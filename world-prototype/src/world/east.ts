import * as THREE from 'three';
import type { Heightfield } from '../heightfield';
import { Builder, Frame } from './kit';
import { M, interiorCard, weathered } from './materials';
import * as P from './props';
import { padFrame, decal } from './rim';
import { Rover } from '../rover';

// Three industrial sites, three different architectures:
//   Diagnostics Bay   SERVICE  — open cantilever canopy over a concrete apron; the vehicle is the anchor
//   Agent Operations  COMPUTE  — gravel compound of identical containerised modules under an overhead cable ladder
//   Workshop          MAKE     — open timber frame on a dirt yard; an unfinished robot under a hoist

const evPaint = weathered({ color: '#55626a', roughness: 0.36, metalness: 0.5 }, { grime: 0.25, streak: 0.15 });
const evPaintLight = weathered({ color: '#c9c7c0', roughness: 0.4, metalness: 0.35 }, { grime: 0.35, streak: 0.25 });
const timber = weathered({ color: '#7a6448', roughness: 0.88 }, { grime: 0.55, streak: 0.45 });
const timberDark = weathered({ color: '#56463a', roughness: 0.9 }, { grime: 0.5, streak: 0.4 });
const tailLamp = new THREE.MeshStandardMaterial({ color: '#5a1410', emissive: '#7a1a10', emissiveIntensity: 0.6 });
const toolRed = new THREE.MeshStandardMaterial({ color: '#3a2420', roughness: 0.5, metalness: 0.4 });

/** A compact EV hatchback: extruded side profile with wheel arches, glazing, lamps. */
function car(b: Builder, f: Frame, lx: number, ly: number, lz: number, ry: number, paint: THREE.Material, o: { frunk?: boolean; noCollide?: boolean } = {}) {
  const sf = f.sub(lx, ly, lz, ry);
  const prof = new THREE.Shape([[-2.1, 0.34], [-2.08, 0.98], [-1.66, 1.42], [0.28, 1.47], [1.06, 1.02], [2.0, 0.86], [2.13, 0.56], [2.08, 0.34], [1.72, 0.34], [1.62, 0.62], [1.08, 0.62], [0.98, 0.34], [-0.98, 0.34], [-1.08, 0.62], [-1.62, 0.62], [-1.72, 0.34]].map(([x, y]) => new THREE.Vector2(x, y)));
  const body = new THREE.ExtrudeGeometry(prof, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 2 }).translate(0, 0, -0.8);
  b.put(paint, body, sf, 0, 0, 0, 0, Math.PI / 2, 0);
  const glassS = new THREE.Shape([[-1.98, 1.0], [-1.62, 1.38], [0.26, 1.42], [0.98, 1.03]].map(([x, y]) => new THREE.Vector2(x, y)));
  b.put(M.glass, new THREE.ExtrudeGeometry(glassS, { depth: 1.74, bevelEnabled: false }).translate(0, 0, -0.87), sf, 0, 0, 0, 0, Math.PI / 2, 0);
  const wheel = new THREE.CylinderGeometry(0.33, 0.33, 0.22, 18).rotateZ(Math.PI / 2);
  for (const sx of [-1, 1]) for (const sz of [-1.35, 1.35]) { b.put(M.rubber, wheel, sf, sx * 0.8, 0.33, sz); b.cyl(M.galv, sf, 0.2, 0.23, sx * 0.8, 0.33, sz, 0, Math.PI / 2, 12); }
  b.box(M.lamp, sf, 1.2, 0.04, 0.03, 0, 0.82, 2.16);
  b.box(tailLamp, sf, 1.3, 0.05, 0.03, 0, 0.92, -2.16);
  b.box(M.steelDark, sf, 1.6, 0.14, 0.06, 0, 0.44, 2.15);
  if (o.frunk) b.box(paint, sf, 1.5, 0.04, 0.95, 0, 1.38, 1.5, 0, -1.05);
  if (!o.noCollide) b.solid(sf, 0, 0, 1.8, 4.3);
  return sf;
}

/** EV charging pedestal; the cable is holstered unless the caller draws a connection. */
function charger(b: Builder, f: Frame, lx: number, lz: number, ry: number, holstered = true) {
  const sf = f.sub(lx, 0, lz, ry);
  b.block(M.concreteDark, sf, 0.7, 0.15, 0.5, 0, 0, 0);
  b.rbox(M.panelWhite, sf, 0.48, 1.55, 0.3, 0, 0.92, 0, 0, 0.05);
  b.box(M.screen, sf, 0.26, 0.18, 0.01, 0, 1.38, 0.155);
  b.box(M.ledAmber, sf, 0.3, 0.02, 0.01, 0, 1.6, 0.155);
  b.box(M.steelDark, sf, 0.08, 0.14, 0.1, 0.18, 1.0, 0.18);
  if (holstered) b.cable(M.rubber, sf, [[0.18, 1.0, 0.22], [0.35, 0.4, 0.3], [0.2, 0.5, 0.2]], 0.02);
  b.solid(sf, 0, 0, 0.6, 0.4);
  return sf;
}

// ------------------------------------------------------------------ 4. DIAGNOSTICS BAY — evDOCTOR
// Read order from the trail: entry apron with tyre tracks -> scanner arch -> EV raised on the lift under
// the canopy with its battery pack lowered beneath it -> diagnostic cart -> service shed and parts behind.
export function buildBay(hf: Heightfield, parent: THREE.Object3D) {
  const b = new Builder(hf, 'diagnostics-bay', 1.0), f = padFrame(hf, 'bay');
  // local frame: -x faces west (trail, basin); canopy columns stand on the east side and the roof cantilevers west
  const C = f.sub(0, 0, 0);
  const L = 17, cx = 2.5, roofY = 5.6, reach = 9.5;
  for (const z of [-L / 2 + 0.6, 0, L / 2 - 0.6]) {
    b.block(M.concreteDark, C, 0.9, 0.3, 0.9, cx, 0, z);
    b.block(M.steelPaint, C, 0.38, roofY, 0.38, cx, 0, z);
    b.rod(M.steelPaint, C, [cx, roofY - 0.2, z], [cx - reach, roofY + 0.35, z], 0.16, 4);           // cantilever beam
    b.rod(M.galv, C, [cx, roofY + 2.3, z], [cx - reach + 0.4, roofY + 0.4, z], 0.035, 4);          // tension rod
    b.block(M.steelPaint, C, 0.22, 2.3, 0.22, cx, roofY, z);                                         // mast stub
    b.post(C, cx, z, 0.3);
  }
  // thin roof plate, slight fall to the west, lamp lines underneath
  const roof = C.sub(cx - reach / 2 + 0.3, roofY + 0.25, 0);
  b.box(M.panelGrey, roof, reach + 1.2, 0.16, L + 0.6, 0, 0, 0, 0, 0, 0.035);
  b.box(M.steelDark, roof, reach + 1.3, 0.34, 0.12, 0, -0.1, -L / 2 - 0.3, 0, 0, 0.035);
  b.box(M.steelDark, roof, reach + 1.3, 0.34, 0.12, 0, -0.1, L / 2 + 0.3, 0, 0, 0.035);
  for (const x of [-3, 0.5, 3.5]) b.box(M.lamp, roof, 0.18, 0.04, L - 2, x, -0.11, 0);
  { const p = C.sub(cx - 4, roofY - 0.6, -3.5); b.light(p.x, p.y, p.z, '#ffd8a8', 46, 24); }
  b.pool(...C.w(-2, -3.5), 9, 0.3);

  // BAY 1: the anchor — EV raised on a two-post lift, battery pack lowered onto a lift table beneath it
  const B1 = C.sub(-2.5, 0, -3.8);
  for (const sx of [-1, 1]) {
    b.block(M.steelPaint, B1, 0.36, 4.0, 0.5, sx * 1.75, 0, 0); b.block(M.hazard, B1, 0.37, 0.5, 0.51, sx * 1.75, 0.2, 0);
    b.block(M.steelDark, B1, 0.6, 0.12, 0.7, sx * 1.75, 0, 0);
    for (const sz of [-1, 1]) b.rod(M.steelDark, B1, [sx * 1.6, 1.5, 0], [sx * 0.75, 1.5, sz * 1.35], 0.06, 4);
  }
  b.box(M.steelDark, B1, 3.8, 0.16, 0.2, 0, 4.05, 0);
  car(b, B1, 0, 1.25, 0, Math.PI / 2, evPaint, { frunk: true, noCollide: true });
  b.solid(B1, 0, 0, 4.4, 2.6);
  // battery pack on the lift table (the thing being diagnosed)
  b.block(M.steelPaint, B1, 1.9, 0.08, 1.3, 0, 0.0, 0);
  b.rod(M.steelDark, B1, [-0.6, 0.08, -0.4], [0.6, 0.62, 0.4], 0.04, 4); b.rod(M.steelDark, B1, [-0.6, 0.08, 0.4], [0.6, 0.62, -0.4], 0.04, 4);
  b.block(M.steelDark, B1, 2.2, 0.06, 1.5, 0, 0.64, 0);
  b.rbox(M.panelInk, B1, 2.0, 0.22, 1.35, 0, 0.82, 0, 0, 0.03);
  for (let k = 0; k < 6; k++) b.box(M.galv, B1, 0.02, 0.24, 1.2, -0.85 + k * 0.34, 0.83, 0);
  b.box(M.hazard, B1, 0.3, 0.12, 0.3, 0.9, 0.98, 0.5);
  b.cable(M.orange, B1, [[0.95, 0.9, 0.55], [1.25, 1.0, 0.8], [1.6, 1.15, 0.9]], 0.03);
  // diagnostic cart, its lead plugged into the raised vehicle
  const K = B1.sub(-2.7, 0, 1.4, 0.5);
  b.block(M.steelPaint, K, 0.75, 0.95, 0.55, 0, 0.12, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(M.rubber, K, 0.07, 0.05, sx * 0.3, 0.07, sz * 0.22, 0, Math.PI / 2, 8);
  b.box(M.steelDark, K, 0.6, 0.42, 0.04, 0, 1.38, -0.1, 0, -0.3); b.box(M.screen, K, 0.53, 0.35, 0.01, 0, 1.38, -0.07, 0, -0.3);
  b.box(M.steelDark, K, 0.5, 0.03, 0.35, 0, 1.08, 0.08);
  { const [ax, az] = K.w(0.25, -0.15), [bx2, bz2] = B1.w(-1.2, -0.9); b.cable(M.rubber, new Frame(0, f.y, 0, 0), [[ax, 1.2, az], [(ax + bx2) / 2, 0.5, (az + bz2) / 2], [bx2, 1.85, bz2]], 0.014); }
  // tool chest beside the lift
  const T = B1.sub(2.9, 0, 2.2);
  b.rbox(toolRed, T, 1.1, 1.0, 0.5, 0, 0.55, 0, 0, 0.03);
  for (let k = 0; k < 5; k++) b.box(M.galv, T, 0.9, 0.015, 0.02, 0, 0.25 + k * 0.17, 0.26);
  b.solid(T, 0, 0, 1.1, 0.5);

  // BAY 2: drive-on ramps with a second EV — ride-height / alignment check, sensor heads clamped to the wheels
  const B2 = C.sub(-2.5, 0, 4.4);
  for (const sx of [-1, 1]) { b.put(M.steelPaint, new THREE.BoxGeometry(0.55, 0.12, 4.6), B2, sx * 0.8, 0.5, 0); b.rod(M.steelPaint, B2, [sx * 0.8, 0.45, -2.3], [sx * 0.8, 0.02, -3.6], 0.08, 4); for (const z of [-2, 0, 2]) b.block(M.steelDark, B2, 0.5, 0.45, 0.12, sx * 0.8, 0, z); }
  car(b, B2, 0, 0.56, 0, Math.PI / 2, evPaintLight, { noCollide: true });
  for (const sx of [-1, 1]) for (const sz of [-1.35, 1.35]) b.box(M.steelDark, B2, 0.35, 0.3, 0.08, sz, 0.9, sx * 1.12);
  b.solid(B2, 0, 0, 4.6, 2.2);

  // floor markings, drain, oil stains; tyre tracks curving in from the entry
  decal(b, C, -3.5, 0, 12, 19, 0, (g, W, H) => {
    const mx = (x: number) => (x + 6) / 12 * W, mz = (z: number) => (z + 9.5) / 19 * H;
    g.strokeStyle = 'rgba(232,228,216,.75)'; g.lineWidth = 7;
    g.strokeRect(mx(-1.8), mz(-6.6), mx(3.4) - mx(-1.8), mz(-1) - mz(-6.6)); g.strokeRect(mx(-1.8), mz(1.6), mx(3.4) - mx(-1.8), mz(7.2) - mz(1.6));
    g.fillStyle = 'rgba(232,228,216,.7)'; g.font = '700 46px ui-monospace, Menlo, monospace'; g.textAlign = 'center';
    g.save(); g.translate(mx(-3.6), mz(-3.8)); g.rotate(-Math.PI / 2); g.fillText('BAY 01', 0, 0); g.restore();
    g.save(); g.translate(mx(-3.6), mz(4.4)); g.rotate(-Math.PI / 2); g.fillText('BAY 02', 0, 0); g.restore();
    g.fillStyle = 'rgba(16,13,10,.38)'; for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(mx(0.8 + Math.sin(i * 3) * 0.6), mz(-3.8 + Math.cos(i * 5) * 0.8), 24 + i * 5, 14 + i * 3, i, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = 'rgba(30,30,30,.6)'; g.fillRect(mx(-0.4), mz(-0.4), mx(0.4) - mx(-0.4), mz(0.4) - mz(-0.4));
    g.strokeStyle = 'rgba(10,10,10,.85)'; g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(mx(-0.35), mz(-0.35 + i * 0.14)); g.lineTo(mx(0.35), mz(-0.35 + i * 0.14)); g.stroke(); }
  }, 768);
  decal(b, f, -13, -1, 16, 12, 0, (g, W, H) => {
    g.strokeStyle = 'rgba(28,24,20,.28)'; g.lineWidth = 18;
    for (const [z0, z1] of [[0.5, 0.22], [0.5, 0.8]]) for (const off of [-0.09, 0.09]) { g.beginPath(); g.moveTo(0, H * (z0 + off)); g.bezierCurveTo(W * 0.45, H * (z0 + off), W * 0.6, H * (z1 + off), W, H * (z1 + off)); g.stroke(); }
  }, 512);
  // drive-through scanner arch at the apron entry: vehicles are scanned on the way in
  const A = f.sub(-11.5, 0, -1.5);
  for (const sz of [-1, 1]) { b.block(M.panelWhite, A, 0.6, 4.3, 0.5, 0, 0, sz * 3.3); b.box(M.lamp, A, 0.05, 3.2, 0.08, 0.31, 2.1, sz * 3.05); b.solid(A, 0, sz * 3.3, 0.6, 0.6); }
  b.box(M.panelWhite, A, 0.7, 0.55, 7.1, 0, 4.55, 0);
  for (let k = 0; k < 4; k++) { b.box(M.steelDark, A, 0.25, 0.2, 0.3, 0, 4.2, -2.1 + k * 1.4); b.cyl(M.glass, A, 0.07, 0.04, 0, 4.08, -2.1 + k * 1.4, 0, 0, 10); }
  b.box(M.steelDark, A, 1.4, 0.05, 5.2, 0, 0.03, 0);

  // charging line on the north edge: two pedestals, one vehicle charging
  const CH = f.sub(-6, 0, -13.2);
  charger(b, CH, -2.2, 0, 0); charger(b, CH, 1.4, 0, 0, false);
  car(b, CH, 1.4, 0, 3.4, Math.PI, evPaint);
  b.cable(M.rubber, CH, [[1.58, 1.0, 0.2], [1.75, 0.3, 0.9], [1.9, 0.75, 1.15]], 0.022);
  decal(b, CH, 0, 3, 8, 6, 0, (g, W, H) => { g.strokeStyle = 'rgba(232,228,216,.7)'; g.lineWidth = 6; for (const x of [0.06, 0.5, 0.94]) { g.beginPath(); g.moveTo(W * x, 0); g.lineTo(W * x, H); g.stroke(); } g.fillStyle = 'rgba(232,228,216,.65)'; g.font = '700 40px ui-monospace, Menlo, monospace'; g.textAlign = 'center'; g.fillText('EV', W * 0.28, H * 0.6); g.fillText('EV', W * 0.72, H * 0.6); });

  // service shed behind the canopy: low mono-pitch, roll door half up, parts inside
  const S = f.sub(11.2, 0, 1, -Math.PI / 2);
  const SW = 12, SD = 8, SH = 4.4;
  b.block(M.concreteSmooth, S, SW + 0.3, 0.15, SD + 0.3, 0, 0, 0);
  b.block(M.corrugated, S, SW, SH, 0.18, 0, 0, -SD / 2);
  for (const sx of [-1, 1]) b.block(M.corrugated, S, 0.18, SH, SD, sx * SW / 2, 0, 0);
  b.block(M.corrugated, S, 3.2, SH, 0.18, -4.4, 0, SD / 2); b.block(M.corrugated, S, 3.2, SH, 0.18, 4.4, 0, SD / 2); b.block(M.corrugated, S, 5.6, 1.4, 0.18, 0, SH - 1.4, SD / 2);
  b.box(M.panelGrey, S, 5.4, 1.2, 0.08, 0, 2.4, SD / 2 + 0.1); for (let k = 0; k < 6; k++) b.box(M.steelDark, S, 5.4, 0.025, 0.1, 0, 1.85 + k * 0.2, SD / 2 + 0.12);
  b.box(M.panelGrey, S, SW + 0.8, 0.14, SD + 1.0, 0, SH + 0.25, 0.2, 0, 0.08);
  const card = new THREE.Mesh(new THREE.PlaneGeometry(5.3, 1.75), interiorCard('workshop')); const cp = S.sub(0, 0.95, SD / 2 - 0.4); card.position.set(cp.x, cp.y, cp.z); card.rotation.y = S.rot; b.add(card);
  b.solid(S, 0, -SD / 2, SW, 0.4); b.solid(S, -SW / 2, 0, 0.4, SD); b.solid(S, SW / 2, 0, 0.4, SD); b.solid(S, -4.4, SD / 2, 3.2, 0.4); b.solid(S, 4.4, SD / 2, 3.2, 0.4);
  // outdoor parts racking under a lean-to: modules, cells, wheels
  const R = f.sub(4.5, 0, -11.5, 0);
  for (const x of [-2.8, 0, 2.8]) for (const z of [-0.5, 0.5]) b.block(M.steelPaint, R, 0.08, 2.8, 0.08, x, 0, z);
  for (const y of [0.12, 1.15, 2.2]) for (const z of [-0.5, 0.5]) b.box(M.orange, R, 5.7, 0.09, 0.06, 0, y, z);
  for (const y of [0.17, 1.2]) for (let k = 0; k < 4; k++) b.rbox(k % 2 ? M.panelInk : M.wood, R, 1.1, 0.5, 0.85, -2.1 + k * 1.4, y + 0.27, 0, 0, 0.03);
  for (let k = 0; k < 3; k++) b.put(M.rubber, new THREE.TorusGeometry(0.28, 0.11, 8, 16).rotateY(Math.PI / 2), R, -1.4 + k * 0.6, 2.62, 0);
  b.box(M.panelGrey, R, 6.2, 0.1, 1.8, 0, 3.0, -0.2, 0, 0.1);
  b.solid(R, 0, 0, 5.8, 1.2);
  // cable reels, battery service trolley, waste-oil drums on a spill tray, tyres
  P.cableReel(b, f, -7.5, 0, 8.5, 0.6); P.cableReel(b, f, -8.7, 0, 9.1, 0.2, 0.42);
  { const T2 = f.sub(2.8, 0, 11.2, 0.3); b.block(M.steelPaint, T2, 1.2, 0.08, 0.8, 0, 0.35, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) { b.cyl(M.rubber, T2, 0.09, 0.06, sx * 0.5, 0.09, sz * 0.32, 0, Math.PI / 2, 8); b.block(M.steelPaint, T2, 0.04, 0.3, 0.04, sx * 0.5, 0.05, sz * 0.32); } b.rbox(M.panelInk, T2, 1.0, 0.3, 0.7, 0, 0.6, 0, 0, 0.03); b.box(M.hazard, T2, 0.18, 0.1, 0.18, 0.35, 0.8, 0.2); b.solid(T2, 0, 0, 1.2, 0.8); }
  { const D = f.sub(13.5, 0, 9.5); b.block(M.hazard, D, 2.0, 0.18, 1.3, 0, 0, 0); for (let k = 0; k < 3; k++) P.drum(b, D, -0.6 + k * 0.6, 0.18, (k % 2) * 0.2, k === 1 ? M.panelInk : M.steelPaint); b.solid(D, 0, 0, 2, 1.3); }
  P.tyreStack(b, f, 14.5, -9, 5); P.tyreStack(b, f, 15.4, -8.2, 3);
  P.container(b, f, 14, -2.5, 0.04, M.corrugated);
  b.sign(f, 12.8, 1.6, -5.6, -Math.PI / 2, 1.6, 0.55, ['BATTERY QUARANTINE'], { posts: false });
  P.lightPole(b, f, -16, -9.5, 8, Math.PI / 2 + 0.3, false, 12); P.lightPole(b, f, -16, 9.5, 8, Math.PI / 2 - 0.3, false, 12);
  b.sign(f, -17.5, 1.2, 4.2, -Math.PI / 2, 2.4, 1.0, ['DIAGNOSTICS BAY', 'EV FAULT TRIAGE · BAY 01–02']);
  return b.finish(parent);
}

// ------------------------------------------------------------------ 5. AGENT OPERATIONS — compute compound
// Five identical containerised compute modules in a row — one per agent, each independent: its own cooling,
// its own power drop, its own status lamp. OP-01 and OP-02 run (doors open, racks lit); OP-03..05 are
// provisioned but dark. Power comes in from the north skid along an overhead cable ladder; a dry-cooler
// bank sits behind; the operations cabin looks across the row; the mast links to the Signal Tower.
export function buildAgentOps(hf: Heightfield, parent: THREE.Object3D, towerAt: [number, number]) {
  const b = new Builder(hf, 'agent-ops', 0.6), f = padFrame(hf, 'agent-ops');
  // the lower service bench shares the frame's origin and orientation but sits 3.5 m lower
  const fl = new Frame(f.x, padFrame(hf, 'agent-ops-lower').y, f.z, f.rot);
  const step = f.y - fl.y, WX = -2.75;                       // retaining wall line (local x) between the benches
  {
    // cast-in-place retaining wall along the lower bench's east edge, with coping, weep holes and a handrail on top
    const z0 = -7, z1 = 11, L = z1 - z0, zc = (z0 + z1) / 2;
    b.block(M.concreteSmooth, fl, 0.55, step + 0.15, L, WX, -0.15, zc); b.solid(fl, WX, zc, 0.6, L);
    b.box(M.concreteDark, fl, 0.75, 0.12, L + 0.2, WX + 0.08, step + 0.06, zc);
    for (let z = z0 + 1.5; z < z1; z += 3) b.cyl(M.steelDark, fl, 0.06, 0.6, WX - 0.25, 0.45, z, 0, Math.PI / 2, 8);
    P.railing(b, f, [[WX + 0.2, 0, z0 + 0.4], [WX + 0.2, 0, z1 - 0.4]], 1.0);
    // returns: the wall turns into the hillside at both ends instead of stopping in mid-air
    for (const [zz, dir] of [[z0, -1], [z1, 1]] as [number, number][]) b.block(M.concreteSmooth, fl, 2.6, step * 0.7, 0.5, WX - 1.1, -0.15, zz + dir * 0.2, dir * 0.35);
    // service stair from the lower bench to the upper bench beside the cable riser
    P.stairs(b, fl, WX - 0.3 - Math.round(step / 0.18) * 0.28, 0, 7.6, -Math.PI / 2, 1.0, step, Math.round(step / 0.18));
  }
  const modZ = [-10.4, -5.2, 0, 5.2, 10.4], MX = 4.5;
  const running = [true, true, false, false, false];
  const lamps: THREE.Mesh[] = [];
  modZ.forEach((z, i) => {
    const Mf = f.sub(MX, 0, z);
    for (const sx of [-1, 1]) b.block(M.concreteSmooth, Mf, 0.6, 0.35, 2.6, sx * 2.4, 0, 0);
    // module: a 6 m container, doors to the west
    const W = 6.06, H = 2.59, D = 2.44, y0 = 0.35;
    b.block(M.corrugatedInk, Mf, W, H, D, 0, y0, 0);
    b.block(M.steelDark, Mf, W + 0.04, 0.12, D + 0.04, 0, y0, 0); b.box(M.steelDark, Mf, W + 0.04, 0.1, D + 0.04, 0, y0 + H - 0.05, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.block(M.steelDark, Mf, 0.16, H, 0.16, sx * (W / 2 - 0.07), y0, sz * (D / 2 - 0.07));
    P.acUnit(b, Mf, 0.6, y0 + H, 0, Math.PI / 2, true);          // each agent cools itself
    const dX = -W / 2 - 0.02;
    if (running[i]) {
      const rk = new THREE.Mesh(new THREE.PlaneGeometry(D - 0.25, H - 0.3), interiorCard('racks')); const rp = Mf.sub(dX - 0.01, y0 + H / 2, 0); rk.position.set(rp.x, rp.y, rp.z); rk.rotation.y = Mf.rot - Math.PI / 2; b.add(rk);
      for (const sz of [-1, 1]) b.box(M.corrugatedInk, Mf, D / 2 - 0.05, H - 0.2, 0.06, dX - D / 4 + 0.1, y0 + H / 2, sz * (D / 2 + 0.05), sz * 0.0);
      b.pool(...Mf.w(dX - 1.6, 0), 2.6, 0.28, '#e8d8b8');
    } else {
      for (const sz of [-1, 1]) b.box(M.corrugatedInk, Mf, 0.06, H - 0.2, D / 2 - 0.05, dX, y0 + H / 2, sz * D / 4);
      for (const sz of [-0.35, 0.35]) b.box(M.galv, Mf, 0.05, H - 0.4, 0.03, dX - 0.04, y0 + H / 2, sz);
    }
    b.sign(Mf, dX - 0.03, y0 + H - 0.45, 0.8, -Math.PI / 2, 0.9, 0.3, [`OP-0${i + 1}`], { posts: false, accent: running[i] });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), (M.ledAmber as THREE.MeshStandardMaterial).clone());
    const lp = Mf.sub(dX + 0.1, y0 + H + 0.35, -0.9); lamp.position.set(lp.x, lp.y, lp.z); b.add(lamp); lamps.push(lamp);
    b.cyl(M.galv, Mf, 0.02, 0.35, dX + 0.1, y0 + H + 0.17, -0.9, 0, 0, 6);
    b.cable(M.rubber, f, [[MX - 4.1, 4.35, z], [MX - 3.6, 3.7, z + 0.3], [MX - 2.6, y0 + H + 0.05, z + 0.4]], 0.05);   // power drop from the ladder
    b.solid(Mf, 0, 0, W, D);
  });
  // each running agent blinks on its own loop period: independent processes, not a light show
  const periods = [1.3, 2.1, 0, 0, 0];
  b.updaters.push((_dt, t) => lamps.forEach((l, i) => { (l.material as THREE.MeshStandardMaterial).emissiveIntensity = periods[i] ? ((t % periods[i]) / periods[i] < 0.22 ? 2.8 : 0.2) : 0.04; }));

  // overhead cable ladder: galvanised posts, twin rails, rungs, a heavy bundle — the compound's spine
  const LX = MX - 4.3;
  for (let z = -16; z <= 13; z += 3.6) { b.block(M.galv, f, 0.14, 4.4, 0.14, LX, 0, z); b.box(M.galv, f, 0.9, 0.08, 0.1, LX, 4.3, z); b.post(f, LX, z, 0.14); }
  for (const sx of [-0.35, 0.35]) b.box(M.galv, f, 0.05, 0.12, 30, LX + sx, 4.42, -1.5);
  for (let z = -16; z <= 13; z += 0.6) b.box(M.galv, f, 0.7, 0.03, 0.04, LX, 4.38, z);
  b.cable(M.rubber, f, [[LX - 0.1, 4.5, -16.2], [LX, 4.5, -1.5], [LX + 0.1, 4.5, 13.2]], 0.12);
  b.cable(M.steelDark, f, [[LX + 0.15, 4.48, -16.2], [LX + 0.15, 4.48, 13.2]], 0.06);

  // power skid (north): transformer, switchgear, fence; the feed climbs to the ladder
  const X = f.sub(1.5, 0, -20.5);
  b.block(M.concreteDark, X, 7.2, 0.25, 4.0, 0, 0, 0);
  b.block(M.panelInk, X, 2.2, 2.2, 1.7, -2.0, 0.25, 0); for (let k = 0; k < 7; k++) b.box(M.steelDark, X, 0.05, 1.6, 1.8, -2.9 + k * 0.3, 1.25, 0);
  for (let k = 0; k < 3; k++) b.cyl(M.chalkPaint, X, 0.09, 0.55, -2.6 + k * 0.6, 2.75, 0, 0, 0, 8);
  for (let k = 0; k < 3; k++) { b.block(M.panelGrey, X, 0.9, 2.1, 0.8, 0.8 + k * 0.95, 0.25, 0); b.box(M.ledAmber, X, 0.05, 0.05, 0.02, 0.8 + k * 0.95, 1.9, 0.41); }
  b.cable(M.rubber, f, [[3.2, 2.2, -20.5], [LX + 0.6, 3.6, -18.2], [LX, 4.5, -16.2]], 0.09);
  P.fence(b, X, [[-4.2, -2.6], [4.2, -2.6], [4.2, 2.6], [-4.2, 2.6], [-4.2, -2.6]], 2.0);
  // dry-cooler bank behind the row: four big horizontal fans on a steel table — the compound's silhouette
  const DC = f.sub(MX + 7.5, 0, 0);
  for (const sx of [-1, 1]) for (let z = -8; z <= 8; z += 4) { b.block(M.galv, DC, 0.12, 2.2, 0.12, sx * 1.2, 0, z); b.post(DC, sx * 1.2, z, 0.12); }
  b.block(M.panelGrey, DC, 2.7, 0.9, 17, 0, 2.2, 0);
  for (let k = 0; k < 4; k++) {
    const z = -6.3 + k * 4.2; b.cyl(M.steelDark, DC, 1.05, 0.12, 0, 3.15, z, 0, 0, 20);
    const fan = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.03, 0.22), M.steelDark); const b2 = fan.clone(); b2.rotation.y = Math.PI / 2; fan.add(b2);
    const p = DC.sub(0, 3.24, z); fan.position.set(p.x, p.y, p.z); b.add(fan); const sp = 5 + k * 0.7; b.updaters.push((dt) => (fan.rotation.y += dt * sp));
  }
  b.rod(M.steelPaint, f, [MX + 3.1, 1.2, -3], [MX + 6.3, 1.2, -3], 0.13, 8); b.rod(M.steelPaint, f, [MX + 3.1, 1.6, 3], [MX + 6.3, 1.6, 3], 0.13, 8);
  b.solid(DC, 0, 0, 2.6, 17);
  // operations cabin: a prefab with one long window facing the row
  const O = fl.sub(-10.5, 0.6, 0, Math.PI / 2);
  for (const x of [-3.5, 0, 3.5]) for (const z of [-1.4, 1.4]) b.cyl(M.galv, O, 0.08, 0.8, x, -0.2, z, 0, 0, 8);
  b.block(M.panelWhite, O, 8, 2.8, 3.2, 0, 0, 0); b.box(M.panelGrey, O, 8.6, 0.14, 3.8, 0, 2.95, 0, 0, 0.05);
  b.box(M.steelDark, O, 6.4, 1.1, 0.08, 0, 1.75, 1.61);
  { const w = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 0.95), interiorCard('desk')); const p = O.sub(0, 1.75, 1.66); w.position.set(p.x, p.y, p.z); w.rotation.y = O.rot; b.add(w); }
  b.box(M.steelDark, O, 0.95, 2.05, 0.06, 3.6, 1.03, -1.62); P.stairs(b, O, 3.6, -0.6, -2.4, Math.PI, 1.0, 0.6, 3);
  P.acUnit(b, O, -3.0, 0, -1.8, Math.PI); P.mast(b, f, -13.5, 3.2, 6, { yagi: true });
  b.solid(O, 0, 0, 8, 3.2);
  b.pool(...O.w(0, 3.2), 5, 0.25);
  // grated cable trench from the cabin across the lower bench to the foot of the wall, then a riser
  // conduit up the wall face and a short tray to the nearest ladder post — one continuous cable route
  for (let k = 0; k < 4; k++) { const x = -8.0 + k * 1.3; b.box(M.concreteDark, fl, 1.25, 0.08, 0.9, x, 0.04, 2.5); for (let s = 0; s < 5; s++) b.box(M.steelDark, fl, 0.04, 0.03, 0.82, x - 0.5 + s * 0.25, 0.1, 2.5); }
  b.box(M.galv, fl, 0.35, step + 0.6, 0.12, WX - 0.34, (step + 0.6) / 2, 2.5);                     // riser channel on the wall face
  b.cable(M.rubber, fl, [[-3.6, 0.1, 2.5], [WX - 0.4, 0.3, 2.5], [WX - 0.4, step + 0.4, 2.5], [WX + 0.6, step + 0.25, 2.3], [MX - 4.3, step + 0.4, 2.0]], 0.07);
  b.cable(M.rubber, f, [[MX - 4.3, 0.4, 2.0], [MX - 4.3, 4.2, 2.0]], 0.05);
  // generator at the south end with exhaust stack and day tank; microwave mast aimed at the Signal Tower
  const GN = f.sub(6, 0, 16.5, 0);
  P.container(b, GN, 0, 0, Math.PI / 2, M.panelInk, 6.06);
  b.cyl(M.steelDark, GN, 0.16, 2.4, 2.2, 3.6, 0.6, 0, 0, 10); b.cyl(M.steelDark, GN, 0.2, 0.2, 2.2, 4.85, 0.6, 0, 0, 10);
  P.tank(b, GN, -4.6, 0.2, 0.9, 1.6, M.panelGrey);
  P.mast(b, f, -6, -16, 13, { dishTo: towerAt, guy: true });
  P.stake(b, ...f.w(-19, 8), '03');
  P.lightPole(b, f, -19, -8, 7, Math.PI / 2, false, 11);
  b.sign(fl, -15, 1.2, 10.5, -Math.PI / 2, 2.6, 1.0, ['AGENT OPERATIONS', 'COMPUTE ROW · OP-01..05']);
  return b.finish(parent);
}

// ------------------------------------------------------------------ 7. WORKSHOP — robotics + fabrication
// An open timber frame on a dirt yard. The unfinished ROVER-03 sits on a stand at the open front under an
// A-frame hoist; its wheels, lidar and battery lie on a tarp beside it in assembly order. Benches, tools and
// instruments line the back wall. Extension cords cross the floor because someone is working here.
export function buildWorkshop(hf: Heightfield, parent: THREE.Object3D) {
  const b = new Builder(hf, 'workshop', 1.0), f = padFrame(hf, 'workshop');
  const S = f.sub(2, 0, -2.5);
  const W = 13, D = 8, H = 3.6, ridge = 5.4;
  // floor: timber boards over sleepers (not a slab)
  b.block(timberDark, S, W + 0.4, 0.12, D + 0.4, 0, 0, 0);
  for (let k = 0; k < 16; k++) b.box(timber, S, W + 0.3, 0.03, 0.46, 0, 0.135, -D / 2 + 0.25 + k * 0.5);
  // posts, plates, rafters
  for (const x of [-W / 2, -W / 6, W / 6, W / 2]) for (const z of [-D / 2, D / 2]) { b.block(timber, S, 0.22, H, 0.22, x, 0.12, z); b.post(S, x, z, 0.18); }
  for (const z of [-D / 2, D / 2]) b.box(timber, S, W + 0.4, 0.24, 0.22, 0, H + 0.2, z);
  for (let k = 0; k <= 6; k++) {
    const x = -W / 2 + (k * W) / 6;
    b.rod(timber, S, [x, H + 0.3, -D / 2 - 0.4], [x, ridge, 0], 0.09, 4); b.rod(timber, S, [x, H + 0.3, D / 2 + 0.4], [x, ridge, 0], 0.09, 4);
  }
  // corrugated roof sheets on both slopes (one sheet missing: light comes through)
  const slope = Math.atan2(ridge - H - 0.3, D / 2 + 0.4), half = Math.hypot(D / 2 + 0.4, ridge - H - 0.3);
  for (const s of [-1, 1]) for (let k = 0; k < 6; k++) {
    if (s === 1 && k === 4) continue;
    const x = -W / 2 + W / 12 + (k * W) / 6;
    b.box(M.corrugatedInk, S, W / 6 + 0.08, 0.06, half + 0.2, x, (H + 0.3 + ridge) / 2 + 0.08, s * (D / 4 + 0.2), 0, s * slope, 0);
  }
  // back wall: timber boards; east end: tarp screen against the wind
  for (let k = 0; k < 9; k++) b.box(timberDark, S, W, 0.36, 0.05, 0, 0.35 + k * 0.38, -D / 2 - 0.12);
  b.box(M.tarp, S, 0.06, H - 0.3, D - 0.6, W / 2 + 0.1, H / 2 + 0.2, 0);
  b.solid(S, 0, -D / 2, W, 0.4); b.solid(S, W / 2, 0, 0.4, D);
  // back bench with vice, pegboard tool wall, soldering corner with fume arm, laptop, oscilloscope, parts shelving
  P.bench(b, S, -2, 0.15, -D / 2 + 0.55, 0, 6.5, 0.8, M.wood);
  b.box(M.steelPaint, S, 0.24, 0.2, 0.16, -4.8, 1.2, -D / 2 + 0.85);
  const peg = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 1.5), interiorCard('workshop')); const pp = S.sub(-2, 2.0, -D / 2 - 0.08); peg.position.set(pp.x, pp.y, pp.z); peg.rotation.y = S.rot; b.add(peg);
  b.box(M.steelDark, S, 0.38, 0.12, 0.25, 0.3, 1.13, -D / 2 + 0.45); b.rod(M.galv, S, [0.6, 1.05, -D / 2 + 0.3], [0.9, 1.55, -D / 2 + 0.6], 0.015); b.box(M.lamp, S, 0.2, 0.05, 0.14, 0.95, 1.58, -D / 2 + 0.65);
  b.rod(M.steelDark, S, [1.2, 1.05, -D / 2 + 0.3], [1.5, 1.7, -D / 2 + 0.5], 0.035); b.cyl(M.steelDark, S, 0.1, 0.12, 1.55, 1.75, -D / 2 + 0.6, Math.PI / 2.5, 0, 10);
  b.box(M.steelDark, S, 0.4, 0.03, 0.28, -0.8, 1.11, -D / 2 + 0.5); b.box(M.screen, S, 0.38, 0.24, 0.01, -0.8, 1.25, -D / 2 + 0.38, 0, -0.35);
  { const OC = S.sub(2.6, 0.12, -D / 2 + 1.0); b.block(M.steelPaint, OC, 0.7, 0.85, 0.55, 0, 0, 0); b.box(M.panelGrey, OC, 0.55, 0.32, 0.4, 0, 1.03, 0); b.box(M.screen, OC, 0.26, 0.18, 0.01, -0.08, 1.05, 0.205); for (let k = 0; k < 4; k++) b.cyl(M.steelDark, OC, 0.025, 0.02, 0.13 + (k % 2) * 0.08, 0.98 + Math.floor(k / 2) * 0.1, 0.21, Math.PI / 2, 0, 8); b.solid(OC, 0, 0, 0.7, 0.55); }
  { const SH = S.sub(-W / 2 + 0.6, 0.12, -1, Math.PI / 2); for (const x of [-1.2, 1.2]) for (const z of [-0.3, 0.3]) b.block(M.galv, SH, 0.05, 2.3, 0.05, x, 0, z); for (let y = 0; y < 5; y++) { b.box(M.galv, SH, 2.45, 0.03, 0.65, 0, 0.3 + y * 0.48, 0); for (let k = 0; k < 6; k++) b.box((k + y) % 3 ? M.panelGrey : M.caseOlive, SH, 0.34, 0.16, 0.5, -1.0 + k * 0.4, 0.4 + y * 0.48, 0); } b.solid(SH, 0, 0, 2.5, 0.7); }
  // the unfinished ROVER-03 on a work stand at the open front, under an A-frame hoist
  const RS = S.sub(-0.5, 0.15, 1.6, 0.35);
  for (const [x, z] of [[-0.35, -0.45], [0.35, -0.45], [-0.35, 0.45], [0.35, 0.45]]) b.block(M.steelPaint, RS, 0.08, 0.62, 0.08, x, 0, z);
  b.box(M.steelPaint, RS, 0.9, 0.05, 1.2, 0, 0.62, 0);
  const proto = new Rover();
  proto.wheels.forEach((w) => (w.grp.visible = false)); proto.lidar.visible = false; proto.headlamp.visible = false; proto.tape.visible = false;
  for (const w of proto.wheels) w.strut.visible = false;
  const rp = RS.sub(0, 0.62 + 0.28, 0);
  proto.root.position.set(rp.x, rp.y, rp.z); proto.root.rotation.y = rp.rot; proto.root.updateMatrixWorld(true);
  proto.root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh) return; let vis = true; for (let q: THREE.Object3D | null = m; q; q = q.parent) if (!q.visible) vis = false; if (vis) b.putWorld(m.material as THREE.Material, m.geometry.clone().applyMatrix4(m.matrixWorld)); });
  // A-frame hoist with a chain block hanging over the rover
  const HF = RS.sub(0, 0, 0, Math.PI / 2);
  for (const sx of [-1, 1]) { b.rod(M.steelPaint, HF, [sx * 1.6, -0.15, -0.9], [sx * 1.6, 3.0, 0], 0.06, 4); b.rod(M.steelPaint, HF, [sx * 1.6, -0.15, 0.9], [sx * 1.6, 3.0, 0], 0.06, 4); }
  b.box(M.steelPaint, HF, 3.5, 0.18, 0.14, 0, 3.05, 0); b.box(M.orange, HF, 0.25, 0.3, 0.2, 0.2, 2.75, 0);
  b.rod(M.steelDark, HF, [0.2, 2.6, 0], [0.2, 1.55, 0], 0.012, 3); b.box(M.steelDark, HF, 0.1, 0.12, 0.06, 0.2, 1.5, 0);
  // parts on a tarp, laid out in assembly order: four wheels, lidar puck, battery module, harness coil
  const TP = S.sub(2.6, 0.15, 2.4, -0.15);
  b.box(M.tarp, TP, 2.6, 0.02, 1.8, 0, 0.02, 0);
  for (let k = 0; k < 4; k++) b.put(M.rubber, new THREE.CylinderGeometry(0.19, 0.19, 0.16, 18), TP, -0.95 + k * 0.42, 0.11, -0.5);
  b.cyl(M.steelDark, TP, 0.075, 0.055, 0.6, 0.06, 0.3, 0, 0, 16);
  b.rbox(M.panelInk, TP, 0.5, 0.15, 0.32, -0.6, 0.1, 0.4, 0, 0.02);
  b.put(M.rubber, new THREE.TorusGeometry(0.16, 0.012, 6, 20).rotateX(Math.PI / 2), TP, 0.95, 0.04, 0.45);
  // extension cords across the floor from the bench to the stand
  b.cable(M.orange, S, [[-3.0, 0.98, -D / 2 + 0.3], [-2.6, 0.18, -2.0], [-1.6, 0.17, 0.6], [-0.7, 0.75, 1.5]], 0.012);
  b.cable(M.rubber, S, [[1.0, 0.98, -D / 2 + 0.3], [1.4, 0.17, -1.5], [2.2, 0.18, 1.5], [2.2, 0.2, 2.2]], 0.012);
  b.pool(...S.w(0, 0.5), 7.5, 0.33);
  // yard: calibration grid with the small robot and cones, extrusion stock rack, scrap bin, pallet
  decal(b, f, -9.5, 6, 6, 6, 0, (g, Wc) => { const n = 6, c = Wc / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i + j) % 2) { g.fillStyle = 'rgba(232,228,216,.5)'; g.fillRect(i * c, j * c, c, c); } g.strokeStyle = 'rgba(232,228,216,.8)'; g.lineWidth = 6; g.strokeRect(3, 3, Wc - 6, Wc - 6); });
  P.tinyRobot(b, f, -9.8, 0.02, 6.3, 0.7, 2.2);
  for (let k = 0; k < 3; k++) { const sf = f.sub(-12.8 + k * 1.3, 0, 2.6); b.cyl(M.orange, sf, 0.18, 0.5, 0, 0.27, 0, 0, 0, 10, 0.25); b.box(M.rubber, sf, 0.4, 0.03, 0.4, 0, 0.015, 0); }
  { const RK = f.sub(-6, 0, -8.5, 0.1); for (const x of [-1.5, 1.5]) { b.rod(M.steelPaint, RK, [x, 0, -0.5], [x, 1.6, 0], 0.04, 4); b.rod(M.steelPaint, RK, [x, 0, 0.5], [x, 1.6, 0], 0.04, 4); } for (let y = 0; y < 3; y++) for (let k = 0; k < 4; k++) b.box(M.galv, RK, 3.6, 0.045, 0.045, 0, 0.6 + y * 0.4, -0.15 + k * 0.08 + y * 0.05); b.solid(RK, 0, 0, 3.4, 1.0); }
  { const K = f.sub(9, 0, 8.5, 0.2); b.block(M.steelPaint, K, 3.2, 1.3, 1.7, 0, 0, 0); b.block(M.steelDark, K, 3.0, 0.1, 1.5, 0, 1.0, 0); for (let k = 0; k < 6; k++) b.box(M.galv, K, 0.8, 0.07, 0.07, -1.1 + k * 0.42, 1.2, (k % 3 - 1) * 0.35, k * 0.7); b.solid(K, 0, 0, 3.2, 1.7); }
  P.pallet(b, f, 10.5, 0, -6); P.crate(b, f, 10.5, 0.14, -6, 0.1, 1.0, 0.7, 0.9); P.drum(b, f, 12, 0, -4.6); P.cableReel(b, f, 11.8, 0, -7.6, 0.3, 0.45);
  // DON'T TOUCH IT: a fenced, humming rig that has been running for a long time
  const X = f.sub(14, 0, 4);
  P.fence(b, X, [[-1.8, -1.8], [1.8, -1.8], [1.8, 1.8], [-1.8, 1.8], [-1.8, -1.8]], 1.4);
  b.block(M.panelGrey, X, 1.2, 1.3, 0.8, 0, 0, 0); b.box(M.screenWarm, X, 0.3, 0.2, 0.01, -0.25, 1.0, 0.41);
  b.cable(M.rubber, X, [[0.5, 0.6, 0.4], [0.9, 0.05, 1.0], [1.6, 0.05, 1.7], [2.4, 0.05, 2.4]], 0.02); b.cable(M.orange, X, [[-0.6, 0.9, 0], [-0.9, 1.4, 0.2], [-0.5, 1.6, 0.3], [0, 1.3, 0.2]], 0.015);
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.08, 18).rotateX(Math.PI / 2), M.galv); const wp = X.sub(0.25, 1.75, 0); wheel.position.set(wp.x, wp.y, wp.z); wheel.rotation.y = X.rot; b.add(wheel);
  const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.1), M.steelDark); wheel.add(spoke);
  const blink = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), (M.ledAmber as THREE.MeshStandardMaterial).clone()); const blp = X.sub(0.45, 1.35, 0.42); blink.position.set(blp.x, blp.y, blp.z); b.add(blink);
  b.updaters.push((dt, t) => { wheel.rotateZ(dt * 3.2); (blink.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(t * 9) > 0.6 ? 3 : 0.2; });
  b.sign(X, 0, 0.95, 1.86, 0, 1.3, 0.62, ['EVERYTHING WORKS', "DON'T TOUCH IT"], { posts: false });
  P.lightPole(b, f, -13, -6, 6.5, 0.4, false, 9);
  b.sign(f, -14.5, 1.1, 9, Math.PI / 2, 2.2, 0.9, ['WORKSHOP', 'FABRICATION · ROVER-03 BUILD']);
  return b.finish(parent);
}
