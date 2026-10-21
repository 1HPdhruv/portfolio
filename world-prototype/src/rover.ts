import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** ROVER-02 — compact six-wheel field-survey vehicle. +Z is forward, +X is its left. */
function scuffTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ece8de'; g.fillRect(0, 0, 256, 256);
  let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${60 + r() * 40},${55 + r() * 35},${45 + r() * 30},${r() * 0.07})`; g.fillRect(r() * 256, r() * 256, 1 + r() * 14, 1 + r() * 2.5); }
  for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(30,28,24,${0.05 + r() * 0.12})`; g.lineWidth = 0.6 + r(); g.beginPath(); const x = r() * 256, y = r() * 256; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 24, y + (r() - 0.5) * 24); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function idTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 512, 128);
  g.fillStyle = '#1d2220'; g.font = '600 74px "IBM Plex Mono", ui-monospace, Menlo, monospace';
  g.textBaseline = 'middle'; g.fillText('ROVER-02', 14, 56);
  g.fillStyle = '#ff6a2b'; g.fillRect(14, 104, 160, 8);
  g.fillStyle = '#1d2220'; g.font = '500 20px ui-monospace, Menlo, monospace'; g.fillText('SURVEY · FIELD UNIT', 186, 110);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export class Rover {
  root = new THREE.Group();
  body = new THREE.Group();
  wheels: { grp: THREE.Group; rot: THREE.Object3D; strut: THREE.Mesh; side: number; z: number }[] = [];
  lidar!: THREE.Object3D; tape!: THREE.Object3D; statusLamp!: THREE.Mesh; headlamp!: THREE.Mesh;
  readonly wheelR = 0.19;
  private t = 0;

  constructor() {
    const paintMap = scuffTexture();
    const paint = new THREE.MeshStandardMaterial({ color: '#f1ece0', map: paintMap, roughness: 0.55, metalness: 0.04 });
    const paintGrey = new THREE.MeshStandardMaterial({ color: '#8a918d', map: paintMap, roughness: 0.62, metalness: 0.1 });
    const dark = new THREE.MeshStandardMaterial({ color: '#1c2022', roughness: 0.72, metalness: 0.2 });
    const rubber = new THREE.MeshStandardMaterial({ color: '#0f1011', roughness: 0.96 });
    const steel = new THREE.MeshStandardMaterial({ color: '#9aa0a2', roughness: 0.42, metalness: 0.85 });
    const orange = new THREE.MeshStandardMaterial({ color: '#ff6a2b', roughness: 0.55, metalness: 0.0 });
    const glass = new THREE.MeshStandardMaterial({ color: '#07090b', roughness: 0.08, metalness: 0.4 });
    const lampMat = new THREE.MeshStandardMaterial({ color: '#ffe2b8', emissive: '#ffc27a', emissiveIntensity: 1.6, roughness: 0.3 });
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = this.body) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
    };

    // hull + deck + belly
    add(new RoundedBoxGeometry(0.78, 0.2, 1.12, 3, 0.035), paint, 0, 0, 0);
    add(new THREE.BoxGeometry(0.66, 0.05, 0.96), dark, 0, -0.125, 0);
    add(new THREE.BoxGeometry(0.70, 0.03, 1.0), paintGrey, 0, 0.115, 0);
    // longitudinal rails and cross-tubes
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.07, 1.3), steel, sx * 0.43, -0.07, 0);
    for (const z of [-0.5, 0, 0.5]) add(new THREE.CylinderGeometry(0.018, 0.018, 1.08, 8).rotateZ(Math.PI / 2), steel, 0, -0.1, z);
    // front bumper with orange band + sensor bar
    add(new RoundedBoxGeometry(0.72, 0.075, 0.07, 2, 0.02), dark, 0, -0.03, 0.585);
    add(new THREE.BoxGeometry(0.5, 0.016, 0.012), orange, 0, -0.03, 0.624);
    for (const sx of [-1, 1]) { add(new THREE.CylinderGeometry(0.03, 0.03, 0.025, 14).rotateX(Math.PI / 2), lampMat, sx * 0.27, 0.075, 0.57); }
    for (const sx of [-1, 1]) { add(new THREE.CylinderGeometry(0.022, 0.022, 0.045, 12).rotateX(Math.PI / 2), glass, sx * 0.1, 0.07, 0.575); }
    // side battery panels + stencil
    const idMat = new THREE.MeshBasicMaterial({ map: idTexture(), transparent: true, toneMapped: false, color: '#d9d3c4', polygonOffset: true, polygonOffsetFactor: -2 });
    for (const sx of [-1, 1]) {
      add(new RoundedBoxGeometry(0.035, 0.14, 0.62, 2, 0.012), paintGrey, sx * 0.405, -0.005, -0.12);
      const id = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.085), idMat);
      id.position.set(sx * 0.4245, 0.0, 0.0); id.rotation.y = sx * Math.PI / 2; this.body.add(id);
      add(new THREE.BoxGeometry(0.012, 0.02, 0.05), steel, sx * 0.425, -0.05, 0.3);
    }
    // instrument case (Pelican-style) with latches
    add(new RoundedBoxGeometry(0.44, 0.15, 0.36, 3, 0.025), new THREE.MeshStandardMaterial({ color: '#2b3033', roughness: 0.7, metalness: 0.1 }), 0, 0.2, -0.27);
    for (const sx of [-1, 1]) for (const z of [-0.37, -0.17]) add(new THREE.BoxGeometry(0.035, 0.03, 0.018), steel, sx * 0.1, 0.235, z - 0.0);
    add(new THREE.BoxGeometry(0.1, 0.012, 0.05), orange, 0.1, 0.278, -0.27);
    // mast with camera head and lidar puck
    const mast = new THREE.Group(); mast.position.set(0.27, 0.13, -0.44); this.body.add(mast);
    add(new THREE.CylinderGeometry(0.045, 0.055, 0.04, 14), dark, 0, 0.02, 0, mast);
    add(new THREE.CylinderGeometry(0.02, 0.022, 0.66, 12), steel, 0, 0.36, 0, mast);
    add(new THREE.CylinderGeometry(0.026, 0.026, 0.14, 12), dark, 0, 0.5, 0, mast);
    const head = new THREE.Group(); head.position.set(0, 0.7, 0); mast.add(head);
    add(new RoundedBoxGeometry(0.2, 0.075, 0.095, 2, 0.015), paintGrey, 0, 0, 0, head);
    for (const sx of [-1, 1]) { add(new THREE.CylinderGeometry(0.026, 0.03, 0.05, 14).rotateX(Math.PI / 2), dark, sx * 0.06, 0, 0.065, head); add(new THREE.CylinderGeometry(0.017, 0.017, 0.012, 14).rotateX(Math.PI / 2), glass, sx * 0.06, 0, 0.093, head); }
    add(new THREE.CylinderGeometry(0.05, 0.055, 0.025, 20), dark, 0, 0.05, 0, head);
    this.lidar = new THREE.Group(); this.lidar.position.set(0, 0.095, 0); head.add(this.lidar);
    add(new THREE.CylinderGeometry(0.075, 0.075, 0.055, 24), new THREE.MeshStandardMaterial({ color: '#16191a', roughness: 0.35, metalness: 0.5 }), 0, 0, 0, this.lidar);
    add(new THREE.CylinderGeometry(0.0765, 0.0765, 0.01, 24), new THREE.MeshStandardMaterial({ color: '#6c7476', roughness: 0.4, metalness: 0.7 }), 0, 0.012, 0, this.lidar);
    add(new THREE.BoxGeometry(0.03, 0.018, 0.012), glass, 0, -0.005, 0.0765, this.lidar);
    // GNSS antenna + orange survey tape
    const ant = new THREE.Group(); ant.position.set(-0.28, 0.13, -0.46); this.body.add(ant);
    add(new THREE.CylinderGeometry(0.014, 0.016, 0.46, 10), steel, 0, 0.23, 0, ant);
    add(new THREE.SphereGeometry(0.058, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#e8e5dc', roughness: 0.4 }), 0, 0.46, 0, ant);
    add(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 20), dark, 0, 0.455, 0, ant);
    this.tape = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.03, 4, 1), new THREE.MeshStandardMaterial({ color: '#ff6a2b', roughness: 0.7, side: THREE.DoubleSide }));
    this.tape.position.set(0.09, 0.4, 0); this.tape.castShadow = true; ant.add(this.tape);
    // soil probe on a stowed boom
    const probe = new THREE.Group(); probe.position.set(0.0, -0.07, 0.62); this.body.add(probe);
    add(new THREE.BoxGeometry(0.06, 0.05, 0.12), dark, 0, 0, 0, probe);
    const rod = add(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 8), steel, 0, -0.13, 0.1, probe); rod.rotation.x = -0.45;
    add(new THREE.ConeGeometry(0.014, 0.05, 8), steel, 0, -0.29, 0.17, probe).rotation.x = Math.PI - 0.45;
    // rear: tow loop, status lamp, cable run to the mast
    const loop = add(new THREE.TorusGeometry(0.06, 0.009, 8, 16, Math.PI), steel, 0, 0.0, -0.57); loop.rotation.set(0, Math.PI, 0);
    this.statusLamp = add(new THREE.BoxGeometry(0.05, 0.022, 0.02), new THREE.MeshStandardMaterial({ color: '#ffc27a', emissive: '#ff9a3c', emissiveIntensity: 1.0 }), 0, 0.075, -0.572);
    const cable = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.27, 0.16, -0.44), new THREE.Vector3(0.2, 0.135, -0.36), new THREE.Vector3(0.12, 0.14, -0.3), new THREE.Vector3(0.1, 0.19, -0.27)]), 16, 0.006, 6);
    add(cable, rubber);
    // fasteners
    const bolt = new THREE.CylinderGeometry(0.0085, 0.0085, 0.008, 6);
    const bolts = new THREE.InstancedMesh(bolt, steel, 28); const dm = new THREE.Object3D(); let bi = 0;
    for (let i = 0; i < 7; i++) for (const sx of [-1, 1]) { dm.position.set(sx * 0.33, 0.133, -0.46 + i * 0.15); dm.updateMatrix(); bolts.setMatrixAt(bi++, dm.matrix); }
    for (let i = 0; i < 7; i++) for (const sx of [-1, 1]) { dm.position.set(sx * 0.405, 0.095 - (i % 2) * 0.0, -0.5 + i * 0.16); dm.rotation.z = Math.PI / 2; dm.updateMatrix(); if (bi < 28) bolts.setMatrixAt(bi++, dm.matrix); dm.rotation.z = 0; }
    bolts.count = bi; this.body.add(bolts);

    // wheels: merged tread + hub geometry, shared
    const R = this.wheelR, Wd = 0.16;
    const parts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(R, R, Wd, 24).rotateZ(Math.PI / 2)];
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; const l = new THREE.BoxGeometry(Wd * 1.02, 0.03, 0.045); l.translate(0, R + 0.005, 0); l.rotateX(a); parts.push(l); }
    const wheelGeo = mergeGeometries(parts)!;
    const hubGeo = new THREE.CylinderGeometry(0.1, 0.1, Wd + 0.012, 18).rotateZ(Math.PI / 2);
    const hubMat = new THREE.MeshStandardMaterial({ color: '#8c9391', roughness: 0.5, metalness: 0.7 });
    const capGeo = new THREE.CylinderGeometry(0.035, 0.035, Wd + 0.03, 10).rotateZ(Math.PI / 2);
    const strutGeo = new THREE.BoxGeometry(0.03, 1, 0.04);
    for (const side of [-1, 1]) for (const z of [0.46, 0, -0.46]) {
      const grp = new THREE.Group(); grp.position.set(side * 0.58, 0, z); this.body.add(grp);
      const rot = new THREE.Group(); grp.add(rot);
      add(wheelGeo, rubber, 0, 0, 0, rot); add(hubGeo, hubMat, 0, 0, 0, rot); add(capGeo, dark, 0, 0, 0, rot);
      const strut = add(strutGeo, steel, side * 0.5, 0, z); // re-parented each frame in local body space
      this.wheels.push({ grp, rot, strut, side, z });
    }
    // headlamp: a projected light pool on the ground ahead (a real SpotLight cost ~14 ms/frame across the world)
    const beam = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -6,
      uniforms: { uI: { value: 0.55 } },
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: 'varying vec2 vU; uniform float uI; void main(){ float x = (vU.x-.5)*2., y = vU.y; float w = .25 + y*.75; float a = (1.-smoothstep(.5*w, w, abs(x))) * smoothstep(0., .12, y) * (1.-smoothstep(.55, 1., y)); gl_FragColor = vec4(vec3(1.,.82,.6)*a*uI, 1.); }',
    });
    this.headlamp = new THREE.Mesh(new THREE.PlaneGeometry(5, 11).rotateX(-Math.PI / 2).translate(0, 0, 6.2), beam);
    this.headlamp.position.set(0, -0.33, 0.4); this.headlamp.renderOrder = 4;
    this.root.add(this.headlamp);

    this.root.add(this.body);
    this.mergeStatic();
  }

  /** Collapse every static body part into one mesh per material (dozens of draw calls -> a handful). */
  private mergeStatic() {
    const dynamic = new Set<THREE.Object3D>([this.lidar, this.tape, this.statusLamp, ...this.wheels.map((w) => w.grp), ...this.wheels.map((w) => w.strut)]);
    const isDynamic = (o: THREE.Object3D) => { for (let q: THREE.Object3D | null = o; q && q !== this.body; q = q.parent) if (dynamic.has(q)) return true; return false; };
    this.body.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.body.matrixWorld).invert();
    const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>(); const remove: THREE.Mesh[] = [];
    this.body.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh || isDynamic(m) || Array.isArray(m.material) || (m.material as THREE.Material).transparent) return;
      const g = m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      const n = g.attributes.position.count;
      g.setIndex(new THREE.BufferAttribute(g.index ? Uint32Array.from(g.index.array) : Uint32Array.from({ length: n }, (_, i) => i), 1));
      const mat = m.material as THREE.Material; if (!byMat.has(mat)) byMat.set(mat, []); byMat.get(mat)!.push(g); remove.push(m);
    });
    for (const m of remove) m.parent!.remove(m);
    for (const [mat, list] of byMat) { const g = mergeGeometries(list, false); if (!g) continue; const mesh = new THREE.Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true; this.body.add(mesh); }
  }

  /** hub heights (body-local y) per wheel: [FL? order matches this.wheels] */
  setSuspension(offsets: number[]) {
    this.wheels.forEach((w, i) => {
      const y = -0.1 + offsets[i];
      w.grp.position.y = y;
      const x0 = w.side * 0.43, x1 = w.side * 0.58, y0 = -0.07;
      const dx = x1 - x0, dy = y - y0, len = Math.hypot(dx, dy);
      w.strut.position.set((x0 + x1) / 2, (y0 + y) / 2, w.z); w.strut.scale.set(1, len, 1); w.strut.rotation.set(0, 0, Math.atan2(dx, dy) * -1);
    });
  }
  update(dt: number, distance: number, boosting: boolean) {
    this.t += dt;
    for (const w of this.wheels) w.rot.rotation.x += distance / this.wheelR;
    this.lidar.rotation.y += dt * 9;
    this.tape.rotation.y = Math.sin(this.t * 5.2) * 0.35; (this.tape as THREE.Mesh).rotation.z = Math.sin(this.t * 3.1) * 0.25;
    (this.statusLamp.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + 0.5 * (Math.sin(this.t * 2.2) > 0.4 ? 1 : 0);
    ((this.headlamp.material as THREE.ShaderMaterial).uniforms.uI.value) = boosting ? 0.7 : 0.55;
  }
}
