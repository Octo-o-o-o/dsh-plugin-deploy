#!/usr/bin/env bash
# scan-dsh-plugin.sh — 扫描 DeepSeek Harness 树外插件仓里「AI 一定会写错、且 grep 抓得住」的反模式。
#
# 用法：
#   scan-dsh-plugin.sh <file>                 扫一个文件（hook 用），人类可读输出
#   scan-dsh-plugin.sh --json <file>          JSON 数组（CI 友好）
#   scan-dsh-plugin.sh --stats <file>         按规则计数
#   scan-dsh-plugin.sh [--json] --all <dir>   扫整个插件仓（发布前 / CI）
#
# 退出码：
#   2   存在 HIGH（应阻塞，让 AI 当场改）
#   1   仅有 MEDIUM / LOW（提醒）
#   0   干净
#   64  参数错误 / 文件不存在
#
# 规则 ID 稳定（被 hook / CI / fixtures 引用；改语义先改 fixture）：
#   DSH-HOST-001   HIGH    函数插件（named export apply）同时 export default → Loader 丢掉 name/inject/Config（postmortem 0001）
#   DSH-HOST-002   MEDIUM  waterfall 事件监听器未调用 next()（静默短路整条链）
#   DSH-HOST-003   MEDIUM  Config 导出为普通对象（必须是 Schemastery schema）
#   DSH-PKG-001    HIGH    package.json 对 @deepseek-ai/* 用 workspace: 协议（monorepo 内部写法，树外装不上）
#   DSH-PKG-002    HIGH    有 cordis.patch.yml 但未声明 dsh.bundle.patch，或 patch 路径不存在（装了不激活）
#   DSH-PKG-003    HIGH    依赖 @deepseek-ai/dsh* 写成 0.0.x（npm latest 旧 train）；latest/* 为 MEDIUM
#   DSH-PKG-004    MEDIUM  files 白名单漏掉 patch 文件 / client bundle（npm 发布会丢）
#   DSH-CLIENT-001 HIGH    exports["./client"] 指向的 bundle 不是 window.__ModuleLoader__.load({id,factory}) 形态或 id ≠ 包名
#   DSH-CLIENT-002 MEDIUM  客户端源码 value-import 了宿主平台模块，但构建配置未把它列为 external
#   DSH-CLIENT-003 HIGH    client bundle 有 __ModuleLoader__.load banner 但缺 module/exports 声明（官方 preset 的 intro 段），浏览器里必抛 module is not defined
#   DSH-CLI-001    MEDIUM  文档/脚本写了不存在的 `dsh plugin install`，或 `dsh plugin add/remove/update` 漏 --profile
#   DSH-SEC-001    HIGH    疑似真实 token / 密钥，或本机家目录绝对路径（/Users/<name>/、/home/<name>/）入仓
#
# 行内抑制：在命中行加 `dsh-scan-ignore` 或 `dsh-scan-ignore: DSH-XXX-000`。
# --all 跳过规则包自身装进来的文件（.dsh-assistant/、.agents|.claude/skills/dsh-plugin-*）与 test-fixtures/。
# 事实来源：waterfall 事件表与 externals 列表优先从同级 reference/ 目录（钉版本生成）读取，读不到用内置默认值。

set -u

MODE="human"
ALL_DIR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --json) MODE="json"; shift;;
    --stats) MODE="stats"; shift;;
    --all) ALL_DIR="${2:-}"; shift 2;;
    -h|--help) sed -n '2,32p' "$0"; exit 0;;
    *) break;;
  esac
done

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------- 事实表加载（reference/ 由 gen-facts.mjs 生成；下游布局 .dsh-assistant/{hooks,reference}，本仓布局 tools/hooks + docs/reference） ----------
find_reference_dir() {
  local c
  for c in "$HERE/../../reference" "$HERE/../../../docs/reference" "${DSH_ASSISTANT_REFERENCE:-}"; do
    [[ -n "$c" && -d "$c" ]] && { (cd "$c" && pwd); return; }
  done
}
REFERENCE_DIR="$(find_reference_dir || true)"

# 从 markdown 里取「某标题之后第一个 ```json 数组」的字符串元素
json_list_from_md() {
  local file="$1" marker="$2"
  [[ -f "$file" ]] || return 1
  awk -v marker="$marker" '
    index($0, marker) { armed=1; next }
    armed && /^```json/ { inb=1; next }
    inb && /^```/ { exit }
    inb { print }
  ' "$file" | tr -d '[],"' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | grep -v '^$'
}

DEFAULT_WATERFALL="agent/pre-step agent/request agent/request-error approval/request fs/edit-intent fs/write-intent llm/stream session-telemetry/record system-prompt/assemble tools/code-dispatch-log tools/execute tools/post-execute tools/pre-execute"
DEFAULT_EXTERNALS="react react/jsx-runtime react-dom react-dom/client @deepseek-ai/cordis @deepseek-ai/dsh-client-ui-slots @deepseek-ai/dsh-client-ui-primitives @deepseek-ai/dsh-client-runtime/client"

WATERFALL_EVENTS="$DEFAULT_WATERFALL"
EXTERNALS="$DEFAULT_EXTERNALS"
if [[ -n "$REFERENCE_DIR" ]]; then
  w="$(json_list_from_md "$REFERENCE_DIR/events.md" '## waterfall' 2>/dev/null | tr '\n' ' ')"
  [[ -n "${w// /}" ]] && WATERFALL_EVENTS="$w"
  e="$(json_list_from_md "$REFERENCE_DIR/client-externals.md" 'CLIENT_EXTERNALS' 2>/dev/null | tr '\n' ' ')"
  [[ -n "${e// /}" ]] && EXTERNALS="$e"
fi

# ---------- 结果收集 ----------
FINDINGS=()
WORST=0

sev_rank() { case "$1" in HIGH) echo 2;; MEDIUM|LOW) echo 1;; *) echo 0;; esac; }

# 行内抑制：命中行含 dsh-scan-ignore（可带规则 ID）
suppressed() {
  local file="$1" line="$2" rule="$3" text
  text="$(sed -n "${line}p" "$file" 2>/dev/null)"
  case "$text" in
    *"dsh-scan-ignore: $rule"*|*"dsh-scan-ignore:$rule"*) return 0;;
    *"dsh-scan-ignore:"*) return 1;;
    *dsh-scan-ignore*) return 0;;
  esac
  return 1
}

add_finding() {
  local rule="$1" sev="$2" line="$3" msg="$4"
  suppressed "$ORIG_FILE" "$line" "$rule" && return 0
  FINDINGS+=("$rule	$sev	$ORIG_FILE	$line	$msg")
  local r; r="$(sev_rank "$sev")"
  [[ "$r" -gt "$WORST" ]] && WORST="$r"
  return 0
}

is_comment_line() {
  local c; c="$(printf '%s' "$1" | sed 's/^[[:space:]]*//')"
  case "$c" in
    //*|\**|/\**) return 0;;
    *) return 1;;
  esac
}

# 把 /* ... */ 块注释刷成等长空白（保留行号）
scrub_block_comments() {
  awk '
  {
    line=$0; out=""; i=1; n=length(line)
    while (i<=n) {
      two=substr(line,i,2)
      if (inb) { if (two=="*/"){inb=0;out=out"  ";i+=2} else {out=out" ";i++} }
      else { if (two=="/*"){inb=1;out=out"  ";i+=2} else {out=out substr(line,i,1);i++} }
    }
    print out
  }' "$1"
}

code_has() {
  local m content
  while IFS= read -r m; do
    content="${m#*:}"
    is_comment_line "$content" && continue
    return 0
  done < <(grep -nE "$1" "$FILE" 2>/dev/null || true)
  return 1
}
first_line() {
  local m ln content
  while IFS= read -r m; do
    ln="${m%%:*}"; content="${m#*:}"
    is_comment_line "$content" && continue
    echo "$ln"; return
  done < <(grep -nE "$1" "$FILE" 2>/dev/null || true)
  echo 1
}
find_rule() {
  local rule="$1" sev="$2" msg="$3" pat="$4"
  local m ln content
  while IFS= read -r m; do
    [[ -z "$m" ]] && continue
    ln="${m%%:*}"; content="${m#*:}"
    is_comment_line "$content" && continue
    add_finding "$rule" "$sev" "$ln" "$msg"
  done < <(grep -nE "$pat" "$FILE" 2>/dev/null || true)
}

# 找最近的 package.json 目录
nearest_pkg_dir() {
  local d; d="$(cd "$(dirname "$1")" && pwd)"
  while [[ "$d" != "/" ]]; do
    [[ -f "$d/package.json" ]] && { echo "$d"; return 0; }
    d="$(dirname "$d")"
  done
  return 1
}

# 用 node 读 package.json 字段（缺 node 时返回空）
pkg_field() {
  local pkg="$1" expr="$2"
  command -v node >/dev/null 2>&1 || return 1
  node -e '
    const fs = require("fs");
    let j; try { j = JSON.parse(fs.readFileSync(process.argv[1], "utf8")) } catch { process.exit(1) }
    const v = (function(){ try { return eval(process.argv[2]) } catch { return undefined } })();
    if (v === undefined || v === null) process.exit(0);
    process.stdout.write(typeof v === "string" ? v : JSON.stringify(v));
  ' "$pkg" "$expr" 2>/dev/null
}

# ---------- 单文件扫描 ----------
scan_one() {
  ORIG_FILE="$1"
  FILE="$ORIG_FILE"
  local base dir pkgdir SCRUBBED=""
  base="$(basename "$ORIG_FILE")"
  dir="$(cd "$(dirname "$ORIG_FILE")" && pwd)"

  # 二进制跳过
  if ! grep -Iq . "$ORIG_FILE" 2>/dev/null; then return 0; fi

  # 代码文件：先把块注释刷白（保留行号），凭据类规则与代码规则都在刷白副本上跑；家目录路径规则仍看原文（注释里的本机路径也是泄漏）
  case "$base" in
    *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs)
      SCRUBBED="$(mktemp 2>/dev/null || echo "/tmp/dsh-scrub-$$")"
      if scrub_block_comments "$ORIG_FILE" > "$SCRUBBED" 2>/dev/null; then FILE="$SCRUBBED"; fi
      ;;
  esac

  # ---- DSH-SEC-001：任何文本文件 ----
  local m ln content tok
  while IFS= read -r m; do
    [[ -z "$m" ]] && continue
    ln="${m%%:*}"; content="${m#*:}"
    is_comment_line "$content" && continue
    tok="$(printf '%s' "$content" | grep -oE 'Bearer [A-Za-z0-9][A-Za-z0-9._-]{15,}' | head -1 | sed 's/^Bearer //')"
    if [[ -n "$tok" ]]; then
      case "$tok" in *PLACEHOLDER*|*placeholder*|*YOUR_*|*EXAMPLE*|*example*|*XXXX*|*xxxx*|*TOKEN*|*token*|*'<'*|*'$'*|*'{'*) tok="";; esac
      [[ -n "$tok" ]] && printf '%s' "$tok" | grep -qE '^[A-Z0-9_]+$' && tok=""
    fi
    if [[ -n "$tok" ]] || printf '%s' "$content" | grep -qE '(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|xox[bap]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16})'; then
      add_finding "DSH-SEC-001" "HIGH" "$ln" "疑似真实凭据入仓；示例只能用占位符，真值走环境变量 / credentials 提供者"
    fi
  done < <(grep -nE '(Bearer [A-Za-z0-9][A-Za-z0-9._-]{15,}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|xox[bap]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16})' "$FILE" 2>/dev/null || true)
  while IFS= read -r m; do
    [[ -z "$m" ]] && continue
    ln="${m%%:*}"; content="${m#*:}"
    local who
    who="$(printf '%s' "$content" | grep -oE '/(Users|home)/[A-Za-z0-9._-]+/' | head -1 | sed -E 's#^/(Users|home)/##; s#/$##')"
    case "$who" in
      you|your|yourname|username|user|name|me|USER|USERNAME|example|foo|bar|alice|bob|xxx|XXX|someone|owner|dev|developer|runner|jenkins|ubuntu|node|root|"") continue;;
    esac
    printf '%s' "$who" | grep -qE '^[A-Z_]+$' && continue
    add_finding "DSH-SEC-001" "HIGH" "$ln" "本机家目录绝对路径入仓（/Users|/home/<name>/）；改用 ~ 或相对路径 / 环境变量"
  done < <(grep -nE '/(Users|home)/[A-Za-z0-9._-]+/' "$ORIG_FILE" 2>/dev/null || true)

  # ---- DSH-CLI-001：任何文本文件 ----
  while IFS= read -r m; do
    [[ -z "$m" ]] && continue
    ln="${m%%:*}"; content="${m#*:}"
    printf '%s' "$content" | grep -qE '没有|不存在|不是|错误|误写|❌|does not exist|not exist|no such|not a |invalid|wrong|instead|nonexistent|non-existent' && continue
    if printf '%s' "$content" | grep -qE 'dsh plugin install'; then
      add_finding "DSH-CLI-001" "MEDIUM" "$ln" "不存在 dsh plugin install；dsh plugin 是 pnpm 转发器：dsh plugin --profile <name> add <pkg|abs-path>"
    elif printf '%s' "$content" | grep -qE 'dsh plugin (add|remove|update|rm|i)( |$)' && ! printf '%s' "$content" | grep -qE -- '--profile'; then
      add_finding "DSH-CLI-001" "MEDIUM" "$ln" "dsh plugin 需要 --profile <name>（源码 args.ts：--profile <name> is required）"
    fi
  done < <(grep -nE 'dsh plugin (install|add|remove|update|rm|i)( |$)' "$ORIG_FILE" 2>/dev/null || true)

  # ---- package.json 规则 ----
  if [[ "$base" == "package.json" ]]; then
    find_rule "DSH-PKG-001" "HIGH" "树外插件不能对 @deepseek-ai/* 用 workspace: 协议；改为 npm 版本（注意 dist-tag，见 reference/npm-dist-tags.md）" \
      '"@deepseek-ai/[^"]+"[[:space:]]*:[[:space:]]*"workspace:'

    # DSH-PKG-003：@deepseek-ai/dsh* 的版本 spec
    while IFS= read -r m; do
      [[ -z "$m" ]] && continue
      ln="${m%%:*}"; content="${m#*:}"
      local spec
      spec="$(printf '%s' "$content" | sed -E 's/.*"@deepseek-ai\/dsh[^"]*"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/')"
      case "$spec" in
        workspace:*) ;;  # PKG-001 已报
        0.0.*|~0.0.*|^0.0.*|=0.0.*|"0.0."*) add_finding "DSH-PKG-003" "HIGH" "$ln" "@deepseek-ai/dsh* 的 0.0.x 是 npm latest 指向的旧 train，装上跑不起来；写 next tag 或精确版本 0.1.0-rc.N（见 reference/npm-dist-tags.md）";;
        latest|"*"|"") add_finding "DSH-PKG-003" "MEDIUM" "$ln" "@deepseek-ai/dsh* 未钉版本（latest/*）；多数子包 latest≠next，请写 next 或精确版本";;
      esac
    done < <(grep -nE '"@deepseek-ai/dsh[^"]*"[[:space:]]*:[[:space:]]*"' "$ORIG_FILE" 2>/dev/null || true)

    # DSH-PKG-002 / 004 / CLIENT-001（需要 node 解析）
    if command -v node >/dev/null 2>&1; then
      local patch name client_export files_json
      patch="$(pkg_field "$ORIG_FILE" 'j.dsh && j.dsh.bundle && j.dsh.bundle.patch')"
      name="$(pkg_field "$ORIG_FILE" 'j.name')"
      if [[ -n "$patch" ]]; then
        if [[ ! -f "$dir/${patch#./}" ]]; then
          add_finding "DSH-PKG-002" "HIGH" "$(first_line '"patch"')" "dsh.bundle.patch 指向不存在的文件 $patch"
        fi
        files_json="$(pkg_field "$ORIG_FILE" 'Array.isArray(j.files) ? j.files.join("\n") : ""')"
        if [[ -n "$files_json" ]] && ! printf '%s\n' "$files_json" | grep -qxF "${patch#./}"; then
          add_finding "DSH-PKG-004" "MEDIUM" "$(first_line '"files"')" "files 白名单未包含 ${patch#./}（npm 发布会丢掉 patch，装上不激活）"
        fi
      elif [[ -f "$dir/cordis.patch.yml" ]]; then
        add_finding "DSH-PKG-002" "HIGH" "1" "目录里有 cordis.patch.yml，但 package.json 未声明 \"dsh\": {\"bundle\": {\"patch\": \"./cordis.patch.yml\"}} —— dsh plugin --profile <p> add 只会当普通依赖装，不激活层"
      fi
      # client bundle
      client_export="$(pkg_field "$ORIG_FILE" 'j.exports && (typeof j.exports["./client"]==="string" ? j.exports["./client"] : (j.exports["./client"] && j.exports["./client"].default))')"
      local has_client; has_client="$(pkg_field "$ORIG_FILE" 'j.dsh && j.dsh.client ? "yes" : ""')"
      if [[ "$has_client" == "yes" ]]; then
        if [[ -z "$client_export" ]]; then
          add_finding "DSH-CLIENT-001" "HIGH" "$(first_line '"client"')" "声明了 dsh.client 但没有 exports[\"./client\"]（宿主报 declares dsh.client but exports no ./client bundle）"
        else
          local cf="$dir/${client_export#./}"
          if [[ -f "$cf" ]]; then
            check_client_bundle "$cf" "$name" "$(first_line '"./client"')"
          fi
          files_json="$(pkg_field "$ORIG_FILE" 'Array.isArray(j.files) ? j.files.join("\n") : ""')"
          if [[ -n "$files_json" ]] && ! printf '%s\n' "$files_json" | grep -qE "^(${client_export#./}|$(dirname "${client_export#./}")(/.*)?)$"; then
            add_finding "DSH-PKG-004" "MEDIUM" "$(first_line '"files"')" "files 白名单未包含 ${client_export#./}（npm 发布会丢掉 client bundle）"
          fi
        fi
      fi
    fi
  fi

  # cordis.patch.yml 被改动：检查同级 package.json 是否声明了它
  if [[ "$base" == "cordis.patch.yml" && -f "$dir/package.json" ]] && command -v node >/dev/null 2>&1; then
    local p; p="$(pkg_field "$dir/package.json" 'j.dsh && j.dsh.bundle && j.dsh.bundle.patch')"
    if [[ -z "$p" ]]; then
      add_finding "DSH-PKG-002" "HIGH" "1" "同级 package.json 未声明 dsh.bundle.patch 指向本文件 —— dsh plugin --profile <p> add 只会当普通依赖装，不激活层"
    fi
  fi

  # 构建产物 client bundle 被直接改动
  if [[ "$base" == "client.js" || "$base" == "client.cjs" ]] && command -v node >/dev/null 2>&1; then
    if pkgdir="$(nearest_pkg_dir "$ORIG_FILE")"; then
      local hc; hc="$(pkg_field "$pkgdir/package.json" 'j.dsh && j.dsh.client ? "yes" : ""')"
      if [[ "$hc" == "yes" ]]; then
        check_client_bundle "$ORIG_FILE" "$(pkg_field "$pkgdir/package.json" 'j.name')" 1
      fi
    fi
  fi

  # ---- 代码规则 ----
  case "$base" in
    *.ts|*.tsx|*.js|*.jsx|*.mjs)
      # DSH-HOST-001
      if code_has '^[[:space:]]*export[[:space:]]+(async[[:space:]]+)?function[[:space:]]+apply\b|^[[:space:]]*export[[:space:]]+const[[:space:]]+apply\b'; then
        if code_has '^[[:space:]]*export[[:space:]]+default\b'; then
          add_finding "DSH-HOST-001" "HIGH" "$(first_line '^[[:space:]]*export[[:space:]]+default\b')" \
            "函数插件（named export apply）不得同时 export default：Loader 用 exports.default ?? exports 解出裸 apply，name/inject/Config 全丢（postmortem 0001）。删掉 export default，或整体改为对象/类形态"
        fi
      fi

      # DSH-HOST-003
      find_rule "DSH-HOST-003" "MEDIUM" "Config 必须是 Schemastery schema（Standard Schema），不能是普通对象；用 Schema.object({...})（docs/user/develop/basic/config.md）" \
        '^[[:space:]]*export[[:space:]]+(const|let|var)[[:space:]]+Config([[:space:]]*:[^=]+)?[[:space:]]*=[[:space:]]*\{'

      # DSH-HOST-002：waterfall 监听器缺 next()
      while IFS= read -r m; do
        [[ -z "$m" ]] && continue
        ln="${m%%:*}"; content="${m#*:}"
        is_comment_line "$content" && continue
        local ev; ev="$(printf '%s' "$content" | sed -E "s/.*ctx\.on\([[:space:]]*['\"]([^'\"]+)['\"].*/\1/")"
        local is_wf=0 e
        for e in $WATERFALL_EVENTS; do [[ "$e" == "$ev" ]] && is_wf=1; done
        [[ $is_wf -eq 1 ]] || continue
        # 从该行起做圆括号配平，取整个 ctx.on(...) 调用块
        local block; block="$(awk -v start="$ln" '
          NR < start { next }
          { line=$0; o=gsub(/\(/, "(", line); c=gsub(/\)/, ")", line); depth += o - c; print $0; if (NR > start && depth <= 0) exit; if (NR == start && depth <= 0) exit; if (NR - start > 200) exit }
        ' "$FILE")"
        if ! printf '%s' "$block" | grep -qE '\bnext[[:space:]]*\('; then
          add_finding "DSH-HOST-002" "MEDIUM" "$ln" "waterfall 事件 '$ev' 的监听器未调用 next()，会静默短路整条链；只有明确要拦截/接管的策略监听才可省略（有意为之请加 // dsh-scan-ignore: DSH-HOST-002）"
        fi
      done < <(grep -nE "ctx\.on\([[:space:]]*['\"][^'\"]+['\"]" "$FILE" 2>/dev/null || true)

      # DSH-CLIENT-002：客户端源码 externals
      if command -v node >/dev/null 2>&1 && pkgdir="$(nearest_pkg_dir "$ORIG_FILE")"; then
        local hc; hc="$(pkg_field "$pkgdir/package.json" 'j.dsh && j.dsh.client ? "yes" : ""')"
        if [[ "$hc" == "yes" ]] && { [[ "$ORIG_FILE" == */client/* ]] || code_has "from[[:space:]]+['\"]@deepseek-ai/dsh-client-"; }; then
          local imported="" ext
          for ext in $EXTERNALS; do
            if grep -E "^[[:space:]]*import[[:space:]]" "$FILE" | grep -v -E '^[[:space:]]*import[[:space:]]+type[[:space:]]' | grep -qE "from[[:space:]]+['\"]${ext}['\"]|^[[:space:]]*import[[:space:]]+['\"]${ext}['\"]"; then
              imported="$imported $ext"
            fi
          done
          if [[ -n "${imported// /}" ]]; then
            local cfgs; cfgs="$(find "$pkgdir" -maxdepth 2 \( -name 'tsdown.config.*' -o -name 'tsup.config.*' -o -name 'esbuild*' -o -name 'build*.mjs' -o -name 'build*.js' -o -name 'build*.ts' -o -name 'rollup.config.*' -o -name 'vite.config.*' -o -name 'client-bundle*' \) -not -path '*/node_modules/*' 2>/dev/null)"
            if [[ -z "$cfgs" ]]; then
              add_finding "DSH-CLIENT-002" "MEDIUM" "$(first_line 'from[[:space:]]+')" "未找到客户端构建配置（tsdown/tsup/esbuild/rollup/vite）；client bundle 必须把宿主平台模块列为 external：${imported# }（reference/client-externals.md）"
            elif ! printf '%s\n' "$cfgs" | xargs grep -lE 'PLATFORM_MODULES|CLIENT_EXTERNALS|clientBundle\(' >/dev/null 2>&1; then
              local missing="" mod
              for mod in $imported; do
                printf '%s\n' "$cfgs" | xargs grep -qF "'$mod'" 2>/dev/null || printf '%s\n' "$cfgs" | xargs grep -qF "\"$mod\"" 2>/dev/null || missing="$missing $mod"
              done
              [[ -n "${missing// /}" ]] && add_finding "DSH-CLIENT-002" "MEDIUM" "$(first_line 'from[[:space:]]+')" "客户端构建配置未把这些宿主模块列为 external：${missing# }（漏列会打进第二份 React/slots 运行时；reference/client-externals.md）"
            fi
          fi
        fi
      fi
      ;;
  esac

  [[ -n "$SCRUBBED" ]] && rm -f "$SCRUBBED"
  FILE="$ORIG_FILE"
  return 0
}

# exports["./client"] 目标或 lib/client.js 的形态检查
check_client_bundle() {
  local cf="$1" name="$2" ln="$3"
  local rel; rel="${cf#"$PWD"/}"
  if ! grep -qF '__ModuleLoader__.load(' "$cf" 2>/dev/null; then
    add_finding "DSH-CLIENT-001" "HIGH" "$ln" "$rel 不是 factory bundle：宿主要求 window.__ModuleLoader__.load({ id, factory })（交 ESM 会报 loaded without registering；reference/client-externals.md）"
    return 0
  fi
  if [[ -n "$name" ]] && ! grep -qF "\"$name\"" "$cf" 2>/dev/null; then
    add_finding "DSH-CLIENT-001" "HIGH" "$ln" "$rel 的 factory id 不等于包名 \"$name\"（宿主按包名注册/查找）"
  fi
  # 产物引用了 module/exports，就必须自带它们的声明（官方 preset 的 intro 段）。
  # 浏览器全局没有 module——只抄 banner+footer 的构建配置（esbuild 无 intro）会在 factory 物化时抛 ReferenceError。
  if grep -qE '(^|[^.[:alnum:]_$])(module\.exports|exports\.)' "$cf" 2>/dev/null \
     && ! grep -qE '(var|let|const)[[:space:]]+module[[:space:]]*=' "$cf" 2>/dev/null; then
    add_finding "DSH-CLIENT-003" "HIGH" "$ln" "$rel 用了 module/exports 却没有声明它们：官方 preset 是 banner + intro + footer 三段，intro 为 'var module = { exports: {} }; var exports = module.exports;'。esbuild 等只有 banner/footer 的构建器要把 intro 并进 banner，否则浏览器抛 module is not defined（reference/client-externals.md）"
  fi
}

# ---------- 入口 ----------
if [[ -n "$ALL_DIR" ]]; then
  if [[ ! -d "$ALL_DIR" ]]; then echo "scan-dsh-plugin.sh: dir not found: $ALL_DIR" >&2; exit 64; fi
  while IFS= read -r f; do
    scan_one "$f"
  done < <(find "$ALL_DIR" -type f \
      -not -path '*/.git/*' -not -path '*/node_modules/*' -not -path '*/.pnpm-store/*' -not -path '*/coverage/*' \
      -not -path '*/test-fixtures/*' -not -name '*.map' -not -name 'pnpm-lock.yaml' -not -name '*.lock' -not -name '.dsh-plugin-last-scan.txt' \
      -not -path '*/.dsh-assistant/*' -not -path '*/.agents/skills/dsh-plugin-*' -not -path '*/.claude/skills/dsh-plugin-*' \
      \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.mjs' -o -name '*.cjs' -o -name '*.json' -o -name '*.yml' -o -name '*.yaml' -o -name '*.md' -o -name '*.sh' -o -name '*.toml' -o -name '.env*' -o -name '*.env' \) \
      | sort)
else
  TARGET="${1:-}"
  if [[ -z "$TARGET" ]]; then echo "usage: scan-dsh-plugin.sh [--json|--stats] <file> | [--json] --all <dir>" >&2; exit 64; fi
  if [[ ! -f "$TARGET" ]]; then echo "scan-dsh-plugin.sh: file not found: $TARGET" >&2; exit 64; fi
  scan_one "$TARGET"
fi

# ---------- 输出 ----------
relpath() { local p="$1"; printf '%s' "${p#"$PWD"/}"; }

if [[ "$MODE" == "json" ]]; then
  printf '['
  first=1
  for f in "${FINDINGS[@]:-}"; do
    [[ -z "$f" ]] && continue
    rule="$(printf '%s' "$f" | cut -f1)"; sev="$(printf '%s' "$f" | cut -f2)"
    file="$(relpath "$(printf '%s' "$f" | cut -f3)")"; line="$(printf '%s' "$f" | cut -f4)"; msg="$(printf '%s' "$f" | cut -f5-)"
    msg="${msg//\\/\\\\}"; msg="${msg//\"/\\\"}"
    [[ $first -eq 0 ]] && printf ','
    first=0
    printf '{"rule":"%s","severity":"%s","file":"%s","line":%s,"message":"%s"}' "$rule" "$sev" "$file" "$line" "$msg"
  done
  printf ']\n'
elif [[ "$MODE" == "stats" ]]; then
  if [[ ${#FINDINGS[@]} -eq 0 || -z "${FINDINGS[0]:-}" ]]; then
    echo "clean"
  else
    printf '%s\n' "${FINDINGS[@]}" | cut -f1 | sort | uniq -c | sort -rn
  fi
else
  if [[ ${#FINDINGS[@]} -gt 0 && -n "${FINDINGS[0]:-}" ]]; then
    for f in "${FINDINGS[@]}"; do
      [[ -z "$f" ]] && continue
      rule="$(printf '%s' "$f" | cut -f1)"; sev="$(printf '%s' "$f" | cut -f2)"
      file="$(relpath "$(printf '%s' "$f" | cut -f3)")"; line="$(printf '%s' "$f" | cut -f4)"; msg="$(printf '%s' "$f" | cut -f5-)"
      printf '%s [%s] %s:%s  %s\n' "$rule" "$sev" "$file" "$line" "$msg"
    done
  fi
fi

exit "$WORST"
