// Screenshot harness: drives the running dev server in headless Brave/Chrome via puppeteer-core.
// usage: node tools/shots.mjs [--out dir] [--only name1,name2] [--json '[{"name":..}]'] [--size 1600x1000]
import puppeteer from 'puppeteer-core';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const out = arg('--out', join(here, '..', 'screenshots'));
const only = arg('--only', '')?.split(',').filter(Boolean);
const [W, H] = arg('--size', '1600x1000').split('x').map(Number);
let shots = arg('--json') ? JSON.parse(arg('--json')) : JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
if (only?.length) shots = shots.filter((s) => only.includes(s.name));
mkdirSync(out, { recursive: true });

const exe = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'].find((p) => p && existsSync(p));
const browser = await puppeteer.launch({
  executablePath: exe, headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', `--window-size=${W},${H}`],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
page.on('console', (m) => { const t = m.text(); if (!/Download the React DevTools|\[vite\]/.test(t)) console.log('[page]', m.type(), t); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(arg('--url', 'http://127.0.0.1:5173/'), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__basin?.ready, { timeout: 120000 });
const gpu = await page.evaluate(() => { const gl = window.__basin.renderer.getContext(); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
console.log('GPU:', gpu, '| heightfield ms:', await page.evaluate(() => window.__basin.tHF.toFixed(0)));
await page.evaluate(() => document.body.classList.add('shot'));
const frames = (n) => page.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
await frames(30);
for (const s of shots) {
  await page.evaluate((s) => {
    const b = window.__basin;
    if (s.eval) (0, eval)(s.eval);
    if (s.contour !== undefined) b.terrain.uniforms.uMode.value = s.contour ? 1 : 0;
    if (s.rover) b.placeRover(...s.rover);
    if (s.p && s.rel) { s.p = [s.p[0], s.p[1] + b.hf.at(s.p[0], s.p[2]), s.p[2]]; s.l = [s.l[0], s.l[1] + b.hf.at(s.l[0], s.l[2]), s.l[2]]; }
    if (s.p) b.setView(s.p, s.l, s.fov ?? 50);
    else { b.follow(); if (s.yaw !== undefined) b.rig.yaw = s.yaw; if (s.pitch !== undefined) b.rig.pitch = s.pitch; if (s.dist !== undefined) b.rig.dist = s.dist; if (s.overview) b.rig.mode = 'overview'; b.rig.snap(); }
  }, s);
  await frames(s.frames ?? 45);
  await page.evaluate(() => window.__basin.stats());
  await frames(40);
  const st = await page.evaluate(() => window.__basin.stats());
  const bn = await page.evaluate(() => window.__basin.bench(24));
  st.bench = bn;
  await page.screenshot({ path: join(out, `${s.name}.png`) });
  console.log(`${s.name.padEnd(28)} calls ${String(st.calls).padStart(4)} tris ${String((st.tris / 1000).toFixed(0)).padStart(5)}k frame ${st.bench.median} ms (p90 ${st.bench.p90})${args.includes('--cpu') ? ' cpu ' + JSON.stringify(st.cpu) : ''}`);
}
// perf sample: drive the rover in follow mode for a few seconds
if (args.includes('--perf')) {
  await page.evaluate(() => { const b = window.__basin; b.follow(); b.teleport('init'); b.driver.keys.add('KeyW'); });
  await frames(240);
  const st = await page.evaluate(() => window.__basin.stats());
  console.log('PERF follow-drive:', JSON.stringify(st));
}
await browser.close();
