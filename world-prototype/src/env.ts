import * as THREE from 'three';

// Palette (brief): orange #FF6A2B is the only loud colour; haze is cool grey-warm.
export const HAZE = new THREE.Color('#939ba1');
export const SUN_DIR = new THREE.Vector3(-0.66, 0.5, 0.56).normalize(); // late-afternoon SW sun, ~30 deg

/** Replace three's fog chunks with a height-aware exp2 fog: thicker in the basin, thinner on the rim. */
export function patchFog() {
  const C = THREE.ShaderChunk as Record<string, string>;
  C.fog_pars_vertex = `#ifdef USE_FOG\n varying float vFogDepth;\n varying float vFogWY;\n#endif`;
  C.fog_vertex = `#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vec4 fogWP = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    fogWP = instanceMatrix * fogWP;
  #endif
  vFogWY = ( modelMatrix * fogWP ).y;
#endif`;
  C.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying float vFogWY;
  uniform float fogDensity;
#endif`;
  C.fog_fragment = `#ifdef USE_FOG
  float fogMid = 0.5 * ( vFogWY + cameraPosition.y );
  float fogK = fogDensity * mix( 2.5, 0.32, smoothstep( -5.0, 125.0, fogMid ) );
  float fogFactor = 1.0 - exp( - fogK * fogK * vFogDepth * vFogDepth );
  fogFactor = max( fogFactor, 1.0 - exp( - pow( vFogDepth / 5200.0, 1.7 ) ) ); // aerial perspective at range
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`;
}

export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: SUN_DIR.clone() }, uHaze: { value: HAZE.clone() } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*p; gl_Position.z = gl_Position.w; }`,
    fragmentShader: `
      varying vec3 vDir; uniform vec3 uSun; uniform vec3 uHaze;
      float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
      float fb(vec2 p){ float s=0.,a=.5; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.1+vec2(7.,3.); a*=.5; } return s; }
      void main(){
        vec3 d = normalize(vDir);
        float up = clamp(d.y, -0.2, 1.0);
        vec3 zen = vec3(0.075, 0.12, 0.21);
        vec3 mid = vec3(0.27, 0.36, 0.48);
        float sd = max(dot(d, normalize(uSun)), 0.0);
        float az = max(dot(normalize(d.xz), normalize(uSun.xz)), 0.0);
        vec3 hor = mix(uHaze, vec3(0.86, 0.62, 0.42), pow(az, 3.0) * 0.75);
        vec3 col = mix(hor, mid, smoothstep(0.0, 0.26, up));
        col = mix(col, zen, smoothstep(0.2, 0.9, up));
        // warm dusk glow around the sun, widest near the horizon
        col += vec3(1.0, 0.5, 0.22) * pow(sd, 5.0) * 0.5 * (1.0 - smoothstep(0.0, 0.55, up));
        col += vec3(1.0, 0.72, 0.45) * pow(sd, 48.0) * 0.7;
        col += vec3(1.0, 0.9, 0.7) * smoothstep(0.9995, 0.99985, sd) * 4.0;
        // high stratified cloud, catching the low sun on its underside
        vec2 cp = d.xz / max(d.y + 0.12, 0.08) * 0.35;
        float cl = fb(cp * vec2(1.0, 2.6) + 3.0) ;
        float cm = smoothstep(0.52, 0.78, cl) * smoothstep(0.02, 0.2, up) * (1.0 - smoothstep(0.55, 0.9, up));
        vec3 ccol = mix(vec3(0.28, 0.30, 0.36), vec3(1.0, 0.62, 0.38), pow(sd, 2.0) * 0.9 + 0.1);
        col = mix(col, ccol, cm * 0.55);
        // below the horizon: fade to haze so the far ring never shows a hard edge
        col = mix(col, uHaze * 0.85, smoothstep(0.0, -0.18, d.y));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), mat);
  m.frustumCulled = false; m.renderOrder = -10;
  return m;
}

/** Distant ridgelines beyond the basin walls so the horizon is never a hard edge. */
export function makeFarRidges(noiseFn: (x: number, y: number) => number) {
  const g = new THREE.Group();
  const specs = [{ r: 7200, h: 900, c: '#949aa0', seed: 3 }, { r: 5600, h: 700, c: '#7c858b', seed: 9 }];
  for (const s of specs) {
    const seg = 260, pos: number[] = [], idx: number[] = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const n = noiseFn(Math.cos(a) * 1.7 + s.seed, Math.sin(a) * 1.7 + s.seed) * 0.5 + 0.5;
      const n2 = noiseFn(Math.cos(a) * 6.5 + s.seed, Math.sin(a) * 6.5) * 0.5 + 0.5;
      const top = s.h * (0.25 + 0.75 * n * n) + 60 * n2;
      pos.push(Math.cos(a) * s.r, -50, Math.sin(a) * s.r, Math.cos(a) * s.r, top, Math.sin(a) * s.r);
      if (i < seg) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: s.c, side: THREE.DoubleSide, fog: false }));
    m.frustumCulled = false; m.renderOrder = -5; g.add(m);
  }
  return g;
}

export function makeLights(scene: THREE.Scene) {
  const sun = new THREE.DirectionalLight('#ffd09c', 3.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const S = 70; Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 420 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.5; sun.shadow.radius = 2.2;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight('#8ea6c4', '#3a3a30', 1.0);
  scene.add(hemi);
  const fill = new THREE.DirectionalLight('#6f89b0', 0.7); // cool bounce from the opposite side
  fill.position.set(0.7, 0.55, -0.45);
  scene.add(fill);
  return { sun, hemi, fill };
}
