import * as THREE from 'three';
import { TrackGeometryHelper } from '../utils/track';
import { createProceduralRockGeo } from './procedural';
import { buildTerrain } from './terrain';
import { buildForest } from './forest';
import { buildVillage } from './village';
import { buildBridge } from './bridge';
import { buildTunnel } from './tunnel';
import { buildWaterfall, WaterfallController } from './waterfall';
import { buildHairpins } from './hairpins';
import { buildTemple } from './temple';
import { buildHighway } from './highway';
import { buildFinishArea, FinishAreaController } from './finishArea';

export class DragonTrackWorld {
  private waterfallCtrl: WaterfallController | null = null;
  private finishAreaCtrl: FinishAreaController | null = null;

  constructor(scene: THREE.Scene, trackHelper: TrackGeometryHelper) {
    // 1. Procedural Backdrop, Fog, Sky, Clouds, Lake, Canyon River
    buildTerrain(scene, trackHelper);

    // Decorative craggy slate rock piles
    const rockBaseGeo = createProceduralRockGeo();
    const rockMatShared = new THREE.MeshStandardMaterial({ color: '#4a4d53', roughness: 0.95, flatShading: true });
    const rockInst = new THREE.InstancedMesh(rockBaseGeo, rockMatShared, trackHelper.rocks.length);
    rockInst.castShadow = true;
    rockInst.receiveShadow = true;

    const dummyObj = new THREE.Object3D();
    trackHelper.rocks.forEach((rk, index) => {
      dummyObj.position.copy(rk.position);
      dummyObj.scale.copy(rk.scale);
      dummyObj.rotation.copy(rk.rotation);
      dummyObj.updateMatrix();
      rockInst.setMatrixAt(index, dummyObj.matrix);
    });
    rockInst.instanceMatrix.needsUpdate = true;
    scene.add(rockInst);

    // 2. Road Network, Skidmarks, center lines, barriers guardrails
    this.buildRoadNetwork(scene, trackHelper);

    // 3. Section Sceneries & Landmarks
    buildForest(scene, trackHelper);
    buildVillage(scene, trackHelper);
    buildBridge(scene, trackHelper);
    buildTunnel(scene, trackHelper);
    this.waterfallCtrl = buildWaterfall(scene, trackHelper);
    buildHairpins(scene, trackHelper);
    buildTemple(scene, trackHelper);
    buildHighway(scene, trackHelper);
    this.finishAreaCtrl = buildFinishArea(scene, trackHelper);
  }

  public update(elapsedSec: number, trackHelper: TrackGeometryHelper, playerRank = 1, isFinished = false): void {
    // Animate the interactive waterfall texture scrolls and splashing mist
    if (this.waterfallCtrl) {
      this.waterfallCtrl.update(elapsedSec);
    }
    // Animate fireworks and other celebrating spectators
    if (this.finishAreaCtrl) {
      this.finishAreaCtrl.update(elapsedSec, playerRank, isFinished);
    }
  }

  private buildRoadNetwork(scene: THREE.Scene, trackHelper: TrackGeometryHelper): void {
    const trackSlices = 400;
    const roadVertices: number[] = [];
    const roadUVs: number[] = [];
    const roadIndices: number[] = [];

    const centerLinePoints: THREE.Vector3[] = [];
    const leftBarrierPoints: THREE.Vector3[] = [];
    const rightBarrierPoints: THREE.Vector3[] = [];

    // Hairpins arrow warning indicator boards
    const createChevronMesh = () => {
      const chevronGroup = new THREE.Group();
      const pMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6),
        new THREE.MeshStandardMaterial({ color: '#444444', metalness: 0.8 })
      );
      pMesh.position.y = 0.8;
      pMesh.castShadow = true;
      chevronGroup.add(pMesh);

      // Warning chevron board canvas
      const bCanvas = document.createElement('canvas');
      bCanvas.width = 128;
      bCanvas.height = 64;
      const bCtx = bCanvas.getContext('2d');
      if (bCtx) {
        bCtx.fillStyle = '#ffc300'; // highway alert yellow
        bCtx.fillRect(0, 0, 128, 64);
        bCtx.fillStyle = '#111111'; // danger black chevron
        for (let i = 0; i < 4; i++) {
          bCtx.beginPath();
          const sx = 14 + i * 28;
          bCtx.moveTo(sx, 12);
          bCtx.lineTo(sx + 16, 32);
          bCtx.lineTo(sx, 52);
          bCtx.lineTo(sx + 8, 52);
          bCtx.lineTo(sx + 24, 32);
          bCtx.lineTo(sx + 8, 12);
          bCtx.fill();
        }
      }
      const bMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.55, 0.1),
        new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(bCanvas), roughness: 0.4 })
      );
      bMesh.position.set(0, 1.25, 0);
      bMesh.castShadow = true;
      chevronGroup.add(bMesh);
      return chevronGroup;
    };

    // Parallel Tire rubber skid decals wrapping precisely on hairpins
    const skidGroup = new THREE.Group();
    const skidMat = new THREE.MeshBasicMaterial({
      color: '#121213',
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });

    const asphaltTex = this.createAsphaltTexture();

    for (let i = 0; i <= trackSlices; i++) {
      const u = i / trackSlices;
      const progress = u % 1.0;
      const pt = trackHelper.curve.getPointAt(progress);
      const tangent = trackHelper.curve.getTangentAt(progress).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      
      const width = trackHelper.getRoadWidthAt(progress);
      const rType = trackHelper.getRoadTypeAt(progress);

      let roadYOffset = 0.02; 
      if (rType === 'bridge') roadYOffset = 0.3; 

      // Left and right shoulders
      const lPt = new THREE.Vector3().copy(pt).addScaledVector(normal, width / 2);
      lPt.y += roadYOffset;
      const rPt = new THREE.Vector3().copy(pt).addScaledVector(normal, -width / 2);
      rPt.y += roadYOffset;

      roadVertices.push(lPt.x, lPt.y, lPt.z); 
      roadVertices.push(rPt.x, rPt.y, rPt.z); 

      // Road UV: Tiling
      const vTile = u * 52; 
      roadUVs.push(0, vTile);
      roadUVs.push(1, vTile);

      const centerPt = new THREE.Vector3().copy(pt);
      centerPt.y += roadYOffset + 0.015; 
      centerLinePoints.push(centerPt);

      // Warning Arrow board placements outside hairpin paths
      if (rType === 'hairpin' && i % 8 === 0) {
        const sign = createChevronMesh();
        const sideSign = (pt.x > 0) ? 1 : -1; // place outer curve shoulder
        sign.position.copy(pt).addScaledVector(normal, sideSign * (width / 2 + 1.2));
        sign.position.y += roadYOffset;
        sign.lookAt(new THREE.Vector3().copy(sign.position).add(normal.clone().multiplyScalar(sideSign * -1)));
        scene.add(sign);
      }

      // Pre-baked tire skid decals on sharp curves
      if (rType === 'hairpin') {
        const trackWidth = 1.35;
        const leftSkidGeo = new THREE.PlaneGeometry(0.18, 1.6);
        leftSkidGeo.rotateX(-Math.PI / 2);

        const skidL = new THREE.Mesh(leftSkidGeo, skidMat);
        skidL.position.copy(pt).addScaledVector(normal, -trackWidth / 2);
        skidL.position.y += roadYOffset + 0.005;
        skidL.lookAt(new THREE.Vector3().copy(skidL.position).add(tangent));
        skidGroup.add(skidL);

        const skidR = new THREE.Mesh(leftSkidGeo, skidMat);
        skidR.position.copy(pt).addScaledVector(normal, trackWidth / 2);
        skidR.position.y += roadYOffset + 0.005;
        skidR.lookAt(new THREE.Vector3().copy(skidR.position).add(tangent));
        skidGroup.add(skidR);
      }

      // Collect barrier point posts positions 
      const isHairpinOrCliff = rType === 'hairpin' || rType === 'bridge' || (pt.y > 10);
      if (isHairpinOrCliff && i % 4 === 0) {
        leftBarrierPoints.push(new THREE.Vector3().copy(lPt).add(new THREE.Vector3(0, 0.4, 0)));
        rightBarrierPoints.push(new THREE.Vector3().copy(rPt).add(new THREE.Vector3(0, 0.4, 0)));
      }

      if (i < trackSlices) {
        const currL = i * 2;
        const currR = i * 2 + 1;
        const nextL = (i + 1) * 2;
        const nextR = (i + 1) * 2 + 1;

        roadIndices.push(currL, nextL, currR);
        roadIndices.push(nextL, nextR, currR);
      }
    }
    scene.add(skidGroup);

    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(roadVertices), 3));
    roadGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(roadUVs), 2));
    roadGeo.setIndex(roadIndices);
    roadGeo.computeVertexNormals();

    const roadMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughness: 0.38, // reflective asphalt coat of real mobile games!
      metalness: 0.4,
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    // Decorative Yellow Dashed line
    const yellLineGeo = new THREE.BufferGeometry().setFromPoints(centerLinePoints);
    const yellLineMat = new THREE.LineDashedMaterial({
      color: '#ffcc00',
      dashSize: 5,
      gapSize: 4,
    });
    const yellLine = new THREE.Line(yellLineGeo, yellLineMat);
    yellLine.computeLineDistances();
    scene.add(yellLine);

    // Decorative Barrier Guardrails
    const barrierMeshGroup = new THREE.Group();
    const bPostGeo = new THREE.CylinderGeometry(0.18, 0.18, 1.2, 5);
    const bPostMat = new THREE.MeshStandardMaterial({ color: '#5a3d24', roughness: 0.9 }); // Wooden post
    const bRailGeo = new THREE.BoxGeometry(0.1, 0.28, 6);
    const bRailMat = new THREE.MeshStandardMaterial({ color: '#dfdfdf', metalness: 0.9, roughness: 0.15 }); // Chrome steel guardrail

    const createRailsAlongPoints = (pts: THREE.Vector3[]) => {
      for (let i = 0; i < pts.length; i++) {
        const post = new THREE.Mesh(bPostGeo, bPostMat);
        post.position.copy(pts[i]);
        post.position.y -= 0.2;
        post.castShadow = true;
        barrierMeshGroup.add(post);

        if (i < pts.length - 1) {
          const rail = new THREE.Mesh(bRailGeo, bRailMat);
          const nextPt = pts[i+1];
          rail.position.copy(pts[i]).add(nextPt).multiplyScalar(0.5);
          rail.position.y += 0.15;
          rail.lookAt(nextPt);
          const segDist = pts[i].distanceTo(nextPt);
          rail.scale.set(1, 1, segDist / 6); 
          rail.castShadow = true;
          barrierMeshGroup.add(rail);
        }
      }
    };
    createRailsAlongPoints(leftBarrierPoints);
    createRailsAlongPoints(rightBarrierPoints);
    scene.add(barrierMeshGroup);
  }

  private createAsphaltTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // base carbon black
      ctx.fillStyle = '#22252b';
      ctx.fillRect(0, 0, 512, 512);

      // tiny sand/grit noise
      for (let i = 0; i < 6000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const size = Math.random() * 1.6;
        const noiseColor = Math.floor(Math.random() * 25) + 35; // dark graphite
        ctx.fillStyle = `rgb(${noiseColor}, ${noiseColor}, ${noiseColor})`;
        ctx.fillRect(x, y, size, size);
      }

      // tire lanes wear texture lines
      const gradL = ctx.createLinearGradient(0, 0, 512, 0);
      gradL.addColorStop(0.12, 'rgba(12,12,12,0.55)');
      gradL.addColorStop(0.24, 'rgba(12,12,12,0.55)');
      gradL.addColorStop(0.38, 'rgba(34,37,43,0)');
      gradL.addColorStop(0.62, 'rgba(34,37,43,0)');
      gradL.addColorStop(0.76, 'rgba(12,12,12,0.55)');
      gradL.addColorStop(0.88, 'rgba(12,12,12,0.55)');
      ctx.fillStyle = gradL;
      ctx.fillRect(0, 0, 512, 512);

      // golden boundary marker stripes
      ctx.fillStyle = '#ff9c00';
      ctx.fillRect(12, 0, 18, 512);
      ctx.fillRect(512 - 30, 0, 18, 512);

      // center dashed lane markers (clean racing stripes)
      ctx.fillStyle = '#ffffff';
      for (let y = 14; y < 512; y += 64) {
        ctx.fillRect(250, y, 12, 34);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 48); // tile tightly along track ribbon
    return tex;
  }
}
