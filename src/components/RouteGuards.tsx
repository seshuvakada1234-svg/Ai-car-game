import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { Compass } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4 font-sans">
        <Compass className="w-12 h-12 text-blue-400 animate-spin" />
        <span className="font-sans font-black text-xs tracking-widest uppercase text-slate-400">Loading Session...</span>
      </div>
    );
  }

  if (!user || !profile) {
    // Redirect to /login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // --- STRICT DUAL BROADCASTER ROLE FIREWALL ---
  const role = profile.role;

  // 1. STREAM_CLIENT account is STRICTLY forbidden from accessing anything else except /live
  if (role === 'STREAM_CLIENT' && location.pathname !== '/live') {
    return <Navigate to="/live" replace />;
  }

  // 2. Resolve equivalent roles for backwards compatibility
  const isAllowed = allowedRoles ? allowedRoles.some(allowed => {
    if (allowed === role) return true;
    if (allowed === 'broadcaster' && (role === 'BROADCAST_ADMIN' || role === 'broadcaster')) return true;
    if (allowed === 'user' && (role === 'PLAYER' || role === 'user')) return true;
    if (allowed === 'admin' && (role === 'admin' || role === 'BROADCAST_ADMIN')) return true;
    return false;
  }) : true;

  if (!isAllowed) {
    // Redirect based on actual role
    if (role === 'admin' || role === 'BROADCAST_ADMIN') {
      return <Navigate to="/broadcaster" replace />;
    } else if (role === 'STREAM_CLIENT') {
      return <Navigate to="/live" replace />;
    } else {
      return <Navigate to="/garage" replace />;
    }
  }

  return <>{children}</>;
};

interface PublicRouteProps {
  children: React.ReactNode;
}

export const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4 font-sans">
        <Compass className="w-12 h-12 text-blue-400 animate-spin" />
        <span className="font-sans font-black text-xs tracking-widest uppercase text-slate-400">Loading Session...</span>
      </div>
    );
  }

  if (user && profile) {
    // Already authenticated, redirect to default path per role
    const role = profile.role;
    if (role === 'admin' || role === 'BROADCAST_ADMIN') {
      return <Navigate to="/broadcaster" replace />;
    } else if (role === 'STREAM_CLIENT') {
      return <Navigate to="/live" replace />;
    } else {
      return <Navigate to="/garage" replace />;
    }
  }

  return <>{children}</>;
};
