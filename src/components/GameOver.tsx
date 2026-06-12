/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CarState } from '../types';
import { Award, RotateCcw, Home, Clock, Sparkles } from 'lucide-react';

interface GameOverProps {
  player: CarState;
  opponents: CarState[];
  elapsedTime: number;
  onRestart: () => void;
  onHome: () => void;
}

export const GameOver: React.FC<GameOverProps> = ({
  player,
  opponents,
  elapsedTime,
  onRestart,
  onHome,
}) => {
  // Amalgamate leaderboard positions
  const fullLeaderboard = [player, ...opponents].sort((a, b) => a.racePosition - b.racePosition);
  
  const playerRank = player.racePosition;
  const isVictory = playerRank === 1;

  // Format race timers helper
  const formatTime = (timeSec: number) => {
    const mins = Math.floor(timeSec / 60);
    const secs = Math.floor(timeSec % 60);
    const centis = Math.floor((timeSec % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
  };

  return (
    <div id="game-over" className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/95 text-white font-sans overflow-y-auto p-4 md:p-8">
      
      {/* Background cinematic visuals spacer / glow card */}
      <div className={`absolute w-[360px] h-[360px] rounded-full blur-[110px] pointer-events-none ${isVictory ? 'bg-amber-500/10' : 'bg-rose-500/10'}`} />

      <div className="relative w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-slate-800/80 backdrop-blur-md shadow-2xl text-center space-y-6">
        
        {/* Banner Headers (Victory vs Defeat badges) */}
        <div className="space-y-2">
          <div className="inline-flex justify-center mx-auto p-4 rounded-full bg-slate-950/80 border border-slate-800 shadow-inner">
            <Award className={`w-12 h-12 ${isVictory ? 'text-amber-400 fill-current animate-pulse' : 'text-slate-400'}`} />
          </div>

          <h2 className="text-3xl font-black tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400">
            {isVictory ? 'Victory Podium!' : 'Race Complete!'}
          </h2>
          
          <p className="text-xs text-slate-400 font-medium">
            {isVictory 
              ? 'You mastered Dragon Mountain Pass as the supreme champion!' 
              : `You crossed the line in ${playerRank} place! Try again to grab the trophy.`}
          </p>
        </div>

        {/* Dynamic Race timing box */}
        <div className="flex border border-slate-800 rounded-2xl bg-slate-950/65 divide-x divide-slate-800 text-left">
          <div className="flex-1 p-4 flex flex-col justify-center">
            <span className="text-[9px] uppercase font-bold tracking-widest text-[#00f2ffa5] flex items-center space-x-1">
              <Clock className="w-3 h-3 text-[#00f2ffa5]" />
              <span>Your Total Time</span>
            </span>
            <span className="text-xl font-mono font-bold mt-1 text-teal-300">
              {formatTime(elapsedTime)}
            </span>
          </div>

          <div className="flex-1 p-4 flex flex-col justify-center">
            <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400 flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-slate-400" />
              <span>Race Class</span>
            </span>
            <span className="text-sm font-extrabold uppercase mt-1.5 text-slate-200">
              {player.difficulty || 'Normal'} AI
            </span>
          </div>
        </div>

        {/* Global Standings list */}
        <div className="text-left space-y-1.5">
          <h3 className="text-[10px] uppercase font-extrabold tracking-widest text-slate-400 px-1">
            Official Lineup Rankings
          </h3>
          
          <div className="flex flex-col space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {fullLeaderboard.map((car, index) => {
              const isPlayer = car.id === 'player';
              const isPodiumNum = car.racePosition <= 3;

              return (
                <div
                  key={car.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all duration-150 ${
                    isPlayer 
                      ? 'bg-blue-600/20 border-blue-500/50 shadow-inner' 
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {/* Rank medals styling */}
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                      car.racePosition === 1 ? 'bg-amber-400 text-amber-950' :
                      car.racePosition === 2 ? 'bg-slate-300 text-slate-900' :
                      car.racePosition === 3 ? 'bg-amber-700/80 text-amber-50' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {car.racePosition}
                    </span>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: car.color }}
                    />
                    <span className={`text-xs ${isPlayer ? 'font-black text-white' : 'font-medium text-slate-300'}`}>
                      {car.name} {isPlayer && '(You)'}
                    </span>
                  </div>

                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">
                    {index === 0 ? '🏁 Champion' : `+${(index * 2.1).toFixed(1)}s`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Buttons Action items */}
        <div className="flex space-x-3 pt-2">
          <button
            onClick={onHome}
            className="flex-1 bg-slate-950 hover:bg-slate-850 text-slate-300 font-bold uppercase text-xs tracking-wider py-3.5 rounded-xl border border-slate-800 transition duration-150 flex items-center justify-center space-x-2"
          >
            <Home className="w-4 h-4" />
            <span>Main Menu</span>
          </button>

          <button
            onClick={onRestart}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-extrabold uppercase text-xs tracking-widest py-3.5 rounded-xl border border-blue-400 transition duration-150 shadow-lg flex items-center justify-center space-x-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Race Again</span>
          </button>
        </div>

      </div>

    </div>
  );
};
