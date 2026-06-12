import * as THREE from 'three';
import { TrackGeometryHelper, getTerrainHeight } from '../utils/track';

export function buildTerrain(scene: THREE.Scene, trackHelper: TrackGeometryHelper): THREE.Mesh {
  // --- 1. SET UP FOG ---
  scene.fog = new THREE.FogExp2('#bcdeff', 0.0018); // Soft mountain fog

  // --- 2. PROCEDURAL BACKGROUND SKYBOX & GROUND ENVIRONMENT ---
  // Sunset dome sky
  const skyGeo = new THREE.SphereGeometry(720, 32, 16);
  // Draw sky grad
  const createSkyTex = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0.0, '#0a1c3f'); // Deep sky blue
      grad.addColorStop(0.4, '#1b224c'); // Twilight indigo
      grad.addColorStop(0.7, '#8d2d68'); // Orchid magenta
      grad.addColorStop(0.88, '#f75b22'); // Tangy orange
      grad.addColorStop(1.0, '#ffc04d'); // Sunset yellow
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 256);
    }
    return new THREE.CanvasTexture(canvas);
  };
  const skyTex = createSkyTex();
  const skyMat = new THREE.MeshBasicMaterial({
    map: skyTex,
    side: THREE.BackSide,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // Drifting 3D Cumulus Clouds
  const cloudGroup = new THREE.Group();
  const cloudMat = new THREE.MeshLambertMaterial({
    color: '#ffdcd1', // warmed by sunset glow
    transparent: true,
    opacity: 0.82,
  });
  const cloudCount = 20;

  for (let c = 0; c < cloudCount; c++) {
    const cMesh = new THREE.Group();
    const radius = 18 + Math.random() * 24;
    const numPuffs = 3 + Math.floor(Math.random() * 5);
    for (let p = 0; p < numPuffs; p++) {
      const r = radius * (0.6 + Math.random() * 0.4);
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

  // --- 3. RECONSTRUCT CONTINUOUS HEIGHTMAP TERRAIN ---
  // Coherent continuous terrain sized 6000x7500 centered around X=200, Z=900 with 110x110 detail vertices
  const terrainGeo = new THREE.PlaneGeometry(6000, 7500, 110, 110);
  const posAttr = terrainGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const worldX = vx + 200;
    const worldZ = -vy + 900;
    // Query our unified procedural heightmap function (coherent harmonics + carved tracks + canyon/lake beds)
    const height = getTerrainHeight(worldX, worldZ, trackHelper);
    posAttr.setZ(i, height);
  }
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    color: '#1a371c', // gorgeous dark organic mossy green base
    roughness: 0.90,
    metalness: 0.05,
    flatShading: true,
  });
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.set(200, -0.5, 900);
  terrain.receiveShadow = true;
  scene.add(terrain);

  // --- 4. EMERALD JADE LAKE ---
  const lakeGeo = new THREE.PlaneGeometry(450, 450);
  const lakeMat = new THREE.MeshStandardMaterial({
    color: '#0e2d4d', // rich deep midnight teal
    roughness: 0.08,
    metalness: 0.85,
    transparent: true,
    opacity: 0.90,
  });
  const lake = new THREE.Mesh(lakeGeo, lakeMat);
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(50, -9.8, -120);
  scene.add(lake);

  // --- 5. CANYON GORGE RIVER UNDER BRIDGE ---
  const riverGeo = new THREE.PlaneGeometry(600, 480);
  const riverMat = new THREE.MeshStandardMaterial({
    color: '#0b243b', // rapid dark canyon river
    roughness: 0.05,
    metalness: 0.90,
    transparent: true,
    opacity: 0.88,
  });
  const river = new THREE.Mesh(riverGeo, riverMat);
  river.rotation.x = -Math.PI / 2;
  river.position.set(900, -34.8, 3225);
  scene.add(river);

  return terrain;
}
