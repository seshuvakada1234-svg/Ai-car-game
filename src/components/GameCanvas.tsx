import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CarState, ControlsState } from '../types';
import { GamePhysicsService } from '../utils/gamePhysics';
import { TrackGeometryHelper } from '../utils/track';
import { gltfModelCache, preloadGLTFAssets, createCarChassisGroup, getCarModelForId, modelWheelMetadataMap, loadCarModel } from '../world/procedural';
import { DragonTrackWorld } from '../world/DragonTrackWorld';
import { particleSystem } from '../world/particleSystem';
import { lodManager } from '../world/lodManager';
import { terrainManager } from '../world/terrainManager';

// Dynamic modular systems integration
import { SuspensionSystem } from '../utils/suspension';
import { WheelSystem } from '../utils/wheelSystem';
import { CameraController } from '../utils/cameraController';
import { CarAudioSystem } from '../utils/carAudio';

// ------------------------------------------------------------
// HIGH-FI DYNAMIC SYNTHESIZED HYPERCAR ENGINE SOUND SYSTEM
// ------------------------------------------------------------
class EngineSoundSystem {
  private ctx: AudioContext | null = null;
  private mainOsc: OscillatorNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private lowpass: BiquadFilterNode | null = null;
  private gainNode: GainNode | null = null;
  private active = false;

  constructor() {}

  private init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // Main sawtooth growl Oscillator
      this.mainOsc = this.ctx.createOscillator();
      this.mainOsc.type = 'sawtooth';

      // Sub frequency triangle Oscillator
      this.subOsc = this.ctx.createOscillator();
      this.subOsc.type = 'triangle';

      // Dynamic lowpass filter to muffle or open exhaust tones
      this.lowpass = this.ctx.createBiquadFilter();
      this.lowpass.type = 'lowpass';
      this.lowpass.Q.value = 3.5;

      // Master output volume gain
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);

      this.mainOsc.connect(this.lowpass);
      this.subOsc.connect(this.lowpass);
      this.lowpass.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);

      this.mainOsc.start(0);
      this.subOsc.start(0);

      this.active = true;
    } catch (err) {
      console.warn('Web Audio Engine failed to load:', err);
    }
  }

  public setSpeed(speed: number, isNitro: boolean, isPaused: boolean, soundEnabled: boolean, state: string) {
    if (!soundEnabled || isPaused || (state !== 'racing' && state !== 'countdown')) {
      if (this.gainNode && this.ctx) {
        this.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08); // fade out
      }
      return;
    }

    if (!this.ctx) {
      this.init();
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (!this.active || !this.ctx) return;

    const absSpeed = Math.abs(speed);
    const speedKmh = absSpeed * 3.6;

    // Simulate multi-speed gearbox with distinct pitch jumps (looks and sounds like NFS!)
    let gear = 1;
    let minG = 0;
    let maxG = 40;

    if (speedKmh > 210) { gear = 6; minG = 210; maxG = 340; }
    else if (speedKmh > 160) { gear = 5; minG = 160; maxG = 210; }
    else if (speedKmh > 115) { gear = 4; minG = 115; maxG = 160; }
    else if (speedKmh > 75) { gear = 3; minG = 75; maxG = 115; }
    else if (speedKmh > 40) { gear = 2; minG = 40; maxG = 75; }

    const ratio = Math.max(0, Math.min(1.0, (speedKmh - minG) / (maxG - minG)));
    const rpm = 800 + ratio * 6400; // 800 to 7200 RPM

    // Base pitch modulation
    const fundamental = (rpm / 60) * 1.4;
    const t = this.ctx.currentTime;

    if (this.mainOsc) {
      this.mainOsc.frequency.setTargetAtTime(fundamental, t, 0.06);
    }
    if (this.subOsc) {
      this.subOsc.frequency.setTargetAtTime(fundamental * 0.5, t, 0.06);
    }

    if (this.lowpass) {
      const lpfFreq = 180 + (rpm / 7200) * 1600 + (isNitro ? 500 : 0);
      this.lowpass.frequency.setTargetAtTime(lpfFreq, t, 0.06);
    }

    if (this.gainNode) {
      let vol = 0.06 + (rpm / 7200) * 0.12;
      if (isNitro) vol *= 1.35;
      this.gainNode.gain.setTargetAtTime(vol, t, 0.04);
    }
  }

  public dispose() {
    this.active = false;
    try {
      if (this.ctx) {
        this.ctx.close();
      }
    } catch (e) {}
  }
}

// ------------------------------------------------------------
// HIGH-PERFORMANCE DYNAMIC NEON LIGHT RIBBON TRAILS FOR ASPHALT EXPERIENCE
// ------------------------------------------------------------
class RibbonTrail {
  geometry: THREE.BufferGeometry;
  mesh: THREE.Mesh;
  positions: THREE.Vector3[] = [];
  maxPoints: number;
  thickness: number;

  constructor(scene: THREE.Scene, color: string, maxPoints = 20, thickness = 0.22) {
    this.maxPoints = maxPoints;
    this.thickness = thickness;
    this.geometry = new THREE.BufferGeometry();
    
    const vertexCount = maxPoints * 2;
    const indexCount = (maxPoints - 1) * 6;
    
    const posArr = new Float32Array(vertexCount * 3);
    const colArr = new Float32Array(vertexCount * 3);
    const indicesArr = new Uint16Array(indexCount);
    
    for (let i = 0; i < maxPoints - 1; i++) {
      const v0 = i * 2;
      const v1 = i * 2 + 1;
      const v2 = (i + 1) * 2;
      const v3 = (i + 1) * 2 + 1;
      
      const idx = i * 6;
      indicesArr[idx] = v0;
      indicesArr[idx + 1] = v1;
      indicesArr[idx + 2] = v2;
      
      indicesArr[idx + 3] = v1;
      indicesArr[idx + 4] = v3;
      indicesArr[idx + 5] = v2;
    }
    
    this.geometry.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    this.geometry.setIndex(new THREE.BufferAttribute(indicesArr, 1));
    
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    
    this.mesh = new THREE.Mesh(this.geometry, mat);
    scene.add(this.mesh);
  }

  addPoint(pt: THREE.Vector3, colorHex: string) {
    this.positions.push(pt.clone());
    if (this.positions.length > this.maxPoints) {
      this.positions.shift();
    }
    this.updateGeometry(colorHex);
  }

  clear() {
    this.positions = [];
    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = this.geometry.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < posAttr.count; i++) {
      posAttr.setXYZ(i, 9999, 9999, 9999);
      colAttr.setXYZ(i, 0, 0, 0);
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  updateGeometry(colorHex: string) {
    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = this.geometry.getAttribute('color') as THREE.BufferAttribute;
    
    const pts = this.positions;
    const len = pts.length;
    const baseColor = new THREE.Color(colorHex);
    
    for (let i = 0; i < this.maxPoints; i++) {
      const v0 = i * 2;
      const v1 = i * 2 + 1;
      
      if (i < len) {
        const pt = pts[i];
        
        // Setup vertical width of ribbon
        posAttr.setXYZ(v0, pt.x, pt.y - this.thickness / 2, pt.z);
        posAttr.setXYZ(v1, pt.x, pt.y + this.thickness / 2, pt.z);
        
        // Exponential decay for glowing taper
        const ratio = i / (len - 1 || 1);
        const intensity = ratio * ratio * ratio;
        
        colAttr.setXYZ(v0, baseColor.r * intensity, baseColor.g * intensity, baseColor.b * intensity);
        colAttr.setXYZ(v1, baseColor.r * intensity, baseColor.g * intensity, baseColor.b * intensity);
      } else {
        posAttr.setXYZ(v0, 9999, 9999, 9999);
        posAttr.setXYZ(v1, 9999, 9999, 9999);
        colAttr.setXYZ(v0, 0, 0, 0);
        colAttr.setXYZ(v1, 0, 0, 0);
      }
    }
    
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    this.geometry.computeBoundingBox();
    this.geometry.computeBoundingSphere();
  }

  dispose() {
    this.geometry.dispose();
    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach(m => m.dispose());
    } else {
      this.mesh.material.dispose();
    }
  }
}

interface GameCanvasProps {
  cars: CarState[];
  playerControls: ControlsState;
  physicsService: GamePhysicsService;
  trackHelper: TrackGeometryHelper;
  isPaused: boolean;
  gameState: string;
  onFinishRace: () => void;
  onTick: (updatedCars: CarState[]) => void;
  soundEnabled?: boolean;
  timeOfDay?: 'morning' | 'noon' | 'sunset' | 'night';
  weather?: 'sunny' | 'cloudy' | 'foggy' | 'rain';
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  cars,
  playerControls,
  physicsService,
  trackHelper,
  isPaused,
  gameState,
  onFinishRace,
  onTick,
  soundEnabled = true,
  timeOfDay = 'sunset',
  weather = 'sunny',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flareRef = useRef<HTMLDivElement>(null);
  const speedVignetteRef = useRef<HTMLDivElement>(null);

  const carsRef = useRef<CarState[]>(cars);
  const controlsRef = useRef<ControlsState>(playerControls);
  const gameStateRef = useRef<string>(gameState);
  const isPausedRef = useRef<boolean>(isPaused);
  const onFinishRaceRef = useRef<() => void>(onFinishRace);
  const onTickRef = useRef<(updatedCars: CarState[]) => void>(onTick);
  
  const soundSystemRef = useRef<EngineSoundSystem | null>(null);
  const cameraControllerRef = useRef<CameraController | null>(null);
  const carAudioSystemRef = useRef<CarAudioSystem | null>(null);
  const soundEnabledRef = useRef<boolean>(soundEnabled);

  const timeOfDayRef = useRef<'morning' | 'noon' | 'sunset' | 'night'>(timeOfDay);
  const weatherRef = useRef<'sunny' | 'cloudy' | 'foggy' | 'rain'>(weather);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const skyDomeRef = useRef<THREE.Mesh | null>(null);
  const sunDiskRef = useRef<THREE.Mesh | null>(null);
  const sunGlowRef = useRef<THREE.Mesh | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambLightRef = useRef<THREE.HemisphereLight | null>(null);
  const rainMeshRef = useRef<THREE.LineSegments | null>(null);

  useEffect(() => { carsRef.current = cars; }, [cars]);
  useEffect(() => { controlsRef.current = playerControls; }, [playerControls]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { onFinishRaceRef.current = onFinishRace; }, [onFinishRace]);
  useEffect(() => { onTickRef.current = onTick; }, [onTick]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { timeOfDayRef.current = timeOfDay; }, [timeOfDay]);
  useEffect(() => { weatherRef.current = weather; }, [weather]);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // Trigger asset preloading asynchronously
    preloadGLTFAssets();

    // --- 1. INITIALIZE THREE.JS SCENE, CAMERA, RENDERER ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(62, 1, 0.4, 1800);
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    // --- 2. ENVIRONMENT MAP ---
    const createReflectionMap = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 128; canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, 0, 128);
        grad.addColorStop(0.0, '#0a1d37');
        grad.addColorStop(0.35, '#2e114d');
        grad.addColorStop(0.65, '#f3501a');
        grad.addColorStop(0.82, '#ffcc00');
        grad.addColorStop(1.0, '#4a2503');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      return tex;
    };
    const reflectionTex = createReflectionMap();

    // --- 3. DYNAMIC WORLD GEOMETRIES ---
    const dragonWorld = new DragonTrackWorld(scene, trackHelper);

    // --- 4. CAR MODEL GENERATIONS ---
    const carGroupMap = new Map<string, THREE.Group>();
    const carPivotsMap = new Map<string, THREE.Group[]>();
    const carSpinnersMap = new Map<string, THREE.Group[]>();
    const tailLightMatMap = new Map<string, THREE.MeshBasicMaterial>();
    const paintMatMap = new Map<string, THREE.MeshStandardMaterial>();
    const modelBrakeLightMap = new Map<string, THREE.MeshStandardMaterial[]>();

    const soundSystem = new EngineSoundSystem();
    soundSystemRef.current = soundSystem;

    carsRef.current.forEach(c => {
      const carData = createCarChassisGroup(c, reflectionTex, scene);
      carGroupMap.set(c.id, carData.group);
      carPivotsMap.set(c.id, carData.pivots);
      carSpinnersMap.set(c.id, carData.spinners);
      tailLightMatMap.set(c.id, carData.tailLightMat);
      paintMatMap.set(c.id, carData.paintMat);
    });

    // --- 5. LIGHTS & REALISTIC SUNSET SKYDOME ---
    const skyGeo = new THREE.SphereGeometry(1400, 32, 15);
    skyGeo.scale(-1, 1, 1); // internal facing sphere shell
    const skyColors: number[] = [];
    const skyPos = skyGeo.attributes.position;
    for (let i = 0; i < skyPos.count; i++) {
      const y = skyPos.getY(i);
      const ratio = (y + 1400) / 2800; // 0 to 1
      let col = new THREE.Color();
      if (ratio > 0.65) {
        col.lerpColors(new THREE.Color('#030514'), new THREE.Color('#0e1329'), (ratio - 0.65) / 0.35);
      } else if (ratio > 0.48) {
        col.lerpColors(new THREE.Color('#ff0055'), new THREE.Color('#0e1329'), (ratio - 0.48) / 0.17);
      } else if (ratio > 0.35) {
        col.lerpColors(new THREE.Color('#ffa600'), new THREE.Color('#ff0055'), (ratio - 0.35) / 0.13);
      } else {
        col.lerpColors(new THREE.Color('#220e02'), new THREE.Color('#ffa600'), ratio / 0.35);
      }
      skyColors.push(col.r, col.g, col.b);
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
    const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyDome);

    // Glowing Lens Sun Disk
    const sunDiskGeo = new THREE.CircleGeometry(42, 16);
    const sunDiskMat = new THREE.MeshBasicMaterial({ color: '#fffdf6', transparent: true, opacity: 0.98, side: THREE.DoubleSide });
    const sunDisk = new THREE.Mesh(sunDiskGeo, sunDiskMat);
    sunDisk.position.set(120, 240, 80).normalize().multiplyScalar(1350);
    sunDisk.lookAt(0, 0, 0);
    scene.add(sunDisk);

    const glowDiskGeo = new THREE.CircleGeometry(110, 16);
    const glowDiskMat = new THREE.MeshBasicMaterial({ color: '#ff7700', transparent: true, opacity: 0.28, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const sunGlow = new THREE.Mesh(glowDiskGeo, glowDiskMat);
    sunGlow.position.copy(sunDisk.position);
    sunGlow.lookAt(0, 0, 0);
    scene.add(sunGlow);

    const sunLight = new THREE.DirectionalLight('#ffc891', 3.2);
    sunLight.position.set(120, 240, 80);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 400;
    const shadowSize = 100;
    sunLight.shadow.camera.left = -shadowSize;
    sunLight.shadow.camera.right = shadowSize;
    sunLight.shadow.camera.top = shadowSize;
    sunLight.shadow.camera.bottom = -shadowSize;
    scene.add(sunLight);
    scene.add(sunLight.target);

    const ambLight = new THREE.HemisphereLight('#0d2149', '#4d2d14', 1.0);
    scene.add(ambLight);

    // Save elements dynamically to refs
    rendererRef.current = renderer;
    sceneRef.current = scene;
    skyDomeRef.current = skyDome;
    sunDiskRef.current = sunDisk;
    sunGlowRef.current = sunGlow;
    sunLightRef.current = sunLight;
    ambLightRef.current = ambLight;

    // Fast-rendering Rain Particle System using single LineSegments mesh (600 drops)
    const rainCount = 600;
    const rainGeo = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(rainCount * 6);
    for (let r = 0; r < rainCount; r++) {
      const rx = Math.random() * 200 - 100;
      const ry = Math.random() * 80;
      const rz = Math.random() * 200 - 100;

      const idx = r * 6;
      rainPositions[idx] = rx;
      rainPositions[idx + 1] = ry;
      rainPositions[idx + 2] = rz;

      rainPositions[idx + 3] = rx - 0.5;
      rainPositions[idx + 4] = ry - 3.5;
      rainPositions[idx + 5] = rz;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rainMat = new THREE.LineBasicMaterial({ color: '#cffafe', transparent: true, opacity: 0.38 });
    const rainMesh = new THREE.LineSegments(rainGeo, rainMat);
    rainMesh.visible = false;
    scene.add(rainMesh);
    rainMeshRef.current = rainMesh;

    // Allocate Ribbon Trails for all cars (except daily commuter traffic)
    const carLeftTailTrails = new Map<string, RibbonTrail>();
    const carRightTailTrails = new Map<string, RibbonTrail>();
    const carLeftExhaustTrails = new Map<string, RibbonTrail>();
    const carRightExhaustTrails = new Map<string, RibbonTrail>();

    carsRef.current.forEach(c => {
      if (c.id.startsWith('traffic')) return;
      carLeftTailTrails.set(c.id, new RibbonTrail(scene, '#ff0a26', 18, 0.22));
      carRightTailTrails.set(c.id, new RibbonTrail(scene, '#ff0a26', 18, 0.22));
      carLeftExhaustTrails.set(c.id, new RibbonTrail(scene, '#00e5ff', 12, 0.16));
      carRightExhaustTrails.set(c.id, new RibbonTrail(scene, '#00e5ff', 12, 0.16));
    });

    // Track street lights
    trackHelper.lights.forEach(lite => {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshBasicMaterial({ color: lite.color }));
      bulb.position.copy(lite.position);
      scene.add(bulb);

      const pl = new THREE.PointLight(lite.color, lite.intensity, 22, 0.5);
      pl.position.copy(lite.position);
      scene.add(pl);
    });

    // --- 6. PARTICLES SYSTEM ---
    particleSystem.initialize(scene);

    // Speed Lines Effect
    const speedLinesCount = 35;
    const linesGroup = new THREE.Group();
    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -4], 3));
    const lMat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 });
    const linesPool: THREE.Line[] = [];
    for (let i = 0; i < speedLinesCount; i++) {
      const lineMesh = new THREE.Line(lGeo, lMat.clone());
      linesGroup.add(lineMesh);
      linesPool.push(lineMesh);
    }
    camera.add(linesGroup);
    scene.add(camera);

    // --- 7. RENDERING FEEDBACK LOOP ---
    let animationId = 0;
    let oldTime = performance.now();
    let accumulatedTime = 0;
    const fixedDt = 1 / 60;
    let camShakePower = 0;
    let runningTime = 0;
    const smoothedLookAt = new THREE.Vector3();
    let smoothedLookAtInitialized = false;

    const tick = () => {
      animationId = requestAnimationFrame(tick);
      const currentTime = performance.now();
      let elapsedSec = (currentTime - oldTime) / 1000;
      if (elapsedSec > 0.1) elapsedSec = 0.1;
      oldTime = currentTime;

      const currentCars = carsRef.current ? [...carsRef.current] : [];
      if (currentCars.length === 0) {
        return; // Skip this frame if cars are not initialized
      }

      if (!isPausedRef.current && gameStateRef.current !== 'completed') {
        runningTime += elapsedSec;
        accumulatedTime += elapsedSec;
        while (accumulatedTime >= fixedDt) {
          const isRaceLocked = gameStateRef.current === 'countdown' || gameStateRef.current === 'menu';
          const playerCar = currentCars.find(c => c.id === 'player');
          if (playerCar && playerCar.position && playerCar.velocity) {
            physicsService.updateCar(playerCar, fixedDt, controlsRef.current, isRaceLocked);
            physicsService.generateExhaustParticles(playerCar, fixedDt);
          }
          currentCars.forEach(c => {
            if (c && c.position && c.velocity && c.isAI) {
              physicsService.updateAICar(c, fixedDt, currentCars);
              physicsService.generateExhaustParticles(c, fixedDt);
            }
          });
          physicsService.evaluatePositionsRanks(currentCars);
          physicsService.updateParticles(fixedDt);
          accumulatedTime -= fixedDt;
        }

        onTickRef.current(currentCars);

        const player = currentCars.find(c => c.id === 'player');
        if (player && player.position && player.isFinished && gameStateRef.current === 'racing') {
          onFinishRaceRef.current();
        }
      }

      // Live animated elements (waterfalls, victory fireworks, grandstands)
      const playerObj = currentCars.find(c => c.id === 'player');
      const isFinished = playerObj ? playerObj.isFinished : false;
      const rank = playerObj ? playerObj.racePosition : 1;
      if (playerObj && playerObj.position) {
        dragonWorld.update(elapsedSec, trackHelper, rank, isFinished);
      }

      // Animate Vehicles
      currentCars.forEach(c => {
        if (!c || !c.id || !c.position) return;
        const carGroup = carGroupMap.get(c.id);
        const pivots = carPivotsMap.get(c.id);
        const spinners = carSpinnersMap.get(c.id);

        if (carGroup && carGroup.position && carGroup.rotation) {
          carGroup.position.set(c.position.x, c.position.y, c.position.z);

          // Dynamic Headlight Assembly For Night/Storm Conditions
          let headlightObj = carGroup.getObjectByName('car_headlight');
          const needsLights = timeOfDayRef.current === 'night' || weatherRef.current === 'rain' || weatherRef.current === 'foggy';
          
          if (needsLights) {
            if (!headlightObj) {
              const hGroup = new THREE.Group();
              hGroup.name = 'car_headlight';
              
              // Forward casting spotlight beam
              const spot = new THREE.SpotLight('#fffaed', 4.5, 45, Math.PI / 5, 0.4, 0.5);
              spot.position.set(0, 0.35, 1.2);
              spot.target.position.set(0, 0.1, 10.0);
              spot.distance = 55;
              spot.castShadow = (c.id === 'player'); // Shadow mapping only on player to keep performance high
              
              hGroup.add(spot);
              hGroup.add(spot.target);
              
              // Small yellow glowing bulb spheres
              const bulbMat = new THREE.MeshBasicMaterial({ color: '#fffaed' });
              const bulbGeo = new THREE.SphereGeometry(0.18, 5, 5);
              
              const leftBulb = new THREE.Mesh(bulbGeo, bulbMat);
              leftBulb.position.set(-0.6, 0.35, 1.3);
              const rightBulb = new THREE.Mesh(bulbGeo, bulbMat);
              rightBulb.position.set(0.6, 0.35, 1.3);
              hGroup.add(leftBulb, rightBulb);
              
              carGroup.add(hGroup);
            }
          } else {
            if (headlightObj) {
              carGroup.remove(headlightObj);
            }
          }

          // Ground Height Snapping using pre-baked terrain or accelerated Road BVH
          try {
            const roadHeight = terrainManager.queryRoadHeight(c.position);
            if (roadHeight !== null) {
              c.position.y = roadHeight + 0.05;
            } else {
              c.position.y = terrainManager.getHeight(c.position.x, c.position.z) + 0.05;
            }
            carGroup.position.y = c.position.y;
          } catch (e) {
            carGroup.position.y = c.position.y;
          }
          carGroup.rotation.y = c.angle;

          // Premium speed-sensitive suspension body roll, weight transfer & road micro-vibrations
          const speedRatio = Math.min(1.0, Math.abs(c.speed) / 78);
          
          // 1. Suspension Body Roll opposite to lateral turn G-force
          const rollTarget = -c.angularVelocity * 0.022 * speedRatio;
          carGroup.rotation.z = THREE.MathUtils.lerp(carGroup.rotation.z, rollTarget, 10 * elapsedSec);

          // 2. Headlight Squat (Accel) / Dive (Brake) pitch weight transfer
          let pitchTarget = 0;
          if (c.id === 'player') {
            if (controlsRef.current.forward) {
              pitchTarget = -0.018 * speedRatio; // Rear squat
            } else if (controlsRef.current.backward) {
              pitchTarget = 0.026 * speedRatio;  // Front nose dive
            }
          } else {
            // AI auto pitch based on relative speed
            pitchTarget = -0.008 * speedRatio;
          }
          carGroup.rotation.x = THREE.MathUtils.lerp(carGroup.rotation.x, pitchTarget, 8 * elapsedSec);

          // 3. High-frequency suspension micro-bumps & road surface vibration feedback
          const suspensionVibe = Math.sin(runningTime * 45.0) * 0.006 * speedRatio;
          carGroup.position.y += suspensionVibe;

          // rolling wheels with burnout wheelspin simulation on hard launch!
          let wheelRotationSpeed = c.speed;
          if (c.id === 'player') {
            if (controlsRef.current.forward && Math.abs(c.speed) < 15) {
              wheelRotationSpeed = 35; // simulate wheelspin burnout!
            }
          } else {
            if (Math.abs(c.speed) < 10) {
              wheelRotationSpeed = 22;
            }
          }
          const rotDelta = (wheelRotationSpeed * elapsedSec) / 0.38;

          const suspensionTravel = 0.08;

          // steerOffset calculation for both GLTF wheels & procedural fallback wheels
          let steerOffset = 0;
          if (c.id === 'player') {
            const steerVal = c.steerValue !== undefined ? c.steerValue : (controlsRef.current.steerValue !== undefined ? controlsRef.current.steerValue : (controlsRef.current.left ? 1 : (controlsRef.current.right ? -1 : 0)));
            steerOffset = steerVal * 0.36;
          } else {
            steerOffset = THREE.MathUtils.clamp((c.steerValue !== undefined ? c.steerValue : c.angularVelocity * 0.4), -0.36, 0.36);
          }
          
          const hasGltf = carGroup.getObjectByName('gltf_car_model');
          if (hasGltf) {
            if (pivots) {
              pivots.forEach(p => { p.visible = false; });
            }
            if (spinners) {
              spinners.forEach(s => { s.visible = false; });
            }

            const wheels = carGroup.userData.wheels;
            const gltfPivots = carGroup.userData.pivots;

            // Roll & Pitch lerps as requested:
            carGroup.rotation.z = THREE.MathUtils.lerp(
              carGroup.rotation.z,
              -c.angularVelocity * 0.022 * speedRatio,
              10 * elapsedSec
            );
            
            carGroup.rotation.x = THREE.MathUtils.lerp(
              carGroup.rotation.x,
              pitchTarget,
              8 * elapsedSec
            );

            // Wheel Spin:
            // All wheels rotate: wheel.rotation.x += rotDelta;
            if (wheels) {
              if (wheels.frontLeft) wheels.frontLeft.rotation.x += rotDelta;
              if (wheels.frontRight) wheels.frontRight.rotation.x += rotDelta;
              if (wheels.rearLeft) wheels.rearLeft.rotation.x += rotDelta;
              if (wheels.rearRight) wheels.rearRight.rotation.x += rotDelta;
            }

            // Steering pivots update:
            if (gltfPivots) {
              if (gltfPivots.frontLeftPivot) {
                gltfPivots.frontLeftPivot.rotation.y = THREE.MathUtils.lerp(
                  gltfPivots.frontLeftPivot.rotation.y,
                  steerOffset,
                  0.18
                );
              }
              if (gltfPivots.frontRightPivot) {
                gltfPivots.frontRightPivot.rotation.y = THREE.MathUtils.lerp(
                  gltfPivots.frontRightPivot.rotation.y,
                  steerOffset,
                  0.18
                );
              }
            }
          } else {
            // Fallback procedural wheels
            if (spinners) {
              spinners.forEach(s => { s.rotation.x += rotDelta; });
            }
            if (pivots && pivots.length >= 2) {
              pivots[0].rotation.y = THREE.MathUtils.lerp(pivots[0].rotation.y, steerOffset, 0.18);
              pivots[1].rotation.y = THREE.MathUtils.lerp(pivots[1].rotation.y, steerOffset, 0.18);
            }
          }

          // GLTF dynamic supercar models hot swap
          if (gltfModelCache.isLoaded) {
            const hasGltfModel = carGroup.getObjectByName('gltf_car_model');
            if (hasGltfModel) {
              if (c.id === 'player') {
                (window as any).playerCarAddedToScene = true;
              }
            } else {
              const modelSource = getCarModelForId(c.id);
              if (modelSource) {
                // Hide procedural body elements, except pivots/spinners of our dynamic tire assembly
                carGroup.children.forEach(child => {
                  if (child instanceof THREE.Mesh) {
                    const hasCaliperColor = child.material && 'color' in child.material && (child.material as any).color.getHexString() === 'e74c3c';
                    if (!hasCaliperColor) child.visible = false;
                  }
                });
                const clonedModel = modelSource.clone();

                // 1. Compute its bounding box and center.
                const box = new THREE.Box3().setFromObject(clonedModel);
                const size = box.getSize(new THREE.Vector3());
                const center = new THREE.Vector3();
                box.getCenter(center);

                clonedModel.userData.boundingBox = box;
                clonedModel.userData.height = size.y;

                clonedModel.position.x -= center.x;
                clonedModel.position.z -= center.z;
                clonedModel.position.y -= box.min.y;

                console.log(
                  "Car height:",
                  size.y,
                  "box.min.y:",
                  box.min.y,
                  "final y:",
                  clonedModel.position.y
                );

                clonedModel.name = 'gltf_car_model';

                // Ensure parent container is loaded so world positions are computed cleanly relative to car root
                carGroup.add(clonedModel);

                // Use updateMatrixWorld on clonedModel so local coordinates mapping works flawlessly
                clonedModel.updateMatrixWorld(true);

                // 2. Automatically detect wheels inside clonedModel (by name containing wheel, tire, rim)
                const detectedWheels: THREE.Object3D[] = [];
                clonedModel.traverse((node) => {
                  const nameLower = node.name.toLowerCase();
                  const isMatch = nameLower.includes("wheel") || nameLower.includes("tire") || nameLower.includes("rim");
                  if (isMatch) {
                    // Prevent nested / duplicated nodes (like tyre meshes under wheel group both being matched)
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

                // 3. Classify wheels based on local space relative to clonedModel
                let frontLeft: THREE.Object3D | null = null;
                let frontRight: THREE.Object3D | null = null;
                let rearLeft: THREE.Object3D | null = null;
                let rearRight: THREE.Object3D | null = null;

                detectedWheels.forEach((wheel) => {
                  const localPos = new THREE.Vector3();
                  wheel.getWorldPosition(localPos);
                  clonedModel.worldToLocal(localPos);

                  const isFront = localPos.z > 0;
                  const isLeft = localPos.x > 0;

                  if (isFront) {
                    if (isLeft) {
                      frontLeft = wheel;
                    } else {
                      frontRight = wheel;
                    }
                  } else {
                    if (isLeft) {
                      rearLeft = wheel;
                    } else {
                      rearRight = wheel;
                    }
                  }
                });

                carGroup.userData.wheels = {
                  frontLeft,
                  frontRight,
                  rearLeft,
                  rearRight
                };

                // 4. Create steering pivots and attach front wheels safely
                let frontLeftPivot: THREE.Group | null = null;
                let frontRightPivot: THREE.Group | null = null;

                if (frontLeft) {
                  frontLeftPivot = new THREE.Group();
                  frontLeftPivot.name = "frontLeftPivot";
                  frontLeftPivot.position.copy(frontLeft.position);
                  frontLeftPivot.rotation.copy(frontLeft.rotation);
                  frontLeft.parent?.add(frontLeftPivot);
                  frontLeft.position.set(0, 0, 0);
                  frontLeft.rotation.set(0, 0, 0);
                  frontLeftPivot.add(frontLeft);
                }

                if (frontRight) {
                  frontRightPivot = new THREE.Group();
                  frontRightPivot.name = "frontRightPivot";
                  frontRightPivot.position.copy(frontRight.position);
                  frontRightPivot.rotation.copy(frontRight.rotation);
                  frontRight.parent?.add(frontRightPivot);
                  frontRight.position.set(0, 0, 0);
                  frontRight.rotation.set(0, 0, 0);
                  frontRightPivot.add(frontRight);
                }

                carGroup.userData.pivots = {
                  frontLeftPivot,
                  frontRightPivot
                };

                // Disable procedural wheels when GLB vehicle exists
                if (pivots) {
                  pivots.forEach(p => { p.visible = false; });
                }
                if (spinners) {
                  spinners.forEach(s => { s.visible = false; });
                }

                clonedModel.traverse(node => {
                  if (node instanceof THREE.Mesh) {
                    if (c.id === 'player') {
                      node.castShadow = true;
                      node.receiveShadow = true;
                    } else {
                      node.castShadow = false;
                      node.receiveShadow = true;
                    }

                    // Set metalness 0.8, roughness 0.5, emissive 0 on original GLTF materials to keep original colors
                    const materials = Array.isArray(node.material) ? node.material : [node.material];
                    materials.forEach(mat => {
                      if (mat) {
                        if (mat.emissive && typeof mat.emissive.set === 'function') {
                          mat.emissive.set(0x000000);
                        }
                        mat.emissiveIntensity = 0;
                        mat.roughness = 0.5;
                        mat.metalness = 0.8;
                      }
                    });
                  }
                });

                if (c.id === 'player') {
                  (window as any).playerCarAddedToScene = true;
                }
              }
            }
          }

          // brake light intensities
          const isBraking = c.id === 'player' ? controlsRef.current.backward : (c.speed < 18 && Math.random() > 0.4);
          const tMat = tailLightMatMap.get(c.id);
          if (tMat) tMat.color.set(isBraking ? '#ff111a' : '#770010');

          // Highlight emissive layers on GLB brake lights
          const modelBrakeMats = modelBrakeLightMap.get(c.id);
          if (modelBrakeMats) {
            modelBrakeMats.forEach(m => {
              if (isBraking) {
                m.emissive.set('#ff0000');
                m.emissiveIntensity = 4.0;
              } else {
                m.emissive.set('#320001');
                m.emissiveIntensity = 1.0;
              }
            });
          }

          // Trigger simulated engine audio pitching
          if (c.id === 'player') {
            if (!carAudioSystemRef.current) {
              carAudioSystemRef.current = new CarAudioSystem();
            }
            carAudioSystemRef.current.update(
              c.speed,
              c.isNitroActive,
              c.isDrifting,
              isPausedRef.current,
              soundEnabledRef.current,
              gameStateRef.current === 'racing' || gameStateRef.current === 'countdown'
            );
          }

          // dynamic exhaust nitro cones flares
          carGroup.traverse(child => {
            if (child.name === 'nitro_flame' && child instanceof THREE.Mesh) {
              const fMat = child.material as THREE.MeshBasicMaterial;
              if (c.isNitroActive) {
                child.scale.set(1, 1, 1.2 + Math.random() * 0.9);
                fMat.opacity = 0.88;
                fMat.color.set(Math.random() > 0.45 ? '#00eaff' : '#6a00ff');
              } else {
                child.scale.set(1, 1, 0.1);
                fMat.opacity = 0;
              }
            }
          });

          // Dynamic Ribbon Trail coordinates feeding
          const lTail = carLeftTailTrails.get(c.id);
          const rTail = carRightTailTrails.get(c.id);
          const lEx = carLeftExhaustTrails.get(c.id);
          const rEx = carRightExhaustTrails.get(c.id);

          if (lTail && rTail) {
            const cosA = Math.cos(c.angle);
            const sinA = Math.sin(c.angle);
            const isTraffic = c.id.startsWith('traffic');
            const groupScale = isTraffic ? 1.25 : 1.4;
            
            // local socket positions for taillights
            const localLX = -0.55 * groupScale;
            const localLZ = -1.95 * groupScale;
            
            const lx = c.position.x + localLX * cosA + localLZ * sinA;
            const ly = c.position.y + 0.44 * groupScale;
            const lz = c.position.z - localLX * sinA + localLZ * cosA;
            
            const rx = c.position.x - localLX * cosA + localLZ * sinA;
            const ry = c.position.y + 0.44 * groupScale;
            const rz = c.position.z + localLX * sinA + localLZ * cosA;
            
            const speedKmh = Math.abs(c.speed) * 3.6;
            if (speedKmh > 20) {
              const activeTailColor = isBraking ? '#ff000a' : '#8c010d';
              lTail.addPoint(new THREE.Vector3(lx, ly, lz), activeTailColor);
              rTail.addPoint(new THREE.Vector3(rx, ry, rz), activeTailColor);
            } else {
              lTail.clear();
              rTail.clear();
            }

            // Exhaust Nitro trails
            if (lEx && rEx) {
              if (c.isNitroActive && speedKmh > 30) {
                const exLX = -0.38 * groupScale;
                const exLZ = -1.92 * groupScale;
                const activeExColor = Math.random() > 0.45 ? '#00f0ff' : '#7200ff';

                const elx = c.position.x + exLX * cosA + exLZ * sinA;
                const ely = c.position.y + 0.24 * groupScale;
                const elz = c.position.z - exLX * sinA + exLZ * cosA;
                
                const erx = c.position.x - exLX * cosA + exLZ * sinA;
                const ery = c.position.y + 0.24 * groupScale;
                const erz = c.position.z + exLX * sinA + exLZ * cosA;

                lEx.addPoint(new THREE.Vector3(elx, ely, elz), activeExColor);
                rEx.addPoint(new THREE.Vector3(erx, ery, erz), activeExColor);
              } else {
                lEx.clear();
                rEx.clear();
              }
            }
          }
        }
      });

      // Chase camera tracking
      const player = currentCars.find(c => c.id === 'player');
      if (player) {
         // Run Level of Detail visual culling updates around player's position
         const pPos = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
         lodManager.update(pPos);

        // --- ASPHALT 8 DYNAMIC CHASE CAMERA SYSTEM ---
        const speedKmh = Math.abs(player.speed) * 3.6;
        const velocityMagnitude = Math.sqrt(player.velocity.x ** 2 + player.velocity.z ** 2);
        const speedRatio = Math.min(1.0, speedKmh / 320);

        // Dynamic FOV linked directly to vehicle speed, with a warp stretch for nitro boosts
        let targetFOV = 62 + speedRatio * 18;
        if (player.isNitroActive) {
          targetFOV += 15.0; // Warp-speed compression field of view (up to ~95 FOV)
        }
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFOV, 10.0 * elapsedSec);
        camera.updateProjectionMatrix();

        // Camera back-set distance and height reacts dynamically to speed & boosts
        let camDist = 8.5 + speedRatio * 2.8;
        let camHeight = 3.6 - speedRatio * 0.4;
        
        if (player.isNitroActive) {
          camDist += 1.8;
          camHeight -= 0.15;
        }

        // Broadside drifting lateral offset: swivels camera in direction of the slide!
        let driftLateralOffset = 0;
        if (player.isDrifting) {
          // Angle shifts gracefully sideways matching slide G-force swings
          driftLateralOffset = player.angularVelocity * 0.38;
        }

        const angleCos = Math.cos(player.angle + driftLateralOffset);
        const angleSin = Math.sin(player.angle + driftLateralOffset);

        const targetCamPos = new THREE.Vector3(
          player.position.x - angleSin * camDist,
          player.position.y + camHeight,
          player.position.z - angleCos * camDist
        );

        // Highly-polished lag tracking: damp transitions sideways/backwards to show slides, follow elevation instantly (frame-rate independent)
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCamPos.x, 1 - Math.exp(-8.5 * elapsedSec));
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCamPos.y, 1 - Math.exp(-14.0 * elapsedSec));
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCamPos.z, 1 - Math.exp(-8.5 * elapsedSec));

        // Prevent clipping through the vehicle body by enforcing a minimum distance and height relative to player
        const toCam = new THREE.Vector3().subVectors(camera.position, player.position);
        const minCamDist = 6.8;
        if (toCam.length() < minCamDist) {
          toCam.normalize().multiplyScalar(minCamDist);
          camera.position.copy(player.position).add(toCam);
        }
        const minCamHeight = player.position.y + 1.8;
        if (camera.position.y < minCamHeight) {
          camera.position.y = minCamHeight;
        }

        // Look at coordinates track ahead of the nose of the car to see curves
        const lookAheadX = Math.sin(player.angle) * (3.0 + speedRatio * 4.0);
        const lookAheadZ = Math.cos(player.angle) * (3.0 + speedRatio * 4.0);
        const targetLookAt = new THREE.Vector3(
          player.position.x + lookAheadX,
          player.position.y + 1.1,
          player.position.z + lookAheadZ
        );

        // Dynamic camera banking tilt tied directly to angular velocity
        const targetTilt = -player.angularVelocity * 0.08 * Math.min(1.0, player.speed / 12);
        const nextUpX = THREE.MathUtils.lerp(camera.up.x, targetTilt, 1 - Math.exp(-8.5 * elapsedSec));
        camera.up.set(nextUpX, 1.0, 0);

        // Variable frequency camera rattle & rumble intensity controller
        const isDrifting = Math.abs(player.angularVelocity) > 2.0;

        if (player.isNitroActive) {
          camShakePower = 0.22; // hyper speed rumble
        } else if (controlsRef.current.forward && player.speed < 24) {
          camShakePower = Math.max(0.045, camShakePower - elapsedSec * 0.35); // launch tire spin rumble
        } else if (player.isDrifting && speedKmh > 50) {
          camShakePower = Math.min(0.12, camShakePower + elapsedSec * 0.45); // sliding tire gravel rumble
        } else {
          // standard road micro-frequency feedback proportional to velocity
          const roadVibe = Math.max(0, speedRatio * 0.025);
          camShakePower = THREE.MathUtils.lerp(camShakePower, roadVibe, 1 - Math.exp(-5.0 * elapsedSec));
        }

        if (camShakePower > 0.001) {
          camera.position.x += (Math.random() - 0.5) * camShakePower;
          camera.position.y += (Math.random() - 0.5) * camShakePower;
          camera.position.z += (Math.random() - 0.5) * camShakePower;
        }

        // Smooth look-at target to eliminate all camera jitter!
        if (!smoothedLookAtInitialized) {
          smoothedLookAt.copy(targetLookAt);
          smoothedLookAtInitialized = true;
        } else {
          smoothedLookAt.lerp(targetLookAt, 1 - Math.exp(-15.0 * elapsedSec));
        }
        camera.lookAt(smoothedLookAt);

        // Project Sunset Lens Flare Coordinates
        if (flareRef.current && camera && renderer) {
          const wOff = containerRef.current?.clientWidth || 800;
          const hOff = containerRef.current?.clientHeight || 600;
          const sunPos = new THREE.Vector3(120, 240, 80);
          const sunProj = sunPos.clone().project(camera);
          const isBehind = sunProj.z > 1.0;

          if (isBehind) {
            flareRef.current.style.opacity = '0';
          } else {
            const sunX = (sunProj.x * 0.5 + 0.5) * wOff;
            const sunY = (-sunProj.y * 0.5 + 0.5) * hOff;
            const inBounds = sunX >= 0 && sunX <= wOff && sunY >= 0 && sunY <= hOff;

            if (inBounds) {
              flareRef.current.style.opacity = '1';
              const dx = (wOff / 2) - sunX;
              const dy = (hOff / 2) - sunY;
              const elements = flareRef.current.children;
              if (elements.length >= 6) {
                const offsets = [0, 0.22, 0.45, 0.72, 0.95, 1.25];
                const scales = [1.0, 0.4, 0.25, 0.65, 0.9, 1.45];
                for (let i = 0; i < 6; i++) {
                  const el = elements[i] as HTMLDivElement;
                  el.style.transform = `translate(-50%, -50%) translate(${sunX + dx * offsets[i]}px, ${sunY + dy * offsets[i]}px) scale(${scales[i]})`;
                }
              }
            } else {
              flareRef.current.style.opacity = '0';
            }
          }
        }

        // speed lines visual flow
        const shouldShowSpeedLines = velocityMagnitude > 40;
        linesPool.forEach(lineMesh => {
          const lMatInst = lineMesh.material as THREE.LineBasicMaterial;
          if (shouldShowSpeedLines) {
            lMatInst.opacity = THREE.MathUtils.lerp(lMatInst.opacity, 0.44, 4 * elapsedSec);
            if (lineMesh.position.z > 0 || lMatInst.opacity === 0) {
              lineMesh.position.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 10, -12 - Math.random() * 20);
            }
            lineMesh.position.z += elapsedSec * 60;
          } else {
            lMatInst.opacity = THREE.MathUtils.lerp(lMatInst.opacity, 0, 10 * elapsedSec);
          }
        });

        // dynamic speed blurs vignette
        if (speedVignetteRef.current) {
          const speedFactor = THREE.MathUtils.clamp((velocityMagnitude - 32) / 36, 0, 1);
          speedVignetteRef.current.style.opacity = String(speedFactor * (player.isNitroActive ? 0.92 : 0.65));
        }

        // Align shadow casting light source targeting
        sunLight.position.set(player.position.x + 80, player.position.y + 220, player.position.z + 80);
        sunLight.target = carGroupMap.get('player') || sunLight.target;

        // --- ANIMATE SPINNING WATERMILL WHEELS ---
        scene.traverse((obj) => {
          if (obj.name === 'watermill_wheel' && obj.userData && obj.userData.isRotating) {
            obj.rotation.z += elapsedSec * obj.userData.rotationSpeed;
          }
        });

        // --- ANIMATE RAIN DROPS COLUMN TRACKING THE PLAYER ---
        const activeWeather = weatherRef.current;
        if (rainMeshRef.current && activeWeather === 'rain') {
          rainMeshRef.current.visible = true;
          rainMeshRef.current.position.set(player.position.x, 0, player.position.z);

          const rGeo = rainMeshRef.current.geometry;
          const posAttr = rGeo.getAttribute('position') as THREE.BufferAttribute;
          const array = posAttr.array as Float32Array;
          const count = 600;

          for (let r = 0; r < count; r++) {
            const idx = r * 6;
            // Translate rain drop down
            array[idx + 1] -= elapsedSec * 62.0;
            array[idx + 4] -= elapsedSec * 62.0;

            // Reset rain drop to upper height once it hits player deck level
            if (array[idx + 1] < player.position.y - 12.0) {
              const rx = Math.random() * 120.0 - 60.0;
              const ry = player.position.y + 50.0 + Math.random() * 20.0;
              const rz = Math.random() * 120.0 - 60.0;

              array[idx] = rx;
              array[idx + 1] = ry;
              array[idx + 2] = rz;

              array[idx + 3] = rx - 0.4;
              array[idx + 4] = ry - 3.2;
              array[idx + 5] = rz;
            }
          }
          posAttr.needsUpdate = true;
        } else if (rainMeshRef.current) {
          rainMeshRef.current.visible = false;
        }
      }

      renderer.render(scene, camera);
    };

    tick();

    // observer handle resize
    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObs = new ResizeObserver(() => handleResize());
    resizeObs.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(animationId);
      resizeObs.disconnect();
      renderer.dispose();
      reflectionTex.dispose();
      particleSystem.dispose();
      lGeo.dispose();
      lMat.dispose();
      sunLight.dispose();
      ambLight.dispose();
      
      skyGeo.dispose();
      skyMat.dispose();
      sunDiskGeo.dispose();
      sunDiskMat.dispose();
      glowDiskGeo.dispose();
      glowDiskMat.dispose();

      carLeftTailTrails.forEach(t => t.dispose());
      carRightTailTrails.forEach(t => t.dispose());
      carLeftExhaustTrails.forEach(t => t.dispose());
      carRightExhaustTrails.forEach(t => t.dispose());

      if (carAudioSystemRef.current) {
        carAudioSystemRef.current.dispose();
      }
    };
  }, [physicsService, trackHelper]);

  // --- REACTIVE HIGH-FIDELITY WEATHER & TIME OF DAY CONTROLLER ---
  useEffect(() => {
    const scene = sceneRef.current;
    const skyDome = skyDomeRef.current;
    const sunDisk = sunDiskRef.current;
    const sunGlow = sunGlowRef.current;
    const sunLight = sunLightRef.current;
    const ambLight = ambLightRef.current;

    if (!scene || !skyDome) return;

    // 1. Setup baseline environment metrics by Time of Day
    const sunPos = new THREE.Vector3();
    let sunColor = '#ffffff';
    let sunIntensity = 3.5;
    let skyColor1 = '#000000', skyColor2 = '#000000';
    let ambSky = '#0d2149', ambGround = '#4d2d14', ambIntensity = 1.0;
    let baseFogColor = '#f55d31';
    let baseFogDensity = 0.0016;

    switch (timeOfDay) {
      case 'morning':
        sunPos.set(120, 160, -220);
        sunColor = '#ffd9b3';
        sunIntensity = 2.4;
        skyColor1 = '#ffcaa8'; // warm dawn horizon
        skyColor2 = '#4fa1eb'; // bright sky blue
        ambSky = '#a9bce0';
        ambGround = '#4d3d34';
        ambIntensity = 1.1;
        baseFogColor = '#cbd2db';
        baseFogDensity = 0.0022;
        break;
      case 'noon':
        sunPos.set(0, 480, 0);
        sunColor = '#ffffff';
        sunIntensity = 3.8;
        skyColor1 = '#ebf6ff';
        skyColor2 = '#1b5cc2';
        ambSky = '#dceafd';
        ambGround = '#5c5643';
        ambIntensity = 1.5;
        baseFogColor = '#cbdbe7';
        baseFogDensity = 0.0008;
        break;
      case 'sunset':
        sunPos.set(120, 50, 450);
        sunColor = '#ffa64d';
        sunIntensity = 3.2;
        skyColor1 = '#ff4d00';
        skyColor2 = '#08081a';
        ambSky = '#54208a';
        ambGround = '#3b1a03';
        ambIntensity = 1.1;
        baseFogColor = '#e0420f';
        baseFogDensity = 0.0015;
        break;
      case 'night':
        sunPos.set(0, -300, 0);
        sunColor = '#0a1122';
        sunIntensity = 0.15;
        skyColor1 = '#090e24';
        skyColor2 = '#010206';
        ambSky = '#030614';
        ambGround = '#010204';
        ambIntensity = 0.25;
        baseFogColor = '#010205';
        baseFogDensity = 0.0045;
        break;
    }

    // 2. Overlay Weather filters onto base settings
    let finalFogColor = baseFogColor;
    let finalFogDensity = baseFogDensity;
    let finalSunIntensity = sunIntensity;
    let finalAmbIntensity = ambIntensity;

    if (weather === 'cloudy') {
      finalFogDensity *= 1.8;
      finalSunIntensity *= 0.35;
      finalAmbIntensity *= 0.72;
      skyColor1 = '#7c8b99';
      skyColor2 = '#3a444c';
      finalFogColor = '#5e6b75';
    } else if (weather === 'foggy') {
      finalFogDensity *= 4.5;
      finalSunIntensity *= 0.08;
      finalAmbIntensity *= 0.45;
      skyColor1 = '#475569';
      skyColor2 = '#1e293b';
      finalFogColor = '#334155';
    } else if (weather === 'rain') {
      finalFogDensity *= 2.2;
      finalSunIntensity *= 0.22;
      finalAmbIntensity *= 0.6;
      skyColor1 = '#1e293b';
      skyColor2 = '#0f172a';
      finalFogColor = '#1e293b';
    }

    // 3. Command properties to active Three scene nodes
    if (sunLight) {
      sunLight.position.copy(sunPos);
      sunLight.color.set(sunColor);
      sunLight.intensity = finalSunIntensity;
    }
    if (ambLight) {
      ambLight.color.set(ambSky);
      ambLight.groundColor.set(ambGround);
      ambLight.intensity = finalAmbIntensity;
    }

    if (sunDisk && sunGlow) {
      sunDisk.position.copy(sunPos).normalize().multiplyScalar(1350);
      sunDisk.lookAt(0, 0, 0);
      sunGlow.position.copy(sunDisk.position);
      sunGlow.lookAt(0, 0, 0);

      // Hide sun dial when obscured by rain/fog/night
      const isSunHidden = (timeOfDay === 'night' || weather === 'foggy' || weather === 'rain');
      sunDisk.visible = !isSunHidden;
      sunGlow.visible = !isSunHidden;
    }

    // Redraw Skydome vertex colors spectrum
    const geometry = skyDome.geometry;
    const currentSkyColors: number[] = [];
    const skyPositions = geometry.attributes.position;
    const cVal1 = new THREE.Color(skyColor1);
    const cVal2 = new THREE.Color(skyColor2);

    for (let i = 0; i < skyPositions.count; i++) {
      const y = skyPositions.getY(i);
      const ratio = (y + 1400) / 2800; // 0..1 factor
      const clrComp = new THREE.Color();
      clrComp.lerpColors(cVal1, cVal2, ratio);
      currentSkyColors.push(clrComp.r, clrComp.g, clrComp.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(currentSkyColors, 3));
    geometry.attributes.color.needsUpdate = true;

    // Apply scene-wide exponential fog
    scene.fog = new THREE.FogExp2(finalFogColor, finalFogDensity);
    if (rendererRef.current) {
      rendererRef.current.setClearColor(finalFogColor);
    }
  }, [timeOfDay, weather]);

  return (
    <div ref={containerRef} id="canvas-container" className="relative w-full h-full overflow-hidden bg-sky-100">
      <canvas ref={canvasRef} className="block w-full h-full" />
      
      {/* Cinematic Sunset Lens flares */}
      <div ref={flareRef} className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300 opacity-0">
        <div className="absolute w-28 h-28 rounded-full bg-amber-400/30 blur-xl filter" />
        <div className="absolute w-14 h-14 rounded-full border border-orange-500/25 bg-orange-500/10 blur-sm filter" />
        <div className="absolute w-8 h-8 rounded-full bg-rose-600/20 blur-xs filter" />
        <div className="absolute w-18 h-18 rounded-full border border-indigo-400/20 bg-indigo-500/5 blur-md filter" />
        <div className="absolute w-24 h-24 rounded-full bg-cyan-400/15 blur-lg filter" />
        <div className="absolute w-40 h-40 rounded-full border border-yellow-300/10 bg-yellow-400/4 blur-xl filter" />
      </div>

      <div 
        ref={speedVignetteRef} 
        className="pointer-events-none absolute inset-0 z-20 mix-blend-multiply opacity-0 transition-opacity duration-150"
        style={{
          background: 'radial-gradient(circle, transparent 52%, rgba(240, 10, 10, 0.12) 80%, rgba(0, 0, 0, 0.72) 100%)'
        }}
      />
    </div>
  );
};
