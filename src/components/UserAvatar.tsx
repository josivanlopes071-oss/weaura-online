import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

const avatarPhotoCache: { [uid: string]: string } = {};
const avatarNameCache: { [uid: string]: string } = {};
const avatarLevelCache: { [uid: string]: number } = {};

interface UserAvatarProps {
  uid?: string | null;
  className?: string; // e.g. "w-12 h-12", "w-16 h-16", "w-32 h-32"
  alt?: string;
  showFrame?: boolean; // deprecated/ignored
  forceFrameId?: string; // deprecated/ignored
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

  useEffect(() => {
    if (!uid) {
      setPhoto(null);
      setUserLevel(1);
      return;
    }

    // Force level preview
    if (forceLevel !== undefined) {
      setUserLevel(forceLevel);
      if (user && uid === user.uid && profile?.photoURL) {
        setPhoto(profile.photoURL);
      }
      return;
    }

    // For current user, our direct context renders live, but we also update state for fallback
    if (user && uid === user.uid) {
      setPhoto(profile?.photoURL || null);
      setUserLevel(profile?.level || 1);
      return;
    }

    // Return cached if exists
    if (avatarPhotoCache[uid]) {
      setPhoto(avatarPhotoCache[uid]);
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
        const level = data.level || 1;

        if (photoURL) {
          avatarPhotoCache[uid] = photoURL;
          setPhoto(photoURL);
        }
        if (displayName) {
          avatarNameCache[uid] = displayName;
        }
        avatarLevelCache[uid] = level;
        setUserLevel(level);
      }
    }).catch(err => {
      console.warn("[UserAvatar] Error fetching user metadata:", err);
    });
  }, [uid, user?.uid, profile?.photoURL, forceLevel]);

  const isMe = user && uid === user.uid;
  const activePhoto = isMe ? (profile?.photoURL || null) : photo;
  const src = activePhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid || 'default'}`;
  const activeLevel = forceLevel !== undefined ? forceLevel : (isMe ? (profile?.level || 1) : userLevel);

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
