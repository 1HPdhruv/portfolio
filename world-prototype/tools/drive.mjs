// Navigation test: teleport to every zone, drive forward and turn, report movement / blockage.
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
const exe = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'].find(existsSync);
const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage(); await page.setViewport({ width: 960, height: 600 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__basin?.ready, { timeout: 120000 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const zones = await page.evaluate(() => [...document.querySelectorAll('#zones button')].length);
console.log('zones in teleport list:', zones);
const ids = ['init', 'field-office', 'agri-terraces', 'bay', 'agent-ops', 'proving', 'workshop', 'maze', 'watershed', 'strata', 'research', 'signal-tower', 'local-minimum'];
for (const id of ids) {
  const r = await page.evaluate(async (id) => {
    const b = window.__basin, d = b.driver; b.follow(); b.teleport(id);
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    await sleep(300);
    const p0 = { x: d.x, z: d.z, y: b.driver.rover.root.position.y };
    d.keys.add('KeyW'); await sleep(2500); d.keys.add('KeyA'); await sleep(900); d.keys.delete('KeyA'); await sleep(1200); d.keys.delete('KeyW');
    const moved = Math.hypot(d.x - p0.x, d.z - p0.z);
    const camAbove = b.camera.position.y - b.hf.at(b.camera.position.x, b.camera.position.z);
    return { id, from: [p0.x.toFixed(0), p0.z.toFixed(0)], elev: p0.y.toFixed(1), moved: moved.toFixed(1), surface: d.surface, camAboveGround: camAbove.toFixed(1) };
  }, id);
  console.log(JSON.stringify(r));
}
// long drive down the Main Descent with the road under the rover (scripted steering toward the next road sample)
const res = await page.evaluate(async () => {
  const b = window.__basin, d = b.driver; b.follow(); b.teleport('init');
  const road = b.hf.roads.find((r) => r.def.id === 'main').pts;
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  let idx = 0; const t0 = performance.now(); let offRoad = 0, samples = 0;
  d.keys.add('KeyW');
  while (performance.now() - t0 < 60000 && idx < road.length - 20) {
    // pick the road sample ~10 m ahead of the nearest one
    let best = idx, bd = 1e9; for (let i = idx; i < Math.min(road.length, idx + 200); i++) { const dd = Math.hypot(road[i].x - d.x, road[i].z - d.z); if (dd < bd) { bd = dd; best = i; } }
    idx = best; const tgt = road[Math.min(road.length - 1, idx + 20)];
    const want = Math.atan2(tgt.x - d.x, tgt.z - d.z); let err = want - d.heading; err = Math.atan2(Math.sin(err), Math.cos(err));
    d.keys.delete('KeyA'); d.keys.delete('KeyD'); if (err > 0.05) d.keys.add('KeyA'); else if (err < -0.05) d.keys.add('KeyD');
    samples++; if (d.surface !== 'road') offRoad++;
    await sleep(50);
  }
  d.keys.clear();
  return { seconds: ((performance.now() - t0) / 1000).toFixed(1), reachedSample: idx, of: road.length, end: [d.x.toFixed(0), d.z.toFixed(0)], elev: b.driver.rover.root.position.y.toFixed(1), offRoadPct: (100 * offRoad / samples).toFixed(0) };
});
console.log('MAIN DESCENT DRIVE', JSON.stringify(res));
await browser.close();
