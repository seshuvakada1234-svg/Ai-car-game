import * as THREE from 'three';
import { TrackGeometryHelper } from '../utils/track';

export function buildHairpins(scene: THREE.Scene, trackHelper: TrackGeometryHelper): void {
  // --- 1. HAIRPIN ROCKY CLIFF GUARDS ---
  const cliffGroup = new THREE.Group();
  const cliffMat = new THREE.MeshStandardMaterial({
    color: '#49423b', // rustic rock face
    roughness: 0.95,
    metalness: 0.05,
    flatShading: true,
  });

  trackHelper.curve.getSpacedPoints(120).forEach((pt, idx) => {
    const u = idx / 120;
    if (pt.y > 18 && idx % 8 === 0) {
      const tangent = trackHelper.curve.getTangentAt(u).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const roadWidth = trackHelper.getRoadWidthAt(u);
      const wall = new THREE.Mesh(new THREE.DodecahedronGeometry(7 + Math.random() * 4, 1), cliffMat);
      const sideSign = (idx % 16 === 0) ? 1 : -1;
      wall.position.copy(pt).addScaledVector(normal, sideSign * (roadWidth / 2 + 13));
      wall.position.y += Math.random() * 4 - 2;
      wall.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      wall.castShadow = false;
      wall.receiveShadow = false;
      cliffGroup.add(wall);
    }
  });
  scene.add(cliffGroup);
}
