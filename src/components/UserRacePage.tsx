import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { NormalRoomService, NormalRoom, NormalPlayer } from '../multiplayer/NormalRoomService';
import { TrackGeometryHelper } from '../utils/track';
import { GamePhysicsService } from '../physics/GamePhysics';
import { GameCanvas } from './GameCanvas';
import { HUD } from './HUD';
import { GameOver } from './GameOver';
import { RoomCodeHUD } from './RoomCodeHUD';
import { terrainManager } from '../world/TerrainManager';
import { CarState, ControlsState } from '../types';
import * as THREE from 'three';
import { Compass, Loader2 } from 'lucide-react';
import { LoadingScreen } from './LoadingScreen';

export const UserRacePage: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const normalizedCode = (roomCode || '').toUpperCase().trim();

  const [room, setRoom] = useState<NormalRoom | null>(null);
  const [players, setPlayers] = useState<NormalPlayer[]>([]);
  const [phase, setPhase] = useState<'loading' | 'racing' | 'completed'>('loading');
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [cars, setCars] = useState<CarState[]>([]);
  
  const [soundEnabled] = useState(true);
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'noon' | 'sunset' | 'night'>('sunset');
  const [weather, setWeather] = useState<'sunny' | 'cloudy' | 'foggy' | 'rain'>('sunny');

  const [controls, setControls] = useState<ControlsState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    nitro: false,
    gear: 'D',
  });

  const trackHelperRef = useRef<TrackGeometryHelper | null>(null);
  const physicsServiceRef = useRef<GamePhysicsService | null>(null);
  const isInitRef = useRef(false);
  const playersRef = useRef<NormalPlayer[]>([]);
  const lastWriteRef = useRef(0);

  // Keep players count ref to avoid stale closures inside Three ticks
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  // 1. Subscribe to Room and Players
  useEffect(() => {
    if (!normalizedCode) return;

    const unsubRoom = NormalRoomService.listenToRoom(normalizedCode, (updatedRoom) => {
      setRoom(updatedRoom);
    });

    const unsubPlayers = NormalRoomService.listenToPlayers(normalizedCode, (updatedPlayers) => {
      setPlayers(updatedPlayers);
    });

    return () => {
      unsubRoom();
      unsubPlayers();
    };
  }, [normalizedCode]);

  // 2. Initialize Game configurations and Lineup once loaded
  useEffect(() => {
    if (room && players.length > 0 && !isInitRef.current && profile) {
      isInitRef.current = true;

      const activeMap = room.mapId || 'map1';
      const helper = new TrackGeometryHelper(activeMap);
      trackHelperRef.current = helper;
      physicsServiceRef.current = new GamePhysicsService(helper);

      // Build Starting lineup
      const curveLength = helper.curve.getLength();
      const wheelRadius = 0.38;
      const lineup: CarState[] = [];

      players.forEach((p, idx) => {
        const isMe = p.uid === profile.uid;
        const side = (idx % 2 === 0) ? -1 : 1;
        const spacingDistance = 15.0 + idx * 8.0;
        const progress = ((1.0 - spacingDistance / curveLength) % 1.0 + 1.0) % 1.0;

        const pt = helper.curve.getPointAt(progress);
        const tangent = helper.curve.getTangentAt(progress).normalize();
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        const spawnPos = pt.clone().addScaledVector(normal, side * 2.5);

        // Standard terrain road alignment
        const roadHeight = terrainManager.getRoadHeight(spawnPos);
        const spawnY = roadHeight + wheelRadius;
        const startAngle = Math.atan2(tangent.x, tangent.z);

        const carId = isMe ? 'player' : `remote_${p.uid}`;

        lineup.push({
          id: carId,
          name: p.playerName,
          isAI: false,
          color: isMe ? '#0062ff' : (idx === 1 ? '#ffcc00' : '#ff3366'),
          position: { x: spawnPos.x, y: spawnY, z: spawnPos.z },
          velocity: { x: 0, y: 0, z: 0 },
          speed: 0,
          angle: startAngle,
          angularVelocity: 0,
          driftFactor: 0,
          isDrifting: false,
          currentLap: 1,
          currentCheckpointIndex: 0,
          distanceToNextCheckpoint: 999,
          racePosition: idx + 1,
          totalDistanceTraveled: -idx * 8.5,
          isFinished: false,
          lastActiveTime: Date.now(),
          nitroCharged: 60,
          isNitroActive: false,
          stuckTimer: 0,
          aiTargetNode: 0,
          aiSpeedFactor: 1,
          aiAggression: 0.72
        });
      });

      // Try lock orientation of multiplayer race to landscape
      try {
        const screenAny = window.screen as any;
        if (screenAny && screenAny.orientation && screenAny.orientation.lock) {
          screenAny.orientation.lock('landscape').catch(() => {});
        }
      } catch (err) {}

      // Automatically request true browser fullscreen experience
      try {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch (err) {}

      setCars(lineup);
      setPhase('racing');
    }
  }, [room, players, profile]);

  // 3. Increment Elapsed Time counter
  useEffect(() => {
    if (phase !== 'racing' || isPaused) return;

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 10);
    }, 10);

    return () => clearInterval(interval);
  }, [phase, isPaused]);

  // 5. requestAnimationFrame frame tick sync
  const handleTickUpdate = (updatedCars: CarState[]) => {
    const playerCar = updatedCars.find((c) => c.id === 'player');

    // Throttled location coordinate push to Firestore (every 120ms)
    const now = Date.now();
    if (playerCar && now - lastWriteRef.current > 120 && profile) {
      lastWriteRef.current = now;
      NormalRoomService.updatePlayerPosition(normalizedCode, profile.uid, {
        position: playerCar.position,
        velocity: playerCar.velocity,
        angle: playerCar.angle,
        speed: playerCar.speed,
        isDrifting: playerCar.isDrifting || false,
        currentLap: playerCar.currentLap || 1,
        isFinished: playerCar.isFinished || false,
        totalDistanceTraveled: playerCar.totalDistanceTraveled || 0,
      }).catch((e) => console.error('Coordinates update failure:', e));
    }

    // Unpack remote cars coordinates securely
    const nextCars = updatedCars.map((car) => {
      if (car.id === 'player') return car;

      const remoteUid = car.id.replace('remote_', '');
      const remotePlr = playersRef.current.find((p) => p.uid === remoteUid);

      if (remotePlr && 'position' in remotePlr && remotePlr.position) {
        const rp = remotePlr as any;
        car.position.x = rp.position.x;
        car.position.y = rp.position.y;
        car.position.z = rp.position.z;
        car.velocity.x = rp.velocity?.x || 0;
        car.velocity.y = rp.velocity?.y || 0;
        car.velocity.z = rp.velocity?.z || 0;
        car.angle = rp.angle || 0;
        car.speed = rp.speed || 0;
        car.isDrifting = rp.isDrifting || false;
        car.currentLap = rp.currentLap || 1;
        car.isFinished = rp.isFinished || false;
        car.totalDistanceTraveled = rp.totalDistanceTraveled || 0;
      }
      return car;
    });

    setCars(nextCars);
  };

  const handleRaceFinish = () => {
    setPhase('completed');
  };

  if (phase === 'loading' || cars.length === 0) {
    return (
      <LoadingScreen 
        progress={78} 
        message="Authenticating race satellite link... configuring active suspension torque rates" 
        subMessage="Optimizing peer collision grids on firestore" 
      />
    );
  }

  const currentPl = cars.find((c) => c.id === 'player') || cars[0];
  const currentOpponents = cars.filter((c) => c.id !== 'player');

  return (
    <div 
      id="user-race-view-root" 
      className="fixed top-0 left-0 w-screen h-[100dvh] overflow-hidden bg-black flex flex-col m-0 p-0 rounded-none max-w-none select-none"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100dvh',
        overflow: 'hidden',
        background: 'black',
        margin: 0,
        padding: 0,
        borderRadius: 0,
        maxWidth: 'none',
      }}
    >
      {/* Information tracker top header */}
      <div className="absolute top-4 left-4 z-20 pointer-events-none flex items-center space-x-2 text-white bg-slate-950/40 backdrop-blur-sm px-3 py-1 rounded-full border border-slate-800/40 opacity-75">
        <Compass className="w-3.5 h-3.5 text-pink-500 rotate-45" />
        <span className="font-mono font-black text-[10px] tracking-wider uppercase">NORMAL MATCH GRID <span className="text-pink-400">RUNNING</span></span>
      </div>

      {/* Atmospheric Day/Weather Controllers */}
      <div className="absolute top-4 right-4 z-30 flex flex-col items-end space-y-1.5 select-none scale-90 origin-top-right md:scale-100">
        <div className="bg-slate-950/75 border border-slate-800/60 backdrop-blur-md p-1.5 px-2.5 rounded-2xl flex items-center space-x-4 text-white shadow-2xl">
          <div className="flex items-center space-x-1 bg-slate-900/40 p-0.5 rounded-xl border border-slate-800/30">
            <span className="text-[7.5px] font-black tracking-widest uppercase text-slate-400 px-1.5 font-mono">TIME</span>
            {(['morning', 'noon', 'sunset', 'night'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeOfDay(t)}
                className={`px-2 py-0.5 rounded-lg text-[8.5px] font-black uppercase tracking-wider transition-all border ${
                  timeOfDay === t
                    ? 'bg-pink-500/20 border-pink-500/60 text-pink-300 shadow-[0_0_8px_rgba(244,63,94,0.2)]'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/20'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-1 bg-slate-900/40 p-0.5 rounded-xl border border-slate-800/30 font-mono">
            <span className="text-[7.5px] font-black tracking-widest uppercase text-emerald-400 px-1.5">WEATHER</span>
            {(['sunny', 'cloudy', 'foggy', 'rain'] as const).map((w) => (
              <button
                key={w}
                onClick={() => setWeather(w)}
                className={`px-2 py-0.5 rounded-lg text-[8.5px] font-black uppercase tracking-wider transition-all border ${
                  weather === w
                    ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.2)]'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/20'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Primary 3D THREE.JS Rendering Canvas */}
      {trackHelperRef.current && physicsServiceRef.current && (
        <GameCanvas
          cars={cars}
          playerControls={controls}
          physicsService={physicsServiceRef.current}
          trackHelper={trackHelperRef.current}
          isPaused={isPaused}
          gameState={phase}
          onFinishRace={handleRaceFinish}
          onTick={handleTickUpdate}
          soundEnabled={soundEnabled}
          timeOfDay={timeOfDay}
          weather={weather}
        />
      )}

      {/* Head-Up-Display HUD Overlay */}
      {phase === 'racing' && currentPl && trackHelperRef.current && (
        <HUD
          player={currentPl}
          opponents={currentOpponents}
          controls={controls}
          setControls={setControls}
          elapsedTime={elapsedTime}
          trackHelper={trackHelperRef.current}
          onPauseToggle={() => setIsPaused((prev) => !prev)}
          isPaused={isPaused}
        />
      )}

      {/* HUD Room Code Identifier */}
      <RoomCodeHUD
        roomCode={normalizedCode}
        playersCount={players.length}
        isLiveMode={false}
      />

      {/* Game Over Leaderboards Overlay */}
      {phase === 'completed' && currentPl && (
        <GameOver
          player={currentPl}
          opponents={currentOpponents}
          elapsedTime={elapsedTime}
          onHome={() => {
            // Disband if owner, or leave
            if (profile) {
              NormalRoomService.leaveOrCancelRoom(normalizedCode, profile.uid).catch(() => {});
            }
            navigate('/garage');
          }}
          onRestart={async () => {
            // Redirect back to waiting lobby so they can queue again
            if (profile) {
              try {
                if (room && room.ownerUid === profile.uid) {
                  await NormalRoomService.setRoomStatus(normalizedCode, 'waiting');
                }
              } catch (e) {
                console.error(e);
              }
            }
            navigate(`/room/${normalizedCode}`);
          }}
        />
      )}

      {/* Pause overlay */}
      {isPaused && phase === 'racing' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center shadow-2xl max-w-sm space-y-4">
            <h3 className="text-2xl font-black uppercase text-slate-200 tracking-wider font-sans">Race Paused</h3>
            <p className="text-xs text-slate-400">Your engine is idling at the pits. Select resume to continue racing.</p>
            <button
              onClick={() => setIsPaused(false)}
              className="px-8 py-3 bg-pink-600 hover:bg-pink-500 text-white font-extrabold uppercase text-xs tracking-widest rounded-xl transition duration-150 cursor-pointer w-full"
            >
              Resume Match
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
