// Lower-power rendering checks on SwiftShader (CPU-only WebGL, no GPU), 1280×720. Not a device test: it shows how
// the page behaves when rendering is far slower than on the development GPU.
//   A (production :4321) default visit → software renderer detected → map mode; Quick View responsive
//   B (production :4321) “Load the 3D world anyway” → the world runs (the visitor's choice); measured, not judged
//   C (QA build :4322, ?gpuProbe=0 hides the renderer name) → the frame-rate watchdog switches to the map
// usage: node e2e/lowpower.mjs [--base http://127.0.0.1:4321] [--qa http://127.0.0.1:4322]
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const BASE = arg('--base', 'http://127.0.0.1:4321'), QA = arg('--qa', 'http://127.0.0.1:4322');
const exe = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'].find((p) => p && existsSync(p));
const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'] });
// Vercel-protected previews: set VERCEL_AUTOMATION_BYPASS_SECRET (Protection Bypass for Automation) to send it on every request
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
if (BYPASS) { const newPage = browser.newPage.bind(browser); browser.newPage = async () => { const p = await newPage(); await p.setExtraHTTPHeaders({ 'x-vercel-protection-bypass': BYPASS, 'x-vercel-set-bypass-cookie': 'true' }); return p; }; }
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const page0 = async (url) => { const p = await browser.newPage(); await p.setViewport({ width: 1280, height: 720 }); const errors = []; p.on('pageerror', (e) => errors.push(e.message)); await p.goto(url, { waitUntil: 'domcontentloaded' }); return { p, errors }; };
const qvLatency = async (p) => { const t = Date.now(); await p.click('.bar [data-open="quick-view"]'); await p.waitForFunction(() => !document.getElementById('quick-view').hidden); const ms = Date.now() - t; await p.keyboard.press('Escape'); await sleep(200); return ms; };

{ // A
  const { p, errors } = await page0(BASE + '/'); await sleep(800);
  const renderer = await p.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2'); const d = gl?.getExtension('WEBGL_debug_renderer_info'); return gl ? gl.getParameter(d ? d.UNMASKED_RENDERER_WEBGL : gl.RENDERER) : 'none'; });
  const s = await p.evaluate(() => ({ state: document.getElementById('stage').dataset.state, reason: document.getElementById('fallback-reason').textContent, iframes: document.querySelectorAll('iframe').length, loadAnyway: !document.getElementById('load-anyway').hidden }));
  const ms = await qvLatency(p);
  await p.screenshot({ path: 'e2e/screenshots/10-lowpower-software-renderer-map-1280x720.png' });
  check('software renderer → map mode with an explanation; no world download; “load anyway” offered', s.state === 'map' && /without a graphics processor/.test(s.reason) && s.iframes === 0 && s.loadAnyway, `${renderer.slice(0, 60)}…`);
  check('software renderer: Quick View opens promptly (< 500 ms)', ms < 500, `${ms} ms`);
  // B
  const t0 = Date.now(); await p.click('#load-anyway');
  const st = await p.waitForFunction(() => ['ready', 'failed', 'map'].includes(document.getElementById('stage').dataset.state) && document.getElementById('stage').dataset.state !== 'map' || false, { timeout: 180000 }).then(() => p.$eval('#stage', (e) => e.dataset.state)).catch(() => 'timeout');
  const readyMs = Date.now() - t0;
  await sleep(4500); // longer than the watchdog window: an explicit choice must not be overridden
  const after = await p.$eval('#stage', (e) => e.dataset.state);
  const fps = after === 'ready' ? await p.evaluate(() => new Promise((r) => { let n = 0; const t = performance.now(); const tick = () => { n++; if (performance.now() - t < 5000) requestAnimationFrame(tick); else r(+(n / ((performance.now() - t) / 1000)).toFixed(1)); }; requestAnimationFrame(tick); })) : null;
  const ms2 = after === 'ready' ? await qvLatency(p) : null;
  check('“Load the 3D world anyway” is honoured on a slow renderer (not switched back)', st === 'ready' && after === 'ready', `ready after ${(readyMs / 1000).toFixed(1)} s; page ${fps} fps; Quick View click → ${ms2} ms`);
  check('software renderer path: no page errors', !errors.length, errors.slice(0, 2).join(' | '));
  await p.close();
}
{ // C
  const { p, errors } = await page0(QA + '/?gpuProbe=0');
  const st = await p.waitForFunction(() => window.__app?.state.worldReady, { timeout: 180000 }).then(() => 'ready').catch(() => 'timeout');
  const t = Date.now();
  const switched = await p.waitForFunction(() => document.getElementById('stage').dataset.state === 'map', { timeout: 30000 }).then(() => true).catch(() => false);
  await sleep(300); // the announcer is cleared, then set 30 ms later
  const s = await p.evaluate(() => ({ reason: document.getElementById('fallback-reason').textContent, iframes: document.querySelectorAll('iframe').length, announced: document.getElementById('announcer').textContent }));
  const ms = await qvLatency(p);
  await p.screenshot({ path: 'e2e/screenshots/11-lowpower-watchdog-switched-to-map-1280x720.png' });
  check('frame-rate watchdog: a world rendering < 7 fps is unmounted and the map shown, with an announcement', st === 'ready' && switched && s.iframes === 0 && /too slowly/.test(s.reason) && /too slowly/.test(s.announced), `switched ${((Date.now() - t) / 1000).toFixed(1)} s after ready; ${JSON.stringify(s)}`);
  check('after the switch, Quick View responds promptly (< 500 ms)', ms < 500, `${ms} ms`);
  check('watchdog path: no page errors', !errors.length, errors.slice(0, 2).join(' | '));
  await p.close();
}
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\nLOW-POWER SUMMARY: ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
