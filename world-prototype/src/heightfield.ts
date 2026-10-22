// The Basin's terrain: a deterministic heightfield with zone pads, terraces, an escarpment,
// carved rivers and road cut/fill baked in. Pure TS (no three) so tools can run it headless.
import { Noise, clamp, smoothstep, lerp, mulberry32 } from './noise';
import { PADS, ROADS, RIVER_SPRINGS, FLOOR, BOUNDS, ESCARPMENTS, padSD as padSDOf, padRadius, type RoadDef } from './layout';

export const SEED = 1729;
export const X0 = BOUNDS.x0, Z0 = BOUNDS.z0;
export const NX = BOUNDS.x1 - BOUNDS.x0 + 1, NZ = BOUNDS.z1 - BOUNDS.z0 + 1;
export const RIM = 100;
/** settling pond where the Watershed drains, just north of the Research Station */
export const POND = { x: -22, z: 232, r: 17 };

export interface RoadSample { x: number; z: number; y: number; s: number; }
export interface RoadPath { def: RoadDef; pts: RoadSample[]; }
export interface RiverPt { x: number; z: number; wl: number; w: number; }
export interface RiverPath { id: number; pts: RiverPt[]; joinsAt?: { river: number; idx: number }; }

const noise = new Noise(SEED);

/** Agri Terraces: contour benches quantised from the natural slope. */
export const TERRACE = { TX: -178, TZ: -118, TR: 82, STEP: 2.5, ROW: 0.9 };
/** Field-trial treatments. 0 = natural (benches fading into the hillside). */
export const TREAT = { NONE: 0, YOUNG: 1, MID: 2, RIPE: 3, FALLOW: 4, LEY: 5 } as const;
const hq = (a: number, b: number) => { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v); };
/**
 * Randomised complete block design: every bench is a block holding each of the five treatments once, in a
 * seeded order, repeated along the bench. Plot lengths vary per bench (17-29 m). The outer ring of benches is
 * a sown-grass guard margin; beyond it the benches fade back into natural hillside.
 */
/** Per-bench plot design (length, offset, treatment order). The terrain shader receives the same table. */
export function benchDesign(q: number) {
  const L = 17 + 12 * hq(q, 1), off = hq(q, 2) * L;
  const order = [TREAT.YOUNG, TREAT.MID, TREAT.RIPE, TREAT.FALLOW, TREAT.LEY] as number[];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(hq(q * 7.3 + i, 3) * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return { L, off, order };
}
/** bench indices that exist in the terrace area (shader table range) */
export const BENCH_Q0 = 0, BENCH_N = 64;
export function plotTreatment(q: number, along: number, tw: number): { code: number; edge: number; plot: number } {
  if (tw < 0.5) return { code: TREAT.NONE, edge: 99, plot: 0 };
  const { L, off, order } = benchDesign(q), u = (along + off) / L, p = Math.floor(u), fu = u - p;
  const edge = Math.min(fu, 1 - fu) * L;
  if (tw < 0.7) return { code: TREAT.LEY, edge: 99, plot: p };
  return { code: order[((p % 5) + 5) % 5], edge, plot: p };
}

/** The upland the Basin is cut into (also drives the outer far-terrain mesh). */
const pnoise = new Noise(4242);
export function plateauHeight(x: number, z: number): number {
  const ex = Math.max(Math.abs(x) - 300, 0), ez = Math.max(Math.abs(z) - 400, 0), e = Math.hypot(ex, ez);
  // rolling upland
  let h = 118 + 12 * pnoise.fbm(x * 0.004, z * 0.004, 4) + 6 * pnoise.fbm(x * 0.02, z * 0.02, 3);
  // broad valleys draining away from the Basin (inverted ridged noise), deepening with distance
  h -= 30 * Math.pow(1 - pnoise.ridged(x * 0.0013 + 11, z * 0.0013 - 5, 3), 1.4) * smoothstep(160, 900, e);
  // distant ranges: ridged massifs that rise with distance
  h += 300 * Math.pow(pnoise.ridged(x * 0.0011 + 3, z * 0.0011, 4), 1.6) * smoothstep(260, 1500, e);
  return h;
}

/** Broad basin function + noise + authored features. `pits` adds the local minima (not used for river routing). */
export function baseHeight(x: number, z: number, pits = true): number {
  // asymmetric elliptical bowl: long gentle north slope, short steep south wall
  const dx = x / 300;
  const dz = z < FLOOR.z ? (z - FLOOR.z) / 680 : (z - FLOOR.z) / 108;
  const d0 = Math.sqrt(dx * dx + dz * dz);
  // the rim is not a perfect ellipse: bays and spurs vary its reach (walls only, not the slopes the sites sit on)
  const ang = Math.atan2(dz, dx);
  const rimN = noise.fbm(Math.cos(ang) * 1.8 + 31, Math.sin(ang) * 1.8 - 17, 3);
  const d = d0 * (1 + 0.075 * rimN * smoothstep(0.62, 0.95, d0));
  let f = d < 1 ? Math.pow(d, 1.55) : 1 + (d - 1) * 1.4;
  let h = RIM * f;

  // domain-warped ridged noise: ravines, spurs, saddles (amplitude grows with distance from the minimum)
  const wx = x + 38 * noise.n2(x * 0.006 + 11, z * 0.006), wz = z + 38 * noise.n2(x * 0.006 - 7, z * 0.006 + 3);
  const amp = 12 * smoothstep(0.08, 0.55, d);
  h += amp * (noise.ridged(wx * 0.0068, wz * 0.0068, 4) - 0.42);
  h += 1.5 * noise.fbm(x * 0.018, z * 0.018, 3) * smoothstep(0.05, 0.4, d);

  // loss-surface ripples: low, wide undulations that make saddles and shallow basins
  h += 3.4 * Math.sin(x * 0.026 + 1.3 * noise.n2(z * 0.01, 4)) * Math.sin(z * 0.019 + 2 + 0.8 * noise.n2(x * 0.01, 9)) * smoothstep(0.1, 0.5, d);

  // northern crest: the rim is a broad shoulder, highest where the Signal Tower stands
  h += 14 * Math.exp(-(((x - 70) / 130) ** 2 + ((z + 345) / 70) ** 2));
  // Benchmark Ridge: a rock spine between the west slope and the descent
  h += 13 * Math.exp(-(((x + 70) / 14) ** 2 + ((z - 40) / 70) ** 2));
  // global minimum: the floor drops into a deep pit
  h -= 9 * Math.exp(-(((x - FLOOR.x) ** 2 + (z - FLOOR.z) ** 2) / (2 * 55 * 55)));
  // buttresses: rock spurs that break the south amphitheatre wall into bays
  h += 11 * Math.exp(-(((x + 112) / 17) ** 2 + ((z - 338) / 34) ** 2));
  h += 9 * Math.exp(-(((x - 78) / 15) ** 2 + ((z - 342) / 30) ** 2));
  h += 8 * Math.exp(-(((x - 178) / 20) ** 2 + ((z - 300) / 36) ** 2));
  h += 6 * Math.exp(-(((x + 205) / 22) ** 2 + ((z - 262) / 30) ** 2));

  if (pits) {
    // shallow local minima: false valleys
    { const r2 = (x + 95) ** 2 + (z + 150) ** 2; h -= 6.5 * Math.exp(-r2 / (2 * 15 * 15)) + 3.2 * Math.exp(-r2 / (2 * 6.5 * 6.5)); } // THE Local Minimum: a broad false valley with a neat pit
    h -= 4.5 * Math.exp(-(((x - 70) ** 2 + (z - 120) ** 2) / (2 * 22 * 22)));
    h -= 5 * Math.exp(-(((x + 120) ** 2 + (z - 120) ** 2) / (2 * 20 * 20)));
  }
  h = Math.max(h + 9, -4); // +9: floor sits at ~0 m
  // the bowl meets the surrounding upland; the playable edge is hidden inside that blend
  const e = Math.max(Math.abs(x) / 300, Math.abs(z) / 400);
  const wob = 0.05 * noise.n2(x * 0.008, z * 0.008);
  const w = Math.max(smoothstep(0.8 + wob, 0.99 + wob, d), smoothstep(0.95, 0.998, e));
  return w <= 0 ? h : lerp(h, plateauHeight(x, z), w);
}

/** Vegetation density for the upland outside the surveyed grid: the in-Basin bake without streams. */
export function uplandVeg(x: number, z: number, h: number, slope: number): number {
  const patch = 0.5 + 0.5 * noise.fbm(x * 0.012 + 40, z * 0.012, 4);
  return clamp(patch * 0.95 - 0.18) * (1 - smoothstep(0.55, 1.0, slope)) * (1 - 0.35 * smoothstep(95, 125, h)) * (1 - smoothstep(170, 320, h));
}

export class Heightfield {
  h = new Float32Array(NX * NZ);
  /** R: paved road, G: dirt trail/gravel shoulder, B: hardstand, A: tilled field */
  splat = new Uint8Array(NX * NZ * 4);
  /** R: wet bank, G: curvature (0.5 = flat, >0.5 hollow, <0.5 convex), B: terrace mask, A: strata mask */
  splat2 = new Uint8Array(NX * NZ * 4);
  /** R: vegetation density (shared by the terrain shader and instanced plants), G: moisture, B: gully floor / scree fan */
  splat3 = new Uint8Array(NX * NZ * 4);
  /** main road: R lateral distance from the centreline (0..255 = 0..8 m), G road band mask, B cut side */
  splat4 = new Uint8Array(NX * NZ * 4);
  /**
   * Agri Terraces, linear-filtered. R = f, the fractional height within the bench (0 at the lip), G = slope
   * magnitude g of the natural surface, B plot headland, A tread mask. Both f and g vary slowly, so they survive
   * 1 m texels; the shader rebuilds the across-bench distance f·STEP/g per pixel and draws 0.9 m crop rows from it.
   */
  splat5 = new Uint8Array(NX * NZ * 4);
  /** Agri Terraces: R bench index q (sampled nearest) */
  splat6 = new Uint8Array(NX * NZ * 4);
  /** Agri Terraces, float (uploaded as half-float, linear): R = bench fraction f, G = bench step width STEP/g in metres */
  benchF = new Float32Array(NX * NZ * 4);
  /** natural surface before terracing (terrace geometry is derived from it) */
  private terr0 = new Float32Array(0);
  roads: RoadPath[] = [];
  rivers: RiverPath[] = [];
  pondLevel = 0;
  padTarget = new Map<string, { ch: number; gx: number; gz: number }>();

  constructor() {
    const T = (n: string, t0 = performance.now()) => () => { if (typeof process !== 'undefined' && process.env.HF_TIMING) console.log(n, (performance.now() - t0).toFixed(0), 'ms'); };
    let e = T('base'); this.buildBase(); e();
    e = T('features'); this.applyFeatures(); e();
    e = T('erosion'); this.carveGullies(); e();
    e = T('rivers'); this.carveRivers(); this.reflattenPads(); e();
    e = T('roads'); for (const r of ROADS) this.carveRoad(r); e();
    e = T('pads+cavity'); this.paintPads(); this.bakeCavity(); e();
    e = T('vegetation'); this.bakeVegetation(); e();
  }

  idx(ix: number, iz: number) { return iz * NX + ix; }

  private buildBase() {
    for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) this.h[this.idx(ix, iz)] = baseHeight(X0 + ix, Z0 + iz);
  }

  /** Terrace geometry at any point: bench index, position across the tread, treatment and plot edge. */
  benchInfo(x: number, z: number) {
    const { TX, TZ, TR, STEP } = TERRACE;
    const fx = clamp(x - X0, 0, NX - 1.001), fz = clamp(z - Z0, 0, NZ - 1.001);
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz, i = iz * NX + ix, a = this.terr0;
    const h0 = lerp(lerp(a[i], a[i + 1], tx), lerp(a[i + NX], a[i + NX + 1], tx), tz);
    // the bench direction and width come from the slope over ±3 m (a one-texel gradient jumps cell to cell and
    // would break the rows into stripes); bilinear on the natural surface keeps it continuous
    const s0 = (px: number, pz: number) => { const fx2 = clamp(px - X0, 0, NX - 1.001), fz2 = clamp(pz - Z0, 0, NZ - 1.001), jx = Math.floor(fx2), jz = Math.floor(fz2), ux = fx2 - jx, uz = fz2 - jz, k = jz * NX + jx; return lerp(lerp(a[k], a[k + 1], ux), lerp(a[k + NX], a[k + NX + 1], ux), uz); };
    const E = 3, gx = (s0(x + E, z) - s0(x - E, z)) / (2 * E), gz = (s0(x, z + E) - s0(x, z - E)) / (2 * E);
    const g = Math.max(Math.hypot(gx, gz), 0.06);
    const hh = h0 + 0.7 * noise.n2(x * 0.025, z * 0.025);
    const q = Math.floor(hh / STEP), f = hh / STEP - q;
    const tw = 1 - smoothstep(TR * 0.62, TR, Math.hypot((x - TX) * 0.85, z - TZ));
    // along-bench coordinate: arc length around the basin floor (benches are near-concentric about it)
    const along = Math.atan2(z - FLOOR.z, x - FLOOR.x) * 440; // plot boundaries are radial lines, i.e. across the benches
    const t = plotTreatment(q, along, tw), treadW = (0.6 * STEP) / g;
    // benches too narrow to work with a planter (< 2.6 m) are kept in sown grass, as on any steep terrace system
    if (treadW < 2.6 && t.code !== TREAT.NONE) t.code = TREAT.LEY;
    return { q, f, hh, tw, g, across: (f * STEP) / g, treadW, along, code: t.code, edge: t.edge, plot: t.plot, gx: gx / g, gz: gz / g };
  }
  /** a point on bench q at fractional bench height fq, on the radial line through `along` (bisection on the natural surface) */
  benchPoint(q: number, fq: number, along: number): [number, number] | null {
    const target = (q + fq) * TERRACE.STEP;
    const r0 = 440, th = along / r0; // along was arc length at roughly this radius; re-derive the angle
    let best: [number, number] | null = null;
    let lo = 330, hi = 560;
    const hAt = (r: number) => { const x = FLOOR.x + Math.cos(th) * r, z = FLOOR.z + Math.sin(th) * r; return this.benchInfo(x, z).hh; };
    if ((hAt(lo) - target) * (hAt(hi) - target) > 0) return null;
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if ((hAt(lo) - target) * (hAt(m) - target) <= 0) hi = m; else lo = m; }
    const r = (lo + hi) / 2; best = [FLOOR.x + Math.cos(th) * r, FLOOR.z + Math.sin(th) * r];
    return best;
  }

  /** bilinear height */
  at(x: number, z: number): number {
    const fx = clamp(x - X0, 0, NX - 1.001), fz = clamp(z - Z0, 0, NZ - 1.001);
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
    const i = iz * NX + ix, h = this.h;
    return lerp(lerp(h[i], h[i + 1], tx), lerp(h[i + NX], h[i + NX + 1], tx), tz);
  }
  normal(x: number, z: number, out: [number, number, number] = [0, 1, 0]) {
    const e = 1.0;
    const hx = this.at(x + e, z) - this.at(x - e, z), hz = this.at(x, z + e) - this.at(x, z - e);
    const l = Math.hypot(hx, 2 * e, hz);
    out[0] = -hx / l; out[1] = 2 * e / l; out[2] = -hz / l; return out;
  }
  slope(x: number, z: number) { return Math.acos(clamp(this.normal(x, z)[1])); }
  splatAt(x: number, z: number, c: number): number {
    const ix = clamp(Math.round(x - X0), 0, NX - 1), iz = clamp(Math.round(z - Z0), 0, NZ - 1);
    return this.splat[(iz * NX + ix) * 4 + c] / 255;
  }

  // ---------------------------------------------------------------- pads, terraces, escarpment
  private applyFeatures() {
    // Agri terraces: height quantised into contour-parallel benches with stone risers
    const { TX, TZ, TR, STEP } = TERRACE;
    this.terr0 = this.h.slice();
    for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) {
      const x = X0 + ix, z = Z0 + iz, i = this.idx(ix, iz);
      let h = this.h[i];
      const tw = 1 - smoothstep(TR * 0.62, TR, Math.hypot((x - TX) * 0.85, z - TZ));
      // cap-rock ledges: a few hard beds outcrop along the walls as broken rims. They follow the contours
      // (beds are near-horizontal), vary in thickness, and break laterally; gullies later cut through them.
      {
        const bx = x / 300, bz = z < FLOOR.z ? (z - FLOOR.z) / 680 : (z - FLOOR.z) / 108;
        const dd = Math.hypot(bx, bz), ang = Math.atan2(bz, bx);
        const er = Math.max(Math.abs(x) / 300, Math.abs(z) / 400);
        const wallM = smoothstep(0.5, 0.68, dd) * (1 - smoothstep(0.86, 0.97, dd)) * (1 - tw) * (1 - smoothstep(0.84, 0.93, er));
        if (wallM > 0) {
          const sc = h / 13 + 0.35 * noise.n2(h * 0.07 + 3, ang * 2.2);
          const id = Math.floor(sc), f = sc - id;
          const hard = (Math.sin(id * 12.9898) * 43758.5453) % 1;
          if (Math.abs(hard) > 0.62) {
            const cont = smoothstep(0.52, 0.7, 0.5 + 0.5 * noise.fbm(ang * 9 + id * 7.3, id * 1.7 + dd * 3, 2));
            const A = 2.1 * (0.5 + 0.9 * Math.abs(hard)) * (0.7 + 0.6 * noise.n2(ang * 23 + id, dd * 11));
            h += A * (smoothstep(0, 0.14, f) - f) * wallM * cont;
            if (cont * wallM > 0.3 && f < 0.2) this.splat2[i * 4 + 3] = Math.max(this.splat2[i * 4 + 3], Math.round(90 * cont * wallM));
          }
        }
      }
      if (tw > 0) {
        const hh = h + 0.7 * noise.n2(x * 0.025, z * 0.025); // gently wandering, hand-built bench lines
        const q = Math.floor(hh / STEP), f = hh / STEP - q;
        const hq = (q + smoothstep(0.6, 1.0, f)) * STEP;
        h = lerp(h, hq - 0.3, tw);
        this.splat2[i * 4 + 2] = Math.round(255 * tw);
        const bi = this.benchInfo(x, z);
        const o = i * 4;
        this.splat5[o] = Math.round(255 * clamp(bi.f)); this.splat5[o + 1] = Math.round(255 * clamp(bi.g));
        this.benchF[o] = bi.f; this.benchF[o + 1] = TERRACE.STEP / Math.max(bi.g, 0.06);
        this.splat6[o] = clamp(bi.q - BENCH_Q0, 0, BENCH_N - 1); // bench index (nearest); codes are computed per pixel
        this.splat5[o + 2] = Math.round(255 * (1 - smoothstep(1.0, 1.7, bi.edge))); // ~2 m access path between plots
        this.splat5[o + 3] = Math.round(255 * clamp((0.9 - bi.f) / 0.25)); // 'not upper riser' as a continuous ramp (no texel staircase); 0 near the lip wrap
        // every treated tread is managed ground: no wild plants there
        if (bi.code !== TREAT.NONE && bi.f < 0.6) this.splat[o + 3] = Math.max(this.splat[o + 3], Math.round(255 * smoothstep(0.5, 0.6, tw)));
      }
      for (const e of ESCARPMENTS) {
        const ex = e.x2 - e.x1, ez = e.z2 - e.z1, L = Math.hypot(ex, ez), ux = ex / L, uz = ez / L;
        const t = ((x - e.x1) * ux + (z - e.z1) * uz) / L, v = (x - e.x1) * uz - (z - e.z1) * ux; // +v: east side
        // a fault-block ridge: sheer face on the west (road side), long back-slope to the east, tapered ends
        const edge = smoothstep(-0.05, 0.22, t) * smoothstep(1.05, 0.8, t);
        const ww = e.w * (1 + 0.5 * noise.n2(x * 0.05, z * 0.05));
        const vv = v + 3 * noise.n2(x * 0.03, z * 0.03);
        const crest = 1 + 0.22 * noise.fbm(t * 9 + 5, 0.5, 3) + 0.12 * noise.n2(x * 0.09, z * 0.09);
        const notch = 1 - 0.35 * smoothstep(0.55, 0.9, noise.ridged(t * 6.5 + 2, 1.7, 2));
        h += e.h * crest * notch * smoothstep(-ww, ww, vv) * (1 - smoothstep(10, 70, vv + 8 * noise.n2(x * 0.02, z * 0.02))) * edge;
        const sm = edge * (1 - smoothstep(4, 16, Math.abs(vv)));
        if (sm > 0) this.splat2[i * 4 + 3] = Math.max(this.splat2[i * 4 + 3], Math.round(255 * sm));
      }
      this.h[i] = h;
    }
    // pads, one at a time so later pads sit on earlier ones (e.g. Init on the rim bench)
    for (const p of PADS) {
      const ch = p.h ?? this.at(p.x, p.z);
      const gx = (this.at(p.x + 6, p.z) - this.at(p.x - 6, p.z)) / 12 * (p.tilt ?? 0), gz = (this.at(p.x, p.z + 6) - this.at(p.x, p.z - 6)) / 12 * (p.tilt ?? 0);
      this.padTarget.set(p.id, { ch, gx, gz });
      const R = padRadius(p) + p.fall + 2;
      for (let iz = Math.max(0, Math.floor(p.z - R - Z0)); iz <= Math.min(NZ - 1, Math.ceil(p.z + R - Z0)); iz++) for (let ix = Math.max(0, Math.floor(p.x - R - X0)); ix <= Math.min(NX - 1, Math.ceil(p.x + R - X0)); ix++) {
        const x = X0 + ix, z = Z0 + iz, i = this.idx(ix, iz);
        const { sd, fall } = padSDOf(p, x, z);
        const w = 1 - smoothstep(0, fall, sd);
        if (w > 0) this.h[i] = lerp(this.h[i], ch + gx * (x - p.x) + gz * (z - p.z), w);
      }
    }
  }

  /**
   * Erosion: rills and gullies traced downhill on the basin walls, carved as V/U channels whose depth
   * grows with length, ending in scree fans where the slope eases. Deterministic, ~1-2k traces.
   */
  private carveGullies() {
    const r = mulberry32(SEED ^ 0x5bd1e995);
    const h0 = this.h.slice();
    // routing field: lightly blurred
    const sm = new Float32Array(h0.length);
    { const t = new Float32Array(h0.length), R = 2;
      for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) { let s = 0; for (let k = -R; k <= R; k++) s += h0[iz * NX + clamp(ix + k, 0, NX - 1)]; t[iz * NX + ix] = s / (2 * R + 1); }
      for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) { let s = 0; for (let k = -R; k <= R; k++) s += t[clamp(iz + k, 0, NZ - 1) * NX + ix]; sm[iz * NX + ix] = s / (2 * R + 1); } }
    const at = (a: Float32Array, x: number, z: number) => {
      const fx = clamp(x - X0, 0, NX - 1.001), fz = clamp(z - Z0, 0, NZ - 1.001), ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz, i = iz * NX + ix;
      return lerp(lerp(a[i], a[i + 1], tx), lerp(a[i + NX], a[i + NX + 1], tx), tz);
    };
    const padSD = (x: number, z: number) => {
      let best = 1e9;
      for (const p of PADS) best = Math.min(best, padSDOf(p, x, z).sd);
      return best;
    };
    const excluded = (x: number, z: number) => {
      if (x < X0 + 14 || x > X0 + NX - 15 || z < Z0 + 14 || z > Z0 + NZ - 15) return true;
      const i = (Math.round(z - Z0) * NX + Math.round(x - X0)) * 4;
      if (this.splat2[i + 2] > 8 || this.splat2[i + 3] > 120) return true; // terraces, the Strata face
      if (Math.hypot(x + 95, z + 150) < 30) return true;                   // keep the Local Minimum clean
      return padSD(x, z) < 10;
    };
    const mask = this.splat3; // B channel: gully floor / fan
    const carve = (x: number, z: number, depth: number, hw: number) => {
      const hc = at(h0, x, z), R = hw + 0.8;
      for (let iz = Math.max(0, Math.floor(z - R - Z0)); iz <= Math.min(NZ - 1, Math.ceil(z + R - Z0)); iz++) for (let ix = Math.max(0, Math.floor(x - R - X0)); ix <= Math.min(NX - 1, Math.ceil(x + R - X0)); ix++) {
        const d = Math.hypot(X0 + ix - x, Z0 + iz - z); if (d > R) continue;
        const prof = d < hw ? 1 - (d / hw) ** 1.6 : 0;
        const t = hc - depth * prof - (d >= hw ? 0 : 0), i = iz * NX + ix;
        if (t < this.h[i]) this.h[i] = t;
        const m = Math.round(255 * clamp(prof * Math.min(1, depth / 1.2)));
        if (m > mask[i * 4 + 2]) mask[i * 4 + 2] = m;
      }
    };
    const fans: { x: number; z: number; R: number }[] = [];
    const fan = (x: number, z: number, dx: number, dz: number, size: number) => {
      let R = clamp(3 + 0.11 * size, 3, 15);
      const near = fans.find((f) => Math.hypot(f.x - x, f.z - z) < f.R * 0.8);
      if (near) R = Math.min(18, Math.hypot(near.R, R)); fans.push({ x, z, R });
      const H = clamp(0.1 * R, 0.25, 1.5);
      for (let iz = Math.max(0, Math.floor(z - 1.6 * R - Z0)); iz <= Math.min(NZ - 1, Math.ceil(z + 1.6 * R - Z0)); iz++) for (let ix = Math.max(0, Math.floor(x - 1.6 * R - X0)); ix <= Math.min(NX - 1, Math.ceil(x + 1.6 * R - X0)); ix++) {
        const ux = X0 + ix - x, uz = Z0 + iz - z, u = ux * dx + uz * dz, v = -ux * dz + uz * dx;
        if (u < -0.4 * R) continue;
        const e2 = ((u - 0.35 * R) / R) ** 2 + (v / (0.75 * R)) ** 2; if (e2 >= 1) continue;
        const i = iz * NX + ix, w = (1 - e2) ** 1.6;
        if (padSD(X0 + ix, Z0 + iz) < 6) continue;
        this.h[i] += H * w;
        const m = Math.round(255 * Math.min(1, w * 1.4)); if (m > mask[i * 4 + 3]) mask[i * 4 + 3] = m;
      }
    };
    // routing blends the smoothed original with the *current* eroded surface, so later traces fall into
    // earlier gullies and networks converge (dendritic) instead of running in parallel
    const cur = this.h;
    const gradAt = (x: number, z: number): [number, number] => [
      0.3 * (at(sm, x + 1, z) - at(sm, x - 1, z)) / 2 + 0.7 * (at(cur, x + 2.5, z) - at(cur, x - 2.5, z)) / 5,
      0.3 * (at(sm, x, z + 1) - at(sm, x, z - 1)) / 2 + 0.7 * (at(cur, x, z + 2.5) - at(cur, x, z - 2.5)) / 5];
    // seeds sorted high-to-low so upper rills are traced first and lower ones join them
    const seeds: [number, number, number][] = [];
    for (let z = Z0 + 14; z < Z0 + NZ - 14; z += 9) for (let x = X0 + 14; x < X0 + NX - 14; x += 9) {
      const jx = x + (r() - 0.5) * 8, jz = z + (r() - 0.5) * 8;
      const [gx, gz] = gradAt(jx, jz), sl = Math.hypot(gx, gz);
      if (sl < 0.34) continue;
      const cluster = 0.5 + 0.5 * noise.fbm(jx * 0.008 + 70, jz * 0.008, 3);
      if (r() > smoothstep(0.34, 0.8, sl) * smoothstep(0.44, 0.7, cluster)) continue;
      if (excluded(jx, jz)) continue;
      seeds.push([jx, jz, at(h0, jx, jz)]);
    }
    seeds.sort((a, b) => b[2] - a[2]);
    let traces = 0;
    for (const [jx, jz] of seeds) {
      traces++;
      let px = jx, pz = jz, dx = 0, dz = 0, L = 0; const rr = r(); const str = 0.25 + 1.35 * rr * rr * rr;
      for (let step = 0; step < 280; step++) {
        const [ax, az] = gradAt(px, pz), gl = Math.hypot(ax, az);
        if (gl < 0.12 && L > 6) { fan(px, pz, dx, dz, L * str); break; }
        if (gl > 1e-4) {
          const k = L < 2 ? 1 : 0.4, wa = 0.55 * noise.n2(px * 0.05 + jx, pz * 0.05), cw = Math.cos(wa), sw = Math.sin(wa);
          const tx = -ax / gl, tz = -az / gl, rx = tx * cw - tz * sw, rz = tx * sw + tz * cw; // meander around the fall line
          dx = (1 - k) * dx + k * rx; dz = (1 - k) * dz + k * rz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        }
        // inside an existing channel: catchment grows, so the channel deepens and widens downstream
        const inCh = mask[(Math.round(pz - Z0) * NX + Math.round(px - X0)) * 4 + 2] > 150;
        L += inCh ? 2.2 : 1;
        carve(px, pz, Math.min(0.18 + 0.012 * L, 2.8) * str, Math.min(0.8 + 0.03 * L, 5));
        px += dx; pz += dz;
        if (excluded(px, pz)) break;
      }
    }
    if (typeof process !== 'undefined' && process.env.HF_TIMING) console.log('gully traces', traces, 'fans', fans.length);
  }

  /** Pad cores are sacred: after rivers carve, restore the flat working surface. */
  private reflattenPads() {
    for (const p of PADS) {
      const t = this.padTarget.get(p.id)!; const R = padRadius(p) + 4;
      for (let iz = Math.max(0, Math.floor(p.z - R - Z0)); iz <= Math.min(NZ - 1, Math.ceil(p.z + R - Z0)); iz++) for (let ix = Math.max(0, Math.floor(p.x - R - X0)); ix <= Math.min(NX - 1, Math.ceil(p.x + R - X0)); ix++) {
        const x = X0 + ix, z = Z0 + iz, i = this.idx(ix, iz);
        const { sd, fall } = padSDOf(p, x, z);
        const w = 1 - smoothstep(-2, Math.min(2, fall * 0.5), sd);
        if (w > 0) this.h[i] = lerp(this.h[i], t.ch + t.gx * (x - p.x) + t.gz * (z - p.z), w);
      }
    }
  }

  private paintPads() {
    for (const p of PADS) {
      if (p.surface === 'none') continue;
      const R = padRadius(p) + 4;
      for (let iz = Math.floor(p.z - R - Z0); iz <= Math.ceil(p.z + R - Z0); iz++) for (let ix = Math.floor(p.x - R - X0); ix <= Math.ceil(p.x + R - X0); ix++) {
        if (ix < 0 || iz < 0 || ix >= NX || iz >= NZ) continue;
        const x = X0 + ix, z = Z0 + iz;
        const { sd } = padSDOf(p, x, z);
        const v = p.surface === 'concrete' ? Math.round(255 * (1 - smoothstep(-0.25, 0.25, sd))) : Math.round(255 * (1 - smoothstep(-0.2, 1.2 + noise.n2(x * 0.4, z * 0.4) * 0.6, sd)));
        const o = this.idx(ix, iz) * 4 + 2;
        // B channel: 1..127 = gravel coverage, 128..255 = concrete coverage
        const enc = v < 3 ? 0 : p.surface === 'concrete' ? 128 + Math.round(v * 127 / 255) : 1 + Math.round(v * 126 / 255);
        if (enc > this.splat[o] || (this.splat[o] < 128 && enc >= 128)) this.splat[o] = enc;
      }
    }
  }

  // ---------------------------------------------------------------- rivers
  private carveRivers() {
    // routing field: terrain without pits, blurred so rivers pick the large-scale gradient
    const g = new Float32Array(NX * NZ);
    for (let i = 0; i < g.length; i++) g[i] = this.h[i];
    // add back the pit removal: recompute base without pits where pits live
    for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) {
      const x = X0 + ix, z = Z0 + iz;
      if ((Math.abs(x + 95) < 60 && Math.abs(z + 150) < 60) || (Math.abs(x - 70) < 80 && Math.abs(z - 120) < 80) || (Math.abs(x + 120) < 70 && Math.abs(z - 120) < 70)) {
        g[iz * NX + ix] += baseHeight(x, z, false) - baseHeight(x, z, true);
      }
    }
    const blur = (src: Float32Array, r: number) => {
      const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
      for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) {
        let s = 0, n = 0; for (let k = -r; k <= r; k++) { const jx = clamp(ix + k, 0, NX - 1); s += src[iz * NX + jx]; n++; } tmp[iz * NX + ix] = s / n;
      }
      for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) {
        let s = 0, n = 0; for (let k = -r; k <= r; k++) { const jz = clamp(iz + k, 0, NZ - 1); s += tmp[jz * NX + ix]; n++; } out[iz * NX + ix] = s / n;
      }
      return out;
    };
    for (const p of PADS) {
      for (let iz = Math.max(0, Math.floor(p.z - 60 - Z0)); iz < Math.min(NZ, Math.ceil(p.z + 60 - Z0)); iz++) for (let ix = Math.max(0, Math.floor(p.x - 70 - X0)); ix < Math.min(NX, Math.ceil(p.x + 70 - X0)); ix++) {
        const x = X0 + ix, z = Z0 + iz, { sd } = padSDOf(p, x, z);
        g[iz * NX + ix] += 16 * (1 - smoothstep(0, 38, sd));
      }
    }
    for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) { const d = Math.hypot(X0 + ix + 95, Z0 + iz + 150); if (d < 60) g[iz * NX + ix] += 14 * (1 - smoothstep(10, 55, d)); }
    const sm = blur(blur(g, 8), 8);
    const sample = (x: number, z: number) => {
      const fx = clamp(x - X0, 0, NX - 1.001), fz = clamp(z - Z0, 0, NZ - 1.001);
      const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz, i = iz * NX + ix;
      return lerp(lerp(sm[i], sm[i + 1], tx), lerp(sm[i + NX], sm[i + NX + 1], tx), tz);
    };
    const pondC = POND;
    const rivers: RiverPath[] = [];
    const occ = new Map<number, { river: number; idx: number }>();
    const key = (x: number, z: number) => Math.floor((x - X0) / 4) * 1000 + Math.floor((z - Z0) / 4);
    RIVER_SPRINGS.forEach(([sx, sz], id) => {
      const pts: RiverPt[] = [];
      let x = sx, z = sz, dx = 0, dz = 0; let joins: RiverPath['joinsAt'];
      const mine: [number, { river: number; idx: number }][] = [];
      const visited = new Map<number, number>(); let breach = 0;
      for (let step = 0; step < 700; step++) {
        pts.push({ x, z, wl: 0, w: 1 });
        const e = 3, gx = (sample(x + e, z) - sample(x - e, z)) / (2 * e), gz = (sample(x, z + e) - sample(x, z - e)) / (2 * e);
        const gl = Math.hypot(gx, gz);
        // a stream that circles in a hollow has found a closed depression: it fills and spills toward the floor
        const vk = key(x, z), seen = visited.get(vk);
        if (seen !== undefined && step - seen > 8) breach = 14;
        if (seen === undefined) visited.set(vk, step);
        if (breach > 0) { breach--; const fx = FLOOR.x - x, fz = FLOOR.z - z, fl = Math.hypot(fx, fz) || 1; dx = 0.6 * dx + 0.4 * fx / fl; dz = 0.6 * dz + 0.4 * fz / fl; const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
        else if (gl > 1e-4) { const k = step < 6 ? 1 : 0.18; dx = (1 - k) * dx + k * (-gx / gl); dz = (1 - k) * dz + k * (-gz / gl); const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
        x += dx * 2; z += dz * 2;
        if (Math.hypot(x - pondC.x, z - pondC.z) < pondC.r * 1.5 || x < X0 + 20 || x > X0 + NX - 20 || z > Z0 + NZ - 30) break;
        // merge into an existing river
        let hit = false;
        if (step > 10) for (let a = -1; a <= 1 && !hit; a++) for (let b = -1; b <= 1 && !hit; b++) {
          const o = occ.get(key(x + a * 4, z + b * 4)); if (o) { joins = { river: o.river, idx: o.idx }; hit = true; }
        }
        if (hit) break;
        if (step % 2 === 0) mine.push([key(x, z), { river: id, idx: pts.length - 1 }]);
      }
      for (const [k, v] of mine) occ.set(k, v);
      rivers.push({ id, pts, joinsAt: joins });
    });
    // flow accumulation -> width
    const flow = rivers.map((r) => new Float32Array(r.pts.length).fill(1));
    for (let k = rivers.length - 1; k >= 0; k--) {
      const r = rivers[k]; if (!r.joinsAt) continue;
      const f = flow[k][r.pts.length - 1], t = flow[r.joinsAt.river];
      for (let j = r.joinsAt.idx; j < t.length; j++) t[j] += f;
    }
    // smooth + monotone water level + carve
    for (let k = 0; k < rivers.length; k++) {
      const r = rivers[k];
      // chaikin smoothing x2
      let p = r.pts.map((q, i) => ({ ...q, f: flow[k][i] }));
      for (let it = 0; it < 2; it++) { const n: typeof p = [p[0]]; for (let i = 0; i < p.length - 1; i++) { const a = p[i], b = p[i + 1]; n.push({ x: lerp(a.x, b.x, 0.25), z: lerp(a.z, b.z, 0.25), wl: 0, w: 1, f: lerp(a.f, b.f, 0.25) }, { x: lerp(a.x, b.x, 0.75), z: lerp(a.z, b.z, 0.75), wl: 0, w: 1, f: lerp(a.f, b.f, 0.75) }); } n.push(p[p.length - 1]); p = n; }
      // water level: lower envelope of smoothed centreline terrain, monotone
      const hs = p.map((q) => this.at(q.x, q.z));
      const sm2 = hs.map((_, i) => { let s = 0, n = 0; for (let j = -10; j <= 10; j++) { const t = clamp(i + j, 0, hs.length - 1); s += hs[t]; n++; } return s / n; });
      let lvl = Infinity; const env: number[] = [];
      for (let i = 0; i < p.length; i++) { lvl = Math.min(lvl - 0.01, sm2[i] - 0.5); env.push(lvl); }
      // pool-and-riffle: the surface holds level in pools and drops at short riffles (never above the envelope + 0.45 m)
      let pool = env[0], sAlong = 0;
      for (let i = 0; i < p.length; i++) {
        if (i) sAlong += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z);
        if (env[i] < pool - 0.45) pool = env[i];
        p[i].wl = Math.min(pool, env[i] + 0.45);
        // width breathes: pools spread, riffles pinch
        const breathe = 1 + 0.32 * noise.n2(sAlong * 0.045 + k * 13, 2.5) + 0.12 * noise.n2(sAlong * 0.17, k);
        p[i].w = (1.6 + 1.5 * Math.sqrt(p[i].f)) * breathe;
      }
      // smooth each drop over ~3 m so it reads as a cascade, not a wall
      { const w2 = p.map((q) => q.wl); for (let i = 0; i < p.length; i++) { let a = 0, n = 0; for (let j = -3; j <= 3; j++) { const t = clamp(i + j, 0, p.length - 1); a += w2[t]; n++; } p[i].wl = Math.min(a / n, w2[Math.max(0, i - 3)]); } }
      r.pts = p.map(({ x, z, wl, w }) => ({ x, z, wl, w }));
      // carve
      for (const q of r.pts) {
        const R = q.w * 0.5 + q.w * 1.1 + 2, depth = 0.55 + 0.1 * q.w, WR = q.w * 0.5 + 5;
        for (let iz = Math.floor(q.z - R - Z0); iz <= Math.ceil(q.z + R - Z0); iz++) for (let ix = Math.floor(q.x - R - X0); ix <= Math.ceil(q.x + R - X0); ix++) {
          if (ix < 0 || iz < 0 || ix >= NX || iz >= NZ) continue;
          const d = Math.hypot(X0 + ix - q.x, Z0 + iz - q.z);
          const t = q.wl - depth + (depth + 0.7) * smoothstep(q.w * 0.35, q.w * 1.1 + 1.4, d);
          const i = this.idx(ix, iz);
          if (t < this.h[i]) this.h[i] = lerp(this.h[i], t, 1 - smoothstep(q.w * 0.5, R, d));
          if (d < WR) this.splat2[i * 4] = Math.max(this.splat2[i * 4], Math.round(255 * (1 - smoothstep(q.w * 0.4, WR, d))));
        }
      }
    }
    this.rivers = rivers;
    // settling pond: a shallow bowl the Watershed drains into
    const L0 = this.at(POND.x, POND.z) - 0.2; this.pondLevel = L0 - 0.9;
    for (let iz = Math.floor(POND.z - 40 - Z0); iz <= Math.ceil(POND.z + 40 - Z0); iz++) for (let ix = Math.floor(POND.x - 40 - X0); ix <= Math.ceil(POND.x + 40 - X0); ix++) {
      const d = Math.hypot(X0 + ix - POND.x, Z0 + iz - POND.z) / (POND.r * (1 + 0.18 * noise.n2((X0 + ix) * 0.05, (Z0 + iz) * 0.05)));
      const t = L0 - 3.2 * (1 - smoothstep(0.2, 1.25, d)) ; const i = this.idx(ix, iz);
      if (d < 1.25 && t < this.h[i]) this.h[i] = lerp(this.h[i], t, 1 - smoothstep(0.9, 1.3, d));
    }
    let rimMin = Infinity; for (let k = 0; k < 72; k++) { const a = (k / 72) * Math.PI * 2; rimMin = Math.min(rimMin, this.at(POND.x + Math.cos(a) * POND.r * 1.05, POND.z + Math.sin(a) * POND.r * 1.05)); }
    this.pondLevel = Math.min(this.pondLevel, rimMin - 0.15);
  }

  // ---------------------------------------------------------------- roads
  private carveRoad(def: RoadDef) {
    // Catmull-Rom sampled at 0.5 m
    const P = def.pts, pts: { x: number; z: number }[] = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(2, Math.ceil(len / 0.5));
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        const f = (a: number, b: number, c: number, d: number) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        pts.push({ x: f(p0[0], p1[0], p2[0], p3[0]), z: f(p0[1], p1[1], p2[1], p3[1]) });
      }
    }
    pts.push({ x: P[P.length - 1][0], z: P[P.length - 1][1] });
    // target elevation profile: smoothed terrain along the path, grade-limited
    const raw = pts.map((q) => this.at(q.x, q.z));
    const win = def.kind === 'main' ? 70 : 36;
    let y = raw.slice();
    for (let pass = 0; pass < 3; pass++) {
      const out = new Float32Array(y.length);
      for (let i = 0; i < y.length; i++) { let s = 0, n = 0; for (let j = -win; j <= win; j++) { const t = i + j; if (t < 0 || t >= y.length) continue; s += y[t]; n++; } out[i] = s / n; }
      y = Array.from(out);
    }
    // ease into the real ground at both ends (pads, junctions) so roads never trench into their destinations
    { let tot = 0; for (let i = 1; i < pts.length; i++) tot += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      const L = def.kind === 'main' ? 28 : 16; let acc = 0;
      for (let i = 0; i < y.length; i++) { if (i) acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); const w = Math.max(1 - smoothstep(0, L, acc), 1 - smoothstep(0, L, tot - acc)); y[i] = lerp(y[i], raw[i], w); } }
    // grade limit with both ends pinned to the ground they connect (if infeasible, the start absorbs it)
    const maxGrade = def.kind === 'main' ? 0.125 : 0.2, step = 0.5, n = y.length;
    y[0] = raw[0]; y[n - 1] = raw[n - 1];
    for (let i = 1; i < n - 1; i++) y[i] = clamp(y[i], y[i - 1] - maxGrade * step, y[i - 1] + maxGrade * step);
    for (let i = n - 2; i > 0; i--) y[i] = clamp(y[i], y[i + 1] - maxGrade * step, y[i + 1] + maxGrade * step);
    let s = 0; const samples: RoadSample[] = pts.map((q, i) => { if (i) s += Math.hypot(q.x - pts[i - 1].x, q.z - pts[i - 1].z); return { x: q.x, z: q.z, y: y[i], s }; });
    this.roads.push({ def, pts: samples });

    const R = def.halfW + def.shoulder + 1;
    const best = new Map<number, [number, number]>();
    for (const q of samples) {
      for (let iz = Math.floor(q.z - R - Z0); iz <= Math.ceil(q.z + R - Z0); iz++) for (let ix = Math.floor(q.x - R - X0); ix <= Math.ceil(q.x + R - X0); ix++) {
        if (ix < 0 || iz < 0 || ix >= NX || iz >= NZ) continue;
        const d = Math.hypot(X0 + ix - q.x, Z0 + iz - q.z); if (d > R) continue;
        const i = this.idx(ix, iz), b = best.get(i);
        if (!b || d < b[0]) best.set(i, [d, q.y]);
      }
    }
    for (const [i, [d, ty]] of best) {
      const w = 1 - smoothstep(def.halfW, def.halfW + def.shoulder, d);
      const before = this.h[i];
      this.h[i] = lerp(this.h[i], ty, w);
      if (def.kind === 'main' && d < 8) {
        this.splat4[i * 4] = Math.round(255 * d / 8); this.splat4[i * 4 + 1] = 255;
        // in cuttings the road drains to a shallow V ditch at the toe of the cut
        if (before > ty + 0.6) { const dd = d - (def.halfW + 2.0); const ditch = Math.max(0, 1 - Math.abs(dd) / 1.1); this.h[i] -= 0.38 * ditch; if (ditch > 0) this.splat4[i * 4 + 2] = Math.max(this.splat4[i * 4 + 2], Math.round(255 * ditch)); }
      }
      const ix = i % NX, iz = (i / NX) | 0;
      const edge = noise.n2((X0 + ix) * 0.7, (Z0 + iz) * 0.7) * 0.25;
      if (def.kind === 'main') {
        this.splat[i * 4] = Math.max(this.splat[i * 4], Math.round(255 * (1 - smoothstep(def.halfW - 0.3, def.halfW + 0.5, d + edge))));
        this.splat[i * 4 + 1] = Math.max(this.splat[i * 4 + 1], Math.round(255 * (1 - smoothstep(def.halfW, def.halfW + 3.5, d + edge))));
      } else {
        this.splat[i * 4 + 1] = Math.max(this.splat[i * 4 + 1], Math.round(255 * (1 - smoothstep(def.halfW * 0.7, def.halfW + 0.8, d + edge))));
      }
    }
  }

  /** Cavity = blurred height minus height; darkens hollows in the shader (cheap baked AO). */
  private bakeCavity() {
    const n = NX * NZ, a = new Float32Array(n), b = new Float32Array(n), r = 5;
    for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) { let s = 0; for (let k = -r; k <= r; k++) s += this.h[iz * NX + clamp(ix + k, 0, NX - 1)]; a[iz * NX + ix] = s / (2 * r + 1); }
    for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) { let s = 0; for (let k = -r; k <= r; k++) s += a[clamp(iz + k, 0, NZ - 1) * NX + ix]; b[iz * NX + ix] = s / (2 * r + 1); }
    for (let i = 0; i < n; i++) this.splat2[i * 4 + 1] = Math.round(255 * clamp(0.5 + (b[i] - this.h[i]) / 4.4, 0, 1));
  }

  /** Vegetation follows water and avoids wind: moisture from streams + hollows, minus slope and exposure. */
  private bakeVegetation() {
    const n = NX * NZ, wet = new Float32Array(n);
    for (let i = 0; i < n; i++) wet[i] = this.splat2[i * 4] / 255;
    // spread stream moisture outward (two box blurs, radius 12 m)
    const blur = (a: Float32Array, r: number) => { const t = new Float32Array(n), o = new Float32Array(n);
      for (let iz = 0; iz < NZ; iz++) { let s = 0; for (let k = -r; k <= r; k++) s += a[iz * NX + clamp(k, 0, NX - 1)]; for (let ix = 0; ix < NX; ix++) { t[iz * NX + ix] = s / (2 * r + 1); s += a[iz * NX + Math.min(ix + r + 1, NX - 1)] - a[iz * NX + Math.max(ix - r, 0)]; } }
      for (let ix = 0; ix < NX; ix++) { let s = 0; for (let k = -r; k <= r; k++) s += t[clamp(k, 0, NZ - 1) * NX + ix]; for (let iz = 0; iz < NZ; iz++) { o[iz * NX + ix] = s / (2 * r + 1); s += t[Math.min(iz + r + 1, NZ - 1) * NX + ix] - t[Math.max(iz - r, 0) * NX + ix]; } }
      return o; };
    const moist = blur(blur(wet, 12), 12);
    for (let iz = 0; iz < NZ; iz++) for (let ix = 0; ix < NX; ix++) {
      const i = iz * NX + ix, x = X0 + ix, z = Z0 + iz, h = this.h[i];
      const hx = this.h[iz * NX + Math.min(ix + 1, NX - 1)] - this.h[iz * NX + Math.max(ix - 1, 0)], hz = this.h[Math.min(iz + 1, NZ - 1) * NX + ix] - this.h[Math.max(iz - 1, 0) * NX + ix];
      const slope = Math.hypot(hx, hz) / 2;
      const cav = Math.max(0, this.splat2[i * 4 + 1] / 255 - 0.5) * 2;
      const m = clamp(moist[i] * 2.2 + cav * 0.8 + (1 - smoothstep(0, 40, h)) * 0.25);
      const patch = 0.5 + 0.5 * noise.fbm(x * 0.012 + 40, z * 0.012, 4);
      let v = clamp(patch * 0.95 + m * 0.9 - 0.18) * (1 - smoothstep(0.55, 1.0, slope)) * (1 - 0.35 * smoothstep(95, 125, h));
      const sp = i * 4;
      const occupied = Math.max(this.splat[sp], this.splat[sp + 1], this.splat[sp + 2] > 0 ? 255 : 0, this.splat[sp + 3]) / 255;
      v *= 1 - occupied;
      if (this.splat2[sp] > 200) v *= 0.3; // the channel itself
      v *= 1 - 0.6 * (this.splat3[sp + 2] / 255);
      this.splat3[sp] = Math.round(255 * clamp(v)); this.splat3[sp + 1] = Math.round(255 * m);
    }
  }
}
