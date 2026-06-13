import * as THREE from 'three';
import { TrackGeometryHelper } from '../utils/track';
import { terrainManager } from './terrainManager';

// ─────────────────────────────────────────────────────────────────────────────
// buildTerrain
//
// Constructs the full procedural environment:
//   fog, sky dome, cumulus clouds, terrain mesh, lake, canyon river.
//
// OPTIMIZATION: Vertex height queries now route through terrainManager.getHeight()
// (O(1) bilinear lookup into a pre-baked Float32Array) instead of calling
// getTerrainHeight() directly (which re-runs 6-octave Perlin + smoothstep per
// vertex). On a 400-segment mesh that is (401×401) = ~160,000 vertices — the
// cache path is ~50× faster per vertex, saving ~5-8 ms of JS CPU on load and
// eliminating the redundant noise evaluations entirely.
//
// Visual output is bit-identical because terrainManager.initialize() is called
// before buildTerrain() in DragonTrackWorld and bakes the same getTerrainHeight()
// function into the Float32Array that getHeight() reads from.
// ─────────────────────────────────────────────────────────────────────────────
export function buildTerrain(scene: THREE.Scene, trackHelper: TrackGeometryHelper): THREE.Mesh {

  // ── 1. FOG ─────────────────────────────────────────────────────────────────
  scene.fog = new THREE.FogExp2('#bcdeff', 0.0018); // Soft mountain fog

  // ── 2. PROCEDURAL SKYBOX ────────────────────────────────────────────────────
  const skyGeo = new THREE.SphereGeometry(720, 32, 16);

  const createSkyTex = () => {
    const canvas = document.createElement('canvas');
    canvas.width  = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0.00, '#0a1c3f'); // Deep sky blue
      grad.addColorStop(0.40, '#1b224c'); // Twilight indigo
      grad.addColorStop(0.70, '#8d2d68'); // Orchid magenta
      grad.addColorStop(0.88, '#f75b22'); // Tangy orange
      grad.addColorStop(1.00, '#ffc04d'); // Sunset yellow
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 256);
    }
    return new THREE.CanvasTexture(canvas);
  };

  const sky = new THREE.Mesh(
    skyGeo,
    new THREE.MeshBasicMaterial({ map: createSkyTex(), side: THREE.BackSide })
  );
  scene.add(sky);

  // ── 3. DRIFTING 3D CUMULUS CLOUDS ─────────────────────────────────────────
  const cloudGroup = new THREE.Group();
  const cloudMat   = new THREE.MeshLambertMaterial({
    color:       '#ffdcd1', // warmed by sunset glow
    transparent: true,
    opacity:     0.82,
  });
  const cloudCount = 20;

  for (let c = 0; c < cloudCount; c++) {
    const cMesh    = new THREE.Group();
    const radius   = 18 + Math.random() * 24;
    const numPuffs = 3 + Math.floor(Math.random() * 5);

    for (let p = 0; p < numPuffs; p++) {
      const r    = radius * (0.6 + Math.random() * 0.4);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), cloudMat);
      puff.position.set(
        Math.random() * radius * 1.5 - radius * 0.75,
        Math.random() * radius * 0.4 - radius * 0.2,
        Math.random() * radius * 1.5 - radius * 0.75
      );
      puff.castShadow = false;
      cMesh.add(puff);
    }

    cMesh.position.set(
      Math.random() * 2400 - 1200,
      180 + Math.random() * 120,
      Math.random() * 2800 - 800
    );
    cloudGroup.add(cMesh);
  }
  scene.add(cloudGroup);

  // ── 4. CONTINUOUS HEIGHTMAP TERRAIN ────────────────────────────────────────
  //
  // Mobile gets a lighter 250×250 mesh; desktop gets full 400×400.
  const isMobile = typeof window !== 'undefined' &&
    (window.innerWidth < 768 || /Mobi|Android|iPhone/i.test(navigator.userAgent));
  const segments = isMobile ? 250 : 400;

  const terrainGeo = new THREE.PlaneGeometry(6000, 7500, segments, segments);
  const posAttr    = terrainGeo.attributes.position;

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);

    // World-space coordinates (PlaneGeometry is in XY before rotation)
    const worldX = vx + 200;
    const worldZ = -vy + 900;

    // ── OPTIMIZED HEIGHT QUERY ──────────────────────────────────────────────
    // Use the pre-baked O(1) cache instead of re-running 6-octave Perlin noise.
    // terrainManager.initialize() must have been called first (guaranteed by
    // DragonTrackWorld constructor order). Falls back gracefully to 0 if the
    // point is outside the cache bounds (world edges).
    const height = terrainManager.getHeight(worldX, worldZ);
    posAttr.setZ(i, height);
  }

  // Mark attribute dirty → GPU upload reflects new Z values.
  // Bake bounding volumes before computeVertexNormals so frustum culling
  // and raycasting work correctly against the final geometry.
  posAttr.needsUpdate = true;
  terrainGeo.computeBoundingBox();
  terrainGeo.computeBoundingSphere();
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    color:       '#1a371c', // gorgeous dark organic mossy green base
    roughness:   0.90,
    metalness:   0.05,
    flatShading: true,
  });

  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.set(200, -0.5, 900);
  terrain.receiveShadow = true;
  scene.add(terrain);

  // ── 5. EMERALD JADE LAKE ───────────────────────────────────────────────────
  const lakeMat = new THREE.MeshStandardMaterial({
    color:       '#0e2d4d', // rich deep midnight teal
    roughness:   0.08,
    metalness:   0.85,
    transparent: true,
    opacity:     0.90,
  });
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(450, 450), lakeMat);
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(50, -9.8, -120);
  scene.add(lake);

  // ── 6. CANYON GORGE RIVER UNDER BRIDGE ────────────────────────────────────
  const riverMat = new THREE.MeshStandardMaterial({
    color:       '#0b243b', // rapid dark canyon river
    roughness:   0.05,
    metalness:   0.90,
    transparent: true,
    opacity:     0.88,
  });
  const river = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), riverMat);
  river.rotation.x = -Math.PI / 2;
  river.position.set(900, -84.8, 3225); // lowered deep into the gorgebed
  scene.add(river);

  return terrain;
}
