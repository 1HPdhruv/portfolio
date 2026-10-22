// World ⇄ application message protocol (postMessage between the portfolio page and the embedded world iframe).
// This file is the single source of truth; the application imports it directly.
//
// Rules (enforced by both sides):
//  - same origin only: messages are posted with targetOrigin = location.origin and accepted only when
//    event.origin === location.origin AND event.source is the expected window (parent / iframe contentWindow);
//  - every message carries `ns` and protocol version `v`; anything that fails the guards below is ignored;
//  - the world never sends portfolio content: only ids (zoneId / siteId) from src/zones.ts and src/layout.ts.

export const PROTOCOL_NS = 'dhruvas-world/basin';
export const PROTOCOL_VERSION = 1;

export interface AnchorRef { zoneId: string; siteId: string }
export interface ZoneSummary { id: string; name: string; num: number }

/** world → application */
export type WorldMessage =
  | { type: 'progress'; stage: string; frac: number }
  | { type: 'ready'; zones: ZoneSummary[]; anchors: (AnchorRef & { label: string })[]; timings: { heightfieldMs: number; sceneMs: number; worker: boolean } }
  | { type: 'error'; code: 'webgl-unavailable' | 'init-failed' | 'context-lost'; message: string }
  | { type: 'zone'; zoneId: string }
  | { type: 'proximity'; site: AnchorRef | null }
  | { type: 'interact'; site: AnchorRef }
  | { type: 'request'; action: 'quick-view' | 'navigator' | 'escape' }
  | { type: 'view'; mode: 'surface' | 'interior' };

/** application → world */
export type AppMessage =
  | { type: 'teleport'; zoneId: string }
  | { type: 'input'; enabled: boolean }
  | { type: 'pause'; paused: boolean }
  | { type: 'reduced-motion'; value: boolean }
  | { type: 'view'; mode: 'surface' | 'interior' };

export type Envelope<T> = T & { ns: typeof PROTOCOL_NS; v: typeof PROTOCOL_VERSION };

export function wrap<T extends WorldMessage | AppMessage>(m: T): Envelope<T> {
  return { ...m, ns: PROTOCOL_NS, v: PROTOCOL_VERSION };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;
const isStr = (x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length < 200;
const isAnchor = (x: unknown): x is AnchorRef => isObj(x) && isStr(x.zoneId) && isStr(x.siteId);
const hasEnvelope = (x: unknown): x is Record<string, unknown> => isObj(x) && x.ns === PROTOCOL_NS && x.v === PROTOCOL_VERSION && isStr(x.type);

export function isWorldMessage(x: unknown): x is Envelope<WorldMessage> {
  if (!hasEnvelope(x)) return false;
  switch (x.type) {
    case 'progress': return isStr(x.stage) && typeof x.frac === 'number' && x.frac >= 0 && x.frac <= 1;
    case 'ready': return Array.isArray(x.zones) && Array.isArray(x.anchors) && x.anchors.every(isAnchor) && isObj(x.timings);
    case 'error': return (x.code === 'webgl-unavailable' || x.code === 'init-failed' || x.code === 'context-lost') && typeof x.message === 'string';
    case 'zone': return isStr(x.zoneId);
    case 'proximity': return x.site === null || isAnchor(x.site);
    case 'interact': return isAnchor(x.site);
    case 'request': return x.action === 'quick-view' || x.action === 'navigator' || x.action === 'escape';
    case 'view': return x.mode === 'surface' || x.mode === 'interior';
    default: return false;
  }
}

export function isAppMessage(x: unknown): x is Envelope<AppMessage> {
  if (!hasEnvelope(x)) return false;
  switch (x.type) {
    case 'teleport': return isStr(x.zoneId);
    case 'input': return typeof x.enabled === 'boolean';
    case 'pause': return typeof x.paused === 'boolean';
    case 'reduced-motion': return typeof x.value === 'boolean';
    case 'view': return x.mode === 'surface' || x.mode === 'interior';
    default: return false;
  }
}
