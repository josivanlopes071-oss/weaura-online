import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { PREMIUM_FRAMES, getDirectDriveUrl } from '../lib/frames';
import { getTransparentFrame } from '../lib/transparentFrameProcessor';

const avatarPhotoCache: { [uid: string]: string } = {};
const avatarNameCache: { [uid: string]: string } = {};
const avatarLevelCache: { [uid: string]: number } = {};
const avatarFrameCache: { [uid: string]: string | null } = {};
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
  const { profile, user } = useAuth();
  const [photo, setPhoto] = useState<string | null>(null);
  const [userLevel, setUserLevel] = useState<number>(1);
  const [equippedFrame, setEquippedFrame] = useState<string | null>(null);

  // States to hold the processed high-quality PNG with alpha channel transparency
  const [processedFrameUrl, setProcessedFrameUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorOccurred, setErrorOccurred] = useState(false);

  useEffect(() => {
    if (!uid) {
      setPhoto(null);
      setUserLevel(1);
      setEquippedFrame(null);
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
      }
      return;
    }

    if (user && uid === user.uid) {
      setPhoto(profile?.photoURL || null);
      setUserLevel(profile?.level || 1);
      return;
    }

    // Cache preloading for immediate fluid render
    if (avatarPhotoCache[uid] !== undefined) {
      setPhoto(avatarPhotoCache[uid]);
      setUserLevel(avatarLevelCache[uid] || 1);
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

            avatarPhotoCache[uid] = fetchedPhoto;
            avatarNameCache[uid] = fetchedName;
            avatarLevelCache[uid] = fetchedLevel;
            avatarFrameCache[uid] = fetchedFrame;

            return { fetchedPhoto, fetchedLevel, fetchedFrame };
          }
          return { fetchedPhoto: '', fetchedLevel: 1, fetchedFrame: null };
        }).catch((err) => {
          console.warn("[UserAvatar Cache] Sync Error:", err);
          return { fetchedPhoto: '', fetchedLevel: 1, fetchedFrame: null };
        });
      }

      const res = await profileFetchPromises[uid];
      setPhoto(res.fetchedPhoto);
      setUserLevel(res.fetchedLevel);
      if (forceFrameId === undefined) {
        setEquippedFrame(res.fetchedFrame);
      }
    };

    fetchUserMeta();
  }, [uid, user?.uid, profile?.photoURL, profile?.equippedFrame, forceFrameId, forceLevel]);

  // Match the equipped frame item
  const currentFrameObj = showFrame && equippedFrame ? PREMIUM_FRAMES.find(f => f.id === equippedFrame) : null;

  // Process the frame image to remove background and convert it to transparent alpha PNG
  useEffect(() => {
    if (currentFrameObj?.imageUrl) {
      setIsProcessing(true);
      setErrorOccurred(false);
      getTransparentFrame(currentFrameObj.imageUrl)
        .then((alphaTransparentUrl) => {
          setProcessedFrameUrl(alphaTransparentUrl);
          setIsProcessing(false);
        })
        .catch((err) => {
          console.warn("[UserAvatar] Falha na conversão de transparência. Usando fallback.", err);
          // Fallback to direct raw url (blended using mix-blend-mode inside CSS)
          setProcessedFrameUrl(currentFrameObj.imageUrl);
          setIsProcessing(false);
        });
    } else {
      setProcessedFrameUrl(null);
      setIsProcessing(false);
    }
  }, [currentFrameObj?.imageUrl]);

  const isMe = user && uid === user.uid;
  const activePhoto = isMe ? (profile?.photoURL || null) : photo;
  const rawSrc = activePhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid || 'default'}`;
  const src = getDirectDriveUrl(rawSrc);
  const activeLevel = forceLevel !== undefined ? forceLevel : (isMe ? (profile?.level || 1) : userLevel);

  return (
    <div id="user-avatar-root" className={`relative flex-shrink-0 ${className} overflow-visible group flex items-center justify-center bg-transparent`}>
      
      {/* Background Aura glow - WePlay theme aura */}
      {currentFrameObj && (
        <div 
          className="absolute rounded-full pointer-events-none transition-all duration-1000 opacity-80 group-hover:opacity-100 weplay-aura-glow animate-pulse"
          style={{
            width: '130%',
            height: '130%',
            background: `radial-gradient(circle, ${currentFrameObj.glowColor}25 0%, transparent 70%)`,
            zIndex: 1
          }}
        />
      )}

      {/* Rotating holograph loop for VIP / Premium style */}
      {currentFrameObj?.isVip && (
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
      )}

      {/* Core Avatar Image Container (Centered, nested, scaled to leave precise space for outer frame) */}
      <div 
        className="rounded-full overflow-hidden flex items-center justify-center bg-zinc-950 border border-white/10 absolute transition-all duration-500"
        style={{
          width: currentFrameObj ? '74%' : '100%',
          height: currentFrameObj ? '74%' : '100%',
          boxShadow: currentFrameObj ? `0 0 16px ${currentFrameObj.glowColor}30` : 'none',
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

      {/* Frame image layer. Positioned exactly centered around the photo container with zero clipping */}
      {currentFrameObj && (currentFrameObj.imageUrl || processedFrameUrl) && (
        <div 
          className="absolute pointer-events-none select-none flex items-center justify-center bg-transparent"
          style={{
            width: '124%',
            height: '124%',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 20
          }}
        >
          {/* Real-time spinner animation before rendering frame texture */}
          {isProcessing && !processedFrameUrl && (
            <div 
              className={`absolute w-[78%] h-[78%] rounded-full border-2 border-dashed ${
                currentFrameObj.id === 'weplay_aura_guardiao' ? 'border-purple-500 animate-spin' : 'border-cyan-500 animate-pulse'
              } opacity-70`}
            />
          )}

          {/* Transparent PNG Frame rendering layer */}
          {(processedFrameUrl || currentFrameObj.imageUrl) && (
            <img 
              src={processedFrameUrl || currentFrameObj.imageUrl} 
              className="w-full h-full object-contain pointer-events-none transition-all duration-300 drop-shadow-[0_0_12px_rgba(0,0,0,0.85)] bg-transparent"
              style={{
                // Auto screen blending mode is set if we load raw imageUrl (unprocessed backup) or if canvas had failure,
                // otherwise it renders pure transparente PNG raw data.
                mixBlendMode: (!processedFrameUrl || processedFrameUrl === currentFrameObj.imageUrl) ? 'screen' : 'normal',
                objectFit: 'contain',
                background: 'transparent',
                imageRendering: 'auto'
              }}
              alt={currentFrameObj.name}
              onError={() => {
                console.warn("[UserAvatar] Falhou ao carregar componente da moldura.");
                setErrorOccurred(true);
              }}
            />
          )}

          {/* Premium Ambient Pulsing Particle Glow effect */}
          {!isProcessing && (processedFrameUrl || currentFrameObj.imageUrl) && (
            <div 
              className="absolute inset-[4%] rounded-full pointer-events-none opacity-40 mix-blend-screen animate-pulse scale-[1.01]"
              style={{
                boxShadow: `0 0 18px ${currentFrameObj.glowColor}40, inset 0 0 18px ${currentFrameObj.glowColor}30`,
                border: `1px solid ${currentFrameObj.glowColor}15`,
                background: 'transparent'
              }}
            />
          )}
        </div>
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
