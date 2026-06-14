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

    // Create the Pivot (handles steering yaw on local Y-axis and suspension vertical travel Y)
    const pivot = new THREE.Group();
    pivot.name = `${name}Pivot`;
    pivot.position.copy(initialLocalPos);
    pivot.quaternion.set(0, 0, 0, 1);
    
    parent.add(pivot);

    // Create the Hub (handles dynamic wheelspin roll on local X-axis)
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
      originalScale
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

    // 1. Calculate wheelspin pace based on actual vehicle speeds
    const speed = car.speed;
    let wheelRotationSpeed = Math.abs(speed);
    
    // Low speed/brake wheelspin smoothing
    if (Math.abs(speed) < 1.0) {
      wheelRotationSpeed = 0.0;
    }

    const rotDelta = (wheelRotationSpeed * elapsedSec) / wheelRadius;
    this.wheelspinAngle += rotDelta;
    this.wheelspinAngle %= Math.PI * 2;

    const qSteer = new THREE.Quaternion();
    const qSpin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.wheelspinAngle);
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

      // Handle Wheelspin Roll (Decoupled on Hub level)
      assembly.hub.quaternion.copy(qSpin);
    };

    updateAssembly(this.frontLeft, suspState ? suspState.frontLeft : 0, true);
    updateAssembly(this.frontRight, suspState ? suspState.frontRight : 0, true);
    updateAssembly(this.rearLeft, suspState ? suspState.rearLeft : 0, false);
    updateAssembly(this.rearRight, suspState ? suspState.rearRight : 0, false);
  }
}
