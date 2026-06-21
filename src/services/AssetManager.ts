import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { StorageManager } from './StorageManager';
import { DownloadManager, DownloadProgress } from './DownloadManager';
import { AssetVerifier } from './AssetVerifier';

// 1. Conforming offline installation types and definitions
export interface AssetInfo {
  id: string;
  name: string;
  url: string;
  size: number;
  category: 'cars' | 'textures' | 'audio';
}

export class AssetManager {
  private static assets: AssetInfo[] = [
    {
      id: 'lamborghini_aventador',
      name: 'Lamborghini Aventador SVJ',
      url: 'https://pub-a248afed72844944a7565dc9cbaacbb0.r2.dev/cars/lamborghini_aventador.glb',
      size: 19083264,
      category: 'cars',
    },
    {
      id: 'ferrari_purosangue',
      name: 'Ferrari Purosangue SUV',
      url: 'https://pub-a248afed72844944a7565dc9cbaacbb0.r2.dev/cars/2023_ferrari_purosangue.glb',
      size: 16357785,
      category: 'cars',
    },
    {
      id: 'bugatti_chiron_top_edition',
      name: 'Bugatti Chiron Apex Edition',
      url: 'https://pub-a248afed72844944a7565dc9cbaacbb0.r2.dev/cars/bugatti_chiron_top_edition.glb',
      size: 22439526,
      category: 'cars',
    },
    {
      id: 'porsche_911_gt3',
      name: 'Porsche 911 GT3 RS',
      url: 'https://pub-a248afed72844944a7565dc9cbaacbb0.r2.dev/cars/porsche_911_gt3.glb',
      size: 17616076,
      category: 'cars',
    }
  ];

  public static async init(): Promise<void> {
    await StorageManager.init();
  }

  public static getAssets(): AssetInfo[] {
    return this.assets;
  }

  public static async isAssetReady(id: string): Promise<boolean> {
    const asset = this.assets.find((a) => a.id === id);
    if (!asset) return false;
    const blob = await StorageManager.getAsset(id);
    if (!blob) return false;
    return await AssetVerifier.verifyBlob(blob, asset.size);
  }

  public static async getVerifiedBlob(id: string): Promise<Blob | null> {
    const asset = this.assets.find((a) => a.id === id);
    const blob = await StorageManager.getAsset(id);
    if (!blob) return null;
    const ok = await AssetVerifier.verifyBlob(blob, asset?.size);
    return ok ? blob : null;
  }

  public static async downloadAsset(id: string, onProgress: (progress: DownloadProgress) => void): Promise<Blob> {
    const asset = this.assets.find((a) => a.id === id);
    if (!asset) throw new Error(`Asset ${id} not found configured`);
    const blob = await DownloadManager.downloadWithProgress(id, asset.name, asset.url, onProgress);
    await StorageManager.saveAsset(id, blob);
    return blob;
  }
}

// 2. High-performance Three.js caching module to prevent duplicate browser downloads
export class ThreeAssetLoader {
  private static instance: ThreeAssetLoader | null = null;
  private gltfCache = new Map<string, Promise<any>>();
  private textureCache = new Map<string, THREE.Texture>();
  private materialCache = new Map<string, THREE.Material>();
  private audioCache = new Map<string, any>();

  private gltfLoader: GLTFLoader;
  private dracoLoader: DRACOLoader | null = null;
  private textureLoader: THREE.TextureLoader;

  private constructor() {
    this.gltfLoader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();

    try {
      const draco = new DRACOLoader();
      draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
      this.gltfLoader.setDRACOLoader(draco);
      this.dracoLoader = draco;
    } catch (e) {
      console.warn('DRACOLoader initialization failed:', e);
    }
  }

  public static getInstance(): ThreeAssetLoader {
    if (!ThreeAssetLoader.instance) {
      ThreeAssetLoader.instance = new ThreeAssetLoader();
    }
    return ThreeAssetLoader.instance;
  }

  public async loadGLTF(url: string): Promise<any> {
    if (this.gltfCache.has(url)) {
      return this.gltfCache.get(url)!;
    }

    const promise = new Promise<any>((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => resolve(gltf),
        undefined,
        (err) => reject(err)
      );
    });

    this.gltfCache.set(url, promise);
    return promise;
  }

  public getTexture(url: string, colorSpace?: THREE.ColorSpace): THREE.Texture {
    if (this.textureCache.has(url)) {
      return this.textureCache.get(url)!;
    }

    const texture = this.textureLoader.load(url);
    if (colorSpace) {
      texture.colorSpace = colorSpace;
    }
    this.textureCache.set(url, texture);
    return texture;
  }

  public getMaterial(key: string, creator: () => THREE.Material): THREE.Material {
    if (this.materialCache.has(key)) {
      return this.materialCache.get(key)!;
    }
    const mat = creator();
    this.materialCache.set(key, mat);
    return mat;
  }

  public getAudio(url: string): any {
    if (this.audioCache.has(url)) {
      return this.audioCache.get(url)!;
    }
    const audio = new Audio(url);
    this.audioCache.set(url, audio);
    return audio;
  }
}

export const assetManager = ThreeAssetLoader.getInstance();
