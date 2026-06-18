import * as THREE from 'three';
import { CarState, ControlsState } from '../types';
import { createCarChassisGroup, gltfModelCache } from '../world/procedural';
import { CarLoader, LoadedCarAsset } from '../vehicles/CarLoader';
import { CarAnimator } from '../vehicles/CarAnimator';

// Body offset above wheel centres (metres).
// Keep at 0.02 while debugging; raise to 0.04-0.06 for final feel.
const BODY_OFFSET = 0.02;

// Reusable axis for yaw-only rotation (avoids allocation per wheel per frame)
const _yawAxis = new THREE.Vector3(0, 1, 0);

export class VehicleRenderer {
  private scene: THREE.Scene;
  private reflectionTex: THREE.Texture | null;

  public carGroupMap     = new Map<string, THREE.Group>();
  public carPivotsMap    = new Map<string, THREE.Group[]>();
  public carSpinnersMap  = new Map<string, THREE.Group[]>();
  public tailLightMatMap = new Map<string, THREE.MeshBasicMaterial>();
  public paintMatMap     = new Map<string, THREE.MeshStandardMaterial>();
  public gltfAssetMap    = new Map<string, LoadedCarAsset>();

  private _dummyControls: ControlsState = {
    forward: false, backward: false, left: false, right: false, nitro: false
  };

  private _scratchGroundVec = new THREE.Vector3();
  private _scratchOffsetVec = new THREE.Vector3();

  constructor(scene: THREE.Scene, reflectionTex: THREE.Texture | null) {
    this.scene         = scene;
    this.reflectionTex = reflectionTex;
  }

  private getGroundHeight(x: number, z: number, terrainManager: any, fallbackY: number): number {
    try {
      this._scratchGroundVec.set(x, 0, z);
      const rh = terrainManager.queryRoadHeight(this._scratchGroundVec);
      return rh !== null ? rh : terrainManager.getHeight(x, z);
    } catch {
      return fallbackY;
    }
  }

  public spawnVehicle(carState: CarState): void {
    if (this.carGroupMap.has(carState.id)) return;

    const carData = createCarChassisGroup(carState, this.reflectionTex || undefined, this.scene);
    this.carGroupMap.set(carState.id, carData.group);
    if (carData.pivots)       this.carPivotsMap.set(carState.id,    carData.pivots);
    if (carData.spinners)     this.carSpinnersMap.set(carState.id,  carData.spinners);
    if (carData.tailLightMat) this.tailLightMatMap.set(carState.id, carData.tailLightMat);
    if (carData.paintMat)     this.paintMatMap.set(carState.id,     carData.paintMat);

    if (carState.id === 'player') (window as any).playerCarAddedToScene = true;
  }

  public destroy(): void {
    this.carGroupMap.forEach((group) => this.scene.remove(group));
    this.carGroupMap.clear();
    this.carPivotsMap.clear();
    this.carSpinnersMap.clear();
    this.tailLightMatMap.clear();
    this.paintMatMap.clear();
    this.gltfAssetMap.clear();
  }

  public update(
    cars: CarState[],
    playerControls: ControlsState,
    elapsedSec: number,
    runningTime: number,
    terrainManager: any,
    weather: string,
    timeOfDay: string
  ): void {
    elapsedSec = Math.min(elapsedSec, 0.05);
    // Remove meshes for cars no longer active
    const activeCarIds = new Set(cars.map(c => c.id));
    this.carGroupMap.forEach((group, id) => {
      if (!activeCarIds.has(id)) {
        this.scene.remove(group);
        this.carGroupMap.delete(id);
        this.carPivotsMap.delete(id);
        this.carSpinnersMap.delete(id);
        this.tailLightMatMap.delete(id);
        this.paintMatMap.delete(id);
        this.gltfAssetMap.delete(id);
        group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            (Array.isArray(child.material) ? child.material : [child.material])
              .forEach(m => m?.dispose());
          }
        });
      }
    });

    const needsHeadlights = timeOfDay === 'night' || weather === 'rain' || weather === 'foggy';

    cars.forEach((c) => {
      if (!c || !c.position) return;

      if (!this.carGroupMap.has(c.id)) this.spawnVehicle(c);

      const carGroup = this.carGroupMap.get(c.id);
      if (!carGroup) return;

      carGroup.position.x = c.position.x;
      carGroup.position.z = c.position.z;
      carGroup.rotation.y = c.angle;

      const controls = c.id === 'player' ? playerControls : this._dummyControls;
      if (c.id !== 'player') {
        const steerOffsetVal = THREE.MathUtils.clamp(
          c.steerValue !== undefined ? c.steerValue : c.angularVelocity * 0.4, -0.36, 0.36
        );
        this._dummyControls.forward  = c.speed > 0;
        this._dummyControls.backward = c.speed < 0;
        this._dummyControls.left     = steerOffsetVal >  0.05;
        this._dummyControls.right    = steerOffsetVal < -0.05;
      }

      // Hot-swap to GLTF asset when available
      let gltfAsset       = this.gltfAssetMap.get(c.id);
      const isGltfInGroup = carGroup.getObjectByName('gltf_car_model');

      if (gltfModelCache.isLoaded && !gltfAsset && !isGltfInGroup) {
        const prepared = CarLoader.loadAndPrepareCar(c.id, carGroup);
        if (prepared) {
          this.gltfAssetMap.set(c.id, prepared);
          gltfAsset = prepared;

          carGroup.children.forEach((child) => {
            if (child instanceof THREE.Mesh && child.name !== 'gltf_car_model') {
              const hasCaliperColor =
                child.material && 'color' in child.material &&
                (child.material as any).color.getHexString() === 'e74c3c';
              if (!hasCaliperColor) child.visible = false;
            }
          });

          this.carPivotsMap.get(c.id)?.forEach(p  => { p.visible = false; });
          this.carSpinnersMap.get(c.id)?.forEach(s => { s.visible = false; });
        }
      }

      if (gltfAsset) {
        // ── GLTF path ──────────────────────────────────────────────────────────

        CarAnimator.animateChassis(
          c, carGroup, gltfAsset.wheelSystem, controls, elapsedSec, runningTime
        );

        const initialY = gltfAsset.model.userData.initialY ?? gltfAsset.model.position.y;
        gltfAsset.model.position.y = initialY;
        gltfAsset.model.updateMatrixWorld(true);

        const wheels = [
          { assembly: gltfAsset.wheelSystem.frontLeft,  isFront: true  },
          { assembly: gltfAsset.wheelSystem.frontRight, isFront: true  },
          { assembly: gltfAsset.wheelSystem.rearLeft,   isFront: false },
          { assembly: gltfAsset.wheelSystem.rearRight,  isFront: false },
        ];

        const scaleX = gltfAsset.model.scale.x * carGroup.scale.x;
        const scaleY = gltfAsset.model.scale.y * carGroup.scale.y;
        const scaleZ = gltfAsset.model.scale.z * carGroup.scale.z;

        // ── Gather per-wheel ground data ─────────────────────────────────────
        const wheelData = wheels.map((w) => {
          const assembly = w.assembly;
          if (!assembly) return null;

          const localX = assembly.initialLocalPos.x * scaleX;
          const localZ = assembly.initialLocalPos.z * scaleZ;

          const cosA = Math.cos(c.angle);
          const sinA = Math.sin(c.angle);
          const worldX = c.position.x + localX * cosA + localZ * sinA;
          const worldZ = c.position.z - localX * sinA + localZ * cosA;

          const wheelGroundY    = this.getGroundHeight(worldX, worldZ, terrainManager, c.position.y);
          const worldRadius     = assembly.wheelRadius * scaleY;
          const wheelCenterWorldY = wheelGroundY + worldRadius;
          const targetBodyY     = wheelCenterWorldY + BODY_OFFSET;

          return { assembly, wheelGroundY, worldRadius, wheelCenterWorldY, targetBodyY };
        });

        // Chassis Y = average wheel target heights
        const validData = wheelData.filter(Boolean) as NonNullable<typeof wheelData[number]>[];
        let chassisWorldY: number;
        if (validData.length > 0) {
          chassisWorldY = validData.reduce((sum, d) => sum + d.targetBodyY, 0) / validData.length;
        } else {
          chassisWorldY = this.getGroundHeight(c.position.x, c.position.z, terrainManager, c.position.y);
        }

        // Never let chassis sink below road centre
        const roadHeightAtCenter = this.getGroundHeight(c.position.x, c.position.z, terrainManager, c.position.y);
        if (chassisWorldY < roadHeightAtCenter) chassisWorldY = roadHeightAtCenter;

        // VehicleRenderer is the SOLE owner of carGroup.position.y
        carGroup.position.y = chassisWorldY;

        // ── Per-wheel: push suspensionPivot so tyre contacts ground ──────────
        // FIX: use yaw-only rotation for mount point Y.
        wheelData.forEach((data) => {
          if (!data) return;
          const { assembly, wheelCenterWorldY } = data;

          // Yaw-only offset of the steer-pivot from chassis centre
          const offsetVec = this._scratchOffsetVec.copy(assembly.initialLocalPos);
          offsetVec.x *= scaleX;
          offsetVec.y *= scaleY;
          offsetVec.z *= scaleZ;
          offsetVec.applyAxisAngle(_yawAxis, c.angle);

          const mountPointWorldY = chassisWorldY + offsetVec.y;

          // How far must the suspensionPivot travel (in local/unscaled space)
          // to push the tyre centre exactly to wheelCenterWorldY?
          let localDisplacementY = (wheelCenterWorldY - mountPointWorldY) / scaleY;
          const localMaxTravel   = 0.18;
          localDisplacementY = THREE.MathUtils.clamp(
            localDisplacementY, -localMaxTravel * 0.4, localMaxTravel * 1.5
          );

          // VehicleRenderer is the SOLE writer of suspensionPivot.position
          assembly.suspensionPivot.position.set(0, localDisplacementY, 0);
        });

        // Brake light emissions
        const isBraking = c.id === 'player'
          ? controls.backward
          : (c.speed < 18 && Math.random() > 0.4);
        gltfAsset.brakeLights.forEach((mat: any) => {
          mat.emissive.set(isBraking ? '#ff0000' : '#320001');
          mat.emissiveIntensity = isBraking ? 4.0 : 1.0;
        });

      } else {
        // ── Procedural fallback ────────────────────────────────────────────────

        const cosA = Math.cos(c.angle);
        const sinA = Math.sin(c.angle);

        const flG  = this.getGroundHeight(c.position.x + 0.95 * cosA + 1.15 * sinA, c.position.z - 0.95 * sinA + 1.15 * cosA, terrainManager, c.position.y);
        const frG  = this.getGroundHeight(c.position.x - 0.95 * cosA + 1.15 * sinA, c.position.z + 0.95 * sinA + 1.15 * cosA, terrainManager, c.position.y);
        const rlG  = this.getGroundHeight(c.position.x + 1.0 * cosA - 1.2 * sinA, c.position.z - 1.0 * sinA - 1.2 * cosA, terrainManager, c.position.y);
        const rrG  = this.getGroundHeight(c.position.x - 1.0 * cosA - 1.2 * sinA, c.position.z + 1.0 * sinA - 1.2 * cosA, terrainManager, c.position.y);
        const avgG = (flG + frG + rlG + rrG) / 4;

        let targetY = avgG + 0.15;
        const centerG = this.getGroundHeight(c.position.x, c.position.z, terrainManager, c.position.y);
        if (targetY - 0.15 < centerG + 0.05) targetY = centerG + 0.05 + 0.15;

        // VehicleRenderer is the SOLE writer of carGroup.position.y
        carGroup.position.y = targetY;

        const speedRatio = Math.min(1.0, Math.abs(c.speed) / 78);
        const rollTarget = -c.angularVelocity * 0.022 * speedRatio;
        carGroup.rotation.z = THREE.MathUtils.lerp(carGroup.rotation.z, rollTarget, 10 * elapsedSec);

        let pitchTarget = 0;
        if (c.id === 'player') {
          if      (controls.forward)  pitchTarget = -0.018 * speedRatio;
          else if (controls.backward) pitchTarget =  0.026 * speedRatio;
        } else {
          pitchTarget = -0.008 * speedRatio;
        }
        carGroup.rotation.x = THREE.MathUtils.lerp(carGroup.rotation.x, pitchTarget, 8 * elapsedSec);

        // Micro-vibration goes to rotation only, NOT position.y
        const suspensionVibe = Math.sin(runningTime * 45.0) * 0.006 * speedRatio;
        carGroup.rotation.x += suspensionVibe * 0.5;

        let wheelRotationSpeed = c.speed;
        if (c.id === 'player' && controls.forward && Math.abs(c.speed) < 15) {
          wheelRotationSpeed = 35;
        } else if (c.id !== 'player' && Math.abs(c.speed) < 10) {
          wheelRotationSpeed = 22;
        }
        const rotDelta = (wheelRotationSpeed * elapsedSec) / 0.38;

        this.carSpinnersMap.get(c.id)?.forEach(s => { s.rotation.x += rotDelta; });

        const pivots = this.carPivotsMap.get(c.id);
        if (pivots && pivots.length >= 2) {
          let steerOffset = 0;
          if (c.id === 'player') {
            const sv = c.steerValue !== undefined
              ? c.steerValue
              : (controls.left ? 1 : controls.right ? -1 : 0);
            steerOffset = sv * 0.36;
          } else {
            steerOffset = THREE.MathUtils.clamp(
              c.steerValue !== undefined ? c.steerValue : c.angularVelocity * 0.4, -0.36, 0.36
            );
          }
          pivots[0].rotation.y = THREE.MathUtils.lerp(pivots[0].rotation.y, steerOffset, 0.18);
          pivots[1].rotation.y = THREE.MathUtils.lerp(pivots[1].rotation.y, steerOffset, 0.18);
        }
      }

      // ── Headlights ──────────────────────────────────────────────────────────
      let headlightObj = carGroup.getObjectByName('car_headlight');
      if (needsHeadlights) {
        if (!headlightObj) {
          const hGroup = new THREE.Group();
          hGroup.name  = 'car_headlight';

          const spot = new THREE.SpotLight('#fffaed', 4.5, 45, Math.PI / 5, 0.4, 0.5);
          spot.position.set(0, 0.35, 1.2);
          spot.target.position.set(0, 0.1, 10.0);
          spot.distance   = 55;
          spot.castShadow = (c.id === 'player');
          hGroup.add(spot, spot.target);

          const bulbMat = new THREE.MeshBasicMaterial({ color: '#fffaed' });
          const bulbGeo = new THREE.SphereGeometry(0.18, 5, 5);
          const lB = new THREE.Mesh(bulbGeo, bulbMat); lB.position.set(-0.6, 0.35, 1.3);
          const rB = new THREE.Mesh(bulbGeo, bulbMat); rB.position.set( 0.6, 0.35, 1.3);
          hGroup.add(lB, rB);

          carGroup.add(hGroup);
        }
      } else {
        if (headlightObj) carGroup.remove(headlightObj);
      }

      // ── Procedural tail-lights ───────────────────────────────────────────────
      const isBrakingProc = c.id === 'player'
        ? controls.backward
        : (c.speed < 18 && Math.random() > 0.4);
      const tMat = this.tailLightMatMap.get(c.id);
      if (tMat) tMat.color.set(isBrakingProc ? '#ff111a' : '#770010');
    });
  }
}