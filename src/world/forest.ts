import * as THREE from 'three';
import { TrackGeometryHelper, getTerrainHeight } from '../utils/track';

export function buildForest(scene: THREE.Scene, trackHelper: TrackGeometryHelper): void {
  // --- OPTIMIZED INSTANCED FACETED FOREST ---
  const treeMaterials = [
    new THREE.MeshStandardMaterial({ color: '#0c3012', roughness: 0.92, flatShading: true }), // Emerald cluster
    new THREE.MeshStandardMaterial({ color: '#154a1d', roughness: 0.9, flatShading: true }),  // Forest canopy
    new THREE.MeshStandardMaterial({ color: '#1a541b', roughness: 0.88, flatShading: true }), // Highland Juniper
    new THREE.MeshStandardMaterial({ color: '#ff7fa2', roughness: 0.85, flatShading: true }), // Sakura Cherry Blossom Pink!
    new THREE.MeshStandardMaterial({ color: '#f5faff', roughness: 0.98, flatShading: true }), // Ice Frosted Snow White!
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
  const fencePostGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.3, 5);
  const fenceLogGeo = new THREE.CylinderGeometry(0.07, 0.07, 4.25, 5);
  fenceLogGeo.rotateX(Math.PI / 2); // align log horizontally

  const fenceWoodMat = new THREE.MeshStandardMaterial({
    color: '#4d3a2b',
    roughness: 0.9,
    flatShading: true
  });

  const forestSplinePts = [];
  const samples = 140;
  for (let s = 0; s <= samples; s++) {
    const u = 0.10 + (s / samples) * 0.10; // Spline progress for Pine Forest (Case 1)
    const pt = trackHelper.curve.getPointAt(u);
    const tangent = trackHelper.curve.getTangentAt(u).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const roadWidth = trackHelper.getRoadWidthAt(u);

    // Place fence posts on BOTH left and right shoulders
    [-1, 1].forEach(side => {
      const fencePost = new THREE.Mesh(fencePostGeo, fenceWoodMat);
      const postPos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * (roadWidth / 2 + 0.8));
      
      // Look up height to ground the post perfectly
      const terrainY = getTerrainHeight(postPos.x, postPos.z, trackHelper);
      fencePost.position.set(postPos.x, terrainY + 0.52, postPos.z);
      fencePost.castShadow = true;
      fencePost.receiveShadow = true;
      fencesGroup.add(fencePost);

      // Connect with horizontal logs to preceding fence post
      if (s > 0) {
        const prevU = 0.10 + ((s - 1) / samples) * 0.10;
        const prevPt = trackHelper.curve.getPointAt(prevU);
        const prevTangent = trackHelper.curve.getTangentAt(prevU).normalize();
        const prevNormal = new THREE.Vector3(-prevTangent.z, 0, prevTangent.x).normalize();
        const prevRoadWidth = trackHelper.getRoadWidthAt(prevU);
        
        const prevPostPos = new THREE.Vector3().copy(prevPt).addScaledVector(prevNormal, side * (prevRoadWidth / 2 + 0.8));
        const prevTerrainY = getTerrainHeight(prevPostPos.x, prevPostPos.z, trackHelper);

        const currentAnchor = new THREE.Vector3(postPos.x, terrainY + 0.85, postPos.z);
        const previousAnchor = new THREE.Vector3(prevPostPos.x, prevTerrainY + 0.85, prevPostPos.z);

        const connectionLog = new THREE.Mesh(fenceLogGeo, fenceWoodMat);
        // Position at midpoint of the two post heads
        connectionLog.position.copy(currentAnchor).add(previousAnchor).multiplyScalar(0.5);
        connectionLog.lookAt(currentAnchor);
        
        // Scale connection log length to match exact post distance
        const dist = currentAnchor.distanceTo(previousAnchor);
        connectionLog.scale.set(1, 1, dist / 4.25);
        connectionLog.castShadow = true;
        fencesGroup.add(connectionLog);

        // Add a second lower parallel log
        const connectionLogLower = connectionLog.clone();
        connectionLogLower.position.y -= 0.4;
        fencesGroup.add(connectionLogLower);
      }
    });
  }

  scene.add(fencesGroup);
}
