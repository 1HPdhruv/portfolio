# Integration audit: Phase 3

Date: 2026-10-22. Base: `aed9509` (World Pass 2.1). Evidence: the test logs and screenshots referenced below, all reproducible with the commands in [DEPLOYMENT.md](DEPLOYMENT.md) §2. This audit is the builder's own; it is returned for independent review, not self-accepted.

## 1. Requirements → status

| Requirement | Status | Evidence |
|---|---|---|
| World is a lazily loaded subsystem and stays independently runnable | **Met** | Same-origin iframe mounted only in 3D mode; `world-prototype` `pnpm dev` and `qa.mjs` unchanged in use |
| App owns content, routing, Quick View, accessibility, deployment | **Met** | `app/src/content/*`, `app/src/scripts/app.ts`, `vercel.json`; the world renders no portfolio text |
| Typed content model, single source of truth, mapped to the real anchors | **Met** | `types.ts` and `data.ts`; `mapping.test.ts` builds anchors from the live heightfield: 42 anchors, 13 zones, one-to-one |
| No fabricated claims or links | **Met, to the builder's knowledge** | Every record has `sources`; links checked 2026-10-22; gaps are listed in CONTENT_MAPPING.md §3, not filled |
| Quick View always available | **Met** | Server-rendered; usable about 150 ms after navigation, during world load, in map mode, in the fallback and without JS (e2e 1, 4, 6) |
| Accessible location navigator and fast travel | **Met** | `#navigator`: 13 zones, each with Go (teleport) and Read; static map pins (e2e “navigator…”, “Go travels…”) |
| Typed, origin-checked messaging; no wildcard | **Met** | `protocol.ts` guards; source, origin and shape checks on both sides; `protocol.test.ts` |
| WebGL fallback | **Met** | e2e “no WebGL…” and “world script fails…”; context loss handled through the same path (not exercised by a test) |
| Mobile handling | **Met in emulation** | Map mode at ≤ 720 px or coarse pointer; 140 KB total; no overflow at 390 px. **No real-device test** |
| Reduced motion | **Met** | e2e: rig cuts, sheet animation `none`; live media-query changes are forwarded |
| Heightfield off the main thread | **Met** | `worker: true` in every run; bit-identical to the main-thread output (`qa.mjs`) |
| Underground culling | **Met** | 253 → 13 draw calls, 1.04 M → 15 k triangles |
| SEO and metadata | **Met, with one owner action** | Title, description, OG/Twitter cards, `og.jpg` 1200×630, JSON-LD `Person`, real static pages per project, `robots.txt`; canonical, `og:url` and sitemap entries need `SITE` |
| Vercel-compatible static output | **Met, not exercised on Vercel** | `astro build` → `dist/`; `vercel.json`. No deployment was made (by instruction) |
| Unit tests, browser e2e, screenshots | **Met** | 22/22, 51/51, 11 screenshots |
| Docs | **Met** | INTEGRATION, CONTENT_MAPPING, DEPLOYMENT, this file, WORLD_AUDIT §10, WORLD_NOTES Phase 3 |
| Compressed review pack; PNG archive not committed | **Met** | `world-prototype/screenshots/review-pack/` (18 JPEG, 2.4 MB); `pass2.1/` git-ignored and kept locally |

## 2. Test results (exact commands)

| Command (directory) | Result |
|---|---|
| `pnpm test` (`app/`) | **22/22 passed**: content integrity, anchor bijection, protocol guards |
| `pnpm build` (`app/`) | Passes. `astro check`: 0 errors, 0 warnings, 0 hints; 14 pages plus `robots.txt` and `sitemap.xml` |
| `pnpm e2e` (`app/`, against `pnpm preview`) | **51/51 passed**: log in `docs/screenshots/phase3/e2e-results.txt` |
| `pnpm exec tsc --noEmit` (`world-prototype/`) | Passes |
| `node tools/qa.mjs` (`world-prototype/`, dev server) | **27/27 passed** |
| `node tools/drive.mjs` (`world-prototype/`) | All 13 zones are drivable; the main descent completes (1672 of 1692 samples, ends at the Research Station) |

**What the e2e suite exercises** (headless Brave, real WebGL through ANGLE/Metal):
- **Dialogs:**
  - Quick View semantics: role, `aria-modal`, labelled heading;
  - focus moves in, Tab is trapped (80 presses), Esc closes, focus is restored, the background is `inert`;
  - driving keys are blocked while a dialog is open.
- **Anchor interaction:** proximity cue → E → evDOCTOR panel at `/work/evdoctor` → Esc → focus back in the world, with zero rover drift.
- **Navigation:**
  - navigator Go → teleport;
  - Read → research page → “Take the lift down” → interior (culled) → Esc → surface;
  - Back/Forward through Quick View → project → Quick View → project.
- **Robustness:**
  - three repeated mounts leave one iframe;
  - direct routes and the deep link `?site=` work, and unknown URLs return 404;
  - the no-WebGL fallback and the world-script-failure fallback (with Retry) both work.
- **Layouts and settings:** reduced motion; phone map mode and Quick View at 390 px; tablet 1024×768.
- **Links and privacy:** 30 internal links return 200; external links are https only; no phone number pattern on the page.
- **Accessibility basics:** `lang`, a single `h1`, named controls, alt text, unique ids and the skip link, on `/`, `/work/evdoctor` and `/research`.

## 3. Performance (measured, headless; indicative only)

Environment: Apple M4, headless Brave (ANGLE/Metal), DPR 1, `astro preview` on localhost (no network latency), cold browser context per run. `node app/e2e/measure.mjs`, 3 runs. Headless rAF is capped and the GPU is shared with the desktop, so these are **not** field numbers.

| Metric | Desktop 1440×900 (3 runs) | Phone emulation 390×844 |
|---|---|---|
| DOMContentLoaded | 135–145 ms | 58–65 ms |
| Portfolio usable (app script wired; Quick View works) | 148–157 ms | 79–80 ms |
| World ready (iframe posts `ready`) | 2.33–3.16 s | not loaded (map mode) |
| Heightfield, in the worker | 1.10–1.53 s | n/a |
| Scene build | 0.76–0.98 s | n/a |
| Transfer, total | 351 KB (+ the 23 KB worker, which CDP's page session does not count) | **140 KB** |
| app HTML / CSS / JS | 11.3 / 3.0 / 14.5 KB | same |
| images (map WebP, favicon) | 111 KB | same |
| world JS (gzip on the wire; 773 KB raw) | 210 KB | 0 |
| Spawn view: draw calls / triangles | 515 / 2.09 M (Pass 2.1 audit: 512 / 2.09 M) | n/a |
| Forced-sync frame time, spawn: median (p90) | 16.5–20.2 ms (20.6–25.6) | n/a |
| Interior: calls / triangles / frame median | 13 / 15 k / 4.3–4.4 ms | n/a |
| World JS heap (iframe) | 70–88 MB | n/a |

A static project page (`/work/evdoctor`) transfers 5.6 KB and loads in 44 ms.

**Caveats:**
- Frame times use the forced-sync benchmark (`bench(30)`, a GPU readback each frame). They are comparable between views, not a frames-per-second figure.
- Run-to-run variance is about ±30 % under desktop load.
- The 2.09 M-triangle spawn view is unchanged from the accepted Pass 2.1 state. Integration added no render cost.

## 4. Accessibility and fallback behaviour

The **checks below are automated and structural** (51-check e2e). **No manual screen-reader pass (VoiceOver or NVDA) has been done, and no contrast audit tool was run**; both are recommended before launch.
- **Keyboard:**
  - skip link first in the tab order;
  - every control is a real `button` or `a`;
  - shortcuts: Q (Quick View), M (map), E or Enter (inspect), Esc (close or leave the interior).
  - The shortcuts are shown as `<kbd>` hints, and every function also has a visible button.
- **Dialogs:**
  - modal semantics, focus trap and focus restore;
  - background `inert`;
  - the URL reflects the open dialog.
- **Announcements:**
  - A polite live region announces zone changes, opened content, travel and world failures.
  - The world iframe has a descriptive `title` with the controls.
- **Reduced motion:** no sheet animation, camera cuts, no dust.
- **Fallback modes:**
  - map mode on small or touch screens;
  - fallback for missing WebGL 2, init failure or context loss;
  - no-JS: Quick View rendered as the page.
- **Content parity:** all 42 anchors' content is reachable without the 3D world, through Quick View, the navigator's Read, the fallback list and the static pages.

## 5. Bugs found and fixed during Phase 3 verification
1. **A project opened from Quick View pushed `/` instead of `/work/<id>`.** `closeDialog(…, replacing)` cleared `panelUrl` before the new dialog read it.
2. **Closing a panel opened from the navigator reopened the navigator.** The explicit close stepped back one history entry, onto `/#map`. The interior lift and fast travel from that state were blocked. History entries now carry their depth, and an explicit close returns to the base entry in one step.
3. **Opening an already-open dialog pushed a duplicate history entry.**
4. **The home page had two `h1` elements** (the fallback title); it is now an `h2`. A skip link was also added.
5. **`robots.txt` / `sitemap.xml`:** the config referenced a sitemap that did not exist. Both are now generated, with absolute URLs when `SITE` is set.
6. **The e2e privacy check contained fragments of the owner's phone number.** It was replaced by a generic pattern before anything was committed.

## 6. Remaining risks and deferred issues

| # | Risk or issue | Severity | Note |
|---|---|---|---|
| 1 | Not run on Vercel; no real domain | Medium | Run DEPLOYMENT.md §5 on a preview deployment first |
| 2 | No real-device mobile, touch or low-end GPU test | Medium | Map mode is the default on phones; “Load anyway” on a weak GPU may be slow |
| 3 | No manual screen-reader or contrast audit | Medium | Structural checks only |
| 4 | Content gaps: résumé PDF (contains a phone number), LinkedIn unverified, maze robot evidence, achievement proof, SEV Guardian demo, research detail | Owner | CONTENT_MAPPING.md §3 |
| 5 | World JS is a single 773 KB chunk (217 KB gzip) | Low | Only loaded in 3D mode; could be split (e.g. Three.js vendor chunk) later |
| 6 | Keyboard users must move focus into the iframe to drive | Low | Click or Tab into it; the cue button, navigator and Quick View cover everything without driving |
| 7 | `window.__basin` and `window.__app` test hooks, and `?worldTimeout`, ship in production | Low | No data or secrets; they expose world internals (teleport, stats). Could be gated behind `?debug=1` |
| 8 | World debt carried from Pass 2.1 (terrace risers, etc.) | Low | WORLD_AUDIT.md §10 |
| 9 | WebGL context-loss path not exercised by a test | Low | Same code path as init failure |

## 7. Screenshots

Full-resolution PNGs are in `app/e2e/screenshots/` (regenerated by every `pnpm e2e`, git-ignored). Committed JPEGs are in `docs/screenshots/phase3/`:

| Required view | File |
|---|---|
| Initial desktop | `01-initial-desktop-1440x900.jpg` |
| Quick View | `02-quick-view-1440x900.jpg` |
| Featured project panel | `03-project-panel-evdoctor-1440x900.jpg` and `03b-featured-agrisaarthi-1440x900.jpg` (AgriSaarthi via deep link) |
| Research Station interaction | `04-research-station-panel-1440x900.jpg` |
| Location navigator | `05-location-navigator-1440x900.jpg` |
| Small screen | `06-mobile-map-mode-390x844.jpg` and `06b-mobile-quick-view-390x844.jpg` |
| Static fallback | `07-static-fallback-no-webgl-1440x900.jpg` |
| Underground interior | `08-underground-interior-1440x900.jpg` |
| (extra) Tablet | `09-tablet-1024x768.jpg` |

---

## Phase 4: release-candidate hardening (2026-10-22)

Full evidence, gates and verdicts are in [RELEASE_READINESS.md](RELEASE_READINESS.md); this section records what changed relative to the Phase 3 audit above.

**Baseline verified before work:**
- Branch `main`; `9eac815` → `448234b` → `aed9509` → `fb8b9c5` → `ffd23da`; clean working tree.
- The Pass 1, 2 and 2.1 screenshot archives are intact: 19, 23 and 30 files.
- The world diff since `aed9509` touched only integration code (bridge, worker, embed mode, culling flag).

**Status of the Phase 3 risks (§6 above):**

| Phase 3 risk | Phase 4 outcome |
|---|---|
| 1. Not run on Vercel | `vercel build` run locally and its route table replayed. This **found a P0**: `cleanUrls` redirected `/world/index.html`, breaking the world. Fixed: the world is now served at `/world/basin`. A real preview is still **NOT VERIFIED** |
| 2. No real-device, touch or low-end GPU test | Real devices still **NOT VERIFIED**. A SwiftShader run **found a P1**: the page was unusable at about 1 fps. Fixed with the software-renderer probe and frame-rate watchdog |
| 3. No manual screen-reader or contrast audit | Contrast is now **measured** on rendered pixels (0 failures across 411 runs, after fixing the `kbd` hints at 3.66–4.42:1). Screen reader still **NOT VERIFIED**; checklist in RELEASE_READINESS §7.1 |
| 5. World JS single chunk | Unchanged (770 KB, 212 KB gzip); deferred |
| 7. Test hooks ship in production | **Fixed**: build-time gates plus the `check-dist` guard. The bare world page no longer exposes the debug HUD |
| 9. Context-loss path untested | Unchanged |

**New or changed since Phase 3 (all re-tested):**
- debug isolation;
- the `/world/basin` URL;
- the software-renderer probe and frame-rate watchdog;
- the “use the map instead” exit during load;
- the dialog state handed to the world on `ready`;
- yielding scene build (longest start-up task 1.35 s → 0.24 s);
- announcement ordering;
- panel id scoping;
- target sizes and heading fixes;
- the `SITE` validation;
- pinned pnpm and Node versions;
- the maze-robot attribution.

**Test totals:**

| Suite | Phase 3 | Phase 4 |
|---|---|---|
| Unit | 22 | 29 |
| e2e (QA build) | 51 | 58 |
| Production-build e2e (new) | n/a | 23, on both `astro preview` and the replayed Vercel routes |
| a11y audit (new) | n/a | 15 states |
| Low-power (new) | n/a | 7 |
| World QA | 27 | 27 |

Every run passed. Commands and exit codes: RELEASE_READINESS §3.

**Evidence:**
- `docs/screenshots/phase4/`: 23 JPEGs, 2 contact sheets and `logs/`.
- `world-prototype/screenshots/review-pack/phase4/regression-pass2.1-vs-phase4.jpg`.
