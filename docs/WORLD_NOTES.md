# WORLD_NOTES — The Basin, 3D world prototype

Phase 1 deliverable. Built by Claude (Opus) in place of Fable, against `docs/FABLE_WORLD_BRIEF.md` under `docs/PROJECT_DIRECTIVE.md`.
Status: **prototype complete, awaiting visual/UX review.** No portfolio UI, content, routing or progression has been built.

```
cd world-prototype
pnpm install          # first run only
pnpm dev              # http://127.0.0.1:5173
pnpm build            # production bundle in dist/
node tools/shots.mjs  # re-render screenshots/ (needs `pnpm dev` running)
node tools/drive.mjs  # navigation test: every zone + a scripted drive down the Main Descent
npx tsx tools/map.ts out.png   # top-down layout map (hillshade + contours + roads + rivers + pads)
```

**Controls:** WASD/arrows drive, Shift boost, drag to orbit, wheel to zoom.
**Debug keys:** `1–9,0` teleport to zones; `F` free-fly (WASD+QE, drag to look); `O` survey overview; `C` contour/heightmap mode; `P` interaction anchors; `H` hide the debug panel. The debug panel (top-left) shows draw calls, triangles, geometries, textures, position, elevation and surface.

---

## 1. Architecture and technology choice

| Choice | Why |
|---|---|
| **Plain three.js r186 + Vite + TypeScript** (not R3F) | The world is procedural and imperative: CPU heightfield, shader patches, geometry merging. A React reconciler adds nothing here, and the final app can still mount this as an island. |
| **One CPU heightfield, everything derived from it** | Terrain mesh, road profiles, rivers, pads, splat masks, vegetation density and placement all sample the same `Heightfield`. Nothing floats and nothing sinks. |
| **No external assets** | Every texture is either procedural GLSL or a tiny generated canvas texture (signs, decals, interiors). The bundle is 716 KB JS (195 KB gzipped) with zero other files. |
| **Single source of truth for layout** | `src/layout.ts` holds pads, roads, rivers, the escarpment and zones. `src/zones.ts` derives interaction anchors from the same pad frames the builders use. |

```
world-prototype/src
  main.ts          renderer, loop, debug API (window.__basin), benchmark
  noise.ts         seeded Perlin, fbm, ridged multifractal, PRNG
  layout.ts        pads, roads, springs, escarpment, zone list (authoritative)
  heightfield.ts   terrain generation pipeline (§2) + splat/moisture/vegetation bakes
  terrain.ts       chunked terrain mesh, outer upland ring, survey-contour terrain shader
  env.ts           height-aware fog patch, dusk sky dome, far ridgelines, lights
  rover.ts         ROVER-02 model (static parts merged), suspension, headlamp pool
  drive.ts         vehicle controller (surfaces, slope limit, colliders, terrain-following body)
  camera.ts        third-person/oblique rig, overview, free-fly, locked (screenshots)
  colliders.ts     2D circle/OBB colliders registered by structures, trees, boulders
  dust.ts          the only particles: wheel dust on unpaved ground
  zones.ts         interaction anchors {zoneId, siteId, label, position, radius}, 42 of them
  debug.ts         dev overlay
  world/
    materials.ts   one weathered material family + interior cards + stencil signage
    kit.ts         Frame, Builder (per-material merging), instancing tiles, distance culling, fake light pools, global static merge
    props.ts       parametric kit: cases, crates, containers, fences, rails, stairs, masts, dishes, tanks, IBCs, solar, AC units, generator, stakes, windsock, weather station, trig pillar, survey tripod...
    rim.ts         Init/Origin, Field Office, Signal Tower (+ decal / glow helpers)
    east.ts        Diagnostics Bay, Agent Operations, Workshop (+ Don't Touch It)
    west.ts        Agri Terraces, Proving Grounds + Benchmark Ridge, Local Minimum, Hedge Maze
    floor.ts       The Strata, Research Station (+ underground corridor)
    watershed.ts   river ribbons, settling pond, gauging stations, pump house
    roads.ts       road paint, guard rails, delineators, elevation posts, culverts
    veg.ts         grass, shrubs, riparian trees, boulders, reeds, springs, survey transects, telegraph line
tools/  shots.mjs (screenshot + benchmark harness), drive.mjs (navigation test), map.ts (layout map)
```

Scale: **1 unit = 1 m**. +x is east, +z is south, +y is up. The rim is north and the floor is south. The playable grid is 600 × 800 m (x −300…300, z −400…400), on a 1 m heightfield (601 × 801 samples). ROVER-02 is about 1.3 × 0.8 × 0.55 m.

## 2. Terrain formula and generation pipeline

**Seed:** terrain `SEED = 1729` (Perlin permutation). Plateau noise uses 4242, vegetation 808/31337, the maze 2019 and crops 99. Every run is deterministic.

`baseHeight(x, z)` in `heightfield.ts`:
1. **Asymmetric elliptical bowl.** `d = √((x/300)² + (dz)²)`, where `dz = (z−285)/680` north of the floor and `(z−285)/108` south of it. Then `h = 100 · d^1.55` (linear beyond `d = 1`). The result is a long gentle northern descent and a short steep southern wall behind the Research Station.
2. **Domain-warped ridged multifractal.** Amplitude 12, grows with `d`; 4 octaves at 0.0068/m; the domain is warped ±38 m by Perlin. This makes the spurs, ravines and saddles.
3. **Small fbm.** Amplitude 1.5, 3 octaves at 0.018/m.
4. **Loss-surface ripples.** `3.4 · sin(0.026x + warp) · sin(0.019z + warp)`, which gives the wide undulations, saddles and shallow basins.
5. **Authored Gaussians:**

   | Feature | Height | Centre | σ |
   |---|---|---|---|
   | Northern crest | +14 | (70, −345) | 130 × 70 |
   | Benchmark Ridge spine | +13 | (−70, 40) | 14 × 70 |
   | Global minimum | −9 | (0, 285) | 55 |
   | Local Minimum (broad) | −6.5 | (−95, −150) | 15 |
   | Local Minimum (pit) | −3.2 | (−95, −150) | 6.5 |
   | Decoy pit | −4.5 | (70, 120) | 22 |
   | Decoy pit | −5 | (−120, 120) | 20 |

6. **Upland blend.** `+9 m` puts the floor at about 0 m. The bowl then blends into `plateauHeight()` (118 m + fbm + ridged mountains that grow with distance) over `d ∈ [0.8, 0.99]`, with a rectangular-edge fallback. The playable edge sits inside that blend, so the Basin reads as cut into a continuous upland.

**Pipeline** (`new Heightfield()`, about 0.7–1.7 s in-browser on the main thread):
`buildBase` → `applyFeatures` → `carveRivers` → `reflattenPads` → `carveRoad`×11 → `paintPads` → `bakeCavity` → `bakeVegetation`.

- **Agri terraces.** Height is quantised into 2.5 m benches, 4 per 10 m, with smoothstep risers. A ±0.7 m wobble makes the benches wander, so they read hand-built.
- **The Strata escarpment.** A fault-block ridge 21 m high, with a sheer west face (transition ±1.3 m), a 75 m back-slope and tapered ends. Line (76, 58) → (54, 150).
- **Pads.** These are rounded-rectangle flattening, applied sequentially, with an optional tilt (the maze follows 80% of the slope). The cut/fill falloff is 14–46 m. Pad cores are re-flattened after river carving.
- **Rivers.** Five springs on the inner rim. The routing field is the blurred terrain with pads and the Local Minimum repelled. Routing uses gradient descent with inertia. On reaching an existing river, a stream joins it and its flow accumulates downstream, so width grows with √flow. Water level is a monotone lower envelope. Channels are carved, and everything ends in a settling pond at (−22, 232).
- **Roads.** Catmull-Rom sampling every 0.5 m. Each elevation profile is the triple-smoothed terrain, eased onto the real ground within 28 m (main) or 16 m (trails) of each end, then grade-limited to 12.5% (main) or 20% (trails), with both ends pinned. Cut/fill blends over the shoulder width.
- **Splat textures (RGBA8, 1 m):**

  | Texture | R | G | B | A |
  |---|---|---|---|---|
  | `splat` | paved road | track | hardstand (1–127 gravel, 128–255 concrete) | tilled field |
  | `splat2` | wet bank | cavity (baked faux-AO) | terrace mask | strata mask |
  | `splat3` | vegetation density | moisture | — | — |

  The terrain shader and the instanced plants both read `splat3`, so green ground and plants coincide.

**Measured terrain:** height 0.8 m at the floor to 125.7 m at the upland. The Main Descent is 857 m long and drops 96.7 m, at a 12.5% maximum grade.

## 3. Zone coordinates

Elevations are measured on the generated terrain.

| # | Zone | Centre (x, z) | Elev. | What is physically there |
|---|---|---|---|---|
| 1 | Init / Origin | (14, −304) | 97.5 | Concrete pad; dock shed with half-rolled door; charging gantry and umbilical; painted launch ring ("INIT · DATUM 0"); trig pillar under a 7.5 m timber survey tripod (first landmark); windsock; quick-view kiosk; container store; battery pallets; stake 01; "THE BASIN" sign showing the real elevation |
| 2 | Field Office | (−42, −290) | 97.5 | Expedition cabin on screw piles with lit desk windows; porch with field printer (resume station) and noticeboard; yagi mast aimed at the tower; VSAT dish; solar array and battery box; generator and jerrycans; IBC water with hose; weather station; stake 02 |
| 12 | Signal Tower | (92, −338) | 119.0 | 60 m guyed triangular lattice mast; orange beacon pulsing every 4 s (one real light plus a glow sprite); microwave dishes aimed at Agent Ops and the Research Station; equipment hut with AC and a cable bridge; solar rows; chain-link fence; switchback service track |
| 3 | Agri Terraces | (−176, −122) | 70–90 | Contour-following benches with grassed risers; about 7.8k crops in three growth stages plus fallow benches; 25 soil-sensor stakes with solar caps; sensor station with gateway mast, weather station, header tank and irrigation main; phenotyping gantry straddling a row |
| 4 | Diagnostics Bay | (150, −70) | 68.0 | Portal-frame garage cut into the east wall; two-post lift holding an EV skateboard chassis (battery pack, orange HV leads); OBD cart; pallet racking; drive-through scanner arch; "BAY 01" markings and oil stains; waiting EV with bonnet up and a diagnostic lead; battery-quarantine container; floods |
| 5 | Agent Operations | (148, 40) | 46.0 | Data hall with louvres and open doors onto lit rack rows; rooftop and yard chillers; Operator Row canopy with five consoles facing the basin — OP-01 and OP-02 running (status lamps blink at different periods: independent loops), OP-03 to OP-05 under tarps (future agents); grated cable trench; cable tray to a microwave mast aimed at the tower; transformer compound; stake 03 |
| 6 | Proving Grounds | (−150, 10) | 64.5 | Sealed test oval with timing gate; scaffold scoring tower with a blank scoreboard (no fabricated results); bleachers; tyre barriers; slalom poles; lane flags; test-team canopy; stake 04. **Benchmark Ridge** runs along the rock spine to the east at x ≈ −70: six brass benchmark discs plus three empty sockets for marks still to be earned |
| 7 | Workshop | (84, 196) | 17.0 | Open-sided fabrication shed with bench, vice, tool board, drill press, lathe, soldering desk, oscilloscope cart, parts bins and gas cylinders; a half-built second ROVER on stands, with its wheels on the bench; calibration checkerboard with a small robot and cones; skip; **"EVERYTHING WORKS / DON'T TOUCH IT"** — a fenced, humming rig with a spinning flywheel and a blinking lamp |
| 8 | Hedge Maze | (−150, 200) | 35–45 | Seeded 11×11 DFS maze of 3.6 m cells with 1.65–1.9 m hedges, following the slope; the original solver parked in the deepest cell; its BFS path drawn in chalk dots (584) from the entrance; lamp, bench and "ORIGIN · SOLVER v1" plaque; reached by a faint 1.1 m track |
| 9 | Watershed | spans the basin | — | Five spring seeps join into one trunk; four confluences each carry a gauging station (concrete weir, stilling-well hut with solar and antenna, staff gauge, "GS-n" plate); a settling pond with a pump house piping water to the Research Station; trees and reeds follow the water |
| 10 | The Strata | (44–66, 60–150) | 25–50 | 21 m sheer fault-block face with dipping beds (buff sandstone, grey, dark shale, rare ochre), hard-bed ledges in relief, fractures; layer plates S-01 to S-06 at the foot (no invented years); scaffold; measuring staff; core boxes on pallets under a tarp; roadside viewing platform |
| 11 | Research Station | (10, 278) | 0.8 (global minimum) | Concrete collar with blast doors — one open, the shaft lit from below; orange/black hazard ring; 24 m steel headframe with sheaves, the lamp on top visible from the rim; hoist house with winding drums behind tall lit windows; four instrument pylons; core store; floods; gatehouse; barrier; bollards; stake 05. **Underground** (y ≈ −29): a lift hall and a 52 m corridor with seven labelled rooms (Computer Vision, Multimodal AI, Medical AI, Experiments, Data, Research Questions, Papers / Writing) and a status board |
| 13 | Local Minimum | (−91, −149) | 61.5 | A true closed pit: every point on a 14 m ring is higher. A chalk index contour closes around it. Survey stake at the bottom; hand-lettered board on the lip: "LOCAL MINIMUM / not the bottom. / try momentum →"; faint spiral tyre tracks |

Interaction anchors: `src/zones.ts` exports `buildAnchors(hf)`, which returns 42 anchors, and `window.__basin.anchors` exposes them. They cover every site above, the six strata plates, nine benchmark markers and four confluences. The site IDs mirror the spec's content list (evdoctor, agrisaarthi, strategyai, sev-guardian, amazon-ml-challenge, maze-robot, and so on) and assert nothing.

## 4. Path system

- **Main Descent.** Paved, 6.8 m wide, from the Init pad edge to the Research Station, with nine switchbacks. Twin chalk edge lines and a dashed centre line are terrain-hugging ribbons. Galvanised guard rails are placed automatically wherever the road runs on fill above a drop of more than 1.6 m. White-and-orange delineators sit every 40 m. Concrete elevation posts mark each 10 m of descent ("ELEV 80 m" … "ELEV 10 m"), so the descent physically counts down.
- **Tracks.** Ten dirt tracks branch off to every zone. The Hedge Maze track is deliberately faint (1.1 m) and unmarked.
- **Culverts.** Every road or track crossing of a stream gets concrete headwalls with pipe mouths. The water passes under the road fill.
- **Telegraph line.** Timber poles about every 45 m along the Main Descent, carrying three sagging wires.
- **Survey transects.** Six lines of pegs with orange tape run straight from the rim toward the global minimum, the direction of steepest descent.

## 5. Rover (ROVER-02)

Six-wheel field-survey vehicle: 0.78 × 1.12 m hull plus rails; 0.19 m lugged wheels on per-wheel struts; front sensor bar with lamps, stereo lenses and an orange bumper band; side battery panels stencilled "ROVER-02 · SURVEY · FIELD UNIT"; Pelican-style instrument case; mast with stereo head and a spinning lidar puck; GNSS dome with fluttering orange tape; stowed soil probe; tow loop; amber status lamp; cable run; 28 fasteners. About 70 parts are merged into a handful of meshes by material.

**Driving:** cruise 9.5 m/s, boost 15.5 m/s (brief: 6 m/s; see deviations). Surface multipliers are road 1.0, track 0.9, ground 0.68 and stream bank ×0.6. Speed falls off with slope, and moves onto slopes steeper than about 46° are refused. Each wheel tracks the ground individually, and body pitch and roll come from a four-point plane fit. Colliders are 2D circles and boxes for structures, trees, boulders, hedges and poles. Wheel dust appears on unpaved ground. The headlamp is a projected additive light pool rather than a real light (§8).

## 6. Camera

Third-person / oblique hybrid:
- **Default framing:** pitch 0.9 rad (about 52°), distance 17 m, adjustable within pitch 0.3–1.35 and distance 6–90 m.
- **Smoothing:** a 120 ms follow ease.
- **Orbit:** drag to orbit. When you stop dragging, after 1.8 s the camera recentres behind the rover's heading, but only while moving.
- **Look-ahead:** proportional to speed.
- **Line of sight:** terrain line-of-sight clamping samples eight points, so the camera lifts over ridges and never goes underground (measured clearance 12.7–16.9 m in every zone test).
- **Other modes:** `O` gives a survey overview; free-fly and locked modes are for debugging and screenshots.
- **Never:** camera shake or depth of field.

## 7. Materials, lighting and atmosphere

**Materials.** There is one material family: `weathered()`, a patched `MeshStandardMaterial` with:
- world-space grime;
- rain streaks on walls;
- optional panel seams and normal-mapped corrugation;
- a diagonal hazard-stripe mode;
- ground-splash dirt baked per vertex at merge time (`aDirt` from height above terrain), so every object darkens where it meets the ground.

The palette is concrete, chalk-white and grey panels, ink-green, galvanised steel and dark steel, plus timber and tarp. Survey orange `#FF6A2B` appears only on tape, stakes, the beacon, the windsock, hazard rings, small accents, cones and the debug contour mode. Brass `#C9A44A` is used only for the benchmark markers. Muted teal `#5E8C8A` appears only in the water. Warm practical light `#FFC27A` is used in lamps, windows and pools. There is no purple, and no bloom pass.

**Terrain shader.** It blends:
- dry upland straw and bare soil;
- vegetation from the baked density field, lusher near water;
- scree;
- banded sedimentary rock on true cliffs (slope above about 40°), plus a dedicated Strata bed shader with ledge relief;
- dry-stone toes on grassed terrace risers;
- tilled rows;
- concrete with expansion joints, and gravel;
- chip-seal road;
- packed tracks;
- wet banks and baked cavity occlusion.

On top of that are survey contours: minor every 2.5 m, index every 12.5 m, antialiased with `fwidth`, faded with distance and line density, and suppressed on roads, pads and water. In `C` mode it switches to a height ramp with orange index contours: the loss surface itself.

**Lighting:**
- **Sun:** a late-afternoon SW sun at about 30° (`#ffd09c`, 3.1), with PCF shadows from a 2048² map over ±70 m that follows the focus (±430 m in overview).
- **Ambient:** a cool hemisphere light (1.0) and a cool opposite fill (0.7).
- **Real lights:** exactly three point lights — the beacon, the Research hatch and the Bay interior.
- **Fake lights:** every other lamp is an emissive head plus an additive ground light pool. Lit windows are painted interior cards.

**Atmosphere:**
- **Fog:** a height-aware exp2 fog patched into every material. It is thicker in the basin floor and thinner on the rim, using the average of camera and fragment height.
- **Sky:** a dusk dome with a warm horizon toward the sun and stratified cloud lit from below.
- **Distance:** the outer upland ring (20 m grid) and two silhouette ridgelines at 2.7 and 3.3 km.

## 8. Performance (measured, not estimated)

**Method.** `window.__basin.bench(n)` renders a frame, forces it to finish with a 1-pixel readback, and times it. It reports the median and p90 of 24 frames per view, at 1600×1000 and DPR 1, on an Apple M4 (ANGLE/Metal, headless Brave).

**Caveat.** The machine was heavily loaded during every measurement (load average 10–48, IDE at about 100% CPU). Headless rAF was capped at 30 fps even for an **empty** scene, so wall-clock FPS here is meaningless and is not reported. Treat these times as upper bounds.

| View | Draw calls | Triangles | Frame ms (median / p90) |
|---|---|---|---|
| 01 Spawn (follow camera) | 422 | 1.66 M | 11.9 / 12.7 |
| 02 Overview (whole basin, wide shadows) | 463 | 1.86 M | 29.5 / 31.8 |
| 03 Descent vista | 450 | 2.24 M | 21.4 / 23.2 |
| 04–09, 12–15 (zone views) | 188–327 | 0.96–1.70 M | 10.3–15.6 |
| 10/11 Research Station | 176–210 | 1.0 M | 10.3–13.1 |
| 16 Underground corridor | 98 | 0.69 M | 10.2 |
| 17 Watershed | 345 | 1.65 M | 13.4 |

**Other numbers:**
- **Build time in the browser:** heightfield 0.66–2.2 s depending on load; world 330–550 ms.
- **Memory:** 109 geometries, 13 textures, 240 instanced meshes and about 305 regular meshes.
- **Instances:** 13.9k grass, 7.8k crops, about 2k shrubs, trees and boulders, 566 reeds, 105 pegs, 584 maze dots.
- **Static structures:** 218 merged meshes, merged again into 46 world-wide by material.

**Ablation findings** (these drove the Pass 5 changes):

| Change | Frame time |
|---|---|
| Real lights (9 point lights + 1 SpotLight) | ~11 ms of a 45 ms frame. The rover's SpotLight alone cost ~14 ms in one test (28 → 14 ms when removed). Now replaced by a decal; budget is 3 point lights. |
| Per-zone static meshes (~220) → global per-material merge (46) | 45 → 30 ms |
| Small vegetation tiles → coarse tiles + distance culling | Draw calls 766 → ~450 |
| Terrain shader octaves trimmed (fbm4 → fbm2/3, vnoise) | ~9 ms cost before trimming |

**Remaining heavy costs:**
1. The terrain fragment shader, which runs on every pixel.
2. About 1M terrain triangles with no LOD.
3. Vegetation and sign draw calls, which together are most of the remaining calls.
4. Main-thread heightfield generation at load.

## 9. Known bugs and limitations

- **Overview seam:** the 600×800 playable rectangle is still faintly visible from very high altitude. The 20 m outer mesh has coarser normals, and a thin seam line shows along the boundary.
- **Shadow range:** cast shadows exist only within ±70 m of the focus point (wider only in overview), so far structures in vista shots have no shadows.
- **Thin wires:** telegraph wires and guy wires alias into dotted lines at distance.
- **Water:** ribbons are flat (no visible flow at range, no foam at weirs). The pond can show a hard circular edge at grazing angles. Water ribbons clip slightly at some culvert mouths.
- **Decals** (launch ring, bay markings, track, tyre spirals) can z-fight at grazing angles and do not conform to curved ground.
- **The headlamp pool** is a flat decal; it can clip into bumps and shows from above in screenshots as a pale patch.
- **Collisions:** small props (Pelican cases, cones, signs) have no colliders. The slope limit is lenient: the rover can climb some 40°+ banks.
- **Camera recentring:** this pulls the camera behind the rover while driving; anyone who prefers a fixed orbit will feel it.
- **Load time:** heightfield generation blocks the main thread for up to about 2 s, behind a plain "Surveying the Basin…" loader.
- **Console warnings:** three.js prints two deprecation warnings (`Clock`, and `PCFSoftShadowMap` falling back to PCF).
- **Unbuilt items:** Overfit Garden, the Field Radio's audio and the Hedge Maze solver animation were not built. A hook location exists for each.
- **The underground corridor** is a stylised blockout, as briefed.

## 10. Self-critique

**Does the terrain resemble a loss landscape?** In contour mode (`02b`), unambiguously. Concentric index contours close on the global minimum, the Local Minimum is a closed contour ring, and saddles and ravines are visible. At normal ground level the metaphor is carried by:
- the descent itself, counted down by the elevation posts;
- the glowing minimum, visible from spawn;
- the survey transects running downhill;
- the Local Minimum gag.

A non-ML visitor sees "a big basin with a station at the bottom", which is acceptable per the spec.

**Does it feel authored?** Mostly yes along the Main Descent, at Init, at the Research Station and in the Watershed. Every structure has a stated purpose, and cables, tracks, dishes and pipes connect things. It feels less authored where facilities sit on large flat rectangular pads with cut banks around them. Those read as "placed on a slab".

**Does the scale make sense?** The rover, buildings, doors and road widths are consistent. The basin is big — 857 m of road — and driving everything takes several minutes. Fast travel will be mandatory in the real app.

**Does every zone look different for a reason?** Yes:

| Zone | Character |
|---|---|
| Agri Terraces | Agriculture: terraces, growth stages, sensors |
| Diagnostics Bay | Industrial garage with an EV on the lift |
| Agent Operations | Quiet data hall and Operator Row |
| Proving Grounds | Track and scoring tower |
| Workshop | Open shed with a half-built rover |
| Hedge Maze | Hedges and a chalk path |
| The Strata | Geology |
| Research Station | Mine headframe and shaft |
| Signal Tower | Mast |

**Is the rover believable?** Yes. It is the strongest small asset. Up close it reads as field-robotics hardware, not a toy. Its stencil and accents follow the palette rules.

**Does it communicate AI/ML without clichés?** Through place, not graphics:
- loss-surface geography;
- the Local Minimum;
- downhill gradient transects;
- agent consoles that blink at different loop periods;
- data racks and core samples as "data";
- research rooms underground.

There are no neural nets, glowing nodes or purple. The cost is subtlety: the ML reading depends on noticing those details.

**Is it empty in a bad way? Too cluttered?** The Basin between sites is open grassland with streams, trees, boulders, transects and the telegraph line: lonely, but not dead. The pads themselves are emptier than they should be, too much bare concrete around compact building clusters. No area is cluttered.

**Does it look like a generic three.js scene?** The terrain, atmosphere and descent vista do not. The box buildings and lumpy blob trees do, a little.

**Does any area look obviously AI-generated?** Three areas:
- the blob trees and shrubs;
- the uniform concrete-pad-plus-box-building pattern repeated at the Bay, Agent Ops and Workshop;
- rock banding on steep cut banks behind sites, which reads as a sandstone quarry.

**Are the materials coherent?** Yes. It is one family, with zone-appropriate wear (oil stains at the Bay, soil at the Terraces, damp at the floor).

**Is the lighting convincing?** It is convincing as late afternoon going to dusk: warm sun, cool shadows, haze thickening into the basin, and warm practicals at occupied sites. It is not a true dusk. I kept the sun at about 30° so both slopes stay readable.

**Is the geography readable in 30 seconds?** From spawn the descent, the tower beacon behind you, the terraces on the right and the station glow at the bottom are all visible. The rim-to-floor structure is immediately legible. Individual site names are not readable without the debug list; the HUD and map come later.

**Are the important landmarks visible?** The Signal Tower is visible across the rim and the upper basin. The Research headframe glow is visible from spawn. The Strata cliff and the terraces are readable from the descent.

**Does the Research Station feel like the deepest and most significant place?** Yes. It is the darkest and quietest location: it sits in the south wall's shadow, with the only lit shaft, the tallest structure on the floor, and a hazard ring.

## 11. Strongest, weakest, generic

**Strongest** (preserve):
1. The descent vista (`03`): switchbacks, rails, telegraph line, streams lined with trees, and the destination glowing at the bottom.
2. The contour view of the loss landscape (`02b`).
3. The Research Station at dusk (`10`, `11`).
4. ROVER-02 (`13`).
5. The Signal Tower silhouette (`12`).
6. The Watershed drainage tree with gauging stations (`17`).
7. The Local Minimum.
8. The Strata face (`14`).

**Weakest:**
1. Trees and shrubs (blob canopies).
2. The pad-plus-box-building pattern, with large empty slabs and banded cut banks behind sites.
3. The overview read: rectangle seam and featureless outer upland (`02`).
4. Close-up ground, which is a shader with sparse tufts, not grass.
5. Water at a distance, which is a flat silver-teal ribbon.

**Generic-looking:**
- the sky and far mountains;
- concrete pads with expansion joints;
- the EV car models;
- basic signage boards.

## 12. What to regenerate vs preserve

**Regenerate:**
- **Trees:** branching or clustered-card canopies.
- **Pads and structures:** smaller pads that hug the land, retaining walls at cuts, and real façades (window frames, doors, roof detail) for the Bay, Agent Ops and Workshop.
- **Distance:** the outer upland and horizon, with a higher-resolution ring, matched normals and distant features.
- **Water shading:** flow-aligned normals and foam at weirs and culverts.
- **Close-range ground:** a proper grass system (GPU-instanced near the camera).
- **Terrace crops:** rows aligned to the contours.

**Preserve:**
- the `layout.ts` → `Heightfield` pipeline (basin + features + rivers + roads + pads + bakes);
- the contour terrain shader and the `C` mode;
- the weathered material family and `Builder`/merge kit;
- the zone compositions for Init, the Research Station, the Signal Tower, Agent Ops' Operator Row and the Local Minimum;
- ROVER-02 and the driver;
- the camera rig;
- `zones.ts` anchors;
- the screenshot, benchmark and drive-test tooling;
- the performance rules: no real lights beyond 3, never a SpotLight, merge statics, tile instancing.

## 13. Deviations from the brief (and why)

| Change | Why |
|---|---|
| Built by Claude (Opus), not Fable | The owner has no Fable access. The prototype was built in five passes, with screenshots inspected after each. |
| Rover speed 9.5 / 15.5 m/s (brief: 6) | At 6 m/s, 600 × 800 m is tedious. The "≤8 s from a stake" rule cannot be met by driving at this size; it needs fast travel, which is not built here. |
| Sun at about 30° SW, late afternoon rather than deep dusk | At 16° the west-slope zones and spawn sat in shadow. Dusk mood comes from the sky, fog and practicals. |
| Workshop at (84, 196), not (125, 185) | The original site needed a 36% access grade. |
| Signal Tower pad set to 119 m with a switchback service track | The direct track was 40%. |
| Benchmark Ridge folded into Proving Grounds | It sits on the rock spine beside the track. |
| Strata uses layer plates S-01…S-06, not engraved years | The brief forbids invented credentials, and years are content. |
| Real lights limited to 3 | Measured cost (§8). |

## 14. Screenshots (`world-prototype/screenshots/`, 1600×1000)

| File | View |
|---|---|
| `00-layout-map.png` | top-down survey map from `tools/map.ts` |
| `01-spawn` | follow camera |
| `02-overview` / `02b-overview-contour` | whole basin, normal and loss-surface views |
| `03-descent` | descent vista |
| `04-agri-terraces` | Agri Terraces |
| `05-diagnostics-bay` | Diagnostics Bay |
| `06-agent-operations` | Agent Operations |
| `07-proving-grounds` | Proving Grounds |
| `08-workshop` | Workshop |
| `09-hedge-maze` | Hedge Maze |
| `10-research-approach` / `11-research-exterior` | Research Station |
| `12-signal-tower-silhouette` | Signal Tower |
| `13-rover-closeup` | ROVER-02 |
| `14-strata` | The Strata |
| `15-local-minimum` | Local Minimum |
| `16-research-interior` | underground corridor |
| `17-watershed` | Watershed |

## 15. Readiness

Ready for **visual and UX review**. Not ready for **integration** until:
1. Heightfield generation moves off the main thread, or is baked at build time.
2. Fast travel and the anchor API are wired to real interactions.
3. A mobile and low-power profile is measured on real hardware (none was tested).
4. The weakest assets in §11 are reconsidered after review.

---

## World Pass 2 — art-direction refinement

Goal: make the existing world feel authored, specific and believable rather than "procedural terrain with buildings on top". The concept, geography, Main Descent route, rover, 13 zones, Signal Tower, Research Station at the global minimum, Local Minimum and palette were all preserved. Pass 1 screenshots are kept for comparison in `world-prototype/screenshots/pass1/` (JPEG); the current set is in `world-prototype/screenshots/` (PNG, 1600×1000, 23 views).

### Changes made, and why

**A. Terrain and geology** (`heightfield.ts`, `terrain.ts`)
- **Erosion pass (`carveGullies`)**: ~250 rill/gully traces seeded high-to-low on steep, clustered ground. Each follows the fall line with a slight meander, falls into earlier channels (so networks converge instead of running in parallel), deepens with catchment length, and deposits a scree fan where the slope eases (~110–130 fans). Excluded from pads, terraces, the Strata face and the Local Minimum. *Why:* the walls read as smooth noise with painted stripes; time and water now visibly shaped them.
- **Cap-rock ledges**: a few hard beds outcrop as broken, contour-following ledges on the basin walls, with lateral breaks and varying thickness. Replaced an earlier attempt (ridged "ribs") that looked like random bumps.
- **Rim variation**: the bowl's reach varies with angle (bays and spurs), and four Gaussian buttresses break the south amphitheatre into bays. Slopes where sites sit are untouched.
- **Rock shader**: replaced regular 5.5 m bands with faulted blocks (per-block throw), irregular bed thickness, discontinuous partings, massive sandstone patches and varnish streaks. Outcrops now break through on convex ground (signed curvature bake replaces the old cavity bake).
- **The Strata face**: dipping beds that pinch out, slanted fault traces with offset blocks, hard beds as ledges and soft beds weathering back (bump-mapped), an irregular crest with notches. Parting lines are clamped to ≥1.5 px to remove the dashed aliasing seen mid-pass.
- **Talus**: gully floors and fans get their own colour (shaded/damp vs pale/coarse).
- **Contour marks** now fade on steep ground and out before the playable edge.

**B. Boundary** (`terrain.ts`, `env.ts`, `heightfield.ts`)
- The 1 m playable grid now sits inside two distant rings: a 5 m mesh to ~200 m past the edge, then a 50 m mesh out to 4 km. Seams are exact (grid edge vertices are geomorphed onto the 5 m lattice; the 5 m ring blends to the 50 m bilinear surface at its outer edge), normals are analytic, and the far rings use the same vegetation formula (`uplandVeg`) as the Basin's own bake, passed as a vertex attribute.
- The upland gets broad valleys draining away from the Basin and massifs that rise with distance; far silhouette ridges moved to 5.6/7.2 km; aerial-perspective fog added at range; camera far plane 9 km.
- Instance vegetation fades over the last 50 m of the grid so it meets the bare far upland without a line.
- *Result:* in `02-overview` and `20-boundary-north` there is no rectangle; the Basin reads as a crater cut into a continuous upland.

**C. Vegetation** (`world/flora.ts`, `world/veg.ts`) — a coherent 9-member family replacing blob trees and shrubs
- Every plant is a real tapered-tube skeleton carrying alpha-cut leaf cards; all share **one** canvas atlas and **one** material. Card textures hold several separate sprays with sky gaps, so canopies read as foliage rather than discs. Canopy normals are bent outward from the crown centre; vertex colour darkens crown interiors. Alpha is rescaled by mip level so trees don't dissolve into sticks at range.
- **T1 riparian poplar** (forked, clustered crown) follows water — 62 instances, plus a 13-tree shelterbelt on the windward edge of the terraces. **T2 upland pine** (S-curved trunk, flat needle pads flagged downwind/ENE) holds the rim and upper slopes in groves — 95. **T3 dryland acacia** (low fork, flat umbrella) stands alone on mid slopes — 14.
- **S1 saltbush** on dry slopes (400), **S2 broom** on scree fans, gully mouths and road verges (201), **S3 scrub juniper** in hollows, gullies and rock (748).
- **G1 short tufts** where moist (2,704), **G2 dry bunchgrass** elsewhere (6,344), **G3 forbs** near water only (46).
- Boulders are now angular, faceted and rock-coloured, concentrated under the Strata, on fans and ledges and in steep hollows; open slopes are mostly clean.
- Tiles enlarged (90–300 m) to keep draw calls down.

**D. Industrial zones** (`world/east.ts`) — three architectures, not three slabs-with-boxes
- **Diagnostics Bay — SERVICE.** An open steel cantilever canopy (three columns, tension rods, roof falling west) over a concrete apron. Anchor: Bay 01, an EV raised on a two-post lift with its battery pack lowered onto a lift table beneath it, orange HV leads, diagnostic cart wired to the vehicle, tool chest. Bay 02: drive-on alignment ramps with sensor heads on the wheels. A drive-through scanner arch at the entry, tyre tracks curving to each bay, bay markings, drain, oil stains, a two-pedestal charging line with one car connected, a low service shed behind, outdoor parts racking, battery trolley, cable reels, drums on a spill tray, battery-quarantine container.
- **Agent Operations — COMPUTE.** A gravel compound of five identical containerised modules in a row (one per agent): each with its own rooftop condenser, power drop and status lamp. OP-01/02 running (doors open onto lit racks, lamps blinking at different periods); OP-03..05 provisioned but dark. An overhead galvanised cable ladder is the compound's spine, fed from a fenced power skid (transformer + switchgear). A dry-cooler bank with four rotating fans behind; an operations cabin with one long window facing the row; grated cable trench; generator with exhaust stack and day tank; microwave mast aimed at the Signal Tower.
- **Workshop — MAKE.** An open timber frame on a dirt yard: timber floor boards, rafters, corrugated roof with one sheet missing, board back wall, tarp wind screen. The unfinished **ROVER-03** sits on a work stand at the open front under an A-frame hoist with a chain block; its four wheels, lidar puck, battery module and harness coil lie on a tarp in assembly order. Back bench with vice, pegboard, soldering station with fume-extractor arm, laptop, oscilloscope cart, parts shelving; orange extension cords cross the floor. Yard: calibration grid with the small robot and cones, extrusion stock rack, scrap skip, pallets; Don't Touch It kept.
- Pads re-sized and resurfaced to suit: Bay concrete 36×30 m, Agent Ops gravel, Workshop gravel/dirt.

**E. Watershed** (`heightfield.ts`, `world/watershed.ts`, `world/roads.ts`)
- Pool-and-riffle water surface: levels hold in pools and drop at short cascades (smoothed over ~3 m), so the water is no longer a constant-slope ribbon.
- River width breathes along its length (pools spread, riffles pinch).
- Water shader: per-vertex flow speed drives ripple speed and broken white water at drops; depth colour (silty margins, darker thalweg); muted teal kept, reflection reduced.
- Bed stones exposed in riffles; dirt tracks now cross streams by stone fords (concrete culverts kept only on the paved road).

**F. Research Station exterior** (`world/floor.ts`) — evolve from field → engineering → research
- A low chamfered concrete perimeter wall around the pad with a single gated opening at the road: the only enclosed site in the Basin.
- A painted walkway from the gate to the collar; a ring of 16 low bollard lamps around the collar (controlled light, nothing brighter than needed).
- The descent system made visible: the lift cage hangs in the headframe above the open collar, ropes to the sheaves.
- Ventilation: an intake/exhaust fan house with louvres and an evasé stack, a duct to the collar, two capped vents. A seismometer vault with cable.

**G. Research interior** (`world/floor.ts`) — replaced the corridor of doors
- A domed concrete **rotunda** at the foot of the lift (radius 9.5 m), radial floor joints and a brass datum ring. Overhead warm light ring.
- Focal wall: a large chalkboard with the Basin drawn as a contour map, a descent path to the minimum, and open questions (`θ* = argmin L(θ)`, `∇L → 0 ≠ done`, `generalise?`, `what does the model see?`). No credentials, no claims.
- Four differentiated labs through short passages: **Computer Vision** (optical table, camera on a rail gantry aimed at a checkerboard target, monitor), **Experiments** (instrument racks, glazed test enclosure with a sensor rig, cable tray), **Data** (core trays as physical samples + storage racks), **Medical AI** (light-box wall of abstract greyscale scan slices, two workstations, reading chair). Instrument consoles between the doors.
- **Lighting is baked into vertex colours** from ~25 warm practical sources (wrap lighting + floor/ceiling occlusion + mottling) and rendered with an unlit material: the whole interior is one draw call with zero runtime lights.

**H. Roads** (`heightfield.ts`, `terrain.ts`, `world/roads.ts`)
- Wheel tracks (polished, darker, lower roughness) in each lane; occasional repair patches; edge cracking and wind-blown dirt toward the shoulders.
- V-ditches at the toe of road cuttings (carved into the heightfield, darker silt in the shader).
- Gabion retaining walls along the deepest cuts (48 segments).
- Culvert headwalls now sit below the road surface instead of standing above it.

**I. Composition**
- New/updated hero shots: `01-spawn` (rover on the dock, gantry in frame, Basin and lit headframe beyond), `03b-ridge-descent-rover` (rover on the descent overlooking the lower Basin), `05`/`06`/`08` re-framed at medium distance, `16`/`16b` interior, `18-industry-overview`, `19-road-detail`, `20-boundary-north`.

### Before / after (screenshot pairs)
| View | Pass 1 (`screenshots/pass1/`) | Pass 2 |
|---|---|---|
| Overview | rectangle visible; outer upland flat | no boundary; crater in continuous upland; gullied walls |
| Descent | smooth walls with stripe banding; blob trees | eroded walls with fans and gullies; branching poplars along streams; pines on the rim |
| Strata | regular horizontal stripes | faulted, dipping, irregular beds with ledges |
| Bay / Agent Ops / Workshop | three concrete slabs with corrugated boxes | canopy+EV on lift / container row under cable ladder / timber frame with ROVER-03 under a hoist |
| Research interior | corridor of identical doors | rotunda + chalkboard + four distinct labs |

### Performance before / after
Measured the same way (forced-sync render of 24 frames, median/p90, 1600×1000, DPR 1, Apple M4, headless Brave). **Caveat:** Pass 1 was measured with load average 10–48; Pass 2 with ~4. Times are therefore not strictly comparable (Pass 1 likely overstated); draw calls and triangles are.

| View | Calls P1 → P2 | Triangles P1 → P2 | Frame ms P1 → P2 |
|---|---|---|---|
| Spawn | 422 → 515 | 1.66 M → 2.16 M | 11.9 → 13.9 |
| Overview | 463 → 489 | 1.86 M → 1.98 M | 29.5 → 26.6 |
| Descent | 450 → 479 | 2.24 M → 2.33 M | 21.4 → 15.7 |
| Zone views | 177–327 → 172–383 | 0.96–1.70 M → 1.01–1.84 M | 10.3–15.6 → 7.4–14.7 |
| Research interior | 98 → 477* | 0.69 M → 1.97 M* | 10.2 → 9.8 |

\*The interior view now looks horizontally under the terrain, so the surface world above is still submitted; the interior itself is a single draw call.

Other measurements (Pass 2): page load → world interactive **1.09 s** (heightfield 0.57–0.6 s, world build 234 ms); estimated texture memory **~80 MB** (15 textures; splats 4×2.5 MB, the rest canvas textures — signs, decals, chalkboard 2048×768, flora atlas); geometry **~30 MB** (122 geometries); JS heap **~104 MB**; real lights still **3**; static zone meshes merged 222 → 51; production bundle **758 KB (211 KB gz)**, up from 716/195. Navigation test: all 13 zone teleports drive and the camera stays 14–17 m above ground; the scripted Main Descent drive behaves as in Pass 1.

### Remaining weaknesses
- **Agri Terraces** still read too regular from below: the upper benches are fallow strips of identical height, which echoes a quarry. Needs crop/fallow/grass variety per bench and irregular bench widths.
- **Agent Ops pad** is still a large gravel rectangle on the slope from above; the architecture is now distinct, the ground under it is not.
- **Gabions** are rigid 2.6 m boxes that stair-step on curves.
- **Workshop** reads well up close but the timber frame is dark from medium distance; it needs a lit interior or a lighter roof.
- **Interior** is clean but sparse: the lift cage dominates the rotunda foreground; labs are single-room vignettes.
- **Rover headlamp decal** appears in locked-camera shots wherever the rover is parked (e.g. a pale patch in `03-descent`).
- **Pines** read dark/flat at mid distance; acacias are rare enough that they're barely seen.
- Shadow range (±70 m) and dotted distant wires unchanged from Pass 1.
- Texture memory roughly doubled the canvas-texture budget; signs/decals should move to an atlas.

### Remaining generic-looking elements
- Concrete pads with expansion joints at Init / Field Office / Signal Tower.
- The EV car models (extruded profile).
- Far mountain silhouettes and sky.
- Grass tufts (`bladeCluster`) at close range.

### Leave alone
- The heightfield pipeline order (base → features → erosion → rivers → pads → roads → bakes) and the single-source-of-truth layout.
- The descent vista, Research Station exterior, Signal Tower, ROVER-02, the Local Minimum.
- The vegetation family architecture (one atlas, one material, skeleton + cards).
- The baked-vertex-light interior technique.
- Performance rules: ≤3 real lights, no SpotLights, merge statics, tile instancing.

### Consider for a future pass
1. Terrace bench variety (crop types, fallow, grass, irregular widths) and an irrigation channel along the bench edges.
2. A smaller, land-hugging Agent Ops footprint (two terraced gravel benches instead of one rectangle).
3. Spline-following gabions/retaining walls.
4. Sign/decal atlas to cut texture memory; move heightfield generation to a worker or bake it at build time.
5. Cull the surface world while underground (and vice versa).

### Self-critique (the ten questions)
1. **Does the terrain still look procedural?** Much less. Walls now read as eroded geology with gullies, fans and broken ledges; the Strata reads as rock. The terraces are the one place that still looks generated.
2. **Do the three industrial zones still look related?** No — canopy over a vehicle, a row of containers under a cable ladder, an open timber shed with a robot under a hoist are distinguishable at medium distance (`18-industry-overview`). From very high up the Agent Ops pad is still a plain rectangle.
3. **Does the vegetation still look synthetic?** Partly. Trees have trunks, branching and irregular canopies and are placed by ecology (water, rim groves, lone acacias). Up close the cards are visible and pines are too dark; it no longer looks like blobs.
4. **Can I see the world boundary?** No, from any of the tested views including the full overview and looking outward from the rim.
5. **Does the Research Station dominate the narrative?** Yes: the only walled, gated and deliberately lit site, at the darkest point of the Basin, with a visible descent system and the most composed interior. It is not large, which is intentional.
6. **One ecosystem?** Yes: water drives tree placement, fans carry broom, hollows carry juniper, the rim carries pines, and the same rock language runs from the walls to the Strata.
7. **Does the rover belong here?** Yes — and ROVER-03 in the Workshop now makes it part of a story rather than a standalone asset.
8. **Still an AI/ML engineer's world?** Yes, and more explicitly underground (the chalkboard ties the Basin back to `argmin L(θ)`); above ground it remains carried by place: the descent, the Local Minimum, the compute row with independent loops.
9. **Anything stock/generated-looking?** The EV cars, concrete pads, close-range grass tufts, and the far mountains.
10. **Strong visual identity?** Yes: a dusk survey basin with eroded sedimentary walls, chalk contour marks, survey-orange accents and warm practicals, ending at a lit mine headframe. The descent shot and the overview are now recognisable as this place.

**Recommendation:** ready for Gemini review — with the terraces and Agent Ops footprint flagged as the first things to look at.

---

## World Pass 2.1 — targeted corrections (Agri Terraces, Agent Operations)

Scope: only the two weaknesses acknowledged at the end of Pass 2. Everything else (13 zones, anchors API, ROVER-02, controls, camera, Main Descent, watershed, Strata, Signal Tower, Research Station, Local Minimum, light budget) is unchanged. Pass 2 was checkpointed first as commit `fb8b9c5 world: checkpoint Pass 2` (local, not pushed); Pass 1 and Pass 2 screenshot archives are untouched.

### Files changed
| File | Change | Why |
|---|---|---|
| `src/layout.ts` | `PadDef` gains `ox/oz` (footprint offset from the frame), `round` (corner radius), `edgeFall` (per-side falloff); new `padSD()`, `padCentre()`, `padRadius()`. Agent Ops pad split into `agent-ops` (upper bench) + `agent-ops-lower`; `t-agentops` re-routed to the lower bench. | One shared footprint definition for terrain, painting, rivers, gullies and vegetation; enables terrain-following, rounded, stepped pads. |
| `src/heightfield.ts` | All pad code uses `padSD()` (verified bit-identical heightfield and splats vs Pass 2 before any layout change). New `TERRACE`, `TREAT`, `benchDesign()`, `plotTreatment()`, `benchInfo()`, `benchPoint()`; terrace bake writes `splat5` (tread/riser flag, headland), `splat6` (bench index) and `benchF` (half-float bench fraction + bench width). | Terrace variation and contour-following rows. |
| `src/terrain.ts` | Field-trial shading per plot treatment; analytic plot boundaries from a per-bench uniform table; tread edge computed per pixel; grassed riser banks; new textures. | Replace identical brown strips. |
| `src/world/west.ts` | Crops placed only in crop plots, on rows parallel to each bench lip; irrigation main stepping down the benches with valve boxes and a lay-flat hose along every bench that carries crops. | Crops follow contours; irrigation connects to the existing header tank. |
| `src/world/east.ts` | Lower service bench frame; cast-in-place retaining wall with coping, weep holes, returns, handrail; service stair; cable route trench → wall riser → ladder; cabin, trench and sign moved to the lower bench; generator/day-tank re-sited onto the upper bench. | Two-level, terrain-following compound with a coherent cable network. |
| `src/world/rim.ts` | `padFrame()` uses the pad's design height (`h`) when set. | The frame must sit on the bench, not on terrain sampled at an offset footprint. |
| `src/world/veg.ts` | `nearPad` uses `padSD()`. | Shared footprint. |
| `src/main.ts` | debug API exposes `zonesList()`. | QA script. |
| `tools/qa.mjs` (new) | 23 automated checks: debug keys (C/O/F/H/P), number-key teleports, 42 anchors (zone refs, grounding, distance), Agent Ops anchors on the upper bench, retaining-wall collision, rover clearance, console errors, failed requests. | Functional gate. |
| `tools/drive.mjs` | Accepts `--url`; records rover clearance per zone and on the Main Descent; descent timeout 150 s and a `completed` flag. | Regression evidence (old version stopped at 60 s, mid-route). |
| `tools/map.ts` | Prints max grade per road. | Layout check. |
| `tools/shots.json` | Added `04b` (terraces top), `04c` (ground), `04d` (bench level), `06b` (Agent Ops top), `06c` (bench); `06`/`06c` cameras made absolute so Pass 2 and 2.1 use identical camera positions. | Before/after evidence. |
| `.gitignore` | `screenshots/*.png` (current output) ignored; archived sets tracked. | Avoid duplicate 34 MB sets in git. |

### How the terrace variation is generated
- Benches are unchanged: height quantised from the natural surface in 2.5 m steps. For any point `benchInfo()` returns the bench index `q`, the bench fraction `f` (0 at the lip; tread = `f < 0.6`, riser = `0.6–1`), the bench width `STEP / g` from the ±3 m slope, and an along-bench coordinate (angle about the basin floor × 440 m), so **plot boundaries are radial lines, i.e. straight across the benches**.
- **Randomised complete block design**: each bench is a block holding the five treatments — young crop, mid crop, ripe crop, fallow (ploughed furrows), sown ley (mown stripes) — once each, in a seeded order, repeated along the bench. Plot length varies per bench (17–29 m) with a seeded offset, so plot edges do not line up from bench to bench. A ~2 m mown headland separates plots.
- The outer ring of the terrace area is a grass guard margin; benches narrower than 2.6 m (unworkable for a planter) stay in grass; beyond the margin benches fade into hillside.
- Rows run **along the bench**: the shader rebuilds the distance from the lip (`f × width`) per pixel and draws 0.9 m rows, drip tape on planted rows, furrows on fallow, mowing stripes on ley. Plot treatment is evaluated per pixel from the same table the CPU uses (bench index from a nearest-sampled texture, everything else analytic), so painted plots and crop instances always agree.
- Crops (`west.ts`) are instanced only in crop plots, snapped to the row centrelines, with clear margins at the lip, riser foot and headlands; spacing differs by stage. Result: 1,703 young / 1,618 mid / 1,564 ripe instances on 19 benches (Pass 2: ~7.8k scattered).
- Irrigation: the header tank feeds a main that steps down one radial line (9 segments, valve box per bench); a lay-flat hose runs along the riser foot of each of the 19 crop benches.

### How the Agent Operations footprint follows the terrain
- Natural slope across the old pad: ~48 m (west) to ~58 m (east). Pass 2 cut one 46 × 46 m slab at 46 m.
- Pass 2.1: **upper bench** at 53.5 m (18 × 45 m, 6 m corner radius) carrying the five modules, cable ladder, dry coolers, power skid and generator; **lower service bench** at 50.0 m (13 × 24 m, 3 m radius) to the west carrying the operations cabin, trench and access. Between them a 3.5 m retaining wall: the lower bench's east edge uses a 1.6 m falloff (stepped edge) and the wall is built exactly on that line. All other edges grade into the hillside over 9–12 m.
- Cables: power skid → overhead ladder → five roof drops (unchanged); cabin → grated trench across the lower bench → galvanised riser channel up the wall face → tray to the nearest ladder post. People reach the upper bench by a service stair beside the riser; vehicles by the re-routed track onto the lower bench, which continues around the north end.
- Verified: every upper-bench object stands on 53.4–53.5 m ground; the rover driving east on the lower bench is stopped by the wall (max local x −3.90 vs wall at −2.75); t-agentops max interior grade 23.8 % (Pass 2: 23.2 %).

### Evidence (screenshots)
- Pass 2.1 set (29 views, 1600×1000): `world-prototype/screenshots/pass2.1/`
- Pass 2 baseline re-rendered **from commit `fb8b9c5` with the same tool, cameras and resolution** (needed because Pass 2 had no `04b/04c/04d/06b/06c` views): `world-prototype/screenshots/pass2.1/baseline-pass2/`
- Side-by-sides and contact sheets: `world-prototype/screenshots/compare/` — `p2-vs-p2.1_04*.jpg`, `p2-vs-p2.1_06*.jpg`, `p2-vs-p2.1_18-industry-overview.jpg`, `p1-vs-p2.1_02-overview.jpg`, `p1-vs-p2.1_03-descent.jpg`, `sheet_p2-vs-p2.1_targets.jpg`, `sheet_p2.1_current-views.jpg`, `sheet_p2.1_all.jpg`.
- Archives untouched: `pass1/` (JPEG), `pass2/` (PNG copy of the Pass 2 deliverable).

### Test results (commands run from `world-prototype/`, dev server on :5173, Pass 2 worktree on :5174)
| Command | Exit | Result |
|---|---|---|
| `npx tsc --noEmit` | 0 | clean |
| `pnpm build` | 0 | `index-*.js` 767.31 kB (215.02 kB gz) — Pass 2: 758.00 / 210.98 |
| `node tools/qa.mjs` | 0 | 23/23 passed; no console errors, no failed requests; warnings: THREE `Clock` deprecation, `PCFSoftShadowMap` fallback (both pre-existing) |
| `node tools/drive.mjs` | 0 | 13/13 zones teleport and drive; camera 14.5–16.9 m above ground; rover clearance 0.12–0.62 m (lowest: Proving Grounds 0.12, unchanged area); **Main Descent completed** (sample 1672/1692, 112.3 s, 10 % of samples off the paint, clearance 0.33–0.62 m). Pass 2 baseline: same route 112.2 s, completed, 0.34–0.62 m |
| `node tools/shots.mjs` (both servers) | 0 | 29 views each |
| `npx tsx tools/map.ts` | 0 | layout map regenerated |

### Performance (measured)
Environment: Apple M4, headless Brave (ANGLE/Metal), 1600×1000, DPR 1, forced-sync benchmark (24 frames/view after warm-up). **Interleaved** P2/P2.1 runs, 3 rounds each, median reported; load average during the runs 3–9, so single runs vary ±30 %. Differences below ~20 % are noise.

| View | Draw calls P2 → P2.1 | Triangles P2 → P2.1 | Median frame ms P2 → P2.1 |
|---|---|---|---|
| 01 spawn | 515 → 512 | 2.16 M → 2.09 M | 21.9 → 22.6 |
| 02 overview | 489 → 491 | 1.98 M → 2.05 M | 34.5 → 35.5 |
| 03 descent | 479 → 477 | 2.33 M → 2.26 M | 23.6 → 24.9 |
| 04 terraces | 190 → 184 | 1.61 M → 1.46 M | 13.7 → 16.0 |
| 04b terraces top | 433 → 435 | 2.48 M → 2.34 M | 17.4 → 17.0 |
| 04c terraces ground | 172 → 169 | 1.50 M → 1.37 M | 17.2 → 16.9 |
| 04d bench level | 321 → 321 | 1.88 M → 1.80 M | 15.9 → 14.0 |
| 06 Agent Ops | 239 → 234 | 1.15 M → 1.21 M | 10.9 → 8.6 |
| 06b Agent Ops top | 252 → 245 | 1.20 M → 1.27 M | 12.9 → 15.4 |
| 06c Agent Ops bench | 239 → 233 | 1.17 M → 1.25 M | 17.1 → 15.2 |
| 18 industry overview | 347 → 338 | 1.55 M → 1.60 M | 19.5 → 19.2 |

Load and memory (3 cold loads each, same session): page → interactive 1.98–2.52 s (P2: 1.86–1.94 s); heightfield 1.10–1.14 s (P2 1.08–1.09 s); **world build 484–590 ms (P2 393–396 ms, +~100 ms: crop scan at 0.3 m and bench-point bisection for the hoses)**; textures 18 (P2 15), est. texture memory 87.4 MB (P2 80.1 MB, +7.3 MB for three terrace textures); geometry 31.1 MB (P2 30.1); JS heap 104–119 MB (P2 85–101). No sustained-FPS claim is made; the headless browser caps rAF.

### Regressions, compromises, remaining weaknesses
- **Riser edges remain jagged at bench level** (`04d`): the terraced terrain mesh is a 1 m grid, so the tread/riser break is a triangulated staircase. It was present in Pass 2; Pass 2.1 removed the extra shader staircases (plot boundaries, tread mask, row chevrons) but not the mesh one. Fix would be a finer or adaptive mesh in the terrace area.
- **Upper terrace benches** (above the station) are narrow and mostly grass/margin; from the low `04` camera they still read as a stepped grass slope. From above (`04b`) and at bench level the field trial is unmistakable.
- `splat5` R/G channels (8-bit f and g) are now unused by the shader (superseded by `benchF`); harmless, removable.
- World build +~100 ms and +7.3 MB texture memory.
- The Agent Ops lower bench is plain gravel; the stair and wall are the only things that say "two levels" at medium distance — it reads clearly from above, less so from the south-west.
- Underground views still submit most of the surface world (476 calls in `16-research-interior`; unchanged from Pass 2).
- Pre-existing: shadow range ±70 m; dotted distant wires; THREE deprecation warnings.

This pass is returned for independent review; it is not self-accepted.
