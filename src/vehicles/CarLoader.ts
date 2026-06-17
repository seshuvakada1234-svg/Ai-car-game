import * as THREE from 'three';
import { getCarModelForId, gltfModelCache } from '../world/procedural';
import { WheelSystem } from './WheelSystem';

export interface LoadedCarAsset {
  model: THREE.Group;
  wheelSystem: WheelSystem;
  brakeLights: THREE.Material[];
  headlights: THREE.Mesh[];
  height: number;
}

export class CarLoader {
  /**
   * Clones and prepares a high-performance GLTF car model structure, setting up shadows,
   * materials, detecting wheels/lights, and creating the high-precision WheelSystem hierarchy.
   */
  public static loadAndPrepareCar(carId: string, carGroup: THREE.Group): LoadedCarAsset | null {
    if (!gltfModelCache.isLoaded) return null;

    const modelSource = getCarModelForId(carId);
    if (!modelSource) return null;

    // Clone the model once
    const clonedModel = modelSource.clone();
    clonedModel.name = 'gltf_car_model';
    clonedModel.updateMatrixWorld(true);

    // Ensure every mesh's geometry bounding box is computed from scratch
    clonedModel.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.geometry.computeBoundingBox();
      }
    });

    // Compute bounding box and center offsets to position the model correctly
    const box = new THREE.Box3().setFromObject(clonedModel);
    const size = box.getSize(new THREE.Vector3());
    const center = new THREE.Vector3();
    box.getCenter(center);

    // Place vehicle on ground: car.position.y = -box.min.y
    const finalY = -box.min.y;
    console.log("[CarLoader] Car ID:", carId, "height:", size.y, "box.min.y:", box.min.y, "final y:", finalY);

    clonedModel.userData.boundingBox = box;
    clonedModel.userData.height = size.y;
    clonedModel.userData.initialY = finalY;

    // Center the chassis
    clonedModel.position.x -= center.x;
    clonedModel.position.z -= center.z;
    clonedModel.position.y = finalY;

    // Collect wheels inside the model first
    const detectedWheels: THREE.Object3D[] = [];
    clonedModel.traverse((node) => {
      const nameLower = node.name.toLowerCase();
      const isMatch = nameLower.includes("wheel") || nameLower.includes("tire") || nameLower.includes("rim");
      if (isMatch) {
        let hasAncestorMatched = false;
        let parent = node.parent;
        while (parent) {
          if (detectedWheels.includes(parent)) {
            hasAncestorMatched = true;
            break;
          }
          parent = parent.parent;
        }
        if (!hasAncestorMatched) {
          detectedWheels.push(node);
        }
      }
    });

    // We must update the world matrix so global positions and local matrices are correct
    carGroup.add(clonedModel);
    clonedModel.updateMatrixWorld(true);

    // Setup the WheelSystem hierarchy (SteerPivot -> SuspensionPivot -> Hub -> WheelMesh)
    const wheelSystem = new WheelSystem(detectedWheels, clonedModel);

    const brakeLights: THREE.Material[] = [];
    const headlights: THREE.Mesh[] = [];

    // Setup shadows and material properties
    clonedModel.traverse((node) => {
      console.log("[GLTF Scene Traverse] Node Name:", node.name);
      if (node instanceof THREE.Mesh) {
        node.visible = true;
        node.frustumCulled = false;
        node.castShadow = (carId === 'player');
        node.receiveShadow = true;

        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((mat) => {
          if (!mat) return;
          if (mat.emissive && typeof mat.emissive.set === 'function') {
            mat.emissive.set(0x000000);
          }
          mat.emissiveIntensity = 0;
          mat.roughness = 0.5;
          mat.metalness = 0.8;

          // Identify brake lights material if we can
          const matName = mat.name.toLowerCase();
          if (matName.includes('brakelight') || matName.includes('taillight') || matName.includes('brake_light')) {
            brakeLights.push(mat);
          }
        });

        // Identify lights meshes
        const meshName = node.name.toLowerCase();
        if (meshName.includes('headlight')) {
          headlights.push(node);
        }
      }
    });

    return {
      model: clonedModel,
      wheelSystem,
      brakeLights,
      headlights,
      height: size.y
    };
  }
}
