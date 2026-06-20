/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Gamepad2, Radio } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

const SPLASH_TIPS = [
  "Retrieving regional drift server metrics...",
  "Syncing volumetric showroom HDR pipelines...",
  "Calibrating active suspension torque rates...",
  "Allocating high-fidelity physics collision grids...",
  "Authenticating secure racer satellite links..."
];

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    // Progress increment timer
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        // Speed up slightly or fluctuate like a real game loading bar
        const increment = Math.floor(Math.random() * 8) + 4;
        return Math.min(100, prev + increment);
      });
    }, 120);

    // Dynamic advice/tips interval
    const tipInterval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % SPLASH_TIPS.length);
    }, 800);

    return () => {
      clearInterval(progressInterval);
      clearInterval(tipInterval);
    };
  }, []);

  useEffect(() => {
    if (progress === 100) {
      const waitTimeout = setTimeout(() => {
        onComplete();
      }, 600); // Small pause for 100% confirmation
      return () => clearTimeout(waitTimeout);
    }
  }, [progress, onComplete]);

  return (
    <div 
      id="splash-screen-root"
      className="fixed inset-0 w-screen h-[100dvh] bg-black text-white select-none overflow-hidden flex flex-col items-center justify-between p-12 z-[9999]"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        overflow: 'hidden',
        background: '#03050a'
      }}
    >
      {/* Immersive cinematic background particles & glows */}
      <div className="absolute inset-0 bg-gradient-to-tr from-cyan-950/20 via-black to-blue-950/30 z-0 pointer-events-none" />
      
      {/* High-speed track overlay grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,242,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(0,242,255,0.015)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none z-0 opacity-40" />

      {/* Floating blurred ambient neon orbs */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[160px] pointer-events-none animate-pulse" />

      {/* Top Section: Satellite Server Connection Indicators */}
      <div className="w-full flex justify-between items-center z-10 font-mono text-[9px] text-[#00f2ff]/60 tracking-widest">
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 bg-[#00f2ff] rounded-full animate-ping" />
          <span className="uppercase">GRID SATELLITE: CONNECTED APAC-S1</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="uppercase">ENGINE v5.8.4</span>
          <span className="uppercase font-black text-emerald-400">FPS: 60.00</span>
        </div>
      </div>

      {/* Middle Section: Massive Majestic Metallic Logo with Flares */}
      <div className="flex flex-col items-center text-center z-10 space-y-4">
        {/* Animated Brand Emblem */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [0.8, 1.05, 1], opacity: 1 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="relative p-6 rounded-3xl bg-gradient-to-br from-[#003cff]/10 to-[#00f2ff]/10 border border-[#00f2ff]/20 shadow-[0_0_50px_rgba(0,242,255,0.15)]"
        >
          <Gamepad2 className="w-16 h-16 text-[#00f2ff] drop-shadow-[0_0_15px_#00f2ff]" />
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 10, ease: 'linear' }}
            className="absolute inset-0 rounded-3xl border border-dashed border-[#00f2ff]/30 pointer-events-none scale-110" 
          />
        </motion.div>

        {/* Title */}
        <div className="space-y-1">
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-5xl md:text-6xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-[#00f2ff] leading-none"
          >
            ASPHALT GRID
          </motion.h1>
          <motion.p
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-xs tracking-[8px] md:tracking-[12px] font-bold text-slate-400 uppercase font-sans mr-[-8px] md:mr-[-12px]"
          >
            HYPER DRIFT CHAMPIONS
          </motion.p>
        </div>

        {/* Sub-line */}
        <div className="inline-flex items-center space-x-2 bg-cyan-950/30 border border-[#00f2ff]/10 px-4 py-1.5 rounded-full text-[10px] text-[#00f2ff]">
          <Radio className="w-3.5 h-3.5 animate-pulse shrink-0" />
          <span className="font-mono tracking-wider font-bold">AAA GRAPHICS EMULATION SYSTEM ON</span>
        </div>
      </div>

      {/* Bottom Section: Immersive PUBG-Style Loading Bar */}
      <div className="w-full max-w-xl flex flex-col items-center z-10 space-y-4">
        {/* Dynamic loading hints message switching */}
        <div className="h-6 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={tipIndex}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="text-xs font-medium text-[#7ee1fc] font-mono tracking-wide text-center uppercase"
            >
              {SPLASH_TIPS[tipIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* The loading bar block */}
        <div className="w-full space-y-2">
          <div className="w-full h-2.5 bg-black/60 rounded-full p-[2px] border border-white/5 shadow-inner overflow-hidden">
            <motion.div
              layout
              className="h-full rounded-full bg-gradient-to-r from-[#003cff] via-[#00f2ff] to-[#00ff88] shadow-[0_0_15px_#00f2ff] relative"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 font-bold px-1 select-all">
            <span>UPDATING SYSTEM DEPENDENCIES</span>
            <span className="text-[#00f2ff] text-xs font-black">{progress}%</span>
          </div>
        </div>

        {/* Disclaimer / Credits */}
        <p className="text-[9px] text-slate-600 font-mono text-center max-w-xs leading-none">
          ASPHALT GRID &copy; 2026. SECURE SERVER PROTECTED. UNMATCHED SPEED EXPERIMENT.
        </p>
      </div>
    </div>
  );
};
