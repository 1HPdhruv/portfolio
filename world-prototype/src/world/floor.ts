import * as THREE from 'three';
import type { Heightfield } from '../heightfield';
import { ESCARPMENTS } from '../layout';
import { Builder, Frame, inward } from './kit';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M, interiorCard, signTexture } from './materials';
import * as P from './props';
import { padFrame, decal, glow } from './rim';

// ------------------------------------------------------------------ 10. THE STRATA — geology as chronology
export function buildStrata(hf: Heightfield, parent: THREE.Object3D) {
  const b = new Builder(hf, 'strata', 0.9);
  const e = ESCARPMENTS[0];
  const L = Math.hypot(e.x2 - e.x1, e.z2 - e.z1), ux = (e.x2 - e.x1) / L, uz = (e.z2 - e.z1) / L, nx = uz, nz = -ux; // n points east, into the cliff
  const at = (t: number, v: number): [number, number] => [e.x1 + ux * L * t + nx * v, e.z1 + uz * L * t + nz * v];
  const faceRot = Math.atan2(-nx, -nz); // frames facing west, out of the face
  // layer plates on short posts along the foot of the face (S-01 oldest/deepest → S-06 youngest)
  for (let k = 0; k < 6; k++) {
    const [x, z] = at(0.25 + k * 0.09, -6.5), F = new Frame(x, hf.at(x, z), z, faceRot);
    b.sign(F, 0, 0.9, 0, 0, 0.7, 0.32, [`S-0${k + 1}`], { accent: k === 5 });
  }
  // scaffold against the face, a measuring staff, core boxes, a tarp shelter: a section being logged
  const [sx, sz] = at(0.5, -3.5); const S = new Frame(sx, hf.at(sx, sz), sz, faceRot);
  for (const x of [-2, 0, 2]) for (const z of [-0.6, 0.6]) b.block(M.galv, S, 0.06, 9, 0.06, x, -0.5, z);
  for (const y of [2.2, 4.4, 6.6, 8.4]) { b.box(M.wood, S, 4.2, 0.05, 1.3, 0, y, 0); b.box(M.galv, S, 4.2, 0.05, 0.05, 0, y + 1.0, 0.65); }
  for (let y = 0; y < 8; y += 0.4) b.box(M.galv, S, 0.05, 0.05, 0.5, 2.25, y + 0.3, -0.35);
  { const [mx, mz] = at(0.44, -2.6); const F = new Frame(mx, hf.at(mx, mz), mz, faceRot); for (let k = 0; k < 12; k++) b.box(k % 2 ? M.chalkPaint : M.steelDark, F, 0.12, 0.5, 0.05, 0, 0.25 + k * 0.5, 0, 0, 0.08); }
  const [cx, cz] = at(0.58, -9); const C = new Frame(cx, hf.at(cx, cz), cz, faceRot);
  for (let k = 0; k < 4; k++) { P.pallet(b, C, -1.5 + (k % 2) * 1.4, 0, (k >> 1) * 1.4); b.block(M.wood, C, 1.1, 0.18, 0.8, -1.5 + (k % 2) * 1.4, 0.13, (k >> 1) * 1.4); for (let c = 0; c < 4; c++) b.cyl(c % 2 ? M.concreteDark : M.concrete, C, 0.05, 0.95, -1.5 + (k % 2) * 1.4, 0.36, (k >> 1) * 1.4 - 0.3 + c * 0.2, 0, Math.PI / 2, 8); }
  for (const x of [-2.5, 2.5]) for (const z of [-1.2, 2.6]) b.block(M.galv, C, 0.05, 2.2, 0.05, x - 0.7, 0, z);
  b.box(M.tarp, C, 5.6, 0.05, 4.4, -0.7, 2.25, 0.7, 0, 0.12);
  // viewing platform on the road side
  const [vx, vz] = at(0.36, -15); const V = new Frame(vx, hf.at(vx, vz), vz, faceRot + Math.PI);
  b.block(M.concreteSmooth, V, 4, 0.3, 2.4, 0, -0.1, 0);
  P.railing(b, V, [[-2, 0.2, -1.1], [2, 0.2, -1.1]]);
  b.sign(V, 0, 0.95, 1.4, Math.PI, 1.9, 0.8, ['THE STRATA', 'SECTION LOG · S-01 → S-06']);
  return b.finish(parent);
}

// ------------------------------------------------------------------ 11. RESEARCH STATION — the global minimum
export function buildResearch(hf: Heightfield, parent: THREE.Object3D) {
  const b = new Builder(hf, 'research', 0.5), f = padFrame(hf, 'research');
  const SH = f.sub(0, 0, 6);
  // shaft collar + blast-door hatch; one leaf open, the shaft lit from below
  b.put(M.concreteSmooth, new THREE.CylinderGeometry(5.6, 6.0, 0.7, 40, 1, true), SH, 0, 0.2, 0);
  b.put(M.concreteSmooth, new THREE.RingGeometry(3.6, 5.6, 40).rotateX(-Math.PI / 2), SH, 0, 0.55, 0);
  b.put(M.concreteDark, inward(new THREE.CylinderGeometry(3.6, 3.6, 14, 32, 1, true)), SH, 0, -6.5, 0);
  const shaftGlow = new THREE.Mesh(new THREE.CircleGeometry(3.55, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffb366' }));
  shaftGlow.position.set(SH.x, SH.y - 12, SH.z); b.add(shaftGlow);
  b.box(M.steelPaint, SH, 3.5, 0.25, 7.0, -1.8, 0.66, 0);
  b.box(M.steelPaint, SH, 3.5, 0.25, 7.0, 1.0, 2.0, 0, 0, 0, -1.15);
  for (let k = 0; k < 5; k++) b.box(M.steelDark, SH, 3.3, 0.08, 0.2, -1.8, 0.82, -2.8 + k * 1.4);
  b.box(M.steelDark, SH, 0.6, 0.6, 0.6, 2.4, 3.6, 0); b.rod(M.steelDark, SH, [2.4, 3.3, 0], [4.8, 0.6, 0], 0.12);
  decal(b, SH, 0, 0, 16, 16, 0, (g, W) => { const c = W / 2; for (let i = 0; i < 48; i++) { g.fillStyle = i % 2 ? 'rgba(255,106,43,.85)' : 'rgba(18,18,18,.85)'; g.beginPath(); g.moveTo(c + Math.cos((i / 48) * 6.283) * W * 0.4, c + Math.sin((i / 48) * 6.283) * W * 0.4); g.arc(c, c, W * 0.4, (i / 48) * 6.283, ((i + 1) / 48) * 6.283); g.lineTo(c + Math.cos(((i + 1) / 48) * 6.283) * W * 0.46, c + Math.sin(((i + 1) / 48) * 6.283) * W * 0.46); g.arc(c, c, W * 0.46, ((i + 1) / 48) * 6.283, (i / 48) * 6.283, true); g.fill(); } });
  const hatchGlow = glow('#ffb877', 26); hatchGlow.position.set(SH.x, SH.y + 2.5, SH.z); b.add(hatchGlow);
  b.light(SH.x, SH.y + 1.5, SH.z, '#ffbe7a', 90, 34);
  b.updaters.push((_dt, t) => { hatchGlow.material.opacity = 0.75 + Math.sin(t * 0.8) * 0.08; });
  // headframe: twin legs over the shaft, back-legs braced toward the hoist house, sheaves on top
  const HT = 24;
  for (const sx of [-1, 1]) {
    b.rod(M.steelPaint, SH, [sx * 4.2, 0.5, -2.5], [sx * 1.6, HT, 0], 0.35, 6);
    b.rod(M.steelPaint, SH, [sx * 4.2, 0.5, 2.5], [sx * 1.6, HT, 0], 0.35, 6);
    b.rod(M.steelPaint, SH, [sx * 3.5, 0.5, 15], [sx * 1.6, HT - 1, 0], 0.3, 6);
    for (const y of [7, 13, 19]) { const t = y / HT; b.rod(M.steelPaint, SH, [sx * (4.2 - 2.6 * t), y, -2.5 + 2.5 * t], [sx * (4.2 - 2.6 * t), y, 2.5 - 2.5 * t], 0.12, 4); }
    b.block(M.concreteDark, SH, 1.6, 0.6, 1.6, sx * 4.2, 0, -2.5); b.block(M.concreteDark, SH, 1.6, 0.6, 1.6, sx * 4.2, 0, 2.5); b.block(M.concreteDark, SH, 1.4, 0.6, 1.4, sx * 3.5, 0, 15);
    b.post(SH, sx * 4.2, -2.5, 0.8); b.post(SH, sx * 4.2, 2.5, 0.8);
  }
  for (const y of [7, 13, 19]) { const t = y / HT; b.rod(M.steelPaint, SH, [-(4.2 - 2.6 * t), y, 0], [4.2 - 2.6 * t, y, 0], 0.12, 4); }
  b.block(M.steelDark, SH, 4.6, 0.3, 3.2, 0, HT - 0.2, 0);
  P.railing(b, SH, [[-2.3, HT + 0.1, -1.6], [2.3, HT + 0.1, -1.6], [2.3, HT + 0.1, 1.6], [-2.3, HT + 0.1, 1.6], [-2.3, HT + 0.1, -1.6]]);
  for (const sx of [-0.9, 0.9]) { const sheave = new THREE.TorusGeometry(1.4, 0.12, 8, 28); b.put(M.steelDark, sheave, SH, sx, HT + 1.5, 0, 0, Math.PI / 2, 0); for (let k = 0; k < 4; k++) b.box(M.steelDark, SH, 0.06, 2.8, 0.08, sx, HT + 1.5, 0, 0, (k / 4) * Math.PI, 0); }
  for (const sx of [-0.9, 0.9]) { b.rod(M.steelDark, SH, [sx, HT + 1.5, 1.4], [sx * 0.6, 4.2, 18], 0.035, 4); b.rod(M.steelDark, SH, [sx, HT + 0.1, -1.4], [sx, 0.6, -1.4], 0.03, 4); }
  b.box(M.lamp, SH, 0.5, 0.3, 0.5, 0, HT + 0.55, 1.5);
  const topGlow = glow('#ffc27a', 18); const tp = SH.sub(0, HT + 0.8, 1.5); topGlow.position.set(tp.x, tp.y, tp.z); b.add(topGlow);
  // hoist house with the winding drums behind the tall windows
  const HH = f.sub(0, 0, 25);
  b.block(M.concreteSmooth, HH, 15, 8, 10, 0, 0, 0); b.block(M.concreteDark, HH, 15.6, 0.5, 10.6, 0, 8, 0);
  for (const x of [-4.5, -1.5, 1.5, 4.5]) { b.box(M.steelDark, HH, 2.2, 4.4, 0.1, x, 4.2, -5.02); const w = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 4.2), interiorCard('plain')); const p = HH.sub(x, 4.2, -5.09); w.position.set(p.x, p.y, p.z); w.rotation.y = HH.rot + Math.PI; b.add(w); }
  for (const sx of [-0.55, 0.55]) b.put(M.steelDark, new THREE.CylinderGeometry(1.2, 1.2, 2.4, 20).rotateZ(Math.PI / 2), HH, sx * 4, 4.2, -7, 0, 0, 0, 0.6, 1, 1);
  b.box(M.steelDark, HH, 1.2, 2.3, 0.06, 6.0, 1.15, -5.03); b.box(M.lamp, HH, 0.4, 0.08, 0.15, 6.0, 2.6, -5.1);
  b.solid(HH, 0, 0, 15, 10);
  // instrument pylons at the corners of the pad: seismic, met, telemetry
  for (const [x, z] of [[-30, -24], [30, -24], [-30, 24], [30, 24]]) {
    const F = f.sub(x, 0, z);
    b.block(M.concreteDark, F, 1.2, 0.4, 1.2, 0, 0, 0); b.cyl(M.galv, F, 0.12, 10, 0, 5.2, 0, 0, 0, 8, 0.6);
    b.box(M.panelWhite, F, 0.6, 0.8, 0.4, 0, 3.0, 0.3); b.box(M.solar, F, 0.9, 0.03, 0.6, 0, 8.0, 0.2, 0, -0.45); b.box(M.ledAmber, F, 0.12, 0.12, 0.12, 0, 10.3, 0); b.post(F, 0, 0, 0.6);
  }
  // core store: racks of labelled core trays under a canopy (the data, physically)
  const CR = f.sub(-22, 0, 2, Math.PI / 2);
  for (const x of [-6, -2, 2, 6]) for (const z of [-2.2, 2.2]) b.block(M.galv, CR, 0.12, 3.6, 0.12, x, 0, z);
  b.box(M.panelGrey, CR, 13.4, 0.15, 5.2, 0, 3.7, 0, 0, 0.05); b.box(M.lamp, CR, 11, 0.04, 0.12, 0, 3.55, 0);
  for (const row of [-1, 1]) for (let lv = 0; lv < 4; lv++) {
    b.box(M.steelPaint, CR, 11, 0.04, 0.9, 0, 0.4 + lv * 0.7, row * 1.0);
    for (let k = 0; k < 10; k++) { b.box(M.wood, CR, 1.0, 0.12, 0.85, -4.95 + k * 1.1, 0.5 + lv * 0.7, row * 1.0); for (let c = 0; c < 3; c++) b.cyl((k + c + lv) % 3 ? M.concreteDark : M.concrete, CR, 0.06, 0.95, -4.95 + k * 1.1, 0.6 + lv * 0.7, row * 1.0 - 0.25 + c * 0.25, 0, Math.PI / 2, 8); }
  }
  b.solid(CR, 0, 0, 13, 4.6);
  b.pool(...CR.w(0, 0), 7, 0.25);
  // floods aimed at the hatch, gatehouse, bollards
  for (const [x, z, ry] of [[-14, -10, 0.8], [14, -10, -0.8], [-14, 18, 2.4], [14, 18, -2.4]] as [number, number, number][]) { const F = f.sub(x, 0, z, ry); b.block(M.galv, F, 0.18, 6, 0.18, 0, 0, 0); P.floodHead(b, F, 0, 6.1, 0.2, 0, 0.6); b.post(F, 0, 0, 0.2); }
  const GH = f.sub(12, 0, -24);
  b.block(M.panelWhite, GH, 3.2, 2.7, 2.6, 0, 0, 0); b.box(M.panelGrey, GH, 3.8, 0.14, 3.2, 0, 2.78, 0); b.box(M.window, GH, 2.0, 0.8, 0.05, 0, 1.6, -1.31); b.solid(GH, 0, 0, 3.2, 2.6);
  b.block(M.hazard, f, 0.18, 1.05, 6.0, 4, 0, -24); b.box(M.steelDark, f, 0.3, 1.1, 0.3, 4, 0.55, -27);
  for (let k = 0; k < 8; k++) P.bollard(b, f, -16 + k * 4.5, -28.5);
  P.stake(b, ...f.w(-6, -20), '05');
  b.sign(f, -10, 1.3, -27.5, 0, 3.2, 1.25, ['RESEARCH STATION', `GLOBAL MINIMUM · ELEV ${f.y.toFixed(0)} m`, 'SHAFT 1 · LIFT TO SUB-LEVELS']);

  // ---- precision: a low chamfered concrete perimeter wall around the whole pad, one gated opening at the road
  const wallSeg = (x0: number, z0: number, x1: number, z1: number) => {
    const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    b.box(M.concreteSmooth, f, 0.5, 1.15, L, mx, 0.58, mz, a); b.box(M.concreteSmooth, f, 0.62, 0.1, L + 0.1, mx, 1.18, mz, a);
    b.solid(f, mx, mz, 0.6, L, a);
  };
  const HW = 33, HD = 29;
  wallSeg(-HW, -HD, -1, -HD); wallSeg(23, -HD, HW, -HD); wallSeg(HW, -HD, HW, HD); wallSeg(HW, HD, -HW, HD); wallSeg(-HW, HD, -HW, -HD);
  // painted walkway from the gate to the collar: the only route across the apron
  decal(b, f, 2, -14, 4, 22, 0, (g, W, H) => { g.strokeStyle = 'rgba(232,228,216,.8)'; g.lineWidth = 6; for (const x of [0.12, 0.88]) { g.beginPath(); g.moveTo(W * x, 0); g.lineTo(W * x, H); g.stroke(); } g.lineWidth = 4; for (let y = 0; y < H; y += 46) { g.beginPath(); g.moveTo(W * 0.12, y); g.lineTo(W * 0.88, y + 18); g.stroke(); } });
  // controlled light: a ring of low bollard lamps around the collar, nothing brighter than it needs to be
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, F2 = SH.sub(Math.cos(a) * 9.5, 0, Math.sin(a) * 9.5); b.cyl(M.concreteDark, F2, 0.14, 0.7, 0, 0.35, 0, 0, 0, 8); b.cyl(M.lamp, F2, 0.12, 0.08, 0, 0.66, 0, 0, 0, 8); }
  // the descent system made visible: the lift cage held in the headframe above the open collar, ropes to the sheaves
  { const CG = SH.sub(0, 3.2, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.block(M.galv, CG, 0.1, 3.0, 0.1, sx * 1.15, 0, sz * 0.95); for (const y of [0, 1.5, 3.0]) { b.box(M.galv, CG, 2.4, 0.1, 0.1, 0, y, -0.95); b.box(M.galv, CG, 2.4, 0.1, 0.1, 0, y, 0.95); b.box(M.galv, CG, 0.1, 0.1, 2.0, -1.15, y, 0); b.box(M.galv, CG, 0.1, 0.1, 2.0, 1.15, y, 0); } b.box(M.steelDark, CG, 2.4, 0.12, 2.0, 0, 0.0, 0); b.box(M.steelDark, CG, 2.6, 0.35, 2.2, 0, 3.15, 0); b.box(M.lamp, CG, 1.6, 0.04, 0.3, 0, 2.95, 0); for (const sx of [-0.9, 0.9]) b.rod(M.steelDark, SH, [sx, 6.5, 0], [sx, HT + 0.2, 0], 0.035, 4); }
  // ventilation: an intake/exhaust fan house with an evasé stack, and two capped vents at the collar
  { const V = f.sub(20, 0, 10, Math.PI / 2); b.block(M.concreteSmooth, V, 7, 4.2, 5, 0, 0, 0); b.block(M.concreteDark, V, 7.4, 0.35, 5.4, 0, 4.2, 0); for (let k = 0; k < 9; k++) b.box(M.steelDark, V, 2.6, 0.06, 0.16, -1.5, 1.0 + k * 0.28, 2.53, 0, -0.5); b.solid(V, 0, 0, 7, 5);
    b.put(M.steelPaint, new THREE.CylinderGeometry(1.6, 1.0, 7, 20, 1, true), V, 2.2, 7.7, 0); b.put(M.steelPaint, new THREE.CylinderGeometry(1.0, 1.0, 0.6, 20), V, 2.2, 4.4, 0); b.cyl(M.steelDark, V, 1.62, 0.12, 2.2, 11.2, 0, 0, 0, 20);
    b.rod(M.galv, f, [17.5, 0.55, 10], [6.5, 0.55, 6.5], 0.32, 10); for (const t of [0.25, 0.5, 0.75]) b.block(M.concreteDark, f, 0.5, 0.25, 0.5, 17.5 - 11 * t, 0, 10 - 3.5 * t); }
  for (const sx of [-1, 1]) { const VV = SH.sub(sx * 7.5, 0, -6); b.block(M.concreteDark, VV, 1.4, 0.4, 1.4, 0, 0, 0); b.cyl(M.galv, VV, 0.35, 2.6, 0, 1.7, 0, 0, 0, 12); b.cyl(M.galv, VV, 0.7, 0.3, 0, 3.15, 0, 0, 0, 14, 0.4); b.post(VV, 0, 0, 0.6); }
  // seismometer vault: a half-buried concrete cube with a hatch — the station listens to the ground
  { const SV = f.sub(-24, 0, -18); b.block(M.concreteSmooth, SV, 2.6, 1.2, 2.6, 0, 0, 0); b.box(M.steelDark, SV, 1.2, 0.08, 1.2, 0, 1.24, 0); b.cable(M.rubber, SV, [[1.3, 0.6, 0], [3.5, 0.05, 2], [6, 0.05, 6]], 0.03); b.solid(SV, 0, 0, 2.6, 2.6); }
  b.finish(parent);
  buildResearchInterior(hf, parent, SH);
  return b;
}

/**
 * Underground: a domed rotunda at the foot of the lift, four laboratories radiating from it.
 * No real lights down here: lighting is BAKED into vertex colours from a set of warm practical sources,
 * so the space costs one draw call and nothing per pixel beyond an unlit material.
 */
function buildResearchInterior(hf: Heightfield, parent: THREE.Object3D, SH: Frame) {
  const Y = SH.y - 30, F = new Frame(SH.x, Y, SH.z, SH.rot);
  type Item = { g: THREE.BufferGeometry; c: THREE.Color };
  const items: Item[] = [];
  const _m = new THREE.Matrix4();
  const put = (g: THREE.BufferGeometry, hex: string, fr: Frame, lx: number, ly: number, lz: number, ry = 0, rx = 0) => {
    _m.compose(new THREE.Vector3(lx, ly, lz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
    const gg = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(fr.m, _m));
    items.push({ g: gg, c: new THREE.Color(hex).convertSRGBToLinear() });
  };
  const box = (hex: string, fr: Frame, w: number, h: number, d: number, lx: number, ly: number, lz: number, ry = 0, seg = 1) =>
    put(new THREE.BoxGeometry(w, h, d, Math.max(1, Math.round(w * seg)), Math.max(1, Math.round(h * seg)), Math.max(1, Math.round(d * seg))), hex, fr, lx, ly + h / 2, lz, ry);
  const lights: { p: THREE.Vector3; i: number; r: number }[] = [];
  const lamp = (fr: Frame, lx: number, ly: number, lz: number, i: number, r: number) => { const [x, z] = fr.w(lx, lz); lights.push({ p: new THREE.Vector3(x, fr.y + ly, z), i, r }); };
  const em = new Builder(hf, 'research-interior-emissive', 0); // lamps, screens: real emissive materials
  em.globalMerge = false; // the interior is shown/hidden as a unit by the underground view

  // ---- rotunda: floor, wall, a shallow dome with the lift shaft through its crown
  const R = 9.5, H = 6.5, CON = '#a7a39a', CON2 = '#8d8a83', FLOOR = '#8e8b84', STEEL = '#5b6260', DARK = '#2e3233', WARM = '#9a8d78';
  put(new THREE.CylinderGeometry(R, R, 0.3, 64, 1).translate(0, -0.15, 0), FLOOR, F, 0, 0, 0);
  // wall arcs between the four lab doorways (doors at the diagonals; the north wall carries the board)
  const doorAng = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4].map((a) => Math.PI - a).map((t) => ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).sort((a, b) => a - b);
  const gap = 0.145;
  doorAng.forEach((t, i) => {
    const t0 = t + gap, t1 = (i + 1 < doorAng.length ? doorAng[i + 1] : doorAng[0] + 2 * Math.PI) - gap;
    put(inward(new THREE.CylinderGeometry(R, R, H, 24, 8, true, t0, t1 - t0)), CON, F, 0, H / 2, 0);
    put(inward(new THREE.CylinderGeometry(R, R, H - 3.0, 3, 3, true, t - gap, 2 * gap)), CON, F, 0, 3.0 + (H - 3.0) / 2, 0); // lintel over the door
  });
  { const d = new THREE.SphereGeometry(R, 64, 10, 0, Math.PI * 2, 0.32, Math.PI / 2 - 0.32); d.scale(1, 0.35, 1); put(inward(d), CON2, F, 0, H, 0); }
  // radial floor joints and a brass datum ring set into the floor at the centre
  for (let k = 0; k < 16; k++) box('#615f59', F.sub(0, 0, 0, (k / 16) * Math.PI * 2), 0.025, 0.008, R - 3.4, 0, 0, (R + 3.4) / 2);
  put(new THREE.TorusGeometry(3.3, 0.06, 6, 64).rotateX(Math.PI / 2), '#b08a3a', F, 0, 0.02, 0);
  // lift: the shaft drops into the room's crown; the cage stands at the bottom, gate open to the south
  put(inward(new THREE.CylinderGeometry(3.6, 3.6, 24, 40, 6, true)), CON2, F, 0, H + 12, 0);
  { const LC = F.sub(0, 0, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(STEEL, LC, 0.12, 3.1, 0.12, sx * 1.25, 0, sz * 1.05); box(STEEL, LC, 2.6, 0.15, 2.2, 0, 3.1, 0); box(DARK, LC, 2.5, 0.1, 2.1, 0, 0, 0); for (const y of [1.0, 2.0]) { box(STEEL, LC, 2.5, 0.06, 0.06, 0, y, -1.05); box(STEEL, LC, 0.06, 0.06, 2.1, -1.25, y, 0); box(STEEL, LC, 0.06, 0.06, 2.1, 1.25, y, 0); } em.box(M.lamp, LC, 1.6, 0.04, 0.3, 0, 3.05, 0); lamp(LC, 0, 2.8, 0, 1.1, 5); }
  // overhead light ring + cable trays radiating to the lab doors (the room is organised around the descent)
  em.put(M.lamp, new THREE.TorusGeometry(6.2, 0.07, 6, 72).rotateX(Math.PI / 2), F, 0, 5.2, 0);
  for (let k = 0; k < 8; k++) lamp(F, Math.cos(k * Math.PI / 4) * 6.2, 5.0, Math.sin(k * Math.PI / 4) * 6.2, 0.55, 7);

  // ---- the research wall (north): a large chalkboard. Drawn on it: the Basin itself as a contour map,
  //      a descent path to the minimum, and open questions as marks — the world, written down.
  {
    const c = document.createElement('canvas'); c.width = 2048; c.height = 768; const g = c.getContext('2d')!;
    g.fillStyle = '#1f2a24'; g.fillRect(0, 0, 2048, 768);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(230,230,220,${Math.random() * 0.03})`; g.fillRect(Math.random() * 2048, Math.random() * 768, 2 + Math.random() * 30, 1 + Math.random() * 3); }
    g.strokeStyle = 'rgba(232,228,214,.82)'; g.lineWidth = 3;
    const cx = 620, cy = 420;
    for (let k = 1; k <= 9; k++) { g.beginPath(); for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.05) { const r = k * 34 * (1 + 0.12 * Math.sin(a * 3 + k) + 0.06 * Math.sin(a * 7 - k)); g.lineTo(cx + Math.cos(a) * r * 1.35, cy + Math.sin(a) * r * 0.85 - k * 6); } g.stroke(); }
    g.beginPath(); g.arc(cx - 170, cy - 150, 22, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(cx - 170, cy - 150, 10, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(255,140,80,.85)'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx + 40, cy - 330); for (let t = 0; t <= 1; t += 0.02) g.lineTo(cx + 40 + Math.sin(t * 9) * 70 * (1 - t), cy - 330 + t * 330); g.stroke();
    g.fillStyle = 'rgba(255,140,80,.9)'; g.beginPath(); g.arc(cx, cy, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(232,228,214,.85)'; g.font = 'italic 44px Georgia, serif';
    g.fillText('θ* = argmin L(θ)', 1120, 150); g.fillText('∇L → 0  ≠  done', 1120, 240); g.fillText('?', 1600, 420); g.fillText('generalise?', 1120, 520); g.fillText('what does the model see?', 1120, 620);
    g.strokeStyle = 'rgba(232,228,214,.6)'; g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(1120, 300 + i * 6); g.lineTo(1480 - i * 40, 300 + i * 6); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.75), new THREE.MeshBasicMaterial({ map: t, color: '#c8c0b0' }));
    const bp = F.sub(0, 2.6, -R + 0.45); board.position.set(bp.x, bp.y, bp.z); board.rotation.y = F.rot; em.add(board);
    box(DARK, F, 10.4, 4.1, 0.2, 0, 0.55, -R + 0.32); em.box(M.lamp, F, 9.5, 0.05, 0.2, 0, 4.85, -R + 0.9); lamp(F, 0, 4.6, -R + 1.6, 0.9, 6.5);
    box('#5a4a3a', F, 9.6, 0.08, 0.35, 0, 0.82, -R + 0.62);
  }

  // ---- four laboratories through short passages, each with its own equipment and light
  const labs: { name: string; ang: number; fill: (L: Frame) => void }[] = [
    { name: 'COMPUTER VISION', ang: Math.PI / 4, fill: (L) => {
      // optical table with a camera on a rail gantry aimed at a calibration target; a light box
      box(STEEL, L, 3.2, 0.85, 1.6, 0, 0, 0); box('#3c4244', L, 3.3, 0.12, 1.7, 0, 0.85, 0);
      for (const x of [-1.4, 1.4]) box(STEEL, L, 0.08, 1.6, 0.08, x, 0.97, -0.7); box(STEEL, L, 2.9, 0.1, 0.1, 0, 2.55, -0.7);
      box(DARK, L, 0.3, 0.22, 0.35, 0.3, 2.3, -0.6); put(new THREE.CylinderGeometry(0.08, 0.1, 0.25, 12).rotateX(Math.PI / 2), DARK, L, 0.3, 2.3, -0.3);
      { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#eee'; g.fillRect(i * 32, j * 32, 32, 32); } const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: tx, color: '#9a968c' })); const p = L.sub(0.3, 1.75, 2.6); m.position.set(p.x, p.y, p.z); m.rotation.y = L.rot + Math.PI; em.add(m); box(STEEL, L, 0.06, 1.2, 0.06, 0.3, 0, 2.62); }
      em.box(M.screen, L, 1.6, 1.0, 0.05, -2.9, 1.2, 1.2, Math.PI / 2); box(DARK, L, 1.7, 1.1, 0.06, -2.94, 1.15, 1.2, Math.PI / 2);
      for (let k = 0; k < 4; k++) box(k % 2 ? '#2b3033' : '#4a5240', L, 0.6, 0.26, 0.42, 2.6, 0.0 + k * 0.27, -2.6 + (k % 2) * 0.1);
      lamp(L, 0, 3.2, 0, 1.1, 6); } },
    { name: 'EXPERIMENTS', ang: (3 * Math.PI) / 4, fill: (L) => {
      // instrument racks in two rows, a glazed test enclosure with a sensor rig, cable tray overhead
      for (const x of [-2.4, 2.4]) for (let k = 0; k < 3; k++) { box('#2a2e30', L, 0.62, 2.1, 0.9, x, 0, -2.4 + k * 1.0); for (let r = 0; r < 6; r++) em.box(M.ledAmber, L, 0.02, 0.012, 0.012, x + (x < 0 ? 0.32 : -0.32), 0.4 + r * 0.25, -2.4 + k * 1.0 + 0.2, 0); }
      box(STEEL, L, 2.2, 0.08, 1.6, 0, 0.9, 1.7); for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(STEEL, L, 0.06, 0.9, 0.06, sx * 1.0, 0, 1.7 + sz * 0.7);
      put(new THREE.BoxGeometry(2.1, 1.3, 1.5), '#6c7d80', L, 0, 1.63, 1.7); box(DARK, L, 0.5, 0.4, 0.5, 0, 0.98, 1.7); put(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12), STEEL, L, 0.5, 1.3, 1.7);
      box(STEEL, L, 0.5, 0.06, 5.5, 0, 3.0, 0); lamp(L, 0, 3.2, 0.5, 1.0, 6.5); } },
    { name: 'DATA', ang: (5 * Math.PI) / 4, fill: (L) => {
      // the archive: core trays (physical samples) on one side, storage racks on the other
      for (let lv = 0; lv < 4; lv++) { box(STEEL, L, 0.9, 0.04, 5.4, -2.6, 0.35 + lv * 0.6, 0); for (let k = 0; k < 9; k++) box(k % 3 ? '#6e5c46' : '#7d6a52', L, 0.8, 0.1, 0.55, -2.6, 0.4 + lv * 0.6, -2.4 + k * 0.6); }
      for (let k = 0; k < 4; k++) { box('#23272a', L, 0.62, 2.1, 1.0, 2.5, 0, -2.0 + k * 1.05); for (let r = 0; r < 8; r++) em.box(M.ledAmber, L, 0.012, 0.012, 0.02, 2.18, 0.35 + r * 0.22, -2.2 + k * 1.05, 0); }
      lamp(L, 0, 3.2, 0, 1.0, 6.5); } },
    { name: 'MEDICAL AI', ang: (7 * Math.PI) / 4, fill: (L) => {
      // a light box wall of greyscale scan slices (abstract), two workstations, a reading chair
      const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d')!; g.fillStyle = '#0c0d0d'; g.fillRect(0, 0, 1024, 256);
      for (let i = 0; i < 6; i++) { const x = 20 + i * 168; const gr = g.createRadialGradient(x + 74, 128, 4, x + 74, 128, 92); gr.addColorStop(0, '#d8dad6'); gr.addColorStop(0.55, '#8a8c88'); gr.addColorStop(1, '#141515'); g.fillStyle = gr; g.beginPath(); g.ellipse(x + 74, 128, 66 - i * 3, 92 - i * 4, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(10,10,10,.55)'; g.beginPath(); g.ellipse(x + 60, 112, 18, 26, 0.3, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(x + 92, 118, 16, 24, -0.3, 0, Math.PI * 2); g.fill(); }
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), new THREE.MeshBasicMaterial({ map: tx, color: '#d8dccf' })); const p = L.sub(0, 1.8, 3.25); m.position.set(p.x, p.y, p.z); m.rotation.y = L.rot + Math.PI; em.add(m);
      box(DARK, L, 5.4, 1.5, 0.08, 0, 1.05, 3.33);
      for (const x of [-1.3, 1.3]) { box('#6e5c46', L, 1.6, 0.05, 0.7, x, 0.75, 1.6); for (const sx of [-0.7, 0.7]) box(STEEL, L, 0.05, 0.75, 0.6, x + sx, 0, 1.6); em.box(M.screen, L, 0.7, 0.42, 0.03, x, 1.05, 1.82); box(DARK, L, 0.74, 0.46, 0.04, x, 0.82, 1.84); }
      box('#3b3a37', L, 0.6, 0.45, 0.6, 0.2, 0, -1.2); box('#3b3a37', L, 0.6, 0.6, 0.12, 0.2, 0.45, -1.48);
      lamp(L, 0, 3.0, 1.0, 1.0, 6); } },
  ];
  for (const lab of labs) {
    const dirx = Math.sin(lab.ang), dirz = -Math.cos(lab.ang); // ang measured clockwise from north (north wall = research board)
    const ry = Math.atan2(dirx, dirz);
    const P2 = F.sub(dirx * (R + 0.9), 0, dirz * (R + 0.9), ry), L = F.sub(dirx * (R + 1.8 + 3.3), 0, dirz * (R + 1.8 + 3.3), ry);
    // passage: floor, ceiling, two walls — open at both ends
    const pl = (hex: string, fr: Frame, w: number, h: number, lx: number, ly: number, lz: number, ry: number, rx: number) => put(new THREE.PlaneGeometry(w, h, Math.max(1, Math.round(w)), Math.max(1, Math.round(h))), hex, fr, lx, ly, lz, ry, rx);
    pl(FLOOR, P2, 2.6, 2.6, 0, 0.001, 0, 0, -Math.PI / 2); pl(CON2, P2, 2.6, 2.6, 0, 3.0, 0, 0, Math.PI / 2);
    pl(CON2, P2, 2.6, 3.0, -1.3, 1.5, 0, Math.PI / 2, 0); pl(CON2, P2, 2.6, 3.0, 1.3, 1.5, 0, -Math.PI / 2, 0);
    // lab: five faces plus a front wall with the doorway cut out
    const W = 7, D = 6.8, Hh = 3.8, dw = 2.6, dh = 3.0;
    pl(FLOOR, L, W, D, 0, 0.001, 0, 0, -Math.PI / 2); pl(CON2, L, W, D, 0, Hh, 0, 0, Math.PI / 2);
    pl(CON, L, D, Hh, -W / 2, Hh / 2, 0, Math.PI / 2, 0); pl(CON, L, D, Hh, W / 2, Hh / 2, 0, -Math.PI / 2, 0); pl(CON, L, W, Hh, 0, Hh / 2, D / 2, Math.PI, 0);
    pl(CON, L, (W - dw) / 2, Hh, -(W + dw) / 4, Hh / 2, -D / 2, 0, 0); pl(CON, L, (W - dw) / 2, Hh, (W + dw) / 4, Hh / 2, -D / 2, 0, 0); pl(CON, L, dw, Hh - dh, 0, dh + (Hh - dh) / 2, -D / 2, 0, 0);
    em.box(M.lamp, L, 0.25, 0.04, 4.5, 0, 3.76, 0);
    const tex = signTexture([lab.name, 'SUB-LEVEL 1'], { w: 512, h: 128, bg: '#16201b', fg: '#e8e4d8' });
    const sgn = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.5), new THREE.MeshBasicMaterial({ map: tex, color: '#cfc8b8' }));
    const sp = F.sub(dirx * (R - 0.08), 3.4, dirz * (R - 0.08), ry); sgn.position.set(sp.x, sp.y, sp.z); sgn.rotation.y = sp.rot + Math.PI; em.add(sgn);
    lab.fill(L);
    lamp(P2, 0, 2.8, 0, 0.5, 4);
  }
  // instrument consoles around the rotunda edge, between the doorways (status of each line of work)
  for (const a of [Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const CF = F.sub(Math.sin(a) * (R - 1.0), 0, -Math.cos(a) * (R - 1.0), Math.atan2(Math.sin(a), -Math.cos(a)) + Math.PI);
    box('#3d4542', CF, 1.8, 0.9, 0.8, 0, 0, 0); box(DARK, CF, 1.7, 0.7, 0.06, 0, 1.25, 0.3); em.box(M.screen, CF, 1.5, 0.55, 0.02, 0, 1.6, 0.26);
    lamp(CF, 0, 1.8, -0.6, 0.35, 3);
  }
  // ---- bake: albedo x (ambient + warm practicals with soft wrap), corner occlusion near floor and ceiling
  const merged = mergeGeometries(items.map((it) => { const g = it.g; for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k); return g; }), false)!;
  const pos = merged.attributes.position, nor = merged.attributes.normal, col = new Float32Array(pos.count * 3);
  let vi = 0; const p = new THREE.Vector3(), n = new THREE.Vector3(), Ld = new THREE.Vector3();
  for (const it of items) {
    const cnt = it.g.attributes.position.count;
    for (let k = 0; k < cnt; k++, vi++) {
      p.fromBufferAttribute(pos, vi); n.fromBufferAttribute(nor, vi);
      let lr = 0.09, lg = 0.085, lb = 0.085;
      for (const l of lights) {
        Ld.subVectors(l.p, p); const d = Ld.length(); Ld.divideScalar(d || 1);
        const wrap = 0.3 + 0.7 * Math.max(0, n.dot(Ld)), att = l.i / (1 + (d / l.r) ** 2) * wrap;
        lr += att * 1.0; lg += att * 0.8; lb += att * 0.58;
      }
      const mott = 0.9 + 0.2 * (Math.sin(p.x * 1.7 + p.z * 0.9) * Math.sin(p.y * 2.3 - p.x * 0.6) * 0.5 + 0.5);
      const hy = p.y - Y, occ = mott * (0.62 + 0.38 * Math.min(1, hy / 0.9)) * (0.8 + 0.2 * Math.min(1, Math.max(0, (H + 2 - hy) / 2)));
      col[vi * 3] = it.c.r * lr * occ; col[vi * 3 + 1] = it.c.g * lg * occ; col[vi * 3 + 2] = it.c.b * lb * occ;
    }
  }
  merged.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ vertexColors: true }));
  mesh.name = 'research-interior'; mesh.matrixAutoUpdate = false; parent.add(mesh);
  return em.finish(parent);
}
