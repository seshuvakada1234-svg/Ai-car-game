import * as THREE from 'three';
import { TrackGeometryHelper } from '../utils/track';
import { terrainManager } from './terrainManager';
import { lodManager } from './lodManager';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

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

class ForestSystem {
  private static instance: ForestSystem | null = null;

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

  private lastCameraPos = new THREE.Vector3(Infinity, Infinity, Infinity);
  private updateFrameCounter = 0;
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

  /**
   * Builds and initializes the forest, placing custom instanced meshes with placeholders initially,
   * then launches background asynchronous preloading of the high-fidelity GLB models.
   */
  public init(scene: THREE.Scene, trackHelper: TrackGeometryHelper): void {
    if (this.isInitialized) {
      console.log('ForestSystem already initialized, skipping duplicate init.');
      return;
    }
    this.isInitialized = true;

    this.scene = scene;
    this.trackHelper = trackHelper;
    this.trees = [];
    this.treesByType = [[], [], [], []];
    this.highInsts = [[], [], [], []];
    this.medInsts = [[], [], [], []];
    this.lowInsts = [];
    this.gltfSubmeshes = [[], [], [], []];
    this.isLoaded = [false, false, false, false];
    this.lastCameraPos.set(Infinity, Infinity, Infinity);
    this.updateFrameCounter = 0;

    console.log('Initializing Forest System...');

    // 1. Filter, distribute, and populate tree coordinates following strict road and landscape rules
    const rawTrees = trackHelper.trees;
    let treeIdCounter = 0;

    rawTrees.forEach((t) => {
      // Enforce scale boundaries as requested by user
      const tScale = 0.8 + Math.random() * 0.7; // 0.8 to 1.5
      const tRotY = Math.random() * Math.PI * 2; // 0 to 360 deg

      // STRICT ROAD RULES & COLLISION EXCLUSIONS:
      // Minimum distance from road is Road Edge + 15 meters
      const tInfo = trackHelper.getNearestTrackInfo(t.position);
      if (tInfo && tInfo.nearestPoint) {
        const roadWidth = trackHelper.getRoadWidthAt(tInfo.progress);
        const minDistanceAllowed = roadWidth / 2 + 15.0; // Keep at least Road edge + 15 meters
        if (tInfo.distanceToTrack < minDistanceAllowed) {
          return; // Skip tree!
        }

        // FOREST DENSITY gradient check based on spatial distance to road corridor
        const distFromRoadEdge = tInfo.distanceToTrack - roadWidth / 2;
        if (distFromRoadEdge < 35.0) {
          // Near roads: Sparse Forest (keep only 18%)
          if (Math.random() > 0.18) return;
        } else if (distFromRoadEdge < 75.0) {
          // Middle distance: Medium Density (keep 50%)
          if (Math.random() > 0.50) return;
        }
        // Far distance: Dense Forest (keeps 100% of generated landscape trees!)
      }

      // Prevent intersections with major landmarks/buildings to guarantee no floating or structural overlaps
      const pagodaDistance = t.position.distanceTo(trackHelper.pagodaPos);
      if (pagodaDistance < 40.0) return; // Skip near starting village pagoda

      const waterfallDistance = t.position.distanceTo(trackHelper.waterfallPos);
      if (waterfallDistance < 45.0) return; // Skip inside waterfall plunge pool/mill

      // Select type safely mapped to 0-3
      const mappedType = t.type % 4;

      const newTree: ForestTree = {
        id: treeIdCounter++,
        position: t.position.clone(),
        scale: tScale,
        rotationY: tRotY,
        type: mappedType
      };

      // Perfect alignment on terrain height
      newTree.position.y = terrainManager.getHeight(newTree.position.x, newTree.position.z);

      this.trees.push(newTree);
      this.treesByType[mappedType].push(newTree);
    });

    console.log(`Forest populated: Total of ${this.trees.length} valid trees arranged into organic clusters!`);

    // 2. Pre-create High-LOD placeholder instanced meshes (for immediate responsive loading, swapped in background)
    for (let type = 0; type < 4; type++) {
      this.buildHighDetailPlaceholder(scene, type);
    }

    // 3. Pre-create Medium-LOD simplified geometry instanced meshes
    for (let type = 0; type < 4; type++) {
      this.buildMediumDetailMeshes(scene, type);
    }

    // 4. Pre-create Low-LOD double-sided SpeedTree crossing-quad Billboard instanced meshes
    for (let type = 0; type < 4; type++) {
      this.buildLowDetailBillboards(scene, type);
    }

    // 5. Build rich Ground Details (Grass, Flowers, Bushes, Small Rocks) close to road edge
    this.buildGroundDetails(scene, trackHelper);

    // 6. Initiate background asynchronous GLTF loading via GLTFLoader and Draco Loader
    this.preloadTreeAssets(scene);
  }

  /**
   * Throttled frame updates of Instance-level LOD offsets.
   * Compares each dynamic distance from camera to tree coordinate, applying LOD visibility filters instantly using zero allocation scaling.
   */
  public update(playerPos: THREE.Vector3): void {
    if (!playerPos || this.trees.length === 0) return;

    this.updateFrameCounter++;
    // Throttle checks every 10 frames to optimize CPU to preserve 60 FPS target
    if (this.updateFrameCounter % 10 !== 0) return;

    // Skip update if user has moved less than 3.0 meters (stationary camera optimize)
    if (playerPos.distanceToSquared(this.lastCameraPos) < 9.0) {
      return;
    }
    this.lastCameraPos.copy(playerPos);

    // Squared distance thresholds for ultra-fast arithmetic operations
    const highDistSq = 140 * 140; // 140m High Detail (Full GLB model)
    const medDistSq = 350 * 350;  // 350m Medium Detail (Simplified low poly)
    const lowDistSq = 900 * 900;  // 1000m Low Detail (Billboard). Beyond 1000m completely culled/unloaded

    for (let type = 0; type < 4; type++) {
      const list = this.treesByType[type];
      const count = list.length;
      if (count === 0) continue;

      const highMeshes = this.highInsts[type];
      const medMeshes = this.medInsts[type];
      const lowMesh = this.lowInsts[type];

      // Track if we need to call dynamic matrix updates
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
          // Scale quads slightly larger in distance to stand out more realistically
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
          // --- CULL / VISIBILITY OFF (>1000m Unloading) ---
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

      // Propagate instanced matrix modifications to the GPU
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
   * Injects beautiful high density organic foliage details next to spline corridor boundaries
   * (sitting perfectly on terrain geometries)
   */
  private buildGroundDetails(scene: THREE.Scene, trackHelper: TrackGeometryHelper): void {
    console.log('Generating high-density ground details next to roads...');

    // 1. Grass clusters setup
    const grassGeo = new THREE.ConeGeometry(0.35, 1.1, 4);
    grassGeo.translate(0, 0.55, 0);
    const grassMat = new THREE.MeshStandardMaterial({ color: '#27ae60', roughness: 0.95, flatShading: true });
    
    const numGrass = 1400;
    const grassInst = new THREE.InstancedMesh(grassGeo, grassMat, numGrass);
    grassInst.castShadow = false;
    grassInst.receiveShadow = true;

    // 2. Bushes setup
    const bushGeo = new THREE.IcosahedronGeometry(0.7, 1);
    bushGeo.translate(0, 0.35, 0);
    const bushMat = new THREE.MeshStandardMaterial({ color: '#145c26', roughness: 0.92, flatShading: true });

    const numBushes = 350;
    const bushInst = new THREE.InstancedMesh(bushGeo, bushMat, numBushes);
    bushInst.castShadow = true;

    // 3. Flower clusters setup
    const flowerGeo = new THREE.DodecahedronGeometry(0.18, 0);
    const flowerColors = ['#e74c3c', '#f1c40f', '#9b59b6', '#ecf0f1', '#f39c12'];
    const flowerMats = flowerColors.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true }));
    
    const numFlowers = 750;
    const flowerMeshGroups = flowerMats.map(fm => new THREE.InstancedMesh(flowerGeo, fm, 150));

    // 4. Little gravel rocks setup
    const rockGeo = new THREE.DodecahedronGeometry(0.4, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: '#686a6e', roughness: 0.95, flatShading: true });

    const numRocks = 300;
    const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, numRocks);
    rockInst.castShadow = true;

    const dummyPlacer = new THREE.Object3D();

    // Linearly distribute details on random sides of the tracks
    for (let prG = 0; prG < numGrass; prG++) {
      const u = (prG / numGrass) % 1.0;
      const pt = trackHelper.curve.getPointAt(u);
      const tangent = trackHelper.curve.getTangentAt(u).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const roadWidth = trackHelper.getRoadWidthAt(u);

      const side = Math.random() > 0.5 ? 1 : -1;
      // Spawn ground detail 1.5 to 18 meters from road shoulder
      const offset = roadWidth / 2 + 1.5 + Math.random() * 16.5;
      const pos = new THREE.Vector3().copy(pt).addScaledVector(normal, side * offset);
      pos.y = terrainManager.getHeight(pos.x, pos.z);

      // Verify not spawning in deep water
      if (pos.y < 2.0) continue;

      dummyPlacer.position.copy(pos);
      dummyPlacer.rotation.set(0, Math.random() * Math.PI, 0);
      const gScale = 0.65 + Math.random() * 0.7;
      dummyPlacer.scale.set(gScale, gScale * 1.2, gScale);
      dummyPlacer.updateMatrix();

      grassInst.setMatrixAt(prG, dummyPlacer.matrix);

      // Occasional bushes
      if (prG % 4 === 0) {
        const bIdx = Math.floor(prG / 4) % numBushes;
        dummyPlacer.position.copy(pos).add(new THREE.Vector3(Math.random()*1.5 - 0.75, 0.1, Math.random()*1.5 - 0.75));
        const bScale = 0.7 + Math.random() * 0.8;
        dummyPlacer.scale.set(bScale, bScale, bScale);
        dummyPlacer.updateMatrix();
        bushInst.setMatrixAt(bIdx, dummyPlacer.matrix);
      }

      // Occasional flowers
      if (prG % 2 === 0) {
        const flowerGroupIdx = Math.floor(Math.random() * flowerMeshGroups.length);
        const groupInst = flowerMeshGroups[flowerGroupIdx];
        const innerSlot = Math.floor(prG / 2) % 150;

        dummyPlacer.position.copy(pos).add(new THREE.Vector3(Math.random() * 0.8 - 0.4, 0.25, Math.random() * 0.8 - 0.4));
        const fScale = 0.8 + Math.random() * 0.5;
        dummyPlacer.scale.set(fScale, fScale, fScale);
        dummyPlacer.updateMatrix();
        groupInst.setMatrixAt(innerSlot, dummyPlacer.matrix);
      }

      // Occasional little rocks
      if (prG % 5 === 0) {
        const rIdx = Math.floor(prG / 5) % numRocks;
        dummyPlacer.position.copy(pos).add(new THREE.Vector3(Math.random() * 1.2 - 0.6, 0.05, Math.random() * 1.2 - 0.6));
        const rSk = 0.5 + Math.random() * 0.85;
        dummyPlacer.scale.set(rSk * 1.3, rSk, rSk);
        dummyPlacer.updateMatrix();
        rockInst.setMatrixAt(rIdx, dummyPlacer.matrix);
      }
    }

    grassInst.instanceMatrix.needsUpdate = true;
    scene.add(grassInst);

    bushInst.instanceMatrix.needsUpdate = true;
    scene.add(bushInst);

    flowerMeshGroups.forEach(f => {
      f.instanceMatrix.needsUpdate = true;
      scene.add(f);
    });

    rockInst.instanceMatrix.needsUpdate = true;
    scene.add(rockInst);
  }

  /**
   * Pre-fetches high detail GLTF meshes asynchronously in the background.
   */
  private async preloadTreeAssets(scene: THREE.Scene): Promise<void> {
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    loader.setDRACOLoader(draco);

    const treeUrls = [
      'https://pub-a248afed72844944a7565dc9cbaacbb0.r2.dev/Trees/pine_tree_-_ps1_low_poly.glb',
      'https://pub-a248afed72844944a7565dc9cbaacbb0.r2.dev/Trees/old_tree.glb',
      'https://pub-a248afed72844944a7565dc9cbaacbb0.r2.dev/Trees/sakura.glb',
      'https://pub-a248afed72844944a7565dc9cbaacbb0.r2.dev/Trees/tree_gn.glb'
    ];

    console.log('Initiating tree asset preloader pipeline in background...');

    treeUrls.forEach((url, index) => {
      // Re-use cached GLTF scene if already loaded
      if (ForestSystem.treeCache.has(url)) {
        console.log(`Reusing cached tree model for ${url}`);
        const cachedScene = ForestSystem.treeCache.get(url)!;
        const submeshes = this.extractSubmeshes(cachedScene.clone(true));
        this.swapHighDetailPlacer(scene, index, submeshes);
        return;
      }

      loader.load(
        url,
        (gltf) => {
          console.log(`Successfully completed preloading tree: ${url}`);
          ForestSystem.treeCache.set(url, gltf.scene);
          const submeshes = this.extractSubmeshes(gltf.scene);
          this.swapHighDetailPlacer(scene, index, submeshes);
        },
        undefined,
        (error) => {
          console.error(`Recoverable: Could not download tree model from ${url}. Switched to fallback placeholders.`, error);
        }
      );
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

    // Force an immediate update block calculation!
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
    this.isInitialized = false;
    this.trees = [];
    this.treesByType = [[], [], [], []];
    this.highInsts = [[], [], [], []];
    this.medInsts = [[], [], [], []];
    this.lowInsts = [];
    this.gltfSubmeshes = [[], [], [], []];
    this.scene = null;
    this.trackHelper = null;
  }
}

export const forestSystem = ForestSystem.getInstance();

export function buildForest(scene: THREE.Scene, trackHelper: TrackGeometryHelper): void {
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
