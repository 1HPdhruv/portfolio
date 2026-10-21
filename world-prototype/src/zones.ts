// Interaction anchors: the only contract between the world and future portfolio content.
// The world never owns content; it exposes named physical places. Positions are derived from the
// same pad frames the zone builders use, so anchors sit on the actual props.
// siteIds are placeholders that mirror the design spec's content list; nothing here asserts results.
import type { Heightfield } from './heightfield';
import { PADS, ZONES, ESCARPMENTS, FLOOR } from './layout';

export interface Anchor { zoneId: string; siteId: string; label: string; position: [number, number, number]; radius: number; }

type Local = { zone: string; site: string; label: string; pad?: string; l?: [number, number]; w?: [number, number]; r: number };

const LOCAL: Local[] = [
  { zone: 'init', site: 'quick-view-kiosk', label: 'Quick view kiosk', pad: 'init', l: [7, 11], r: 4 },
  { zone: 'init', site: 'datum-0', label: 'Datum 0 trig pillar', pad: 'init', l: [-13, 1], r: 4 },
  { zone: 'init', site: 'stake-01', label: 'Survey stake 01', pad: 'init', l: [-4, 10], r: 3 },
  { zone: 'field-office', site: 'profile', label: 'Field Office (profile)', pad: 'field-office', l: [2.4, 1.5], r: 5 },
  { zone: 'field-office', site: 'resume-printer', label: 'Resume station (printer)', pad: 'field-office', l: [3.35, 0.2], r: 3 },
  { zone: 'field-office', site: 'survey-terminal', label: 'Survey Terminal (GitHub)', pad: 'field-office', l: [-2.2, -0.7], r: 3 },
  { zone: 'field-office', site: 'field-radio', label: 'Field radio', pad: 'field-office', l: [6.6, -3.6], r: 3 },
  { zone: 'signal-tower', site: 'contact', label: 'Signal Tower (contact)', pad: 'signal-tower', l: [-6.5, 9], r: 6 },
  { zone: 'agri-terraces', site: 'agrisaarthi', label: 'Sensor station (AgriSaarthi)', pad: 'agri', l: [0, 2.5], r: 6 },
  { zone: 'bay', site: 'evdoctor', label: 'Bay 01: EV on the lift, battery pack lowered (evDOCTOR)', pad: 'bay', l: [-2.5, -3.8], r: 6 },
  { zone: 'agent-ops', site: 'strategyai', label: 'Compute module OP-01 (running)', pad: 'agent-ops', l: [0.2, -10.4], r: 3 },
  { zone: 'agent-ops', site: 'sev-guardian', label: 'Compute module OP-02 (running)', pad: 'agent-ops', l: [0.2, -5.2], r: 3 },
  { zone: 'agent-ops', site: 'future-agents', label: 'Compute modules OP-03..05 (provisioned, dark)', pad: 'agent-ops', l: [0.2, 5.2], r: 7 },
  { zone: 'proving', site: 'amazon-ml-challenge', label: 'Scoring tower', pad: 'proving', l: [-24, -10], r: 6 },
  { zone: 'proving', site: 'hackathons', label: 'Timing gate', pad: 'proving', l: [-4, 11.5], r: 5 },
  { zone: 'proving', site: 'stake-04', label: 'Survey stake 04', pad: 'proving', l: [26, 8], r: 3 },
  { zone: 'workshop', site: 'robotics-bench', label: 'ROVER-03 on the stand under the hoist', pad: 'workshop', l: [1.5, -0.9], r: 6 },
  { zone: 'workshop', site: 'dont-touch-it', label: "Don't Touch It", pad: 'workshop', l: [14, 4], r: 3 },
  { zone: 'maze', site: 'maze-robot', label: 'Hedge Maze entrance (maze-solving robot)', w: [-124, 198], r: 5 },
  { zone: 'research', site: 'research-hatch', label: 'Shaft 1 hatch (lift to sub-levels)', pad: 'research', l: [0, 6], r: 8 },
  { zone: 'research', site: 'core-store', label: 'Core store (datasets)', pad: 'research', l: [-22, 2], r: 7 },
  { zone: 'research', site: 'stake-05', label: 'Survey stake 05', pad: 'research', l: [-6, -20], r: 3 },
  { zone: 'local-minimum', site: 'local-minimum', label: 'Local Minimum (easter egg)', w: [-91, -149], r: 8 },
];

export function buildAnchors(hf: Heightfield): Anchor[] {
  const out: Anchor[] = [];
  for (const a of LOCAL) {
    let x: number, z: number;
    if (a.pad) {
      const p = PADS.find((q) => q.id === a.pad)!; const rot = -p.rot, c = Math.cos(rot), s = Math.sin(rot);
      const [lx, lz] = a.l!; x = p.x + lx * c + lz * s; z = p.z - lx * s + lz * c;
    } else [x, z] = a.w!;
    out.push({ zoneId: a.zone, siteId: a.site, label: a.label, position: [x, hf.at(x, z), z], radius: a.r });
  }
  // the Strata (timeline) and Benchmark Ridge (achievements) and Watershed (skills) are linear places
  const e = ESCARPMENTS[0];
  for (let k = 0; k < 6; k++) { const t = 0.25 + k * 0.09, L = Math.hypot(e.x2 - e.x1, e.z2 - e.z1), ux = (e.x2 - e.x1) / L, uz = (e.z2 - e.z1) / L; const x = e.x1 + ux * L * t - uz * 6.5, z = e.z1 + uz * L * t + ux * 6.5; out.push({ zoneId: 'strata', siteId: `strata-S-0${k + 1}`, label: `Strata layer plate S-0${k + 1}`, position: [x, hf.at(x, z), z], radius: 3 }); }
  for (let k = 0; k < 9; k++) { const z = -8 + k * 13; let bx = -70, bh = -1e9; for (let x = -95; x <= -45; x += 0.5) { const h = hf.at(x, z); if (h > bh) { bh = h; bx = x; } } out.push({ zoneId: 'proving', siteId: `benchmark-BM-0${k + 1}`, label: `Benchmark Ridge marker BM-0${k + 1}${k >= 6 ? ' (empty socket)' : ''}`, position: [bx, bh, z], radius: 2.5 }); }
  hf.rivers.forEach((r, i) => { if (!r.joinsAt) return; const q = r.pts[r.pts.length - 1]; out.push({ zoneId: 'watershed', siteId: `confluence-${i}`, label: `Watershed confluence (gauging station)`, position: [q.x, hf.at(q.x, q.z), q.z], radius: 8 }); });
  void ZONES; void FLOOR;
  return out;
}
