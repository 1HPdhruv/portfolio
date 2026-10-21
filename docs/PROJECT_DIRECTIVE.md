# DHRUVA'S WORLD — Project Directive

Status: Phase 0 complete. Phase 1 (world prototype) not started.
Source spec: "Dhruva's World — Open-World Portfolio Design Spec.pdf" (33 pp, Oct 6 2026). Where this directive and the spec disagree, **this directive wins**; the spec's rendering recommendation (2D Pixi) is overridden.

## 0. Repository state at start

| Item | Finding |
|---|---|
| Contents | `README.md` (11 bytes) only |
| Framework / config | None. No package.json, no lockfile, no tooling config |
| Git | `main`, one commit (`ffd23da Initial commit`), clean tree |
| Remote | `github.com/1HPdhruv/portfolio` |
| Toolchain on machine | Node 24.7, npm, pnpm, yarn (no bun) |
| Deployment | Nothing configured. Spec assumes Vercel + custom domain |
| Decision | Use **pnpm**. Greenfield; nothing to preserve or migrate |

## 1. Project objective

Replace the current template portfolio with **a professional 3D open-world game that happens to be Dhruva's portfolio**. The visitor should feel they are exploring a place that belongs to an AI/ML engineer, not browsing a website.

Phase 1 success criterion: *on entering the prototype, the visitor immediately understands they are inside a unique explorable world belonging to an AI/ML engineer — not inside a portfolio template.*

## 2. Creative direction

A **geological survey / scientific field expedition** meets **field robotics and experimental AI research**, with restrained near-future technology. Believable, used, purposeful. Equipment has a function; buildings relate to their zone; paths follow terrain logic; landmarks aid navigation.

Spec palette discipline carries over as a *constraint*, translated to 3D: ink-green ground, chalk/paper neutrals, survey-orange (`#FF6A2B`) as the single loud accent, brass (`#C9A44A`) for benchmarks only, muted teal (`#5E8C8A`) for water only, warm window light (`#FFC27A`). Orange stays a small fraction of any frame.

Explicitly rejected looks: cyberpunk, purple neon, generic sci-fi city, fantasy RPG, Minecraft/voxel, GTA, generic futuristic lab, glassmorphism, particle/neural-net backgrounds.

## 3. World concept — "The Basin"

One continuous terrain shaped like an ML loss landscape. **Elevation = depth of work.** Rim (who/contact) → Slopes (projects, skills, achievements, timeline) → Floor (Research Station at the global minimum). The player is a small autonomous **survey rover**, a descendant of Dhruva's maze-solving robot: research equipment, not a cartoon avatar.

Zones (13, improvable; see the Fable brief for full design): Init/Origin, Field Office, Agri Terraces, Diagnostics Bay, Agent Operations, Proving Grounds, Workshop, Hedge Maze, Watershed, The Strata, Research Station, Signal Tower, Local Minimum. The spec's Benchmark Ridge (achievements as brass survey markers) is retained and folded into Proving Grounds/Strata unless Fable finds a better home.

## 4. UX principles

1. Places, not menus. Content attaches to physical locations.
2. Evidence before decoration. Only verifiable claims ship (repo, demo, report, status). No invented stats, XP, levels, or metrics.
3. Never trap a recruiter. A conventional **Quick view** and plain links (Resume, GitHub, LinkedIn, Email) are always one click away. Nothing is locked.
4. One progress metric (Survey %); no XP. Fog is never black.
5. Always see something unvisited: landmarks/beacons readable from anywhere.
6. Fast travel from the start; no site more than ~8 s from a stake.
7. Motion carries meaning; no forced cutscenes > 1.5 s; skippable, never repeated. Sound opt-in.
8. Readable camera over cinematic camera.

## 5. Non-negotiable requirements

- Third-person / oblique-top-down hybrid camera; follow-cam with limited, readable orbit; no first-person; no shake.
- Rover looks like field-robotics hardware.
- The terrain itself communicates the loss-landscape metaphor (visible basin form, contour language, descent).
- Every major structure has a reason to exist tied to portfolio content.
- Landmarks make navigation possible: Signal Tower visible from everywhere on the rim side, Research Station hatch/glow visible from spawn.
- Coherent materials and consistent scale (1 unit = 1 m; rover ≈ 1.2 m long).
- Accessibility and fallback are designed in, not bolted on: DOM content layer, keyboard path, reduced-motion mode, WebGL-failure fallback to static map + Quick view.
- No unverified content. Placeholder copy is marked as placeholder.
- Personal contact details (phone) are not placed in the world.

## 6. Intentionally NOT being built (this phase)

- The actual portfolio content, case studies, routing, CMS/content collections.
- HUD/Sheet/Map/Journal UI beyond a debug overlay.
- Survey %, fog persistence, routes, benchmarks logic.
- Contact form, GitHub fetch, analytics, SEO, OG images.
- Mobile/touch UX and low-power mode (design for them; don't build).
- Photoreal rendering, physics simulation, multiplayer, voice/chatbot ("Drake" is retired).
- Anything resembling a normal portfolio page.

## 7. Technical assumptions

- Prototype: **Vite + TypeScript + three.js** (plain three or R3F; Fable chooses), `pnpm`, in an isolated `world-prototype/` directory so the final app architecture is unconstrained.
- **Procedural first**: terrain from a seeded heightfield function; structures from parametric builders and a small kit of reusable parts; materials from a small shared set. No downloaded model packs. Procedural textures/shaders allowed; any external asset must be CC0/self-made and documented.
- Optimise for visual quality and coherence now; production performance later. Still avoid obviously wasteful choices (instancing for repeats, merged static geometry, shared materials).
- Final app (later, not decided here): Astro or equivalent static shell for Quick view/SEO + the 3D world as a lazy-loaded island; DOM for all text; Vercel deploy. The spec's one-content-source / shared-URL idea is retained.
- The spec's budgets (350 KB JS, 1.5 MB art) were written for 2D Pixi and **do not apply** to 3D. New budgets are set in the audit after the prototype exists.

## 8. Fable's responsibility

Design and generate the 3D world: terrain, zone layout, landmarks, structures, rover model, materials, lighting, atmosphere, path network, camera rig, drive controls sufficient to evaluate the space, a debug fly/teleport-to-zone tool, and a short `WORLD_NOTES.md` describing how it is built. Fable decides art execution inside the brief's constraints and may improve the zone design if it can justify it. Fable does **not** build portfolio UI, content, or app architecture.

## 9. Claude Code's responsibility

- Repo inspection, this directive, the Fable brief, and the audit (`WORLD_AUDIT.md`).
- Inspect Fable's output before touching it; report honestly; no rewriting on reflex.
- After the world passes review: project scaffold, content model, DOM UI layer (HUD, sheets, map, terminal), routing, Quick view, state, accessibility, performance work, deployment, tests, CI.
- Keep boundaries clean: the world exposes zone/site anchors and events; it never owns content.

## 10. Gemini's review responsibility

Independent visual/UX critique of screenshots or the running prototype, against the Phase 1 success criterion and the "generic AI 3D demo" failure modes: Does it read as a place? Is the loss-landscape metaphor legible? Is navigation clear? Does anything look template/stock? Are scale, lighting and material coherence believable? Gemini reports findings only; it does not edit the repository. Its review is an input to `WORLD_AUDIT.md`, and the pass/fail gate is the owner's.
