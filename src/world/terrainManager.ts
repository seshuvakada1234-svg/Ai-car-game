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
    console.warn("Recoverable: acceleratedRaycast failed on mesh, falling back to native raycaster:", err);
    try {
      if (originalMeshRaycast) {
        return originalMeshRaycast.call(this, raycaster, intersects);
      }
    } catch (fallbackErr) {
      console.error("Critical: Native raycasting fallback also failed:", fallbackErr);
    }
  }
};

export class TerrainManager {
  private static instance: TerrainManager | null = null;
  private heightCache: Float32Array;
  private minX = -3000;
  private maxX = 3000;
  private minZ = -3000;
  private maxZ = 4500;
  private resolution = 8; // 8 meters grid step
  private cols: number;
  private rows: number;
  private trackHelper: TrackGeometryHelper | null = null;

  public playerPos = new THREE.Vector3();

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
   * Generates and freezes the heightmap cache once, completely removing runtime noise evaluation.
   */
  public initialize(trackHelper: TrackGeometryHelper): void {
    this.trackHelper = trackHelper;
    console.time('TerrainManager Heightmap Baking');
    for (let r = 0; r < this.rows; r++) {
      const z = this.minZ + r * this.resolution;
      for (let c = 0; c < this.cols; c++) {
        const x = this.minX + c * this.resolution;
        const height = getTerrainHeight(x, z, trackHelper);
        this.heightCache[r * this.cols + c] = height;
      }
    }
    console.timeEnd('TerrainManager Heightmap Baking');
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

  /**
   * Caches track road meshes and creates boundsTree BVH hierarchies on them
   */
  public bakeRoadMeshBVH(meshes: THREE.Object3D[]): void {
    this.roadMeshesCache = [...meshes];
    
    // Group all mesh geometries to build a singular highly optimized collision tree
    const geometriesToMerge: THREE.BufferGeometry[] = [];
    meshes.forEach(m => {
      if (m instanceof THREE.Mesh) {
        // Clone and apply world transformation
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
          // Build MeshBVH
          (mergedGeom as any).boundsTree = new MeshBVH(mergedGeom);
          this.roadBVHMesh = new THREE.Mesh(mergedGeom, new THREE.MeshBasicMaterial());
          console.log("Baked compiled Road Network into a single highly optimized BVH bounds tree successfully!");
        }
      } catch (err) {
        // Fallback: build boundsTree directly on individual meshes in cache
        meshes.forEach(m => {
          if (m instanceof THREE.Mesh && m.geometry) {
            try {
              (m.geometry as any).boundsTree = new MeshBVH(m.geometry);
            } catch (bvhErr) {
              console.warn("Could not generate individual MeshBVH structure:", bvhErr);
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

    try {
      const rayOrigin = MemoryPool.getVector().set(pos.x, pos.y + 20.0, pos.z);
      const rayDir = MemoryPool.getVector().set(0, -1, 0);
      const raycaster = MemoryPool.tempRay;
      raycaster.set(rayOrigin, rayDir);
      raycaster.near = 0.0;
      raycaster.far = 150.0;
      
      // Configure raycast for BVH-first traversal
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
      console.warn("Exception in queryRoadHeight raycast helper:", e);
    }
    return null;
  }

  public clear(): void {
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
