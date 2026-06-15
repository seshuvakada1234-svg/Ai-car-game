import * as THREE from 'three';
import { CarState } from '../types';
import { terrainManager } from '../world/terrainManager';

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  
  // Camera settings
  private baseFov: number;
  private currentFov: number;
  private cameraShakePower = 0.0;
  
  // Reusable scratch vectors to avoid garbage collection memory pressure (Zero allocations in update!)
  private smoothedLookAt = new THREE.Vector3();
  private isInitialized = false;

  private _targetCamPos = new THREE.Vector3();
  private _toCar = new THREE.Vector3();
  private _targetLookAt = new THREE.Vector3();
  private _playerPosVec = new THREE.Vector3();

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
   */
  public update(
    player: CarState,
    elapsedSec: number,
    controls: { forward: boolean; backward: boolean; left: boolean; right: boolean; nitro: boolean },
    activeMode: 'CLOSE' | 'MEDIUM' | 'FAR' | 'COCKPIT' = 'MEDIUM'
  ): void {
    if (!player || !player.position) return;

    this._playerPosVec.set(player.position.x, player.position.y, player.position.z);

    const speedKmh = Math.abs(player.speed) * 3.6;
    const speedRatio = Math.min(1.0, Math.abs(player.speed) / 78);

    // --- 1. DYNAMIC SPEED-SENSITIVE FIELD OF VIEW (FOV Expansion) ---
    const targetFov = this.baseFov + speedRatio * 18.0 + (player.isNitroActive ? 6.5 : 0.0);
    this.currentFov = THREE.MathUtils.lerp(this.currentFov, targetFov, 1 - Math.exp(-6.5 * elapsedSec));
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();

    // --- 2. DRIFT CAMERA SYSTEM (Anticipative Orbiting Swing) ---
    let driftLateralOffset = 0;
    if (player.isDrifting && activeMode !== 'COCKPIT') {
      const velocityAngle = Math.atan2(player.velocity.x, player.velocity.z);
      let slipAngle = velocityAngle - player.angle;
      while (slipAngle < -Math.PI) slipAngle += Math.PI * 2;
      while (slipAngle > Math.PI) slipAngle -= Math.PI * 2;

      driftLateralOffset = slipAngle * 0.72; // swing wide based on sideways slide angle
    }

    // --- 3. TARGET CHASE POSITIONS & HEIGHTS ---
    let camDist = 8.5;
    let camHeight = 2.4;
    let lookAheadDistance = 3.5 + speedRatio * 4.5;
    let lookAheadHeightY = 0.95;
    let smoothingFactorPos = 8.2;
    let minCamTrackDist = 6.8;
    let minHeightAltitude = player.position.y + 1.25;

    if (activeMode === 'CLOSE') {
      camDist = 5.6 + speedRatio * 1.2;
      camHeight = 1.8 - speedRatio * 0.2;
      lookAheadDistance = 2.8 + speedRatio * 3.5;
      lookAheadHeightY = 0.85;
      smoothingFactorPos = 12.0;
      minCamTrackDist = 4.2;
      minHeightAltitude = player.position.y + 1.0;
    } else if (activeMode === 'FAR') {
      camDist = 12.5 + speedRatio * 2.2;
      camHeight = 3.6 - speedRatio * 0.35;
      lookAheadDistance = 5.2 + speedRatio * 6.0;
      lookAheadHeightY = 1.15;
      smoothingFactorPos = 6.2;
      minCamTrackDist = 9.8;
      minHeightAltitude = player.position.y + 1.8;
    }

    const angleCos = Math.cos(player.angle + driftLateralOffset);
    const angleSin = Math.sin(player.angle + driftLateralOffset);

    if (activeMode === 'COCKPIT') {
      // Cockpit hood-mount positioning: perfect lock-step forward translation
      const forwardX = Math.sin(player.angle);
      const forwardZ = Math.cos(player.angle);
      this._targetCamPos.set(
        player.position.x + forwardX * 0.65,
        player.position.y + 1.12,
        player.position.z + forwardZ * 0.65
      );
      this.camera.position.copy(this._targetCamPos);
      lookAheadDistance = 16.0;
      lookAheadHeightY = 1.0;
    } else {
      this._targetCamPos.set(
        player.position.x - angleSin * camDist,
        player.position.y + camHeight,
        player.position.z - angleCos * camDist
      );

      // --- 4. FLUID CARRIAGE LAG (Positional Smoothing) ---
      this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, this._targetCamPos.x, 1 - Math.exp(-smoothingFactorPos * elapsedSec));
      this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, this._targetCamPos.y, 1 - Math.exp(-12.5 * elapsedSec));
      this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, this._targetCamPos.z, 1 - Math.exp(-smoothingFactorPos * elapsedSec));

      // --- 4.5 THREE-DIMENSIONAL SPRING-ARM CAMERA COLLISION AVOIDANCE ---
      // Trace a ray from the player car's cockpit center to the camera's smoothed position
      const traceStart = this._playerPosVec.clone().add(new THREE.Vector3(0, 1.2, 0)); // Trace from above center center
      const traceEnd = this.camera.position.clone();
      const traceDirection = new THREE.Vector3().subVectors(traceEnd, traceStart);
      const traceLength = traceDirection.length();

      if (traceLength > 0.05) {
        traceDirection.normalize();
        
        let safeLength = traceLength;
        const totalSamples = 6;
        
        // Sampling along coordinates to find if terrain intersects spring-arm path
        for (let s = 1; s <= totalSamples; s++) {
          const ratio = s / totalSamples;
          const samplePos = new THREE.Vector3().copy(traceStart).addScaledVector(traceDirection, traceLength * ratio);
          const tHeight = terrainManager.getHeight(samplePos.x, samplePos.z);
          
          if (samplePos.y < tHeight + 1.2) {
            // Obstacle/terrain hill detected! Shorten the spring arm (clip-avoidance)
            const safeFraction = (s - 0.55) / totalSamples;
            safeLength = Math.min(safeLength, traceLength * safeFraction);
          }
        }
        
        // Constrain matching spring-arm positions
        const solvedPos = new THREE.Vector3().copy(traceStart).addScaledVector(traceDirection, Math.max(1.5, safeLength));
        this.camera.position.copy(solvedPos);
      }

      // Hard floor boundary to lock camera strictly above landscape terrain and roads
      const localTerrainHeight = terrainManager.getHeight(this.camera.position.x, this.camera.position.z);
      const minAltitudeCeiling = Math.max(minHeightAltitude, localTerrainHeight + 1.85);

      if (this.camera.position.y < minAltitudeCeiling) {
        this.camera.position.y = minAltitudeCeiling;
      }
    }

    // --- 5. HIGH-FREQUENCY INTUITIVE CAMERA SHAKE ---
    let reduction = activeMode === 'COCKPIT' ? 0.44 : 1.0;
    if (player.isNitroActive) {
      this.cameraShakePower = Math.max(0.12 * reduction, this.cameraShakePower - elapsedSec * 0.25);
    } else if (controls.forward && player.speed < 12) {
      this.cameraShakePower = Math.max(0.045 * reduction, this.cameraShakePower - elapsedSec * 0.35); // launch rubber rumbles
    } else if (player.isDrifting && speedKmh > 40) {
      this.cameraShakePower = Math.min(0.11 * reduction, this.cameraShakePower + elapsedSec * 0.45); // sliding tire rumbles
    } else {
      const roadVibe = Math.max(0, speedRatio * 0.02 * reduction);
      this.cameraShakePower = THREE.MathUtils.lerp(this.cameraShakePower, roadVibe, 1 - Math.exp(-5.0 * elapsedSec));
    }

    if (this.cameraShakePower > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.cameraShakePower;
      this.camera.position.y += (Math.random() - 0.5) * this.cameraShakePower;
      this.camera.position.z += (Math.random() - 0.5) * this.cameraShakePower;
    }

    // --- 6. TARGET LOOK-AT (Look into the turn) ---
    const lookAheadX = Math.sin(player.angle) * lookAheadDistance;
    const lookAheadZ = Math.cos(player.angle) * lookAheadDistance;

    this._targetLookAt.set(
      player.position.x + lookAheadX,
      player.position.y + lookAheadHeightY,
      player.position.z + lookAheadZ
    );

    // Filter focus coordinate updates to avoid high-frequency jittering
    if (!this.isInitialized) {
      this.smoothedLookAt.copy(this._targetLookAt);
      this.isInitialized = true;
    } else {
      this.smoothedLookAt.lerp(this._targetLookAt, 1 - Math.exp(-15.0 * elapsedSec));
    }
    
    this.camera.lookAt(this.smoothedLookAt);
  }
}
export default CameraController;
