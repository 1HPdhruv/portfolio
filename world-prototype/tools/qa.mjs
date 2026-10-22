// Functional QA: debug controls, console / network health, anchor grounding and the Agent Operations benches.
// usage: node tools/qa.mjs [--url http://127.0.0.1:5173/]   (needs the dev server running)
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
const args = process.argv.slice(2), url = args.includes('--url') ? args[args.indexOf('--url') + 1] : 'http://127.0.0.1:5173/';
const exe = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'].find((p) => p && existsSync(p));
const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 800 });
const errors = [], warnings = [], failed = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning' || m.type() === 'warn') warnings.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => failed.push(`${r.url()} ${r.failure()?.errorText}`));
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
await page.goto(url, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__basin?.ready, { timeout: 120000 });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const key = (code) => page.evaluate((code) => { window.dispatchEvent(new KeyboardEvent('keydown', { code })); window.dispatchEvent(new KeyboardEvent('keyup', { code })); }, code);
const frames = (n) => page.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const st = () => page.evaluate(() => { const b = window.__basin; return { mode: b.rig.mode, contour: b.terrain.uniforms.uMode.value, shot: document.body.classList.contains('shot'), pins: b.scene.children.some((o) => o.isGroup && o.children.length > 40 && o.visible && o.children[0]?.material?.depthTest === false) }; });
await frames(20);
let s0 = await st(); check('starts in follow mode', s0.mode === 'follow', s0.mode);
await key('KeyC'); s0 = await st(); check('C: contour/heightmap mode on', s0.contour === 1); await key('KeyC'); s0 = await st(); check('C: contour mode off', s0.contour === 0);
await key('KeyO'); s0 = await st(); check('O: overview mode', s0.mode === 'overview'); await key('KeyO'); s0 = await st(); check('O: back to follow', s0.mode === 'follow');
await key('KeyF'); s0 = await st(); check('F: free-fly mode', s0.mode === 'fly');
await page.evaluate(() => window.__basin.driver.keys.clear());
const flyMove = await page.evaluate(async () => { const b = window.__basin, p0 = b.camera.position.clone(); b.driver.keys.add('KeyW'); await new Promise((r) => setTimeout(r, 800)); b.driver.keys.delete('KeyW'); return b.camera.position.distanceTo(p0); });
check('F: free-fly camera moves with W', flyMove > 5, `${flyMove.toFixed(1)} m`); await key('KeyF'); s0 = await st(); check('F: back to follow', s0.mode === 'follow');
await key('KeyH'); s0 = await st(); check('H: hide UI (screenshot mode)', s0.shot === true); await key('KeyH'); s0 = await st(); check('H: UI restored', s0.shot === false);
await key('KeyP'); s0 = await st(); check('P: anchor pins shown', s0.pins === true); await key('KeyP');
// number keys teleport
for (const [code, id] of [['Digit5', 'agent-ops'], ['Digit3', 'agri-terraces'], ['Digit1', 'init']]) {
  await key(code); await frames(5);
  const d = await page.evaluate((id) => { const b = window.__basin, z = b.zonesList().find((q) => q.id === id); const t = z.tp ?? [z.x, z.z]; return Math.hypot(b.driver.x - t[0], b.driver.z - t[1]); }, id);
  check(`${code}: teleports to ${id}`, d < 2, `${d.toFixed(2)} m from target`);
}
// anchors: count, grounded, inside their zone
const an = await page.evaluate(() => { const b = window.__basin, zs = b.zonesList(); return b.anchors.map((a) => { const z = zs.find((q) => q.id === a.zoneId); return { id: a.siteId, zone: a.zoneId, zoneOk: !!z, dy: a.position[1] - b.hf.at(a.position[0], a.position[2]), dz: z ? Math.hypot(a.position[0] - z.x, a.position[2] - z.z) : 1e9 }; }); });
check('anchor count is 42', an.length === 42, String(an.length));
check('every anchor references an existing zone', an.every((a) => a.zoneOk));
check('every anchor sits on the terrain (|dy| < 0.05 m)', an.every((a) => Math.abs(a.dy) < 0.05), `max |dy| ${Math.max(...an.map((a) => Math.abs(a.dy))).toFixed(3)}`);
const far = an.filter((a) => a.zone !== 'watershed' && a.zone !== 'strata' && a.zone !== 'proving' && a.dz > 45);
check('site anchors lie within 45 m of their zone centre (linear zones excluded)', far.length === 0, far.map((a) => `${a.id} ${a.dz.toFixed(0)}m`).join(', '));
const ao = await page.evaluate(() => { const b = window.__basin; return b.anchors.filter((a) => a.zoneId === 'agent-ops').map((a) => ({ id: a.siteId, y: a.position[1] })); });
check('Agent Ops module anchors are on the upper bench (53.5 m)', ao.every((a) => Math.abs(a.y - 53.5) < 0.2), ao.map((a) => `${a.id}@${a.y.toFixed(2)}`).join(' '));
// Agent Ops: lower-bench drive into the retaining wall must be blocked, ramp/stair area reachable, no falling through
const wall = await page.evaluate(async () => {
  const b = window.__basin, d = b.driver, rot = -0.1, c = Math.cos(rot), s = Math.sin(rot);
  const toLocal = (x, z) => [(x - 148) * c - (z - 40) * s, (x - 148) * s + (z - 40) * c];
  const w = (lx, lz) => [148 + lx * c + lz * s, 40 - lx * s + lz * c];
  const [sx, sz] = w(-9, 1); d.teleport(sx, sz, Math.PI / 2 - 0.1); b.follow();
  let maxLx = -1e9, minClr = 1e9, maxClr = -1e9; d.keys.add('KeyW'); const t0 = performance.now();
  while (performance.now() - t0 < 3500) { await new Promise((r) => setTimeout(r, 50)); const [lx] = toLocal(d.x, d.z); maxLx = Math.max(maxLx, lx); const clr = b.driver.rover.root.position.y - b.hf.at(d.x, d.z); minClr = Math.min(minClr, clr); maxClr = Math.max(maxClr, clr); }
  d.keys.clear(); return { maxLx, minClr, maxClr };
});
check('Agent Ops: rover driving east on the lower bench is stopped by the retaining wall (local x < -2.75)', wall.maxLx < -2.75, `max local x ${wall.maxLx.toFixed(2)}`);
check('Agent Ops: rover body stays on the ground (clearance 0.2–0.6 m)', wall.minClr > 0.2 && wall.maxClr < 0.6, `${wall.minClr.toFixed(2)}–${wall.maxClr.toFixed(2)} m`);
await frames(10);
check('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
check('no failed or 4xx/5xx requests', failed.length === 0, failed.slice(0, 5).join(' | '));
console.log('console warnings:', JSON.stringify([...new Set(warnings)]));
const nFail = results.filter((r) => !r.ok).length;
console.log(`QA SUMMARY: ${results.length - nFail}/${results.length} passed`);
await browser.close();
process.exit(nFail ? 1 : 0);
