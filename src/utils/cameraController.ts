import * as THREE from 'three';
import { CarState } from '../types';

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  
  // Camera settings
  private baseFov: number;
  private currentFov: number;
  private cameraShakePower = 0.0;
  
  // Reusable spatial scratchpads
  private smoothedLookAt = new THREE.Vector3();
  private isInitialized = false;

  constructor(camera: THREE.PerspectiveCamera, baseFov = 60) {
    this.camera = camera;
    this.baseFov = baseFov;
    this.currentFov = baseFov;
  }

  /**
   * Resets the camera orientation immediately to avoid snaps on start/respawn
   */
  public reset(playerPos: THREE.Vector3, playerAngle: number): void {
    this.isInitialized = false;
    this.cameraShakePower = 0;
    
    const backX = Math.sin(playerAngle + Math.PI);
    const backZ = Math.cos(playerAngle + Math.PI);

    this.camera.position.set(
      playerPos.x + backX * 8.5,
      playerPos.y + 2.8,
      playerPos.z + backZ * 8.5
    );
    this.smoothedLookAt.set(playerPos.x, playerPos.y + 1.1, playerPos.z);
    this.camera.lookAt(this.smoothedLookAt);
  }

  /**
   * Updates the camera position, heading direction, FOV, lag, and rumble effects.
   * Pulls inspirations directly from telemetry-linked driving cameras (Assetto Corsa EVO).
   */
  public update(
    player: CarState,
    elapsedSec: number,
    controls: { forward: boolean; backward: boolean; left: boolean; right: boolean; nitro: boolean }
  ): void {
    if (!player || !player.position) return;

    const speedKmh = Math.abs(player.speed) * 3.6;
    const speedRatio = Math.min(1.0, Math.abs(player.speed) / 78);

    // --- 1. DYNAMIC SPEED-SENSITIVE FIELD OF VIEW (FOV Expansion) ---
    // At high speeds, the camera FOV expands to create a dramatic sense of pace and tunnel vision
    const targetFov = this.baseFov + speedRatio * 18.0 + (player.isNitroActive ? 6.5 : 0.0);
    this.currentFov = THREE.MathUtils.lerp(this.currentFov, targetFov, 1 - Math.exp(-6.5 * elapsedSec));
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();

    // --- 2. DRIFT CAMERA SYSTEM (Anticipative Orbiting Swing) ---
    // When drifting, swing the camera wider outward to help the pilot see down-track
    let driftLateralOffset = 0;
    if (player.isDrifting) {
      // Calculate angular slip velocity
      const velocityAngle = Math.atan2(player.velocity.x, player.velocity.z);
      let slipAngle = velocityAngle - player.angle;
      while (slipAngle < -Math.PI) slipAngle += Math.PI * 2;
      while (slipAngle > Math.PI) slipAngle -= Math.PI * 2;

      driftLateralOffset = slipAngle * 0.72; // swing wide based on sideways slide angle
    }

    // --- 3. TARGET CHASE POSITIONS & HEIGHTS ---
    const camDist = 8.5 + speedRatio * 1.5; // push camera backward at speed
    const camHeight = 2.4 - speedRatio * 0.25; // lower the carriage down for a speed-feeling perspective

    const angleCos = Math.cos(player.angle + driftLateralOffset);
    const angleSin = Math.sin(player.angle + driftLateralOffset);

    const targetCamPos = new THREE.Vector3(
      player.position.x - angleSin * camDist,
      player.position.y + camHeight,
      player.position.z - angleCos * camDist
    );

    // --- 4. FLUID CARRIAGE LAG (Positional Smoothing) ---
    // Introduce lag on sideways & backwards translation, but follow elevation (gravity falls) instantly
    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamPos.x, 1 - Math.exp(-8.2 * elapsedSec));
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetCamPos.y, 1 - Math.exp(-12.5 * elapsedSec));
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetCamPos.z, 1 - Math.exp(-8.2 * elapsedSec));

    // Anti-clipping constraints: prevent camera from ever pushing into or under the car engine bay
    const toCar = new THREE.Vector3().subVectors(this.camera.position, player.position);
    const minCamTrackDist = 6.8;
    if (toCar.length() < minCamTrackDist) {
      toCar.normalize().multiplyScalar(minCamTrackDist);
      this.camera.position.copy(player.position).add(toCar);
    }
    const minHeightAltitude = player.position.y + 1.6;
    if (this.camera.position.y < minHeightAltitude) {
      this.camera.position.y = minHeightAltitude;
    }

    // --- 5. HIGH-FREQUENCY INTUITIVE CAMERA SHAKE ---
    // Generate tactile vibration feedback for nitro flares, drift friction, and road irregularities
    if (player.isNitroActive) {
      this.cameraShakePower = Math.max(0.12, this.cameraShakePower - elapsedSec * 0.25);
    } else if (controls.forward && player.speed < 12) {
      this.cameraShakePower = Math.max(0.045, this.cameraShakePower - elapsedSec * 0.35); // launch rubber rumbles
    } else if (player.isDrifting && speedKmh > 40) {
      this.cameraShakePower = Math.min(0.11, this.cameraShakePower + elapsedSec * 0.45); // sliding tire rumbles
    } else {
      // Gentle vibration proportional to highway speeds
      const roadVibe = Math.max(0, speedRatio * 0.02);
      this.cameraShakePower = THREE.MathUtils.lerp(this.cameraShakePower, roadVibe, 1 - Math.exp(-5.0 * elapsedSec));
    }

    if (this.cameraShakePower > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.cameraShakePower;
      this.camera.position.y += (Math.random() - 0.5) * this.cameraShakePower;
      this.camera.position.z += (Math.random() - 0.5) * this.cameraShakePower;
    }

    // --- 6. TARGET LOOK-AT (Look into the turn) ---
    // Camera focuses slightly ahead of the vehicle nose to anticipate sharp curves
    const lookAheadDistance = 3.5 + speedRatio * 4.5;
    const lookAheadX = Math.sin(player.angle) * lookAheadDistance;
    const lookAheadZ = Math.cos(player.angle) * lookAheadDistance;

    const targetLookAt = new THREE.Vector3(
      player.position.x + lookAheadX,
      player.position.y + 0.95,
      player.position.z + lookAheadZ
    );

    // Filter focus coordinate updates to avoid high-frequency jittering
    if (!this.isInitialized) {
      this.smoothedLookAt.copy(targetLookAt);
      this.isInitialized = true;
    } else {
      this.smoothedLookAt.lerp(targetLookAt, 1 - Math.exp(-15.0 * elapsedSec));
    }
    
    this.camera.lookAt(this.smoothedLookAt);
  }
}
export default CameraController;
