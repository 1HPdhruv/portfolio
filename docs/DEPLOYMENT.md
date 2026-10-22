# Deployment guide

**Nothing has been deployed.** No domain, DNS, Vercel project or remote has been created or changed. These steps are for the owner to run when they decide to publish.

## 1. Requirements
- Node 22 or later (developed on Node 24.7) and pnpm 11 (`corepack enable`).
- macOS, Linux or Windows. The world build uses `tsx` and `sharp` (for the map image). Both are installed by pnpm.
- `pnpm-workspace.yaml` in each package allows the `esbuild` and `sharp` build scripts. pnpm 11 blocks them otherwise.

## 2. Local verification

```sh
cd world-prototype && pnpm install && cd ../app && pnpm install

pnpm test            # 22 unit tests: content model, 42-anchor mapping, protocol guards
pnpm build           # builds the world into public/world/, renders the map, runs astro check, builds dist/
pnpm preview         # serves dist/ at http://127.0.0.1:4321
pnpm e2e             # (second terminal) 51 real-browser checks against the preview; screenshots → e2e/screenshots/
node e2e/measure.mjs # optional: headless load timings and transfer sizes
```

`pnpm e2e` drives an installed Chrome or Brave through `puppeteer-core`. Set `CHROME=/path/to/chrome` if neither is in the default macOS location.

The world is still independently runnable: `cd world-prototype && pnpm dev` → http://127.0.0.1:5173 (debug HUD on). Its regression suite is `node tools/qa.mjs` (27 checks) and `node tools/drive.mjs`.

**Useful URLs on the preview:**
- `/`
- `/#quick-view`
- `/#map`
- `/work/evdoctor`
- `/research`
- `/?site=agri-terraces/agrisaarthi` (deep link to a site)
- `/?world=0` (map mode) and `/?world=1` (force 3D on a small screen)
- `/?debug=1` (world debug HUD inside the embed)

## 3. Vercel (static)

The app is plain static output (`dist/`). Vercel needs no adapter and no server functions.

1. Import the Git repository in Vercel. Do not push or connect until you have decided to publish.
2. **Root Directory:** `app`. Keep “Include files outside the root directory in the Build Step” **enabled** (the default), because the build compiles `../world-prototype`.
3. Framework preset: Astro, or “Other”. `app/vercel.json` already sets these:
   - install: `pnpm install --frozen-lockfile && pnpm --dir ../world-prototype install --frozen-lockfile`
   - build: `pnpm build`
   - output: `dist`
   - `cleanUrls`, no trailing slashes;
   - immutable caching for hashed assets (`/_astro/*`, `/world/assets/*`);
   - `X-Content-Type-Options`, `Referrer-Policy` and `X-Frame-Options: SAMEORIGIN` (the world iframe must stay same-origin).
4. **Environment variable:** `SITE=https://<your-domain>`. Setting it does three things:
   - adds canonical and `og:url` tags with absolute URLs;
   - fills `sitemap.xml`;
   - adds a `Sitemap:` line to `robots.txt`.
   Without it the site works, but those URLs are relative or absent.
5. Node version: 22.x or later in Project Settings.
6. Deploy a **Preview** first and run the checks in §5 against the preview URL:

   ```sh
   cd app && node e2e/e2e.mjs --base https://<preview-url>
   ```

7. Promote to production and attach the domain only after that.

No secrets, API keys, analytics or third-party services are used. Nothing needs configuring beyond `SITE`.

## 4. Owner decisions before going public
- **Résumé PDF.** `app/public/resume.pdf` is git-ignored and absent. The supplied résumé includes a phone number, which the directive keeps off the site.
  - To publish one, add a version without the phone number at that path and remove `public/resume.pdf` from `app/.gitignore`. The header link and the Field Office page switch to the download automatically at build time.
- **LinkedIn.** Confirm `https://www.linkedin.com/in/1hpdhruv` by hand; automated checks get HTTP 999.
- **Domain.** Choose one and set `SITE`.
- **Screenshots.** `world-prototype/screenshots/pass2.1/` (about 90 MB of PNG) is git-ignored local evidence. The JPEG selection in `screenshots/review-pack/` is committed instead.

## 5. Post-deploy checks
- `/`, `/work/evdoctor`, `/research`, `/robots.txt` and `/sitemap.xml` all return 200; `/no-such-page` returns the 404 page.
- Response headers on `/world/index.html` include `X-Frame-Options: SAMEORIGIN`.
- The browser console shows no errors on `/`. The two `THREE` deprecation warnings are known and harmless.
- On a phone: map mode, Quick View usable, no horizontal scroll.
- Share-card preview (any OG validator) shows `og.jpg`.

## 6. Rollback
The site is static; Vercel's “Promote previous deployment” is an instant rollback. There is no data or state to migrate.
