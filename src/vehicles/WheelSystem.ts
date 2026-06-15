import * as THREE from 'three';
import { CarState } from '../types';
import { SuspensionState } from '../utils/suspension';

export interface WheelAssembly {
  node: THREE.Object3D;
  steerPivot: THREE.Group;
  suspensionPivot: THREE.Group;
  hub: THREE.Group;
  initialLocalPos: THREE.Vector3;
  originalQuaternion: THREE.Quaternion;
  originalScale: THREE.Vector3;
  spinAxis: THREE.Vector3;
  spinSign: number;
  wheelRadius: number;
}

export class WheelSystem {
  public frontLeft: WheelAssembly | null = null;
  public frontRight: WheelAssembly | null = null;
  public rearLeft: WheelAssembly | null = null;
  public rearRight: WheelAssembly | null = null;

  public wheelspinAngle: number = 0;

  // Cached objects for zero allocation in update loop
  private _qSteer = new THREE.Quaternion();
  private _qZero = new THREE.Quaternion().set(0, 0, 0, 1);
  private _axisY = new THREE.Vector3(0, 1, 0);

  constructor(wheels: THREE.Object3D[], modelRoot: THREE.Object3D) {
    if (!wheels || wheels.length === 0) return;
    this.detectAndAssignWheels(wheels, modelRoot);
  }

  private detectAndAssignWheels(wheels: THREE.Object3D[], modelRoot: THREE.Object3D): void {
    // 1. Identify potential candidates in modelRoot while ignoring forbidden body-related terms
    const forbiddenTerms = [
      "car", "body", "chassis", "suspension", "brake", "axle",
      "wheel_group", "support", "fender", "caliper", "disc",
      "hub", "steering", "arch", "well", "housing", "pivot"
    ];
    const wheelTerms = ["wheel", "rim", "tire", "pneu", "col_w"];

    const candidates: THREE.Object3D[] = [];
    modelRoot.traverse((node) => {
      const nameLower = node.name.toLowerCase();
      const containsWheelTerm = wheelTerms.some(term => nameLower.includes(term));
      const containsForbiddenTerm = forbiddenTerms.some(term => nameLower.includes(term));

      if (containsWheelTerm && !containsForbiddenTerm) {
        // Roll up to the highest group representing this wheel/tire assembly (prevent detaching sub-parts separately)
        let current = node;
        while (current.parent && current.parent !== modelRoot) {
          const pName = current.parent.name.toLowerCase();
          const pWheel = wheelTerms.some(term => pName.includes(term));
          const pForbidden = forbiddenTerms.some(term => pName.includes(term));
          if (pWheel && !pForbidden) {
            current = current.parent;
          } else {
            break;
          }
        }
        if (!candidates.includes(current)) {
          candidates.push(current);
        }
      }
    });

    // 2. Ideal target quadrant positions (standard hypercar coordinates)
    let flTarget = new THREE.Vector3(0.95, 0.38, 1.15);
    let frTarget = new THREE.Vector3(-0.95, 0.38, 1.15);
    let rlTarget = new THREE.Vector3(1.0, 0.38, -1.2);
    let rrTarget = new THREE.Vector3(-1.0, 0.38, -1.2);

    // Retrieve dynamically calculated offsets if available on the window object
    const globalMetaMap = (window as any).modelWheelMetadataMap;
    if (globalMetaMap) {
      for (const [url, meta] of globalMetaMap.entries()) {
        if (meta && meta.detected) {
          flTarget.copy(meta.fl);
          frTarget.copy(meta.fr);
          rlTarget.copy(meta.rl);
          rrTarget.copy(meta.rr);
          break; // Use the first matching/valid metadata
        }
      }
    }

    let flNode: THREE.Object3D | null = null;
    let frNode: THREE.Object3D | null = null;
    let rlNode: THREE.Object3D | null = null;
    let rrNode: THREE.Object3D | null = null;

    let minFlDist = Infinity;
    let minFrDist = Infinity;
    let minRlDist = Infinity;
    let minRrDist = Infinity;

    const localPos = new THREE.Vector3();

    candidates.forEach((node) => {
      node.updateWorldMatrix(true, true);
      node.getWorldPosition(localPos);
      modelRoot.worldToLocal(localPos);

      const isFront = localPos.z > 0;
      const isLeft = localPos.x > 0;

      if (isFront) {
        if (isLeft) {
          const dist = localPos.distanceTo(flTarget);
          if (dist < minFlDist) {
            minFlDist = dist;
            flNode = node;
          }
        } else {
          const dist = localPos.distanceTo(frTarget);
          if (dist < minFrDist) {
            minFrDist = dist;
            frNode = node;
          }
        }
      } else {
        if (isLeft) {
          const dist = localPos.distanceTo(rlTarget);
          if (dist < minRlDist) {
            minRlDist = dist;
            rlNode = node;
          }
        } else {
          const dist = localPos.distanceTo(rrTarget);
          if (dist < minRrDist) {
            minRrDist = dist;
            rrNode = node;
          }
        }
      }
    });

    this.frontLeft = this.setupAssembly(flNode, "frontLeft", modelRoot);
    this.frontRight = this.setupAssembly(frNode, "frontRight", modelRoot);
    this.rearLeft = this.setupAssembly(rlNode, "rearLeft", modelRoot);
    this.rearRight = this.setupAssembly(rrNode, "rearRight", modelRoot);
  }

  private setupAssembly(node: THREE.Object3D | null, name: string, modelRoot: THREE.Object3D): WheelAssembly | null {
    if (!node) return null;

    // Make sure matrices are completely fresh before capturing positions
    node.updateWorldMatrix(true, true);
    modelRoot.updateWorldMatrix(true, true);

    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();

    node.getWorldPosition(worldPos);
    node.getWorldQuaternion(worldQuat);
    node.getWorldScale(worldScale);

    // Transform position and quaternion to modelRoot coordinates
    const localPos = worldPos.clone();
    modelRoot.worldToLocal(localPos);

    const modelRootWorldQuat = new THREE.Quaternion();
    modelRoot.getWorldQuaternion(modelRootWorldQuat);
    const localQuat = modelRootWorldQuat.clone().invert().multiply(worldQuat);

    // Detach node from its current group safely
    if (node.parent) {
      node.parent.remove(node);
    }

    // Capture local properties
    const initialLocalPos = localPos.clone();
    const originalQuaternion = localQuat.clone();

    // Divide out model local scale to prevent scale squaring / distortion side-effects
    const localScale = new THREE.Vector3();
    const modelRootWorldScale = new THREE.Vector3();
    modelRoot.getWorldScale(modelRootWorldScale);
    localScale.set(
      worldScale.x / (modelRootWorldScale.x || 1.0),
      worldScale.y / (modelRootWorldScale.y || 1.0),
      worldScale.z / (modelRootWorldScale.z || 1.0)
    );
    const originalScale = localScale.clone();

    // Determine raw geometry bounds for determining correct spin axis
    const oldParent = node.parent;
    if (oldParent) {
      oldParent.remove(node);
    }

    const tempPos = node.position.clone();
    const tempRot = node.rotation.clone();
    const tempScale = node.scale.clone();

    node.position.set(0, 0, 0);
    node.rotation.set(0, 0, 0);
    node.scale.set(1, 1, 1);
    node.updateMatrix();
    node.updateMatrixWorld(true);

    const localBox = new THREE.Box3().setFromObject(node);

    node.position.copy(tempPos);
    node.rotation.copy(tempRot);
    node.scale.copy(tempScale);
    node.updateMatrix();
    node.updateMatrixWorld(true);

    if (oldParent) {
      oldParent.add(node);
    }

    const size = new THREE.Vector3();
    localBox.getSize(size);

    // Default spin axis matches wheel cylinder direction in local coordinates
    const localSpinAxis = new THREE.Vector3(1, 0, 0);
    const minDim = Math.min(size.x, size.y, size.z);
    if (minDim === size.y) {
      localSpinAxis.set(0, 1, 0);
    } else if (minDim === size.z) {
      localSpinAxis.set(0, 0, 1);
    }

    // Align local spin axis using original quaternions
    const spinAxis = localSpinAxis.clone().applyQuaternion(originalQuaternion).normalize();

    // Flip rotation direction for opposite side wheelspin synchrony
    const spinSign = spinAxis.x >= 0 ? 1 : -1;

    // Build the hierarchical assembly structure:
    // modelRoot (CarRoot)
    //  └── SteerPivot (Y rotation)
    //       └── SuspensionPivot (Y slide translation)
    //            └── Hub (spinning mesh joint)
    //                 └── Original Mesh

    const steerPivot = new THREE.Group();
    steerPivot.name = `${name}SteerPivot`;
    steerPivot.position.copy(initialLocalPos);
    modelRoot.add(steerPivot);

    const suspensionPivot = new THREE.Group();
    suspensionPivot.name = `${name}SuspensionPivot`;
    steerPivot.add(suspensionPivot);

    const hub = new THREE.Group();
    hub.name = `${name}Hub`;
    suspensionPivot.add(hub);

    // Place the mesh at local center inside Hub with preserved orientations and dimensions
    node.position.set(0, 0, 0);
    node.quaternion.copy(originalQuaternion);
    node.scale.copy(originalScale);
    hub.add(node);

    // Use the vertical height dimension of the unrotated tire for perfect ground contact
    const rollingDiameter = size.y > 0 ? size.y : Math.max(size.x, size.y, size.z);
    const wheelRadius = (rollingDiameter / 2) * (originalScale.y || 1.0);

    return {
      node,
      steerPivot,
      suspensionPivot,
      hub,
      initialLocalPos,
      originalQuaternion,
      originalScale,
      spinAxis,
      spinSign,
      wheelRadius
    };
  }

  public update(
    car: CarState,
    steerOffset: number,
    suspState: SuspensionState,
    elapsedSec: number
  ): void {
    const wheelRadius = 0.38;
    const maxTravelY = 0.10;
    const maxSteerAngle = 0.36;

    const speed = car.speed;
    let wheelRotationSpeed = Math.abs(speed);
    if (Math.abs(speed) < 1.0) {
      wheelRotationSpeed = 0.0;
    }

    const rotDelta = (wheelRotationSpeed * elapsedSec) / wheelRadius;
    this.wheelspinAngle += rotDelta * (speed >= 0 ? 1 : -1);
    this.wheelspinAngle %= Math.PI * 2;

    const updateAssembly = (
      assembly: WheelAssembly | null,
      compressionY: number,
      isFront: boolean
    ) => {
      if (!assembly) return;

      // 1. Suspension vertical translation only (applied strictly to suspensionPivot)
      const relativeTravelY = compressionY * maxTravelY;
      assembly.suspensionPivot.position.set(0, relativeTravelY, 0);

      // 2. Front wheel steering yaw (applied strictly to steerPivot)
      if (isFront) {
        const steerYaw = steerOffset * maxSteerAngle;
        this._qSteer.setFromAxisAngle(this._axisY, steerYaw);
        assembly.steerPivot.quaternion.copy(this._qSteer);
      } else {
        assembly.steerPivot.quaternion.copy(this._qZero);
      }

      // 3. Wheelspin rotation roll (applied strictly to hub)
      const rollAngle = this.wheelspinAngle * assembly.spinSign;
      assembly.hub.quaternion.setFromAxisAngle(assembly.spinAxis, rollAngle);
    };

    updateAssembly(this.frontLeft, suspState ? suspState.frontLeft : 0, true);
    updateAssembly(this.frontRight, suspState ? suspState.frontRight : 0, true);
    updateAssembly(this.rearLeft, suspState ? suspState.rearLeft : 0, false);
    updateAssembly(this.rearRight, suspState ? suspState.rearRight : 0, false);
  }
}
