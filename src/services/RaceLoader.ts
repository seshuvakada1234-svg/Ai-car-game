/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { AssetManager } from './AssetManager';
import { ShaderPreloader } from './ShaderPreloader';
import { gltfModelCache } from '../world/procedural';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export interface RaceLoaderProgress {
  stage: string;
  percent: number;
}

export class RaceLoader {
  /**
   * Sequence that must fully complete before allowing race countdown to execute
   */
  public static async loadRaceEnvironment(
    selectedCarId: string,
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    onProgress: (prog: RaceLoaderProgress) => void
  ): Promise<void> {
    onProgress({ stage: 'Checking downloaded files...', percent: 10 });
    await AssetManager.init();

    // 1. Load chosen car. Wait fully until loaded from direct storage verified files
    onProgress({ stage: 'Loading selected high-end supercar model...', percent: 35 });
    
    const carMapKey = selectedCarId.includes('porsche') ? 'porsche_911_gt3' :
                      selectedCarId.includes('ferrari') ? 'ferrari_purosangue' :
                      selectedCarId.includes('bugatti') ? 'bugatti_chiron_top_edition' :
                      'lamborghini_aventador';

    const localBlob = await AssetManager.getVerifiedBlob(carMapKey);
    if (localBlob) {
      const buffer = await localBlob.arrayBuffer();
      const loader = new GLTFLoader();
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
      loader.setDRACOLoader(dracoLoader);

      await new Promise<void>((resolve, reject) => {
        loader.parse(buffer, '', (gltf) => {
          (gltfModelCache as any)[carMapKey] = gltf.scene;
          dracoLoader.dispose();
          resolve();
        }, (err) => {
          dracoLoader.dispose();
          reject(err);
        });
      });
    } else {
      console.warn(`RaceLoader: Car asset not stored locally, utilizing procedural geometry.`);
    }

    onProgress({ stage: 'Preparing track environment structures...', percent: 65 });
    await new Promise((resolve) => setTimeout(resolve, 300)); // Simulating map setup

    // 2. Pre-compile WebGL shaders to avoid compiler stalls
    onProgress({ stage: 'Warming graphics cards & compiling shaders...', percent: 85 });
    await ShaderPreloader.preloadShaders(renderer, scene, camera);

    onProgress({ stage: 'Calibrating active simulation frames...', percent: 100 });
  }
}
