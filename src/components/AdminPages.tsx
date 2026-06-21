import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, doc, getDocs, setDoc, updateDoc, 
  deleteDoc, onSnapshot, query, where, serverTimestamp 
} from 'firebase/firestore';
import { 
  Map, Car, Users, BarChart3, Settings, Plus, Trash2, 
  Edit, ArrowLeft, RefreshCw, Layers, ShieldCheck, HelpCircle, 
  Sparkles, Compass, CheckCircle, Radio, LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

// Default mock seed data if not present in Firestore
const DEFAULT_MAPS = [
  { id: 'map1', name: 'Alpine Ridge', difficulty: 'medium', laps: 3, description: 'Sweeping curves and snow-capped peaks with extreme elevation changes.' },
  { id: 'map2', name: 'Sunset Harbour', difficulty: 'easy', laps: 3, description: 'Beautiful ocean-side flat course with long straightaways and easy hairpins.' },
];

const DEFAULT_CARS = [
  { id: 'lamborghini', name: 'Lamborghini Aventador', topSpeed: 350, acceleration: '2.9s', handling: 85, desc: 'V12 naturally-aspirated aerodynamic monster with roaring track energy.', colorPreset: '#ff5500', class: 'S CLASS' },
  { id: 'ferrari', name: 'Ferrari Purosangue', topSpeed: 310, acceleration: '3.3s', handling: 90, desc: 'Supreme active-suspension SUV utilities delivering unmatched active stability.', colorPreset: '#ff003c', class: 'A CLASS' },
  { id: 'bugatti', name: 'Bugatti Chiron', topSpeed: 420, acceleration: '2.4s', handling: 80, desc: 'Unmatched continuous speed powered by a monstrous quad-turbo W16.', colorPreset: '#00ccff', class: 'HYPER CLASS' },
  { id: 'porsche', name: 'Porsche 911 GT3', topSpeed: 320, acceleration: '3.2s', handling: 98, desc: 'Surgeon-like track precision crafted directly from pure GT motorsport racing heritage.', colorPreset: '#00ff3c', class: 'A CLASS' },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ADMIN DASHBOARD OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────
export const AdminDashboard: React.FC = () => {
  const { logout } = useAuth();
  const [stats, setStats] = useState({ maps: 0, cars: 0, rooms: 0, users: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const mapsSnap = await getDocs(collection(db, 'maps'));
        const carsSnap = await getDocs(collection(db, 'cars'));
        const roomsSnap = await getDocs(collection(db, 'rooms'));
        const usersSnap = await getDocs(collection(db, 'users'));

        setStats({
          maps: mapsSnap.empty ? DEFAULT_MAPS.length : mapsSnap.size,
          cars: carsSnap.empty ? DEFAULT_CARS.length : carsSnap.size,
          rooms: roomsSnap.size,
          users: usersSnap.size
        });
      } catch (err) {
        console.error('Failed to query statistics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/20 p-6 rounded-2xl border border-slate-900/60 backdrop-blur-sm">
        <div>
          <div className="flex items-center space-x-2 bg-rose-500/10 text-rose-400 font-extrabold uppercase text-[10px] tracking-widest px-3 py-1 rounded-full border border-rose-500/20 w-max mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
            <span>Security Administration Level 01</span>
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tight text-white animate-pulse">
            Admin Dashboard
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Complete platform control utilities for Asphalt Champions.
          </p>
        </div>
        <div className="shrink-0">
          <button
            onClick={() => logout()}
            className="flex items-center space-x-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black uppercase text-xs tracking-wider px-5 py-3 rounded-xl border border-rose-500/30 transition-all shadow-[0_0_15px_rgba(244,63,94,0.15)] select-none cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0 animate-pulse" />
            <span>Logout Session</span>
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Active Course Maps', val: stats.maps, desc: 'Alpine & Coastal geometry pools', icon: Map, color: 'text-indigo-400' },
          { label: 'Licensed Cars', val: stats.cars, desc: 'High-polygon vehicle assets', icon: Car, color: 'text-sky-400' },
          { label: 'Active Lobbies', val: stats.rooms, desc: 'Active multiplayer race servers', icon: Settings, color: 'text-rose-400' },
          { label: 'Registered Players', val: stats.users, desc: 'Synchronized Gmail entries', icon: Users, color: 'text-emerald-400' },
        ].map((item, i) => (
          <div key={i} className="bg-slate-950/60 border border-slate-900/80 p-6 rounded-2xl flex items-center space-x-4">
            <div className={`p-4 rounded-xl bg-slate-900/60 text-slate-400 shrink-0 ${item.color}`}>
              <item.icon className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{item.label}</span>
              <h3 className="text-2xl font-black text-white leading-tight mt-0.5">{item.val}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Admin Information */}
      <div className="bg-slate-950/40 border border-slate-900 absolute-none p-8 rounded-2xl space-y-4">
        <h4 className="text-sm font-black uppercase tracking-widest text-[#00f2ffa5] flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-cyan-400 fill-current" />
          <span>Operations Quick Reference</span>
        </h4>
        <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
          As a registered administrative representative, you possess comprehensive authority over the matchmaking cluster and local document databases. Use the navigation sidebar to execute full CRUD on track locations, update high-performance vehicles, monitor live race staging boards, manage accounts and broadcasters, and view detailed telemetry analytics. 
        </p>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAPS MANAGER
// ─────────────────────────────────────────────────────────────────────────────
export const ManageMaps: React.FC = () => {
  const [maps, setMaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [laps, setLaps] = useState(3);
  const [description, setDescription] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'maps'));
    const unsubscribe = onSnapshot(q, async (snap) => {
      if (snap.empty) {
        // Auto-seed
        for (const m of DEFAULT_MAPS) {
          await setDoc(doc(db, 'maps', m.id), m);
        }
      } else {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMaps(list);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleEdit = (map: any) => {
    setEditingId(map.id);
    setId(map.id);
    setName(map.name);
    setDifficulty(map.difficulty);
    setLaps(map.laps || 3);
    setDescription(map.description || '');
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !name) return;
    try {
      const payload = { id, name, difficulty, laps, description };
      await setDoc(doc(db, 'maps', id), payload);
      resetForm();
    } catch (err) {
      console.error('Error saving map:', err);
    }
  };

  const handleDelete = async (mid: string) => {
    if (confirm('Are you sure you want to delete this track geography entry?')) {
      await deleteDoc(doc(db, 'maps', mid));
    }
  };

  const resetForm = () => {
    setId('');
    setName('');
    setDifficulty('medium');
    setLaps(3);
    setDescription('');
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0 pb-4 border-b border-slate-905">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight">Maps Manager</h2>
          <p className="text-xs text-slate-400 mt-1">Configure alpine paths and circuit configurations</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>ADD NEW CIRCUIT</span>
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleSave}
            className="bg-slate-950/60 p-6 rounded-2xl border border-slate-900 space-y-4 max-w-2xl"
          >
            <h3 className="text-sm font-black uppercase tracking-widest text-[#00f2ffa5] mb-2">
              {editingId ? 'Edit Configuration' : 'Register New Track Geometric Profile'}
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">MAP ID (unique, e.g. map3)</label>
                <input
                  type="text"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  disabled={!!editingId}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  placeholder="map3"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">DISPLAY LABEL</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Neon Ridge"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">DIFFICULTY RANK</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">LAP COUNT</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={laps}
                  onChange={(e) => setLaps(Number(e.target.value))}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">MAP DESCRIPTION</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                placeholder="A circuit describing sweeping curves and dramatic high elevation profiles..."
              />
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-wider rounded-xl transition"
              >
                SAVE CIRCUIT
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 font-black uppercase text-[10px] tracking-wider rounded-xl transition"
              >
                CANCEL
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {maps.map((map) => (
          <div key={map.id} className="bg-slate-950/60 p-6 rounded-2xl border border-slate-900/80 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-500">{map.id.toUpperCase()}</span>
                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                  map.difficulty === 'easy' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                  map.difficulty === 'hard' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                }`}>
                  {map.difficulty}
                </span>
              </div>
              <h3 className="text-lg font-black uppercase text-white tracking-tight">{map.name}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{map.description}</p>
              <div className="text-[10px] font-black text-slate-500 items-center space-x-1 uppercase flex">
                <Layers className="w-3.5 h-3.5" />
                <span>SETTINGS: {map.laps} Laps</span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-900/45">
              <button
                onClick={() => handleEdit(map)}
                className="p-2 text-slate-400 hover:text-white bg-slate-900/40 hover:bg-slate-900 border border-slate-800/60 rounded-lg transition"
                title="Edit Map Settings"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(map.id)}
                className="p-2 text-red-400 hover:text-red-300 bg-red-950/10 hover:bg-red-950/30 border border-red-950/30 rounded-lg transition"
                title="Delete Location File"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CARS MANAGER
// ─────────────────────────────────────────────────────────────────────────────
export const ManageCars: React.FC = () => {
  const [cars, setCars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [topSpeed, setTopSpeed] = useState(300);
  const [acceleration, setAcceleration] = useState('3.0s');
  const [handling, setHandling] = useState(80);
  const [desc, setDesc] = useState('');
  const [colorPreset, setColorPreset] = useState('#ff5500');
  const [carClass, setCarClass] = useState('S CLASS');

  useEffect(() => {
    const q = query(collection(db, 'cars'));
    const unsubscribe = onSnapshot(q, async (snap) => {
      if (snap.empty) {
        // Auto-seed
        for (const c of DEFAULT_CARS) {
          await setDoc(doc(db, 'cars', c.id), c);
        }
      } else {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCars(list);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleEdit = (car: any) => {
    setEditingId(car.id);
    setId(car.id);
    setName(car.name);
    setTopSpeed(car.topSpeed);
    setAcceleration(car.acceleration);
    setHandling(car.handling);
    setDesc(car.desc || '');
    setColorPreset(car.colorPreset || '#ff5500');
    setCarClass(car.class || 'A CLASS');
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !name) return;
    try {
      const payload = { 
        id, name, topSpeed, acceleration, handling, 
        desc, colorPreset, class: carClass 
      };
      await setDoc(doc(db, 'cars', id), payload);
      resetForm();
    } catch (err) {
      console.error('Error saving vehicle:', err);
    }
  };

  const handleDelete = async (cid: string) => {
    if (confirm('Are you sure you want to delete this high-performance vehicle entry?')) {
      await deleteDoc(doc(db, 'cars', cid));
    }
  };

  const resetForm = () => {
    setId('');
    setName('');
    setTopSpeed(300);
    setAcceleration('3.0s');
    setHandling(80);
    setDesc('');
    setColorPreset('#ff5500');
    setCarClass('A CLASS');
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0 pb-4 border-b border-slate-905">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight">Cars Manager</h2>
          <p className="text-xs text-slate-400 mt-1">Manage physical vehicle aerodynamics and styling presets</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>REGISTER NEW VEHICLE</span>
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleSave}
            className="bg-slate-950/60 p-6 rounded-2xl border border-slate-900 space-y-4 max-w-2xl"
          >
            <h3 className="text-sm font-black uppercase tracking-widest text-[#00f2ffa5] mb-2">
              {editingId ? 'Edit Performance Tuning' : 'Register New Racing Chassis'}
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">VEHICLE ID (unique, e.g. porsche)</label>
                <input
                  type="text"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  disabled={!!editingId}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  placeholder="ferrari"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">VEHICLE BRAND MODEL NAME</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Ferrari SF90"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">TOP SPEED (KM/H)</label>
                <input
                  type="number"
                  value={topSpeed}
                  onChange={(e) => setTopSpeed(Number(e.target.value))}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">ACCELERATION (0-100)</label>
                <input
                  type="text"
                  value={acceleration}
                  onChange={(e) => setAcceleration(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="2.5s"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">HANDLING SCORE (1-100)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={handling}
                  onChange={(e) => setHandling(Number(e.target.value))}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">LIVERY DEFAULT COLOR HEX</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={colorPreset}
                    onChange={(e) => setColorPreset(e.target.value)}
                    className="w-10 h-10 bg-transparent border border-slate-800 rounded-lg cursor-pointer shrink-0"
                  />
                  <input
                    type="text"
                    value={colorPreset}
                    onChange={(e) => setColorPreset(e.target.value)}
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                    placeholder="#ff5500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">VEHICLE CLASSIFICATION</label>
                <select
                  value={carClass}
                  onChange={(e) => setCarClass(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="S CLASS">S CLASS</option>
                  <option value="A CLASS">A CLASS</option>
                  <option value="B CLASS">B CLASS</option>
                  <option value="HYPER CLASS">HYPER CLASS</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">CHASSIS DESCRIPTION</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                placeholder="A rear-mounted mid-engine carbon fiber body styled explicitly for extreme downforce operations..."
              />
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-wider rounded-xl transition"
              >
                SAVE Tuning
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 font-black uppercase text-[10px] tracking-wider rounded-xl transition"
              >
                CANCEL
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cars.map((car) => (
          <div key={car.id} className="bg-slate-950/60 p-6 rounded-2xl border border-slate-900/80 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">{car.id}</span>
                <span className="px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-slate-900 text-cyan-400 border border-cyan-500/10">
                  {car.class || 'S CLASS'}
                </span>
              </div>
              <h3 className="text-lg font-black uppercase text-white tracking-tight flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: car.colorPreset || '#ffffff' }} />
                <span>{car.name}</span>
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">{car.desc}</p>
              
              <div className="grid grid-cols-3 gap-3 bg-slate-900/30 p-2.5 border border-slate-900/60 rounded-xl">
                <div className="text-center">
                  <span className="block text-[8px] font-black text-slate-500 uppercase">SPEED</span>
                  <span className="text-xs font-black text-white">{car.topSpeed} KM/H</span>
                </div>
                <div className="text-center border-x border-slate-900">
                  <span className="block text-[8px] font-black text-slate-500 uppercase">ACCEL</span>
                  <span className="text-xs font-black text-white">{car.acceleration}</span>
                </div>
                <div className="text-center">
                  <span className="block text-[8px] font-black text-slate-500 uppercase">GRIP</span>
                  <span className="text-xs font-black text-white">{car.handling}%</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-900/45">
              <button
                onClick={() => handleEdit(car)}
                className="p-2 text-slate-400 hover:text-white bg-slate-900/40 hover:bg-slate-900 border border-slate-800/60 rounded-lg transition"
                title="Edit Engine/Aero Parameters"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(car.id)}
                className="p-2 text-red-400 hover:text-red-300 bg-red-950/10 hover:bg-red-950/30 border border-red-950/30 rounded-lg transition"
                title="Decommission vehicle chassis"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ROOMS MANAGER
// ─────────────────────────────────────────────────────────────────────────────
export const ManageRooms: React.FC = () => {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'rooms'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRooms(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleCloseRoom = async (code: string) => {
    if (confirm(`Do you wish to completely close multiplayer room ${code.toUpperCase()}?`)) {
      try {
        await deleteDoc(doc(db, 'rooms', code.toUpperCase()));
      } catch (err) {
        console.error('Failed to terminate multiplayer room:', err);
      }
    }
  };

  const handleForceStart = async (code: string) => {
    try {
      await updateDoc(doc(db, 'rooms', code.toUpperCase()), {
        status: 'racing',
        countdown: 0
      });
      alert(`Sent race start trigger to room ${code}!`);
    } catch (err) {
      console.error('Failed to start race:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black uppercase tracking-tight">Active Rooms Manager</h2>
        <p className="text-xs text-slate-400 mt-1">Monitor, modify, and terminate active multiplayer sessions</p>
      </div>

      {rooms.length === 0 ? (
        <div className="border border-slate-900 bg-slate-950/30 p-12 rounded-2xl text-center space-y-2">
          <Settings className="w-8 h-8 text-slate-600 mx-auto" />
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-450">No Live Game Servers</h4>
          <p className="text-[10px] text-slate-500 max-w-xs mx-auto">No rooms are currently staged inside the firestore collection.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rooms.map((room) => (
            <div key={room.id} className="bg-slate-950/60 p-6 rounded-2xl border border-slate-900 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-base font-black text-rose-400 uppercase tracking-widest bg-rose-500/10 px-3 py-1 rounded-xl border border-rose-500/15">
                      {room.roomCode || room.code}
                    </span>
                    {room.isLiveMode && (
                      <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/15">
                        <Radio className="w-2.5 h-2.5 animate-pulse" />
                        <span>LIVE STREAM</span>
                      </span>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase border ${
                    room.status === 'racing' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' :
                    room.status === 'completed' || room.status === 'finished' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  }`}>
                    {room.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-900/25 p-3 rounded-xl border border-slate-900/60">
                  <div>
                    <span className="text-[8px] font-black text-slate-500 uppercase block">Map Selection</span>
                    <span className="font-black text-slate-200 uppercase mt-0.5 block">{room.map}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black text-slate-500 uppercase block">Laps Cycle</span>
                    <span className="font-black text-slate-200 mt-0.5 block">{room.laps} Laps</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black text-slate-500 uppercase block">AI Difficulty</span>
                    <span className="font-black text-slate-200 uppercase mt-0.5 block">{room.difficulty}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black text-slate-500 uppercase block">Weather</span>
                    <span className="font-black text-slate-200 uppercase mt-0.5 block">{room.weather}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[8px] font-black text-slate-500 uppercase block">Connected Grid Players ({room.players?.length || 0})</span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {room.players?.map((p: any, idx: number) => (
                      <span key={idx} className="bg-slate-900 border border-slate-800/80 text-[10px] font-bold px-2.5 py-1 rounded-lg text-slate-300">
                        {p.nickname} {p.isHost && '👑'} {p.isAI && '🤖'}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex space-x-2 pt-3 border-t border-slate-900/50">
                {room.status === 'waiting' && (
                  <button
                    onClick={() => handleForceStart(room.id)}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-wider py-2.5 rounded-xl transition"
                  >
                    FORCE START RACE
                  </button>
                )}
                <button
                  onClick={() => handleCloseRoom(room.id)}
                  className="p-2.5 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-950/30 font-black uppercase text-[10px] tracking-wider rounded-xl transition flex items-center space-x-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span>CLOSE ROOM</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// USERS MANAGER
// ─────────────────────────────────────────────────────────────────────────────
export const ManageUsers: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Email of broadcasters we want to manually configure/invite
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'broadcaster' | 'admin' | 'user'>('broadcaster');

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleRoleChange = async (uid: string, newRole: 'admin' | 'broadcaster' | 'user') => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        role: newRole
      });
      alert('Account role updated successfully in Firestore!');
    } catch (err) {
      console.error('Failed to change user role:', err);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    try {
      // Simulate/register invited profile entry inside DB
      const dummyUid = `invited_${Date.now()}`;
      await setDoc(doc(db, 'users', dummyUid), {
        uid: dummyUid,
        email: inviteEmail.trim().toLowerCase(),
        name: `Invited ${inviteRole.toUpperCase()}`,
        photoURL: '',
        role: inviteRole,
        createdAt: serverTimestamp()
      });
      setInviteEmail('');
      alert(`Successfully registered pre-allocated role ${inviteRole.toUpperCase()} for ${inviteEmail.trim()}!`);
    } catch (err) {
      console.error('Failed to invite user/broadcaster:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-905 gap-4">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight">Manage Accounts & Broadcasters</h2>
          <p className="text-xs text-slate-400 mt-1">Review active player profiles, change permission tiers, and allocate broadcasters</p>
        </div>
      </div>

      {/* Account quick registration */}
      <form onSubmit={handleInviteUser} className="bg-slate-950/60 p-6 rounded-2xl border border-slate-900 space-y-4 max-w-xl">
        <h3 className="text-xs font-black uppercase tracking-widest text-[#00f2ffa5]">Pre-Allocate Account Permissions</h3>
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-[8.5px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Gmail Email Address</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
              placeholder="invited-broadcaster@gmail.com"
              required
            />
          </div>
          <div>
            <label className="block text-[8.5px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Role Tier</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as any)}
              className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="broadcaster">Broadcaster</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </div>
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-wider py-3 px-5 rounded-xl transition"
          >
            ALLOCATE PROFILES
          </button>
        </div>
      </form>

      {/* Accounts List */}
      <div className="bg-slate-950/60 rounded-2xl border border-slate-900 overflow-hidden">
        <div className="p-5 border-b border-slate-900/60 bg-slate-950/40">
          <h3 className="text-xs font-black uppercase tracking-widest text-white">Registered Accounts Directory</h3>
        </div>
        <div className="divide-y divide-slate-900/60">
          {users.map((u) => {
            const date = u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : 'Recently';
            return (
              <div key={u.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <img
                    src={u.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                    alt={u.name}
                    className="w-10 h-10 rounded-full object-cover bg-slate-800 border border-slate-800"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h4 className="text-xs font-black text-white uppercase">{u.name || 'Anonymous Champion'}</h4>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{u.email}</span>
                    <span className="text-[8px] font-mono text-slate-500 block mt-0.5">Joined at {date}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-3 self-end sm:self-auto">
                  <span className="text-[9px] font-black uppercase text-slate-500">Authorize Role:</span>
                  <select
                    value={u.role || 'user'}
                    onChange={(e) => handleRoleChange(u.id, e.target.value as any)}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold uppercase tracking-wider"
                  >
                    <option value="user">User</option>
                    <option value="broadcaster">Broadcaster</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS & LEADERBOARD LOGS
// ─────────────────────────────────────────────────────────────────────────────
export const ManageAnalytics: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulates an active firestore query to global leaderboards
    const q = query(collection(db, 'leaderboards'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLeaderboard(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleClearScore = async (id: string) => {
    if (confirm('Do you wish to completely wipe this player score ranking log?')) {
      await deleteDoc(doc(db, 'leaderboards', id));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black uppercase tracking-tight">Analytics & Leaderboards Manager</h2>
        <p className="text-xs text-slate-400 mt-1">Review top speed lists, clear race telemetry logs, and analyze metrics</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Simple Telemetry Metrics */}
        <div className="lg:col-span-2 bg-slate-950/60 p-6 rounded-2xl border border-slate-900 space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-[#00f2ffa5] flex items-center space-x-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <span>Active Frame Performance logs</span>
          </h3>

          {/* Simple Vector Graph representation */}
          <div className="h-48 flex items-end justify-between px-4 pb-2 pt-6 bg-slate-900/25 border border-slate-900 rounded-2xl relative">
            <div className="absolute top-2 left-3 text-[8px] font-black text-slate-500 uppercase tracking-widest">WIFI RTT Latency / Tick Sync Rate</div>
            {[45, 70, 52, 90, 80, 65, 87, 95, 40, 72, 85, 99].map((h, i) => (
              <div key={i} className="flex flex-col items-center flex-1 mx-1.5 space-y-1.5 h-full justify-end">
                <div 
                  className="w-full bg-gradient-to-t from-indigo-500/80 to-cyan-400 rounded-t-md cursor-pointer hover:opacity-80 transition-all shadow-[0_0_8px_rgba(99,102,241,0.2)]" 
                  style={{ height: `${h}%` }}
                />
                <span className="text-[7.5px] font-mono text-slate-500 font-bold">t+{i}s</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-900/60">
              <span className="block text-[8px] font-black text-slate-500 uppercase">Average Latency</span>
              <span className="text-sm font-black text-cyan-400 mt-1 block">42ms</span>
            </div>
            <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-900/60">
              <span className="block text-[8px] font-black text-slate-500 uppercase">Server FPS</span>
              <span className="text-sm font-black text-emerald-400 mt-1 block">59.8 FPS</span>
            </div>
            <div className="bg-slate-900/30 p-3 rounded-xl border border-slate-900/60">
              <span className="block text-[8px] font-black text-slate-500 uppercase">Packet Drops</span>
              <span className="text-sm font-black text-red-400 mt-1 block">0.02%</span>
            </div>
          </div>
        </div>

        {/* Global Standings list */}
        <div className="bg-slate-950/60 rounded-2xl border border-slate-900 overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-slate-900/60 bg-slate-950/40">
              <h3 className="text-xs font-black uppercase tracking-widest text-white">Global Speed Ranking List</h3>
            </div>
            
            {leaderboard.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <BarChart3 className="w-8 h-8 text-slate-650 mx-auto" />
                <span className="block text-[10px] font-black text-slate-500 uppercase uppercase">No Highscores Loaded</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-900/40 max-h-64 overflow-y-auto">
                {leaderboard.map((item, index) => (
                  <div key={item.id} className="p-3.5 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-black text-slate-500">#{index+1}</span>
                      <span className="font-bold text-white uppercase">{item.playerName}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-black text-cyan-300">{item.topSpeed || 298} km/h</span>
                      <button 
                        onClick={() => handleClearScore(item.id)}
                        className="p-1 hover:text-red-400 text-slate-600 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
