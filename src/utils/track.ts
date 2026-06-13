/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { TrackNode, Checkpoint, Vector3D } from '../types';
import { TrackSpatialCache } from './trackSpatialCache';

// ─────────────────────────────────────────────────────────────────────────────
// Massive 10 KM European Countryside Pass Control Points
// Loop length translates to exactly ~10.1 Kilometers in World Space
// ─────────────────────────────────────────────────────────────────────────────
export const TRACK_CONTROL_POINTS: TrackNode[] = [
  // Zone 0: Start Area (0-1 KM, u: 0.0 - 0.1) - Meadows & paddocks
  { position: { x: 0,    y: 5,  z: 0    }, width: 24, type: 'straight' }, // 0: Start Grid / Finish line
  { position: { x: 100,  y: 6,  z: 180  }, width: 24, type: 'straight' }, // 1: Scenic farm track adjacent
  { position: { x: 250,  y: 8,  z: 400  }, width: 24, type: 'straight' }, // 2: Open meadows paddock straight
  { position: { x: 450,  y: 10, z: 620  }, width: 22, type: 'straight' }, // 3: Woodland entry transition

  // Zone 1: Dense Forest (Birch, Oak, Pine) (1-2 KM, u: 0.1 - 0.2)
  { position: { x: 650,  y: 12, z: 850  }, width: 22, type: 'normal' },   // 4: Canopy gateway
  { position: { x: 800,  y: 14, z: 1100 }, width: 22, type: 'normal' },   // 5: Gentle woodland lefthand sweep
  { position: { x: 950,  y: 13, z: 1350 }, width: 22, type: 'normal' },   // 6: Gentle woodland righthand sweep
  { position: { x: 1100, y: 10, z: 1600 }, width: 22, type: 'normal' },   // 7: Emerging into village outskirts

  // Zone 2: European Village (German / Swiss styled Fachwerk houses) (2-3 KM, u: 0.2 - 0.3)
  { position: { x: 1200, y: 8,  z: 1850 }, width: 20, type: 'normal' },   // 8: Cozy town boundary entry
  { position: { x: 1300, y: 7,  z: 2150 }, width: 20, type: 'normal' },   // 9: Narrow village stone path
  { position: { x: 1350, y: 8,  z: 2450 }, width: 20, type: 'normal' },   // 10: Central wooden bazaar bridge
  { position: { x: 1300, y: 11, z: 2750 }, width: 22, type: 'normal' },   // 11: Gentle exit climb towards lake

  // Zone 3: Lake Stone Arch Bridge (3-4 KM, u: 0.3 - 0.4)
  { position: { x: 1200, y: 12, z: 3050 }, width: 22, type: 'bridge' },   // 12: Stone bridge approach base
  { position: { x: 1000, y: 12, z: 3300 }, width: 22, type: 'bridge' },   // 13: Floating over tranquil countryside lake
  { position: { x: 750,  y: 12, z: 3450 }, width: 22, type: 'bridge' },   // 14: Scenic stone pillars alignment
  { position: { x: 500,  y: 11, z: 3500 }, width: 22, type: 'bridge' },   // 15: Low coast edge bridge exit

  // Zone 4: Gentle Meadows & Windmill Fields (4-5 KM, u: 0.4 - 0.5)
  { position: { x: 250,  y: 12, z: 3400 }, width: 22, type: 'normal' },   // 16: Sunny pasture road entrance
  { position: { x: 100,  y: 14, z: 3200 }, width: 22, type: 'normal' },   // 17: Rolling meadow curves
  { position: { x: 0,    y: 15, z: 2950 }, width: 22, type: 'normal' },   // 18: Wheat field bypass
  { position: { x: -80,  y: 16, z: 2700 }, width: 22, type: 'normal' },   // 19: Pasture boundary curve

  // Zone 5: River Stream & Old Watermill (5-6 KM, u: 0.5 - 0.6)
  { position: { x: -150, y: 15, z: 2400 }, width: 22, type: 'normal' },   // 20: Brookside valley portal
  { position: { x: -280, y: 13, z: 2100 }, width: 22, type: 'normal' },   // 21: Stream-side dirt corridor
  { position: { x: -450, y: 12, z: 1800 }, width: 22, type: 'normal' },   // 22: Traditional watermill view curve
  { position: { x: -600, y: 14, z: 1550 }, width: 22, type: 'normal' },   // 23: Quiet valley ascent

  // Zone 6: Farm Lands & Golden Hay Fields (6-7 KM, u: 0.6 - 0.7)
  { position: { x: -750, y: 18, z: 1300 }, width: 20, type: 'normal' },   // 24: Barnyard side sweep
  { position: { x: -900, y: 20, z: 1050 }, width: 20, type: 'normal' },   // 25: Hay bales field curve
  { position: { x: -750, y: 22, z: 800  }, width: 20, type: 'normal' },   // 26: Grain silo roadside path
  { position: { x: -900, y: 24, z: 550  }, width: 20, type: 'normal' },   // 27: Tractor road turnout

  // Zone 7: Grazing Valleys & Wildflower S-Bends (7-8 KM, u: 0.7 - 0.8)
  { position: { x: -700, y: 22, z: 300  }, width: 22, type: 'normal' },   // 28: Rustic fence entry corridor
  { position: { x: -450, y: 18, z: 120  }, width: 22, type: 'normal' },   // 29: Sheep & cow pastures border S-bend
  { position: { x: -200, y: 15, z: -20  }, width: 22, type: 'normal' },   // 30: Small stone bridge descent
  { position: { x: -50,  y: 11, z: -170 }, width: 22, type: 'normal' },   // 31: Exit pastures ridge

  // Zone 8: Rural Highway Corridor (8-9 KM, u: 0.8 - 0.9)
  { position: { x: -100, y: 10, z: -420  }, width: 24, type: 'straight' }, // 32: Standard countryside dual lane
  { position: { x: -300, y: 9,  z: -720  }, width: 24, type: 'straight' }, // 33: Flat highway speedway
  { position: { x: -500, y: 7,  z: -1070 }, width: 24, type: 'straight' }, // 34: Billboard speedway
  { position: { x: -600, y: 6,  z: -1420 }, width: 24, type: 'straight' }, // 35: High speed exit bend

  // Zone 9: Spectator Resort & Finish Area (9-10 KM, u: 0.9 - 1.0)
  { position: { x: -400, y: 6,  z: -1720 }, width: 24, type: 'straight' }, // 36: Cozy village inn bend
  { position: { x: -150, y: 5,  z: -1420 }, width: 24, type: 'straight' }, // 37: Paved straightaway approach
  { position: { x: -50,  y: 5,  z: -720  }, width: 24, type: 'straight' }, // 38: Pre-finish gate stretch
];

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic 2D Perlin noise implementation for multi-octave terrain gen
// ─────────────────────────────────────────────────────────────────────────────
const grad2D = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1],  [0, -1],
];

const pTable = new Uint8Array(256);
for (let i = 0; i < 256; i++) pTable[i] = i;

// Deterministic seed LCG shuffling
let seedLCG = 54321;
for (let i = 255; i > 0; i--) {
  seedLCG = (1103515245 * seedLCG + 12345) & 0x7fffffff;
  const j = seedLCG % (i + 1);
  const tmp = pTable[i];
  pTable[i] = pTable[j];
  pTable[j] = tmp;
}

const perm      = new Uint8Array(512);
const permGradX = new Float32Array(512);
const permGradY = new Float32Array(512);

for (let i = 0; i < 512; i++) {
  const val = pTable[i & 255];
  perm[i] = val;
  const g = grad2D[val % 8];
  permGradX[i] = g[0];
  permGradY[i] = g[1];
}

function perlinNoise2d(x: number, y: number): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;

  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);

  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
  const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);

  const n00 = permGradX[X     + perm[Y]]     * xf       + permGradY[X     + perm[Y]]     * yf;
  const n10 = permGradX[X + 1 + perm[Y]]     * (xf - 1) + permGradY[X + 1 + perm[Y]]     * yf;
  const n01 = permGradX[X     + perm[Y + 1]] * xf       + permGradY[X     + perm[Y + 1]] * (yf - 1);
  const n11 = permGradX[X + 1 + perm[Y + 1]] * (xf - 1) + permGradY[X + 1 + perm[Y + 1]] * (yf - 1);

  const x1 = n00 + u * (n10 - n00);
  const x2 = n01 + u * (n11 - n01);

  return x1 + v * (x2 - x1);
}

function noiseFBm(x: number, z: number, octaves: number = 6): number {
  let total     = 0;
  let frequency = 0.00012; // wide expansive countryside landscapes
  let amplitude = 1.0;
  let maxValue  = 0;

  for (let i = 0; i < octaves; i++) {
    total    += perlinNoise2d(x * frequency, z * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.52;
    frequency *= 2.1;
  }

  return total / maxValue;
}

// Gentle rolling European countryside hills
const PEAKS = [
  { x: -1600, z: -1500, radius: 1500, height: 60 },
  { x: -2000, z:  800,  radius: 1400, height: 50 },
  { x:  1650, z: -1900, radius: 1600, height: 70 },
  { x:  2100, z:  1100, radius: 1500, height: 55 },
  { x:  -700, z:  2300, radius: 1300, height: 45 },
  { x:  1100, z:  2600, radius: 1400, height: 48 },
  { x:   110, z:  3100, radius:  800, height: 35 },
];

// ─────────────────────────────────────────────────────────────────────────────
// File-scope scratchpad vectors
// Avoids per-call heap allocations in hot terrain / scenery generation loops.
// ─────────────────────────────────────────────────────────────────────────────
const SCRATCH_POS_A  = new THREE.Vector3();
const SCRATCH_POS_B  = new THREE.Vector3();
// Dedicated reusable vector for getTerrainHeight → getNearestTrackInfo calls
const TEMP_HEIGHT_VEC = new THREE.Vector3();
// Reusable scratch vectors for generateSceneryDistributions
const TEMP_VEC1   = new THREE.Vector3(); // spline point (pt)
const TEMP_VEC2   = new THREE.Vector3(); // tangent
const TEMP_VEC3   = new THREE.Vector3(); // general placement scratch
const TEMP_NORMAL = new THREE.Vector3(); // road normal

// ─────────────────────────────────────────────────────────────────────────────
// High fidelity fully-integrated terrain height function
// with smooth carving around road splines
// ─────────────────────────────────────────────────────────────────────────────
export function getTerrainHeight(x: number, z: number, trackHelper?: any): number {
  const distFromCenter = Math.sqrt(x * x + z * z);

  // 1. Continuous Multi-Octave Perlin noise base
  const rawNoise  = noiseFBm(x, z, 6);
  let baseHeight  = rawNoise * 42.0 + 8.0;

  // Outer boundary framing
  if (distFromCenter > 420) {
    const extraHeight = Math.min(80, (distFromCenter - 420) * 0.05);
    baseHeight += extraHeight;
  } else {
    baseHeight += (distFromCenter - 420) * 0.02;
  }

  // 2. Sculpt Rolling Countryside Hills (Smoothstep Radial Falloff)
  let hillHeight = 0;
  for (const p of PEAKS) {
    const dx   = x - p.x;
    const dz   = z - p.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < p.radius) {
      const t       = dist / p.radius;
      const falloff = 1.0 - t * t * (3 - 2 * t);
      hillHeight   += p.height * Math.pow(falloff, 1.5);
    }
  }
  baseHeight += hillHeight;

  // 3. Zone Specific Geography Sculptures

  // Tranquil European Lake Bed
  const distToLake = Math.sqrt(Math.pow(x - 50, 2) + Math.pow(z + 120, 2));
  if (distToLake < 250) {
    const lakeFactor  = Math.cos(Math.min(1.0, distToLake / 250) * Math.PI / 2);
    const smoothFactor = lakeFactor * lakeFactor * (3 - 2 * lakeFactor);
    baseHeight = THREE.MathUtils.lerp(baseHeight, 1.2, smoothFactor);
  }

  // Countryside Stream/River under stone bridge
  if (z > 2850 && z < 3600) {
    const distToRiverCenter = Math.abs(x - 900);
    if (distToRiverCenter < 280) {
      const uRiver  = distToRiverCenter / 280;
      const sFactor = 1.0 - uRiver * uRiver * (3 - 2 * uRiver);
      const riverDepth = 3.5 + Math.sin(z * 0.04) * 0.5;
      baseHeight = THREE.MathUtils.lerp(baseHeight, riverDepth, sFactor * 0.88);
    }
  }

  // Brookside valley pool bed
  const distToWaterfall = Math.sqrt(Math.pow(x + 150, 2) + Math.pow(z - 2400, 2));
  if (distToWaterfall < 300) {
    const wfFactor = Math.min(1.0, distToWaterfall / 300);
    const sFactor  = 1.0 - wfFactor * wfFactor * (3 - 2 * wfFactor);
    baseHeight = THREE.MathUtils.lerp(baseHeight, 3.8, sFactor * 0.90);
  }

  // 4. Dynamic Road Corridors Carving
  if (trackHelper && typeof trackHelper.getNearestTrackInfo === 'function') {
    TEMP_HEIGHT_VEC.set(x, 0, z);
    const info = trackHelper.getNearestTrackInfo(TEMP_HEIGHT_VEC);
    if (info) {
      const rType     = typeof trackHelper.getRoadTypeAt  === 'function' ? trackHelper.getRoadTypeAt(info.progress)  : 'normal';
      const width     = typeof trackHelper.getRoadWidthAt === 'function' ? trackHelper.getRoadWidthAt(info.progress) : 24;
      const halfWidth = width / 2;
      const flatZone  = halfWidth + 1.25;
      const blendZone = 36.0;

      if (rType !== 'bridge' && info.nearestPoint) {
        if (info.distanceToTrack < flatZone) {
          baseHeight = info.nearestPoint.y - 0.18;
        } else if (info.distanceToTrack < flatZone + blendZone) {
          let t = (info.distanceToTrack - flatZone) / blendZone;
          t = THREE.MathUtils.clamp(t, 0, 1);
          const s       = t * t * (3 - 2 * t);
          const roadBedY = info.nearestPoint.y - 0.18;
          baseHeight = THREE.MathUtils.lerp(roadBedY, baseHeight, s);
        }
      }
    }
  }

  if (!Number.isFinite(baseHeight)) {
    console.error('BAD HEIGHT', x, z, baseHeight);
    baseHeight = 0;
  }
  return THREE.MathUtils.clamp(baseHeight, -10, 120);
}

// ─────────────────────────────────────────────────────────────────────────────
// TrackGeometryHelper
// ─────────────────────────────────────────────────────────────────────────────
export class TrackGeometryHelper {
  curve: THREE.CatmullRomCurve3;
  cachedPoints: THREE.Vector3[];
  checkpoints: Checkpoint[] = [];
  length: number;
  public carLastIndexMap = new Map<string, number>();

  // Spatial grid index — replaces the O(2000) linear fallback scan
  private spatialCache!: TrackSpatialCache;

  // High fidelity scenery distribution structures
  trees:         { position: THREE.Vector3; scale: number; type: number }[]           = [];
  rocks:         { position: THREE.Vector3; scale: THREE.Vector3; rotation: THREE.Euler }[] = [];
  lights:        { position: THREE.Vector3; color: string; intensity: number }[]       = [];
  mountains:     { position: THREE.Vector3; radius: number; height: number }[]         = [];
  villageHouses: { position: THREE.Vector3; scale: number; rotation: number }[]        = [];
  grandstands:   { position: THREE.Vector3; scale: THREE.Vector3; rotation: number }[] = [];
  banners:       { position: THREE.Vector3; rotation: number; text: string }[]         = [];
  billboards:    { position: THREE.Vector3; rotation: number; text: string }[]         = [];
  snowPeaks:     { position: THREE.Vector3; radius: number; height: number }[]         = [];

  // Anchored landmarks coordinates
  pagodaPos:     THREE.Vector3 = new THREE.Vector3(-450, 90,  120);  // Dragon Temple
  waterfallPos:  THREE.Vector3 = new THREE.Vector3(-150, 20,  2400); // Waterfall Valley
  finishGatePos: THREE.Vector3 = new THREE.Vector3(0,    0,   0);    // Start/Finish gate

  constructor() {
    // 1. Instantiate closed 3D CatmullRom spline loop
    const threePoints = TRACK_CONTROL_POINTS.map(
      node => new THREE.Vector3(node.position.x, node.position.y, node.position.z)
    );
    this.curve = new THREE.CatmullRomCurve3(threePoints, true, 'centripetal');

    // 2. Cache 2000 evenly-spaced points along the spline
    this.cachedPoints = this.curve.getSpacedPoints(2000);

    // 3. Build spatial grid index once — O(1) nearest-point queries from here on
    this.spatialCache = new TrackSpatialCache(this.cachedPoints);

    // 4. Calculate accurate analytical track spline length
    let calculatedLength = 0;
    if (this.cachedPoints && this.cachedPoints.length > 1) {
      for (let idx = 0; idx < this.cachedPoints.length - 1; idx++) {
        const ptA = this.cachedPoints[idx];
        const ptB = this.cachedPoints[idx + 1];
        if (ptA && ptB && typeof ptA.distanceTo === 'function') {
          calculatedLength += ptA.distanceTo(ptB);
        }
      }
      const lastPt  = this.cachedPoints[this.cachedPoints.length - 1];
      const firstPt = this.cachedPoints[0];
      if (lastPt && firstPt && typeof lastPt.distanceTo === 'function') {
        calculatedLength += lastPt.distanceTo(firstPt);
      }
    }
    this.length = calculatedLength || 4150.0;

    // 5. Align gates and landmarks on actual spline points
    const startPt = this.curve.getPointAt(0.0);
    this.finishGatePos.copy(startPt);

    this.waterfallPos.set(-150, getTerrainHeight(-150, 2400, this) + 12, 2400);
    this.pagodaPos.set(-450, getTerrainHeight(-450, 120, this), 120);

    // 6. Generate 30 analytical checkpoints across the 10 KM course
    const numCheckpoints = 30;
    for (let i = 0; i < numCheckpoints; i++) {
      const u      = i / numCheckpoints;
      const pos    = this.curve.getPointAt(u);
      const tangent = this.curve.getTangentAt(u).normalize();

      this.checkpoints.push({
        position:  { x: pos.x,     y: pos.y,     z: pos.z     },
        direction: { x: tangent.x, y: tangent.y, z: tangent.z },
        width: this.getRoadWidthAt(u),
        index: i,
      });
    }

    // 7. Populate themed scenic lists
    this.generateSceneryDistributions();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Get dynamic road width (interpolated between control points)
  // ───────────────────────────────────────────────────────────────────────────
  getRoadWidthAt(u: number): number {
    if (u === undefined || u === null || isNaN(u)) u = 0;
    u = u % 1.0;
    if (u < 0) u += 1.0;

    const size       = TRACK_CONTROL_POINTS.length;
    const indexFloat = u * size;
    const currIdx    = Math.floor(indexFloat) % size;
    const nextIdx    = (currIdx + 1) % size;
    const alpha      = indexFloat - Math.floor(indexFloat);

    const currWidth = TRACK_CONTROL_POINTS[currIdx].width;
    const nextWidth = TRACK_CONTROL_POINTS[nextIdx].width;
    return currWidth + (nextWidth - currWidth) * alpha;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Get local road segment type
  // ───────────────────────────────────────────────────────────────────────────
  getRoadTypeAt(u: number): string {
    if (u === undefined || u === null || isNaN(u)) u = 0;
    u = (u % 1.0 + 1.0) % 1.0;
    const size  = TRACK_CONTROL_POINTS.length;
    const index = Math.floor(u * size) % size;
    return TRACK_CONTROL_POINTS[index].type || 'normal';
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getNearestTrackInfo
  //
  // OPTIMIZATION: Full O(2000) linear scan replaced with TrackSpatialCache
  // lookup → only 5-30 candidates checked instead of 2000 every frame.
  // The fast ±20 cached-index path is kept for continuously-moving cars;
  // the spatial cache replaces the expensive cold-start fallback.
  // ───────────────────────────────────────────────────────────────────────────
  getNearestTrackInfo(pos: THREE.Vector3, carId?: string) {
    try {
      if (
        !pos ||
        typeof pos.distanceToSquared !== 'function' ||
        isNaN(pos.x) || isNaN(pos.y) || isNaN(pos.z)
      ) {
        return {
          nearestPoint:    new THREE.Vector3(),
          progress:        0,
          tangent:         new THREE.Vector3(0, 0, 1),
          normal:          new THREE.Vector3(1, 0, 0),
          width:           24,
          sideOffset:      0,
          distanceToTrack: 0,
        };
      }

      let minDistance     = Infinity;
      let nearestProgress = 0;
      let nearestPoint    = new THREE.Vector3();

      const pointsLength = this.cachedPoints ? this.cachedPoints.length : 0;
      const samples      = Math.min(2000, pointsLength);

      let foundIndex    = -1;
      let lastCachedIdx = carId ? this.carLastIndexMap.get(carId) : undefined;

      if (lastCachedIdx !== undefined && samples > 0) {
        // ── Fast path: scan ±20 points around last known index ──────────────
        for (let offset = -20; offset <= 20; offset++) {
          const i  = (lastCachedIdx + offset + samples) % samples;
          const pt = this.cachedPoints[i];
          if (!pt || typeof pt.distanceToSquared !== 'function') continue;
          const distSq = pos.distanceToSquared(pt);
          if (!isNaN(distSq) && distSq < minDistance) {
            minDistance     = distSq;
            nearestProgress = i / samples;
            nearestPoint.copy(pt);
            foundIndex = i;
          }
        }
      } else if (samples > 0) {
        // ── Spatial-grid accelerated scan ───────────────────────────────────
        // Previously O(2000) — now O(~5-30) candidates from the grid cell.
        const nearbyIndices = this.spatialCache.getNearbyIndices(pos.x, pos.z);
        for (let k = 0; k < nearbyIndices.length; k++) {
          const i  = nearbyIndices[k];
          const pt = this.cachedPoints[i];
          if (!pt || typeof pt.distanceToSquared !== 'function') continue;
          const distSq = pos.distanceToSquared(pt);
          if (!isNaN(distSq) && distSq < minDistance) {
            minDistance     = distSq;
            nearestProgress = i / samples;
            nearestPoint.copy(pt);
            foundIndex = i;
          }
        }
      } else {
        // ── Absolute fallback (no cached points) ────────────────────────────
        const startPt = this.curve ? this.curve.getPointAt(0) : new THREE.Vector3();
        if (startPt) {
          nearestPoint.copy(startPt);
          const distSq = pos.distanceToSquared(nearestPoint);
          if (!isNaN(distSq)) minDistance = distSq;
        }
      }

      if (carId && foundIndex !== -1) {
        this.carLastIndexMap.set(carId, foundIndex);
      }

      // ── Sub-sample refinement around the coarse winner ───────────────────
      let preciseProgress = nearestProgress;
      if (isNaN(preciseProgress) || preciseProgress === undefined || preciseProgress === null) {
        preciseProgress = 0;
      }

      const searchStep = 1 / (Math.max(samples, 1) * 5);
      const tempPt     = SCRATCH_POS_A;

      if (this.curve && typeof this.curve.getPointAt === 'function') {
        for (let step = -4; step <= 4; step++) {
          let u = (nearestProgress + step * searchStep + 1.0) % 1.0;
          if (isNaN(u) || u === undefined || u === null) u = 0.0;
          try {
            this.curve.getPointAt(u, tempPt);
            if (
              tempPt && typeof tempPt.distanceToSquared === 'function' &&
              pos    && typeof pos.distanceToSquared    === 'function'
            ) {
              const distSq = pos.distanceToSquared(tempPt);
              if (!isNaN(distSq) && distSq < minDistance) {
                minDistance     = distSq;
                preciseProgress = u;
                nearestPoint.copy(tempPt);
              }
            }
          } catch (_e) {
            // ignore failure for this sample step
          }
        }
      }

      if (isNaN(preciseProgress) || preciseProgress === undefined || preciseProgress === null) {
        preciseProgress = 0;
      }

      const tangent = new THREE.Vector3();
      if (this.curve && typeof this.curve.getTangentAt === 'function') {
        this.curve.getTangentAt(preciseProgress, tangent);
      } else {
        tangent.set(0, 0, 1);
      }
      tangent.normalize();

      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const width  = this.getRoadWidthAt(preciseProgress);

      const toCar = SCRATCH_POS_B.subVectors(pos, nearestPoint);
      let sideOffset = toCar.dot(normal);

      // Final isFinite guards — nothing NaN escapes to car physics
      if (!Number.isFinite(preciseProgress)) preciseProgress = 0;
      if (!Number.isFinite(minDistance))     minDistance     = 0;
      if (!Number.isFinite(sideOffset))      sideOffset      = 0;

      return {
        nearestPoint,
        progress: preciseProgress,
        tangent,
        normal,
        width,
        sideOffset,
        distanceToTrack: Number.isFinite(minDistance) ? Math.sqrt(minDistance) : 0,
      };
    } catch (err) {
      console.warn('Exception caught in getNearestTrackInfo, returning safe fallback values:', err);
      return {
        nearestPoint:    new THREE.Vector3(),
        progress:        0,
        tangent:         new THREE.Vector3(0, 0, 1),
        normal:          new THREE.Vector3(1, 0, 0),
        width:           24,
        sideOffset:      0,
        distanceToTrack: 0,
      };
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // generateSceneryDistributions
  //
  // OPTIMIZATION: All per-iteration new THREE.Vector3() calls replaced with
  // TEMP_VEC1/2/3 and TEMP_NORMAL scratch vectors. The loop runs 2000 times
  // so this eliminates up to ~20,000 short-lived heap objects and the GC
  // pauses they cause at load time. .clone() is called only when pushing
  // a position that must persist in the arrays.
  // ───────────────────────────────────────────────────────────────────────────
  private generateSceneryDistributions() {
    let seed = 98765;
    const random = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    // 1. Hills and ridges
    const peakConfigs = [
      { x: -1600, z: -1500, radius: 1500, height: 60 },
      { x: -2000, z:  800,  radius: 1400, height: 50 },
      { x:  1650, z: -1900, radius: 1600, height: 70 },
      { x:  2100, z:  1100, radius: 1500, height: 55 },
      { x:  -700, z:  2300, radius: 1300, height: 45 },
      { x:  1100, z:  2600, radius: 1400, height: 48 },
    ];
    for (const p of peakConfigs) {
      this.mountains.push({
        position: new THREE.Vector3(p.x, -5, p.z),
        radius:   p.radius,
        height:   p.height,
      });
    }

    // Align specific landmarks
    this.pagodaPos    = new THREE.Vector3(-450, getTerrainHeight(-450, 120,  this),     120);
    this.waterfallPos = new THREE.Vector3(-150, getTerrainHeight(-150, 2400, this) + 2, 2400);

    // 2. Sample 2000 points along the course for heavy scenery placement
    const steps = 2000;
    for (let j = 0; j < steps; j++) {
      const u       = j / steps;
      const zoneIdx = Math.floor(u * 10);

      // ── Reuse scratch vectors — zero allocations per iteration ────────────
      this.curve.getPointAt(u,    TEMP_VEC1);           // TEMP_VEC1 = pt
      this.curve.getTangentAt(u,  TEMP_VEC2).normalize(); // TEMP_VEC2 = tangent
      TEMP_NORMAL.set(-TEMP_VEC2.z, 0, TEMP_VEC2.x).normalize();

      const pt      = TEMP_VEC1;
      const tangent = TEMP_VEC2;
      const normal  = TEMP_NORMAL;

      const roadWidth    = this.getRoadWidthAt(u);
      const rType        = this.getRoadTypeAt(u);
      const headingAngle = Math.atan2(tangent.x, tangent.z);
      const isInsideRestricted = (rType === 'bridge');

      // ── Heavy open-world tree generation ─────────────────────────────────
      if (!isInsideRestricted) {
        const clusterCount = 4 + Math.floor(random() * 5);
        for (let tc = 0; tc < clusterCount; tc++) {
          const side       = random() > 0.5 ? 1 : -1;
          const treeOffset = roadWidth / 2 + 5.0 + random() * 140.0;

          // Compute position in TEMP_VEC3 scratch, then clone only once for storage
          TEMP_VEC3.copy(pt).addScaledVector(normal, side * treeOffset);
          TEMP_VEC3.y = getTerrainHeight(TEMP_VEC3.x, TEMP_VEC3.z, this);

          let tType = 0;
          const rand = random();
          if      (rand < 0.35) tType = 0; // Pine
          else if (rand < 0.65) tType = 1; // Birch
          else if (rand < 0.82) tType = 2; // Oak
          else                  tType = 3; // Shrub

          this.trees.push({ position: TEMP_VEC3.clone(), scale: 0.8 + random() * 1.5, type: tType });
        }
      }

      switch (zoneIdx) {
        // ── ZONE 0: START AREA — Meadows & Paddocks ────────────────────────
        case 0:
          if (j % 30 === 0) {
            const side = (j % 60 === 0) ? 1 : -1;
            TEMP_VEC3.copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 13.0));
            TEMP_VEC3.y = getTerrainHeight(TEMP_VEC3.x, TEMP_VEC3.z, this) - 0.1;
            this.grandstands.push({
              position: TEMP_VEC3.clone(),
              scale:    new THREE.Vector3(10, 5, 20),
              rotation: headingAngle + (side * Math.PI / 2),
            });
          }
          if (j % 20 === 0) {
            const side = (j % 40 === 0) ? 1 : -1;
            TEMP_VEC3.copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 2.0));
            TEMP_VEC3.y = getTerrainHeight(TEMP_VEC3.x, TEMP_VEC3.z, this) + 4.0;
            this.lights.push({ position: TEMP_VEC3.clone(), color: '#ffeaad', intensity: 2.0 });
          }
          break;

        // ── ZONE 1: DENSE FOREST — handled by the tree generator above ─────
        case 1:
          break;

        // ── ZONE 2: COZY GERMAN/SWISS VILLAGE ─────────────────────────────
        case 2:
          if (!isInsideRestricted && j % 15 === 0) {
            const side      = random() > 0.5 ? 1 : -1;
            const houseDist = roadWidth / 2 + 6.5 + random() * 8;

            TEMP_VEC3.copy(pt).addScaledVector(normal, side * houseDist);
            TEMP_VEC3.y = getTerrainHeight(TEMP_VEC3.x, TEMP_VEC3.z, this) - 0.1;
            this.villageHouses.push({
              position: TEMP_VEC3.clone(),
              scale:    1.0 + random() * 0.4,
              rotation: headingAngle + (side * Math.PI / 2) + (random() * 0.1 - 0.05),
            });

            // Street lamps — reuse TEMP_VEC3 for lamp position too
            TEMP_VEC3.copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 1.5));
            TEMP_VEC3.y = getTerrainHeight(TEMP_VEC3.x, TEMP_VEC3.z, this) + 2.5;
            this.lights.push({ position: TEMP_VEC3.clone(), color: '#ff9900', intensity: 3.5 });
          }
          break;

        // ── ZONE 3: LAKE & STONE BRIDGE ───────────────────────────────────
        case 3:
          if (rType === 'bridge' && j % 15 === 0) {
            TEMP_VEC3.copy(pt).addScaledVector(normal, -18 - random() * 10);
            TEMP_VEC3.y = getTerrainHeight(TEMP_VEC3.x, TEMP_VEC3.z, this) + 3;
            this.rocks.push({
              position: TEMP_VEC3.clone(),
              scale:    new THREE.Vector3(6 + random() * 4, 10 + random() * 12, 6 + random() * 4),
              rotation: new THREE.Euler(0, random() * Math.PI, 0),
            });

            TEMP_VEC3.copy(pt).addScaledVector(normal, 18 + random() * 10);
            TEMP_VEC3.y = getTerrainHeight(TEMP_VEC3.x, TEMP_VEC3.z, this) + 3;
            this.rocks.push({
              position: TEMP_VEC3.clone(),
              scale:    new THREE.Vector3(6 + random() * 4, 10 + random() * 12, 6 + random() * 4),
              rotation: new THREE.Euler(0, random() * Math.PI, 0),
            });
          }
          break;

        // ── ZONE 4: MEADOWS & WINDMILL FIELDS ─────────────────────────────
        case 4:
          if (j % 55 === 0) {
            const side = (j % 110 === 0) ? 1 : -1;
            TEMP_VEC3.copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 12));
            TEMP_VEC3.y = getTerrainHeight(TEMP_VEC3.x, TEMP_VEC3.z, this);
            this.billboards.push({
              position: TEMP_VEC3.clone(),
              rotation: headingAngle + (side * Math.PI / 2),
              text:     'WINDMILL VIEWPOINT',
            });
          }
          break;

        // ── ZONE 5: BROOKSIDE VALLEYS ──────────────────────────────────────
        case 5:
          if (!isInsideRestricted && random() < 0.4) {
            const side      = random() > 0.5 ? 1 : -1;
            const stoneDist = roadWidth / 2 + 2.0 + random() * 20;
            TEMP_VEC3.copy(pt).addScaledVector(normal, side * stoneDist);
            TEMP_VEC3.y = getTerrainHeight(TEMP_VEC3.x, TEMP_VEC3.z, this) - 0.2;
            this.rocks.push({
              position: TEMP_VEC3.clone(),
              scale:    new THREE.Vector3(3 + random() * 3, 2 + random() * 2, 3 + random() * 3),
              rotation: new THREE.Euler(random() * 0.2, random() * Math.PI, 0),
            });
          }
          break;

        // ── ZONE 6: FARM BARNYARDS & SILOS ────────────────────────────────
        case 6:
          if (j % 50 === 0) {
            const side = (j % 100 === 0) ? 1 : -1;
            TEMP_VEC3.copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 10));
            TEMP_VEC3.y = getTerrainHeight(TEMP_VEC3.x, TEMP_VEC3.z, this);
            this.billboards.push({
              position: TEMP_VEC3.clone(),
              rotation: headingAngle + (side * Math.PI / 2),
              text:     'RURAL HARVESTS',
            });
          }
          break;

        // ── ZONE 7: COWS & PASTORAL S-BENDS ──────────────────────────────
        case 7:
          if (j % 30 === 0) {
            TEMP_VEC3.copy(pt).addScaledVector(normal, (j % 60 === 0 ? 1 : -1) * (roadWidth / 2 + 1.8));
            TEMP_VEC3.y = getTerrainHeight(TEMP_VEC3.x, TEMP_VEC3.z, this) + 1.5;
            this.lights.push({ position: TEMP_VEC3.clone(), color: '#ffd600', intensity: 2.2 });
          }
          break;

        // ── ZONE 8: RURAL HIGHWAY CORRIDOR ────────────────────────────────
        case 8:
          if (j % 30 === 0) {
            const side = (j % 60 === 0) ? -1 : 1;
            TEMP_VEC3.copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 10));
            TEMP_VEC3.y = getTerrainHeight(TEMP_VEC3.x, TEMP_VEC3.z, this);
            this.billboards.push({
              position: TEMP_VEC3.clone(),
              rotation: headingAngle + (side * Math.PI / 2),
              text:     'SPEED LIMIT: 80',
            });
          }
          break;

        // ── ZONE 9: SPECTATOR RESORT & HOTELS ─────────────────────────────
        case 9:
          if (j % 35 === 0) {
            const side = (j % 70 === 0) ? 1 : -1;
            TEMP_VEC3.copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 12));
            TEMP_VEC3.y = getTerrainHeight(TEMP_VEC3.x, TEMP_VEC3.z, this) - 0.1;
            this.grandstands.push({
              position: TEMP_VEC3.clone(),
              scale:    new THREE.Vector3(10, 5, 20),
              rotation: headingAngle + (side * Math.PI / 2),
            });
          }
          if (j % 20 === 0) {
            TEMP_VEC3.copy(pt).addScaledVector(normal, (j % 40 === 0 ? 1 : -1) * (roadWidth / 2 + 1.5));
            TEMP_VEC3.y = getTerrainHeight(TEMP_VEC3.x, TEMP_VEC3.z, this) + 4.5;
            this.lights.push({ position: TEMP_VEC3.clone(), color: '#ffffff', intensity: 2.0 });
          }
          break;

        default:
          break;
      }
    }
  }
}
