import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Crown, Sparkles, Star, Flame, Zap, Gem, Award, Shield } from 'lucide-react';

const avatarPhotoCache: { [uid: string]: string } = {};
const avatarFrameCache: { [uid: string]: string } = {};
const avatarNameCache: { [uid: string]: string } = {};

interface UserAvatarProps {
  uid?: string | null;
  className?: string; // e.g. "w-12 h-12", "w-16 h-16", "w-32 h-32"
  alt?: string;
  showFrame?: boolean;
  forceFrameId?: string; // used to override/preview specific frame
}

export default function UserAvatar({ uid, className = "w-12 h-12", alt = "", showFrame = true, forceFrameId }: UserAvatarProps) {
  const { profile, user } = useAuth();
  const [photo, setPhoto] = useState<string | null>(null);
  const [userFrame, setUserFrame] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setUserFrame(null);
      setPhoto(null);
      return;
    }

    // Force frame id for preview if specified
    if (forceFrameId !== undefined) {
      setUserFrame(forceFrameId);
      // For photo, use logged in user's photo if applicable, else default
      if (user && uid === user.uid && profile?.photoURL) {
        setPhoto(profile.photoURL);
      }
      return;
    }

    // Direct live sync for current user
    if (user && uid === user.uid) {
      if (profile?.photoURL) setPhoto(profile.photoURL);
      setUserFrame(profile?.equippedFrame || null);
      return;
    }

    // Return cached if exists
    if (avatarPhotoCache[uid]) {
      setPhoto(avatarPhotoCache[uid]);
      setUserFrame(avatarFrameCache[uid] || null);
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

        if (photoURL) {
          avatarPhotoCache[uid] = photoURL;
          setPhoto(photoURL);
        }
        if (displayName) {
          avatarNameCache[uid] = displayName;
        }
        avatarFrameCache[uid] = equipped;
        setUserFrame(equipped);
      }
    }).catch(err => {
      console.warn("[UserAvatar] Error fetching user metadata:", err);
    });
  }, [uid, user?.uid, profile?.photoURL, profile?.equippedFrame, forceFrameId]);

  const src = photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid || 'default'}`;

  // If we should not show the frame, or user doesn't have one active, render standard clean avatar
  const activeFrame = showFrame ? userFrame : null;

  if (!activeFrame) {
    return (
      <img
        src={src}
        className={`${className} rounded-full object-cover border border-white/10 bg-zinc-800`}
        alt={alt}
        referrerPolicy="no-referrer"
      />
    );
  }

  // Animated Molduras style WePlay Configuration
  let decor = null;
  // classes container around image
  let containerClasses = "relative rounded-full aspect-square overflow-hidden flex items-center justify-center p-[4px] ";
  let bgGradient = "";

  if (activeFrame === 'cyber') {
    // Cyber Neon Frame: Animated Cyan-magenta rotation and cyber pulsing shadow
    containerClasses += "animate-pulse-cyan";
    bgGradient = "bg-gradient-to-tr from-cyan-400 via-fuchsia-500 to-cyan-500 animate-rotate-bg-fast";
    decor = (
      <div className="absolute -top-1.5 -right-1.5 z-20 flex items-center justify-center bg-cyan-400 rounded-full p-0.5 shadow-[0_0_12px_#22d3ee] animate-pulse">
        <Sparkles size={8} className="text-[#020202] stroke-[3]" />
      </div>
    );
  } else if (activeFrame === 'golden') {
    // Imperial Golden: Deep gold rich aura with majestic crowns spinning
    containerClasses += "animate-pulse-gold";
    bgGradient = "bg-gradient-to-tr from-amber-500 via-yellow-250 to-amber-300 animate-rotate-bg";
    decor = (
      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20 transition-all filter drop-shadow-[0_4px_8px_rgba(251,191,36,0.6)]">
        <Crown size={15} className="text-amber-300 fill-amber-300 stroke-[1.5]" />
      </div>
    );
  } else if (activeFrame === 'celestial') {
    // Cosmic Portal: Celestial stars blinking, violet-indigo spinning portal
    containerClasses += "animate-pulse-purple";
    bgGradient = "bg-gradient-to-tr from-indigo-500 via-purple-600 to-pink-500 animate-rotate-bg";
    decor = (
      <>
        <Star size={9} className="absolute -top-2.5 -left-1 text-indigo-300 drop-shadow-[0_0_6px_#818cf8] fill-indigo-300 animate-ping z-20" />
        <Sparkles size={9} className="absolute -bottom-1 -right-1 text-purple-400 drop-shadow-[0_0_6px_#c084fc] animate-pulse z-20" />
      </>
    );
  } else if (activeFrame === 'royal') {
    // Royal Pink/Ruby We Aura Frame
    containerClasses += "animate-pulse-pink";
    bgGradient = "bg-gradient-to-tr from-pink-500 via-rose-600 to-pink-500 animate-rotate-bg";
    decor = (
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-20 bg-pink-500 px-1.5 py-0.5 rounded-full border border-pink-300 flex items-center justify-center shadow-[0_0_12px_#ec4899] scale-90">
        <span className="text-[7px] font-black uppercase text-white tracking-widest leading-none">VIP</span>
      </div>
    );
  } else if (activeFrame === 'demon') {
    // Dark Demon: Onyx spark & fiery scarlet flames rotating
    containerClasses += "animate-pulse-demon";
    bgGradient = "bg-gradient-to-tr from-red-600 via-zinc-950 to-red-500 animate-rotate-bg";
    decor = (
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">
        <Flame size={14} className="text-red-500 fill-red-500" />
      </div>
    );
  } else if (activeFrame === 'prism') {
    // Mystic Prism Frame
    containerClasses += "animate-pulse-prism";
    bgGradient = "bg-gradient-to-tr from-rose-500 via-emerald-500 to-cyan-500 animate-rotate-bg";
    decor = (
      <div className="absolute -top-2 right-1/2 translate-x-1/2 z-20 filter drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]">
         <Gem size={12} className="text-teal-300 fill-teal-100" />
      </div>
    );
  }

  return (
    <div className={`relative flex-shrink-0 ${className} p-0.5`}>
      {decor}
      <div className={`${containerClasses} w-full h-full`}>
        {/* Background Rotating element */}
        <div className={`absolute w-[180%] h-[180%] rounded-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${bgGradient} z-0`} />
        
        {/* Inner Circle container mask keeping photo clear */}
        <div className="w-full h-full rounded-full bg-[#0c0c0c] z-10 flex items-center justify-center overflow-hidden relative">
          <img
            src={src}
            className="w-full h-full rounded-full object-cover bg-zinc-900"
            alt={alt}
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </div>
  );
}
