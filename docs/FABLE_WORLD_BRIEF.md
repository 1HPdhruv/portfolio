# FABLE WORLD-DESIGN BRIEF — The Basin (3D prototype)

You are designing and building the **3D world** for "Dhruva's World", the open-world portfolio of Dhruva Mishra, an AI/ML engineer (computer vision, applied ML, agents). Read `docs/PROJECT_DIRECTIVE.md` first. This brief is your whole job: **the world, not the portfolio.**

## 0. The one question you must answer

> Can you create a world that actually looks like Dhruva's world?

A first-time visitor should think *"this is an actual place, built by someone who does ML research and builds robots"* — not *"AI-generated 3D demo"* and not *"portfolio template."* If you have to choose between more things and a more convincing place, choose the place.

## 1. Deliverable

A runnable prototype in `world-prototype/` (Vite + TypeScript + three.js; `pnpm install && pnpm dev`). Do not touch anything outside `world-prototype/` and `docs/WORLD_NOTES.md`.

Must include:
1. The full Basin terrain with all zones placed and recognisable.
2. A drivable survey rover with the third-person/oblique camera, WASD/arrows + mouse-drag orbit (limited pitch), Shift boost.
3. A path network (main paved descent + dirt trails) that makes geographic sense.
4. Lighting, sky, fog/atmosphere, and shadows that give depth.
5. Debug tools only: teleport-to-zone menu (keys 1–9,0 or a small DOM list), free-fly toggle, FPS/draw-call/triangle counter, a "contour/heightmap" view toggle (this doubles as the Konami easter egg later), screenshot-friendly hide-UI key.
6. Interaction *anchors* only: each zone exposes named anchor points (`{zoneId, siteId, position, radius}`) in a single `zones.ts`. No panels, no content, no text beyond in-world signage.
7. `docs/WORLD_NOTES.md`: how the world is generated, file map, parameters to tweak, known weak spots, honest self-assessment.

Not wanted: HUD, menus, portfolio copy, routing, state management, sound, mobile controls.

## 2. Core concept

**The Basin is a loss landscape you can walk through.** Elevation = depth of work. One continuous terrain, roughly 3:4 (≈ 600 m × 800 m playable), shaped like a real loss surface: a high rim, broad slopes with ridges and ravines, saddle points, a few shallow local minima, and one deep global minimum at the floor. The metaphor must be *visible in the form of the land* — someone who knows ML should recognise a loss surface; someone who doesn't should still see "a big basin you descend into."

Make the metaphor physical, not decorative:
- **Contour language** is the world's visual signature. Survey contour lines (index contours every 5th) appear as painted/engraved/emissive-subtle lines on the ground, strongest on slopes. They tell the player which way is downhill. They must read as *survey markings on real terrain*, not a neon grid or a weather-map overlay.
- **Gradient cues**: survey stakes with flagging tape, drainage channels, scree/erosion streaks that flow downhill.
- **Descent has weight**: atmosphere thickens and the palette cools/darkens toward the floor; the rim is open, windy and bright; the floor is enclosed, quiet, and serious.
- The terrain must have **navigation-friendly structure**: terraced/benched slopes where sites sit on flat pads, ridgelines that separate zones, one clear "down."

## 3. Art direction

Combine: geological survey, scientific field expedition, field robotics, experimental AI research, industrial engineering, *subtle* futuristic technology.

Tone references (conceptual, not to copy): USGS survey sheets; Antarctic/Atacama research stations; open-pit mine benches; Svalbard seed vault; ESA/JPL rover test fields; agricultural research plots; Kamchatka/Iceland geology; field-instrument aesthetics (Pelican cases, theodolites, orange flagging tape, brass benchmarks).

Time/lighting: **late-afternoon-to-dusk field survey** — low warm sun on the rim, long shadows, cool blue shadows, haze gathering in the basin, warm practical lights (`#FFC27A`) in windows and on equipment so occupied sites read from afar. Pick one lighting setup and commit; no day/night cycle required.

Palette discipline (hard rule): desaturated earth, rock, ink-green vegetation, chalk-white and concrete neutrals; **survey-orange `#FF6A2B` is the only loud colour** and covers < 5% of any screen (tape, stakes, rover accents, the Signal Tower beacon, hazard marking); brass `#C9A44A` only for benchmark markers; muted teal `#5E8C8A` only for the Watershed water. No purple. No glow-bloom everywhere. Emissive only where something is actually a light or a screen.

Identity test: the screenshot should be recognisable as *this* world with the logo removed.

Style position: **grounded stylised realism** — believable proportions, weathering, honest materials (soil, basalt, concrete, galvanised steel, painted steel, HDPE, brass), simplified geometry with strong silhouettes and careful materials. Not photoreal, not low-poly toy, not voxel. Procedural noise-based material variation (grime, edge wear, soil darkening) is encouraged; flat-colour uniform meshes are not.

## 4. Scale and units

1 unit = 1 metre. Rover ≈ 1.3 × 0.8 × 0.6 m. Doors ≈ 2.1 m. Buildings read at human scale relative to the rover (the rover is small; the world is big). Signal Tower ≈ 60 m (visible across the basin). Research Station hatch complex ≈ 25 m across. Write the scale convention in WORLD_NOTES.

## 5. The player: survey rover ("ROVER-02")

A small autonomous field-survey vehicle, descendant of Dhruva's maze-solving robot. **It must not look like a toy, a cartoon, WALL-E, or a Mars-rover knock-off.**

- Compact tracked or six-wheel rocker chassis; ground-clearance suited to rough terrain; visible suspension articulation that follows the terrain.
- Equipment payload that implies purpose: mast with camera pair + small lidar puck, GNSS antenna, a downward soil probe, sample/instrument case, a small status light bar.
- Materials: painted matte off-white/grey body, dark rubber, exposed fasteners, orange flagging or panel accent (sparingly), a stencilled ID `ROVER-02`, scuffed edges, a little dust at the base.
- Behaviour: smooth acceleration, body pitch/roll on slopes, wheel/track animation, dust on dirt, subtle headlamp. Speed ≈ 6 m/s, boost ×1.6; paths faster than grass.
- It should look slightly *vulnerable* in scale against the Basin — that is the point.

## 6. Camera

Third-person/oblique-top-down hybrid. Default ≈ 50–55° pitch, distance ~14–20 m, smooth follow (≈120 ms ease), limited horizontal orbit via drag, scroll zoom within clamps, never below terrain, auto-lift over ridges. A "survey overview" high-angle toggle shows the whole basin for the loss-landscape read. No shake, no cinematic swoops, no depth-of-field gimmicks that harm readability. The visitor must always be able to *see where they are going* and spot the next landmark.

## 7. Zones

Place these with deliberate geography. You may rename, merge, or add if you can justify it in WORLD_NOTES; do not drop the Research Station, Signal Tower, Init, Field Office, or Local Minimum. Each zone has a **reason-to-exist** line — honour it: every major structure must justify itself by content it will later hold.

Elevations are relative: 0 = floor, 100 = rim.

| # | Zone | Elev. | Concept (material/story) | Later holds |
|---|---|---|---|---|
| 1 | **Init / Origin** | ~95 | Rover dock: concrete pad, charging gantry, tool wall, windsock, painted launch ring, a first landmark (a big surveyed benchmark obelisk or a numbered "Datum 0" pylon). Looks like a base the rover just rolled out of. Quick-access kiosk (field cabinet with a lit screen). | Spawn, tutorial, **Quick view / Resume / links** |
| 2 | **Field Office** | ~92 | Prefab expedition cabin on piers, lit desk visible through window, antenna, stacked Pelican cases, field printer, noticeboard, a radio. Lived-in, not corporate. | Dhruva's profile, resume (printer), GitHub terminal, "Field Radio" egg |
| 3 | **Agri Terraces** | ~65, upper west slope | Stepped crop terraces (retaining walls, irrigation channels) following contour lines — the terraces *are* contour lines in physical form. Rows of crops in different growth stages, soil-sensor stakes with small solar caps, a weather mast, a small sensor-station shed, drip lines. Real agricultural field-trial feel. | AgriSaarthi (AI crop recommendation) |
| 4 | **Diagnostics Bay** | ~55, mid east | Industrial garage/service bay carved into the slope: roll-up door, vehicle lift with an **EV chassis/battery pack on it** (skateboard platform, orange HV cabling), scanner gantry, OBD cart, parts racks, floodlit apron, painted bay markings, oil-stain/coolant grime. | evDOCTOR / EV Troubleshooter |
| 5 | **Agent Operations** | ~45, mid east below Bay | Control-infrastructure compound: a low data-hall with rack rows seen through open doors, a gantry of operator terminals/consoles each facing the slope, cable trenches, a cooling plant, microwave dish, status lights that blink at *different* cadences (agents running independent loops), a row of identical workstations ("Operator Row") that can grow. Industrial and quiet, not holo-UI. | StrategyAI, SEV Guardian, future agents |
| 6 | **Proving Grounds** | ~50, mid west | Test/competition range: a timed track with gates, a scoring tower/board, flagged lanes, a spectator berm, tyre barriers, a leaderboard board (blank scoreboard geometry only). Where work is judged externally. Brass **benchmark markers** set into a rock ridge beside it (Benchmark Ridge). | Amazon ML Challenge, hackathons, competitive programming, achievements |
| 7 | **Workshop** | ~30, lower east | Open-sided fabrication shed: workbench, vice, lathe silhouette, soldering station, oscilloscope cart, parts bins, a **half-built second rover** on stands, tool outlines, scrap bin. Warm light. | Robotics, hardware, supporting full-stack/engineering work |
| 8 | **Hedge Maze** | ~28, lower west, partly hidden | A clipped-hedge maze (real maze topology, ~1.6 m hedge walls, ~40×40 m) that a small robot can solve; a tiny maze-solving robot prop sits inside (static model is enough; mark where a solver animation will go). Entrance not on the main path: found by following a faint trail. Origin-story tone: handmade, slightly absurd, affectionate. | Maze-solving robot (origin story) |
| 9 | **Watershed** | runs rim → floor | Streams from the rim (fundamentals) merging into rivers (ML → Vision → Agents → Systems) that drain into the floor basin. Muted teal, shallow, believable, following the terrain's gradient. Confluences are meaningful: put small stone gauging stations/weirs at merges. Rivers pass near the relevant zones. Cross them with plain bridges/stepping stones on paths. | Skills as dependency flow |
| 10 | **The Strata** | ~40–15 along the descent | A cut/cliff wall beside the main road exposing **layered strata** (varied bands of rock/soil colour/texture), with engraved year markers and a stair-stepped geologist's trench. Layers get older/denser toward the bottom. | Timeline: school → SRM → projects → research |
| 11 | **Research Station** | **0 (global minimum)** | The deepest and most serious place. A reinforced surface complex over a shaft: blast-door hatch ringed with hazard marking, a headframe/lift tower, instrument pylons, sample core racks, a lit hatch visible from the spawn as a warm point at the bottom of the basin. Cooler, quieter, more engineered than everything above it: precise, no clutter, honest "this is where the real work happens." Also model a **simple underground interior shell** (lift shaft → corridor with 6–7 door bays labelled by room type: Computer Vision, Multimodal AI, Medical AI, Experiments, Data, Research Questions, Papers/Writing), lit sparsely. Interiors can be stylised blockouts; the *exterior* and the *shaft descent mood* are the priority. | Research lines, datasets, status board |
| 12 | **Signal Tower** | ~100 (highest) | Lattice mast with dish/antenna arrays, guy-wires, a pulsing orange beacon (1 pulse / 4 s), small equipment hut at its base, solar array, fence. A silhouette that dominates the northern skyline from anywhere. | Contact |
| 13 | **Local Minimum** | ~70 off a main path | A smooth, shallow false valley — a perfect small bowl — with a hand-lettered sign and a single survey stake at its centre. The rover should be able to roll in; make the slope read as *almost* a trap. Visually a quiet joke. | Easter egg |

Additional optional environmental elements (only if they pull their weight): "Don't Touch It" (a fenced machine with a sign reading *Everything works… don't touch it*), "Overfit Garden" (a hedge shaped to a driven path — leave a placeholder pad), a survey **stake network** (5 numbered fast-travel stakes at Init, Field Office, Agent Ops, Proving Grounds, Research Station).

### Map logic
- **Main Descent**: a paved switchback road Init → Field Office → Diagnostics Bay → Strata → Research Station. Double-line edge paint, culverts, retaining walls, guard rails on drops.
- **Trails**: dirt tracks branch to every other zone; a faint, unmarked one to the Hedge Maze.
- No dead-end cul-de-sacs that trap the player; steep walls and rocky ridges keep the rover inside the playable area without invisible walls (cliffs, boulders, fences, river gorges).
- **Beacons**: the Signal Tower always visible from the rim half; the Research Station's lit hatch glows at the bottom of the basin and should be glimpsed from spawn. Orange tape on stakes marks the nearest unvisited site.
- Max ~8 s of driving between a stake and any site. If the basin is too big for that, shrink it.

## 8. Environmental storytelling rules

- Every prop answers *why is this here?* Cables go somewhere; antennas point at the tower; tyre tracks lead to doors; path wear exists where people/robots walk; the half-built rover has its missing parts on the bench.
- Zone-appropriate wear: grease at the Bay, soil at the Terraces, dust at the Proving Grounds, damp at the Research floor.
- Signage is functional (zone names in stencilled mono, numbered stakes, hazard symbols, bay numbers). No lorem ipsum, no meme text except the three intentional jokes (Local Minimum sign, Don't Touch It, Overfit Garden).
- No pointless clutter. If you can't state a prop's purpose, delete it.
- **No invented credentials or claims** anywhere in the world: no fake scores, no fake logos, no fake award plaques.

## 9. Generation approach (strong preference)

- **Seeded procedural terrain**: composite heightfield = broad basin bowl + domain-warped ridged noise + a few authored Gaussian features (rim crest, Local Minimum bowl, Research Floor pit, zone pads that flatten terrain locally, road cuts). Document the formula. A single seed + parameter file regenerates the world.
- Terrain mesh with chunking or LOD sufficient for ~600×800 m at good silhouette quality; normal-mapped or shader-blended materials by slope/height (rock on steep, soil on mid, scree on slope-bottoms, grass/vegetation on benches, mud/damp on the floor); triplanar projection to avoid stretching.
- Contour lines: generated in the **terrain shader** from height (so they are exact), with index-contour emphasis, fading with distance, blended into materials as painted survey marks.
- Roads/trails: splines that follow the terrain, carved into the heightfield (cut/fill) with shoulders, drawn into a splat/road mask.
- Water: rivers as flow-field-derived splines following steepest descent, rendered as shallow stylised water with subtle flow, banks cut into the terrain.
- Structures: built from a **small parametric kit** (wall panel, roof, gantry, rack, pipe, cable run, stairs, railing, tank, light, sign, crate, pelican case, fence, mast…) with shared materials. Instance repeating elements; merge static meshes where possible.
- Vegetation: instanced, restrained, ink-green; crops with growth-stage variation; no tree-spam.
- Lighting: directional sun with shadow cascades, hemisphere/IBL ambient, atmospheric/height fog thickening toward the floor, sky gradient, warm point/spot lights on a **small, budgeted** number of key practicals (faux-light via emissive + sprite glow for the rest).
- Post: tone mapping, subtle SSAO or baked AO, light vignette. No heavy bloom. Maintain legibility.

## 10. Quality bar and anti-patterns

Must feel: grounded, specific, engineered, quietly dramatic, slightly lonely, *authored.*

Do NOT produce: neon, cyberpunk, glowing cubes/orbs, floating islands, hexagon grids, "tech" particle swirls, the default three.js look (grey MeshStandardMaterial everywhere, flat-colour boxes, single directional light), low-poly toy trees, identical repeated prefabs without variation, empty terrain with scattered objects, a world that is just a flat plane with props.

Self-review before you hand back: render 8+ screenshots (spawn view, descent view, each zone hero shot, basin overview, rover close-up, Research Station approach, dusk silhouette of Signal Tower) and honestly critique them in WORLD_NOTES against the question in §0.

## 11. Performance posture for this phase

Visual quality and coherence first. Still: target 60 fps on a recent laptop GPU at 1080p, instance/merge repeats, share materials, avoid per-frame allocation. Report triangle count, draw calls, texture memory and the heaviest 3 costs. Heavy decisions (shadow resolution, shader complexity) must be documented so they can be tuned later.

## 12. Hand-back checklist

- [ ] `pnpm dev` runs from a clean install; no console errors.
- [ ] All 13 zones present and navigable; teleport list works.
- [ ] Rover drives the whole basin; camera never clips terrain.
- [ ] Main Descent is drivable end to end; Hedge Maze found via trail; Local Minimum rollable.
- [ ] `zones.ts` exports anchors for every site.
- [ ] `docs/WORLD_NOTES.md` complete and self-critical (strengths, weaknesses, what you'd regenerate).
- [ ] Screenshots saved in `world-prototype/screenshots/`.
- [ ] Nothing outside `world-prototype/` and `docs/WORLD_NOTES.md` modified.
