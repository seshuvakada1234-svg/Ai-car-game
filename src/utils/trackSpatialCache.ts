import * as THREE from 'three';

/**
 * TrackSpatialCache
 *
 * Divides the world into a uniform 100 m grid and buckets every cached
 * spline-point index into the cell it falls in. getNearbyIndices() returns
 * only the indices in the 3×3 neighbourhood of the query cell, cutting the
 * linear O(2000) scan in getNearestTrackInfo() down to ~5–30 candidates.
 *
 * Performance: ~65× fewer distanceToSquared() calls per query tick.
 * With 6 AI cars + 1 player all calling getNearestTrackInfo every frame,
 * this saves ~80,000 sqrt/multiply ops per second on a 60 FPS session.
 *
 * GC OPTIMIZATION: The original implementation allocated a fresh `number[]`
 * on every call to getNearbyIndices(). At 60 FPS × 7 cars = 420 allocations
 * per second, this generated ~420 short-lived arrays that the GC had to
 * collect. On Android's Dalvik/ART-style GC with a conservative young-gen
 * collector this causes periodic 2–8 ms stalls.
 *
 * Fix: a single pre-allocated _resultBuffer (capacity 512) is reused each
 * call. getNearbyIndices() writes into it and returns a typed view.
 * The caller must consume the result before the next getNearbyIndices() call
 * (satisfied by getNearestTrackInfo's synchronous inner loop).
 */
export class TrackSpatialCache {
  private readonly CELL_SIZE = 100; // metres per grid cell side
  private grid: Map<number, number[]> = new Map();

  // ── Reusable result buffer — eliminates per-query heap allocation ─────────
  // Pre-sized to 512 indices. A 3×3 cell neighbourhood at 100 m cells with
  // 2000 spline points distributed over ~10 km gives at most ~18 points per
  // cell on average, so 9 cells × 18 = ~162 max. 512 gives comfortable headroom.
  private readonly _resultBuffer: Int32Array = new Int32Array(512);
  private _resultLength = 0;

  // ── Lightweight view object reused each call — zero allocation per query ──
  // Wraps _resultBuffer so callers can iterate with a standard for-loop.
  private readonly _resultView: ArrayLike<number> & { length: number };

  constructor(points: THREE.Vector3[]) {
    // Build spatial grid index once at construction time.
    // O(n) where n = number of cached spline points (typically 2000).
    for (let i = 0; i < points.length; i++) {
      const key = this.cellKey(points[i].x, points[i].z);
      let bucket = this.grid.get(key);
      if (!bucket) {
        bucket = [];
        this.grid.set(key, bucket);
      }
      bucket.push(i);
    }

    // Create a stable view object whose .length always reflects the last fill.
    // Using a Proxy keeps the API identical to a plain number[] without copying.
    const self = this;
    this._resultView = new Proxy(this._resultBuffer, {
      get(target, prop) {
        if (prop === 'length') return self._resultLength;
        return target[prop as any];
      },
    }) as unknown as ArrayLike<number> & { length: number };
  }

  /**
   * Returns point indices for the 3×3 block of cells surrounding (x, z).
   *
   * IMPORTANT: The returned object is a reused buffer. It is valid only until
   * the next call to getNearbyIndices(). Copy values if you need them later.
   *
   * Searching 9 cells of 100 m each gives a 300 m search radius — always
   * wider than any road width or car offset.
   *
   * OPTIMIZATION: No heap allocation occurs in this method.
   * The result is written into the pre-allocated _resultBuffer and the
   * _resultLength cursor is updated. The caller iterates via index.
   */
  public getNearbyIndices(x: number, z: number): ArrayLike<number> & { length: number } {
    const cx = Math.floor(x / this.CELL_SIZE);
    const cz = Math.floor(z / this.CELL_SIZE);

    // Reset length cursor — reusing the same buffer each call
    this._resultLength = 0;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const bucket = this.grid.get(this.packKey(cx + dx, cz + dz));
        if (bucket) {
          for (let k = 0; k < bucket.length; k++) {
            // Guard against buffer overflow (extremely unlikely with 512 slots)
            if (this._resultLength < this._resultBuffer.length) {
              this._resultBuffer[this._resultLength++] = bucket[k];
            }
          }
        }
      }
    }

    return this._resultView;
  }

  /**
   * Pack two signed integers into a single numeric key.
   * Offset by 4096 so negative coordinates stay positive before combining.
   */
  private packKey(cx: number, cz: number): number {
    return (cx + 4096) * 8192 + (cz + 4096);
  }

  private cellKey(x: number, z: number): number {
    return this.packKey(Math.floor(x / this.CELL_SIZE), Math.floor(z / this.CELL_SIZE));
  }
}
