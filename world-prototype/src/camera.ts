import * as THREE from 'three';
import type { Heightfield } from './heightfield';
import { clamp } from './noise';

export type CamMode = 'follow' | 'overview' | 'fly' | 'locked';

/** Third-person / oblique camera. Readability first: high pitch, limited orbit, never under terrain. */
export class CameraRig {
  yaw = 0; pitch = 0.9; dist = 17;
  mode: CamMode = 'follow';
  private pos = new THREE.Vector3(); private look = new THREE.Vector3();
  private lastDrag = -1e9; private drag: { x: number; y: number } | null = null; private first = true;
  fly = { pos: new THREE.Vector3(0, 120, -300), yaw: 0, pitch: -0.4 };
  locked = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  constructor(public cam: THREE.PerspectiveCamera, dom: HTMLElement, private hf: Heightfield) {
    dom.addEventListener('pointerdown', (e) => { this.drag = { x: e.clientX, y: e.clientY }; dom.setPointerCapture(e.pointerId); });
    dom.addEventListener('pointerup', (e) => { this.drag = null; dom.releasePointerCapture(e.pointerId); });
    dom.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y; this.drag = { x: e.clientX, y: e.clientY };
      this.lastDrag = performance.now();
      if (this.mode === 'fly') { this.fly.yaw -= dx * 0.004; this.fly.pitch = clamp(this.fly.pitch - dy * 0.004, -1.5, 1.2); }
      else { this.yaw -= dx * 0.0055; this.pitch = clamp(this.pitch + dy * 0.004, 0.3, 1.35); }
    });
    dom.addEventListener('wheel', (e) => { this.dist = clamp(this.dist * Math.exp(e.deltaY * 0.0012), 6, 90); e.preventDefault(); }, { passive: false });
  }

  update(dt: number, target: THREE.Vector3, heading: number, speed: number, keys: Set<string>) {
    const a = this.first ? 1 : 1 - Math.exp(-dt / 0.12);
    if (this.mode === 'locked') { this.cam.position.copy(this.locked.pos); this.cam.lookAt(this.locked.look); return; }
    if (this.mode === 'fly') {
      const f = this.fly, v = (keys.has('ShiftLeft') ? 120 : 40) * dt;
      const fwd = new THREE.Vector3(Math.sin(f.yaw) * Math.cos(f.pitch), Math.sin(f.pitch), Math.cos(f.yaw) * Math.cos(f.pitch));
      const right = new THREE.Vector3(-Math.cos(f.yaw), 0, Math.sin(f.yaw));
      if (keys.has('KeyW')) f.pos.addScaledVector(fwd, v); if (keys.has('KeyS')) f.pos.addScaledVector(fwd, -v);
      if (keys.has('KeyD')) f.pos.addScaledVector(right, v); if (keys.has('KeyA')) f.pos.addScaledVector(right, -v);
      if (keys.has('KeyE')) f.pos.y += v; if (keys.has('KeyQ')) f.pos.y -= v;
      f.pos.y = Math.max(f.pos.y, this.hf.at(f.pos.x, f.pos.z) + 1.5);
      this.cam.position.copy(f.pos); this.cam.lookAt(f.pos.clone().add(fwd)); return;
    }
    let want: THREE.Vector3, look: THREE.Vector3;
    if (this.mode === 'overview') {
      want = new THREE.Vector3(-120, 560, -560); look = new THREE.Vector3(-10, 0, 60);
    } else {
      // auto-recentre behind the rover while driving, unless the visitor is orbiting
      if (performance.now() - this.lastDrag > 1800 && Math.abs(speed) > 1) {
        let d = heading - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += d * (1 - Math.exp(-dt * 1.3));
      }
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      look = target.clone().add(new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading)).multiplyScalar(clamp(speed, 0, 16) * 0.25)).add(new THREE.Vector3(0, 0.8, 0));
      want = new THREE.Vector3(look.x - Math.sin(this.yaw) * cp * this.dist, look.y + sp * this.dist, look.z - Math.cos(this.yaw) * cp * this.dist);
      // keep the line of sight above terrain
      let need = this.hf.at(want.x, want.z) + 2.2;
      for (let i = 1; i <= 8; i++) {
        const t = i / 8, x = look.x + (want.x - look.x) * t, z = look.z + (want.z - look.z) * t;
        need = Math.max(need, look.y + (this.hf.at(x, z) + 1.2 - look.y) / t);
      }
      want.y = Math.max(want.y, need);
    }
    this.pos.lerp(want, a); this.look.lerp(look, this.first ? 1 : 1 - Math.exp(-dt / 0.08)); this.first = false;
    this.cam.position.copy(this.pos); this.cam.lookAt(this.look);
  }
  snap() { this.first = true; }
}
