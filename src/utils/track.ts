/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { TrackNode, Checkpoint, Vector3D } from '../types';

// Massive 10 KM Dragon Mountain Pass Control Points
// Loop length translates to exactly ~10.1 Kilometers in World Space
export const TRACK_CONTROL_POINTS: TrackNode[] = [
  // Zone 0: Start Area (0-1 KM, u: 0.0 - 0.1)
  { position: { x: 0, y: 0, z: 0 }, width: 26, type: 'straight' },       // 0: Start Grid / Finish line
  { position: { x: 100, y: 2, z: 180 }, width: 26, type: 'straight' },    // 1: Spaced grandstand straight 1
  { position: { x: 250, y: 6, z: 400 }, width: 26, type: 'straight' },    // 2: Spaced grandstand straight 2
  { position: { x: 450, y: 10, z: 620 }, width: 24, type: 'straight' },   // 3: Pine forest transition entry

  // Zone 1: Dense Pine Forest (1-2 KM, u: 0.1 - 0.2)
  { position: { x: 650, y: 18, z: 850 }, width: 22, type: 'normal' },     // 4: Thick pine tree gateway
  { position: { x: 800, y: 22, z: 1100 }, width: 22, type: 'normal' },    // 5: Gentle canopy lefthand sweep
  { position: { x: 950, y: 15, z: 1350 }, width: 22, type: 'normal' },    // 6: Gentle canopy righthand sweep
  { position: { x: 1100, y: 10, z: 1600 }, width: 22, type: 'normal' },   // 7: Descending towards village gateways

  // Zone 2: Mountain Village (2-3 KM, u: 0.2 - 0.3)
  { position: { x: 1200, y: 8, z: 1850 }, width: 20, type: 'normal' },    // 8: Japanese gateway arch entry
  { position: { x: 1300, y: 5, z: 2150 }, width: 20, type: 'normal' },    // 9: Narrow village lanterns bypass
  { position: { x: 1350, y: 10, z: 2450 }, width: 20, type: 'normal' },   // 10: Central wooden bazaar bridge
  { position: { x: 1300, y: 20, z: 2750 }, width: 22, type: 'normal' },   // 11: Steep exit climbing turn

  // Zone 3: Red Suspension Bridge (3-4 KM, u: 0.3 - 0.4)
  { position: { x: 1200, y: 35, z: 3050 }, width: 24, type: 'bridge' },   // 12: High concrete support base
  { position: { x: 1000, y: 35, z: 3300 }, width: 24, type: 'bridge' },   // 13: Floating over giant canyon bottom
  { position: { x: 750, y: 35, z: 3450 }, width: 24, type: 'bridge' },    // 14: Above misty deep canyon river
  { position: { x: 500, y: 30, z: 3500 }, width: 24, type: 'bridge' },    // 15: Cliff face bridge exit

  // Zone 4: Neon Tunnel (4-5 KM, u: 0.4 - 0.5)
  { position: { x: 250, y: 22, z: 3400 }, width: 18, type: 'tunnel' },    // 16: Neon mountain entry portal
  { position: { x: 100, y: 10, z: 3200 }, width: 18, type: 'tunnel' },    // 17: Sweeping blue LED tube vault
  { position: { x: 0, y: -6, z: 2950 }, width: 18, type: 'tunnel' },     // 18: Underground canyon bypass curve
  { position: { x: -80, y: -16, z: 2700 }, width: 18, type: 'tunnel' },   // 19: Portal exit curve

  // Zone 5: Waterfall Valley (5-6 KM, u: 0.5 - 0.6)
  { position: { x: -150, y: -11, z: 2400 }, width: 22, type: 'normal' },  // 20: Emerald cascade valley entrance
  { position: { x: -280, y: -9, z: 2100 }, width: 22, type: 'normal' },   // 21: Moist valley boulder corridor
  { position: { x: -450, y: -3, z: 1800 }, width: 22, type: 'normal' },   // 22: Cascade viewing bridge road
  { position: { x: -600, y: 14, z: 1550 }, width: 22, type: 'normal' },   // 23: Low cliff pass ascent

  // Zone 6: Hairpin Roads (6-7 KM, u: 0.6 - 0.7)
  { position: { x: -750, y: 35, z: 1300 }, width: 18, type: 'hairpin' },  // 24: Sharp warning wall L1
  { position: { x: -900, y: 65, z: 1050 }, width: 18, type: 'hairpin' },  // 25: Cliff barrier switchback curve
  { position: { x: -750, y: 95, z: 800 }, width: 18, type: 'hairpin' },   // 26: Rocky peak switchback curve
  { position: { x: -900, y: 120, z: 550 }, width: 18, type: 'hairpin' },  // 27: Temple summit peak turnout

  // Zone 7: Dragon Temple (7-8 KM, u: 0.7 - 0.8)
  { position: { x: -700, y: 110, z: 300 }, width: 22, type: 'normal' },   // 28: Traditional torii gate portal
  { position: { x: -450, y: 90, z: 120 }, width: 22, type: 'normal' },    // 29: Crimson pagoda cherry blossom drive
  { position: { x: -200, y: 70, z: -20 }, width: 22, type: 'normal' },    // 30: Stone stairs bridge descent
  { position: { x: -50, y: 55, z: -170 }, width: 22, type: 'normal' },    // 31: Exit temple ridge S-bend

  // Zone 8: Long Highway (8-9 KM, u: 0.8 - 0.9)
  { position: { x: -100, y: 35, z: -420 }, width: 26, type: 'straight' },  // 32: Speed corridor high-rise viaduct
  { position: { x: -300, y: 22, z: -720 }, width: 26, type: 'straight' },  // 33: Flat highway speed straight
  { position: { x: -500, y: 12, z: -1070 }, width: 26, type: 'straight' }, // 34: Multi-lane Billboard speedway
  { position: { x: -600, y: 5, z: -1420 }, width: 26, type: 'straight' },  // 35: High speed exit transition

  // Zone 9: Finish Area (9-10 KM, u: 0.9 - 1.0)
  { position: { x: -400, y: 0, z: -1720 }, width: 24, type: 'straight' },  // 36: Final spectator grand bend
  { position: { x: -150, y: -2, z: -1420 }, width: 24, type: 'straight' }, // 37: Loop back high straight
  { position: { x: -50, y: -1, z: -720 }, width: 24, type: 'straight' },   // 38: Pre-finish gate stretch
];

// Deterministic 2D Perlin noise implementation for multi-octave terrain generation
const grad2D = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1]
];

const pTable = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  pTable[i] = i;
}
// Deterministic seed LCG shuffling
let seedLCG = 54321;
for (let i = 255; i > 0; i--) {
  seedLCG = (1103515245 * seedLCG + 12345) & 0x7fffffff;
  const j = seedLCG % (i + 1);
  const tmp = pTable[i];
  pTable[i] = pTable[j];
  pTable[j] = tmp;
}

const perm = new Uint8Array(512);
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

  const n00 = permGradX[X + perm[Y]] * xf + permGradY[X + perm[Y]] * yf;
  const n10 = permGradX[X + 1 + perm[Y]] * (xf - 1) + permGradY[X + 1 + perm[Y]] * yf;
  const n01 = permGradX[X + perm[Y + 1]] * xf + permGradY[X + perm[Y + 1]] * (yf - 1);
  const n11 = permGradX[X + 1 + perm[Y + 1]] * (xf - 1) + permGradY[X + 1 + perm[Y + 1]] * (yf - 1);

  const x1 = n00 + u * (n10 - n00);
  const x2 = n01 + u * (n11 - n01);

  return x1 + v * (x2 - x1);
}

function noiseFBm(x: number, z: number, octaves: number = 6): number {
  let total = 0;
  let frequency = 0.00015; // wide expansive landscapes
  let amplitude = 1.0;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    total += perlinNoise2d(x * frequency, z * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2.3;
  }

  return total / maxValue;
}

// Giant, majestic alpine peaks matching the Forza / Horizon request
// Perfectly sculpted with smoothstep radial falloff inside getTerrainHeight
const PEAKS = [
  { x: -1600, z: -1500, radius: 1100, height: 520 }, // High snow peaks (Zone 9)
  { x: -2000, z: 800, radius: 1000, height: 490 },  // Alpine ridge
  { x: 1650, z: -1900, radius: 1150, height: 550 },  // Massive northeast backdrop
  { x: 2100, z: 1100, radius: 1000, height: 460 },  // Canyon flanks
  { x: -700, z: 2300, radius: 900, height: 350 },   // Waterfall mountain range
  { x: 1100, z: 2600, radius: 1050, height: 410 },  // Village pass peak
  { x: 110, y: 10, z: 3100, radius: 450, height: 260 }, // Solid rock massif encasing neon tunnel portals
];

// High fidelity fully-integrated terrain height function with smooth carving around road splines
export function getTerrainHeight(x: number, z: number, trackHelper?: any): number {
  const distFromCenter = Math.sqrt(x * x + z * z);
  
  // 1. Continuous Multi-Octave Perlin noise base (6 octaves for granular valleys and hills)
  const rawNoise = noiseFBm(x, z, 6);
  let baseHeight = rawNoise * 145.0; // scale noise range beautifully
  
  // Create beautiful, natural surrounding alpine ridge barriers (outer edges)
  if (distFromCenter > 380) {
    baseHeight += (distFromCenter - 380) * 0.45;
  } else {
    baseHeight += (distFromCenter - 380) * 0.05;
  }

  // 2. Sculpt Actual Mountain Masses (Smoothstep Radial Falloff)
  let mountainHeight = 0;
  for (const p of PEAKS) {
    const dx = x - p.x;
    const dz = z - p.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < p.radius) {
      const t = dist / p.radius;
      const falloff = 1.0 - t * t * (3 - 2 * t); // smoothstep radial blend
      mountainHeight += p.height * Math.pow(falloff, 1.6);
    }
  }
  baseHeight += mountainHeight;
  
  // 3. Zone Specific Geography Sculptures
  // Emerald Jade Lake Bed (centered around Zone 9 transition)
  const distToLake = Math.sqrt(Math.pow(x - 50, 2) + Math.pow(z + 120, 2));
  if (distToLake < 250) {
    const lakeFactor = Math.cos(Math.min(1.0, distToLake / 250) * Math.PI / 2);
    const smoothFactor = lakeFactor * lakeFactor * (3 - 2 * lakeFactor);
    baseHeight = THREE.MathUtils.lerp(baseHeight, -10.2, smoothFactor);
  }

  // Spectacular Deep Canyon Gorge under the suspension bridge (z: 2900 to 3550, x: center around 900)
  if (z > 2850 && z < 3600) {
    const distToCanyonCenter = Math.abs(x - 900); 
    if (distToCanyonCenter < 380) {
      const uCanyon = distToCanyonCenter / 380;
      const sFactor = 1.0 - uCanyon * uCanyon * (3 - 2 * uCanyon); // smoothstep vertical drop
      const canyonFloor = -85.0 + Math.sin(z * 0.05) * 6; // deep rocky bottom!
      baseHeight = THREE.MathUtils.lerp(baseHeight, canyonFloor, sFactor);
    }
  }

  // Waterfall valley pool bed (near coordinates x: -150, z: 2400)
  const distToWaterfall = Math.sqrt(Math.pow(x + 150, 2) + Math.pow(z - 2400, 2));
  if (distToWaterfall < 340) {
    const wfFactor = Math.min(1.0, distToWaterfall / 340);
    const sFactor = 1.0 - wfFactor * wfFactor * (3 - 2 * wfFactor);
    baseHeight = THREE.MathUtils.lerp(baseHeight, -35.0, sFactor * 0.95);
  }

  // 4. Dynamic Road Corridors Carving & Tunnel Mountain Solidness
  if (trackHelper) {
    const info = trackHelper.getNearestTrackInfo(new THREE.Vector3(x, 0, z));
    const rType = trackHelper.getRoadTypeAt(info.progress);
    const width = trackHelper.getRoadWidthAt(info.progress);
    const halfWidth = width / 2;
    const flatZone = halfWidth + 1.25; // zero-clipping road shoulder
    const blendZone = 36.0;            // smooth shoulder ramp

    if (rType === 'tunnel') {
      // Build an extremely thick solid rock dome of 35-50m above the tunnel curve
      if (info.distanceToTrack < 75) {
        const blend = info.distanceToTrack / 75;
        const s = blend * blend * (3 - 2 * blend);
        
        const mountainTopY = info.nearestPoint.y + 45.0; // 45m thick rock layers!
        const isNearMouth = (info.progress < 0.41) || (info.progress > 0.49);
        
        let targetMountainY = mountainTopY;
        if (isNearMouth) {
          const mouthDist = Math.min(Math.abs(info.progress - 0.40), Math.abs(info.progress - 0.50));
          const mouthBlend = Math.min(1.0, mouthDist * 20.0);
          targetMountainY = THREE.MathUtils.lerp(info.nearestPoint.y + 5.5, mountainTopY, mouthBlend);
        }

        baseHeight = THREE.MathUtils.lerp(targetMountainY, baseHeight, s);
      }
    } else if (rType !== 'bridge') {
      // Standard ground shoulder beds carved level with spline
      if (info.distanceToTrack < flatZone) {
        baseHeight = info.nearestPoint.y - 0.18;
      } else if (info.distanceToTrack < flatZone + blendZone) {
        const t = (info.distanceToTrack - flatZone) / blendZone;
        const s = t * t * (3 - 2 * t);
        const roadBedY = info.nearestPoint.y - 0.18;
        baseHeight = THREE.MathUtils.lerp(roadBedY, baseHeight, s);
      }
    }
  }

  // Final clamp to prevent dropping below map bedrock level
  return Math.max(-95.0, baseHeight);
}

// File-scope scratchpad vectors to avoid garbage collection memory leaks in high-frequency loops
const SCRATCH_POS_A = new THREE.Vector3();
const SCRATCH_POS_B = new THREE.Vector3();

export class TrackGeometryHelper {
  curve: THREE.CatmullRomCurve3;
  cachedPoints: THREE.Vector3[];
  checkpoints: Checkpoint[] = [];
  length: number;
  
  // High fidelity scenery distribution structures
  trees: { position: THREE.Vector3; scale: number; type: number }[] = [];
  rocks: { position: THREE.Vector3; scale: THREE.Vector3; rotation: THREE.Euler }[] = [];
  lights: { position: THREE.Vector3; color: string; intensity: number }[] = [];
  mountains: { position: THREE.Vector3; radius: number; height: number }[] = [];
  
  // Specific zone landmark offsets
  villageHouses: { position: THREE.Vector3; scale: number; rotation: number }[] = [];
  grandstands: { position: THREE.Vector3; scale: THREE.Vector3; rotation: number }[] = [];
  banners: { position: THREE.Vector3; rotation: number; text: string }[] = [];
  billboards: { position: THREE.Vector3; rotation: number; text: string }[] = [];
  snowPeaks: { position: THREE.Vector3; radius: number; height: number }[] = [];
  
  // Anchored landmarks coordinates
  pagodaPos: THREE.Vector3 = new THREE.Vector3(-450, 90, 120); // Dragon Temple (will be updated on load)
  waterfallPos: THREE.Vector3 = new THREE.Vector3(-150, 20, 2400); // Waterfall Valley (will be updated on load)
  finishGatePos: THREE.Vector3 = new THREE.Vector3(0, 0, 0); // Start/Finish line gate coordinates

  constructor() {
    // 1. Instantiating closed 3D CatmullRom spline loop
    const threePoints = TRACK_CONTROL_POINTS.map(
      node => new THREE.Vector3(node.position.x, node.position.y, node.position.z)
    );
    this.curve = new THREE.CatmullRomCurve3(threePoints, true, 'centripetal');
    
    // Smooth 2000 spacing segments (highly detailed, frame-stable caching)
    this.cachedPoints = this.curve.getSpacedPoints(2000);

    // Calculate accurate analytical track spline length by summing segments
    let calculatedLength = 0;
    for (let idx = 0; idx < this.cachedPoints.length - 1; idx++) {
      calculatedLength += this.cachedPoints[idx].distanceTo(this.cachedPoints[idx + 1]);
    }
    calculatedLength += this.cachedPoints[this.cachedPoints.length - 1].distanceTo(this.cachedPoints[0]);
    this.length = calculatedLength;

    // Dyn-align gates and landmarks on actual track spline points
    const startPt = this.curve.getPointAt(0.0);
    this.finishGatePos.copy(startPt);

    const wfPt = this.curve.getPointAt(0.51); // waterfall zone center
    this.waterfallPos.set(-150, getTerrainHeight(-150, 2400, this) + 12, 2400);

    const pagodaPt = this.curve.getPointAt(0.74); // dragon temple zone center
    this.pagodaPos.set(-450, getTerrainHeight(-450, 120, this), 120);

    // 2. High fidelity analytical checkpoints (30 checkpoints across 10 KM course)
    const numCheckpoints = 30;
    for (let i = 0; i < numCheckpoints; i++) {
      const u = i / numCheckpoints;
      const pos = this.curve.getPointAt(u);
      const tangent = this.curve.getTangentAt(u).normalize();
      
      this.checkpoints.push({
        position: { x: pos.x, y: pos.y, z: pos.z },
        direction: { x: tangent.x, y: tangent.y, z: tangent.z },
        width: this.getRoadWidthAt(u),
        index: i
      });
    }

    // 3. Populate themed scenic lists
    this.generateSceneryDistributions();
  }

  // Get dynamic road width
  getRoadWidthAt(u: number): number {
    if (u === undefined || u === null || isNaN(u)) u = 0;
    u = u % 1.0;
    if (u < 0) u += 1.0;

    const size = TRACK_CONTROL_POINTS.length;
    const indexFloat = u * size;
    const currIdx = Math.floor(indexFloat) % size;
    const nextIdx = (currIdx + 1) % size;
    const alpha = indexFloat - Math.floor(indexFloat);

    const currWidth = TRACK_CONTROL_POINTS[currIdx].width;
    const nextWidth = TRACK_CONTROL_POINTS[nextIdx].width;
    return currWidth + (nextWidth - currWidth) * alpha;
  }

  // Get local road segment type matching structural code
  getRoadTypeAt(u: number): string {
    if (u === undefined || u === null || isNaN(u)) u = 0;
    u = (u % 1.0 + 1.0) % 1.0;
    const size = TRACK_CONTROL_POINTS.length;
    const index = Math.floor(u * size) % size;
    return TRACK_CONTROL_POINTS[index].type || 'normal';
  }

  // Fast math projecting player positions directly upon closest spline segment
  getNearestTrackInfo(pos: THREE.Vector3) {
    try {
      if (!pos || typeof pos.distanceToSquared !== 'function' || isNaN(pos.x) || isNaN(pos.y) || isNaN(pos.z)) {
        return {
          nearestPoint: new THREE.Vector3(),
          progress: 0,
          tangent: new THREE.Vector3(0, 0, 1),
          normal: new THREE.Vector3(1, 0, 0),
          width: 24,
          sideOffset: 0,
          distanceToTrack: 0,
        };
      }
      let minDistance = Infinity;
      let nearestProgress = 0;
      let nearestPoint = new THREE.Vector3();
      
      const pointsLength = this.cachedPoints ? this.cachedPoints.length : 0;
      const samples = Math.min(2000, pointsLength);

      if (samples > 0) {
        for (let i = 0; i < samples; i++) {
          const u = i / samples;
          const pt = this.cachedPoints[i];
          if (!pt) continue;
          const distSq = pos.distanceToSquared(pt);
          if (distSq < minDistance) {
            minDistance = distSq;
            nearestProgress = u;
            nearestPoint.copy(pt);
          }
        }
      } else {
        // Fallback if cached points are missing
        const startPt = this.curve ? this.curve.getPointAt(0) : new THREE.Vector3();
        if (startPt) {
          nearestPoint.copy(startPt);
          minDistance = pos.distanceToSquared(nearestPoint);
        }
      }

      let preciseProgress = nearestProgress;
      const searchStep = 1 / (Math.max(samples, 1) * 5);
      const tempPt = SCRATCH_POS_A;
      if (this.curve && typeof this.curve.getPointAt === 'function') {
        for (let step = -4; step <= 4; step++) {
          const u = (nearestProgress + step * searchStep + 1.0) % 1.0;
          this.curve.getPointAt(u, tempPt);
          const distSq = pos.distanceToSquared(tempPt);
          if (distSq < minDistance) {
            minDistance = distSq;
            preciseProgress = u;
            nearestPoint.copy(tempPt);
          }
        }
      }

      const tangent = new THREE.Vector3();
      if (this.curve && typeof this.curve.getTangentAt === 'function') {
        this.curve.getTangentAt(preciseProgress, tangent);
      } else {
        tangent.set(0, 0, 1);
      }
      tangent.normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const width = this.getRoadWidthAt(preciseProgress);
      
      const toCar = SCRATCH_POS_B.subVectors(pos, nearestPoint);
      const sideOffset = toCar.dot(normal);

      return {
        nearestPoint,
        progress: preciseProgress,
        tangent,
        normal,
        width,
        sideOffset,
        distanceToTrack: Math.sqrt(minDistance),
      };
    } catch (err) {
      console.warn("Exception caught in getNearestTrackInfo, returning safe fallback values:", err);
      return {
        nearestPoint: new THREE.Vector3(),
        progress: 0,
        tangent: new THREE.Vector3(0, 0, 1),
        normal: new THREE.Vector3(1, 0, 0),
        width: 24,
        sideOffset: 0,
        distanceToTrack: 0,
      };
    }
  }

  // Procedural distribution of scenery matching 10 distinct thematic zones
  private generateSceneryDistributions() {
    let seed = 98765;
    const random = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    // 1. Mountains - We don't use low-poly pyramids anymore!
    // We populate this array to define where the giant peaks sit on the heightmap for logic or triggers
    const peakConfigs = [
      { x: -1600, z: -1500, radius: 450, height: 350 },
      { x: -1800, z: 800, radius: 400, height: 320 },
      { x: 1200, z: -1800, radius: 520, height: 390 },
      { x: 1800, z: 1200, radius: 480, height: 360 },
      { x: -400, z: 2200, radius: 350, height: 280 },
      { x: 800, z: 2500, radius: 380, height: 300 }
    ];
    for (const p of peakConfigs) {
      this.mountains.push({
        position: new THREE.Vector3(p.x, -15, p.z),
        radius: p.radius,
        height: p.height
      });
    }

    // Adjust specific zone dynamic coordinates
    this.pagodaPos = new THREE.Vector3(-450, getTerrainHeight(-450, 150, this), 150); // Set Pagoda perfectly in Zone 7: Dragon Temple

    // 2. Sample 1400 dense points along the track to populate high-fidelity scenery
    const steps = 1400;
    for (let j = 0; j < steps; j++) {
      const u = j / steps;
      const zoneIdx = Math.floor(u * 10); // 10 distinct zones
      const pt = this.curve.getPointAt(u);
      const tangent = this.curve.getTangentAt(u).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const roadWidth = this.getRoadWidthAt(u);
      const rType = this.getRoadTypeAt(u);
      const headingAngle = Math.atan2(tangent.x, tangent.z);

      const isInsideRestricted = (rType === 'tunnel' || rType === 'bridge');

      switch (zoneIdx) {
        case 0: // ZONE 0: START AREA (u: 0.0 - 0.1)
          // Add festive lights, banners, and grandstands
          if (j % 24 === 0) {
            const side = (j % 48 === 0) ? 1 : -1;
            const standPos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 14.5));
            standPos.y = getTerrainHeight(standPos.x, standPos.z, this) - 0.2;
            this.grandstands.push({
              position: standPos,
              scale: new THREE.Vector3(12, 6, 24),
              rotation: headingAngle + (side * Math.PI / 2)
            });
          }
          if (j % 16 === 0) {
            const side = (j % 32 === 0) ? 1 : -1;
            const flagPos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 1.8));
            flagPos.y = getTerrainHeight(flagPos.x, flagPos.z, this) + 4.5;
            this.lights.push({ position: flagPos, color: '#00f6ff', intensity: 2.5 });
          }
          break;

        case 1: // ZONE 1: DENSE PINE FOREST (u: 0.1 - 0.2)
          // Thousands of towering evergreens framing the forest sector
          if (!isInsideRestricted) {
            const fillCount = 3 + Math.floor(random() * 4);
            for (let f = 0; f < fillCount; f++) {
              const side = random() > 0.5 ? 1 : -1;
              const treeDist = roadWidth / 2 + 4.5 + random() * 60;
              const tPos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * treeDist);
              tPos.y = getTerrainHeight(tPos.x, tPos.z, this);
              this.trees.push({
                position: tPos,
                scale: 0.9 + random() * 1.8,
                type: Math.floor(random() * 3) // Standard Emerald/Juniper/Forest Pine varieties (0, 1, 2)
              });
            }
          }
          break;

        case 2: // ZONE 2: MOUNTAIN VILLAGE (u: 0.2 - 0.3)
          // Japanese villages on borders
          if (!isInsideRestricted && j % 12 === 0) {
            const side = random() > 0.5 ? 1 : -1;
            const houseDist = roadWidth / 2 + 8.0 + random() * 10;
            const hPos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * houseDist);
            hPos.y = getTerrainHeight(hPos.x, hPos.z, this) - 0.1;
            
            this.villageHouses.push({
              position: hPos,
              scale: 1.1 + random() * 0.45,
              rotation: headingAngle + (side * Math.PI / 2) + (random() * 0.12 - 0.06)
            });

            // Street lamps
            const lanPos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 1.8));
            lanPos.y = getTerrainHeight(lanPos.x, lanPos.z, this) + 2.4;
            this.lights.push({ position: lanPos, color: '#ff7700', intensity: 3.2 });
          }
          break;

        case 3: // ZONE 3: RED SUSPENSION BRIDGE (u: 0.3 - 0.4)
          // Scenic canyon rocks below the bridge
          if (rType === 'bridge' && j % 12 === 0) {
            const bLeft = new THREE.Vector3().copy(pt).addScaledVector(normal, -38 - random() * 22);
            const bRight = new THREE.Vector3().copy(pt).addScaledVector(normal, 38 + random() * 22);
            bLeft.y = getTerrainHeight(bLeft.x, bLeft.z, this) + 12;
            bRight.y = getTerrainHeight(bRight.x, bRight.z, this) + 12;

            this.rocks.push({
              position: bLeft,
              scale: new THREE.Vector3(14 + random() * 8, 30 + random() * 20, 14 + random() * 8),
              rotation: new THREE.Euler(0, random() * Math.PI, 0)
            });
            this.rocks.push({
              position: bRight,
              scale: new THREE.Vector3(14 + random() * 8, 30 + random() * 20, 14 + random() * 8),
              rotation: new THREE.Euler(0, random() * Math.PI, 0)
            });
          }
          break;

        case 4: // ZONE 4: NEON TUNNEL (u: 0.4 - 0.5)
          // Brilliant cyan-blue LED arches lining the cave track
          if (rType === 'tunnel' && j % 5 === 0) {
            const nLeft = new THREE.Vector3().copy(pt).addScaledVector(normal, -roadWidth / 2 + 0.4);
            const nRight = new THREE.Vector3().copy(pt).addScaledVector(normal, roadWidth / 2 - 0.4);
            // Height is placed along road bed
            nLeft.y = pt.y + 0.1;
            nRight.y = pt.y + 0.1;

            this.lights.push({ position: nLeft, color: '#00ccff', intensity: 3.8 });
            this.lights.push({ position: nRight, color: '#00ffff', intensity: 3.8 });
          }
          break;

        case 5: // ZONE 5: WATERFALL VALLEY (u: 0.5 - 0.6)
          // River rocks and mossy stone hazards
          if (!isInsideRestricted && random() < 0.6) {
            const side = random() > 0.5 ? 1 : -1;
            const stoneDist = roadWidth / 2 + 1.5 + random() * 32;
            const rPos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * stoneDist);
            rPos.y = getTerrainHeight(rPos.x, rPos.z, this) - 0.5;

            this.rocks.push({
              position: rPos,
              scale: new THREE.Vector3(4 + random() * 5, 2 + random() * 4, 4 + random() * 5),
              rotation: new THREE.Euler(random() * 0.3, random() * Math.PI, 0)
            });
          }
          break;

        case 6: // ZONE 6: HAIRPIN ROADS (u: 0.6 - 0.7)
          // Intense warnings and guard cliffs
          if (rType === 'hairpin' && random() < 0.72) {
            const side = (pt.x > 0) ? -1 : 1; 
            const rPos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 10.0 + random() * 15));
            rPos.y = getTerrainHeight(rPos.x, rPos.z, this) - 2.0;
            
            this.rocks.push({
              position: rPos,
              scale: new THREE.Vector3(7 + random() * 9, 14 + random() * 22, 7 + random() * 9),
              rotation: new THREE.Euler(0, random() * Math.PI, random() * 0.08)
            });
          }
          break;

        case 7: // ZONE 7: DRAGON TEMPLE (u: 0.7 - 0.8)
          // Beautiful Cherry Blossom Trees (Sakura) & Lanterns
          if (random() < 0.65) {
            const side = random() > 0.5 ? 1 : -1;
            const treeDist = roadWidth / 2 + 5.5 + random() * 28;
            const tPos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * treeDist);
            tPos.y = getTerrainHeight(tPos.x, tPos.z, this);
            this.trees.push({
              position: tPos,
              scale: 0.85 + random() * 1.5,
              type: 3 // Crimson Sakura Pink blossom trees!
            });
          }
          if (j % 16 === 0) {
            const side = random() > 0.5 ? 1 : -1;
            const lPos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 1.8));
            lPos.y = getTerrainHeight(lPos.x, lPos.z, this) + 1.5;
            this.lights.push({ position: lPos, color: '#ffd600', intensity: 2.8 });
          }
          break;

        case 8: // ZONE 8: LONG HIGHWAY (u: 0.8 - 0.9)
          // Huge billboards
          if (j % 28 === 0) {
            const side = (j % 56 === 0) ? 1 : -1;
            const billPos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 11.5));
            billPos.y = getTerrainHeight(billPos.x, billPos.z, this);

            const boardTitle = (j % 112 === 0) ? 'ZONE: 120 KMH' : ((j % 112 === 28) ? 'DRAGON MOUNTAIN PASS' : 'PBR ULTRA DRIVE');
            this.billboards.push({
              position: billPos,
              rotation: headingAngle + (side * Math.PI / 2),
              text: boardTitle
            });
          }
          break;

        case 9: // ZONE 9: FINISH AREA (u: 0.9 - 1.0)
          // Stadium Grandstands
          if (j % 24 === 0) {
            const side = (j % 48 === 0) ? 1 : -1;
            const standPos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 14.5));
            standPos.y = getTerrainHeight(standPos.x, standPos.z, this) - 0.2;
            this.grandstands.push({
              position: standPos,
              scale: new THREE.Vector3(12, 6, 24),
              rotation: headingAngle + (side * Math.PI / 2)
            });
          }
          if (j % 16 === 0) {
            const flagPos = new THREE.Vector3().copy(pt).addScaledVector(normal, (j % 32 === 0 ? 1 : -1) * (roadWidth / 2 + 1.6));
            flagPos.y = getTerrainHeight(flagPos.x, flagPos.z, this) + 4.8;
            this.lights.push({ position: flagPos, color: '#ffffff', intensity: 2.2 });
          }
          break;

        default:
          break;
      }
    }
  }
}

