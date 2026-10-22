// Headless measurements of the integrated build (run against `pnpm preview`). Numbers are from a headless
// browser on the development machine; they are indicative, not field data.
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
const BASE = process.argv[2] ?? 'http://127.0.0.1:4321';
const RUNS = Number(process.argv[3] ?? 3);
const exe = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'].find((p) => p && existsSync(p));
const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const kb = (n) => (n / 1024).toFixed(1);

async function run(path, view, mobile = false) {
  const ctx = await browser.createBrowserContext(); // cold cache per run
  const page = await ctx.newPage();
  await page.setViewport({ ...view, isMobile: mobile, hasTouch: mobile });
  const bytes = {}; const cdp = await page.createCDPSession(); await cdp.send('Network.enable');
  const urls = {}; cdp.on('Network.responseReceived', (e) => (urls[e.requestId] = e.response.url));
  cdp.on('Network.loadingFinished', (e) => { const u = urls[e.requestId] ?? '?'; const k = /hf\.worker/.test(u) ? 'world worker' : /\/world\/assets\/.*\.js/.test(u) ? 'world JS' : /\/world\//.test(u) ? 'world other' : /\.js/.test(u) ? 'app JS' : /\.css/.test(u) ? 'CSS' : /\.(webp|jpg|png|svg)/.test(u) ? 'images' : /fonts/.test(u) ? 'fonts' : 'HTML/other'; bytes[k] = (bytes[k] ?? 0) + e.encodedDataLength; });
  const t0 = Date.now();
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  const dcl = Date.now() - t0;
  if (path !== '/') { await page.waitForFunction(() => document.readyState === 'complete'); const out = { dcl, load: Date.now() - t0 }; await new Promise((r) => setTimeout(r, 500)); out.totalKB = kb(Object.values(bytes).reduce((a, b) => a + b, 0)); await ctx.close(); return out; } // static pages ship no app script
  await page.waitForFunction(() => !!window.__app, { timeout: 30000 });
  const qvReady = Date.now() - t0; // Quick View button wired = portfolio usable
  const out = { dcl, qvReady };
  if (!mobile) {
    await page.waitForFunction(() => window.__app.state.worldReady, { timeout: 120000 });
    out.worldReady = Date.now() - t0;
    out.timings = await page.evaluate(() => window.__app.state.worldTimings);
    const f = await (await page.$('#stage iframe')).contentFrame();
    await new Promise((r) => setTimeout(r, 3000));
    out.surface = await f.evaluate(() => { window.__basin.stats(); return new Promise((r) => setTimeout(() => r(window.__basin.stats()), 2000)); });
    out.benchSurface = await f.evaluate(() => window.__basin.bench(30));
    await f.evaluate(() => window.__basin.setInterior(true)); await new Promise((r) => setTimeout(r, 500));
    out.benchInterior = await f.evaluate(() => window.__basin.bench(30));
    out.heap = await f.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
  } else await new Promise((r) => setTimeout(r, 1500));
  out.bytes = Object.fromEntries(Object.entries(bytes).map(([k, v]) => [k, kb(v)]));
  out.totalKB = kb(Object.values(bytes).reduce((a, b) => a + b, 0));
  await ctx.close();
  return out;
}

if (RUNS) for (let i = 0; i < RUNS; i++) console.log('desktop 1440x900', JSON.stringify(await run('/', { width: 1440, height: 900 })));
console.log('phone 390x844 (map mode)', JSON.stringify(await run('/', { width: 390, height: 844 }, true)));
console.log('static /work/evdoctor', JSON.stringify(await run('/work/evdoctor', { width: 1440, height: 900 }, true)));
await browser.close();
