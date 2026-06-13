import * as THREE from 'three';
import { TrackGeometryHelper } from '../utils/track';
import { terrainManager } from './terrainManager';
import { lodManager } from './lodManager';

export function buildForest(scene: THREE.Scene, trackHelper: TrackGeometryHelper): void {
  // --- OPTIMIZED INSTANCED FACETED FOREST ---
  const treeMaterials = [
    new THREE.MeshStandardMaterial({ color: '#092d0d', roughness: 0.92, flatShading: true }), // Spruce Pine Dark Green
    new THREE.MeshStandardMaterial({ color: '#55872a', roughness: 0.88, flatShading: true }), // Silver Birch Soft Bright Green
    new THREE.MeshStandardMaterial({ color: '#d38312', roughness: 0.9, flatShading: true }),  // Golden/Rust Autumn Oak
    new THREE.MeshStandardMaterial({ color: '#2a6a2a', roughness: 0.92, flatShading: true }), // Wild Meadow Shrub
    new THREE.MeshStandardMaterial({ color: '#edd534', roughness: 0.95, flatShading: true }), // Canola Meadow Flower Yellow
  ];
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#3d2511', roughness: 0.95 });

  // Stylized organic leafy canopy nodes
  const foliageGeoMain = new THREE.IcosahedronGeometry(1.4, 1);
  foliageGeoMain.translate(0, 3.4, 0);

  const foliageGeoLeft = new THREE.IcosahedronGeometry(1.0, 1);
  foliageGeoLeft.translate(-0.6, 2.6, 0.3);

  const foliageGeoRight = new THREE.IcosahedronGeometry(1.1, 1);
  foliageGeoRight.translate(0.6, 2.5, -0.3);

  const foliageGeoFront = new THREE.IcosahedronGeometry(0.8, 1);
  foliageGeoFront.translate(0.1, 2.0, 0.6);

  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 2.0, 5);
  trunkGeo.translate(0, 1.0, 0);

  const treeGroups: { [key: number]: any[] } = { 0: [], 1: [], 2: [], 3: [], 4: [] };
  trackHelper.trees.forEach(tree => {
    if (treeGroups[tree.type]) {
      treeGroups[tree.type].push(tree);
    }
  });

  Object.keys(treeGroups).forEach(key => {
    const typeIdx = parseInt(key);
    const list = treeGroups[typeIdx];
    const count = list.length;
    if (count === 0) return;

    // Create multi-layer instanced clusters
    const leafMainInst = new THREE.InstancedMesh(foliageGeoMain, treeMaterials[typeIdx], count);
    const leafLeftInst = new THREE.InstancedMesh(foliageGeoLeft, treeMaterials[typeIdx], count);
    const leafRightInst = new THREE.InstancedMesh(foliageGeoRight, treeMaterials[typeIdx], count);
    const leafFrontInst = new THREE.InstancedMesh(foliageGeoFront, treeMaterials[typeIdx], count);
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, count);

    leafMainInst.castShadow = true;
    leafMainInst.receiveShadow = true;
    leafLeftInst.castShadow = true;
    leafRightInst.castShadow = true;
    leafFrontInst.castShadow = true;
    trunkInst.castShadow = true;

    const dummy = new THREE.Object3D();
    list.forEach((t, index) => {
      dummy.position.copy(t.position);
      dummy.scale.set(t.scale, t.scale, t.scale);
      dummy.rotation.y = Math.sin(index) * Math.PI; 
      dummy.updateMatrix();
      
      leafMainInst.setMatrixAt(index, dummy.matrix);
      leafLeftInst.setMatrixAt(index, dummy.matrix);
      leafRightInst.setMatrixAt(index, dummy.matrix);
      leafFrontInst.setMatrixAt(index, dummy.matrix);
      trunkInst.setMatrixAt(index, dummy.matrix);
    });

    leafMainInst.instanceMatrix.needsUpdate = true;
    leafLeftInst.instanceMatrix.needsUpdate = true;
    leafRightInst.instanceMatrix.needsUpdate = true;
    leafFrontInst.instanceMatrix.needsUpdate = true;
    trunkInst.instanceMatrix.needsUpdate = true;

    scene.add(leafMainInst, leafLeftInst, leafRightInst, leafFrontInst, trunkInst);
  });

  // Alpine Meadows: Grass Clusters and Wildflowers!
  const grassBladeGeo = new THREE.DodecahedronGeometry(0.35, 1);
  grassBladeGeo.scale(0.5, 1.8, 0.5); // stretch into sleek multi-faceted organic grass clusters
  grassBladeGeo.translate(0, 0.35, 0);
  const grassMat = new THREE.MeshStandardMaterial({ color: '#27ae60', roughness: 0.95 });
  
  // Colorful wildflower head
  const flowerGeo = new THREE.DodecahedronGeometry(0.18, 0);
  const flowerColors = ['#ff3b30', '#ffcc00', '#af52de', '#ff9500'];
  const flowerMats = flowerColors.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));

  const numGrassClumps = 500;
  const grassInst = new THREE.InstancedMesh(grassBladeGeo, grassMat, numGrassClumps);
  grassInst.castShadow = true;
  
  const flowerInsts = flowerMats.map(fm => new THREE.InstancedMesh(flowerGeo, fm, 100));
  flowerInsts.forEach(f => f.castShadow = true);

  const dummyPlant = new THREE.Object3D();
  for (let g = 0; g < numGrassClumps; g++) {
    const u = (g / numGrassClumps) % 1.0;
    const pt = trackHelper.curve.getPointAt(u);
    const tangent = trackHelper.curve.getTangentAt(u).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const roadWidth = trackHelper.getRoadWidthAt(u);
    
    const side = g % 2 === 0 ? 1 : -1;
    const offset = roadWidth / 2 + 1.2 + Math.random() * 4.0;
    const gp = new THREE.Vector3().copy(pt).addScaledVector(normal, side * offset);
    gp.y += 0.12;

    dummyPlant.position.copy(gp);
    dummyPlant.rotation.set(0, Math.random() * Math.PI, 0);
    dummyPlant.scale.set(0.6 + Math.random() * 0.8, 0.6 + Math.random() * 0.8, 0.6 + Math.random() * 0.8);
    dummyPlant.updateMatrix();
    grassInst.setMatrixAt(g, dummyPlant.matrix);

    // Place occasional flowers nearby
    if (g % 5 === 0) {
      const flowerIdx = Math.floor(Math.random() * flowerMats.length);
      const fInst = flowerInsts[flowerIdx];
      const instSlot = Math.floor(g / 5) % 100;
      
      dummyPlant.position.copy(gp).add(new THREE.Vector3(Math.random()*0.4-0.2, 0.15, Math.random()*0.4-0.2));
      dummyPlant.scale.set(0.9 + Math.random()*0.5, 0.9 + Math.random()*0.5, 0.9 + Math.random()*0.5);
      dummyPlant.updateMatrix();
      fInst.setMatrixAt(instSlot, dummyPlant.matrix);
    }
  }
  grassInst.instanceMatrix.needsUpdate = true;
  scene.add(grassInst);
  flowerInsts.forEach(f => {
    f.instanceMatrix.needsUpdate = true;
    scene.add(f);
  });

  // --- ALPINE RUSTIC WOODEN FENCES ---
  // Renders logs and wooden barriers wrapping the forest shoulder edges (progress tracking: 0.10 to 0.20)
  const fencesGroup = new THREE.Group();
  fencesGroup.name = 'scenery_forest_fences';
  const fencePostGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.3, 5);
  const fenceLogGeo = new THREE.CylinderGeometry(0.07, 0.07, 4.25, 5);
  fenceLogGeo.rotateX(Math.PI / 2); // align log horizontally

  const fenceWoodMat = new THREE.MeshStandardMaterial({
    color: '#4d3a2b',
    roughness: 0.9,
    flatShading: true
  });

  const samples = 140;
  const fencePostInst = new THREE.InstancedMesh(fencePostGeo, fenceWoodMat, 282);
  const fenceLogInst = new THREE.InstancedMesh(fenceLogGeo, fenceWoodMat, 560);

  fencePostInst.castShadow = false;
  fencePostInst.receiveShadow = true;
  fenceLogInst.castShadow = false;

  const fenceDummy = new THREE.Object3D();
  let postCount = 0;
  let logCount = 0;

  const postPositionsLeft: THREE.Vector3[] = [];
  const postPositionsRight: THREE.Vector3[] = [];

  for (let s = 0; s <= samples; s++) {
    const u = 0.10 + (s / samples) * 0.10; // Spline progress for Pine Forest (Case 1)
    const pt = trackHelper.curve.getPointAt(u);
    const tangent = trackHelper.curve.getTangentAt(u).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const roadWidth = trackHelper.getRoadWidthAt(u);

    // Place fence posts on BOTH left and right shoulders
    const pL = new THREE.Vector3().copy(pt).addScaledVector(normal, -1 * (roadWidth / 2 + 0.8));
    pL.y = terrainManager.getHeight(pL.x, pL.z) + 0.52;
    postPositionsLeft.push(pL);

    fenceDummy.position.copy(pL);
    fenceDummy.rotation.set(0, 0, 0);
    fenceDummy.scale.set(1, 1, 1);
    fenceDummy.updateMatrix();
    if (postCount < 282) {
      fencePostInst.setMatrixAt(postCount++, fenceDummy.matrix);
    }

    const pR = new THREE.Vector3().copy(pt).addScaledVector(normal, 1 * (roadWidth / 2 + 0.8));
    pR.y = terrainManager.getHeight(pR.x, pR.z) + 0.52;
    postPositionsRight.push(pR);

    fenceDummy.position.copy(pR);
    fenceDummy.updateMatrix();
    if (postCount < 282) {
      fencePostInst.setMatrixAt(postCount++, fenceDummy.matrix);
    }

    // Connect with horizontal logs to preceding fence post
    if (s > 0) {
      const pL_prev = postPositionsLeft[s - 1];
      const anchorL_curr = new THREE.Vector3(pL.x, pL.y + 0.33, pL.z);
      const anchorL_prev = new THREE.Vector3(pL_prev.x, pL_prev.y + 0.33, pL_prev.z);

      fenceDummy.position.copy(anchorL_curr).add(anchorL_prev).multiplyScalar(0.5);
      fenceDummy.lookAt(anchorL_curr);
      const distL = anchorL_curr.distanceTo(anchorL_prev);
      fenceDummy.scale.set(1, 1, distL / 4.25);
      fenceDummy.updateMatrix();
      if (logCount < 560) {
        fenceLogInst.setMatrixAt(logCount++, fenceDummy.matrix);
      }

      fenceDummy.position.y -= 0.4;
      fenceDummy.updateMatrix();
      if (logCount < 560) {
        fenceLogInst.setMatrixAt(logCount++, fenceDummy.matrix);
      }

      const pR_prev = postPositionsRight[s - 1];
      const anchorR_curr = new THREE.Vector3(pR.x, pR.y + 0.33, pR.z);
      const anchorR_prev = new THREE.Vector3(pR_prev.x, pR_prev.y + 0.33, pR_prev.z);

      fenceDummy.position.copy(anchorR_curr).add(anchorR_prev).multiplyScalar(0.5);
      fenceDummy.lookAt(anchorR_curr);
      const distR = anchorR_curr.distanceTo(anchorR_prev);
      fenceDummy.scale.set(1, 1, distR / 4.25);
      fenceDummy.updateMatrix();
      if (logCount < 560) {
        fenceLogInst.setMatrixAt(logCount++, fenceDummy.matrix);
      }

      fenceDummy.position.y -= 0.4;
      fenceDummy.updateMatrix();
      if (logCount < 560) {
        fenceLogInst.setMatrixAt(logCount++, fenceDummy.matrix);
      }
    }
  }

  fencePostInst.instanceMatrix.needsUpdate = true;
  fenceLogInst.instanceMatrix.needsUpdate = true;

  fencesGroup.add(fencePostInst, fenceLogInst);
  scene.add(fencesGroup);

  lodManager.registerSector(
    'Forest Fences',
    800, 20, 1100,
    fencesGroup,
    280, 520
  );
}
