import * as THREE from 'three';
import { TrackGeometryHelper, getTerrainHeight } from '../utils/track';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MemoryPool } from '../utils/memoryPool';

// Inject accelerated raycast into Three.js Mesh prototype
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export class TerrainManager {
  private static instance: TerrainManager | null = null;
  private heightCache: Float32Array;
  private minX       = -3000;
  private maxX       =  3000;
  private minZ       = -3000;
  private maxZ       =  4500;
  private resolution =  8; // 8 metres per grid step
  private cols: number;
  private rows: number;
  private trackHelper: TrackGeometryHelper | null = null;

  // BVH-accelerated road physics mesh
  private roadBVHMesh:       THREE.Mesh | null        = null;
  private roadMeshesCache:   THREE.Object3D[]         = [];

  private constructor() {
    this.cols        = Math.ceil((this.maxX - this.minX) / this.resolution);
    this.rows        = Math.ceil((this.maxZ - this.minZ) / this.resolution);
    this.heightCache = new Float32Array(this.cols * this.rows);
  }

  public static getInstance(): TerrainManager {
    if (!TerrainManager.instance) {
      TerrainManager.instance = new TerrainManager();
    }
    return TerrainManager.instance;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // initialize
  //
  // Generates and freezes the heightmap cache once, completely removing
  // runtime noise evaluation from the render loop.
  // ───────────────────────────────────────────────────────────────────────────
  public initialize(trackHelper: TrackGeometryHelper): void {
    this.trackHelper = trackHelper;
    console.time('TerrainManager Heightmap Baking');

    for (let r = 0; r < this.rows; r++) {
      const z = this.minZ + r * this.resolution;
      for (let c = 0; c < this.cols; c++) {
        const x      = this.minX + c * this.resolution;
        const height = getTerrainHeight(x, z, trackHelper);
        // Guard against NaN poisoning the entire cache — a single bad
        // getTerrainHeight() result would corrupt every bilinear query that
        // touches the surrounding four cells for the rest of the session.
        this.heightCache[r * this.cols + c] = Number.isFinite(height) ? height : 0;
      }
    }

    console.timeEnd('TerrainManager Heightmap Baking');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // getHeight
  //
  // Fast O(1) bilinear interpolation from the pre-baked heightmap.
  // Used by buildTerrain() and anywhere a terrain height is needed at runtime.
  // ───────────────────────────────────────────────────────────────────────────
  public getHeight(x: number, z: number): number {
    if (x < this.minX || x > this.maxX || z < this.minZ || z > this.maxZ) {
      return -95.0; // bedrock boundary
    }

    const cf = (x - this.minX) / this.resolution;
    const rf = (z - this.minZ) / this.resolution;

    const c0 = Math.floor(cf);
    const r0 = Math.floor(rf);
    const c1 = Math.min(this.cols - 1, c0 + 1);
    const r1 = Math.min(this.rows - 1, r0 + 1);

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

  // ───────────────────────────────────────────────────────────────────────────
  // bakeRoadMeshBVH
  //
  // Caches track road meshes and creates a BVH hierarchy for fast raycasting.
  //
  // OPTIMIZATION: Temporary cloned geometries are now explicitly disposed after
  // merging. Previously they stayed in heap indefinitely — on a complex track
  // with 400+ slices this leaked hundreds of MB of BufferGeometry data that the
  // GC could never reclaim because Three.js keeps internal GPU references.
  // ───────────────────────────────────────────────────────────────────────────
  public bakeRoadMeshBVH(meshes: THREE.Object3D[]): void {
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
        const mergedGeom = mergeGeometries(geometriesToMerge, false);

        // ── MEMORY LEAK FIX ────────────────────────────────────────────────
        // Dispose all temporary clones immediately after merging.
        // Without this, each clone (position, normal, uv buffers) stays alive
        // on the GPU and in JS heap until the page is unloaded.
        geometriesToMerge.forEach(g => g.dispose());
        // ───────────────────────────────────────────────────────────────────

        if (mergedGeom) {
          (mergedGeom as any).boundsTree = new MeshBVH(mergedGeom);
          this.roadBVHMesh = new THREE.Mesh(mergedGeom, new THREE.MeshBasicMaterial());
          console.log('Baked compiled Road Network into a single highly optimized BVH bounds tree successfully!');
        }
      } catch (err) {
        // Dispose clones even in the error path to prevent leaking on failure
        geometriesToMerge.forEach(g => {
          try { g.dispose(); } catch (_) { /* ignore */ }
        });

        // Fallback: build boundsTree on individual meshes
        meshes.forEach(m => {
          if (m instanceof THREE.Mesh && m.geometry) {
            try {
              (m.geometry as any).boundsTree = new MeshBVH(m.geometry);
            } catch (bvhErr) {
              console.warn('Could not generate individual MeshBVH structure:', bvhErr);
            }
          }
        });
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // queryRoadHeight
  //
  // Executes an accelerated BVH raycast downward from above a position and
  // returns the road surface Y, or null if no road is under the point.
  // ───────────────────────────────────────────────────────────────────────────
  public queryRoadHeight(pos: any, outNormal?: THREE.Vector3): number | null {
    if (
      !pos ||
      typeof pos.x !== 'number' || typeof pos.y !== 'number' || typeof pos.z !== 'number' ||
      isNaN(pos.x) || isNaN(pos.y) || isNaN(pos.z)
    ) {
      return null;
    }

    try {
      const rayOrigin = MemoryPool.getVector().set(pos.x, pos.y + 20.0, pos.z);
      const rayDir    = MemoryPool.getVector().set(0, -1, 0);
      const raycaster = MemoryPool.tempRay;
      raycaster.set(rayOrigin, rayDir);
      raycaster.near         = 0.0;
      raycaster.far          = 150.0;
      raycaster.firstHitOnly = true;

      if (this.roadBVHMesh) {
        const intersections = raycaster.intersectObject(this.roadBVHMesh);
        if (intersections && intersections.length > 0) {
          if (outNormal && intersections[0].face) {
            outNormal.copy(intersections[0].face.normal);
          }
          return intersections[0].point.y;
        }
      } else if (this.roadMeshesCache && this.roadMeshesCache.length > 0) {
        const intersections = raycaster.intersectObjects(this.roadMeshesCache, true);
        if (intersections && intersections.length > 0) {
          if (outNormal && intersections[0].face) {
            outNormal.copy(intersections[0].face.normal);
          }
          return intersections[0].point.y;
        }
      }
    } catch (e) {
      console.warn('Exception in queryRoadHeight raycast helper:', e);
    }
    return null;
  }
}

export const terrainManager = TerrainManager.getInstance();
