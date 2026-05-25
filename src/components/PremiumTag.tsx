import React, { useState, useEffect } from 'react';
import { Crown, Shield } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface PremiumTagProps {
  email?: string | null;
  role?: 'user' | 'admin' | string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showFallback?: boolean;
}

const SUPER_ADMINS = ['josivanlopes071@gmail.com', 'manoeldasilva631kejr@gmail.com'];

const emailCache: { [uid: string]: string } = {};
const roleCache: { [uid: string]: string } = {};

export function UserPremiumTag({ uid, size = 'xs', className = '' }: { uid?: string | null; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }) {
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setEmail(null);
      setRole(null);
      return;
    }
    if (emailCache[uid] !== undefined) {
      setEmail(emailCache[uid]);
      setRole(roleCache[uid]);
      return;
    }

    const userRef = doc(db, 'users', uid);
    getDoc(userRef).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        const userEmail = data.email || '';
        const userRole = data.role || 'user';
        emailCache[uid] = userEmail;
        roleCache[uid] = userRole;
        setEmail(userEmail);
        setRole(userRole);
      } else {
        emailCache[uid] = '';
        roleCache[uid] = 'user';
        setEmail('');
        setRole('user');
      }
    }).catch(err => {
      console.warn("Error fetching premium details for tagging:", err);
    });
  }, [uid]);

  if (!uid || !email) return null;
  return <PremiumTag email={email} role={role} size={size} className={className} />;
}

export default function PremiumTag({ email, role, size = 'sm', className = '', showFallback = false }: PremiumTagProps) {
  const normEmail = (email || '').trim().toLowerCase();
  const isOwner = SUPER_ADMINS.includes(normEmail);
  const isAdmin = role === 'admin' && !isOwner;

  if (!isOwner && !isAdmin) {
    if (showFallback) {
      return (
        <span className={`inline-flex items-center gap-1.5 font-bold tracking-widest uppercase rounded-full bg-zinc-900 border border-white/5 text-[9px] text-white/40 px-2 py-0.5 ${className}`}>
          Membro
        </span>
      );
    }
    return null;
  }

  // Dimensions setup
  const sizeMap = {
    xs: {
      tag: 'h-4 px-1.5 rounded-md text-[7px] gap-0.5 tracking-[0.1em]',
      icon: 8,
    },
    sm: {
      tag: 'h-5 px-2 rounded-lg text-[8px] gap-1 tracking-[0.12em]',
      icon: 10,
    },
    md: {
      tag: 'h-6.5 px-3 rounded-xl text-[10px] gap-1.5 tracking-[0.18em]',
      icon: 12,
    },
    lg: {
      tag: 'h-8 px-4 rounded-2xl text-[11px] gap-2 tracking-[0.2em] font-black',
      icon: 14,
    },
  };

  const currentSize = sizeMap[size] || sizeMap.sm;

  if (isOwner) {
    return (
      <span
        id="premium-tag-owner"
        className={`inline-flex items-center justify-center font-black uppercase select-none weplay-tag-dono weplay-tag-shine border text-[#EA580C] italic shadow-[0_0_15px_rgba(234,88,12,0.3)] ${currentSize.tag} ${className}`}
      >
        <Crown 
          size={currentSize.icon} 
          className="text-[#EAB308] animate-pulse drop-shadow-[0_0_5px_rgba(234,179,8,0.8)] shrink-0" 
        />
        <span className="bg-gradient-to-r from-yellow-400 via-orange-400 to-[#F43F5E] bg-clip-text text-transparent">
          Dono
        </span>
      </span>
    );
  }

  // Admin tag
  return (
    <span
      id="premium-tag-admin"
      className={`inline-flex items-center justify-center font-black uppercase select-none weplay-tag-adm weplay-tag-shine border text-red-500 italic shadow-[0_0_15px_rgba(239,68,68,0.3)] ${currentSize.tag} ${className}`}
    >
      <Shield 
        size={currentSize.icon} 
        className="text-[#FF4D9D] animate-pulse drop-shadow-[0_0_5px_rgba(255,77,157,0.8)] shrink-0" 
      />
      <span className="bg-gradient-to-r from-[#FF4D9D] via-[#EC4899] to-[#8A2EFF] bg-clip-text text-transparent">
        Adm
      </span>
    </span>
  );
}
