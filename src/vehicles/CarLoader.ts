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
   * Clones and prepares a high-performance GLTF car model, setting up shadows,
   * materials, detecting wheels/lights, and creating the WheelSystem hierarchy.
   *
   * FIX: Bounding box is computed with wheel meshes hidden so that the chassis
   * height (finalY) is not inflated by wheel geometry sticking out below/above.
   */
  public static loadAndPrepareCar(carId: string, carGroup: THREE.Group): LoadedCarAsset | null {
    if (!gltfModelCache.isLoaded) return null;

    const modelSource = getCarModelForId(carId);
    if (!modelSource) return null;

    const clonedModel = modelSource.clone();
    clonedModel.name = 'gltf_car_model';
    clonedModel.updateMatrixWorld(true);

    clonedModel.traverse((node) => {
      if (node instanceof THREE.Mesh) node.geometry.computeBoundingBox();
    });

    // --- Collect wheel meshes so we can hide them when computing chassis bounds ---
    const wheelTerms     = ['wheel', 'tire', 'rim'];
    const forbiddenTerms = ['caliper', 'disc', 'brake', 'arch', 'housing'];
    const wheelMeshes: THREE.Object3D[] = [];

    clonedModel.traverse((node) => {
      const nl = node.name.toLowerCase();
      if (
        wheelTerms.some(t => nl.includes(t)) &&
        !forbiddenTerms.some(t => nl.includes(t))
      ) {
        wheelMeshes.push(node);
      }
    });

    // Hide wheels before measuring chassis height so the box reflects only
    // the body/chassis and is not pulled down by tyre geometry.
    wheelMeshes.forEach(w => { w.visible = false; });
    const box  = new THREE.Box3().setFromObject(clonedModel);
    const size = box.getSize(new THREE.Vector3());
    // Restore visibility immediately
    wheelMeshes.forEach(w => { w.visible = true; });

    const center = new THREE.Vector3();
    box.getCenter(center);

    // Place chassis so its bottom rests at Y=0
    const finalY = -box.min.y;

    console.log('[CarLoader]', {
      id: carId,
      boxMinY: box.min.y,
      boxMaxY: box.max.y,
      finalY,
      height: size.y,
    });

    clonedModel.userData.boundingBox = box;
    clonedModel.userData.height      = size.y;
    clonedModel.userData.initialY    = finalY;

    clonedModel.position.x -= center.x;
    clonedModel.position.z -= center.z;
    clonedModel.position.y  = finalY;

    // Collect wheel root nodes for WheelSystem (before attaching to scene)
    const detectedWheels: THREE.Object3D[] = [];
    clonedModel.traverse((node) => {
      const nl = node.name.toLowerCase();
      const isMatch = nl.includes('wheel') || nl.includes('tire') || nl.includes('rim');
      if (isMatch) {
        let hasAncestorMatched = false;
        let parent = node.parent;
        while (parent) {
          if (detectedWheels.includes(parent)) { hasAncestorMatched = true; break; }
          parent = parent.parent;
        }
        if (!hasAncestorMatched) detectedWheels.push(node);
      }
    });

    carGroup.add(clonedModel);
    clonedModel.updateMatrixWorld(true);

    const wheelSystem = new WheelSystem(detectedWheels, clonedModel);

    const brakeLights: THREE.Material[] = [];
    const headlights:  THREE.Mesh[]     = [];

    clonedModel.traverse((node) => {
      console.log('[GLTF Scene Traverse] Node Name:', node.name);
      if (node instanceof THREE.Mesh) {
        node.visible       = true;
        node.frustumCulled = false;
        node.castShadow    = (carId === 'player');
        node.receiveShadow = true;

        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((mat) => {
          if (!mat) return;
          if (mat.emissive && typeof mat.emissive.set === 'function') mat.emissive.set(0x000000);
          mat.emissiveIntensity = 0;
          mat.roughness  = 0.5;
          mat.metalness  = 0.8;

          const mn = mat.name.toLowerCase();
          if (mn.includes('brakelight') || mn.includes('taillight') || mn.includes('brake_light')) {
            brakeLights.push(mat);
          }
        });

        const meshName = node.name.toLowerCase();
        if (meshName.includes('headlight')) headlights.push(node);
      }
    });

    return { model: clonedModel, wheelSystem, brakeLights, headlights, height: size.y };
  }
}
