import * as THREE from 'three';
import type { Heightfield } from './heightfield';
import { Rover } from './rover';
import { resolve } from './colliders';
import { clamp } from './noise';

export class Driver {
  x = 14; z = -300; heading = 0; speed = 0; yawRate = 0;
  pitch = 0; roll = 0; bodyY = 0;
  odo = 0; surface = 'grass';
  keys = new Set<string>();
  private p = { x: 0, z: 0 };
  private wheelOff = [0, 0, 0, 0, 0, 0];
  constructor(private hf: Heightfield, public rover: Rover) {}

  teleport(x: number, z: number, heading = this.heading) { this.x = x; this.z = z; this.heading = heading; this.speed = 0; this.settle(1e3); }

  private groundAt(lx: number, lz: number) { // body-local (left,forward) offsets -> ground height
    const F = [Math.sin(this.heading), Math.cos(this.heading)], L = [Math.cos(this.heading), -Math.sin(this.heading)];
    return this.hf.at(this.x + F[0] * lz + L[0] * lx, this.z + F[1] * lz + L[1] * lx);
  }

  update(dt: number, active: boolean) {
    const k = this.keys;
    const fwd = active ? (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) : 0;
    const turn = active ? (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) - (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) : 0;
    const boost = active && (k.has('ShiftLeft') || k.has('ShiftRight'));
    const hf = this.hf;
    const road = hf.splatAt(this.x, this.z, 0), trail = hf.splatAt(this.x, this.z, 1), padv = hf.splatAt(this.x, this.z, 2), wet = hf.splat2[((Math.round(this.z + 400)) * 601 + Math.round(this.x + 300)) * 4] / 255;
    let surf = 0.68; this.surface = 'ground';
    if (trail > 0.4) { surf = 0.9; this.surface = 'track'; }
    if (road > 0.5) { surf = 1; this.surface = 'road'; } else if (padv > 0.4) { surf = 1; this.surface = 'hardstand'; }
    if (wet > 0.7) { surf *= 0.6; this.surface = 'stream bank'; }
    const sl = hf.slope(this.x, this.z);
    const slopeF = 1 - clamp((sl - 0.42) / 0.38) * 0.75;
    const vmax = (boost ? 15.5 : 9.5) * surf * slopeF * (fwd < 0 ? 0.45 : 1);
    const target = fwd * vmax;
    const acc = target === 0 ? 7 : 5.2;
    this.speed += clamp(target - this.speed, -acc * dt, acc * dt);
    const steerRate = 1.5 * (0.35 + 0.65 * clamp(Math.abs(this.speed) / 5)) * (fwd < 0 ? -1 : 1) * (Math.abs(this.speed) < 0.3 && turn ? 0.7 : 1);
    const wantYaw = turn * (Math.abs(this.speed) < 0.3 ? 1.0 : steerRate);
    this.yawRate += (wantYaw - this.yawRate) * (1 - Math.exp(-dt * 9));
    this.heading += this.yawRate * dt;
    const ox = this.x, oz = this.z;
    this.x += Math.sin(this.heading) * this.speed * dt; this.z += Math.cos(this.heading) * this.speed * dt;
    // too steep: refuse the move
    if (hf.slope(this.x, this.z) > 0.72 && hf.slope(this.x, this.z) > hf.slope(ox, oz)) { this.x = ox; this.z = oz; this.speed *= 0.3; }
    this.p.x = this.x; this.p.z = this.z; if (resolve(this.p, 0.85)) { this.x = this.p.x; this.z = this.p.z; this.speed *= 0.6; }
    this.x = clamp(this.x, -288, 288); this.z = clamp(this.z, -388, 388);
    const moved = Math.hypot(this.x - ox, this.z - oz) * Math.sign(this.speed || 1);
    this.odo += Math.abs(moved);
    this.settle(dt);
    this.rover.update(dt, moved, boost);
  }

  private settle(dt: number) {
    const hF = this.groundAt(0, 0.6), hB = this.groundAt(0, -0.6), hL = this.groundAt(0.55, 0), hR = this.groundAt(-0.55, 0), hC = this.groundAt(0, 0);
    const wantPitch = Math.atan2(hF - hB, 1.2), wantRoll = Math.atan2(hL - hR, 1.1);
    const a = 1 - Math.exp(-dt * 10);
    this.pitch += (wantPitch - this.pitch) * a; this.roll += (wantRoll - this.roll) * a;
    const plane = (hF + hB + hL + hR + hC * 2) / 6;
    const want = plane + 0.36;
    this.bodyY += (want - this.bodyY) * (dt > 1 ? 1 : 1 - Math.exp(-dt * 14));
    const r = this.rover;
    r.root.position.set(this.x, this.bodyY, this.z);
    r.root.rotation.order = 'YXZ'; r.root.rotation.set(-this.pitch, this.heading, this.roll);
    // per-wheel hub height from the true ground under each wheel, minus what body tilt already accounts for
    const sp = Math.sin(this.pitch), sr = Math.sin(this.roll), k = dt > 1 ? 1 : 1 - Math.exp(-dt * 16);
    r.wheels.forEach((w, i) => {
      const lx = w.side * 0.58;
      const gh = this.groundAt(lx, w.z) + r.wheelR;
      const local = gh - this.bodyY - w.z * sp - lx * sr;
      this.wheelOff[i] += (clamp(local + 0.1, -0.12, 0.14) - this.wheelOff[i]) * k;
    });
    r.setSuspension(this.wheelOff);
  }
}

export { THREE };
