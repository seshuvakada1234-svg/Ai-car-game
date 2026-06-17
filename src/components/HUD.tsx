/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { CarState, ControlsState } from '../types';
import { TrackGeometryHelper } from '../utils/track';
import { 
  Pause, 
  Play, 
  Users, 
  Compass, 
  ChevronLeft, 
  ChevronRight, 
  Triangle, 
  Zap, 
  Eye, 
  Settings, 
  Gauge, 
  Activity,
  Flame,
  Award
} from 'lucide-react';

interface HUDProps {
  player: CarState;
  opponents: CarState[];
  controls: ControlsState;
  setControls: React.Dispatch<React.SetStateAction<ControlsState>>;
  elapsedTime: number;
  trackHelper: TrackGeometryHelper;
  onPauseToggle: () => void;
  isPaused: boolean;
}

export const HUD: React.FC<HUDProps> = ({
  player,
  opponents,
  controls,
  setControls,
  elapsedTime,
  trackHelper,
  onPauseToggle,
  isPaused,
}) => {
  // Speed calculation
  const speedKmh = Math.floor(Math.abs(player.speed) * 3.6);
  const maxVisualSpeed = 340;
  const speedPercentage = Math.min(100, (speedKmh / maxVisualSpeed) * 100);

  // States
  const [gear, setGear] = useState<'P' | 'R' | 'N' | 'D'>('D');
  const [leftIndicator, setLeftIndicator] = useState(false);
  const [rightIndicator, setRightIndicator] = useState(false);
  const [hazardIndicator, setHazardIndicator] = useState(false);
  const [flash, setFlash] = useState(true);
  
  const [gasPressed, setGasPressed] = useState(false);
  const [brakePressed, setBrakePressed] = useState(false);
  const [driftPressed, setDriftPressed] = useState(false);
  const [leftPressed, setLeftPressed] = useState(false);
  const [rightPressed, setRightPressed] = useState(false);

  const [notif, setNotif] = useState<string | null>(null);

  // References to keep latest gear value without re-binding handlers
  const gearRef = useRef(gear);
  useEffect(() => {
    gearRef.current = gear;
  }, [gear]);

  // Unified keyboard listener to map WASD / Arrows directly to HUD pedal press states
  useEffect(() => {
    if (isPaused) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'ArrowUp') {
        setGasPressed(true);
      } else if (key === 's' || e.key === 'ArrowDown') {
        setBrakePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'ArrowUp') {
        setGasPressed(false);
      } else if (key === 's' || e.key === 'ArrowDown') {
        setBrakePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPaused]);

  // Touch & Gesture Control references to capture non-passive raw events
  const btnLeftRef = useRef<HTMLButtonElement>(null);
  const btnRightRef = useRef<HTMLButtonElement>(null);
  const btnDriftRef = useRef<HTMLButtonElement>(null);
  const btnNitroRef = useRef<HTMLButtonElement>(null);
  const btnBrakeRef = useRef<HTMLButtonElement>(null);
  const btnGasRef = useRef<HTMLButtonElement>(null);

  // Prevent double-tap-to-zoom, system context-menus, and native browser gestures
  useEffect(() => {
    const preventAll = (e: Event) => {
      if (e.cancelable) {
        e.preventDefault();
      }
      e.stopPropagation();
    };

    const attachButtonEvents = (
      btn: HTMLButtonElement | null,
      onPress: () => void,
      onRelease: () => void
    ) => {
      if (!btn) return () => {};

      let isPressed = false;

      const handlePress = (e: Event) => {
        if (e.cancelable) {
          e.preventDefault();
        }
        e.stopPropagation();
        if (isPressed) return;
        isPressed = true;
        onPress();
      };

      const handleRelease = (e: Event) => {
        if (e.cancelable) {
          e.preventDefault();
        }
        e.stopPropagation();
        if (!isPressed) return;
        isPressed = false;
        onRelease();
      };

      const handleMove = (e: Event) => {
        if (e.cancelable) {
          e.preventDefault();
        }
      };

      // Register non-passive raw touch listeners to avoid browser menus/scrolls
      btn.addEventListener('touchstart', handlePress, { passive: false });
      btn.addEventListener('touchend', handleRelease, { passive: false });
      btn.addEventListener('touchcancel', handleRelease, { passive: false });
      btn.addEventListener('touchmove', handleMove, { passive: false });

      // Pointer Event fallback support
      btn.addEventListener('pointerdown', handlePress, { passive: false });
      btn.addEventListener('pointerup', handleRelease, { passive: false });
      btn.addEventListener('pointercancel', handleRelease, { passive: false });
      btn.addEventListener('pointerleave', handleRelease, { passive: false });

      // Mouse Event fallback support
      btn.addEventListener('mousedown', handlePress);
      btn.addEventListener('mouseup', handleRelease);
      btn.addEventListener('mouseleave', handleRelease);

      // Defend against browser's context link/image download/save triggers
      btn.addEventListener('contextmenu', preventAll);
      btn.addEventListener('selectstart', preventAll);

      return () => {
        btn.removeEventListener('touchstart', handlePress);
        btn.removeEventListener('touchend', handleRelease);
        btn.removeEventListener('touchcancel', handleRelease);
        btn.removeEventListener('touchmove', handleMove);

        btn.removeEventListener('pointerdown', handlePress);
        btn.removeEventListener('pointerup', handleRelease);
        btn.removeEventListener('pointercancel', handleRelease);
        btn.removeEventListener('pointerleave', handleRelease);

        btn.removeEventListener('mousedown', handlePress);
        btn.removeEventListener('mouseup', handleRelease);
        btn.removeEventListener('mouseleave', handleRelease);

        btn.removeEventListener('contextmenu', preventAll);
        btn.removeEventListener('selectstart', preventAll);
      };
    };

    const cleanupLeft = attachButtonEvents(
      btnLeftRef.current,
      () => {
        setLeftPressed(true);
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
          window.navigator.vibrate(20);
        }
        setControls(prev => ({ ...prev, left: true, right: false }));
      },
      () => {
        setLeftPressed(false);
        setControls(prev => ({ ...prev, left: false }));
      }
    );

    const cleanupRight = attachButtonEvents(
      btnRightRef.current,
      () => {
        setRightPressed(true);
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
          window.navigator.vibrate(20);
        }
        setControls(prev => ({ ...prev, right: true, left: false }));
      },
      () => {
        setRightPressed(false);
        setControls(prev => ({ ...prev, right: false }));
      }
    );

    const cleanupDrift = attachButtonEvents(
      btnDriftRef.current,
      () => {
        setDriftPressed(true);
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
          window.navigator.vibrate([15, 10, 15]);
        }
        setControls(prev => ({ ...prev, handbrake: true }));
      },
      () => {
        setDriftPressed(false);
        setControls(prev => ({ ...prev, handbrake: false }));
      }
    );

    const cleanupNitro = attachButtonEvents(
      btnNitroRef.current,
      () => {
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
          window.navigator.vibrate(35);
        }
        setControls(prev => ({ ...prev, nitro: true }));
      },
      () => setControls(prev => ({ ...prev, nitro: false }))
    );

    const cleanupBrake = attachButtonEvents(
      btnBrakeRef.current,
      () => {
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
          window.navigator.vibrate(15);
        }
        handleBrakeChange(true);
      },
      () => handleBrakeChange(false)
    );

    const cleanupGas = attachButtonEvents(
      btnGasRef.current,
      () => {
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
          window.navigator.vibrate(15);
        }
        handleGasChange(true);
      },
      () => handleGasChange(false)
    );

    const gameHud = document.getElementById('game-hud');
    const handleGlobalContextMenu = (e: Event) => {
      e.preventDefault();
    };
    if (gameHud) {
      gameHud.addEventListener('contextmenu', handleGlobalContextMenu);
      gameHud.addEventListener('touchstart', (e) => {
        // Prevent default double-tap zoom scales across non-interactive margins
        if (e.target === gameHud && e.cancelable) {
          e.preventDefault();
        }
      }, { passive: false });
    }

    return () => {
      cleanupLeft();
      cleanupRight();
      cleanupDrift();
      cleanupNitro();
      cleanupBrake();
      cleanupGas();
      if (gameHud) {
        gameHud.removeEventListener('contextmenu', handleGlobalContextMenu);
      }
    };
  }, [setControls]);

  // Blinking cycle for dynamic indicator lights
  useEffect(() => {
    const blinker = setInterval(() => {
      setFlash(f => !f);
    }, 450);
    return () => clearInterval(blinker);
  }, []);

  // Time Formatter
  const formatTime = (timeSec: number) => {
    const mins = Math.floor(timeSec / 60);
    const secs = Math.floor(timeSec % 60);
    const centis = Math.floor((timeSec % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
  };

  const leaderboard = [player, ...opponents].sort((a, b) => a.racePosition - b.racePosition);

  // SVG coordinates rendering
  const minX = -1100;
  const maxX = 1500;
  const minZ = -2600;
  const maxZ = 4000;

  const mapX = (x: number) => {
    if (x === undefined || x === null || isNaN(x)) return 80;
    return 10 + ((x - minX) / (maxX - minX)) * 140;
  };
  const mapZ = (z: number) => {
    if (z === undefined || z === null || isNaN(z)) return 80;
    return 10 + ((z - minZ) / (maxZ - minZ)) * 140;
  };

  const splinePts = trackHelper.cachedPoints;
  const pathD = splinePts.reduce((acc, pt, idx) => {
    const x = mapX(pt.x);
    const z = mapZ(pt.z);
    return idx === 0 ? `M ${x} ${z}` : `${acc} L ${x} ${z}`;
  }, '') + ' Z';

  const positionSuffix = (pos: number) => {
    if (pos === 1) return 'ST';
    if (pos === 2) return 'ND';
    if (pos === 3) return 'RD';
    return 'TH';
  };

  // Simplified pedal togglers for automatic driving mechanics
  const handleGasChange = (active: boolean) => {
    setGasPressed(active);
  };

  const handleBrakeChange = (active: boolean) => {
    setBrakePressed(active);
  };

  // --- AUTOMATIC TRANSMISSION CONTROLLER ---
  // Calculates gear ('D', 'R', 'P') based on speed and pedal inputs (from keyboard or touch)
  useEffect(() => {
    // Determine what active inputs are pressed (touch or keyboard)
    const isForwardPressed = gasPressed;
    const isBackwardPressed = brakePressed;

    let nextGear: 'P' | 'R' | 'N' | 'D' = gear;
    let nextForward = false;
    let nextBackward = false;

    if (isForwardPressed && isBackwardPressed) {
      // Both pressed? Prioritize braking for stability, and keep/shift to Drive/Reverse
      nextGear = gear === 'R' ? 'R' : 'D';
      nextForward = false;
      nextBackward = true;
    } else if (isForwardPressed) {
      // Gas pedal / Forward key handling
      if (gear === 'R') {
        if (player.speed > -0.1) {
          // Stopped reversing, now shift to Drive and accelerate forward
          nextGear = 'D';
          nextForward = true;
          nextBackward = false;
        } else {
          // Still reversing, Gas acts as reverse brake
          nextGear = 'R';
          nextForward = false;
          nextBackward = true;
        }
      } else {
        // Accelerating forward
        nextGear = 'D';
        nextForward = true;
        nextBackward = false;
      }
    } else if (isBackwardPressed) {
      // Brake pedal / Backward key handling
      if (gear === 'D') {
        if (player.speed < 0.3) {
          // Stopped moving forward, now shift to Reverse and go back
          nextGear = 'R';
          nextForward = true; // reverse acceleration in reverse gear
          nextBackward = false;
        } else {
          // Still moving forward, Brake acts as brake
          nextGear = 'D';
          nextForward = false;
          nextBackward = true;
        }
      } else {
        // Reversing
        nextGear = 'R';
        nextForward = true; // reverse acceleration in reverse gear
        nextBackward = false;
      }
    } else {
      // Coasting/rolling friction
      nextForward = false;
      nextBackward = false;
      
      const absSpeed = Math.abs(player.speed);
      if (absSpeed < 0.1) {
        nextGear = 'P';
      } else if (player.speed < -0.1) {
        nextGear = 'R';
      } else {
        nextGear = 'D';
      }
    }

    if (nextGear !== gear) {
      setGear(nextGear);
    }

    // Only commit controls state update if the target mapping differs to prevent loops
    const needsControlsUpdate = 
      controls.forward !== nextForward || 
      controls.backward !== nextBackward || 
      controls.gear !== nextGear;

    if (needsControlsUpdate) {
      setControls(prev => ({
        ...prev,
        forward: nextForward,
        backward: nextBackward,
        gear: nextGear,
      }));
    }
  }, [gasPressed, brakePressed, player.speed, gear, setControls]);

  const triggerNotification = (msg: string) => {
    setNotif(msg);
    setTimeout(() => {
      setNotif(prev => prev === msg ? null : prev);
    }, 1800);
  };

  const toggleIndicators = (type: 'left' | 'right' | 'hazard') => {
    if (type === 'left') {
      setLeftIndicator(prev => !prev);
      setRightIndicator(false);
      setHazardIndicator(false);
    } else if (type === 'right') {
      setRightIndicator(prev => !prev);
      setLeftIndicator(false);
      setHazardIndicator(false);
    } else {
      setHazardIndicator(prev => !prev);
      setLeftIndicator(false);
      setRightIndicator(false);
    }
  };

  return (
    <div id="game-hud" className="absolute inset-0 z-10 flex flex-col justify-between p-4 pb-6 pointer-events-none select-none font-sans">
      
      {/* ================= TOP ROW ================= */}
      <div className="flex items-start justify-between w-full">
        
        {/* --- TOP LEFT: Race Standings, Lap Timer & Engine/Fuel Health telemetry --- */}
        <div className="flex flex-col space-y-2 pointer-events-auto">
          {/* Main Semi-transparent glass dashboard card */}
          <div className="bg-slate-950/70 border border-slate-700/20 backdrop-blur-md p-3.5 px-4 rounded-2xl flex flex-col space-y-2.5 min-w-[210px] sm:min-w-[240px] shadow-2xl">
            {/* Lap / Rank Stats headers */}
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/60">
              <div className="flex items-center space-x-1">
                <Award className="w-4 h-4 text-sky-400" />
                <span className="text-sm font-black text-white">{player.racePosition}<span className="text-[9px] text-slate-400">{positionSuffix(player.racePosition)}</span></span>
              </div>
              <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-md bg-sky-950/40 text-sky-400 border border-sky-900/30">
                <span className="text-[10px] font-black uppercase tracking-wider">Lap</span>
                <span className="text-xs font-bold text-white">{player.currentLap}/3</span>
              </div>
            </div>

            {/* Current timer */}
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest flex items-center">
                <Compass className="w-3.5 h-3.5 mr-1 text-sky-400 animate-spin" style={{ animationDuration: '6s' }} />
                <span>Timer</span>
              </span>
              <span className="font-mono text-base font-black text-sky-300">{formatTime(elapsedTime)}</span>
            </div>
          </div>

          {/* Miniature vertical Standings ledger */}
          <div className="hidden sm:flex flex-col space-y-1 max-w-[210px] p-2 bg-slate-950/45 border border-slate-800/40 backdrop-blur-sm rounded-xl">
            <div className="flex items-center space-x-1 pb-1 border-b border-white/5">
              <Users className="w-3 h-3 text-slate-400" />
              <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest">RACING LEDGER</span>
            </div>
            {leaderboard.slice(0, 3).map((car) => {
              const checkPlayer = car.id === 'player';
              return (
                <div key={car.id} className={`flex items-center justify-between text-[9px] px-1.5 py-0.5 rounded ${checkPlayer ? 'bg-sky-500/20 text-sky-400 font-bold' : 'text-slate-400'}`}>
                  <span className="truncate max-w-[120px]">{car.racePosition}. {car.name}</span>
                  <span className="font-mono">L{car.currentLap}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* HUD Center Notification Banner popups */}
        {notif && (
          <div className="self-center mt-2.5 bg-sky-500/90 backdrop-blur-md px-5 py-1.5 rounded-full border border-sky-300 text-white text-[10px] font-sans font-black tracking-widest uppercase shadow-lg select-none pointer-events-none transition-all duration-150">
            {notif}
          </div>
        )}

        {/* --- TOP RIGHT: Mini Map, Camera, Settings, and Large Pause button --- */}
        <div className="flex items-start space-x-3 pointer-events-auto">
          {/* Action buttons list */}
          <div className="flex flex-col space-y-2">
            <button
              onClick={onPauseToggle}
              id="pause-btn"
              className="p-3 rounded-full bg-slate-950/70 hover:bg-slate-800 border border-slate-700/20 backdrop-blur-md text-white active:scale-95 transition-all shadow-md flex items-center justify-center shrink-0"
              title="Pause race"
            >
              {isPaused ? <Play className="w-4 h-4 fill-current text-sky-400" /> : <Pause className="w-4 h-4" />}
            </button>

            <button
              onClick={() => triggerNotification('Settings: Audio 3D & Graphics High [60 FPS]')}
              className="p-3 rounded-full bg-slate-950/70 hover:bg-slate-800 border border-slate-700/20 backdrop-blur-md text-white/90 active:scale-95 transition-all shadow-md flex items-center justify-center shrink-0"
              title="Settings menu"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {/* Blueprint vector Mini Map HUD overlay */}
          <div className="flex flex-col items-center justify-center p-2 rounded-2xl bg-slate-950/70 border border-slate-700/20 backdrop-blur-md shadow-2xl shrink-0">
            <svg className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28" viewBox="0 0 160 160">
              {/* Back pathways */}
              <path
                d={pathD}
                fill="none"
                stroke="#111827"
                strokeWidth="5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* Blueprint stream core */}
              <path
                d={pathD}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.8"
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity="0.9"
              />
              {/* Opponent markers */}
              {opponents.map((car) => (
                <circle
                  key={car.id}
                  cx={mapX(car?.position?.x ?? 0)}
                  cy={mapZ(car?.position?.z ?? 0)}
                  r="3"
                  fill={car.color || '#ff0000'}
                  stroke="#000000"
                  strokeWidth="0.8"
                />
              ))}
              {/* Glowing Player dot */}
              <circle
                cx={mapX(player?.position?.x ?? 0)}
                cy={mapZ(player?.position?.z ?? 0)}
                r="4.2"
                fill="#38bdf8"
                stroke="#ffffff"
                strokeWidth="1"
                className="animate-pulse"
              />
            </svg>
            <div className="mt-1 font-mono text-[7px] text-slate-400 font-extrabold uppercase tracking-widest flex items-center">
              <span className="w-1 h-1 rounded-full bg-sky-400 mr-1 animate-ping" />
              <span>DRAGON TRACK</span>
            </div>
          </div>
        </div>

      </div>

      {/* ================= MIDDLE NOTIFICATION ROW ================= */}
      <div className="flex justify-center my-auto pointer-events-none">
        {/* Empty or auxiliary messages space */}
      </div>

      {/* ================= BOTTOM ROW: LANDSCAPE SYMMETRY PLATFORM ================= */}
      <div className="flex justify-between items-end w-full select-none pointer-events-none mt-auto mb-4 px-6">
        
        {/* --- LEFT SIDE: COMPACT TRANSLUCENT RACING ARROW CONTROLS --- */}
        <div className="flex items-end pointer-events-auto shrink-0 select-none">
          <div className="flex gap-[28px] items-center">
            {/* Left Steer Arrow Button */}
            <button
              ref={btnLeftRef}
              id="btnLeft"
              style={{
                touchAction: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
                pointerEvents: 'auto',
                width: '120px',
                height: '120px'
              }}
              className={`rounded-full flex flex-col items-center justify-center transition-all bg-slate-950/40 backdrop-blur-md border-2 ${
                leftPressed
                  ? 'border-sky-450 bg-sky-500/25 shadow-[0_0_25px_rgba(56,189,248,0.7)] scale-95'
                  : 'border-sky-500/15 hover:border-sky-400/30 text-sky-400 shadow-[0_4px_12px_rgba(0,0,0,0.5)] bg-slate-950/20'
              }`}
            >
              <ChevronLeft className="w-12 h-12 pointer-events-none" />
              <span className="text-[9px] font-black tracking-wider uppercase pointer-events-none -mt-1">STEER L</span>
            </button>

            {/* Right Steer Arrow Button */}
            <button
              ref={btnRightRef}
              id="btnRight"
              style={{
                touchAction: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
                pointerEvents: 'auto',
                width: '120px',
                height: '120px'
              }}
              className={`rounded-full flex flex-col items-center justify-center transition-all bg-slate-950/40 backdrop-blur-md border-2 ${
                rightPressed
                  ? 'border-sky-450 bg-sky-500/25 shadow-[0_0_25px_rgba(56,189,248,0.7)] scale-95'
                  : 'border-sky-500/15 hover:border-sky-400/30 text-sky-400 shadow-[0_4px_12px_rgba(0,0,0,0.5)] bg-slate-950/20'
              }`}
            >
              <ChevronRight className="w-12 h-12 pointer-events-none" />
              <span className="text-[9px] font-black tracking-wider uppercase pointer-events-none -mt-1">STEER R</span>
            </button>
          </div>
        </div>

        {/* --- CENTER BOTTOM: BLUE GLASS SPEEDOMETER & GEAR TELEMETRY --- */}
        <div className="flex flex-col items-center space-y-2 mx-auto justify-end pointer-events-auto">
          {/* Glassmorphic digital race panel */}
          <div className="bg-slate-950/50 border-2 border-sky-500/20 backdrop-blur-xl p-4 px-6 rounded-3xl flex flex-col items-center shadow-[0_8px_32px_rgba(0,0,0,0.7),0_0_15px_rgba(56,189,248,0.15)] min-w-[200px]">
            {/* Gear display & speed */}
            <div className="flex items-center space-x-5">
              {/* Giant digital transmission block */}
              <div className="flex flex-col items-center">
                <span className="text-[8px] font-black text-sky-400/60 uppercase tracking-widest leading-none mb-1">GEAR</span>
                <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white via-sky-100 to-sky-300 font-mono leading-none tracking-tight shadow-[0_0_10px_rgba(56,189,248,0.3)] select-none">
                  {gear}
                </span>
              </div>

              {/* Vertical Divider */}
              <div className="w-0.5 h-10 bg-gradient-to-b from-sky-500/0 via-sky-500/30 to-sky-500/0" />

              {/* Speedy numbers */}
              <div className="flex flex-col items-start leading-none">
                <div className="flex items-baseline space-x-1">
                  <span className="text-4xl font-extrabold text-white font-mono tracking-tight glow-text leading-none">{speedKmh}</span>
                  <span className="text-xs text-sky-400 font-extrabold tracking-wider uppercase leading-none">KM/H</span>
                </div>
                {/* Micro speed percentage progress glow bar */}
                <div className="w-24 h-1.5 bg-slate-950/85 rounded-full mt-2 border border-slate-900/40 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-sky-500 via-cyan-400 to-teal-400 rounded-full transition-all duration-75 shadow-[0_0_8px_rgba(56,189,248,0.5)]"
                    style={{ width: `${speedPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Integrated micro indicator light dots */}
            <div className="flex mt-3 space-x-4 items-center">
              <span className={`w-1.5 h-1.5 rounded-full ${leftIndicator && flash ? 'bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'bg-slate-800'}`} />
              <span className="text-[8px] font-extrabold text-slate-500 uppercase tracking-widest font-mono">TELEMETRY</span>
              <span className={`w-1.5 h-1.5 rounded-full ${rightIndicator && flash ? 'bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'bg-slate-800'}`} />
            </div>
          </div>
        </div>

        {/* --- RIGHT SIDE: COMPACT VERTICAL RACING CLUSTER CONTROLS --- */}
        <div className="flex flex-col items-end space-y-4 pointer-events-auto shrink-0 select-none mb-1 mr-4">
          
          {/* NITRO & DRIFT Stack Row */}
          <div className="flex space-x-4 items-center">
            {/* Drift Button */}
            <button
              id="btnDrift"
              ref={btnDriftRef}
              style={{
                touchAction: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
                pointerEvents: 'auto'
              }}
              className={`w-16 h-16 rounded-full flex flex-col items-center justify-center transition-all bg-slate-950/45 backdrop-blur-sm border border-slate-800/40 text-orange-400 hover:text-orange-300 shadow-[0_4px_12px_rgba(0,0,0,0.5)] ${
                driftPressed
                  ? 'bg-orange-500 border border-orange-300 ring-4 ring-orange-500/30 text-white scale-95 shadow-[0_0_15px_rgba(249,115,22,0.6)]'
                  : 'active:bg-slate-900/60 bg-slate-950/20'
              }`}
            >
              <Flame className="w-7 h-7 text-orange-400 pointer-events-none animate-pulse" />
              <span className="text-[7.5px] font-black tracking-widest uppercase pointer-events-none mt-0.5">DRIFT</span>
            </button>

            {/* Nitro Button */}
            <button
              id="btnNitro"
              ref={btnNitroRef}
              disabled={player.nitroCharged < 20}
              style={{
                touchAction: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
                pointerEvents: 'auto'
              }}
              className={`w-16 h-16 rounded-full flex flex-col items-center justify-center transition-all shadow-[0_4px_12px_rgba(0,0,0,0.5)] ${
                player.nitroCharged < 20
                  ? 'bg-slate-950/15 border border-slate-850 opacity-25 cursor-not-allowed text-slate-500'
                  : controls.nitro
                    ? 'bg-cyan-500/80 border border-cyan-300 ring-4 ring-cyan-500/30 text-white scale-95 shadow-[0_0_15px_rgba(6,182,212,0.6)]'
                    : 'bg-cyan-950/45 border border-cyan-900/40 text-cyan-400 hover:text-cyan-300 animate-pulse bg-slate-950/20'
              }`}
            >
              <Zap className="w-7 h-7 fill-current pointer-events-none" />
              <span className="text-[7.5px] font-black tracking-widest uppercase pointer-events-none mt-0.5">{Math.floor(player.nitroCharged)}%</span>
            </button>
          </div>

          {/* Pedals Pedal Cluster (Brake on Left, Gas on Right) */}
          <div className="flex space-x-4 items-end">
            {/* Brake Pedal Button */}
            <button
              id="btnBrake"
              ref={btnBrakeRef}
              style={{
                touchAction: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
                pointerEvents: 'auto'
              }}
              className={`w-20 h-28 rounded-2xl flex flex-col items-center justify-between py-4 transition-all bg-slate-950/30 backdrop-blur-sm border-2 ${
                brakePressed
                  ? 'bg-rose-600 border-rose-450 ring-4 ring-rose-500/30 text-white scale-95 shadow-[0_0_15px_rgba(225,29,72,0.6)]'
                  : 'border-rose-950/45 text-rose-450 hover:text-rose-400 hover:border-rose-300 shadow-[0_4px_12px_rgba(0,0,0,0.5)] bg-slate-950/20'
              }`}
            >
              <div className="w-10 h-1 bg-rose-500/30 rounded-full" />
              <span className="text-[10px] font-black tracking-widest uppercase pointer-events-none">BRAKE</span>
              <div className="w-12 h-6 border-t border-rose-500/25 flex items-center justify-center">
                <ChevronLeft className="w-5 h-5 -rotate-90 pointer-events-none text-rose-500" />
              </div>
            </button>

            {/* Accelerator/Gas Pedal Button */}
            <button
              id="btnGas"
              ref={btnGasRef}
              style={{
                touchAction: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
                pointerEvents: 'auto'
              }}
              className={`w-20 h-32 rounded-2xl flex flex-col items-center justify-between py-5 transition-all bg-slate-950/30 backdrop-blur-sm border-2 ${
                gasPressed
                  ? 'bg-emerald-600 border-emerald-450 ring-4 ring-emerald-500/30 text-white scale-95 shadow-[0_0_20px_rgba(16,185,129,0.7)]'
                  : 'border-emerald-950/45 text-emerald-450 hover:text-emerald-400 hover:border-emerald-300 shadow-[0_4px_16px_rgba(0,0,0,0.6)]'
              }`}
            >
              <div className="w-12 h-1 bg-emerald-500/30 rounded-full animate-pulse" />
              <span className="text-[10px] font-black tracking-widest uppercase pointer-events-none">GAS</span>
              <div className="w-12 h-6 border-t border-emerald-500/25 flex items-center justify-center">
                <ChevronLeft className="w-6 h-6 rotate-90 pointer-events-none text-emerald-500" />
              </div>
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
