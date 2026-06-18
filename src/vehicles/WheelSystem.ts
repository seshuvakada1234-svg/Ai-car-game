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

  private _qSteer = new THREE.Quaternion();
  private _qZero  = new THREE.Quaternion().set(0, 0, 0, 1);
  private _axisY  = new THREE.Vector3(0, 1, 0);

  constructor(wheels: THREE.Object3D[], modelRoot: THREE.Object3D) {
    if (!wheels || wheels.length === 0) return;
    this.detectAndAssignWheels(wheels, modelRoot);
  }

  private detectAndAssignWheels(wheels: THREE.Object3D[], modelRoot: THREE.Object3D): void {
    const forbiddenTerms = [
      "car","body","chassis","suspension","brake","axle",
      "wheel_group","support","fender","caliper","disc",
      "hub","steering","arch","well","housing","pivot"
    ];
    const wheelTerms = ["wheel","rim","tire","pneu","col_w"];

    const candidates: THREE.Object3D[] = [];
    modelRoot.traverse((node) => {
      const nameLower = node.name.toLowerCase();
      const containsWheelTerm     = wheelTerms.some(t => nameLower.includes(t));
      const containsForbiddenTerm = forbiddenTerms.some(t => nameLower.includes(t));
      if (containsWheelTerm && !containsForbiddenTerm) {
        let current = node;
        while (current.parent && current.parent !== modelRoot) {
          const pName      = current.parent.name.toLowerCase();
          const pWheel     = wheelTerms.some(t => pName.includes(t));
          const pForbidden = forbiddenTerms.some(t => pName.includes(t));
          if (pWheel && !pForbidden) { current = current.parent; } else { break; }
        }
        if (!candidates.includes(current)) candidates.push(current);
      }
    });



    let flTarget = new THREE.Vector3( 0.95, 0.38,  1.15);
    let frTarget = new THREE.Vector3(-0.95, 0.38,  1.15);
    let rlTarget = new THREE.Vector3( 1.0,  0.38, -1.2);
    let rrTarget = new THREE.Vector3(-1.0,  0.38, -1.2);

    const globalMetaMap = (window as any).modelWheelMetadataMap;
    if (globalMetaMap) {
      for (const [, meta] of globalMetaMap.entries()) {
        if (meta && meta.detected) {
          flTarget.copy(meta.fl); frTarget.copy(meta.fr);
          rlTarget.copy(meta.rl); rrTarget.copy(meta.rr);
          break;
        }
      }
    }

    let flNode: THREE.Object3D | null = null, frNode: THREE.Object3D | null = null;
    let rlNode: THREE.Object3D | null = null, rrNode: THREE.Object3D | null = null;
    let minFlDist = Infinity, minFrDist = Infinity, minRlDist = Infinity, minRrDist = Infinity;

    const localPos = new THREE.Vector3();
    candidates.forEach((node) => {
      node.updateWorldMatrix(true, true);
      node.getWorldPosition(localPos);
      modelRoot.worldToLocal(localPos);
      const isFront = localPos.z > 0;
      const isLeft  = localPos.x > 0;
      if (isFront) {
        if (isLeft)  { const d = localPos.distanceTo(flTarget); if (d < minFlDist) { minFlDist = d; flNode = node; } }
        else         { const d = localPos.distanceTo(frTarget); if (d < minFrDist) { minFrDist = d; frNode = node; } }
      } else {
        if (isLeft)  { const d = localPos.distanceTo(rlTarget); if (d < minRlDist) { minRlDist = d; rlNode = node; } }
        else         { const d = localPos.distanceTo(rrTarget); if (d < minRrDist) { minRrDist = d; rrNode = node; } }
      }
    });



    this.frontLeft  = this.setupAssembly(flNode, 'frontLeft',  modelRoot);
    this.frontRight = this.setupAssembly(frNode, 'frontRight', modelRoot);
    this.rearLeft   = this.setupAssembly(rlNode, 'rearLeft',   modelRoot);
    this.rearRight  = this.setupAssembly(rrNode, 'rearRight',  modelRoot);


  }

  private setupAssembly(
    node: THREE.Object3D | null,
    name: string,
    modelRoot: THREE.Object3D
  ): WheelAssembly | null {
    if (!node) return null;

    node.updateWorldMatrix(true, true);
    modelRoot.updateWorldMatrix(true, true);

    const worldPos   = new THREE.Vector3();
    const worldQuat  = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    node.getWorldPosition(worldPos);
    node.getWorldQuaternion(worldQuat);
    node.getWorldScale(worldScale);

    const localPos = worldPos.clone();
    modelRoot.worldToLocal(localPos);

    const modelRootWorldQuat = new THREE.Quaternion();
    modelRoot.getWorldQuaternion(modelRootWorldQuat);
    const localQuat = modelRootWorldQuat.clone().invert().multiply(worldQuat);

    if (node.parent) node.parent.remove(node);

    const initialLocalPos    = localPos.clone();
    const originalQuaternion = localQuat.clone();

    const modelRootWorldScale = new THREE.Vector3();
    modelRoot.getWorldScale(modelRootWorldScale);
    const originalScale = new THREE.Vector3(
      worldScale.x / (modelRootWorldScale.x || 1),
      worldScale.y / (modelRootWorldScale.y || 1),
      worldScale.z / (modelRootWorldScale.z || 1)
    );

    // ── Measure ONLY visible tyre/rim meshes, ignoring helpers & brake parts ──
    const brakeTerms = [
      'caliper','disc','brake','rotor','drum','hub','helper',
      'pivot','dummy','empty','shadow','lod','collision'
    ];

    // Zero the node transform so bounds are in node-local space
    const savedPos   = node.position.clone();
    const savedRot   = node.rotation.clone();
    const savedScale = node.scale.clone();
    node.position.set(0, 0, 0);
    node.rotation.set(0, 0, 0);
    node.scale.set(1, 1, 1);
    node.updateMatrixWorld(true);

    const meshBox  = new THREE.Box3();
    const childBox = new THREE.Box3();
    let   meshBoxEmpty = true;

    node.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (!child.visible) return;
      if (!child.geometry) return;

      const cName = child.name.toLowerCase();
      if (brakeTerms.some(t => cName.includes(t))) return;

      // Skip suspiciously tiny geometry (brake discs, invisible helpers)
      const geo = child.geometry;
      if (geo.attributes.position && geo.attributes.position.count < 12) return;

      child.updateWorldMatrix(true, false);
      childBox.setFromObject(child);
      if (!childBox.isEmpty()) {
        meshBox.union(childBox);
        meshBoxEmpty = false;
      }
    });

    // Restore node transform
    node.position.copy(savedPos);
    node.rotation.copy(savedRot);
    node.scale.copy(savedScale);
    node.updateMatrixWorld(true);

    // Fallback: use full object bounds if no clean meshes were found
    if (meshBoxEmpty) {
      node.position.set(0, 0, 0);
      node.rotation.set(0, 0, 0);
      node.scale.set(1, 1, 1);
      node.updateMatrixWorld(true);
      meshBox.setFromObject(node);
      node.position.copy(savedPos);
      node.rotation.copy(savedRot);
      node.scale.copy(savedScale);
      node.updateMatrixWorld(true);
    }

    const size = new THREE.Vector3();
    meshBox.getSize(size);

    // Sort dims descending: [largest, middle, smallest(=axle width)]
    // Use the SECOND-LARGEST (middle) dimension as rolling diameter.
    // The largest can be the tyre width on wide-bodied models; the middle is
    // always the outer diameter cross-section.
    const dims = [size.x, size.y, size.z].sort((a, b) => b - a);
    const rollingDiameter = dims[1]; // second largest = tyre diameter
    const wheelRadius = THREE.MathUtils.clamp(rollingDiameter * 0.5, 0.28, 0.48);



    // Spin axis = direction of the smallest dimension (the axle)
    const localSpinAxis = new THREE.Vector3(1, 0, 0);
    const minDim = Math.min(size.x, size.y, size.z);
    if      (minDim === size.y) localSpinAxis.set(0, 1, 0);
    else if (minDim === size.z) localSpinAxis.set(0, 0, 1);

    const spinAxis = localSpinAxis.clone().applyQuaternion(originalQuaternion).normalize();
    const spinSign = spinAxis.x >= 0 ? 1 : -1;

    // Hierarchy: modelRoot → SteerPivot → SuspensionPivot → Hub → WheelMesh
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

    node.position.set(0, 0, 0);
    node.quaternion.copy(originalQuaternion);
    node.scale.copy(originalScale);
    hub.add(node);

    return {
      node, steerPivot, suspensionPivot, hub,
      initialLocalPos, originalQuaternion, originalScale,
      spinAxis, spinSign, wheelRadius
    };
  }

  /**
   * Updates steering yaw and wheel spin ONLY.
   *
   * OWNERSHIP CONTRACT — suspensionPivot.position is NOT touched here.
   * VehicleRenderer is the sole owner; it sets it once per frame after
   * querying ground height under each wheel.
   */
  public update(
    car: CarState,
    steerOffset: number,
    suspState: SuspensionState,
    elapsedSec: number
  ): void {
    const fallbackRadius = 0.38;
    const maxSteerAngle  = 0.36;

    const speed = car.speed;
    let wheelRotationSpeed = Math.abs(speed);
    if (Math.abs(speed) < 1.0) wheelRotationSpeed = 0.0;

    const rotDelta = (wheelRotationSpeed * elapsedSec) / fallbackRadius;
    this.wheelspinAngle += rotDelta * (speed >= 0 ? 1 : -1);
    this.wheelspinAngle %= Math.PI * 2;

    const updateAssembly = (assembly: WheelAssembly | null, isFront: boolean) => {
      if (!assembly) return;

      if (isFront) {
        this._qSteer.setFromAxisAngle(this._axisY, steerOffset * maxSteerAngle);
        assembly.steerPivot.quaternion.copy(this._qSteer);
      } else {
        assembly.steerPivot.quaternion.copy(this._qZero);
      }

      assembly.hub.quaternion.setFromAxisAngle(
        assembly.spinAxis,
        this.wheelspinAngle * assembly.spinSign
      );

      // suspensionPivot.position ← deliberately NOT written here.
    };

    updateAssembly(this.frontLeft,  true);
    updateAssembly(this.frontRight, true);
    updateAssembly(this.rearLeft,   false);
    updateAssembly(this.rearRight,  false);
  }
}