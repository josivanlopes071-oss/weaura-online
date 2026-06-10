import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { PREMIUM_FRAMES, getDirectDriveUrl, getFrameById } from '../lib/frames';
import { AURA_LEVELS } from '../lib/aura';
import ProfileFrame from './ProfileFrame';

const avatarPhotoCache: { [uid: string]: string } = {};
const avatarNameCache: { [uid: string]: string } = {};
const avatarLevelCache: { [uid: string]: number } = {};
const avatarFrameCache: { [uid: string]: string | null } = {};
const avatarAuraLevelCache: { [uid: string]: number } = {};
const avatarVipCache: { [uid: string]: boolean } = {};
const avatarVipPlanCache: { [uid: string]: string | null } = {};
const profileFetchPromises: { [uid: string]: Promise<any> | null } = {};

interface UserAvatarProps {
  uid?: string | null;
  className?: string; // e.g. "w-12 h-12", "w-16 h-16", "w-32 h-32"
  alt?: string;
  showFrame?: boolean;
  forceFrameId?: string;
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
  const { profile, user, customFrames = [] } = useAuth();
  const [photo, setPhoto] = useState<string | null>(null);
  const [userLevel, setUserLevel] = useState<number>(1);
  const [equippedFrame, setEquippedFrame] = useState<string | null>(null);
  const [userAuraLevel, setUserAuraLevel] = useState<number>(1);
  const [isVip, setIsVip] = useState<boolean>(false);
  const [vipPlan, setVipPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setPhoto(null);
      setUserLevel(1);
      setEquippedFrame(null);
      setIsVip(false);
      setVipPlan(null);
      return;
    }

    if (forceFrameId !== undefined) {
      setEquippedFrame(forceFrameId);
    } else if (user && uid === user.uid) {
      setEquippedFrame(profile?.equippedFrame || null);
    }

    if (forceLevel !== undefined) {
      setUserLevel(forceLevel);
      if (user && uid === user.uid && profile?.photoURL) {
        setPhoto(profile.photoURL);
        setIsVip(profile?.isVip || false);
        setVipPlan(profile?.vipPlan || null);
      }
      return;
    }

    if (user && uid === user.uid) {
      setPhoto(profile?.photoURL || null);
      setUserLevel(profile?.level || 1);
      setUserAuraLevel(profile?.auraLevel || 1);
      setIsVip(profile?.isVip || false);
      setVipPlan(profile?.vipPlan || null);
      return;
    }

    // Cache preloading for immediate fluid render
    if (avatarPhotoCache[uid] !== undefined) {
      setPhoto(avatarPhotoCache[uid]);
      setUserLevel(avatarLevelCache[uid] || 1);
      setUserAuraLevel(avatarAuraLevelCache[uid] || 1);
      setIsVip(avatarVipCache[uid] || false);
      setVipPlan(avatarVipPlanCache[uid] || null);
      if (forceFrameId === undefined) {
        setEquippedFrame(avatarFrameCache[uid] || null);
      }
      return;
    }

    // Fetch asynchronously using a unified shared promise registry to prevent double-fetching
    const fetchUserMeta = async () => {
      const userRef = doc(db, 'users', uid);
      if (!profileFetchPromises[uid]) {
        profileFetchPromises[uid] = getDoc(userRef).then((snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const fetchedPhoto = data.photoURL || '';
            const fetchedName = data.displayName || 'Membro Aura';
            const fetchedLevel = data.level || 1;
            const fetchedFrame = data.equippedFrame || null;
            const fetchedAuraLevel = data.auraLevel || 1;
            const fetchedVip = data.isVip || false;
            const fetchedVipPlan = data.vipPlan || null;

            avatarPhotoCache[uid] = fetchedPhoto;
            avatarNameCache[uid] = fetchedName;
            avatarLevelCache[uid] = fetchedLevel;
            avatarFrameCache[uid] = fetchedFrame;
            avatarAuraLevelCache[uid] = fetchedAuraLevel;
            avatarVipCache[uid] = fetchedVip;
            avatarVipPlanCache[uid] = fetchedVipPlan;

            return { fetchedPhoto, fetchedLevel, fetchedFrame, fetchedAuraLevel, fetchedVip, fetchedVipPlan };
          }
          return { fetchedPhoto: '', fetchedLevel: 1, fetchedFrame: null, fetchedAuraLevel: 1, fetchedVip: false, fetchedVipPlan: null };
        }).catch((err) => {
          console.warn("[UserAvatar Cache] Sync Error:", err);
          return { fetchedPhoto: '', fetchedLevel: 1, fetchedFrame: null, fetchedAuraLevel: 1, fetchedVip: false, fetchedVipPlan: null };
        });
      }

      const res = await profileFetchPromises[uid];
      setPhoto(res.fetchedPhoto);
      setUserLevel(res.fetchedLevel);
      setUserAuraLevel(res.fetchedAuraLevel || 1);
      setIsVip(res.fetchedVip || false);
      setVipPlan(res.fetchedVipPlan || null);
      if (forceFrameId === undefined) {
        setEquippedFrame(res.fetchedFrame);
      }
    };

    fetchUserMeta();
  }, [uid, user?.uid, profile?.photoURL, profile?.equippedFrame, profile?.level, profile?.auraLevel, profile?.isVip, profile?.vipPlan, forceFrameId, forceLevel, customFrames]);

  const isMe = user && uid === user.uid;
  const activePhoto = isMe ? (profile?.photoURL || null) : photo;
  const rawSrc = activePhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid || 'default'}`;
  const src = getDirectDriveUrl(rawSrc);
  const activeLevel = forceLevel !== undefined ? forceLevel : (isMe ? (profile?.level || 1) : userLevel);

  const activeIsVip = isMe ? (profile?.isVip || false) : isVip;
  const activeVipPlan = isMe ? (profile?.vipPlan || null) : vipPlan;

  // Auto-equipped VIP frame fallback if user hasn't chosen one
  const matchedFrameId = forceFrameId !== undefined ? forceFrameId : (equippedFrame || (activeIsVip && activeVipPlan ? `fr_vip_${activeVipPlan.toLowerCase()}` : null));

  // Match the equipped frame item
  const currentFrameObj = showFrame && matchedFrameId 
    ? (PREMIUM_FRAMES.find(f => f.id === matchedFrameId) || customFrames.find((f: any) => f.id === matchedFrameId) || getFrameById(matchedFrameId)) 
    : null;

  const activeAuraLevel = isMe ? (profile?.auraLevel || 1) : userAuraLevel;
  const hasAuraFrame = !currentFrameObj && activeAuraLevel >= 2;
  const imageSize = currentFrameObj ? '74%' : (hasAuraFrame ? '84%' : '100%');

  // Check if they are explicitly using another non-VIP frame. Avoid cluttering if another frame is equipped.
  const isUsingSelfVipFrame = !equippedFrame || (activeVipPlan && equippedFrame === `fr_vip_${activeVipPlan.toLowerCase()}`);
  const isRawDesign = !!currentFrameObj?.noProcessing;

  return (
    <div id="user-avatar-root" className={`relative flex-shrink-0 ${className} aspect-square overflow-visible group flex items-center justify-center bg-transparent`}>
           {/* Background Aura glow - WePlay theme aura or custom VIP pulse gradient */}
      {(!isRawDesign && (currentFrameObj || hasAuraFrame || activeIsVip)) && (
        <div 
          className="absolute rounded-full pointer-events-none transition-all duration-1000 opacity-80 group-hover:opacity-100 animate-pulse"
          style={{
            width: '135%',
            height: '135%',
            background: (activeIsVip && isUsingSelfVipFrame)
              ? (activeVipPlan === 'Bronze' ? 'radial-gradient(circle, rgba(217,119,6,0.3) 0%, transparent 70%)' :
                 activeVipPlan === 'Prata' ? 'radial-gradient(circle, rgba(148,163,184,0.3) 0%, transparent 70%)' :
                 activeVipPlan === 'Ouro' ? 'radial-gradient(circle, rgba(234,179,8,0.4) 0%, transparent 72%)' :
                 'radial-gradient(circle, rgba(6,182,212,0.5) 0%, rgba(168,85,247,0.15) 40%, transparent 75%)')
              : `radial-gradient(circle, ${
                  currentFrameObj ? currentFrameObj.glowColor : 
                  activeAuraLevel === 2 ? '#10b981' :
                  activeAuraLevel === 3 ? '#3b82f6' :
                  activeAuraLevel === 4 ? '#a855f7' :
                  activeAuraLevel === 5 ? '#f59e0b' : '#ff4d9d'
                }25 0%, transparent 70%)`,
            zIndex: 1
          }}
        />
      )}

      {/* Rotating holograph loop for VIP / Premium style */}
      {(!isRawDesign && (currentFrameObj?.isVip || (hasAuraFrame && activeAuraLevel >= 4) || (activeIsVip && isUsingSelfVipFrame))) && (
        <>
          {/* Default Rotating Hologram */}
          <div 
            className="absolute rounded-full pointer-events-none opacity-40 mix-blend-screen scale-[1.08] animate-angle-rotate holographic-gradient block"
            style={{
              width: '100%',
              height: '100%',
              padding: '2px',
              maskImage: 'radial-gradient(circle, transparent 58%, black 60%)',
              WebkitMaskImage: 'radial-gradient(circle, transparent 58%, black 60%)',
              zIndex: 2
            }}
          />

          {/* Level Specific Specialized Moving Orbits */}
          {activeIsVip && isUsingSelfVipFrame && activeVipPlan === 'Bronze' && (
            <div className="absolute rounded-full pointer-events-none scale-[1.12] border border-amber-500/30 border-dashed animate-spin" style={{ width: '105%', height: '105%', zIndex: 1 }} />
          )}
          {activeIsVip && isUsingSelfVipFrame && activeVipPlan === 'Prata' && (
            <>
              <div className="absolute rounded-full pointer-events-none scale-[1.12] border border-slate-300/40 animate-spin" style={{ width: '105%', height: '105%', zIndex: 1 }} />
              <div className="absolute rounded-full pointer-events-none scale-[1.15] border border-dotted border-slate-400/30 animate-spin-slow" style={{ width: '110%', height: '110%', zIndex: 1 }} />
            </>
          )}
          {activeIsVip && isUsingSelfVipFrame && activeVipPlan === 'Ouro' && (
            <>
              <div className="absolute rounded-full pointer-events-none scale-[1.15] border-2 border-double border-yellow-400/50 shadow-[0_0_12px_#fbbf24] animate-pulse" style={{ width: '108%', height: '108%', zIndex: 1 }} />
              <div className="absolute rounded-full pointer-events-none scale-[1.20] border border-dashed border-amber-400/30 animate-spin" style={{ width: '114%', height: '114%', zIndex: 1 }} />
            </>
          )}
          {activeIsVip && isUsingSelfVipFrame && activeVipPlan === 'Diamante' && (
            <>
              <div className="absolute rounded-full pointer-events-none scale-[1.20] bg-gradient-to-tr from-cyan-400 via-fuchsia-500 to-pink-500 p-[1.5px] animate-spin shadow-[0_0_20px_rgba(6,182,212,0.4)]" style={{ width: '112%', height: '112%', zIndex: 1, maskImage: 'radial-gradient(circle, transparent 55%, black 60%)', WebkitMaskImage: 'radial-gradient(circle, transparent 55%, black 60%)' }} />
              <div className="absolute rounded-full pointer-events-none scale-[1.25] border border-dashed border-cyan-400/45 animate-spin-slow" style={{ width: '118%', height: '118%', zIndex: 1 }} />
            </>
          )}
        </>
      )}

      {/* Core Avatar Image / Profile Frame Container Layout */}
      {currentFrameObj ? (
        <ProfileFrame frameObj={currentFrameObj} zIndex={20}>
          <img
            src={src}
            className="w-full h-full rounded-full object-cover"
            alt={alt}
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid || 'default'}`;
            }}
          />
        </ProfileFrame>
      ) : (
        /* Standard Avatar Image Container when no Custom Frame is equipped */
        <div 
          className="rounded-full overflow-hidden flex items-center justify-center bg-zinc-950 border border-white/10 absolute transition-all duration-500"
          style={{
            width: imageSize,
            height: imageSize,
            boxShadow: 'none',
            zIndex: 10,
            background: 'transparent'
          }}
        >
          <img
            src={src}
            className="w-full h-full rounded-full object-cover"
            alt={alt}
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid || 'default'}`;
            }}
          />
        </div>
      )}

      {/* Dynamic CSS Aura Level Frames */}
      {hasAuraFrame && (
        <div 
          className={`absolute rounded-full pointer-events-none transition-all duration-300 ${
            activeAuraLevel === 2 ? 'border-2 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.55)] animate-pulse' :
            activeAuraLevel === 3 ? 'border-2 border-blue-500 shadow-[0_0_18px_rgba(59,130,246,0.65)] animate-pulse' :
            activeAuraLevel === 4 ? 'border-2 border-purple-500 border-dashed shadow-[0_0_22px_rgba(168,85,247,0.7)] animate-spin-slow' :
            activeAuraLevel === 5 ? 'border-[3px] border-double border-amber-500 shadow-[0_0_28px_rgba(245,158,11,0.85)] animate-pulse' :
            activeAuraLevel >= 6 ? 'border-2 border-[#8A2EFF] shadow-[0_0_35px_rgba(138,46,255,0.9)] animate-pulse' : ''
          }`}
          style={{
            width: '93%',
            height: '93%',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 15,
            borderImage: activeAuraLevel >= 6 ? 'linear-gradient(to right, #FF4D9D, #8A2EFF, #00F0FF) 1' : undefined
          }}
        />
      )}

      {/* Level Tag (glowing match if frame is equipped) */}
      {showLevel && (
        <div 
          className={`absolute bottom-[-1.5px] left-1/2 -translate-x-1/2 translate-y-1/4 flex items-center justify-center font-black rounded-lg border text-[8px] px-1.5 pointer-events-none py-0.5 uppercase tracking-wider scale-[0.82] leading-none font-mono transition-transform duration-300 ${
            currentFrameObj 
              ? 'border-purple-400 bg-zinc-950 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.45)]' 
              : 'border-yellow-500/30 bg-zinc-950 text-yellow-400'
          }`}
          style={{ zIndex: 30 }}
        >
          LV.{activeLevel}
        </div>
      )}
    </div>
  );
}
