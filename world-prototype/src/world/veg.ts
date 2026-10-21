import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Heightfield, NX, X0, Z0, POND } from '../heightfield';
import { Builder, Frame } from './kit';
import { M, weathered } from './materials';
import { Noise, mulberry32, clamp, smoothstep } from '../noise';

import { addCircle } from '../colliders';
import { bladeCluster } from './west';
import { floraMaterial, poplar, pine, acacia, shrub, broom, bunchgrass, forb } from './flora';
import { PADS } from '../layout';
import { RIVER_SPRINGS, FLOOR } from '../layout';

const nz = new Noise(808);

/** A lumpy organic blob: shrubs, canopies, boulders. Smooth-shaded, vertex-coloured bottom-to-top. */
function lumpy(seed: number, sx: number, sy: number, sz: number, jitter: number, bottom: string, top: string, detail = 1) {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position, cb = new THREE.Color(bottom), ct = new THREE.Color(top), col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + jitter * nz.n2(x * 1.7 + seed * 3.1 + z * 0.9, y * 1.7 - seed);
    p.setXYZ(i, x * k * sx, Math.max(y * k * sy, -0.25 * sy), z * k * sz);
    c.copy(cb).lerp(ct, clamp((y + 1) / 2)); col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** Angular boulder: a jittered low-detail icosahedron with flattened facets and a buried base. */
export function angular(seed: number, sx: number, sy: number, sz: number) {
  const r = mulberry32(seed);
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 0);
  g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color(), lo = new THREE.Color('#6b665d'), hi = new THREE.Color('#a39b8d');
  for (let i = 0; i < p.count; i++) {
    const k = 0.75 + r() * 0.5; let x = p.getX(i) * k * sx, y = p.getY(i) * k * sy, z = p.getZ(i) * k * sz;
    if (y > 0.35 * sy) y = 0.35 * sy + (y - 0.35 * sy) * 0.4; // a weathered flat top
    p.setXYZ(i, x, Math.max(y, -0.3 * sy), z);
    c.copy(lo).lerp(hi, clamp((p.getY(i) / sy + 0.3) / 0.9)); col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const ng = g.toNonIndexed(); ng.computeVertexNormals(); // faceted
  return ng;
}

function tree(seed: number) {
  const parts: THREE.BufferGeometry[] = [];
  const r = mulberry32(seed);
  const trunk = new THREE.CylinderGeometry(0.09, 0.16, 3.0, 7).translate(0, 1.5, 0);
  const tc = new Float32Array(trunk.attributes.position.count * 3); for (let i = 0; i < tc.length; i += 3) tc.set([0.22, 0.18, 0.14], i);
  trunk.setAttribute('color', new THREE.BufferAttribute(tc, 3)); trunk.deleteAttribute('uv');
  parts.push(trunk);
  for (let k = 0; k < 3; k++) {
    const b = lumpy(seed + k * 7, 1.3 + r() * 0.6, 0.9 + r() * 0.4, 1.3 + r() * 0.6, 0.3, '#1b2614', '#3b4d26');
    b.translate((r() - 0.5) * 1.4, 3.1 + k * 0.55 + r() * 0.3, (r() - 0.5) * 1.4); parts.push(b);
  }
  const out = mergeGeoms(parts); return out;
}
function mergeGeoms(parts: THREE.BufferGeometry[]) {
  const pos: number[] = [], nor: number[] = [], col: number[] = [], idx: number[] = []; let base = 0;
  for (const g of parts) {
    const gi = g.index ? g : mergeVertices(g);
    if (!gi.attributes.normal) gi.computeVertexNormals();
    const p = gi.attributes.position, n = gi.attributes.normal, c = gi.attributes.color;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.getX(i), c.getY(i), c.getZ(i)); }
    const ix = gi.index!; for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base);
    base += p.count;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  return g;
}

export function buildVegetation(hf: Heightfield, parent: THREE.Object3D) {
  const b = new Builder(hf, 'vegetation', 0);
  const r = mulberry32(31337);
  const veg = (x: number, z: number) => { const ix = Math.round(x - X0), iz = Math.round(z - Z0); return hf.splat3[(iz * NX + ix) * 4] / 255; };
  const moist = (x: number, z: number) => { const ix = Math.round(x - X0), iz = Math.round(z - Z0); return hf.splat3[(iz * NX + ix) * 4 + 1] / 255; };
  // instance density fades out over the last 50 m of the grid so it meets the bare far upland smoothly
  const edgeFade = (x: number, z: number) => smoothstep(4, 50, Math.min(296 - Math.abs(x), 396 - Math.abs(z)));
  const inBounds = (x: number, z: number) => x > -296 && x < 296 && z > -396 && z < 396 && r() < edgeFade(x, z);
  const m4 = (x: number, y: number, z: number, s: number, sy = s, ry = r() * Math.PI * 2, tilt = 0) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt * (r() - 0.5), ry, tilt * (r() - 0.5))), new THREE.Vector3(s, sy, s));

  const fl = floraMaterial();
  const at4 = (x: number, z: number) => (Math.round(z - Z0) * NX + Math.round(x - X0)) * 4;
  const occupiedAt = (x: number, z: number) => { const i = at4(x, z); return hf.splat[i] > 8 || hf.splat[i + 1] > 40 || hf.splat[i + 2] > 0 || hf.splat[i + 3] > 0; };
  const nearPad = (x: number, z: number, m: number) => PADS.some((p) => { const c = Math.cos(p.rot), sn = Math.sin(p.rot), lx = (x - p.x) * c + (z - p.z) * sn, lz = -(x - p.x) * sn + (z - p.z) * c; return Math.abs(lx) < p.hw + m && Math.abs(lz) < p.hd + m; });
  const grove = (x: number, z: number, f: number, o: number) => 0.5 + 0.5 * nz.fbm(x * f + o, z * f - o, 3);

  // ---- ground growth: G1 short tufts (green, where it is moist enough), G2 dry bunchgrass, G3 forbs near water
  const g1: THREE.Matrix4[] = [], g2: THREE.Matrix4[] = [], g3: THREE.Matrix4[] = [];
  const g1c: THREE.Color[] = [];
  for (let z = -396; z < 396; z += 2.4) for (let x = -296; x < 296; x += 2.4) {
    const jx = x + (r() - 0.5) * 2.3, jz = z + (r() - 0.5) * 2.3; if (!inBounds(jx, jz)) continue;
    const v = veg(jx, jz), m = moist(jx, jz); if (v < 0.18) continue;
    const y = hf.at(jx, jz) - 0.03;
    if (m > 0.32 && r() < v * 0.7) { g1.push(m4(jx, y, jz, 0.7 + r() * 0.6, 0.6 + r() * 0.7, undefined, 0.3)); g1c.push(new THREE.Color().setHSL(0.2 + r() * 0.05, 0.3 + r() * 0.12, 0.3 + r() * 0.12)); if (m > 0.6 && r() < 0.05) g3.push(m4(jx + 0.6, y, jz + 0.4, 0.8 + r() * 0.5, 0.8 + r() * 0.5)); }
    else if (r() < v * 0.42) g2.push(m4(jx, y, jz, 0.8 + r() * 0.6, 0.7 + r() * 0.6, undefined, 0.25));
  }
  const grassMat = new THREE.MeshStandardMaterial({ color: '#7d8a52', roughness: 0.9, side: THREE.DoubleSide });
  b.tiled(bladeCluster(8, 0.5, 0.22, 0.06, 4), grassMat, g1, { shadow: false, tile: 100, maxDist: 150, colors: g1c });
  b.tiled(bunchgrass(21), fl, g2, { shadow: false, tile: 100, maxDist: 170 });
  b.tiled(forb(5), fl, g3, { shadow: false, tile: 120, maxDist: 120 });

  // ---- shrubs: S1 saltbush on dry slopes, S2 broom on scree fans / gully mouths / verges, S3 juniper in hollows and rock
  const s1: THREE.Matrix4[] = [], s2: THREE.Matrix4[] = [], s3: THREE.Matrix4[] = [];
  for (let z = -396; z < 396; z += 5) for (let x = -296; x < 296; x += 5) {
    const jx = x + (r() - 0.5) * 4.6, jz = z + (r() - 0.5) * 4.6; if (!inBounds(jx, jz)) continue;
    const i = at4(jx, jz);
    if (hf.splat[i] > 8 || hf.splat[i + 2] > 0 || hf.splat[i + 3] > 0 || hf.splat2[i] > 150) continue;
    const v = veg(jx, jz), m = moist(jx, jz), sl = hf.slope(jx, jz), fan = hf.splat3[i + 3] / 255, gully = hf.splat3[i + 2] / 255;
    const cav = Math.max(0, hf.splat2[i + 1] / 255 - 0.5) * 2, verge = hf.splat[i + 1] / 255 * (hf.splat[i + 1] < 200 ? 1 : 0);
    const y = hf.at(jx, jz);
    if ((fan > 0.3 || verge > 0.25) && r() < 0.32 + 0.25 * fan) { const s = 0.7 + r() * 0.6; s2.push(m4(jx, y - 0.05, jz, s, s * (0.85 + r() * 0.4))); continue; }
    if ((cav > 0.25 || gully > 0.35 || sl > 0.45) && sl < 0.9 && r() < 0.12 + 0.35 * Math.max(cav, gully)) { const s = 0.7 + r() * 0.8; s3.push(m4(jx, y - 0.1, jz, s, s * (0.8 + r() * 0.5))); continue; }
    if (v > 0.22 && m < 0.55 && sl < 0.5 && r() < (v - 0.15) * 0.5 * grove(jx, jz, 0.02, 9)) { const s = 0.6 + r() * 0.9; s1.push(m4(jx, y - 0.08, jz, s * 1.1, s * (0.75 + r() * 0.4))); }
  }
  b.tiled(shrub(31, 'salt'), fl, s1, { tile: 150, maxDist: 420 });
  b.tiled(broom(37), fl, s2, { tile: 150, maxDist: 380 });
  b.tiled(shrub(41, 'juniper'), fl, s3, { tile: 150, maxDist: 450 });

  // ---- trees: T1 poplar follows water, T2 pine holds the rim in groves, T3 acacia stands alone on the mid slopes
  const tGeo = { poplar: [poplar(11), poplar(12)], pine: [pine(21), pine(22)], acacia: [acacia(31), acacia(32)] };
  const tM: Record<string, THREE.Matrix4[][]> = { poplar: [[], []], pine: [[], []], acacia: [[], []] };
  const taken: [number, number][] = [];
  const free = (x: number, z: number, d: number) => !taken.some(([a, c]) => Math.abs(a - x) < d && Math.abs(c - z) < d && Math.hypot(a - x, c - z) < d);
  const plant = (kind: 'poplar' | 'pine' | 'acacia', x: number, z: number, s: number, tilt = 0.06) => {
    tM[kind][r() < 0.5 ? 0 : 1].push(m4(x, hf.at(x, z) - 0.15, z, s, s * (0.9 + r() * 0.2), undefined, tilt));
    taken.push([x, z]); addCircle(x, z, 0.35 * s);
  };
  for (let z = -392; z < 392; z += 6) for (let x = -292; x < 292; x += 6) {
    const jx = x + (r() - 0.5) * 5.5, jz = z + (r() - 0.5) * 5.5; if (!inBounds(jx, jz)) continue;
    if (occupiedAt(jx, jz) || nearPad(jx, jz, 3) || hf.splat2[at4(jx, jz)] > 140) continue;
    const h = hf.at(jx, jz), m = moist(jx, jz), sl = hf.slope(jx, jz), v = veg(jx, jz);
    if (sl > 0.55) continue;
    if (m > 0.42 && h < 85 && r() < (m - 0.35) * 0.55 && free(jx, jz, 7)) { plant('poplar', jx, jz, 0.75 + r() * 0.45); continue; }
    if (h > 64 && v > 0.2 && grove(jx, jz, 0.011, 51) > 0.6 && r() < 0.28 && free(jx, jz, 5.5)) { plant('pine', jx, jz, 0.7 + r() * 0.55, 0.1); continue; }
    if (h > 14 && h < 80 && m < 0.4 && sl < 0.3 && v > 0.15 && r() < 0.012 && free(jx, jz, 30)) plant('acacia', jx, jz, 0.85 + r() * 0.35, 0.04);
  }
  // shelterbelt: a planted row of poplars on the windward (west-south-west) edge of the terraces
  for (let k = 0; k < 13; k++) {
    const a = 2.45 + k * 0.085, x = -178 + Math.cos(a) * 78, z = -118 + Math.sin(a) * 78 * 0.95;
    if (occupiedAt(x, z) || hf.slope(x, z) > 0.6) continue;
    plant('poplar', x + (r() - 0.5) * 0.6, z + (r() - 0.5) * 0.6, 0.9 + r() * 0.15, 0.02);
  }
  for (const k of ['poplar', 'pine', 'acacia'] as const) tM[k].forEach((list, i) => b.tiled(tGeo[k][i], fl, list, { tile: 300 }));
  console.log('flora', JSON.stringify({ poplar: tM.poplar[0].length + tM.poplar[1].length, pine: tM.pine[0].length + tM.pine[1].length, acacia: tM.acacia[0].length + tM.acacia[1].length, saltbush: s1.length, broom: s2.length, juniper: s3.length, grass: g1.length, bunchgrass: g2.length, forb: g3.length }));

  // ---- boulders: angular, rock-coloured; rockfall under steep ground, the Strata, and the cap-rock ledges
  const rockMat = weathered({ color: '#ffffff', vertexColors: true, roughness: 0.9 }, { grime: 0.6, streak: 0.4 });
  const rockGeo = [angular(5, 1, 0.7, 1.15), angular(9, 1.2, 0.55, 0.9)];
  const rocks: THREE.Matrix4[][] = [[], []];
  for (let z = -396; z < 396; z += 6) for (let x = -296; x < 296; x += 6) {
    const jx = x + (r() - 0.5) * 5.5, jz = z + (r() - 0.5) * 5.5; if (!inBounds(jx, jz)) continue;
    const i = at4(jx, jz);
    if (hf.splat[i] > 10 || hf.splat[i + 1] > 30 || hf.splat[i + 2] > 0 || hf.splat[i + 3] > 0) continue;
    const sl = hf.slope(jx, jz), cav = Math.max(0, hf.splat2[i + 1] / 255 - 0.5) * 2, strata = hf.splat2[i + 3] / 255, fan = hf.splat3[i + 3] / 255;
    // rockfall collects: under the Strata and ledges, on fans, in steep hollows. Open slopes stay mostly clean.
    const fall = nz.n2(jx * 0.03 + 7, jz * 0.03) > 0.25 ? 1 : 0.15;
    const p = (smoothstep(0.55, 0.85, sl) * 0.14 + cav * 0.08) * fall + strata * 0.45 + fan * 0.3;
    if (r() > p) continue;
    const s = 0.35 + r() * r() * 1.7;
    rocks[r() < 0.5 ? 0 : 1].push(m4(jx, hf.at(jx, jz) - 0.22 * s, jz, s, s * (0.75 + r() * 0.5), undefined, 0.7));
    if (s > 0.8) addCircle(jx, jz, s * 0.75);
  }
  rocks.forEach((list, k) => b.tiled(rockGeo[k], rockMat, list, { tile: 150, maxDist: 420 }));

  // reeds on stream banks and the pond margin
  const reeds: THREE.Matrix4[] = [];
  for (const rv of hf.rivers) for (let k = 0; k < rv.pts.length; k += 5) {
    const p = rv.pts[k], a = rv.pts[Math.max(0, k - 2)], c = rv.pts[Math.min(rv.pts.length - 1, k + 2)];
    let tx = c.x - a.x, tz = c.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    for (const side of [-1, 1]) {
      if (r() > 0.55) continue;
      const off = p.w * 0.62 + 0.4 + r() * 1.4, x = p.x - tz * side * off, z = p.z + tx * side * off;
      if (!inBounds(x, z) || hf.splatAt(x, z, 0) > 0.05 || hf.splatAt(x, z, 1) > 0.2) continue;
      reeds.push(m4(x, Math.max(hf.at(x, z), p.wl) - 0.05, z, 0.7 + r() * 0.6, 0.8 + r() * 0.6, undefined, 0.2));
    }
  }
  for (let k = 0; k < 140; k++) { const a = r() * Math.PI * 2, rr = POND.r * (0.95 + r() * 0.35), x = POND.x + Math.cos(a) * rr, z = POND.z + Math.sin(a) * rr; reeds.push(m4(x, Math.max(hf.at(x, z), hf.pondLevel) - 0.05, z, 0.8 + r() * 0.6, 0.9 + r() * 0.6, undefined, 0.2)); }
  const reedMat = new THREE.MeshStandardMaterial({ color: '#8a8a55', roughness: 0.9, side: THREE.DoubleSide });
  b.tiled(bladeCluster(10, 1.5, 0.12, 0.035, 8), reedMat, reeds, { tile: 120, maxDist: 240, shadow: false });

  // springs: each stream starts at a stone-lined seep
  RIVER_SPRINGS.forEach(([sx, sz], k) => {
    const y = hf.at(sx, sz), f = new Frame(sx, y, sz, k);
    const ring: THREE.Matrix4[] = [];
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const x = sx + Math.cos(a) * 1.8, z = sz + Math.sin(a) * 1.8; ring.push(m4(x, hf.at(x, z) - 0.1, z, 0.35 + r() * 0.2, 0.3)); }
    rocks[0].push(...ring);
    b.cyl(M.concreteDark, f, 0.07, 0.6, 0.6, 0.2, 0.3, Math.PI / 2, 0, 8);
  });
  b.inst(rockGeo[0], rockMat, rocks[0].slice(-RIVER_SPRINGS.length * 9), true);

  // survey transects: pegs with orange tape, running straight down the gradient toward the minimum
  const pegs: THREE.Matrix4[] = [], tapes: THREE.Matrix4[] = [];
  const starts: [number, number][] = [[-200, -250], [-250, 40], [210, -200], [250, 60], [-150, 330], [160, 330]];
  for (const [sx, sz] of starts) {
    const L = Math.hypot(FLOOR.x - sx, FLOOR.z - sz), n = Math.floor(L / 16);
    for (let k = 1; k < n - 2; k++) {
      const t = k / n, x = sx + (FLOOR.x - sx) * t, z = sz + (FLOOR.z - sz) * t;
      if (!inBounds(x, z) || hf.splatAt(x, z, 2) > 0 || hf.splatAt(x, z, 0) > 0.1) continue;
      const y = hf.at(x, z);
      pegs.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y + 0.3, z), new THREE.Quaternion(), new THREE.Vector3(0.05, 0.6, 0.05)));
      tapes.push(new THREE.Matrix4().compose(new THREE.Vector3(x + 0.03, y + 0.55, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, r() * 3, 0.2)), new THREE.Vector3(0.02, 0.28, 0.035)));
    }
  }
  const unit = new THREE.BoxGeometry(1, 1, 1);
  b.tiled(unit, M.wood, pegs, { shadow: false, maxDist: 170, tile: 200 }); b.tiled(unit, M.orange, tapes, { shadow: false, maxDist: 170, tile: 200 });

  // telegraph line down the Main Descent: poles every ~45 m, three sagging wires
  const main = hf.roads.find((q) => q.def.id === 'main')!;
  const poles: [number, number, number][] = [];
  let next = 10;
  for (let i = 0; i < main.pts.length; i++) {
    const p = main.pts[i]; if (p.s < next) continue; next = p.s + 45;
    const a = main.pts[Math.max(0, i - 3)], c = main.pts[Math.min(main.pts.length - 1, i + 3)];
    let tx = c.x - a.x, tz = c.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const x = p.x - tz * 7.5, z = p.z + tx * 7.5;
    if (hf.splatAt(x, z, 0) > 0.1 || hf.splatAt(x, z, 2) > 0.2) continue;
    poles.push([x, hf.at(x, z), z]);
  }
  const F0 = new Frame(0, 0, 0, 0);
  poles.forEach(([x, y, z], k) => {
    const nb = poles[Math.min(poles.length - 1, k + 1)], pv = poles[Math.max(0, k - 1)];
    const ang = Math.atan2(nb[0] - pv[0], nb[2] - pv[2]);
    const f = new Frame(x, y, z, ang);
    b.cyl(M.woodDark, f, 0.13, 8.2, 0, 4.0, 0, 0, 0, 8, 0.75);
    b.box(M.woodDark, f, 1.9, 0.12, 0.12, 0, 7.6, 0);
    for (const sx of [-0.8, 0, 0.8]) b.cyl(M.chalkPaint, f, 0.04, 0.16, sx, sx === 0 ? 8.15 : 7.72, 0, 0, 0, 6);
    addCircle(x, z, 0.25);
    if (k < poles.length - 1) {
      const g = new Frame(nb[0], nb[1], nb[2], Math.atan2(nb[0] - x, nb[2] - z));
      for (const sx of [-0.8, 0, 0.8]) {
        const [ax, az] = f.w(sx, 0), [bx, bz] = g.w(sx, 0), ay = y + (sx === 0 ? 8.2 : 7.8), by = nb[1] + (sx === 0 ? 8.2 : 7.8);
        const d = Math.hypot(bx - ax, bz - az);
        b.cable(M.steelDark, F0, [[ax, ay, az], [(ax + bx) / 2, (ay + by) / 2 - d * 0.03, (az + bz) / 2], [bx, by, bz]], 0.012);
      }
    }
  });
  return b.finish(parent);
}
