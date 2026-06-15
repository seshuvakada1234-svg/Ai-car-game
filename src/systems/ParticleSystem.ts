import * as THREE from 'three';
import { particleSystem } from '../world/particleSystem';

export class ParticleSystem {
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initialize();
  }

  public initialize(): void {
    particleSystem.initialize(this.scene);
  }

  /**
   * Refreshes particle simulation layers (tire smoke, red spark lines, engine exhaust).
   */
  public update(physicsService: any, elapsedSec: number): void {
    if (physicsService && typeof physicsService.updateParticles === 'function') {
      physicsService.updateParticles(elapsedSec);
    }
  }

  public destroy(): void {
    particleSystem.dispose();
  }
}
export default ParticleSystem;
