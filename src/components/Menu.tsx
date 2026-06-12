/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Difficulty, GameSettings } from '../types';
import { Zap, Trophy, Shield, HelpCircle, Sparkles, Download, CheckCircle, AlertOctagon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { loadSpecificCarModel } from '../world/procedural';

// Import our beautiful custom generated preview coordinates
import lamboPreview from '../assets/images/lambo_garage_1781251735063.jpg';
import ferrariPreview from '../assets/images/ferrari_garage_1781251750236.jpg';
import bugattiPreview from '../assets/images/bugatti_garage_1781251768295.jpg';
import porschePreview from '../assets/images/porsche_garage_1781251783563.jpg';

interface MenuProps {
  onStartGame: (settings: GameSettings) => void;
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
    desc: 'V12 naturally-aspirated aerodynamic monster with roaring track energy.',
    gradient: 'from-orange-500/20 via-slate-950 to-slate-950',
    borderGlow: 'shadow-[0_0_20px_rgba(249,115,22,0.35)] border-orange-500/50',
    colorPreset: '#ff5500'
  },
  {
    id: 'ferrari' as const,
    name: 'Ferrari Purosangue',
    image: ferrariPreview,
    class: 'A CLASS',
    topSpeed: 310,
    acceleration: '3.3s',
    handling: 90,
    desc: 'Supreme active-suspension SUV utilities delivering unmatched active stability.',
    gradient: 'from-red-650/20 via-slate-950 to-slate-950',
    borderGlow: 'shadow-[0_0_20px_rgba(220,38,38,0.35)] border-red-500/50',
    colorPreset: '#ff003c'
  },
  {
    id: 'bugatti' as const,
    name: 'Bugatti Chiron',
    image: bugattiPreview,
    class: 'HYPER CLASS',
    topSpeed: 420,
    acceleration: '2.4s',
    handling: 80,
    desc: 'Unmatched continuous speed powered by a monstrous quad-turbo W16.',
    gradient: 'from-cyan-500/20 via-slate-950 to-slate-950',
    borderGlow: 'shadow-[0_0_20px_rgba(6,182,212,0.35)] border-cyan-400/50',
    colorPreset: '#00ccff'
  },
  {
    id: 'porsche' as const,
    name: 'Porsche 911 GT3',
    image: porschePreview,
    class: 'A CLASS',
    topSpeed: 320,
    acceleration: '3.2s',
    handling: 98,
    desc: 'Surgeon-like track precision crafted directly from pure GT motorsport racing heritage.',
    gradient: 'from-emerald-500/20 via-slate-950 to-slate-950',
    borderGlow: 'shadow-[0_0_20px_rgba(16,185,129,0.35)] border-emerald-400/50',
    colorPreset: '#00ff3c'
  },
];

export const Menu: React.FC<MenuProps> = ({ onStartGame }) => {
  const [playerName, setPlayerName] = useState('Speedster');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [selectedCar, setSelectedCar] = useState<'lamborghini' | 'ferrari' | 'bugatti' | 'porsche'>('lamborghini');

  // Custom livery paint hex defaults to the selected car's standard color preset (automatically set on car swap)
  const [carColor, setCarColor] = useState('#ff5500');

  // Asset preloading progress pipeline
  const [loadStatus, setLoadStatus] = useState<'idle' | 'downloading' | 'ready' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);

  const handleSelectCar = (id: 'lamborghini' | 'ferrari' | 'bugatti' | 'porsche') => {
    setSelectedCar(id);
    // Auto-update paint to match brand presets
    const chosen = CARS_GARAGE.find(c => c.id === id);
    if (chosen) setCarColor(chosen.colorPreset);
  };

  const handleStartProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadStatus('downloading');
    setProgress(0);

    try {
      // Trigger loader with progress reporting
      await loadSpecificCarModel(selectedCar, (pct) => {
        setProgress(pct);
      });

      // Complete
      setProgress(100);
      setLoadStatus('ready');

      // Hold briefly for cinematic user feedback
      setTimeout(() => {
        onStartGame({
          playerName: playerName.trim() || 'Racer',
          difficulty,
          carColor,
          selectedCar
        });
      }, 1000);

    } catch (err) {
      console.error("Failed downloading car assets:", err);
      setLoadStatus('failed');
    }
  };

  return (
    <div id="game-menu" className="absolute inset-0 z-20 flex flex-col justify-start bg-slate-950 text-white font-sans overflow-y-auto px-4 py-6 md:px-8 select-none">
      
      {/* Background neon glows */}
      <div className="absolute w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[140px] pointer-events-none -top-10 left-10" />
      <div className="absolute w-[550px] h-[550px] bg-cyan-500/5 rounded-full blur-[140px] pointer-events-none bottom-20 right-10" />

      {/* Header and Branding Title */}
      <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between border-b border-slate-900/60 pb-5 mb-6 space-y-4 md:space-y-0">
        <div className="flex flex-col items-center md:items-start space-y-1">
          <div className="inline-flex items-center space-x-1.5 bg-cyan-500/10 text-cyan-400 font-extrabold uppercase text-[10px] tracking-widest px-3.5 py-1 rounded-full border border-cyan-500/20 shadow-[0_0_12px_rgba(34,211,238,0.15)]">
            <Sparkles className="w-3.5 h-3.5 fill-current animate-pulse text-cyan-400" />
            <span className="font-semibold">ASPHALT CHAMPIONS LIVE Arena</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400">
            Showroom Garage
          </h1>
          <p className="text-[11px] text-slate-500 font-medium">
            Configure your custom supercar livery and prepare to challenge the global AI grid
          </p>
        </div>

        {/* User Driver Profile configurations */}
        <div className="flex flex-wrap items-center gap-4 bg-slate-900/40 border border-slate-800/60 p-3 rounded-2xl backdrop-blur-md">
          <div className="flex flex-col space-y-1">
            <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500">Racer Nickname</span>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value.slice(0, 15))}
              className="bg-slate-950/80 border border-slate-800 focus:border-cyan-500 text-slate-100 font-bold text-xs px-3.5 py-1.5 rounded-lg outline-none transition duration-150 w-36"
              required
            />
          </div>

          <div className="flex flex-col space-y-1">
            <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500">Grid Difficulty</span>
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map((level) => {
                const isActive = difficulty === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDifficulty(level)}
                    className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition cursor-pointer ${
                      isActive
                        ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {level}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* HORIZONTAL CAR GARAGE SECTION */}
      <div className="w-full max-w-7xl mx-auto flex-grow flex flex-col space-y-4 mb-6">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
            <span className="w-1.5 h-3.5 bg-cyan-400 rounded-sm inline-block"></span>
            <span>Select Hypercar Class</span>
          </h2>
          <span className="text-[10px] font-mono text-cyan-400">AVAILABLE: {CARS_GARAGE.length} MODELS</span>
        </div>

        {/* Car Cards Grid Container */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CARS_GARAGE.map((car) => {
            const isSelected = selectedCar === car.id;
            return (
              <motion.div
                key={car.id}
                onClick={() => handleSelectCar(car.id)}
                whileHover={{ scale: 1.02 }}
                className={`relative flex flex-col bg-slate-1000 backdrop-blur-md rounded-2xl overflow-hidden cursor-pointer transition border border-slate-800/85 hover:border-cyan-500/40 select-none ${
                  isSelected ? 'border-cyan-400 ring-1 ring-cyan-400/40 bg-gradient-to-b ' + car.gradient : ''
                }`}
              >
                
                {/* Vehicle Class Badge */}
                <div className="absolute top-2.5 right-2.5 z-10">
                  <span className={`text-[9px] font-black tracking-widest px-2.5 py-0.5 rounded-full ${
                    car.class.includes('S') 
                      ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' 
                      : car.class.includes('HYPER') 
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    {car.class}
                  </span>
                </div>

                {/* Cover Image */}
                <div className="relative aspect-[4/3] bg-slate-950 overflow-hidden group">
                  <img
                    src={car.image}
                    alt={car.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {/* High Tech Cover Overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
                </div>

                {/* Car details & Specs */}
                <div className="p-4 flex flex-col flex-grow text-left space-y-3">
                  <div>
                    <h3 className="text-base font-black uppercase tracking-tight text-white leading-tight">
                      {car.name}
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 h-7">
                      {car.desc}
                    </p>
                  </div>

                  {/* Visual Stat Bars */}
                  <div className="space-y-2 py-2 border-t border-b border-slate-900/60 font-mono">
                    {/* Top Speed Stat */}
                    <div className="flex flex-col space-y-1">
                      <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                        <span>Top Speed</span>
                        <span className="text-white">{car.topSpeed} km/h</span>
                      </div>
                      <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-400" 
                          style={{ width: `${(car.topSpeed / 420) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Acceleration Stat */}
                    <div className="flex flex-col space-y-1">
                      <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                        <span>0-100 Accel</span>
                        <span className="text-white">{car.acceleration}</span>
                      </div>
                      <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-red-500 to-amber-400" 
                          style={{ width: `${(2.4 / parseFloat(car.acceleration)) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Handling Stat */}
                    <div className="flex flex-col space-y-1">
                      <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                        <span>Handling DB</span>
                        <span className="text-white">{car.handling} / 100</span>
                      </div>
                      <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400" 
                          style={{ width: `${car.handling}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* CAR SELECTOR BUTTON */}
                  <button
                    type="button"
                    className={`w-full py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25 font-black'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    {isSelected ? '★ SELECTED' : 'CHOOSE CHASSIS'}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* MECHANICS GUIDELINE TUTORIAL */}
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/20 border border-slate-900/60 px-5 py-4 rounded-3xl backdrop-blur-md text-left mb-6">
        <div className="space-y-1">
          <div className="flex items-center space-x-1.5 text-slate-300 text-[10px] uppercase font-bold tracking-widest">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>METALLIC CUSTOM LIVERY PAINT</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-normal max-w-lg">
            Selecting a model load dynamically resets preset colors. Modify color overrides configurations directly inside the HUD as you speed across cliff nodes.
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center space-x-1.5 text-slate-300 text-[10px] uppercase font-bold tracking-widest">
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span>ACCELERATOR & DRIFTING MECHANICS</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-normal max-w-lg">
            Tap direction keys <b className="text-white">[A]/[D]</b> or <b className="text-white">[←]/[→]</b> to drift around hairpin curbs to load Nitro. Press <b className="text-cyan-400">[SPACEBAR]</b> to unleash maximum acceleration!
          </p>
        </div>
      </div>

      {/* MAIN START TRIGGER */}
      <div className="w-full max-w-lg mx-auto pb-8">
        <button
          type="button"
          onClick={handleStartProcess}
          id="start-race-btn"
          className="w-full bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-500 hover:brightness-105 text-white font-extrabold uppercase text-sm tracking-widest py-4 rounded-xl shadow-2xl shadow-cyan-500/25 active:scale-[0.98] transition cursor-pointer flex items-center justify-center space-x-2 border border-cyan-400/20"
        >
          <Trophy className="w-4 h-4 text-white fill-current animate-bounce" />
          <span>ENTER RACE GRID</span>
        </button>
      </div>

      {/* ================= CINEMATIC DOWNLOADING & PREPARING VEHICLE OVERLAY ================= */}
      <AnimatePresence>
        {loadStatus !== 'idle' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-xl"
          >
            <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-center flex flex-col items-center space-y-6 relative overflow-hidden">
              {/* Highlight background lines */}
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
                    <p className="text-xs text-slate-400 font-medium">
                      Downloading {CARS_GARAGE.find(c => c.id === selectedCar)?.name}...
                    </p>
                  </div>

                  {/* Progress Glow meter */}
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
                      The selected vehicle {CARS_GARAGE.find(c => c.id === selectedCar)?.name} is currently unavailable. Please choose another car or try again.
                    </p>
                  </div>

                  <div className="w-full flex space-x-3 mt-4">
                    <button
                      type="button"
                      onClick={() => setLoadStatus('idle')}
                      className="flex-1 py-3 bg-slate-950 border border-slate-850 hover:border-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider hover:text-white"
                    >
                      Return
                    </button>
                    <button
                      type="button"
                      onClick={handleStartProcess}
                      className="flex-1 py-3 bg-red-650 hover:bg-red-500 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-lg"
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
