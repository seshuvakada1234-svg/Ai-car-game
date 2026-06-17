import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export class GLTFMaterialsPBRSpecularGlossinessExtension {
  public name = 'KHR_materials_pbrSpecularGlossiness';
  public parser: any;

  constructor(parser: any) {
    this.parser = parser;
  }

  public getMaterialType(materialIndex: number) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) return null;
    return THREE.MeshStandardMaterial;
  }

  public extendMaterialParams(materialIndex: number, materialParams: any) {
    const parser = this.parser;
    const materialDef = parser.json.materials[materialIndex];
    if (!materialDef.extensions || !materialDef.extensions[this.name]) return Promise.resolve();

    const pending: Promise<any>[] = [];
    const extension = materialDef.extensions[this.name];

    materialParams.color = new THREE.Color(1.0, 1.0, 1.0);
    materialParams.opacity = 1.0;

    if (Array.isArray(extension.diffuseFactor)) {
      const f = extension.diffuseFactor;
      materialParams.color.fromArray(f);
      materialParams.opacity = f[3];
    }

    if (extension.diffuseTexture !== undefined) {
      pending.push(parser.assignTexture(materialParams, 'map', extension.diffuseTexture));
    }

    let glossiness = 1.0;
    if (extension.glossinessFactor !== undefined) {
      glossiness = extension.glossinessFactor;
    }
    materialParams.roughness = 1.0 - glossiness;
    materialParams.metalness = 0.0;

    if (extension.specularGlossinessTexture !== undefined) {
      pending.push(parser.assignTexture(materialParams, 'roughnessMap', extension.specularGlossinessTexture));
    }

    return Promise.all(pending);
  }
}

export class CarLoader {
  private static readonly R2_BUCKET_URL = 'https://pub-a248afed72844944a7565dc9cbaacbb0.r2.dev/cars/';
  
  public static readonly VEHICLE_URLS = {
    lamborghini_aventador: `${CarLoader.R2_BUCKET_URL}lamborghini_aventador.glb`,
    ferrari_purosangue: `${CarLoader.R2_BUCKET_URL}2023_ferrari_purosangue.glb`,
    bugatti_chiron: `${CarLoader.R2_BUCKET_URL}bugatti_chiron_top_edition.glb`,
    porsche_911: `${CarLoader.R2_BUCKET_URL}porsche_911_gt3.glb`
  };

  private static loader: GLTFLoader | null = null;

  /**
   * Returns a singleton GLTFLoader configured with DRACO decoders to handle compressed meshes
   */
  private static getLoader(): GLTFLoader {
    if (!this.loader) {
      const gltfLoader = new GLTFLoader();
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
      gltfLoader.setDRACOLoader(dracoLoader);
      
      // Register KHR_materials_pbrSpecularGlossiness support
      gltfLoader.register((parser) => new GLTFMaterialsPBRSpecularGlossinessExtension(parser));
      
      this.loader = gltfLoader;
    }
    return this.loader;
  }

  /**
   * Loads a vehicle model by its ID, applying stunning PBR reflections, shadows, and ACES tone mapping alignment
   */
  public static async loadVehicleModel(
    key: 'lamborghini_aventador' | 'ferrari_purosangue' | 'bugatti_chiron_top_edition' | 'porsche_911_gt3',
    envMap: THREE.Texture | null,
    onProgress?: (percent: number) => void
  ): Promise<THREE.Group> {
    const keyMap = {
      lamborghini_aventador: 'lamborghini_aventador',
      ferrari_purosangue: 'ferrari_purosangue',
      bugatti_chiron_top_edition: 'bugatti_chiron',
      porsche_911_gt3: 'porsche_911'
    } as const;

    const targetKey = keyMap[key];
    const url = this.VEHICLE_URLS[targetKey as keyof typeof this.VEHICLE_URLS];

    return new Promise((resolve, reject) => {
      const gltfLoader = this.getLoader();
      
      gltfLoader.load(
        url,
        (gltf) => {
          const model = gltf.scene;
          
          // Apply realistic scaling so models feel structurally uniform
          const tempBox = new THREE.Box3().setFromObject(model);
          const size = tempBox.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const targetScale = 4.6 / (maxDim || 1.0);
          model.scale.setScalar(targetScale);

          // Apply rich physically-based materials (PBR) and shadow capabilities
          model.traverse((node) => {
            if (node instanceof THREE.Mesh) {
              node.castShadow = true;
              node.receiveShadow = true;

              if (node.material && node.material instanceof THREE.MeshStandardMaterial) {
                // Ensure reflections look incredibly wet and shiny!
                if (envMap) {
                  node.material.envMap = envMap;
                  node.material.envMapIntensity = 3.5; // vibrant ambient bounce reflections
                }
                
                // Enhance clearcoat and metallic feel on paint materials
                const nameLower = node.name.toLowerCase();
                if (nameLower.includes('body') || nameLower.includes('carpaint') || nameLower.includes('paint')) {
                  node.material.metalness = 0.95;
                  node.material.roughness = 0.05;
                } else if (nameLower.includes('glass') || nameLower.includes('window')) {
                  node.material.roughness = 0.01;
                  node.material.metalness = 0.1;
                  node.material.transparent = true;
                  node.material.opacity = 0.45;
                } else if (nameLower.includes('carbon') || nameLower.includes('trim')) {
                  node.material.roughness = 0.5;
                  node.material.metalness = 0.2;
                }
              }
            }
          });

          // Compute exact bounding dimensions
          const finalBox = new THREE.Box3().setFromObject(model);
          const finalSize = finalBox.getSize(new THREE.Vector3());
          const center = finalBox.getCenter(new THREE.Vector3());

          model.userData.boundingBox = finalBox;
          model.userData.height = finalSize.y;

          // Align center point of model
          model.position.y -= finalBox.min.y;
          model.position.x -= center.x;
          model.position.z -= center.z;

          resolve(model);
        },
        (xhr) => {
          if (onProgress && xhr.total > 0) {
            const percent = Math.floor((xhr.loaded / xhr.total) * 100);
            onProgress(percent);
          }
        },
        (err) => {
          console.error(`Failed to load vehicle model matching key ${key}:`, err);
          reject(err);
        }
      );
    });
  }
}
export default CarLoader;
