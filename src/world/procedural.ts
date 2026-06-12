import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CarState } from '../types';

// Shared cache for loaded GLTF models to prevent repeated network requests
export const gltfModelCache = {
  lamborghini_aventador: null as THREE.Group | null,
  ferrari_sf90: null as THREE.Group | null,
  bugatti_chiron: null as THREE.Group | null,
  porsche_911: null as THREE.Group | null,
  playerModel: null as THREE.Group | null,
  aiModel: null as THREE.Group | null,
  treeModel: null as THREE.Group | null,
  rockModel: null as THREE.Group | null,
  mountainModel: null as THREE.Group | null,
  pagodaModel: null as THREE.Group | null,
  isLoaded: false
};

// Map each vehicle state stably to its respective 3D model (stretching across the line dynamically)
export function getCarModelForId(id: string): THREE.Group | null {
  if (id === 'player') {
    return gltfModelCache.lamborghini_aventador || gltfModelCache.playerModel;
  }
  
  const aiModels = [
    gltfModelCache.ferrari_sf90,
    gltfModelCache.bugatti_chiron,
    gltfModelCache.porsche_911
  ].filter(m => m !== null);

  if (aiModels.length === 0) {
    return gltfModelCache.aiModel;
  }

  // Consistent stable assignment based on AI number index
  let numId = 0;
  if (id.startsWith('ai')) {
    numId = parseInt(id.replace('ai', '')) || 0;
  } else {
    for (let i = 0; i < id.length; i++) {
      numId += id.charCodeAt(i);
    }
  }
  return aiModels[numId % aiModels.length];
}

export interface ProceduralCarData {
  group: THREE.Group;
  pivots: THREE.Group[];
  spinners: THREE.Group[];
  tailLightMat: THREE.MeshBasicMaterial;
  paintMat: THREE.MeshStandardMaterial;
}

export type SupercarStyle = 'aventador' | 'sf90' | 'chiron' | 'porsche911' | 'traffic';

export function getSupercarStyleForId(id: string): SupercarStyle {
  if (id === 'player') return 'aventador';
  if (id.startsWith('traffic')) return 'traffic';
  if (id.includes('phantom')) return 'sf90';
  if (id.includes('nova')) return 'chiron';
  if (id.includes('blaze')) return 'porsche911';
  if (id.includes('apex')) return 'sf90';
  if (id.includes('titan')) return 'porsche911';
  return 'aventador';
}

// Spawns procedural luxury supercar bodies, fallback for loading Supercars GLTFs
export function buildProceduralCar(c: CarState, reflectionTex: THREE.Texture, scene: THREE.Scene): ProceduralCarData {
  const mainCarGroup = new THREE.Group();
  mainCarGroup.castShadow = true;
  scene.add(mainCarGroup);

  const style = getSupercarStyleForId(c.id);

  // Extreme high-gloss metallic paint with sunset reflection map properties!
  const paint = new THREE.MeshStandardMaterial({
    color: c.color,
    roughness: 0.08,
    metalness: 0.92, 
    envMap: reflectionTex,
    envMapIntensity: 2.5,
  });

  const carbonMat = new THREE.MeshStandardMaterial({ color: '#131518', roughness: 0.44, metalness: 0.72 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#08090f',
    metalness: 0.96,
    roughness: 0.01,
    transparent: true,
    opacity: 0.8,
    envMap: reflectionTex,
    envMapIntensity: 2.8,
  });

  // Dual tone and special materials for Bugatti and curves
  const bugattiDuoMat = new THREE.MeshStandardMaterial({ color: '#090e1c', roughness: 0.08, metalness: 0.92, envMap: reflectionTex, envMapIntensity: 2.5 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#f3f4f6', roughness: 0.02, metalness: 0.98, envMap: reflectionTex, envMapIntensity: 3.0 });
  
  const pivots: THREE.Group[] = [];
  const spinners: THREE.Group[] = [];
  let tlMat = new THREE.MeshBasicMaterial({ color: '#770010' }); 

  if (style === 'traffic') {
    // --- 1. CIVILIAN COMMUTER VEHICLE STYLE ---
    // A simple compact hatchback commuter car profile
    const bodyGeo = new THREE.BoxGeometry(1.68, 0.76, 3.4);
    const bodyMesh = new THREE.Mesh(bodyGeo, paint);
    bodyMesh.position.set(0, 0.54, 0);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    mainCarGroup.add(bodyMesh);

    // Hatchback greenhouse cabin windshield glass
    const cabGeo = new THREE.BoxGeometry(1.58, 0.45, 1.8);
    const cabin = new THREE.Mesh(cabGeo, glassMat);
    cabin.position.set(0, 0.95, -0.2);
    cabin.castShadow = true;
    mainCarGroup.add(cabin);

    // Simple yellow headlights
    const hMat = new THREE.MeshBasicMaterial({ color: '#ffeaad' });
    const hlGeo = new THREE.BoxGeometry(0.25, 0.12, 0.1);
    const hlL = new THREE.Mesh(hlGeo, hMat);
    hlL.position.set(0.64, 0.45, 1.71);
    const hlR = hlL.clone();
    hlR.position.x = -0.64;
    mainCarGroup.add(hlL, hlR);

    // Simple taillight boxes
    const tlL = new THREE.Mesh(hlGeo, tlMat);
    tlL.position.set(0.64, 0.45, -1.71);
    const tlR = tlL.clone();
    tlR.position.x = -0.64;
    mainCarGroup.add(tlL, tlR);

  } else if (style === 'chiron') {
    // --- 2. BUGATTI CHIRON DUO-TONE STYLE ---
    // Front Half painted with color
    const frontGeo = new THREE.BoxGeometry(1.82, 0.22, 2.05);
    const frontBase = new THREE.Mesh(frontGeo, paint);
    frontBase.position.set(0, 0.22, 1.025);
    frontBase.castShadow = true;
    frontBase.receiveShadow = true;
    mainCarGroup.add(frontBase);

    // Rear Half painted in Carbon Blue
    const rearGeo = new THREE.BoxGeometry(1.82, 0.22, 2.05);
    const rearBase = new THREE.Mesh(rearGeo, bugattiDuoMat);
    rearBase.position.set(0, 0.22, -1.025);
    rearBase.castShadow = true;
    rearBase.receiveShadow = true;
    mainCarGroup.add(rearBase);

    // Curved front cowl
    const cowlGeo = new THREE.CylinderGeometry(0.72, 0.88, 1.6, 12, 2);
    cowlGeo.rotateX(Math.PI / 2);
    const cowl = new THREE.Mesh(cowlGeo, paint);
    cowl.position.set(0, 0.38, 1.15);
    cowl.scale.set(1.1, 0.42, 1.0);
    cowl.castShadow = true;
    mainCarGroup.add(cowl);

    // Horseshoe Grille (signature Bugatti detail!)
    const grilleGeo = new THREE.TorusGeometry(0.24, 0.05, 8, 16, Math.PI);
    grilleGeo.rotateX(-Math.PI / 2);
    const grille = new THREE.Mesh(grilleGeo, chromeMat);
    grille.position.set(0, 0.22, 2.05);
    grille.scale.set(1.2, 1.0, 1.5);
    mainCarGroup.add(grille);

    // Teardrop glass cabin
    const cabGeo = new THREE.SphereGeometry(0.72, 16, 12);
    cabGeo.scale(0.86, 0.62, 1.45);
    const cabin = new THREE.Mesh(cabGeo, glassMat);
    cabin.position.set(0, 0.54, -0.2); 
    cabin.castShadow = true;
    mainCarGroup.add(cabin);

    // Famous Bugatti side C-bar loops (decorative chrome arcs!)
    for (let side = -1; side <= 1; side += 2) {
      if (side === 0) continue;
      const cBar = new THREE.Group();
      cBar.position.set(0.92 * side, 0.48, -0.15);
      // Constructing beautiful metallic highlight trim
      const arcGeo = new THREE.TorusGeometry(0.68, 0.04, 8, 16, Math.PI * 1.25);
      const arcMesh = new THREE.Mesh(arcGeo, chromeMat);
      arcMesh.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2;
      arcMesh.rotation.z = Math.PI / 5;
      cBar.add(arcMesh);
      mainCarGroup.add(cBar);
    }

    // Wide flat-mounted deployable speed spoiler
    const wingGeo = new THREE.BoxGeometry(1.92, 0.04, 0.48);
    const wing = new THREE.Mesh(wingGeo, bugattiDuoMat);
    wing.position.set(0, 0.64, -1.82);
    wing.castShadow = true;
    mainCarGroup.add(wing);

    // Quad LED Headlights matrix
    const qlGeo = new THREE.BoxGeometry(0.28, 0.04, 0.14);
    const hlMat = new THREE.MeshBasicMaterial({ color: '#9df2ff' });
    const hlL = new THREE.Mesh(qlGeo, hlMat);
    hlL.position.set(0.66, 0.32, 2.01);
    hlL.rotation.y = -0.16;
    const hlR = hlL.clone();
    hlR.position.x = -0.66;
    hlR.rotation.y = 0.16;
    mainCarGroup.add(hlL, hlR);

    // Solid wide horizontal Ruby LED laser bar taillight
    tlMat = new THREE.MeshBasicMaterial({ color: '#770010' });
    const tlBarGeo = new THREE.BoxGeometry(1.72, 0.03, 0.06);
    const tlBar = new THREE.Mesh(tlBarGeo, tlMat);
    tlBar.position.set(0, 0.44, -2.04);
    mainCarGroup.add(tlBar);

  } else if (style === 'sf90') {
    // --- 3. FERRARI SF90 STRADALE STYLE ---
    // Curved aerodynamic chassis base
    const baseGeo = new THREE.BoxGeometry(1.82, 0.22, 4.1);
    const base = new THREE.Mesh(baseGeo, carbonMat);
    base.position.y = 0.22;
    base.castShadow = true;
    mainCarGroup.add(base);

    // Extremely low curved sports cowl
    const cowlGeo = new THREE.CylinderGeometry(0.62, 0.86, 1.8, 12, 2);
    cowlGeo.rotateX(Math.PI / 2);
    const cowl = new THREE.Mesh(cowlGeo, paint);
    cowl.position.set(0, 0.34, 1.25);
    cowl.scale.set(1.1, 0.38, 1.0);
    cowl.castShadow = true;
    mainCarGroup.add(cowl);

    // Front spoiler splitter lip
    const splitterGeo = new THREE.BoxGeometry(1.86, 0.06, 0.5);
    const splitter = new THREE.Mesh(splitterGeo, carbonMat);
    splitter.position.set(0, 0.14, 2.08);
    mainCarGroup.add(splitter);

    // Low bubble cabin glass canopy
    const cabGeo = new THREE.SphereGeometry(0.70, 16, 12);
    cabGeo.scale(0.85, 0.58, 1.55);
    const cabin = new THREE.Mesh(cabGeo, glassMat);
    cabin.position.set(0, 0.50, -0.3);
    cabin.castShadow = true;
    mainCarGroup.add(cabin);

    // Dynamic dual integrated back-deck body scoops (carbon fiber)
    const scoopGeo = new THREE.BoxGeometry(0.3, 0.15, 0.8);
    const scoopL = new THREE.Mesh(scoopGeo, carbonMat);
    scoopL.position.set(0.68, 0.44, -1.0);
    scoopL.rotation.y = 0.12;
    const scoopR = scoopL.clone();
    scoopR.position.x = -0.68;
    scoopR.rotation.y = -0.12;
    mainCarGroup.add(scoopL, scoopR);

    // Understated active rear spoiler deck lip
    const deckLipGeo = new THREE.BoxGeometry(1.84, 0.05, 0.3);
    const deckLip = new THREE.Mesh(deckLipGeo, paint);
    deckLip.position.set(0, 0.55, -1.94);
    mainCarGroup.add(deckLip);

    // Ultra-thin horizontal LED headlight slits
    const hlGeo = new THREE.BoxGeometry(0.24, 0.03, 0.12);
    const hlMat = new THREE.MeshBasicMaterial({ color: '#b2f9ff' });
    const hlL = new THREE.Mesh(hlGeo, hlMat);
    hlL.position.set(0.64, 0.30, 2.03);
    const hlR = hlL.clone();
    hlR.position.x = -0.64;
    mainCarGroup.add(hlL, hlR);

    // Twin rectangular ruby LED rear taillight modules
    tlMat = new THREE.MeshBasicMaterial({ color: '#770010' });
    const tlBoxGeo = new THREE.BoxGeometry(0.2, 0.06, 0.04);
    const tlL = new THREE.Mesh(tlBoxGeo, tlMat);
    tlL.position.set(0.55, 0.44, -2.03);
    const tlR = tlL.clone();
    tlR.position.x = -0.55;
    mainCarGroup.add(tlL, tlR);

  } else if (style === 'porsche911') {
    // --- 4. PORSCHE 911 GT3 STYLE ---
    // Smooth rounded chassis base
    const baseGeo = new THREE.BoxGeometry(1.78, 0.22, 4.0);
    const base = new THREE.Mesh(baseGeo, paint);
    base.position.y = 0.22;
    base.castShadow = true;
    mainCarGroup.add(base);

    // Retro rounded front hood
    const cowlGeo = new THREE.CylinderGeometry(0.66, 0.84, 1.5, 12, 1);
    cowlGeo.rotateX(Math.PI / 2);
    const cowl = new THREE.Mesh(cowlGeo, paint);
    cowl.position.set(0, 0.38, 1.2);
    cowl.scale.set(1.1, 0.44, 1.0);
    cowl.castShadow = true;
    mainCarGroup.add(cowl);

    // Distinct round bulging "Bug-Eye" headlights
    const hlGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.2, 10);
    hlGeo.rotateX(Math.PI / 4);
    const hlMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const hlL = new THREE.Mesh(hlGeo, paint);
    hlL.position.set(0.62, 0.48, 1.76);
    const bulbL = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), hlMat);
    bulbL.position.set(0, 0.05, 0.08);
    hlL.add(bulbL);
    const hlR = hlL.clone();
    hlR.position.x = -0.62;
    mainCarGroup.add(hlL, hlR);

    // Tear-drop passenger cabin sloping down all the way to rear hatchback flyline
    const cabGeo = new THREE.SphereGeometry(0.72, 16, 12);
    cabGeo.scale(0.85, 0.65, 1.75); // extra stretched flyline
    const cabin = new THREE.Mesh(cabGeo, glassMat);
    cabin.position.set(0, 0.55, -0.4);
    cabin.castShadow = true;
    mainCarGroup.add(cabin);

    // Classic dynamic integrated rear "ducktail" or medium carbon wing
    const wingGeo = new THREE.BoxGeometry(1.88, 0.04, 0.44);
    const wing = new THREE.Mesh(wingGeo, carbonMat);
    wing.position.set(0, 0.78, -1.82);
    wing.castShadow = true;
    mainCarGroup.add(wing);

    const postGeo = new THREE.BoxGeometry(0.08, 0.3, 0.1);
    const postL = new THREE.Mesh(postGeo, carbonMat);
    postL.position.set(0.5, 0.58, -1.8);
    const postR = postL.clone();
    postR.position.x = -0.5;
    mainCarGroup.add(postL, postR);

    // Continuous curved ruby back taillight strip
    tlMat = new THREE.MeshBasicMaterial({ color: '#770010' });
    const tlBarGeo = new THREE.BoxGeometry(1.6, 0.03, 0.04);
    const tlBar = new THREE.Mesh(tlBarGeo, tlMat);
    tlBar.position.set(0, 0.42, -2.01);
    mainCarGroup.add(tlBar);

  } else {
    // --- 5. LAMBORGHINI AVENTADOR WEDGE STYLE (DEFAULT PLAYER) ---
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
    const cabin = new THREE.Mesh(cabGeo, glassMat);
    cabin.position.set(0, 0.54, -0.2); // lowered for race-spec sleek cockpit lines
    cabin.castShadow = true;
    mainCarGroup.add(cabin);

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
    const hlMatMod = new THREE.MeshBasicMaterial({ color: '#b3f0ff' }); 
    const headlightL = new THREE.Mesh(hlLeftGeo, hlMatMod);
    headlightL.position.set(0.68, 0.32, 2.02);
    headlightL.rotation.y = -0.22;
    mainCarGroup.add(headlightL);
    const headlightR = headlightL.clone();
    headlightR.position.x = -0.68;
    headlightR.rotation.y = 0.22;
    mainCarGroup.add(headlightR);

    // Continuous ruby red laser tail light bar
    tlMat = new THREE.MeshBasicMaterial({ color: '#770010' }); 
    const tlBarGeo = new THREE.BoxGeometry(1.68, 0.04, 0.08);
    const taillightBar = new THREE.Mesh(tlBarGeo, tlMat);
    taillightBar.position.set(0, 0.42, -2.04);
    mainCarGroup.add(taillightBar);
  }

  // Common Headlight light projections for player car (working headlights!)
  if (c.id === 'player') {
    const spotLight = new THREE.SpotLight('#ffffff', 4.8, 52, Math.PI / 5, 0.35, 0.82);
    spotLight.position.set(0, 0.42, 1.95);
    spotLight.target.position.set(0, 0.1, 16);
    mainCarGroup.add(spotLight);
    mainCarGroup.add(spotLight.target);
  }

  // Side view mirrors (common to supercars, omitted on traffic)
  if (style !== 'traffic') {
    const mirrorArmGeo = new THREE.BoxGeometry(0.24, 0.06, 0.06);
    const mirrorHeadGeo = new THREE.BoxGeometry(0.28, 0.14, 0.14);
    const mirrorGlassGeo = new THREE.PlaneGeometry(0.24, 0.11);
    mirrorGlassGeo.rotateY(Math.PI / 2);
    const silverMirrorMat = new THREE.MeshStandardMaterial({ color: '#dfdfdf', metalness: 0.94, roughness: 0.05 });

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
  }

  // Dual exhaust burners with interactive flaring Nitro cylinder flames
  if (style !== 'traffic') {
    const exGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.35, 8);
    exGeo.rotateX(Math.PI / 2);
    const exMat = new THREE.MeshStandardMaterial({ color: '#333333', metalness: 0.9, roughness: 0.2 });
    
    // Conic hot glowing flame cylinder
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
  }

  // Spun alloy wheels with inside brake discs and bright sports brake calipers!
  const rimMat = new THREE.MeshStandardMaterial({ color: '#f5f5f5', roughness: 0.18, metalness: 0.94 });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#131314', roughness: 0.95, metalness: 0.02 });
  const brakeDiscMat = new THREE.MeshStandardMaterial({ color: '#7b8586', roughness: 0.35, metalness: 0.93 });
  
  // Custom caliper colors depending on car style
  const caliperColor = style === 'chiron' ? '#3b82f6' : (style === 'porsche911' ? '#fbbf24' : '#e74c3c'); // Blue calipers for Bugatti, yellow for Porsche, red for Lamborghini and Ferrari
  const caliperMat = new THREE.MeshStandardMaterial({ color: caliperColor, roughness: 0.25, metalness: 0.6 });

  const spawnWheelAssembly = (wx: number, wy: number, wz: number, isLeft: boolean) => {
    // Red/yellow/blue sports brake caliper stays completely static attached to car group
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

  // Adjust wheel offsets and sizes slightly for compact traffic if needed
  const wheelZOffset = style === 'traffic' ? 1.05 : 1.15;
  const wheelRearZOffset = style === 'traffic' ? -1.1 : -1.2;

  spawnWheelAssembly(0.95, 0.38, wheelZOffset, true);    // Front Left
  spawnWheelAssembly(-0.95, 0.38, wheelZOffset, false);  // Front Right
  spawnWheelAssembly(1.0, 0.38, wheelRearZOffset, true);     // Rear Left
  spawnWheelAssembly(-1.0, 0.38, wheelRearZOffset, false);   // Rear Right

  // Increase car group size by 40% (except traffic which is already reasonably sized)
  const groupScale = style === 'traffic' ? 1.25 : 1.4;
  mainCarGroup.scale.set(groupScale, groupScale, groupScale);

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
    // 1. Preload real 3D supercar models
    gltfModelCache.lamborghini_aventador = await tryLoadPath([
      '/cars/lamborghini_aventador.glb',
      '/cars/supercar.glb',
      '/public/cars/lamborghini_aventador.glb'
    ]);

    gltfModelCache.ferrari_sf90 = await tryLoadPath([
      '/cars/ferrari_sf90.glb',
      '/public/cars/ferrari_sf90.glb'
    ]);

    gltfModelCache.bugatti_chiron = await tryLoadPath([
      '/cars/bugatti_chiron.glb',
      '/public/cars/bugatti_chiron.glb'
    ]);

    gltfModelCache.porsche_911 = await tryLoadPath([
      '/cars/porsche_911.glb',
      '/public/cars/porsche_911.glb'
    ]);

    // Backwards compatibility aliases
    gltfModelCache.playerModel = gltfModelCache.lamborghini_aventador || await tryLoadPath([
      '/cars/supercar.glb',
      '/cars/supercar.gltf',
      '/public/cars/supercar.glb'
    ]);

    gltfModelCache.aiModel = gltfModelCache.ferrari_sf90 || gltfModelCache.bugatti_chiron || gltfModelCache.porsche_911 || gltfModelCache.playerModel;

    // 2. Preload Scenery model structures
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
