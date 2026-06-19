/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { TrackNode, Checkpoint, Vector3D } from '../types';

// Massive 10 KM European Countryside Pass Control Points
// Loop length translates to exactly ~10.1 Kilometers in World Space
export const TRACK_CONTROL_POINTS: TrackNode[] = [
  // Zone 0: Start Area (0-1 KM, u: 0.0 - 0.1) - Meadows & paddocks
  { position: { x: 0, y: 5, z: 0 }, width: 24, type: 'straight' },       // 0: Start Grid / Finish line
  { position: { x: 100, y: 6, z: 180 }, width: 24, type: 'straight' },    // 1: Scenic farm track adjacent
  { position: { x: 250, y: 8, z: 400 }, width: 24, type: 'straight' },    // 2: Open meadows paddock straight
  { position: { x: 450, y: 10, z: 620 }, width: 22, type: 'straight' },   // 3: Woodland entry transition

  // Zone 1: Dense Forest (Birch, Oak, Pine) (1-2 KM, u: 0.1 - 0.2)
  { position: { x: 650, y: 12, z: 850 }, width: 22, type: 'normal' },     // 4: Canopy gateway
  { position: { x: 800, y: 14, z: 1100 }, width: 22, type: 'normal' },    // 5: Gentle woodland lefthand sweep
  { position: { x: 950, y: 13, z: 1350 }, width: 22, type: 'normal' },    // 6: Gentle woodland righthand sweep
  { position: { x: 1100, y: 10, z: 1600 }, width: 22, type: 'normal' },   // 7: Emerging into village outskirts

  // Zone 2: European Village (German / Swiss styled Fachwerk houses) (2-3 KM, u: 0.2 - 0.3)
  { position: { x: 1200, y: 8, z: 1850 }, width: 20, type: 'normal' },    // 8: Cozy town boundary entry
  { position: { x: 1300, y: 7, z: 2150 }, width: 20, type: 'normal' },    // 9: Narrow village stone path
  { position: { x: 1350, y: 8, z: 2450 }, width: 20, type: 'normal' },    // 10: Central wooden bazaar bridge
  { position: { x: 1300, y: 11, z: 2750 }, width: 22, type: 'normal' },   // 11: Gentle exit climb towards lake

  // Zone 3: Lake Stone Arch Bridge (3-4 KM, u: 0.3 - 0.4)
  { position: { x: 1200, y: 12, z: 3050 }, width: 22, type: 'bridge' },   // 12: Stone bridge approach base
  { position: { x: 1000, y: 12, z: 3300 }, width: 22, type: 'bridge' },   // 13: Floating over tranquil countryside lake
  { position: { x: 750, y: 12, z: 3450 }, width: 22, type: 'bridge' },    // 14: Scenic stone pillars alignment
  { position: { x: 500, y: 11, z: 3500 }, width: 22, type: 'bridge' },    // 15: Low coast edge bridge exit

  // Zone 4: Gentle Meadows & Windmill Fields (4-5 KM, u: 0.4 - 0.5) - Replacing the neon tunnel
  { position: { x: 250, y: 12, z: 3400 }, width: 22, type: 'normal' },    // 16: Sunny pasture road entrance
  { position: { x: 100, y: 14, z: 3200 }, width: 22, type: 'normal' },    // 17: Rolling meadow curves
  { position: { x: 0, y: 15, z: 2950 }, width: 22, type: 'normal' },     // 18: Wheat field bypass
  { position: { x: -80, y: 16, z: 2700 }, width: 22, type: 'normal' },    // 19: Pasture boundary curve

  // Zone 5: River Stream & Old Watermill (5-6 KM, u: 0.5 - 0.6)
  { position: { x: -150, y: 15, z: 2400 }, width: 22, type: 'normal' },  // 20: Brookside valley portal
  { position: { x: -280, y: 13, z: 2100 }, width: 22, type: 'normal' },   // 21: Stream-side dirt corridor
  { position: { x: -450, y: 12, z: 1800 }, width: 22, type: 'normal' },   // 22: Traditional watermill view curve
  { position: { x: -600, y: 14, z: 1550 }, width: 22, type: 'normal' },   // 23: Quiet valley ascent

  // Zone 6: Farm Lands & Golden Hay Fields (6-7 KM, u: 0.6 - 0.7) - replacing hairpins
  { position: { x: -750, y: 18, z: 1300 }, width: 20, type: 'normal' },  // 24: Barnyard side sweep
  { position: { x: -900, y: 20, z: 1050 }, width: 20, type: 'normal' },   // 25: Hay bales field curve
  { position: { x: -750, y: 22, z: 800 }, width: 20, type: 'normal' },    // 26: Grain silo roadside path
  { position: { x: -900, y: 24, z: 550 }, width: 20, type: 'normal' },    // 27: Tractor road turnout

  // Zone 7: Grazing Valleys & Wildflower S-Bends (7-8 KM, u: 0.7 - 0.8) - replacing pagoda temple
  { position: { x: -700, y: 22, z: 300 }, width: 22, type: 'normal' },    // 28: Rustic fence entry corridor
  { position: { x: -450, y: 18, z: 120 }, width: 22, type: 'normal' },    // 29: Sheep & cow pastures border S-bend
  { position: { x: -200, y: 15, z: -20 }, width: 22, type: 'normal' },    // 30: Small stone bridge descent
  { position: { x: -50, y: 11, z: -170 }, width: 22, type: 'normal' },    // 31: Exit pastures ridge

  // Zone 8: Rural Highway Corridor (8-9 KM, u: 0.8 - 0.9)
  { position: { x: -100, y: 10, z: -420 }, width: 24, type: 'straight' },  // 32: Standard countryside dual lane
  { position: { x: -300, y: 9, z: -720 }, width: 24, type: 'straight' },   // 33: Flat highway speedway
  { position: { x: -500, y: 7, z: -1070 }, width: 24, type: 'straight' },  // 34: Billboard speedway
  { position: { x: -600, y: 6, z: -1420 }, width: 24, type: 'straight' },  // 35: High speed exit bend

  // Zone 9: Spectator Resort & Finish Area (9-10 KM, u: 0.9 - 1.0)
  { position: { x: -400, y: 6, z: -1720 }, width: 24, type: 'straight' },  // 36: Cozy village inn bend
  { position: { x: -150, y: 5, z: -1420 }, width: 24, type: 'straight' },  // 37: Paved straightaway approach
  { position: { x: -50, y: 5, z: -720 }, width: 24, type: 'straight' },    // 38: Pre-finish gate stretch
];

// Coastal Sunset Circuit (Map 2) - 2.5 KM (2500 meters) loop track
export const COASTAL_SUNSET_CONTROL_POINTS: TrackNode[] = [
  // Zone 0: Beach Start Area (starts around x: 0, y: 1.5, z: 0)
  { position: { x: 0, y: 1.5, z: 0 }, width: 24, type: 'straight' },    // 0: Start Grid / Finish Line
  { position: { x: 100, y: 1.5, z: 120 }, width: 24, type: 'straight' }, // 1: Pit area flank
  { position: { x: 220, y: 1.5, z: 220 }, width: 24, type: 'straight' }, // 2: Coastal Highway entry

  // Zone 1: Coastal Highway (long straight alongside the ocean)
  { position: { x: 380, y: 2.0, z: 340 }, width: 26, type: 'straight' }, // 3: Ocean road entrance
  { position: { x: 550, y: 2.0, z: 460 }, width: 26, type: 'straight' }, // 4: Wave spray barriers side
  { position: { x: 740, y: 2.5, z: 540 }, width: 26, type: 'straight' }, // 5: Fast ocean sweep stretch
  { position: { x: 920, y: 3.0, z: 580 }, width: 26, type: 'straight' }, // 6: Cliff tunnel mouth approach

  // Zone 2: Neon Tunnel Section (neon blue lights inside a rocky tunnel passageway)
  { position: { x: 1080, y: 4.5, z: 520 }, width: 22, type: 'tunnel' },  // 7: Cave portal entrance
  { position: { x: 1180, y: 6.0, z: 400 }, width: 22, type: 'tunnel' },  // 8: Under-mountain blue lit run
  { position: { x: 1220, y: 7.5, z: 250 }, width: 22, type: 'tunnel' },  // 9: Curved cavern bend
  { position: { x: 1180, y: 8.5, z: 100 }, width: 22, type: 'tunnel' },  // 10: Cave portal exit

  // Zone 3: Mountain Hairpin Curves (steep climbs and sharp turns along low-poly cliffs)
  { position: { x: 1060, y: 15.0, z: -20 }, width: 18, type: 'hairpin' }, // 11: Switchback 1 ascent
  { position: { x: 950, y: 24.5, z: -100 }, width: 18, type: 'hairpin' }, // 12: Peak hairpin bend 1
  { position: { x: 800, y: 32.0, z: -80 }, width: 18, type: 'hairpin' },  // 13: Cliff face ridge straight
  { position: { x: 680, y: 35.5, z: -150 }, width: 18, type: 'hairpin' }, // 14: Peak hairpin bend 2
  { position: { x: 520, y: 24.0, z: -220 }, width: 18, type: 'hairpin' }, // 15: Rapid descent, mountain bridge

  // Zone 4: Harbor Area (containers, small cranes, factory warehouses)
  { position: { x: 380, y: 7.0, z: -280 }, width: 24, type: 'normal' },  // 16: Docks industrial entry
  { position: { x: 230, y: 3.0, z: -320 }, width: 24, type: 'normal' },  // 17: Container stack alleyways
  { position: { x: 100, y: 2.2, z: -300 }, width: 24, type: 'normal' },  // 18: Grand crane bay bypass
  { position: { x: -20, y: 1.5, z: -250 }, width: 24, type: 'normal' },  // 19: Leaving harbor gates

  // Zone 5: Spectator Grandstand & Finish Straight (fireworks, billboards, finish line banner)
  { position: { x: -100, y: 1.5, z: -180 }, width: 24, type: 'straight' }, // 20: Home stretch approach
  { position: { x: -140, y: 1.5, z: -100 }, width: 24, type: 'straight' }, // 21: Grandstand curve entry
  { position: { x: -100, y: 1.5, z: -40 }, width: 24, type: 'straight' },  // 22: High speed final straightaway
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
  let frequency = 0.00012; // wide expansive countryside landscapes
  let amplitude = 1.0;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    total += perlinNoise2d(x * frequency, z * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.52;
    frequency *= 2.1;
  }

  return total / maxValue;
}

// Gentle rolling European countryside hills (replaces sharp mountain peaks)
const PEAKS = [
  { x: -1600, z: -1500, radius: 1500, height: 60 }, // Smooth low northwest hills
  { x: -2000, z: 800, radius: 1400, height: 50 },  // Flowing grassy slopes
  { x: 1650, z: -1900, radius: 1600, height: 70 },  // Gentle landscape backdrop
  { x: 2100, z: 1100, radius: 1500, height: 55 },  // Meadow flanking mounds
  { x: -700, z: 2300, radius: 1300, height: 45 },   // Soft brookside slopes
  { x: 1100, z: 2600, radius: 1400, height: 48 },  // Village bordering mounds
  { x: 110, y: 10, z: 3100, radius: 800, height: 35 }, // Low hills near meadows
];

// High fidelity fully-integrated terrain height function with smooth carving around road splines
export function getTerrainHeight(x: number, z: number, trackHelper?: any): number {
  if (trackHelper && trackHelper.mapType === 'map2') {
    // 1. Base beach height with soft sand dunes
    const rawNoise = noiseFBm(x, z, 3);
    let baseHeight = rawNoise * 6.5 + 1.2; // soft coastal dunes

    // 2. Coastal Ocean, Tunnel Mountain, and Cliff carving
    if (typeof trackHelper.getNearestTrackInfo === 'function') {
      const info = trackHelper.getNearestTrackInfo(new THREE.Vector3(x, 0, z));
      if (info && info.nearestPoint) {
        const roadWidth = typeof trackHelper.getRoadWidthAt === 'function' ? trackHelper.getRoadWidthAt(info.progress) : 24;
        const halfWidth = roadWidth / 2;

        // Check if we are outside the road corridor
        if (info.distanceToTrack > halfWidth + 8.0) {
          // If we are on the Coastal Highway (Zone 1, progress 0.10 - 0.32) and sideOffset is negative (outer right overlook of ocean)
          if (info.progress > 0.10 && info.progress < 0.32 && info.sideOffset < 0) {
            const oceanDist = Math.max(0, -info.sideOffset - (halfWidth + 8.0));
            const tOcean = Math.min(1.0, oceanDist / 50.0);
            baseHeight = THREE.MathUtils.lerp(baseHeight, -12.0, tOcean * tOcean);
          }
        }

        // 3. Mountain ridges for the Tunnel Section (progress 0.26 to 0.46)
        if (info.progress > 0.26 && info.progress < 0.46) {
          const tunnelCenterProgress = 0.36;
          const distFromTunnelCenter = Math.abs(info.progress - tunnelCenterProgress) / 0.10; // Normalized 0 to 1
          if (distFromTunnelCenter < 1.0) {
            const mountainFalloff = 1.0 - distFromTunnelCenter; 
            const mountainY = 24.0 * Math.sin(mountainFalloff * Math.PI / 2) + 2.0;

            // Raise massive mountain above, but leave road bed alone
            if (info.distanceToTrack > halfWidth + 2.0) {
              const cliffDist = info.distanceToTrack - (halfWidth + 2.0);
              const cliffT = Math.min(1.0, cliffDist / 22.0);
              baseHeight = THREE.MathUtils.lerp(info.nearestPoint.y - 0.45, mountainY, cliffT);
            } else {
              baseHeight = info.nearestPoint.y - 0.45;
            }
          }
        }

        // 4. Cliffs for Mountain Curves (progress 0.46 to 0.65)
        if (info.progress >= 0.46 && info.progress <= 0.65) {
          if (info.distanceToTrack > halfWidth + 1.5) {
            const sideSign = info.sideOffset > 0 ? 1 : -1;
            const cliffFactor = Math.min(1.0, (info.distanceToTrack - halfWidth - 1.5) / 25.0);
            if (sideSign > 0) {
              // steep cliff mountain peak rising up on one side
              baseHeight = THREE.MathUtils.lerp(info.nearestPoint.y - 0.45, info.nearestPoint.y + 22.0, cliffFactor);
            } else {
              // steep cliff dropping down to ocean bed on the opposite side
              baseHeight = THREE.MathUtils.lerp(info.nearestPoint.y - 0.45, -12.0, cliffFactor);
            }
          } else {
            baseHeight = info.nearestPoint.y - 0.45;
          }
        }

        // 5. Hard Road/Slab carving for other zones to guarantee driving surface is flat
        if (info.distanceToTrack < halfWidth + 6.0) {
          baseHeight = info.nearestPoint.y - 0.45;
        }
      }
    }

    return Math.max(-15.0, baseHeight);
  }

  const distFromCenter = Math.sqrt(x * x + z * z);
  
  // 1. Continuous Multi-Octave Perlin noise base (6 octaves for granular valleys and hills)
  const rawNoise = noiseFBm(x, z, 6);
  let baseHeight = rawNoise * 42.0 + 8.0; // scale noise range beautifully for rolling hills (between 8 and 50 meters base)
  
  // Create beautiful, natural surrounding rolling countryside crests (outer boundary frames)
  if (distFromCenter > 420) {
    baseHeight += (distFromCenter - 420) * 0.15;
  } else {
    baseHeight += (distFromCenter - 420) * 0.02;
  }

  // 2. Sculpt Actual Rolling Countryside Hills (Smoothstep Radial Falloff)
  let hillHeight = 0;
  for (const p of PEAKS) {
    const dx = x - p.x;
    const dz = z - p.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < p.radius) {
      const t = dist / p.radius;
      const falloff = 1.0 - t * t * (3 - 2 * t); // smoothstep radial blend
      hillHeight += p.height * Math.pow(falloff, 1.5);
    }
  }
  baseHeight += hillHeight;
  
  // 3. Zone Specific Geography Sculptures
  // Tranquil European Lake Bed (centered around original Zone 9, coordinates x=50, z=-120)
  const distToLake = Math.sqrt(Math.pow(x - 50, 2) + Math.pow(z + 120, 2));
  if (distToLake < 250) {
    const lakeFactor = Math.cos(Math.min(1.0, distToLake / 250) * Math.PI / 2);
    const smoothFactor = lakeFactor * lakeFactor * (3 - 2 * lakeFactor);
    baseHeight = THREE.MathUtils.lerp(baseHeight, 1.2, smoothFactor); // shallow 1.2m lake bottom (lake surface is 4.0m)
  }

  // Countryside Stream/River under the stone bridge (z: 2850 to 3600, x: center around 900)
  if (z > 2850 && z < 3600) {
    const distToRiverCenter = Math.abs(x - 900); 
    if (distToRiverCenter < 280) {
      const uRiver = distToRiverCenter / 280;
      const sFactor = 1.0 - uRiver * uRiver * (3 - 2 * uRiver); // smoothstep vertical drop
      const riverDepth = 3.5 + Math.sin(z * 0.04) * 0.5; // tranquil shallow stream bed (river surface is 9.0m)
      baseHeight = THREE.MathUtils.lerp(baseHeight, riverDepth, sFactor * 0.88);
    }
  }

  // Brookside valley pool bed (near coordinates x: -150, z: 2400)
  const distToWaterfall = Math.sqrt(Math.pow(x + 150, 2) + Math.pow(z - 2400, 2));
  if (distToWaterfall < 300) {
    const wfFactor = Math.min(1.0, distToWaterfall / 300);
    const sFactor = 1.0 - wfFactor * wfFactor * (3 - 2 * wfFactor);
    baseHeight = THREE.MathUtils.lerp(baseHeight, 3.8, sFactor * 0.90); // shallow water bed (surface is 9.0m)
  }

  // 4. Dynamic Road Corridors Carving (Absolute priority of roads over terrain)
  if (trackHelper && typeof trackHelper.getNearestTrackInfo === 'function') {
    const info = trackHelper.getNearestTrackInfo(new THREE.Vector3(x, 0, z));
    if (info && info.nearestPoint) {
      const rType = typeof trackHelper.getRoadTypeAt === 'function' ? trackHelper.getRoadTypeAt(info.progress) : 'normal';
      const width = typeof trackHelper.getRoadWidthAt === 'function' ? trackHelper.getRoadWidthAt(info.progress) : 24;
      const halfWidth = width / 2;
      
      // Safety corridor is defined as roadWidth + 20 meters (or halfWidth + 10m on each side).
      // We extend this with a 12.0m flatZone buffer for absolute security against collision.
      const flatZone = halfWidth + 12.0; 
      const blendZone = 30.0; // smooth ramp outwards from the safe corridor

      if (rType === 'bridge') {
        // Bridges span beautifully over tunnels or waterways; carve terrain deep beneath the span (22 meters drop)
        const bridgeDepthY = info.nearestPoint.y - 22.0;
        if (info.distanceToTrack < flatZone) {
          baseHeight = bridgeDepthY;
        } else if (info.distanceToTrack < flatZone + blendZone) {
          const t = (info.distanceToTrack - flatZone) / blendZone;
          const s = t * t * (3 - 2 * t);
          baseHeight = THREE.MathUtils.lerp(bridgeDepthY, baseHeight, s);
        }
      } else if (rType === 'tunnel') {
        // Tunnels require mountain meshes above, but we carve the direct road bed path cleanly to avoid overlapping lane triangles
        if (info.distanceToTrack < halfWidth + 2.0) {
          baseHeight = info.nearestPoint.y - 0.45;
        }
      } else {
        // Normal roads: flatten inside flatZone, and ramp up beautifully outside, clamping to prevent clipping
        const roadBedY = info.nearestPoint.y - 0.45;
        if (info.distanceToTrack < flatZone) {
          baseHeight = roadBedY;
        } else if (info.distanceToTrack < flatZone + blendZone) {
          const t = (info.distanceToTrack - flatZone) / blendZone;
          const s = t * t * (3 - 2 * t);
          const rawTargetHeight = baseHeight;
          const blendedValue = THREE.MathUtils.lerp(roadBedY, rawTargetHeight, s);
          
          // Clamp adjacent terrain heights so they rise gently away from the road corridor (road Y plus gradual rise offset)
          const gradSlopeLimit = roadBedY + t * 4.5;
          baseHeight = Math.min(gradSlopeLimit, blendedValue);
        }
      }
    }
  }

  // Final clamp to prevent dropping below map bedrock level
  return Math.max(-10.0, baseHeight);
}

// File-scope scratchpad vectors to avoid garbage collection memory leaks in high-frequency loops
const SCRATCH_POS_A = new THREE.Vector3();
const SCRATCH_POS_B = new THREE.Vector3();

export class TrackGeometryHelper {
  public mapType: 'map1' | 'map2';
  curve: THREE.CatmullRomCurve3;
  cachedPoints: THREE.Vector3[];
  checkpoints: Checkpoint[] = [];
  length: number;
  public carLastIndexMap = new Map<string, number>();
  private trackInfoCache = new Map<string, { pos: THREE.Vector3; result: any }>();
  private globalLastQuery: { pos: THREE.Vector3; result: any } | null = null;
  
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

  constructor(selectedMap: 'map1' | 'map2' = 'map1') {
    this.mapType = selectedMap;

    // 1. Instantiating closed 3D CatmullRom spline loop
    const controlPoints = selectedMap === 'map2' ? COASTAL_SUNSET_CONTROL_POINTS : TRACK_CONTROL_POINTS;
    const scaleFactor = selectedMap === 'map2' ? 0.7024 : 1.0;

    const threePoints = controlPoints.map(
      node => new THREE.Vector3(
        node.position.x * scaleFactor, 
        node.position.y * (selectedMap === 'map2' ? 0.8 : 1.0), 
        node.position.z * scaleFactor
      )
    );
    this.curve = new THREE.CatmullRomCurve3(threePoints, true, 'centripetal');
    
    // Smooth 2000 spacing segments (highly detailed, frame-stable caching)
    this.cachedPoints = this.curve.getSpacedPoints(2000);

    // Calculate accurate analytical track spline length by summing segments
    let calculatedLength = 0;
    if (this.cachedPoints && this.cachedPoints.length > 1) {
      for (let idx = 0; idx < this.cachedPoints.length - 1; idx++) {
        const ptA = this.cachedPoints[idx];
        const ptB = this.cachedPoints[idx + 1];
        if (ptA && ptB && typeof ptA.distanceTo === 'function') {
          calculatedLength += ptA.distanceTo(ptB);
        }
      }
      const lastPt = this.cachedPoints[this.cachedPoints.length - 1];
      const firstPt = this.cachedPoints[0];
      if (lastPt && firstPt && typeof lastPt.distanceTo === 'function') {
        calculatedLength += lastPt.distanceTo(firstPt);
      }
    }
    this.length = calculatedLength || 4150.0;

    // Dyn-align gates and landmarks on actual track spline points
    const startPt = this.curve.getPointAt(0.0);
    this.finishGatePos.copy(startPt);

    const wfPt = this.curve.getPointAt(0.51); // waterfall zone center
    this.waterfallPos.set(-150, getTerrainHeight(-150, 2400, this) + 12, 2400);

    const pagodaPt = this.curve.getPointAt(0.74); // dragon temple zone center
    this.pagodaPos.set(-450, getTerrainHeight(-450, 120, this), 120);

    // 2. High fidelity analytical checkpoints (30 checkpoints across course)
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

    const controlPoints = this.mapType === 'map2' ? COASTAL_SUNSET_CONTROL_POINTS : TRACK_CONTROL_POINTS;
    const size = controlPoints.length;
    const indexFloat = u * size;
    const currIdx = Math.floor(indexFloat) % size;
    const nextIdx = (currIdx + 1) % size;
    const alpha = indexFloat - Math.floor(indexFloat);

    const currWidth = controlPoints[currIdx].width;
    const nextWidth = controlPoints[nextIdx].width;
    return currWidth + (nextWidth - currWidth) * alpha;
  }

  // Get local road segment type matching structural code
  getRoadTypeAt(u: number): string {
    if (u === undefined || u === null || isNaN(u)) u = 0;
    u = (u % 1.0 + 1.0) % 1.0;
    const controlPoints = this.mapType === 'map2' ? COASTAL_SUNSET_CONTROL_POINTS : TRACK_CONTROL_POINTS;
    const size = controlPoints.length;
    const index = Math.floor(u * size) % size;
    return controlPoints[index].type || 'normal';
  }

  // Fast math projecting player positions directly upon closest spline segment
  getNearestTrackInfo(pos: THREE.Vector3, carId?: string) {
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

      // Check cache
      if (carId) {
        const cached = this.trackInfoCache.get(carId);
        if (cached && pos.distanceToSquared(cached.pos) < 0.01) {
          return {
            nearestPoint: cached.result.nearestPoint.clone(),
            progress: cached.result.progress,
            tangent: cached.result.tangent.clone(),
            normal: cached.result.normal.clone(),
            width: cached.result.width,
            sideOffset: cached.result.sideOffset,
            distanceToTrack: cached.result.distanceToTrack,
          };
        }
      } else if (this.globalLastQuery && pos.distanceToSquared(this.globalLastQuery.pos) < 0.01) {
        return {
          nearestPoint: this.globalLastQuery.result.nearestPoint.clone(),
          progress: this.globalLastQuery.result.progress,
          tangent: this.globalLastQuery.result.tangent.clone(),
          normal: this.globalLastQuery.result.normal.clone(),
          width: this.globalLastQuery.result.width,
          sideOffset: this.globalLastQuery.result.sideOffset,
          distanceToTrack: this.globalLastQuery.result.distanceToTrack,
        };
      }

      let minDistance = Infinity;
      let nearestProgress = 0;
      let nearestPoint = new THREE.Vector3();
      
      const pointsLength = this.cachedPoints ? this.cachedPoints.length : 0;
      const samples = Math.min(500, pointsLength);

      let foundIndex = -1;
      let lastCachedIdx = carId ? this.carLastIndexMap.get(carId) : undefined;

      if (lastCachedIdx !== undefined && samples > 0) {
        // Fast search: scan +-20 points around cached index
        for (let offset = -20; offset <= 20; offset++) {
          const i = (lastCachedIdx + offset + samples) % samples;
          const pt = this.cachedPoints[i];
          if (!pt || typeof pt.distanceToSquared !== 'function' || !pos || typeof pos.distanceToSquared !== 'function') continue;
          const distSq = pos.distanceToSquared(pt);
          if (!isNaN(distSq) && distSq < minDistance) {
            minDistance = distSq;
            nearestProgress = i / samples;
            nearestPoint.copy(pt);
            foundIndex = i;
          }
        }
      } else if (samples > 0) {
        // Full scan fallback
        for (let i = 0; i < samples; i++) {
          const pt = this.cachedPoints[i];
          if (!pt || typeof pt.distanceToSquared !== 'function' || !pos || typeof pos.distanceToSquared !== 'function') continue;
          const distSq = pos.distanceToSquared(pt);
          if (!isNaN(distSq) && distSq < minDistance) {
            minDistance = distSq;
            nearestProgress = i / samples;
            nearestPoint.copy(pt);
            foundIndex = i;
          }
        }
      } else {
        // Fallback if cached points are missing
        const startPt = this.curve ? this.curve.getPointAt(0) : new THREE.Vector3();
        if (startPt) {
          nearestPoint.copy(startPt);
          if (pos && typeof pos.distanceToSquared === 'function' && nearestPoint && typeof nearestPoint.distanceToSquared === 'function') {
            const distSq = pos.distanceToSquared(nearestPoint);
            if (!isNaN(distSq)) {
              minDistance = distSq;
            }
          }
        }
      }

      if (carId && foundIndex !== -1) {
        this.carLastIndexMap.set(carId, foundIndex);
      }

      let preciseProgress = nearestProgress;
      if (isNaN(preciseProgress) || preciseProgress === undefined || preciseProgress === null) {
        preciseProgress = 0;
      }
      const searchStep = 1 / (Math.max(samples, 1) * 5);
      const tempPt = SCRATCH_POS_A;
      if (this.curve && typeof this.curve.getPointAt === 'function') {
        for (let step = -2; step <= 2; step++) {
          let u = (nearestProgress + step * searchStep + 1.0) % 1.0;
          if (isNaN(u) || u === undefined || u === null) u = 0.0;
          try {
            this.curve.getPointAt(u, tempPt);
            if (tempPt && typeof tempPt.distanceToSquared === 'function' && pos && typeof pos.distanceToSquared === 'function') {
              const distSq = pos.distanceToSquared(tempPt);
              if (!isNaN(distSq) && distSq < minDistance) {
                minDistance = distSq;
                preciseProgress = u;
                nearestPoint.copy(tempPt);
              }
            }
          } catch (e) {
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
      const width = this.getRoadWidthAt(preciseProgress);
      
      const toCar = SCRATCH_POS_B.subVectors(pos, nearestPoint);
      const sideOffset = toCar.dot(normal);

      const resultValue = {
        nearestPoint: nearestPoint.clone(),
        progress: preciseProgress,
        tangent: tangent.clone(),
        normal: normal.clone(),
        width,
        sideOffset,
        distanceToTrack: Math.sqrt(minDistance === Infinity ? 0 : minDistance),
      };

      if (carId) {
        if (this.trackInfoCache.size > 200) {
          this.trackInfoCache.clear();
        }
        this.trackInfoCache.set(carId, { pos: pos.clone(), result: resultValue });
      } else {
        this.globalLastQuery = { pos: pos.clone(), result: resultValue };
      }

      return {
        nearestPoint,
        progress: preciseProgress,
        tangent,
        normal,
        width,
        sideOffset,
        distanceToTrack: resultValue.distanceToTrack,
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

  // Procedural distribution of scenery matching 10 distinct thematic European zones
  private generateSceneryDistributions() {
    if (this.mapType === 'map2') {
      this.generateCoastalSunsetScenery();
      return;
    }
    let seed = 98765;
    const random = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    // 1. Hills and ridges
    const peakConfigs = [
      { x: -1600, z: -1500, radius: 1500, height: 60 },
      { x: -2000, z: 800, radius: 1400, height: 50 },
      { x: 1650, z: -1900, radius: 1600, height: 70 },
      { x: 2100, z: 1100, radius: 1500, height: 55 },
      { x: -700, z: 2300, radius: 1300, height: 45 },
      { x: 1100, z: 2600, radius: 1400, height: 48 }
    ];
    for (const p of peakConfigs) {
      this.mountains.push({
         position: new THREE.Vector3(p.x, -5, p.z),
         radius: p.radius,
         height: p.height
      });
    }

    // Align specific landmarks
    this.pagodaPos = new THREE.Vector3(-450, getTerrainHeight(-450, 120, this), 120); // Central Town Church
    this.waterfallPos = new THREE.Vector3(-150, getTerrainHeight(-150, 2400, this) + 2, 2400); // Old Brookside Watermill

    // 2. Sample 600 detailed points along the course to achieve heavy forest density (10,000+ trees)
    const steps = 600;
    for (let j = 0; j < steps; j++) {
      const u = j / steps;
      const zoneIdx = Math.floor(u * 10); // 10 distinct zones
      const pt = this.curve.getPointAt(u);
      const tangent = this.curve.getTangentAt(u).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const roadWidth = this.getRoadWidthAt(u);
      const rType = this.getRoadTypeAt(u);
      const headingAngle = Math.atan2(tangent.x, tangent.z);

      const isInsideRestricted = (rType === 'bridge');

      // Heavy open-world tree generation (forest density covers all background hills)
      if (!isInsideRestricted) {
        // Spawn 2 to 3 trees in random placement clusters at every step
        const clusterCount = 2 + Math.floor(random() * 2);
        for (let tc = 0; tc < clusterCount; tc++) {
          const side = random() > 0.5 ? 1 : -1;
          // Spawn trees strictly at least 15 meters from the road edge
          const treeOffset = roadWidth / 2 + 15.2 + random() * 140.0;
          const treePos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * treeOffset);
          treePos.y = getTerrainHeight(treePos.x, treePos.z, this);

          // STRICT COLLISION & ENVIRONMENT CHECKS:
          // 1. Minimum distance from road is 15 meters from road edge (halfWidth + 15m)
          const tInfo = this.getNearestTrackInfo(treePos);
          if (tInfo && tInfo.nearestPoint) {
            const minTreeDist = tInfo.width / 2 + 15.0;
            if (tInfo.distanceToTrack < minTreeDist) {
              continue; // Reject tree!
            }
          }

          // 2. Prevent trees spawning inside deep lakes, rivers, or above high mountain tops (exceeding 52m)
          if (treePos.y > 52.0 || treePos.y < 1.0) {
            continue; // Reject tree!
          }

          // Select tree type:
          // 0 = Spruce Pine, 1 = Silver Birch, 2 = Autumn Oak, 3 = Shrub Bush, 4 = Wildflower
          let tType = 0;
          const rand = random();
          if (rand < 0.35) {
            tType = 0; // Pine
          } else if (rand < 0.65) {
            tType = 1; // Birch
          } else if (rand < 0.82) {
            tType = 2; // Oak
          } else {
            tType = 3; // Shrub
          }

          this.trees.push({
            position: treePos,
            scale: 0.8 + random() * 1.5,
            type: tType
          });
        }
      }

      switch (zoneIdx) {
        case 0: // ZONE 0: START AREA (u: 0.0 - 0.1) - Meadows & Paddocks
          if (j % 30 === 0) {
            const side = (j % 60 === 0) ? 1 : -1;
            const standPos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 16.0));
            standPos.y = getTerrainHeight(standPos.x, standPos.z, this) - 0.1;
            this.grandstands.push({
              position: standPos,
              scale: new THREE.Vector3(10, 5, 20),
              rotation: headingAngle + (side * Math.PI / 2)
            });
          }
          if (j % 20 === 0) {
            const side = (j % 40 === 0) ? 1 : -1;
            const flagPos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 4.5));
            flagPos.y = getTerrainHeight(flagPos.x, flagPos.z, this) + 4.0;
            this.lights.push({ position: flagPos, color: '#ffeaad', intensity: 2.0 }); // warm morning glow lamp
          }
          break;

         case 1: // ZONE 1: DENSE FOREST (Birch, Oak, Pine) (u: 0.1 - 0.2)
          // Handled by the heavy open tree generator above
          break;

        case 2: // ZONE 2: COZY GERMAN/SWISS COUNTRY VILLAGE (u: 0.2 - 0.3)
          if (!isInsideRestricted && j % 15 === 0) {
            const side = random() > 0.5 ? 1 : -1;
            const houseDist = roadWidth / 2 + 15.0 + random() * 8;
            const hPos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * houseDist);
            hPos.y = getTerrainHeight(hPos.x, hPos.z, this) - 0.1;
            
            this.villageHouses.push({
              position: hPos,
              scale: 1.0 + random() * 0.4,
              rotation: headingAngle + (side * Math.PI / 2) + (random() * 0.1 - 0.05)
            });

            // Street lamps
            const lanPos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 4.5));
            lanPos.y = getTerrainHeight(lanPos.x, lanPos.z, this) + 2.5;
            this.lights.push({ position: lanPos, color: '#ff9900', intensity: 3.5 }); // Cozy golden orange streetlights
          }
          break;

        case 3: // ZONE 3: LAKE & STONE BRIDGE ROAD (u: 0.3 - 0.4)
          if (rType === 'bridge' && j % 15 === 0) {
            const bLeft = new THREE.Vector3().copy(pt).addScaledVector(normal, -20 - random() * 10);
            const bRight = new THREE.Vector3().copy(pt).addScaledVector(normal, 20 + random() * 10);
            bLeft.y = getTerrainHeight(bLeft.x, bLeft.z, this) + 3;
            bRight.y = getTerrainHeight(bRight.x, bRight.z, this) + 3;

            const infoL = this.getNearestTrackInfo(bLeft);
            if (infoL && infoL.nearestPoint && infoL.distanceToTrack >= infoL.width / 2 + 15.0) {
              this.rocks.push({
                position: bLeft,
                scale: new THREE.Vector3(6 + random() * 4, 10 + random() * 12, 6 + random() * 4),
                rotation: new THREE.Euler(0, random() * Math.PI, 0)
              });
            }

            const infoR = this.getNearestTrackInfo(bRight);
            if (infoR && infoR.nearestPoint && infoR.distanceToTrack >= infoR.width / 2 + 15.0) {
              this.rocks.push({
                position: bRight,
                scale: new THREE.Vector3(6 + random() * 4, 10 + random() * 12, 6 + random() * 4),
                rotation: new THREE.Euler(0, random() * Math.PI, 0)
              });
            }
          }
          break;

        case 4: // ZONE 4: MEADOWS AND WINDMILL FIELDS (u: 0.4 - 0.5)
          // Rural windmills billboard markers
          if (j % 55 === 0) {
            const side = (j % 110 === 0) ? 1 : -1;
            const billPos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 16));
            billPos.y = getTerrainHeight(billPos.x, billPos.z, this);
            this.billboards.push({
              position: billPos,
              rotation: headingAngle + (side * Math.PI / 2),
              text: 'WINDMILL VIEWPOINT'
            });
          }
          break;

        case 5: // ZONE 5: BROOKSIDE VALLEYS (u: 0.5 - 0.6)
          if (!isInsideRestricted && random() < 0.4) {
            const side = random() > 0.5 ? 1 : -1;
            const stoneDist = roadWidth / 2 + 15.5 + random() * 20;
            const rPos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * stoneDist);
            rPos.y = getTerrainHeight(rPos.x, rPos.z, this) - 0.2;

            const infoRock = this.getNearestTrackInfo(rPos);
            if (infoRock && infoRock.nearestPoint && infoRock.distanceToTrack >= infoRock.width / 2 + 15.0) {
              this.rocks.push({
                position: rPos,
                scale: new THREE.Vector3(3 + random() * 3, 2 + random() * 2, 3 + random() * 3),
                rotation: new THREE.Euler(random() * 0.2, random() * Math.PI, 0)
              });
            }
          }
          break;

        case 6: // ZONE 6: FARM BARNYARDS & SILOS (u: 0.6 - 0.7)
          if (j % 50 === 0) {
            const side = (j % 100 === 0) ? 1 : -1;
            const billPos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 16));
            billPos.y = getTerrainHeight(billPos.x, billPos.z, this);
            this.billboards.push({
              position: billPos,
              rotation: headingAngle + (side * Math.PI / 2),
              text: 'RURAL HARVESTS'
            });
          }
          break;

        case 7: // ZONE 7: COWS & PASTORAL S-BENDS (u: 0.7 - 0.8)
          if (j % 30 === 0) {
            const lPos = new THREE.Vector3().copy(pt).addScaledVector(normal, (j % 60 === 0 ? 1 : -1) * (roadWidth / 2 + 4.5));
            lPos.y = getTerrainHeight(lPos.x, lPos.z, this) + 1.5;
            this.lights.push({ position: lPos, color: '#ffd600', intensity: 2.2 });
          }
          break;

        case 8: // ZONE 8: RURAL HIGHWAY CORRIDOR (u: 0.8 - 0.9)
          if (j % 30 === 0) {
            const side = (j % 60 === 0) ? -1 : 1;
            const billPos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 16));
            billPos.y = getTerrainHeight(billPos.x, billPos.z, this);

            this.billboards.push({
              position: billPos,
              rotation: headingAngle + (side * Math.PI / 2),
              text: 'SPEED LIMIT: 80'
            });
          }
          break;

        case 9: // ZONE 9: SPECTATOR RESORT & HOTELS (u: 0.9 - 1.0)
          if (j % 35 === 0) {
            const side = (j % 70 === 0) ? 1 : -1;
            const standPos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 16));
            standPos.y = getTerrainHeight(standPos.x, standPos.z, this) - 0.1;
            this.grandstands.push({
              position: standPos,
              scale: new THREE.Vector3(10, 5, 20),
              rotation: headingAngle + (side * Math.PI / 2)
            });
          }
          if (j % 20 === 0) {
            const flagPos = new THREE.Vector3().copy(pt).addScaledVector(normal, (j % 40 === 0 ? 1 : -1) * (roadWidth / 2 + 4.5));
            flagPos.y = getTerrainHeight(flagPos.x, flagPos.z, this) + 4.5;
            this.lights.push({ position: flagPos, color: '#ffffff', intensity: 2.0 });
          }
          break;

        default:
          break;
      }
    }
  }

  // Procedural distribution of scenery for Coastal Sunset Circuit (Map 2)
  private generateCoastalSunsetScenery() {
    let seed = 12345;
    const random = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    // 1. Add low coastal hills/mountains configs (only 2 basic ones for backing scenery)
    this.mountains.push({
      position: new THREE.Vector3(1400, -5, 600),
      radius: 800,
      height: 35
    });
    this.mountains.push({
      position: new THREE.Vector3(900, -5, -800),
      radius: 900,
      height: 45
    });

    // 2. Loop through 350 spacing points to place assets along the Coastal Sunset track
    const steps = 350;
    for (let j = 0; j < steps; j++) {
      const u = j / steps;
      const pt = this.curve.getPointAt(u);
      const tangent = this.curve.getTangentAt(u).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const roadWidth = this.getRoadWidthAt(u);
      const rType = this.getRoadTypeAt(u);
      const headingAngle = Math.atan2(tangent.x, tangent.z);

      // --- SECTION 1: Beach Start Area (u: 0.0 to 0.12) ---
      if (u >= 0.0 && u < 0.12) {
        // Grandstand and Pits
        if (j === 5 || j === 15) {
          const side = -1; // place on outer left side
          const standY = getTerrainHeight(pt.x + normal.x * side * (roadWidth / 2 + 15), pt.z + normal.z * side * (roadWidth / 2 + 15), this);
          this.grandstands.push({
            position: new THREE.Vector3().copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 14.5)),
            scale: new THREE.Vector3(1.2, 1.2, 1.2),
            rotation: headingAngle
          });
        }
        
        // Spawn Palm Trees (Birch/palm representational trunk)
        if (j % 12 === 0) {
          const side = random() > 0.5 ? 1 : -1;
          const treePos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 10.0 + random() * 12.0));
          treePos.y = getTerrainHeight(treePos.x, treePos.z, this);
          this.trees.push({
            position: treePos,
            scale: 1.0 + random() * 0.8,
            type: 1 // Birch / Palm trunk
          });
        }

        // Billboards
        if (j % 20 === 0) {
          const bPos = new THREE.Vector3().copy(pt).addScaledVector(normal, 1 * (roadWidth / 2 + 6.0));
          this.billboards.push({
            position: bPos,
            rotation: headingAngle + Math.PI / 2,
            text: 'SUNSET BEACH'
          });
        }
      }

      // --- SECTION 2: Coastal Highway (u: 0.12 to 0.28) ---
      else if (u >= 0.12 && u < 0.28) {
        // Guard rails (rocks/barriers) on the outer right (ocean overlook side)
        if (j % 4 === 0) {
          const side = -1; // right side overlooking ocean
          const rfPos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 1.2));
          rfPos.y = pt.y + 0.55;
          // Spawn rocks as guard barriers
          this.rocks.push({
            position: rfPos,
            scale: new THREE.Vector3(1.3, 0.6, 1.3),
            rotation: new THREE.Euler(0, random() * Math.PI, 0)
          });
        }

        // Low-poly palms/shrub on left side
        if (j % 10 === 0) {
          const side = 1;
          const treePos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 11.0 + random() * 15.0));
          treePos.y = getTerrainHeight(treePos.x, treePos.z, this);
          this.trees.push({
            position: treePos,
            scale: 0.8 + random() * 0.8,
            type: 3 // shrub
          });
        }

        // Roadside Rocks on left
        if (j % 16 === 0) {
          const rPos = new THREE.Vector3().copy(pt).addScaledVector(normal, 1 * (roadWidth / 2 + 6.0));
          rPos.y = getTerrainHeight(rPos.x, rPos.z, this) + 0.4;
          this.rocks.push({
            position: rPos,
            scale: new THREE.Vector3(3.0 + random() * 4.0, 3.0 + random() * 4.0, 3.0 + random() * 4.0),
            rotation: new THREE.Euler(random(), random(), random())
          });
        }
      }

      // --- SECTION 3: Neon Tunnel Section (u: 0.28 to 0.44) ---
      else if (u >= 0.28 && u < 0.44) {
        // Neon blue lights inside tunnel
        // Limit is crucial: maximum 10 lights on map! Let's place exactly 6 neon lights inside the tunnel zone.
        if (j % 18 === 0 && this.lights.length < 6) {
          const lightPos = new THREE.Vector3().copy(pt);
          lightPos.y += 4.5; // overhead center hanging light
          this.lights.push({
            position: lightPos,
            color: '#00f6ff', // neon cyan blue
            intensity: 75
          });
        }
        
        // Spawn mountain backing rocks above the tunnel
        if (j % 15 === 0) {
          const side = random() > 0.5 ? 1.5 : -1.5;
          const rPos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 14.0));
          rPos.y = pt.y + 12.0;
          this.rocks.push({
            position: rPos,
            scale: new THREE.Vector3(12.0, 12.0, 12.0),
            rotation: new THREE.Euler(random() * 0.5, random() * 3.14, 0)
          });
        }
      }

      // --- SECTION 4: Mountain Curves (u: 0.44 to 0.64) ---
      else if (u >= 0.44 && u < 0.64) {
        // High density rocks along cliff walls (left side rises up, right side drops down)
        if (j % 5 === 0) {
          const rPos = new THREE.Vector3().copy(pt).addScaledVector(normal, 1 * (roadWidth / 2 + 4.2));
          rPos.y = getTerrainHeight(rPos.x, rPos.z, this) + 0.5;
          this.rocks.push({
            position: rPos,
            scale: new THREE.Vector3(5.0 + random() * 6.0, 8.0 + random() * 12.0, 5.0 + random() * 6.0),
            rotation: new THREE.Euler(0, random() * Math.PI, 0)
          });
        }

        // Pine trees on mountain ledges
        if (j % 12 === 0) {
          const side = random() > 0.5 ? 1 : -1;
          const treePos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 8.5 + random() * 10.0));
          treePos.y = getTerrainHeight(treePos.x, treePos.z, this);
          if (treePos.y > pt.y - 2.0 && treePos.y < pt.y + 20.0) {
            this.trees.push({
              position: treePos,
              scale: 0.9 + random() * 1.3,
              type: 0 // Spruce Pine
            });
          }
        }
      }

      // --- SECTION 5: Harbor Area (u: 0.64 to 0.88) ---
      else if (u >= 0.64 && u < 0.88) {
        // Warehouses, factories & shipping containers
        if (j % 15 === 0 && this.villageHouses.length < 30) {
          const side = random() > 0.5 ? 1 : -1;
          const housePos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 12.0 + random() * 8.0));
          housePos.y = getTerrainHeight(housePos.x, housePos.z, this);
          this.villageHouses.push({
            position: housePos,
            scale: 1.5 + random() * 0.8,
            rotation: headingAngle + Math.PI / 2
          });
        }

        // Container stacks: shipping structures
        if (j % 8 === 0) {
          const side = random() > 0.5 ? 1 : -1;
          const boxPos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 5.5));
          boxPos.y = pt.y + 0.5;
          this.villageHouses.push({
            position: boxPos,
            scale: 0.7,
            rotation: headingAngle
          });
        }
        
        // Small trees/palm on the sidewalk
        if (j % 14 === 0) {
          const treePos = new THREE.Vector3().copy(pt).addScaledVector(normal, -1 * (roadWidth / 2 + 8.0));
          treePos.y = getTerrainHeight(treePos.x, treePos.z, this);
          this.trees.push({
            position: treePos,
            scale: 0.8 + random() * 0.5,
            type: 1 // palm
          });
        }
      }

      // --- SECTION 6: Finish Straight (u: 0.88 to 1.0) ---
      else {
        // Grandstand, finish banner, and street lights
        if (j === steps - 12) {
          // Overhead finish banner gate at starting line
          this.banners.push({
            position: new THREE.Vector3().copy(pt),
            rotation: headingAngle,
            text: 'FINISH'
          });
          
          // Place 2 finish lights near the starting lane banner!
          const lPos1 = new THREE.Vector3().copy(pt).addScaledVector(normal, roadWidth / 2 + 2);
          lPos1.y += 6.0;
          this.lights.push({
            position: lPos1,
            color: '#ffe11a', // golden orange sunset light
            intensity: 45
          });

          const lPos2 = new THREE.Vector3().copy(pt).addScaledVector(normal, -roadWidth / 2 - 2);
          lPos2.y += 6.0;
          this.lights.push({
            position: lPos2,
            color: '#ffe11a',
            intensity: 45
          });
        }

        // Billboards & Grandstand spectating zone
        if (j % 16 === 0) {
          const standPos = new THREE.Vector3().copy(pt).addScaledVector(normal, 1 * (roadWidth / 2 + 12.0));
          this.grandstands.push({
            position: standPos,
            scale: new THREE.Vector3(1.1, 1.1, 1.1),
            rotation: headingAngle
          });
        }

        if (j % 10 === 0) {
          const side = random() > 0.5 ? 1 : -1;
          const treePos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 10.0 + random() * 8.0));
          treePos.y = getTerrainHeight(treePos.x, treePos.z, this);
          this.trees.push({
            position: treePos,
            scale: 1.0 + random() * 0.6,
            type: 1 // palm
          });
        }
      }
    }

    // Safety checks: double-check constraints
    if (this.trees.length > 300) {
      this.trees = this.trees.slice(0, 300);
    }
    const housesLimit = 40 - this.grandstands.length;
    if (this.villageHouses.length > housesLimit) {
      this.villageHouses = this.villageHouses.slice(0, housesLimit);
    }
    if (this.lights.length > 10) {
      this.lights = this.lights.slice(0, 10);
    }

    console.log(`Coastal Sunset Scenery generated: ${this.trees.length} trees, ${this.villageHouses.length} warehouses, ${this.grandstands.length} grandstands, ${this.lights.length} lights.`);
  }
}

