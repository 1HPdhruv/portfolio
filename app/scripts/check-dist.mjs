// Release guard, run at the end of `pnpm build`: fails if the production output contains debug-only code,
// test hooks, source maps, secrets or a phone number. Usage: node scripts/check-dist.mjs [dir=dist]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.argv[2] ?? 'dist';
const files = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : [p]; });
const all = files(root);
const text = all.filter((f) => /\.(html|js|mjs|css|xml|txt|json|svg|webmanifest)$/.test(f));

// Markers of code that must exist only on the dev server or in the QA build (dist-qa/).
const DEBUG_MARKERS = [
  ['__basin', 'world test-hook global'],
  ['__app', 'app test-hook global'],
  ['placeRover', 'world test hook'],
  ['zonesList', 'world test hook'],
  ['isUnderground', 'world test hook'],
  ['worldTimeout', 'app load-timeout test parameter'],
  ['world prototype · debug', 'world debug HUD'],
  ['O overview', 'world debug HUD buttons'],
  ['&debug=1', 'debug flag forwarded into the world iframe'],
  ['/world/index.html', 'world URL that Vercel cleanUrls would redirect (breaking relative asset paths)'],
];
const SECRET = /(sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|xox[abpr]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY)/;
const PHONE = /(\+\d{1,3}[\s-]?)?\b\d{5}[\s-]?\d{5}\b/; // checked in documents only: minified JS is full of digit runs

const problems = [];
for (const f of all) if (f.endsWith('.map')) problems.push(`${relative(root, f)}: source map in production output`);
for (const f of text) {
  const s = readFileSync(f, 'utf8'), rel = relative(root, f);
  for (const [m, what] of DEBUG_MARKERS) if (s.includes(m)) problems.push(`${rel}: contains ${what} (${JSON.stringify(m)})`);
  if (/sourceMappingURL=/.test(s)) problems.push(`${rel}: sourceMappingURL comment`);
  if (SECRET.test(s)) problems.push(`${rel}: looks like a credential (value not printed)`);
  if (/\.(html|xml|txt|json)$/.test(f) && PHONE.test(s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/\b(?:width|height|viewBox|d|points)="[^"]*"/g, ''))) problems.push(`${rel}: phone-number-like digit sequence (value not printed)`);
}

if (problems.length) { console.error(`[check-dist] FAIL — ${problems.length} problem(s) in ${root}/:\n  ` + problems.join('\n  ')); process.exit(1); }
console.log(`[check-dist] OK — ${all.length} files in ${root}/: no debug UI, test hooks, source maps, credentials or phone numbers`);
