// Headless layout map: hillshade + contours + roads + rivers + pads -> PNG. Used to design the world.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { Heightfield, NX, NZ, X0, Z0 } from '../src/heightfield.ts';
import { PADS, ZONES } from '../src/layout.ts';

const t0 = Date.now();
const hf = new Heightfield();
console.log('heightfield built in', Date.now() - t0, 'ms');
let mn = 1e9, mx = -1e9; for (const v of hf.h) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
console.log('height range', mn.toFixed(1), mx.toFixed(1));
for (const p of PADS) console.log(p.id.padEnd(14), `(${p.x},${p.z})`, 'h=', hf.at(p.x, p.z).toFixed(1));
for (const r of hf.roads) { let g = 0; for (let i = 4; i < r.pts.length; i += 4) g = Math.max(g, Math.abs(r.pts[i].y - r.pts[i - 4].y) / Math.max(0.01, r.pts[i].s - r.pts[i - 4].s)); console.log('road', r.def.id, 'len', r.pts[r.pts.length - 1].s.toFixed(0), 'y', r.pts[0].y.toFixed(1), '->', r.pts[r.pts.length - 1].y.toFixed(1), 'maxGrade', (100 * g).toFixed(1) + '%'); }
for (const r of hf.rivers) console.log('river', r.id, 'pts', r.pts.length, 'join', JSON.stringify(r.joinsAt), 'end', r.pts[r.pts.length - 1].x.toFixed(0), r.pts[r.pts.length - 1].z.toFixed(0));

const S = 2; // px per metre
const W = NX * S, H = NZ * S, px = Buffer.alloc(W * H * 3);
const L = [-0.6, 0.5, -0.62];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const wx = X0 + x / S, wz = Z0 + y / S;
  const h = hf.at(wx, wz), n = hf.normal(wx, wz);
  const sh = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
  let g = 70 + sh * 150;
  let r = g * 0.95, gg = g, b = g * 0.85;
  const t = (h + 5) / 105; r += t * 30; gg += t * 18;
  const c = h / 2.5, cf = Math.abs(c - Math.round(c)) * 2.5; const ci = h / 12.5, cif = Math.abs(ci - Math.round(ci)) * 12.5;
  if (cif < 0.25) { r *= 0.55; gg *= 0.6; b *= 0.6; } else if (cf < 0.12) { r *= 0.82; gg *= 0.85; b *= 0.85; }
  const o = (y * W + x) * 3;
  const road = hf.splatAt(wx, wz, 0), trail = hf.splatAt(wx, wz, 1), pad = hf.splatAt(wx, wz, 2), fld = hf.splatAt(wx, wz, 3);
  if (fld > 0.5) { r = r * 0.6 + 60; gg = gg * 0.8 + 40; }
  if (trail > 0.3) { r = r * 0.6 + 70; gg = gg * 0.6 + 50; b = b * 0.5 + 30; }
  if (pad > 0.3) { r = r * 0.5 + 100; gg = gg * 0.5 + 100; b = b * 0.5 + 100; }
  if (road > 0.3) { r = 255; gg = 106; b = 43; }
  px[o] = Math.min(255, r); px[o + 1] = Math.min(255, gg); px[o + 2] = Math.min(255, b);
}
const dot = (x: number, z: number, col: [number, number, number], rad0 = 4) => {
  const rad = Math.ceil(rad0);
  for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
    if (dx * dx + dy * dy > rad * rad) continue;
    const X = Math.round((x - X0) * S) + dx, Y = Math.round((z - Z0) * S) + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
    const o = (Y * W + X) * 3; px[o] = col[0]; px[o + 1] = col[1]; px[o + 2] = col[2];
  }
};
for (const r of hf.rivers) for (const q of r.pts) dot(q.x, q.z, [60, 140, 190], Math.max(1, q.w * S * 0.5));
for (const z of ZONES) dot(z.x, z.z, [255, 255, 255], 6);
// grid ticks every 100 m
for (let gx = -300; gx <= 300; gx += 100) for (let gz = -400; gz <= 400; gz += 100) dot(gx, gz, [0, 0, 0], 2);

// PNG
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
const crcT = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
const crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync(process.argv[2] ?? 'map.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
