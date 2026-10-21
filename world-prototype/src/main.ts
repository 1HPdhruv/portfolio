import * as THREE from 'three';
import { patchFog, makeSky, makeLights, makeFarRidges, HAZE, SUN_DIR } from './env';
import { Heightfield } from './heightfield';
import { buildTerrain } from './terrain';
import { Rover } from './rover';
import { Driver } from './drive';
import { CameraRig } from './camera';
import { Debug } from './debug';
import { ZONES } from './layout';
import { Noise } from './noise';
import { buildWorld } from './world';
import { Dust } from './dust';
import { buildAnchors } from './zones';

patchFog();

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(HAZE, 0.0017);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.25, 9000);

async function boot() {
  await new Promise((r) => setTimeout(r, 30));
  const t0 = performance.now();
  const hf = new Heightfield();
  const tHF = performance.now() - t0;
  const terrain = buildTerrain(hf);
  scene.add(terrain.group);
  scene.add(makeSky());
  const nz = new Noise(77); scene.add(makeFarRidges((x, y) => nz.fbm(x, y, 4)));
  const { sun } = makeLights(scene);
  const world = buildWorld(scene, hf);

  // interaction anchors (dev view: key P shows them as survey pins)
  const anchors = buildAnchors(hf);
  const pins = new THREE.Group(); pins.visible = false; scene.add(pins);
  const pinMat = new THREE.MeshBasicMaterial({ color: '#ff6a2b', transparent: true, opacity: 0.85, depthTest: false });
  for (const a of anchors) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6, 6).translate(0, 3, 0), pinMat); m.position.set(...a.position); m.renderOrder = 9; pins.add(m); const ring = new THREE.Mesh(new THREE.RingGeometry(a.radius - 0.15, a.radius, 40).rotateX(-Math.PI / 2), pinMat); ring.position.set(a.position[0], a.position[1] + 0.2, a.position[2]); ring.renderOrder = 9; pins.add(ring); }
  console.log('anchors', anchors.length);

  const rover = new Rover(); scene.add(rover.root);
  const driver = new Driver(hf, rover);
  const dust = new Dust(); scene.add(dust.points);
  driver.teleport(14, -298, 0.0);
  const rig = new CameraRig(camera, renderer.domElement, hf);
  rig.yaw = 0;

  let hidden = false;
  const toggle = (k: string) => {
    if (k === 'fly') { rig.mode = rig.mode === 'fly' ? 'follow' : 'fly'; if (rig.mode === 'fly') { rig.fly.pos.copy(camera.position); rig.fly.yaw = rig.yaw; rig.fly.pitch = -0.5; } rig.snap(); }
    if (k === 'overview') { rig.mode = rig.mode === 'overview' ? 'follow' : 'overview'; }
    if (k === 'contour') terrain.uniforms.uMode.value = terrain.uniforms.uMode.value > 0.5 ? 0 : 1;
    if (k === 'hide') { hidden = !hidden; document.body.classList.toggle('shot', hidden); }
    if (k === 'anchors') pins.visible = !pins.visible;
  };
  const teleport = (id: string) => {
    const z = ZONES.find((q) => q.id === id); if (!z) return;
    const t = z.tp ?? [z.x, z.z, z.face];
    driver.teleport(t[0], t[1], t[2]); rig.mode = 'follow'; rig.yaw = t[2]; rig.snap();
  };
  const dbg = new Debug({ teleport, toggle });

  const keys = driver.keys;
  addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (e.code === 'KeyF') toggle('fly'); if (e.code === 'KeyO') toggle('overview'); if (e.code === 'KeyC') toggle('contour'); if (e.code === 'KeyH') toggle('hide'); if (e.code === 'KeyP') toggle('anchors');
    if (/^Digit[0-9]$/.test(e.code)) { const n = +e.code.slice(5) || 10; const z = ZONES.find((q) => q.num === n); if (z) teleport(z.id); }
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

  const clock = new THREE.Clock();
  const focus = new THREE.Vector3();
  let shadowWide = false;
  const setShadow = (wide: boolean) => {
    if (wide === shadowWide) return; shadowWide = wide;
    const S = wide ? 430 : 70, c = sun.shadow.camera; c.left = -S; c.right = S; c.top = S; c.bottom = -S; c.far = wide ? 1600 : 420; c.updateProjectionMatrix();
  };
  let frames = 0; const prof = { drive: 0, world: 0, render: 0, dbg: 0, n: 0 };
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const frame = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    let tq = performance.now(); const lap = (k: 'drive' | 'world' | 'render' | 'dbg') => { const n = performance.now(); prof[k] += n - tq; tq = n; };
    driver.update(dt, rig.mode === 'follow');
    rig.update(dt, rover.root.position, driver.heading, driver.speed, keys);
    lap('drive');
    world.update(dt, clock.elapsedTime, camera);
    dust.update(dt, rover.root, driver.speed, driver.surface, driver.heading);
    lap('world');
    if (rig.mode === 'follow') focus.copy(rover.root.position); else if (rig.mode === 'overview') focus.set(0, 40, 0);
    else { focus.copy(camera.position); const d = new THREE.Vector3(); camera.getWorldDirection(d); focus.addScaledVector(d, 70); }
    setShadow(rig.mode === 'overview' || (rig.mode === 'locked' && camera.position.y - hf.at(camera.position.x, camera.position.z) > 140));
    const s = shadowWide ? 700 : 260;
    // snap the shadow frustum to texels to avoid swimming
    sun.target.position.copy(focus); sun.position.copy(focus).addScaledVector(SUN_DIR, s);
    renderer.render(scene, camera);
    lap('render');
    const zone = ZONES.reduce((b, z) => (Math.hypot(z.x - driver.x, z.z - driver.z) < Math.hypot(b.x - driver.x, b.z - driver.z) ? z : b));
    dbg.update(dt, renderer, `${zone.name}<br>${driver.x.toFixed(0)}, ${driver.z.toFixed(0)} · elev ${(rover.root.position.y).toFixed(1)} m · ${driver.surface}<br>${Math.abs(driver.speed).toFixed(1)} m/s`);
    lap('dbg'); prof.n++;
    frames++;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  document.getElementById('loading')!.style.opacity = '0';
  setTimeout(() => document.getElementById('loading')!.remove(), 700);

  (window as any).__basin = {
    ready: true, hf, driver, rig, renderer, scene, camera, tHF, terrain, anchors,
    teleport, toggle,
    setView(p: number[], l: number[], fov = 50) { rig.mode = 'locked'; rig.locked.pos.set(p[0], p[1], p[2]); rig.locked.look.set(l[0], l[1], l[2]); camera.fov = fov; camera.updateProjectionMatrix(); },
    follow() { rig.mode = 'follow'; camera.fov = 50; camera.updateProjectionMatrix(); rig.snap(); },
    placeRover(x: number, z: number, h: number) { driver.teleport(x, z, h); },
    stats() { const i = renderer.info; const p = Object.fromEntries(Object.entries(prof).map(([k, v]) => [k, k === 'n' ? v : +(v / Math.max(1, prof.n)).toFixed(2)])); prof.drive = prof.world = prof.render = prof.dbg = prof.n = 0; return { fps: dbg.fps(), calls: i.render.calls, tris: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, frames, cpu: p }; },
    frames: () => frames,
    /** Synchronous benchmark: n renders each forced to completion (1 px readback). Returns ms per frame. */
    bench(n = 30) {
      const px = new Uint8Array(4); const ts: number[] = [];
      for (let i = 0; i < n + 3; i++) { const t0 = performance.now(); renderer.render(scene, camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); if (i >= 3) ts.push(performance.now() - t0); }
      ts.sort((a, b) => a - b); const i = renderer.info;
      return { median: +ts[Math.floor(ts.length / 2)].toFixed(2), p90: +ts[Math.floor(ts.length * 0.9)].toFixed(2), calls: i.render.calls, tris: i.render.triangles };
    },
  };
}
boot();
