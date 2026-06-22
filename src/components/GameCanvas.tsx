import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CarState, ControlsState } from '../types';
import { GamePhysicsService } from '../physics/GamePhysics';
import { TrafficAIService } from '../ai/TrafficAI';
import { TrackGeometryHelper } from '../utils/track';
import { preloadGLTFAssets } from '../world/procedural';
import { ShaderPreloader } from '../services/ShaderPreloader';
import { ShaderCompileScreen } from './ShaderCompileScreen';
import { DragonTrackWorld } from '../world/DragonTrackWorld';
import { CoastalSunsetTrackWorld } from '../world/CoastalSunsetTrackWorld';
import { lodManager } from '../world/lodManager';
import { terrainManager, TerrainManager } from '../world/TerrainManager';
import { forestSystem, ForestSystem } from '../world/forest';
import { MemoryPool } from '../utils/memoryPool';

// Dynamic modular systems integration
import { VehicleRenderer } from '../systems/VehicleRenderer';
import { CameraController } from '../systems/CameraController';
import { WeatherSystem } from '../systems/WeatherSystem';
import { LightingSystem } from '../systems/LightingSystem';
import { SkySystem } from '../systems/SkySystem';
import { RainSystem } from '../systems/RainSystem';
import { ParticleSystem } from '../systems/ParticleSystem';
import { TrailSystem } from '../systems/TrailSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { VehicleEffects } from '../systems/VehicleEffects';

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

// Shared global instances to preserve WebGL context and loaded GPU memory across React mount/unmount lifecycles
let globalRenderer: THREE.WebGLRenderer | null = null;
let globalCanvas: HTMLCanvasElement | null = null;

const GameCanvasComponent: React.FC<GameCanvasProps> = ({
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
  const flareRef = useRef<HTMLDivElement>(null);
  const speedVignetteRef = useRef<HTMLDivElement>(null);

  const [warming, setWarming] = React.useState(true);
  const [warmProgress, setWarmProgress] = React.useState(15);
  const [contextKey, setContextKey] = React.useState(0);

  useEffect(() => {
    const startTime = Date.now();
    let timer = setInterval(() => {
      if ((window as any).shadersCompiled || (Date.now() - startTime > 15000)) {
        if (Date.now() - startTime > 15000) {
          console.warn("Shader comp/loading state timed out. Forcing ready state.");
          (window as any).shadersCompiled = true;
        }
        setWarmProgress(100);
        clearInterval(timer);
        setTimeout(() => {
          setWarming(false);
        }, 850);
      } else {
        setWarmProgress(prev => {
          if (prev >= 95) return 95;
          return prev + 10;
        });
      }
    }, 200);

    return () => clearInterval(timer);
  }, []);

  const carsRef = useRef<CarState[]>(cars);
  const controlsRef = useRef<ControlsState>(playerControls);
  const gameStateRef = useRef<string>(gameState);
  const isPausedRef = useRef<boolean>(isPaused);
  const onFinishRaceRef = useRef<() => void>(onFinishRace);
  const onTickRef = useRef<(updatedCars: CarState[]) => void>(onTick);
  const soundEnabledRef = useRef<boolean>(soundEnabled);

  const timeOfDayRef = useRef<'morning' | 'noon' | 'sunset' | 'night'>(timeOfDay);
  const weatherRef = useRef<'sunny' | 'cloudy' | 'foggy' | 'rain'>(weather);

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
    if (!containerRef.current) return;

    let isUnmounted = false;

    // --- 1. DOM RE-PARENTING FOR INSTANT LIFECYCLE RECOVERY & ZERO CONTEXT LOSS ---
    if (!globalCanvas) {
      globalCanvas = document.createElement('canvas');
      globalCanvas.className = "block focus:outline-none";
      globalCanvas.style.position = "fixed";
      globalCanvas.style.inset = "0";
      globalCanvas.style.width = "100vw";
      globalCanvas.style.height = "100dvh";
      globalCanvas.style.display = "block";
      globalCanvas.style.margin = "0";
      globalCanvas.style.padding = "0";
      globalCanvas.style.borderRadius = "0";
      globalCanvas.style.maxWidth = "none";
      globalCanvas.style.outline = 'none';
      globalCanvas.style.border = 'none';
    }

    if (containerRef.current && globalCanvas.parentNode !== containerRef.current) {
      containerRef.current.appendChild(globalCanvas);
    }

    if (!globalRenderer) {
      globalRenderer = new THREE.WebGLRenderer({
        canvas: globalCanvas,
        antialias: false,
        powerPreference: 'high-performance',
        alpha: false,
        depth: true,
        stencil: false,
        precision: 'mediump',
      });
      globalRenderer.shadowMap.enabled = true;
      globalRenderer.shadowMap.type = THREE.PCFShadowMap;
      globalRenderer.outputColorSpace = THREE.SRGBColorSpace;
      globalRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      globalRenderer.toneMappingExposure = 1.0;
    }

    const renderer = globalRenderer;
    const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    renderer.setPixelRatio(isMobileDevice ? 1.0 : 1.5);
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);

    // --- 1B. CONTEXT LOSS RECOVERY HANDLING ---
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      console.warn('GameCanvas: WebGL Context Lost detected! Halting render buffer ticks...');
    };

    const handleContextRestored = () => {
      console.log('GameCanvas: WebGL Context Restored! Reinitializing materials and world systems.');
      try {
        if (globalRenderer) {
          globalRenderer.dispose();
        }
      } catch (err) {
        console.error('Error disposing globalRenderer on lost/restored:', err);
      }
      globalRenderer = null;
      globalCanvas = null;

      // Force state flags reset to rebuild objects
      DragonTrackWorld.initialized = false;
      CoastalSunsetTrackWorld.initialized = false;
      ForestSystem.initialized = false;
      TerrainManager.initialized = false;
      ShaderPreloader.initialized = false;
      ParticleSystem.initialized = false;
      VehicleRenderer.initialized = false;
      WeatherSystem.initialized = false;
      AudioSystem.initialized = false;

      // Trigger re-mount/re-initialization of WebGL context and assets
      setContextKey(prev => prev + 1);
    };

    globalCanvas.addEventListener('webglcontextlost', handleContextLost, false);
    globalCanvas.addEventListener('webglcontextrestored', handleContextRestored, false);

    // Reset window loading and compilation tracking flags for the new race
    (window as any).carLoaded = false;
    (window as any).playerCarAddedToScene = false;
    (window as any).mapLoaded = false;
    (window as any).shadersCompiled = false;
    (window as any).worldReady = false;

    // --- 1C. SCENE & CAMERA CONFIGURATION ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(62, 1, 0.4, 1800);

    // --- 2. ENVIRONMENT COLOR MAP FOR REFLECTIONS ---
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
    const isMap2 = trackHelper.mapType === 'map2';
    const dragonWorld = isMap2 
      ? new CoastalSunsetTrackWorld(scene, trackHelper) 
      : new DragonTrackWorld(scene, trackHelper);

    // Cache Watermill Wheels from the scene once at spawn to completely eliminate scene.traverse()
    const cachedWatermillWheels: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if (obj.name === 'watermill_wheel') {
        cachedWatermillWheels.push(obj);
      }
    });

    // --- 4. INITIALIZE MODULAR ARCHITECTURE SYSTEMS ---
    const weatherSystem = new WeatherSystem(scene);
    weatherSystem.setRenderer(renderer);

    const lightingSystem = new LightingSystem(scene);
    const skySystem = new SkySystem(scene);
    const rainSystem = new RainSystem(scene);
    const particleSystemWrapper = new ParticleSystem(scene);
    const trailSystem = new TrailSystem(scene);
    const audioSystem = new AudioSystem();
    const vehicleEffects = new VehicleEffects(scene);
    const cameraController = new CameraController(camera, 62, scene);
    const vehicleRenderer = new VehicleRenderer(scene, reflectionTex);
    const trafficAIService = new TrafficAIService(trackHelper);

    // Mark the world build and configuration phase complete
    (window as any).worldReady = true;

    // Warm up WebGL shader context on the fly
    (window as any).shadersCompiled = false;
    (async () => {
      try {
        await preloadGLTFAssets();
        await ShaderPreloader.preloadShaders(renderer, scene, camera);
      } catch (err) {
        console.warn("Shader warming error, proceeding standard:", err);
      } finally {
        (window as any).shadersCompiled = true;
      }
    })();

    // Spawn trackside street light glow elements (Preallocated geometry & batched color material cache)
    const bulbGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    const bulbMaterialCache = new Map<string, THREE.MeshBasicMaterial>();

    trackHelper.lights.forEach((lite) => {
      let mat = bulbMaterialCache.get(lite.color);
      if (!mat) {
        mat = new THREE.MeshBasicMaterial({ color: lite.color });
        bulbMaterialCache.set(lite.color, mat);
      }
      const bulb = new THREE.Mesh(bulbGeometry, mat);
      bulb.position.copy(lite.position);
      scene.add(bulb);

      const pl = new THREE.PointLight(lite.color, lite.intensity, 22, 0.5);
      pl.position.copy(lite.position);
      scene.add(pl);
    });

    // --- 5. CAMERA SPEED LINES IMPACT ---
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

    // --- 6. TICK RENDER LOOPS WITH ROLLING ADAPTIVE QUALITY ENGINE ---
    let animationId = 0;
    let oldTime = performance.now();
    let accumulatedTime = 0;
    const fixedDt = 1 / 60;
    let runningTime = 0;

    // Rolling FPS statistics
    let lastFrameTime = performance.now();
    const fpsSamples: number[] = [];
    let currentQuality = 2; // 2 = Extreme/Ultra (PCF Shadows enabled), 1 = Low (No Shadows and balanced pixelRatio)

    const tick = () => {
      if (isUnmounted) return;
      animationId = requestAnimationFrame(tick);
      const currentTime = performance.now();
      let elapsedSec = (currentTime - oldTime) / 1000;
      elapsedSec = Math.min(elapsedSec, 0.05);
      oldTime = currentTime;

      // Adaptive quality calculation
      const frameDelta = currentTime - lastFrameTime;
      lastFrameTime = currentTime;
      if (frameDelta > 0) {
        const instantFps = 1000 / frameDelta;
        fpsSamples.push(instantFps);
        if (fpsSamples.length > 45) {
          fpsSamples.shift();
          const avgFps = fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;
          if (avgFps < 55 && currentQuality > 1) {
            currentQuality = 1;
            console.warn(`Adaptive Quality scaling: Frame rate dropped to ${avgFps.toFixed(1)} FPS (< 55). Disabling heavy shadows to sustain 60 FPS.`);
            renderer.shadowMap.enabled = false;
            renderer.setPixelRatio(1.0);
            
            // Scaledown particle emissions and effects
            particleSystemWrapper.destroy(); // Recalibrate particle pools on the fly
          }
        }
      }

      const currentCars = carsRef.current ? [...carsRef.current] : [];
      if (currentCars.length === 0) return;

      const player = currentCars.find((c) => c.id === 'player');
      const activeWeather = weatherRef.current;
      const activeTimeOfDay = timeOfDayRef.current;

      // Update weather, skies and lighting environments
      weatherSystem.update(activeWeather, activeTimeOfDay, elapsedSec);
      if (weatherSystem.currentFogColor) {
        // Reuse-oriented fog allocation to completely bypass O(N) GC thrashing
        if (!scene.fog || !(scene.fog instanceof THREE.FogExp2)) {
          scene.fog = new THREE.FogExp2(weatherSystem.currentFogColor, weatherSystem.currentFogDensity);
        } else {
          scene.fog.color.set(weatherSystem.currentFogColor);
          scene.fog.density = weatherSystem.currentFogDensity;
        }
        renderer.setClearColor(weatherSystem.currentFogColor);
      }
      lightingSystem.update(activeWeather, activeTimeOfDay, elapsedSec);
      skySystem.update(activeWeather, activeTimeOfDay, elapsedSec);

      // Align sun light shadowing target relative to client car
      if (player && player.position && lightingSystem.sunLight) {
        lightingSystem.sunLight.position.set(player.position.x + 80, player.position.y + 220, player.position.z + 80);
        const playerGroup = vehicleRenderer.carGroupMap.get('player');
        if (playerGroup) {
          lightingSystem.sunLight.target = playerGroup;
        }
      }

      if (!isPausedRef.current && gameStateRef.current !== 'completed') {
        runningTime += elapsedSec;
        accumulatedTime += elapsedSec;

        while (accumulatedTime >= fixedDt) {
          const isRaceLocked = gameStateRef.current === 'countdown' || gameStateRef.current === 'menu';
          const playerCar = currentCars.find((c) => c.id === 'player');
          if (playerCar && playerCar.position && playerCar.velocity) {
            physicsService.updateCar(playerCar, fixedDt, controlsRef.current, isRaceLocked);
            physicsService.generateExhaustParticles(playerCar, fixedDt);
          }

          currentCars.forEach((c) => {
            if (c && c.position && c.velocity && c.isAI) {
              trafficAIService.updateAICar(c, fixedDt, currentCars, physicsService);
              physicsService.generateExhaustParticles(c, fixedDt);
            }
          });

          // Cleanly heal/recover any cars with NaN positions, out of bounds coordinates, or floating > 5m high
          currentCars.forEach((c) => {
            if (!c || !c.position) return;

            if (isNaN(c.position.x) || isNaN(c.position.y) || isNaN(c.position.z)) {
              console.warn(`Healing vehicle ${c.id} due to NaN positions.`);
              c.position.x = 0;
              c.position.y = 0;
              c.position.z = 0;
              c.velocity = { x: 0, y: 0, z: 0 };
              c.speed = 0;
              c.angle = 0;
              c.angularVelocity = 0;
              physicsService.recoverCarToNearestCheckpoint(c);
              return;
            }

            // Map Bounds Check
            if (Math.abs(c.position.x) > 3000 || c.position.z < -3000 || c.position.z > 4500) {
              console.warn(`Healing vehicle ${c.id} because it drifted outside map bounds.`);
              physicsService.recoverCarToNearestCheckpoint(c);
              return;
            }

            // Floating detection: check height relative to ground/road
            const roadY = terrainManager.queryRoadHeight(c.position);
            const terrainY = terrainManager.getHeight(c.position.x, c.position.z);
            const groundY = roadY !== null ? roadY : terrainY;
            if (c.position.y > groundY + 5.0) {
              console.warn(`Healing vehicle ${c.id} because it floated > 5.0m in the air.`);
              physicsService.recoverCarToNearestCheckpoint(c);
            }
          });

          physicsService.evaluatePositionsRanks(currentCars);
          particleSystemWrapper.update(physicsService, fixedDt);
          accumulatedTime -= fixedDt;
        }

        onTickRef.current(currentCars);

        if (player && player.position && player.isFinished && gameStateRef.current === 'racing') {
          onFinishRaceRef.current();
        }
      }

      // Live animated waterfall scrolls and spectator dynamics
      if (player && player.position) {
        const isFinished = player ? player.isFinished : false;
        const rank = player ? player.racePosition : 1;
        dragonWorld.update(elapsedSec, trackHelper, rank, isFinished, activeWeather);
      }

      // Animate Vehicles and Wheels
      vehicleRenderer.update(
        currentCars,
        controlsRef.current,
        elapsedSec,
        runningTime,
        terrainManager,
        activeWeather,
        activeTimeOfDay
      );

      // Animate vehicle effects (flames, light trails)
      vehicleEffects.update(currentCars, vehicleRenderer.carGroupMap);
      trailSystem.update(currentCars, elapsedSec);

      // Animate environmental features
      rainSystem.update(player, activeWeather, elapsedSec);

      // Animate cached Watermill Wheels (zero scene.traverse)
      cachedWatermillWheels.forEach((obj) => {
        if (obj.userData && obj.userData.isRotating) {
          obj.rotation.z += elapsedSec * obj.userData.rotationSpeed;
        }
      });

      if (player && player.position) {
        const velocityMagnitude = player.velocity ? Math.sqrt(player.velocity.x ** 2 + player.velocity.z ** 2) : 0;

        // Level Of Detail dynamic geometry culling around player's position
        const pPos = MemoryPool.getVector().set(player.position.x, player.position.y, player.position.z);
        terrainManager.playerPos.copy(pPos);
        lodManager.update(pPos);

        // Update Camera Controller and shake rumble
        cameraController.update(player, elapsedSec, controlsRef.current);

        // Render Speed lines
        const shouldShowSpeedLines = velocityMagnitude > 40;
        linesPool.forEach((lineMesh) => {
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

        // Speed Vignette UI Overlay
        if (speedVignetteRef.current) {
          const speedFactor = THREE.MathUtils.clamp((velocityMagnitude - 32) / 36, 0, 1);
          speedVignetteRef.current.style.opacity = String(speedFactor * (player.isNitroActive ? 0.92 : 0.65));
        }

        // --- 7. DYNAMIC CINEMATIC LENS FLARE SHIFTING ---
        if (flareRef.current && skySystem.sunDisk) {
          // Zero runtime vector allocating via MemoryPool
          const sunWorldPos = MemoryPool.getVector().copy(skySystem.sunDisk.position);
          const screenPos = sunWorldPos.project(camera);

          if (screenPos.z < 1) { // Check that sun is in front of camera frustum
            const flareX = (screenPos.x * 0.5 + 0.5) * containerRef.current!.clientWidth;
            const flareY = (-screenPos.y * 0.5 + 0.5) * containerRef.current!.clientHeight;

            const buffer = 45;
            const w = containerRef.current!.clientWidth;
            const h = containerRef.current!.clientHeight;
            const isOutOfEdges = flareX < -buffer || flareX > w + buffer || flareY < -buffer || flareY > h + buffer;
            const isObscured = (activeTimeOfDay === 'night' || activeWeather === 'foggy' || activeWeather === 'rain');

            if (!isOutOfEdges && !isObscured) {
              flareRef.current.style.opacity = '1';
              const kids = flareRef.current.children;
              if (kids.length >= 6) {
                const screenCenterX = w / 2;
                const screenCenterY = h / 2;
                const dx = flareX - screenCenterX;
                const dy = flareY - screenCenterY;

                (kids[0] as HTMLElement).style.transform = `translate(${flareX - 56}px, ${flareY - 56}px)`;
                (kids[1] as HTMLElement).style.transform = `translate(${screenCenterX + dx * 0.44 - 28}px, ${screenCenterY + dy * 0.44 - 28}px)`;
                (kids[2] as HTMLElement).style.transform = `translate(${screenCenterX - dx * 0.28 - 16}px, ${screenCenterY - dy * 0.28 - 16}px)`;
                (kids[3] as HTMLElement).style.transform = `translate(${screenCenterX - dx * 0.62 - 36}px, ${screenCenterY - dy * 0.62 - 36}px)`;
                (kids[4] as HTMLElement).style.transform = `translate(${screenCenterX - dx * 1.15 - 48}px, ${screenCenterY - dy * 1.15 - 48}px)`;
                (kids[5] as HTMLElement).style.transform = `translate(${screenCenterX - dx * 1.8 - 80}px, ${screenCenterY - dy * 1.8 - 80}px)`;
              }
            } else {
              flareRef.current.style.opacity = '0';
            }
          }
        }

        // --- 8. AUDIO UPDATE SYSTEMS ---
        const isDrifting = player.isDrifting || false;
        audioSystem.update(
          player.speed,
          player.isNitroActive,
          isDrifting,
          isPausedRef.current,
          soundEnabledRef.current,
          gameStateRef.current
        );
      }

      renderer.render(scene, camera);
    };

    tick();

    // Observer resize handling
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
      isUnmounted = true;
      cancelAnimationFrame(animationId);
      resizeObs.disconnect();
      
      // Clean up event listeners on our persistent canvas
      if (globalCanvas) {
        globalCanvas.removeEventListener('webglcontextlost', handleContextLost);
        globalCanvas.removeEventListener('webglcontextrestored', handleContextRestored);
        
        // Dynamic DOM re-parenting: swap out canvas elegantly
        if (globalCanvas.parentNode === containerRef.current) {
          containerRef.current.removeChild(globalCanvas);
        }
      }

      reflectionTex.dispose();

      // System Disposals representing clean lifecycle hooks
      weatherSystem.setRenderer(null as any);
      lightingSystem.sunLight?.dispose();
      lightingSystem.ambLight?.dispose();
      skySystem.skyDome?.geometry.dispose();
      (skySystem.skyDome?.material as THREE.Material)?.dispose();
      skySystem.sunDisk?.geometry.dispose();
      (skySystem.sunDisk?.material as THREE.Material)?.dispose();
      skySystem.sunGlow?.geometry.dispose();
      (skySystem.sunGlow?.material as THREE.Material)?.dispose();

      rainSystem.destroy();
      particleSystemWrapper.destroy();
      trailSystem.destroy();
      audioSystem.destroy();
      vehicleEffects.destroy();
      vehicleRenderer.destroy();
      forestSystem.destroy();

      // Geometry and materials from speed lines
      lGeo.dispose();
      lMat.dispose();

      // Clear cached streetlight resources to avoid memory leaks
      bulbGeometry.dispose();
      bulbMaterialCache.forEach((mat) => mat.dispose());

      // Clear static singletons to prevent memory leaks and recreate cleanly next time
      lodManager.clear();
      terrainManager.clear();

      // Reset static initialization flags completely to allow a clean second mount
      DragonTrackWorld.initialized = false;
      CoastalSunsetTrackWorld.initialized = false;
      ForestSystem.initialized = false;
      TerrainManager.initialized = false;
      ShaderPreloader.initialized = false;
      ParticleSystem.initialized = false;
      VehicleRenderer.initialized = false;
      WeatherSystem.initialized = false;
      AudioSystem.initialized = false;

      (window as any).carLoaded = false;
      (window as any).playerCarAddedToScene = false;
      (window as any).mapLoaded = false;
      (window as any).shadersCompiled = false;
      (window as any).worldReady = false;
    };
  }, [physicsService, trackHelper, contextKey]);

  return (
    <div 
      ref={containerRef} 
      id="canvas-container" 
      className="m-0 p-0 rounded-none max-w-none border-none outline-none overflow-hidden"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        zIndex: 0,
        margin: 0,
        padding: 0,
        borderRadius: 0,
        maxWidth: 'none',
        outline: 'none',
        border: 'none',
      }}
    >
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

      {warming && <ShaderCompileScreen progress={warmProgress} />}
    </div>
  );
};

export const GameCanvas = React.memo(
  GameCanvasComponent,
  (prevProps, nextProps) => {
    // Only re-render when structural inputs or core settings change
    return (
      prevProps.trackHelper === nextProps.trackHelper &&
      prevProps.physicsService === nextProps.physicsService &&
      prevProps.soundEnabled === nextProps.soundEnabled &&
      prevProps.timeOfDay === nextProps.timeOfDay &&
      prevProps.weather === nextProps.weather &&
      prevProps.gameState === nextProps.gameState &&
      prevProps.isPaused === nextProps.isPaused
    );
  }
);
