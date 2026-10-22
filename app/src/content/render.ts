// One renderer for every surface: static pages (Astro, at build time) and in-world panels (client, at run time)
// produce identical HTML from the same data, so there is no second copy of any text.
import { achievements, education, profile, projects, research, skills, timeline } from './data';
import { placeFor } from './mapping';
import type { AnchorOutcome, Link, PageId, Project, ResearchLine, Status } from './types';

export interface RenderCtx { resumeAvailable: boolean }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const STATUS: Record<Status, string> = { prototype: 'Prototype', 'in-progress': 'In progress', research: 'Research', planned: 'Documentation pending' };

export const statusLabel = (s: Status) => STATUS[s];
export const projectById = (id: string) => projects.find((p) => p.id === id) ?? null;
export const researchById = (id: string) => research.find((r) => r.id === id) ?? null;

function linkHtml(l: Link): string {
  const ext = /^https?:/.test(l.href);
  return `<a class="lnk lnk-${l.kind}" href="${esc(l.href)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(l.label)}${ext ? '<span class="sr-only"> (opens in a new tab)</span>' : ''}</a>`;
}
const links = (ls: Link[]) => (ls.length ? `<p class="links">${ls.map(linkHtml).join('')}</p>` : '');
const list = (items: string[], cls = '') => (items.length ? `<ul${cls ? ` class="${cls}"` : ''}>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '');
const chips = (items: string[]) => (items.length ? `<ul class="chips" aria-label="Technologies">${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '');
const basinLink = (zoneId: string | undefined, siteId?: string) => (zoneId ? `<p class="basin-link"><a href="/?site=${esc(zoneId)}${siteId ? `/${esc(siteId)}` : ''}" data-goto-zone="${esc(zoneId)}">Find it in the Basin →</a></p>` : '');

export function renderProject(p: Project, opts: { headingLevel?: 2 | 3; withPlace?: boolean } = {}): string {
  const h = `h${opts.headingLevel ?? 2}`;
  const place = opts.withPlace ? placeFor('project', p.id) : null;
  return `<article class="item project" id="project-${esc(p.id)}" aria-labelledby="t-${esc(p.id)}">
  <p class="eyebrow"><span class="status status-${p.status}">${STATUS[p.status]}</span>${p.year ? ` · ${p.year}` : ''}</p>
  <${h} id="t-${esc(p.id)}">${esc(p.title)}</${h}>
  <p class="lede">${esc(p.summary)}</p>
  ${p.statusNote ? `<p class="note">${esc(p.statusNote)}</p>` : ''}
  ${p.description.map((d) => `<p>${esc(d)}</p>`).join('')}
  ${p.highlights.length ? `<h${(opts.headingLevel ?? 2) + 1} class="label">Verified details</h${(opts.headingLevel ?? 2) + 1}>${list(p.highlights)}` : ''}
  ${chips(p.tech)}
  ${p.needsEvidence ? `<p class="note">Still needed: ${esc(p.needsEvidence)}</p>` : ''}
  ${links(p.links)}
  ${place ? basinLink(place.zoneId, place.siteId) : ''}
</article>`;
}

export function renderResearch(r: ResearchLine, headingLevel: 2 | 3 = 2): string {
  const h = `h${headingLevel}`;
  return `<article class="item research" id="research-${esc(r.id)}" aria-labelledby="t-${esc(r.id)}">
  <p class="eyebrow"><span class="status status-research">Ongoing research</span></p>
  <${h} id="t-${esc(r.id)}">${esc(r.title)}</${h}>
  <p class="lede">${esc(r.question)}</p>
  ${r.description.map((d) => `<p>${esc(d)}</p>`).join('')}
  <h${headingLevel + 1} class="label">What this page does not claim</h${headingLevel + 1}>${list(r.boundaries)}
</article>`;
}

const projectRow = (p: Project) => `<li><a href="/work/${esc(p.id)}" data-open-project="${esc(p.id)}">${esc(p.title)}</a> — <span class="status status-${p.status}">${STATUS[p.status]}</span><br><span class="muted">${esc(p.summary)}</span></li>`;

export function renderPage(id: PageId, ctx: RenderCtx): { title: string; html: string } {
  switch (id) {
    case 'profile': return { title: profile.name, html: `<p class="lede">${esc(profile.role)} · ${esc(profile.location)}</p>${profile.intro.map((p) => `<p>${esc(p)}</p>`).join('')}<h3 class="label">Focus</h3>${list(profile.focus)}<h3 class="label">Education</h3><ul>${education.map((e) => `<li><strong>${esc(e.title)}</strong><br>${esc(e.institution)} · ${esc(e.period)}${e.detail ? ` · ${esc(e.detail)}` : ''}</li>`).join('')}</ul><h3 class="label">Leadership</h3>${list(profile.leadership)}<h3 class="label">Languages</h3><p>${profile.languages.map(esc).join(' · ')}</p>${links(profile.links)}` };
    case 'contact': return { title: 'Contact', html: `<p class="lede">The direct ways to reach Dhruva.</p>${links(profile.links)}<p class="muted">No contact form: email goes straight to Dhruva.</p>` };
    case 'github': return { title: 'Survey Terminal — GitHub', html: `<p class="lede">Source for the projects in the Basin lives on GitHub.</p><ul class="rows">${projects.filter((p) => p.links.some((l) => l.kind === 'repo')).map((p) => { const r = p.links.find((l) => l.kind === 'repo')!; return `<li>${linkHtml(r)} — ${esc(p.title)}</li>`; }).join('')}</ul>${links([profile.links.find((l) => l.href.includes('github.com'))!])}` };
    case 'resume': return { title: 'Résumé', html: ctx.resumeAvailable ? `<p class="lede">The full résumé as a PDF.</p><p class="links"><a class="lnk lnk-resume" href="${esc(profile.resume.href)}" download>Download résumé (PDF)</a></p>` : `<p class="lede">The résumé PDF has not been published on this site yet.</p><p>Everything on it is in Quick View: projects, research, skills, education and achievements.</p>${links(profile.links)}` };
    case 'skills': return { title: 'Watershed — skills', html: renderSkills() };
    case 'timeline': return { title: 'The Strata — timeline', html: `<ol class="rows timeline">${[...timeline].reverse().map((m) => `<li><span class="year">${esc(m.year)}</span> <strong>${esc(m.title)}</strong><br><span class="muted">${esc(m.detail)}</span></li>`).join('')}</ol>` };
    case 'achievements': return { title: 'Benchmark Ridge — achievements', html: renderAchievements() };
    case 'research': return { title: 'Research Station', html: `<p class="lede">The deepest point of the Basin. Two research lines are under way; both are presented without results until there are results to show.</p>${research.map((r) => renderResearch(r, 3)).join('')}<p class="muted">Nothing here uses or exposes participant-level data.</p><p><button type="button" class="btn" data-world-view="interior">Take the lift down</button></p>` };
    case 'agents': return { title: 'Agent Operations — more agent systems', html: `<p class="lede">Modules OP-03 to OP-05 are provisioned but dark: capacity for agents not built yet. Other agent and LLM systems so far:</p><ul class="rows">${['smart-parking', 'financial-csi'].map((i) => projectRow(projectById(i)!)).join('')}</ul>` };
    case 'competitions': return { title: 'Proving Grounds — competitions', html: `<p class="lede">Work done under external judging.</p>${renderAchievements(['techformers', 'schneider-hmi', 'ideathon', 'hackathons'])}<h3 class="label">Competition and hackathon projects</h3><ul class="rows">${['vocalvitals', 'sev-guardian', 'amazon-ml-challenge', 'competitive-programming'].map((i) => projectRow(projectById(i)!)).join('')}</ul>` };
    case 'workshop': return { title: 'Workshop — hardware and fabrication', html: `<p class="lede">Hardware and embedded work. ROVER-03 on the stand is part of the world, not a project claim.</p><ul class="rows">${['driver-vigilance', 'smart-parking', 'maze-robot'].map((i) => projectRow(projectById(i)!)).join('')}</ul><h3 class="label">Activities</h3>${list(profile.leadership.filter((l) => l.startsWith('Hyperloop')))}` };
  }
}

export function renderSkills(focus?: string): string {
  return skills.map((g) => `<section class="skill-group${g.id === focus ? ' focus' : ''}" aria-labelledby="sk-${g.id}"><h3 id="sk-${g.id}">${esc(g.title)}</h3><p class="muted">${esc(g.note)}</p><ul class="rows">${g.skills.map((s) => `<li>${esc(s.name)}${s.usedIn.length ? ` — <span class="muted">used in ${s.usedIn.map((id) => { const p = projectById(id); return p ? `<a href="/work/${esc(id)}" data-open-project="${esc(id)}">${esc(p.title.split(' — ')[0])}</a>` : ''; }).join(', ')}</span>` : ''}</li>`).join('')}</ul></section>`).join('') + '<p class="muted">Groups follow the résumé; the river layout in the world is a metaphor, not a measured dependency graph.</p>';
}

export function renderAchievements(ids?: string[]): string {
  const items = ids ? achievements.filter((a) => ids.includes(a.id)) : achievements;
  return `<ul class="rows">${items.map((a) => `<li><strong>${esc(a.title)}</strong>${a.year ? ` · ${a.year}` : ''}<br><span class="muted">${esc(a.detail)}</span>${a.proof ? ` ${linkHtml(a.proof)}` : ''}</li>`).join('')}</ul><p class="muted">Source: résumé. Certificate and announcement links will be added as they are collected.</p>`;
}

/** Resolve an anchor outcome into a panel. Returns null for outcomes handled by the app shell (quick view, navigator). */
export function renderOutcome(o: AnchorOutcome, ctx: RenderCtx): { title: string; html: string; url?: string } | null {
  switch (o.kind) {
    case 'project': { const p = projectById(o.id); return p ? { title: p.title, html: renderProject(p, { headingLevel: 2 }).replace(/<h2[^>]*>.*?<\/h2>/, ''), url: `/work/${p.id}` } : null; }
    case 'research': { const r = researchById(o.id); return r ? { title: r.title, html: renderResearch(r, 3) } : null; }
    case 'page': { const pg = renderPage(o.id, ctx); return { ...pg, url: o.id === 'research' ? '/research' : undefined }; }
    case 'achievement': { const a = achievements.find((x) => x.id === o.id); return a ? { title: a.title, html: `<p class="eyebrow">Benchmark Ridge</p>${renderAchievements([a.id])}` } : null; }
    case 'empty-benchmark': return { title: `Benchmark ${o.marker}`, html: `<p class="lede">An empty socket on Benchmark Ridge.</p><p>Reserved for a mark not yet earned.</p>` };
    case 'milestone': { const m = timeline.find((x) => x.id === o.id); return m ? { title: `${m.id} · ${m.year} — ${m.title}`, html: `<p class="eyebrow">The Strata</p><p class="lede">${esc(m.detail)}</p>${renderPage('timeline', ctx).html}` } : null; }
    case 'skills': return { title: 'Watershed — skills', html: renderSkills(o.id) };
    case 'note': return { title: o.title, html: `<p class="lede">${esc(o.body)}</p>` };
    case 'quick-view': case 'navigator': return null;
  }
}
