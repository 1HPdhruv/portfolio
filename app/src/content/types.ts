// Typed content model for Dhruva's World. One authoritative source: ./data.ts.
// Every claim carries a `source` so reviewers can trace it; anything not yet evidenced is flagged `needsEvidence`.

/** Where a fact came from. */
export type Source =
  | { kind: 'resume'; note?: string }            // Dhruva's résumé (Resume.pdf, 2 pages, supplied by the owner)
  | { kind: 'repo'; url: string; note?: string }  // public GitHub repository README / metadata
  | { kind: 'owner'; note: string }               // stated by the owner in the project brief, not independently evidenced
  | { kind: 'world'; note: string };              // describes the 3D world itself

/**
 * prototype   — working software exists (repository and/or demo), not a production product
 * in-progress — actively being built; parts described may not exist yet
 * research    — an ongoing research line; no published results
 * planned     — an intention only
 */
export type Status = 'prototype' | 'in-progress' | 'research' | 'planned';

export type LinkKind = 'repo' | 'demo' | 'report' | 'email' | 'profile' | 'resume' | 'site';
export interface Link { kind: LinkKind; label: string; href: string; /** verified: responded at last check; unverified: could not be checked automatically */ check: 'ok' | 'unverified'; checkedOn?: string; }

export type Domain = 'applied-ml' | 'vision' | 'agents' | 'llm' | 'systems' | 'iot' | 'security' | 'research' | 'competition';

export interface Project {
  id: string;            // stable slug, also the /work/<id> URL
  title: string;
  summary: string;       // one line, outcome-first
  description: string[]; // paragraphs
  status: Status;
  statusNote?: string;
  year?: number;
  domains: Domain[];
  tech: string[];        // only technologies named in the repo or résumé
  highlights: string[];  // verifiable facts only
  links: Link[];
  sources: Source[];
  needsEvidence?: string; // what is missing before this can be presented as fact
}

export interface ResearchLine {
  id: string;
  title: string;
  question: string;
  stage: 'ongoing';
  description: string[];
  boundaries: string[]; // what this page does NOT claim
  sources: Source[];
}

export interface SkillGroup { id: string; title: string; note: string; skills: { name: string; usedIn: string[] }[]; sources: Source[] }
export interface Education { id: string; title: string; institution: string; period: string; detail?: string; sources: Source[] }
export interface Achievement { id: string; title: string; year?: number; detail: string; proof: Link | null; sources: Source[] }
export interface Milestone { id: string; year: string; title: string; detail: string; sources: Source[] }

export interface Profile {
  name: string;
  role: string;
  location: string;
  intro: string[];
  focus: string[];
  languages: string[];
  leadership: string[];
  links: Link[];
  resume: { href: string; note: string };
  sources: Source[];
}

/** What activating a physical anchor does. Every anchor maps to exactly one outcome. */
export type AnchorOutcome =
  | { kind: 'project'; id: string }
  | { kind: 'research'; id: string }
  | { kind: 'page'; id: PageId }
  | { kind: 'achievement'; id: string }
  | { kind: 'empty-benchmark'; marker: string }
  | { kind: 'milestone'; id: string }
  | { kind: 'skills'; id: string }
  | { kind: 'quick-view' }
  | { kind: 'navigator' }
  | { kind: 'note'; title: string; body: string };

export type PageId = 'profile' | 'contact' | 'github' | 'resume' | 'skills' | 'timeline' | 'achievements' | 'research' | 'agents' | 'competitions' | 'workshop';

export interface AnchorMapping { zoneId: string; siteId: string; outcome: AnchorOutcome }
