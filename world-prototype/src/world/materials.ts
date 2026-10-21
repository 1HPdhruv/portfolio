import * as THREE from 'three';
import { NOISE_GLSL } from '../glsl';

/**
 * One coherent material language for every structure in the Basin.
 * All materials share a weathering patch: world-space grime, rain streaks on walls,
 * optional panel seams / corrugation, and ground-splash dirt baked per vertex (aDirt).
 */
export interface WeatherOpts { grime?: number; streak?: number; seam?: number; corrugate?: boolean; hazard?: boolean; dirtCol?: string; }

export function weathered(params: THREE.MeshStandardMaterialParameters, o: WeatherOpts = {}) {
  const m = new THREE.MeshStandardMaterial(params);
  const u = {
    uGrime: { value: o.grime ?? 0.6 }, uStreak: { value: o.streak ?? 0.5 }, uSeam: { value: o.seam ?? 0 },
    uDirtCol: { value: new THREE.Color(o.dirtCol ?? '#3a3127') },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aDirt; varying float vDirt; varying vec3 vWPos; varying vec3 vWN;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wp4 = vec4(transformed, 1.0); vec3 wn3 = objectNormal;
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4; wn3 = mat3(instanceMatrix) * wn3;
        #endif
        vWPos = (modelMatrix * wp4).xyz; vWN = normalize(mat3(modelMatrix) * wn3); vDirt = aDirt;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vDirt; varying vec3 vWPos; varying vec3 vWN;
        uniform float uGrime; uniform float uStreak; uniform float uSeam; uniform vec3 uDirtCol;
        ${NOISE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 wn = normalize(vWN); vec3 wp = vWPos;
          float wall = 1. - abs(wn.y);
          float along = dot(wp.xz, vec2(wn.z, -wn.x));
          float g = fbm2(vec2(along, wp.y) * .45 + wp.xz * .08);
          float n = vnoise(vec2(along, wp.y) * 6.);
          vec2 sc = vec2(along * 2.6, wp.y * .32);
          float st = vnoise(sc) * smoothstep(.35, .95, vnoise(vec2(along * .7, 5.)));
          ${o.hazard ? `float hz = step(.5, fract((wp.x + wp.y + wp.z) * 1.6)); diffuseColor.rgb = mix(vec3(.05,.05,.05), vec3(1.,.416,.169), hz);` : ''}
          diffuseColor.rgb *= 1. - uGrime * (.28 * g + .1 * n) - uStreak * st * .3 * wall;
          diffuseColor.rgb = mix(diffuseColor.rgb, uDirtCol, clamp(vDirt, 0., 1.) * .6);
          if (uSeam > 0.) {
            float s1 = abs(fract(along / uSeam + .5) - .5) * uSeam;
            float s2 = abs(fract(wp.y / (uSeam * 2.4) + .5) - .5) * uSeam * 2.4;
            float l = 1. - smoothstep(.0, .02, min(s1, s2));
            diffuseColor.rgb *= 1. - l * .4 * wall;
          }
        }`);
    if (o.corrugate) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 wn = normalize(vWN);
          if (abs(wn.y) < .6) {
            vec3 T = normalize(vec3(wn.z, 0., -wn.x));
            float a = dot(vWPos.xz, vec2(wn.z, -wn.x)) * 6.2831 / .076;
            normal = normalize(normal + mat3(viewMatrix) * T * cos(a) * .32);
          }
        }`);
    }
  };
  m.customProgramCacheKey = () => `weather-${o.corrugate ? 1 : 0}${o.hazard ? 1 : 0}`;
  return m;
}

function emissive(color: string, emissiveColor: string, intensity: number) {
  return new THREE.MeshStandardMaterial({ color, emissive: emissiveColor, emissiveIntensity: intensity, roughness: 0.5 });
}

export const M = {
  concrete: weathered({ color: '#8f8c85', roughness: 0.92 }, { grime: 0.7, streak: 0.8, seam: 1.2 }),
  concreteDark: weathered({ color: '#66645e', roughness: 0.93 }, { grime: 0.7, streak: 0.6 }),
  concreteSmooth: weathered({ color: '#a19e96', roughness: 0.82 }, { grime: 0.35, streak: 0.45, seam: 2.4 }),
  panelWhite: weathered({ color: '#d2cec3', roughness: 0.6, metalness: 0.1 }, { grime: 0.45, streak: 0.7, seam: 1.2 }),
  panelGrey: weathered({ color: '#6c7470', roughness: 0.62, metalness: 0.2 }, { grime: 0.5, streak: 0.6, seam: 1.2 }),
  panelInk: weathered({ color: '#36423b', roughness: 0.66, metalness: 0.15 }, { grime: 0.4, streak: 0.5, seam: 1.2 }),
  corrugated: weathered({ color: '#8a8f8b', roughness: 0.55, metalness: 0.55 }, { grime: 0.55, streak: 0.9, corrugate: true }),
  corrugatedInk: weathered({ color: '#3d4943', roughness: 0.6, metalness: 0.4 }, { grime: 0.45, streak: 0.8, corrugate: true }),
  galv: weathered({ color: '#a2a7a7', roughness: 0.48, metalness: 0.75 }, { grime: 0.5, streak: 0.4 }),
  steelDark: weathered({ color: '#2f3334', roughness: 0.6, metalness: 0.5 }, { grime: 0.4, streak: 0.3 }),
  steelPaint: weathered({ color: '#5b625f', roughness: 0.6, metalness: 0.3 }, { grime: 0.5, streak: 0.4 }),
  rubber: new THREE.MeshStandardMaterial({ color: '#141515', roughness: 0.95 }),
  plastic: weathered({ color: '#2a2f31', roughness: 0.7, metalness: 0.05 }, { grime: 0.3, streak: 0.1 }),
  caseDark: weathered({ color: '#2b3033', roughness: 0.68, metalness: 0.1 }, { grime: 0.35, streak: 0.1 }),
  caseOlive: weathered({ color: '#4a5240', roughness: 0.7, metalness: 0.1 }, { grime: 0.35, streak: 0.1 }),
  wood: weathered({ color: '#6e5c46', roughness: 0.9 }, { grime: 0.7, streak: 0.5 }),
  woodDark: weathered({ color: '#4a3d2f', roughness: 0.92 }, { grime: 0.6, streak: 0.4 }),
  tarp: weathered({ color: '#55574a', roughness: 0.95 }, { grime: 0.5, streak: 0.2 }),
  orange: weathered({ color: '#ff6a2b', roughness: 0.6 }, { grime: 0.25, streak: 0.1 }),
  hazard: weathered({ color: '#ffffff', roughness: 0.65 }, { grime: 0.45, streak: 0.2, hazard: true }),
  chalkPaint: weathered({ color: '#d9d4c4', roughness: 0.7 }, { grime: 0.5, streak: 0.3 }),
  brass: new THREE.MeshStandardMaterial({ color: '#c9a44a', roughness: 0.32, metalness: 0.95 }),
  glass: new THREE.MeshStandardMaterial({ color: '#0d1316', roughness: 0.08, metalness: 0.6 }),
  solar: new THREE.MeshStandardMaterial({ color: '#141c26', roughness: 0.18, metalness: 0.55 }),
  hedge: weathered({ color: '#4a6338', roughness: 0.95 }, { grime: 0.75, streak: 0 }),
  crop: new THREE.MeshStandardMaterial({ color: '#4f6b34', roughness: 0.85, side: THREE.DoubleSide }),
  // light sources (practicals). Warm only.
  lamp: emissive('#ffe7c4', '#ffc27a', 3.2),
  window: emissive('#3a2a18', '#ffc27a', 1.25),
  screen: emissive('#1a1f1c', '#d6e2d2', 0.55),
  screenWarm: emissive('#1f1a14', '#ffc27a', 0.7),
  beacon: emissive('#ff6a2b', '#ff6a2b', 2.0),
  ledAmber: emissive('#3a2510', '#ffb050', 2.2),
};

/** Interior "cards": painted lit interiors seen through windows (desk, lamp, shelves). Cheap, readable at distance. */
const cardCache = new Map<string, THREE.Material>();
export function interiorCard(kind: 'desk' | 'racks' | 'workshop' | 'plain'): THREE.Material {
  if (cardCache.has(kind)) return cardCache.get(kind)!;
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(150, 30, 10, 128, 64, 190); grad.addColorStop(0, '#ffd9a0'); grad.addColorStop(0.5, '#b07a3c'); grad.addColorStop(1, '#3a2614');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 128);
  g.fillStyle = 'rgba(25,18,10,.85)';
  if (kind === 'desk') { g.fillRect(20, 84, 150, 8); g.fillRect(30, 92, 6, 36); g.fillRect(150, 92, 6, 36); g.fillRect(70, 52, 50, 32); g.fillStyle = 'rgba(214,226,210,.8)'; g.fillRect(74, 56, 42, 22); g.fillStyle = 'rgba(25,18,10,.85)'; g.fillRect(190, 20, 50, 108); for (let y = 30; y < 128; y += 22) g.fillRect(190, y, 50, 3); g.fillRect(140, 30, 4, 54); g.beginPath(); g.moveTo(130, 30); g.lineTo(160, 30); g.lineTo(150, 18); g.fill(); }
  if (kind === 'racks') { for (let x = 10; x < 256; x += 48) { g.fillRect(x, 10, 34, 118); g.fillStyle = 'rgba(255,190,120,.7)'; for (let y = 20; y < 120; y += 9) g.fillRect(x + 4, y, 3, 2); g.fillStyle = 'rgba(25,18,10,.85)'; } }
  if (kind === 'workshop') { g.fillRect(0, 80, 256, 10); g.fillRect(20, 30, 90, 4); for (let i = 0; i < 9; i++) g.fillRect(24 + i * 10, 34, 3, 14 + (i % 3) * 6); g.fillRect(160, 50, 60, 30); }
  // blinds
  g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < 128; y += 6) g.fillRect(0, y, 256, 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.3 });
  cardCache.set(kind, m); return m;
}

/** Stencilled signage: mono capitals, ink on chalk (or reverse). */
export function signTexture(lines: string[], o: { w?: number; h?: number; bg?: string; fg?: string; font?: string; accent?: boolean; size?: number } = {}) {
  const W = o.w ?? 512, H = o.h ?? 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')!;
  g.fillStyle = o.bg ?? '#d9d4c4'; g.fillRect(0, 0, W, H);
  // wear
  let s = lines.join('').length * 977 + 13; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(60,50,40,${r() * 0.08})`; g.fillRect(r() * W, r() * H, 2 + r() * 20, 1 + r() * 3); }
  g.fillStyle = o.fg ?? '#16201b';
  const base = o.size ?? Math.min(H / (lines.length + 0.6), 80);
  g.textBaseline = 'middle';
  lines.forEach((l, i) => {
    let fs = i === 0 ? base : base * 0.62;
    const mk = () => o.font ?? `${i === 0 ? 600 : 500} ${fs}px "IBM Plex Mono", ui-monospace, Menlo, monospace`;
    g.font = mk();
    while (g.measureText(l).width > W * 0.88 && fs > 8) { fs *= 0.92; g.font = o.font ? o.font.replace(/\d+px/, `${Math.round(fs)}px`) : mk(); }
    g.fillText(l, W * 0.06, H * ((i + 0.75) / (lines.length + 0.5)));
  });
  if (o.accent !== false) { g.fillStyle = '#ff6a2b'; g.fillRect(W * 0.06, H - H * 0.1, W * 0.18, H * 0.035); }
  g.strokeStyle = 'rgba(22,32,27,.6)'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
