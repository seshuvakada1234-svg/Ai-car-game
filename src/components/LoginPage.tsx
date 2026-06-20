import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Compass, Sparkles, AlertCircle, LogIn } from 'lucide-react';
import { motion } from 'motion/react';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (e: any) {
      setError(e.message || 'Google Auth authentication failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#070b19] flex items-center justify-center font-sans overflow-hidden px-4">
      {/* Abstract Background Accents */}
      <div className="absolute w-[450px] h-[450px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none -top-10 left-5" />
      <div className="absolute w-[500px] h-[500px] bg-fuchsia-500/10 rounded-full blur-[160px] pointer-events-none -bottom-10 right-5" />
      <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.015)_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md bg-slate-950/70 backdrop-blur-xl border border-slate-900/80 p-8 rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] z-10"
      >
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Logo Brand */}
          <div className="relative p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-blue-500/10 border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)]">
            <Compass className="w-10 h-10 text-indigo-400 rotate-45" />
            <div className="absolute -top-1 -right-1 bg-indigo-500 text-white p-0.5 rounded-full animate-ping">
              <Sparkles className="w-1.5 h-1.5" />
            </div>
          </div>

          <div>
            <div className="inline-flex items-center space-x-1.5 bg-indigo-500/10 text-indigo-400 font-extrabold uppercase text-[9px] tracking-widest px-3 py-0.5 rounded-full border border-indigo-500/20 mb-2">
              <Sparkles className="w-3 h-3 text-indigo-400 fill-current" />
              <span>RBAC SECURE ENTRY</span>
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tight text-white">
              ASPHALT CHAMPIONS
            </h2>
            <p className="text-sm text-slate-400 mt-2 font-medium">
              Grand Arena Sports Portal
            </p>
          </div>

          {error && (
            <div className="w-full bg-red-950/50 border border-red-500/40 p-4 rounded-2xl flex items-start space-x-3 text-left">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs text-red-300 font-medium">
                {error}
              </div>
            </div>
          )}

          <div className="w-full space-y-4 pt-2">
            <button
              onClick={handleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center space-x-3 bg-gradient-to-r from-indigo-600 via-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-extrabold uppercase text-xs tracking-widest py-4 px-6 rounded-2xl transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(99,102,241,0.25)]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-white" />
                  <span>SIGN IN WITH GOOGLE</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs mx-auto">
              Access is protected according to pre-allocated Roles (Admin, Broadcaster, or User profiles) determined by email.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
