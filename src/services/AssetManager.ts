/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StorageManager } from './StorageManager';
import { DownloadManager, DownloadProgress } from './DownloadManager';
import { AssetVerifier } from './AssetVerifier';

export interface AssetInfo {
  id: string;
  name: string;
  version: string;
  size: number;
  url: string;
  checksum: string;
  category: 'cars' | 'maps' | 'textures' | 'audio';
}

export class AssetManager {
  private static manifestList: AssetInfo[] = [];
  private static isInitialized = false;

  public static async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      const response = await fetch('/assets/manifest.json');
      if (response.ok) {
        const data = await response.json();
        this.manifestList = data.assets;
      } else {
        // Fallback hardcoded if manifest.json takes too long or fails
        this.manifestList = [
          {
            id: 'lamborghini_aventador',
            name: "Lamborghini Aventador SVJ (8.3 MB)",
            version: '1.0.0',
            size: 8703180,
            url: 'https://pub-a248afed72844944a7565dc9cbaacbb0.r2.dev/cars/lamborghini_aventador.glb',
            checksum: 'lambosvj',
            category: 'cars'
          },
          {
            id: 'ferrari_purosangue',
            name: "Ferrari Purosangue Line (6.1 MB)",
            version: '1.0.0',
            size: 6396000,
            url: 'https://pub-a248afed72844944a7565dc9cbaacbb0.r2.dev/cars/2023_ferrari_purosangue.glb',
            checksum: 'ferrari',
            category: 'cars'
          },
          {
            id: 'bugatti_chiron_top_edition',
            name: "Bugatti Chiron Super Sport (9.5 MB)",
            version: '1.0.0',
            size: 9961472,
            url: 'https://pub-a248afed72844944a7565dc9cbaacbb0.r2.dev/cars/bugatti_chiron_top_edition.glb',
            checksum: 'bugatti',
            category: 'cars'
          },
          {
            id: 'porsche_911_gt3',
            name: "Porsche 911 GT3 RS Touring (7.2 MB)",
            version: '1.0.0',
            size: 7549747,
            url: 'https://pub-a248afed72844944a7565dc9cbaacbb0.r2.dev/cars/porsche_911_gt3.glb',
            checksum: 'porsche',
            category: 'cars'
          },
          {
            id: 'dragon_mountain_map',
            name: "Dragon Mountain Apex Map (42.1 MB)",
            version: '1.0.0',
            size: 44145049,
            url: 'https://pub-a248afed72844944a7565dc9cbaacbb0.r2.dev/assets/maps/dragon_mountain.glb',
            checksum: 'dragon',
            category: 'maps'
          },
          {
            id: 'coastal_sunset_track',
            name: "Coastal Sunset Beach Track (15.4 MB)",
            version: '1.0.0',
            size: 16148070,
            url: 'https://pub-a248afed72844944a7565dc9cbaacbb0.r2.dev/assets/maps/coastal_sunset.glb',
            checksum: 'coastal',
            category: 'maps'
          },
          {
            id: 'environmental_textures',
            name: "High Dynamic Range Textures (12.0 MB)",
            version: '1.0.1',
            size: 12582912,
            url: 'https://pub-a248afed72844944a7565dc9cbaacbb0.r2.dev/assets/textures/env_hdr_sky.png',
            checksum: 'hdrenv',
            category: 'textures'
          },
          {
            id: 'engine_audio_sounds',
            name: "High Fidelity Engine Audio Loops (5.5 MB)",
            version: '1.0.0',
            size: 5767168,
            url: 'https://pub-a248afed72844944a7565dc9cbaacbb0.r2.dev/assets/audio/engine_loop.mp3',
            checksum: 'audioloop',
            category: 'audio'
          }
        ];
      }
      this.isInitialized = true;
    } catch (e) {
      console.warn('Failed to load asset manifest, utilizing high robust defaults: ', e);
      this.isInitialized = true;
    }
  }

  public static getAssets(): AssetInfo[] {
    return this.manifestList;
  }

  public static async isAssetReady(id: string): Promise<boolean> {
    const blob = await StorageManager.getAsset(id);
    if (!blob) return false;
    const info = this.manifestList.find(a => a.id === id);
    return await AssetVerifier.verifyBlob(blob, info?.size);
  }

  public static async getVerifiedBlob(id: string): Promise<Blob | null> {
    const blob = await StorageManager.getAsset(id);
    if (!blob) return null;
    const info = this.manifestList.find(a => a.id === id);
    const valid = await AssetVerifier.verifyBlob(blob, info?.size);
    return valid ? blob : null;
  }

  public static async downloadAsset(
    id: string,
    onProgress: (p: DownloadProgress) => void
  ): Promise<Blob> {
    await this.init();
    const info = this.manifestList.find(a => a.id === id);
    if (!info) {
      throw new Error(`Asset ID not found in manifest: ${id}`);
    }

    // Try storage retrieval first
    const existing = await StorageManager.getAsset(id);
    if (existing && await AssetVerifier.verifyBlob(existing, info.size)) {
      onProgress({
        id,
        name: info.name,
        bytesLoaded: existing.size,
        bytesTotal: existing.size,
        percentage: 100
      });
      return existing;
    }

    console.log(`AssetManager: Downloading asset ${info.name}...`);
    const blob = await DownloadManager.downloadWithProgress(id, info.name, info.url, onProgress);
    
    // Save to IndexedDB
    await StorageManager.saveAsset(id, blob);
    return blob;
  }
}
