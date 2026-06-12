import * as THREE from 'three';
import { TrackGeometryHelper } from '../utils/track';

export function buildTunnel(scene: THREE.Scene, trackHelper: TrackGeometryHelper): void {
  // --- 1. PROCEDURAL TUNNEL ARCHES & MOUTHS ---
  const tunnelGroup = new THREE.Group();
  trackHelper.curve.getSpacedPoints(180).forEach((pt, idx) => {
    const u = idx / 180;
    const type = trackHelper.getRoadTypeAt(u);
    
    if (type === 'tunnel') {
      const tangent = trackHelper.curve.getTangentAt(u).normalize();
      const width = trackHelper.getRoadWidthAt(u);

      // Heavy reinforced realistic stone tunnel archway
      const tunnelArchGeo = new THREE.CylinderGeometry(width / 2 + 0.8, width / 2 + 1.2, 4.2, 16, 1, true, 0, Math.PI);
      const tunnelArchMat = new THREE.MeshStandardMaterial({
        color: '#2a2c2f', // concrete tunnel
        roughness: 0.9,
        metalness: 0.1,
        side: THREE.DoubleSide,
        flatShading: true,
      });
      const arch = new THREE.Mesh(tunnelArchGeo, tunnelArchMat);
      arch.position.copy(pt);
      arch.rotation.z = Math.PI / 2; // arch ceiling
      arch.rotation.y = -Math.atan2(tangent.z, tangent.x);
      tunnelGroup.add(arch);

      // Add safety warning yellow stripes at both outer entrance mouths!
      const isMouth = idx > 0 && (trackHelper.getRoadTypeAt((idx - 1) / 180) !== 'tunnel' || trackHelper.getRoadTypeAt((idx + 1) / 180) !== 'tunnel');
      if (isMouth) {
        const mouthCapGeo = new THREE.CylinderGeometry(width / 2 + 1.2, width / 2 + 1.4, 0.4, 16, 1, true, 0, Math.PI);
        mouthCapGeo.rotateZ(Math.PI / 2);
        mouthCapGeo.rotateY(-Math.atan2(tangent.z, tangent.x));
        const stripeCanvas = document.createElement('canvas');
        stripeCanvas.width = 128;
        stripeCanvas.height = 32;
        const sCtx = stripeCanvas.getContext('2d');
        if (sCtx) {
          sCtx.fillStyle = '#ffcc00';
          sCtx.fillRect(0, 0, 128, 32);
          sCtx.fillStyle = '#111111';
          for (let s = 0; s < 8; s++) {
            sCtx.beginPath();
            sCtx.moveTo(s * 16, 0);
            sCtx.lineTo(s * 16 + 8, 0);
            sCtx.lineTo(s * 16 + 16, 32);
            sCtx.lineTo(s * 16 + 8, 32);
            sCtx.fill();
          }
        }
        const capMesh = new THREE.Mesh(mouthCapGeo, new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(stripeCanvas), roughness: 0.5 }));
        capMesh.position.copy(pt).addScaledVector(tangent, idx === 0 ? 0.3 : -0.3);
        tunnelGroup.add(capMesh);
      }
    }
  });
  scene.add(tunnelGroup);

  // --- 2. NEON LIGHT TUNNEL GLOWING ARCHWAYS ---
  const neonArchesGroup = new THREE.Group();
  const arrowSignsGroup = new THREE.Group();

  const arrowFrameMat = new THREE.MeshStandardMaterial({ color: '#11151d', roughness: 0.8 });
  const arrowNeonMat = new THREE.MeshBasicMaterial({ color: '#00d2ff' }); // Electric glowing blue

  trackHelper.curve.getSpacedPoints(180).forEach((pt, idx) => {
    const u = idx / 180;
    if (trackHelper.getRoadTypeAt(u) === 'tunnel') {
      const tangent = trackHelper.curve.getTangentAt(u).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const width = trackHelper.getRoadWidthAt(u);
      
      if (idx % 3 === 0) {
        // Circular glowing tube vault
        const ringGeo = new THREE.CylinderGeometry(width / 2 + 0.5, width / 2 + 0.6, 0.4, 8, 1, true, 0, Math.PI);
        const neonColorList = ['#ff0055', '#00ffcc', '#ffff00'];
        const nColor = neonColorList[idx % neonColorList.length];
        const ringMat = new THREE.MeshBasicMaterial({ color: nColor, side: THREE.DoubleSide });
        
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(pt);
        ring.rotation.z = Math.PI / 2;
        ring.rotation.y = -Math.atan2(tangent.z, tangent.x);
        neonArchesGroup.add(ring);
      }

      // Add electric-blue neon chevron arrow warning panels on the left/right walls of the tunnel turns!
      if (idx % 6 === 0) {
        const theta = -Math.atan2(tangent.z, tangent.x);
        const wallPlacementOffset = width / 2 + 0.35;

        // Draw arrow panel on both sides of the interior wall
        [-1, 1].forEach(side => {
          const arrowGroup = new THREE.Group();
          // Position adjacent to the wall, slightly raised above road level
          arrowGroup.position.copy(pt).addScaledVector(normal, side * wallPlacementOffset);
          arrowGroup.position.y += 1.8;
          arrowGroup.rotation.y = theta + (side === 1 ? -Math.PI / 2 : Math.PI / 2);

          // Dark plate backing
          const plate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.1), arrowFrameMat);
          arrowGroup.add(plate);

          // Glowing chevron shape (3 boxes overlapping to form ">>>" pointing in driving direction)
          for (let c = -1; c <= 1; c++) {
            const shiftX = c * 0.4;
            // Draw a greater-than symbol chevron pointing forward
            const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 0.05), arrowNeonMat);
            bar1.position.set(shiftX - 0.08, 0.12, 0.06);
            bar1.rotation.z = -Math.PI / 4;
            arrowGroup.add(bar1);

            const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 0.05), arrowNeonMat);
            bar2.position.set(shiftX - 0.08, -0.12, 0.06);
            bar2.rotation.z = Math.PI / 4;
            arrowGroup.add(bar2);
          }

          arrowSignsGroup.add(arrowGroup);
        });
      }
    }
  });
  scene.add(neonArchesGroup);
  scene.add(arrowSignsGroup);
}
