import * as THREE from 'three';
import { TrackGeometryHelper } from '../utils/track';

export function buildHighway(scene: THREE.Scene, trackHelper: TrackGeometryHelper): void {
  // LANDMARK 5: HIGHWAY COMMERCIAL BILLBOARDS
  const billboardGroup = new THREE.Group();
  trackHelper.billboards.forEach(bb => {
    const bSet = new THREE.Group();
    bSet.position.copy(bb.position);
    bSet.rotation.y = bb.rotation;

    // Support metal pole support
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 12, 6), new THREE.MeshStandardMaterial({ color: '#2a2f35', metalness: 0.8 }));
    pole.position.y = 6;
    pole.castShadow = true;
    bSet.add(pole);

    // Create a high visual quality canvas texture board
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0a0d13';
      ctx.fillRect(0, 0, 256, 128);
      ctx.strokeStyle = '#00f6ff';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, 250, 122);
      
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 20px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(bb.text, 128, 68);
    }
    
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(11, 5.5, 0.4),
      new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(canvas), roughness: 0.35 })
    );
    board.position.y = 11;
    board.castShadow = true;
    bSet.add(board);

    billboardGroup.add(bSet);
  });
  scene.add(billboardGroup);
}
