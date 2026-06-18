import * as THREE from 'three';
import { CarState } from '../types';

// Forza Horizon 5 style chase camera parameters
const FOV_MIN = 70;
const FOV_MAX = 85;

// Interpolation decay rates for AAA smoothness and frame-rate independence
const POSITION_DECAY = 8.0;   // Position tracking speed (rate)
const LOOKTARGET_DECAY = 10.0; // Camera look target tracking speed (rate)
const HEADING_DECAY = 7.5;    // Cinematic camera steering/yaw tracking lag
const SWAY_DECAY = 4.5;       // Side sway tracking lag
const VERTICAL_DECAY = 5.0;   // Vertical terrain smoothing
const FOV_DECAY = 6.0;        // Zoom responsiveness

const MIN_DIST = 5.5;         // Minimum distance to prevent car clipping
const MAX_DIST = 18.0;        // Maximum distance constraint

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private scene?: THREE.Scene;
  private isInitialized = false;
  private frustumCullingHandled = false;

  // Pre-allocated scratch vectors — reused every frame, never recreated in update()
  private carPosition = new THREE.Vector3();
  private targetForward = new THREE.Vector3();
  private forward = new THREE.Vector3();
  private carRight = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private desiredPosition = new THREE.Vector3();
  private desiredLookTarget = new THREE.Vector3();
  private lookTarget = new THREE.Vector3();
  private toCamera = new THREE.Vector3();

  // Custom smooth tracking properties
  private smoothY = 0;
  private sideSway = 0;

  constructor(camera: THREE.PerspectiveCamera, baseFov = FOV_MIN, scene?: THREE.Scene) {
    this.camera = camera;
    this.scene = scene;

    this.camera.fov = baseFov;
    this.camera.updateProjectionMatrix();

    window.addEventListener('reset-camera', () => {
      this.isInitialized = false;
    });
  }

  /**
   * Resets the camera so the next update() snaps instead of lagging.
   */
  public reset(playerPos: THREE.Vector3, playerAngle: number): void {
    this.isInitialized = false;
    this.smoothY = playerPos.y;
    this.sideSway = 0;
    this.forward.set(Math.sin(playerAngle), 0, Math.cos(playerAngle)).normalize();
  }

  /**
   * Forza Horizon 5 style chase camera with drift offset, speed-zoom feel,
   * completely mobile-friendly, stable at 60 FPS, and free of garbage allocations.
   */
  public update(
    player: CarState,
    elapsedSec: number,
    controls: { forward: boolean; backward: boolean; left: boolean; right: boolean; nitro: boolean },
    activeMode: string = 'CHASE' // Kept for signature compatibility pathing
  ): void {
    if (!player || !player.position) return;

    // Resolve frustum culling on player's group mesh exactly once
    if (!this.frustumCullingHandled) {
      const playerGroup = this.scene?.getObjectByName('car_root_player');
      if (playerGroup) {
        playerGroup.traverse((obj) => {
          if ((obj as any).isMesh) obj.frustumCulled = false;
        });
        this.frustumCullingHandled = true;
      }
    }

    // Clamp elapsed time to filter high-latency physics steps
    const dt = Math.min(elapsedSec, 0.05);

    // Calculate normalized speed ratio based on game's performance ceiling (max speed ~78m/s)
    const speedRatio = Math.max(0, Math.min(1.0, Math.abs(player.speed) / 78));

    // 1. Dynamic FOV Speed-Zoom (Slices with high velocity to warp field-of-view gracefully)
    const targetFov = FOV_MIN + speedRatio * (FOV_MAX - FOV_MIN);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 1 - Math.exp(-FOV_DECAY * dt));
    this.camera.updateProjectionMatrix();

    // 2. Dynamic Distance & Height (Zoom back and high at extreme speeds for vision scope)
    const currentDistance = 9.0 + speedRatio * 3.5;
    const currentHeight = 3.4 + speedRatio * 0.7;

    // 3. Lookahead distance & verticality scaling with velocity to frame the upcoming road bend
    const currentLookahead = 12.0 + speedRatio * 15.0;
    const currentLookaheadHeight = 1.6 + speedRatio * 0.5;

    // 4. Smooth vertical axis to eliminate suspension jitter and bump impacts
    if (!this.isInitialized) {
      this.smoothY = player.position.y;
    } else {
      this.smoothY = THREE.MathUtils.lerp(this.smoothY, player.position.y, 1 - Math.exp(-VERTICAL_DECAY * dt));
    }
    this.carPosition.set(player.position.x, this.smoothY, player.position.z);

    // 5. Dynamic Drift and Turning Sway math
    const velX = player.velocity ? player.velocity.x : 0;
    const velZ = player.velocity ? player.velocity.z : 0;
    const rightX = -Math.cos(player.angle);
    const rightZ = Math.sin(player.angle);
    const lateralSpeed = velX * rightX + velZ * rightZ;

    let steerOffsetFactor = 0;
    if (controls) {
      if (controls.left) steerOffsetFactor += 1.0;
      if (controls.right) steerOffsetFactor -= 1.0;
    }

    // Combine active steering press sway with physical slide lateral speed sway
    const targetSway = (steerOffsetFactor * 0.5) - (lateralSpeed * 0.12);
    this.sideSway = THREE.MathUtils.lerp(this.sideSway, THREE.MathUtils.clamp(targetSway, -2.2, 2.2), 1 - Math.exp(-SWAY_DECAY * dt));

    // 6. Cinematic heading vector lag (camera lags behind turning, swinging around corners)
    this.targetForward.set(Math.sin(player.angle), 0, Math.cos(player.angle)).normalize();

    if (!this.isInitialized) {
      this.forward.copy(this.targetForward);
    } else {
      this.forward.lerp(this.targetForward, 1 - Math.exp(-HEADING_DECAY * dt));
      this.forward.normalize();
    }

    // 7. Render dynamic camera location behind chase focal node
    this.desiredPosition
      .copy(this.carPosition)
      .addScaledVector(this.forward, -currentDistance)
      .addScaledVector(this.up, currentHeight);

    // Lateral offset based on side sway (NFS/Asphalt apex framing)
    this.carRight.set(-this.forward.z, 0, this.forward.x).normalize();
    this.desiredPosition.addScaledVector(this.carRight, this.sideSway);

    // 8. Place dynamic look point incorporating speed and side framing offsets
    this.desiredLookTarget
      .copy(this.carPosition)
      .addScaledVector(this.forward, currentLookahead)
      .addScaledVector(this.up, currentLookaheadHeight)
      .addScaledVector(this.carRight, this.sideSway * 0.45);

    // Smooth position and target tracking
    if (!this.isInitialized) {
      this.camera.position.copy(this.desiredPosition);
      this.lookTarget.copy(this.desiredLookTarget);
      this.isInitialized = true;
    } else {
      this.camera.position.lerp(this.desiredPosition, 1 - Math.exp(-POSITION_DECAY * dt));
      this.lookTarget.lerp(this.desiredLookTarget, 1 - Math.exp(-LOOKTARGET_DECAY * dt));
    }

    // 9. Hard clipping safeguard constraint to map boundaries relative to vehicle center
    this.toCamera.subVectors(this.camera.position, this.carPosition);
    const dist = this.toCamera.length();

    if (dist <= 0.001) {
      this.camera.position
        .copy(this.carPosition)
        .addScaledVector(this.forward, -MIN_DIST)
        .addScaledVector(this.up, currentHeight);
    } else if (dist < MIN_DIST) {
      this.toCamera.multiplyScalar(MIN_DIST / dist);
      this.camera.position.copy(this.carPosition).add(this.toCamera);
    } else if (dist > MAX_DIST) {
      this.toCamera.multiplyScalar(MAX_DIST / dist);
      this.camera.position.copy(this.carPosition).add(this.toCamera);
    }

    // Direct alignment
    this.camera.lookAt(this.lookTarget);
  }
}

export default CameraController;
