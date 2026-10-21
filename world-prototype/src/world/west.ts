import * as THREE from 'three';
import type { Heightfield } from '../heightfield';
import { Builder, Frame } from './kit';
import { M, weathered } from './materials';
import * as P from './props';
import { padFrame, decal } from './rim';
import { mulberry32 } from '../noise';

/** Crop plant: a cluster of curved, tapering blades (optionally with seed heads). */
export function bladeCluster(n: number, h: number, spread: number, w: number, seed: number, stalk = false) {
  const r = mulberry32(seed), pos: number[] = [];
  const blade = (a: number, hh: number, lean: number, ww: number, y0 = 0) => {
    const ca = Math.cos(a), sa = Math.sin(a), segs = 3;
    const pt = (t: number, side: number) => {
      const along = lean * t * t, up = y0 + hh * t, half = ww * 0.5 * (1 - t) * side;
      return [ca * along - sa * half, up, sa * along + ca * half];
    };
    for (let s = 0; s < segs; s++) {
      const t0 = s / segs, t1 = (s + 1) / segs;
      const a0 = pt(t0, -1), b0 = pt(t0, 1), a1 = pt(t1, -1), b1 = pt(t1, 1);
      pos.push(...a0, ...b0, ...a1, ...b0, ...b1, ...a1);
    }
  };
  if (stalk) blade(0, h * 1.05, 0.02, w * 0.6);
  for (let k = 0; k < n; k++) blade((k / n) * Math.PI * 2 + r() * 0.8, h * (0.6 + 0.4 * r()), spread * (0.5 + r()), w, stalk ? h * 0.25 * r() : 0);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return g;
}

const cropMats = {
  young: new THREE.MeshStandardMaterial({ color: '#6f9142', roughness: 0.85, side: THREE.DoubleSide }),
  mid: new THREE.MeshStandardMaterial({ color: '#5a7d36', roughness: 0.85, side: THREE.DoubleSide }),
  ripe: new THREE.MeshStandardMaterial({ color: '#a89458', roughness: 0.9, side: THREE.DoubleSide }),
};

// ------------------------------------------------------------------ 3. AGRI TERRACES — AgriSaarthi
export function buildTerraces(hf: Heightfield, parent: THREE.Object3D) {
  const b = new Builder(hf, 'agri-terraces', 1.0);
  const geos = { young: bladeCluster(5, 0.28, 0.12, 0.05, 1), mid: bladeCluster(7, 1.15, 0.38, 0.09, 2, true), ripe: bladeCluster(11, 0.85, 0.16, 0.035, 3) };
  const mats: Record<string, THREE.Matrix4[]> = { young: [], mid: [], ripe: [] };
  const rnd = mulberry32(99), dummy = new THREE.Object3D();
  const TX = -178, TZ = -118, ROW = (2 * Math.PI) / 2.9;
  const stages = ['young', 'mid', 'ripe', 'fallow', 'mid', 'young', 'ripe'];
  for (let x = TX - 90; x < TX + 90; x += ROW / 2) for (let z = TZ - 85; z < TZ + 85; z += 0.5) {
    const xx = Math.round((x - 0.54) / (ROW / 2)) * (ROW / 2) + 0.54 - 0.08;
    if (hf.splatAt(xx, z, 3) < 0.75 || hf.splatAt(xx, z, 1) > 0.05 || hf.splatAt(xx, z, 2) > 0.05) continue;
    const n = hf.normal(xx, z); if (n[1] < 0.985) continue;
    const terrace = Math.round((hf.at(xx, z) + 0.3) / 2.5);
    const st = stages[((terrace % stages.length) + stages.length) % stages.length];
    if (st === 'fallow') continue;
    const jx = xx + (rnd() - 0.5) * 0.12, jz = z + (rnd() - 0.5) * 0.18;
    dummy.position.set(jx, hf.at(jx, jz) - 0.02, jz); dummy.rotation.set(0, rnd() * Math.PI * 2, 0);
    const s = 0.8 + rnd() * 0.4; dummy.scale.set(s, s * (0.85 + rnd() * 0.3), s); dummy.updateMatrix();
    mats[st].push(dummy.matrix.clone());
  }
  for (const k of ['young', 'mid', 'ripe'] as const) {
    const cols = mats[k].map(() => new THREE.Color().setHSL(0.24 + (rnd() - 0.5) * 0.04, 0.35, 0.5 + (rnd() - 0.5) * 0.18).lerp(new THREE.Color(1, 1, 1), 0.5));
    b.tiled(geos[k], cropMats[k], mats[k], { shadow: k === 'mid', tile: 90, maxDist: 280, colors: cols });
  }
  // soil-sensor stakes on a 16 m grid: post, logger, tiny solar cap
  const posts: THREE.Matrix4[] = [], loggers: THREE.Matrix4[] = [], caps: THREE.Matrix4[] = [];
  for (let x = TX - 80; x < TX + 80; x += 16) for (let z = TZ - 80; z < TZ + 80; z += 16) {
    const jx = x + (rnd() - 0.5) * 3, jz = z + (rnd() - 0.5) * 3;
    if (hf.splatAt(jx, jz, 3) < 0.75 || hf.normal(jx, jz)[1] < 0.985) continue;
    const y = hf.at(jx, jz);
    posts.push(new THREE.Matrix4().compose(new THREE.Vector3(jx, y + 0.55, jz), new THREE.Quaternion(), new THREE.Vector3(0.05, 1.1, 0.05)));
    loggers.push(new THREE.Matrix4().compose(new THREE.Vector3(jx, y + 0.95, jz + 0.06), new THREE.Quaternion(), new THREE.Vector3(0.14, 0.12, 0.09)));
    caps.push(new THREE.Matrix4().compose(new THREE.Vector3(jx, y + 1.13, jz), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.45, 0, 0)), new THREE.Vector3(0.22, 0.012, 0.16)));
  }
  const box = new THREE.BoxGeometry(1, 1, 1);
  b.inst(box, M.galv, posts); b.inst(box, M.panelWhite, loggers); b.inst(box, M.solar, caps);
  // sensor station: shed, gateway antenna aimed at the Signal Tower, weather mast, header tank + irrigation main
  const f = padFrame(hf, 'agri');
  b.block(M.concreteDark, f, 4.6, 0.2, 3.6, 0, 0, 0);
  b.block(M.panelWhite, f, 4.2, 2.5, 3.2, 0, 0.2, 0);
  b.box(M.panelGrey, f, 4.8, 0.12, 3.9, 0, 2.8, 0, 0, 0.08); b.box(M.solar, f, 4.0, 0.04, 2.8, 0, 2.9, 0, 0, 0.08);
  b.box(M.steelDark, f, 0.9, 2.0, 0.05, 1.2, 1.2, 1.62); b.box(M.window, f, 0.9, 0.6, 0.04, -0.8, 1.6, 1.62);
  b.solid(f, 0, 0, 4.4, 3.4);
  P.mast(b, f, -3, -1.5, 8, { yagi: true, guy: true });
  P.weatherStation(b, f, 4.5, -3.5);
  P.tank(b, f, -5.5, 3, 1.2, 2.4, M.panelInk);
  { const pts: [number, number, number][] = []; for (let k = 0; k <= 10; k++) { const [x, z] = f.w(-5.5 - k * 4, 3 + k * 2.5); pts.push([x, hf.at(x, z) + 0.25, z]); } const F0 = new Frame(0, 0, 0, 0); for (let k = 1; k < pts.length; k++) b.rod(M.panelInk, F0, pts[k - 1], pts[k], 0.07, 6); }
  b.sign(f, 3.5, 1.1, 4.8, 0, 2.2, 0.9, ['AGRI TERRACES', 'TRIAL PLOTS · SENSOR GRID']);
  // phenotyping gantry straddling a row: camera carriage on a rolling portal
  {
    let best: [number, number] | null = null;
    for (let k = 0; k < 400 && !best; k++) { const x = -190 + (k % 20) * 1.5, z = -108 + Math.floor(k / 20) * 1.5; if (hf.splatAt(x, z, 3) > 0.9 && hf.normal(x, z)[1] > 0.995 && hf.normal(x + 3, z)[1] > 0.99 && hf.normal(x - 3, z)[1] > 0.99) best = [x, z]; }
    if (best) {
      const g = new Frame(best[0], hf.at(best[0], best[1]), best[1], 0);
      for (const sx of [-1, 1]) { b.rod(M.galv, g, [sx * 3, 0.25, -0.8], [sx * 3, 2.6, 0], 0.06); b.rod(M.galv, g, [sx * 3, 0.25, 0.8], [sx * 3, 2.6, 0], 0.06); b.box(M.galv, g, 0.1, 0.1, 1.7, sx * 3, 0.3, 0); for (const sz of [-0.8, 0.8]) b.cyl(M.rubber, g, 0.18, 0.12, sx * 3, 0.18, sz, 0, Math.PI / 2, 12); }
      b.box(M.galv, g, 6.4, 0.18, 0.18, 0, 2.65, 0); b.box(M.panelWhite, g, 0.5, 0.4, 0.4, 0.8, 2.35, 0); b.box(M.glass, g, 0.2, 0.05, 0.2, 0.8, 2.13, 0);
      b.box(M.solar, g, 1.2, 0.04, 0.8, -1.8, 2.8, 0, 0, -0.3);
      b.box(M.panelGrey, g, 0.6, 0.5, 0.35, 2.2, 1.0, 0.5);
    }
  }
  return b.finish(parent);
}

// ------------------------------------------------------------------ 6. PROVING GROUNDS + Benchmark Ridge
export function buildProving(hf: Heightfield, parent: THREE.Object3D) {
  const b = new Builder(hf, 'proving', 1.0), f = padFrame(hf, 'proving');
  decal(b, f, -4, 0, 46, 34, 0, (g, W, H) => {
    const cx = W / 2, cy = H / 2;
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(36,30,22,.7)'; g.lineWidth = W * 0.11; g.beginPath(); g.ellipse(cx, cy, W * 0.36, H * 0.32, 0, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(232,228,216,.55)'; g.lineWidth = 3; g.setLineDash([18, 22]); g.beginPath(); g.ellipse(cx, cy, W * 0.36, H * 0.32, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    g.lineWidth = 4; g.beginPath(); g.ellipse(cx, cy, W * 0.415, H * 0.39, 0, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.ellipse(cx, cy, W * 0.305, H * 0.25, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(232,228,216,.8)'; for (let i = 0; i < 8; i++) g.fillRect(cx - 4 + (i % 2) * 8, cy + H * 0.25 + Math.floor(i / 2) * (H * 0.035), 8, H * 0.035);
  }, 1024);
  // start/finish timing gate over the track
  const T = f.sub(-4, 0, 11.5);
  for (const sx of [-1, 1]) { b.block(M.panelGrey, T, 0.4, 3.6, 0.4, sx * 3.4, 0, 0); b.post(T, sx * 3.4, 0, 0.3); b.box(M.lamp, T, 0.05, 0.3, 0.12, sx * 3.18, 0.9, 0); }
  b.box(M.panelGrey, T, 7.2, 0.5, 0.4, 0, 3.8, 0); for (let k = 0; k < 3; k++) b.box(M.steelDark, T, 0.25, 0.18, 0.22, -1.5 + k * 1.5, 3.45, 0);
  // scoring tower: scaffold, cabin, blank board (no fabricated results)
  const S = f.sub(-24, 0, -10, 0.5);
  for (const x of [-1.6, 1.6]) for (const z of [-1.6, 1.6]) { b.block(M.galv, S, 0.08, 8.0, 0.08, x, 0, z); b.post(S, x, z, 0.12); }
  for (const y of [2, 4, 6]) { for (const z of [-1.6, 1.6]) b.box(M.galv, S, 3.3, 0.06, 0.06, 0, y, z); for (const x of [-1.6, 1.6]) b.box(M.galv, S, 0.06, 0.06, 3.3, x, y, 0); b.rod(M.galv, S, [-1.6, y - 2, -1.6], [1.6, y, -1.6], 0.025); }
  b.block(M.wood, S, 3.4, 0.08, 3.4, 0, 6, 0);
  b.block(M.panelWhite, S, 3.2, 2.4, 3.2, 0, 6.08, 0); b.box(M.panelGrey, S, 3.8, 0.14, 3.8, 0, 8.6, 0);
  b.box(M.window, S, 2.6, 0.9, 0.05, 0, 7.6, 1.62); b.box(M.window, S, 0.05, 0.9, 2.6, 1.62, 7.6, 0);
  P.stairs(b, S, -1.0, 0, 3.6, 0, 0.9, 6.0, 20);
  const B = S.sub(0, 0, 1.9, 0);
  b.box(M.steelDark, B, 5.2, 2.2, 0.15, 3.6, 9.9, -1.9); b.box(M.galv, B, 0.12, 4, 0.12, 1.4, 8.4, -1.9); b.box(M.galv, B, 0.12, 4, 0.12, 5.8, 8.4, -1.9);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) b.box(M.glass, B, 0.7, 0.36, 0.02, 3.6 - 2.15 + c * 0.86, 10.75 - r * 0.5, -1.8);
  // bleachers along the straight
  const BL = f.sub(-4, 0, -17.5);
  for (let t = 0; t < 3; t++) { b.box(M.wood, BL, 10, 0.06, 0.45, 0, 0.5 + t * 0.45, -t * 0.6); for (let k = 0; k < 6; k++) b.block(M.galv, BL, 0.06, 0.5 + t * 0.45, 0.06, -4.8 + k * 1.9, 0, -t * 0.6); }
  b.solid(BL, 0, -0.6, 10, 1.8);
  // tyre barriers on the tight corner, slalom poles, lane flags
  for (let k = 0; k < 9; k++) { const a = -0.9 + k * 0.22; P.tyreStack(b, f, -4 + Math.cos(a) * 21.5, Math.sin(a) * 15.5, 3); }
  for (let k = 0; k < 6; k++) { const sf = f.sub(-12 + k * 3.2, 0, 3 + (k % 2) * 1.2); b.cyl(M.chalkPaint, sf, 0.03, 1.4, 0, 0.7, 0, 0, 0, 6); b.cyl(M.orange, sf, 0.032, 0.25, 0, 1.2, 0, 0, 0, 6); }
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; const sf = f.sub(-4 + Math.cos(a) * 20, 0, Math.sin(a) * 14.6); b.cyl(M.galv, sf, 0.02, 1.8, 0, 0.9, 0, 0, 0, 5); b.put(k % 4 ? M.chalkPaint : M.orange, new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.8, 0), new THREE.Vector3(0.45, 1.65, 0), new THREE.Vector3(0, 1.5, 0)]).setIndex([0, 1, 2, 0, 2, 1]), sf, 0, 0, 0); }
  // field-test team station: canopy, table, cases
  const C = f.sub(18, 0, -12, -0.3);
  for (const x of [-1.5, 1.5]) for (const z of [-1.5, 1.5]) b.block(M.galv, C, 0.05, 2.4, 0.05, x, 0, z);
  b.put(M.tarp, new THREE.ConeGeometry(2.3, 0.6, 4, 1).rotateY(Math.PI / 4), C, 0, 2.7, 0);
  b.box(M.steelPaint, C, 1.8, 0.04, 0.7, 0, 0.75, 0); P.pelican(b, C, -0.5, 0.77, 0, 0.1); b.box(M.steelDark, C, 0.35, 0.02, 0.25, 0.5, 0.78, 0); b.box(M.screen, C, 0.33, 0.22, 0.01, 0.5, 0.9, -0.12, 0, 0.3);
  P.pelican(b, C, 1.2, 0, 1.0, 0.4, 1.2, M.caseOlive); P.jerrycans(b, C, -1.4, 0, 1.2, 0.2, 2);
  b.solid(C, 0, 0, 2.0, 1.0);
  P.stake(b, ...f.w(26, 8), '04');
  P.lightPole(b, f, 27, -18, 7, -Math.PI / 2, false, 10);
  b.sign(f, 29, 1.15, 14, -Math.PI / 2, 2.4, 1.0, ['PROVING GROUNDS', 'EXTERNALLY JUDGED WORK']);
  b.finish(parent);

  // Benchmark Ridge: brass survey markers along the crest of the rock spine
  const r = new Builder(hf, 'benchmark-ridge', 0.6);
  const crest = (z: number) => { let bx = -70, bh = -1e9; for (let x = -95; x <= -45; x += 0.5) { const h = hf.at(x, z); if (h > bh) { bh = h; bx = x; } } return bx; };
  for (let k = 0; k < 9; k++) {
    const z = -8 + k * 13, x = crest(z), y = hf.at(x, z), F = new Frame(x, y, z, 0);
    const set = k < 6; // the last three sockets wait, empty, for marks still to be earned
    r.cyl(M.concreteSmooth, F, 0.32, 0.55, 0, 0.18, 0, 0, 0, 12);
    if (set) { r.cyl(M.brass, F, 0.17, 0.04, 0, 0.47, 0, 0, 0, 20); r.cyl(M.brass, F, 0.04, 0.05, 0, 0.5, 0, 0, 0, 8); }
    else r.cyl(M.steelDark, F, 0.15, 0.02, 0, 0.455, 0, 0, 0, 16);
    r.post(F, 0, 0, 0.35);
  }
  { const z = -22, x = crest(z) + 3; const F = new Frame(x, hf.at(x, z), z, -Math.PI / 2 + 0.3); r.sign(F, 0, 1.05, 0, 0, 1.8, 0.8, ['BENCHMARK RIDGE', 'BM-01 … BM-09'], { bg: '#c9c2ae' }); }
  r.finish(parent);
  return b;
}

// ------------------------------------------------------------------ 13. LOCAL MINIMUM — easter egg
export function buildLocalMinimum(hf: Heightfield, parent: THREE.Object3D) {
  const b = new Builder(hf, 'local-minimum', 0.5);
  // find the true bottom of the bowl
  let bx = -95, bz = -146, bh = 1e9;
  for (let x = -110; x <= -80; x += 0.5) for (let z = -160; z <= -132; z += 0.5) { const h = hf.at(x, z); if (h < bh) { bh = h; bx = x; bz = z; } }
  P.stake(b, bx, bz, '··', 1.4);
  // tyre tracks spiralling in the bottom: someone went round and round in here
  const F = new Frame(bx, bh, bz, 0);
  decal(b, F, 0, 0, 16, 16, 0, (g, W) => { g.strokeStyle = 'rgba(30,24,18,.35)'; g.lineWidth = 5; for (const off of [-9, 9]) { g.beginPath(); for (let t = 0; t < 28; t += 0.05) { const r = W * 0.42 - t * 4.2 + off * 0.4; g.lineTo(W / 2 + Math.cos(t) * r, W / 2 + Math.sin(t) * r); } g.stroke(); } });
  // hand-lettered board on the lip
  const lip = new Frame(bx + 9.5, hf.at(bx + 9.5, bz - 9), bz - 9, -0.6);
  const hand = '600 64px "Marker Felt", "Chalkboard SE", "Comic Sans MS", cursive';
  lip.y = hf.at(...lip.w(0, 0));
  b.sign(lip, 0, 1.0, 0, 0, 1.7, 0.95, ['LOCAL MINIMUM', 'not the bottom.', 'try momentum →'], { bg: '#b9a37e', fg: '#2a1e12', accent: false, font: hand });
  return b.finish(parent);
}

// ------------------------------------------------------------------ 8. HEDGE MAZE — the origin story
export function buildMaze(hf: Heightfield, parent: THREE.Object3D) {
  const b = new Builder(hf, 'hedge-maze', 0.3), f = padFrame(hf, 'maze');
  const N = 11, C = 3.6, half = (N * C) / 2, r = mulberry32(2019);
  const hW = Array.from({ length: N + 1 }, () => Array(N).fill(true)); // walls along z-lines (between rows)
  const vW = Array.from({ length: N }, () => Array(N + 1).fill(true)); // walls along x-lines (between cols)
  const seen = Array.from({ length: N }, () => Array(N).fill(false));
  const stack: [number, number][] = [[N - 1, (N / 2) | 0]]; seen[(N / 2) | 0][N - 1] = true;
  while (stack.length) {
    const [i, j] = stack[stack.length - 1];
    const nb = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).map(([di, dj]) => [i + di, j + dj] as [number, number]).filter(([a, c]) => a >= 0 && c >= 0 && a < N && c < N && !seen[c][a]);
    if (!nb.length) { stack.pop(); continue; }
    const [a, c] = nb[Math.floor(r() * nb.length)];
    if (a !== i) vW[j][Math.max(a, i)] = false; else hW[Math.max(c, j)][i] = false;
    seen[c][a] = true; stack.push([a, c]);
  }
  const entryRow = (N / 2) | 0; vW[entryRow][N] = false;
  // BFS from the entrance for the deepest cell and the path to it
  const dist = Array.from({ length: N }, () => Array(N).fill(-1)), par = new Map<string, [number, number]>();
  const q: [number, number][] = [[N - 1, entryRow]]; dist[entryRow][N - 1] = 0; let far: [number, number] = [N - 1, entryRow];
  while (q.length) {
    const [i, j] = q.shift()!;
    if (dist[j][i] > dist[far[1]][far[0]]) far = [i, j];
    const moves: [number, number, boolean][] = [[i + 1, j, i + 1 < N && !vW[j][i + 1]], [i - 1, j, i > 0 && !vW[j][i]], [i, j + 1, j + 1 < N && !hW[j + 1][i]], [i, j - 1, j > 0 && !hW[j][i]]];
    for (const [a, c, ok] of moves) if (ok && dist[c][a] < 0) { dist[c][a] = dist[j][i] + 1; par.set(`${a},${c}`, [i, j]); q.push([a, c]); }
  }
  const cell = (i: number, j: number): [number, number] => [-half + C * (i + 0.5), -half + C * (j + 0.5)];
  const hedge = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2);
  { const p = hedge.attributes.position; const rr = mulberry32(5); for (let k = 0; k < p.count; k++) p.setXYZ(k, p.getX(k) * (1 + (rr() - 0.5) * 0.08), p.getY(k) + (p.getY(k) > 0.4 ? (rr() - 0.5) * 0.08 : 0), p.getZ(k) * (1 + (rr() - 0.5) * 0.08)); hedge.computeVertexNormals(); }
  const wallH = () => 1.65 + r() * 0.25;
  for (let j = 0; j <= N; j++) for (let i = 0; i < N; i++) if (hW[j][i]) { const x = -half + C * (i + 0.5), z = -half + C * j; b.put(M.hedge, hedge, f, x, hf.at(...f.w(x, z)) - f.y + 0.8, z, 0, 0, 0, C + 0.85, wallH(), 0.85); b.solid(f, x, z, C + 0.85, 0.85); }
  for (let j = 0; j < N; j++) for (let i = 0; i <= N; i++) if (vW[j][i]) { const x = -half + C * i, z = -half + C * (j + 0.5); b.put(M.hedge, hedge, f, x, hf.at(...f.w(x, z)) - f.y + 0.8, z, 0, 0, 0, 0.85, wallH(), C + 0.85); b.solid(f, x, z, 0.85, C + 0.85); }
  // the original solver, parked in the deepest cell; its search trail drawn in chalk dots behind it
  const [gx, gz] = cell(far[0], far[1]);
  P.tinyRobot(b, f, gx, hf.at(...f.w(gx, gz)) - f.y, gz, 0.4, 1.6);
  const path: [number, number][] = []; let cur: [number, number] | undefined = far;
  while (cur) { path.push(cell(cur[0], cur[1])); cur = par.get(`${cur[0]},${cur[1]}`); }
  path.push([half + 1.5, -half + C * (entryRow + 0.5)]);
  const dots: THREE.Matrix4[] = [];
  for (let k = 0; k < path.length - 1; k++) { const [ax, az] = path[k], [cx, cz] = path[k + 1]; const n = Math.ceil(Math.hypot(cx - ax, cz - az) / 0.6); for (let s = 0; s < n; s++) { const [wx, wz] = f.w(ax + ((cx - ax) * s) / n, az + ((cz - az) * s) / n); dots.push(new THREE.Matrix4().makeTranslation(wx, hf.at(wx, wz) + 0.03, wz)); } }
  b.inst(new THREE.CircleGeometry(0.07, 8).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#e6e1d2', roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }), dots, false);
  // entrance: a lamp and a small plaque
  const E = f.sub(half + 2.5, 0, -half + C * (entryRow + 0.5) + 2.6, Math.PI / 2);
  P.lightPole(b, f, half + 3, -half + C * (entryRow + 0.5) - 3.2, 4.5, Math.PI, false, 7);
  b.sign(E, 0, 0.9, 0, 0, 1.2, 0.55, ['HEDGE MAZE', 'ORIGIN · SOLVER v1'], { bg: '#c9c2ae' });
  b.block(M.wood, f, 2.0, 0.08, 0.5, half + 4.5, 0.42, -half + C * (entryRow + 0.5) + 5.5); for (const sx of [-0.8, 0.8]) b.block(M.steelPaint, f, 0.06, 0.42, 0.45, half + 4.5 + sx, 0, -half + C * (entryRow + 0.5) + 5.5);
  return b.finish(parent);
}

export const _unused = weathered;
