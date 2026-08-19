<h1 align="center">dsh-plugin-deploy</h1>

<p align="center">
  <b>Ship a project to Cloudflare in one sentence. Publish a plugin to npm in one more.</b><br>
  A DeepSeek Harness plugin · No cloud account needed for your first deploy · Credentials never reach the model
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-plugin-deploy"><img alt="npm" src="https://img.shields.io/npm/v/dsh-plugin-deploy?color=cb3837&logo=npm" /></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-blue.svg" /></a>
  <a href="https://deepseek-harness.github.io/deepseek-harness/"><img alt="harness" src="https://img.shields.io/badge/harness-0.1.0--rc.7-4c1?logo=deepseek" /></a>
  <img alt="tests" src="https://img.shields.io/badge/tests-96%20passed-brightgreen" />
  <img alt="tracks" src="https://img.shields.io/badge/track-Host%20%2B%20Web%20UI-8957e5" />
</p>

<p align="center">
  <a href="README.md">简体中文</a> · <b>English</b>
</p>

> This is the English companion to the Chinese [README.md](README.md), which is the source of truth. When they disagree, the Chinese version wins.

---

```
You:   ship this site for me

Agent: calling deploy …
       ┌─────────────────────────────────────────┐
       │ Temporary preview URL                    │
       │ https://my-site.breezy-broom.workers.dev │
       │ ⏱ Claim it or it gets deleted · 60 min   │
       │ [Open claim link]                        │
       └─────────────────────────────────────────┘
```

**You get a live URL without owning a Cloudflare account.** Not a mock — this uses Cloudflare's official temporary preview accounts, which their docs describe as built for AI agents.

---

## What it solves

Your agent just wrote a site, a Worker, a plugin — and then you hit the last mile:

| What you want | Without this plugin | With it |
|---|---|---|
| Put a page online to look at it | sign up → create project → install wrangler → write config → debug auth | say "ship it", get a URL |
| Deploy to your own account | handle auth state and `wrangler.jsonc` every time | store a credential *reference* once, then one sentence |
| Publish a dsh plugin you built | manually check 8 failure points → `npm pack` → `npm publish` hits 2FA | one command; it refuses to publish if checks fail |

And it does not trade away safety for convenience: tokens never enter the conversation or the log, and every outward action needs your explicit approval.

---

## Quick start

```sh
# Install into your dsh profile (pnpm must be on PATH)
npx @deepseek-ai/dsh plugin --profile web add dsh-plugin-deploy

# Boot
npx @deepseek-ai/dsh web
```

Then just say:

> ship the `./my-site` directory for me

That's it. **No account required the first time** — the plugin uses a Cloudflare temporary preview account and hands you a working URL in under a minute.

> [!NOTE]
> Requires [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/) ≥ 4.102.0 locally (the version that supports temporary previews). If it is missing, the plugin tells you how to install it instead of failing silently.

> [!TIP]
> **Just published and not getting the new version?** pnpm's `minimumReleaseAge` supply-chain guard skips freshly published versions during a cooldown, so `add dsh-plugin-deploy` may resolve to the previous one. Pin it explicitly to get the latest right away: `add dsh-plugin-deploy@0.1.1`.

---

## Capability 1 — Deploy a project to Cloudflare

Tool `deploy`, slash command `/deploy`.

| Mode | For whom | You get | Account needed |
|---|---|---|---|
| **`temporary`** | want to see it now, no Cloudflare account yet | a `*.workers.dev` URL + a **60-minute** claim window | ❌ no |
| **`account`** | want a permanent address | a persistent URL under your account | ✅ yes (token or `wrangler login`) |

Default is `auto`: authenticated locally → `account`, otherwise → `temporary`. Ask for one explicitly and you get it.

> [!WARNING]
> **If you do not claim within 60 minutes, Cloudflare deletes the temporary account and everything in it.**
> The result card shows the countdown and the claim link, and later deploys remind you about unclaimed ones.
> The claim link is itself a credential and appears in the session record — **do not share that session**.

The plugin is careful with wording: a temporary preview is always called a *temporary preview URL*, never "live" or "published".

**Supported project shapes**: static directories, Vite-style build output (`dist/`), and existing Worker projects with `wrangler.jsonc` / `.toml` / `.json`. When it cannot tell, **it asks** instead of guessing. For projects without a wrangler config it generates one in a system temp directory — **it never writes files into your repository**.

---

## Capability 2 — Publish the dsh plugin you built

Tool `publish_plugin`, slash command `/publish-plugin`. This one is for **plugin authors**.

```sh
check   # verify only, zero side effects (default)
pack    # verified → produce a .tgz
npm     # verified + your approval → publish to npm
```

### The checks are the point

Plenty of plugins in the wild install but never activate, or publish with files missing. Eight checks run before anything else:

| Check | What it catches |
|---|---|
| `dsh-plugin` | missing `dsh.bundle.patch` → installs but never activates (one stderr warning is your only clue) |
| `patch-in-pack` | patch file not in the npm tarball → same failure, even quieter |
| `client-bundle` | `lib/client.js` is not a factory bundle, or its id ≠ package name → `loaded without registering` in the browser |
| `main-entry` | main entry missing from the tarball |
| `deps` | leftover `workspace:` protocol → nobody can install it; `@deepseek-ai/dsh*` pinned to `0.0.x` → wrong train |
| `pack-clean` | `.env` / `.npmrc` / private keys / `node_modules` leaking into the package |
| `version-available` | version already taken |
| `scan` | if your repo has [dsh-plugin-assistant](https://github.com/Octo-o-o-o/dsh-plugin-assistant) installed, its rule scan runs too |

**If any check fails, neither `pack` nor `npm` runs** (fail closed).

### About npm tokens

npm does **not** read tokens from environment variables. The plugin writes a temporary `.npmrc` containing only the reference `${DSH_NPM_TOKEN}`, passes the real value through the process environment, and deletes the file afterwards. **Your `~/.npmrc` is never touched and the token never lands on disk.**

> [!TIP]
> With 2FA enabled, an ordinary token stalls on the OTP prompt. Use an **automation token**, or a granular token with "Bypass 2FA" — set a short expiry and revoke it when you are done.

---

## Don't want to type? There's a button

After install, a **Publish** button appears in the session header beside the title. Click it for two options:

| Option | Equivalent to typing |
|---|---|
| Deploy to Cloudflare | "deploy the current workspace to Cloudflare" |
| Check plugin publish | "check whether the current workspace can be published as a dsh plugin" |

> [!IMPORTANT]
> The button does **not** bypass the agent. It writes that sentence into the composer and submits it — everything downstream is unchanged: the model calls the tool, terms confirmation, approval, result card, session record.
>
> That is deliberate. dsh's `approval.request()` requires an **open agent turn** (source: `the approval/asked + approval/decided audit pair must be turn-enclosed`). A UI-triggered action gets no approval and leaves no session record — unacceptable for irreversible outward actions.

**Which directory does it target?** No hardcoded path — it uses the **current session workspace**. So point the workspace at your project or plugin repo. If the workspace is a container directory, the agent will tell you it is not a plugin package; just say which directory you mean.

The button disables itself when the draft is non-empty (`setDraft` overwrites wholesale, so it will not clobber a half-typed message) and while the agent is busy.

Result cards also carry **Redeploy** / **Re-check** buttons on the same path.

---

## Configuring credentials

**Settings → Plugins → Cloudflare deploy**:

| Field | What goes in | Note |
|---|---|---|
| API token reference | default `CLOUDFLARE_API_TOKEN` | this is a **name**, not the token |
| npm token reference | default `NPM_TOKEN` | same |
| Write token value (write-only) | paste the real token | the box clears on save and **never refills** |

Two layers by design: **configuration stores only references**, **values live in the dsh credentials service** (`$DSH_HOME/.credentials.yaml`, mode `0600`). The card can only tell you *configured / not configured* — no surface ever returns the value.

---

## Why it interrupts you

Two deliberate stops:

**1. Terms of service** (temporary previews only). Creating a temporary account means accepting Cloudflare's terms. Wrangler auto-accepts them in non-interactive environments — the plugin refuses that default and shows you both links to confirm.

**2. Approval.** Deploying publicly and publishing to npm are irreversible. The plugin requests one-shot authorization through the dsh approval channel and continues **only** on an explicit allow. Deny, timeout, or an unavailable approver all abort (fail closed). The approval reason carries no credentials.

---

## Security design

| Measure | How |
|---|---|
| Credentials stay out of model context | tool parameters contain **no** token fields, only reference names; values travel via process env |
| Credentials stay out of the log | dsh's core invariant is "model-visible ⟺ logged", so tokens never enter command lines, result text, or approval reasons |
| Output redaction | command output is filtered for token / `_authToken` / `Bearer` shapes before it is returned |
| Your environment stays clean | temp configs, tarballs, and npm cache all go to system temp; `~/.wrangler` and `~/.npmrc` are never modified |
| Temporary previews run isolated | a separate `HOME`, so it cannot read your local Cloudflare credentials — and **you never have to log out** |
| Irreversible actions need approval | both deploy and publish |

---

## Known limitations

Stated plainly:

- **Cloudflare only.** No Vercel / Netlify / VPS / custom domains / rollback / Next.js SSR (OpenNext).
- **Temporary previews expire in 60 minutes** unless claimed. Cloudflare's rule; the plugin can only remind you.
- **Temporary account asset caps**: ≤1,000 files, ≤5 MiB each.
- **In `account` mode wrangler writes `~/.wrangler/logs`**, which can raise `EPERM` under the Workspace Write sandbox. Measured to be harmless noise (exit code 0).
- **stderr is capped at 64 KB** (harness exposes no `stderrMaxBytes`), so extreme diagnostics may truncate.
- **Publishing covers npm and tarball only.** GitHub installs and [dsh.pub](https://dsh.pub) listing are pointed at, never performed for you.
- **Not verified on TUI / headless profiles.** Fail-closed by construction, but without a live run to prove it.
- Requires dsh **`0.1.0-rc.7`**. Earlier releases (e.g. rc.5) declare slots differently and will fail to load.

---

## FAQ

<details>
<summary><b>"Already authenticated, cannot use temporary preview" — now what?</b></summary>

Older builds did that. **Not anymore**: when you explicitly ask for a temporary preview, the plugin runs with an isolated `HOME` that cannot see your local credentials, so **no `wrangler logout` is needed**. Seeing this message means you are on an old version.
</details>

<details>
<summary><b>The temporary URL 404s.</b></summary>

Edge propagation lag on a freshly created temporary account. Retry after 10–20 seconds; measured at roughly 12 seconds to a 200.
</details>

<details>
<summary><b>Will it litter my project directory?</b></summary>

No. Temp wrangler configs, tarballs, and npm cache all live in the system temp directory. An early build did write a generated config into the project root — which then got served publicly as a static asset. That is fixed, with an `.assetsignore` safety net.
</details>

<details>
<summary><b>npm publish stalls on OTP.</b></summary>

Your account has 2FA. Use an automation token, or a granular token with "Bypass two-factor authentication". Prefer a short expiry and revoke after use.
</details>

<details>
<summary><b>Can it deploy Next.js?</b></summary>

Static export, yes. SSR needs the [OpenNext adapter](https://github.com/opennextjs/opennextjs-cloudflare), which this version does not handle — it will tell you so rather than pretend.
</details>

<details>
<summary><b>Where do credentials live? Are they uploaded?</b></summary>

In the dsh credentials service (`$DSH_HOME/.credentials.yaml`, `0600`). They are passed to the wrangler / npm child process to perform the deployment and nowhere else. The plugin itself phones nothing home.
</details>

---

## Developing from source

```sh
git clone https://github.com/Octo-o-o-o/dsh-plugin-deploy.git
cd dsh-plugin-deploy
npm install
node build.mjs                      # builds lib/index.js and lib/client.js
node --test tests/*.test.js         # 96 unit tests

npx @deepseek-ai/dsh plugin --profile web add "$PWD"   # absolute path required
```

The browser artifact must be dsh's lazy-CJS factory bundle (`window.__ModuleLoader__.load({id, factory})`). `build.mjs` already wires banner + intro + footer — **all three are required**; dropping the intro throws `module is not defined` in the browser.

---

## Credits

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — the everything-is-a-plugin agent harness
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) — [temporary preview accounts](https://developers.cloudflare.com/workers/platform/claim-deployments/)
- [dsh-plugin-assistant](https://github.com/Octo-o-o-o/dsh-plugin-assistant) — the rule pack used to build this plugin: a version-pinned fact layer plus an edit-time gate
- [dsh.pub](https://dsh.pub) — the community plugin catalog

Not affiliated with DeepSeek.

## License

[MIT](LICENSE)
