import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Heightfield } from '../heightfield';
import { M, signTexture } from './materials';
import { addBox, addCircle } from '../colliders';
import { clamp } from '../noise';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

/** A local construction frame: origin on the ground, rotated about Y. */
export class Frame {
  m: THREE.Matrix4;
  constructor(public x: number, public y: number, public z: number, public rot = 0) {
    this.m = new THREE.Matrix4().makeRotationY(rot).setPosition(x, y, z);
  }
  w(lx: number, lz: number): [number, number] {
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    return [this.x + lx * c + lz * s, this.z - lx * s + lz * c];
  }
  sub(lx: number, ly: number, lz: number, rot = 0) { const [x, z] = this.w(lx, lz); return new Frame(x, this.y + ly, z, this.rot + rot); }
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const cylCache = new Map<string, THREE.BufferGeometry>();
export function unitCyl(seg = 12, top = 1) {
  const k = `${seg}:${top}`; if (!cylCache.has(k)) cylCache.set(k, new THREE.CylinderGeometry(top, 1, 1, seg)); return cylCache.get(k)!;
}

/** Turn a closed primitive inside-out (rooms, shafts): reverse winding and normals. */
export function inward(g: THREE.BufferGeometry) {
  const idx = g.index!; for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, a); }
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return g;
}

/** Objects hidden beyond userData.maxDist from the camera (grass, small clutter). */
export const distCulled: THREE.Object3D[] = [];
export function updateDistanceCulling(cam: THREE.Vector3) { for (const o of distCulled) o.visible = cam.distanceTo(o.userData.center) < o.userData.maxDist + 60; }

let realLights = 0;
export const LIGHT_BUDGET = 3; // every real light is paid for by every lit fragment in the world

/** Collects static parts per material and merges them into a handful of draw calls per zone. */
export class Builder {
  parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  group = new THREE.Group();
  updaters: ((dt: number, t: number) => void)[] = [];
  /** false keeps this builder's meshes out of mergeWorldStatic (e.g. geometry that must be shown/hidden on its own) */
  globalMerge = true;
  constructor(public hf: Heightfield, name: string, public dirt = 1) { this.group.name = name; }
  ground(x: number, z: number) { return this.hf.at(x, z); }

  put(mat: THREE.Material, geo: THREE.BufferGeometry, f: Frame, lx: number, ly: number, lz: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); _m.compose(_v.set(lx, ly, lz), _q, _s.set(sx, sy, sz));
    const g = geo.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(f.m, _m));
    this.push(mat, g);
  }
  putWorld(mat: THREE.Material, g: THREE.BufferGeometry) { this.push(mat, g); }
  private push(mat: THREE.Material, g: THREE.BufferGeometry) {
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    const n = g.attributes.position.count;
    if (!g.index) { const idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i; g.setIndex(new THREE.BufferAttribute(idx, 1)); }
    else if (!(g.index.array instanceof Uint32Array)) g.setIndex(new THREE.BufferAttribute(Uint32Array.from(g.index.array), 1));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    const d = new Float32Array(n), p = g.attributes.position;
    for (let i = 0; i < n; i++) { const above = p.getY(i) - this.hf.at(p.getX(i), p.getZ(i)); d[i] = clamp(1 - above / 1.3) * this.dirt; }
    g.setAttribute('aDirt', new THREE.BufferAttribute(d, 1));
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat)!.push(g);
  }
  box(mat: THREE.Material, f: Frame, w: number, h: number, d: number, lx: number, ly: number, lz: number, ry = 0, rx = 0, rz = 0) {
    this.put(mat, unitBox, f, lx, ly, lz, rx, ry, rz, w, h, d);
  }
  /** box standing on local y = ly (bottom face at ly) */
  block(mat: THREE.Material, f: Frame, w: number, h: number, d: number, lx: number, ly: number, lz: number, ry = 0) { this.box(mat, f, w, h, d, lx, ly + h / 2, lz, ry); }
  rbox(mat: THREE.Material, f: Frame, w: number, h: number, d: number, lx: number, ly: number, lz: number, ry = 0, r = 0.04) {
    this.put(mat, new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.1, h / 2.1, d / 2.1)), f, lx, ly, lz, 0, ry, 0);
  }
  cyl(mat: THREE.Material, f: Frame, r: number, h: number, lx: number, ly: number, lz: number, rx = 0, rz = 0, seg = 12, top = 1, ry = 0) {
    this.put(mat, unitCyl(seg, top), f, lx, ly, lz, rx, ry, rz, r, h, r);
  }
  /** cylinder between two local points */
  rod(mat: THREE.Material, f: Frame, a: [number, number, number], b: [number, number, number], r: number, seg = 6) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), dir = B.clone().sub(A), len = dir.length();
    if (len < 1e-4) return;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    const mm = new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new THREE.Vector3(r, len, r));
    const g = unitCyl(seg).clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(f.m, mm));
    this.push(mat, g);
  }
  /** sagging cable / hose through local points */
  cable(mat: THREE.Material, f: Frame, pts: [number, number, number][], r = 0.02, sag = 0) {
    const v = pts.map((p) => new THREE.Vector3(...p));
    if (sag && v.length === 2) { const mid = v[0].clone().lerp(v[1], 0.5); mid.y -= sag; v.splice(1, 0, mid); }
    const curve = new THREE.CatmullRomCurve3(v);
    const g = new THREE.TubeGeometry(curve, Math.max(6, Math.round(curve.getLength() * 2)), r, 5).applyMatrix4(f.m);
    this.push(mat, g);
  }
  geo(mat: THREE.Material, g: THREE.BufferGeometry, f: Frame) { this.push(mat, g.applyMatrix4(f.m)); }
  add(o: THREE.Object3D) { this.group.add(o); return o; }
  inst(geo: THREE.BufferGeometry, mat: THREE.Material, matrices: THREE.Matrix4[], shadow = true) {
    if (!matrices.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, matrices.length);
    matrices.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = shadow; im.receiveShadow = true;
    im.computeBoundingSphere(); this.group.add(im); return im;
  }
  /** Instancing split into spatial tiles so frustum (and shadow-frustum) culling works; optional max view distance. */
  tiled(geo: THREE.BufferGeometry, mat: THREE.Material, matrices: THREE.Matrix4[], o: { shadow?: boolean; tile?: number; maxDist?: number; colors?: THREE.Color[] } = {}) {
    const T = o.tile ?? 80, bins = new Map<string, number[]>(), v = new THREE.Vector3();
    matrices.forEach((m, i) => { v.setFromMatrixPosition(m); const k = `${Math.floor(v.x / T)},${Math.floor(v.z / T)}`; if (!bins.has(k)) bins.set(k, []); bins.get(k)!.push(i); });
    const out: THREE.InstancedMesh[] = [];
    for (const [, ids] of bins) {
      const im = new THREE.InstancedMesh(geo, mat, ids.length);
      ids.forEach((id, j) => { im.setMatrixAt(j, matrices[id]); if (o.colors) im.setColorAt(j, o.colors[id]); });
      im.castShadow = o.shadow ?? true; im.receiveShadow = true; im.computeBoundingSphere();
      if (o.maxDist) { const md = o.maxDist, c = im.boundingSphere!.center.clone(); im.onBeforeRender = () => {}; (im as THREE.Object3D).userData.maxDist = md; (im as THREE.Object3D).userData.center = c; distCulled.push(im); }
      this.group.add(im); out.push(im);
    }
    return out;
  }
  solid(f: Frame, lx: number, lz: number, w: number, d: number, ry = 0) {
    const [x, z] = f.w(lx, lz); addBox(x, z, w / 2, d / 2, -(f.rot + ry));
  }
  post(f: Frame, lx: number, lz: number, r: number) { const [x, z] = f.w(lx, lz); addCircle(x, z, r); }

  /** Stencil sign board on two posts (or wall-mounted when posts=false). */
  sign(f: Frame, lx: number, ly: number, lz: number, ry: number, w: number, h: number, lines: string[], o: { posts?: boolean; bg?: string; fg?: string; accent?: boolean; font?: string } = {}) {
    const tex = signTexture(lines, { w: 512, h: Math.round(512 * h / w), bg: o.bg, fg: o.fg, accent: o.accent, font: o.font });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    const sf = f.sub(lx, ly, lz, ry);
    face.position.set(sf.x, sf.y, sf.z); face.rotation.y = sf.rot; face.translateZ(0.031); face.castShadow = true; face.receiveShadow = true;
    this.group.add(face);
    this.box(M.steelDark, sf, w + 0.06, h + 0.06, 0.05, 0, 0, 0);
    if (o.posts !== false) for (const sx of [-1, 1]) this.cyl(M.galv, sf, 0.035, ly + h / 2, sx * (w / 2 - 0.08), -ly / 2 + h / 4, -0.06, 0, 0, 8);
  }

  /** Real light (budgeted) + emissive head is the caller's job. Returns null when over budget. */
  light(x: number, y: number, z: number, color = '#ffc27a', intensity = 30, distance = 26) {
    if (realLights >= LIGHT_BUDGET) return null;
    realLights++;
    const l = new THREE.PointLight(color, intensity, distance, 1.8); l.position.set(x, y, z); this.group.add(l); return l;
  }
  /** Fake light pool on the ground: additive radial decal. */
  pool(x: number, z: number, r: number, strength = 0.5, color = '#ffc27a') {
    const m = new THREE.Mesh(poolGeo, poolMat(color, strength));
    const y = this.hf.at(x, z);
    m.position.set(x, y + 0.06, z); m.scale.set(r, 1, r); m.renderOrder = 2; this.group.add(m);
    // conform roughly to slope
    const n = this.hf.normal(x, z); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(n[0], n[1], n[2]));
    return m;
  }

  finish(parent: THREE.Object3D) {
    for (const [mat, list] of this.parts) {
      const g = mergeGeometries(list, false);
      if (!g) { console.warn('merge failed', this.group.name); continue; }
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; mesh.userData.static = this.globalMerge;
      this.group.add(mesh);
    }
    this.parts.clear();
    parent.add(this.group);
    return this;
  }
}

const poolGeo = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
const poolCache = new Map<string, THREE.Material>();
function poolMat(color: string, strength: number) {
  const k = color + strength; if (poolCache.has(k)) return poolCache.get(k)!;
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    polygonOffset: true, polygonOffsetFactor: -4,
    uniforms: { uCol: { value: new THREE.Color(color) }, uS: { value: strength } },
    vertexShader: 'varying vec2 vU; void main(){ vU = position.xz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec2 vU; uniform vec3 uCol; uniform float uS; void main(){ float d = length(vU); float a = pow(max(1.-d,0.), 2.2) * uS; gl_FragColor = vec4(uCol*a, 1.); }',
  });
  poolCache.set(k, m); return m;
}

/** After every zone is built: merge all static zone meshes in the world by material (hundreds of draws -> ~35). */
export function mergeWorldStatic(root: THREE.Object3D) {
  const byMat = new Map<THREE.Material, THREE.Mesh[]>();
  root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.userData.static) { const k = m.material as THREE.Material; if (!byMat.has(k)) byMat.set(k, []); byMat.get(k)!.push(m); } });
  const out = new THREE.Group(); out.name = 'static-merged';
  let before = 0;
  for (const [mat, list] of byMat) {
    before += list.length;
    const g = mergeGeometries(list.map((m) => m.geometry), false);
    for (const m of list) { m.parent!.remove(m); m.geometry.dispose(); }
    if (!g) continue;
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; out.add(mesh);
  }
  root.add(out);
  return { before, after: out.children.length };
}
