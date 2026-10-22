# Deployment guide

**Nothing has been deployed.** No domain, DNS, Vercel project or remote has been created or changed. No upload of any kind has been made. The steps below are for the owner to run once they authorise a preview deployment, and later production.

## 1. Requirements
- Node 22 or later (developed on Node 24.7).
- pnpm **11.25.0**. Both `package.json` files pin it in `packageManager`, so `corepack enable` selects it.
- `pnpm-workspace.yaml` in each package allows the `esbuild` and `sharp` build scripts. That `allowBuilds` setting is pnpm 11 syntax.

## 2. Build modes

| Command (in `app/`) | Output | Test hooks (`window.__app`, `window.__basin`) | Developer tools (debug HUD, fly/number keys, `?debug=1`) |
|---|---|---|---|
| `pnpm dev` | dev server | yes | yes (world dev server) |
| `pnpm build` | `dist/`, **the only output to deploy** | **no**, compiled out | **no**, compiled out |
| `pnpm build:qa` | `dist-qa/` | yes | no |

- `pnpm build` ends with `scripts/check-dist.mjs`. It **fails the build** if `dist/` contains any of these:
  - test hooks or debug UI strings;
  - source maps;
  - a world URL that would redirect;
  - anything shaped like a credential, or a phone-number-like digit sequence.
- `pnpm build` and `pnpm build:qa` both write the world into `public/world/`. Always run `pnpm build` last before deploying. The guard catches a stale QA world if you forget.

## 3. Local verification (all offline)

```sh
cd world-prototype && pnpm install && cd ../app && pnpm install

pnpm test                    # 29 unit tests: content, 42-anchor mapping, protocol guards, release guard
pnpm build:qa && pnpm preview:qa   # QA build on :4322 (leave running)
pnpm e2e                     # 58 browser checks against the QA build (needs the hooks)
pnpm build && pnpm preview   # production build on :4321 (leave running)
pnpm e2e:prod                # 23 browser checks against the hook-free production build
node e2e/a11y.mjs            # measured contrast, structure, focus rings, targets, reduced motion (exit 1 on any failure)
node e2e/lowpower.mjs        # SwiftShader (no GPU): software-renderer map mode, "load anyway", frame-rate watchdog
node e2e/measure.mjs         # headless timings, transfer sizes, long tasks (QA build on :4322)
```

The browser suites drive an installed Chrome or Brave through `puppeteer-core`. Set `CHROME=/path/to/chrome` if neither is in the default macOS location.

**Vercel routing, locally.** This needs no login and uploads nothing:

```sh
VERCEL_TELEMETRY_DISABLED=1 vercel build --yes   # writes .vercel/output (git-ignored)
node e2e/vercel-local.mjs 4330                   # replays .vercel/output/config.json routes over the static files
node e2e/prod.mjs --base http://127.0.0.1:4330
```

- `vercel build` needs `app/.vercel/project.json`. A placeholder (`projectId`/`orgId` set to `local-validation-only`) was used for validation; it is git-ignored.
- `vercel-local.mjs` approximates Vercel's routing. It does not replace a real preview deployment.

The world still runs on its own: `cd world-prototype && pnpm dev` → http://127.0.0.1:5173, with the debug HUD. Its regression suites are `node tools/qa.mjs` (27 checks) and `node tools/drive.mjs`.

## 4. Vercel project settings (for the owner, when authorised)

| Setting | Value |
|---|---|
| Root Directory | `app` |
| Include files outside the root directory | **enabled** (the default); the build compiles `../world-prototype` |
| Framework preset | Astro (no adapter; output is static) |
| Install / Build / Output | from `app/vercel.json`: install both packages; `pnpm build`; `dist` |
| Node.js | 22.x or later (`engines` says `>=22`; Vercel then picks its newest supported major) |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1`, in **both** Preview and Production. Without it Vercel chooses pnpm 9 or 10 from the lockfile version, and those ignore the pnpm 11 `allowBuilds` setting. This is **unverified on Vercel**: the local `vercel build` used the local pnpm 11 |

**Environment variables:**

| Variable | Preview | Production |
|---|---|---|
| `SITE` | **leave unset**: canonical, `og:url` and sitemap entries are omitted, so no preview URL is published as canonical and no wrong domain appears | `https://<your-domain>`, a bare https origin. The build **refuses** anything else (http, a path, a query) |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` | `1` |
| `TEST_HOOKS` | **never set** | **never set** |

No secrets, API keys, analytics or third-party services are used. Client code needs no credentials.

**What `vercel.json` provides:**
- `cleanUrls` and no trailing slashes;
- immutable caching for hashed assets (`/_astro/*`, `/world/assets/*`);
- `X-Content-Type-Options`, `Referrer-Policy`, and `X-Frame-Options: SAMEORIGIN` (the world iframe must stay same-origin).

**The world URL is `/world/basin`.** `cleanUrls` 308-redirects any `…/index.html` to its directory without a trailing slash, where the world's relative `./assets/` paths would 404. That is why the world's entry is published as `basin.html` and loaded as `/world/basin`. Phase 4 found and fixed this, and the release guard rejects `/world/index.html`.

## 5. Preview-deployment checklist (requires the owner's separate authorisation)
1. Push the branch, or connect the repository to Vercel, only once authorised.
2. Create the project with the §4 settings. Set `ENABLE_EXPERIMENTAL_COREPACK=1`. Leave `SITE` unset for Preview.
3. In the build log, confirm:
   - pnpm 11.25.0 is used;
   - `astro check` reports 0 errors;
   - the last lines include `[check-dist] OK`.
4. Against the preview URL (Vercel normally sends `X-Robots-Tag: noindex` on preview URLs; confirm it in the response headers):

   ```sh
   cd app && node e2e/prod.mjs --base https://<preview-url>
   node e2e/a11y.mjs --base https://<preview-url>
   ```

   Then check by hand:
   - `/world/basin?embed=1` returns 200 (no redirect), with `X-Frame-Options: SAMEORIGIN`;
   - `/work/evdoctor/` and `/work/evdoctor.html` 308-redirect to `/work/evdoctor`;
   - `/nope` returns the 404 page;
   - `/robots.txt` and `/sitemap.xml` return 200;
   - the browser console on `/` shows only the two known `THREE` deprecation warnings.
5. Run the manual checks in RELEASE_READINESS.md §7 on the preview: a phone, a screen reader, a low-end laptop.
6. Production comes later: set `SITE`, attach the domain and promote. Each step needs separate authorisation.

## 6. Owner decisions before production
- **Résumé PDF.** `app/public/resume.pdf` is git-ignored and absent, because the supplied résumé includes a phone number. To publish one, add a version without the phone number and remove that line from `app/.gitignore`. The header link and Field Office page switch over automatically. The release guard scans HTML, XML, TXT and JSON for phone-like numbers, **not PDFs**, so check the PDF by hand.
- **LinkedIn.** The URL comes from the résumé. Confirm `https://www.linkedin.com/in/1hpdhruv` by hand; automated checks get HTTP 999.
- **Domain.** Choose one and set `SITE` for Production only.
- **Screenshots.** `world-prototype/screenshots/pass2.1/` (about 90 MB of PNG) is git-ignored local evidence. JPEG selections are committed in `world-prototype/screenshots/review-pack/` and `docs/screenshots/`.

## 7. Rollback
The site is static; Vercel's “Promote previous deployment” is an instant rollback. There is no data or state to migrate.
