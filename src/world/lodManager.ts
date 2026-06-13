import * as THREE from 'three';

export interface ScenerySector {
  name: string;
  center: THREE.Vector3;
  group: THREE.Object3D | null;
  nearDistance: number;  // Distance within which we run Full Detail
  farDistance: number;   // Distance beyond which we set visible = false
}

export class LODManager {
  private static instance: LODManager | null = null;
  private sectors: ScenerySector[] = [];

  private constructor() {}

  public static getInstance(): LODManager {
    if (!LODManager.instance) {
      LODManager.instance = new LODManager();
    }
    return LODManager.instance;
  }

  public clear(): void {
    this.sectors = [];
  }

  /**
   * Registers a scenery sector group with its central coordinate
   */
  public registerSector(
    name: string,
    centerX: number,
    centerY: number,
    centerZ: number,
    group: THREE.Object3D,
    nearDistance = 250,
    farDistance = 480
  ): void {
    this.sectors.push({
      name,
      center: new THREE.Vector3(centerX, centerY, centerZ),
      group,
      nearDistance,
      farDistance
    });
    console.log(`Registered Scenery LOD Sector: ${name} (far: ${farDistance}m)`);
  }

  /**
   * Evaluates player distance and updates visibility recursively
   */
  public update(playerPos: THREE.Vector3): void {
    for (const sector of this.sectors) {
      if (!sector.group) continue;

      const dist = playerPos.distanceTo(sector.center);

      if (dist > sector.farDistance) {
        // Unload entirely from frustum
        if (sector.group.visible) {
          sector.group.visible = false;
        }
      } else {
        // Load into frustum
        if (!sector.group.visible) {
          sector.group.visible = true;
        }

        // Apply progressive detail scaling (Level of Detail)
        if (dist > sector.nearDistance) {
          // Medium/Low LOD: hide fine accents like lanterns, posts, or minor details
          sector.group.traverse(child => {
            if (child.name && (child.name.includes('detail') || child.name.includes('bench') || child.name.includes('post') || child.name.includes('lantern') || child.name.includes('lamp_pole'))) {
              if (child.visible) child.visible = false;
            }
          });
        } else {
          // High LOD: enable every beautiful submesh detail
          sector.group.traverse(child => {
            if (child.name && (child.name.includes('detail') || child.name.includes('bench') || child.name.includes('post') || child.name.includes('lantern') || child.name.includes('lamp_pole'))) {
              if (!child.visible) child.visible = true;
            }
          });
        }
      }
    }
  }
}

export const lodManager = LODManager.getInstance();
