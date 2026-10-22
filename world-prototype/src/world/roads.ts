import * as THREE from 'three';
import type { Heightfield, RoadPath } from '../heightfield';
import { Builder, Frame } from './kit';
import { M, weathered } from './materials';
import { devLog } from '../devlog';

/** Ribbon strips that sit on the terrain: road paint, survey lines. */
function ribbon(hf: Heightfield, path: { x: number; z: number; s: number }[], offset: number, width: number, dash?: [number, number], lift = 0.035) {
  const pos: number[] = [], idx: number[] = [];
  let open = false, base = 0;
  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)], c = path[Math.min(path.length - 1, i + 1)];
    let tx = c.x - a.x, tz = c.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const nx = -tz, nz = tx, p = path[i];
    const on = !dash || (p.s % (dash[0] + dash[1])) < dash[0];
    if (on) {
      const x0 = p.x + nx * (offset - width / 2), z0 = p.z + nz * (offset - width / 2), x1 = p.x + nx * (offset + width / 2), z1 = p.z + nz * (offset + width / 2);
      pos.push(x0, hf.at(x0, z0) + lift, z0, x1, hf.at(x1, z1) + lift, z1);
      const k = pos.length / 3 - 2;
      if (open) idx.push(base, base + 1, k, k, base + 1, k + 1);
      base = k; open = true;
    } else open = false;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

const pipeDark = new THREE.MeshBasicMaterial({ color: '#050606' });
// gabion: wire-mesh baskets of local stone — a world-space stone pattern with a galvanised grid over it
const gabion = weathered({ color: '#9a9284', roughness: 0.95, metalness: 0.05 }, { grime: 0.95, streak: 0.35, seam: 1.0, dirtCol: '#3d352b' });
export const paintMat = new THREE.MeshStandardMaterial({ color: '#d8d3c3', roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });

export function buildRoads(hf: Heightfield, parent: THREE.Object3D) {
  const b = new Builder(hf, 'roads', 0.4);
  const main = hf.roads.find((r) => r.def.id === 'main')!;
  const hw = main.def.halfW;
  // paint: twin edge lines (the survey-sheet "double line"), dashed centre
  for (const side of [-1, 1]) { const m = new THREE.Mesh(ribbon(hf, main.pts, side * (hw - 0.3), 0.13), paintMat); m.receiveShadow = true; b.add(m); }
  { const m = new THREE.Mesh(ribbon(hf, main.pts, 0, 0.11, [3, 6]), paintMat); m.receiveShadow = true; b.add(m); }

  // guard rails where the road runs on fill above a drop
  const rails: { x: number; z: number; y: number }[][] = [[], []];
  const flush = (side: number) => {
    const run = rails[side];
    if (run.length >= 2) {
      const f = new Frame(0, 0, 0, 0);
      for (let i = 0; i < run.length; i++) {
        const p = run[i];
        b.box(M.galv, f, 0.12, 0.95, 0.1, p.x, p.y + 0.38, p.z);
        if (i) { const q = run[i - 1]; b.rod(M.galv, f, [q.x, q.y + 0.68, q.z], [p.x, p.y + 0.68, p.z], 0.07, 4); b.rod(M.galv, f, [q.x, q.y + 0.52, q.z], [p.x, p.y + 0.52, p.z], 0.05, 4); }
        b.post(f, p.x, p.z, 0.18);
      }
    }
    rails[side] = [];
  };
  for (let i = 0; i < main.pts.length; i += 8) {
    const a = main.pts[Math.max(0, i - 2)], c = main.pts[Math.min(main.pts.length - 1, i + 2)], p = main.pts[i];
    let tx = c.x - a.x, tz = c.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    [-1, 1].forEach((side, si) => {
      const nx = -tz * side, nz = tx * side;
      const qx = p.x + nx * (hw + 0.9), qz = p.z + nz * (hw + 0.9);
      const drop = p.y - hf.at(p.x + nx * (hw + 5), p.z + nz * (hw + 5));
      if (drop > 1.6 && p.s > 30 && p.s < main.pts[main.pts.length - 1].s - 30) rails[si].push({ x: qx, z: qz, y: hf.at(qx, qz) });
      else flush(si);
    });
  }
  flush(0); flush(1);

  // gabion retaining walls where the road is cut deep into the slope (wire baskets of local stone)
  { let run = 0;
    for (let i = 4; i < main.pts.length - 4; i += 4) {
      const p = main.pts[i], a = main.pts[i - 4], c = main.pts[i + 4];
      let tx = c.x - a.x, tz = c.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      for (const side of [-1, 1]) {
        const nx = -tz * side, nz = tx * side, off = hw + 3.4;
        const cut = hf.at(p.x + nx * (off + 4), p.z + nz * (off + 4)) - p.y;
        if (cut < 3.2 || p.s < 40) continue;
        // one continuous wall at the toe of the cut, beyond the ditch; its base follows the road, not the slope
        const wx = p.x + nx * (hw + 3.0), wz = p.z + nz * (hw + 3.0), f = new Frame(wx, p.y - 0.35, wz, Math.atan2(tx, tz));
        const H = Math.min(2.9, 0.9 + cut * 0.22);
        b.box(gabion, f, 1.1, H, 2.6, 0, H / 2, 0); b.box(gabion, f, 0.95, 0.06, 2.6, 0, H + 0.03, 0);
        b.solid(f, 0, 0, 1.1, 2.0); run++;
      }
    }
    devLog('gabion segments', run); }

  // delineator posts and elevation markers: the descent counts down in metres
  let lastMark = Math.ceil(main.pts[0].y / 10) * 10;
  for (let i = 0; i < main.pts.length; i++) {
    const p = main.pts[i];
    const a = main.pts[Math.max(0, i - 2)], c = main.pts[Math.min(main.pts.length - 1, i + 2)];
    let tx = c.x - a.x, tz = c.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    if (i % 80 === 40) for (const side of [-1, 1]) {
      const x = p.x - tz * side * (hw + 1.3), z = p.z + tx * side * (hw + 1.3), f = new Frame(x, hf.at(x, z), z);
      b.box(M.chalkPaint, f, 0.1, 1.05, 0.1, 0, 0.5, 0); b.box(M.orange, f, 0.105, 0.12, 0.105, 0, 0.88, 0); b.post(f, 0, 0, 0.08);
    }
    const mark = Math.floor(p.y / 10) * 10;
    if (mark < lastMark && mark >= 0 && p.s > 20) {
      lastMark = mark;
      const x = p.x + tz * (hw + 1.6), z = p.z - tx * (hw + 1.6), f = new Frame(x, hf.at(x, z), z, Math.atan2(-tx, -tz));
      b.put(M.concreteSmooth, new THREE.CylinderGeometry(0.16, 0.2, 0.9, 4).rotateY(Math.PI / 4), f, 0, 0.45, 0);
      b.sign(f, 0, 1.05, 0.0, 0, 0.62, 0.32, [`ELEV ${mark} m`], { posts: false, accent: mark % 50 === 0 });
      b.post(f, 0, 0, 0.25);
    }
  }
  b.finish(parent);
  return b;
}

/** Concrete headwalls + pipe mouths wherever a road or track crosses a stream. */
export function buildCulverts(hf: Heightfield, parent: THREE.Object3D) {
  const b = new Builder(hf, 'culverts', 0.9);
  const done: { x: number; z: number }[] = [];
  const crossings: { road: RoadPath; i: number; rx: number; rz: number; w: number }[] = [];
  for (const road of hf.roads) for (const river of hf.rivers) {
    for (let j = 0; j < river.pts.length; j += 3) {
      const q = river.pts[j];
      for (let i = 0; i < road.pts.length; i += 2) {
        const p = road.pts[i];
        if (Math.abs(p.x - q.x) > 4 || Math.abs(p.z - q.z) > 4) continue;
        if (Math.hypot(p.x - q.x, p.z - q.z) < 2.5 && !done.some((d) => Math.hypot(d.x - q.x, d.z - q.z) < 14)) {
          const q2 = river.pts[Math.min(river.pts.length - 1, j + 4)], q0 = river.pts[Math.max(0, j - 4)];
          done.push({ x: q.x, z: q.z }); crossings.push({ road, i, rx: q2.x - q0.x, rz: q2.z - q0.z, w: q.w });
        }
      }
    }
  }
  for (const c of crossings) {
    const p = c.road.pts[c.i], hw = c.road.def.halfW;
    if (c.road.def.kind === 'trail') {
      // a track crosses by a stone ford: flat stepping stones across the shallow bed, no concrete
      const l = Math.hypot(c.rx, c.rz) || 1, dx = c.rx / l, dz = c.rz / l, nx = -dz, nz = dx;
      for (let k = -3; k <= 3; k++) for (const side of [-0.7, 0.7]) {
        const x = p.x + nx * k * 0.75 + dx * side * (k % 2 ? 1 : 0.8), z = p.z + nz * k * 0.75 + dz * side * (k % 2 ? 1 : 0.8);
        const f = new Frame(x, hf.at(x, z) - 0.05, z, k * 1.7 + side);
        b.cyl(M.concreteDark, f, 0.32 + 0.08 * Math.sin(k * 3 + side), 0.22, 0, 0.08, 0, 0, 0, 7);
      }
      continue;
    }
    const l = Math.hypot(c.rx, c.rz) || 1, dx = c.rx / l, dz = c.rz / l;
    // headwalls sit up- and down-stream of the road shoulder
    for (const s of [-1, 1]) {
      const off = hw + 2.2 + c.road.def.shoulder * 0.25;
      const x = p.x + dx * s * off, z = p.z + dz * s * off, rot = Math.atan2(dx, dz);
      const W = Math.max(3.2, c.w + 2.2), r = Math.min(0.9, 0.35 + c.w * 0.12);
      // headwall top sits just below the road surface; the pipe mouth at its foot
      const y = p.y - 0.4 - 2 * r;
      const f = new Frame(x, y, z, rot);
      b.block(M.concrete, f, W, r * 2 + 0.9, 0.45, 0, -0.6, 0);
      for (const sx of [-1, 1]) b.block(M.concrete, f, 0.4, r * 2 + 0.6, 2.2, sx * (W / 2 - 0.2), -0.6, s * 1.0, sx * s * 0.35);
      b.cyl(M.steelDark, f, r, 0.5, 0, r - 0.25, -s * 0.05, Math.PI / 2, 0, 16);
      b.cyl(pipeDark, f, r * 0.86, 0.52, 0, r - 0.25, -s * 0.06, Math.PI / 2, 0, 16);
      b.box(M.galv, f, W, 0.06, 0.06, 0, r * 2 + 0.45, -0.12);
    }
  }
  b.finish(parent);
  return { b, count: crossings.length };
}
