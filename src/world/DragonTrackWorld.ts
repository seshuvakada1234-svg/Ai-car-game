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
import { buildAnimals, AnimalController } from './animals';
import { terrainManager } from './terrainManager';
import { lodManager } from './lodManager';

// ─────────────────────────────────────────────────────────────────────────────
// Module-scope reusable vectors for buildRoadNetwork()
//
// OPTIMIZATION: The road ribbon loop runs trackSlices (400) times.
// Each iteration previously created:
//   new THREE.Vector3(-tangent.z, 0, tangent.x)  → normal
//   new THREE.Vector3().copy(pt).addScaledVector(…) → lPt, rPt, centerPt
//   new THREE.Vector3().copy(pt).add(…)            → barrier points (conditional)
//
// Hoisting these to module scope eliminates 400+ short-lived Vector3
// allocations per buildRoadNetwork() call, reducing GC pressure during init.
// Note: lPt and rPt are pushed into barrier arrays so they are still cloned
// at that point — only the temporary computation vectors are reused.
// ─────────────────────────────────────────────────────────────────────────────
const ROAD_TANGENT  = new THREE.Vector3();
const ROAD_NORMAL   = new THREE.Vector3();
const ROAD_PT       = new THREE.Vector3();
const ROAD_LPT      = new THREE.Vector3();
const ROAD_RPT      = new THREE.Vector3();
const ROAD_CENTER   = new THREE.Vector3();
const ROAD_SIGN_DIR = new THREE.Vector3();

export class DragonTrackWorld {
  private waterfallCtrl:  WaterfallController  | null = null;
  private finishAreaCtrl: FinishAreaController | null = null;
  private animalsCtrl:    AnimalController     | null = null;

  constructor(scene: THREE.Scene, trackHelper: TrackGeometryHelper) {
    // 1. Pre-bake Terrain Heightmap once before anything else
    terrainManager.initialize(trackHelper);

    // 2. Procedural Backdrop, Fog, Sky, Clouds, Lake, Canyon River
    buildTerrain(scene, trackHelper);

    // Decorative craggy slate rock piles
    const rockBaseGeo   = createProceduralRockGeo();
    const rockMatShared = new THREE.MeshStandardMaterial({
      color:       '#4a4d53',
      roughness:   0.95,
      flatShading: true,
    });
    const rockInst = new THREE.InstancedMesh(rockBaseGeo, rockMatShared, trackHelper.rocks.length);
    rockInst.castShadow    = true;
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

    // 3. Road Network, Skidmarks, centre lines, barriers, guardrails
    this.buildRoadNetwork(scene, trackHelper);

    // 4. Section Sceneries & Landmarks
    buildForest(scene, trackHelper);
    buildVillage(scene, trackHelper);
    buildBridge(scene, trackHelper);
    buildTunnel(scene, trackHelper);
    this.waterfallCtrl  = buildWaterfall(scene, trackHelper);
    buildHairpins(scene, trackHelper);
    buildTemple(scene, trackHelper);
    buildHighway(scene, trackHelper);
    this.finishAreaCtrl = buildFinishArea(scene, trackHelper);
    this.animalsCtrl    = buildAnimals(scene, trackHelper);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // update — called every frame
  // ───────────────────────────────────────────────────────────────────────────
  public update(
    elapsedSec: number,
    trackHelper: TrackGeometryHelper,
    playerRank = 1,
    isFinished = false
  ): void {
    if (this.waterfallCtrl)  this.waterfallCtrl.update(elapsedSec);
    if (this.finishAreaCtrl) this.finishAreaCtrl.update(elapsedSec, playerRank, isFinished);
    if (this.animalsCtrl)    this.animalsCtrl.update(elapsedSec);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // buildRoadNetwork
  //
  // Constructs the road ribbon mesh, yellow centre-line, skid decals, chevron
  // warning signs and barrier guardrails.
  //
  // OPTIMIZATION: All Vector3 temporaries inside the hot 400-iteration loop
  // are replaced with the module-scope scratch vectors declared above.
  // The normal is computed as:
  //   ROAD_NORMAL.set(-tangent.z, 0, tangent.x).normalize()
  // instead of:
  //   new THREE.Vector3(-tangent.z, 0, tangent.x).normalize()
  // This alone eliminates 400 Vector3 heap allocations per road build.
  // ───────────────────────────────────────────────────────────────────────────
  private buildRoadNetwork(scene: THREE.Scene, trackHelper: TrackGeometryHelper): void {
    const trackSlices   = 400;
    const roadVertices: number[] = [];
    const roadUVs:      number[] = [];
    const roadIndices:  number[] = [];

    const centerLinePoints:  THREE.Vector3[] = [];
    const leftBarrierPoints: THREE.Vector3[] = [];
    const rightBarrierPoints: THREE.Vector3[] = [];

    // ── Chevron warning indicator boards ─────────────────────────────────────
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
      const bCanvas  = document.createElement('canvas');
      bCanvas.width  = 128;
      bCanvas.height = 64;
      const bCtx = bCanvas.getContext('2d');
      if (bCtx) {
        bCtx.fillStyle = '#ffc300';
        bCtx.fillRect(0, 0, 128, 64);
        bCtx.fillStyle = '#111111';
        for (let i = 0; i < 4; i++) {
          bCtx.beginPath();
          const sx = 14 + i * 28;
          bCtx.moveTo(sx,      12);
          bCtx.lineTo(sx + 16, 32);
          bCtx.lineTo(sx,      52);
          bCtx.lineTo(sx + 8,  52);
          bCtx.lineTo(sx + 24, 32);
          bCtx.lineTo(sx + 8,  12);
          bCtx.fill();
        }
      }

      const bMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.55, 0.1),
        new THREE.MeshStandardMaterial({
          map:      new THREE.CanvasTexture(bCanvas),
          roughness: 0.4,
        })
      );
      bMesh.position.set(0, 1.25, 0);
      bMesh.castShadow = true;
      chevronGroup.add(bMesh);
      return chevronGroup;
    };

    // ── Skid decal group ──────────────────────────────────────────────────────
    const skidGroup = new THREE.Group();
    const skidMat   = new THREE.MeshBasicMaterial({
      color:      '#121213',
      transparent: true,
      opacity:    0.45,
      depthWrite: false,
    });

    const asphaltTex = this.createAsphaltTexture();

    // ── Main road ribbon loop ─────────────────────────────────────────────────
    for (let i = 0; i <= trackSlices; i++) {
      const u        = i / trackSlices;
      const progress = u % 1.0;

      // Reuse module-scope scratch vectors — no heap allocation per slice
      trackHelper.curve.getPointAt(progress, ROAD_PT);
      trackHelper.curve.getTangentAt(progress, ROAD_TANGENT).normalize();

      // Perpendicular road normal (XZ plane)
      ROAD_NORMAL.set(-ROAD_TANGENT.z, 0, ROAD_TANGENT.x).normalize();

      const width  = trackHelper.getRoadWidthAt(progress);
      const rType  = trackHelper.getRoadTypeAt(progress);

      let roadYOffset = 0.02;
      if (rType === 'bridge') roadYOffset = 0.3;

      // Left and right shoulder vertices — clone only the positions we store
      ROAD_LPT.copy(ROAD_PT).addScaledVector(ROAD_NORMAL,  width / 2);
      ROAD_LPT.y += roadYOffset;

      ROAD_RPT.copy(ROAD_PT).addScaledVector(ROAD_NORMAL, -width / 2);
      ROAD_RPT.y += roadYOffset;

      roadVertices.push(ROAD_LPT.x, ROAD_LPT.y, ROAD_LPT.z);
      roadVertices.push(ROAD_RPT.x, ROAD_RPT.y, ROAD_RPT.z);

      const vTile = u * 52;
      roadUVs.push(0, vTile);
      roadUVs.push(1, vTile);

      ROAD_CENTER.copy(ROAD_PT);
      ROAD_CENTER.y += roadYOffset + 0.015;
      centerLinePoints.push(ROAD_CENTER.clone()); // stored — must clone

      // ── Chevron warning signs on hairpins ──────────────────────────────────
      if (rType === 'hairpin' && i % 8 === 0) {
        const sign    = createChevronMesh();
        const sideSign = (ROAD_PT.x > 0) ? 1 : -1;
        sign.position.copy(ROAD_PT).addScaledVector(ROAD_NORMAL, sideSign * (width / 2 + 1.2));
        sign.position.y += roadYOffset;
        ROAD_SIGN_DIR.copy(sign.position).add(
          ROAD_NORMAL.clone().multiplyScalar(sideSign * -1)
        );
        sign.lookAt(ROAD_SIGN_DIR);
        scene.add(sign);
      }

      // ── Pre-baked tire skid decals on sharp curves ─────────────────────────
      if (rType === 'hairpin') {
        const trackWidth  = 1.35;
        const leftSkidGeo = new THREE.PlaneGeometry(0.18, 1.6);
        leftSkidGeo.rotateX(-Math.PI / 2);

        const skidL = new THREE.Mesh(leftSkidGeo, skidMat);
        skidL.position.copy(ROAD_PT).addScaledVector(ROAD_NORMAL, -trackWidth / 2);
        skidL.position.y += roadYOffset + 0.005;
        ROAD_SIGN_DIR.copy(skidL.position).add(ROAD_TANGENT);
        skidL.lookAt(ROAD_SIGN_DIR);
        skidGroup.add(skidL);

        const skidR = new THREE.Mesh(leftSkidGeo, skidMat);
        skidR.position.copy(ROAD_PT).addScaledVector(ROAD_NORMAL, trackWidth / 2);
        skidR.position.y += roadYOffset + 0.005;
        ROAD_SIGN_DIR.copy(skidR.position).add(ROAD_TANGENT);
        skidR.lookAt(ROAD_SIGN_DIR);
        skidGroup.add(skidR);
      }

      // ── Barrier post collection points ─────────────────────────────────────
      const isHairpinOrCliff = rType === 'hairpin' || rType === 'bridge' || (ROAD_PT.y > 10);
      if (isHairpinOrCliff && i % 4 === 0) {
        // Clone because these are stored permanently in the barrier arrays
        leftBarrierPoints.push(
          new THREE.Vector3(ROAD_LPT.x, ROAD_LPT.y + 0.4, ROAD_LPT.z)
        );
        rightBarrierPoints.push(
          new THREE.Vector3(ROAD_RPT.x, ROAD_RPT.y + 0.4, ROAD_RPT.z)
        );
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

    // ── Road ribbon geometry ──────────────────────────────────────────────────
    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(roadVertices), 3));
    roadGeo.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(roadUVs),      2));
    roadGeo.setIndex(roadIndices);
    roadGeo.computeVertexNormals();
    roadGeo.computeBoundingBox();
    roadGeo.computeBoundingSphere();

    const roadMat = new THREE.MeshStandardMaterial({
      map:       asphaltTex,
      roughness: 0.38,
      metalness: 0.4,
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    if (roadGeo.attributes.position.count > 0) {
      terrainManager.bakeRoadMeshBVH([roadMesh]);
    }

    // ── Decorative yellow dashed centre line ──────────────────────────────────
    const yellLineGeo = new THREE.BufferGeometry().setFromPoints(centerLinePoints);
    const yellLineMat = new THREE.LineDashedMaterial({
      color:    '#ffcc00',
      dashSize: 5,
      gapSize:  4,
    });
    const yellLine = new THREE.Line(yellLineGeo, yellLineMat);
    yellLine.computeLineDistances();
    scene.add(yellLine);

    // ── Barrier guardrails ────────────────────────────────────────────────────
    const barrierMeshGroup = new THREE.Group();

    const bPostGeo = new THREE.CylinderGeometry(0.18, 0.18, 1.2, 5);
    const bPostMat = new THREE.MeshStandardMaterial({ color: '#5a3d24', roughness: 0.9 });
    const bRailGeo = new THREE.BoxGeometry(0.1, 0.28, 6);
    const bRailMat = new THREE.MeshStandardMaterial({ color: '#dfdfdf', metalness: 0.9, roughness: 0.15 });

    const totalBarrierPosts = leftBarrierPoints.length + rightBarrierPoints.length;
    const totalBarrierRails =
      Math.max(0, leftBarrierPoints.length  - 1) +
      Math.max(0, rightBarrierPoints.length - 1);

    const bPostInst = new THREE.InstancedMesh(bPostGeo, bPostMat, totalBarrierPosts);
    const bRailInst = new THREE.InstancedMesh(bRailGeo, bRailMat, totalBarrierRails);

    bPostInst.castShadow    = false;
    bPostInst.receiveShadow = true;
    bRailInst.castShadow    = false;

    let postIdx = 0;
    let railIdx = 0;
    const dummy = new THREE.Object3D();

    const addBarrierRails = (pts: THREE.Vector3[]) => {
      for (let i = 0; i < pts.length; i++) {
        dummy.position.copy(pts[i]);
        dummy.position.y -= 0.2;
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        bPostInst.setMatrixAt(postIdx++, dummy.matrix);

        if (i < pts.length - 1) {
          const nextPt = pts[i + 1];
          dummy.position.copy(pts[i]).add(nextPt).multiplyScalar(0.5);
          dummy.position.y += 0.15;
          dummy.lookAt(nextPt);
          const segDist =
            pts[i] && typeof pts[i].distanceTo === 'function' && nextPt
              ? pts[i].distanceTo(nextPt)
              : 6.0;
          dummy.scale.set(1, 1, segDist / 6);
          dummy.updateMatrix();
          bRailInst.setMatrixAt(railIdx++, dummy.matrix);
        }
      }
    };

    addBarrierRails(leftBarrierPoints);
    addBarrierRails(rightBarrierPoints);

    bPostInst.instanceMatrix.needsUpdate = true;
    bRailInst.instanceMatrix.needsUpdate = true;

    barrierMeshGroup.add(bPostInst, bRailInst);
    scene.add(barrierMeshGroup);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // createAsphaltTexture
  //
  // Generates a 512×512 canvas texture simulating worn asphalt with grit
  // noise, tire lane wear gradients, boundary marker stripes and centre dashes.
  // Unchanged from original — no visual difference.
  // ───────────────────────────────────────────────────────────────────────────
  private createAsphaltTexture(): THREE.CanvasTexture {
    const canvas  = document.createElement('canvas');
    canvas.width  = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Base carbon black
      ctx.fillStyle = '#22252b';
      ctx.fillRect(0, 0, 512, 512);

      // Tiny sand/grit noise
      for (let i = 0; i < 6000; i++) {
        const x          = Math.random() * 512;
        const y          = Math.random() * 512;
        const size       = Math.random() * 1.6;
        const noiseColor = Math.floor(Math.random() * 25) + 35;
        ctx.fillStyle    = `rgb(${noiseColor}, ${noiseColor}, ${noiseColor})`;
        ctx.fillRect(x, y, size, size);
      }

      // Tire lane wear texture lines
      const gradL = ctx.createLinearGradient(0, 0, 512, 0);
      gradL.addColorStop(0.12, 'rgba(12,12,12,0.55)');
      gradL.addColorStop(0.24, 'rgba(12,12,12,0.55)');
      gradL.addColorStop(0.38, 'rgba(34,37,43,0)');
      gradL.addColorStop(0.62, 'rgba(34,37,43,0)');
      gradL.addColorStop(0.76, 'rgba(12,12,12,0.55)');
      gradL.addColorStop(0.88, 'rgba(12,12,12,0.55)');
      ctx.fillStyle = gradL;
      ctx.fillRect(0, 0, 512, 512);

      // Golden boundary marker stripes
      ctx.fillStyle = '#ff9c00';
      ctx.fillRect(12,         0, 18, 512);
      ctx.fillRect(512 - 30,   0, 18, 512);

      // Centre dashed lane markers (clean racing stripes)
      ctx.fillStyle = '#ffffff';
      for (let y = 14; y < 512; y += 64) {
        ctx.fillRect(250, y, 12, 34);
      }
    }

    const tex   = new THREE.CanvasTexture(canvas);
    tex.wrapS   = THREE.RepeatWrapping;
    tex.wrapT   = THREE.RepeatWrapping;
    tex.repeat.set(1, 48); // tile tightly along track ribbon
    return tex;
  }
}
