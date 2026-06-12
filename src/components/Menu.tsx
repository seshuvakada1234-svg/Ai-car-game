/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Difficulty, GameSettings } from '../types';
import { Zap, Trophy, Shield, HelpCircle, Sparkles } from 'lucide-react';

interface MenuProps {
  onStartGame: (settings: GameSettings) => void;
}

export const Menu: React.FC<MenuProps> = ({ onStartGame }) => {
  const [playerName, setPlayerName] = useState('Speedster');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [carColor, setCarColor] = useState('#0062ff'); // default blue

  const colorPresets = [
    { name: 'Cosmic Blue', hex: '#0062ff' },
    { name: 'Redline Ruby', hex: '#ff003c' },
    { name: 'Championship Gold', hex: '#ffac00' },
    { name: 'Emerald Forest', hex: '#00ff50' },
    { name: 'Matte Shadow Carbon', hex: '#1c1f24' },
    { name: 'Neon Purple', hex: '#b300ff' },
  ];

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    onStartGame({
      playerName: playerName.trim() || 'Racer',
      difficulty,
      carColor,
    });
  };

  return (
    <div id="game-menu" className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/90 text-white font-sans overflow-y-auto px-4 py-8">
      
      {/* Background cinematic visuals spacer / glow card */}
      <div className="absolute w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute w-[300px] h-[300px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none -bottom-10" />

      <div className="relative w-full max-w-lg p-6 md:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-2xl">
        
        {/* Banner Logo Title */}
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center space-x-1 bg-blue-500/10 text-blue-400 font-extrabold uppercase text-[10px] tracking-widest px-3 py-1 rounded-full border border-blue-500/10">
            <Sparkles className="w-3 h-3 fill-current" />
            <span>Premium 3D Arcade</span>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-amber-300">
            AI Race Arena Live
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Challenge elite AI drivers through the hairpin cliffs of Dragon Mountain Pass
          </p>
        </div>

        {/* Configurations Form */}
        <form onSubmit={handleStart} className="space-y-5">
          
          {/* Racer Nickname Input */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
              Racer Tag Name
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value.slice(0, 15))}
              placeholder="Tag Name"
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 text-slate-100 font-semibold px-4 py-3 rounded-xl outline-none transition duration-150"
              required
            />
          </div>

          {/* Car Metallic Color Customization */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
              Supercar Livery Paint
            </label>
            
            <div className="grid grid-cols-6 gap-2">
              {colorPresets.map((preset) => {
                const isSelected = carColor === preset.hex;
                return (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => setCarColor(preset.hex)}
                    title={preset.name}
                    className={`h-11 rounded-xl cursor-pointer relative flex items-center justify-center transition border ${
                      isSelected 
                        ? 'border-white scale-105 ring-2 ring-blue-500/40' 
                        : 'border-slate-800 hover:border-slate-700 hover:scale-102'
                    }`}
                    style={{ backgroundColor: preset.hex }}
                  >
                    {isSelected && (
                      <span className="absolute w-2 h-2 rounded-full bg-white shadow-md animate-ping" />
                    )}
                  </button>
                );
              })}
            </div>
            <span className="text-[10px] text-slate-500 text-left">
              Current Paint: <b className="text-slate-400" style={{ color: carColor }}>{colorPresets.find(p => p.hex === carColor)?.name || 'Custom'}</b>
            </span>
          </div>

          {/* AI Difficulty Ratios selector */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400 flex items-center space-x-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>Grid Difficulty Level</span>
            </label>
            
            <div className="grid grid-cols-3 gap-2">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map((level) => {
                const isActive = difficulty === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDifficulty(level)}
                    className={`py-2 rounded-xl text-xs font-bold uppercase transition border ${
                      isActive
                        ? 'bg-blue-600 border-blue-400 text-white shadow-lg'
                        : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-800 hover:text-slate-300'
                    }`}
                  >
                    {level}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tutorial guides Panel */}
          <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-2xl text-left space-y-2">
            <div className="flex items-center space-x-1.5 text-slate-300 text-[10px] uppercase font-bold tracking-wider">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>Mechanics Tutorial</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
              <div className="space-y-1">
                <span className="block font-bold text-slate-300 uppercase">⚡ Nitro Boost:</span>
                <p className="leading-normal">Press <b className="text-cyan-400">[SPACE]</b> or tap the lightning button to boost speed. Nitro charges automatically and faster when drifting.</p>
              </div>
              <div className="space-y-1">
                <span className="block font-bold text-slate-300 uppercase">🏎️ Slipstream Drift:</span>
                <p className="leading-normal">Hold direction keys while speeding to drift sideways. Drifting charges nitro cells rapidly!</p>
              </div>
            </div>
          </div>

          {/* Action trigger button */}
          <button
            type="submit"
            id="start-race-btn"
            className="w-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-extrabold uppercase text-sm tracking-widest py-4 rounded-xl shadow-lg hover:shadow-cyan-500/20 active:scale-[0.98] transition cursor-pointer flex items-center justify-center space-x-2"
          >
            <Trophy className="w-4 h-4 fill-current animate-bounce" />
            <span>Enter Race Grid</span>
          </button>
        </form>
      </div>

    </div>
  );
};
