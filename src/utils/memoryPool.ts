import * as THREE from 'three';

/**
 * MemoryPool
 *
 * Pre-allocates reusable Three.js math objects to eliminate per-frame GC pressure.
 *
 * OPTIMIZATION: Pool sizes increased significantly from 200 to prevent
 * wraparound under heavy concurrent load (terrain baking + 6 AI cars +
 * scenery generation all running simultaneously at startup).
 *
 * Pool size rationale:
 *   Vector3   : 1000 — used by road loop (400), scenery (800 steps × 4 per step),
 *               getNearestTrackInfo sub-sampling, and car physics simultaneously.
 *   Quaternion:  500 — used by car orientation, barrier rail lookAt, AI steering.
 *   Euler     :  500 — used by rock placement, house rotation, animal poses.
 *   Matrix4   :  500 — used by InstancedMesh dummy updates (rocks, barriers, trees).
 *
 * Wraparound-safe: getVector() etc. still wrap via modulo, but with 1000 slots
 * the cursor laps only after 1000 borrows — far beyond any single frame budget.
 * If a caller holds a reference across a frame boundary it should use .clone()
 * rather than rely on the pool value remaining stable.
 */
export class MemoryPool {
  private static vectors: THREE.Vector3[] = [];
  private static vectorIndex = 0;

  private static quaternions: THREE.Quaternion[] = [];
  private static quaternionIndex = 0;

  private static eulers: THREE.Euler[] = [];
  private static eulerIndex = 0;

  private static matrices: THREE.Matrix4[] = [];
  private static matrixIndex = 0;

  static {
    // ── Pre-warm all pools at module load time ────────────────────────────
    // Allocating in bulk here means zero GC pressure from math objects for
    // the entire session. The JIT can also optimise the fixed-size arrays
    // far better than dynamically-growing ones.

    // Vector3 × 1000 (was 200)
    for (let i = 0; i < 1000; i++) {
      this.vectors.push(new THREE.Vector3());
    }

    // Quaternion × 500 (was 200)
    for (let i = 0; i < 500; i++) {
      this.quaternions.push(new THREE.Quaternion());
    }

    // Euler × 500 (was 200)
    for (let i = 0; i < 500; i++) {
      this.eulers.push(new THREE.Euler());
    }

    // Matrix4 × 500 (was 200)
    for (let i = 0; i < 500; i++) {
      this.matrices.push(new THREE.Matrix4());
    }
  }

  // ── Named scratchpad singletons — zero allocation, zero indirection ─────
  // Use these for single-threaded hot paths where you own the value for
  // exactly one synchronous block. Never await across a use of these.
  public static readonly tempVecA = new THREE.Vector3();
  public static readonly tempVecB = new THREE.Vector3();
  public static readonly tempVecC = new THREE.Vector3();
  public static readonly tempVecD = new THREE.Vector3();

  public static readonly tempRotA  = new THREE.Euler();
  public static readonly tempQuatA = new THREE.Quaternion();
  public static readonly tempQuatB = new THREE.Quaternion();

  public static readonly tempBox = new THREE.Box3();
  public static readonly tempRay = new THREE.Raycaster();

  // ── Pool accessor: Vector3 ───────────────────────────────────────────────
  // Returns a zeroed vector. The cursor wraps at pool size (1000), so the
  // caller must not hold the reference beyond the current synchronous call
  // if another getVector() will fire before it is read.
  public static getVector(): THREE.Vector3 {
    const v = this.vectors[this.vectorIndex];
    v.set(0, 0, 0);
    // Wraparound-safe modulo — with 1000 slots this lap happens only after
    // 1000 consecutive borrows, which is far more than any single frame uses.
    this.vectorIndex = (this.vectorIndex + 1) % this.vectors.length;
    return v;
  }

  // ── Pool accessor: Quaternion ────────────────────────────────────────────
  public static getQuaternion(): THREE.Quaternion {
    const q = this.quaternions[this.quaternionIndex];
    q.set(0, 0, 0, 1); // identity
    this.quaternionIndex = (this.quaternionIndex + 1) % this.quaternions.length;
    return q;
  }

  // ── Pool accessor: Euler ─────────────────────────────────────────────────
  public static getEuler(): THREE.Euler {
    const e = this.eulers[this.eulerIndex];
    e.set(0, 0, 0, 'XYZ');
    this.eulerIndex = (this.eulerIndex + 1) % this.eulers.length;
    return e;
  }

  // ── Pool accessor: Matrix4 ───────────────────────────────────────────────
  public static getMatrix(): THREE.Matrix4 {
    const m = this.matrices[this.matrixIndex];
    m.identity();
    this.matrixIndex = (this.matrixIndex + 1) % this.matrices.length;
    return m;
  }
}
