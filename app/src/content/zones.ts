// Application-side description of each world zone (for the navigator, map pins and fallback).
// Zone ids, names, numbers and coordinates come from the world's layout (single source of truth).
import { ZONES } from '../../../world-prototype/src/layout';
import type { AnchorOutcome } from './types';

export interface ZoneInfo { id: string; num: number; name: string; x: number; z: number; blurb: string; primary: AnchorOutcome }

const META: Record<string, { blurb: string; primary: AnchorOutcome }> = {
  init: { blurb: 'Rover dock and Datum 0, where every visit starts.', primary: { kind: 'quick-view' } },
  'field-office': { blurb: 'Profile, education, résumé and GitHub.', primary: { kind: 'page', id: 'profile' } },
  'agri-terraces': { blurb: 'Field-trial terraces: AgriSaarthi.', primary: { kind: 'project', id: 'agrisaarthi' } },
  bay: { blurb: 'EV on the lift: evDOCTOR fault diagnosis.', primary: { kind: 'project', id: 'evdoctor' } },
  'agent-ops': { blurb: 'Compute row: StrategyAI, SEV Guardian and other agent systems.', primary: { kind: 'page', id: 'agents' } },
  proving: { blurb: 'Competitions, hackathons and Benchmark Ridge.', primary: { kind: 'page', id: 'competitions' } },
  workshop: { blurb: 'Hardware, vision and embedded work.', primary: { kind: 'page', id: 'workshop' } },
  maze: { blurb: 'Where ROVER-02’s ancestor, the maze robot, lives.', primary: { kind: 'project', id: 'maze-robot' } },
  watershed: { blurb: 'Skills, as streams joining rivers.', primary: { kind: 'page', id: 'skills' } },
  strata: { blurb: 'Rock layers as a timeline.', primary: { kind: 'page', id: 'timeline' } },
  research: { blurb: 'The global minimum: ongoing research.', primary: { kind: 'page', id: 'research' } },
  'signal-tower': { blurb: 'Contact.', primary: { kind: 'page', id: 'contact' } },
  'local-minimum': { blurb: 'A small pit off the trail. Not the bottom.', primary: { kind: 'note', title: 'Local minimum', body: 'Not the bottom. The gradient is zero here, and that is the trap. Try momentum.' } },
};

export const zones: ZoneInfo[] = [...ZONES].sort((a, b) => a.num - b.num).map((z) => {
  const m = META[z.id];
  if (!m) throw new Error(`zones.ts: no description for world zone "${z.id}"`);
  return { id: z.id, num: z.num, name: z.name.replace(' (confluence)', ''), x: z.x, z: z.z, ...m };
});

/** map position as a percentage of the static map (the map tool renders x −300…300, z −400…400) */
export const mapPos = (x: number, z: number) => ({ left: ((x + 300) / 600) * 100, top: ((z + 400) / 800) * 100 });
