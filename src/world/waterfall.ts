import * as THREE from 'three';
import { TrackGeometryHelper } from '../utils/track';

export interface WaterfallController {
  waterfallMesh: THREE.Mesh;
  foamGroup: THREE.Group;
  update: (elapsedSec: number) => void;
}

export function buildWaterfall(scene: THREE.Scene, trackHelper: TrackGeometryHelper): WaterfallController {
  // --- 1. RUSHING WATERFALL SURFACE ---
  const wfWidth = 32;
  const wfHeight = 85; // Taller cascades - UPDATED!
  const wfGeo = new THREE.PlaneGeometry(wfWidth, wfHeight, 1, 10);
  
  // High fidelity canvas drawing vertical cascading water-stream threads
  const createWaterTex = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Light blue stream background
      ctx.fillStyle = '#4fc3f7';
      ctx.fillRect(0, 0, 128, 512);

      // White frothy foam threads
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * 128;
        const h = 40 + Math.random() * 180;
        ctx.fillRect(x, Math.random() * 512, 1.8, h);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    return tex;
  };

  const waterTex = createWaterTex();
  const wfMat = new THREE.MeshStandardMaterial({
    map: waterTex,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide
  });

  const waterfall = new THREE.Mesh(wfGeo, wfMat);
  // Center of waterfall is placed just above the river basin level
  const baseLoc = trackHelper.waterfallPos.clone();
  waterfall.position.set(baseLoc.x, baseLoc.y + 26, baseLoc.z);
  // Angle the waterfall mesh to match the mountain cliff slant
  waterfall.rotation.set(0.12, Math.PI / 4 + 0.15, 0); 
  waterfall.castShadow = true;
  scene.add(waterfall);

  // --- 2. FOAMING SPLASHING MIST CLOUDS ---
  // A group of semi-transparent rising mist puffs at the base of the waterfall pool
  const foamGroup = new THREE.Group();
  const mistCount = 32;
  const mistPuffs: { mesh: THREE.Mesh; velY: number; baseX: number; baseZ: number; maxLife: number; life: number; scaleRate: number }[] = [];

  const mistMat = new THREE.MeshStandardMaterial({
    color: '#e1f5fe', // Frothy splashing sky-blue mist
    roughness: 0.98,
    transparent: true,
    opacity: 0.42,
    flatShading: true
  });

  const puffGeo = new THREE.IcosahedronGeometry(3.2, 1);

  // Place the foam vapor generator exactly at the bottom pool coordinates -35.0!
  const poolCenter = new THREE.Vector3(baseLoc.x - 3.0, -35.0, baseLoc.z - 3.0);

  for (let i = 0; i < mistCount; i++) {
    const puff = new THREE.Mesh(puffGeo, mistMat.clone());
    
    // Spread the starting coordinates around the plunge pool zone
    const spreadX = Math.random() * 24 - 12;
    const spreadZ = Math.random() * 24 - 12;

    puff.position.set(poolCenter.x + spreadX, poolCenter.y + Math.random() * 4, poolCenter.z + spreadZ);
    
    const randomScale = 0.55 + Math.random() * 0.9;
    puff.scale.set(randomScale, randomScale, randomScale);
    foamGroup.add(puff);

    mistPuffs.push({
      mesh: puff,
      velY: 2.2 + Math.random() * 3.5, // rising upward speed
      baseX: poolCenter.x + spreadX,
      baseZ: poolCenter.z + spreadZ,
      maxLife: 1.5 + Math.random() * 1.5,
      life: Math.random() * 1.5,
      scaleRate: 0.4 + Math.random() * 0.6
    });
  }
  scene.add(foamGroup);

  // --- 3. EXPORT CONTROLLER ---
  return {
    waterfallMesh: waterfall,
    foamGroup,
    update: (elapsedSec: number) => {
      // Texture panning animation mimicking raging downstream torrent
      if (waterTex) {
        waterTex.offset.y -= elapsedSec * 1.76;
      }

      // Animate and fade rising mist particles at the splash pool base
      mistPuffs.forEach(p => {
        p.life += elapsedSec;
        if (p.life >= p.maxLife) {
          // Recycle and reincarnate the vapor puff back at the crash basin
          p.life = 0;
          p.mesh.position.set(p.baseX + (Math.random() * 6 - 3), poolCenter.y, p.baseZ + (Math.random() * 6 - 3));
          p.mesh.scale.set(0.4, 0.4, 0.4);
          (p.mesh.material as THREE.MeshStandardMaterial).opacity = 0.42;
        } else {
          // Push upward and inflate
          p.mesh.position.y += p.velY * elapsedSec;
          const progress = p.life / p.maxLife;
          const currentScale = 0.4 + progress * p.scaleRate * 3.5;
          p.mesh.scale.set(currentScale, currentScale, currentScale);
          
          // Fade to 0 as it merges with mountain atmosphere
          (p.mesh.material as THREE.MeshStandardMaterial).opacity = (1.0 - progress) * 0.42;
        }
      });
    }
  };
}
