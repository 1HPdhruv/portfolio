// Builds the standalone Three.js world (../world-prototype) into public/world/ and derives the static basin map.
// The world stays an independent Vite project; this script is the only coupling at build time.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, '..'), world = resolve(app, '../world-prototype'), out = join(app, 'public/world');
// TEST_HOOKS=1 (pnpm build:qa) compiles the world's window.__basin test hooks in; any other build strips them,
// whatever VITE_TEST_HOOKS happens to be set to in the environment.
const hooks = process.env.TEST_HOOKS === '1';
const env = { ...process.env, VITE_TEST_HOOKS: hooks ? '1' : '' };
const run = (cmd, cwd) => { console.log(`[build-world] ${cmd}`); execSync(cmd, { cwd, stdio: 'inherit', env }); };

if (!existsSync(join(world, 'node_modules'))) run('pnpm install --frozen-lockfile', world);
rmSync(out, { recursive: true, force: true });
run(`pnpm exec tsc --noEmit`, world);
run(`pnpm exec vite build --outDir "${out}" --emptyOutDir`, world);
// Publish the entry as basin.html and load it as /world/basin. Vercel's cleanUrls 308-redirects any …/index(.html)
// URL to its directory without a trailing slash (/world), where the build's relative ./assets/ paths would resolve
// to /assets/ and 404. /world/basin is served directly (no redirect, query kept), and ./assets → /world/assets/.
renameSync(join(out, 'index.html'), join(out, 'basin.html'));

// static map for the fallback / map mode: rendered from the same heightfield + layout by the world's own map tool
const tmp = join(app, '.cache'); mkdirSync(tmp, { recursive: true });
const png = join(tmp, 'basin-map.png');
run(`pnpm exec tsx tools/map.ts "${png}"`, world);
await sharp(png).resize({ width: 900 }).webp({ quality: 72 }).toFile(join(app, 'public/basin-map.webp'));
console.log(`[build-world] wrote public/world/ (${hooks ? 'QA build, test hooks ON' : 'production, no test hooks'}) and public/basin-map.webp`);
