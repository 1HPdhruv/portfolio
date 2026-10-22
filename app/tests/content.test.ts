// Content integrity: stable ids, traceable sources, no dangling references, safe rendering.
import { describe, expect, it } from 'vitest';
import { achievements, education, profile, projects, research, skills, timeline } from '../src/content/data';
import { renderPage, renderProject, renderOutcome } from '../src/content/render';
import type { PageId } from '../src/content/types';

describe('content model', () => {
  it('project ids are unique, URL-safe slugs', () => {
    const ids = projects.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
  it('every record carries at least one source', () => {
    for (const r of [...projects, ...research, ...skills, ...education, ...achievements, ...timeline]) expect(r.sources.length, (r as { id: string }).id).toBeGreaterThan(0);
    expect(profile.sources.length).toBeGreaterThan(0);
  });
  it('shipped work has evidence: a link, or an explicit needsEvidence flag', () => {
    for (const p of projects) expect(p.links.length > 0 || !!p.needsEvidence, p.id).toBe(true);
  });
  it('external links are https and well-formed; nothing points at localhost or a dev server', () => {
    const all = [...projects.flatMap((p) => p.links), ...profile.links];
    for (const l of all) {
      if (l.kind === 'email') { expect(l.href).toMatch(/^mailto:[^@\s]+@[^@\s]+$/); continue; }
      expect(l.href, l.href).toMatch(/^https:\/\//);
      expect(l.href).not.toMatch(/localhost|127\.0\.0\.1|:\d{4}\b/);
    }
  });
  it('no phone number is published anywhere in the content', () => {
    const blob = JSON.stringify({ profile, projects, research, skills, education, achievements, timeline });
    expect(blob).not.toMatch(/\+91|92638|94272/);
  });
  it('research makes no clinical or performance claims and states its boundaries', () => {
    for (const r of research) { expect(r.stage).toBe('ongoing'); expect(r.boundaries.length).toBeGreaterThan(0); }
    const alz = research.find((r) => r.id === 'alzheimers')!;
    expect(alz.boundaries.join(' ')).toMatch(/No clinical validation/);
    expect(JSON.stringify(alz)).not.toMatch(/accuracy|AUC|validated\b|diagnoses patients/i);
  });
  it('skills only reference real projects', () => {
    const ids = new Set(projects.map((p) => p.id));
    for (const g of skills) for (const s of g.skills) for (const id of s.usedIn) expect(ids.has(id), `${s.name} → ${id}`).toBe(true);
  });
  it('the Amazon ML Challenge page keeps the repository’s own caveat', () => {
    const p = projects.find((x) => x.id === 'amazon-ml-challenge')!;
    expect(p.statusNote).toMatch(/no competition submission/i);
  });
  it('renderers escape content (no HTML injection from data)', () => {
    const html = renderProject({ ...projects[0], title: '<img src=x onerror=alert(1)>', summary: '"><script>x</script>' });
    expect(html).not.toMatch(/<img src=x|<script>/);
    expect(html).toMatch(/&lt;img src=x/);
  });
  it('every page id renders; the résumé page never links a missing PDF', () => {
    for (const id of ['profile', 'contact', 'github', 'resume', 'skills', 'timeline', 'achievements', 'research', 'agents', 'competitions', 'workshop'] as PageId[]) expect(renderPage(id, { resumeAvailable: false }).html.length).toBeGreaterThan(20);
    expect(renderPage('resume', { resumeAvailable: false }).html).not.toMatch(/resume\.pdf/);
    expect(renderPage('resume', { resumeAvailable: true }).html).toMatch(/href="\/resume\.pdf"/);
    expect(renderOutcome({ kind: 'note', title: 't', body: '<b>' }, { resumeAvailable: false })!.html).toMatch(/&lt;b&gt;/);
  });
});
