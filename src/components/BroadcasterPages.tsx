import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, doc, getDocs, updateDoc } from 'firebase/firestore';
import { 
  Radio, Video, Tv, Play, Square, Compass, Sparkles, 
  Settings, Users, Camera, Eye, Info, Volume2, Maximize, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ─────────────────────────────────────────────────────────────────────────────
// BROADCASTER MAIN HUB / LOBBY ROOMS SELECTOR
// ─────────────────────────────────────────────────────────────────────────────
export const BroadcasterDashboard: React.FC = () => {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'rooms'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRooms(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center space-x-2 bg-cyan-500/10 text-cyan-400 font-extrabold uppercase text-[10px] tracking-widest px-3 py-1 rounded-full border border-cyan-500/20 w-max mb-3">
          <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>BROADCASTER PORTAL LEVEL 02</span>
        </div>
        <h2 className="text-3xl font-black uppercase tracking-tight text-white">
          Spectator & Broadcast Hub
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Join rooms as SPECTATOR or AI_CAMERA to begin streaming the races live.
        </p>
      </div>

      {rooms.length === 0 ? (
        <div className="border border-slate-905 bg-slate-950/30 p-12 rounded-2xl text-center space-y-4">
          <Tv className="w-10 h-10 text-slate-650 mx-auto" />
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">No Active Race staging matches</h4>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            There are currently no active room servers to spectate. Wait for users to host matchmaking staging lines.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {rooms.map((room) => (
            <div key={room.id} className="bg-slate-950/60 p-6 rounded-2xl border border-slate-900 shadow-xl flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-base font-black text-cyan-400 uppercase tracking-widest bg-cyan-500/10 px-3 py-1 rounded-xl border border-cyan-500/15">
                    {room.roomCode || room.code}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-widest bg-slate-900 border border-slate-800 text-slate-400">
                    {room.status}
                  </span>
                </div>

                <div className="text-xs space-y-2 text-slate-400 leading-normal">
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span>Circuit:</span>
                    <span className="font-black text-slate-200 uppercase">{room.map}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span>Laps Cycle:</span>
                    <span className="font-black text-slate-200">{room.laps} Laps</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Connected Players:</span>
                    <span className="font-black text-slate-200">{room.players?.length || 0} Racers</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-900">
                <a 
                  href={`/broadcaster/live?room=${room.id}`}
                  className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-black uppercase text-[10px] tracking-wider py-3 rounded-xl transition shadow-[0_4px_15px_rgba(6,182,212,0.15)]"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>SPECTATE ROOM LIVE</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


// ─────────────────────────────────────────────────────────────────────────────
// IMMERSIVE LIVE STREAMING STUDIO
// ─────────────────────────────────────────────────────────────────────────────
export const BroadcasterLiveDesk: React.FC = () => {
  // Broadcaster visual settings
  const [broadcasting, setBroadcasting] = useState(false);
  const [cameraMode, setCameraMode] = useState<'third-person' | 'drone' | 'side' | 'finish' | 'replay'>('third-person');
  const [fps, setFps] = useState(60);
  const [resolution, setResolution] = useState('1080p');
  const [streamBitrate, setStreamBitrate] = useState(6000);
  const [latency, setLatency] = useState(30);

  // Overlay switches
  const [showRoomCode, setShowRoomCode] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [showSpeedometer, setShowSpeedometer] = useState(true);
  const [showLapCounter, setShowLapCounter] = useState(true);

  // Simulated Room Info
  const roomCodeQuery = new URLSearchParams(window.location.search).get('room') || 'CHAMP_X';

  const toggleBroadcast = () => {
    setBroadcasting(prev => !prev);
  };

  return (
    <div className="space-y-6">
      {/* Upper Streaming state header */}
      <div className="flex flex-col sm:flex-row items-staged sm:items-center justify-between pb-4 border-b border-slate-905 gap-4">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight flex items-center space-x-2">
            <Radio className="w-6 h-6 text-cyan-400" />
            <span>Studio Live Broadcast Desk</span>
          </h2>
          <p className="text-xs text-slate-405 mt-1">
            Immersive live streaming hub connected to Room: <span className="text-cyan-405 font-mono font-bold uppercase">{roomCodeQuery}</span>
          </p>
        </div>

        <button
          onClick={toggleBroadcast}
          className={`flex items-center space-x-2.5 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            broadcasting 
              ? 'bg-red-650 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.25)] animate-pulse' 
              : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.2)]'
          }`}
        >
          {broadcasting ? (
            <>
              <Square className="w-4 h-4 fill-current" />
              <span>STOP LIVE STREAM</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>START LIVE STREAM</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cinematic Stream Video Screen */}
        <div className="lg:col-span-2 space-y-6">
          <div className="relative bg-[#04060f] border border-slate-900 rounded-3xl overflow-hidden aspect-video shadow-[0_20px_45px_rgba(0,0,0,0.5)] flex flex-col justify-between p-6">
            
            {/* Top Bar overlays of Stream */}
            <div className="flex items-start justify-between z-10">
              <div className="flex space-x-2">
                {broadcasting && (
                  <span className="flex items-center space-x-1.5 bg-red-650 text-white text-[9px] font-black uppercase px-3 py-1 rounded-full border border-red-500/10 shadow-[0_0_12px_rgba(239,68,68,0.3)] animate-pulse">
                    <span className="w-1.5 h-1.5 bg-white rounded-full" />
                    <span>BROADCASTING LIVE</span>
                  </span>
                )}
                <span className="bg-slate-950/80 backdrop-blur-md text-slate-300 text-[9px] font-black uppercase px-2.5 py-1 rounded-full border border-slate-900">
                  CAMERA: <span className="text-cyan-400 font-mono">{cameraMode.toUpperCase()}</span>
                </span>
              </div>

              {showRoomCode && (
                <div className="bg-slate-950/80 backdrop-blur-md text-[#00f2ffa5] border border-slate-900/60 px-4 py-1.5 rounded-2xl font-mono text-xs font-black shadow-lg">
                  ROOM CODE: <span className="text-white font-mono">{roomCodeQuery.toUpperCase()}</span>
                </div>
              )}
            </div>

            {/* Simulated Live Action UI representation (Racing Canvas) */}
            <div className="absolute inset-x-0 top-16 bottom-16 flex items-center justify-center opacity-85 select-none pointer-events-none">
              <div className="text-center space-y-2">
                <Video className="w-12 h-12 text-slate-800 mx-auto" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-sans">[SPECTATOR CAMERA RIG ONLINE]</span>
                <p className="text-[9px] text-slate-600 max-w-xs mx-auto">
                  Rending live mesh viewport telemetry using {cameraMode} configurations. All game overlays are applied client-side inside the broadcaster pipeline.
                </p>
              </div>
            </div>

            {/* Bottom hud stream overlay specs */}
            <div className="flex items-end justify-between z-10">
              {/* Leaderboard HUD switch overlay */}
              {showLeaderboard && (
                <div className="bg-slate-950/85 backdrop-blur-md border border-slate-900 text-left p-3.5 rounded-2xl min-w-[150px] shadow-2xl space-y-1.5 scale-90 origin-bottom-left">
                  <span className="text-[7.5px] font-black text-slate-500 uppercase block tracking-wider">Race Standings</span>
                  <div className="space-y-1 text-[10px] font-bold">
                    <div className="flex justify-between space-x-4">
                      <span className="text-cyan-400">1. Speedster</span>
                      <span className="font-mono">Lap 1/3</span>
                    </div>
                    <div className="flex justify-between space-x-4 text-slate-400">
                      <span>2. Ghost_Rider</span>
                      <span className="font-mono">+0.84s</span>
                    </div>
                    <div className="flex justify-between space-x-4 text-slate-405">
                      <span>3. Apex🤖</span>
                      <span className="font-mono">+1.92s</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Speedometer and Laps overlays switches */}
              <div className="flex items-end space-x-2 scale-90 origin-bottom-right">
                {showLapCounter && (
                  <div className="bg-slate-950/85 backdrop-blur-md border border-slate-900 p-3 rounded-2xl text-center shadow-xl">
                    <span className="text-[6.5px] font-black text-slate-500 uppercase block">LAP</span>
                    <span className="text-xs font-black text-slate-200">2 / 3</span>
                  </div>
                )}
                {showSpeedometer && (
                  <div className="bg-slate-950/85 backdrop-blur-md border border-slate-900 p-3.5 rounded-2xl text-center shadow-xl min-w-[90px]">
                    <span className="text-[7px] font-black text-slate-500 uppercase block">SPEEDOMETER</span>
                    <span className="text-lg font-black font-mono text-cyan-300">298 <span className="text-[9px] font-bold text-slate-500">KM/H</span></span>
                  </div>
                )}
              </div>
            </div>

            {/* Seamless Grid BG of Stream */}
            <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.01)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />
          </div>

          {/* Quick Stream telemetry metrics panel */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { val: `${latency} ms`, desc: 'MATCH LATENCY', text: 'text-indigo-400' },
              { val: `${fps} FPS`, desc: 'CAMERA DRAW FPS', text: 'text-emerald-400' },
              { val: `${streamBitrate} kbps`, desc: 'STREAMING BITRATE', text: 'text-cyan-400' },
              { val: resolution.toUpperCase(), desc: 'RESOLUTION TIER', text: 'text-fuchsia-400' },
            ].map((stat, i) => (
              <div key={i} className="bg-slate-950/50 p-4 rounded-xl border border-slate-900/60 text-center">
                <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest">{stat.desc}</span>
                <span className={`text-sm font-black mt-1 block ${stat.text}`}>{stat.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Studio Stream Settings & Overlays selectors */}
        <div className="space-y-6">
          {/* Studio Camera Rig selector */}
          <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-900 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#00f2ffa5] flex items-center space-x-2">
              <Camera className="w-4 h-4 text-cyan-400" />
              <span>Studio Camera Settings</span>
            </h3>

            <div className="flex flex-col space-y-1.5">
              {[
                { mode: 'third-person' as const, label: '3rd-Person Chase Cam', desc: 'Active track tracking auto-line' },
                { mode: 'drone' as const, label: 'Drone Hover Cam', desc: 'Cinematic hover matrix' },
                { mode: 'side' as const, label: 'Pits Side Camera', desc: 'Wide lateral static grid alignment' },
                { mode: 'finish' as const, label: 'Finish-Line Camera', desc: 'Primary speed finish loop tracking' },
                { mode: 'replay' as const, label: 'Telemetry Replay Cam', desc: 'Slow motion analytics sweep' },
              ].map((cam) => (
                <button
                  key={cam.mode}
                  onClick={() => setCameraMode(cam.mode)}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                    cameraMode === cam.mode
                      ? 'bg-slate-900/80 border-slate-800 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                      : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900/30'
                  }`}
                >
                  <div>
                    <span className="block text-[11px] font-black uppercase tracking-wider">{cam.label}</span>
                    <span className="text-[9px] text-slate-500 font-medium block mt-0.5">{cam.desc}</span>
                  </div>
                  <Video className={`w-3.5 h-3.5 ${cameraMode === cam.mode ? 'text-[#00f2ffa5]' : 'text-slate-600'}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Overlays Visibility Panel */}
          <div className="bg-slate-950/60 p-5 rounded-2xl border border-slate-900 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-[#00f2ffa5] flex items-center space-x-2">
              <Settings className="w-4 h-4 text-cyan-400" />
              <span>Overlay Configuration</span>
            </h3>

            <div className="space-y-3.5 text-xs text-slate-300">
              {[
                { state: showRoomCode, toggle: setShowRoomCode, label: 'Display Match Room Code' },
                { state: showLeaderboard, toggle: setShowLeaderboard, label: 'Display Match Standings Board' },
                { state: showSpeedometer, toggle: setShowSpeedometer, label: 'Display Active Speedometer' },
                { state: showLapCounter, toggle: setShowLapCounter, label: 'Display Live Lap Counter' },
              ].map((sw, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="font-bold text-slate-300">{sw.label}</span>
                  <button
                    onClick={() => sw.toggle(!sw.state)}
                    className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                      sw.state ? 'bg-cyan-500' : 'bg-slate-800'
                    }`}
                  >
                    <span className={`absolute w-4 h-4 bg-white rounded-full top-0.5 left-0.5 transition-transform ${
                      sw.state ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
