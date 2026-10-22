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
import { createEmbedBridge } from './bridge/embed';
import type { HeightfieldData } from './heightfield';

patchFog();

// ?embed=1 — running inside the portfolio page: debug UI and debug keys off (unless ?debug=1), bridge on.
const params = new URLSearchParams(location.search);
const EMBED = params.get('embed') === '1';
const DEBUG = !EMBED || params.get('debug') === '1';
const bridge = EMBED ? createEmbedBridge() : null;
if (EMBED) document.body.classList.add('embed');
if (!DEBUG) document.body.classList.add('no-debug');

let renderer: THREE.WebGLRenderer;
try {
  const probe = document.createElement('canvas');
  if (!probe.getContext('webgl2')) throw new Error('WebGL 2 is not available in this browser.');
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  bridge?.send({ type: 'error', code: 'webgl-unavailable', message: String((e as Error)?.message ?? e) });
  document.getElementById('loading')!.textContent = 'The 3D world needs WebGL 2, which is not available here.';
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); bridge?.send({ type: 'error', code: 'context-lost', message: 'The graphics context was lost.' }); });

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(HAZE, 0.0017);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.25, 9000);

/** Generate the heightfield in a worker (keeps the page responsive); fall back to the main thread if workers fail. */
function generateHeightfield(): Promise<{ hf: Heightfield; worker: boolean }> {
  return new Promise((resolve) => {
    const mainThread = () => { Heightfield.onStage = (stage, frac) => bridge?.send({ type: 'progress', stage, frac: frac * 0.8 }); resolve({ hf: new Heightfield(), worker: false }); };
    if (params.get('worker') === '0' || typeof Worker === 'undefined') { mainThread(); return; }
    let w: Worker;
    try { w = new Worker(new URL('./hf.worker.ts', import.meta.url), { type: 'module' }); } catch { mainThread(); return; }
    w.onmessage = (ev: MessageEvent) => {
      const m = ev.data as { type: string; stage?: string; frac?: number; data?: HeightfieldData; message?: string };
      if (m.type === 'progress') bridge?.send({ type: 'progress', stage: m.stage!, frac: m.frac! * 0.8 });
      else if (m.type === 'done') { w.terminate(); resolve({ hf: Heightfield.fromData(m.data!), worker: true }); }
      else { w.terminate(); console.warn('heightfield worker failed, using main thread:', m.message); mainThread(); }
    };
    w.onerror = (e) => { e.preventDefault(); w.terminate(); console.warn('heightfield worker error, using main thread'); mainThread(); };
    w.postMessage('go');
  });
}

async function boot() {
  const t0 = performance.now();
  const { hf, worker } = await generateHeightfield();
  const tHF = performance.now() - t0;
  bridge?.send({ type: 'progress', stage: 'scene', frac: 0.82 });
  await new Promise((r) => setTimeout(r, 0));
  const tScene0 = performance.now();
  const terrain = buildTerrain(hf);
  scene.add(terrain.group);
  scene.add(makeSky());
  const nz = new Noise(77); const farRidges = makeFarRidges((x, y) => nz.fbm(x, y, 4)); scene.add(farRidges);
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
  // embedded: open on the approved spawn composition (rover, the descent and the lit headframe in one frame)
  if (EMBED) { driver.teleport(14, -293, 0.05); rig.yaw = 0.05; rig.pitch = 0.42; rig.dist = 13; rig.snap(); }

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
  let inputEnabled = true, paused = false, reduced = false, nearSite: { zoneId: string; siteId: string } | null = null;
  const DRIVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
  addEventListener('keydown', (e) => {
    if (!inputEnabled) return;
    if (DRIVE_KEYS.has(e.code)) { keys.add(e.code); if (e.code.startsWith('Arrow')) e.preventDefault(); }
    else if (DEBUG && rig.mode === 'fly') keys.add(e.code); // fly mode also uses E/Q
    if (DEBUG) {
      if (e.code === 'KeyF') toggle('fly'); if (e.code === 'KeyO') toggle('overview'); if (e.code === 'KeyC') toggle('contour'); if (e.code === 'KeyH') toggle('hide'); if (e.code === 'KeyP') toggle('anchors');
      if (/^Digit[0-9]$/.test(e.code)) { const n = +e.code.slice(5) || 10; const z = ZONES.find((q) => q.num === n); if (z) teleport(z.id); }
    }
    if (bridge && !e.repeat) {
      // interaction key: E or Enter while near a site (never while free-flying, where E means "up")
      if ((e.code === 'KeyE' || e.code === 'Enter') && nearSite && rig.mode === 'follow') { e.preventDefault(); bridge.send({ type: 'interact', site: nearSite }); }
      else if (e.code === 'KeyQ' && rig.mode !== 'fly') bridge.send({ type: 'request', action: 'quick-view' });
      else if (e.code === 'KeyM') bridge.send({ type: 'request', action: 'navigator' });
      else if (e.code === 'Escape') { if (rig.mode === 'locked' && interior) setInterior(false); else bridge.send({ type: 'request', action: 'escape' }); }
    }
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

  // ---- interior view (Research Station sub-level) and underground culling
  const SH = { x: 10, z: 284, y: hf.at(10, 278) };
  const IY = SH.y - 30;
  let interior = false, underground = false;
  const setInterior = (on: boolean) => {
    if (on === interior) return;
    interior = on;
    if (on) { rig.mode = 'locked'; rig.locked.pos.set(SH.x + 3, IY + 1.9, SH.z + 6); rig.locked.look.set(SH.x, IY + 2.4, SH.z - 10); camera.fov = 62; }
    else { rig.mode = 'follow'; camera.fov = 50; rig.snap(); }
    camera.updateProjectionMatrix();
    bridge?.send({ type: 'view', mode: on ? 'interior' : 'surface' });
  };
  // everything except the interior is irrelevant while the camera is below ground: hide it (restored on exit)
  const interiorParts = new Set(world.root.children.filter((o) => o.name === 'research-interior' || o.name === 'research-interior-emissive'));
  const surfaceParts: THREE.Object3D[] = [terrain.group, farRidges, rover.root, dust.points, pins, ...world.root.children.filter((o) => !interiorParts.has(o))];
  const surfaceVis = new Map<THREE.Object3D, boolean>();
  const setUnderground = (u: boolean) => {
    if (u === underground) return;
    underground = u;
    if (u) for (const o of surfaceParts) { surfaceVis.set(o, o.visible); o.visible = false; }
    else for (const o of surfaceParts) o.visible = surfaceVis.get(o) ?? true;
  };

  bridge?.onMessage((m) => {
    if (m.type === 'teleport') { setInterior(false); teleport(m.zoneId); }
    else if (m.type === 'input') { inputEnabled = m.enabled; if (!m.enabled) keys.clear(); }
    else if (m.type === 'pause') { paused = m.paused; if (paused) keys.clear(); }
    else if (m.type === 'reduced-motion') { reduced = m.value; rig.reducedMotion = m.value; dust.points.visible = !m.value; }
    else if (m.type === 'view') setInterior(m.mode === 'interior');
  });
  if (EMBED && matchMedia('(prefers-reduced-motion: reduce)').matches) { reduced = true; rig.reducedMotion = true; dust.points.visible = false; }

  let lastZone = '';
  const proximity = () => {
    let best: typeof anchors[number] | null = null, bd = Infinity;
    if (rig.mode === 'follow') for (const a of anchors) { const d = Math.hypot(a.position[0] - driver.x, a.position[2] - driver.z); if (d < a.radius + 3 && d < bd) { bd = d; best = a; } }
    const next = best ? { zoneId: best.zoneId, siteId: best.siteId } : null;
    if ((next?.siteId ?? '') !== (nearSite?.siteId ?? '')) { nearSite = next; bridge?.send({ type: 'proximity', site: next }); }
  };

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
    if (paused) { requestAnimationFrame(frame); return; }
    let tq = performance.now(); const lap = (k: 'drive' | 'world' | 'render' | 'dbg') => { const n = performance.now(); prof[k] += n - tq; tq = n; };
    driver.update(dt, rig.mode === 'follow');
    rig.update(dt, rover.root.position, driver.heading, driver.speed, keys);
    lap('drive');
    world.update(reduced ? 0 : dt, reduced ? 0 : clock.elapsedTime, camera);
    if (!reduced) dust.update(dt, rover.root, driver.speed, driver.surface, driver.heading);
    setUnderground(camera.position.y < hf.at(camera.position.x, camera.position.z) - 3);
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
    if (bridge) { if (zone.id !== lastZone) { lastZone = zone.id; bridge.send({ type: 'zone', zoneId: zone.id }); } proximity(); }
    if (DEBUG) dbg.update(dt, renderer, `${zone.name}<br>${driver.x.toFixed(0)}, ${driver.z.toFixed(0)} · elev ${(rover.root.position.y).toFixed(1)} m · ${driver.surface}<br>${Math.abs(driver.speed).toFixed(1)} m/s`);
    lap('dbg'); prof.n++;
    frames++;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  const tScene = performance.now() - tScene0;
  bridge?.send({ type: 'ready', zones: ZONES.map((z) => ({ id: z.id, name: z.name, num: z.num })), anchors: anchors.map((a) => ({ zoneId: a.zoneId, siteId: a.siteId, label: a.label })), timings: { heightfieldMs: Math.round(tHF), sceneMs: Math.round(tScene), worker } });
  document.getElementById('loading')!.style.opacity = '0';
  setTimeout(() => document.getElementById('loading')!.remove(), 700);

  (window as any).__basin = {
    ready: true, hf, driver, rig, renderer, scene, camera, tHF, tScene, worker, terrain, anchors, setInterior, isUnderground: () => underground,
    teleport, toggle, zonesList: () => ZONES,
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
boot().catch((e) => {
  console.error(e);
  bridge?.send({ type: 'error', code: 'init-failed', message: String((e as Error)?.message ?? e) });
  const l = document.getElementById('loading'); if (l) l.textContent = 'The world failed to start.';
});
