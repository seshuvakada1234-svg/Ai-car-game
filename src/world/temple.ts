import * as THREE from 'three';
import { TrackGeometryHelper, getTerrainHeight } from '../utils/track';
import { gltfModelCache, createProceduralPagoda } from './procedural';

export function buildTemple(scene: THREE.Scene, trackHelper: TrackGeometryHelper): void {
  // --- 1. MAJESTIC PAGODA TOWER OVERLOOK & PLAZA TERRACE ---
  const pagodaMainGroup = new THREE.Group();
  pagodaMainGroup.position.copy(trackHelper.pagodaPos); 
  
  // High-fidelity Multi-tiered stone plaza foundation for the Pagoda
  const terraceSlabGeo = new THREE.BoxGeometry(22, 2.5, 22);
  const terraceSlabMat = new THREE.MeshStandardMaterial({ color: '#5b5d63', roughness: 0.92 });
  const terraceSlab = new THREE.Mesh(terraceSlabGeo, terraceSlabMat);
  terraceSlab.position.y = -1.25; // Flush the top of slab with the terrain level
  terraceSlab.castShadow = true;
  terraceSlab.receiveShadow = true;
  pagodaMainGroup.add(terraceSlab);

  // Red lacquered safety perimeter railings around the shrine overlook slab
  const railWoodMat = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.7 });
  const railGroup = new THREE.Group();
  
  const railCoords = [-10.5, 10.5];
  railCoords.forEach(cx => {
    // Left-to-right boundary rails
    const boundaryBar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.8, 21), railWoodMat);
    boundaryBar.position.set(cx, 0.4, 0);
    boundaryBar.castShadow = true;
    railGroup.add(boundaryBar);

    // Front-to-back boundary rails
    const boundaryBarY = new THREE.Mesh(new THREE.BoxGeometry(21, 0.8, 0.18), railWoodMat);
    boundaryBarY.position.set(0, 0.4, cx);
    boundaryBarY.castShadow = true;
    railGroup.add(boundaryBarY);
  });
  pagodaMainGroup.add(railGroup);

  scene.add(pagodaMainGroup);

  // Dynamic asset swap checking
  if (gltfModelCache.isLoaded && gltfModelCache.pagodaModel) {
    const gltfPagoda = gltfModelCache.pagodaModel.clone();
    const bbox = new THREE.Box3().setFromObject(gltfPagoda);
    const sz = bbox.getSize(new THREE.Vector3());
    if (sz.y > 0) {
      const sf = 15 / sz.y; 
      gltfPagoda.scale.set(sf, sf, sf);
    } else {
      gltfPagoda.scale.set(8, 8, 8);
    }
    pagodaMainGroup.add(gltfPagoda);
  } else {
    const procPagoda = createProceduralPagoda();
    procPagoda.scale.set(1.4, 1.4, 1.4);
    pagodaMainGroup.add(procPagoda);
  }

  // --- 2. TRADITIONAL RED TORII GATES AT DRAGON TEMPLE ---
  const toriiGatesGroup = new THREE.Group();
  const heavyRedSteelMat = new THREE.MeshStandardMaterial({ color: '#b22222', metalness: 0.7, roughness: 0.25 });
  const slateFootingMat = new THREE.MeshStandardMaterial({ color: '#323438', roughness: 0.98 });
  const toriiPlacements = [0.70, 0.78];

  toriiPlacements.forEach(u => {
    const pt = trackHelper.curve.getPointAt(u);
    const tangent = trackHelper.curve.getTangentAt(u).normalize();
    const angle = -Math.atan2(tangent.z, tangent.x) + Math.PI / 2;
    const width = trackHelper.getRoadWidthAt(u);

    const gate = new THREE.Group();
    gate.position.copy(pt);
    gate.rotation.y = angle;

    const pillarOffset = width / 2 + 1.2;

    // Secure concrete/stone footings going 3.5m deep under the roadway shoulder
    const footingL = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 3.5, 6), slateFootingMat);
    footingL.position.set(-pillarOffset, -1.75, 0); // plunge 1.75m beneath road deck
    footingL.receiveShadow = true;
    gate.add(footingL);

    const footingR = footingL.clone();
    footingR.position.x = pillarOffset;
    gate.add(footingR);

    // Pillars placed outside road width shoulders
    const pL = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.45, 8.5, 6), heavyRedSteelMat);
    pL.position.set(-pillarOffset, 4.25, 0);
    pL.castShadow = true;
    gate.add(pL);

    const pR = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.45, 8.5, 6), heavyRedSteelMat);
    pR.position.set(pillarOffset, 4.25, 0);
    pR.castShadow = true;
    gate.add(pR);

    // Curved overarching lintel spanning the whole roadway
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(pillarOffset * 2 + 3.0, 0.7, 1.1), heavyRedSteelMat);
    lintel.position.set(0, 8.5, 0);
    lintel.castShadow = true;
    gate.add(lintel);

    toriiGatesGroup.add(gate);
  });
  scene.add(toriiGatesGroup);
}
