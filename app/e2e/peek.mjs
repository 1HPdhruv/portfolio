// quick visual probe: node e2e/peek.mjs <url> <out.png> [WxH] [js-to-eval-after-ready]
import puppeteer from 'puppeteer-core';
const [url, out, size = '1440x900', js] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
const b = await puppeteer.launch({ executablePath: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); await p.setViewport({ width: W, height: H });
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn') console.log('[console]', m.type(), m.text()); });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
p.on('requestfailed', (r) => console.log('[requestfailed]', r.url()));
await p.goto(url, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__app && (window.__app.state.worldReady || ['map', 'failed'].includes(window.__app.state.mode)), { timeout: 120000 });
await new Promise((r) => setTimeout(r, 1500));
if (js) { await p.evaluate(js); await new Promise((r) => setTimeout(r, 1200)); }
console.log(JSON.stringify(await p.evaluate(() => window.__app.state)));
await p.screenshot({ path: out });
await b.close();
