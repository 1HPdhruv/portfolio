import * as THREE from 'three';

/** The only particles in the Basin: dust kicked up by ROVER-02 on unpaved ground. */
export class Dust {
  readonly N = 260;
  points: THREE.Points;
  private pos: Float32Array; private vel: Float32Array; private age: Float32Array; private life: Float32Array; private size: Float32Array;
  private i = 0; private acc = 0;
  constructor() {
    const N = this.N;
    this.pos = new Float32Array(N * 3); this.vel = new Float32Array(N * 3); this.age = new Float32Array(N).fill(1); this.life = new Float32Array(N).fill(1); this.size = new Float32Array(N);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aAge', new THREE.BufferAttribute(this.age, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uCol: { value: new THREE.Color('#b9a98c') } },
      vertexShader: `attribute float aAge; attribute float aSize; varying float vA;
        void main(){ vA = aAge; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * (1. + aAge * 2.2) * 320. / -mv.z; }`,
      fragmentShader: `uniform vec3 uCol; varying float vA;
        void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard; float a = (1. - smoothstep(.15, .5, d)) * (1. - vA) * .32;
        gl_FragColor = vec4(uCol, a); }`,
    });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false;
  }
  emit(x: number, y: number, z: number, vx: number, vz: number) {
    const k = this.i++ % this.N;
    this.pos.set([x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3], k * 3);
    this.vel.set([vx * 0.25 + (Math.random() - 0.5) * 0.6, 0.35 + Math.random() * 0.5, vz * 0.25 + (Math.random() - 0.5) * 0.6], k * 3);
    this.age[k] = 0; this.life[k] = 1.1 + Math.random() * 0.9; this.size[k] = 0.35 + Math.random() * 0.35;
  }
  update(dt: number, rover: THREE.Object3D, speed: number, surface: string, heading: number) {
    const unpaved = surface !== 'road' && surface !== 'hardstand';
    if (unpaved && Math.abs(speed) > 1.5) {
      this.acc += dt * Math.abs(speed) * 3.2;
      while (this.acc > 1) {
        this.acc -= 1;
        const side = Math.random() < 0.5 ? -1 : 1, back = -0.5;
        const lx = side * 0.58, F = [Math.sin(heading), Math.cos(heading)], L = [Math.cos(heading), -Math.sin(heading)];
        const p = rover.position;
        this.emit(p.x + F[0] * back + L[0] * lx, p.y - 0.25, p.z + F[1] * back + L[1] * lx, -F[0] * speed, -F[1] * speed);
      }
    }
    for (let k = 0; k < this.N; k++) {
      if (this.age[k] >= 1) continue;
      this.age[k] = Math.min(1, this.age[k] + dt / this.life[k]);
      this.vel[k * 3 + 1] -= dt * 0.15; for (let c = 0; c < 3; c++) { this.vel[k * 3 + c] *= 1 - dt * 1.2; this.pos[k * 3 + c] += this.vel[k * 3 + c] * dt; }
      // drift downwind (ENE)
      this.pos[k * 3] += dt * 0.5; this.pos[k * 3 + 2] -= dt * 0.15;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.aAge.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
  }
}
