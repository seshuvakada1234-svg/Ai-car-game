import * as THREE from 'three';
import { TrackGeometryHelper } from '../utils/track';

export interface WaterfallController {
  waterfallMesh: THREE.Mesh;
  foamMesh: THREE.InstancedMesh;
  update: (elapsedSec: number) => void;
  dispose: () => void;
}

export function buildWaterfall(scene: THREE.Scene, trackHelper: TrackGeometryHelper): WaterfallController {
  // --- 1. RUSHING WATERFALL SURFACE ---
  const wfWidth = 32;
  const wfHeight = 85; // Taller cascades
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

  // --- 2. FOAMING SPLASHING MIST CLOUDS VIA BATCHED INSTANCEDMESH ---
  const mistCount = 32;
  const mistMat = new THREE.MeshStandardMaterial({
    color: '#e1f5fe', // Frothy splashing sky-blue mist
    roughness: 0.98,
    transparent: true,
    opacity: 0.42,
    flatShading: true
  });

  const puffGeo = new THREE.IcosahedronGeometry(3.2, 1);
  const instMesh = new THREE.InstancedMesh(puffGeo, mistMat, mistCount);
  instMesh.castShadow = false;
  instMesh.receiveShadow = false;

  // Place the foam vapor generator exactly at the bottom pool coordinates -35.0!
  const poolCenter = new THREE.Vector3(baseLoc.x - 3.0, -35.0, baseLoc.z - 3.0);

  const pData = Array.from({ length: mistCount }, () => {
    const spreadX = Math.random() * 24 - 12;
    const spreadZ = Math.random() * 24 - 12;
    const maxLife = 1.5 + Math.random() * 1.5;
    return {
      x: poolCenter.x + spreadX,
      y: poolCenter.y + Math.random() * 4,
      z: poolCenter.z + spreadZ,
      velY: 2.2 + Math.random() * 3.5, // rising upward speed
      baseX: poolCenter.x + spreadX,
      baseZ: poolCenter.z + spreadZ,
      maxLife,
      life: Math.random() * maxLife,
      scaleRate: 0.4 + Math.random() * 0.6
    };
  });

  const dummy = new THREE.Object3D();
  const baseColor = new THREE.Color('#e1f5fe');
  const tempColor = new THREE.Color();

  // Position instances initially
  for (let i = 0; i < mistCount; i++) {
    const p = pData[i];
    dummy.position.set(p.x, p.y, p.z);
    const progress = p.life / p.maxLife;
    const currentScale = (0.55 + p.scaleRate) * (1.0 - progress);
    dummy.scale.set(currentScale, currentScale, currentScale);
    dummy.updateMatrix();
    instMesh.setMatrixAt(i, dummy.matrix);
  }
  instMesh.instanceMatrix.needsUpdate = true;
  scene.add(instMesh);

  // --- 3. EXPORT CONTROLLER ---
  return {
    waterfallMesh: waterfall,
    foamMesh: instMesh,
    update: (elapsedSec: number) => {
      // Texture panning animation mimicking raging downstream torrent
      if (waterTex) {
        waterTex.offset.y -= elapsedSec * 1.76;
      }

      // Update instanced particles
      for (let i = 0; i < mistCount; i++) {
        const p = pData[i];
        p.life += elapsedSec;
        if (p.life >= p.maxLife) {
          // Recycle and reincarnate the vapor puff back at the crash basin
          p.life = 0;
          p.x = p.baseX + (Math.random() * 6 - 3);
          p.y = poolCenter.y;
          p.z = p.baseZ + (Math.random() * 6 - 3);
        } else {
          // Push upward
          p.y += p.velY * elapsedSec;
        }

        const progress = p.life / p.maxLife;
        const lifeScale = 1.0 - progress;
        const currentScale = (0.4 + progress * p.scaleRate * 3.5) * lifeScale;
        
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.set(currentScale, currentScale, currentScale);
        dummy.updateMatrix();
        instMesh.setMatrixAt(i, dummy.matrix);

        // Control item brightness to fade with environment cleanly
        tempColor.copy(baseColor).multiplyScalar(lifeScale);
        instMesh.setColorAt(i, tempColor);
      }
      instMesh.instanceMatrix.needsUpdate = true;
      if (instMesh.instanceColor) {
        instMesh.instanceColor.needsUpdate = true;
      }
    },
    dispose: () => {
      scene.remove(waterfall);
      scene.remove(instMesh);
      wfGeo.dispose();
      wfMat.dispose();
      waterTex.dispose();
      puffGeo.dispose();
      mistMat.dispose();
    }
  };
}
