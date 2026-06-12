import * as THREE from 'three';
import { TrackGeometryHelper, getTerrainHeight } from '../utils/track';

export function buildVillage(scene: THREE.Scene, trackHelper: TrackGeometryHelper): void {
  // --- 1. JAPANESE MOUNTAIN VILLAGE HOUSES WITH FOUNDATIONS ---
  const villageHousesGroup = new THREE.Group();
  const wallPlasterMat = new THREE.MeshStandardMaterial({ color: '#fcfaf2', roughness: 0.85 });
  const slateRoofMat = new THREE.MeshStandardMaterial({ color: '#1a1f2c', roughness: 0.55, flatShading: true });
  // Granite stone foundation mat to prevent floating corners on mountain slopes
  const foundationMat = new THREE.MeshStandardMaterial({ color: '#55585d', roughness: 0.95, flatShading: true });
  const woodTrimMat = new THREE.MeshStandardMaterial({ color: '#4a2f13', roughness: 0.8 });

  trackHelper.villageHouses.forEach(vh => {
    const houseGroup = new THREE.Group();
    // Slightly bury the house center slightly to seal any terrain gaps
    houseGroup.position.set(vh.position.x, vh.position.y, vh.position.z);
    houseGroup.rotation.y = vh.rotation;

    const baseWidth = 4.8 * vh.scale;
    const baseHeight = 3.2 * vh.scale;
    const baseDepth = 4.8 * vh.scale;

    // Solid deep stone basement/foundation block (buries 6m deep into bedrock)
    const foundationGeo = new THREE.BoxGeometry(baseWidth + 0.2, 6.0, baseDepth + 0.2);
    const foundationMesh = new THREE.Mesh(foundationGeo, foundationMat);
    // Positioned so the top of the stone deck is flush with the floor
    foundationMesh.position.y = -3.0;
    foundationMesh.castShadow = true;
    foundationMesh.receiveShadow = true;
    houseGroup.add(foundationMesh);

    // Main plastered drywall frame
    const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(baseWidth, baseHeight, baseDepth), wallPlasterMat);
    wallMesh.position.y = baseHeight / 2;
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    houseGroup.add(wallMesh);

    // Traditional Japanese curved pyramid roof cone
    const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(baseWidth * 0.8, 2.6 * vh.scale, 4), slateRoofMat);
    roofMesh.rotateY(Math.PI / 4); // Align roof diagonals with corners
    roofMesh.position.y = baseHeight + (2.6 * vh.scale) / 2 - 0.15 * vh.scale;
    roofMesh.castShadow = true;
    houseGroup.add(roofMesh);

    // Decorative dark wood door frame details
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8 * vh.scale, 1.0 * vh.scale), woodTrimMat);
    door.position.set(baseWidth / 2, 0.9 * vh.scale, 0);
    door.castShadow = true;
    houseGroup.add(door);

    villageHousesGroup.add(houseGroup);
  });
  scene.add(villageHousesGroup);

  // --- 2. DECORATIVE JAPANESE SMALL BRIDGES (FOOTBRIDGES) ---
  const bridgesGroup = new THREE.Group();
  const bridgeWoodMat = new THREE.MeshStandardMaterial({ color: '#8e1f18', roughness: 0.72 }); // Red lacquered wood

  // Let's spawn 3 beautiful architectural footbridges over adjacent mountain channels
  const bridgePositions = [
    { x: 1240, z: 1950, rotation: 0.4 },
    { x: 1320, z: 2200, rotation: -0.3 },
    { x: 1360, z: 2360, rotation: 1.1 }
  ];

  bridgePositions.forEach((pos, idx) => {
    const bridge = new THREE.Group();
    const terrainY = getTerrainHeight(pos.x, pos.z, trackHelper);
    bridge.position.set(pos.x, terrainY + 0.25, pos.z);
    bridge.rotation.y = pos.rotation;

    // Curved deck walkway
    const deckGeo = new THREE.BoxGeometry(3.5, 0.24, 7.5);
    const deck = new THREE.Mesh(deckGeo, woodTrimMat);
    deck.castShadow = true;
    deck.receiveShadow = true;
    bridge.add(deck);

    // Left red handrail
    const railL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, 7.5), bridgeWoodMat);
    railL.position.set(-1.65, 0.45, 0);
    railL.castShadow = true;
    bridge.add(railL);

    // Right red handrail
    const railR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, 7.5), bridgeWoodMat);
    railR.position.set(1.65, 0.45, 0);
    railR.castShadow = true;
    bridge.add(railR);

    // Vertical posts for railings
    for (let offsetZ = -3.5; offsetZ <= 3.5; offsetZ += 1.75) {
      const postL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.2, 0.24), bridgeWoodMat);
      postL.position.set(-1.65, 0.5, offsetZ);
      postL.castShadow = true;
      bridge.add(postL);

      const postR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.2, 0.24), bridgeWoodMat);
      postR.position.set(1.65, 0.5, offsetZ);
      postR.castShadow = true;
      bridge.add(postR);
    }

    // Grounded wooden pillars under the footbridge
    const pillarL = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 4.0), woodTrimMat);
    pillarL.position.set(-1.4, -2.0, 0);
    pillarL.castShadow = true;
    bridge.add(pillarL);

    const pillarR = pillarL.clone();
    pillarR.position.x = 1.4;
    bridge.add(pillarR);

    bridgesGroup.add(bridge);
  });
  scene.add(bridgesGroup);

  // --- 3. STREET LAMPS (3D POSTS + EMISSIVE GLOWING ORBS) ---
  const streetLampsGroup = new THREE.Group();
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: '#2c2d30', roughness: 0.35, metalness: 0.85 });
  const lampGlassMat = new THREE.MeshBasicMaterial({ color: '#ff9900' }); // Warm orange emissive look

  trackHelper.lights.forEach((light, lIdx) => {
    // Only place street lamps in the mountain village area (color: #ff7700)
    if (light.color === '#ff7700') {
      const lamp = new THREE.Group();
      
      // Compute the exact terrain level under the light coordinate to ground the pole flawlessly
      const terrainY = getTerrainHeight(light.position.x, light.position.z, trackHelper);
      lamp.position.set(light.position.x, terrainY, light.position.z);

      const poleHeight = 4.2;

      // Grounded metal pole
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, poleHeight, 6), lampPoleMat);
      pole.position.y = poleHeight / 2;
      pole.castShadow = true;
      lamp.add(pole);

      // Curved overhead cross banner
      const crossArm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.12), lampPoleMat);
      crossArm.position.set(0, poleHeight - 0.1, 0);
      crossArm.castShadow = true;
      lamp.add(crossArm);

      // Traditional hanging lantern box
      const lanternGeo = new THREE.BoxGeometry(0.42, 0.58, 0.42);
      const lantern = new THREE.Mesh(lanternGeo, lampPoleMat);
      lantern.position.set(0.35, poleHeight - 0.35, 0);
      lantern.castShadow = true;
      lamp.add(lantern);

      // Glowing lens globe
      const lensGeo = new THREE.SphereGeometry(0.18, 6, 6);
      const lens = new THREE.Mesh(lensGeo, lampGlassMat);
      lens.position.set(0.35, poleHeight - 0.45, 0);
      lamp.add(lens);

      // Real localized scene pointlight from the lamp head (only for the first few to keep performance at 60fps)
      if (lIdx % 2 === 0) {
        const pointLight = new THREE.PointLight('#ff7700', 3.0, 15, 1.2);
        pointLight.position.set(0.35, poleHeight - 0.45, 0);
        lamp.add(pointLight);
      }

      streetLampsGroup.add(lamp);
    }
  });
  scene.add(streetLampsGroup);
}

