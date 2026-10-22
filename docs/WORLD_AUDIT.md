# WORLD AUDIT — The Basin, World Pass 2.1

Prepared for independent acceptance review. This document separates facts, test results, visual observations, measurements and assumptions. It does **not** record acceptance; the acceptance decision belongs to the owner.

- Repository: `github.com/1HPdhruv/portfolio` (local only; nothing pushed)
- Baseline: `fb8b9c5 world: checkpoint Pass 2`
- Audited state: commit `world: Pass 2.1` on top of `fb8b9c5` (code, docs, `tools/qa.mjs`, contact sheets). The 90 MB `screenshots/pass2.1/` PNG set is left **untracked** on disk pending decision 3 below.
- Detailed notes: `docs/WORLD_NOTES.md` → "World Pass 2.1"

## 1. Repository state (confirmed)
- `git diff --check`: no whitespace errors.
- Source changes are confined to `world-prototype/` (11 files modified, `tools/qa.mjs` added); documentation in `docs/`. No file outside these was changed.
- Screenshot archives `pass1/` and `pass2/` unchanged since the checkpoint; new sets in `pass2.1/` and `compare/`.
- Refactor safety: before any layout change, the heightfield and all splat textures produced by the refactored pad code were hashed against the checkpoint — identical (`h b74468a6c6`, `splat c58b5ea9cc`, `splat2 ceeec104e1`, `splat3 60c935c0b2`, `splat4 f3928d0f03`).

## 2. Confirmed implementation facts
- Agri Terraces: 5 treatments in a seeded randomised block design per bench; plot lengths 17–29 m; radial plot boundaries; rows parallel to each bench lip; 4,885 crop instances on 19 benches; irrigation main (9 segments, valve boxes) + 19 bench hoses fed from the existing header tank; sensor stakes, weather station, gantry, sensor station unchanged.
- Agent Operations: two benches (53.5 m upper, 50.0 m lower) with a 3.5 m retaining wall, stair, cable riser; five modules, cable ladder, power skid, coolers, cabin, trench, generator, mast all retained; OP-01/02 running, OP-03..05 dark (unchanged).
- Anchor API (`src/zones.ts`) unchanged: 42 anchors. Zone list unchanged: 13 zones.
- Real lights: 3 (unchanged). No SpotLights. No new dependencies.

## 3. Automated test results (exact commands, run from `world-prototype/`)
| Command | Exit | Result |
|---|---|---|
| `npx tsc --noEmit` | 0 | no errors |
| `pnpm build` | 0 | 767.31 kB JS / 215.02 kB gz |
| `node tools/qa.mjs` | 0 | **23/23 passed** — C contour mode on/off, O overview on/off, F free-fly (camera moved 30 m with W) and back, H hide/restore UI, P anchor pins, Digit1/3/5 teleports (0.00 m error), 42 anchors, all reference existing zones, all on terrain (max \|dy\| 0.000 m), site anchors within 45 m of zone centres, Agent Ops anchors on the 53.5 m bench, rover stopped by the retaining wall, rover clearance 0.35–0.45 m on the bench, **no console errors**, **no failed / 4xx / 5xx requests** |
| `node tools/drive.mjs` | 0 | 13/13 zones drivable; camera 14.5–16.9 m above terrain; rover clearance 0.12–0.62 m; **Main Descent completed end to end** in 112.3 s (Pass 2 baseline 112.2 s) |
| `node tools/shots.mjs --out screenshots/pass2.1` | 0 | 29 views |
| `node tools/shots.mjs --url http://127.0.0.1:5174/ --out screenshots/pass2.1/baseline-pass2` | 0 | 29 views from the checkpoint |
| `npx tsx tools/map.ts screenshots/pass2.1/00-layout-map.png` | 0 | ok |

Console warnings present in both Pass 2 and 2.1: `THREE.Clock` deprecated; `PCFSoftShadowMap` → `PCFShadowMap`.

## 4. Visual observations supported by screenshots
Evidence: `world-prototype/screenshots/compare/` (side-by-sides at identical cameras and resolution), originals in `pass2.1/` and `pass2.1/baseline-pass2/`.
- `p2-vs-p2.1_04b-agri-terraces-top.jpg`: Pass 2 shows uniform brown striped benches; Pass 2.1 shows distinct plots — furrowed fallow, pale ripe, green mid-crop, striped ley, headlands — with offset boundaries between benches and a grass margin ring.
- `p2-vs-p2.1_04-agri-terraces.jpg` / `04d-agri-bench-level.jpg`: crop rows now follow each bench; irrigation hoses visible along the benches; adjacent plots show different treatments. Jagged riser edges remain at bench level (mesh resolution).
- `p2-vs-p2.1_06b-agent-operations-top.jpg` / `18-industry-overview.jpg`: the 46 m square slab is replaced by two rounded, offset benches; the step between them is legible from above.
- `p2-vs-p2.1_06-agent-operations.jpg`: retaining wall and stair make the two levels readable at medium distance; modules and cable ladder remain legible.
- `sheet_p2.1_current-views.jpg`, `p1-vs-p2.1_02-overview.jpg`, `p1-vs-p2.1_03-descent.jpg`: Research Station, Signal Tower, ROVER-02, Strata, Watershed, Local Minimum, spawn, boundary-free overview and descent vista match Pass 2 (no regressions observed).

## 5. Performance measurements
Apple M4, headless Brave 154 (ANGLE Metal), 1600×1000, DPR 1, forced-sync 24-frame benchmark, interleaved Pass 2 / 2.1 runs ×3, medians. Machine load average 3–9 during runs.
- Draw calls: −9 to +2 per view. Triangles: −147k to +73k per view.
- Median frame time: all affected views within run-to-run noise (largest delta 04 terraces 13.7 → 16.0 ms with P2 runs spanning 12.9–17.4 ms).
- Load: world build +~100 ms (393 → 484–590 ms); heightfield ~unchanged (1.08 → 1.10–1.14 s); page → interactive 1.9 → 2.0–2.5 s.
- Memory: textures 15 → 18; est. texture memory 80.1 → 87.4 MB; geometry 30.1 → 31.1 MB; JS heap 85–101 → 104–119 MB.
- Bundle: 758.00 → 767.31 kB (210.98 → 215.02 kB gz).
- **Comparable**: draw calls, triangles, memory, bundle, interleaved frame-time medians. **Not comparable**: Pass 1 vs Pass 2 timings recorded earlier (different machine load). No sustained-60 FPS claim — headless rAF is capped and no real-time device measurement was made.
- Confirmed issue: the underground view (`16-research-interior`) still submits the surface world (476 draw calls, 2.06 M triangles).

## 6. Unverified assumptions
- Behaviour on real (non-headless) browsers, other GPUs, mobile or low-power devices — not tested.
- Real-time frame rate during interactive driving — not measured.
- Whether a non-ML visitor reads the terraces as a "field trial" rather than generic farming — subjective, not tested with people.

## 7. Acceptance criteria assessment
| Criterion | Verdict | Evidence |
|---|---|---|
| **Agri Terraces** | **CONDITIONAL PASS** | From above and at bench level the benches are no longer identical strips; five treatments, offset plot boundaries, headlands, contour rows, irrigation (`04b`, `04d`). Condition: from the low `04` camera the narrow upper benches still read as a stepped grass slope, and riser edges stay jagged at 1 m mesh resolution. |
| **Agent Operations** | **PASS** | Two rounded benches with a retaining wall replace the square slab (`06b`, `18`); modules and infrastructure legible (`06`); objects grounded (53.4–53.5 m); wall collision and clearance verified by `qa.mjs`. |
| **World identity** | **PASS** | Palette, materials, survey contours, lighting unchanged; no new visual language introduced (`sheet_p2.1_all.jpg`). |
| **Preservation** | **PASS** | Heightfield outside the two sites unchanged; boundary, erosion, Main Descent, rover, Signal Tower, Research Station, Strata, Watershed, Local Minimum match Pass 2 (`sheet_p2.1_current-views.jpg`, `p1-vs-p2.1_*`). |
| **Navigation** | **PASS** | 13/13 zones, Main Descent completed, camera clearance valid, 42 anchors grounded (`drive.mjs`, `qa.mjs`). |
| **Performance** | **PASS** | No newly unacceptable cost; +~100 ms build and +7.3 MB textures are the only measurable increases. |

## 8. Remaining issues
**P1**
- Jagged terrace riser edges at close range (1 m terrain mesh). Needs local mesh refinement if close-up terrace shots matter.
- Underground view renders the surface world (wasted ~2 M triangles while inside).

**P2**
- Upper narrow benches read as grass steps from low angles.
- Agent Ops lower bench is plain gravel at medium distance.
- Unused `splat5` R/G data; +100 ms world build (crop scan could be coarser).
- THREE deprecation warnings; shadow range ±70 m; dotted distant wires (pre-existing).
- Screenshot sets total ~130 MB as PNG in `screenshots/`; consider JPEG archives before pushing.

## 9. Decisions for the owner
1. Accept, conditionally accept, or reject Pass 2.1 (this document is evidence only).
2. Whether the jagged terrace riser edges at bench level must be fixed before integration (mesh refinement) or are acceptable.
3. Whether the ~130 MB of PNG screenshot archives should be committed as PNG or converted to JPEG.
4. Phase 3 (portfolio integration) was requested before this evidence existed; confirm it should proceed on this Pass 2.1 state.

---

## 10. Phase 3 addendum (2026-10-22): approved baseline and carried debt

**Baseline.** Phase 3 integrated the world at **`aed9509` (World Pass 2.1)**, as authorised by the owner. That is the approved art baseline. Phase 3 made no terrain or art changes, only the integration changes listed in WORLD_NOTES.md (“Phase 3 integration changes”).

**Resolved in Phase 3**
- ~~Underground view renders the surface world~~ → the interior now culls the surface: 253 → 13 draw calls, 1.04 M → 15 k triangles (`tools/qa.mjs`, and the e2e “Take the lift down” check).
- ~~Screenshot archive size~~ → `screenshots/pass2.1/` (89 MB PNG) stays local and git-ignored. An 18-image JPEG review pack (2.4 MB) is in `screenshots/review-pack/`. The Pass 1 and Pass 2 archives are untouched.

**Known debt carried forward (non-blocking, owner-accepted for integration)**

| Item | Severity |
|---|---|
| Jagged terrace riser edges at bench level (1 m mesh) | P1 visual, close range only |
| Upper narrow benches read as grass steps from low angles | P2 |
| Agent Ops lower bench reads as plain gravel at medium distance | P2 |
| Unused `splat5` R/G data; +100 ms build | P2 |
| THREE deprecation warnings (`Clock`, `PCFSoftShadowMap`) | P2; no functional effect |
| Shadow range ±70 m; dotted distant wires | P2, pre-existing |
| World JS is 773 KB (217 KB gzip) in a single chunk | P2 performance; loaded only in 3D mode |

**Re-verified after integration:**
- `pnpm exec tsc --noEmit` passes;
- `node tools/qa.mjs` passes 27/27;
- `node tools/drive.mjs` completes the descent route and all 13 zones.
