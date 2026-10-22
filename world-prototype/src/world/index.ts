import * as THREE from 'three';
import type { Heightfield } from '../heightfield';
import { type Builder, updateDistanceCulling, mergeWorldStatic } from './kit';
import { buildInit, buildFieldOffice, buildSignalTower } from './rim';
import { buildBay, buildAgentOps, buildWorkshop } from './east';
import { buildTerraces, buildProving, buildLocalMinimum, buildMaze } from './west';
import { buildStrata, buildResearch } from './floor';
import { buildWatershed } from './watershed';
import { buildRoads, buildCulverts } from './roads';
import { buildVegetation } from './veg';
import { PADS } from '../layout';
import { devLog } from '../devlog';

/** Builds every zone in a fixed order. Yields to the event loop between zones so the page (which shares this
 *  main thread when embedded same-origin) stays responsive; order and output are identical to a synchronous build. */
export async function buildWorld(scene: THREE.Scene, hf: Heightfield) {
  const root = new THREE.Group(); root.name = 'world'; scene.add(root);
  const builders: Builder[] = [];
  const t0 = performance.now();
  const at = (id: string): [number, number] => { const p = PADS.find((q) => q.id === id)!; return [p.x, p.z]; };
  const steps: [string, () => Builder][] = [
    ['init', () => buildInit(hf, root)],
    ['office', () => buildFieldOffice(hf, root)],
    ['tower', () => buildSignalTower(hf, root, [at('agent-ops'), at('research')])],
    ['bay', () => buildBay(hf, root)],
    ['agentops', () => buildAgentOps(hf, root, at('signal-tower'))],
    ['workshop', () => buildWorkshop(hf, root)],
    ['terraces', () => buildTerraces(hf, root)],
    ['proving', () => buildProving(hf, root)],
    ['localmin', () => buildLocalMinimum(hf, root)],
    ['maze', () => buildMaze(hf, root)],
    ['strata', () => buildStrata(hf, root)],
    ['research', () => buildResearch(hf, root)],
    ['watershed', () => buildWatershed(hf, root)],
    ['roads', () => buildRoads(hf, root)],
    ['culverts', () => buildCulverts(hf, root).b],
    ['vegetation', () => buildVegetation(hf, root)],
  ];
  const timing: string[] = [];
  for (const [name, fn] of steps) {
    await new Promise((r) => setTimeout(r, 0));
    const t = performance.now();
    try { builders.push(fn()); } catch (e) { console.error('zone failed:', name, e); }
    timing.push(`${name} ${(performance.now() - t).toFixed(0)}`);
  }
  const mg = mergeWorldStatic(root);
  devLog('world built in', (performance.now() - t0).toFixed(0), 'ms ·', timing.join(' · '), `· static meshes ${mg.before} -> ${mg.after}`);
  return {
    root,
    update: (dt: number, t: number, cam: THREE.Camera) => { for (const b of builders) for (const u of b.updaters) u(dt, t); updateDistanceCulling(cam.position); },
  };
}
