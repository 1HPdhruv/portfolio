// Builds the standalone Three.js world (../world-prototype) into public/world/ and derives the static basin map.
// The world stays an independent Vite project; this script is the only coupling at build time.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, '..'), world = resolve(app, '../world-prototype'), out = join(app, 'public/world');
const run = (cmd, cwd) => { console.log(`[build-world] ${cmd}`); execSync(cmd, { cwd, stdio: 'inherit' }); };

if (!existsSync(join(world, 'node_modules'))) run('pnpm install --frozen-lockfile', world);
rmSync(out, { recursive: true, force: true });
run(`pnpm exec tsc --noEmit`, world);
run(`pnpm exec vite build --outDir "${out}" --emptyOutDir`, world);

// static map for the fallback / map mode: rendered from the same heightfield + layout by the world's own map tool
const tmp = join(app, '.cache'); mkdirSync(tmp, { recursive: true });
const png = join(tmp, 'basin-map.png');
run(`pnpm exec tsx tools/map.ts "${png}"`, world);
await sharp(png).resize({ width: 900 }).webp({ quality: 72 }).toFile(join(app, 'public/basin-map.webp'));
console.log('[build-world] wrote public/world/ and public/basin-map.webp');
