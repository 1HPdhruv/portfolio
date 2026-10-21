// Simple 2D colliders so the rover cannot drive through structures. Structures register themselves.
export interface Collider { x: number; z: number; hx: number; hz: number; rot: number; circle: boolean; }
const list: Collider[] = [];
export const colliders = list;
export const addBox = (x: number, z: number, hx: number, hz: number, rot = 0) => list.push({ x, z, hx, hz, rot, circle: false });
export const addCircle = (x: number, z: number, r: number) => list.push({ x, z, hx: r, hz: r, rot: 0, circle: true });

/** Push a circle of radius r out of every collider. Returns true if it moved. */
export function resolve(p: { x: number; z: number }, r: number): boolean {
  let moved = false;
  for (const c of list) {
    if (Math.abs(p.x - c.x) > Math.max(c.hx, c.hz) * 1.5 + r + 1 || Math.abs(p.z - c.z) > Math.max(c.hx, c.hz) * 1.5 + r + 1) continue;
    if (c.circle) {
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.hx + r;
      if (d < m) { const k = (m - d) / (d || 1); p.x += (d ? dx : 1) * k; p.z += (d ? dz : 0) * k; moved = true; }
    } else {
      const cs = Math.cos(c.rot), sn = Math.sin(c.rot);
      const lx = (p.x - c.x) * cs + (p.z - c.z) * sn, lz = -(p.x - c.x) * sn + (p.z - c.z) * cs;
      const cx = Math.max(-c.hx, Math.min(c.hx, lx)), cz = Math.max(-c.hz, Math.min(c.hz, lz));
      let dx = lx - cx, dz = lz - cz, d = Math.hypot(dx, dz);
      if (d < r) {
        if (d < 1e-5) { // centre inside box: exit by the nearest face
          const ox = c.hx - Math.abs(lx), oz = c.hz - Math.abs(lz);
          if (ox < oz) { dx = Math.sign(lx || 1) * (ox + r); dz = 0; } else { dz = Math.sign(lz || 1) * (oz + r); dx = 0; }
        } else { const k = (r - d) / d; dx *= k; dz *= k; }
        p.x += dx * cs - dz * sn; p.z += dx * sn + dz * cs; moved = true;
      }
    }
  }
  return moved;
}
