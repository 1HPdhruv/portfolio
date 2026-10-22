// World anchor → content. Keys are the exact (zoneId, siteId) pairs exported by world-prototype/src/zones.ts
// (verified by tests/mapping.test.ts against the live anchor list). Several anchors may share one content object.
import type { AnchorMapping, AnchorOutcome } from './types';
import { achievements } from './data';

const BENCHMARK_ORDER = ['techformers', 'schneider-hmi', 'ideathon', 'hackathons', 'oracle', 'nptel']; // BM-01 … BM-06

export const anchorMappings: AnchorMapping[] = [
  // Init / Origin
  { zoneId: 'init', siteId: 'quick-view-kiosk', outcome: { kind: 'quick-view' } },
  { zoneId: 'init', siteId: 'datum-0', outcome: { kind: 'note', title: 'Datum 0', body: 'Every survey starts from a fixed point. The Basin is shaped like a loss landscape: models learn by descending one, and the deeper you go here, the deeper the work. The Research Station sits at the global minimum.' } },
  { zoneId: 'init', siteId: 'stake-01', outcome: { kind: 'navigator' } },
  // Field Office
  { zoneId: 'field-office', siteId: 'profile', outcome: { kind: 'page', id: 'profile' } },
  { zoneId: 'field-office', siteId: 'resume-printer', outcome: { kind: 'page', id: 'resume' } },
  { zoneId: 'field-office', siteId: 'survey-terminal', outcome: { kind: 'page', id: 'github' } },
  { zoneId: 'field-office', siteId: 'field-radio', outcome: { kind: 'note', title: 'Field radio', body: 'Nothing on this frequency yet. To reach Dhruva, use the Signal Tower or the contact links.' } },
  // Signal Tower
  { zoneId: 'signal-tower', siteId: 'contact', outcome: { kind: 'page', id: 'contact' } },
  // Agri Terraces
  { zoneId: 'agri-terraces', siteId: 'agrisaarthi', outcome: { kind: 'project', id: 'agrisaarthi' } },
  // Diagnostics Bay
  { zoneId: 'bay', siteId: 'evdoctor', outcome: { kind: 'project', id: 'evdoctor' } },
  // Agent Operations
  { zoneId: 'agent-ops', siteId: 'strategyai', outcome: { kind: 'project', id: 'strategyai' } },
  { zoneId: 'agent-ops', siteId: 'sev-guardian', outcome: { kind: 'project', id: 'sev-guardian' } },
  { zoneId: 'agent-ops', siteId: 'future-agents', outcome: { kind: 'page', id: 'agents' } },
  // Proving Grounds + Benchmark Ridge
  { zoneId: 'proving', siteId: 'amazon-ml-challenge', outcome: { kind: 'project', id: 'amazon-ml-challenge' } },
  { zoneId: 'proving', siteId: 'hackathons', outcome: { kind: 'page', id: 'competitions' } },
  { zoneId: 'proving', siteId: 'stake-04', outcome: { kind: 'navigator' } },
  ...Array.from({ length: 9 }, (_, i): AnchorMapping => {
    const marker = `BM-0${i + 1}`;
    const id = BENCHMARK_ORDER[i];
    return { zoneId: 'proving', siteId: `benchmark-${marker}`, outcome: id ? { kind: 'achievement', id } : { kind: 'empty-benchmark', marker } };
  }),
  // Workshop
  { zoneId: 'workshop', siteId: 'robotics-bench', outcome: { kind: 'page', id: 'workshop' } },
  { zoneId: 'workshop', siteId: 'dont-touch-it', outcome: { kind: 'note', title: 'Everything works… don’t touch it.', body: 'A fenced rig that has been humming along for a long time. Dhruva’s GitHub tagline, made physical. Told you.' } },
  // Hedge Maze
  { zoneId: 'maze', siteId: 'maze-robot', outcome: { kind: 'project', id: 'maze-robot' } },
  // Research Station
  { zoneId: 'research', siteId: 'research-hatch', outcome: { kind: 'page', id: 'research' } },
  { zoneId: 'research', siteId: 'core-store', outcome: { kind: 'page', id: 'research' } },
  { zoneId: 'research', siteId: 'stake-05', outcome: { kind: 'navigator' } },
  // Local Minimum
  { zoneId: 'local-minimum', siteId: 'local-minimum', outcome: { kind: 'note', title: 'Local minimum', body: 'Not the bottom. The gradient is zero here, and that is the trap. Try momentum.' } },
  // The Strata
  ...['S-01', 'S-02', 'S-03', 'S-04', 'S-05', 'S-06'].map((id): AnchorMapping => ({ zoneId: 'strata', siteId: `strata-${id}`, outcome: { kind: 'milestone', id } })),
  // Watershed confluences (gauging stations)
  ...(['fundamentals', 'ml', 'vision', 'agents'] as const).map((id, i): AnchorMapping => ({ zoneId: 'watershed', siteId: `confluence-${i + 1}`, outcome: { kind: 'skills', id } })),
];

const key = (zoneId: string, siteId: string) => `${zoneId}/${siteId}`;
const index = new Map(anchorMappings.map((m) => [key(m.zoneId, m.siteId), m.outcome]));

/** Resolve a world interaction. Unknown anchors resolve to null (the app shows a neutral message, never throws). */
export function resolveAnchor(zoneId: string, siteId: string): AnchorOutcome | null {
  return index.get(key(zoneId, siteId)) ?? null;
}

/** The physical place for a content object, for "See it in the Basin". First matching anchor wins. */
export function placeFor(kind: 'project' | 'research' | 'page', id: string): { zoneId: string; siteId: string } | null {
  for (const m of anchorMappings) {
    const o = m.outcome;
    if ((o.kind === kind && 'id' in o && o.id === id) || (kind === 'research' && o.kind === 'page' && o.id === 'research')) return { zoneId: m.zoneId, siteId: m.siteId };
  }
  return null;
}

export const achievementIds = new Set(achievements.map((a) => a.id));
