import * as THREE from 'three';
import type { Heightfield } from '../heightfield';
import { PADS } from '../layout';
import { Builder, Frame } from './kit';
import { M, interiorCard } from './materials';
import * as P from './props';

export function padFrame(hf: Heightfield, id: string) {
  const p = PADS.find((q) => q.id === id)!;
  return new Frame(p.x, p.h ?? hf.at(p.x, p.z), p.z, -p.rot);
}

/** Painted ground marking (ring, bay lines, stencils): a transparent decal hugging a flat pad. */
export function decal(b: Builder, f: Frame, lx: number, lz: number, w: number, d: number, ry: number, draw: (g: CanvasRenderingContext2D, W: number, H: number) => void, res = 512) {
  const c = document.createElement('canvas'); c.width = res; c.height = Math.round(res * d / w); const g = c.getContext('2d')!;
  draw(g, c.width, c.height);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -3, depthWrite: false }));
  const sf = f.sub(lx, 0.02, lz, ry); m.position.set(sf.x, sf.y, sf.z); m.rotation.y = sf.rot; m.receiveShadow = true; m.renderOrder = 1;
  b.add(m); return m;
}

/** Glow sprite for beacons and the Research hatch: visible from across the Basin. */
export function glow(color: string, size: number) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  s.scale.set(size, size, 1); return s;
}

// ------------------------------------------------------------------ 1. INIT / ORIGIN — the rover dock
export function buildInit(hf: Heightfield, parent: THREE.Object3D) {
  const b = new Builder(hf, 'init', 0.8), f = padFrame(hf, 'init');
  // dock shed: open to the south (the descent), mono-pitch roof
  const S = f.sub(0, 0, -8.5);
  b.block(M.concreteSmooth, S, 11.6, 0.18, 7.6, 0, 0, 0);
  b.block(M.corrugated, S, 11.2, 3.7, 0.14, 0, 0, -3.6);
  for (const sx of [-1, 1]) b.block(M.corrugated, S, 0.14, 3.7, 7.2, sx * 5.55, 0, 0);
  b.box(M.panelGrey, S, 11.9, 0.16, 8.2, 0, 3.95, 0.1, 0, -0.06);
  b.box(M.steelDark, S, 11.3, 0.35, 0.25, 0, 3.55, 3.55);
  b.cyl(M.panelGrey, S, 0.28, 10.6, 0, 3.25, 3.45, 0, Math.PI / 2, 14); // rolled-up door drum
  for (const sx of [-1, 1]) b.block(M.steelPaint, S, 0.22, 3.6, 0.22, sx * 5.45, 0, 3.55);
  b.solid(S, 0, -3.6, 11.4, 0.4); b.solid(S, -5.55, 0, 0.4, 7.2); b.solid(S, 5.55, 0, 0.4, 7.2);
  // inside: charging cabinet, tool wall, spares, bench, lamp
  b.block(M.panelInk, S, 1.4, 2.0, 0.6, -3.5, 0.18, -3.1);
  b.box(M.ledAmber, S, 0.06, 0.06, 0.02, -3.2, 1.7, -2.79); b.box(M.screen, S, 0.4, 0.25, 0.02, -3.7, 1.5, -2.79);
  b.cable(M.rubber, S, [[-3.2, 0.6, -2.8], [-2.4, 0.25, -1.4], [-1.0, 0.25, 0.4], [0.2, 0.35, 1.2]], 0.03);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.5), interiorCard('workshop')); const bp = S.sub(2.4, 1.9, -3.52); board.position.set(bp.x, bp.y, bp.z); board.rotation.y = S.rot; b.add(board);
  P.bench(b, S, 2.4, 0.18, -2.9, 0, 3.0, 0.7, M.steelPaint);
  P.pelican(b, S, 1.6, 1.12, -2.9, 0.2); P.pelican(b, S, 3.0, 1.12, -2.85, -0.1, 0.8, M.caseOlive);
  for (let i = 0; i < 3; i++) b.put(M.rubber, new THREE.CylinderGeometry(0.19, 0.19, 0.16, 20).rotateZ(Math.PI / 2), S, 4.6, 0.37 + i * 0.17, -1.6 + i * 0.02, Math.PI / 2, 0, 0);
  b.box(M.lamp, S, 1.2, 0.05, 0.2, 0, 3.55, -0.5); b.box(M.lamp, S, 1.2, 0.05, 0.2, 0, 3.6, 2.0);
  b.pool(...S.w(0, 0.5), 6.5, 0.42);
  // charging gantry over the launch ring; the umbilical hangs where ROVER-02 docks
  const G = f.sub(0, 0, 4);
  for (const sx of [-1, 1]) { b.block(M.galv, G, 0.22, 4.5, 0.22, sx * 3.1, 0, 0); b.block(M.concreteDark, G, 0.6, 0.25, 0.6, sx * 3.1, 0, 0); b.post(G, sx * 3.1, 0, 0.3); }
  b.box(M.galv, G, 6.6, 0.3, 0.3, 0, 4.55, 0);
  b.box(M.steelDark, G, 0.5, 0.4, 0.4, 0.6, 4.25, 0);
  b.cable(M.rubber, G, [[0.6, 4.1, 0], [0.75, 2.6, 0.6], [0.55, 1.3, 1.4], [0.3, 0.75, 1.75]], 0.035);
  b.box(M.orange, G, 0.12, 0.2, 0.12, 0.3, 0.7, 1.8);
  b.box(M.lamp, G, 0.6, 0.04, 0.15, -1.5, 4.39, 0);
  // painted launch ring + datum stencil
  decal(b, f, 0, 6, 8, 8, 0, (g, W) => {
    const c = W / 2; g.strokeStyle = 'rgba(232,228,216,.75)'; g.lineWidth = 7; g.beginPath(); g.arc(c, c, W * 0.42, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.arc(c, c, W * 0.36, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2, r0 = W * (i % 9 === 0 ? 0.3 : 0.335); g.beginPath(); g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); g.lineTo(c + Math.cos(a) * W * 0.36, c + Math.sin(a) * W * 0.36); g.stroke(); }
    g.fillStyle = 'rgba(255,106,43,.9)'; g.beginPath(); g.moveTo(c, c - W * 0.47); g.lineTo(c - 14, c - W * 0.42); g.lineTo(c + 14, c - W * 0.42); g.fill();
    g.fillStyle = 'rgba(232,228,216,.7)'; g.font = '600 34px ui-monospace, Menlo, monospace'; g.textAlign = 'center'; g.fillText('INIT · DATUM 0', c, c + W * 0.47);
  });
  // first landmark: trig pillar under a timber survey tripod
  P.trigPillar(b, f, -13, 1); P.surveyTripod(b, f, -13, 1, 7.5);
  P.windsock(b, f, 18, -11);
  // quick-access kiosk: a weatherproof field cabinet facing the dock
  const K = f.sub(7, 0, 11, Math.PI);
  b.block(M.concreteDark, K, 0.8, 0.15, 0.6, 0, 0, 0);
  b.box(M.galv, K, 0.12, 1.1, 0.12, 0, 0.6, 0);
  b.rbox(M.panelGrey, K, 0.7, 0.9, 0.32, 0, 1.55, 0, 0, 0.03);
  b.box(M.steelDark, K, 0.8, 0.06, 0.5, 0, 2.03, 0.08);
  b.box(M.screenWarm, K, 0.5, 0.36, 0.01, 0, 1.62, 0.165);
  b.box(M.orange, K, 0.5, 0.03, 0.01, 0, 1.3, 0.165);
  b.solid(K, 0, 0, 0.8, 0.6);
  P.lightPole(b, f, -18, -12, 7.5, 0.6, false, 13); P.lightPole(b, f, 18.5, 10, 6.5, -2.4, false, 10);
  // supplies: batteries on pallets, cases, cable reel, a container store
  P.pallet(b, f, 8.3, 0, -9); for (let i = 0; i < 4; i++) b.rbox(M.panelInk, f, 0.5, 0.35, 0.45, 7.95 + (i % 2) * 0.6, 0.31, -9.25 + Math.floor(i / 2) * 0.5, 0, 0.03);
  P.pelican(b, f, -8, 0, -6.8, 0.3); P.pelican(b, f, -8.1, 0.27, -6.75, 0.1, 0.9); P.pelican(b, f, -7.2, 0, -5.9, -0.2, 1.1, M.caseOlive);
  P.cableReel(b, f, 10.5, 0, -5.5, 0.4);
  P.container(b, f, -16.5, -6, Math.PI / 2 + 0.02, M.corrugatedInk);
  P.stake(b, ...f.w(-4, 10), '01');
  for (const sx of [-1, 1]) P.bollard(b, f, 6 + sx * 4.2, 14.2);
  b.sign(f, -9.5, 1.2, 13.8, Math.PI, 2.6, 1.1, ['THE BASIN', `DATUM 0 · ELEV ${f.y.toFixed(0)} m`]);
  return b.finish(parent);
}

// ------------------------------------------------------------------ 2. FIELD OFFICE — expedition cabin
export function buildFieldOffice(hf: Heightfield, parent: THREE.Object3D) {
  const b = new Builder(hf, 'field-office', 0.9), f = padFrame(hf, 'field-office');
  const C = f.sub(0, 0.75, -3);
  for (const x of [-4.6, -1.5, 1.5, 4.6]) for (const z of [-2, 2]) b.cyl(M.galv, C, 0.09, 1.1, x, -0.35, z, 0, 0, 8);
  b.block(M.steelPaint, C, 10.2, 0.25, 4.8, 0, 0, 0);
  b.block(M.panelWhite, C, 10, 2.8, 4.6, 0, 0.25, 0);
  b.box(M.panelGrey, C, 10.8, 0.14, 5.6, 0, 3.15, 0.15, 0, 0.05);
  // windows (lit interiors) and door on the south face
  for (const x of [-3.4, -1.0]) { b.box(M.steelDark, C, 1.5, 1.1, 0.08, x, 1.75, 2.31); const w = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.96), interiorCard('desk')); const p = C.sub(x, 1.75, 2.36); w.position.set(p.x, p.y, p.z); w.rotation.y = C.rot; b.add(w); }
  { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.8), interiorCard('plain')); const p = C.sub(-5.04, 1.8, 0); w.position.set(p.x, p.y, p.z); w.rotation.y = C.rot - Math.PI / 2; b.add(w); b.box(M.steelDark, C, 0.08, 0.92, 1.12, -5.0, 1.8, 0); }
  b.box(M.panelGrey, C, 0.95, 2.05, 0.08, 2.4, 1.28, 2.32); b.box(M.galv, C, 0.04, 0.2, 0.06, 2.75, 1.2, 2.37);
  // porch, steps, railing
  b.block(M.steelDark, C, 3.0, 0.12, 1.6, 2.4, 0.1, 3.1);
  P.stairs(b, C, 2.4, -0.75, 4.95, Math.PI, 1.1, 0.95, 4);
  P.railing(b, C, [[0.9, 0.22, 2.35], [0.9, 0.22, 3.85]]); P.railing(b, C, [[3.9, 0.22, 2.35], [3.9, 0.22, 3.85]]);
  b.box(M.panelGrey, C, 3.2, 0.08, 1.9, 2.4, 2.75, 3.15, 0, 0.12);
  b.box(M.lamp, C, 0.3, 0.06, 0.15, 2.4, 2.68, 2.6);
  b.pool(...C.w(2.4, 4.0), 4.5, 0.35);
  // noticeboard beside the door: pinned survey sheets
  b.box(M.wood, C, 1.0, 0.7, 0.04, 0.6, 1.7, 2.34);
  for (let i = 0; i < 5; i++) b.box(M.chalkPaint, C, 0.2, 0.26, 0.01, 0.25 + (i % 3) * 0.3, 1.82 - Math.floor(i / 3) * 0.3, 2.37);
  // resume station: field table with printer under the porch roof
  b.box(M.steelPaint, C, 1.0, 0.04, 0.55, 3.35, 0.95, 3.2); for (const sx of [-1, 1]) b.box(M.steelPaint, C, 0.04, 0.75, 0.5, 3.35 + sx * 0.45, 0.58, 3.2);
  b.rbox(M.chalkPaint, C, 0.42, 0.2, 0.32, 3.3, 1.08, 3.2, 0, 0.02); b.box(M.chalkPaint, C, 0.28, 0.01, 0.2, 3.3, 1.19, 3.36, 0, -0.5);
  b.solid(C, 0, 0, 10.4, 5.0); b.solid(C, 2.4, 3.6, 3.0, 2.6);
  // comms: yagi mast aimed at the Signal Tower, VSAT dish aimed at the southern sky
  P.mast(b, f, 6.6, -3.6, 9, { yagi: true, guy: true });
  { const D = f.sub(8.5, 0, -7.5); b.block(M.concreteDark, D, 1.6, 0.3, 1.6, 0, 0, 0); b.cyl(M.galv, D, 0.08, 1.3, 0, 0.9, 0, 0, 0, 8); P.dish(b, D, 0, 1.7, 0, -f.rot, 0.75); b.post(D, 0, 0, 0.9); }
  b.cable(M.rubber, f, [[8.5, 0.4, -7.5], [6.5, 0.2, -6], [5.2, 0.6, -5.3]], 0.025);
  // power: solar array, battery box, generator + jerrycans; water: IBC tote with hose
  P.solarArray(b, f, -8.5, 5, 4); b.block(M.panelInk, f, 1.2, 0.8, 0.6, -5.5, 0, 6.8);
  b.cable(M.rubber, f, [[-5.5, 0.6, 6.5], [-5.3, 0.15, 4.5], [-4.9, 0.4, -0.6]], 0.025);
  P.generator(b, f, 7.4, 0, 3.6, 0.4); P.jerrycans(b, f, 6.2, 0, 5.0, 0.4);
  P.ibc(b, f, -8, 0, -6.5, 0.2); b.cable(M.rubber, f, [[-7.6, 0.3, -6.0], [-6.5, 0.1, -4.4], [-5.2, 0.5, -3.2]], 0.03);
  P.weatherStation(b, f, 10.5, 7);
  P.pelican(b, f, -0.6, 0, 3.0, 0.4); P.pelican(b, f, -0.55, 0.27, 3.05, 0.2, 0.85, M.caseOlive); P.crate(b, f, -2.2, 0, 3.2, 0.1, 1.0, 0.7, 0.8);
  P.stake(b, ...f.w(-3, 8), '02');
  b.sign(f, 4.5, 1.1, 9.5, 0, 2.2, 0.9, ['FIELD OFFICE', 'SURVEY HQ · RIM']);
  P.lightPole(b, f, -11.5, -1, 6, 1.3, false, 9);
  return b.finish(parent);
}

// ------------------------------------------------------------------ 12. SIGNAL TOWER — contact
export function buildSignalTower(hf: Heightfield, parent: THREE.Object3D, aims: [number, number][]) {
  const b = new Builder(hf, 'signal-tower', 0.6), f = padFrame(hf, 'signal-tower');
  const H = 60, legs = [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 + (4 * Math.PI) / 3];
  const R = (y: number) => 2.8 + (0.75 - 2.8) * (y / H);
  const pt = (i: number, y: number): [number, number, number] => [Math.cos(legs[i]) * R(y), y, Math.sin(legs[i]) * R(y)];
  for (let i = 0; i < 3; i++) { b.block(M.concreteDark, f, 1.2, 0.5, 1.2, Math.cos(legs[i]) * 2.8, -0.1, Math.sin(legs[i]) * 2.8); b.post(f, Math.cos(legs[i]) * 2.8, Math.sin(legs[i]) * 2.8, 0.7); }
  const step = 3;
  for (let y = 0; y < H; y += step) {
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      b.rod(M.galv, f, pt(i, y), pt(i, y + step), 0.085 - 0.04 * (y / H), 6);
      b.rod(M.galv, f, pt(i, y + step), pt(j, y + step), 0.03, 4);
      b.rod(M.galv, f, (y / step) % 2 ? pt(i, y) : pt(j, y), (y / step) % 2 ? pt(j, y + step) : pt(i, y + step), 0.025, 4);
    }
  }
  // climbing ladder + cable ladder up one face
  b.rod(M.steelDark, f, [0, 0.3, 1.9], [0, H, 0.55], 0.05, 4);
  // top: antenna panels, lightning rod, beacon platform
  for (let i = 0; i < 3; i++) { const a = legs[i] + Math.PI / 3; b.box(M.chalkPaint, f, 0.35, 2.6, 0.12, Math.cos(a) * 1.0, H - 2, Math.sin(a) * 1.0, -a + Math.PI / 2); }
  b.cyl(M.steelDark, f, 1.1, 0.12, 0, H, 0, 0, 0, 12);
  b.cyl(M.galv, f, 0.04, 4.5, 0, H + 2.4, 0, 0, 0, 6);
  // microwave links: dishes aimed at the sites they serve
  aims.forEach(([tx, tz], k) => { const ang = Math.atan2(tx - f.x, tz - f.z); const y = 44 - k * 6; const [lx, lz] = [Math.sin(ang) * R(y) * 0.6, Math.cos(ang) * R(y) * 0.6]; P.dish(b, f, lx, y, lz, ang - f.rot, 0.9); });
  // guy wires: three levels, three anchors
  for (let i = 0; i < 3; i++) {
    const a = legs[i]; const ax = Math.cos(a) * 34, az = Math.sin(a) * 34; const [wx, wz] = f.w(ax, az); const gy = hf.at(wx, wz) - f.y;
    b.block(M.concreteDark, f, 1.4, 0.8, 1.4, ax, gy - 0.4, az); b.post(f, ax, az, 0.9);
    for (const y of [22, 40, 56]) { const p = pt(i, y); b.rod(M.steelDark, f, [p[0], p[1], p[2]], [ax, gy + 0.4, az], 0.012, 3); }
  }
  // the beacon: one pulse every four seconds
  const beaconMat = (M.beacon as THREE.MeshStandardMaterial).clone();
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 10), beaconMat); const bp = f.sub(0, H + 0.6, 0); beacon.position.set(bp.x, bp.y, bp.z); b.add(beacon);
  const halo = glow('#ff7a3a', 16); halo.position.copy(beacon.position); b.add(halo);
  const bl = b.light(bp.x, bp.y, bp.z, '#ff6a2b', 0, 60);
  b.updaters.push((_dt, t) => {
    const ph = (t % 4) / 4, pulse = Math.exp(-ph * 9) + 0.12;
    beaconMat.emissiveIntensity = 0.6 + pulse * 5; halo.material.opacity = 0.25 + pulse * 0.9; halo.scale.setScalar(12 + pulse * 10);
    if (bl) bl.intensity = pulse * 260;
  });
  // equipment hut, cable bridge, solar, fence
  const E = f.sub(-6.5, 0, 6.5, 0.4);
  b.block(M.concreteSmooth, E, 4.2, 2.8, 3.2, 0, 0, 0); b.box(M.panelGrey, E, 4.6, 0.15, 3.6, 0, 2.88, 0);
  b.box(M.steelDark, E, 0.95, 2.05, 0.06, 0.9, 1.03, 1.62); P.acUnit(b, E, -1.2, 0.6, 1.8, 0);
  b.box(M.lamp, E, 0.25, 0.08, 0.12, 0.9, 2.3, 1.68);
  b.pool(...E.w(0.9, 2.6), 3.5, 0.3);
  b.solid(E, 0, 0, 4.2, 3.2);
  b.rod(M.galv, f, [-4.6, 2.5, 5.0], [-0.4, 3.0, 1.2], 0.08, 4);
  P.solarArray(b, f, 6, 6.5, 5, 2);
  P.fence(b, f, [[-12, -12], [12, -12], [12, 12], [2.5, 12]]); P.fence(b, f, [[-2.5, 12], [-12, 12], [-12, -12]]);
  b.sign(f, -4.6, 1.15, 12.8, 0, 1.9, 0.8, ['SIGNAL', 'RIM MAST · 60 m']);
  return b.finish(parent);
}
