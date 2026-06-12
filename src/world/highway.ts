import * as THREE from 'three';
import { TrackGeometryHelper, getTerrainHeight } from '../utils/track';

export function buildHighway(scene: THREE.Scene, trackHelper: TrackGeometryHelper): void {
  // LANDMARK 5: HIGHWAY COMMERCIAL BILLBOARDS
  const billboardGroup = new THREE.Group();
  
  trackHelper.billboards.forEach(bb => {
    const bSet = new THREE.Group();
    
    // Anchor billboard directly at the terrain level to prevent any floating gaps on hills!
    const terrainY = getTerrainHeight(bb.position.x, bb.position.z, trackHelper);
    bSet.position.set(bb.position.x, terrainY, bb.position.z);
    bSet.rotation.y = bb.rotation;

    // Heavy industrially-welded metallic supporting stanchion (sinks deep into hillbed)
    const poleHeight = 24.0;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, poleHeight, 8), 
      new THREE.MeshStandardMaterial({ color: '#252930', metalness: 0.95, roughness: 0.12 })
    );
    // Let the pole sink 2m into bedrock to guarantee complete grounding
    pole.position.y = poleHeight / 2 - 2.0;
    pole.castShadow = true;
    bSet.add(pole);

    // Create a high visual quality neon canvas texture board with retro racing styling
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Midnight dark backdrop
      ctx.fillStyle = '#070a13';
      ctx.fillRect(0, 0, 512, 256);
      
      // Cyber neon gird lines background
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
      ctx.lineWidth = 1;
      for (let x = 0; x < 512; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 256);
        ctx.stroke();
      }
      for (let y = 0; y < 256; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
      }

      // Outer bold double neon-pink/cyan frames
      ctx.strokeStyle = '#ff007f';
      ctx.lineWidth = 10;
      ctx.strokeRect(10, 10, 492, 236);
      ctx.strokeStyle = '#00f6ff';
      ctx.lineWidth = 4;
      ctx.strokeRect(18, 18, 476, 220);
      
      // Racing double speed stripes at the bottom
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(32, 204, 448, 14);
      ctx.fillStyle = '#111111';
      for (let s = 1; s < 18; s++) {
        ctx.beginPath();
        ctx.moveTo(s * 25 + 30, 204);
        ctx.lineTo(s * 25 + 40, 204);
        ctx.lineTo(s * 25 + 32, 218);
        ctx.lineTo(s * 25 + 22, 218);
        ctx.fill();
      }

      // Center glowing title
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px "Space Grotesk", sans-serif';
      ctx.shadowColor = '#00f6ff';
      ctx.shadowBlur = 15;
      ctx.textAlign = 'center';
      ctx.fillText('⚡ DRAGON RUSH ⚡', 256, 92);
      
      // Subtitle with bb message
      ctx.fillStyle = '#00d2ff';
      ctx.font = 'bold 28px "JetBrains Mono", monospace';
      ctx.shadowColor = 'transparent';
      ctx.fillText(bb.text, 256, 144);
    }
    
    // Massive AAA scale billboard: BoxGeometry(22, 11, 0.6) - UPDATED!
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(22, 11, 0.6),
      new THREE.MeshStandardMaterial({ 
        map: new THREE.CanvasTexture(canvas), 
        roughness: 0.28,
        metalness: 0.2
      })
    );
    // Position billboard crowning the pole high above the tarmac
    board.position.y = poleHeight - 5.0;
    board.castShadow = true;
    bSet.add(board);

    billboardGroup.add(bSet);
  });
  
  scene.add(billboardGroup);
}
