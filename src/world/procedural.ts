import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CarState } from '../types';

// Shared cache for loaded GLTF models to prevent repeated network requests
export const gltfModelCache = {
  playerModel: null as THREE.Group | null,
  aiModel: null as THREE.Group | null,
  treeModel: null as THREE.Group | null,
  rockModel: null as THREE.Group | null,
  mountainModel: null as THREE.Group | null,
  pagodaModel: null as THREE.Group | null,
  isLoaded: false
};

export interface ProceduralCarData {
  group: THREE.Group;
  pivots: THREE.Group[];
  spinners: THREE.Group[];
  tailLightMat: THREE.MeshBasicMaterial;
  paintMat: THREE.MeshStandardMaterial;
}

// Spawns procedural luxury supercar bodies, fallback for loading Supercars GLTFs
export function buildProceduralCar(c: CarState, reflectionTex: THREE.Texture, scene: THREE.Scene): ProceduralCarData {
  const mainCarGroup = new THREE.Group();
  mainCarGroup.castShadow = true;
  scene.add(mainCarGroup);

  // Extreme high-gloss metallic paint with sunset reflection map properties!
  const paint = new THREE.MeshStandardMaterial({
    color: c.color,
    roughness: 0.08,
    metalness: 0.92, 
    envMap: reflectionTex,
    envMapIntensity: 2.5,
  });

  const carbonMat = new THREE.MeshStandardMaterial({ color: '#131518', roughness: 0.44, metalness: 0.72 });

  // Chassis base platform
  const baseGeo = new THREE.BoxGeometry(1.82, 0.22, 4.1);
  const base = new THREE.Mesh(baseGeo, carbonMat);
  base.position.y = 0.22;
  base.castShadow = true;
  base.receiveShadow = true;
  mainCarGroup.add(base);

  // Sleek low sloped cowl (Sports wedge aerodynamic hood)
  const cowlGeo = new THREE.CylinderGeometry(0.68, 0.88, 1.6, 12, 2);
  cowlGeo.rotateX(Math.PI / 2);
  const cowl = new THREE.Mesh(cowlGeo, paint);
  cowl.position.set(0, 0.36, 1.2);
  cowl.scale.set(1.1, 0.42, 1.05); // carve and level low for a supercar hood profile
  cowl.castShadow = true;
  mainCarGroup.add(cowl);

  // Front splitter bumper spoiler extension
  const splitterGeo = new THREE.BoxGeometry(1.86, 0.08, 0.45);
  const splitter = new THREE.Mesh(splitterGeo, carbonMat);
  splitter.position.set(0, 0.15, 2.05);
  splitter.castShadow = true;
  mainCarGroup.add(splitter);

  // Greenhouse Cabin cockpit glass canopy (Teardrop Sphere bubble instead of standard box block)
  const cabGeo = new THREE.SphereGeometry(0.72, 16, 12);
  cabGeo.scale(0.86, 0.62, 1.45); // stretch into aerodynamic canopy teardrop shape
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#08090f',
    metalness: 0.96,
    roughness: 0.01,
    transparent: true,
    opacity: 0.8,
    envMap: reflectionTex,
    envMapIntensity: 2.8,
  });
  const cabin = new THREE.Mesh(cabGeo, glassMat);
  cabin.position.set(0, 0.54, -0.2); // lowered for race-spec sleek cockpit lines
  cabin.castShadow = true;
  mainCarGroup.add(cabin);

  // Side view mirrors
  const mirrorArmGeo = new THREE.BoxGeometry(0.24, 0.06, 0.06);
  const mirrorHeadGeo = new THREE.BoxGeometry(0.28, 0.14, 0.14);
  const mirrorGlassGeo = new THREE.PlaneGeometry(0.24, 0.11);
  mirrorGlassGeo.rotateY(Math.PI / 2);
  const silverMirrorMat = new THREE.MeshStandardMaterial({ color: '#dfdfdf', metalness: 0.94, roughness: 0.05 });

  // Left mirror
  const mL = new THREE.Group();
  mL.position.set(0.92, 0.54, 0.35);
  const armL = new THREE.Mesh(mirrorArmGeo, paint);
  armL.position.x = 0.11;
  const headL = new THREE.Mesh(mirrorHeadGeo, paint);
  headL.position.x = 0.24;
  const glassL = new THREE.Mesh(mirrorGlassGeo, silverMirrorMat);
  glassL.position.set(0.24 + 0.075, 0, 0);
  mL.add(armL, headL, glassL);
  mainCarGroup.add(mL);

  // Right mirror
  const mR = new THREE.Group();
  mR.position.set(-0.92, 0.54, 0.35);
  const armR = new THREE.Mesh(mirrorArmGeo, paint);
  armR.position.x = -0.11;
  const headR = new THREE.Mesh(mirrorHeadGeo, paint);
  headR.position.x = -0.24;
  const glassR = new THREE.Mesh(mirrorGlassGeo, silverMirrorMat);
  glassR.position.set(-0.24 - 0.075, 0, 0);
  mR.add(armR, headR, glassR);
  mainCarGroup.add(mR);

  // Carbon fiber aerodynamic intake side loops (Sleek tubular design)
  const scoopGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.76, 12, 1);
  scoopGeo.rotateX(Math.PI / 2);
  const scoopLeft = new THREE.Mesh(scoopGeo, carbonMat);
  scoopLeft.position.set(0.88, 0.34, -0.6);
  scoopLeft.rotation.y = 0.14;
  scoopLeft.castShadow = true;
  mainCarGroup.add(scoopLeft);
  const scoopRight = scoopLeft.clone();
  scoopRight.position.x = -0.88;
  scoopRight.rotation.y = -0.14;
  mainCarGroup.add(scoopRight);

  // Aggressive heavy rear wing spoiler with endplates
  const wingGeo = new THREE.BoxGeometry(2.12, 0.06, 0.52);
  const wing = new THREE.Mesh(wingGeo, carbonMat);
  wing.position.set(0, 0.88, -1.86);
  wing.castShadow = true;
  mainCarGroup.add(wing);

  const wingPostGeo = new THREE.BoxGeometry(0.08, 0.44, 0.12);
  const lp = new THREE.Mesh(wingPostGeo, carbonMat);
  lp.position.set(0.58, 0.54, -1.86);
  lp.rotation.x = -0.15;
  mainCarGroup.add(lp);
  const rp = lp.clone();
  rp.position.x = -0.58;
  mainCarGroup.add(rp);

  const endplateGeo = new THREE.BoxGeometry(0.04, 0.34, 0.56);
  const el = new THREE.Mesh(endplateGeo, paint);
  el.position.set(1.06, 0.88, -1.86);
  el.castShadow = true;
  mainCarGroup.add(el);
  const er = el.clone();
  er.position.x = -1.06;
  mainCarGroup.add(er);

  // Sleek Xenon Ice-blue elongated LED strip headlights
  const hlLeftGeo = new THREE.BoxGeometry(0.34, 0.05, 0.18);
  const hlMat = new THREE.MeshBasicMaterial({ color: '#b3f0ff' }); 
  const headlightL = new THREE.Mesh(hlLeftGeo, hlMat);
  headlightL.position.set(0.68, 0.32, 2.02);
  headlightL.rotation.y = -0.22;
  mainCarGroup.add(headlightL);
  const headlightR = headlightL.clone();
  headlightR.position.x = -0.68;
  headlightR.rotation.y = 0.22;
  mainCarGroup.add(headlightR);

  // Real Front spotlight projection from player headlight body
  if (c.id === 'player') {
    const spotLight = new THREE.SpotLight('#ffffff', 4.8, 52, Math.PI / 5, 0.35, 0.82);
    spotLight.position.set(0, 0.42, 1.9);
    spotLight.target.position.set(0, 0.1, 16);
    mainCarGroup.add(spotLight);
    mainCarGroup.add(spotLight.target);
  }

  // Continuous ruby red laser tail light bar across the entire tail Diffuser (starts dim ruby, shines hot red when braking)
  const tlBarGeo = new THREE.BoxGeometry(1.68, 0.04, 0.08);
  const tlMat = new THREE.MeshBasicMaterial({ color: '#770010' }); 
  const taillightBar = new THREE.Mesh(tlBarGeo, tlMat);
  taillightBar.position.set(0, 0.42, -2.04);
  mainCarGroup.add(taillightBar);

  // Dual exhaust burners with interactive flaring Nitro cylinder flames
  const exGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.35, 8);
  exGeo.rotateX(Math.PI / 2);
  const exMat = new THREE.MeshStandardMaterial({ color: '#333333', metalness: 0.9, roughness: 0.2 });
  
  const fireGeo = new THREE.ConeGeometry(0.12, 0.6, 8);
  fireGeo.rotateX(-Math.PI / 2);
  fireGeo.translate(0, 0, -0.3); // extend flame backwards
  const fireMat = new THREE.MeshBasicMaterial({ color: '#00ffff', transparent: true, opacity: 0 });

  const exL = new THREE.Group();
  exL.position.set(0.55, 0.24, -1.95);
  const pipeL = new THREE.Mesh(exGeo, exMat);
  const flameL = new THREE.Mesh(fireGeo, fireMat);
  flameL.name = 'nitro_flame';
  exL.add(pipeL, flameL);
  mainCarGroup.add(exL);

  const exR = new THREE.Group();
  exR.position.set(-0.55, 0.24, -1.95);
  const pipeR = new THREE.Mesh(exGeo, exMat);
  const flameR = new THREE.Mesh(fireGeo, fireMat.clone());
  flameR.name = 'nitro_flame';
  exR.add(pipeR, flameR);
  mainCarGroup.add(exR);

  // Spun alloy wheels with inside brake discs and bright red sports brake calipers!
  const rimMat = new THREE.MeshStandardMaterial({ color: '#f5f5f5', roughness: 0.18, metalness: 0.94 });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#131314', roughness: 0.95, metalness: 0.02 });
  const brakeDiscMat = new THREE.MeshStandardMaterial({ color: '#7b8586', roughness: 0.35, metalness: 0.93 });
  const caliperMat = new THREE.MeshStandardMaterial({ color: '#e74c3c', roughness: 0.25, metalness: 0.6 }); // hot red calipers

  const pivots: THREE.Group[] = [];
  const spinners: THREE.Group[] = [];

  const spawnWheelAssembly = (wx: number, wy: number, wz: number, isLeft: boolean) => {
    // Red sports brake caliper stays completely static attached to car group
    const caliperGeo = new THREE.BoxGeometry(0.06, 0.17, 0.11);
    const caliper = new THREE.Mesh(caliperGeo, caliperMat);
    caliper.position.set(wx + (isLeft ? -0.1 : 0.1), wy + 0.11, wz + 0.04);
    mainCarGroup.add(caliper);

    // Steering pivot group
    const pivot = new THREE.Group();
    pivot.position.set(wx, wy, wz);
    mainCarGroup.add(pivot);

    // Spinning roll group
    const spinner = new THREE.Group();
    pivot.add(spinner);

    // Black high-performance tires rubber
    const tireGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.36, 12);
    tireGeo.rotateZ(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;
    tire.receiveShadow = true;
    spinner.add(tire);

    // Chrome multispokes rim center
    const rimBaseGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.37, 12);
    rimBaseGeo.rotateZ(Math.PI / 2);
    const rimCenter = new THREE.Mesh(rimBaseGeo, rimMat);
    spinner.add(rimCenter);

    // 5 Star Alloy spokes wheels
    for (let s = 0; s < 5; s++) {
      const spokeGeo = new THREE.BoxGeometry(0.04, 0.24, 0.05);
      const spoke = new THREE.Mesh(spokeGeo, rimMat);
      const sAngle = (s * Math.PI * 2) / 5;
      spoke.position.set(0, Math.sin(sAngle) * 0.12, Math.cos(sAngle) * 0.12);
      spoke.rotation.x = sAngle;
      spinner.add(spoke);
    }

    // Inner circular brake disc
    const discGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.03, 10);
    discGeo.rotateZ(Math.PI / 2);
    const disc = new THREE.Mesh(discGeo, brakeDiscMat);
    disc.position.x = isLeft ? -0.06 : 0.06;
    spinner.add(disc);

    pivots.push(pivot);
    spinners.push(spinner);
  };

  spawnWheelAssembly(0.95, 0.38, 1.15, true);    // Front Left
  spawnWheelAssembly(-0.95, 0.38, 1.15, false);  // Front Right
  spawnWheelAssembly(1.0, 0.38, -1.2, true);     // Rear Left
  spawnWheelAssembly(-1.0, 0.38, -1.2, false);   // Rear Right

  // Increase car group size by 40%
  mainCarGroup.scale.set(1.4, 1.4, 1.4);

  return {
    group: mainCarGroup,
    pivots,
    spinners,
    tailLightMat: tlMat,
    paintMat: paint
  };
}

// Asynchronous GLTF loader worker
export const preloadGLTFAssets = async (): Promise<void> => {
  if (gltfModelCache.isLoaded) return;
  const loader = new GLTFLoader();
  const tryLoadPath = async (paths: string[]): Promise<THREE.Group | null> => {
    for (const p of paths) {
      try {
        const gltf = await new Promise<any>((resolve, reject) => {
          loader.load(p, resolve, undefined, reject);
        });
        return gltf.scene || gltf;
      } catch (e) {
        // fail-silent and try next fallback url path
      }
    }
    return null;
  };

  try {
    gltfModelCache.playerModel = await tryLoadPath([
      '/cars/supercar.glb',
      '/cars/supercar.gltf',
      '/cars/car.glb',
      '/public/cars/supercar.glb'
    ]);

    gltfModelCache.aiModel = await tryLoadPath([
      '/cars/ai_car.glb',
      '/cars/ai_car.gltf',
      '/cars/ai_ghost.glb',
      '/public/cars/supercar.glb'
    ]) || gltfModelCache.playerModel;

    gltfModelCache.treeModel = await tryLoadPath([
      '/nature/trees/tree.glb',
      '/nature/trees/pine.glb',
      '/nature/trees/tree.gltf',
      '/public/nature/trees/tree.glb'
    ]);

    gltfModelCache.rockModel = await tryLoadPath([
      '/nature/rocks/rock.glb',
      '/nature/rocks/stone.glb',
      '/nature/rocks/rock.gltf',
      '/public/nature/rocks/rock.glb'
    ]);

    gltfModelCache.mountainModel = await tryLoadPath([
      '/environment/mountain.glb',
      '/environment/mountain.gltf',
      '/public/environment/mountain.glb'
    ]);

    gltfModelCache.pagodaModel = await tryLoadPath([
      '/environment/pagoda.glb',
      '/environment/pagoda.gltf',
      '/public/environment/pagoda.glb'
    ]);

    gltfModelCache.isLoaded = true;
  } catch (err) {
    console.warn('Silent asset load warning:', err);
  }
};

// Generates procedural jagged alpine peaks with rock-fault crevices to replace basic pyramids
export const createProceduralMountain = (radius: number, height: number): THREE.CylinderGeometry => {
  const geometry = new THREE.CylinderGeometry(radius * 0.08, radius, height, 16, 12);
  const pos = geometry.attributes.position;
  
  // Custom seed/harmonics
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    
    // Scale influence of noise: 0 at the absolute tip, full at base
    const heightPercentage = (vy + height / 2) / height; 
    const isBase = heightPercentage < 0.1;
    
    // Multi-frequency noise based on polar coordinates
    const theta = Math.atan2(vz, vx);
    let shift = Math.sin(theta * 6) * Math.cos(vy * 0.12) * 12 * (1 - heightPercentage) +
                Math.sin(theta * 15) * 4 * (1 - heightPercentage);
                
    if (isBase) shift *= 0.5;
    
    // Scale radial coords outward
    const radialRatio = 1.0 + (shift / radius);
    pos.setX(i, vx * radialRatio);
    pos.setZ(i, vz * radialRatio);
  }
  
  geometry.computeVertexNormals();
  return geometry;
};

// Generates stylized organic rock slabs to replace boring spheres
export const createProceduralRockGeo = (): THREE.DodecahedronGeometry => {
  const rockGeo = new THREE.DodecahedronGeometry(1.5, 1);
  const rAttr = rockGeo.attributes.position;
  for (let i = 0; i < rAttr.count; i++) {
    const x = rAttr.getX(i);
    const y = rAttr.getY(i);
    const z = rAttr.getZ(i);
    
    // Add jagged slate-like flattening and random noise offsets
    const noise = 0.85 + Math.sin(x * 5 + y * 3) * 0.15;
    rAttr.setXYZ(i, x * noise, y * noise * 0.55, z * noise); 
  }
  rockGeo.computeVertexNormals();
  return rockGeo;
};

// Generates a stunning tiered Japanese crimson Pagoda tower for scenery
export const createProceduralPagoda = (): THREE.Group => {
  const pagoda = new THREE.Group();
  
  // 1. Rustic stone foundation
  const baseGeo = new THREE.CylinderGeometry(4.8, 5.4, 2.2, 8);
  const baseMat = new THREE.MeshStandardMaterial({ color: '#686a6e', roughness: 0.92, flatShading: true });
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  pagoda.add(baseMesh);
  
  // 2. Main structure tiers
  const tiers = 3;
  const redMat = new THREE.MeshStandardMaterial({ color: '#bf1616', roughness: 0.45, metalness: 0.05 });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#25262a', roughness: 0.85 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#e5b800', roughness: 0.15, metalness: 0.95 });

  for (let t = 0; t < tiers; t++) {
    const scale = 1.0 - t * 0.22;
    const height = 2.2;
    const y = 1.1 + t * (height + 0.3);

    // Red wall body
    const trGeo = new THREE.CylinderGeometry(3.2 * scale, 3.4 * scale, height, 8);
    const tr = new THREE.Mesh(trGeo, redMat);
    tr.position.y = y;
    tr.castShadow = true;
    tr.receiveShadow = true;
    pagoda.add(tr);

    // Dark tiles roof with overhanging flares
    const roofY = y + height / 2 + 0.15;
    const rGeo = new THREE.CylinderGeometry(1.0 * scale, 4.2 * scale, 0.65, 8);
    const r = new THREE.Mesh(rGeo, roofMat);
    r.position.y = roofY;
    r.castShadow = true;
    pagoda.add(r);

    // Curved golden eave edges pointing upwards
    for (let c = 0; c < 8; c++) {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.7), goldMat);
      const angle = (c * Math.PI) / 4;
      tip.position.set(Math.sin(angle) * 4.2 * scale, roofY - 0.12, Math.cos(angle) * 4.2 * scale);
      tip.rotation.y = angle;
      tip.rotation.x = -0.35; 
      pagoda.add(tip);
    }
  }

  // 3. Golden pinnacle spire
  const spireY = 1.1 + tiers * 2.5 + 0.3;
  const spireGeo = new THREE.ConeGeometry(0.35, 2.8, 8);
  const spire = new THREE.Mesh(spireGeo, goldMat);
  spire.position.y = spireY + 1.0;
  spire.castShadow = true;
  pagoda.add(spire);

  for (let r = 0; r < 4; r++) {
    const ringGeo = new THREE.TorusGeometry(0.42 - r * 0.08, 0.08, 8, 16);
    ringGeo.rotateX(Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, goldMat);
    ring.position.y = spireY + 0.2 + r * 0.35;
    ring.castShadow = true;
    pagoda.add(ring);
  }

  return pagoda;
};
