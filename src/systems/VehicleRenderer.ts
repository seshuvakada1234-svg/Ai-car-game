import * as THREE from 'three';
import { CarState, ControlsState } from '../types';
import { createCarChassisGroup, gltfModelCache } from '../world/procedural';
import { CarLoader, LoadedCarAsset } from '../vehicles/CarLoader';
import { CarAnimator } from '../vehicles/CarAnimator';

export class VehicleRenderer {
  private scene: THREE.Scene;
  private reflectionTex: THREE.Texture | null;

  // Track rendering assets with zero scene.traverse or carGroup.traverse in the ticking loop
  public carGroupMap = new Map<string, THREE.Group>();
  public carPivotsMap = new Map<string, THREE.Group[]>();
  public carSpinnersMap = new Map<string, THREE.Group[]>();
  public tailLightMatMap = new Map<string, THREE.MeshBasicMaterial>();
  public paintMatMap = new Map<string, THREE.MeshStandardMaterial>();

  // Cached GLTF model details
  public gltfAssetMap = new Map<string, LoadedCarAsset>();

  // Temporary reusable variables to achieve zero allocations during update()
  private _dummyControls: ControlsState = { forward: false, backward: false, left: false, right: false, nitro: false };

  constructor(scene: THREE.Scene, reflectionTex: THREE.Texture | null) {
    this.scene = scene;
    this.reflectionTex = reflectionTex;
  }

  /**
   * Initializes and spawns the procedural fallback structure for a given vehicle state.
   */
  public spawnVehicle(carState: CarState): void {
    if (this.carGroupMap.has(carState.id)) return;

    const carData = createCarChassisGroup(carState, this.reflectionTex || undefined, this.scene);
    this.carGroupMap.set(carState.id, carData.group);
    
    if (carData.pivots) this.carPivotsMap.set(carState.id, carData.pivots);
    if (carData.spinners) this.carSpinnersMap.set(carState.id, carData.spinners);
    if (carData.tailLightMat) this.tailLightMatMap.set(carState.id, carData.tailLightMat);
    if (carData.paintMat) this.paintMatMap.set(carState.id, carData.paintMat);

    if (carState.id === 'player') {
      (window as any).playerCarAddedToScene = true;
    }
  }

  /**
   * Cleans up all vehicle meshes and resources from the scene.
   */
  public destroy(): void {
    this.carGroupMap.forEach((group) => {
      this.scene.remove(group);
    });
    this.carGroupMap.clear();
    this.carPivotsMap.clear();
    this.carSpinnersMap.clear();
    this.tailLightMatMap.clear();
    this.paintMatMap.clear();
    this.gltfAssetMap.clear();
  }

  /**
   * Orchestrates complete movement, physics alignments, suspension updates,
   * light switching, and animations for active vehicles in real-time.
   */
  public update(
    cars: CarState[],
    playerControls: ControlsState,
    elapsedSec: number,
    runningTime: number,
    terrainManager: any,
    weather: string,
    timeOfDay: string
  ): void {
    const needsHeadlights = timeOfDay === 'night' || weather === 'rain' || weather === 'foggy';

    cars.forEach((c) => {
      if (!c || !c.position) return;

      // Automatically spawn the vehicle representation if not present yet
      if (!this.carGroupMap.has(c.id)) {
        this.spawnVehicle(c);
      }

      const carGroup = this.carGroupMap.get(c.id);
      if (!carGroup) return;

      // Determine ground/road height at this coordinate position
      let groundY = 0;
      try {
        const roadHeight = terrainManager.queryRoadHeight(c.position);
        if (roadHeight !== null) {
          groundY = roadHeight;
        } else {
          groundY = terrainManager.getHeight(c.position.x, c.position.z);
        }
      } catch (e) {
        groundY = c.position.y;
      }

      // Update basic 3D placement (using c.position.y as initial reference)
      carGroup.position.set(c.position.x, c.position.y, c.position.z);

      // Sync facing yaw angle heading
      carGroup.rotation.set(0, c.angle, 0);

      const controls = c.id === 'player' ? playerControls : this._dummyControls;
      if (c.id !== 'player') {
        const steerOffsetVal = THREE.MathUtils.clamp((c.steerValue !== undefined ? c.steerValue : c.angularVelocity * 0.4), -0.36, 0.36);
        this._dummyControls.forward = c.speed > 0;
        this._dummyControls.backward = c.speed < 0;
        this._dummyControls.left = steerOffsetVal > 0.05;
        this._dummyControls.right = steerOffsetVal < -0.05;
      }

      // Check if we can upgrade and hot-swap to the gorgeous loaded GLTF asset
      let gltfAsset = this.gltfAssetMap.get(c.id);
      const isGltfInGroup = carGroup.getObjectByName('gltf_car_model');

      if (gltfModelCache.isLoaded && !gltfAsset && !isGltfInGroup) {
        const prepared = CarLoader.loadAndPrepareCar(c.id, carGroup);
        if (prepared) {
          this.gltfAssetMap.set(c.id, prepared);
          gltfAsset = prepared;

          // Hide procedural backup geometry to prevent overlaps
          carGroup.children.forEach((child) => {
            if (child instanceof THREE.Mesh && child.name !== 'gltf_car_model') {
              const hasCaliperColor = child.material && 'color' in child.material && (child.material as any).color.getHexString() === 'e74c3c';
              if (!hasCaliperColor) child.visible = false;
            }
          });

          // Disable procedural fallback wheels
          const proceduralPivots = this.carPivotsMap.get(c.id);
          if (proceduralPivots) {
            proceduralPivots.forEach(p => { p.visible = false; });
          }
          const proceduralSpinners = this.carSpinnersMap.get(c.id);
          if (proceduralSpinners) {
            proceduralSpinners.forEach(s => { s.visible = false; });
          }
        }
      }

      if (gltfAsset) {
        // Animate high-precision chassis & decoupled wheels using modern zero allocation structures
        CarAnimator.animateChassis(
          c,
          carGroup,
          gltfAsset.wheelSystem,
          controls,
          elapsedSec,
          runningTime
        );

        // Reset visual model Y to its baseline before calculating gap
        const initialY = gltfAsset.model.userData.initialY !== undefined ? gltfAsset.model.userData.initialY : gltfAsset.model.position.y;
        gltfAsset.model.position.y = initialY;
        gltfAsset.model.updateMatrixWorld(true);

        const wheels = [
          gltfAsset.wheelSystem.frontLeft,
          gltfAsset.wheelSystem.frontRight,
          gltfAsset.wheelSystem.rearLeft,
          gltfAsset.wheelSystem.rearRight
        ];

        let lowestWheelY = Infinity;
        let validWheelsCount = 0;

        wheels.forEach((assembly) => {
          if (assembly && assembly.node) {
            assembly.node.updateWorldMatrix(true, false);
            const wheelCenter = new THREE.Vector3();
            assembly.node.getWorldPosition(wheelCenter);

            // Subtract the dynamically calculated wheelRadius adjusted by model and group scale
            const worldRadius = assembly.wheelRadius * gltfAsset.model.scale.y * carGroup.scale.y;
            const bottomY = wheelCenter.y - worldRadius;

            if (bottomY < lowestWheelY) {
              lowestWheelY = bottomY;
            }
            validWheelsCount++;

            // Draw visual helpers on wheel centers as requested by user
            let sphereHelper = assembly.suspensionPivot.getObjectByName('debug_sphere') as THREE.Mesh;
            let lineHelper = assembly.suspensionPivot.getObjectByName('debug_line') as THREE.Line;

            if (!sphereHelper) {
              const geom = new THREE.SphereGeometry(0.04, 8, 8);
              const mat = new THREE.MeshBasicMaterial({ color: 0x39ff14, depthTest: false, transparent: true, opacity: 0.8 });
              sphereHelper = new THREE.Mesh(geom, mat);
              sphereHelper.name = 'debug_sphere';
              assembly.suspensionPivot.add(sphereHelper);
            }
            if (!lineHelper) {
              const linePoints = [
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, -assembly.wheelRadius, 0)
              ];
              const geom = new THREE.BufferGeometry().setFromPoints(linePoints);
              const mat = new THREE.LineBasicMaterial({ color: 0xff0055, depthTest: false, transparent: true, opacity: 0.8 });
              lineHelper = new THREE.Line(geom, mat);
              lineHelper.name = 'debug_line';
              assembly.suspensionPivot.add(lineHelper);
            }
          }
        });

        // Set visual offset on model, keeping physics group matched to actual simulator state
        carGroup.position.y = c.position.y;
        if (validWheelsCount > 0 && lowestWheelY !== Infinity) {
          const gap = lowestWheelY - groundY;
          gltfAsset.model.position.y = initialY - gap;
        }

        // Control brake light emissions on GLTF material
        const isBraking = c.id === 'player' ? controls.backward : (c.speed < 18 && Math.random() > 0.4);
        gltfAsset.brakeLights.forEach((mat: any) => {
          if (isBraking) {
            mat.emissive.set('#ff0000');
            mat.emissiveIntensity = 4.0;
          } else {
            mat.emissive.set('#320001');
            mat.emissiveIntensity = 1.0;
          }
        });
      } else {
        // Fallback procedural animations
        carGroup.position.y = groundY;

        const speedRatio = Math.min(1.0, Math.abs(c.speed) / 78);
        const rollTarget = -c.angularVelocity * 0.022 * speedRatio;
        carGroup.rotation.z = THREE.MathUtils.lerp(carGroup.rotation.z, rollTarget, 10 * elapsedSec);

        let pitchTarget = 0;
        if (c.id === 'player') {
          if (controls.forward) {
            pitchTarget = -0.018 * speedRatio;
          } else if (controls.backward) {
            pitchTarget = 0.026 * speedRatio;
          }
        } else {
          pitchTarget = -0.008 * speedRatio;
        }
        carGroup.rotation.x = THREE.MathUtils.lerp(carGroup.rotation.x, pitchTarget, 8 * elapsedSec);

        const suspensionVibe = Math.sin(runningTime * 45.0) * 0.006 * speedRatio;
        carGroup.position.y += suspensionVibe;
        c.position.y = carGroup.position.y;

        let wheelRotationSpeed = c.speed;
        if (c.id === 'player') {
          if (controls.forward && Math.abs(c.speed) < 15) {
            wheelRotationSpeed = 35; // simulate hard launch wheelspin burnout!
          }
        } else {
          if (Math.abs(c.speed) < 10) {
            wheelRotationSpeed = 22;
          }
        }
        const rotDelta = (wheelRotationSpeed * elapsedSec) / 0.38;

        const spinners = this.carSpinnersMap.get(c.id);
        if (spinners) {
          spinners.forEach((s) => { s.rotation.x += rotDelta; });
        }

        const pivots = this.carPivotsMap.get(c.id);
        if (pivots && pivots.length >= 2) {
          let steerOffset = 0;
          if (c.id === 'player') {
            const steerVal = c.steerValue !== undefined ? c.steerValue : (controls.left ? 1 : (controls.right ? -1 : 0));
            steerOffset = steerVal * 0.36;
          } else {
            steerOffset = THREE.MathUtils.clamp((c.steerValue !== undefined ? c.steerValue : c.angularVelocity * 0.4), -0.36, 0.36);
          }
          pivots[0].rotation.y = THREE.MathUtils.lerp(pivots[0].rotation.y, steerOffset, 0.18);
          pivots[1].rotation.y = THREE.MathUtils.lerp(pivots[1].rotation.y, steerOffset, 0.18);
        }
      }

      // Dynamic headlights toggle
      let headlightObj = carGroup.getObjectByName('car_headlight');
      if (needsHeadlights) {
        if (!headlightObj) {
          const hGroup = new THREE.Group();
          hGroup.name = 'car_headlight';

          const spot = new THREE.SpotLight('#fffaed', 4.5, 45, Math.PI / 5, 0.4, 0.5);
          spot.position.set(0, 0.35, 1.2);
          spot.target.position.set(0, 0.1, 10.0);
          spot.distance = 55;
          spot.castShadow = (c.id === 'player');

          hGroup.add(spot);
          hGroup.add(spot.target);

          const bulbMat = new THREE.MeshBasicMaterial({ color: '#fffaed' });
          const bulbGeo = new THREE.SphereGeometry(0.18, 5, 5);

          const leftBulb = new THREE.Mesh(bulbGeo, bulbMat);
          leftBulb.position.set(-0.6, 0.35, 1.3);
          const rightBulb = new THREE.Mesh(bulbGeo, bulbMat);
          rightBulb.position.set(0.6, 0.35, 1.3);
          hGroup.add(leftBulb, rightBulb);

          carGroup.add(hGroup);
        }
      } else {
        if (headlightObj) {
          carGroup.remove(headlightObj);
        }
      }

      // Procedural fallback brake lights color synchronization
      const isBraking = c.id === 'player' ? controls.backward : (c.speed < 18 && Math.random() > 0.4);
      const tMat = this.tailLightMatMap.get(c.id);
      if (tMat) {
        tMat.color.set(isBraking ? '#ff111a' : '#770010');
      }
    });
  }
}
