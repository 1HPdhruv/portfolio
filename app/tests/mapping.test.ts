// Every anchor the world exports must map to exactly one valid outcome, and nothing may map to a missing anchor.
import { describe, expect, it, beforeAll } from 'vitest';
import { Heightfield } from '../../world-prototype/src/heightfield';
import { buildAnchors, type Anchor } from '../../world-prototype/src/zones';
import { ZONES } from '../../world-prototype/src/layout';
import { anchorMappings, resolveAnchor, placeFor } from '../src/content/mapping';
import { renderOutcome } from '../src/content/render';
import { projects } from '../src/content/data';
import { zones } from '../src/content/zones';

let anchors: Anchor[] = [];
beforeAll(() => { anchors = buildAnchors(new Heightfield()); });

describe('anchor contract', () => {
  it('the world exports 42 anchors across 13 zones', () => {
    expect(anchors.length).toBe(42);
    expect(new Set(anchors.map((a) => a.zoneId)).size).toBe(13);
    expect(ZONES.length).toBe(13);
  });
  it('every exported anchor has exactly one mapping', () => {
    for (const a of anchors) expect(anchorMappings.filter((m) => m.zoneId === a.zoneId && m.siteId === a.siteId), `${a.zoneId}/${a.siteId}`).toHaveLength(1);
  });
  it('no mapping refers to an anchor the world does not export', () => {
    const live = new Set(anchors.map((a) => `${a.zoneId}/${a.siteId}`));
    for (const m of anchorMappings) expect(live.has(`${m.zoneId}/${m.siteId}`), `${m.zoneId}/${m.siteId}`).toBe(true);
  });
  it('every mapping resolves deterministically to renderable content or a shell action', () => {
    for (const a of anchors) {
      const o = resolveAnchor(a.zoneId, a.siteId);
      expect(o, `${a.zoneId}/${a.siteId}`).not.toBeNull();
      if (o!.kind === 'quick-view' || o!.kind === 'navigator') continue;
      const r1 = renderOutcome(o!, { resumeAvailable: false }), r2 = renderOutcome(o!, { resumeAvailable: false });
      expect(r1, `${a.zoneId}/${a.siteId}`).not.toBeNull();
      expect(r1!.title.length).toBeGreaterThan(0);
      expect(r1!.html).toBe(r2!.html);
    }
  });
  it('unknown or missing ids resolve to null instead of throwing', () => {
    expect(resolveAnchor('nowhere', 'nothing')).toBeNull();
    expect(resolveAnchor('bay', 'not-a-site')).toBeNull();
    expect(renderOutcome({ kind: 'project', id: 'does-not-exist' }, { resumeAvailable: false })).toBeNull();
  });
  it('the required zone concepts point at the right content', () => {
    expect(resolveAnchor('agri-terraces', 'agrisaarthi')).toEqual({ kind: 'project', id: 'agrisaarthi' });
    expect(resolveAnchor('bay', 'evdoctor')).toEqual({ kind: 'project', id: 'evdoctor' });
    expect(resolveAnchor('agent-ops', 'strategyai')).toEqual({ kind: 'project', id: 'strategyai' });
    expect(resolveAnchor('agent-ops', 'sev-guardian')).toEqual({ kind: 'project', id: 'sev-guardian' });
    expect(resolveAnchor('maze', 'maze-robot')).toEqual({ kind: 'project', id: 'maze-robot' });
    expect(resolveAnchor('signal-tower', 'contact')).toEqual({ kind: 'page', id: 'contact' });
    expect(resolveAnchor('field-office', 'profile')).toEqual({ kind: 'page', id: 'profile' });
    expect(resolveAnchor('research', 'research-hatch')).toEqual({ kind: 'page', id: 'research' });
    expect(resolveAnchor('init', 'quick-view-kiosk')).toEqual({ kind: 'quick-view' });
    expect(resolveAnchor('proving', 'benchmark-BM-07')).toEqual({ kind: 'empty-benchmark', marker: 'BM-07' });
  });
  it('every project that has a world location can be found from its page', () => {
    for (const id of ['agrisaarthi', 'evdoctor', 'strategyai', 'sev-guardian', 'amazon-ml-challenge', 'maze-robot']) expect(placeFor('project', id), id).not.toBeNull();
    expect(projects.length).toBeGreaterThan(0);
  });
  it('the navigator describes every world zone, using the world’s own ids and numbers', () => {
    expect(zones.map((z) => z.id).sort()).toEqual(ZONES.map((z) => z.id).sort());
    for (const z of zones) expect(ZONES.find((q) => q.id === z.id)!.num).toBe(z.num);
  });
});
