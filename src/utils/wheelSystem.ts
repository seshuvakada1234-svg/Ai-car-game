import * as THREE from 'three';
import { CarState } from '../types';
import { SuspensionState } from './suspension';

export interface WheelAssembly {
  node: THREE.Object3D;
  initialLocalPos: THREE.Vector3;
  initialRotation: THREE.Euler;
  wheelspinAngle: number;
}

export class WheelSystem {
  public frontLeftWheel: WheelAssembly | null = null;
  public frontRightWheel: WheelAssembly | null = null;
  public rearLeftWheel: WheelAssembly | null = null;
  public rearRightWheel: WheelAssembly | null = null;

  // Fallback wheel positions for models without proper naming
  private static readonly FALLBACK_POSITIONS = {
    frontLeft: new THREE.Vector3(0.95, 0.38, 1.15),
    frontRight: new THREE.Vector3(-0.95, 0.38, 1.15),
    rearLeft: new THREE.Vector3(1.0, 0.38, -1.2),
    rearRight: new THREE.Vector3(-1.0, 0.38, -1.2)
  };

  // Wheel radius for spin calculations
  private static readonly WHEEL_RADIUS = 0.38;

  // Suspension constants
  private static readonly MAX_TRAVEL = 0.15;
  private static readonly WHEEL_TRAVEL_Y = 0.10;

  constructor(wheels: THREE.Object3D[]) {
    this.detectAndAssignWheels(wheels);
  }

  /**
   * Detects wheel meshes by name matching and classifies by Z-coordinate sorting
   * 
   * Detection pattern: names containing:
   * - wheel, tire, rim, pneu, col_w (case-insensitive)
   * 
   * Classification:
   * 1. Collect all matching wheels
   * 2. Sort by Z coordinate (higher Z = front)
   * 3. Split into front and rear pairs
   * 4. Sort each pair by X coordinate
   * 5. Assign: frontLeft, frontRight, rearLeft, rearRight
   * 6. Store initial rotation to preserve GLTF orientation
   */
  private detectAndAssignWheels(wheels: THREE.Object3D[]): void {
    if (!wheels || wheels.length === 0) {
      this.assignFallbackWheels();
      return;
    }

    // Collect wheels that match name patterns
    const detectedWheels: THREE.Object3D[] = [];
    const wheelPatterns = ['wheel', 'tire', 'rim', 'pneu', 'col_w'];

    wheels.forEach((node) => {
      const nameLower = node.name.toLowerCase();
      const isWheelMatch = wheelPatterns.some(pattern => nameLower.includes(pattern));
      
      if (isWheelMatch) {
        detectedWheels.push(node);
      }
    });

    if (detectedWheels.length === 0) {
      this.assignFallbackWheels();
      return;
    }

    // Sort wheels by Z coordinate (higher Z = front wheels)
    detectedWheels.sort((a, b) => (b.position.z || 0) - (a.position.z || 0));

    // Split into front and rear pairs
    const frontWheels = detectedWheels.slice(0, 2);
    const rearWheels = detectedWheels.slice(2, 4);

    // Process front wheels - sort by X (positive X = left in local space)
    if (frontWheels.length >= 2) {
      frontWheels.sort((a, b) => (b.position.x || 0) - (a.position.x || 0));
      this.frontLeftWheel = this.createWheelAssembly(frontWheels[0]);
      this.frontRightWheel = this.createWheelAssembly(frontWheels[1]);
    } else if (frontWheels.length === 1) {
      this.frontLeftWheel = this.createWheelAssembly(frontWheels[0]);
    }

    // Process rear wheels - sort by X (positive X = left in local space)
    if (rearWheels.length >= 2) {
      rearWheels.sort((a, b) => (b.position.x || 0) - (a.position.x || 0));
      this.rearLeftWheel = this.createWheelAssembly(rearWheels[0]);
      this.rearRightWheel = this.createWheelAssembly(rearWheels[1]);
    } else if (rearWheels.length === 1) {
      this.rearLeftWheel = this.createWheelAssembly(rearWheels[0]);
    }

    // Fill remaining slots with fallbacks
    if (!this.frontLeftWheel) {
      this.frontLeftWheel = this.createFallbackWheelAssembly(WheelSystem.FALLBACK_POSITIONS.frontLeft);
    }
    if (!this.frontRightWheel) {
      this.frontRightWheel = this.createFallbackWheelAssembly(WheelSystem.FALLBACK_POSITIONS.frontRight);
    }
    if (!this.rearLeftWheel) {
      this.rearLeftWheel = this.createFallbackWheelAssembly(WheelSystem.FALLBACK_POSITIONS.rearLeft);
    }
    if (!this.rearRightWheel) {
      this.rearRightWheel = this.createFallbackWheelAssembly(WheelSystem.FALLBACK_POSITIONS.rearRight);
    }
  }

  /**
   * Creates a wheel assembly from a detected wheel node
   * Stores initial rotation to preserve GLTF orientation
   */
  private createWheelAssembly(node: THREE.Object3D): WheelAssembly {
    return {
      node,
      initialLocalPos: node.position.clone(),
      initialRotation: node.rotation.clone(),
      wheelspinAngle: 0
    };
  }

  /**
   * Assigns fallback wheel positions when detection fails
   */
  private assignFallbackWheels(): void {
    this.frontLeftWheel = this.createFallbackWheelAssembly(WheelSystem.FALLBACK_POSITIONS.frontLeft);
    this.frontRightWheel = this.createFallbackWheelAssembly(WheelSystem.FALLBACK_POSITIONS.frontRight);
    this.rearLeftWheel = this.createFallbackWheelAssembly(WheelSystem.FALLBACK_POSITIONS.rearLeft);
    this.rearRightWheel = this.createFallbackWheelAssembly(WheelSystem.FALLBACK_POSITIONS.rearRight);
  }

  /**
   * Creates a fallback wheel assembly with a dummy node
   */
  private createFallbackWheelAssembly(position: THREE.Vector3): WheelAssembly {
    const dummyGroup = new THREE.Group();
    dummyGroup.position.copy(position);
    return {
      node: dummyGroup,
      initialLocalPos: position.clone(),
      initialRotation: new THREE.Euler(),
      wheelspinAngle: 0
    };
  }

  /**
   * EXCLUSIVE wheel control: spin, steering, and suspension travel.
   * 
   * Only this system updates wheel transforms.
   * No other system (suspension.ts, gamePhysics.ts, GameCanvas.tsx) should modify wheels.
   * 
   * Uses spring-damper suspension with:
   * - MAX_TRAVEL = 0.15m
   * - wheelTravelY = 0.10m
   * - No teleporting or floating
   * 
   * CRITICAL RULES:
   * 1. Preserve original wheel axis orientation from GLTF
   * 2. Apply rotations additively (rotateX, rotateY) - never overwrite
   * 3. Lock X and Z positions to initial values
   * 4. Smooth Y-axis suspension with clamped lerp
   * 5. Front wheels only steer (rotateY)
   * 6. Rear wheels never steer
   */
  public update(
    car: CarState,
    steerValue: number,
    suspension: SuspensionState,
    elapsedSec: number
  ): void {
    const speed = car.speed;

    // 1. Calculate wheel spin angle change
    // wheel_rotation_speed = velocity / radius = (dt * speed / radius)
    let spinDelta = (speed * elapsedSec) / WheelSystem.WHEEL_RADIUS;
    
    // Simulate burnout wheelspin during hard acceleration launch
    const isAcceleratingHard = car.id === 'player' && car.speed < 15 && Math.abs(steerValue) < 0.1;
    if (isAcceleratingHard && speed > 1) {
      spinDelta = (35 * elapsedSec) / WheelSystem.WHEEL_RADIUS;
    }

    // 2. Front wheel steering angle
    const maxSteerAngle = 0.42; // ~24 degrees of real front wheel lock
    const steerAngle = steerValue * maxSteerAngle;

    // 3. Maximum suspension travel - clamped lerp factor to prevent teleporting
    const suspensionLerpAlpha = Math.min(1.0, elapsedSec * 10.0);

    // 4. Update each wheel assembly - EXCLUSIVELY
    // Front wheels can steer
    this.updateWheelAssembly(
      this.frontLeftWheel,
      suspension.frontLeft,
      steerAngle,
      spinDelta,
      suspensionLerpAlpha,
      true  // canSteer
    );
    this.updateWheelAssembly(
      this.frontRightWheel,
      suspension.frontRight,
      steerAngle,
      spinDelta,
      suspensionLerpAlpha,
      true  // canSteer
    );

    // Rear wheels never steer
    this.updateWheelAssembly(
      this.rearLeftWheel,
      suspension.rearLeft,
      0,
      spinDelta,
      suspensionLerpAlpha,
      false  // canSteer
    );
    this.updateWheelAssembly(
      this.rearRightWheel,
      suspension.rearRight,
      0,
      spinDelta,
      suspensionLerpAlpha,
      false  // canSteer
    );
  }

  /**
   * Updates a single wheel assembly with spin, steering, and suspension travel
   * 
   * CRITICAL: Preserve original rotation orientation from GLTF
   * CRITICAL: Apply rotations additively using rotateX/rotateY
   * CRITICAL: Lock X,Z to initial positions - only modify Y for suspension
   * CRITICAL: Use clamped lerp for suspension to prevent teleporting
   */
  private updateWheelAssembly(
    assembly: WheelAssembly | null,
    compression: number,
    steerAngle: number,
    spinDelta: number,
    suspensionLerpAlpha: number,
    canSteer: boolean
  ): void {
    if (!assembly || !assembly.node) return;

    // 1. Update wheel spin accumulator
    assembly.wheelspinAngle += spinDelta;
    
    // Keep wheel rotation normalized to prevent numerical errors
    while (assembly.wheelspinAngle > Math.PI * 2) assembly.wheelspinAngle -= Math.PI * 2;
    while (assembly.wheelspinAngle < 0) assembly.wheelspinAngle += Math.PI * 2;

    // 2. Restore initial orientation from GLTF to preserve axis alignment
    assembly.node.rotation.copy(assembly.initialRotation);

    // 3. Apply rotations additively (never overwrite)
    // Spin around X-axis (pitch - actual wheel rotation)
    assembly.node.rotateX(assembly.wheelspinAngle);
    
    // Steering around Y-axis (yaw - only for front wheels)
    if (canSteer) {
      assembly.node.rotateY(steerAngle);
    }

    // 4. Apply vertical suspension travel with clamped lerp
    // Clamp compression to [0, 1]
    const clampedCompression = Math.max(0, Math.min(1, compression));
    const targetDisplacementY = assembly.initialLocalPos.y + (clampedCompression * WheelSystem.WHEEL_TRAVEL_Y);
    
    // Smooth suspension movement with clamped alpha to prevent teleporting
    assembly.node.position.y = THREE.MathUtils.lerp(
      assembly.node.position.y,
      targetDisplacementY,
      suspensionLerpAlpha
    );

    // 5. Lock X and Z coordinates to initial values
    // This prevents wheel drifting and ensures consistent track width and wheelbase
    assembly.node.position.x = assembly.initialLocalPos.x;
    assembly.node.position.z = assembly.initialLocalPos.z;
  }
}
