/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import Navigation from './components/Navigation';
import Header from './components/Header';
import { AnimatePresence, motion } from 'motion/react';
import { WifiOff, Megaphone, X as XIcon } from 'lucide-react';
import { db } from './lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

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
const Checkers = lazy(() => import('./pages/Checkers'));
const Games = lazy(() => import('./pages/Games'));

// Loading screen
const PageLoading = () => (
  <div className="min-h-screen bg-[#050505] flex items-center justify-center p-8">
     <div className="flex flex-col items-center gap-6">
       <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(168,85,247,0.3)]"></div>
       <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] animate-pulse">Sincronizando Universo</div>
     </div>
  </div>
);

function AppContent() {
  const { user, profile, loading, connectionError, isOnline, refreshConnection } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();
  const isRoomPage = location.pathname.startsWith('/room/');

  const [latestAnnouncement, setLatestAnnouncement] = useState<{ id: string; text: string; adminName: string } | null>(null);
  const [showAnnouncement, setShowAnnouncement] = useState(false);

  useEffect(() => {
    if (!user) {
      setLatestAnnouncement(null);
      setShowAnnouncement(false);
      return;
    }

    let unsubscribe: () => void = () => {};

    try {
      const q = query(
        collection(db, 'system_announcements'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const docData = snapshot.docs[0].data();
          const docId = snapshot.docs[0].id;

          const dismissed = sessionStorage.getItem(`dismissed_announce_${docId}`);
          if (!dismissed) {
            setLatestAnnouncement({
              id: docId,
              text: docData.text || '',
              adminName: docData.adminName || 'ADM',
            });
            setShowAnnouncement(true);
            
            try {
              const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
              if (AudioContextClass) {
                const ctx = new AudioContextClass();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(450, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(950, ctx.currentTime + 0.35);
                gain.gain.setValueAtTime(0.08, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.35);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.35);
              }
            } catch (soundErr) {
              console.warn(soundErr);
            }
          }
        } else {
          setLatestAnnouncement(null);
          setShowAnnouncement(false);
        }
      }, (err) => {
        console.warn("Firestore announcements permission check restriction, deploying local storage synchronizer:", err.message);
        useLocalStorageFallback();
      });
    } catch (e: any) {
      console.warn("Firestore query error for system announcements, using fallback:", e.message);
      useLocalStorageFallback();
    }

    function useLocalStorageFallback() {
      // Setup local storage synced feedback
      const checkLocalStorage = () => {
        const saved = localStorage.getItem('we_aura_announcements');
        if (saved) {
          try {
            const list = JSON.parse(saved);
            if (list && list.length > 0) {
              const latest = list[list.length - 1]; // Latest added
              const dismissed = sessionStorage.getItem(`dismissed_announce_${latest.id}`);
              if (!dismissed) {
                setLatestAnnouncement({
                  id: latest.id,
                  text: latest.text,
                  adminName: latest.adminName || 'ADM'
                });
                setShowAnnouncement(true);
              }
            }
          } catch (e) {
            console.warn(e);
          }
        }
      };

      checkLocalStorage();
      window.addEventListener('storage', checkLocalStorage);
      unsubscribe = () => window.removeEventListener('storage', checkLocalStorage);
    }

    return () => unsubscribe();
  }, [user]);

  const handleDismissAnnouncement = () => {
    if (latestAnnouncement) {
      try {
        sessionStorage.setItem(`dismissed_announce_${latestAnnouncement.id}`, 'true');
      } catch (e) {
        console.warn("Could not save announcement dismissed flag in sessionStorage:", e);
      }
    }
    setShowAnnouncement(false);
  };

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
    <div className={`min-h-screen flex flex-col ${theme === 'light' ? 'bg-[#f4f4f7] text-zinc-900 light' : 'bg-[#050505] text-white dark'} ${!isRoomPage ? 'pt-6' : ''}`}>
      {/* Real-time Admin Announcement Overlay */}
      <AnimatePresence>
        {showAnnouncement && latestAnnouncement && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[150] w-[90%] max-w-xl bg-gradient-to-r from-[#0a051d]/95 to-[#160a37]/95 border border-[#8A2EFF]/60 p-5 rounded-2xl shadow-[0_0_40px_rgba(138,46,255,0.4)] backdrop-blur-md flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3.5">
              <div className="bg-[#FF4D9D]/20 p-2.5 rounded-xl border border-[#FF4D9D]/30 flex-shrink-0 shadow-[0_0_10px_rgba(255,77,157,0.2)]">
                <Megaphone size={16} className="text-[#FF4D9D] animate-bounce" />
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-[#00F0FF] block">
                  AVISO GLOBAL DO ADMINISTRADOR ({latestAnnouncement.adminName})
                </span>
                <p className="text-white font-bold text-xs leading-relaxed mt-1">
                  {latestAnnouncement.text}
                </p>
              </div>
            </div>
            <button
              onClick={handleDismissAnnouncement}
              className="p-1.5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-all flex-shrink-0"
            >
              <XIcon size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
              <Route path="/checkers" element={<Checkers />} />
              <Route path="/games" element={<Games />} />
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
      <ThemeProvider>
        <NotificationProvider>
          <Router>
            <AppContent />
          </Router>
        </NotificationProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
