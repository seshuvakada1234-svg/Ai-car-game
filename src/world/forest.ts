import * as THREE from 'three';
import { TrackGeometryHelper } from '../utils/track';
import { terrainManager } from './TerrainManager';
import { lodManager } from './lodManager';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFMaterialsPBRSpecularGlossinessExtension } from './procedural';
import { applyGltfMaterialFix } from '../utils/gltfMaterialFix';

interface ForestTree {
  id: number;
  position: THREE.Vector3;
  scale: number;
  rotationY: number;
  type: number; // 0=Pine, 1=Old Tree, 2=Sakura, 3=Tree GN
}

interface ExtractedSubmesh {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  localMatrix: THREE.Matrix4;
}

// Compact, performant, Zero-allocation Perlin-Noise implementation to map organic clusters
class SimpleNoise {
  private static hash2D(x: number, y: number): number {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
    return n - Math.floor(n);
  }

  private static fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  public static noise(x: number, y: number): number {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    const xf = x - X;
    const yf = y - Y;

    const h00 = SimpleNoise.hash2D(X, Y);
    const h10 = SimpleNoise.hash2D(X + 1, Y);
    const h01 = SimpleNoise.hash2D(X, Y + 1);
    const h11 = SimpleNoise.hash2D(X + 1, Y + 1);

    const u = SimpleNoise.fade(xf);
    const v = SimpleNoise.fade(yf);

    const a = h00 * (1 - u) + h10 * u;
    const b = h01 * (1 - u) + h11 * u;
    return a * (1 - v) + b * v;
  }
}

export class ForestSystem {
  private static instance: ForestSystem | null = null;
  public static initialized = false;

  // Active forest coordinates
  private trees: ForestTree[] = [];
  private treesByType: ForestTree[][] = [[], [], [], []];

  // Instanced Meshes containers: insts[type][meshIndex]
  private highInsts: THREE.InstancedMesh[][] = [[], [], [], []];
  private medInsts: THREE.InstancedMesh[][] = [[], [], [], []];
  private lowInsts: THREE.InstancedMesh[] = []; // Only 1 crossing-quad InstancedMesh per type

  // Cache geometries & materials for clean unloading/disposal
  private gltfSubmeshes: ExtractedSubmesh[][] = [[], [], [], []];
  private isLoaded: boolean[] = [false, false, false, false];
  private isInitialized = false;
  private static readonly treeCache = new Map<string, THREE.Group>();
  private static readonly activeDownloads = new Set<string>();

  // Roadside vegetation (Nature Pack)
  private roadsideCoords: { position: THREE.Vector3; scale: number; rotationY: number }[][] = [[], [], [], [], []]; // 0: Grass, 1: Flower, 2: Bush, 3: Plant, 4: Rock
  private roadsideInsts: THREE.InstancedMesh[][] = [[], [], [], [], []];
  private naturePackSubmeshes: ExtractedSubmesh[][] = [[], [], [], [], []];
  private isNaturePackLoaded = false;

  private lastCameraPos = new THREE.Vector3(Infinity, Infinity, Infinity);
  private lastUpdateTime = 0;
  private scene: THREE.Scene | null = null;
  private trackHelper: TrackGeometryHelper | null = null;

  // Static reuseable matrices to prevent runtime allocations
  private readonly zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  private readonly dummyObj = new THREE.Object3D();
  private readonly tempMatrix = new THREE.Matrix4();

  private constructor() {}

  public static getInstance(): ForestSystem {
    if (!ForestSystem.instance) {
      ForestSystem.instance = new ForestSystem();
    }
    return ForestSystem.instance;
  }

  public get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Builds and initializes the forest, placing custom instanced meshes with placeholders initially,
   * then launches background asynchronous preloading of the high-fidelity GLB models.
   */
  public init(scene: THREE.Scene, trackHelper: TrackGeometryHelper): void {
    // Note: Do not early skip if ForestSystem.initialized is set because we want to attach instanced meshes
    // to the newly passed scene object, but we will reuse coordinates to avoid heavy regeneration.
    const coordinatesCached = (this.trees && this.trees.length > 0);

    this.scene = scene;
    this.trackHelper = trackHelper;
    this.highInsts = [[], [], [], []];
    this.medInsts = [[], [], [], []];
    this.lowInsts = [];
    this.gltfSubmeshes = [[], [], [], []];
    this.isLoaded = [false, false, false, false];

    this.roadsideInsts = [[], [], [], [], []];
    this.naturePackSubmeshes = [[], [], [], [], []];
    this.isNaturePackLoaded = false;

    this.lastCameraPos.set(Infinity, Infinity, Infinity);
    this.lastUpdateTime = 0;

    console.log('Initializing AAA Forest System... Reuse Coordinates:', coordinatesCached);

    if (!coordinatesCached) {
      this.trees = [];
      this.treesByType = [[], [], [], []];
      this.roadsideCoords = [[], [], [], [], []];

      // 1. Generate organic, highly realistic forest coordinates using Perlin-style noise probability maps
      console.log('Generating organic forest trees around active loop corridors...');
      
      // Sample the spline curve to construct the natural gameplay corridors
      const steps = 1200;
      let treeIdCounter = 0;

      for (let j = 0; j < steps; j++) {
        const u = j / steps;
        const pt = trackHelper.curve.getPointAt(u);
        const tangent = trackHelper.curve.getTangentAt(u).normalize();
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        const roadWidth = trackHelper.getRoadWidthAt(u);
        const rType = trackHelper.getRoadTypeAt(u);

        // Bridges have strictly NO trees
        if (rType === 'bridge') {
          continue;
        }

        for (let side of [-1, 1]) {
          // Query local spatial noise value for organic clusters/glade designs
          const localNoise = SimpleNoise.noise(pt.x / 140.0, pt.z / 140.0);

          // --- BAND 1: Sparse Corridor (15m to 60m from road edge) ---
          if (Math.random() < 0.015 * (localNoise * 0.8 + 0.2)) {
            const minCorrd = roadWidth / 2 + 15.0;
            const maxCorrd = roadWidth / 2 + 60.0;
            const perpOffset = minCorrd + Math.random() * (maxCorrd - minCorrd);
            const tangentJitter = (Math.random() * 2.0 - 1.0) * 4.0;

            const pos = new THREE.Vector3()
              .copy(pt)
              .addScaledVector(normal, side * perpOffset)
              .addScaledVector(tangent, tangentJitter);

            pos.y = terrainManager.getHeight(pos.x, pos.z);

            if (this.isValidTreeLocation(pos, u, trackHelper)) {
              const mappedType = treeIdCounter % 4; // 0=Pine, 1=Old, 2=Sakura, 3=GN
              const tScale = 0.8 + Math.random() * 0.7; // 0.8 to 1.5
              const tRotY = Math.random() * Math.PI * 2; // 0 to 360 deg

              const newTree: ForestTree = {
                id: treeIdCounter++,
                position: pos,
                scale: tScale,
                rotationY: tRotY,
                type: mappedType
              };
              this.trees.push(newTree);
              this.treesByType[mappedType].push(newTree);
            }
          }

          // --- BAND 2: Medium Corridor (60m to 150m from road edge) ---
          const medNoise = SimpleNoise.noise(pt.x / 90.0, pt.z / 90.0);
          if (Math.random() < 0.035 * medNoise) {
            const minCorrd = roadWidth / 2 + 60.0;
            const maxCorrd = roadWidth / 2 + 150.0;
            const attempts = 1;
            for (let att = 0; att < attempts; att++) {
              const perpOffset = minCorrd + Math.random() * (maxCorrd - minCorrd);
              const tangentJitter = (Math.random() * 2.0 - 1.0) * 12.0;

              const pos = new THREE.Vector3()
                .copy(pt)
                .addScaledVector(normal, side * perpOffset)
                .addScaledVector(tangent, tangentJitter);

              pos.y = terrainManager.getHeight(pos.x, pos.z);

              if (this.isValidTreeLocation(pos, u, trackHelper)) {
                const mappedType = treeIdCounter % 4;
                const tScale = 0.8 + Math.random() * 0.7;
                const tRotY = Math.random() * Math.PI * 2;

                const newTree: ForestTree = {
                  id: treeIdCounter++,
                  position: pos,
                  scale: tScale,
                  rotationY: tRotY,
                  type: mappedType
                };
                this.trees.push(newTree);
                this.treesByType[mappedType].push(newTree);
              }
            }
          }
        }
      }

      console.log(`Forest populated organic: Total of ${this.trees.length} valid trees arranged into organic clusters!`);

      // 2. Generate high-density continuous roadside details strips on LEFT and RIGHT sides of the road
      console.log('Generating continuous roadside vegetation strips with optimized densities...');
      for (let s = 0; s < steps; s++) {
        const u = s / steps;
        const pt = trackHelper.curve.getPointAt(u);
        const tangent = trackHelper.curve.getTangentAt(u).normalize();
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        const roadWidth = trackHelper.getRoadWidthAt(u);
        const rType = trackHelper.getRoadTypeAt(u);

        if (rType === 'bridge') continue;

        for (let side of [-1, 1]) {
          const clusterNoise = SimpleNoise.noise(pt.x / 40.0, pt.z / 40.0);
          
          // Populate roadside items based on local cluster noise logic (reduced coordinates count)
          const spawnGrass = (clusterNoise > 0.35) ? (Math.random() < 0.35) : (Math.random() < 0.10);
          const spawnFlower = (clusterNoise > 0.45) ? (Math.random() < 0.20) : (Math.random() < 0.05);
          const spawnBush = (clusterNoise > 0.30) ? (Math.random() < 0.20) : (Math.random() < 0.04);
          const spawnPlant = (clusterNoise > 0.40) ? (Math.random() < 0.18) : (Math.random() < 0.03);
          const spawnRock = (clusterNoise > 0.25) ? (Math.random() < 0.12) : (Math.random() < 0.02);

          const spawnChecks = [spawnGrass, spawnFlower, spawnBush, spawnPlant, spawnRock];

          for (let cat = 0; cat < 5; cat++) {
            if (!spawnChecks[cat]) continue;

            let minOffset = 0.3;
            let maxOffset = 1.8;
            if (cat === 0) { // Grass
              minOffset = 0.3; maxOffset = 1.8;
            } else if (cat === 1) { // Flower
              minOffset = 1.8; maxOffset = 4.2;
            } else if (cat === 2) { // Bush
              minOffset = 4.2; maxOffset = 8.5;
            } else if (cat === 3) { // Plant
              minOffset = 8.5; maxOffset = 12.0;
            } else if (cat === 4) { // Rock
              minOffset = 12.0; maxOffset = 15.0;
            }

            const perpOffset = roadWidth / 2 + minOffset + Math.random() * (maxOffset - minOffset);
            const tangentJitter = (Math.random() * 2.0 - 1.0) * 1.5;

            const pos = new THREE.Vector3()
              .copy(pt)
              .addScaledVector(normal, side * perpOffset)
              .addScaledVector(tangent, tangentJitter);

            pos.y = terrainManager.getHeight(pos.x, pos.z);

            // Skip if inside deep water level
            if (pos.y < 2.0) continue;

            // Skip near key game landmarks
            if (pos.distanceToSquared(trackHelper.pagodaPos) < 1225) continue; // 35m
            if (pos.distanceToSquared(trackHelper.waterfallPos) < 1600) continue; // 40m

            // Skip near starting/finish line
            if (u < 0.03 || u > 0.97) continue;

            // Skip near village houses
            let nearHouse = false;
            for (let house of trackHelper.villageHouses) {
              if (pos.distanceToSquared(house.position) < 169) { // 13m
                nearHouse = true;
                break;
              }
            }
            if (nearHouse) continue;

            const scaleVal = 0.8 + Math.random() * 0.7; // 0.8 to 1.5 Scale
            const rotYVal = Math.random() * Math.PI * 2; // 0 to 360 deg Rotation

            this.roadsideCoords[cat].push({
              position: pos,
              scale: scaleVal,
              rotationY: rotYVal
            });
          }
        }
      }
    } else {
      console.log('Successfully re-used organic coord system. Total Forest Trees preserved:', this.trees.length);
    }

    // 3. Pre-create High-LOD placeholder instanced meshes (for immediate responsive loading, swapped in background)
    for (let type = 0; type < 4; type++) {
      this.buildHighDetailPlaceholder(scene, type);
    }

    // 4. Pre-create Medium-LOD simplified geometry instanced meshes
    for (let type = 0; type < 4; type++) {
      this.buildMediumDetailMeshes(scene, type);
    }

    // 5. Pre-create Low-LOD double-sided SpeedTree crossing-quad Billboard instanced meshes
    for (let type = 0; type < 4; type++) {
      this.buildLowDetailBillboards(scene, type);
    }

    // 6. Pre-create roadside placeholders (loaded fast before Nature pack downloading completes)
    this.buildRoadsidePlaceholders(scene);

    // 7. Initiate background asynchronous GLTF loading via GLTFLoader and Draco Loader
    this.preloadTreeAssets(scene);
  }

  // Verification helper for tree placements
  private isValidTreeLocation(pos: THREE.Vector3, u: number, trackHelper: TrackGeometryHelper): boolean {
    if (pos.y < 2.0) return false;
    if (pos.y > 65.0) return false;
    if (u < 0.03 || u > 0.97) return false;

    if (pos.distanceToSquared(trackHelper.pagodaPos) < 1600) return false; // 40m
    if (pos.distanceToSquared(trackHelper.waterfallPos) < 2025) return false; // 45m

    for (let house of trackHelper.villageHouses) {
      if (pos.distanceToSquared(house.position) < 324) { // 18m
        return false;
      }
    }

    return true;
  }

  /**
   * Throttled frame updates of Instance-level LOD offsets.
   * Compares each dynamic distance from camera to tree coordinate, applying LOD visibility filters instantly using zero allocation scaling.
   */
  public update(playerPos: THREE.Vector3): void {
    if (!playerPos || this.trees.length === 0) return;

    const now = performance.now();
    // Update dynamically exactly every 0.25 seconds to preserve high FPS
    if (now - this.lastUpdateTime < 250) return;
    this.lastUpdateTime = now;

    // Skip update if user has moved less than 3.0 meters (stationary camera optimize)
    if (playerPos.distanceToSquared(this.lastCameraPos) < 9.0) {
      return;
    }
    this.lastCameraPos.copy(playerPos);

    // Dynamic Level of Detail squared range parameters:
    // LOD0: 0-50m (high-fidelity trees near camera)
    // LOD1: 50-120m (medium-fidelity performance models)
    // LOD2: 120-150m (low-fidelity crossing quads)
    // Beyond 150m: Hide vegetation completely to sustain 60+ FPS
    const highDistSq = 2500;
    const medDistSq = 14400;
    const lowDistSq = 22500;

    // 1. UPDATE CHOSEN LOD FOR FOREST TREES
    for (let type = 0; type < 4; type++) {
      const list = this.treesByType[type];
      const count = list.length;
      if (count === 0) continue;

      const highMeshes = this.highInsts[type];
      const medMeshes = this.medInsts[type];
      const lowMesh = this.lowInsts[type];

      let highNeedsUpdate = false;
      let medNeedsUpdate = false;
      let lowNeedsUpdate = false;

      for (let idx = 0; idx < count; idx++) {
        const t = list[idx];
        const distSq = playerPos.distanceToSquared(t.position);

        if (distSq < highDistSq) {
          // --- LOD HIGH ---
          highNeedsUpdate = true;
          this.dummyObj.position.copy(t.position);
          this.dummyObj.scale.set(t.scale, t.scale, t.scale);
          this.dummyObj.rotation.set(0, t.rotationY, 0);
          this.dummyObj.updateMatrix();

          // Standard meshes loop
          if (highMeshes.length > 0) {
            highMeshes.forEach((inst, mIdx) => {
              const submesh = this.gltfSubmeshes[type][mIdx];
              if (submesh) {
                this.tempMatrix.multiplyMatrices(this.dummyObj.matrix, submesh.localMatrix);
                inst.setMatrixAt(idx, this.tempMatrix);
              } else {
                inst.setMatrixAt(idx, this.dummyObj.matrix);
              }
            });
          }

          // Cull lower LODs
          if (medMeshes.length > 0) {
            medMeshes.forEach(inst => inst.setMatrixAt(idx, this.zeroMatrix));
            medNeedsUpdate = true;
          }
          if (lowMesh) {
            lowMesh.setMatrixAt(idx, this.zeroMatrix);
            lowNeedsUpdate = true;
          }

        } else if (distSq < medDistSq) {
          // --- LOD MEDIUM ---
          medNeedsUpdate = true;
          this.dummyObj.position.copy(t.position);
          this.dummyObj.scale.set(t.scale, t.scale, t.scale);
          this.dummyObj.rotation.set(0, t.rotationY, 0);
          this.dummyObj.updateMatrix();

          if (medMeshes.length > 0) {
            medMeshes.forEach(inst => inst.setMatrixAt(idx, this.dummyObj.matrix));
          }

          // Cull other LODs
          if (highMeshes.length > 0) {
            highMeshes.forEach(inst => inst.setMatrixAt(idx, this.zeroMatrix));
            highNeedsUpdate = true;
          }
          if (lowMesh) {
            lowMesh.setMatrixAt(idx, this.zeroMatrix);
            lowNeedsUpdate = true;
          }

        } else if (distSq < lowDistSq) {
          // --- LOD LOW (Billboard) ---
          lowNeedsUpdate = true;
          this.dummyObj.position.copy(t.position);
          this.dummyObj.scale.set(t.scale * 1.05, t.scale * 1.05, t.scale * 1.05);
          this.dummyObj.rotation.set(0, t.rotationY, 0);
          this.dummyObj.updateMatrix();

          if (lowMesh) {
            lowMesh.setMatrixAt(idx, this.dummyObj.matrix);
          }

          // Cull other LODs
          if (highMeshes.length > 0) {
            highMeshes.forEach(inst => inst.setMatrixAt(idx, this.zeroMatrix));
            highNeedsUpdate = true;
          }
          if (medMeshes.length > 0) {
            medMeshes.forEach(inst => inst.setMatrixAt(idx, this.zeroMatrix));
            medNeedsUpdate = true;
          }

        } else {
          // --- Beyond 1000m: CULL ---
          if (highMeshes.length > 0) {
            highMeshes.forEach(inst => inst.setMatrixAt(idx, this.zeroMatrix));
            highNeedsUpdate = true;
          }
          if (medMeshes.length > 0) {
            medMeshes.forEach(inst => inst.setMatrixAt(idx, this.zeroMatrix));
            medNeedsUpdate = true;
          }
          if (lowMesh) {
            lowMesh.setMatrixAt(idx, this.zeroMatrix);
            lowNeedsUpdate = true;
          }
        }
      }

      // Propagate updates to GPU
      if (highNeedsUpdate) {
        highMeshes.forEach(inst => {
          inst.instanceMatrix.needsUpdate = true;
        });
      }
      if (medNeedsUpdate) {
        medMeshes.forEach(inst => {
          inst.instanceMatrix.needsUpdate = true;
        });
      }
      if (lowNeedsUpdate && lowMesh) {
        lowMesh.instanceMatrix.needsUpdate = true;
      }
    }

    // 2. UPDATE ROADSIDE VEGETATION (Draw only within 150m for seamless graphics and FPS)
    const roadsideRangeSq = 150 * 150;
    for (let cat = 0; cat < 5; cat++) {
      const count = this.roadsideCoords[cat].length;
      if (count === 0) continue;

      const insts = this.roadsideInsts[cat];
      if (insts.length === 0) continue;

      let catNeedsUpdate = false;

      for (let i = 0; i < count; i++) {
        const item = this.roadsideCoords[cat][i];
        const distSq = playerPos.distanceToSquared(item.position);

        if (distSq < roadsideRangeSq) {
          catNeedsUpdate = true;
          this.dummyObj.position.copy(item.position);
          this.dummyObj.scale.set(item.scale, item.scale, item.scale);
          this.dummyObj.rotation.set(0, item.rotationY, 0);
          this.dummyObj.updateMatrix();

          insts.forEach((inst, mIdx) => {
            const submesh = this.naturePackSubmeshes[cat][mIdx];
            if (submesh) {
              this.tempMatrix.multiplyMatrices(this.dummyObj.matrix, submesh.localMatrix);
              inst.setMatrixAt(i, this.tempMatrix);
            } else {
              inst.setMatrixAt(i, this.dummyObj.matrix);
            }
          });
        } else {
          insts.forEach((inst) => {
            inst.setMatrixAt(i, this.zeroMatrix);
          });
          catNeedsUpdate = true;
        }
      }

      if (catNeedsUpdate) {
        insts.forEach((inst) => {
          inst.instanceMatrix.needsUpdate = true;
        });
      }
    }
  }

  /**
   * Builds High LOD visual tree placeholders using lightweight cylinders and cones/icosahedrons
   * to guarantee instant playability before background assets finish downloading.
   */
  private buildHighDetailPlaceholder(scene: THREE.Scene, type: number): void {
    const totalCount = this.treesByType[type].length;
    if (totalCount === 0) return;

    // Define trunk (Common weight and color)
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 3.0, 5);
    trunkGeo.translate(0, 1.5, 0); // shift pivot at bottom
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#54361e', roughness: 0.9, flatShading: true });

    let foliageGeo: THREE.BufferGeometry;
    let foliageColor = '#1e3014'; // default dark pine

    if (type === 0) {
      // Tall Pine Tree
      foliageGeo = new THREE.ConeGeometry(1.4, 5.5, 5);
      foliageGeo.translate(0, 4.25, 0);
      foliageColor = '#123d1b';
    } else if (type === 1) {
      // Old Tree (gnarled oak)
      foliageGeo = new THREE.DodecahedronGeometry(2.3, 1);
      foliageGeo.translate(0, 3.8, 0);
      foliageColor = '#194c1a';
    } else if (type === 2) {
      // Sakura Tree (gorgeous pink foliage)
      foliageGeo = new THREE.IcosahedronGeometry(2.0, 1);
      foliageGeo.translate(0, 3.4, 0);
      foliageColor = '#fca6c8';
    } else {
      // Tree GN
      foliageGeo = new THREE.IcosahedronGeometry(2.1, 1);
      foliageGeo.translate(0, 3.6, 0);
      foliageColor = '#2b934b';
    }

    const foliageMat = new THREE.MeshStandardMaterial({
      color: foliageColor,
      roughness: 0.9,
      flatShading: true
    });

    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, totalCount);
    const foliageInst = new THREE.InstancedMesh(foliageGeo, foliageMat, totalCount);

    trunkInst.castShadow = true;
    trunkInst.receiveShadow = true;
    foliageInst.castShadow = true;
    foliageInst.receiveShadow = true;

    // Place initially hiding (all scaled to zero until camera updates it)
    for (let i = 0; i < totalCount; i++) {
      trunkInst.setMatrixAt(i, this.zeroMatrix);
      foliageInst.setMatrixAt(i, this.zeroMatrix);
    }

    trunkInst.instanceMatrix.needsUpdate = true;
    foliageInst.instanceMatrix.needsUpdate = true;

    scene.add(trunkInst, foliageInst);
    this.highInsts[type] = [trunkInst, foliageInst];
  }

  /**
   * Pre-builds low polygon meshes for the Medium detail stage of the Level of Detail scheduler.
   */
  private buildMediumDetailMeshes(scene: THREE.Scene, type: number): void {
    const totalCount = this.treesByType[type].length;
    if (totalCount === 0) return;

    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.20, 2.6, 4);
    trunkGeo.translate(0, 1.3, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#482e18', roughness: 0.95, flatShading: true });

    let foliageGeo: THREE.BufferGeometry;
    let foliageColor = '#102d13';

    if (type === 0) {
      foliageGeo = new THREE.ConeGeometry(1.1, 4.5, 4);
      foliageGeo.translate(0, 3.5, 0);
      foliageColor = '#103716';
    } else if (type === 1) {
      foliageGeo = new THREE.BoxGeometry(2.3, 2.3, 2.3);
      foliageGeo.translate(0, 3.2, 0);
      foliageColor = '#164017';
    } else if (type === 2) {
      foliageGeo = new THREE.IcosahedronGeometry(1.5, 0);
      foliageGeo.translate(0, 3.0, 0);
      foliageColor = '#fca6c8';
    } else {
      foliageGeo = new THREE.IcosahedronGeometry(1.5, 0);
      foliageGeo.translate(0, 3.2, 0);
      foliageColor = '#247b3f';
    }

    const foliageMat = new THREE.MeshStandardMaterial({
      color: foliageColor,
      roughness: 0.95,
      flatShading: true
    });

    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, totalCount);
    const foliageInst = new THREE.InstancedMesh(foliageGeo, foliageMat, totalCount);

    trunkInst.castShadow = false;
    trunkInst.receiveShadow = true;
    foliageInst.castShadow = false;

    // Initialize as culled
    for (let i = 0; i < totalCount; i++) {
      trunkInst.setMatrixAt(i, this.zeroMatrix);
      foliageInst.setMatrixAt(i, this.zeroMatrix);
    }

    trunkInst.instanceMatrix.needsUpdate = true;
    foliageInst.instanceMatrix.needsUpdate = true;

    scene.add(trunkInst, foliageInst);
    this.medInsts[type] = [trunkInst, foliageInst];
  }

  /**
   * Pre-builds crossing-quad SpeedTree style billboard quads mapped with custom generated
   * procedurally stylized canvas texture trees to ensure high fidelity rendering in absolute distance.
   */
  private buildLowDetailBillboards(scene: THREE.Scene, type: number): void {
    const totalCount = this.treesByType[type].length;
    if (totalCount === 0) return;

    // Height of 6.2 meters, width of 3.4 meters
    const billboardGeo = this.createCrossQuadGeometry(3.6, 6.8);
    
    // Draw procedural tree leaf silhouette texture on Canvas (zero resource load)
    const texture = this.createProceduralTreeCanvasTexture(type);
    
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: 1.0,
      metalness: 0.0
    });

    const inst = new THREE.InstancedMesh(billboardGeo, mat, totalCount);
    inst.castShadow = false;
    inst.receiveShadow = false;

    // Initialize as zero scale (culled)
    for (let i = 0; i < totalCount; i++) {
      inst.setMatrixAt(i, this.zeroMatrix);
    }
    inst.instanceMatrix.needsUpdate = true;

    scene.add(inst);
    this.lowInsts[type] = inst;
  }

  /**
   * Builds roadside placeholders before the Stylized Nature Pack loads.
   */
  private buildRoadsidePlaceholders(scene: THREE.Scene): void {
    const grassGeo = new THREE.ConeGeometry(0.12, 0.45, 4);
    grassGeo.translate(0, 0.225, 0);
    const grassMat = new THREE.MeshStandardMaterial({ color: '#27ae60', roughness: 0.9, flatShading: true });

    const flowerGeo = new THREE.DodecahedronGeometry(0.12, 0);
    flowerGeo.translate(0, 0.4, 0);
    const flowerMat = new THREE.MeshStandardMaterial({ color: '#e74c3c', roughness: 0.8, flatShading: true });

    const bushGeo = new THREE.IcosahedronGeometry(0.35, 1);
    bushGeo.translate(0, 0.25, 0);
    const bushMat = new THREE.MeshStandardMaterial({ color: '#1b4d22', roughness: 0.9, flatShading: true });

    const plantGeo = new THREE.DodecahedronGeometry(0.28, 0);
    plantGeo.translate(0, 0.3, 0);
    const plantMat = new THREE.MeshStandardMaterial({ color: '#2ecc71', roughness: 0.9, flatShading: true });

    const rockGeo = new THREE.DodecahedronGeometry(0.3, 0);
    rockGeo.translate(0, 0.15, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: '#7f8c8d', roughness: 0.85, flatShading: true });

    const geometries = [grassGeo, flowerGeo, bushGeo, plantGeo, rockGeo];
    const materials = [grassMat, flowerMat, bushMat, plantMat, rockMat];

    for (let cat = 0; cat < 5; cat++) {
      const count = this.roadsideCoords[cat].length;
      if (count === 0) continue;

      const inst = new THREE.InstancedMesh(geometries[cat], materials[cat], count);
      inst.castShadow = false;
      inst.receiveShadow = false;

      for (let i = 0; i < count; i++) {
        inst.setMatrixAt(i, this.zeroMatrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      scene.add(inst);

      this.roadsideInsts[cat] = [inst];
    }
  }

  /**
   * Pre-fetches high detail GLTF meshes asynchronously in the background.
   */
  private async preloadTreeAssets(scene: THREE.Scene): Promise<void> {
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    loader.setDRACOLoader(draco);
    loader.register((parser) => new GLTFMaterialsPBRSpecularGlossinessExtension(parser));

    const allUrls = [
      '', // pine tree - removed
      '', // old tree - removed
      'https://pub-a248afed72844944a7565dc9cbaacbb0.r2.dev/Trees/sakura.glb',
      'https://pub-a248afed72844944a7565dc9cbaacbb0.r2.dev/Trees/tree_gn.glb',
      'https://pub-a248afed72844944a7565dc9cbaacbb0.r2.dev/Trees/stylized_nature_pack_vol-1__3d_tree.glb'
    ];

    console.log('Initiating tree and vegetation asset preloader pipeline in background...');

    const loadPromises = allUrls.map((url, index) => {
      if (!url) {
        return Promise.resolve();
      }

      if (ForestSystem.treeCache.has(url)) {
        console.log(`Reusing cached asset for ${url}`);
        const cachedScene = ForestSystem.treeCache.get(url)!;
        if (index === 4) {
          const classified = this.extractAndClassifyNaturePack(cachedScene.clone(true));
          this.swapRoadsidePlacer(scene, classified);
        } else {
          const submeshes = this.extractSubmeshes(cachedScene.clone(true));
          this.swapHighDetailPlacer(scene, index, submeshes);
        }
        return Promise.resolve();
      }

      if (ForestSystem.activeDownloads.has(url)) {
        console.log(`Avoid duplicate download of: ${url} (already loading)`);
        return Promise.resolve();
      }
      ForestSystem.activeDownloads.add(url);
      const startTime = performance.now();

      return new Promise<void>((resolve) => {
        loader.load(
          url,
          (gltf) => {
            const duration = performance.now() - startTime;
            console.log(`Successfully completed preloading GLB: ${url} in ${duration.toFixed(1)}ms`);
            applyGltfMaterialFix(gltf.scene);
            ForestSystem.treeCache.set(url, gltf.scene);
            ForestSystem.activeDownloads.delete(url);
            if (index === 4) {
              const classified = this.extractAndClassifyNaturePack(gltf.scene);
              this.swapRoadsidePlacer(scene, classified);
            } else {
              const submeshes = this.extractSubmeshes(gltf.scene);
              this.swapHighDetailPlacer(scene, index, submeshes);
            }
            resolve();
          },
          undefined,
          (error) => {
            console.error(`Recoverable: Could not download asset model from ${url}. Switched to fallback placeholders.`, error);
            ForestSystem.activeDownloads.delete(url);
            resolve();
          }
        );
      });
    });

    Promise.allSettled(loadPromises).then(() => {
      console.log('Tree and vegetation preloader pipeline completed all operations.');
    });
  }

  /**
   * Swaps out placeholder high detailed shapes with true parsed submeshes loaded from GLB.
   */
  private swapHighDetailPlacer(scene: THREE.Scene, type: number, glbMeshes: ExtractedSubmesh[]): void {
    if (glbMeshes.length === 0) return;

    const totalCount = this.treesByType[type].length;
    if (totalCount === 0) return;

    // Discard preceding placeholders from scene
    const placeholderInsts = this.highInsts[type];
    placeholderInsts.forEach((inst) => {
      scene.remove(inst);
      inst.dispose();
    });

    // Cache the ExtractedSubmesh structures
    this.gltfSubmeshes[type] = glbMeshes;

    // Instantiate brand-new real high detail GLB InstancedMeshes
    const newHighInsts = glbMeshes.map((m) => {
      const inst = new THREE.InstancedMesh(m.geometry, m.material, totalCount);
      inst.castShadow = true;
      inst.receiveShadow = true;
      scene.add(inst);
      return inst;
    });

    // Populate positions as scaling=0 initially until Scheduler update runs
    for (let i = 0; i < totalCount; i++) {
      newHighInsts.forEach((inst) => {
        inst.setMatrixAt(i, this.zeroMatrix);
      });
    }

    newHighInsts.forEach(inst => {
      inst.instanceMatrix.needsUpdate = true;
    });

    this.highInsts[type] = newHighInsts;
    this.isLoaded[type] = true;

    // Force an immediate update block calculation
    this.lastCameraPos.set(Infinity, Infinity, Infinity);
  }

  /**
   * Swaps out roadside placeholders with loaded, classified Stylized Nature Pack entries.
   */
  private swapRoadsidePlacer(scene: THREE.Scene, categoriesSubmeshes: ExtractedSubmesh[][]): void {
    console.log('Swapping roadside placeholders with real Nature Pack GLB submeshes!');
    
    for (let cat = 0; cat < 5; cat++) {
      const submeshes = categoriesSubmeshes[cat];
      if (submeshes.length === 0) continue;

      const count = this.roadsideCoords[cat].length;
      if (count === 0) continue;

      // Discard placeholders
      const placeholders = this.roadsideInsts[cat];
      placeholders.forEach((inst) => {
        scene.remove(inst);
        inst.dispose();
      });

      this.naturePackSubmeshes[cat] = submeshes;

      // Instantiate loaded submeshes
      const newInsts = submeshes.map((m) => {
        const inst = new THREE.InstancedMesh(m.geometry, m.material, count);
        inst.castShadow = false;
        inst.receiveShadow = false;
        scene.add(inst);
        return inst;
      });

      // Clear initially
      for (let i = 0; i < count; i++) {
        newInsts.forEach((inst) => inst.setMatrixAt(i, this.zeroMatrix));
      }
      newInsts.forEach(inst => {
        inst.instanceMatrix.needsUpdate = true;
      });

      this.roadsideInsts[cat] = newInsts;
    }

    this.isNaturePackLoaded = true;
    
    // Force immediate update loop calculation
    this.lastCameraPos.set(Infinity, Infinity, Infinity);
  }

  /**
   * Traverses a cloned or raw loaded GLTF hierarchy to capture child Mesh components relative to its local coordinates.
   */
  private extractSubmeshes(model: THREE.Object3D): ExtractedSubmesh[] {
    const result: ExtractedSubmesh[] = [];

    // Temporarily reset parent transform to grab nested worldMatrix offsets of parts
    const prevPos = model.position.clone();
    const prevRot = model.rotation.clone();
    const prevScale = model.scale.clone();

    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    model.updateMatrixWorld(true);

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Clone geometry to isolate instances and preserve original GLB shapes
        result.push({
          geometry: child.geometry.clone(),
          material: child.material,
          localMatrix: child.matrixWorld.clone()
        });
      }
    });

    // Restore root layout transformation
    model.position.copy(prevPos);
    model.rotation.copy(prevRot);
    model.scale.copy(prevScale);
    model.updateMatrixWorld(true);

    return result;
  }

  /**
   * Classify submeshes in the Nature Pack GLB using string matching.
   */
  private extractAndClassifyNaturePack(scene: THREE.Object3D): ExtractedSubmesh[][] {
    const categories: ExtractedSubmesh[][] = [[], [], [], [], []]; // 0: Grass, 1: Flower, 2: Bush, 3: Plant, 4: Rock
    
    const prevPos = scene.position.clone();
    const prevRot = scene.rotation.clone();
    const prevScale = scene.scale.clone();
    scene.position.set(0, 0, 0);
    scene.rotation.set(0, 0, 0);
    scene.scale.set(1, 1, 1);
    scene.updateMatrixWorld(true);

    let unclassifiedCount = 0;

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const name = child.name.toLowerCase();
        const submesh: ExtractedSubmesh = {
          geometry: child.geometry.clone(),
          material: child.material,
          localMatrix: child.matrixWorld.clone()
        };

        // Classify based on node name
        if (name.includes('grass') || name.includes('ground') || name.includes('turf') || name.includes('clover') || name.includes('lawn')) {
          categories[0].push(submesh);
        } else if (name.includes('flower') || name.includes('petal') || name.includes('tulip') || name.includes('blossom') || name.includes('flora') || name.includes('violet') || name.includes('poppy')) {
          categories[1].push(submesh);
        } else if (name.includes('bush') || name.includes('shrub') || name.includes('hedge') || name.includes('foliage')) {
          categories[2].push(submesh);
        } else if (name.includes('plant') || name.includes('fern') || name.includes('leaf') || name.includes('weed') || name.includes('ivy') || name.includes('dandelion')) {
          categories[3].push(submesh);
        } else if (name.includes('rock') || name.includes('stone') || name.includes('boulder') || name.includes('pebble') || name.includes('gravel') || name.includes('debris')) {
          categories[4].push(submesh);
        } else {
          // Fallback distribution
          const index = unclassifiedCount % 5;
          categories[index].push(submesh);
          unclassifiedCount++;
        }
      }
    });

    scene.position.copy(prevPos);
    scene.rotation.copy(prevRot);
    scene.scale.copy(prevScale);
    scene.updateMatrixWorld(true);

    return categories;
  }

  /**
   * Generates double-sided perpendicular quads.
   */
  private createCrossQuadGeometry(width: number, height: number): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const halfW = width / 2;

    const vertices = new Float32Array([
      // Quad 1: Aligned on X-axis (offset centered at bottom)
      -halfW, 0, 0,
       halfW, 0, 0,
       halfW, height, 0,
      -halfW, height, 0,

      // Quad 2: Aligned on Z-axis (offset centered at bottom)
      0, 0, -halfW,
      0, 0,  halfW,
      0, height,  halfW,
      0, height, -halfW
    ]);

    const uvs = new Float32Array([
      0, 0,
      1, 0,
      1, 1,
      0, 1,

      0, 0,
      1, 0,
      1, 1,
      0, 1
    ]);

    const indices = [
      0, 1, 2,  0, 2, 3,
      4, 5, 6,  4, 6, 7
    ];

    const normals = new Float32Array([
      0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
      1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0
    ]);

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setIndex(indices);

    return geometry;
  }

  /**
   * Generates distinctive, clean, high fidelity vector tree quads procedurally onto Canvas as CanvasTexture
   */
  private createProceduralTreeCanvasTexture(type: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 128, 256);

    // Draw solid tree trunk root
    ctx.fillStyle = '#41220a';
    ctx.fillRect(58, 165, 12, 91);

    if (type === 0) {
      // Tall Pine Tree: layered evergreen triangles
      ctx.fillStyle = '#0a230f';
      ctx.beginPath();
      ctx.moveTo(64, 15); ctx.lineTo(24, 90); ctx.lineTo(104, 90); ctx.closePath(); ctx.fill();

      ctx.fillStyle = '#113518';
      ctx.beginPath();
      ctx.moveTo(64, 55); ctx.lineTo(16, 135); ctx.lineTo(112, 135); ctx.closePath(); ctx.fill();

      ctx.fillStyle = '#1e5229';
      ctx.beginPath();
      ctx.moveTo(64, 95); ctx.lineTo(6, 175); ctx.lineTo(122, 175); ctx.closePath(); ctx.fill();
    } else if (type === 1) {
      // Old Tree (Gnarled broad oak)
      ctx.fillStyle = '#14310e';
      ctx.beginPath();
      ctx.arc(64, 90, 50, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1f4816';
      ctx.beginPath();
      ctx.arc(42, 110, 36, 0, Math.PI * 2);
      ctx.arc(86, 110, 36, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#2c6222';
      ctx.beginPath();
      ctx.arc(64, 125, 40, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 2) {
      // Sakura Tree (gorgeous pink bloom variations)
      ctx.fillStyle = '#cf3977';
      ctx.beginPath();
      ctx.arc(64, 90, 48, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ea5c9d';
      ctx.beginPath();
      ctx.arc(42, 110, 36, 0, Math.PI * 2);
      ctx.arc(86, 110, 36, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ff94c9';
      ctx.beginPath();
      ctx.arc(64, 125, 42, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Tree GN (Bright vibrant summer green)
      ctx.fillStyle = '#114a1c';
      ctx.beginPath();
      ctx.arc(64, 85, 48, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#227e36';
      ctx.beginPath();
      ctx.arc(40, 105, 34, 0, Math.PI * 2);
      ctx.arc(88, 105, 34, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#3eb058';
      ctx.beginPath();
      ctx.arc(64, 120, 38, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  public destroy(): void {
    ForestSystem.initialized = false;
    this.isInitialized = false;

    // Collect all unique geometries, materials, and textures to dispose
    const geometriesToDispose = new Set<THREE.BufferGeometry>();
    const materialsToDispose = new Set<THREE.Material>();
    const texturesToDispose = new Set<THREE.Texture>();

    // Helper function to register an InstancedMesh for removal and disposal
    const cleanupMesh = (mesh: THREE.InstancedMesh) => {
      if (!mesh) return;
      if (this.scene) {
        this.scene.remove(mesh);
      }
      if (mesh.geometry) {
        geometriesToDispose.add(mesh.geometry);
      }
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => {
            materialsToDispose.add(m);
            if ((m as any).map) texturesToDispose.add((m as any).map);
          });
        } else {
          materialsToDispose.add(mesh.material);
          if ((mesh.material as any).map) texturesToDispose.add((mesh.material as any).map);
        }
      }
    };

    // Dispose highInsts
    this.highInsts.forEach(arr => {
      if (arr) {
        arr.forEach(cleanupMesh);
      }
    });

    // Dispose medInsts
    this.medInsts.forEach(arr => {
      if (arr) {
        arr.forEach(cleanupMesh);
      }
    });

    // Dispose lowInsts
    this.lowInsts.forEach(mesh => {
      if (mesh) {
        cleanupMesh(mesh);
      }
    });

    // Dispose roadsideInsts
    this.roadsideInsts.forEach(arr => {
      if (arr) {
        arr.forEach(cleanupMesh);
      }
    });

    // Actually dispose!
    geometriesToDispose.forEach(g => {
      try { g.dispose(); } catch (e) {}
    });
    materialsToDispose.forEach(m => {
      try { m.dispose(); } catch (e) {}
    });
    texturesToDispose.forEach(t => {
      try { t.dispose(); } catch (e) {}
    });

    this.trees = [];
    this.treesByType = [[], [], [], []];
    this.highInsts = [[], [], [], []];
    this.medInsts = [[], [], [], []];
    this.lowInsts = [];
    this.gltfSubmeshes = [[], [], [], []];

    // Detach and clean roadside details
    this.roadsideCoords = [[], [], [], [], []];
    this.roadsideInsts = [[], [], [], [], []];
    this.naturePackSubmeshes = [[], [], [], [], []];
    this.isNaturePackLoaded = false;

    this.scene = null;
    this.trackHelper = null;
  }
}

export const forestSystem = ForestSystem.getInstance();

export function buildForest(scene: THREE.Scene, trackHelper: TrackGeometryHelper): void {
  if (forestSystem.initialized) {
    console.log('Forest already built, skipping buildForest.');
    return;
  }

  // Initialize the singleton forest system
  forestSystem.init(scene, trackHelper);

  // --- ALPINE RUSTIC WOODEN FENCES ---
  // Renders beautiful logs and fence barriers framing the spline curves as visual accents
  const fencesGroup = new THREE.Group();
  fencesGroup.name = 'scenery_forest_fences';
  const fencePostGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.3, 5);
  const fenceLogGeo = new THREE.CylinderGeometry(0.07, 0.07, 4.25, 5);
  fenceLogGeo.rotateX(Math.PI / 2); // align horizontally

  const fenceWoodMat = new THREE.MeshStandardMaterial({
    color: '#4d3a2b',
    roughness: 0.9,
    flatShading: true
  });

  const samples = 140;
  const fencePostInst = new THREE.InstancedMesh(fencePostGeo, fenceWoodMat, 282);
  const fenceLogInst = new THREE.InstancedMesh(fenceLogGeo, fenceWoodMat, 560);

  fencePostInst.castShadow = false;
  fencePostInst.receiveShadow = true;
  fenceLogInst.castShadow = false;

  const fenceDummy = new THREE.Object3D();
  let postCount = 0;
  let logCount = 0;

  const postPositionsLeft: THREE.Vector3[] = [];
  const postPositionsRight: THREE.Vector3[] = [];

  for (let s = 0; s <= samples; s++) {
    const u = 0.10 + (s / samples) * 0.10; // spline curve subset
    const pt = trackHelper.curve.getPointAt(u);
    const tangent = trackHelper.curve.getTangentAt(u).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const roadWidth = trackHelper.getRoadWidthAt(u);

    const pL = new THREE.Vector3().copy(pt).addScaledVector(normal, -1 * (roadWidth / 2 + 0.8));
    pL.y = terrainManager.getHeight(pL.x, pL.z) + 0.52;
    postPositionsLeft.push(pL);

    fenceDummy.position.copy(pL);
    fenceDummy.rotation.set(0, 0, 0);
    fenceDummy.scale.set(1, 1, 1);
    fenceDummy.updateMatrix();
    if (postCount < 282) {
      fencePostInst.setMatrixAt(postCount++, fenceDummy.matrix);
    }

    const pR = new THREE.Vector3().copy(pt).addScaledVector(normal, 1 * (roadWidth / 2 + 0.8));
    pR.y = terrainManager.getHeight(pR.x, pR.z) + 0.52;
    postPositionsRight.push(pR);

    fenceDummy.position.copy(pR);
    fenceDummy.updateMatrix();
    if (postCount < 282) {
      fencePostInst.setMatrixAt(postCount++, fenceDummy.matrix);
    }

    if (s > 0) {
      const pL_prev = postPositionsLeft[s - 1];
      const anchorL_curr = new THREE.Vector3(pL.x, pL.y + 0.33, pL.z);
      const anchorL_prev = new THREE.Vector3(pL_prev.x, pL_prev.y + 0.33, pL_prev.z);

      fenceDummy.position.copy(anchorL_curr).add(anchorL_prev).multiplyScalar(0.5);
      fenceDummy.lookAt(anchorL_curr);
      const distL = anchorL_curr.distanceTo(anchorL_prev);
      fenceDummy.scale.set(1, 1, distL / 4.25);
      fenceDummy.updateMatrix();
      if (logCount < 560) {
        fenceLogInst.setMatrixAt(logCount++, fenceDummy.matrix);
      }

      fenceDummy.position.y -= 0.4;
      fenceDummy.updateMatrix();
      if (logCount < 560) {
        fenceLogInst.setMatrixAt(logCount++, fenceDummy.matrix);
      }

      const pR_prev = postPositionsRight[s - 1];
      const anchorR_curr = new THREE.Vector3(pR.x, pR.y + 0.33, pR.z);
      const anchorR_prev = new THREE.Vector3(pR_prev.x, pR_prev.y + 0.33, pR_prev.z);

      fenceDummy.position.copy(anchorR_curr).add(anchorR_prev).multiplyScalar(0.5);
      fenceDummy.lookAt(anchorR_curr);
      const distR = anchorR_curr.distanceTo(anchorR_prev);
      fenceDummy.scale.set(1, 1, distR / 4.25);
      fenceDummy.updateMatrix();
      if (logCount < 560) {
        fenceLogInst.setMatrixAt(logCount++, fenceDummy.matrix);
      }

      fenceDummy.position.y -= 0.4;
      fenceDummy.updateMatrix();
      if (logCount < 560) {
        fenceLogInst.setMatrixAt(logCount++, fenceDummy.matrix);
      }
    }
  }

  fencePostInst.instanceMatrix.needsUpdate = true;
  fenceLogInst.instanceMatrix.needsUpdate = true;

  fencesGroup.add(fencePostInst, fenceLogInst);
  scene.add(fencesGroup);

  lodManager.registerSector(
    'Forest Fences',
    800, 20, 1100,
    fencesGroup,
    280, 520
  );
}
