import * as THREE from 'three';
import { CarState } from '../types';
import { SuspensionState } from './suspension';

export interface WheelAssembly {
  node: THREE.Object3D;
  pivot: THREE.Group;
  hub: THREE.Group;
  initialLocalPos: THREE.Vector3;
  originalQuaternion: THREE.Quaternion;
  originalScale: THREE.Vector3;
  spinAxis: THREE.Vector3;
  spinSign: number;
}

export class WheelSystem {
  public frontLeft: WheelAssembly | null = null;
  public frontRight: WheelAssembly | null = null;
  public rearLeft: WheelAssembly | null = null;
  public rearRight: WheelAssembly | null = null;

  public wheelspinAngle: number = 0;

  constructor(wheels: THREE.Object3D[], modelRoot: THREE.Object3D) {
    if (!wheels || wheels.length === 0) return;
    this.detectAndAssignWheels(wheels, modelRoot);
  }

  /**
   * Automatically detect and classify each 3D wheel model node based on its spatial quadrant position
   */
  private detectAndAssignWheels(wheels: THREE.Object3D[], modelRoot: THREE.Object3D): void {
    let flNode: THREE.Object3D | null = null;
    let frNode: THREE.Object3D | null = null;
    let rlNode: THREE.Object3D | null = null;
    let rrNode: THREE.Object3D | null = null;

    wheels.forEach((wheel) => {
      const localPos = new THREE.Vector3();
      wheel.getWorldPosition(localPos);
      modelRoot.worldToLocal(localPos);

      const isFront = localPos.z > 0;
      const isLeft = localPos.x > 0;

      if (isFront) {
        if (isLeft) flNode = wheel;
        else frNode = wheel;
      } else {
        if (isLeft) rlNode = wheel;
        else rrNode = wheel;
      }
    });

    // Setup each quadrant as a nested Pivot-Hub-Mesh assembly
    this.frontLeft = this.setupAssembly(flNode, "frontLeft");
    this.frontRight = this.setupAssembly(frNode, "frontRight");
    this.rearLeft = this.setupAssembly(rlNode, "rearLeft");
    this.rearRight = this.setupAssembly(rrNode, "rearRight");
  }

  private setupAssembly(node: THREE.Object3D | null, name: string): WheelAssembly | null {
    if (!node) return null;

    const parent = node.parent;
    if (!parent) return null;

    // Capture the original local transform details
    const initialLocalPos = node.position.clone();
    const originalQuaternion = node.quaternion.clone();
    const originalScale = node.scale.clone();

    // Determine the raw local spin axis by checking local bounding box of raw geometry
    const tempPosition = node.position.clone();
    const tempRotation = node.rotation.clone();
    const tempScale = node.scale.clone();

    // Temporarily clear scale, rotation & position to compute local bounding box correctly
    node.position.set(0, 0, 0);
    node.rotation.set(0, 0, 0);
    node.scale.set(1, 1, 1);
    node.updateMatrix();

    const localBox = new THREE.Box3().setFromObject(node);

    // Restore original transform
    node.position.copy(tempPosition);
    node.rotation.copy(tempRotation);
    node.scale.copy(tempScale);
    node.updateMatrix();

    const size = new THREE.Vector3();
    localBox.getSize(size);

    // Default to local X-axis (1, 0, 0)
    const localSpinAxis = new THREE.Vector3(1, 0, 0);
    const minDim = Math.min(size.x, size.y, size.z);

    if (minDim === size.y) {
      localSpinAxis.set(0, 1, 0);
    } else if (minDim === size.z) {
      localSpinAxis.set(0, 0, 1);
    }

    // Now, transform this local spin axis into the car's body coordinate system
    const spinAxis = localSpinAxis.clone().applyQuaternion(originalQuaternion).normalize();

    // Determine spin sign based on axis dot left of car (positive X)
    // If it points to the left (+X), rotating positive curl goes forward.
    // If it points to the right (-X), we invert it.
    const spinSign = spinAxis.x >= 0 ? 1 : -1;

    // Create the Pivot (handles steering yaw on local Y-axis and suspension vertical travel Y)
    const pivot = new THREE.Group();
    pivot.name = `${name}Pivot`;
    pivot.position.copy(initialLocalPos);
    pivot.quaternion.set(0, 0, 0, 1);
    
    parent.add(pivot);

    // Create the Hub (handles dynamic wheelspin roll on local spinAxis)
    const hub = new THREE.Group();
    hub.name = `${name}Hub`;
    hub.position.set(0, 0, 0);
    hub.quaternion.set(0, 0, 0, 1);

    pivot.add(hub);

    // Reparent and preserve mesh
    node.position.set(0, 0, 0);
    node.quaternion.copy(originalQuaternion);
    node.scale.copy(originalScale);
    hub.add(node);

    return {
      node,
      pivot,
      hub,
      initialLocalPos,
      originalQuaternion,
      originalScale,
      spinAxis,
      spinSign
    };
  }

  /**
   * Performs the high-precision steering, wheelspin, and suspension translation updates
   * using decoupled pivots and hubs with stable, gimbal-lock-free quaternions.
   */
  public update(
    car: CarState,
    steerOffset: number,
    suspState: SuspensionState,
    elapsedSec: number
  ): void {
    const wheelRadius = 0.38; // standard physical tire radius
    const maxTravelY = 0.10;  // maximum suspension travel range in meters
    const maxSteerAngle = 0.36; // maximum turning steering limit

    // Calculate wheelspin pace based on actual vehicle speeds
    const speed = car.speed;
    let wheelRotationSpeed = Math.abs(speed);
    
    // Low speed/brake wheelspin smoothing
    if (Math.abs(speed) < 1.0) {
      wheelRotationSpeed = 0.0;
    }

    const rotDelta = (wheelRotationSpeed * elapsedSec) / wheelRadius;
    this.wheelspinAngle += rotDelta * (speed >= 0 ? 1 : -1);
    this.wheelspinAngle %= Math.PI * 2;

    const qSteer = new THREE.Quaternion();
    const qZero = new THREE.Quaternion().set(0, 0, 0, 1);

    const updateAssembly = (
      assembly: WheelAssembly | null,
      compressionY: number,
      isFront: boolean
    ) => {
      if (!assembly) return;

      // Vertical suspension slide with rigid structural X/Z lock to prevent visual detachments
      const targetY = assembly.initialLocalPos.y + (compressionY * maxTravelY);
      assembly.pivot.position.y = THREE.MathUtils.lerp(assembly.pivot.position.y, targetY, 15 * elapsedSec);
      assembly.pivot.position.x = assembly.initialLocalPos.x;
      assembly.pivot.position.z = assembly.initialLocalPos.z;

      // Handle Steering Yaw (Decoupled on Pivot level)
      if (isFront) {
        const steerYaw = steerOffset * maxSteerAngle;
        qSteer.setFromAxisAngle(new THREE.Vector3(0, 1, 0), steerYaw);
        assembly.pivot.quaternion.copy(qSteer);
      } else {
        assembly.pivot.quaternion.copy(qZero);
      }

      // Handle Wheelspin Roll (Decoupled on Hub level, based on cached spinAxis and correct directional spinSign)
      const rollAngle = this.wheelspinAngle * assembly.spinSign;
      assembly.hub.quaternion.setFromAxisAngle(assembly.spinAxis, rollAngle);
    };

    updateAssembly(this.frontLeft, suspState ? suspState.frontLeft : 0, true);
    updateAssembly(this.frontRight, suspState ? suspState.frontRight : 0, true);
    updateAssembly(this.rearLeft, suspState ? suspState.rearLeft : 0, false);
    updateAssembly(this.rearRight, suspState ? suspState.rearRight : 0, false);
  }
}
