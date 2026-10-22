# Integration architecture: the portfolio app and the Basin

Phase 3 wraps the accepted World Pass 2.1 (`aed9509`) in a production portfolio site. This note covers the boundary between the two, the protocol that crosses it, the loading sequence and the fallbacks. Content is covered in [CONTENT_MAPPING.md](CONTENT_MAPPING.md) and shipping in [DEPLOYMENT.md](DEPLOYMENT.md).

## 1. Two programs with one boundary

```
portfolio/
├── world-prototype/   the Basin: Three.js + Vite. Still runs on its own (pnpm dev → :5173)
│   └── src/bridge/    protocol.ts (shared types + guards), embed.ts (world side of the bridge)
└── app/               the portfolio: Astro 7, static output
    ├── src/content/   types, data, anchor mapping, renderer: the only copy of every claim
    ├── src/scripts/app.ts   controller: world lifecycle, dialogs, history, bridge (app side)
    └── public/world/  ← build output of world-prototype (generated, git-ignored)
```

| Owned by the app | Owned by the world |
|---|---|
| All text, links and status labels | Terrain, art, anchors, collision, camera |
| URLs, history, deep links | Driving, proximity detection, interior view |
| Quick View, navigator, panels, focus, announcements | Its own loading screen in standalone mode |
| Fallback, map mode, small-screen policy | WebGL capability check and context-loss detection |
| SEO, metadata, deployment config | Debug HUD and debug keys (standalone or `?debug=1` only) |

The world knows **anchor IDs** (`zoneId/siteId` from `world-prototype/src/world/layout.ts` and `anchors.ts`), not content. It never renders a project title or a link. The app knows anchor IDs and content, never geometry. One unit test (`app/tests/mapping.test.ts`) builds the real anchor list from `new Heightfield()` and requires an exact one-to-one match with `app/src/content/mapping.ts`. Adding an anchor in the world without mapping it fails the test.

## 2. Embedding: a same-origin iframe

The app loads `/world/index.html?embed=1` into an iframe. The iframe gives these properties at no cost:
- **Lazy by construction.** No world bytes load until the app decides to mount (never in map mode).
- **Teardown by construction.** Setting `src = about:blank` and removing the element releases the WebGL context, workers and every listener. Nothing is left to clean up by hand.
- **Independently runnable.** The same build is the standalone world.

`X-Frame-Options: SAMEORIGIN` (set in `vercel.json`) stops other origins from framing it. `robots.txt` disallows `/world/` so the bare world page is not indexed in place of the portfolio.

## 3. The protocol (`world-prototype/src/bridge/protocol.ts`)

Every message is `{ ns: 'dhruvas-world/basin', v: 1, type, …payload }`. Each side validates **three** things before acting:

1. `event.source` is the expected window: the app checks the iframe's `contentWindow`; the world checks `window.parent`.
2. `event.origin === location.origin`.
3. The payload passes `isWorldMessage` / `isAppMessage`: namespace, version, a known `type`, and per-type field checks (string lengths, number ranges, enums).

Sends always name the target origin (`postMessage(msg, location.origin)`). There is no `'*'` anywhere. Anything that fails validation is dropped silently.

| World → app | Meaning |
|---|---|
| `progress {stage, frac}` | Loading progress for the app's loading bar |
| `ready {zones, anchors, timings}` | Scene is interactive; timings report heightfield and scene build in ms, and whether the worker was used |
| `error {code}` | `webgl-unavailable`, `init-failed` or `context-lost`, which switches the app to the fallback |
| `zone {zoneId}` | The rover entered a zone (for the announcer) |
| `proximity {site or null}` | The nearest anchor in reach changed (drives the on-screen cue) |
| `interact {site}` | The visitor pressed E or Enter at an anchor |
| `request {quick-view, navigator or escape}` | The visitor pressed Q, M or Esc inside the world |
| `view {surface or interior}` | The camera entered or left the Research Station interior |

| App → world | Meaning |
|---|---|
| `teleport {zoneId}` | Fast travel |
| `input {enabled}` | Disable driving while a dialog is open |
| `pause {paused}` | Stop the render loop while the world is covered |
| `reduced-motion {value}` | Camera cuts instead of eases; dust off |
| `view {surface or interior}` | “Take the lift down” and “Return to the surface” |

## 4. Loading sequence

1. **HTML (about 11 KB) arrives with the whole portfolio in it.** Quick View, the navigator and every project are server-rendered into the page. Without JavaScript, Quick View *is* the page.
2. **The app script (about 15 KB over the wire) wires up the UI.** Quick View works from this moment, about 150 ms after navigation in headless tests, whether or not the world ever loads.
3. **Decide whether to mount the world:**
   - no WebGL 2 → fallback (static map, site list, Quick View);
   - small or touch screen, or `?world=0` → map mode with a “Load the 3D world anyway” button;
   - otherwise → mount the iframe. `?world=1` forces it.
4. **Inside the iframe:**
   - the world checks WebGL 2;
   - it generates the heightfield **in a Web Worker** (`src/hf.worker.ts`; buffers are transferred, not copied);
   - it builds the scene and posts `ready`.
   - If the worker is unavailable it falls back to the main thread (`?worker=0` forces this), and the output is bit-identical (checked by `tools/qa.mjs`).
5. **A 90 s watchdog guards startup.** If `ready` never arrives, or `error` does, the app unmounts the iframe and shows the fallback with **Retry**. No endless spinner.

## 5. Interaction path (anchor → content)

```
rover near anchor ──proximity──▶ app shows cue “evDOCTOR — EV fault diagnosis  [Inspect E]”
visitor presses E ──interact────▶ resolveAnchor('bay','evdoctor') → {kind:'project', id:'evdoctor'}
                                 renderOutcome() → panel HTML (same renderer as /work/evdoctor)
                                 pushState('/work/evdoctor'); input:false, pause:true → world
Esc / Close / Back ─────────────▶ panel closes, history returns to the base entry, focus → iframe,
                                 input:true, pause:false → world (rover exactly where it was)
```

Clicking the cue button does the same as E. The navigator's **Go** sends `teleport`; **Read** opens the zone's primary content without moving.

## 6. Dialogs, focus and history

- There are three dialogs: Quick View, the navigator and the content panel. Each is `role="dialog" aria-modal="true"` with a labelled heading.
- Opening a dialog does three things:
  - it sets `inert` on the header bar and the stage;
  - it moves focus into the dialog;
  - it traps Tab inside it.
- Esc, Close, the scrim and browser Back all close it, and focus returns to whatever opened it (the iframe if the world opened it).
- Each dialog has a URL: `/#quick-view`, `/#map`, `/work/<id>` or `/research`. Every pushed entry records its depth above the base page.
- An explicit close returns to the base entry in one step, so closing a panel opened from the navigator does not reopen the navigator. Back and Forward step through the dialogs one at a time.
- `/work/<id>` and `/research` are also real static pages. A direct load or a crawler gets a complete document, not the 3D shell.

## 7. Fallbacks and adaptive behaviour

| Condition | Behaviour |
|---|---|
| No WebGL 2 (app probe or world probe) | Static map with 13 numbered pins, the site list, Quick View, and an explanation. No iframe. |
| World fails to start or times out | The same fallback, plus **Retry** |
| WebGL context lost while running | The same fallback, plus **Retry** |
| Width ≤ 720 px, or coarse pointer without hover | Map mode: no world download (about 140 KB total transfer); **Load the 3D world anyway** |
| `prefers-reduced-motion: reduce` | The app's sheets don't animate; the world camera cuts instead of easing; dust particles off. The setting is live: changing it while open is forwarded. |
| No JavaScript | Quick View is rendered as the page; every project link is a real static page |

## 8. World changes made for integration

These are all behind `?embed=1` or are neutral for standalone use. Details are in [WORLD_NOTES.md](WORLD_NOTES.md), “Phase 3 integration changes”.
- Heightfield generation runs in a worker (serialisable `Heightfield.toData()` / `fromData()`).
- **Embed mode:**
  - debug HUD and debug keys hidden;
  - own loading screen hidden;
  - spawn uses the 01-spawn hero camera;
  - E/Enter/Q/M/Esc are forwarded to the app.
- Underground culling: in the interior view, the surface world, terrain, sky ridges, rover and particles are hidden. Draw calls drop from 253 to 13 and triangles from 1.04 M to 15 k.
- `CameraRig.reducedMotion`.
- `vite.config.ts`: `base: './'` (so the build works under `/world/`) and ES-module workers.
- No terrain regeneration, no art changes, light budget unchanged.
