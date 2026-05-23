import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Crown, Sparkles, Star, Flame, Zap, Gem, Award, Shield, Cpu, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import moldura67 from '../assets/images/moldura_guardiao.png';

const avatarPhotoCache: { [uid: string]: string } = {};
const avatarFrameCache: { [uid: string]: string } = {};
const avatarNameCache: { [uid: string]: string } = {};
const avatarLevelCache: { [uid: string]: number } = {};

const globalLoadedFrames = new Set<string>();
const globalFailedFrames = new Set<string>();

function sanitizeClassName(className: string) {
  const words = className.split(/\s+/);
  const allowed = words.filter(word => {
    const w = word.trim().toLowerCase();
    if (!w) return false;
    if (w.startsWith('border') || w.includes('/10') || w.includes('[0.08]') || w.includes('border-white')) return false;
    if (w.startsWith('bg-') && !w.includes('clip') && !w.includes('opacity')) return false;
    if (w.startsWith('rounded')) return false;
    if (w.startsWith('object-')) return false;
    if (w.startsWith('overflow')) return false;
    return true;
  });
  return allowed.join(' ');
}

interface UserAvatarProps {
  uid?: string | null;
  className?: string; // e.g. "w-12 h-12", "w-16 h-16", "w-32 h-32"
  alt?: string;
  showFrame?: boolean;
  forceFrameId?: string; // used to override/preview specific frame
  showLevel?: boolean;
  forceLevel?: number;
}

export default function UserAvatar({ 
  uid, 
  className = "w-12 h-12", 
  alt = "", 
  showFrame = true, 
  forceFrameId,
  showLevel = true,
  forceLevel
}: UserAvatarProps) {
  const { profile, user } = useAuth();
  const [photo, setPhoto] = useState<string | null>(null);
  const [userFrame, setUserFrame] = useState<string | null>(null);
  const [userLevel, setUserLevel] = useState<number>(1);

  useEffect(() => {
    if (!uid) {
      setUserFrame(null);
      setPhoto(null);
      setUserLevel(1);
      return;
    }

    // Force variables for preview/overrides if specified
    if (forceFrameId !== undefined) {
      setUserFrame(forceFrameId);
      if (forceLevel !== undefined) {
        setUserLevel(forceLevel);
      } else if (user && uid === user.uid) {
        setUserLevel(profile?.level || 1);
      }
      if (user && uid === user.uid && profile?.photoURL) {
        setPhoto(profile.photoURL);
      }
      return;
    }

    // For current user, our direct context renders live, but we also update state for fallback
    if (user && uid === user.uid) {
      setPhoto(profile?.photoURL || null);
      setUserFrame(profile?.equippedFrame || null);
      setUserLevel(profile?.level || 1);
      return;
    }

    // Return cached if exists
    if (avatarPhotoCache[uid]) {
      setPhoto(avatarPhotoCache[uid]);
      setUserFrame(avatarFrameCache[uid] || null);
      setUserLevel(avatarLevelCache[uid] || 1);
      return;
    }

    // Fetch from firestore
    const userRef = doc(db, 'users', uid);
    getDoc(userRef).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        const photoURL = data.photoURL;
        const displayName = data.displayName;
        const equipped = data.equippedFrame || null;
        const level = data.level || 1;

        if (photoURL) {
          avatarPhotoCache[uid] = photoURL;
          setPhoto(photoURL);
        }
        if (displayName) {
          avatarNameCache[uid] = displayName;
        }
        avatarFrameCache[uid] = equipped;
        avatarLevelCache[uid] = level;
        setUserFrame(equipped);
        setUserLevel(level);
      }
    }).catch(err => {
      console.warn("[UserAvatar] Error fetching user metadata:", err);
    });
  }, [uid, user?.uid, profile?.photoURL, profile?.equippedFrame, forceFrameId, forceLevel]);

  const isMe = user && uid === user.uid;
  const activePhoto = isMe ? (profile?.photoURL || null) : photo;
  const activeFrame = showFrame ? (isMe ? (profile?.equippedFrame || null) : (forceFrameId !== undefined ? forceFrameId : userFrame)) : null;
  const src = activePhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid || 'default'}`;
  const activeLevel = forceLevel !== undefined ? forceLevel : (isMe ? (profile?.level || 1) : userLevel);

  const [frameLoadState, setFrameLoadState] = useState<'loading' | 'loaded' | 'error'>(() => {
    if (!activeFrame) return 'loaded';
    if (activeFrame === 'guardiao_67') {
      if (globalFailedFrames.has('guardiao_67')) return 'error';
      if (globalLoadedFrames.has('guardiao_67')) return 'loaded';
      return 'loading';
    }
    return 'error';
  });

  const [currentFrameUrl, setCurrentFrameUrl] = useState<string>(() => {
    if (activeFrame === 'guardiao_67') {
      return moldura67 || '/moldura_guardiao.png';
    }
    return '';
  });

  useEffect(() => {
    if (!activeFrame) {
      setFrameLoadState('loaded');
      return;
    }
    if (activeFrame === 'guardiao_67') {
      if (globalLoadedFrames.has('guardiao_67')) {
        setFrameLoadState('loaded');
      } else if (globalFailedFrames.has('guardiao_67')) {
        setFrameLoadState('error');
      } else {
        setFrameLoadState('loading');
      }
      setCurrentFrameUrl(moldura67 || '/moldura_guardiao.png');
    } else {
      setFrameLoadState('error');
    }
  }, [activeFrame]);

  if (!activeFrame) {
    return (
      <div className={`relative flex-shrink-0 ${className} overflow-visible`}>
        <img
          src={src}
          className="w-full h-full rounded-full object-cover border border-white/10 bg-zinc-800"
          alt={alt}
          referrerPolicy="no-referrer"
        />
        {showLevel && (
          <div className="absolute bottom-[-1.5px] left-1/2 -translate-x-1/2 translate-y-1/4 z-10 flex items-center justify-center font-black rounded-lg border border-yellow-500/30 bg-zinc-950 text-yellow-400 text-[8px] px-1 py-0.5 uppercase tracking-wider scale-[0.85] leading-none font-mono">
            LV.{activeLevel}
          </div>
        )}
      </div>
    );
  }

function FrameParticles({ frameId }: { frameId: string }) {
  if (frameId === 'guardiao_67') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={`g67-p-${i}`}
            className="absolute rounded-full bg-fuchsia-400"
            style={{
              width: i % 2 === 0 ? 3 : 5,
              height: i % 2 === 0 ? 3 : 5,
              left: `${15 + (i * 16) % 70}%`,
              bottom: `${10 + (i * 11) % 25}%`,
              boxShadow: '0 0 10px #d946ef, 0 0 20px #a855f7',
            }}
            animate={{
              y: [-12, -45],
              x: [0, (Math.sin(i) * 12)],
              scale: [0.8, 1.4, 0.2],
              opacity: [0, 0.9, 0.4, 0]
            }}
            transition={{
              duration: 2.2 + Math.random() * 0.8,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeOut"
            }}
          />
        ))}
      </div>
    );
  }

  if (frameId === 'cyber') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={`cyber-p-${i}`}
            className="absolute rounded-full bg-cyan-400"
            style={{
              width: i % 2 === 0 ? 3 : 5,
              height: i % 2 === 0 ? 3 : 5,
              left: `${15 + (i * 17) % 70}%`,
              top: `${15 + (i * 23) % 70}%`,
              boxShadow: '0 0 8px #22d3ee, 0 0 16px #22d3ee',
            }}
            animate={{
              y: [-10, -28, -10],
              x: [0, (i % 2 === 0 ? 8 : -8), 0],
              opacity: [0, 0.8, 0],
              scale: [0.6, 1.2, 0.6]
            }}
            transition={{
              duration: 2.5 + (i * 0.4) % 1.5,
              repeat: Infinity,
              delay: i * 0.3,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>
    );
  }

  if (frameId === 'vip' || frameId === 'golden') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={`vip-p-${i}`}
            className="absolute bg-amber-305"
            style={{
              width: i % 2 === 0 ? 4 : 6,
              height: i % 2 === 0 ? 4 : 6,
              left: `${12 + (i * 19) % 76}%`,
              top: `${12 + (i * 29) % 76}%`,
              borderRadius: '2px',
              boxShadow: '0 0 8px #f59e0b, 0 0 16px #fbbf24',
            }}
            animate={{
              y: [-8, -32],
              opacity: [0, 0.9, 0],
              scale: [0.4, 1.3, 0.4],
              rotate: [0, 360]
            }}
            transition={{
              duration: 3 + (i * 0.5) % 1.8,
              repeat: Infinity,
              delay: i * 0.25,
              ease: "easeOut"
            }}
          />
        ))}
      </div>
    );
  }

  if (frameId === 'legendary') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={`legend-p-${i}`}
            className="absolute rounded bg-amber-400"
            style={{
              width: 4,
              height: 4,
              left: `${10 + (i * 17) % 80}%`,
              top: `${10 + (i * 21) % 80}%`,
              boxShadow: '0 0 10px #fbbf24, 0 0 20px #f59e0b',
            }}
            animate={{
              y: [-12, -34],
              rotate: [0, 360],
              opacity: [0, 1, 0],
              scale: [0.4, 1.4, 0.4]
            }}
            transition={{
              duration: 2.2 + i * 0.3,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeOut"
            }}
          />
        ))}
      </div>
    );
  }

  if (frameId === 'supreme') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={`supreme-p-${i}`}
            className="absolute rounded-full bg-rose-500"
            style={{
              width: i % 2 === 0 ? 4 : 6,
              height: i % 2 === 0 ? 4 : 6,
              left: `${12 + (i * 18) % 76}%`,
              top: `${12 + (i * 24) % 76}%`,
              boxShadow: '0 0 12px #f43f5e, 0 0 24px #be123c',
            }}
            animate={{
              y: [-8, -28, -8],
              opacity: [0.1, 1, 0.1],
              scale: [0.8, 1.3, 0.8]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: i * 0.4,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>
    );
  }

  if (frameId === 'galaxy' || frameId === 'celestial') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={`galaxy-p-${i}`}
            className="absolute rounded-full bg-indigo-200"
            style={{
              width: i % 2 === 0 ? 3 : 5,
              height: i % 2 === 0 ? 3 : 5,
              left: `${8 + (i * 21) % 84}%`,
              top: `${8 + (i * 17) % 84}%`,
              boxShadow: '0 0 10px #818cf8, 0 0 15px #c084fc',
            }}
            animate={{
              scale: [0.3, 1.3, 0.3],
              opacity: [0.2, 0.9, 0.2],
              y: [-5, -20, -5]
            }}
            transition={{
              duration: 2 + (i * 0.3) % 1.5,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>
    );
  }

  if (frameId === 'blue_fire') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={`bluefire-p-${i}`}
            className="absolute rounded-full bg-cyan-400"
            style={{
              width: i % 2 === 0 ? 4 : 6,
              height: i % 2 === 0 ? 4 : 6,
              left: `${15 + (i * 15) % 70}%`,
              bottom: `${10 + (i * 11) % 25}%`,
              boxShadow: '0 0 10px #22d3ee, 0 0 20px #3b82f6',
            }}
            animate={{
              y: [-5, -38],
              x: [0, (Math.sin(i) * 10)],
              scale: [1, 0.2],
              opacity: [0, 1, 0.6, 0]
            }}
            transition={{
              duration: 1.8 + Math.random() * 0.8,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeOut"
            }}
          />
        ))}
      </div>
    );
  }

  if (frameId === 'purple_aura') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={`purpleaura-p-${i}`}
            className="absolute rounded-full bg-fuchsia-400"
            style={{
              width: 5,
              height: 5,
              left: `${15 + (i * 19) % 70}%`,
              top: `${15 + (i * 21) % 70}%`,
              boxShadow: '0 0 12px #e879f9, 0 0 24px #a21caf',
            }}
            animate={{
              scale: [0.5, 1.5, 0.5],
              opacity: [0.2, 0.9, 0.2],
            }}
            transition={{
              duration: 2 + i * 0.3,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>
    );
  }

  if (frameId === 'diamond') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={`diamond-p-${i}`}
            className="absolute bg-white"
            style={{
              width: 4,
              height: 4,
              borderRadius: '1px',
              left: `${15 + (i * 18) % 70}%`,
              top: `${15 + (i * 22) % 70}%`,
              boxShadow: '0 0 8px #fff, 0 0 16px #93c5fd',
            }}
            animate={{
              rotate: [0, 180, 360],
              scale: [0.5, 1.3, 0.5],
              opacity: [0.1, 1, 0.1]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: i * 0.3,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>
    );
  }

  if (frameId === 'special_event') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={`event-p-${i}`}
            className="absolute rounded-sm"
            style={{
              width: 5,
              height: 5,
              background: i % 3 === 0 ? '#34d399' : (i % 3 === 1 ? '#f43f5e' : '#fbbf24'),
              left: `${12 + (i * 16) % 76}%`,
              top: `${12 + (i * 22) % 76}%`,
              boxShadow: '0 0 8px rgba(251,191,36,0.6)',
            }}
            animate={{
              y: [0, 25],
              rotate: [0, 180],
              opacity: [0, 0.9, 0]
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              delay: i * 0.3,
              ease: "linear"
            }}
          />
        ))}
      </div>
    );
  }

  if (frameId === 'ranking_special') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={`ranking-p-${i}`}
            className="absolute rounded-full bg-yellow-300"
            style={{
              width: i % 2 === 0 ? 3 : 5,
              height: i % 2 === 0 ? 3 : 5,
              left: `${15 + (i * 18) % 70}%`,
              top: `${15 + (i * 21) % 70}%`,
              boxShadow: '0 0 10px #fde047, 0 0 20px #eab308',
            }}
            animate={{
              y: [-10, -28, -10],
              opacity: [0, 1, 0],
              scale: [0.6, 1.2, 0.6]
            }}
            transition={{
              duration: 2.6,
              repeat: Infinity,
              delay: i * 0.4,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>
    );
  }

  if (frameId === 'royal') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={`royal-p-${i}`}
            className="absolute bg-pink-400"
            style={{
              width: 4,
              height: 4,
              borderRadius: '2px',
              left: `${15 + (i * 22) % 70}%`,
              top: `${15 + (i * 13) % 70}%`,
              boxShadow: '0 0 8px #f472b6, 0 0 16px #db2777',
            }}
            animate={{
              y: [-12, -26],
              x: [-4, 4, -4],
              rotate: [0, 180],
              opacity: [0, 0.8, 0]
            }}
            transition={{
              duration: 2.8,
              repeat: Infinity,
              delay: i * 0.4,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>
    );
  }

  if (frameId === 'demon') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={`demon-p-${i}`}
            className="absolute rounded-full"
            style={{
              width: i % 2 === 0 ? 4 : 6,
              height: i % 2 === 0 ? 4 : 6,
              background: 'linear-gradient(to top, #ef4444, #f59e0b)',
              left: `${10 + (i * 14) % 80}%`,
              bottom: `${10 + (i * 9) % 25}%`,
              boxShadow: '0 0 10px #ef4444, 0 0 20px #f97316',
            }}
            animate={{
              y: [-5, -40],
              x: [0, (Math.sin(i) * 12)],
              scale: [1, 0.2],
              opacity: [0, 1, 0.7, 0]
            }}
            transition={{
              duration: 1.8 + Math.random() * 1.2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeOut"
            }}
          />
        ))}
      </div>
    );
  }

  if (frameId === 'prism') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={`prism-p-${i}`}
            className="absolute"
            style={{
              width: 5,
              height: 5,
              background: 'linear-gradient(135deg, #10b981, #06b6d4, #f43f5e)',
              borderRadius: '1px',
              left: `${20 + (i * 15) % 60}%`,
              top: `${20 + (i * 21) % 60}%`,
              boxShadow: '0 0 10px #34d399, 0 0 18px #67e8f9',
            }}
            animate={{
              scale: [0.6, 1.4, 0.6],
              rotate: [0, 360],
              opacity: [0.2, 0.8, 0.2],
              y: [-5, -20, -5]
            }}
            transition={{
              duration: 3 + i * 0.3,
              repeat: Infinity,
              delay: i * 0.3,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>
    );
  }

  if (frameId === 'sakura') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={`sakura-p-${i}`}
            className="absolute rounded-br-full rounded-tl-full"
            style={{
              width: 6,
              height: 7,
              background: '#f472b6',
              border: '0.5px solid #fbcfe8',
              left: `${15 + (i * 16) % 70}%`,
              top: `${10 + (i * 14) % 60}%`,
              boxShadow: '0 0 8px rgba(244,114,182,0.5)',
            }}
            animate={{
              y: [0, 35],
              x: [0, -10, 10, 0],
              rotate: [0, 180, 360],
              opacity: [0, 0.85, 0.5, 0]
            }}
            transition={{
              duration: 3.5 + Math.random() * 1.5,
              repeat: Infinity,
              delay: i * 0.4,
              ease: "linear"
            }}
          />
        ))}
      </div>
    );
  }

  if (frameId === 'matrix') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={`matrix-p-${i}`}
            className="absolute font-mono text-[7px] leading-none text-green-450 font-black"
            style={{
              left: `${12 + i * 15}%`,
              top: `${10 + i * 8}%`,
              textShadow: '0 0 6px #22c55e, 0 0 12px #10b981'
            }}
            animate={{
              y: [-10, 30],
              opacity: [0, 1, 0.7, 0]
            }}
            transition={{
              duration: 1.8 + Math.random() * 1.2,
              repeat: Infinity,
              delay: i * 0.25,
              ease: "linear"
            }}
          >
            {i % 2 === 0 ? '1' : '0'}
          </motion.div>
        ))}
      </div>
    );
  }

  if (frameId === 'phoenix') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
        {[...Array(5)].map((_, i) => {
          const angle = (i * 2 * Math.PI) / 5;
          const targetX = Math.cos(angle) * 32;
          const targetY = Math.sin(angle) * 32;
          return (
            <motion.div
              key={`phoenix-p-${i}`}
              className="absolute rounded-full bg-orange-450"
              style={{
                width: 4,
                height: 4,
                left: '50%',
                top: '50%',
                marginLeft: -2,
                marginTop: -2,
                boxShadow: '0 0 10px #f97316, 0 0 18px #ef4444'
              }}
              animate={{
                x: [0, targetX],
                y: [0, targetY],
                scale: [0.4, 1.3, 0.2],
                opacity: [0.2, 0.9, 0]
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                delay: i * 0.3,
                ease: "easeOut"
              }}
            />
          );
        })}
      </div>
    );
  }

  if (frameId === 'quantum') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
        {[...Array(3)].map((_, i) => {
          const startAngle = (i * 120) * (Math.PI / 180);
          return (
            <motion.div
              key={`quantum-p-${i}`}
              className="absolute rounded-full bg-cyan-300"
              style={{
                width: 4,
                height: 4,
                left: '46%',
                top: '46%',
                boxShadow: '0 0 10px #22d3ee, 0 0 20px #3b82f6',
              }}
              animate={{
                x: [
                  28 * Math.cos(startAngle), 
                  28 * Math.cos(startAngle + Math.PI/2), 
                  28 * Math.cos(startAngle + Math.PI), 
                  28 * Math.cos(startAngle + 3*Math.PI/2), 
                  28 * Math.cos(startAngle)
                ],
                y: [
                  16 * Math.sin(startAngle), 
                  16 * Math.sin(startAngle + Math.PI/2), 
                  16 * Math.sin(startAngle + Math.PI), 
                  16 * Math.sin(startAngle + 3*Math.PI/2), 
                  16 * Math.sin(startAngle)
                ],
                scale: [0.8, 1.2, 0.8, 1.2, 0.8],
                opacity: [0.4, 1, 0.4, 1, 0.4]
              }}
              transition={{
                duration: 3.5,
                repeat: Infinity,
                ease: "linear"
              }}
            />
          );
        })}
      </div>
    );
  }

  return null;
}

  // Absolute overlay details depending on loading/loaded state
  let decor = null;
  let bgGradient = "";
  let containerGlow = "";

  if (activeFrame === 'guardiao_67') {
    // Elegant futuristic pulsing glow and rotating aura bg gradient
    containerGlow = "shadow-[0_0_24px_rgba(168,85,247,0.55)] border border-purple-500/20 bg-purple-950/10";
    bgGradient = "bg-gradient-to-tr from-purple-900/50 via-fuchsia-950/20 to-zinc-950/40 animate-rotate-bg";
    
    decor = (
      <>
        {/* Layer 1: Elegant Fallback Background Vectors (spinning dashed lines and golden crown - always here as a graceful fallback / background element) */}
        {frameLoadState !== 'loaded' && (
          <div className="absolute inset-[-4px] z-30 pointer-events-none overflow-visible flex items-center justify-center scale-[1.12] transition-opacity duration-300">
            {/* Inner ring spinning anticlockwise */}
            <div className="absolute inset-1 rounded-full border border-dashed border-amber-400/35 animate-[spin_24s_linear_infinite_reverse]" />
            {/* Outer ring pulsing and spinning clockwise */}
            <div className="absolute inset-[-2px] rounded-full border border-dashed border-purple-500/50 animate-[spin_15s_linear_infinite]" />
            {/* Center crown badge representing Elite Guardian status */}
            <div className="absolute -top-3.5 scale-75 bg-gradient-to-b from-amber-300 to-amber-500 p-0.5 rounded-full border border-[#0c0c0c] shadow-[0_2px_5px_rgba(0,0,0,0.5)] flex items-center justify-center">
              <Crown size={10} className="text-black fill-black animate-pulse" />
            </div>
          </div>
        )}

        {/* Layer 2: Main PNG Moldura Image (loaded asynchronously with inline fail-safe path chaining without blocking ref headers) */}
        <div 
          className={`absolute -inset-3.5 z-35 pointer-events-none overflow-visible flex items-center justify-center scale-[1.20] transition-all duration-300 ${
            frameLoadState === 'loaded' ? 'opacity-100' : 'opacity-80'
          }`}
        >
          <img 
            src={currentFrameUrl || moldura67 || '/moldura_guardiao.png'} 
            className="w-full h-full object-contain" 
            alt="Moldura Guardião Elite 67"
            onLoad={() => {
              globalLoadedFrames.add('guardiao_67');
              setFrameLoadState('loaded');
            }}
            onError={(e) => {
              const imgEl = e.currentTarget;
              // Chaining loading paths locally to maximize chance of match
              if (currentFrameUrl === moldura67) {
                setCurrentFrameUrl('/moldura_guardiao.png');
              } else if (currentFrameUrl === '/moldura_guardiao.png') {
                setCurrentFrameUrl('moldura_guardiao.png');
              } else if (currentFrameUrl === 'moldura_guardiao.png') {
                setCurrentFrameUrl('/moldura_67_1779407125172.png');
              } else {
                globalFailedFrames.add('guardiao_67');
                setFrameLoadState('error');
              }
            }}
          />
        </div>
      </>
    );
  }

  const sanitizedClass = activeFrame ? sanitizeClassName(className) : className;

  return (
    <div className={`relative flex-shrink-0 ${sanitizedClass} overflow-visible flex items-center justify-center p-[2px]`}>
      
      {/* Background Rotating element aura inside the main area */}
      <div className={`absolute w-[80%] h-[80%] rounded-full overflow-hidden ${containerGlow} z-0 flex items-center justify-center`}>
         <div className={`absolute w-[185%] h-[185%] rounded-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${bgGradient} z-0`} />
      </div>

      {/* Frame Particles (fires, sparkles) */}
      <FrameParticles frameId={activeFrame || ''} />

      {/* The User Avatar Photo: centered and scales inside the frame's transparent center perfectly */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[74%] h-[74%] rounded-full overflow-hidden z-20 flex items-center justify-center bg-[#0c0c0c] border border-purple-500/20">
        <img
          src={src}
          className="w-full h-full rounded-full object-cover bg-zinc-950"
          alt={alt}
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Guardian Frame overlay layer */}
      {decor}

      {/* WePlay inspired level badge centered perfectly on bottom overlaying the frame */}
      {showLevel && (
        <div className="absolute bottom-[-1.5px] left-1/2 -translate-x-1/2 z-40 bg-zinc-950 font-black rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.9)] border-2 border-amber-400 text-amber-400 text-[8px] px-2 py-0.5 uppercase tracking-wider scale-[0.88] md:scale-95 font-mono font-extrabold flex items-center gap-0.5 whitespace-nowrap">
          <span className="text-yellow-400/95 pr-0.5 select-none animate-pulse">★</span>{isMe && profile?.isVip ? `VIP ` : `LV.`}{activeLevel}
        </div>
      )}

    </div>
  );
}
