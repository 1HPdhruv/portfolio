# Content mapping: anchors → portfolio content

**Single source of truth:** `app/src/content/data.ts` (typed by `types.ts`). Every surface uses the same renderer (`render.ts`): the static pages, Quick View, the in-world panels and the fallback list. Each text exists once.
**Anchor mapping:** `app/src/content/mapping.ts`, which covers all 42 anchors in the world (`world-prototype/src/world/anchors.ts`) and is enforced one-to-one by `app/tests/mapping.test.ts`.
**Sources:** Dhruva's résumé (2 pages, supplied by the owner) and the public READMEs and metadata of `github.com/1HPdhruv` repositories. Links were checked on 2026-10-22. Each record carries a `sources` field (`resume`, `repo`, `owner` or `world`).

## 1. Zones and anchors (13 zones, 42 anchors)

| # | Zone | Anchors → outcome | Status |
|---|---|---|---|
| 1 | Init / Origin | `quick-view-kiosk` → Quick View · `datum-0` → note (the loss-landscape premise) · `stake-01` → navigator | Complete |
| 2 | Field Office | `profile` → profile page · `resume-printer` → résumé page · `survey-terminal` → GitHub page · `field-radio` → note | Complete; the résumé PDF is not published (see §3) |
| 3 | Agri Terraces | `agrisaarthi` → project **AgriSaarthi** | Complete |
| 4 | Diagnostics Bay | `evdoctor` → project **evDOCTOR** | Complete |
| 5 | Agent Operations | `strategyai` → **StrategyAI** · `sev-guardian` → **SEV Guardian** · `future-agents` → “more agent systems” page (Smart Parking, Financial CSI) | Complete; SEV Guardian has no live demo |
| 6 | Proving Grounds | `amazon-ml-challenge` → project · `hackathons` → competitions page · `stake-04` → navigator · BM-01…06 → the six achievements · BM-07…09 → empty sockets | Complete; achievements have no proof links |
| 7 | Workshop | `robotics-bench` → workshop page (Driver Vigilance, Smart Parking, maze robot, Hyperloop) · `dont-touch-it` → note | Complete |
| 8 | Hedge Maze | `maze-robot` → project **maze robot** (status “Documentation pending”) | **Evidence missing**: no repo, photos or log yet |
| 9 | Watershed | `confluence-1…4` → skill groups: fundamentals, ML, vision, agents | Complete |
| 10 | The Strata | `strata-S-01…06` → milestones (Class X 2022 → research 2026) | Complete |
| 11 | Research Station | `research-hatch`, `core-store` → research page · `stake-05` → navigator | Complete as a page; the research lines have no results or publications to show yet (stated on the page) |
| 12 | Signal Tower | `contact` → contact page (email, GitHub, LinkedIn) | Complete; LinkedIn is unverified |
| 13 | Local Minimum | `local-minimum` → note | Complete (narrative only, by design) |

Each zone also has a **primary outcome**, used by the navigator's **Read**, by the fallback list, and by fast travel when no world is running.

## 2. Content records

| Record | Status shown | Links (all `https://`, checked 2026-10-22) |
|---|---|---|
| AgriSaarthi | Prototype · 2025 | repo `1HPdhruv/AgriSaarthi` |
| evDOCTOR | Prototype · 2025 | repo `1HPdhruv/evDOCTOR`, demo `ev-troubleshooter.netlify.app` |
| StrategyAI | Prototype · 2026 | repo `1HPdhruv/strategyai`, demo `strategyai.netlify.app` |
| SEV Guardian | Prototype · 2026 (AMD Slingshot Hackathon) | repo `1HPdhruv/Sev-Guardian`. The README's Render demo timed out, so it is not linked |
| Financial CSI | Prototype · 2026 | repo `1HPdhruv/Razorpay`, demo `razorpay-swart.vercel.app` |
| Smart Parking System | In progress | repo `1HPdhruv/Smart_Parking_System`, demo `parker-os.netlify.app` |
| VocalVitals | Prototype, “not a medical device” | repo `1HPdhruv/VocalVitals` |
| Amazon ML Challenge 2026 | Prototype; states it used synthetic data and made no submission | repo `1HPdhruv/AmazonMLchallenge` |
| Driver Vigilance System | Prototype | repo `1HPdhruv/Driver-Vigiliance-System` (the repository's own spelling) |
| Competitive programming | Prototype | repo `1HPdhruv/Competetive-Programming` (the repository's own spelling) |
| Maze-solving robot | Documentation pending | none (`needsEvidence`) |
| Research: depth completion (AR/VR) | Ongoing | none; the page lists what it does **not** claim |
| Research: early-onset Alzheimer's | Ongoing | none; no clinical validation, diagnostic use or performance figures are claimed, and no participant data is used or shown |
| Skills (5 groups), education (3), achievements (6), timeline (S-01…S-06) | From the résumé | GitHub profile; LinkedIn (unverified) |

Featured in Quick View: evDOCTOR, AgriSaarthi, StrategyAI.

## 3. Verified vs missing

**Verified** (a link checked or a public README read):
- the 10 project repositories and their 5 live demos;
- the GitHub profile;
- the email (from the résumé).

**Stated from the résumé, not independently evidenced:**
- the achievements (wins, certifications, 30+ hackathons);
- education and the timeline;
- the research lines.

These are shown as the owner's résumé states them, with no proof links. The achievements list says so.

**Missing: owner action needed**

| Gap | Where it shows | What would close it |
|---|---|---|
| Résumé PDF | Field Office → résumé page says “not published yet”; the header link is hidden | Add `app/public/resume.pdf`. The current PDF contains a phone number, and the directive keeps the phone off the site, so publish a version without it |
| LinkedIn URL unverified | Contact links | LinkedIn answers automated checks with HTTP 999; confirm `linkedin.com/in/1hpdhruv` by hand |
| Maze robot evidence | Hedge Maze | Repo, photos, video or a build log |
| Achievement proof | Benchmark Ridge | Certificate or announcement URLs (`proof` field) |
| SEV Guardian demo | Agent Operations | A live URL, if the Render service is revived |
| Research detail | Research Station | Abstracts or publications when they exist; supervisor or lab names only with permission |
| Production domain | SEO | Set `SITE` (see DEPLOYMENT.md) for canonical URLs, absolute OG URLs and a sitemap |

## 4. Rules the content follows

- No metrics, accuracy figures, users, awards, employers or collaborators beyond what the sources state.
- Phone number: never in the world, the site or the repo. An e2e check guards the rendered page.
- Medical and clinical: VocalVitals and the Alzheimer's line carry explicit non-claims.
- World props that are part of the fiction say so. ROVER-03 is “part of the world, not a project claim”, and the Watershed river is “a metaphor, not a measured dependency graph”.
- To add or change content, edit `data.ts`, and `mapping.ts` if an anchor should point to it, then run `pnpm test`.
