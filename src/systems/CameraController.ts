import * as THREE from 'three';
import { CarState } from '../types';

// Forza Horizon 5 style chase camera — fixed tuning constants
const CAMERA_DISTANCE = 8;
const CAMERA_HEIGHT = 3.2;
const LOOKAHEAD_DIST = 10;
const LOOKAHEAD_HEIGHT = 1.8;
const POS_LERP = 0.12;
const LOOK_LERP = 0.15;
const MIN_DIST = 6;
const MAX_DIST = 10;
const FOV = 65;

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private scene?: THREE.Scene;
  private isInitialized = false;
  private frustumCullingHandled = false;

  // Pre-allocated scratch vectors — reused every frame, never recreated in update()
  private carPosition = new THREE.Vector3();
  private forward = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private desiredPosition = new THREE.Vector3();
  private desiredLookTarget = new THREE.Vector3();
  private lookTarget = new THREE.Vector3();
  private toCamera = new THREE.Vector3();
  private smoothY = 0;

  constructor(camera: THREE.PerspectiveCamera, baseFov = FOV, scene?: THREE.Scene) {
    this.camera = camera;
    this.scene = scene;

    this.camera.fov = FOV;
    this.camera.updateProjectionMatrix();

    window.addEventListener('reset-camera', () => {
      this.isInitialized = false;
    });
  }

  /** Resets the camera so the next update() snaps instead of lerping. */
  public reset(playerPos: THREE.Vector3, playerAngle: number): void {
    this.isInitialized = false;
    this.smoothY = playerPos.y;
  }

  /**
   * Single Forza Horizon 5 style chase camera. Yaw-only, no quaternions,
   * no springs, no terrain raycasts. Zero allocations inside this method.
   */
  public update(
    player: CarState,
    elapsedSec: number,
    controls: { forward: boolean; backward: boolean; left: boolean; right: boolean; nitro: boolean },
    activeMode: string = 'CHASE' // kept for signature compatibility, ignored — single camera only
  ): void {
    if (!player || !player.position) return;

    // Disable frustum culling on the player mesh exactly once, not every frame
    if (!this.frustumCullingHandled) {
      const playerGroup = this.scene?.getObjectByName('car_root_player');
      if (playerGroup) {
        playerGroup.traverse((obj) => {
          if ((obj as any).isMesh) obj.frustumCulled = false;
        });
        this.frustumCullingHandled = true;
      }
    }

    // Smooth only the vertical axis to filter suspension jitter.
    // Snap on the very first frame so the camera doesn't creep up from 0.
    // Never read playerGroup.position.y — it contains suspension movement.
    if (!this.isInitialized) {
      this.smoothY = player.position.y;
    } else {
      this.smoothY = THREE.MathUtils.lerp(this.smoothY, player.position.y, 0.05);
    }

    this.carPosition.set(player.position.x, this.smoothY, player.position.z);

    // Yaw-only forward vector — no quaternions, no pitch, no roll
    this.forward.set(Math.sin(player.angle), 0, Math.cos(player.angle)).normalize();

    this.desiredPosition
      .copy(this.carPosition)
      .addScaledVector(this.forward, -CAMERA_DISTANCE)
      .addScaledVector(this.up, CAMERA_HEIGHT);

    this.desiredLookTarget
      .copy(this.carPosition)
      .addScaledVector(this.forward, LOOKAHEAD_DIST)
      .addScaledVector(this.up, LOOKAHEAD_HEIGHT);

    if (!this.isInitialized) {
      this.camera.position.copy(this.desiredPosition);
      this.lookTarget.copy(this.desiredLookTarget);
      this.isInitialized = true;
    } else {
      this.camera.position.lerp(this.desiredPosition, POS_LERP);
      this.lookTarget.lerp(this.desiredLookTarget, LOOK_LERP);
    }

    // Clamp distance to prevent clipping through the car or drifting too far
    this.toCamera.subVectors(this.camera.position, this.carPosition);
    const dist = this.toCamera.length();

    if (dist <= 0.001) {
      this.camera.position
        .copy(this.carPosition)
        .addScaledVector(this.forward, -MIN_DIST)
        .addScaledVector(this.up, CAMERA_HEIGHT);
    } else if (dist < MIN_DIST) {
      this.toCamera.multiplyScalar(MIN_DIST / dist);
      this.camera.position.copy(this.carPosition).add(this.toCamera);
    } else if (dist > MAX_DIST) {
      this.toCamera.multiplyScalar(MAX_DIST / dist);
      this.camera.position.copy(this.carPosition).add(this.toCamera);
    }

    // Only ever orient via lookAt — never write rotation/quaternion directly
    this.camera.lookAt(this.lookTarget);
  }
}

export default CameraController;
