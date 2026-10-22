# Release readiness: Dhruva's World (Phase 4 release candidate)

Date: 2026-10-22 · Branch `main` · Base `9eac815` (on top of `448234b` and `aed9509`), plus the Phase 4 commit. **Nothing has been pushed or deployed.**
This report is the builder's evidence for the owner's independent review; it is not self-acceptance.

**Labels used throughout:**
- **IMPLEMENTED**: the code exists.
- **AUTOMATED TESTED**: a scripted check exercises it, in a real browser where stated.
- **MANUALLY VERIFIED**: a person observed it on real hardware or with real assistive technology. In this phase that was only the builder reviewing screenshots; no hands-on device or screen-reader session took place.
- **NOT VERIFIED**: no evidence yet.

## 1. Verdict

| Scope | Status | Conditions |
|---|---|---|
| **Preview readiness** (a Vercel preview deployment for review) | **CONDITIONAL PASS** | (1) The owner authorises the push and project creation. (2) Set `ENABLE_EXPERIMENTAL_COREPACK=1`, so Vercel uses the pinned pnpm 11.25.0; this is unverified on Vercel. (3) Run the DEPLOYMENT.md §5 checks on the preview URL. |
| **Production readiness** (public domain) | **CONDITIONAL PASS: not releasable until gates G6–G11 close** | No known code defects remain. Gates still open: a real phone test, a screen-reader pass, a low-end-hardware test, a verified preview deployment, a domain with `SITE`, and owner content decisions (résumé, LinkedIn). |

## 2. Release-gate checklist

| # | Gate | Status | Evidence |
|---|---|---|---|
| G1 | Production build passes type checks and the release guard | AUTOMATED TESTED | `pnpm build`: exit 0; `astro check` 0/0/0; `[check-dist] OK` (logs/build.txt) |
| G2 | No debug UI, debug keys, test hooks, source maps, secrets or phone number in production output | AUTOMATED TESTED | check-dist (static) and `e2e/prod.mjs` (runtime: globals, HUD, keys, `?debug=1`) |
| G3 | Core journeys work on the real production build | AUTOMATED TESTED | `e2e/prod.mjs` 23/23 on `astro preview`, and 23/23 under the replayed Vercel routes |
| G4 | Full behaviour suite (history, focus, fallbacks, teardown, interior, travel) | AUTOMATED TESTED | `e2e/e2e.mjs` 58/58 (QA build = production + hooks) |
| G5 | WCAG 2.2 AA measurable checks (contrast, names, structure, focus, targets, reduced motion) | AUTOMATED TESTED | `e2e/a11y.mjs`: 15 states, 411 text runs, 0 failures |
| G6 | Screen-reader pass | **NOT VERIFIED** | No screen-reader session was run. Checklist in §7.1 |
| G7 | Real phone (touch, GPU, thermals, loading) | **NOT VERIFIED** | No device available. Checklist in §7.2 |
| G8 | Low-end hardware | Partially: AUTOMATED TESTED with SwiftShader (software renderer); real hardware **NOT VERIFIED** | `e2e/lowpower.mjs` 7/7 |
| G9 | Vercel build and routing | AUTOMATED TESTED locally (`vercel build` + route replay); **NOT VERIFIED on Vercel** | logs/prod-vercel-local.txt |
| G10 | Domain and `SITE` set for Production | **OPEN (owner)** | The build refuses a malformed `SITE` |
| G11 | Owner content inputs (résumé PDF without phone, LinkedIn confirmation, evidence links) | **OPEN (owner)** | §6 |
| G12 | World unchanged from the accepted Pass 2.1 art | AUTOMATED TESTED | 28/28 views diffed against Pass 2.1 (worst mean 0.34/255); QA 27/27; drive test complete |

## 3. Automated test results (final run, in this order)

| Directory | Command | Exit | Result |
|---|---|---|---|
| `app/` | `pnpm test` | 0 | **29/29** (4 files: content, mapping 42/13, protocol, release guard) |
| `app/` | `pnpm build:qa` | 0 | QA build → `dist-qa/` |
| `app/` | `pnpm e2e` (against `pnpm preview:qa` :4322) | 0 | **58/58** |
| `app/` | `pnpm build` | 0 | 0 errors / 0 warnings / 0 hints; check-dist OK (24 files) |
| `app/` | `pnpm e2e:prod` (against `pnpm preview` :4321) | 0 | **23/23** |
| `app/` | `VERCEL_TELEMETRY_DISABLED=1 vercel build --yes` | 0 | `"status": "ok"`, local only; nothing uploaded |
| `app/` | `node e2e/prod.mjs --base http://127.0.0.1:4330` (with `node e2e/vercel-local.mjs 4330`) | 0 | **23/23** under the replayed Vercel routes |
| `app/` | `node e2e/a11y.mjs` | 0 | 15 states; 0 contrast failures; focus rings 3/3; no structural failures |
| `app/` | `node e2e/lowpower.mjs` | 0 | **7/7** |
| `app/` | `node e2e/measure.mjs` | 0 | §8 |
| `world-prototype/` | `pnpm exec tsc --noEmit` | 0 | passes |
| `world-prototype/` | `node tools/qa.mjs` (dev server :5173) | 0 | **27/27** |
| `world-prototype/` | `node tools/drive.mjs` | 0 | 13/13 zones drivable; descent reaches sample 1672/1692 at the Research Station |
| `world-prototype/` | `node tools/shots.mjs --out <scratch>` + pixel diff | 0 | 28/28 views match Pass 2.1 |

Logs are in `docs/screenshots/phase4/logs/`. Every browser run used headless Brave (Chromium) on an Apple M4 with ANGLE/Metal, except the SwiftShader runs.

## 4. Production debug isolation

**Before Phase 4:**
- `window.__basin` (world internals: renderer, scene, `placeRover`, `teleport`, `setView`, `bench`) and `window.__app` shipped in production.
- So did `?worldTimeout`.
- `?debug=1` turned on the debug HUD and keys inside the embed.
- Opening `/world/index.html` directly gave the **full debug HUD**: fly mode, overview, contours, anchor pins and number-key teleport.
- Zone builders logged diagnostics to the console.

**Now** (IMPLEMENTED, AUTOMATED TESTED):
- These are build-time constants, so production drops the code:
  - `DEV_TOOLS = import.meta.env.DEV` (world);
  - `TEST_HOOKS = DEV || VITE_TEST_HOOKS/PUBLIC_TEST_HOOKS === '1'` (world and app).
- `check-dist` fails `pnpm build` if any of these reach `dist/`:
  - `__basin`, `__app`, `placeRover`, `zonesList`, `isUnderground`, `worldTimeout`;
  - the HUD strings, `&debug=1`, `/world/index.html`;
  - `.map` files and `sourceMappingURL`.
- `tests/check-dist.test.ts` proves the guard rejects each of these.
- `prod.mjs` confirms at runtime that there are no globals, no HUD, inert debug keys, and that `?debug=1` is ignored, both embedded and at `/world/basin`.
- The dev server keeps every tool (checked: HUD with 18 buttons, F → fly mode, 9 → Watershed teleport).

**What remains in production, and why:**

| Item | Why it stays |
|---|---|
| WASD/arrow/Shift driving, mouse drag orbit, wheel zoom | Normal world navigation |
| E/Enter (inspect), Q (Quick View), M (map), Esc (leave interior or close) | Visitor controls, forwarded to the app |
| The interior view (`setInterior`) | The Research Station lift |
| Fly/overview branches inside `CameraRig` | Class methods are not tree-shaken. They are **unreachable**: nothing in production can set those modes |
| Per-frame timing counters (`prof`) | A few additions per frame, never exposed; harmless |
| `console.error` on world boot failure, plus the `error` bridge message | Genuine error reporting: the app shows the fallback |
| `/world/basin` reachable directly | It is the iframe document. Bare world, no HUD, no hooks; `robots.txt` disallows `/world/` |
| `?embed=1` | Required: switches the world into embedded mode |
| Two THREE deprecation warnings (`Clock`, `PCFSoftShadowMap`) | Library notices, known from Pass 2.1 |

## 5. Accessibility

### 5.1 Measured (AUTOMATED TESTED, `e2e/a11y.mjs` on the production build)

**States covered:**
1. initial loading;
2. world ready, with the help overlay and cue over the 3D scene;
3. Quick View;
4. a project panel opened from Quick View;
5. the location navigator;
6. the evDOCTOR cue over the 3D bay;
7. E → panel (keyboard-driven interaction);
8. the Research Station page;
9. the interior view, with the surface button over 3D;
10. the static-map fallback;
11. phone map mode;
12. phone Quick View;
13. a static project page;
14. `/research`;
15. the 404 page.

**Method, contrast (1.4.3):**
- Each visible text run's computed colour, multiplied by its inherited opacity, is compared with **every backdrop pixel behind it**.
- The backdrop is captured by a screenshot with all text made transparent, so sheets, scrims, translucent overlays and the live 3D scene are measured, not assumed.
- The check passes when the 5th-percentile ratio meets 4.5:1 (or 3:1 for large text).

**Results:**
- 411 text runs measured. **Lowest anywhere: 5.85:1**: the orange “Quick view” button, the `kbd` hints, and buttons over the 3D scene.
- Focus indicators (1.4.11), measured against their backdrop: 6.47:1 on the header, 5.02:1 on a sheet, 6.47:1 in the fallback.
- **Structure:**
  - `lang="en"`;
  - landmarks: banner, main, nav;
  - one `h1` per page, no heading-level skips, no duplicate ids;
  - every control named;
  - dialogs: `role=dialog`, `aria-modal=true`, a name, and focus inside;
  - the iframe has a descriptive title.
- **Targets (2.5.8):** none under 24×24 CSS px. Many are under 44 px, which is a AAA-level guideline and reported only.
- **Reduced motion:** with `prefers-reduced-motion`, no element animates or transitions longer than 10 ms. The world cuts its camera and stops dust (e2e).

**Keyboard and conflicts (AUTOMATED TESTED):**
- The skip link is first in the tab order and visible on focus.
- Q and M work at page level. Inside the world, E, Q, M and Esc are forwarded.
- Arrow keys and PageDown scroll an open sheet without driving the rover, because the world ignores input while a dialog is open.
- Tab is trapped in dialogs (80 presses), and focus is restored to the opener, or to the iframe if the world opened the dialog.
- The background is `inert`.

**Accessibility tree (AUTOMATED TESTED, via Chrome's AX snapshot):** while Quick View is open, the tree exposes a modal dialog named “Dhruva Mishra”, and the header controls and the world iframe are absent. After closing, the iframe is exposed with its title.

### 5.2 Accessibility findings in this phase

| ID | Sev. | Finding (evidence) | Impact | Fix | Verified by |
|---|---|---|---|---|---|
| A1 | P2 | `kbd` key hints measured **3.66–4.42:1** over the hint panel and 3D scene (`opacity: .8`) | Instructions hard to read for low-vision users | Removed the opacity; hint panel backdrop 0.82 → 0.94 opaque, so it holds over any scene | a11y.mjs: now ≥ 5.85:1 |
| A2 | P2 | Panel content reused Quick View's ids: 1–4 duplicate ids per state, and `aria-labelledby` pointed into the hidden Quick View | Ambiguous names for assistive technology | Panel ids prefixed `panel-` | a11y.mjs dup-id check; e2e unique-id check |
| A3 | P2 | Map pins 21×21 px; brand link 14 px tall (below 2.5.8's 24 px) | Hard to hit on touch | Pins ≥ 26 px; brand link min-height 32 px | a11y.mjs + prod.mjs target checks |
| A4 | P2 | Static project pages skipped from `h1` to `h3` | Heading navigation gap | “Verified details” is an `h2` on static pages | a11y.mjs heading-skip check |
| A5 | P2 | Two skip links on the home page (Phase 3 left one in `Header` and one in the page) | Redundant tab stop | Header renders its skip link only on non-home pages | e2e and a11y skip-link checks |
| A6 | P2 | The travel announcement (“Travelled to X. …”) was overwritten one frame later by “Entered X” | Screen-reader users lost the destination description | `announce()` timestamps itself, so zone messages wait 1.5 s | e2e “travel announcement is not overwritten” |
| A7 | P2 | The world's “Inspect” cue showed at the edge of an open panel | Visual clutter; a control visible behind a modal | Cue hidden while any dialog is open, and restored on close | e2e (2 checks) |
| A8 | P2 | At 360 px the header buttons wrapped their key hints onto a second line | Cramped header on small phones | Key hints hidden under 720 px (no keyboard on touch); buttons don't wrap | responsive sweep screenshots |
| A9 | (n/a) | The focus-ring measurement first reported “outline none” on the sheet's Close button | A measurement artifact: a programmatic `focus()` after mouse use doesn't trigger `:focus-visible` | Test sets keyboard modality first | a11y.mjs |

**Not verified (accessibility):**
- No real screen reader (G6).
- No Windows High Contrast / forced-colors check.
- No zoom to 200% or 400% (reflow) check beyond the 360 px viewport.
- No speech-input check.
- Contrast inside the 3D scene was measured at the tested viewpoints only. The hint backdrop is now opaque enough to hold over any scene, but text over the canvas was not swept across all 13 zones.

## 6. Privacy, links and content integrity

| Check | Result |
|---|---|
| Phone number | None in `dist/`. Guard: check-dist scans HTML/XML/TXT/JSON for phone-like digit sequences; e2e scans the rendered page and every `href`. The guard does **not** scan PDFs: a future `resume.pdf` must be checked by hand |
| Secrets and tokens | None. Credential patterns scanned in all text output; no environment variables are read by client code; nothing needs credentials |
| Source maps / debug data | None in `dist/` (guarded) |
| External links in the build (16) | Re-checked 2026-10-22: **15 return 200** (10 repositories, the GitHub profile, 4 live demos); **LinkedIn returns HTTP 999** to automated requests. The URL itself comes from the owner's résumé (link annotation `https://linkedin.com/in/1hpdhruv`), so it is genuine but unverified. Email is a `mailto:` from the résumé |
| Résumé | Not published. No link is rendered while `public/resume.pdf` is absent. The string `/resume.pdf` exists in the app bundle as data only |
| Live-demo claims | Only demos that answered 200 are linked. The SEV Guardian demo (Render) is not linked |
| Achievements | Six records from the résumé, labelled as such, with no proof links; the page says links will be added |
| Research | Both lines are “Ongoing research”; each page lists what it does **not** claim. No clinical validation, diagnostic use or results are claimed; no participant data is used |
| Status labels | `prototype`, `in-progress`, `research`, and “Documentation pending” (maze robot). **Maze robot wording fixed:** the status note now reads “Reported by Dhruva; no build log, photos or repository published yet”, so the owner-sourced claim is attributed rather than presented as evidenced |
| Canonical / OG / sitemap | Without `SITE`: no canonical or `og:url`, `og:image` relative, sitemap empty with a comment, so no wrong domain is ever emitted. With `SITE`: absolute, checked with a test value. A malformed `SITE` (http, a path) **fails the build** |
| 404 page | `noindex`; links home |

## 7. Manual checks: performed and pending

**Actually performed by the builder** (screenshot review, not hands-on use):
- Visual review of every Phase 4 screenshot and contact sheet. This review is what found A7 and A8.
- Visual comparison sheet of the world, Pass 2.1 vs Phase 4.

**Not performed:** any hands-on session with a phone, tablet, screen reader or low-end laptop.

### 7.1 Screen-reader checklist (NOT VERIFIED; for VoiceOver on macOS/iOS and NVDA on Windows)
On the preview URL, with the screen reader on and the mouse unused, check each item:
1. The page title is announced: “Dhruva Mishra — AI/ML Engineer · The Basin”. The landmarks rotor lists banner, navigation and main.
2. The first Tab lands on “Skip to the portfolio content”; activating it opens Quick View.
3. Quick View: “Dhruva Mishra, dialog” is announced, the reading cursor is inside it, and headings (h1 → h2 → h3) can be navigated with the rotor.
4. VoiceOver cursor (VO+arrows) or NVDA browse mode cannot reach the header or the world while the dialog is open.
5. Esc closes it and focus returns to the “Quick view” button, which is announced.
6. M or the Map button: “Go anywhere in the Basin, dialog”. Each zone is listed with “Go” and “Read” buttons; Read opens content.
7. Go → “Travelled to <zone>. <description>” is announced. Note whether the zone message interrupts it.
8. Tab to the iframe: its title, “The Basin — explorable 3D world. Drive with W A S D…”, is announced.
9. At an anchor, the cue “<zone> <title> Inspect” is reachable and announced. Activating it opens the panel, the panel title is announced, and Esc returns to the world.
10. Research page → “Take the lift down” → “Research Station, sub-level 1…” is announced, and “Return to the surface” is reachable.
11. With WebGL disabled (Safari: Develop → Disable WebGL; Chrome: `--disable-webgl`): the fallback heading and reason are read, and the 13 locations are a navigable ordered list.
12. On iOS VoiceOver: map mode, swipe order is sensible, and Quick View and panels open and close with the two-finger scrub gesture.

Record pass or fail per step, with the browser and screen-reader versions.

### 7.2 Real-device checklist (NOT VERIFIED)
On at least one phone (iOS Safari and/or Android Chrome) and one low-end laptop, against the preview URL:
1. **Initial load on 4G or throttled Wi-Fi:** time to readable content; map mode by default on the phone.
2. **Map-first navigation:** every pin and list item is tappable without zoom, and pins are not mis-hit.
3. **Quick View and panels:** open, scroll (no scroll bleed to the page), close with the Close button and with the system back gesture; the URL updates.
4. **Touch targets:** no accidental activations; spacing is adequate.
5. **No horizontal scroll** in portrait and landscape; text zoom at 200% still reflows.
6. **Reduced motion** (iOS: Settings → Accessibility → Motion) is respected.
7. **“Load the 3D world anyway” on the phone:**
   - the progress line moves, and “use the map instead” works during loading;
   - check the device temperature after 2 minutes;
   - if the frame rate is very low, the page switches back to the map with a message (the watchdog). Record whether it triggers.
8. **Fallback:** Retry after a forced failure (airplane mode during load), and recovery once online.
9. **Low-end laptop (integrated GPU):** world-ready time, smoothness while driving, and Quick View latency while driving.

## 8. Build, runtime and performance (measured, headless; indicative only)

**Environment:**
- Apple M4, headless Brave (ANGLE/Metal), DPR 1, localhost preview (no network latency), cold browser context per run.
- `e2e/measure.mjs`, 3 runs, against the QA build: production plus hooks, transfer within 1 KB.
- The headless frame rate is capped and the GPU is shared with the desktop, so **no sustained-FPS claim is made**.

| Metric | Phase 4 | Phase 3 (reported) |
|---|---|---|
| Shell transfer: HTML / CSS / app JS (gzip) | 11.3 / 2.8 / 14.9 KB = **29 KB** | about 29 KB |
| Map image (WebP) | 110 KB (loaded in map mode or the fallback; lazy in the navigator) | 111 KB |
| World downloaded before the visitor asks? | **Desktop: yes**: the world auto-mounts once the shell is interactive (it is the home experience). **Phone, small or touch screen, software renderer, `?world=0`: no**: the world is never fetched unless “Load the 3D world anyway” is pressed | same, plus software renderers |
| World JS raw / gzip | **769.6 KB / 212.4 KB** (gzip -9; 215.8 KB in Vite's report) | 773.2 / 217.3 KB |
| Worker raw / gzip | 23.3 / 9.4 KB | 23.3 KB |
| Total desktop transfer | 240–350 KB (the map image is fetched in some runs) | 351 KB |
| Phone (map mode) transfer | 140 KB | 140 KB |
| Portfolio usable (Quick View wired) | 158–198 ms | 148–157 ms |
| World ready | **2.47–2.61 s** | 2.33–3.16 s |
| Heightfield (worker) | 1.13–1.27 s | 1.10–1.53 s |
| Scene build | 0.84–0.87 s | 0.76–0.98 s |
| **Longest main-thread task during start-up** | **236–238 ms** (4 tasks, about 535 ms total) | 755–1,349 ms (a single task) |
| Heightfield main-thread overhead (standalone world, same build) | worker: long tasks 837 ms total, longest 302 ms. `?worker=0`: 1,959 ms total, longest 1,134 ms | n/a |
| Cumulative layout shift | **0** | not measured |
| Spawn view: draw calls / triangles | **515 / 2.09 M** (Pass 2.1 audit: 512 / 2.09 M) | 515 / 2.09 M |
| Forced-sync frame time at spawn: median (p90) | 22–28 ms (26–38). Noisy this session; Phase 3 measured 16.5–20.2 ms | 16.5–20.2 (20.6–25.6) |
| Interior: calls / triangles / frame median | **13 / 15,254** / 3.0–4.4 ms | 13 / 15 k / 4.3–4.4 ms |
| World JS heap | 69–93 MB | 70–88 MB |
| GPU resources | 269 geometries, 81 textures | n/a |
| Console | Production: only the two THREE warnings. No errors, no failed requests | the same, plus build logs |

**SwiftShader (no GPU; production build):**

| Path | Result |
|---|---|
| Default visit | Software renderer detected → map mode; Quick View opens in 45 ms |
| “Load anyway” | World ready in 22 s at 0.8 fps; Quick View click → **25 s** while it runs. That is the visitor's explicit choice; the watchdog does not override it |
| Watchdog path (QA build, renderer name hidden) | Switched to the map 5 s after ready, with an announcement; Quick View then 51 ms |

**Caveats:**
- The frame-time benchmark forces a GPU readback every frame. Medians varied 2× between sessions on the same machine because of background load, so treat them as ranges.
- Heap figures depend on when garbage collection runs.
- None of this predicts phone or low-end laptop behaviour (G7).

## 9. Findings: release-relevant (Phase 4)

| ID | Sev. | Finding (evidence) | Impact | Fix applied | Verified by |
|---|---|---|---|---|---|
| R1 | **P0** | On Vercel, `cleanUrls` 308-redirects `/world/index.html?embed=1` to `/world`. The world's relative `./assets/*.js` then resolve to `/assets/*.js` and 404. Reproduced by replaying the `vercel build` route table: 308 → 404 → 404 | **The 3D world would never load on Vercel.** Visitors would see a 90 s loading state, then the fallback | The world entry is published as `basin.html` and loaded as `/world/basin` (served directly by `cleanUrls`, query kept). The guard rejects `/world/index.html` in output | `prod.mjs` 23/23 under the replayed routes; `curl /world/basin?embed=1` → 200 |
| R2 | P1 | Debug and test surface in production: `window.__basin`/`__app`, `?worldTimeout`, `?debug=1`, and the **full debug HUD and keys at `/world/index.html`** (static review plus runtime probe) | Exposed internals; anyone could teleport, fly and inspect scene internals; unprofessional HUD | Build-time gates; guard in `pnpm build`; unit and runtime tests (§4) | check-dist; `tests/check-dist.test.ts`; `prod.mjs` (5 checks) |
| R3 | P1 | On a software renderer the world renders at about 1 fps and blocks the shared main thread: Quick View took 19–25 s to open (SwiftShader) | **The whole portfolio becomes unusable** on GPU-less, blocklisted or very weak machines | Software-renderer probe → map mode; post-ready frame-rate watchdog → unmount and map; explicit “load anyway” honoured | `lowpower.mjs` 7/7 |
| R4 | P1 | No `packageManager` pin. `vercel build` reported “Detected pnpm-lock.yaml 9 … Using pnpm@9.x” | Vercel's pnpm 9 or 10 ignores the pnpm 11 `allowBuilds` setting; the install or build could break | `packageManager: pnpm@11.25.0` and `engines.node >=22` in both packages; `ENABLE_EXPERIMENTAL_COREPACK=1` documented | Local `vercel build`; **remote NOT VERIFIED** (preview condition 2) |
| R5 | P2 | The scene build was one 0.75–1.35 s main-thread task | Quick View unresponsive for up to about 1.3 s during load | `buildWorld` yields between zones (same order and output) | `measure.mjs` longest task 236–238 ms; 28/28 views unchanged |
| R6 | P2 | A dialog opened while the world was loading did not pause it (the app posts nothing before `ready`) | The world rendered and accepted state behind a modal | On `ready`, the app sends the current dialog state | e2e “stays paused when it becomes ready” |
| R7 | P2 | After choosing 3D on a phone there was no way back to the light map during loading | Battery and data cost; no exit | “use the map instead” in the loading overlay unmounts the world | e2e (2 checks) |
| R8 | P2 | `?worker=0` honoured in production | A test switch reachable by visitors | Gated behind test hooks | QA `?worker=0` comparison still works |
| R9 | P2 | Zone builders' `console.log` output in production | Console noise | `devLog` (dev only) | `prod.mjs` console-output check |
| R10 | P2 | A malformed `SITE` (e.g. `http://`, a path) would publish wrong canonical and OG URLs | SEO and trust | The build fails with a clear message | Manual run (2 negative cases) |
| R11 | P2 | Maze-robot copy stated the build without attribution | Trust | Status note attributes it to the owner, with no evidence claimed | Content review |
| A1–A8 | P2 | Accessibility items | See §5.2 | Fixed | §5.2 |

No P0 or P1 item remains open in the code. The open items are gates (G6–G11) and owner inputs.

## 10. Remaining blockers and deferred items

**Before production** (owner or hardware):
- G6: screen-reader pass.
- G7: real phone.
- G8: low-end laptop.
- G9: a real Vercel preview, including corepack and pnpm 11.
- G10: domain and `SITE`.
- G11: résumé PDF without the phone number, LinkedIn confirmation.

**Deferred (P2, not blocking):**
- The world JS is a single 770 KB chunk (212 KB gzip); a vendor split is possible.
- “Load anyway” on a software renderer is slow by nature; no further mitigation.
- Fly/overview code remains in `CameraRig` (unreachable).
- Contrast over the 3D canvas was swept at the tested viewpoints, not all zones.
- No forced-colors or zoom-reflow audit.
- Known world debt from Pass 2.1 (terrace risers and others) is unchanged and not reopened.

**Content gaps** (unchanged; owner inputs):
- maze-robot evidence;
- achievement proof links;
- SEV Guardian demo;
- research detail when available.

## 11. Hosting and preview

See DEPLOYMENT.md:
- §3: local verification, including the offline Vercel route replay;
- §4: project settings and **separate Preview and Production environment variables**;
- §5: the preview checklist.

**In short:** Root Directory `app`; `ENABLE_EXPERIMENTAL_COREPACK=1`; `SITE` unset on Preview and set to the bare https origin on Production; never set `TEST_HOOKS`; run `node e2e/prod.mjs --base <preview-url>` and `node e2e/a11y.mjs --base <preview-url>` against the preview.

## 12. What has not been tested
- Any physical phone or tablet: touch, GPU, thermals, real network.
- Any screen reader, voice control, switch access, forced colors or high zoom.
- Safari (WebKit) and Firefox (Gecko). Every browser run used Chromium (Brave). In particular:
  - Safari's WebGL 2 and its renderer string;
  - Firefox's renderer-string sanitising, which may hide a software renderer from the probe (the watchdog still applies);
  - `inert` and `:focus-visible` behaviour.
- Real Vercel infrastructure: the pnpm version chosen, header application, `X-Robots-Tag` on previews, CDN caching, and the 308 behaviour on the live edge.
- Slow networks: all loads were from localhost.
- WebGL context loss during a session (the code path is shared with init failure, which is tested).
- `SITE`-enabled output beyond the checks in §6 (no OG validator or Search Console).

---

## Phase 5: Vercel preview deployment

**Verification levels:**
- **LOCAL VERIFIED**: on the development machine.
- **VERCEL BUILD VERIFIED**: from the real Vercel build log.
- **PREVIEW BROWSER VERIFIED**: browser tests against the hosted URL.
- **MANUALLY VERIFIED**: a person on real hardware or with assistive technology.
- **NOT VERIFIED**: no evidence yet.

### P5.1 Repository checkpoint (LOCAL VERIFIED)

**Starting state:**
- `main` at `9eac815`. Parent chain: `9eac815` → `448234b` → `aed9509` → `fb8b9c5` → `ffd23da`, all verified.
- Remote `origin` = `github.com/1HPdhruv/portfolio`, a **public** repository. Its `main` is at `ffd23da`.
- Phase 4 work was uncommitted; `git diff --check` was clean.

**Pre-push privacy scan, over every commit being pushed and all staged files:**
- The owner's real phone number, extracted from the résumé in memory and never printed, was found in **0 files**.
- No credential patterns, PDFs or `.env` files.
- The only phone-shaped string is the fictitious `98765 43210` in the release-guard unit test.
- Local absolute paths (machine username) were scrubbed from the Phase 4 and 5 logs, and fixed going forward in a Phase 3 log. Rewriting the history copy is not allowed; it reveals only a local path.

**Pre-push gates (all exit 0; logs `docs/screenshots/phase5/logs/prepush-*.txt`):**

| Gate | Result |
|---|---|
| Unit | 29/29 |
| `build:qa` + e2e (QA) | 58/58 |
| `build` | `astro check` 0/0/0; `check-dist` OK |
| `prod.mjs` | 23/23 |
| `vercel build` + route replay + `prod.mjs` | 23/23 |
| a11y | 15 states, 0 failures |
| Low-power | 7/7 |
| World | `tsc` OK; QA 27/27; drive test complete; 28/28 views vs Pass 2.1 (worst mean 0.34/255) |
| Clean-checkout build of the commit | Fresh worktree, frozen installs, `pnpm build`: OK |

**Branch:**
- `release/phase5-vercel-preview` was created from the working tree. It didn't exist locally or remotely beforehand.
- 86 files staged explicitly. None from `pass2.1/`, `node_modules`, `dist*`, `.vercel`, `public/world`, `e2e/screenshots` or `.cache`, and none over 500 KB.
- Commits, pushed without force; remote `main` untouched:

| Commit | Content |
|---|---|
| `966d889` | Phase 4 checkpoint |
| `9741922` | Phase 5 configuration notes |
| `4c330b2` | Root `packageManager` fix |
| this report's commit | Test support and report |

### P5.2 Vercel project (VERCEL BUILD VERIFIED, read back from the API)

- **Project:** `dhruvas-world` (`prj_HCCgoVbBxT93PUXyC0Z4iT8MlSkm`), team “Dhruv's projects”.
- **Why a new project:** all 5 existing projects were checked, and none was linked to this repository. `dhruva-portfolio` is linked to `1HPdhruv/dhruva-portfolio` and was not touched.

| Setting | Value |
|---|---|
| Git | `1HPdhruv/portfolio`; production branch `main` (**any future push to `main` would deploy production**; nothing has been pushed to `main`) |
| Root Directory | `app` |
| Include source files outside the Root Directory | **true** |
| Framework | Astro (preset) |
| Install / Build / Output | from `app/vercel.json` (both packages installed with frozen lockfiles; `pnpm build`; `dist`) |
| Node.js | 24.x (project setting; `engines >=22`). The build log does not print the exact patch version |
| Environment | `ENABLE_EXPERIMENTAL_COREPACK=1`, **Preview only**. **No Production variables.** `SITE` and `TEST_HOOKS` unset |
| Deployment protection | Vercel Authentication on deployment URLs (the default; unauthenticated requests get 302 to `vercel.com/sso-api`) |
| Domains / DNS | none added / unchanged |

### P5.3 Deployments

| Deployment | Commit | Target | State | Notes |
|---|---|---|---|---|
| `dpl_Hi2hPUe9RAfiqzbRCrVhj4b7NHXd` | `966d889` | **production** | **CANCELED** | API-created without `target`; Vercel made it production. Cancelled while `INITIALIZING`, before any build. **Incident**: see below |
| `dpl_9Mxj5m1AybJuMQySRLrSpGWHqxqH` | `9741922` | preview | **ERROR** | Install failed: “Could not enable corepack because package.json is missing "packageManager"” → fallback pnpm → “Ignoring not compatible lockfile … Headless installation requires a pnpm-lock.yaml” |
| `dpl_DcoJUu34hAsRiYfbDrru74v2GjJ4` | `4c330b2` | **preview** | **READY** | `https://dhruvas-world-9cnxi08yw-dhruvs-projects-d6f6b32b.vercel.app` |
| (this report's commit) | latest | preview | built by the Git integration on push | The branch alias always points at the newest branch deployment: `https://dhruvas-world-git-release-phase-c7b6e5-dhruvs-projects-d6f6b32b.vercel.app` |

**Incident:**
- Production deployment was not authorised. One production-target deployment was created by mistake through the API, and cancelled before it built.
- Its only lasting effect: the project's auto-generated production alias `dhruvas-world-dhruvs-projects-d6f6b32b.vercel.app` refers to the cancelled deployment and serves nothing.
- No production build, no domain, no DNS change.
- All later deployments came from Git pushes to the non-production branch.

**Hosted defect H1 (P0 for the preview):**
- **Cause:** Vercel's Corepack step reads `packageManager` from the **repository root**, not from the Root Directory. Reproduced locally by running `vercel build` from the repo root with `rootDirectory: app`.
- **Fix:** a minimal root `package.json` (`private`, `packageManager: pnpm@11.25.0`, nothing else). The pinned version and the lockfiles are unchanged.
- **Verified:** locally (Corepack detected, pnpm 11.25.0) and on Vercel (`4c330b2`, READY).

**Build log `4c330b2`** (VERCEL BUILD VERIFIED; `logs/vercel-preview-build-4c330b2.txt`):
- cloned `release/phase5-vercel-preview` at `4c330b2`;
- Vercel CLI 64.7.0;
- “Detected ENABLE_EXPERIMENTAL_COREPACK=1 and "pnpm@11.25.0" in package.json”; Corepack downloaded pnpm 11.25.0;
- both installs “Lockfile is up to date … Done using pnpm v11.25.0”;
- `world-prototype` built from the sibling source (`index-EX9ctL91.js` 769.60 kB, 215.77 kB gzip): “production, no test hooks”;
- `astro check` 0 errors / 0 warnings / 0 hints;
- output `/vercel/path0/app/dist/`;
- `[check-dist] OK — 24 files`;
- “Build Completed … Deployment completed”;
- target: preview.

### P5.4 Hosted browser verification: **NOT VERIFIED (blocked on access)**

The preview is behind Vercel Authentication. Running the browser suites against it needs a **Protection Bypass for Automation** secret. Creating and storing that secret was **refused by this session's permission policy**, and was not worked around. Disabling preview protection, which would make the preview public, is an owner decision and was **not** done.

So **no browser test has run against the hosted URL yet**. The hosted-capable scripts now accept the secret from the environment and send it as Vercel's bypass header; nothing is stored in the repo. To run them:

```sh
# Vercel → dhruvas-world → Settings → Deployment Protection → Protection Bypass for Automation → create; copy the secret
cd app
export VERCEL_AUTOMATION_BYPASS_SECRET='<paste here; do not commit>'
B=https://dhruvas-world-git-release-phase-c7b6e5-dhruvs-projects-d6f6b32b.vercel.app
node e2e/prod.mjs --base $B       # 23 checks: hooks/HUD absent, journeys, fallbacks, routes, responsive sweep
node e2e/a11y.mjs --base $B       # 15 states: measured contrast, structure, focus, targets, reduced motion
node e2e/lowpower.mjs --base $B   # checks A and B (software renderer); check C needs the QA build and will fail remotely
curl -sI -H "x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET" $B/world/basin | grep -iE "^HTTP|x-frame|cache-control|x-content"
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -H "x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET" $B/work/evdoctor/   # expect 308 → /work/evdoctor
```

Revoke the secret afterwards if it is not needed. Alternatively, allow this session to create it, and the same commands will be run here and their results recorded.

**Hosted checks still pending** (from the Phase 5 brief): routing and refresh (`/`, `/world/basin`, `/work/evdoctor`), world assets without 404, no clean-URL regression, `robots.txt`/`sitemap.xml`, security and cache headers, Quick View, content routes, focus restoration, history, navigator and fast travel, the Research lift, map-first on narrow screens, no-WebGL fallback, Retry, debug tools absent, console and network errors, and hosted load timing. All are **NOT VERIFIED on the preview**. All are LOCAL VERIFIED on the identical build output, including under the replayed Vercel routes.

### P5.5 Manual checks for the hosted preview: all NOT VERIFIED

| Check | What to do on the preview |
|---|---|
| Real phone (iOS Safari, Android Chrome) | Map-first load; tap every pin and list item; Quick View open/scroll/close (button and back gesture); panel scrolling without page bleed; “Load the 3D world anyway” → progress, “use the map instead”, heat after 2 min, watchdog |
| Screen reader (VoiceOver, NVDA) | RELEASE_READINESS §7.1, steps 1–12: landmarks, skip link, dialog announcements, focus return, inert background, travel announcements, iframe title, fallback list |
| Low-end laptop | Time to readable content and to the world; driving smoothness; Quick View latency while driving; the watchdog's behaviour |
| Safari and Firefox | `/`, `/work/evdoctor`, `/world/basin` load; the world starts or falls back cleanly; renderer-string probe behaviour; `inert` and focus-visible |
| WebGL context loss | Chrome DevTools → Rendering → “Emulate a GPU context loss” (or `WEBGL_lose_context` in the console): the fallback appears with Retry; Retry restores the world |
| Slow connection | DevTools “Slow 4G”: Quick View usable before the world loads; the loading line moves; the 90 s watchdog → fallback with Retry |

### P5.6 Status

| Item | Level |
|---|---|
| Checkpoint, branch, privacy scan, pre-push gates | LOCAL VERIFIED |
| Vercel project configuration | VERCEL BUILD VERIFIED (API read-back) |
| Hosted build: Corepack, pnpm 11.25.0, world built from sibling source, `astro check`, `check-dist`, preview target | VERCEL BUILD VERIFIED |
| Hosted routing, headers, journeys, accessibility, fallbacks | **NOT VERIFIED** (blocked on preview access) |
| Phone, screen reader, low-end laptop, Safari/Firefox, context loss, slow network | **NOT VERIFIED** |

**Open defects:** none known in the code. **Blocker:** access to the protected preview for automated tests (an owner decision).
