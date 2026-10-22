// Accessibility audit of rendered states in the production build (no test hooks needed).
// Contrast is measured, not inferred from tokens: each visible text run's colour (with inherited opacity) is
// compared with every backdrop pixel behind it, captured with all text made transparent, so translucent
// sheets, scrims and the live 3D scene are all accounted for.
// usage: node e2e/a11y.mjs [--base http://127.0.0.1:4321] [--json out.json]
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { existsSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const BASE = arg('--base', 'http://127.0.0.1:4321');
const exe = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'].find((p) => p && existsSync(p));
const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { base: BASE, date: new Date().toISOString(), states: [] };

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const blend = (fg, a, bg) => fg.map((c, i) => c * a + bg[i] * (1 - a));

async function audit(page, label, { dpr = 1 } = {}) {
  const runs = await page.evaluate(() => {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode());) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (!el || el.closest('[hidden], [inert], .sr-only, script, style, noscript')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden') continue;
      let op = 1; for (let a = el; a; a = a.parentElement) op *= +getComputedStyle(a).opacity;
      if (op < 0.05) continue;
      const r = document.createRange(); r.selectNodeContents(n);
      const rects = [...r.getClientRects()].filter((q) => q.width > 2 && q.height > 4 && q.top >= 0 && q.bottom <= innerHeight && q.left >= 0 && q.right <= innerWidth);
      if (!rects.length) continue;
      const q = rects[0], hit = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2);
      if (!hit || !(el.contains(hit) || hit.contains(el) || hit === el)) continue; // covered by something else
      const m = cs.color.match(/[\d.]+/g).map(Number);
      out.push({ text: n.textContent.trim().replace(/\s+/g, ' ').slice(0, 48), fg: m.slice(0, 3), alpha: (m[3] ?? 1) * op, size: parseFloat(cs.fontSize), weight: +cs.fontWeight,
        where: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : ''),
        rects: rects.map((x) => [x.x, x.y, x.width, x.height]) });
    }
    return out;
  });
  const style = await page.addStyleTag({ content: '*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;text-decoration-color:transparent!important}' });
  await sleep(120);
  const png = await page.screenshot({ type: 'png' });
  await page.evaluate((s) => s.remove(), style);
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => { const i = (y * info.width + x) * 3; return [data[i], data[i + 1], data[i + 2]]; };
  const results = [];
  for (const r of runs) {
    const vals = [];
    for (const [x, y, w, h] of r.rects) for (let yy = Math.ceil((y + 1) * dpr); yy < Math.floor((y + h - 1) * dpr); yy += 1) for (let xx = Math.ceil((x + 1) * dpr); xx < Math.floor((x + w - 1) * dpr); xx += 2) { const bg = px(Math.min(xx, info.width - 1), Math.min(yy, info.height - 1)); vals.push(ratio(blend(r.fg, r.alpha, bg), bg)); }
    if (!vals.length) continue;
    vals.sort((a, b) => a - b);
    const large = r.size >= 24 || (r.size >= 18.66 && r.weight >= 700);
    const need = large ? 3 : 4.5;
    results.push({ text: r.text, where: r.where, size: r.size, large, need, min: +vals[0].toFixed(2), p5: +vals[Math.floor(vals.length * 0.05)].toFixed(2), ok: vals[Math.floor(vals.length * 0.05)] >= need });
  }
  // structure
  const s = await page.evaluate(() => {
    const vis = (e) => !e.closest('[hidden]') && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0;
    const dlg = [...document.querySelectorAll('[role=dialog]')].find((d) => !d.hidden);
    const scope = dlg ?? document.body;
    const heads = [...scope.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(vis).map((h) => +h.tagName[1]);
    const skips = heads.filter((l, i) => i > 0 && l > heads[i - 1] + 1).length;
    const ids = [...document.querySelectorAll('[id]')].map((e) => e.id); const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    const ctrls = [...document.querySelectorAll('a[href],button,[role=button],iframe,input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter((e) => vis(e) && !e.closest('[inert]'));
    const unnamed = ctrls.filter((e) => !((e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent || '').trim())).map((e) => e.outerHTML.slice(0, 70));
    const targets = ctrls.filter((e) => e.tagName !== 'IFRAME').map((e) => { const r = e.getBoundingClientRect(); return { t: (e.textContent || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 30), w: Math.round(r.width), h: Math.round(r.height), inline: getComputedStyle(e).display === 'inline' && !!e.closest('p,li') }; });
    return {
      title: document.title, lang: document.documentElement.lang,
      landmarks: { banner: document.querySelectorAll('header.bar, [role=banner]').length, main: document.querySelectorAll('main, [role=main]').length, nav: document.querySelectorAll('nav').length },
      dialog: dlg ? { id: dlg.id, name: document.getElementById(dlg.getAttribute('aria-labelledby') ?? '')?.textContent?.trim() ?? dlg.getAttribute('aria-label'), modal: dlg.getAttribute('aria-modal'), focusInside: dlg.contains(document.activeElement) } : null,
      headings: heads.join(' '), headingSkips: skips, duplicateIds: dup, unnamed,
      smallTargets: targets.filter((t) => !t.inline && (t.w < 24 || t.h < 24)),
      under44: targets.filter((t) => !t.inline && (t.w < 44 || t.h < 44)).length, targets: targets.length,
      iframe: (() => { const f = document.querySelector('#stage iframe'); return f ? f.title : null; })(),
    };
  });
  const fails = results.filter((r) => !r.ok);
  report.states.push({ label, structure: s, contrast: { measured: results.length, failures: fails, worst: results.sort((a, b) => a.p5 - b.p5).slice(0, 5) } });
  console.log(`\n## ${label}\n  text runs measured: ${results.length}; contrast failures (p5 below AA): ${fails.length}`);
  for (const f of fails.slice(0, 12)) console.log(`   FAIL ${f.p5}:1 (min ${f.min}, need ${f.need}) ${f.where} “${f.text}”`);
  const w = results.slice(0, 3).map((r) => `${r.p5} ${r.where} “${r.text.slice(0, 24)}”`).join(' | ');
  console.log(`  lowest: ${w}`);
  console.log(`  title “${s.title}” · landmarks ${JSON.stringify(s.landmarks)} · headings [${s.headings}] skips ${s.headingSkips} · dup ids ${s.duplicateIds.length} · unnamed ${s.unnamed.length} · targets <24px ${s.smallTargets.length}/${s.targets} (<44px ${s.under44})${s.dialog ? ` · dialog ${JSON.stringify(s.dialog)}` : ''}${s.iframe ? ` · iframe title ✓` : ''}`);
  if (s.smallTargets.length) console.log('   small targets: ' + s.smallTargets.slice(0, 8).map((t) => `${t.t}(${t.w}×${t.h})`).join(', '));
  if (s.unnamed.length) console.log('   unnamed: ' + s.unnamed.join(' | '));
}

async function focusRing(page, selector, label) {
  // non-text contrast (WCAG 1.4.11): the focus indicator against the pixels it is drawn over
  await page.keyboard.press('Shift'); // keyboard modality, so :focus-visible applies as it does for keyboard users
  await page.focus(selector); await sleep(100);
  const r = await page.evaluate((sel) => { const e = document.querySelector(sel); const cs = getComputedStyle(e); const b = e.getBoundingClientRect(); return { color: cs.outlineColor.match(/[\d.]+/g).map(Number).slice(0, 3), w: parseFloat(cs.outlineWidth), off: parseFloat(cs.outlineOffset) || 0, style: cs.outlineStyle, box: [b.x, b.y, b.width, b.height] }; }, selector);
  const png = await page.screenshot({ type: 'png' });
  await page.evaluate(() => document.activeElement?.blur());
  await sleep(80);
  const png0 = await page.screenshot({ type: 'png' });
  const raw = async (p) => sharp(p).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const [{ data: d0, info }] = [await raw(png0)];
  const [x, y, w] = r.box; const ry = Math.round(y - r.off - r.w / 2); // a row through the top edge of the outline
  const vals = [];
  for (let xx = Math.round(x); xx < Math.round(x + w); xx += 2) { if (ry < 0) break; const i = (ry * info.width + xx) * 3; vals.push(ratio(r.color, [d0[i], d0[i + 1], d0[i + 2]])); }
  vals.sort((a, b) => a - b);
  const res = { label, selector, outline: `${r.w}px ${r.style}`, minContrastVsBackdrop: vals.length ? +vals[0].toFixed(2) : null, ok: r.style !== 'none' && r.w >= 2 && vals.length && vals[0] >= 3 };
  report.focus = [...(report.focus ?? []), res];
  console.log(`  focus ring ${label}: ${res.outline}, min ${res.minContrastVsBackdrop}:1 vs backdrop → ${res.ok ? 'OK' : 'FAIL'}`);
}

const newPage = async (w = 1440, h = 900, mobile = false, noWebGL = false) => {
  const p = await browser.newPage(); await p.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile });
  if (noWebGL) await p.evaluateOnNewDocument(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...r) { return /webgl/i.test(String(t)) ? null : g.call(this, t, ...r); }; });
  return p;
};
const ready = (p) => p.waitForFunction(() => document.getElementById('stage').dataset.state === 'ready', { timeout: 120000 });

// desktop states
{
  const p = await newPage();
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await sleep(250);
  await audit(p, '1 initial loading (desktop 1440×900)');
  await ready(p); await sleep(1500);
  await audit(p, '2 world ready, help overlay and cue over the 3D scene');
  await focusRing(p, '.bar [data-open="navigator"]', 'header button over dark bar');
  await p.click('.bar [data-open="quick-view"]'); await sleep(500);
  await audit(p, '3 Quick View');
  await focusRing(p, '#quick-view [data-close]', 'close button on sheet');
  await p.click('#quick-view a[data-open-project="vocalvitals"]'); await sleep(500);
  await audit(p, '4 project panel (VocalVitals, from Quick View)');
  await p.keyboard.press('Escape'); await sleep(400);
  await p.click('.bar [data-open="navigator"]'); await sleep(500);
  await audit(p, '5 location navigator');
  await p.click('[data-travel="bay"]'); await sleep(900);
  await p.keyboard.down('KeyW'); for (let i = 0; i < 40 && await p.$eval('#cue', (e) => e.hidden); i++) await sleep(150); await p.keyboard.up('KeyW'); await sleep(800);
  await audit(p, '6 physical anchor: evDOCTOR cue over the 3D bay');
  await p.keyboard.press('KeyE'); await sleep(500);
  await audit(p, '7 keyboard-driven interaction: E → evDOCTOR panel');
  await p.keyboard.press('Escape'); await sleep(300);
  await p.click('.bar [data-open="navigator"]'); await sleep(300); await p.click('#navigator [data-zone-open="research"]'); await sleep(400);
  await audit(p, '8 Research Station page');
  await p.click('[data-world-view="interior"]'); await sleep(1500);
  await audit(p, '9 interior view, “Return to the surface” over the 3D interior');
  await p.close();
}
// fallback, phone, static pages
{
  const p = await newPage(1440, 900, false, true);
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await sleep(800);
  await audit(p, '10 static-map fallback (no WebGL 2)');
  await focusRing(p, '#fallback [data-open="quick-view"]', 'fallback primary button');
  await p.close();
  const m = await newPage(390, 844, true);
  await m.goto(BASE + '/', { waitUntil: 'domcontentloaded' }); await sleep(800);
  await audit(m, '11 phone 390×844 map mode');
  await m.click('.bar [data-open="quick-view"]'); await sleep(500);
  await audit(m, '12 phone Quick View');
  await m.close();
  const s = await newPage();
  await s.goto(BASE + '/work/evdoctor'); await audit(s, '13 static project page /work/evdoctor');
  await s.goto(BASE + '/research'); await audit(s, '14 static /research');
  await s.goto(BASE + '/nope'); await audit(s, '15 404 page');
  await s.close();
}

// reduced motion: transitions and animations
{
  const p = await newPage(); await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.goto(BASE + '/?world=0', { waitUntil: 'domcontentloaded' }); await sleep(300);
  const anim = await p.evaluate(() => [...document.querySelectorAll('*')].filter((e) => { const cs = getComputedStyle(e); return (cs.animationName !== 'none' && parseFloat(cs.animationDuration) > 0.01) || parseFloat(cs.transitionDuration) > 0.01; }).map((e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + '.' + String(e.className).split(' ')[0]));
  report.reducedMotion = { animatedElements: anim };
  console.log(`\n## reduced motion: elements still animating/transitioning > 10 ms: ${anim.length}${anim.length ? ' → ' + anim.slice(0, 8).join(', ') : ''}`);
  await p.close();
}

await browser.close();
const out = arg('--json', null); if (out) writeFileSync(out, JSON.stringify(report, null, 2));
const total = report.states.reduce((a, s) => a + s.contrast.failures.length, 0);
console.log(`\nA11Y SUMMARY: ${report.states.length} states, ${report.states.reduce((a, s) => a + s.contrast.measured, 0)} text runs measured, ${total} contrast failures; focus rings ${report.focus.filter((f) => f.ok).length}/${report.focus.length} OK`);
const structural = report.states.filter((s) => s.structure.duplicateIds.length || s.structure.unnamed.length || s.structure.headingSkips || s.structure.smallTargets.length || s.structure.lang !== 'en');
process.exit(total || structural.length || report.focus.some((f) => !f.ok) || report.reducedMotion.animatedElements.length ? 1 : 0);
