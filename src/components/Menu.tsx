/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { useAuth } from '../contexts/AuthContext';
import { Difficulty, GameSettings } from '../types';
import { 
  Zap, Trophy, HelpCircle, Sparkles, Download, CheckCircle, 
  AlertOctagon, Users, Radio, Key, Coins, Gem, Car, ArrowLeft, 
  Plus, Paintbrush, Wrench, Play, X, Compass, ChevronRight, Star, Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { loadSpecificCarModel, gltfModelCache, setPlayerSelectedModelKey } from '../world/procedural';
import { NormalRoomService, NormalRoom, NormalPlayer } from '../multiplayer/NormalRoomService';
import { RoomCodeGenerator } from '../multiplayer/RoomCodeGenerator';

// Preview frames
import lamboPreview from '../assets/images/lambo_garage_1781251735063.jpg';
import ferrariPreview from '../assets/images/ferrari_garage_1781251750236.jpg';
import bugattiPreview from '../assets/images/bugatti_garage_1781251768295.jpg';
import porschePreview from '../assets/images/porsche_garage_1781251783563.jpg';

interface MenuProps {
  onStartGame: (settings: GameSettings) => void;
  onCreateRoom?: (settings: GameSettings, isLiveMode?: boolean) => void;
  onJoinRoom?: (settings: GameSettings) => void;
}

const CARS_GARAGE = [
  {
    id: 'lamborghini' as const,
    name: 'Lamborghini Aventador',
    image: lamboPreview,
    class: 'S CLASS',
    topSpeed: 350,
    acceleration: '2.9s',
    handling: 85,
    power: '720 HP',
    stars: 5,
    xp: 82,
    oil: 95,
    engine: 90,
    chassis: 75,
    desc: 'V12 naturally-aspirated aerodynamic monster with roaring track energy.',
    colorPreset: '#ff5500',
    scale: 0.85
  },
  {
    id: 'ferrari' as const,
    name: 'Ferrari Purosangue',
    image: ferrariPreview,
    class: 'A CLASS',
    topSpeed: 310,
    acceleration: '3.3s',
    handling: 90,
    power: '715 HP',
    stars: 4,
    xp: 41,
    oil: 40,
    engine: 85,
    chassis: 95,
    desc: 'Supreme active-suspension SUV utilities delivering unmatched active stability.',
    colorPreset: '#ff003c',
    scale: 0.85
  },
  {
    id: 'bugatti' as const,
    name: 'Bugatti Chiron',
    image: bugattiPreview,
    class: 'HYPER CLASS',
    topSpeed: 420,
    acceleration: '2.4s',
    handling: 80,
    power: '1500 HP',
    stars: 5,
    xp: 95,
    oil: 15,
    engine: 95,
    chassis: 85,
    desc: 'Unmatched continuous speed powered by a monstrous quad-turbo W16.',
    colorPreset: '#00ccff',
    scale: 0.82
  },
  {
    id: 'porsche' as const,
    name: 'Porsche 911 GT3',
    image: porschePreview,
    class: 'A CLASS',
    topSpeed: 320,
    acceleration: '3.2s',
    handling: 98,
    power: '502 HP',
    stars: 5,
    xp: 68,
    oil: 92,
    engine: 92,
    chassis: 60,
    desc: 'Surgeon-like track precision crafted directly from pure GT motorsport heritage.',
    colorPreset: '#00ff3c',
    scale: 0.85
  },
];

const METALLIC_COLORS = [
  { name: 'Speed Orange', hex: '#ff5500' },
  { name: 'Rosso Red', hex: '#ff003c' },
  { name: 'Nitro Green', hex: '#00ff3c' },
  { name: 'Hyper Blue', hex: '#00ccff' },
  { name: 'Giallo Yellow', hex: '#ffe600' },
  { name: 'Viper Purple', hex: '#ab00ff' },
  { name: 'Carbon Matte', hex: '#111111' },
  { name: 'Titanium White', hex: '#f0f3ff' },
];

export const Menu: React.FC<MenuProps> = ({ onStartGame, onCreateRoom, onJoinRoom }) => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Selected vehicle settings
  const [selectedCar, setSelectedCar] = useState<'lamborghini' | 'ferrari' | 'bugatti' | 'porsche'>('lamborghini');
  const [carColor, setCarColor] = useState('#ff5500');
  const [selectedMap, setSelectedMap] = useState<'map1' | 'map2'>('map1');
  const [playerName, setPlayerName] = useState(profile?.name || 'Speedster');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [isLiveMode, setIsLiveMode] = useState(false);

  // Asset prepares status
  const [loadStatus, setLoadStatus] = useState<'idle' | 'downloading' | 'ready' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);

  // Maintenance Restore State
  const [showMaintenanceSplash, setShowMaintenanceSplash] = useState(false);
  const [maintenanceLevels, setMaintenanceLevels] = useState<{ oil: number; engine: number; chassis: number }>({
    oil: 95,
    engine: 90,
    chassis: 75
  });

  // Top Bar In-game currencies state
  const [trophicCount, setTrophicCount] = useState(2450);
  const [coinCount, setCoinCount] = useState(18250);
  const [diamondCount, setDiamondCount] = useState(450);
  const [keyCount, setKeyCount] = useState(12);

  // Dynamic customization preset toggle
  const [customizerOpen, setCustomizerOpen] = useState(false);

  // MULTIPLAYER POPUPS & LOBBIES STATES
  const [activePopup, setActivePopup] = useState<'none' | 'create_room' | 'join_room' | 'lobby'>('none');
  const [createdRoomName, setCreatedRoomName] = useState(`${playerName}'s Grid`);
  const [generatedCode, setGeneratedCode] = useState('');
  const [enteredJoinCode, setEnteredJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  // Firestore Room synced lists
  const [syncedRoom, setSyncedRoom] = useState<NormalRoom | null>(null);
  const [syncedPlayers, setSyncedPlayers] = useState<NormalPlayer[]>([]);
  const [countdownMsg, setCountdownMsg] = useState('');
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // 3D Showroom Refs
  const showroomCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const carGroupRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  // Synchronize dynamic metadata based on choice
  const currentVehicleMetadata = CARS_GARAGE.find(c => c.id === selectedCar)!;

  // Track change values on select
  useEffect(() => {
    // Sync current color and maintenance specs
    setCarColor(currentVehicleMetadata.colorPreset);
    setMaintenanceLevels({
      oil: currentVehicleMetadata.oil,
      engine: currentVehicleMetadata.engine,
      chassis: currentVehicleMetadata.chassis
    });
  }, [selectedCar]);

  // Load selected model for live rendering on showroom scene
  useEffect(() => {
    let isCancelled = false;

    const triggerPreload = async () => {
      try {
        await loadSpecificCarModel(selectedCar, () => {});
        if (isCancelled) return;

        // Rebuilt mesh inside showroom
        rebuildShowroomCar();
      } catch (err) {
        console.error("3D Showroom failed downloading:", err);
      }
    };

    triggerPreload();
    return () => {
      isCancelled = true;
    };
  }, [selectedCar]);

  // Interactive 3D Showroom Setup
  useEffect(() => {
    if (!showroomCanvasRef.current) return;

    let animFrame: number;
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Dark majestic atmospheric smoke/fog
    scene.background = new THREE.Color('#03050a');
    scene.fog = new THREE.FogExp2('#03050a', 0.08);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    // Low camera angle inspired by NFS/Asphalt
    camera.position.set(0, 0.75, 5.0);

    const renderer = new THREE.WebGLRenderer({
      canvas: showroomCanvasRef.current,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    // Resize controller
    const resizeHandler = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    resizeHandler();
    window.addEventListener('resize', resizeHandler);

    // Grid Floor with dynamic shadows & glossy metallics
    const floorGeo = new THREE.PlaneGeometry(50, 50);
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#080d1a',
      roughness: 0.15,
      metalness: 0.9,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.12;
    floor.receiveShadow = true;
    scene.add(floor);

    // Glowing Neon Grid accents line
    const gridHelper = new THREE.GridHelper(40, 40, '#00f2ff', '#101630');
    gridHelper.position.y = -0.11;
    (gridHelper.material as any).opacity = 0.12;
    (gridHelper.material as any).transparent = true;
    scene.add(gridHelper);

    // Blue Neon accent standing lights inside the premium garage
    const neonMatCyan = new THREE.MeshBasicMaterial({ color: '#00f2ff' });
    const neonMatBlue = new THREE.MeshBasicMaterial({ color: '#003cff' });

    // Tubes left and right
    const tubeGeo = new THREE.CylinderGeometry(0.015, 0.015, 6, 8);
    
    const tube1 = new THREE.Mesh(tubeGeo, neonMatCyan);
    tube1.position.set(-3.2, 2.5, -3.0);
    scene.add(tube1);

    const tube2 = new THREE.Mesh(tubeGeo, neonMatBlue);
    tube2.position.set(3.2, 2.5, -3.0);
    scene.add(tube2);

    const tube3 = new THREE.Mesh(tubeGeo, neonMatCyan);
    tube3.position.set(-4.0, 2.5, 1.0);
    scene.add(tube3);

    const tube4 = new THREE.Mesh(tubeGeo, neonMatBlue);
    tube4.position.set(4.0, 2.5, 1.0);
    scene.add(tube4);

    // Add neon light points for shiny reflections
    const rLightLeft = new THREE.PointLight('#00f2ff', 4.0, 15);
    rLightLeft.position.set(-3.2, 1.2, -1.0);
    scene.add(rLightLeft);

    const rLightRight = new THREE.PointLight('#0033ff', 4.0, 15);
    rLightRight.position.set(3.2, 1.2, -1.0);
    scene.add(rLightRight);

    // Scene Main light rigging
    const ambientLight = new THREE.AmbientLight('#0b1022', 1.2);
    scene.add(ambientLight);

    // Top primary warm spot highlighting car center
    const mainSpot = new THREE.SpotLight('#ffffff', 15.0, 12, Math.PI / 4, 0.5, 1.0);
    mainSpot.position.set(0, 4.0, 1.5);
    mainSpot.castShadow = true;
    mainSpot.shadow.bias = -0.0002;
    mainSpot.shadow.mapSize.width = 1024;
    mainSpot.shadow.mapSize.height = 1024;
    scene.add(mainSpot);

    // Cinematic back light
    const backSpot = new THREE.DirectionalLight('#42c1f9', 2.0);
    backSpot.position.set(0, 2.5, -4.0);
    scene.add(backSpot);

    // Sparkles particles
    const particleCount = 80;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 8.0;
      positions[i * 3 + 1] = Math.random() * 3.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8.0;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: '#00f2ff',
      size: 0.02,
      transparent: true,
      opacity: 0.45,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Continuous 60 fps rendering loop
    let angle = 0;
    const renderLoop = () => {
      animFrame = requestAnimationFrame(renderLoop);

      // Slow orbital rotate around the car index (parallax cameras)
      angle += 0.0022; // very slow cinematic rotation
      camera.position.x = 4.3 * Math.cos(angle);
      camera.position.z = 4.3 * Math.sin(angle);
      camera.lookAt(0, 0.22, 0);

      // Rotate sparkles
      particles.rotation.y += 0.001;

      // Render scene
      renderer.render(scene, camera);
    };
    animFrame = requestAnimationFrame(renderLoop);

    return () => {
      window.removeEventListener('resize', resizeHandler);
      cancelAnimationFrame(animFrame);
      renderer.dispose();
    };
  }, []);

  // Live render color changer
  useEffect(() => {
    if (!carGroupRef.current) return;
    updateMaterialColors(carGroupRef.current, carColor);
  }, [carColor]);

  // Methods to traverse and apply custom paint live
  const updateMaterialColors = (model: THREE.Group, hex: string) => {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const name = child.name.toLowerCase();
        // Match common car paint material nodes
        if (
          name.includes('paint') || 
          name.includes('body') || 
          name.includes('car_paint') || 
          child.material.name?.toLowerCase().includes('paint') ||
          child.material.name?.toLowerCase().includes('car_paint') ||
          (child.material instanceof THREE.MeshStandardMaterial && child.material.roughness < 0.15 && child.material.metalness > 0.8)
        ) {
          if (child.material instanceof THREE.Material) {
            if ('color' in child.material) {
              (child.material as any).color.set(hex);
            }
          }
        }
      }
    });
  };

  const rebuildShowroomCar = () => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Flush old car meshes
    if (carGroupRef.current) {
      scene.remove(carGroupRef.current);
      carGroupRef.current = null;
    }

    const modelKey = selectedCar === 'lamborghini' ? 'lamborghini_aventador' :
                     selectedCar === 'ferrari' ? 'ferrari_purosangue' :
                     selectedCar === 'bugatti' ? 'bugatti_chiron_top_edition' :
                     'porsche_911_gt3';

    const baseModel = gltfModelCache[modelKey];
    if (baseModel) {
      const cloned = baseModel.clone();
      cloned.position.set(0, -0.05, 0);
      cloned.rotation.y = 0;
      
      const s = currentVehicleMetadata.scale;
      cloned.scale.set(s, s, s);

      // Traverses shadow mappings config
      cloned.traverse(c => {
        if (c instanceof THREE.Mesh) {
          c.castShadow = true;
          c.receiveShadow = true;
          if (c.material) {
            c.material.needsUpdate = true;
          }
        }
      });

      // Apply hex paint color
      updateMaterialColors(cloned, carColor);

      scene.add(cloned);
      carGroupRef.current = cloned;
    }
  };

  // Launch single-player gameplay pipeline
  const handleStartProcess = async (action: 'single' | 'create' | 'join') => {
    setLoadStatus('downloading');
    setProgress(0);

    try {
      await loadSpecificCarModel(selectedCar, (pct) => {
        setProgress(pct);
      });

      setProgress(100);
      setLoadStatus('ready');

      // 1.5s delay for dynamic visual confirmation feedback
      setTimeout(() => {
        const payload: GameSettings = {
          playerName: playerName.trim() || 'Racer',
          difficulty,
          carColor,
          selectedCar,
          selectedMap
        };

        const modelKey = selectedCar === 'lamborghini' ? 'lamborghini_aventador' :
                         selectedCar === 'ferrari' ? 'ferrari_purosangue' :
                         selectedCar === 'bugatti' ? 'bugatti_chiron_top_edition' :
                         'porsche_911_gt3';
        setPlayerSelectedModelKey(modelKey);

        if (action === 'single') {
          onStartGame(payload);
          navigate('/race');
        }
      }, 1200);

    } catch (err) {
      console.error("Preparation crashed:", err);
      setLoadStatus('failed');
    }
  };

  // MULTIPLAYER FIREBASE OPERATIONS
  const handleCreateRoomClick = () => {
    // Generates a AAA style room code (e.g. BLAZE456)
    const code = RoomCodeGenerator.generate();
    setGeneratedCode(code.toUpperCase());
    setCreatedRoomName(`${playerName}'s Grid`);
    setActivePopup('create_room');
  };

  const handleConfirmCreateRoom = async () => {
    if (!profile) return;
    try {
      // Use Firestore Room creation
      await NormalRoomService.createRoom(
        profile.uid,
        playerName || 'Racer',
        profile.photoURL || '',
        selectedCar,
        selectedMap
      );
      
      // Override or write the room setup custom generated code if necessary, or let Room Manager manage
      // Write custom code with Firebase NormalRoomService standard
      // Since NormalRoomService uses dynamic autogen inside, let's trigger and sync listen!
      subscribeToRoomListeners(generatedCode);
      setActivePopup('lobby');
    } catch (err) {
      console.error(err);
    }
  };

  const handleJoinRoomClick = () => {
    setEnteredJoinCode('');
    setJoinError(null);
    setActivePopup('join_room');
  };

  const handleConfirmJoinRoom = async () => {
    if (!profile) return;
    const cleanCode = enteredJoinCode.trim().toUpperCase();
    if (cleanCode.length < 4) {
      setJoinError('Enter a valid room code!');
      return;
    }

    try {
      await NormalRoomService.joinRoom(
        cleanCode,
        profile.uid,
        playerName || 'Racer',
        profile.photoURL || ''
      );
      
      subscribeToRoomListeners(cleanCode);
      setActivePopup('lobby');
    } catch (err: any) {
      setJoinError(err.message || 'Room code not found or lobby list full.');
    }
  };

  // Subscribes live listeners to firestore matchmaking room
  const subscribeToRoomListeners = (code: string) => {
    const cleanCode = code.toUpperCase().trim();
    setGeneratedCode(cleanCode);

    const unsubRoom = NormalRoomService.listenToRoom(cleanCode, (room) => {
      if (!room) {
        // Canceled
        setActivePopup('none');
        return;
      }
      setSyncedRoom(room);

      // Handle racing trigger redirection
      if (room.status === 'racing') {
        navigate(`/race/${cleanCode}`);
      }
    });

    const unsubPlayers = NormalRoomService.listenToPlayers(cleanCode, (players) => {
      setSyncedPlayers(players);
    });

    // Save unsubscribe to clean up when we leave
    (window as any).activeRoomUnsubscribers = [unsubRoom, unsubPlayers];
  };

  // Clean room subscriptions
  const cleanRoomListeners = () => {
    if ((window as any).activeRoomUnsubscribers) {
      (window as any).activeRoomUnsubscribers.forEach((fn: any) => fn());
      (window as any).activeRoomUnsubscribers = null;
    }
  };

  const handleLeaveLobby = async () => {
    if (!profile || !generatedCode) return;
    try {
      cleanRoomListeners();
      await NormalRoomService.leaveOrCancelRoom(generatedCode, profile.uid);
      setActivePopup('none');
      setSyncedRoom(null);
      setSyncedPlayers([]);
      setSecondsLeft(null);
    } catch (e) {
      console.error(e);
    }
  };

  // Count down logic in Lobby
  useEffect(() => {
    if (!syncedRoom || syncedRoom.status !== 'countdown') {
      setSecondsLeft(null);
      return;
    }

    if (secondsLeft === null) {
      setSecondsLeft(5);
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null) return 5;
        if (prev <= 1) {
          clearInterval(interval);
          setCountdownMsg('GO!');
          
          setTimeout(() => {
            const isHost = syncedRoom && profile ? syncedRoom.ownerUid === profile.uid : false;
            if (isHost) {
              NormalRoomService.setRoomStatus(generatedCode, 'racing');
            }
            navigate(`/race/${generatedCode}`);
          }, 800);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [syncedRoom?.status, secondsLeft]);

  // Restores repair status to 100% with sound effects
  const handleRestoreMaintenance = () => {
    setShowMaintenanceSplash(true);
    setMaintenanceLevels({ oil: 100, engine: 100, chassis: 100 });
    setTimeout(() => {
      setShowMaintenanceSplash(false);
    }, 1000);
  };

  // Add keys, coins, items
  const handleResourceAdd = (type: 'trophy' | 'key' | 'coin' | 'diamond') => {
    if (type === 'trophy') setTrophicCount(prev => prev + 50);
    if (type === 'key') setKeyCount(prev => prev + 1);
    if (type === 'coin') setCoinCount(prev => prev + 1000);
    if (type === 'diamond') setDiamondCount(prev => prev + 100);
  };

  return (
    <div 
      ref={containerRef}
      id="game-garage-root" 
      className="relative w-screen h-[100dvh] overflow-hidden bg-black text-white select-none m-0 p-0 rounded-none max-w-none border-none outline-none font-sans"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        overflow: 'hidden'
      }}
    >
      {/* 3D WebGL Canvas Showroom background */}
      <canvas ref={showroomCanvasRef} className="absolute inset-0 z-0 w-full h-full block" />

      {/* Volumetric neon background fog shadows overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-t from-black via-transparent to-black/40" />

      {/* TOP BAR (Height: 80px) */}
      <div 
        id="top-bar-hud"
        className="absolute top-0 left-0 right-0 h-20 z-20 px-8 flex items-center justify-between border-b border-white/5 shadow-2xl"
        style={{
          background: 'rgba(5, 5, 5, 0.45)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Left Side: Back / Title */}
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate('/')} 
            className="p-2 border border-white/10 rounded-xl hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-slate-200" />
          </button>
          <div className="h-8 w-[1px] bg-white/10" />
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg shadow-lg">
              <Car className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-[9px] uppercase font-black tracking-widest text-[#00f2ff] block">GRID ARENA SHOWROOM</span>
              <h2 className="text-xl font-black uppercase tracking-tighter text-white font-sans">GARAGE</h2>
            </div>
          </div>
        </div>

        {/* Right Side: Currency Counters */}
        <div className="flex items-center space-x-5 font-mono">
          {/* Trophy Count */}
          <div className="flex items-center space-x-2 bg-black/60 border border-white/5 rounded-xl px-3.5 py-1.5 relative group">
            <Trophy className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="text-sm font-black text-white">{trophicCount.toLocaleString()}</span>
            <button 
              onClick={() => handleResourceAdd('trophy')}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black p-1 text-[8px] rounded-md transition-all active:scale-95 flex items-center justify-center shrink-0 ml-1 hover:brightness-110 cursor-pointer"
            >
              <Plus className="w-2.5 h-2.5 stroke-[4px]" />
            </button>
          </div>

          {/* Keys */}
          <div className="flex items-center space-x-2 bg-black/60 border border-white/5 rounded-xl px-3.5 py-1.5 relative group">
            <Key className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-black text-white">{keyCount}</span>
            <button 
              onClick={() => handleResourceAdd('key')}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black p-1 text-[8px] rounded-md transition-all active:scale-95 flex items-center justify-center shrink-0 ml-1 hover:brightness-110 cursor-pointer"
            >
              <Plus className="w-2.5 h-2.5 stroke-[4px]" />
            </button>
          </div>

          {/* Coins */}
          <div className="flex items-center space-x-2 bg-black/60 border border-white/5 rounded-xl px-3.5 py-1.5 relative group">
            <Coins className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="text-sm font-black text-white">{coinCount.toLocaleString()}</span>
            <button 
              onClick={() => handleResourceAdd('coin')}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black p-1 text-[8px] rounded-md transition-all active:scale-95 flex items-center justify-center shrink-0 ml-1 hover:brightness-110 cursor-pointer"
            >
              <Plus className="w-2.5 h-2.5 stroke-[4px]" />
            </button>
          </div>

          {/* Diamonds */}
          <div className="flex items-center space-x-2 bg-black/60 border border-white/5 rounded-xl px-3.5 py-1.5 relative group">
            <Gem className="w-4 h-4 text-[#00f2ff] fill-[#00a6ff]" />
            <span className="text-sm font-black text-white">{diamondCount}</span>
            <button 
              onClick={() => handleResourceAdd('diamond')}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black p-1 text-[8px] rounded-md transition-all active:scale-95 flex items-center justify-center shrink-0 ml-1 hover:brightness-110 cursor-pointer"
            >
              <Plus className="w-2.5 h-2.5 stroke-[4px]" />
            </button>
          </div>
        </div>
      </div>

      {/* LEFT PANEL: Glass panel for vehicle info */}
      <motion.div 
        initial={{ opacity: 0, x: -120 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        id="garage-left-panel"
        className="absolute left-6 top-24 bottom-24 w-80 z-20 rounded-3xl border border-white/10 p-5 flex flex-col justify-between overflow-hidden shadow-2xl"
        style={{
          background: 'rgba(5, 5, 5, 0.45)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="space-y-4">
          {/* Class Class Class badge & Star rating */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black tracking-[4px] px-3.5 py-1.5 rounded-full bg-gradient-to-r from-red-600 to-amber-500 text-white shadow-xl shadow-red-500/20">
              {currentVehicleMetadata.class}
            </span>
            <div className="flex space-x-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star 
                  key={i} 
                  className={`w-4 h-4 ${
                    i < currentVehicleMetadata.stars 
                      ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_8px_java(140,55,0,0.85)]' 
                      : 'text-white/20'
                  }`} 
                />
              ))}
            </div>
          </div>

          {/* Car Name */}
          <div className="space-y-1 py-1">
            <h1 className="text-3xl font-black uppercase tracking-tighter text-white max-h-[80px] leading-none">
              {currentVehicleMetadata.name.split(' ')[0]}
            </h1>
            <h2 className="text-2xl font-light uppercase tracking-wide text-white/70 leading-none">
              {currentVehicleMetadata.name.split(' ').slice(1).join(' ')}
            </h2>
          </div>

          <p className="text-[11px] text-[#7ee1fc]/80 font-mono leading-relaxed bg-[#7ee1fc]/5 border border-[#7ee1fc]/10 p-2.5 rounded-2xl">
            {currentVehicleMetadata.desc}
          </p>

          {/* Driver details inputs & difficulty options */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <span className="text-[8px] uppercase tracking-widest font-bold text-slate-400">Driver License Name</span>
            <input 
              type="text" 
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value.slice(0, 16))}
              className="w-full bg-black/60 border border-white/10 focus:border-[#00f2ff]/60 px-3.5 py-2 rounded-xl text-xs font-black text-white outline-none transition-all font-mono uppercase"
            />
          </div>

          {/* Grid difficulty selection */}
          <div className="space-y-2">
            <span className="text-[8px] uppercase tracking-widest font-bold text-slate-400">Grid Enemy Difficulty</span>
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map(l => (
                <button
                  key={l}
                  onClick={() => setDifficulty(l)}
                  className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all cursor-pointer ${
                    difficulty === l
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Maintenance Diagnostics specs */}
        <div className="space-y-3 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">DIAGNOSTICS</span>
            <span className="text-[8px] font-mono text-emerald-400">STATUS LEVEL: OK</span>
          </div>

          {/* Oil status indicator */}
          <div className="space-y-1">
            <div className="flex justify-between text-[9px] font-mono text-slate-400">
              <span>OIL RECHARGE</span>
              <span className={`font-bold ${
                maintenanceLevels.oil > 80 ? 'text-emerald-400' : maintenanceLevels.oil > 30 ? 'text-amber-500' : 'text-red-500'
              }`}>{maintenanceLevels.oil}%</span>
            </div>
            <div className="w-full h-1.5 bg-black/80 rounded-full overflow-hidden border border-white/5">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  maintenanceLevels.oil > 80 ? 'bg-emerald-400' : maintenanceLevels.oil > 30 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${maintenanceLevels.oil}%` }}
              />
            </div>
          </div>

          {/* Engine status indicator */}
          <div className="space-y-1">
            <div className="flex justify-between text-[9px] font-mono text-slate-400">
              <span>ENGINE COMPRESSION</span>
              <span className="font-bold text-emerald-400">{maintenanceLevels.engine}%</span>
            </div>
            <div className="w-full h-1.5 bg-black/80 rounded-full overflow-hidden border border-white/5">
              <div 
                className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                style={{ width: `${maintenanceLevels.engine}%` }}
              />
            </div>
          </div>

          {/* Chassis integrity status indicator */}
          <div className="space-y-1">
            <div className="flex justify-between text-[9px] font-mono text-slate-400">
              <span>SUSPENSION INTEGRITY</span>
              <span className={`font-bold ${
                maintenanceLevels.chassis > 70 ? 'text-emerald-400' : 'text-amber-500'
              }`}>{maintenanceLevels.chassis}%</span>
            </div>
            <div className="w-full h-1.5 bg-black/80 rounded-full overflow-hidden border border-white/5">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  maintenanceLevels.chassis > 70 ? 'bg-emerald-400' : 'bg-amber-500'
                }`}
                style={{ width: `${maintenanceLevels.chassis}%` }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* RIGHT PANEL: Animated Performance Bars (inspired by CarX Drift Racing) */}
      <motion.div 
        initial={{ opacity: 0, x: 120 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        id="performance-right-panel"
        className="absolute right-6 top-24 bottom-24 w-80 z-20 rounded-3xl border border-white/10 p-5 flex flex-col justify-between"
        style={{
          background: 'rgba(5, 5, 5, 0.45)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="space-y-5">
          <div className="border-b border-white/5 pb-2">
            <span className="text-[10px] font-black tracking-widest text-[#00f2ff] uppercase block">VEHICLE SPECS</span>
            <h3 className="text-sm font-black uppercase text-white font-mono">TUNING DATAS</h3>
          </div>

          {/* POWER SPEC (Orange) */}
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Engine Power</span>
              <span className="text-sm font-mono font-black text-white">{currentVehicleMetadata.power}</span>
            </div>
            <div className="relative w-full h-2.5 bg-black/80 rounded-lg overflow-hidden border border-white/5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: selectedCar === 'bugatti' ? '100%' : selectedCar === 'lamborghini' ? '80%' : selectedCar === 'ferrari' ? '74%' : '55%' }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-lg shadow-[0_0_12px_rgba(234,88,12,0.4)]"
              />
            </div>
          </div>

          {/* ACCELERATION SPEC (Green) */}
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">0 - 100 Accel</span>
              <span className="text-sm font-mono font-black text-white">{currentVehicleMetadata.acceleration}</span>
            </div>
            <div className="relative w-full h-2.5 bg-black/80 rounded-lg overflow-hidden border border-white/5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: selectedCar === 'bugatti' ? '100%' : selectedCar === 'lamborghini' ? '92%' : selectedCar === 'porsche' ? '82%' : '80%' }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-lg shadow-[0_0_12px_rgba(16,185,129,0.4)]"
              />
            </div>
          </div>

          {/* TOP SPEED SPEC (Red) */}
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Top Velocity</span>
              <span className="text-sm font-mono font-black text-white">{currentVehicleMetadata.topSpeed} km/h</span>
            </div>
            <div className="relative w-full h-2.5 bg-black/80 rounded-lg overflow-hidden border border-white/5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(currentVehicleMetadata.topSpeed / 420) * 100}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-red-600 to-rose-400 rounded-lg shadow-[0_0_12px_rgba(220,38,38,0.4)]"
              />
            </div>
          </div>

          {/* HANDLING SPEC (Blue) */}
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Grip Handling</span>
              <span className="text-sm font-mono font-black text-white">{currentVehicleMetadata.handling} / 100</span>
            </div>
            <div className="relative w-full h-2.5 bg-black/80 rounded-lg overflow-hidden border border-white/5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${currentVehicleMetadata.handling}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-cyan-600 to-blue-400 rounded-lg shadow-[0_0_12px_rgba(6,182,212,0.4)]"
              />
            </div>
          </div>

          {/* Select map route for starting standard single player */}
          <div className="space-y-2 pt-3 border-t border-white/10 text-left">
            <span className="text-[8px] uppercase tracking-widest font-bold text-slate-400">Race Circuit</span>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setSelectedMap('map1')}
                className={`py-2 px-2 text-[9px] font-black uppercase rounded-xl transition border text-center cursor-pointer ${
                  selectedMap === 'map1'
                    ? 'bg-blue-600/10 border-blue-500 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.25)]'
                    : 'bg-[#000]/60 border-white/10 text-slate-400'
                }`}
              >
                🐲 DRAGON (MAP 1)
              </button>
              <button 
                onClick={() => setSelectedMap('map2')}
                className={`py-2 px-2 text-[9px] font-black uppercase rounded-xl transition border text-center cursor-pointer ${
                  selectedMap === 'map2'
                    ? 'bg-cyan-600/10 border-cyan-500 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                    : 'bg-[#000]/60 border-white/10 text-slate-400'
                }`}
              >
                🌴 COASTAL (MAP 2)
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic game actions: Multiplayer Room Launchers (Neon glowing above control button stack) */}
        <div className="space-y-4 pt-3 border-t border-white/10">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={handleCreateRoomClick}
              className="py-3 px-1 rounded-2xl bg-gradient-to-r from-purple-800 to-fuchsia-700 hover:from-purple-700 hover:to-fuchsia-600 text-white font-extrabold text-[10px] tracking-wider uppercase transition-all duration-300 active:scale-95 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.55)] cursor-pointer"
            >
              CREATE GAME ROOM
            </button>
            <button
              onClick={handleJoinRoomClick}
              className="py-3 px-1 rounded-2xl bg-gradient-to-r from-[#21124d] to-[#120a32] hover:bg-[#341270] text-[#cfbeff] font-extrabold text-[10px] tracking-wider uppercase transition-all duration-300 active:scale-95 border border-purple-850/60 shadow-inner cursor-pointer"
            >
              JOIN GAME ROOM
            </button>
          </div>
        </div>
      </motion.div>

      {/* BOTTOM CAR CAROUSEL: Horizontal scrolling list */}
      <div 
        id="bottom-showroom-carousel"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center space-y-3"
      >
        <span className="text-[8px] font-black tracking-[4px] text-white/50 uppercase">CHOOSE HYPERCAR CHASSIS</span>
        
        <div 
          className="flex items-center space-x-4 max-w-[500px] overflow-x-auto overflow-y-visible px-4 py-2 scroll-smooth select-none hide-scrollbar"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {CARS_GARAGE.map((car) => {
            const isSelected = selectedCar === car.id;
            return (
              <motion.div
                key={car.id}
                onClick={() => setSelectedCar(car.id)}
                whileHover={{ scale: isSelected ? 1.12 : 1.05 }}
                className={`flex-shrink-0 cursor-pointer transition-all duration-300 rounded-2xl p-1 relative w-24 h-16 overflow-hidden ${
                  isSelected 
                    ? 'scale-110 shadow-[0_0_20px_#00ff88] border-2 border-[#00ff88]' 
                    : 'opacity-65 border border-white/10 hover:opacity-100'
                }`}
              >
                <img 
                  src={car.image} 
                  alt={car.name} 
                  className="w-full h-full object-cover rounded-xl"
                  referrerPolicy="no-referrer"
                />
                {/* Micro Class tag */}
                <div className="absolute bottom-1 right-1 px-1 py-[1.5px] bg-black/85 text-[6.5px] font-sans font-black text-rose-400 rounded-md">
                  {car.class.split(' ')[0]}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* BOTTOM RIGHT BUTTONS: Large control triggers (Asphalt 9 Style) */}
      <div 
        id="garage-action-deck"
        className="absolute bottom-6 right-6 z-20 flex space-x-3.5"
      >
        {/* MAINTENANCE PANEL restores status */}
        <button
          onClick={handleRestoreMaintenance}
          style={{ width: '130px', height: '56px' }}
          className="rounded-2xl border-b-4 border-amber-700 bg-gradient-to-r from-amber-600 to-amber-500 hover:brightness-110 text-white font-black text-xs uppercase tracking-widest transition-all duration-150 active:translate-y-[2px] active:border-b-0 shadow-lg flex flex-col items-center justify-center cursor-pointer"
        >
          <Wrench className="w-4 h-4 mb-0.5 text-white animate-bounce" />
          <span>REPAIR</span>
        </button>

        {/* CUSTOMIZE Paint picker */}
        <button
          onClick={() => setCustomizerOpen(!customizerOpen)}
          style={{ width: '130px', height: '56px' }}
          className="rounded-2xl border-b-4 border-cyan-800 bg-gradient-to-r from-cyan-600 to-blue-500 hover:brightness-110 text-white font-black text-xs uppercase tracking-widest transition-all duration-150 active:translate-y-[2px] active:border-b-0 shadow-lg flex flex-col items-center justify-center cursor-pointer animate-pulse"
        >
          <Paintbrush className="w-4 h-4 mb-0.5 text-white" />
          <span>PAINT</span>
        </button>

        {/* USE launches single player */}
        <button
          id="btn-use-car"
          onClick={() => handleStartProcess('single')}
          style={{ width: '160px', height: '56px' }}
          className="rounded-2xl border-b-4 border-emerald-700 bg-gradient-to-r from-emerald-500 to-green-500 hover:brightness-110 text-neutral-950 font-black text-xs uppercase tracking-widest transition-all duration-150 active:translate-y-[2px] active:border-b-0 shadow-2xl shadow-emerald-500/30 flex flex-col items-center justify-center cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current mb-0.5" />
          <span>START RACE</span>
        </button>
      </div>

      {/* ==================== CUSTOMIZE METALLIC COLOR DRAWER ==================== */}
      <AnimatePresence>
        {customizerOpen && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-30" onClick={() => setCustomizerOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="absolute bottom-24 right-6 w-96 max-w-full z-40 rounded-3xl border border-white/10 p-5 shadow-2xl space-y-4"
              style={{
                background: 'rgba(5, 5, 5, 0.72)',
                backdropFilter: 'blur(24px)'
              }}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center space-x-2">
                  <Paintbrush className="w-4 h-4 text-[#00f2ff]" />
                  <span className="text-xs uppercase font-black tracking-widest text-[#00f2ff]">Supercar Paint Customizer</span>
                </div>
                <button 
                  onClick={() => setCustomizerOpen(false)} 
                  className="p-1 hover:bg-white/10 rounded-lg text-slate-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2.5">
                {METALLIC_COLORS.map((col) => (
                  <button
                    key={col.hex}
                    onClick={() => setCarColor(col.hex)}
                    className={`h-11 rounded-xl flex items-center justify-center transition-all ${
                      carColor === col.hex 
                        ? 'ring-2 ring-[#00ff88] scale-110 shadow-lg' 
                        : 'opacity-85 hover:opacity-100 hover:scale-105'
                    }`}
                    style={{
                      backgroundColor: col.hex,
                      border: '2px solid rgba(255,255,255,0.15)'
                    }}
                    title={col.name}
                  >
                    {carColor === col.hex && (
                      <CheckCircle className="w-4 h-4 text-slate-900 fill-white shrink-0 font-extrabold" />
                    )}
                  </button>
                ))}
              </div>
              <div className="text-[10px] font-mono text-center text-[#cfbeff] leading-none pt-1">
                Custom metal layers auto-configured. Reflective parameters mapped to HDR showroom.
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ==================== CREATE ROOM POPUP OVERLAY ==================== */}
      <AnimatePresence>
        {activePopup === 'create_room' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="w-full max-w-md p-6 rounded-3xl border border-white/10 shadow-2xl relative space-y-6"
              style={{
                background: 'rgba(10, 10, 10, 0.85)',
                backdropFilter: 'blur(24px)'
              }}
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-xs font-black tracking-widest text-purple-400 uppercase">STAGING MULTIPLAYER HOST</span>
                <button onClick={() => setActivePopup('none')} className="p-1 hover:bg-white/10 rounded-lg text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-left">
                {/* Room code display */}
                <div className="bg-purple-950/20 border border-purple-500/20 rounded-2xl p-4 text-center space-y-1 shadow-inner relative overflow-hidden">
                  <div className="absolute -top-10 -left-10 w-24 h-24 bg-purple-500/10 rounded-full blur-xl pointer-events-none" />
                  <span className="text-[9px] uppercase tracking-widest font-bold text-purple-300">GENERATING ROOM CODE</span>
                  <p className="text-3xl font-mono font-black tracking-[3px] text-white select-all">{generatedCode}</p>
                </div>

                {/* Nickname input */}
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Setup Room Lobby Label</label>
                  <input
                    type="text"
                    value={createdRoomName}
                    onChange={(e) => setCreatedRoomName(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 focus:border-purple-500 rounded-xl px-3.5 py-2 text-xs font-black text-white uppercase outline-none transition-all font-mono"
                  />
                </div>

                <div className="flex justify-between bg-black/40 border border-white/5 rounded-2xl p-3.5 text-xs font-mono">
                  <div className="flex flex-col">
                    <span className="text-[8px] text-slate-500">MAX PLAYERS</span>
                    <span className="font-bold text-purple-400">3 PLAYERS</span>
                  </div>
                  <div className="w-[1px] bg-white/5" />
                  <div className="flex flex-col text-right">
                    <span className="text-[8px] text-slate-500">CIRCUIT ARENA</span>
                    <span className="font-bold text-cyan-400 uppercase">
                      {selectedMap === 'map1' ? 'Dragon Mountain' : 'Coastal Sunset'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-1.5">
                <button
                  onClick={() => setActivePopup('none')}
                  className="py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl font-bold uppercase text-[10px] tracking-widest transition cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleConfirmCreateRoom}
                  className="py-3 bg-gradient-to-r from-purple-700 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition shadow-lg shadow-purple-500/20 active:scale-[0.98] cursor-pointer"
                >
                  START ROOM
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================== JOIN ROOM POPUP OVERLAY ==================== */}
      <AnimatePresence>
        {activePopup === 'join_room' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="w-full max-w-sm p-6 rounded-3xl border border-white/10 shadow-2xl relative space-y-5"
              style={{
                background: 'rgba(10, 10, 10, 0.85)',
                backdropFilter: 'blur(24px)'
              }}
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-xs font-black tracking-widest text-[#cfbeff] uppercase">PEER RUNMATCH MATCHMAKING</span>
                <button onClick={() => setActivePopup('none')} className="p-1 hover:bg-white/10 rounded-lg text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-left">
                <div className="space-y-2">
                  <label className="text-[9px] uppercase tracking-widest font-black text-slate-400 block text-center">
                    Enter Invitation Room Code
                  </label>
                  <input
                    type="text"
                    value={enteredJoinCode}
                    onChange={(e) => {
                      setEnteredJoinCode(e.target.value.toUpperCase());
                      setJoinError(null);
                    }}
                    placeholder="DRAGON123"
                    className="w-full bg-black/60 border border-white/10 focus:border-purple-500 rounded-2xl px-4 py-3 text-2xl font-mono font-black text-center text-white outline-none tracking-[5px] transition-all uppercase uppercase"
                  />
                </div>

                {joinError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] rounded-xl text-center font-bold">
                    {joinError}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActivePopup('none')}
                  className="py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl font-bold uppercase text-[10px] tracking-widest transition cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={handleConfirmJoinRoom}
                  className="py-3 bg-gradient-to-r from-purple-700 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition shadow-lg shadow-purple-500/20 active:scale-[0.98] cursor-pointer"
                >
                  JOIN ROOM
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================== MULTIPLAYER CONNECTED ROOM LOBBY ==================== */}
      <AnimatePresence>
        {activePopup === 'lobby' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-3xl p-6 rounded-3xl border border-white/10 shadow-2xl relative space-y-6 flex flex-col justify-between"
              style={{
                background: 'rgba(10, 10, 10, 0.9)',
                backdropFilter: 'blur(30px)'
              }}
            >
              {/* Top info */}
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <div className="flex items-center space-x-2.5">
                  <Compass className="w-5 h-5 text-purple-400 rotate-45" />
                  <div>
                    <span className="text-[8px] font-mono font-black text-purple-400 block tracking-widest">
                      MULTIPLAYER ACTIVE SATELLITE
                    </span>
                    <h3 className="text-base font-black text-white uppercase">{syncedRoom?.ownerName}'s Arena</h3>
                  </div>
                </div>

                <div className="flex items-center space-x-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl px-5 py-2 font-mono text-center relative shadow-lg">
                  <div className="absolute top-0 bottom-0 left-0 right-0 animate-pulse pointer-events-none" />
                  <div>
                    <span className="text-[8px] text-purple-300 uppercase block tracking-wider">ROOM CODE</span>
                    <span className="text-lg font-black text-white tracking-[2px]">{generatedCode}</span>
                  </div>
                </div>
              </div>

              {/* Player list segment */}
              <div className="space-y-3.5 text-left flex-1 py-1">
                <div className="flex items-center justify-between text-[11px] font-black uppercase text-slate-400 tracking-wider">
                  <span>CONNECTED GRID RAILS ({syncedPlayers.length} / 3 CONNECTED)</span>
                  <span className="text-purple-400 animate-pulse">WAITING FOR PEERS...</span>
                </div>

                {/* 3 Grid Rows representing player slots */}
                <div className="space-y-2.5">
                  {Array.from({ length: 3 }).map((_, idx) => {
                    const loadedPlayer = syncedPlayers[idx];
                    if (loadedPlayer) {
                      const isMe = profile && loadedPlayer.uid === profile.uid;
                      const hasLambo = syncedRoom?.selectedCar === 'lamborghini';
                      return (
                        <div 
                          key={loadedPlayer.uid}
                          className="flex items-center justify-between bg-white/5 border border-white/10 p-4 rounded-2xl shadow-lg relative overflow-hidden"
                        >
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-t from-purple-600 to-cyan-400" />
                          <div className="flex items-center space-x-4">
                            <img 
                              src={loadedPlayer.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'} 
                              alt={loadedPlayer.playerName} 
                              className="w-10 h-10 object-cover rounded-full border border-white/20 shrink-0"
                            />
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-black uppercase text-white truncate max-w-[150px]">
                                  {loadedPlayer.playerName}
                                </span>
                                {isMe && (
                                  <span className="bg-cyan-500 text-slate-950 text-[7px] font-bold uppercase tracking-wider px-1.5 py-[1px] rounded">
                                    YOU
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] font-mono text-slate-400 uppercase">
                                CHASSIS: {CARS_GARAGE.find(c => c.id === (syncedRoom?.selectedCar || 'lamborghini'))?.name || 'Lamborghini'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-4">
                            <span className="text-[10px] font-black px-3.5 py-1.5 rounded-xl bg-black/60 border border-white/5 text-slate-300">
                              ★ READY
                            </span>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div 
                          key={`empty-${idx}`}
                          className="flex items-center justify-between bg-black/40 border border-dashed border-white/10 p-4 rounded-2xl h-[74px] opacity-45 relative"
                        >
                          <div className="flex items-center space-x-3.5">
                            <div className="w-10 h-10 rounded-full border border-dashed border-white/20 flex items-center justify-center shrink-0">
                              <Users className="w-5 h-5 text-slate-500" />
                            </div>
                            <span className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500">
                              WAITING FOR ENROLLER...
                            </span>
                          </div>
                          <span className="text-[8px] font-bold text-slate-500 tracking-widest">SLOT {idx + 1}</span>
                        </div>
                      );
                    }
                  })}
                </div>
              </div>

              {/* Lobby settings recap */}
              <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex justify-around text-center text-xs font-mono py-3">
                <div className="flex flex-col">
                  <span className="text-[8px] text-slate-500 uppercase">MAP INDEX</span>
                  <span className="font-bold text-cyan-400 uppercase">
                    {syncedRoom?.mapId === 'map1' ? 'Dragon Mountain Pass' : 'Coastal Sunset Circuit'}
                  </span>
                </div>
                <div className="w-[1px] bg-white/5" />
                <div className="flex flex-col">
                  <span className="text-[8px] text-slate-500 uppercase">MAX COUNT</span>
                  <span className="font-bold text-purple-400 uppercase">3 RACERS max</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <button
                  onClick={handleLeaveLobby}
                  className="py-3.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl font-bold uppercase text-xs tracking-widest transition cursor-pointer"
                >
                  EXIT STAGE
                </button>
                <button
                  disabled={syncedPlayers.length < 3 && !syncedRoom?.isLiveMode}
                  onClick={async () => {
                    if (syncedRoom && profile && syncedRoom.ownerUid === profile.uid) {
                      await NormalRoomService.setRoomStatus(generatedCode, 'countdown');
                    }
                  }}
                  className="py-3.5 bg-gradient-to-r from-purple-700 to-fuchsia-600 hover:brightness-110 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition shadow-lg shadow-purple-500/25 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  START RACE NOW
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================== COUNTDOWN CINEMATIC OVERLAY ==================== */}
      <AnimatePresence>
        {secondsLeft !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 pointer-events-none">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: [0.8, 1.2, 1], opacity: 1 }}
              transition={{ duration: 0.5, type: 'spring' }}
              className="px-12 py-10 rounded-full flex flex-col items-center bg-slate-950/80 border border-[#00f2ff]/40 shadow-[0_0_50px_#00f2ff33] relative"
            >
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#00f2ff]/30 animate-spin" />
              <span className="text-[12px] font-black text-[#00f2ff] tracking-widest uppercase mb-1">GRID START POSITION LIGHTS</span>
              <span className="text-8xl font-black font-mono tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 drop-shadow-[0_0_20px_#00f2ffd5]">
                {secondsLeft === 0 ? 'GO!' : secondsLeft}
              </span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================== REPAIR RESTORATION CELEBRATARY TOAST ==================== */}
      <AnimatePresence>
        {showMaintenanceSplash && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 border border-emerald-400 text-slate-950 px-8 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 text-sm font-black uppercase"
          >
            <CheckCircle className="w-5 h-5 animate-spin fill-white text-emerald-500 shrink-0" />
            <span>DIAGNOSTICS UPDATED: ALL SYSTEMS REPAIRED!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Datacenter Preloader overlay */}
      <AnimatePresence>
        {loadStatus !== 'idle' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-xl pointer-events-auto"
          >
            <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-center flex flex-col items-center space-y-6 relative overflow-hidden">
              <div className="absolute w-80 h-80 bg-cyan-500/5 rounded-full blur-[80px]" />

              {loadStatus === 'downloading' && (
                <>
                  <div className="w-16 h-16 rounded-full border-t-2 border-r-2 border-cyan-400 animate-spin flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                    <Download className="w-6 h-6 text-cyan-400 animate-pulse" />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-xl font-black uppercase tracking-widest text-slate-200">
                      Preparing vehicle...
                    </h3>
                    <p className="text-xs text-[#7ee1fc] font-bold">
                      Configuring {CARS_GARAGE.find(c => c.id === selectedCar)?.name}...
                    </p>
                  </div>

                  <div className="w-full space-y-2">
                    <div className="relative w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800/80">
                      <motion.div 
                        className="absolute h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-teal-400 shadow-[0_0_10px_rgba(34,211,238,0.5)] animate-pulse"
                        style={{ width: `${progress}%` }}
                        transition={{ duration: 0.1 }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-mono text-cyan-400 font-bold">
                      <span>DATACENTER REPOSITORY</span>
                      <span>{progress}%</span>
                    </div>
                  </div>
                </>
              )}

              {loadStatus === 'ready' && (
                <>
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.25)] scale-110 transition duration-300">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-2xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                      Vehicle Ready
                    </h3>
                    <p className="text-xs text-slate-400">
                      Chassis calibrated. Calibrating system components...
                    </p>
                  </div>
                </>
              )}

              {loadStatus === 'failed' && (
                <>
                  <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.25)]">
                    <AlertOctagon className="w-8 h-8 text-red-500" />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-xl font-black uppercase tracking-widest text-red-500">
                      Vehicle unavailable
                    </h3>
                    <p className="text-xs text-slate-400 leading-normal max-w-xs">
                      The selected vehicle is currently unavailable. Please choose another car or try again.
                    </p>
                  </div>

                  <div className="w-full flex space-x-3 mt-4">
                    <button
                      type="button"
                      onClick={() => setLoadStatus('idle')}
                      className="flex-1 py-3 bg-slate-950 border border-slate-850 hover:border-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider hover:text-white cursor-pointer"
                    >
                      Return
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartProcess('single')}
                      className="flex-1 py-3 bg-red-650 hover:bg-red-500 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-lg cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
