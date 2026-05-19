/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Navigation from './components/Navigation';
import Header from './components/Header';
import { AnimatePresence } from 'motion/react';
import { WifiOff } from 'lucide-react';

// Lazy loading pages for better performance
const Home = lazy(() => import('./pages/Home'));
const Room = lazy(() => import('./pages/Room'));
const PrivateChat = lazy(() => import('./pages/PrivateChat'));
const Profile = lazy(() => import('./pages/Profile'));
const Social = lazy(() => import('./pages/Social'));
const Shop = lazy(() => import('./pages/Shop'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));
const Challenges = lazy(() => import('./pages/Challenges'));

// Loading screen
const PageLoading = () => (
  <div className="min-h-screen bg-[#050505] flex items-center justify-center p-8">
     <div className="flex flex-col items-center gap-6">
       <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(168,85,247,0.3)]"></div>
       <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] animate-pulse">Sincronizando Universo</div>
     </div>
  </div>
);

const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

function AppContent() {
  const { user, profile, loading, connectionError, isOnline, refreshConnection } = useAuth();
  const location = useLocation();
  const isRoomPage = location.pathname.startsWith('/room/');

  if (loading) return <PageLoading />;

  if (profile?.isBanned) {
    return (
      <div className="min-h-screen bg-[#020202] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mb-6 border border-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.1)]">
          <WifiOff size={40} className="text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2 uppercase tracking-tight">Conta Suspensa</h1>
        <p className="text-white/30 text-xs max-w-sm mb-8 leading-relaxed font-medium">
          Sua conta foi suspensa permanentemente por violar nossos termos de uso.
          Se você acredita que isso foi um erro, entre em contato através do site oficial.
        </p>
      </div>
    );
  }

  if (!user) {
    return <Suspense fallback={<PageLoading />}><Login /></Suspense>;
  }

  return (
    <div className={`min-h-screen bg-[#050505] text-white flex flex-col ${!isRoomPage ? 'pt-6' : ''}`}>
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[101] bg-amber-500 text-black text-[9px] font-bold uppercase py-1 px-4 flex items-center justify-center gap-2 tracking-widest">
          <WifiOff size={10} />
          Modo Offline Ativado
        </div>
      )}
      {connectionError && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white text-[9px] font-bold uppercase py-1 px-4 flex items-center justify-between gap-2 tracking-widest shadow-lg">
          <div className="flex items-center gap-2">
            <WifiOff size={10} />
            {connectionError}
          </div>
          <button 
            onClick={() => refreshConnection()}
            className="bg-white/20 px-2 py-0.5 rounded text-[8px] hover:bg-white/30 transition-colors"
          >
            RECONECTAR
          </button>
        </div>
      )}
      {!isRoomPage && <Header />}
      <main className={`flex-1 overflow-y-auto ${!isRoomPage ? 'pb-24' : ''}`}>
        <AnimatePresence mode="wait">
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/room/:id" element={<Room />} />
              <Route path="/chat/:id" element={<PrivateChat />} />
              <Route path="/social" element={<Social />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/:id" element={<Profile />} />
              <Route path="/challenges" element={<Challenges />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </AnimatePresence>
      </main>
      {!isRoomPage && <Navigation />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <AppContent />
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}
