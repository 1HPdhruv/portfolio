// Deterministic seeded noise. No dependencies so tools can run it under tsx.
export function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const G = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071],
];

export class Noise {
  private perm = new Uint8Array(512);
  constructor(seed: number) {
    const r = mulberry32(seed);
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }
  /** Gradient noise, approx [-1,1]. */
  n2(x: number, y: number): number {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255, P = this.perm;
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const g00 = G[P[P[X] + Y] & 7], g10 = G[P[P[X + 1] + Y] & 7], g01 = G[P[P[X] + Y + 1] & 7], g11 = G[P[P[X + 1] + Y + 1] & 7];
    const a = g00[0] * xf + g00[1] * yf, b = g10[0] * (xf - 1) + g10[1] * yf;
    const c = g01[0] * xf + g01[1] * (yf - 1), d = g11[0] * (xf - 1) + g11[1] * (yf - 1);
    const ab = a + u * (b - a), cd = c + u * (d - c);
    return (ab + v * (cd - ab)) * 1.41;
  }
  fbm(x: number, y: number, oct = 5, lac = 2, gain = 0.5): number {
    let s = 0, a = 1, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { s += a * this.n2(x * f, y * f); n += a; a *= gain; f *= lac; }
    return s / n;
  }
  /** Ridged multifractal, [0,1]; sharp crests. */
  ridged(x: number, y: number, oct = 5): number {
    let s = 0, a = 0.5, f = 1, w = 1;
    for (let i = 0; i < oct; i++) {
      let n = 1 - Math.abs(this.n2(x * f, y * f));
      n *= n; n *= w; w = Math.min(1, Math.max(0, n * 2));
      s += n * a; f *= 2.05; a *= 0.5;
    }
    return s;
  }
}

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
