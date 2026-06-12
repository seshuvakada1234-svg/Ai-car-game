import * as THREE from 'three';
import { TrackGeometryHelper, getTerrainHeight } from '../utils/track';

export function buildBridge(scene: THREE.Scene, trackHelper: TrackGeometryHelper): void {
  // --- 1. DYNAMICALLY GROUNDED EAGLE PASS PILLARS ---
  // Every pillar now spans dynamically from the road spline level down to the exact terrain height
  trackHelper.curve.getSpacedPoints(180).forEach((pt, idx) => {
    const u = idx / 180;
    if (trackHelper.getRoadTypeAt(u) === 'bridge') {
      const terrainY = getTerrainHeight(pt.x, pt.z, trackHelper);
      const pillarHeight = Math.max(1.0, pt.y - terrainY);
      
      const supGeo = new THREE.CylinderGeometry(0.8, 1.2, pillarHeight, 6);
      const supMat = new THREE.MeshStandardMaterial({ color: '#2c1e12', roughness: 0.98 });
      const support = new THREE.Mesh(supGeo, supMat);
      
      // Position the pillar so its top aligns perfectly with the road, and its base is wedged in the bedrock
      support.position.set(pt.x, pt.y - pillarHeight / 2, pt.z);
      support.castShadow = true;
      support.receiveShadow = true;
      scene.add(support);
    }
  });

  // --- 2. GROUNDED SUSPENSION BRIDGE PYLON TOWERS ---
  const bridgeTowersGroup = new THREE.Group();
  const heavyRedSteelMat = new THREE.MeshStandardMaterial({ color: '#c0392b', metalness: 0.85, roughness: 0.15 });
  
  // Bridge tower coordinates at start and end of high suspension segment
  const towerProgresses = [0.301, 0.399];
  
  towerProgresses.forEach(u => {
    const pos = trackHelper.curve.getPointAt(u);
    const riverBedY = -84.8; // Canyon gorge river bottom - UPDATED!
    const towerTopY = pos.y + 42.0; // Extend towers 42m above road deck for dramatic cables!
    const totalPylonHeight = towerTopY - riverBedY;

    const tower = new THREE.Group();
    // Anchor the tower group container at the river bed to ensure absolute grounding!
    tower.position.set(pos.x, riverBedY, pos.z);

    // Left column pole spanning from floor to cable crown
    const legL = new THREE.Mesh(new THREE.BoxGeometry(2.4, totalPylonHeight, 2.4), heavyRedSteelMat);
    legL.position.set(-14, totalPylonHeight / 2, 0);
    legL.castShadow = true;
    legL.receiveShadow = true;
    tower.add(legL);

    // Right column pole
    const legR = new THREE.Mesh(new THREE.BoxGeometry(2.4, totalPylonHeight, 2.4), heavyRedSteelMat);
    legR.position.set(14, totalPylonHeight / 2, 0);
    legR.castShadow = true;
    legR.receiveShadow = true;
    tower.add(legR);

    // Lateral truss cross beams and bracing braces (X style) to look like Golden Gate Bridge
    const numCrossSections = 4;
    for (let i = 0; i < numCrossSections; i++) {
      const braceY = (totalPylonHeight * (i + 1)) / (numCrossSections + 1);
      
      // Horizontal bar
      const crossBar = new THREE.Mesh(new THREE.BoxGeometry(28, 1.8, 1.2), heavyRedSteelMat);
      crossBar.position.set(0, braceY, 0);
      crossBar.castShadow = true;
      tower.add(crossBar);

      // Diagonal cross-bracing (stunning architectural truss look!)
      if (i < numCrossSections - 1) {
        const nextBraceY = (totalPylonHeight * (i + 2)) / (numCrossSections + 1);
        const midY = (braceY + nextBraceY) / 2;
        const beamHeight = nextBraceY - braceY;
        const diagonalLength = Math.sqrt(28 * 28 + beamHeight * beamHeight);
        const diagonalAngle = Math.atan2(beamHeight, 28);

        // Positive diagonal slash
        const d1 = new THREE.Mesh(new THREE.BoxGeometry(diagonalLength, 0.8, 0.4), heavyRedSteelMat);
        d1.position.set(0, midY, 0);
        d1.rotation.z = diagonalAngle;
        d1.castShadow = true;
        tower.add(d1);

        // Negative diagonal slash
        const d2 = new THREE.Mesh(new THREE.BoxGeometry(diagonalLength, 0.8, 0.4), heavyRedSteelMat);
        d2.position.set(0, midY, 0);
        d2.rotation.z = -diagonalAngle;
        d2.castShadow = true;
        tower.add(d2);
      }
    }

    // --- 3. MAJESTIC CATENARY SUSPENSION CABLES ---
    // Chrome steel cables hanging from tower crown to bridge deck
    const numCableSegments = 40;
    const cableMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', metalness: 0.95, roughness: 0.1 });
    const sPt = trackHelper.curve.getPointAt(0.301);
    const ePt = trackHelper.curve.getPointAt(0.399);

    // If we're constructing cables, let's only do it for the main span between the two pylons
    if (u === towerProgresses[0]) {
      const cablePointsL: THREE.Vector3[] = [];
      const cablePointsR: THREE.Vector3[] = [];

      for (let s = 0; s <= numCableSegments; s++) {
        const alpha = s / numCableSegments;
        const currProgress = 0.301 + alpha * 0.098;
        const deckPt = trackHelper.curve.getPointAt(currProgress);
        
        // Catenary curve dip formula
        // y = mid_height + curvature * (x - mid_x)^2
        const parabolicFactor = Math.pow(alpha - 0.5, 2) * 4; // 1.0 at ends, 0.0 at center
        const cableY = THREE.MathUtils.lerp(deckPt.y + 1.2, towerTopY, parabolicFactor);

        const tangent = trackHelper.curve.getTangentAt(currProgress).normalize();
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

        const pL = new THREE.Vector3(deckPt.x, cableY, deckPt.z).addScaledVector(normal, 14);
        const pR = new THREE.Vector3(deckPt.x, cableY, deckPt.z).addScaledVector(normal, -14);

        cablePointsL.push(pL);
        cablePointsR.push(pR);

        // Vertical hanger rods linking catenary cable to bridge deck
        if (s > 0 && s < numCableSegments) {
          const hangerHeight = cableY - (deckPt.y + 1.0);
          const hangerGeo = new THREE.CylinderGeometry(0.08, 0.08, hangerHeight, 4);
          const hangerL = new THREE.Mesh(hangerGeo, cableMat);
          hangerL.position.set(pL.x, deckPt.y + hangerHeight / 2 + 1.0, pL.z);
          hangerL.castShadow = true;
          scene.add(hangerL);

          const hangerR = new THREE.Mesh(hangerGeo, cableMat);
          hangerR.position.set(pR.x, deckPt.y + hangerHeight / 2 + 1.0, pR.z);
          hangerR.castShadow = true;
          scene.add(hangerR);
        }
      }

      // Main thick red suspension master cable lines
      const leftCableCurve = new THREE.CatmullRomCurve3(cablePointsL);
      const rightCableCurve = new THREE.CatmullRomCurve3(cablePointsR);

      const cableGeoL = new THREE.TubeGeometry(leftCableCurve, 40, 0.32, 8, false);
      const cableGeoR = new THREE.TubeGeometry(rightCableCurve, 40, 0.32, 8, false);

      const mCableL = new THREE.Mesh(cableGeoL, heavyRedSteelMat);
      const mCableR = new THREE.Mesh(cableGeoR, heavyRedSteelMat);
      mCableL.castShadow = true;
      mCableR.castShadow = true;
      scene.add(mCableL, mCableR);
    }

    bridgeTowersGroup.add(tower);
  });
  scene.add(bridgeTowersGroup);
}

