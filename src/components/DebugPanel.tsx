import React, { useEffect, useState } from 'react';
import { Activity, ShieldAlert, Cpu, Layers, Disc3 } from 'lucide-react';

export const DebugPanel: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [metrics, setMetrics] = useState({
    fps: 0,
    carLoaded: false,
    mapLoaded: false,
    shaders: 'pending',
    world: 'pending',
    assetFailures: [] as string[],
    aiCount: 0,
    treeCount: 0,
    gpu: { geometries: 0, textures: 0, programs: 0 },
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const win = window as any;
      setMetrics({
        fps: Math.round(win.currentFPS || 0),
        carLoaded: !!(win.carLoaded || win.playerCarAddedToScene),
        mapLoaded: !!win.mapLoaded,
        shaders: win.shadersCompiled ? 'compiled' : 'pending',
        world: win.worldReady ? 'ready' : 'pending',
        assetFailures: win.assetFailures || [],
        aiCount: win.aiCount || 0,
        treeCount: win.forestTreeCount || 0,
        gpu: win.gpuMemory || { geometries: 0, textures: 0, programs: 0 },
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      id="game-debug-overlay"
      className="fixed bottom-4 left-4 z-[9999] pointer-events-auto"
    >
      {collapsed ? (
        <button
          id="btn-debug-expand"
          onClick={() => setCollapsed(false)}
          className="flex items-center space-x-2 bg-slate-950/85 border border-cyan-500/50 hover:border-cyan-400 text-cyan-400 text-xs px-3 py-1.5 rounded-md shadow-[0_0_15px_rgba(6,182,212,0.15)] font-mono transition-all duration-300 backdrop-blur-md"
        >
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span>SHOW CONSOLE</span>
        </button>
      ) : (
        <div className="w-72 bg-slate-950/90 border border-cyan-500/50 rounded-lg p-3 shadow-[0_0_20px_rgba(6,182,212,0.25)] backdrop-blur-md font-mono text-[10px] text-cyan-400 flex flex-col space-y-2.5 transition-all duration-300">
          <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1.5">
            <div className="flex items-center space-x-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400 spin-infinite" />
              <span className="font-bold tracking-widest text-cyan-300 uppercase">ENGINE GRAPHICS HUD</span>
            </div>
            <button
              id="btn-debug-minimize"
              onClick={() => setCollapsed(true)}
              className="text-cyan-500 hover:text-cyan-300 px-1 hover:bg-cyan-500/10 rounded transition-all"
            >
              [MINIMIZE]
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="flex flex-col bg-cyan-950/10 border border-cyan-500/10 rounded p-1.5">
              <span className="text-slate-500 text-[8px] uppercase">Frame Rate</span>
              <span className={`text-sm font-bold ${metrics.fps > 55 ? 'text-emerald-400' : metrics.fps > 30 ? 'text-amber-400' : 'text-rose-400'}`}>
                {metrics.fps} FPS
              </span>
            </div>

            <div className="flex flex-col bg-cyan-950/10 border border-cyan-500/10 rounded p-1.5">
              <span className="text-slate-500 text-[8px] uppercase">Active AI Cars</span>
              <span className="text-sm font-bold text-cyan-300">
                {metrics.aiCount} DRIVERS
              </span>
            </div>
          </div>

          <div className="space-y-1 bg-slate-900/40 p-2 rounded border border-cyan-500/10">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">VEHICLE ASSET:</span>
              <span className={`font-semibold ${metrics.carLoaded ? 'text-emerald-400' : 'text-slate-500'}`}>
                {metrics.carLoaded ? 'LOADED' : 'PENDING'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">TRACK MAP:</span>
              <span className={`font-semibold ${metrics.mapLoaded ? 'text-emerald-400' : 'text-slate-500'}`}>
                {metrics.mapLoaded ? 'LOADED' : 'PENDING'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">WEBGL SHADERS:</span>
              <span className={`font-semibold ${metrics.shaders === 'compiled' ? 'text-emerald-400' : 'text-cyan-500 animate-pulse'}`}>
                {metrics.shaders.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">WORLD PIPELINE:</span>
              <span className={`font-semibold ${metrics.world === 'ready' ? 'text-emerald-400' : 'text-cyan-500'}`}>
                {metrics.world.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="space-y-1 bg-slate-900/40 p-2 rounded border border-cyan-500/10">
            <div className="flex items-center space-x-1 border-b border-cyan-500/10 pb-0.5 mb-1.5">
              <Layers className="w-3 h-3 text-cyan-500" />
              <span className="text-[8px] text-cyan-300 font-bold uppercase">Instance Allocations</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Veg/Detail Count:</span>
              <span className="text-cyan-300">{metrics.treeCount} instances</span>
            </div>
          </div>

          <div className="space-y-1 bg-slate-900/40 p-2 rounded border border-cyan-500/10">
            <div className="flex items-center space-x-1 border-b border-cyan-500/10 pb-0.5 mb-1.5">
              <Disc3 className="w-3 h-3 text-cyan-500" />
              <span className="text-[8px] text-cyan-300 font-bold uppercase">GPU Video Memory</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Buffer Geometries:</span>
              <span className="text-cyan-300">{metrics.gpu.geometries}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Allocated Textures:</span>
              <span className="text-cyan-300">{metrics.gpu.textures}</span>
            </div>
            {(metrics.gpu as any).programs !== undefined && (
              <div className="flex justify-between">
                <span className="text-slate-400">GL Programs:</span>
                <span className="text-cyan-300">{(metrics.gpu as any).programs}</span>
              </div>
            )}
          </div>

          {metrics.assetFailures.length > 0 && (
            <div className="bg-rose-950/20 border border-rose-500/30 rounded p-1.5 flex flex-col space-y-1">
              <div className="flex items-center space-x-1 text-rose-400">
                <ShieldAlert className="w-3 h-3" />
                <span className="text-[8px] font-bold uppercase">Asset Hard Failures</span>
              </div>
              <div className="max-h-12 overflow-y-auto space-y-0.5 pr-1 scrollbar-thin">
                {metrics.assetFailures.map((f, i) => (
                  <div key={i} className="text-rose-400 text-[8px] truncate leading-tight">
                    {f}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
