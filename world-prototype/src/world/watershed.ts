import * as THREE from 'three';
import { Heightfield, POND } from '../heightfield';
import { Builder, Frame } from './kit';
import { M } from './materials';
import { NOISE_GLSL } from '../glsl';
import { HAZE } from '../env';
import { mulberry32 } from '../noise';
import { angular } from './veg';
import { weathered } from './materials';
const stoneMat = weathered({ color: '#ffffff', vertexColors: true, roughness: 0.75 }, { grime: 0.8, streak: 0, dirtCol: '#2b3530' });

/** Shallow, muted-teal water: fresnel sky reflection, flow ripples along the channel, soft banks. */
export function waterMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: '#2c4a48', roughness: 0.16, metalness: 0.0, transparent: true, depthWrite: false });
  const u = { uTime: { value: 0 }, uSky: { value: new THREE.Color('#5e8c8a').lerp(new THREE.Color('#8fa3b0'), 0.35) }, uHaze: { value: HAZE.clone() } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aFlow; varying float vFlow; varying vec2 vUv2; varying vec3 vWP;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvUv2 = uv; vFlow = aFlow; vWP = (modelMatrix*vec4(position,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying float vFlow; varying vec2 vUv2; varying vec3 vWP; uniform float uTime; uniform vec3 uSky;\n${NOISE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float edge = smoothstep(0., .22, vUv2.x) * smoothstep(1., .78, vUv2.x);
        // deeper in the thalweg, shallow and silty at the margins
        float centre = 1. - abs(vUv2.x - .5) * 2.;
        diffuseColor.rgb = mix(diffuseColor.rgb * vec3(1.35, 1.25, 1.05) + vec3(.03,.025,.01), diffuseColor.rgb * .8, smoothstep(.1, .8, centre));
        // riffles and drops: broken white water, flowing
        float fl = smoothstep(.02, .09, vFlow);
        float fo = fbm4(vec2(vUv2.x * 9., vUv2.y * 3. - uTime * 2.2) + vWP.xz * .1);
        float foam = fl * smoothstep(.5, .75, fo) * (.4 + .6 * centre);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.78,.8,.76), foam * .65);
        diffuseColor.a = mix(.82, .95, foam) * edge;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec2 fp = vec2(vUv2.x * 6., vUv2.y * .9 - uTime * (.6 + vFlow * 14.));
          float e = .05;
          float h0 = fbm4(fp + vWP.xz*.05), hx = fbm4(fp + vec2(e,0.) + vWP.xz*.05), hy = fbm4(fp + vec2(0.,e) + vWP.xz*.05);
          vec3 nW = normalize(vec3((h0-hx)*2.2, 1., (h0-hy)*2.2));
          normal = normalize(mat3(viewMatrix) * nW);
        }`)
      .replace('#include <opaque_fragment>', `
        {
          vec3 V = normalize(cameraPosition - vWP);
          vec3 nW = normalize((vec4(normal, 0.) * viewMatrix).xyz);
          float fr = pow(1. - max(dot(V, nW), 0.), 4.);
          outgoingLight = mix(outgoingLight, uSky * .8, clamp(.08 + fr * .55, 0., .6));
        }
        #include <opaque_fragment>`);
  };
  return { m, u };
}

export function buildWatershed(hf: Heightfield, parent: THREE.Object3D) {
  const b = new Builder(hf, 'watershed', 0.8);
  const { m: water, u } = waterMaterial();
  const rnd = mulberry32(606), stones: THREE.Matrix4[] = [];
  for (const r of hf.rivers) {
    const pos: number[] = [], uv: number[] = [], idx: number[] = [], flow: number[] = [];
    let s = 0;
    for (let i = 0; i < r.pts.length; i++) {
      const p = r.pts[i], a = r.pts[Math.max(0, i - 2)], c = r.pts[Math.min(r.pts.length - 1, i + 2)];
      if (i) s += Math.hypot(p.x - r.pts[i - 1].x, p.z - r.pts[i - 1].z);
      let tx = c.x - a.x, tz = c.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const w = p.w * 0.62 + 0.6, y = p.wl + 0.12;
      const fl = Math.max(0, (a.wl - c.wl) / (l || 1));
      pos.push(p.x - tz * w, y, p.z + tx * w, p.x + tz * w, y, p.z - tx * w); uv.push(0, s / 4, 1, s / 4); flow.push(fl, fl);
      if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
      // stones in the riffles: the drop exposes the bed
      if (fl > 0.05 && i % 3 === 0) for (let k = 0; k < 2; k++) { const o = (rnd() - 0.5) * w * 1.4; stones.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x - tz * o, p.wl - 0.05, p.z + tx * o), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(), rnd() * 6, rnd())), new THREE.Vector3(0.35 + rnd() * 0.4, 0.25 + rnd() * 0.3, 0.35 + rnd() * 0.4))); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 1)); g.setIndex(idx); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, water); mesh.renderOrder = 3; mesh.receiveShadow = true; b.add(mesh);
  }
  // settling pond at the foot of the Watershed
  {
    const g = new THREE.CircleGeometry(POND.r * 1.12, 48).rotateX(-Math.PI / 2);
    const uvs = g.attributes.uv; for (let i = 0; i < uvs.count; i++) uvs.setXY(i, 0.5, uvs.getY(i) * 6);
    g.setAttribute('aFlow', new THREE.Float32BufferAttribute(new Float32Array(uvs.count), 1));
    const mesh = new THREE.Mesh(g, water); mesh.position.set(POND.x, hf.pondLevel, POND.z); mesh.renderOrder = 3; b.add(mesh);
  }
  b.updaters.push((_dt, t) => (u.uTime.value = t));
  b.inst(angular(77, 1, 0.6, 1.1), stoneMat, stones, true);

  // gauging stations at each confluence: weir, stilling-well hut, staff gauge, telemetry
  let n = 0;
  for (const r of hf.rivers) {
    if (!r.joinsAt) continue;
    const tgt = hf.rivers[r.joinsAt.river];
    const q = r.pts[r.pts.length - 1];
    // find the trunk point nearest the confluence and its direction
    let best = 0, bd = 1e9; tgt.pts.forEach((p, i) => { const d = Math.hypot(p.x - q.x, p.z - q.z); if (d < bd) { bd = d; best = i; } });
    const j = Math.min(tgt.pts.length - 1, best + 30), c = tgt.pts[j], c2 = tgt.pts[Math.min(tgt.pts.length - 1, j + 4)];
    const dir = Math.atan2(c2.x - c.x, c2.z - c.z);
    n++;
    const f = new Frame(c.x, c.wl, c.z, dir + Math.PI / 2);
    // low concrete weir across the channel
    const W = c.w * 1.4 + 2;
    b.block(M.concrete, f, W, 0.9, 0.6, 0, -0.75, 0);
    for (const sx of [-1, 1]) b.block(M.concrete, f, 0.5, 1.6, 1.6, sx * W / 2, -0.75, 0);
    // stilling-well hut on the bank
    const sx = W / 2 + 2.2, [hx, hz] = f.w(sx, 0.5), gy = hf.at(hx, hz);
    const H = new Frame(hx, gy, hz, f.rot);
    for (const [a, c3] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) b.cyl(M.galv, H, 0.05, 0.9, a, 0.45, c3, 0, 0, 6);
    b.block(M.panelWhite, H, 1.3, 1.6, 1.3, 0, 0.9, 0); b.box(M.panelGrey, H, 1.5, 0.08, 1.5, 0, 2.55, 0, 0, 0.1);
    b.box(M.steelDark, H, 0.6, 1.2, 0.04, 0, 1.5, 0.66);
    b.box(M.solar, H, 0.7, 0.03, 0.5, 0, 2.66, 0, 0, -0.4);
    b.cyl(M.galv, H, 0.02, 1.6, 0.5, 3.3, -0.5, 0, 0, 6);
    b.solid(H, 0, 0, 1.4, 1.4);
    // staff gauge: a painted board standing in the water
    const [sxw, szw] = f.w(W / 2 - 1.0, -1.2);
    const G = new Frame(sxw, c.wl - 0.6, szw, f.rot);
    b.box(M.chalkPaint, G, 0.14, 2.2, 0.04, 0, 1.1, 0);
    for (let k = 0; k < 10; k++) b.box(k % 5 === 4 ? M.orange : M.steelDark, G, k % 5 === 4 ? 0.14 : 0.08, 0.035, 0.045, k % 5 === 4 ? 0 : -0.03, 0.2 + k * 0.2, 0);
    b.sign(H, 0, 1.5, 0.72, 0, 0.5, 0.3, [`GS-${n}`], { posts: false, accent: false });
  }
  // pond outlet + pump house feeding the Research Station's cooling loop
  {
    const a = Math.atan2(10 - POND.x, 278 - POND.z);
    const ox = POND.x + Math.sin(a) * (POND.r + 4), oz = POND.z + Math.cos(a) * (POND.r + 4);
    const f = new Frame(ox, hf.at(ox, oz), oz, a);
    b.block(M.concreteSmooth, f, 4, 2.6, 3.2, 0, 0, 0); b.box(M.panelGrey, f, 4.4, 0.15, 3.6, 0, 2.7, 0);
    b.box(M.steelDark, f, 1, 2, 0.05, 0, 1, 1.62); b.box(M.lamp, f, 0.3, 0.08, 0.12, 0, 2.3, 1.68);
    b.pool(...f.w(0, 2.5), 3, 0.25);
    b.solid(f, 0, 0, 4, 3.2);
    const [px, pz] = [10 - 22, 278 - 24];
    b.cable(M.steelPaint, new Frame(0, 0, 0), [[ox, f.y + 0.4, oz], [(ox + px) / 2, hf.at((ox + px) / 2, (oz + pz) / 2) + 0.35, (oz + pz) / 2], [px, hf.at(px, pz) + 0.4, pz]], 0.16);
    b.sign(f, 2.6, 1.0, 2.2, 0, 1.4, 0.6, ['SETTLING POND', 'BASIN OUTFALL'], {});
  }
  b.finish(parent);
  return b;
}
