/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { GamePhase, GameSettings, CarState, ControlsState } from './types';
import { TrackGeometryHelper } from './utils/track';
import { GamePhysicsService } from './physics/GamePhysics';
import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { Menu } from './components/Menu';
import { GameOver } from './components/GameOver';
import { Trophy, Compass, Sparkles, Volume2, VolumeX, AlertCircle, Sun, Cloud, CloudRain, CloudFog, Moon } from 'lucide-react';
import { selectRandomPlayerCar, setPlayerSelectedModelKey } from './world/procedural';

export default function App() {
  // Game states orchestration
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Dynamic Environment Settings
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'noon' | 'sunset' | 'night'>('sunset');
  const [weather, setWeather] = useState<'sunny' | 'cloudy' | 'foggy' | 'rain'>('sunny');

  // Synchronous car entities list
  const [cars, setCars] = useState<CarState[]>([]);
  
  // Controls key triggers tracking
  const [controls, setControls] = useState<ControlsState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    nitro: false,
  });

  // Sound preference state
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Screen orientation state
  const [isPortrait, setIsPortrait] = useState(false);

  // Monitor screen orientation
  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerWidth < window.innerHeight);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Instantiated engines
  const trackHelperRef = useRef<TrackGeometryHelper | null>(null);
  const physicsServiceRef = useRef<GamePhysicsService | null>(null);
  const lastTimeRef = useRef<number>(Date.now());

  // Countdown timer count [3..0]
  const [countdown, setCountdown] = useState(3);
  const [countdownMsg, setCountdownMsg] = useState('READY...');

  // Initialize helpers on startup
  useEffect(() => {
    const helper = new TrackGeometryHelper();
    trackHelperRef.current = helper;
    physicsServiceRef.current = new GamePhysicsService(helper);
  }, []);

  // Keyboard controls listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase !== 'racing' || isPaused) return;

      const key = e.key.toLowerCase();
      if (key === 'a' || e.key === 'ArrowLeft') {
        setControls(prev => ({ ...prev, left: true }));
      } else if (key === 'd' || e.key === 'ArrowRight') {
        setControls(prev => ({ ...prev, right: true }));
      } else if (e.key === ' ') {
        setControls(prev => ({ ...prev, nitro: true }));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'a' || e.key === 'ArrowLeft') {
        setControls(prev => ({ ...prev, left: false }));
      } else if (key === 'd' || e.key === 'ArrowRight') {
        setControls(prev => ({ ...prev, right: false }));
      } else if (e.key === ' ') {
        setControls(prev => ({ ...prev, nitro: false }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [phase, isPaused]);

  // General countdown clock loop sequence
  useEffect(() => {
    let timerId = 0;
    if (phase === 'countdown') {
      setCountdown(3);
      setCountdownMsg('READY');

      const tickCountdown = () => {
        if (!(window as any).playerCarAddedToScene) {
          console.log('Waiting for player vehicle to be successfully loaded and added to the scene...');
          setCountdownMsg('READY...');
          return;
        }

        setCountdown(prev => {
          const next = prev - 1;
          setTimeout(() => {
            if (next === 2) {
              setCountdownMsg('3');
            } else if (next === 1) {
              setCountdownMsg('2');
            } else if (next === 0) {
              setCountdownMsg('GO!');
            } else if (next < 0) {
              setPhase('racing');
              lastTimeRef.current = Date.now();
            }
          }, 0);
          return next;
        });
      };

      timerId = window.setInterval(tickCountdown, 1000);
    }

    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [phase]);

  // Overall timing clock elapsed increments helper
  useEffect(() => {
    let frameId = 0;
    
    const updateTime = () => {
      if (phase === 'racing' && !isPaused) {
        const now = Date.now();
        const delta = (now - lastTimeRef.current) / 1000;
        setElapsedTime(prev => prev + delta);
        lastTimeRef.current = now;
      } else {
        lastTimeRef.current = Date.now(); // reset anchor during pause
      }

      frameId = requestAnimationFrame(updateTime);
    };

    frameId = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(frameId);
  }, [phase, isPaused]);

  // Start the actual game from configurations
  const handleStartGame = (cfg: GameSettings) => {
    // Reset vehicle added state
    (window as any).playerCarAddedToScene = false;

    // Apply exact player selected map
    const activeMap = cfg.selectedMap || 'map1';
    const helper = new TrackGeometryHelper(activeMap);
    trackHelperRef.current = helper;
    physicsServiceRef.current = new GamePhysicsService(helper);

    setSettings(cfg);
    setElapsedTime(0);
    setIsPaused(false);

    // Apply exact player selected vehicle key
    const modelKey = cfg.selectedCar === 'lamborghini' ? 'lamborghini_aventador' :
                      cfg.selectedCar === 'ferrari' ? 'ferrari_purosangue' :
                      cfg.selectedCar === 'bugatti' ? 'bugatti_chiron_top_edition' :
                      'porsche_911_gt3';
    setPlayerSelectedModelKey(modelKey);

    // Try to rotate to horizontal landscape mode automatically
    try {
      const screenAny = window.screen as any;
      if (screenAny && screenAny.orientation && screenAny.orientation.lock) {
        screenAny.orientation.lock('landscape').catch(() => {});
      }
    } catch (err) {}

    // Initialise racers state
    if (physicsServiceRef.current) {
      const initialLineup = physicsServiceRef.current.initializeCars(
        cfg.playerName,
        cfg.difficulty,
        cfg.carColor
      );
      setCars(initialLineup);
    }

    // Move to Countdown phase
    setPhase('countdown');
  };

  // Callback triggered inside the canvas animation frames
  const handleTickUpdate = (updatedCars: CarState[]) => {
    setCars(updatedCars);
  };

  // Re-run track race with same configurations
  const handleRestartRace = () => {
    if (settings) {
      handleStartGame(settings);
    } else {
      setPhase('menu');
    }
  };

  // Automatically load the alternate track (Map 1 <-> Map 2) and boot it up
  const handleNextRace = () => {
    if (settings) {
      const nextMap = settings.selectedMap === 'map2' ? 'map1' : 'map2';
      const updatedSettings = {
        ...settings,
        selectedMap: nextMap as 'map1' | 'map2',
      };
      handleStartGame(updatedSettings);
    } else {
      setPhase('menu');
    }
  };

  // Back to Main configuration screen
  const handleHomeMenu = () => {
    setPhase('menu');
  };

  const currentPl = cars.find(c => c.id === 'player') || cars[0];
  const currentOpponents = cars.filter(c => c.id !== 'player' && !c.id.startsWith('traffic'));

  return (
    <div id="ai-race-root" className="relative w-screen h-screen overflow-hidden bg-slate-950 flex flex-col">
      
      {/* ================= PORTRAIT ROTATION WARNING OVERLAY ================= */}
      {isPortrait && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950 text-white p-6 text-center select-none">
          <div className="animate-bounce mb-6 text-sky-400">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" fill="none" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 3h3M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-black uppercase tracking-wider mb-2">Landscape Mode Required</h2>
          <p className="text-sm text-slate-400 max-w-xs">Rotate your device for the best racing experience.</p>
        </div>
      )}

      {/* ================= GORGEOUS SIDEBAR EMBELLISHMENTS ================= */}
      {/* Let's include premium minimal info bars for clean structural balance */}
      <div className="absolute top-4 left-4 z-20 pointer-events-none flex items-center space-x-2 text-white bg-slate-950/40 backdrop-blur-sm px-3 py-1 rounded-full border border-slate-800/40 opacity-72">
        <Compass className="w-3.5 h-3.5 text-blue-400 rotate-45" />
        <span className="font-sans font-black text-[10px] tracking-wider uppercase">AI RACE ARENA <span className="text-[#00f2ffa5]">LIVE</span></span>
      </div>

      {/* ================= ENVIRONMENT CONTROLLER PANEL ================= */}
      {phase !== 'completed' && (
        <div className="absolute top-4 right-4 z-30 flex flex-col items-end space-y-1.5 select-none scale-90 origin-top-right md:scale-100">
          <div className="bg-slate-950/75 border border-slate-800/60 backdrop-blur-md p-1.5 px-2.5 rounded-2xl flex items-center space-x-4 text-white shadow-2xl">
            
            {/* Time Selector */}
            <div className="flex items-center space-x-1 bg-slate-900/40 p-0.5 rounded-xl border border-slate-800/30">
              <span className="text-[7.5px] font-black tracking-widest uppercase text-slate-400 px-1.5">TIME</span>
              {(['morning', 'noon', 'sunset', 'night'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTimeOfDay(t)}
                  className={`px-2 py-0.5 rounded-lg text-[8.5px] font-black uppercase tracking-wider transition-all border ${
                    timeOfDay === t
                      ? 'bg-sky-500/20 border-sky-500/60 text-sky-300 shadow-[0_0_8px_rgba(56,189,248,0.2)]'
                      : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/20'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Weather Selector */}
            <div className="flex items-center space-x-1 bg-slate-900/40 p-0.5 rounded-xl border border-slate-800/30">
              <span className="text-[7.5px] font-black tracking-widest uppercase text-emerald-400 px-1.5">WEATHER</span>
              {(['sunny', 'cloudy', 'foggy', 'rain'] as const).map(w => (
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
      )}

      {/* ================= RENDER INTERACTIVE THREE CANVAS ================= */}
      {trackHelperRef.current && physicsServiceRef.current && cars.length > 0 && (
        <GameCanvas
          cars={cars}
          playerControls={controls}
          physicsService={physicsServiceRef.current}
          trackHelper={trackHelperRef.current}
          isPaused={isPaused}
          gameState={phase}
          onFinishRace={() => setPhase('completed')}
          onTick={handleTickUpdate}
          soundEnabled={soundEnabled}
          timeOfDay={timeOfDay}
          weather={weather}
        />
      )}

      {/* ================= GAMEPLAY HUD (DURING ACTIVE CAMERAS) ================= */}
      {phase === 'racing' && currentPl && (
        <HUD
          player={currentPl}
          opponents={currentOpponents}
          controls={controls}
          setControls={setControls}
          elapsedTime={elapsedTime}
          trackHelper={trackHelperRef.current!}
          onPauseToggle={() => setIsPaused(prev => !prev)}
          isPaused={isPaused}
        />
      )}

      {/* ================= PRE-RACING GAME MENU OVERLAY ================= */}
      {phase === 'menu' && (
        <Menu onStartGame={handleStartGame} />
      )}

      {/* ================= POST-RACING CELEBRATION GAME OVER RESULTS ================= */}
      {phase === 'completed' && currentPl && (
        <GameOver
          player={currentPl}
          opponents={currentOpponents}
          elapsedTime={elapsedTime}
          onRestart={handleRestartRace}
          onHome={handleHomeMenu}
          onNextRace={handleNextRace}
        />
      )}

      {/* ================= CINEMATIC COUNTDOWN OVERLAY CONTAINER ================= */}
      {phase === 'countdown' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/40 pointer-events-none select-none">
          <div className="bg-slate-900/84 border border-slate-700/60 backdrop-blur-md px-10 py-8 rounded-3xl flex flex-col items-center min-w-[200px] animate-bounce">
            <span className="text-[12px] font-black text-slate-400 tracking-widest uppercase">Grid Light</span>
            <span className={`text-6xl font-black font-sans mt-3 text-transparent bg-clip-text ${
              countdownMsg === 'GO!' 
                ? 'bg-gradient-to-r from-emerald-400 to-teal-300 scale-110' 
                : 'bg-gradient-to-r from-amber-400 to-red-400'
            }`}>
              {countdownMsg}
            </span>
          </div>
        </div>
      )}

      {/* ================= SUSPENDED STATE PAUSED VIEW BANNER ================= */}
      {isPaused && phase === 'racing' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/72 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center shadow-2xl max-w-sm space-y-4">
            <h3 className="text-2xl font-black uppercase text-slate-200 tracking-wider">Race Suspended</h3>
            <p className="text-xs text-slate-400">Your engine is idling at the pits. Click to resume tracking racing line.</p>
            <button
              onClick={() => setIsPaused(false)}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold uppercase text-xs tracking-widest rounded-xl transition duration-150 cursor-pointer w-full"
            >
              Resume Race
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
