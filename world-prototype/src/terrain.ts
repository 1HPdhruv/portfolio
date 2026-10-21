import * as THREE from 'three';
import { Heightfield, NX, NZ, X0, Z0, plateauHeight, uplandVeg } from './heightfield';
import { NOISE_GLSL } from './glsl';


const CS = 100;

export function buildTerrain(hf: Heightfield) {
  const splat = new THREE.DataTexture(hf.splat, NX, NZ, THREE.RGBAFormat, THREE.UnsignedByteType);
  const splat2 = new THREE.DataTexture(hf.splat2, NX, NZ, THREE.RGBAFormat, THREE.UnsignedByteType);
  const splat3 = new THREE.DataTexture(hf.splat3, NX, NZ, THREE.RGBAFormat, THREE.UnsignedByteType);
  const splat4 = new THREE.DataTexture(hf.splat4, NX, NZ, THREE.RGBAFormat, THREE.UnsignedByteType);
  for (const t of [splat, splat2, splat3, splat4]) {
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
  }
  const uniforms = {
    uSplat: { value: splat }, uSplat2: { value: splat2 }, uSplat3: { value: splat3 }, uSplat4: { value: splat4 },
    uOrg: { value: new THREE.Vector2(X0, Z0) }, uDim: { value: new THREE.Vector2(NX, NZ) },
    uMode: { value: 0 },
  };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWN; attribute vec2 aVeg; varying vec2 vVeg;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix*vec4(position,1.)).xyz; vWN = normalize(mat3(modelMatrix)*normal); vVeg = aVeg;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWPos; varying vec3 vWN; varying vec2 vVeg;
uniform sampler2D uSplat; uniform sampler2D uSplat2; uniform sampler2D uSplat3; uniform sampler2D uSplat4; uniform vec2 uOrg; uniform vec2 uDim; uniform float uMode;
vec3 gNb; float gRough; float gEmit; float gStrata;
${NOISE_GLSL}
float lineAA(float h, float sp, float px){ float w = max(fwidth(h), 1e-4); float d = abs(fract(h/sp+.5)-.5)*sp; return 1.-smoothstep(px*w*.5, px*w*1.5, d); }
`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 N = normalize(vWN);
  vec2 q = vWPos.xz; float hgt = vWPos.y;
  vec2 suv = (q - uOrg + 0.5) / uDim; gStrata = 0.;
  vec4 sp = texture2D(uSplat, suv); vec4 sp2 = texture2D(uSplat2, suv); vec4 sp3 = texture2D(uSplat3, suv); vec4 sp4 = texture2D(uSplat4, suv);
  // outside the surveyed grid (outer upland): no painted features, natural cover only
  float inside = step(0., suv.x) * step(suv.x, 1.) * step(0., suv.y) * step(suv.y, 1.);
  if (inside < .5) { sp4 = vec4(0.); sp = vec4(0.); sp2 = vec4(0., .5, 0., 0.); sp3 = vec4(vVeg.x, vVeg.y, 0., 0.); }
  // the survey (contour marks) covers the Basin only, fading out before the playable edge
  vec2 eu = min(suv, 1. - suv) * uDim; float survey = inside * smoothstep(10., 60., min(eu.x, eu.y));
  float cavity = max(sp2.g - .5, 0.) * 2., convex = max(.5 - sp2.g, 0.) * 2.;
  float slope = 1. - N.y;
  // fine noise is projected on the dominant plane so cut faces do not smear vertically
  vec2 rq = abs(N.x) > abs(N.z) ? vec2(vWPos.z, vWPos.y) : vec2(vWPos.x, vWPos.y);
  float tp = smoothstep(.22, .42, slope);
  float nL = fbm2(q*.012), nM = fbm3(q*.09);
  mat2 rotm = mat2(.8,-.6,.6,.8);
  float nS = mix(vnoise(q*1.3), vnoise(rotm*rq*.9), tp), nF = mix(vnoise(q*5.), vnoise(rotm*rq*2.7), tp);
  // ---- ground: soil <-> ink-green scrub
  // base cover is dry upland grass (straw / olive-grey); bare soil shows through in patches
  vec3 straw = mix(vec3(.29,.29,.20), vec3(.40,.38,.26), nM) * (.86 + .22*nS) * (.94 + .1*nF);
  vec3 bare = mix(vec3(.25,.22,.17), vec3(.36,.32,.25), nS);
  float camNear = 1. - smoothstep(25., 90., length(vWPos - cameraPosition));
  vec2 sq2 = mat2(.94, .34, -.34, .94) * q;
  float blades = vnoise(sq2 * vec2(14., 2.2)) * vnoise(sq2 * vec2(5., 1.1) + 3.);
  straw *= 1. + (blades - .25) * .55 * camNear;
  vec3 soil = mix(bare, straw, smoothstep(.32, .6, nL + .3*nM - slope*1.5));
  // vegetation density is baked on the CPU (shared with the instanced plants) and broken up here
  float veg = smoothstep(.1, .55, sp3.r + (nM - .5) * .35) * (1. - smoothstep(.2, .34, slope));
  float lush = sp3.g;
  vec3 grass = mix(vec3(.16,.19,.11), vec3(.24,.26,.15), nM);
  grass = mix(grass, vec3(.09,.14,.08), lush * .8) * (.85 + .3*nS);
  vec3 col = mix(soil, grass, veg);
  col *= mix(1., .72, smoothstep(30., 0., hgt)*.6);
  // ---- rock: faulted sedimentary beds of irregular thickness, massive sandstone in places,
  //      broken partings, varnish streaks. One geological language, never a regular stripe.
  float fcoord = dot(q, vec2(.83, .55)) / 42. + vnoise(q * .012) * 1.3;
  float fid = floor(fcoord);
  float throwv = (hash21(vec2(fid, 2.)) - .5) * 8.;
  float ly = hgt + throwv + dot(q, vec2(.035, -.02)) + vnoise(q * .03) * 2.4;
  float lw = ly / 3.6 + .5 * vnoise(vec2(ly * .09, 3.)) + .3 * sin(ly * .23);
  float lid = floor(lw), lf = fract(lw);
  float sel = hash21(vec2(lid, 3.));
  vec3 band = sel<.25 ? vec3(.38,.36,.33) : sel<.47 ? vec3(.26,.25,.235) : sel<.66 ? vec3(.47,.44,.39) : sel<.84 ? vec3(.21,.205,.19) : vec3(.43,.35,.27);
  float massive = smoothstep(.42, .68, vnoise(q * .0065 + 9.));
  vec3 rock = mix(mix(vec3(.32,.31,.29), band, .55), vec3(.36,.34,.31) * (.86 + .28*nM), massive);
  float parting = smoothstep(.86, 1., lf) * step(.38, vnoise(vec2(rq.x * .12, lid * 1.7)));
  float varnish = vnoise(vec2(rq.x * .9, rq.y * .07));
  rock *= (.8 + .4*nS) * (1. - .34 * parting * (1. - massive)) * (.84 + .24 * varnish);
  float rockM = smoothstep(.2, .36, slope + (nM-.5)*.08);
  rockM = max(rockM, convex * smoothstep(.07, .2, slope) * .85);       // outcrops break through on convex ground
  rockM = max(rockM, smoothstep(.05, .3, sp2.a) * (1. - smoothstep(.45, .65, sp2.a)) * smoothstep(.25, .45, slope)); // cap-rock ledges
  // ---- talus: gully floors and the scree fans they build, plus loose ground at the foot of steep slopes
  float gully = sp3.b, fanM = sp3.a;
  vec3 scree = mix(vec3(.40,.37,.33), vec3(.27,.25,.23), nS) * (.84 + .3*nF);
  col = mix(col, scree, smoothstep(.13,.21,slope + (nS-.5)*.05)*(1.-rockM)*.55);
  // gully floors: shaded, damp, finer debris; fans: pale, coarse, fresh
  col = mix(col, vec3(.25,.24,.22) * (.8 + .35*nF), gully * .6);
  vec3 fanCol = mix(vec3(.47,.44,.39), vec3(.36,.34,.30), nF) * (.9 + .2*nS);
  col = mix(col, fanCol, fanM * .7 * (1. - gully));
  // dry-stone retaining walls on the terrace risers
  float terr = sp2.b;
  if (terr > .01) {
    vec2 sq = vec2(abs(N.x) > abs(N.z) ? vWPos.z : vWPos.x, vWPos.y) * vec2(2.2, 3.6);
    sq.x += floor(sq.y) * .5;
    vec2 cell = floor(sq), fq = fract(sq);
    float mortar = smoothstep(.0, .1, min(min(fq.x, 1.-fq.x)*1.6, min(fq.y, 1.-fq.y)));
    vec3 stone = mix(vec3(.42,.38,.31), vec3(.58,.53,.44), hash21(cell)) * (.72 + .28*mortar);
    stone = mix(stone, grass * 1.1, .65 + .3*smoothstep(.4, .8, nM));
    float riser = smoothstep(.12, .3, slope);
    col = mix(col, rock, rockM * (1. - terr));
    col = mix(col, stone, riser * terr);
  }
  else col = mix(col, rock, rockM);
  // The Strata: a faulted, dipping sedimentary sequence. Beds vary in thickness, pinch out laterally,
  // step across small faults, and weather back (soft) or stand out as ledges (hard).
  float strataM = smoothstep(.45, .65, sp2.a) * smoothstep(.22, .45, slope);
  if (strataM > .01) {
    float along = rq.x;                                   // horizontal distance along the face
    float fpos = along + hgt * .32;                       // fault planes dip steeply: traces are slanted
    float blk = floor(fpos / 17. + vnoise(vec2(fpos * .02, 1.)) * .9);
    float offs = (hash21(vec2(blk, 13.)) - .5) * 2.6;     // fault throw per block
    float ly = hgt + offs + along * .055 + vnoise(vec2(along * .03, hgt * .05)) * 1.1;   // dip + warp
    // non-uniform bed thickness: a monotone warp of the stratigraphic coordinate
    float sc = ly * .52 + 1.6 * vnoise(vec2(ly * .11, 4.)) + .7 * vnoise(vec2(ly * .37, 9.));
    float id2 = floor(sc), f2 = fract(sc);
    float s2 = hash21(vec2(id2, 11.));
    vec3 bed = s2<.18 ? vec3(.57,.52,.43) : s2<.36 ? vec3(.39,.37,.34) : s2<.48 ? vec3(.20,.19,.18) : s2<.62 ? vec3(.48,.37,.27) : s2<.8 ? vec3(.63,.59,.50) : vec3(.31,.30,.28);
    float lum = dot(bed, vec3(.3,.59,.11)); bed = mix(bed, vec3(lum), .3);
    float hard = step(.55, hash21(vec2(id2, 7.)));
    // partings are discontinuous: they pinch out along the face
    float pw = max(fwidth(sc) * 1.5, .06);                // never thinner than ~1.5 px: no dashed aliasing
    float parting = smoothstep(1. - pw * 2., 1. - pw * .5, f2) * smoothstep(.35, .6, vnoise(vec2(along * .07, id2 * 2.3))) * (1. - smoothstep(.12, .3, pw));
    // vertical joints in hard beds; rills and varnish streaks run down the soft ones
    float joint = (1. - smoothstep(.0, .05, abs(fract(along * .19 + id2 * .37) - .5))) * hard * step(.45, vnoise(vec2(along * .4, id2)));
    float streak = vnoise(vec2(along * 2.2, hgt * .08));
    bed *= (.82 + .3*nS) * (1. - .45 * parting) * (1. - .3 * joint) * mix(.86 + .2 * streak, 1., hard);
    // block edges darken (fault traces)
    float fb = fract(fpos / 17. + vnoise(vec2(fpos * .02, 1.)) * .9) * 17.;
    bed *= 1. - .22 * (1. - smoothstep(.0, .5, min(fb, 17. - fb)));
    col = mix(col, bed, strataM);
    rockM = max(rockM, strataM);
    gStrata = strataM * smoothstep(.0, .18, f2) * smoothstep(1., .82, f2) * (hard * 1.4 - (1. - hard) * .45);
  }
  // ---- tilled field rows (Agri Terraces)
  float rows = .5 + .5*sin(q.x*2.9 + nM*2.2);
  vec3 tilled = mix(vec3(.13,.11,.08), vec3(.24,.20,.15), rows*.8 + nS*.2);
  col = mix(col, tilled, sp.a * (1.-rockM));
  // ---- hardstand: concrete (B>=128) or gravel (B<128)
  float bB = sp.b*255.;
  float conC = bB >= 127.5 ? (bB-128.)/127. : 0.;
  float grvC = bB >= 127.5 ? 0. : bB/127.;
  vec2 jq = q / 5.0; float joint = 1. - smoothstep(.0, .035, min(abs(fract(jq.x+.5)-.5), abs(fract(jq.y+.5)-.5)));
  vec3 conc = vec3(.47,.47,.45) * (.82 + .3*nL + .12*nS) * (1. - .18*joint) * (.92+.12*nF);
  vec3 grav = vec3(.41,.38,.33) * (.8 + .35*nF + .15*nS);
  col = mix(col, grav, clamp(grvC*1.4,0.,1.));
  col = mix(col, conc, clamp(conC*1.4,0.,1.));
  // ---- dirt track / road shoulder
  float trailM = sp.g * (1. - sp.r);
  float ruts = .5 + .5*sin(q.x*1.7 + q.y*.9);
  vec3 packed = vec3(.46,.39,.29) * (.82 + .3*nS) * (.94 + .1*ruts);
  col = mix(col, packed, trailM * (1. - rockM*.5));
  // ---- paved road: dark chip-seal with fine grain and oil stains
  vec3 asph = vec3(.16,.16,.165) * (.8 + .5*nS) * (.88 + .22*nF) * (1. - .25*smoothstep(.55,.8,nM));
  float roadPolish = 0.;
  if (sp4.g > .5) {
    float lat = sp4.r * 8.;
    // wheel tracks: polished, darker paths in each lane
    float trk = exp(-pow((lat - .95) / .38, 2.)) + exp(-pow((lat - 2.45) / .38, 2.));
    asph *= 1. - .16 * trk; roadPolish = trk;
    // patched asphalt: newer, darker rectangles where the surface has been repaired
    vec2 pc = floor((q + vec2(1.3, 2.1)) / vec2(2.7, 4.3));
    float patchM = step(.965, hash21(pc)) * step(lat, 2.9);
    asph = mix(asph, vec3(.12,.122,.128) * (.9 + .2*nF), patchM * .55);
    // edge break-up: cracks and wind-blown dirt collect toward the shoulders
    float edgeZ = smoothstep(2.5, 3.4, lat);
    float crack = (1. - smoothstep(.0, .06, abs(vnoise(q * .9) - .5))) * edgeZ;
    asph *= 1. - .35 * crack;
    asph = mix(asph, vec3(.36,.31,.24) * (.8 + .3*nS), edgeZ * smoothstep(.35, .7, nM + .2*nS) * .55);
  }
  col = mix(col, asph, sp.r);
  // ditch floors in cuttings: damp, darker silt
  col = mix(col, col * vec3(.62,.6,.56), sp4.b * (1. - sp.r));
  // ---- damp banks along the Watershed, baked cavity occlusion
  col *= mix(1., .55, sp2.r);
  col = mix(col, col*vec3(.8,.95,.92), sp2.r*.5);
  col *= mix(1., .55, cavity);
  col *= 1. + .1 * convex;
  // ---- survey contours: chalk survey marks painted on the ground
  float wH = max(fwidth(hgt), 1e-4);
  float aMin = lineAA(hgt, 2.5, 1.0) * smoothstep(5., 12., 2.5/wH);
  float aMaj = lineAA(hgt, 12.5, 1.6) * smoothstep(4., 9., 12.5/wH);
  float camD = length(vWPos - cameraPosition);
  float near = 1. - smoothstep(70., 210., camD);
  float ground = (1. - sp.r) * (1. - clamp(conC + grvC, 0., 1.)) * (1. - sp2.r) * (1. - sp.a*.6) * (1. - smoothstep(.12, .3, slope)) * survey;
  col *= 1. - aMin * .16 * ground * near;
  col = mix(col, vec3(.80,.77,.66)*.7, aMaj * .24 * ground * near);
  gRough = mix(.96, .86, rockM); gRough = mix(gRough, .78, clamp(conC,0.,1.)); gRough = mix(gRough, .82 - .14 * roadPolish, sp.r);
  gEmit = 0.;
  if (uMode > .5) {
    aMin = lineAA(hgt, 2.5, 1.0) * smoothstep(3., 8., 2.5/wH); aMaj = lineAA(hgt, 12.5, 1.8);
    vec3 ramp = mix(vec3(.04,.09,.08), vec3(.80,.76,.62), clamp(hgt/105., 0., 1.));
    ramp = mix(ramp, vec3(.5,.62,.6), sp2.r);
    col = mix(ramp, vec3(.05,.06,.05), aMin*.5);
    col = mix(col, vec3(1.,.416,.169), aMaj);
    col = mix(col, vec3(.95), sp.r*.6);
    gRough = 1.;
  }
  // micro-relief bump (screen-space derivative of a height proxy)
  float hb = (nS*.6 + nF*.4) * mix(.10, .22, rockM) + nM*.12 + gStrata;
  vec3 dpx = dFdx(vWPos), dpy = dFdy(vWPos);
  float lim = .35 * max(length(dpx), length(dpy)); // clamp: discontinuities must not spike the normal
  float dhx = clamp(dFdx(hb), -lim, lim), dhy = clamp(dFdy(hb), -lim, lim);
  vec3 r1 = cross(dpy, N), r2 = cross(N, dpx); float det = dot(dpx, r1);
  gNb = normalize(abs(det)*N - sign(det)*(dhx*r1 + dhy*r2) * 0.55);
  diffuseColor.rgb = col;
}`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(mat3(viewMatrix) * gNb);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = gRough;');
  };
  mat.customProgramCacheKey = () => 'basin-terrain';

  const group = new THREE.Group(); group.name = 'terrain';
  // shared index
  const n = CS + 1, idx = new Uint16Array(CS * CS * 6);
  let k = 0;
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const a = z * n + x, b = a + 1, c = a + n, d = c + 1;
    if ((x + z) & 1) idx.set([a, c, b, b, c, d], k); else idx.set([a, c, d, a, d, b], k);
    k += 6;
  }
  const index = new THREE.BufferAttribute(idx, 1);
  for (let cz = 0; cz < (NZ - 1) / CS; cz++) for (let cx = 0; cx < (NX - 1) / CS; cx++) {
    const pos = new Float32Array(n * n * 3), nor = new Float32Array(n * n * 3);
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
      const ix = cx * CS + x, iz = cz * CS + z, o = (z * n + x) * 3, h = hf.h;
      pos[o] = X0 + ix; pos[o + 1] = (ix === 0 || iz === 0 || ix === NX - 1 || iz === NZ - 1) ? edgeH(X0 + ix, Z0 + iz) : h[iz * NX + ix]; pos[o + 2] = Z0 + iz;
      const hl = h[iz * NX + Math.max(ix - 1, 0)], hr = h[iz * NX + Math.min(ix + 1, NX - 1)];
      const hu = h[Math.max(iz - 1, 0) * NX + ix], hd = h[Math.min(iz + 1, NZ - 1) * NX + ix];
      const nx = hl - hr, nz = hu - hd, l = Math.hypot(nx, 2, nz);
      nor[o] = nx / l; nor[o + 1] = 2 / l; nor[o + 2] = nz / l;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setIndex(index);
    g.computeBoundingSphere(); g.computeBoundingBox();
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false;
    group.add(m);
  }
  // skirts on the four outer edges (terrain-coloured) guard against sub-metre cracks
  const skirt = (pts: [number, number][], ox: number, oz: number) => {
    const pos: number[] = [], nor: number[] = [], ind: number[] = [];
    pts.forEach(([x, z], i) => { const h = edgeH(x, z); pos.push(x, h, z, x, h - 30, z); nor.push(ox, 0.4, oz, ox, 0.4, oz); if (i) { const k = i * 2; ind.push(k - 2, k - 1, k, k, k - 1, k + 1); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(ind);
    const m = new THREE.Mesh(g, mat); group.add(m);
  };
  const xs = Array.from({ length: NX }, (_, i) => X0 + i), zs = Array.from({ length: NZ }, (_, i) => Z0 + i);
  skirt(xs.map((x) => [x, Z0]), 0, -1); skirt(xs.map((x) => [x, Z0 + NZ - 1]), 0, 1);
  skirt(zs.map((z) => [X0, z]), -1, 0); skirt(zs.map((z) => [X0 + NX - 1, z]), 1, 0);
  for (const m of buildFar(mat)) group.add(m);
  return { group, material: mat, uniforms };
}

// ------------------------------------------------------------------ distant terrain
// The playable grid is 1 m; beyond it the upland continues as two rings: 5 m out to ~200 m past the
// edge, then 50 m out to 4 km. Seams are exact: boundary vertices of the finer mesh lie on the coarser
// mesh's edges (geomorphed), normals are analytic, vegetation uses the same formula as inside.
const NEAR = { x: 500, z: 600, s: 5 }, FAR = { r: 4000, s: 50 };
/** Height along a lattice line, linearly interpolated between lattice points of spacing S. */
function linOnLattice(x: number, z: number, S: number) {
  const fx = x / S, fz = z / S;
  if (Math.abs(fx - Math.round(fx)) < 1e-6) { const z0 = Math.floor(fz) * S, t = (z - z0) / S; return plateauHeight(x, z0) * (1 - t) + plateauHeight(x, z0 + S) * t; }
  const x0 = Math.floor(fx) * S, t = (x - x0) / S; return plateauHeight(x0, z) * (1 - t) + plateauHeight(x0 + S, z) * t;
}
/** inner mesh boundary height: exactly the near ring's edge */
function edgeH(x: number, z: number) { return linOnLattice(x, z, NEAR.s); }
function farBilinear(x: number, z: number) {
  const S = FAR.s, x0 = Math.floor(x / S) * S, z0 = Math.floor(z / S) * S, tx = (x - x0) / S, tz = (z - z0) / S;
  const a = plateauHeight(x0, z0), b = plateauHeight(x0 + S, z0), c = plateauHeight(x0, z0 + S), d = plateauHeight(x0 + S, z0 + S);
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}
function analyticNormal(x: number, z: number, e: number): [number, number, number] {
  const hx = plateauHeight(x + e, z) - plateauHeight(x - e, z), hz = plateauHeight(x, z + e) - plateauHeight(x, z - e);
  const l = Math.hypot(hx, 2 * e, hz); return [-hx / l, 2 * e / l, -hz / l];
}
function ringMesh(S: number, ex: number, ez: number, hole: (cx: number, cz: number) => boolean, height: (x: number, z: number) => number, normalE: (x: number, z: number) => number) {
  const nx = Math.round((2 * ex) / S) + 1, nz = Math.round((2 * ez) / S) + 1;
  const pos = new Float32Array(nx * nz * 3), nor = new Float32Array(nx * nz * 3), veg = new Float32Array(nx * nz * 2), ind: number[] = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = -ex + i * S, z = -ez + j * S, o = j * nx + i, h = height(x, z), n = analyticNormal(x, z, normalE(x, z));
    pos.set([x, h, z], o * 3); nor.set(n, o * 3);
    veg.set([uplandVeg(x, z, h, Math.hypot(n[0], n[2]) / Math.max(n[1], 0.05)), 0.08], o * 2);
  }
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    if (hole(-ex + (i + 0.5) * S, -ez + (j + 0.5) * S)) continue;
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; ind.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('aVeg', new THREE.BufferAttribute(veg, 2)); g.setIndex(ind);
  g.computeBoundingSphere(); return g;
}
function buildFar(mat: THREE.Material) {
  const x1 = X0 + NX - 1, z1 = Z0 + NZ - 1;
  const near = ringMesh(NEAR.s, NEAR.x, NEAR.z,
    (cx, cz) => cx > X0 && cx < x1 && cz > Z0 && cz < z1,
    (x, z) => { const eo = Math.min(NEAR.x - Math.abs(x), NEAR.z - Math.abs(z)); const t = 1 - smooth(0, 60, eo); return plateauHeight(x, z) * (1 - t) + farBilinear(x, z) * t; },
    (x, z) => { const eo = Math.min(NEAR.x - Math.abs(x), NEAR.z - Math.abs(z)); return 1.5 + 8.5 * (1 - smooth(0, 60, eo)); });
  const far = ringMesh(FAR.s, FAR.r, FAR.r, (cx, cz) => Math.abs(cx) < NEAR.x && Math.abs(cz) < NEAR.z, (x, z) => plateauHeight(x, z), () => 10);
  const m1 = new THREE.Mesh(near, mat); m1.receiveShadow = true; m1.castShadow = true; m1.name = 'upland-near';
  const m2 = new THREE.Mesh(far, mat); m2.receiveShadow = true; m2.name = 'upland-far';
  return [m1, m2];
}
function smooth(a: number, b: number, x: number) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
