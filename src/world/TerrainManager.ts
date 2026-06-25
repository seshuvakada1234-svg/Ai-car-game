import * as THREE from 'three';
import { TrackGeometryHelper, getTerrainHeight } from '../utils/track';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MemoryPool } from '../utils/memoryPool';

// Inject robust self-healing accelerated raycast into Three.js Mesh prototype
const originalMeshRaycast = THREE.Mesh.prototype.raycast;
THREE.Mesh.prototype.raycast = function(this: THREE.Mesh, raycaster, intersects) {
  try {
    return acceleratedRaycast.call(this, raycaster, intersects);
  } catch (err) {
    try {
      if (originalMeshRaycast) {
        return originalMeshRaycast.call(this, raycaster, intersects);
      }
    } catch (fallbackErr) {
    }
  }
};

export class TerrainManager {
  private static instance: TerrainManager | null = null;
  public static initialized = false;

  private heightCache: Float32Array;
  private minX = -3000;
  private maxX = 3000;
  private minZ = -3000;
  private maxZ = 4500;
  private resolution = 8; // 8 meters grid step
  private cols: number;
  private rows: number;
  private trackHelper: TrackGeometryHelper | null = null;
  private roadHeightCache = new Map<number, { height: number | null; normal: THREE.Vector3 | null }>();

  public playerPos = new THREE.Vector3();

  // Async Chunked Generation Properties
  private generatedChunks = new Set<string>();
  private chunkQueue: { r: number; c: number; dist: number }[] = [];
  private isProcessingQueue = false;

  // BVH-accelerated road physics mesh
  private roadBVHMesh: THREE.Mesh | null = null;
  private roadMeshesCache: THREE.Object3D[] = [];

  private constructor() {
    this.cols = Math.ceil((this.maxX - this.minX) / this.resolution);
    this.rows = Math.ceil((this.maxZ - this.minZ) / this.resolution);
    this.heightCache = new Float32Array(this.cols * this.rows);
  }

  public static getInstance(): TerrainManager {
    if (!TerrainManager.instance) {
      TerrainManager.instance = new TerrainManager();
    }
    return TerrainManager.instance;
  }

  /**
   * Generates a single 64x64 terrain chunk.
   */
  public generateChunk(chunkRow: number, chunkCol: number): void {
    const key = `${chunkRow}_${chunkCol}`;
    if (this.generatedChunks.has(key)) return;
    this.generatedChunks.add(key);

    const startTime = performance.now();

    const chunkSize = 64;
    const startRow = chunkRow * chunkSize;
    const endRow = Math.min(this.rows, startRow + chunkSize);
    const startCol = chunkCol * chunkSize;
    const endCol = Math.min(this.cols, startCol + chunkSize);

    if (!this.trackHelper) return;

    for (let r = startRow; r < endRow; r++) {
      const z = this.minZ + r * this.resolution;
      const rowOffset = r * this.cols;
      for (let c = startCol; c < endCol; c++) {
        const x = this.minX + c * this.resolution;
        const height = getTerrainHeight(x, z, this.trackHelper);
        this.heightCache[rowOffset + c] = height;
      }
    }

    const duration = performance.now() - startTime;
    const streamingRadius = 1500; // 1.5km active streaming boundary radius
    console.log(`[TerrainManager] Generated Chunk ${key} in ${duration.toFixed(1)}ms. Active chunks: ${this.generatedChunks.size} | Queue remaining: ${this.chunkQueue.length} | Streaming Radius: ${streamingRadius}m`);
  }

  /**
   * Ensures the specified chunk is generated immediately (on-demand fallback).
   */
  private ensureChunkGenerated(chunkRow: number, chunkCol: number): void {
    const key = `${chunkRow}_${chunkCol}`;
    if (!this.generatedChunks.has(key)) {
      // Remove from background queue if present to avoid redundant work
      const qIndex = this.chunkQueue.findIndex(item => item.r === chunkRow && item.c === chunkCol);
      if (qIndex > -1) {
        this.chunkQueue.splice(qIndex, 1);
      }
      this.generateChunk(chunkRow, chunkCol);
    }
  }

  /**
   * Generates and freezes the heightmap cache once, completely removing runtime noise evaluation.
   */
  public initialize(trackHelper: TrackGeometryHelper): void {
    if (TerrainManager.initialized) {
      console.log('TerrainManager: Already initialized. Skipping heightbaking.');
      return;
    }
    TerrainManager.initialized = true;
    this.trackHelper = trackHelper;

    console.log('[TerrainManager] Initiating asynchronous chunked heightmap generation...');

    // 1. Determine player/start position
    let startX = 0;
    let startZ = 0;
    if (trackHelper.checkpoints && trackHelper.checkpoints.length > 0) {
      startX = trackHelper.checkpoints[0].position.x;
      startZ = trackHelper.checkpoints[0].position.z;
    }

    // 2. Build sorted queue of all chunks based on distance to player starting position
    const chunkSize = 64;
    const numChunkCols = Math.ceil(this.cols / chunkSize);
    const numChunkRows = Math.ceil(this.rows / chunkSize);

    const chunksList: { r: number; c: number; dist: number }[] = [];
    for (let r = 0; r < numChunkRows; r++) {
      const chunkZ = this.minZ + (r * chunkSize + chunkSize / 2) * this.resolution;
      for (let c = 0; c < numChunkCols; c++) {
        const chunkX = this.minX + (c * chunkSize + chunkSize / 2) * this.resolution;
        const dx = chunkX - startX;
        const dz = chunkZ - startZ;
        const dist = dx * dx + dz * dz;
        chunksList.push({ r, c, dist });
      }
    }

    // Sort: nearest chunks first
    chunksList.sort((a, b) => a.dist - b.dist);

    // 3. Immediately generate nearest chunks synchronously so player is spawned on correct ground instantly
    const immediateChunksCount = Math.min(12, chunksList.length);
    console.log(`[TerrainManager] Generating first ${immediateChunksCount} nearby chunks synchronously (< 15ms total)...`);
    for (let i = 0; i < immediateChunksCount; i++) {
      const chunk = chunksList[i];
      this.generateChunk(chunk.r, chunk.c);
    }

    // 4. Queue remaining chunks for background loading
    this.chunkQueue = chunksList.slice(immediateChunksCount);
    this.startQueueProcessing();
  }

  private startQueueProcessing(): void {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    const processNext = () => {
      if (this.chunkQueue.length === 0) {
        this.isProcessingQueue = false;
        console.log('[TerrainManager] All background terrain chunks successfully streamed!');
        return;
      }

      const nextChunk = this.chunkQueue.shift();
      if (nextChunk) {
        this.generateChunk(nextChunk.r, nextChunk.c);
      }

      // Yield frame computation to browser to maintain flawless 60/120 FPS
      requestAnimationFrame(() => {
        setTimeout(processNext, 16);
      });
    };

    requestAnimationFrame(processNext);
  }

  /**
   * Fast bilinear interpolation height querying in O(1) time
   */
  public getHeight(x: number, z: number): number {
    if (x < this.minX || x > this.maxX || z < this.minZ || z > this.maxZ) {
      return -95.0; // bed rock boundary
    }

    const cf = (x - this.minX) / this.resolution;
    const rf = (z - this.minZ) / this.resolution;

    const c0 = Math.floor(cf);
    const r0 = Math.floor(rf);

    // Dynamic stream fallback: ensure chunk is baked on demand
    const chunkSize = 64;
    const chunkRow0 = Math.floor(r0 / chunkSize);
    const chunkCol0 = Math.floor(c0 / chunkSize);
    this.ensureChunkGenerated(chunkRow0, chunkCol0);

    const c1 = Math.min(this.cols - 1, c0 + 1);
    const r1 = Math.min(this.rows - 1, r0 + 1);

    const chunkRow1 = Math.floor(r1 / chunkSize);
    const chunkCol1 = Math.floor(c1 / chunkSize);
    this.ensureChunkGenerated(chunkRow1, chunkCol1);

    const tx = cf - c0;
    const tz = rf - r0;

    const h00 = this.heightCache[r0 * this.cols + c0];
    const h10 = this.heightCache[r0 * this.cols + c1];
    const h01 = this.heightCache[r1 * this.cols + c0];
    const h11 = this.heightCache[r1 * this.cols + c1];

    // Bilinear interpolation
    const h0 = h00 * (1 - tx) + h10 * tx;
    const h1 = h01 * (1 - tx) + h11 * tx;

    return h0 * (1 - tz) + h1 * tz;
  }

  /**
   * Caches track road meshes and creates boundsTree BVH hierarchies on them
   */
  public bakeRoadMeshBVH(meshes: THREE.Object3D[]): void {
    if (this.roadBVHMesh) {
      return;
    }
    this.roadMeshesCache = [...meshes];
    
    const geometriesToMerge: THREE.BufferGeometry[] = [];
    meshes.forEach(m => {
      if (m instanceof THREE.Mesh) {
        m.updateMatrixWorld(true);
        const geom = m.geometry.clone();
        geom.applyMatrix4(m.matrixWorld);
        geometriesToMerge.push(geom);
      }
    });

    if (geometriesToMerge.length > 0) {
      try {
        let mergedGeom: THREE.BufferGeometry | null = null;
        if (geometriesToMerge.length === 1) {
          mergedGeom = geometriesToMerge[0];
        } else {
          mergedGeom = mergeGeometries(geometriesToMerge, false);
        }
        if (mergedGeom) {
          (mergedGeom as any).boundsTree = new MeshBVH(mergedGeom);
          this.roadBVHMesh = new THREE.Mesh(mergedGeom, new THREE.MeshBasicMaterial());
        }
      } catch (err) {
        meshes.forEach(m => {
          if (m instanceof THREE.Mesh && m.geometry) {
            try {
              (m.geometry as any).boundsTree = new MeshBVH(m.geometry);
            } catch (bvhErr) {
            }
          }
        });
      }
    }
  }

  /**
   * Executes accelerated raycast query
   */
  public queryRoadHeight(pos: any, outNormal?: THREE.Vector3): number | null {
    if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number' || typeof pos.z !== 'number' || isNaN(pos.x) || isNaN(pos.y) || isNaN(pos.z)) {
      return null;
    }

    const qx = Math.round(pos.x * 5);
    const qz = Math.round(pos.z * 5);
    const key = (qx * 73856093) ^ (qz * 19349663);

    if (this.roadHeightCache.has(key)) {
      const cached = this.roadHeightCache.get(key)!;
      if (outNormal && cached.normal) {
        outNormal.copy(cached.normal);
      }
      return cached.height;
    }

    try {
      const rayOrigin = MemoryPool.getVector().set(pos.x, pos.y + 20.0, pos.z);
      const rayDir = MemoryPool.getVector().set(0, -1, 0);
      const raycaster = MemoryPool.tempRay;
      raycaster.set(rayOrigin, rayDir);
      raycaster.near = 0.0;
      raycaster.far = 150.0;
      raycaster.firstHitOnly = true;

      let resultHeight: number | null = null;
      let resultNormal: THREE.Vector3 | null = null;

      if (this.roadBVHMesh) {
        const intersections = raycaster.intersectObject(this.roadBVHMesh);
        if (intersections && intersections.length > 0) {
          resultHeight = intersections[0].point.y;
          if (intersections[0].face) {
            resultNormal = intersections[0].face.normal;
          }
        }
      } else if (this.roadMeshesCache && this.roadMeshesCache.length > 0) {
        const intersections = raycaster.intersectObjects(this.roadMeshesCache, true);
        if (intersections && intersections.length > 0) {
          resultHeight = intersections[0].point.y;
          if (intersections[0].face) {
            resultNormal = intersections[0].face.normal;
          }
        }
      }

      if (this.roadHeightCache.size > 8000) {
        this.roadHeightCache.clear();
      }
      this.roadHeightCache.set(key, {
        height: resultHeight,
        normal: resultNormal ? resultNormal.clone() : null
      });

      if (outNormal && resultNormal) {
        outNormal.copy(resultNormal);
      }
      return resultHeight;
    } catch (e) {
    }
    return null;
  }

  /**
   * Safe wrapper that guarantees a valid, non-NaN, non-Infinity road height.
   * If road height query returns null/invalid, it falls back to lastValidY,
   * then to the nearest track spline point, then to terrain, then to bedrock.
   */
  public getRoadHeight(pos: any, lastValidY?: number): number {
    if (!pos || typeof pos.x !== 'number' || typeof pos.z !== 'number' || isNaN(pos.x) || isNaN(pos.z)) {
      if (lastValidY !== undefined && Number.isFinite(lastValidY) && !isNaN(lastValidY)) {
        return lastValidY;
      }
      return 0.0;
    }

    const queried = this.queryRoadHeight(pos);
    if (queried !== null && Number.isFinite(queried) && !isNaN(queried)) {
      return queried;
    }

    // Fallback 1: Spline-based nearest track point height
    if (this.trackHelper && typeof this.trackHelper.getNearestTrackInfo === 'function') {
      try {
        const queryPos = MemoryPool.getVector().set(pos.x, pos.y || 0, pos.z);
        const nearestInfo = this.trackHelper.getNearestTrackInfo(queryPos);
        if (nearestInfo && nearestInfo.nearestPoint && Number.isFinite(nearestInfo.nearestPoint.y) && !isNaN(nearestInfo.nearestPoint.y)) {
          return nearestInfo.nearestPoint.y;
        }
      } catch (e) {
      }
    }

    // Fallback 2: Terrain height
    const tHeight = this.getHeight(pos.x, pos.z);
    if (Number.isFinite(tHeight) && !isNaN(tHeight)) {
      return tHeight;
    }

    // Fallback 3: lastValidY
    if (lastValidY !== undefined && Number.isFinite(lastValidY) && !isNaN(lastValidY)) {
      return lastValidY;
    }

    // Ultimate fallback
    return 0.0;
  }

  /**
   * Gets the surface normal at the road. Falls back to track helper spline normals.
   */
  public getRoadNormal(pos: any, outNormal?: THREE.Vector3): THREE.Vector3 {
    const normal = outNormal || new THREE.Vector3(0, 1, 0);
    if (!pos) return normal;
    
    const tempNormal = new THREE.Vector3();
    this.queryRoadHeight(pos, tempNormal);
    if (tempNormal.lengthSq() > 0.1) {
      normal.copy(tempNormal);
    } else if (this.trackHelper) {
      try {
        const queryPos = MemoryPool.getVector().set(pos.x, pos.y || 0, pos.z);
        const nearestInfo = this.trackHelper.getNearestTrackInfo(queryPos);
        if (nearestInfo && nearestInfo.normal) {
          normal.copy(nearestInfo.normal);
        }
      } catch (e) {}
    }
    return normal;
  }

  /**
   * Evaluates how far off-road a position is (0.0 means on-road, 1.0 means fully off-road).
   */
  public getOffRoadFactor(pos: any): number {
    if (!pos || !this.trackHelper) return 0.0;
    try {
      const queryPos = MemoryPool.getVector().set(pos.x, pos.y || 0, pos.z);
      const nearestInfo = this.trackHelper.getNearestTrackInfo(queryPos);
      const shoulderStart = nearestInfo.width / 2 - 1.8;
      if (Math.abs(nearestInfo.sideOffset) > shoulderStart) {
        return Math.min(1.0, (Math.abs(nearestInfo.sideOffset) - shoulderStart) / 1.35);
      }
    } catch (e) {}
    return 0.0;
  }

  /**
   * Checks if a position is considered off-road.
   */
  public isOffRoad(pos: any): boolean {
    return this.getOffRoadFactor(pos) > 0.0;
  }

  public clear(): void {
    TerrainManager.initialized = false;
    if (this.roadBVHMesh) {
      this.roadBVHMesh.geometry.dispose();
      if (Array.isArray(this.roadBVHMesh.material)) {
        this.roadBVHMesh.material.forEach((m: any) => m.dispose());
      } else {
        this.roadBVHMesh.material.dispose();
      }
      this.roadBVHMesh = null;
    }
    this.roadMeshesCache = [];
    this.trackHelper = null;
  }
}

export const terrainManager = TerrainManager.getInstance();
