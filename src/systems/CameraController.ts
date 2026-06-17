import * as THREE from 'three';
import { CarState } from '../types';

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private scene?: THREE.Scene;
  private isInitialized = false;
  private lastLogTime = 0;

  constructor(camera: THREE.PerspectiveCamera, baseFov = 60, scene?: THREE.Scene) {
    this.camera = camera;
    this.scene = scene;

    // Reset initialization when requested
    window.addEventListener('reset-camera', () => {
      this.isInitialized = false;
    });
  }

  /**
   * Resets the camera orientation by resetting the initialization flag
   */
  public reset(playerPos: THREE.Vector3, playerAngle: number): void {
    this.isInitialized = false;
  }

  /**
   * Updates camera position, rotation, and look-at target matching the specified chase style.
   */
  public update(
    player: CarState,
    elapsedSec: number,
    controls: { forward: boolean; backward: boolean; left: boolean; right: boolean; nitro: boolean },
    activeMode: string = 'MEDIUM' // Kept the signature for compatibility, but ignored
  ): void {
    if (!player || !player.position) return;

    // 1. Get the player's 3D vehicle root object
    const playerGroup = this.scene?.getObjectByName('car_root_player');

    // 2. Compute position and quaternion representing the vehicle's orientation
    const carPosition = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
    const carQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), player.angle);

    if (playerGroup) {
      carPosition.copy(playerGroup.position);
      carQuaternion.copy(playerGroup.quaternion);

      // Disable frustum culling recursively for all meshes in the player group to prevent disappearing
      playerGroup.traverse((obj) => {
        if ((obj as any).isMesh) {
          obj.frustumCulled = false;
        }
      });
    }

    // 3. Setup single Third-Person Chase Camera parameters
    // Target: cameraHeight = 2.5m, cameraDistance = 7m, lookHeight = 1.3m
    // camera.position: desiredPosition = player.position - forward * 7 + up * 2.5
    // camera.lookAt: player.position + forward * 8 + up * 1.3
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(carQuaternion);
    const up = new THREE.Vector3(0, 1, 0);

    const desiredPosition = carPosition.clone()
      .addScaledVector(forward, -7.0)
      .addScaledVector(up, 2.5);

    const desiredLookAt = carPosition.clone()
      .addScaledVector(forward, 8.0)
      .addScaledVector(up, 1.3);

    // 4. Initial snap or smooth follow with lerp(desiredPosition, 0.10)
    if (!this.isInitialized) {
      this.camera.position.copy(desiredPosition);
      this.isInitialized = true;
    } else {
      this.camera.position.lerp(desiredPosition, 0.10);
    }

    // 5. ANTI-CLIPPING: Enforce strict distance limits
    // Minimum distance from player: 5m, Maximum distance: 10m
    const toCamera = new THREE.Vector3().subVectors(this.camera.position, carPosition);
    const distToPlayer = toCamera.length();

    if (distToPlayer < 5.0) {
      // Move camera backward
      if (distToPlayer > 0.01) {
        toCamera.multiplyScalar(5.0 / distToPlayer);
      } else {
        const backDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(carQuaternion);
        toCamera.copy(backDirection).multiplyScalar(5.0);
      }
      this.camera.position.copy(carPosition).add(toCamera);
    } else if (distToPlayer > 10.0) {
      toCamera.multiplyScalar(10.0 / distToPlayer);
      this.camera.position.copy(carPosition).add(toCamera);
    }

    // 6. Ensure camera looks smoothly at the oriented forward lookTarget
    this.camera.lookAt(desiredLookAt);

    // 7. Debug logging: Print positions every 5 seconds
    const now = performance.now();
    if (now - this.lastLogTime > 5000) {
      this.lastLogTime = now;
      console.log("[Camera Debug] Player Position:", carPosition);
      console.log("[Camera Debug] Camera Position:", this.camera.position);
    }
  }
}

export default CameraController;
