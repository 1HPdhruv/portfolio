// Real-browser integration tests against the production build.
// usage: pnpm build && pnpm preview (port 4321) in another shell, then: node e2e/e2e.mjs [--base http://127.0.0.1:4321] [--shots dir]
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const BASE = arg('--base', 'http://127.0.0.1:4321');
const SHOTS = arg('--shots', join(dirname(fileURLToPath(import.meta.url)), 'screenshots'));
mkdirSync(SHOTS, { recursive: true });
const exe = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'].find((p) => p && existsSync(p));
const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const IGNORED_WARN = /THREE\.Clock|PCFSoftShadowMap/;

async function open(path = '/', { w = 1440, h = 900, mobile = false, reduced = false, noWebGL = false, block = null } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  if (noWebGL) await page.evaluateOnNewDocument(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...r) { return /webgl/i.test(String(t)) ? null : g.call(this, t, ...r); }; });
  if (block) { await page.setRequestInterception(true); page.on('request', (r) => (block.test(r.url()) ? r.abort() : r.continue())); }
  const log = { errors: [], failed: [] };
  page.on('console', (m) => { if (m.type() === 'error' && !(/status of 404/.test(m.text()) && /no-such-page/.test(m.location()?.url ?? ''))) log.errors.push(m.text()); });
  page.on('pageerror', (e) => log.errors.push('pageerror: ' + e.message));
  // net::ERR_ABORTED = a request cancelled by tearing the iframe down mid-load, which is the behaviour under test
  page.on('requestfailed', (r) => { if (!r.url().startsWith('about:') && !(block && block.test(r.url())) && r.failure()?.errorText !== 'net::ERR_ABORTED') log.failed.push(`${r.failure()?.errorText} ${r.url()}`); });
  page.on('response', (r) => { if (r.status() >= 400 && !/\/resume\.pdf$|\/no-such-page$/.test(r.url())) log.failed.push(`${r.status()} ${r.url()}`); });
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  return { page, log };
}
const state = (page) => page.evaluate(() => window.__app.state);
const waitWorld = (page, t = 120000) => page.waitForFunction(() => window.__app?.state.worldReady, { timeout: t });
const worldFrame = async (page) => (await page.$('#stage iframe')).contentFrame();
const active = (page) => page.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.tagName.toLowerCase() + (a.className ? '.' + String(a.className).split(' ')[0] : '')) : null; });
const shot = (page, name) => page.screenshot({ path: join(SHOTS, name) });
const keyInFrame = (f, code) => f.evaluate((code) => { window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code === 'KeyE' ? 'e' : code })); window.dispatchEvent(new KeyboardEvent('keyup', { code })); }, code);

// ---------------------------------------------------------------- 1. desktop: world loads, Quick View available before and after
{
  const { page, log } = await open('/');
  const early = await page.evaluate(() => ({ qvBtn: !!document.querySelector('.bar [data-open="quick-view"]'), qvContent: !!document.querySelector('#quick-view #project-evdoctor'), h1: document.querySelector('#quick-view h1')?.textContent }));
  check('Quick View content is in the DOM before the world loads', early.qvBtn && early.qvContent && early.h1 === 'Dhruva Mishra');
  // Quick View works while the world is still loading
  await page.click('.bar [data-open="quick-view"]');
  let s = await state(page);
  check('Quick View opens while the world is loading', s.openId === 'quick-view', `world ready: ${s.worldReady}`);
  await page.keyboard.press('Escape');
  await waitWorld(page);
  s = await state(page);
  check('world becomes ready inside the iframe (heightfield in a worker)', s.worldReady && s.worldTimings?.worker === true, JSON.stringify(s.worldTimings));
  await sleep(1500); await shot(page, '01-initial-desktop-1440x900.png');

  // keyboard: Q opens Quick View from the page, focus moves in, Tab is trapped, Esc closes and restores focus
  await page.click('.brand', { delay: 10 }).catch(() => {});
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await waitWorld(page); await sleep(500);
  await page.focus('.bar [data-open="quick-view"]');
  await page.keyboard.press('Enter');
  s = await state(page);
  const dlg = await page.evaluate(() => { const d = document.getElementById('quick-view'); return { role: d.getAttribute('role'), modal: d.getAttribute('aria-modal'), labelled: !!document.getElementById(d.getAttribute('aria-labelledby'))?.textContent, focusInside: d.contains(document.activeElement), bgInert: document.querySelector('.bar').inert && document.getElementById('stage').inert, url: location.hash }; });
  check('Quick View dialog semantics (role=dialog, aria-modal, labelled heading)', dlg.role === 'dialog' && dlg.modal === 'true' && dlg.labelled);
  check('focus moves into Quick View; background is inert', dlg.focusInside && dlg.bgInert);
  check('Quick View has a URL (#quick-view)', dlg.url === '#quick-view');
  await sleep(500); await shot(page, '02-quick-view-1440x900.png');
  let trapped = true; for (let i = 0; i < 80; i++) { await page.keyboard.press('Tab'); const inside = await page.evaluate(() => document.getElementById('quick-view').contains(document.activeElement)); if (!inside) { trapped = false; break; } }
  check('Tab focus stays inside the open dialog (80 presses)', trapped);
  await page.keyboard.press('Escape'); await sleep(200);
  check('Escape closes Quick View and returns focus to the opener', (await state(page)).openId === null && (await active(page)) === 'button.primary', await active(page));
  check('closing restores the URL', await page.evaluate(() => location.hash === '' && location.pathname === '/'));

  // world input is disabled while a dialog is open, and restored afterwards
  const f = await worldFrame(page);
  await page.keyboard.press('q'); await sleep(150);
  await keyInFrame(f, 'KeyW').catch(() => {});
  const blocked = await f.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })); return window.__basin.driver.keys.has('KeyW'); });
  await page.keyboard.press('Escape'); await sleep(150);
  const allowed = await f.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })); const k = window.__basin.driver.keys.has('KeyW'); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })); return k; });
  check('driving keys are ignored while a dialog is open, accepted after closing', blocked === false && allowed === true);

  // physical interaction: put the rover at the evDOCTOR anchor, press E in the world
  await f.evaluate(() => { const b = window.__basin, a = b.anchors.find((x) => x.siteId === 'evdoctor'); b.placeRover(a.position[0] - 1, a.position[2], 0); });
  await page.waitForFunction(() => window.__app.state.nearSite?.siteId === 'evdoctor', { timeout: 10000 }).catch(() => {});
  // baseline after arrival: the first frame after placeRover resolves the rover out of the anchor's collider
  const before = await f.evaluate(() => ({ x: window.__basin.driver.x, z: window.__basin.driver.z }));
  const cue = await page.evaluate(() => ({ hidden: document.getElementById('cue').hidden, title: document.getElementById('cue-title').textContent }));
  check('approaching an anchor shows a cue with the content title', !cue.hidden && /evDOCTOR/.test(cue.title), cue.title);
  await f.focus('canvas').catch(() => {}); await keyInFrame(f, 'KeyE'); await sleep(300);
  const panel = await page.evaluate(() => ({ open: window.__app.state.openId, title: document.getElementById('panel-title').textContent, url: location.pathname, focusInside: document.getElementById('panel').contains(document.activeElement) }));
  check('pressing E at the anchor opens the evDOCTOR panel', panel.open === 'panel' && /evDOCTOR/.test(panel.title), panel.title);
  check('the panel has its project URL (/work/evdoctor) and focus', panel.url === '/work/evdoctor' && panel.focusInside);
  await shot(page, '03-project-panel-evdoctor-1440x900.png');
  await page.keyboard.press('Escape'); await sleep(300);
  const after = await f.evaluate(() => ({ x: window.__basin.driver.x, z: window.__basin.driver.z }));
  const drift = Math.hypot(after.x - before.x, after.z - before.z);
  check('closing the panel returns to the world without moving the rover', drift < 0.05 && (await page.evaluate(() => location.pathname)) === '/', `drift ${drift.toFixed(3)} m, url ${await page.evaluate(() => location.pathname)}`);
  check('focus returns to the world after a world-opened panel', (await active(page)) === 'iframe', await active(page));

  // location navigator + fast travel
  await page.keyboard.press('m').catch(() => {}); await page.evaluate(() => document.querySelector('.bar [data-open="navigator"]').click()); await sleep(200);
  await shot(page, '05-location-navigator-1440x900.png');
  const goCount = await page.$$eval('[data-travel]', (b) => b.length);
  check('navigator lists all 13 zones with Go buttons', goCount === 13, String(goCount));
  await page.click('[data-travel="research"]'); await sleep(400);
  const tp = await f.evaluate(() => ({ x: window.__basin.driver.x, z: window.__basin.driver.z }));
  check('Go travels to the Research Station and closes the navigator', Math.hypot(tp.x - 14, tp.z - 258) < 1 && (await state(page)).openId === null, `${tp.x.toFixed(1)}, ${tp.z.toFixed(1)}`);

  // research + lift into the interior, culling, and back
  await page.evaluate(() => document.querySelector('[data-zone-open="research"]').click()); await sleep(300);
  check('research page opens from the navigator list', /Research Station/.test(await page.$eval('#panel-title', (e) => e.textContent)));
  await shot(page, '04-research-station-panel-1440x900.png');
  await page.click('[data-world-view="interior"]'); await sleep(1200);
  const inside = await f.evaluate(() => ({ ug: window.__basin.isUnderground(), ...window.__basin.bench(6) }));
  check('“Take the lift down” shows the interior with the surface culled', inside.ug && inside.tris < 100000, `${inside.calls} calls, ${(inside.tris / 1000).toFixed(0)}k tris`);
  check('a “Return to the surface” control is offered', !(await page.$eval('#surface-btn', (e) => e.hidden)));
  await shot(page, '08-underground-interior-1440x900.png');
  await keyInFrame(f, 'Escape'); await sleep(600);
  check('Escape in the interior returns to the surface', !(await f.evaluate(() => window.__basin.isUnderground())) && (await page.$eval('#surface-btn', (e) => e.hidden)));

  // history: open a project from Quick View, back closes it, forward reopens it
  await page.evaluate(() => document.querySelector('.bar [data-open="quick-view"]').click()); await sleep(150);
  await page.click('#quick-view a[data-open-project="vocalvitals"]'); await sleep(200);
  const p1 = await page.evaluate(() => ({ url: location.pathname, open: window.__app.state.openId }));
  await page.goBack(); await sleep(300);
  const p2 = await page.evaluate(() => ({ url: location.pathname + location.hash, open: window.__app.state.openId }));
  await page.goForward(); await sleep(300);
  const p3 = await page.evaluate(() => ({ url: location.pathname, open: window.__app.state.openId, title: document.getElementById('panel-title').textContent }));
  check('history: project link pushes /work/<id>; Back returns; Forward reopens', p1.url === '/work/vocalvitals' && p1.open === 'panel' && p2.url === '/#quick-view' && p2.open === 'quick-view' && p3.url === '/work/vocalvitals' && /VocalVitals/.test(p3.title), JSON.stringify([p1, p2, p3]));
  await page.keyboard.press('Escape'); await sleep(200);

  // repeated teardown / init: never more than one iframe, world ready again
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__app.mountWorld()); await sleep(200); }
  await waitWorld(page);
  check('repeated init/teardown leaves exactly one world iframe and a ready world', (await state(page)).iframes === 1 && (await state(page)).worldReady);
  check('desktop journey: no console errors, no failed requests', log.errors.length === 0 && log.failed.length === 0, [...log.errors, ...log.failed].slice(0, 4).join(' | '));
  await page.close();
}

// ---------------------------------------------------------------- 2. direct URLs and deep links
{
  const { page, log } = await open('/work/evdoctor');
  const h1 = await page.$eval('main h1', (e) => e.textContent);
  check('direct /work/evdoctor serves a static page with an h1', /evDOCTOR/.test(h1), h1);
  const links = await page.$$eval('main a[href^="https://"]', (a) => a.map((x) => x.href));
  check('the static project page carries its real links', links.includes('https://github.com/1HPdhruv/evDOCTOR') && links.includes('https://ev-troubleshooter.netlify.app/'), links.join(' '));
  await page.goto(BASE + '/research', { waitUntil: 'domcontentloaded' });
  check('direct /research serves the research page', /Research/.test(await page.$eval('main h1', (e) => e.textContent)));
  await page.goto(BASE + '/#quick-view', { waitUntil: 'domcontentloaded' }); await sleep(300);
  check('direct /#quick-view opens Quick View on load', (await state(page)).openId === 'quick-view');
  await page.goto(BASE + '/?site=agri-terraces/agrisaarthi', { waitUntil: 'domcontentloaded' }); await waitWorld(page); await sleep(800);
  const dl = await page.evaluate(() => ({ open: window.__app.state.openId, title: document.getElementById('panel-title').textContent }));
  check('deep link /?site=agri-terraces/agrisaarthi travels there and opens AgriSaarthi', dl.open === 'panel' && dl.title === 'AgriSaarthi');
  await shot(page, '03b-featured-agrisaarthi-1440x900.png');
  const r404 = await page.goto(BASE + '/no-such-page');
  check('unknown URL returns 404 with a way back', r404.status() === 404 && /Return to the Basin/.test(await page.content()));
  check('direct routes: no console errors', log.errors.length === 0, log.errors.slice(0, 3).join(' | '));
  await page.close();
}

// ---------------------------------------------------------------- 3. reduced motion
{
  const { page } = await open('/', { reduced: true });
  await waitWorld(page); await sleep(500);
  const f = await worldFrame(page);
  const rm = await f.evaluate(() => ({ rig: window.__basin.rig.reducedMotion }));
  const anim = await page.evaluate(() => { document.querySelector('.bar [data-open="quick-view"]').click(); return getComputedStyle(document.getElementById('quick-view')).animationName; });
  check('prefers-reduced-motion: world camera cuts instead of easing; no sheet animation', rm.rig === true && (anim === 'none' || anim === ''), `rig=${rm.rig} anim=${anim}`);
  await page.close();
}

// ---------------------------------------------------------------- 4. WebGL unavailable → fallback
{
  const { page, log } = await open('/', { noWebGL: true });
  await page.waitForFunction(() => window.__app?.state.mode === 'failed', { timeout: 10000 });
  const fb = await page.evaluate(() => ({ visible: !document.getElementById('fallback').hidden, reason: document.getElementById('fallback-reason').textContent, sites: document.querySelectorAll('#fallback [data-zone-open]').length, pins: document.querySelectorAll('#fallback-map .pin').length, iframes: document.querySelectorAll('iframe').length }));
  check('no WebGL: static map + all 13 sites + explanation, no iframe', fb.visible && fb.sites === 13 && fb.pins === 13 && fb.iframes === 0 && /WebGL/.test(fb.reason), fb.reason);
  await shot(page, '07-static-fallback-no-webgl-1440x900.png');
  await page.click('#fallback [data-zone-open="bay"]'); await sleep(200);
  check('fallback: a site opens its content directly', /evDOCTOR/.test(await page.$eval('#panel-title', (e) => e.textContent)));
  await page.keyboard.press('Escape'); await page.click('#fallback [data-open="quick-view"]'); await sleep(100);
  check('fallback: Quick View works', (await state(page)).openId === 'quick-view');
  check('fallback: no console errors', log.errors.length === 0, log.errors.slice(0, 3).join(' | '));
  await page.close();
}

// ---------------------------------------------------------------- 5. world fails to initialise → fallback with retry
{
  const { page } = await open('/?worldTimeout=4000', { block: /\/world\/assets\/index-.*\.js/ });
  await page.waitForFunction(() => window.__app?.state.mode === 'failed', { timeout: 15000 });
  const fb = await page.evaluate(() => ({ retry: !document.getElementById('retry').hidden, reason: document.getElementById('fallback-reason').textContent }));
  check('world script fails → fallback with a retry button (never an endless spinner)', fb.retry, fb.reason);
  await page.close();
}

// ---------------------------------------------------------------- 6. phone: map mode, no forced 3D
{
  const { page, log } = await open('/', { w: 390, h: 844, mobile: true });
  await page.waitForFunction(() => window.__app?.state.mode === 'map', { timeout: 10000 });
  await sleep(500); await shot(page, '06-mobile-map-mode-390x844.png');
  const m = await page.evaluate(() => ({ iframes: document.querySelectorAll('iframe').length, loadAnyway: !document.getElementById('load-anyway').hidden, overflow: document.documentElement.scrollWidth > window.innerWidth }));
  check('phone: map mode by default, “load anyway” offered, no 3D download', m.iframes === 0 && m.loadAnyway);
  check('phone: no horizontal overflow at 390 px', !m.overflow);
  await page.click('.bar [data-open="quick-view"]'); await sleep(200);
  const qvW = await page.$eval('#quick-view', (e) => e.getBoundingClientRect().width);
  check('phone: Quick View is full width', Math.abs(qvW - 390) < 2, String(qvW));
  await shot(page, '06b-mobile-quick-view-390x844.png');
  check('phone: no console errors', log.errors.length === 0, log.errors.slice(0, 3).join(' | '));
  await page.close();
}

// ---------------------------------------------------------------- 7. tablet layout
{
  const { page } = await open('/', { w: 1024, h: 768 });
  await waitWorld(page); await sleep(800);
  await shot(page, '09-tablet-1024x768.png');
  check('tablet 1024×768: world mode with header links', (await state(page)).worldReady && (await page.$$eval('.bar nav a', (a) => a.length)) >= 3);
  await page.close();
}

// ---------------------------------------------------------------- 8. links on the page resolve
{
  const { page } = await open('/');
  const hrefs = await page.$$eval('a[href]', (a) => [...new Set(a.map((x) => x.getAttribute('href')))]);
  const internal = hrefs.filter((h) => h.startsWith('/') && !h.startsWith('//'));
  const bad = [];
  for (const h of internal) { const u = new URL(h, BASE); const r = await page.evaluate(async (u) => (await fetch(u)).status, u.pathname); if (r !== 200) bad.push(`${r} ${h}`); }
  const external = hrefs.filter((h) => /^https?:/.test(h));
  check(`all ${internal.length} internal links return 200`, bad.length === 0, bad.join(', '));
  check('external links are https only', external.every((h) => h.startsWith('https://')), `${external.length} external`);
  check('no phone number in the rendered page', !/(\+\d{1,3}[\s-]?)?\d{5}[\s-]?\d{5}/.test(await page.evaluate(() => document.body.innerText + [...document.querySelectorAll('a[href]')].map((a) => a.href).join(' '))));
  await page.close();
}

// ---------------------------------------------------------------- 9. static accessibility basics (not a substitute for a manual audit)
for (const path of ['/', '/work/evdoctor', '/research']) {
  const { page } = await open(path);
  const a = await page.evaluate(() => {
    const named = (el) => (el.getAttribute('aria-label') || el.textContent || el.querySelector('img')?.alt || '').trim().length > 0;
    return {
      lang: document.documentElement.lang,
      h1: document.querySelectorAll('h1').length,
      unnamed: [...document.querySelectorAll('a[href], button')].filter((el) => !named(el)).map((el) => el.outerHTML.slice(0, 60)),
      noAlt: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length,
      dupIds: (() => { const ids = [...document.querySelectorAll('[id]')].map((e) => e.id); return ids.filter((x, i) => ids.indexOf(x) !== i); })(),
    };
  });
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => ({ cls: document.activeElement?.className, visible: document.activeElement?.getBoundingClientRect().top >= 0 }));
  check(`a11y ${path}: lang, one h1, named controls, img alt, unique ids`, a.lang === 'en' && a.h1 === 1 && !a.unnamed.length && !a.noAlt && !a.dupIds.length, JSON.stringify({ h1: a.h1, unnamed: a.unnamed, noAlt: a.noAlt, dupIds: a.dupIds }));
  check(`a11y ${path}: first Tab reaches a visible skip link`, first.cls === 'skip' && first.visible);
  await page.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\nE2E SUMMARY: ${results.length - failed}/${results.length} passed  (screenshots: ${SHOTS})`);
process.exit(failed ? 1 : 0);
