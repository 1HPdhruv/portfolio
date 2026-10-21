// Authoritative world layout. Everything that must agree between terrain carving,
// structure placement and the debug teleports lives here. 1 unit = 1 m. +x east, +z south, y up.
// North (-z) is the rim; south (+z) is the floor.

export interface PadDef {
  id: string; x: number; z: number; hw: number; hd: number; rot: number; fall: number;
  surface: 'concrete' | 'gravel' | 'field' | 'none';
  /** 0 = level pad, 1 = follows the natural slope */
  tilt?: number;
  h?: number; // override target height (default: base terrain height at centre)
}
export interface RoadDef {
  id: string; kind: 'main' | 'trail'; halfW: number; shoulder: number; pts: [number, number][];
}
export interface ZoneDef { id: string; name: string; num: number; x: number; z: number; face: number; band: 'rim' | 'slope' | 'floor'; /** teleport: x, z, heading */ tp?: [number, number, number]; }

export const BOUNDS = { x0: -300, x1: 300, z0: -400, z1: 400 };
export const FLOOR = { x: 0, z: 285 };

export const PADS: PadDef[] = [
  { id: 'rim-bench', x: -12, z: -298, hw: 40, hd: 12, rot: 0, fall: 46, surface: 'none' },
  { id: 'init', x: 14, z: -304, hw: 20, hd: 14, rot: 0, fall: 12, surface: 'concrete' },
  { id: 'field-office', x: -42, z: -290, hw: 14, hd: 11, rot: 0.15, fall: 10, surface: 'gravel' },
  { id: 'signal-tower', x: 92, z: -338, hw: 14, hd: 14, rot: 0, fall: 14, surface: 'gravel', h: 119 },
  { id: 'bay', x: 150, z: -70, hw: 18, hd: 15, rot: -0.2, fall: 22, surface: 'concrete' },
  { id: 'agent-ops', x: 148, z: 40, hw: 21, hd: 23, rot: 0.1, fall: 22, surface: 'gravel', h: 46 },
  { id: 'proving', x: -150, z: 10, hw: 26, hd: 20, rot: 0.1, fall: 24, surface: 'gravel' },
  { id: 'workshop', x: 84, z: 196, hw: 17, hd: 12, rot: 0.25, fall: 22, surface: 'gravel', h: 17 },
  { id: 'agri', x: -170, z: -129, hw: 8, hd: 6, rot: 0.2, fall: 5, surface: 'gravel' },
  { id: 'maze', x: -150, z: 200, hw: 25, hd: 25, rot: 0.1, fall: 20, surface: 'none', tilt: 0.8 },
  { id: 'research', x: 10, z: 278, hw: 34, hd: 30, rot: 0, fall: 24, surface: 'concrete' },
];

export const ROADS: RoadDef[] = [
  { id: 'main', kind: 'main', halfW: 3.4, shoulder: 9, pts: [[14, -289], [18, -272], [60, -240], [10, -205], [-40, -170], [10, -135], [60, -95], [20, -60], [-30, -25], [20, 10], [70, 45], [52, 80], [44, 106], [26, 130], [-4, 152], [24, 180], [52, 205], [30, 245], [12, 268]] },
  { id: 't-office', kind: 'trail', halfW: 2.2, shoulder: 5, pts: [[-6, -302], [-24, -296], [-42, -290]] },
  { id: 't-tower', kind: 'trail', halfW: 2.2, shoulder: 5, pts: [[34, -304], [62, -302], [96, -300], [120, -312], [112, -332], [96, -337]] },
  { id: 't-terraces', kind: 'trail', halfW: 2.0, shoulder: 5, pts: [[-40, -170], [-75, -172], [-110, -168], [-148, -150], [-164, -133]] },
  { id: 't-localmin', kind: 'trail', halfW: 1.4, shoulder: 4, pts: [[-100, -170], [-98, -158], [-95, -146]] },
  { id: 't-proving', kind: 'trail', halfW: 2.2, shoulder: 5, pts: [[-30, -25], [-70, -16], [-110, 0], [-150, 10]] },
  { id: 't-bay', kind: 'trail', halfW: 2.2, shoulder: 5, pts: [[60, -95], [92, -92], [122, -80], [150, -70]] },
  { id: 't-agentops', kind: 'trail', halfW: 2.2, shoulder: 5, pts: [[70, 45], [100, 48], [148, 40]] },
  { id: 't-workshop', kind: 'trail', halfW: 2.0, shoulder: 5, pts: [[40, 191], [56, 194], [70, 197]] },
  { id: 't-maze', kind: 'trail', halfW: 1.1, shoulder: 4, pts: [[-4, 152], [-50, 166], [-95, 190], [-124, 198]] },
];

/** The Strata: a cut cliff wall rising on the east side of the descent, banded in the shader by height. */
export const ESCARPMENTS = [{ x1: 76, z1: 58, x2: 54, z2: 150, h: 21, w: 1.3 }];

export const RIVER_SPRINGS: [number, number][] = [[-20, -222], [-100, -190], [95, -188], [178, -125], [-175, -60]];

export const ZONES: ZoneDef[] = [
  { id: 'init', name: 'Init / Origin', num: 1, x: 14, z: -304, face: Math.PI, band: 'rim', tp: [14, -298, 0.15] },
  { id: 'field-office', name: 'Field Office', num: 2, x: -42, z: -290, face: 0, band: 'rim', tp: [-38, -276, Math.PI + 0.3] },
  { id: 'agri-terraces', name: 'Agri Terraces', num: 3, x: -176, z: -122, face: 0, band: 'slope', tp: [-160, -136, -2.2] },
  { id: 'bay', name: 'Diagnostics Bay', num: 4, x: 150, z: -70, face: 0, band: 'slope', tp: [127, -72, 1.37] },
  { id: 'agent-ops', name: 'Agent Operations', num: 5, x: 148, z: 40, face: 0, band: 'slope', tp: [128, 44, 1.5] },
  { id: 'proving', name: 'Proving Grounds', num: 6, x: -150, z: 10, face: 0, band: 'slope', tp: [-128, 6, -1.6] },
  { id: 'workshop', name: 'Workshop', num: 7, x: 84, z: 196, face: 0, band: 'slope', tp: [72, 204, 1.3] },
  { id: 'maze', name: 'Hedge Maze', num: 8, x: -150, z: 200, face: 0, band: 'slope', tp: [-124, 198, -1.5] },
  { id: 'watershed', name: 'Watershed (confluence)', num: 9, x: 0, z: 0, face: 0, band: 'slope', tp: [6, 4, 0.4] },
  { id: 'strata', name: 'The Strata', num: 10, x: 44, z: 106, face: 0, band: 'slope', tp: [44, 100, 0.3] },
  { id: 'research', name: 'Research Station', num: 11, x: 10, z: 278, face: 0, band: 'floor', tp: [14, 258, 0] },
  { id: 'signal-tower', name: 'Signal Tower', num: 12, x: 92, z: -338, face: 0, band: 'rim', tp: [96, -326, Math.PI] },
  { id: 'local-minimum', name: 'Local Minimum', num: 13, x: -95, z: -146, face: 0, band: 'slope', tp: [-98, -162, 0] },
];
