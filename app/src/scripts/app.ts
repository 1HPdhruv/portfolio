// Application controller: owns content, dialogs, focus, history, announcements and the world bridge.
// The world (an iframe) only reports ids and events; it never receives or renders portfolio content.
import { isWorldMessage, wrap, type AppMessage, type WorldMessage } from '../../../world-prototype/src/bridge/protocol';
import { resolveAnchor } from '../content/mapping';
import { renderOutcome, projectById } from '../content/render';
import { zones } from '../content/zones';
import type { AnchorOutcome } from '../content/types';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const app = $('app'), stage = $('stage'), scrim = $('scrim'), announcer = $('announcer');
const ctx = { resumeAvailable: app.dataset.resume === '1' };
const params = new URLSearchParams(location.search);
const reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
// Build-time gate (mirrors the world's): test hooks exist on the dev server and in the `pnpm build:qa` output only.
const TEST_HOOKS = import.meta.env.DEV || import.meta.env.PUBLIC_TEST_HOOKS === '1';

// ------------------------------------------------------------------ world bridge
let frame: HTMLIFrameElement | null = null;
let worldTimings: unknown = null;
let worldReady = false, loadTimer = 0, nearSite: { zoneId: string; siteId: string } | null = null, lastZone = '', lastAnnounce = 0;
const zoneName = (id: string) => zones.find((z) => z.id === id)?.name ?? id;

function post(m: AppMessage) { if (frame?.contentWindow && worldReady) frame.contentWindow.postMessage(wrap(m), location.origin); }

// one listener for the page's lifetime; it only accepts messages from the *current* iframe at our own origin
window.addEventListener('message', (ev) => {
  if (!frame || ev.source !== frame.contentWindow || ev.origin !== location.origin || !isWorldMessage(ev.data)) return;
  onWorld(ev.data);
});

function onWorld(m: WorldMessage) {
  switch (m.type) {
    case 'progress':
      stage.style.setProperty('--p', String(m.frac));
      $('load-stage').textContent = `Surveying the Basin… ${m.stage === 'scene' ? 'placing structures' : m.stage} (${Math.round(m.frac * 100)}%)`;
      break;
    case 'ready':
      worldReady = true; clearTimeout(loadTimer);
      stage.dataset.state = 'ready'; stage.style.setProperty('--p', '1');
      $('world-help').hidden = false;
      document.documentElement.dataset.world = 'ready';
      worldTimings = m.timings;
      post({ type: 'reduced-motion', value: reducedMQ.matches });
      // nothing is posted before ready, so hand over the current state: a dialog opened during loading keeps the world paused
      if (openId) { post({ type: 'input', enabled: false }); post({ type: 'pause', paused: true }); }
      watchFrameRate();
      announce('The 3D world is ready. Click it to drive, or use the map to travel.');
      handleDeepLink();
      break;
    case 'error': fail(m.code, m.message); break;
    case 'zone':
      if (m.zoneId !== lastZone) { lastZone = m.zoneId; if (performance.now() - lastAnnounce > 1500) { lastAnnounce = performance.now(); announce(`Entered ${zoneName(m.zoneId)}`); } }
      break;
    case 'proximity': showCue(m.site); break;
    case 'interact': activateAnchor(m.site.zoneId, m.site.siteId, frame); break;
    case 'request':
      if (m.action === 'quick-view') openDialog('quick-view', frame);
      else if (m.action === 'navigator') openDialog('navigator', frame);
      break;
    case 'view': $('surface-btn').hidden = m.mode !== 'interior'; if (m.mode === 'interior') announce('Research Station, sub-level 1. Press Escape or use “Return to the surface”.'); break;
  }
}

function mountWorld() {
  unmountWorld();
  stage.dataset.state = 'loading'; stage.style.setProperty('--p', '0');
  $('fallback').hidden = true;
  frame = document.createElement('iframe');
  frame.title = 'The Basin — explorable 3D world. Drive with W A S D or the arrow keys; press E near a site to inspect it.';
  // clean URL served as-is by Vercel (see scripts/build-world.mjs); the dev server only knows the file name
  frame.src = `${import.meta.env.DEV ? '/world/basin.html' : '/world/basin'}?embed=1${import.meta.env.DEV && params.get('debug') === '1' ? '&debug=1' : ''}`;
  frame.setAttribute('allow', 'fullscreen');
  stage.prepend(frame);
  frame.addEventListener('load', () => { if (!frame?.contentWindow) fail('init-failed', 'The world page did not load.'); });
  const timeout = TEST_HOOKS ? Math.min(Math.max(Number(params.get('worldTimeout')) || 90_000, 2_000), 180_000) : 90_000;
  loadTimer = window.setTimeout(() => { if (!worldReady) fail('init-failed', 'The world took too long to start.'); }, timeout);
}

function unmountWorld() {
  clearTimeout(loadTimer);
  worldReady = false; nearSite = null; showCue(null);
  if (frame) { frame.src = 'about:blank'; frame.remove(); frame = null; } // removing the iframe releases its WebGL context
}

function fail(code: string, message: string) {
  unmountWorld();
  stage.dataset.state = 'failed';
  document.documentElement.dataset.world = 'failed';
  $('fallback-title').textContent = 'The Basin — map';
  $('fallback-reason').textContent = code === 'webgl-unavailable'
    ? 'The 3D world needs WebGL 2, which this browser or device does not provide.'
    : code === 'context-lost' ? 'The graphics context was lost while the world was running.' : `The 3D world could not start (${message}).`;
  $('retry').hidden = code === 'webgl-unavailable';
  $('load-anyway').hidden = true;
  $('fallback').hidden = false; $('world-help').hidden = true;
  announce('The 3D world is unavailable. The full portfolio is available from the map, the list, and Quick View.');
}

const MAP_REASON = {
  requested: 'The Basin is shown as a map. Every site below opens directly.',
  small: 'On small or touch screens the Basin opens as a map: the 3D world is driven with a keyboard. Every site below opens directly.',
  software: 'This browser is drawing graphics without a graphics processor, so the 3D world would run very slowly. The Basin opens as a map instead; every site below opens directly.',
  slow: 'The 3D world was running too slowly on this device, so the Basin switched to the map. Every site below opens directly.',
};
function mapMode(reason: keyof typeof MAP_REASON) {
  stage.dataset.state = 'map';
  document.documentElement.dataset.world = 'map';
  $('fallback-title').textContent = 'The Basin';
  $('fallback-reason').textContent = MAP_REASON[reason];
  $('retry').hidden = true; $('load-anyway').hidden = false;
  $('fallback').hidden = false; $('world-help').hidden = true;
}

// The embedded world shares this page's main thread, so a world that renders slowly also makes every dialog slow.
// After ready, sample the page's own frame interval; if the median stays above 150 ms (under ~7 fps) for ~3 s,
// unmount the world and fall back to the map. Skipped when the visitor explicitly asked for 3D.
let forced = params.get('world') === '1';
function watchFrameRate() {
  if (forced) return;
  const deltas: number[] = []; const start = performance.now(); let last = 0;
  const tick = (t: number) => {
    if (!worldReady || forced) return;
    if (document.visibilityState === 'visible' && !openId) { if (last) deltas.push(t - last); last = t; } else last = 0;
    if (performance.now() - start < 3000 || deltas.length < 3) { requestAnimationFrame(tick); return; }
    const median = deltas.sort((a, b) => a - b)[deltas.length >> 1];
    if (median > 150) { unmountWorld(); mapMode('slow'); announce(MAP_REASON.slow); }
  };
  requestAnimationFrame(tick);
}

// ------------------------------------------------------------------ dialogs, focus and history
type DialogId = 'quick-view' | 'navigator' | 'panel';
let openId: DialogId | null = null, opener: HTMLElement | null = null;
const background = () => [document.querySelector('.bar') as HTMLElement, stage];

// Every dialog entry we push records its depth above the base page, so an explicit close can return to the
// base in one step instead of stepping back through (and reopening) the dialogs it replaced.
let suppressPop = false;
function pushDialog(dialog: DialogId, url: string) { history.pushState({ dialog, url, depth: (history.state?.depth ?? 0) + 1 }, '', url); }

function openDialog(id: DialogId, from: Element | null = document.activeElement, push = true) {
  if (openId === id && id !== 'panel') { $(id).focus(); return; }
  if (openId && openId !== id) closeDialog(false, true);
  const el = $(id);
  if (!openId) opener = (from as HTMLElement) ?? null;
  openId = id;
  el.classList.add('open'); el.hidden = false; scrim.hidden = false;
  for (const b of background()) b.inert = true;
  $('cue').hidden = true; // the world's prompt would show at the dialog's edge
  post({ type: 'input', enabled: false }); post({ type: 'pause', paused: true });
  el.scrollTop = 0;
  (el.querySelector('h1, h2') as HTMLElement | null)?.setAttribute('tabindex', '-1');
  el.focus();
  if (push) {
    const url = id === 'quick-view' ? '/#quick-view' : id === 'navigator' ? '/#map' : panelUrl ?? '/';
    pushDialog(id, url);
  }
}

function closeDialog(viaHistory = false, replacing = false) {
  if (!openId) return;
  const el = $(openId);
  el.classList.remove('open'); el.hidden = true;
  openId = null;
  if (replacing) return;
  panelUrl = null;
  scrim.hidden = true;
  for (const b of background()) b.inert = false;
  showCue(nearSite);
  post({ type: 'pause', paused: false }); post({ type: 'input', enabled: true });
  const depth = history.state?.depth ?? 0;
  if (!viaHistory && depth > 0) { suppressPop = true; history.go(-depth); }
  else if (!viaHistory && (location.hash || location.pathname !== '/')) history.replaceState(null, '', '/' + location.search);
  const o = opener; opener = null;
  if (o && document.contains(o)) { o.focus(); if (o === frame) frame?.contentWindow?.focus(); }
}

// focus trap + Escape
document.addEventListener('keydown', (e) => {
  if (openId) {
    if (e.key === 'Escape') { e.preventDefault(); closeDialog(); return; }
    if (e.key === 'Tab') {
      const el = $(openId);
      const f = [...el.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    return;
  }
  const t = e.target as HTMLElement;
  if (e.metaKey || e.ctrlKey || e.altKey || t.closest('input, textarea, select')) return;
  if (e.key === 'q' || e.key === 'Q') { e.preventDefault(); openDialog('quick-view'); }
  else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); openDialog('navigator'); }
});

window.addEventListener('popstate', () => { if (suppressPop) { suppressPop = false; return; } syncFromLocation(); });

let panelUrl: string | null = null;
// Panel content comes from the same renderer as Quick View; prefix its ids so the page never has duplicates
// and aria-labelledby inside the panel points at the panel's own headings.
const scopeIds = (html: string) => html.replace(/\b(id|aria-labelledby|aria-describedby)="([^"]+)"/g, (_, a: string, v: string) => `${a}="${v.split(' ').map((x) => 'panel-' + x).join(' ')}"`);
function openPanel(o: AnchorOutcome, kicker: string, from: Element | null, push = true) {
  const r = renderOutcome(o, ctx);
  if (!r) return;
  $('panel-kicker').textContent = kicker;
  $('panel-title').textContent = r.title;
  $('panel-body').innerHTML = scopeIds(r.html);
  panelUrl = r.url ?? null;
  if (openId === 'panel') { // replace content in place
    if (push && panelUrl) pushDialog('panel', panelUrl);
    $('panel').scrollTop = 0; $('panel').focus();
  } else openDialog('panel', from, push && !!panelUrl);
  if (push && !panelUrl && !history.state?.dialog) pushDialog('panel', location.pathname + location.search);
  announce(`Opened ${r.title}`);
}

function handleOutcome(o: AnchorOutcome, kicker: string, from: Element | null) {
  if (o.kind === 'quick-view') openDialog('quick-view', from);
  else if (o.kind === 'navigator') openDialog('navigator', from);
  else openPanel(o, kicker, from);
}

function activateAnchor(zoneId: string, siteId: string, from: Element | null) {
  const o = resolveAnchor(zoneId, siteId);
  if (!o) { announce('Nothing is filed at this marker.'); return; }
  handleOutcome(o, zoneName(zoneId), from);
}

function syncFromLocation() {
  const path = location.pathname.replace(/\/$/, '');
  const m = /^\/work\/([a-z0-9-]+)$/.exec(path);
  if (m && projectById(m[1])) { openPanel({ kind: 'project', id: m[1] }, 'Project', null, false); return; }
  if (path === '/research') { openPanel({ kind: 'page', id: 'research' }, 'Research Station', null, false); return; }
  if (location.hash === '#quick-view') { if (openId !== 'quick-view') openDialog('quick-view', null, false); return; }
  if (location.hash === '#map') { if (openId !== 'navigator') openDialog('navigator', null, false); return; }
  if (openId) closeDialog(true);
}

// ------------------------------------------------------------------ world UI: cue, travel, deep links
function cueTitle(o: AnchorOutcome | null): string {
  if (!o) return 'Marker';
  if (o.kind === 'quick-view') return 'Quick view kiosk';
  if (o.kind === 'navigator') return 'Survey stake — fast travel';
  return renderOutcome(o, ctx)?.title ?? 'Marker';
}
function showCue(site: { zoneId: string; siteId: string } | null) {
  nearSite = site;
  const cue = $('cue');
  if (!site) { cue.hidden = true; return; }
  $('cue-where').textContent = zoneName(site.zoneId);
  $('cue-title').textContent = cueTitle(resolveAnchor(site.zoneId, site.siteId));
  cue.hidden = !!openId;
}
$('cue-btn').addEventListener('click', () => { if (nearSite) activateAnchor(nearSite.zoneId, nearSite.siteId, frame); });
$('surface-btn').addEventListener('click', () => { post({ type: 'view', mode: 'surface' }); frame?.focus(); });

function travel(zoneId: string, from: Element | null) {
  const z = zones.find((q) => q.id === zoneId); if (!z) return;
  if (worldReady && frame) {
    closeDialog();
    post({ type: 'teleport', zoneId });
    frame.focus(); frame.contentWindow?.focus();
    announce(`Travelled to ${z.name}. ${z.blurb}`);
  } else handleOutcome(z.primary, z.name, from);
}
function readZone(zoneId: string, from: Element | null) { const z = zones.find((q) => q.id === zoneId); if (z) handleOutcome(z.primary, z.name, from); }

function handleDeepLink() {
  const site = params.get('site'); if (!site) return;
  const [zoneId, siteId] = site.split('/');
  if (!zones.some((z) => z.id === zoneId)) return;
  if (worldReady) post({ type: 'teleport', zoneId });
  if (siteId) activateAnchor(zoneId, siteId, null); else if (!worldReady) readZone(zoneId, null);
}

// delegated clicks: openers, travel, content links inside panels
document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-open], [data-close], [data-travel], [data-zone-open], [data-zone], [data-open-project], [data-goto-zone], [data-world-view]');
  if (!t) return;
  if (t.dataset.open) { e.preventDefault(); openDialog(t.dataset.open as DialogId, t); }
  else if (t.hasAttribute('data-close')) { e.preventDefault(); closeDialog(); }
  else if (t.dataset.travel) { e.preventDefault(); travel(t.dataset.travel, t); }
  else if (t.dataset.zoneOpen) { e.preventDefault(); readZone(t.dataset.zoneOpen, t); }
  else if (t.dataset.zone) { e.preventDefault(); (worldReady ? travel : readZone)(t.dataset.zone, t); }
  else if (t.dataset.openProject) { e.preventDefault(); openPanel({ kind: 'project', id: t.dataset.openProject }, 'Project', openId === 'panel' ? opener : t); }
  else if (t.dataset.gotoZone) { e.preventDefault(); travel(t.dataset.gotoZone, t); }
  else if (t.dataset.worldView === 'interior') { e.preventDefault(); if (worldReady) { closeDialog(); post({ type: 'view', mode: 'interior' }); frame?.focus(); } else announce('The lift needs the 3D world, which is not running.'); }
});
scrim.addEventListener('click', () => closeDialog());
$('retry').addEventListener('click', () => mountWorld());
$('load-anyway').addEventListener('click', () => { forced = true; mountWorld(); });
$('use-map').addEventListener('click', () => { forced = false; unmountWorld(); mapMode('requested'); $('fallback-title').focus(); });
reducedMQ.addEventListener('change', () => post({ type: 'reduced-motion', value: reducedMQ.matches }));

// Records the time so the per-frame zone messages cannot overwrite a richer announcement (travel, opened content) at once.
function announce(msg: string) { lastAnnounce = performance.now(); announcer.textContent = ''; window.setTimeout(() => (announcer.textContent = msg), 30); }

// ------------------------------------------------------------------ start
for (const id of ['quick-view', 'navigator', 'panel'] as const) $(id).hidden = true;
// WebGL 2 probe; also spots CPU-only renderers (SwiftShader, llvmpipe, Microsoft Basic Render…), where the world
// runs at about one frame per second and would block the page.
const gl2 = (() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl2'); if (!gl) return { ok: false, software: false };
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { ok: true, software: /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name) && !(TEST_HOOKS && params.get('gpuProbe') === '0') };
  } catch { return { ok: false, software: false }; }
})();
const smallOrTouch = matchMedia('(max-width: 720px), (pointer: coarse) and (hover: none)').matches;
if (params.get('world') === '0') mapMode('requested');
else if (!gl2.ok) fail('webgl-unavailable', 'WebGL 2 unavailable');
else if (forced) mountWorld();
else if (gl2.software) mapMode('software');
else if (smallOrTouch) mapMode('small');
else mountWorld();
syncFromLocation();
if (!worldReady && params.get('site')) handleDeepLink();

// test hook (no content, no secrets); compiled out of the production build
if (TEST_HOOKS) (window as unknown as { __app: object }).__app = { get state() { return { openId, worldReady, mode: stage.dataset.state, nearSite, worldTimings, iframes: document.querySelectorAll('#stage iframe').length }; }, mountWorld, unmountWorld };
