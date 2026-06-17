import * as THREE from 'three';
import { CarState } from '../types';
import { SuspensionSystem, SuspensionState } from './SuspensionSystem';
import { WheelSystem } from './WheelSystem';

export class CarAnimator {
  /**
   * Animates the car chassis (handling body roll, weight-transfer pitching, micro-vibrations)
   * and delegates precise steering and spin rotation updates to the wheel system.
   */
  public static animateChassis(
    car: CarState,
    carGroup: THREE.Group,
    wheelSystem: WheelSystem | null,
    controls: { forward: boolean; backward: boolean; left: boolean; right: boolean; handbrake?: boolean },
    elapsedSec: number,
    runningTime: number
  ): SuspensionState {
    if (!carGroup) {
      return { frontLeft: 0, frontRight: 0, rearLeft: 0, rearRight: 0, bodyRoll: 0, bodyPitch: 0 };
    }

    // Smooth speed factor ratio
    const speedRatio = Math.min(1.0, Math.abs(car.speed) / 78);

    // Calculate dynamic steering offset for front wheel orientation
    let steerOffset = 0;
    if (car.id === 'player') {
      const steerVal = car.steerValue !== undefined ? car.steerValue : (controls.left ? 1 : (controls.right ? -1 : 0));
      steerOffset = steerVal * 0.36;
    } else {
      steerOffset = THREE.MathUtils.clamp((car.steerValue !== undefined ? car.steerValue : car.angularVelocity * 0.4), -0.36, 0.36);
    }

    // Evaluate high-sports car realistic suspension and body pitch/roll offsets
    const suspState: SuspensionState = SuspensionSystem.calculateSuspension(
      car,
      elapsedSec,
      controls,
      steerOffset,
      0,
      carGroup.rotation.z,
      carGroup.rotation.x
    );

    // 1. Roll chassis body opposite to cornering force G-transfer
    carGroup.rotation.z = suspState.bodyRoll;

    // 2. Headlight Squat (accel rear drop) and dive (brake nose dip) weight transfer
    carGroup.rotation.x = suspState.bodyPitch;

    // 3. High-frequency chassis road vibrations
    const suspensionVibe = Math.sin(runningTime * 45.0) * 0.006 * speedRatio;
    carGroup.position.y += suspensionVibe;

    // 4. Update the WheelSystem hierarchy
    if (wheelSystem) {
      const normSteer = steerOffset / 0.36;
      wheelSystem.update(car, normSteer, suspState, elapsedSec);
    }

    return suspState;
  }
}
