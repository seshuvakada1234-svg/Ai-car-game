import * as THREE from 'three';
import { CarState } from '../types';
import { SuspensionState } from './suspension';

export interface WheelAssembly {
  node: THREE.Object3D;
  initialLocalPos: THREE.Vector3;
  wheelspinAngle: number;
}

export class WheelSystem {
  public frontLeftWheel: WheelAssembly | null = null;
  public frontRightWheel: WheelAssembly | null = null;
  public rearLeftWheel: WheelAssembly | null = null;
  public rearRightWheel: WheelAssembly | null = null;

  // Track width / wheelbase constants (taken from real GT3 and Aventador spec ratios)
  private static readonly REFL_TRACK_WIDTH = 1.95; // meters
  private static readonly REFL_WHEEL_BASE = 2.70;  // meters

  constructor(wheels: THREE.Object3D[]) {
    this.detectAndAssignWheels(wheels);
  }

  /**
   * Automatically detect and classify each 3D wheel model node based on its spatial quadrant position
   */
  private detectAndAssignWheels(wheels: THREE.Object3D[]): void {
    if (!wheels || wheels.length === 0) return;

    wheels.forEach((node) => {
      // Find local coordinates relative to the direct parent frame (the car body)
      const localPos = node.position.clone();

      // Front vs Rear (Z in standard hypercar GLTFs is forward-facing or backwards depending on the model scale)
      // Usually Z is forward, but we can check absolute boundaries
      const isFront = localPos.z > 0.15;
      const isLeft = localPos.x > 0;

      const assembly: WheelAssembly = {
        node,
        initialLocalPos: localPos.clone(),
        wheelspinAngle: 0
      };

      if (isFront) {
        if (isLeft) {
          this.frontLeftWheel = assembly;
        } else {
          this.frontRightWheel = assembly;
        }
      } else {
        if (isLeft) {
          this.rearLeftWheel = assembly;
        } else {
          this.rearRightWheel = assembly;
        }
      }
    });

    // Fallbacks if some quadrants are shared or empty (make sure all properties are stable)
    if (!this.frontLeftWheel && wheels[0]) {
      this.frontLeftWheel = { node: wheels[0], initialLocalPos: wheels[0].position.clone(), wheelspinAngle: 0 };
    }
    if (!this.frontRightWheel && wheels[1] || (!this.frontRightWheel && wheels[0])) {
      this.frontRightWheel = { node: wheels[1] || wheels[0], initialLocalPos: (wheels[1] || wheels[0]).position.clone(), wheelspinAngle: 0 };
    }
    if (!this.rearLeftWheel && wheels[2] || (!this.rearLeftWheel && wheels[0])) {
      this.rearLeftWheel = { node: wheels[2] || wheels[0], initialLocalPos: (wheels[2] || wheels[0]).position.clone(), wheelspinAngle: 0 };
    }
    if (!this.rearRightWheel && wheels[3] || (!this.rearRightWheel && wheels[0])) {
      this.rearRightWheel = { node: wheels[3] || wheels[0], initialLocalPos: (wheels[3] || wheels[0]).position.clone(), wheelspinAngle: 0 };
    }
  }

  /**
   * Updates wheel yaw steering, pitch rolling rotation and suspension vertical travel offset.
   * Keeps track width consistent to prevent wheels from ever looking detached or floating.
   */
  public update(
    car: CarState,
    steerValue: number,
    suspension: SuspensionState,
    elapsedSec: number
  ): void {
    const speed = car.speed;
    const wheelRadius = 0.38; // standard physical wheel radius

    // 1. Calculate wheelspin pitch angle change
    // wheel_rotation_speed = velocity / radius (dt * speed / radius)
    let spinDelta = (speed * elapsedSec) / wheelRadius;
    
    // Simulate initial burnout tire spin during hard accelerate launch!
    const isAcceleratingHard = car.id === 'player' && car.speed < 15 && Math.abs(steerValue) < 0.1;
    if (isAcceleratingHard && speed > 1) {
      spinDelta = (35 * elapsedSec) / wheelRadius; // locked in burnout spin speed!
    }

    // 2. Front wheel steer yaw angle limits
    const maxSteerAngle = 0.42; // ~24 degrees of real front wheel lock
    const steerAngle = steerValue * maxSteerAngle;

    // 3. Apply changes to each wheel assembly securely
    const updateAssembly = (assembly: WheelAssembly | null, compression: number, steer: number) => {
      if (!assembly || !assembly.node) return;

      // Update stable wheel spin accumulator
      assembly.wheelspinAngle += spinDelta;
      
      // Keep wheel rotation between 0 and 2*PI for precision
      if (assembly.wheelspinAngle > Math.PI * 2) assembly.wheelspinAngle -= Math.PI * 2;
      if (assembly.wheelspinAngle < 0) assembly.wheelspinAngle += Math.PI * 2;

      // Setup clean and stable rotation transitions
      assembly.node.rotation.set(0, 0, 0); // Reset rotation to default base alignment

      // Yaw rotation (steer on front wheels)
      assembly.node.rotateY(steer);

      // Pitch rotation (spin on rolling axel)
      assembly.node.rotateX(assembly.wheelspinAngle);

      // Apply vertical suspension travel relative to rest height
      // The tire moves upward in the wheel well by (compression * dynamic dampening height)
      const maxTravelY = 0.10; // meters of maximum wheel travel
      const targetDisplacementY = assembly.initialLocalPos.y + (compression * maxTravelY);
      
      assembly.node.position.y = THREE.MathUtils.lerp(assembly.node.position.y, targetDisplacementY, 15 * elapsedSec);

      // Lock X and Z coordinates to initial values to preserve track width and wheelbase perfectly!
      assembly.node.position.x = assembly.initialLocalPos.x;
      assembly.node.position.z = assembly.initialLocalPos.z;
    };

    // Apply updates
    updateAssembly(this.frontLeftWheel, suspension.frontLeft, steerAngle);
    updateAssembly(this.frontRightWheel, suspension.frontRight, steerAngle);
    updateAssembly(this.rearLeftWheel, suspension.rearLeft, 0); // standard rear wheel alignment
    updateAssembly(this.rearRightWheel, suspension.rearRight, 0);
  }
}
