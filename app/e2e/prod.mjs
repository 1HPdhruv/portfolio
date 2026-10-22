// Checks against the real production build (dist/, `pnpm preview` on :4321), which has no test hooks:
// everything here is observed through the DOM, the URL, the accessibility announcer and screenshots.
// usage: node e2e/prod.mjs [--base http://127.0.0.1:4321]
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const args = process.argv.slice(2);
const BASE = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'http://127.0.0.1:4321';
const exe = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'].find((p) => p && existsSync(p));
const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(path, { noWebGL = false, w = 1440, h = 900 } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  if (noWebGL) await page.evaluateOnNewDocument(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...r) { return /webgl/i.test(String(t)) ? null : g.call(this, t, ...r); }; });
  const log = { errors: [], failed: [], warnings: [] };
  page.on('console', (m) => { if (m.type() === 'error') log.errors.push(m.text()); if (m.type() === 'warn' || m.type() === 'warning') log.warnings.push(m.text()); if (m.type() === 'log') log.warnings.push('log: ' + m.text()); });
  page.on('pageerror', (e) => log.errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => { if (r.failure()?.errorText !== 'net::ERR_ABORTED') log.failed.push(r.url()); });
  page.on('response', (r) => { if (r.status() >= 400) log.failed.push(`${r.status()} ${r.url()}`); });
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  return { page, log };
}
const ready = (page) => page.waitForFunction(() => document.getElementById('stage')?.dataset.state === 'ready', { timeout: 120000 });
const frameOf = async (page) => (await page.$('#stage iframe')).contentFrame();
const announced = (page) => page.$eval('#announcer', (e) => e.textContent);
const openDialog = (page) => page.evaluate(() => [...document.querySelectorAll('[role=dialog]')].find((d) => !d.hidden)?.id ?? null);

// 1. production build exposes no hooks or debug UI, and debug keys do nothing
{
  const { page, log } = await open('/');
  await ready(page);
  const f = await frameOf(page);
  const g = await page.evaluate(() => ({ app: typeof window.__app }));
  const w = await f.evaluate(() => ({ basin: typeof window.__basin, dbg: !!document.getElementById('dbg'), dbgButtons: document.querySelectorAll('#dbg button').length }));
  check('no window.__app in the production page', g.app === 'undefined');
  check('no window.__basin and no debug HUD in the production world', w.basin === 'undefined' && !w.dbg && w.dbgButtons === 0, JSON.stringify(w));
  // debug keys: digits teleported between zones, F/O toggled fly/overview cameras. In production none may change the view.
  await page.click('#stage iframe'); await sleep(800);
  const canvasShot = async () => (await (await f.$('canvas')).screenshot({ encoding: 'base64' }));
  const before = await announced(page);
  for (const code of ['Digit5', 'Digit9', 'KeyF', 'KeyO', 'KeyC', 'KeyP', 'KeyH']) { await f.evaluate((code) => { window.dispatchEvent(new KeyboardEvent('keydown', { code })); window.dispatchEvent(new KeyboardEvent('keyup', { code })); }, code); await sleep(120); }
  await sleep(1500);
  const after = await announced(page);
  check('debug keys (digits, F, O, C, P, H) do not teleport or change zone', before === after, `announcer: ${JSON.stringify(after.slice(0, 60))}`);
  // ?debug=1 on the page must not enable anything either
  const p2 = await open('/?debug=1'); await ready(p2.page);
  const src = await p2.page.$eval('#stage iframe', (i) => i.getAttribute('src'));
  const w2 = await (await frameOf(p2.page)).evaluate(() => ({ basin: typeof window.__basin, dbg: !!document.getElementById('dbg') }));
  check('?debug=1 is ignored in production (not forwarded, no HUD)', !src.includes('debug') && w2.basin === 'undefined' && !w2.dbg, src);
  await p2.page.close();

  // 2. core journeys through the public UI only
  await page.keyboard.press('q'); await sleep(250);
  check('Q opens Quick View', (await openDialog(page)) === 'quick-view');
  // keyboard: arrow keys scroll the open sheet (they drive the rover only when the world has focus)
  const st0 = await page.$eval('#quick-view', (e) => e.scrollTop);
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('PageDown'); await sleep(300);
  check('arrow keys and PageDown scroll Quick View (no conflict with world driving)', (await page.$eval('#quick-view', (e) => e.scrollTop)) > st0 + 100);
  // Chrome's accessibility tree while the modal is open: the dialog is exposed with its name; the inert background is not
  const ax = await page.accessibility.snapshot({ interestingOnly: true });
  const flat = []; (function walk(n) { flat.push(n); (n.children ?? []).forEach(walk); })(ax);
  const dlg = flat.find((n) => n.role === 'dialog');
  const bg = flat.filter((n) => (n.role === 'button' && /^Map/.test(n.name)) || n.role === 'Iframe' || n.role === 'iframe');
  check('AX tree with Quick View open: named modal dialog, background controls and world iframe absent', dlg?.name === 'Dhruva Mishra' && dlg?.modal === true && bg.length === 0, JSON.stringify({ dialog: dlg && { name: dlg.name, modal: dlg.modal }, background: bg.map((n) => n.role + ':' + n.name) }));
  await page.keyboard.press('Escape'); await sleep(250);
  const ax2 = await page.accessibility.snapshot({ interestingOnly: true });
  const flat2 = []; (function walk(n) { flat2.push(n); (n.children ?? []).forEach(walk); })(ax2);
  const ifr = flat2.find((n) => /iframe/i.test(n.role));
  check('AX tree after closing: world iframe exposed with its descriptive title', !!ifr && /Basin/.test(ifr.name ?? ''), JSON.stringify(ifr && { role: ifr.role, name: ifr.name?.slice(0, 50) }));
  await page.click('.bar [data-open="navigator"]'); await sleep(250);
  await page.click('[data-travel="bay"]'); await sleep(900);
  check('navigator Go → Diagnostics Bay, announced, dialog closed', /Travelled to Diagnostics Bay/.test(await announced(page)) && !(await openDialog(page)));
  // the bay's arrival point is beside the evDOCTOR anchor: drive a little if the cue is not already up
  // (real keyboard: puppeteer's key events go to the focused iframe, exactly as a visitor's would)
  let cue = await page.$eval('#cue', (e) => !e.hidden);
  if (!cue) { await page.keyboard.down('KeyW'); for (let i = 0; i < 40 && !cue; i++) { await sleep(150); cue = await page.$eval('#cue', (e) => !e.hidden); } await page.keyboard.up('KeyW'); await sleep(600); cue = await page.$eval('#cue', (e) => !e.hidden); }
  check('arriving at the bay shows the evDOCTOR cue', cue && /evDOCTOR/.test(await page.$eval('#cue-title', (e) => e.textContent)));
  await page.keyboard.press('KeyE'); await sleep(400);
  const pnl = await page.evaluate(() => ({ title: document.getElementById('panel-title').textContent, url: location.pathname, open: !document.getElementById('panel').hidden }));
  check('E (real keyboard, focus in the world) opens the evDOCTOR panel at /work/evdoctor', pnl.open && /evDOCTOR/.test(pnl.title) && pnl.url === '/work/evdoctor', JSON.stringify(pnl));
  await page.keyboard.press('Escape'); await sleep(300);
  check('Esc closes the panel; focus back in the world; URL /', (await page.evaluate(() => document.activeElement?.tagName)) === 'IFRAME' && (await page.evaluate(() => location.pathname)) === '/');
  await page.click('.bar [data-open="navigator"]'); await sleep(250);
  await page.click('#navigator [data-zone-open="research"]'); await sleep(300);
  await page.click('[data-world-view="interior"]'); await sleep(1200);
  check('research page → “Take the lift down” enters the interior (surface button shown)', !(await page.$eval('#surface-btn', (e) => e.hidden)) && !(await openDialog(page)));
  await page.click('#surface-btn'); await sleep(800);
  check('“Return to the surface” leaves the interior', await page.$eval('#surface-btn', (e) => e.hidden));
  check('production journey: no console errors or failed requests', !log.errors.length && !log.failed.length, [...log.errors, ...log.failed].slice(0, 3).join(' | '));
  const extra = log.warnings.filter((w) => !/THREE\.Clock|PCFSoftShadowMap/.test(w));
  check('production journey: no console output beyond the two known THREE deprecation warnings', extra.length === 0, extra.slice(0, 3).join(' | '));
  await page.close();
}

// 3. the bare world page in production: drivable scene, nothing else
{
  const { page, log } = await open('/world/basin');
  await page.waitForFunction(() => !document.getElementById('loading'), { timeout: 120000 });
  const w = await page.evaluate(() => ({ basin: typeof window.__basin, dbg: !!document.getElementById('dbg'), canvas: !!document.querySelector('canvas') }));
  check('/world/basin standalone in production: renders, no HUD, no hooks', w.canvas && !w.dbg && w.basin === 'undefined', JSON.stringify(w));
  check('/world/basin: no console errors', !log.errors.length, log.errors.slice(0, 2).join(' | '));
  await page.close();
}

// 4. fallbacks in the production build
{
  const { page, log } = await open('/', { noWebGL: true });
  await page.waitForFunction(() => document.getElementById('stage').dataset.state === 'failed', { timeout: 15000 });
  await page.click('#fallback [data-open="quick-view"]'); await sleep(200);
  check('no WebGL 2: fallback shown and Quick View still opens', (await openDialog(page)) === 'quick-view');
  check('no WebGL 2: no console errors', !log.errors.length, log.errors.slice(0, 2).join(' | '));
  await page.close();
  const m = await open('/?world=0');
  await sleep(500);
  check('?world=0 map mode: no world iframe, Quick View available', (await m.page.$$('iframe')).length === 0 && (await m.page.$eval('#stage', (e) => e.dataset.state)) === 'map');
  await m.page.close();
}

// 5. direct routes (refresh on every supported URL)
{
  const page = await browser.newPage(); await page.setCacheEnabled(false);
  const routes = ['/', '/research', '/work/evdoctor', '/work/agrisaarthi', '/work/maze-robot', '/robots.txt', '/sitemap.xml', '/favicon.svg', '/og.jpg', '/basin-map.webp', '/world/basin'];
  const bad = [];
  for (const r of routes) { const res = await page.goto(BASE + r); if (res.status() !== 200) bad.push(`${res.status()} ${r}`); }
  // (trailing-slash and .html variants redirect only on Vercel — `trailingSlash: false`, `cleanUrls` — so they are post-deploy checks)
  const nf = await page.goto(BASE + '/work/not-a-project');
  check(`direct load of ${routes.length} routes returns 200; unknown project → 404`, bad.length === 0 && nf.status() === 404, bad.join(', '));
  await page.close();
}

// 6. responsive sweep (emulated viewports: layout only; not a device test)
{
  const sizes = [[360, 740, true], [390, 844, true], [768, 1024, true], [1024, 768, false], [1440, 900, false]];
  const bad = [];
  for (const [w, h, mobile] of sizes) {
    const page = await browser.newPage(); await page.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile });
    for (const path of ['/', '/work/evdoctor', '/research']) {
      await page.goto(BASE + path + (path === '/' ? '?world=0' : ''), { waitUntil: 'domcontentloaded' }); await sleep(300);
      const o = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (o > 0) bad.push(`${w}px ${path} overflows by ${o}px`);
      if (path === '/') {
        await page.screenshot({ path: `e2e/screenshots/12-responsive-map-${w}x${h}.png` });
        await page.click('.bar [data-open="quick-view"]'); await sleep(400);
        const q = await page.evaluate(() => { const d = document.getElementById('quick-view'); return { o: document.documentElement.scrollWidth - innerWidth, inner: d.scrollWidth - d.clientWidth }; });
        if (q.o > 0 || q.inner > 0) bad.push(`${w}px Quick View overflows ${JSON.stringify(q)}`);
        const small = await page.evaluate(() => [...document.querySelectorAll('#quick-view a[href], #quick-view button')].filter((e) => { const r = e.getBoundingClientRect(); const inline = getComputedStyle(e).display === 'inline' && e.closest('p,li'); return !inline && r.width > 0 && (r.width < 24 || r.height < 24); }).length);
        if (small) bad.push(`${w}px Quick View has ${small} targets under 24px`);
        await page.screenshot({ path: `e2e/screenshots/12-responsive-quick-view-${w}x${h}.png` });
      }
    }
    await page.close();
  }
  check(`responsive sweep ${sizes.map((s) => s[0]).join('/')} px: no horizontal overflow, no Quick View targets < 24 px`, bad.length === 0, bad.join('; '));
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\nPROD SUMMARY: ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
