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
    // Sync 3D meshes of deleted/missing cars to prevent overlaps and floating double cars
    const activeCarIds = new Set(cars.map(c => c.id));
    this.carGroupMap.forEach((group, id) => {
      if (!activeCarIds.has(id)) {
        console.log(`Removing unregistered car representation from scene: ${id}`);
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
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else if (child.material) {
              child.material.dispose();
            }
          }
        });
      }
    });

    const needsHeadlights = timeOfDay === 'night' || weather === 'rain' || weather === 'foggy';

    cars.forEach((c) => {
      if (!c || !c.position) return;

      // Automatically spawn the vehicle representation if not present yet
      if (!this.carGroupMap.has(c.id)) {
        this.spawnVehicle(c);
      }

      const carGroup = this.carGroupMap.get(c.id);
      if (!carGroup) return;

      // Sync physical horizontal position and heading angle (yaw) to the visual group
      carGroup.position.x = c.position.x;
      carGroup.position.z = c.position.z;
      carGroup.rotation.y = c.angle;

      // Determine ground/road height at this coordinate position
      const getGroundHeight = (x: number, z: number): number => {
        try {
          const tempP = new THREE.Vector3(x, 0, z);
          const roadHeight = terrainManager.queryRoadHeight(tempP);
          if (roadHeight !== null) {
            return roadHeight;
          }
          return terrainManager.getHeight(x, z);
        } catch (e) {
          return c.position.y;
        }
      };

      const groundY = getGroundHeight(c.position.x, c.position.z);

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
        const suspState = CarAnimator.animateChassis(
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
          { assembly: gltfAsset.wheelSystem.frontLeft, key: 'fl', isFront: true },
          { assembly: gltfAsset.wheelSystem.frontRight, key: 'fr', isFront: true },
          { assembly: gltfAsset.wheelSystem.rearLeft, key: 'rl', isFront: false },
          { assembly: gltfAsset.wheelSystem.rearRight, key: 'rr', isFront: false }
        ];

        // 1. Calculate ground heights at each wheel (Raycasts)
        const scaleX = gltfAsset.model.scale.x * carGroup.scale.x;
        const scaleY = gltfAsset.model.scale.y * carGroup.scale.y;
        const scaleZ = gltfAsset.model.scale.z * carGroup.scale.z;

        let totalTargetBodyY = 0;
        let validWheelsCount = 0;

        // Cache the calculated values to avoid re-evaluating
        const wheelData = wheels.map((w) => {
          const assembly = w.assembly;
          if (!assembly) return null;

          // Locate uncompressed local wheel coordinates relative to the model
          const localX = assembly.initialLocalPos.x * scaleX;
          const localZ = assembly.initialLocalPos.z * scaleZ;

          // Yaw rotation transform to world horizontal coordinates
          const cosA = Math.cos(c.angle);
          const sinA = Math.sin(c.angle);
          const worldX = c.position.x + localX * cosA + localZ * sinA;
          const worldZ = c.position.z - localX * sinA + localZ * cosA;

          // Raycast ground detection under the wheel contact
          const wheelGroundY = getGroundHeight(worldX, worldZ);

          // Get suspension state/height offset from physical simulation
          let compression = 0;
          if (w.key === 'fl') compression = suspState.frontLeft;
          else if (w.key === 'fr') compression = suspState.frontRight;
          else if (w.key === 'rl') compression = suspState.rearLeft;
          else if (w.key === 'rr') compression = suspState.rearRight;

          // suspensionY = compression * maxTravel (standard max travel is 0.10)
          const suspensionHeight = compression * 0.10;

          // Target Body position at this wheel = contact height + suspension height + bodyOffset (0.15m)
          const targetBodyY = wheelGroundY + suspensionHeight + 0.15;
          totalTargetBodyY += targetBodyY;
          validWheelsCount++;

          return {
            assembly,
            wheelGroundY,
            suspensionHeight
          };
        });

        // 2. Position chassis and wheels exactly on road surface (Ground clearance 0.08m matching built-in model offset)
        let chassisWorldY = c.position.y;
        const roadHeightAtCenter = getGroundHeight(c.position.x, c.position.z);
        if (chassisWorldY < roadHeightAtCenter) {
          chassisWorldY = roadHeightAtCenter;
        }

        // Apply solved chassis height to the group and the state
        carGroup.position.y = chassisWorldY;
        c.position.y = chassisWorldY;

        // 4. Wheels touch the road surface: adjust each wheel's suspensionPivot position
        const chassisEuler = new THREE.Euler(carGroup.rotation.x, carGroup.rotation.y, carGroup.rotation.z, 'YXZ');

        wheelData.forEach((data) => {
          if (!data) return;
          const { assembly, wheelGroundY } = data;

          // Calculate rotated mount point world Y including body roll and pitch
          const offsetVec = assembly.initialLocalPos.clone();
          offsetVec.x *= scaleX;
          offsetVec.y *= scaleY;
          offsetVec.z *= scaleZ;
          offsetVec.applyEuler(chassisEuler);

          const mountPointWorldY = chassisWorldY + offsetVec.y;

          // Wheel center should be at wheelGroundY + worldRadius
          const worldRadius = assembly.wheelRadius * scaleY;
          const wheelCenterWorldY = wheelGroundY + worldRadius;

          // Calculate local displacement to force wheel ground contact
          let localDisplacementY = (wheelCenterWorldY - mountPointWorldY) / scaleY;

          // Add limit to suspend rotation / drop if the car goes airborne
          const localMaxTravel = 0.18;
          localDisplacementY = THREE.MathUtils.clamp(localDisplacementY, -localMaxTravel * 0.4, localMaxTravel * 1.5);

          // Update wheel assembly pivot
          assembly.suspensionPivot.position.set(0, localDisplacementY, 0);

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
        });

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
        const cosA = Math.cos(c.angle);
        const sinA = Math.sin(c.angle);

        // Raycast heights under the four virtual coordinates in horizontal plane
        const getFallbackGroundHeight = (lx: number, lz: number): number => {
          const wx = c.position.x + lx * cosA + lz * sinA;
          const wz = c.position.z - lx * sinA + lz * cosA;
          return getGroundHeight(wx, wz);
        };

        const flG = getFallbackGroundHeight(0.95, 1.15);
        const frG = getFallbackGroundHeight(-0.95, 1.15);
        const rlG = getFallbackGroundHeight(1.0, -1.2);
        const rrG = getFallbackGroundHeight(-1.0, -1.2);

        // Compute average wheel heights
        const avgG = (flG + frG + rlG + rrG) / 4;

        let targetY = avgG + 0.15; // 0.15m ground clearance

        // Anti-clipping constraint
        const centerGroundY = getGroundHeight(c.position.x, c.position.z);
        if (targetY - 0.15 < centerGroundY + 0.05) {
          targetY = centerGroundY + 0.05 + 0.15;
        }

        carGroup.position.y = targetY;
        c.position.y = targetY;

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
