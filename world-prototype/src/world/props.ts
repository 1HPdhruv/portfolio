import * as THREE from 'three';
import { Builder, Frame, unitCyl } from './kit';
import { M } from './materials';

// Parametric props. Every prop is built from the same kit and the same materials.
type V3 = [number, number, number];

export function pelican(b: Builder, f: Frame, lx: number, ly: number, lz: number, ry = 0, s = 1, mat: THREE.Material = M.caseDark) {
  const w = 0.62 * s, h = 0.26 * s, d = 0.42 * s, sf = f.sub(lx, ly, lz, ry);
  b.rbox(mat, sf, w, h, d, 0, h / 2, 0, 0, 0.03 * s);
  b.box(mat, sf, w * 0.98, 0.02 * s, d * 1.02, 0, h * 0.62, 0);
  for (const sx of [-0.28, 0.28]) b.box(M.galv, sf, 0.05 * s, 0.05 * s, 0.02 * s, sx * w, h * 0.62, d / 2 + 0.01 * s);
  b.box(M.plastic, sf, 0.16 * s, 0.025 * s, 0.035 * s, 0, h + 0.012 * s, 0);
}

export function crate(b: Builder, f: Frame, lx: number, ly: number, lz: number, ry = 0, w = 1.1, h = 0.8, d = 0.9) {
  const sf = f.sub(lx, ly, lz, ry);
  b.block(M.wood, sf, w, h, d, 0, 0, 0);
  for (const y of [0.08, h - 0.08]) { b.box(M.woodDark, sf, w + 0.03, 0.09, d + 0.03, 0, y, 0); }
  for (const sx of [-1, 1]) b.box(M.woodDark, sf, 0.09, h, d + 0.035, sx * (w / 2 - 0.045), h / 2, 0);
  b.solid(sf, 0, 0, w, d);
}

export function pallet(b: Builder, f: Frame, lx: number, ly: number, lz: number, ry = 0) {
  const sf = f.sub(lx, ly, lz, ry);
  for (const z of [-0.5, 0, 0.5]) b.block(M.woodDark, sf, 1.2, 0.1, 0.1, 0, 0, z);
  for (let i = 0; i < 7; i++) b.block(M.wood, sf, 0.12, 0.025, 1.1, -0.54 + i * 0.18, 0.1, 0);
}

export function container(b: Builder, f: Frame, lx: number, lz: number, ry = 0, mat: THREE.Material = M.corrugatedInk, len = 6.06, ly = 0) {
  const sf = f.sub(lx, ly, lz, ry), W = 2.44, H = 2.59;
  b.block(mat, sf, W, H, len, 0, 0, 0);
  b.block(M.steelDark, sf, W + 0.04, 0.12, len + 0.04, 0, 0, 0);
  b.box(M.steelDark, sf, W + 0.04, 0.1, len + 0.04, 0, H - 0.05, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.block(M.steelDark, sf, 0.18, H, 0.18, sx * (W / 2 - 0.07), 0, sz * (len / 2 - 0.07));
  for (const x of [-0.75, -0.35, 0.35, 0.75]) b.cyl(M.galv, sf, 0.022, H - 0.3, x, H / 2, len / 2 + 0.04, 0, 0, 6);
  b.solid(sf, 0, 0, W, len);
}

export function fence(b: Builder, f: Frame, pts: [number, number][], h = 2.0) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 2.8));
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      const [wx, wz] = f.w(x, z); const gy = b.ground(wx, wz) - f.y;
      b.cyl(M.galv, f, 0.03, h + 0.4, x, gy + h / 2 - 0.2, z, 0, 0, 6);
    }
    const ang = Math.atan2(bx - ax, bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const [wx, wz] = f.w(mx, mz); const gy = b.ground(wx, wz) - f.y;
    b.box(M.galv, f, 0.04, 0.04, len, mx, gy + h, mz, ang);
    const panel = new THREE.PlaneGeometry(len, h * 0.96);
    b.put(chain(), panel, f, mx, gy + h * 0.5, mz, 0, ang + Math.PI / 2, 0);
    b.solid(f, mx, mz, 0.2, len, ang);
  }
}
let chainMat: THREE.Material | null = null;
function chain() {
  if (chainMat) return chainMat;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
  g.strokeStyle = '#fff'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, 32); g.lineTo(32, 0); g.lineTo(64, 32); g.lineTo(32, 64); g.closePath(); g.stroke();
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 9);
  chainMat = new THREE.MeshStandardMaterial({ color: '#9aa1a1', metalness: 0.7, roughness: 0.5, alphaMap: t, alphaTest: 0.45, side: THREE.DoubleSide });
  return chainMat;
}

export function railing(b: Builder, f: Frame, pts: V3[], h = 1.05, mat: THREE.Material = M.galv) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], c = pts[i + 1], len = Math.hypot(c[0] - a[0], c[2] - a[2]), n = Math.max(1, Math.round(len / 1.6));
    for (let k = 0; k <= n; k++) { const t = k / n; b.rod(mat, f, [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t], [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t + h, a[2] + (c[2] - a[2]) * t], 0.025); }
    b.rod(mat, f, [a[0], a[1] + h, a[2]], [c[0], c[1] + h, c[2]], 0.025);
    b.rod(mat, f, [a[0], a[1] + h * 0.5, a[2]], [c[0], c[1] + h * 0.5, c[2]], 0.018);
  }
}

export function stairs(b: Builder, f: Frame, lx: number, ly: number, lz: number, ry: number, w: number, rise: number, n: number) {
  const sf = f.sub(lx, ly, lz, ry), run = 0.28, sh = rise / n;
  for (let i = 0; i < n; i++) b.box(M.steelDark, sf, w, 0.04, run, 0, sh * (i + 1) - 0.02, -run * i - run / 2);
  for (const sx of [-1, 1]) {
    b.rod(M.steelPaint, sf, [sx * w / 2, 0, 0], [sx * w / 2, rise, -run * n], 0.04, 4);
    b.rod(M.galv, sf, [sx * w / 2, 1.0, 0], [sx * w / 2, rise + 1.0, -run * n], 0.022);
    b.rod(M.galv, sf, [sx * w / 2, 0, 0], [sx * w / 2, 1.0, 0], 0.022);
  }
}

export function lightPole(b: Builder, f: Frame, lx: number, lz: number, h = 7, ry = 0, real = false, poolR = 9) {
  const [wx, wz] = f.w(lx, lz); const gy = b.ground(wx, wz) - f.y; const sf = f.sub(lx, gy, lz, ry);
  b.cyl(M.concreteDark, sf, 0.25, 0.5, 0, 0.25, 0, 0, 0, 10);
  b.cyl(M.galv, sf, 0.08, h, 0, h / 2, 0, 0, 0, 8, 0.65);
  b.rod(M.galv, sf, [0, h - 0.3, 0], [0, h - 0.1, 0.9], 0.04);
  b.box(M.steelDark, sf, 0.34, 0.14, 0.5, 0, h - 0.12, 1.05);
  b.box(M.lamp, sf, 0.28, 0.02, 0.42, 0, h - 0.2, 1.05);
  const [px, pz] = sf.w(0, 1.05);
  b.pool(px, pz, poolR, 0.32);
  if (real) b.light(px, f.y + gy + h - 0.6, pz, '#ffc27a', 38, 30);
  b.post(sf, 0, 0, 0.3);
}

export function floodHead(b: Builder, f: Frame, lx: number, ly: number, lz: number, ry: number, tilt = 0.5) {
  const sf = f.sub(lx, ly, lz, ry);
  b.box(M.steelDark, sf, 0.5, 0.36, 0.14, 0, 0, 0, 0, tilt);
  b.box(M.lamp, sf, 0.44, 0.3, 0.02, 0, -0.05 * Math.sin(tilt), 0.07 * Math.cos(tilt), 0, tilt);
}

export function mast(b: Builder, f: Frame, lx: number, lz: number, h: number, o: { yagi?: boolean; dishTo?: [number, number]; guy?: boolean } = {}) {
  const [wx, wz] = f.w(lx, lz); const gy = b.ground(wx, wz) - f.y; const sf = f.sub(lx, gy, lz);
  b.cyl(M.concreteDark, sf, 0.3, 0.3, 0, 0.15, 0, 0, 0, 8);
  b.cyl(M.galv, sf, 0.05, h, 0, h / 2, 0, 0, 0, 8);
  if (o.yagi) {
    b.box(M.galv, sf, 0.03, 0.03, 1.6, 0, h - 0.3, 0.4);
    for (let i = 0; i < 6; i++) b.box(M.galv, sf, 0.5 - i * 0.04, 0.015, 0.015, 0, h - 0.3, -0.3 + i * 0.28);
  }
  if (o.dishTo) {
    const [tx, tz] = o.dishTo; const ang = Math.atan2(tx - wx, tz - wz) - sf.rot;
    dish(b, sf, 0, h - 0.8, 0, ang, 0.45);
  }
  if (o.guy) for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.3; const ax = Math.sin(a) * h * 0.45, az = Math.cos(a) * h * 0.45; const [gx, gz] = sf.w(ax, az); b.cable(M.steelDark, sf, [[0, h * 0.8, 0], [ax, b.ground(gx, gz) - sf.y + 0.1, az]], 0.008); }
  b.post(sf, 0, 0, 0.25);
}

export function dish(b: Builder, f: Frame, lx: number, ly: number, lz: number, ry: number, r = 0.6) {
  const sf = f.sub(lx, ly, lz, ry);
  const g = new THREE.SphereGeometry(r, 18, 6, 0, Math.PI * 2, 0, 0.75).rotateX(Math.PI / 2);
  b.put(M.chalkPaint, g, sf, 0, 0, r * 0.75 - 0.05);
  b.cyl(M.steelDark, sf, r * 0.25, r * 0.35, 0, 0, -0.05, Math.PI / 2, 0, 10);
  b.rod(M.galv, sf, [0, 0, r * 0.2], [0, 0, r * 1.05], 0.015);
}

export function tank(b: Builder, f: Frame, lx: number, lz: number, r: number, h: number, mat: THREE.Material = M.panelWhite) {
  const [wx, wz] = f.w(lx, lz); const gy = b.ground(wx, wz) - f.y; const sf = f.sub(lx, gy, lz);
  b.cyl(M.concreteDark, sf, r + 0.25, 0.3, 0, 0.15, 0, 0, 0, 20);
  b.cyl(mat, sf, r, h, 0, 0.3 + h / 2, 0, 0, 0, 24);
  for (let i = 1; i < 4; i++) b.cyl(M.steelPaint, sf, r + 0.02, 0.06, 0, 0.3 + (h * i) / 4, 0, 0, 0, 24);
  b.cyl(mat, sf, r * 0.2, r * 0.25, 0, 0.3 + h + r * 0.12, 0, 0, 0, 20, 0.15);
  for (const y of [0.4, h + 0.3]) b.rod(M.galv, sf, [r + 0.25, y, -0.2], [r + 0.25, y, 0.2], 0.02);
  b.rod(M.galv, sf, [r + 0.25, 0.3, -0.2], [r + 0.25, h + 0.6, -0.2], 0.02); b.rod(M.galv, sf, [r + 0.25, 0.3, 0.2], [r + 0.25, h + 0.6, 0.2], 0.02);
  for (let y = 0.6; y < h + 0.3; y += 0.3) b.rod(M.galv, sf, [r + 0.25, y, -0.2], [r + 0.25, y, 0.2], 0.012);
  b.post(sf, 0, 0, r + 0.2);
}

export function ibc(b: Builder, f: Frame, lx: number, ly: number, lz: number, ry = 0) {
  const sf = f.sub(lx, ly, lz, ry);
  pallet(b, sf, 0, 0, 0);
  b.rbox(M.chalkPaint, sf, 1.0, 0.95, 1.1, 0, 0.62, 0, 0, 0.08);
  for (const y of [0.15, 0.6, 1.08]) for (const sx of [-1, 1]) b.box(M.galv, sf, 0.025, 0.025, 1.14, sx * 0.53, y, 0);
  for (const x of [-0.53, 0, 0.53]) for (const z of [-0.57, 0.57]) b.box(M.galv, sf, 0.025, 1.0, 0.025, x, 0.6, z);
  b.solid(sf, 0, 0, 1.2, 1.2);
}

export function solarArray(b: Builder, f: Frame, lx: number, lz: number, n: number, rows = 1) {
  // panels face south (+z world) everywhere in the Basin, tilted 28 deg
  for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) {
    const [wx, wz] = f.w(lx + (i - (n - 1) / 2) * 1.1, lz + r * 2.6);
    const gy = b.ground(wx, wz);
    const sf = new Frame(wx, gy, wz, 0);
    b.box(M.solar, sf, 1.0, 0.04, 1.7, 0, 1.15, 0, 0, -0.49);
    b.box(M.galv, sf, 1.04, 0.05, 0.04, 0, 1.15 + 0.4, -0.75);
    b.cyl(M.galv, sf, 0.03, 1.5, 0, 0.75, -0.55, 0, 0, 6);
    b.cyl(M.galv, sf, 0.03, 0.8, 0, 0.4, 0.55, 0, 0, 6);
  }
}

export function acUnit(b: Builder, f: Frame, lx: number, ly: number, lz: number, ry = 0, big = false) {
  const sf = f.sub(lx, ly, lz, ry), w = big ? 2.2 : 0.9, h = big ? 1.3 : 0.7, d = big ? 1.1 : 0.4;
  b.block(M.panelGrey, sf, w, h, d, 0, 0, 0);
  const fans = big ? [-0.55, 0.55] : [0];
  for (const x of fans) {
    b.cyl(M.steelDark, sf, big ? 0.45 : 0.25, 0.04, x, big ? h + 0.02 : h * 0.55, big ? 0 : d / 2 + 0.01, big ? 0 : Math.PI / 2, 0, 18);
    const fan = new THREE.Mesh(new THREE.BoxGeometry(big ? 0.85 : 0.45, 0.02, 0.08), M.steelDark);
    const blade2 = fan.clone(); blade2.rotation.y = Math.PI / 2; fan.add(blade2);
    const p = sf.sub(x, big ? h + 0.05 : h * 0.55, big ? 0 : d / 2 + 0.03);
    fan.position.set(p.x, p.y, p.z);
    if (!big) { fan.rotation.set(Math.PI / 2, 0, 0); fan.rotation.y = sf.rot; }
    b.add(fan);
    b.updaters.push((dt) => { if (big) fan.rotation.y += dt * 7; else fan.rotateY(dt * 7); });
  }
  b.solid(sf, 0, 0, w, d);
}

export function drum(b: Builder, f: Frame, lx: number, ly: number, lz: number, mat: THREE.Material = M.steelPaint) {
  const sf = f.sub(lx, ly, lz);
  b.cyl(mat, sf, 0.29, 0.88, 0, 0.44, 0, 0, 0, 14);
  for (const y of [0.29, 0.59]) b.cyl(mat, sf, 0.3, 0.03, 0, y, 0, 0, 0, 14);
}

export function cableReel(b: Builder, f: Frame, lx: number, ly: number, lz: number, ry = 0, r = 0.55) {
  const sf = f.sub(lx, ly, lz, ry);
  for (const sx of [-0.25, 0.25]) b.cyl(M.wood, sf, r, 0.05, sx, r, 0, 0, Math.PI / 2, 16);
  b.cyl(M.rubber, sf, r * 0.75, 0.45, 0, r, 0, 0, Math.PI / 2, 16);
}

export function tyreStack(b: Builder, f: Frame, lx: number, lz: number, n = 4) {
  const [wx, wz] = f.w(lx, lz); const gy = b.ground(wx, wz) - f.y; const sf = f.sub(lx, gy, lz);
  const g = new THREE.TorusGeometry(0.32, 0.13, 8, 16).rotateX(Math.PI / 2);
  for (let i = 0; i < n; i++) b.put(M.rubber, g, sf, (i % 2) * 0.03, 0.13 + i * 0.25, 0, 0, i * 0.7);
  b.post(sf, 0, 0, 0.45);
}

export function bench(b: Builder, f: Frame, lx: number, ly: number, lz: number, ry: number, w = 2.4, d = 0.75, top: THREE.Material = M.wood) {
  const sf = f.sub(lx, ly, lz, ry);
  b.box(top, sf, w, 0.06, d, 0, 0.9, 0);
  b.box(M.steelPaint, sf, w - 0.1, 0.03, d - 0.1, 0, 0.25, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(M.steelPaint, sf, 0.05, 0.9, 0.05, sx * (w / 2 - 0.08), 0.45, sz * (d / 2 - 0.06));
  b.solid(sf, 0, 0, w, d);
}

export function rack(b: Builder, f: Frame, lx: number, ly: number, lz: number, ry: number, lit = true) {
  const sf = f.sub(lx, ly, lz, ry);
  b.block(M.steelDark, sf, 0.6, 2.1, 1.0, 0, 0, 0);
  b.box(M.glass, sf, 0.5, 1.9, 0.01, 0, 1.05, 0.505);
  if (lit) for (let i = 0; i < 9; i++) b.box(M.ledAmber, sf, 0.02, 0.012, 0.01, -0.18 + (i % 3) * 0.04, 0.3 + i * 0.18, 0.511);
}

export function consoleDesk(b: Builder, f: Frame, lx: number, ly: number, lz: number, ry: number, on: boolean, covered = false) {
  const sf = f.sub(lx, ly, lz, ry);
  b.block(M.panelGrey, sf, 1.6, 0.78, 0.8, 0, 0, 0);
  b.box(M.steelDark, sf, 1.62, 0.04, 0.85, 0, 0.8, 0.02, 0, -0.12);
  b.box(M.steelDark, sf, 0.06, 0.5, 0.06, 0, 1.05, -0.25);
  if (covered) { b.rbox(M.tarp, sf, 1.7, 0.95, 0.95, 0, 0.9, 0, 0, 0.15); return; }
  b.box(M.steelDark, sf, 1.1, 0.62, 0.05, 0, 1.32, -0.22, 0, -0.1);
  b.box(on ? M.screen : M.glass, sf, 1.02, 0.54, 0.01, 0, 1.32, -0.19, 0, -0.1);
  b.solid(sf, 0, 0, 1.6, 0.8);
}

export function stake(b: Builder, x: number, z: number, label: string, tall = 1.8) {
  const gy = b.ground(x, z), sf = new Frame(x, gy, z, 0);
  b.box(M.wood, sf, 0.09, tall, 0.09, 0, tall / 2 - 0.25, 0);
  b.box(M.orange, sf, 0.1, 0.05, 0.1, 0, tall - 0.3, 0);
  b.cyl(M.chalkPaint, sf, 0.06, 0.02, 0, tall - 0.21, 0, 0, 0, 8);
  // flagging tape streamers (animated)
  const tape = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.55, 1, 4).translate(0, -0.27, 0), new THREE.MeshStandardMaterial({ color: '#ff6a2b', roughness: 0.7, side: THREE.DoubleSide }));
  tape.position.set(x + 0.05, gy + tall - 0.28, z); tape.castShadow = true; b.add(tape);
  const ph = x * 0.37 + z;
  b.updaters.push((_dt, t) => { tape.rotation.set(0.25 + Math.sin(t * 2.4 + ph) * 0.18, 0.6 + Math.sin(t * 1.3 + ph) * 0.5, 0.35 + Math.sin(t * 3.1 + ph) * 0.12); });
  b.sign(sf, 0, 0.75, 0.07, 0, 0.26, 0.2, [label], { posts: false, accent: false });
  b.post(sf, 0, 0, 0.12);
}

export function windsock(b: Builder, f: Frame, lx: number, lz: number, h = 6) {
  const [wx, wz] = f.w(lx, lz); const gy = b.ground(wx, wz) - f.y; const sf = f.sub(lx, gy, lz);
  b.cyl(M.galv, sf, 0.05, h, 0, h / 2, 0, 0, 0, 8);
  b.cyl(M.galv, sf, 0.28, 0.03, 0, h - 0.1, 0, Math.PI / 2, 0, 12);
  const sock = new THREE.Group(); const p = sf.sub(0, h - 0.1, 0); sock.position.set(p.x, p.y, p.z);
  const cone = new THREE.CylinderGeometry(0.28, 0.12, 1.6, 12, 5, true).rotateX(Math.PI / 2).translate(0, 0, 0.8);
  // banded orange/white sock: two meshes sharing geometry ranges would be overkill; alternate rings as separate cones
  for (let i = 0; i < 5; i++) {
    const r0 = 0.28 - i * 0.032, r1 = r0 - 0.032;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, 0.32, 12, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.16 + i * 0.32), i % 2 ? M.chalkPaint : new THREE.MeshStandardMaterial({ color: '#ff6a2b', roughness: 0.8, side: THREE.DoubleSide }));
    seg.castShadow = true; sock.add(seg);
  }
  void cone;
  b.add(sock);
  // wind comes from the west-south-west; the sock points downwind (ENE)
  b.updaters.push((_dt, t) => { sock.rotation.set(0.25 + Math.sin(t * 1.7) * 0.06, -Math.PI * 0.62 + Math.sin(t * 0.9) * 0.12, 0); });
  b.post(sf, 0, 0, 0.15);
}

export function weatherStation(b: Builder, f: Frame, lx: number, lz: number) {
  const [wx, wz] = f.w(lx, lz); const gy = b.ground(wx, wz) - f.y; const sf = f.sub(lx, gy, lz);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; b.rod(M.galv, sf, [Math.sin(a) * 0.7, 0, Math.cos(a) * 0.7], [0, 1.4, 0], 0.025); }
  b.cyl(M.galv, sf, 0.035, 3.0, 0, 1.5, 0, 0, 0, 8);
  b.box(M.panelWhite, sf, 0.3, 0.4, 0.2, 0, 1.2, 0.12);
  for (let i = 0; i < 5; i++) b.cyl(M.chalkPaint, sf, 0.09, 0.03, 0.35, 2.2 + i * 0.05, 0, 0, 0, 10);
  b.rod(M.galv, sf, [0, 2.4, 0], [0.35, 2.4, 0], 0.012);
  b.box(M.solar, sf, 0.35, 0.02, 0.28, 0, 1.75, -0.2, 0, -0.5);
  const cups = new THREE.Group(); const p = sf.sub(0, 3.05, 0); cups.position.set(p.x, p.y, p.z);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; const arm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.01, 0.01), M.galv); arm.position.set(Math.cos(a) * 0.14, 0, Math.sin(a) * 0.14); arm.rotation.y = -a; cups.add(arm); const c = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6, 0, Math.PI), M.chalkPaint); c.position.set(Math.cos(a) * 0.28, 0, Math.sin(a) * 0.28); c.rotation.y = -a; cups.add(c); }
  b.add(cups); b.updaters.push((dt) => (cups.rotation.y += dt * 6));
  const vane = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.4), M.galv); const pv = sf.sub(0, 2.85, 0); vane.position.set(pv.x, pv.y, pv.z); b.add(vane);
  b.updaters.push((_dt, t) => (vane.rotation.y = -Math.PI * 0.62 + Math.sin(t * 0.7) * 0.15));
  b.post(sf, 0, 0, 0.5);
}

export function generator(b: Builder, f: Frame, lx: number, ly: number, lz: number, ry = 0) {
  const sf = f.sub(lx, ly, lz, ry);
  b.block(M.steelDark, sf, 1.9, 0.12, 1.0, 0, 0, 0);
  b.rbox(M.panelInk, sf, 1.8, 1.05, 0.95, 0, 0.65, 0, 0, 0.05);
  for (let i = 0; i < 6; i++) b.box(M.steelDark, sf, 0.02, 0.5, 0.6, -0.6 + i * 0.06, 0.65, 0.48);
  b.cyl(M.steelDark, sf, 0.06, 0.6, 0.6, 1.35, -0.2, 0, 0, 8);
  b.solid(sf, 0, 0, 1.9, 1.0);
}

export function jerrycans(b: Builder, f: Frame, lx: number, ly: number, lz: number, ry = 0, n = 3) {
  const sf = f.sub(lx, ly, lz, ry);
  for (let i = 0; i < n; i++) { b.rbox(M.caseOlive, sf, 0.17, 0.47, 0.35, i * 0.2, 0.235, 0, 0, 0.02); b.box(M.steelDark, sf, 0.05, 0.05, 0.12, i * 0.2, 0.5, 0.08); }
}

export function trigPillar(b: Builder, f: Frame, lx: number, lz: number) {
  const [wx, wz] = f.w(lx, lz); const gy = b.ground(wx, wz) - f.y; const sf = f.sub(lx, gy, lz);
  b.put(M.concreteSmooth, new THREE.CylinderGeometry(0.3, 0.42, 1.25, 4).rotateY(Math.PI / 4), sf, 0, 0.62, 0);
  b.cyl(M.brass, sf, 0.09, 0.03, 0, 1.26, 0, 0, 0, 16);
  b.box(M.brass, sf, 0.2, 0.12, 0.01, 0, 0.8, 0.33);
  b.post(sf, 0, 0, 0.5);
}

export function surveyTripod(b: Builder, f: Frame, lx: number, lz: number, h = 7) {
  // a timber signal tripod over the datum: classic survey beacon, banded target at the top
  const [wx, wz] = f.w(lx, lz); const gy = b.ground(wx, wz) - f.y; const sf = f.sub(lx, gy, lz);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.4; b.rod(M.wood, sf, [Math.sin(a) * 2.2, 0, Math.cos(a) * 2.2], [0, h, 0], 0.07, 6); }
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.4, a2 = ((i + 1) / 3) * Math.PI * 2 + 0.4; b.rod(M.woodDark, sf, [Math.sin(a) * 1.4, h * 0.36, Math.cos(a) * 1.4], [Math.sin(a2) * 1.4, h * 0.36, Math.cos(a2) * 1.4], 0.04, 5); }
  b.cyl(M.wood, sf, 0.05, 1.8, 0, h + 0.7, 0, 0, 0, 6);
  for (let i = 0; i < 3; i++) b.cyl(i % 2 ? M.chalkPaint : M.orange, sf, 0.3, 0.3, 0, h + 0.35 + i * 0.3, 0, 0, 0, 12);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.4; const [px, pz] = sf.w(Math.sin(a) * 2.2, Math.cos(a) * 2.2); b.post(new Frame(px, 0, pz), 0, 0, 0.12); }
}

export function bollard(b: Builder, f: Frame, lx: number, lz: number) {
  const [wx, wz] = f.w(lx, lz); const gy = b.ground(wx, wz) - f.y;
  b.cyl(M.concreteSmooth, f, 0.13, 0.9, lx, gy + 0.45, lz, 0, 0, 10);
  b.cyl(M.orange, f, 0.135, 0.07, lx, gy + 0.78, lz, 0, 0, 10);
}

/** A small mobile robot of the maze-solver lineage (used for the maze and workshop). */
export function tinyRobot(b: Builder, f: Frame, lx: number, ly: number, lz: number, ry = 0, s = 1) {
  const sf = f.sub(lx, ly, lz, ry);
  b.rbox(M.panelWhite, sf, 0.16 * s, 0.05 * s, 0.2 * s, 0, 0.05 * s, 0, 0, 0.012 * s);
  b.box(M.plastic, sf, 0.12 * s, 0.03 * s, 0.1 * s, 0, 0.09 * s, -0.02 * s);
  for (const sx of [-1, 1]) b.cyl(M.rubber, sf, 0.03 * s, 0.02 * s, sx * 0.09 * s, 0.03 * s, 0.02 * s, 0, Math.PI / 2, 10);
  for (let i = -1; i <= 1; i++) b.box(M.steelDark, sf, 0.02 * s, 0.02 * s, 0.02 * s, i * 0.05 * s, 0.06 * s, 0.1 * s);
}

export { unitCyl };
