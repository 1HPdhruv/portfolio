import * as THREE from 'three';
import { mulberry32 } from '../noise';

/**
 * The Basin's plant family: three tree species, three shrub forms, three ground-growth forms.
 * Every plant is a real branch skeleton (tapered tubes) carrying clusters of alpha-cut leaf cards,
 * all sampling ONE canvas atlas through ONE material, so a species costs one draw call per tile.
 * Canopy normals are bent outward from the crown centre so card canopies shade as volumes.
 *
 *   T1 riparian poplar   tall, forked, clustered crown            streams, pond, low-moist ground
 *   T2 upland pine       twisted trunk, layered wind-flagged pads  rim and upper slopes, in groves
 *   T3 dryland acacia    low fork, flat spreading umbrella        mid slopes, scattered singletons
 *   S1 saltbush mound    low grey-green dome                       dry open slopes
 *   S2 broom             upright bundle of thin green stems        scree fans, gully mouths, verges
 *   S3 scrub juniper     dark compact, twiggy                      hollows, rock, gully floors
 *   G1 short grass, G2 dry bunchgrass, G3 flowering forb (rare, near water)
 */

// ------------------------------------------------------------------ atlas (1024 x 512)
// u 0.00-0.25  broadleaf cluster (poplar)     u 0.25-0.50  needle spray (pine)
// u 0.50-0.75  fine-leaf cluster (acacia)     u 0.75-1.00  shrub foliage (grey / dark)  [v split]
// bottom strip v 0.00-0.125: bark (u 0-.5) and stem (u .5-1) — opaque
const ATLAS = { W: 1024, H: 512 };
type Rect = [number, number, number, number]; // u0, v0, u1, v1
const R = {
  broad: [0.0, 0.14, 0.25, 1.0] as Rect,
  needle: [0.25, 0.14, 0.5, 1.0] as Rect,
  fine: [0.5, 0.14, 0.75, 1.0] as Rect,
  shrubGrey: [0.75, 0.57, 1.0, 1.0] as Rect,
  shrubDark: [0.75, 0.14, 1.0, 0.57] as Rect,
  bark: [0.0, 0.0, 0.5, 0.12] as Rect,
  stem: [0.5, 0.0, 1.0, 0.12] as Rect,
};

function makeAtlas() {
  const c = document.createElement('canvas'); c.width = ATLAS.W; c.height = ATLAS.H;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, ATLAS.W, ATLAS.H);
  const rnd = mulberry32(4711);
  const px = (r: Rect) => ({ x: r[0] * ATLAS.W, y: (1 - r[3]) * ATLAS.H, w: (r[2] - r[0]) * ATLAS.W, h: (r[3] - r[1]) * ATLAS.H });
  const hsl = (h: number, s: number, l: number) => `hsl(${h},${s}%,${l}%)`;
  // leaf clusters: many small leaves inside a soft, ragged outline (density falls off to the edge)
  // a card holds several separate sprays with sky gaps between them, so overlapping cards read as foliage
  const cluster = (r: Rect, leaf: (x: number, y: number, s: number) => void, n: number, edge = 0.46) => {
    const b = px(r), sub: [number, number, number][] = [];
    const k = 7 + Math.floor(rnd() * 3);
    for (let j = 0; j < k; j++) { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * (edge - 0.13); sub.push([0.5 + Math.cos(a) * d, 0.5 + Math.sin(a) * d, 0.07 + rnd() * 0.09]); }
    for (let i = 0; i < n; i++) {
      const [cx, cy, cr] = sub[i % k];
      const a = rnd() * Math.PI * 2, d = Math.abs(rnd() + rnd() + rnd() - 1.5) / 1.5 * cr; // peaked toward the spray centre
      const x = b.x + b.w * (cx + Math.cos(a) * d), y = b.y + b.h * (cy + Math.sin(a) * d);
      const outer = Math.hypot(cx + Math.cos(a) * d - 0.5, cy + Math.sin(a) * d - 0.5) / edge;
      leaf(x, y, Math.min(1, (1 - d / cr) * 0.6 + (1 - outer) * 0.4));
    }
  };
  // T1 broadleaf: ovate leaves, olive to sap green, darker inside
  cluster(R.broad, (x, y, s) => {
    g.save(); g.translate(x, y); g.rotate(rnd() * Math.PI * 2);
    g.fillStyle = hsl(78 + rnd() * 22, 28 + rnd() * 14, 18 + s * 16 + rnd() * 8);
    g.beginPath(); g.ellipse(0, 0, 3 + rnd() * 2.5, 6.5 + rnd() * 3.5, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }, 1700);
  // T2 needles: radiating short strokes in tufts, blue-green
  cluster(R.needle, (x, y, s) => {
    const n = 8 + Math.floor(rnd() * 6), a0 = rnd() * Math.PI * 2;
    g.strokeStyle = hsl(140 + rnd() * 25, 16 + rnd() * 10, 20 + s * 16 + rnd() * 6); g.lineWidth = 2.4;
    for (let k = 0; k < n; k++) { const a = a0 + (k / n) * Math.PI * 2, L = 6 + rnd() * 8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
  }, 1500);
  // T3 fine leaves: tiny dots in clumps, dusty olive
  cluster(R.fine, (x, y, s) => {
    g.fillStyle = hsl(70 + rnd() * 18, 22 + rnd() * 12, 22 + s * 18 + rnd() * 8);
    g.beginPath(); g.arc(x, y, 1.6 + rnd() * 2.2, 0, Math.PI * 2); g.fill();
  }, 3600, 0.47);
  // shrubs: grey-green saltbush, dark juniper
  cluster(R.shrubGrey, (x, y, s) => { g.fillStyle = hsl(85 + rnd() * 25, 10 + rnd() * 10, 30 + s * 18 + rnd() * 8); g.beginPath(); g.ellipse(x, y, 2 + rnd() * 1.6, 3 + rnd() * 2, rnd() * 3, 0, Math.PI * 2); g.fill(); }, 1500, 0.47);
  cluster(R.shrubDark, (x, y, s) => { g.strokeStyle = hsl(120 + rnd() * 30, 18 + rnd() * 10, 12 + s * 13 + rnd() * 5); g.lineWidth = 2; const a = rnd() * Math.PI * 2, L = 3 + rnd() * 5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }, 1900, 0.47);
  // bark: vertical fissures over grey-brown
  { const b = px(R.bark); g.fillStyle = '#4b4237'; g.fillRect(b.x, b.y, b.w, b.h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${20 + rnd() * 50},${18 + rnd() * 40},${14 + rnd() * 30},${0.25 + rnd() * 0.4})`; g.fillRect(b.x + rnd() * b.w, b.y + rnd() * b.h, 1 + rnd() * 2, 4 + rnd() * 18); } }
  { const b = px(R.stem); g.fillStyle = '#5e6a3e'; g.fillRect(b.x, b.y, b.w, b.h);
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${60 + rnd() * 40},${70 + rnd() * 40},${30 + rnd() * 20},0.5)`; g.fillRect(b.x + rnd() * b.w, b.y + rnd() * b.h, 1, 3 + rnd() * 10); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

let _mat: THREE.MeshStandardMaterial | null = null;
export function floraMaterial() {
  if (_mat) return _mat;
  _mat = new THREE.MeshStandardMaterial({ map: makeAtlas(), alphaTest: 0.42, side: THREE.DoubleSide, vertexColors: true, roughness: 0.92, metalness: 0 });
  // soften: canopy normals are already bent; add a little wrap lighting so backlit cards are not black
  _mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      // alpha-tested foliage loses coverage in lower mips (averaged alpha falls below the cutoff) and trees
      // turn to bare sticks at range. Rescale alpha by the mip level actually sampled.
      .replace('#include <map_fragment>', `#include <map_fragment>
        #ifdef USE_MAP
        { vec2 tsz = vec2(textureSize(map, 0)); vec2 dx = dFdx(vMapUv * tsz), dy = dFdy(vMapUv * tsz);
          float lod = max(0., 0.5 * log2(max(dot(dx, dx), dot(dy, dy))));
          diffuseColor.a *= 1. + lod * 0.32; }
        #endif`)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n reflectedLight.indirectDiffuse += diffuseColor.rgb * 0.06;');
  };
  return _mat;
}

// ------------------------------------------------------------------ geometry builder
class G {
  pos: number[] = []; nor: number[] = []; uv: number[] = []; col: number[] = []; idx: number[] = [];
  /** tapered tube from a to b, radii r0 -> r1, bark UVs */
  tube(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, seg = 5, rect: Rect = R.bark, shade = [0.9, 0.85, 0.8]) {
    const dir = b.clone().sub(a), len = dir.length(); dir.normalize();
    const t1 = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = t1.clone().cross(dir).normalize(), v = dir.clone().cross(u).normalize();
    const base = this.pos.length / 3;
    for (let ring = 0; ring < 2; ring++) {
      const c = ring ? b : a, r = ring ? r1 : r0;
      for (let k = 0; k <= seg; k++) {
        const ang = (k / seg) * Math.PI * 2, nx = Math.cos(ang), ny = Math.sin(ang);
        const n = u.clone().multiplyScalar(nx).add(v.clone().multiplyScalar(ny));
        this.pos.push(c.x + n.x * r, c.y + n.y * r, c.z + n.z * r); this.nor.push(n.x, n.y, n.z);
        this.uv.push(rect[0] + (rect[2] - rect[0]) * (k / seg), rect[1] + (rect[3] - rect[1]) * (ring ? Math.min(1, len / 3) : 0));
        this.col.push(shade[0], shade[1], shade[2]);
      }
    }
    for (let k = 0; k < seg; k++) { const a0 = base + k, b0 = base + k + 1, a1 = base + seg + 1 + k, b1 = a1 + 1; this.idx.push(a0, a1, b0, b0, a1, b1); }
  }
  /** leaf card centred at p, size w x h, oriented by a random basis; normals bent away from `centre` */
  card(p: THREE.Vector3, w: number, h: number, rect: Rect, rnd: () => number, centre: THREE.Vector3, tone: number, upright = false) {
    const e = new THREE.Euler(upright ? (rnd() - 0.5) * 0.5 : rnd() * Math.PI, rnd() * Math.PI * 2, upright ? (rnd() - 0.5) * 0.5 : rnd() * Math.PI);
    const q = new THREE.Quaternion().setFromEuler(e);
    const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(q).multiplyScalar(w / 2), ay = new THREE.Vector3(0, 1, 0).applyQuaternion(q).multiplyScalar(h / 2);
    const out = p.clone().sub(centre); const ol = out.length(); out.normalize();
    const cn = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const nrm = out.multiplyScalar(0.75).add(cn.multiplyScalar(0.25 * Math.sign(cn.dot(out) || 1))).add(new THREE.Vector3(0, 0.35, 0)).normalize();
    const base = this.pos.length / 3;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [sx, sy] of corners) {
      this.pos.push(p.x + ax.x * sx + ay.x * sy, p.y + ax.y * sx + ay.y * sy, p.z + ax.z * sx + ay.z * sy);
      this.nor.push(nrm.x, nrm.y, nrm.z);
      this.uv.push(sx < 0 ? rect[0] : rect[2], sy < 0 ? rect[1] : rect[3]);
      // interior of the crown is darker (self-shadowing)
      const ao = Math.min(1, 0.55 + 0.45 * Math.min(1, ol / 1.6)) * tone;
      this.col.push(ao, ao, ao);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx); g.computeBoundingSphere(); return g;
  }
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** T1 riparian poplar: a forked trunk with 3-4 ascending limbs, each carrying an irregular leaf mass. */
export function poplar(seed: number) {
  const r = mulberry32(seed), g = new G();
  const H = 7.5 + r() * 2.5, lean = V((r() - 0.5) * 0.6, 0, (r() - 0.5) * 0.6);
  const fork = V(lean.x * 0.4, H * 0.38, lean.z * 0.4);
  g.tube(V(0, -0.3, 0), fork, 0.24, 0.17, 6);
  const crownC = V(lean.x, H * 0.72, lean.z);
  const limbs = 3 + Math.floor(r() * 2);
  for (let k = 0; k < limbs; k++) {
    const a = (k / limbs) * Math.PI * 2 + r() * 0.8, spread = 0.9 + r() * 1.3;
    const tip = V(lean.x + Math.cos(a) * spread, H * (0.78 + r() * 0.2), lean.z + Math.sin(a) * spread);
    const mid = fork.clone().lerp(tip, 0.5).add(V(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3));
    g.tube(fork, mid, 0.14, 0.09, 5); g.tube(mid, tip, 0.09, 0.03, 4);
    // side twigs
    for (let t = 0; t < 2; t++) { const s = mid.clone().lerp(tip, 0.3 + r() * 0.4), b2 = s.clone().add(V((r() - 0.5) * 1.6, 0.4 + r() * 0.8, (r() - 0.5) * 1.6)); g.tube(s, b2, 0.04, 0.015, 3); }
    // leaf mass around the upper limb: 9-13 cards
    const n = 20 + Math.floor(r() * 6), mc = mid.clone().lerp(tip, 0.65);
    for (let i = 0; i < n; i++) {
      const p = mc.clone().add(V((r() - 0.5) * 2.4, (r() - 0.35) * 2.2, (r() - 0.5) * 2.4));
      const s = 1.0 + r() * 0.7; g.card(p, s, s, R.broad, r, crownC, 0.85 + r() * 0.2);
    }
  }
  // a few cards fill the crown centre
  for (let i = 0; i < 8; i++) { const p = crownC.clone().add(V((r() - 0.5) * 2, (r() - 0.5) * 1.6, (r() - 0.5) * 2)); g.card(p, 1.3, 1.3, R.broad, r, crownC, 0.68); }
  return g.build();
}

/** T2 upland pine: an S-curved trunk with near-horizontal limbs carrying flat needle pads, flagged downwind. */
export function pine(seed: number) {
  const r = mulberry32(seed), g = new G();
  const H = 5.5 + r() * 3, flag = V(0.9, 0, -0.3).normalize(); // prevailing wind blows toward ENE
  const pts = [V(0, -0.3, 0), V((r() - 0.5) * 0.6, H * 0.35, (r() - 0.5) * 0.6), V(flag.x * 0.5 + (r() - 0.5) * 0.4, H * 0.7, flag.z * 0.5), V(flag.x * 0.7, H, flag.z * 0.7)];
  const rad = [0.22, 0.16, 0.1, 0.04];
  for (let i = 0; i < 3; i++) g.tube(pts[i], pts[i + 1], rad[i], rad[i + 1], 5);
  const crownC = pts[2].clone();
  const tiers = 4 + Math.floor(r() * 3);
  for (let t = 0; t < tiers; t++) {
    const f = 0.32 + (t / tiers) * 0.66, y = H * f;
    const along = Math.floor(f * 3), base = pts[Math.min(2, along)].clone().lerp(pts[Math.min(3, along + 1)], (f * 3) % 1);
    const reach = (1 - f * 0.55) * (1.6 + r() * 1.1);
    const limbs = 2 + Math.floor(r() * 2);
    for (let k = 0; k < limbs; k++) {
      // limbs grow mostly downwind (wind-flagging), a few upwind and short
      const downwind = r() < 0.7;
      const a = Math.atan2(flag.z, flag.x) + (downwind ? (r() - 0.5) * 1.6 : Math.PI + (r() - 0.5) * 1.4);
      const L = reach * (downwind ? 1 : 0.5);
      const tip = V(base.x + Math.cos(a) * L, y + (r() - 0.3) * 0.4, base.z + Math.sin(a) * L);
      g.tube(V(base.x, y, base.z), tip, 0.06, 0.02, 3);
      // flat pad: several cards lying near-horizontal along the limb
      const pads = 3 + Math.floor(L * 1.4);
      for (let i = 0; i < pads; i++) {
        const p = V(base.x, y, base.z).lerp(tip, 0.35 + (i / pads) * 0.75).add(V((r() - 0.5) * 0.5, 0.15 + r() * 0.25, (r() - 0.5) * 0.5));
        const s = 1.2 + r() * 0.8; const q = new THREE.Euler(-Math.PI / 2 + (r() - 0.5) * 0.6, r() * Math.PI * 2, (r() - 0.5) * 0.6);
        const save = g.pos.length; g.card(p, s * 1.3, s, R.needle, () => 0.5, crownC, 0.8 + r() * 0.25);
        // re-orient last card to near-horizontal
        const qq = new THREE.Quaternion().setFromEuler(q), cx = p.x, cy = p.y, cz = p.z;
        for (let vi = save; vi < g.pos.length; vi += 3) { const v = V(g.pos[vi] - cx, g.pos[vi + 1] - cy, g.pos[vi + 2] - cz); v.set(v.x, 0, v.z).applyQuaternion(qq); v.y += (vi % 2) * 0.05; g.pos[vi] = cx + v.x; g.pos[vi + 1] = cy + v.y * 0.35; g.pos[vi + 2] = cz + v.z; }
      }
    }
  }
  return g.build();
}

/** T3 dryland acacia: low fork, 3-5 limbs spreading outward, one flat umbrella canopy with a ragged edge. */
export function acacia(seed: number) {
  const r = mulberry32(seed), g = new G();
  const H = 3.6 + r() * 1.6, forkY = 1.0 + r() * 0.5;
  const fork = V((r() - 0.5) * 0.3, forkY, (r() - 0.5) * 0.3);
  g.tube(V(0, -0.3, 0), fork, 0.2, 0.15, 6);
  const crownC = V(fork.x, H, fork.z);
  const limbs = 3 + Math.floor(r() * 3);
  const tips: THREE.Vector3[] = [];
  for (let k = 0; k < limbs; k++) {
    const a = (k / limbs) * Math.PI * 2 + r() * 0.9, reach = 1.6 + r() * 1.6;
    const tip = V(fork.x + Math.cos(a) * reach, H - 0.2 + r() * 0.5, fork.z + Math.sin(a) * reach);
    const elbow = fork.clone().lerp(tip, 0.45).add(V(Math.cos(a) * 0.4, -0.1, Math.sin(a) * 0.4));
    g.tube(fork, elbow, 0.12, 0.08, 5); g.tube(elbow, tip, 0.08, 0.03, 4); tips.push(tip);
  }
  // umbrella: a thin layer of near-horizontal cards over the limb tips; ragged rim
  const rad = 2.4 + r() * 1.2;
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad;
    const p = V(crownC.x + Math.cos(a) * d, H + 0.2 + (r() - 0.5) * 0.35 - (d / rad) * 0.25, crownC.z + Math.sin(a) * d);
    const s = 1.0 + r() * 0.7, save = g.pos.length;
    g.card(p, s, s * 0.9, R.fine, r, V(crownC.x, H - 1.2, crownC.z), 0.8 + r() * 0.3);
    const cx = p.x, cy = p.y, cz = p.z;
    for (let vi = save; vi < g.pos.length; vi += 3) g.pos[vi + 1] = cy + (g.pos[vi + 1] - cy) * 0.22;
  }
  return g.build();
}

/** S1 saltbush mound / S3 scrub juniper: low clusters of cards around short twigs. */
export function shrub(seed: number, kind: 'salt' | 'juniper') {
  const r = mulberry32(seed), g = new G();
  const rect = kind === 'salt' ? R.shrubGrey : R.shrubDark;
  const W = kind === 'salt' ? 1.1 : 0.9, H = kind === 'salt' ? 0.75 : 1.1;
  const c = V(0, H * 0.45, 0);
  for (let t = 0; t < 5; t++) { const a = r() * Math.PI * 2; g.tube(V(0, -0.1, 0), V(Math.cos(a) * W * 0.5, H * (0.5 + r() * 0.4), Math.sin(a) * W * 0.5), 0.035, 0.012, 3, R.bark, [0.6, 0.55, 0.5]); }
  const n = kind === 'salt' ? 16 : 18;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * W * 0.55;
    const p = V(Math.cos(a) * d, H * (0.3 + r() * 0.6) * (1 - 0.4 * d / W), Math.sin(a) * d);
    const s = (kind === 'salt' ? 0.55 : 0.5) + r() * 0.35;
    g.card(p, s, s * (kind === 'juniper' ? 1.3 : 0.9), rect, r, c, 0.8 + r() * 0.3, kind === 'juniper');
  }
  return g.build();
}

/** S2 broom: an upright bundle of thin green stems (no leaves), very readable at mid distance. */
export function broom(seed: number) {
  const r = mulberry32(seed), g = new G();
  const n = 22;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, lean = 0.12 + r() * 0.35, L = 0.9 + r() * 0.8;
    const base = V(Math.cos(a) * 0.08, -0.05, Math.sin(a) * 0.08), tip = V(Math.cos(a) * lean * L, L, Math.sin(a) * lean * L);
    g.tube(base, tip, 0.016, 0.006, 3, R.stem, [0.95, 1, 0.9]);
  }
  return g.build();
}

/** G2 dry bunchgrass: arching straw blades (cards use the stem strip, alpha-free so drawn as thin quads). */
export function bunchgrass(seed: number) {
  const r = mulberry32(seed), g = new G();
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2, L = 0.45 + r() * 0.45, out = 0.15 + r() * 0.3;
    const b = V(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04), m = V(Math.cos(a) * out * 0.5, L * 0.7, Math.sin(a) * out * 0.5), t = V(Math.cos(a) * out, L * (0.85 + r() * 0.2), Math.sin(a) * out);
    g.tube(b, m, 0.012, 0.008, 2, R.stem, [1.25, 1.12, 0.78]); g.tube(m, t, 0.008, 0.002, 2, R.stem, [1.3, 1.18, 0.8]);
  }
  return g.build();
}

/** G3 flowering forb: a few stems with pale seed heads. Rare; only near water. */
export function forb(seed: number) {
  const r = mulberry32(seed), g = new G();
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2, L = 0.35 + r() * 0.35, tip = V(Math.cos(a) * 0.12, L, Math.sin(a) * 0.12);
    g.tube(V(0, 0, 0), tip, 0.008, 0.004, 2, R.stem, [0.9, 1, 0.8]);
    g.card(tip, 0.07, 0.07, R.shrubGrey, r, V(0, 0, 0), 2.2);
  }
  return g.build();
}
