import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Users, ArrowRight, Loader2, UserMinus, UserPlus } from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import UserAvatar from './UserAvatar';
import { useNavigate } from 'react-router-dom';

interface NetworkDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  initialTab?: 'followers' | 'following';
}

export default function NetworkDrawer({ isOpen, onClose, userId, initialTab = 'followers' }: NetworkDrawerProps) {
  const { user, profile: myProfile, followUser } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab);
  const [listUsers, setListUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetProfile, setTargetProfile] = useState<any>(null);

  // Fetch the target user profile to get list of follower/following IDs
  useEffect(() => {
    if (!userId || !isOpen) return;
    const fetchTargetData = async () => {
      setLoading(true);
      try {
        const userRef = doc(db, 'users', userId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          setTargetProfile({ ...snap.data(), uid: snap.id });
        }
      } catch (err) {
        console.warn("Could not fetch user profile for network:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTargetData();
  }, [userId, isOpen]);

  // Sync tab with initialTab prop when it opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Fetch users details in list
  useEffect(() => {
    if (!isOpen || !targetProfile) return;

    const uids = activeTab === 'followers' 
      ? (targetProfile.followers || []) 
      : (targetProfile.following || []);

    if (uids.length === 0) {
      setListUsers([]);
      return;
    }

    const fetchListUsers = async () => {
      setLoading(true);
      try {
        // Chunk queries of 10 if UIDs are many, or just query in chunks for safety
        const userDetails: any[] = [];
        const chunkSize = 10;
        
        for (let i = 0; i < uids.length; i += chunkSize) {
          const chunk = uids.slice(i, i + chunkSize);
          const q = query(collection(db, 'users'), where('uid', 'in', chunk));
          const snap = await getDocs(q);
          snap.docs.forEach((d) => {
            userDetails.push({ ...d.data(), uid: d.id });
          });
        }
        
        setListUsers(userDetails);
      } catch (err) {
        console.warn("Could not retrieve network users details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchListUsers();
  }, [activeTab, targetProfile, isOpen]);

  const handleActionFollow = async (e: React.MouseEvent, targetId: string) => {
    e.stopPropagation(); // prevent navigation on click
    try {
      await followUser(targetId);
      // Update local targetProfile dynamically to reflect follow change if user is viewing their own or someone's network
      if (userId === user?.uid) {
        setTargetProfile((prev: any) => {
          if (!prev) return prev;
          const following = prev.following || [];
          if (following.includes(targetId)) {
            return { ...prev, following: following.filter((id: string) => id !== targetId) };
          } else {
            return { ...prev, following: [...following, targetId] };
          }
        });
      }
    } catch (err) {
      console.warn("Follow error:", err);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[60]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 180 }}
            className="fixed inset-x-0 bottom-0 bg-[#0a0a0a] rounded-t-[40px] border-t border-white/5 p-6 z-[70] pb-12 shadow-2xl h-[80vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-purple-400 uppercase tracking-[0.25em] italic">Rede do Clã</span>
                <h3 className="text-2xl font-black text-white leading-tight uppercase tracking-tight italic flex items-center gap-2">
                  <Users size={22} className="text-purple-400 animate-pulse" /> CONEXÕES WEAURA
                </h3>
              </div>
              <button 
                onClick={onClose} 
                className="p-2.5 bg-white/5 rounded-2xl text-white/30 hover:text-white transition-all hover:scale-105"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tab navigation */}
            <div className="grid grid-cols-2 p-1.5 bg-black rounded-[24px] border border-white/10 mb-6 font-sans">
              <button
                onClick={() => setActiveTab('followers')}
                className={`py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'followers' 
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' 
                    : 'text-white/40 hover:text-white/80'
                }`}
              >
                Seguidores ({targetProfile?.followers?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('following')}
                className={`py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'following' 
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' 
                    : 'text-white/40 hover:text-white/80'
                }`}
              >
                Seguindo ({targetProfile?.following?.length || 0})
              </button>
            </div>

            {/* List users */}
            {loading ? (
              <div className="py-20 flex justify-center"><Loader2 size={36} className="animate-spin text-purple-500" /></div>
            ) : listUsers.length === 0 ? (
              <div className="text-center py-20 bg-white/[0.01] rounded-[36px] border border-dashed border-white/5 p-8">
                <span className="text-sm font-semibold text-zinc-500 block">Ninguém por aqui ainda</span>
                <span className="text-[10px] text-zinc-600 font-bold block mt-2 uppercase tracking-wider">
                  {activeTab === 'followers' ? 'Consiga seguidores compartilhando pontos de Aura e jogando!' : 'Comece a seguir outros influenciadores para atualizar este feed!'}
                </span>
              </div>
            ) : (
              <div className="space-y-4">
                {listUsers.map((item) => {
                  const isMe = item.uid === user?.uid;
                  const alreadyFollowing = myProfile?.following?.includes(item.uid);
                  
                  return (
                    <div
                      key={item.uid}
                      onClick={() => {
                        navigate(`/profile/${item.uid}`);
                        onClose();
                      }}
                      className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 hover:border-purple-500/30 transition-all rounded-[28px] cursor-pointer group"
                    >
                      <div className="flex items-center gap-4">
                        <UserAvatar uid={item.uid} className="w-12 h-12" />
                        <div>
                          <h4 className="text-sm font-black text-white uppercase group-hover:text-purple-400 transition-colors flex items-center gap-1.5">
                            {item.displayName}
                            {isMe && <span className="text-[8px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded uppercase font-bold italic">Você</span>}
                          </h4>
                          <span className="text-[9px] font-mono text-purple-400/60 uppercase tracking-widest mt-1 block">
                            Aura ✨ {(item.aura || 0).toLocaleString()} • Lvl {item.level || 1}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {!isMe && (
                          <button
                            onClick={(e) => handleActionFollow(e, item.uid)}
                            className={`px-4 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                              alreadyFollowing
                                ? 'bg-zinc-900 border border-white/5 text-white/40 hover:text-red-400'
                                : 'bg-white text-black hover:bg-neutral-200'
                            }`}
                          >
                            {alreadyFollowing ? 'Seguindo' : 'Seguir'}
                          </button>
                        )}
                        <div className="p-2.5 bg-white/5 rounded-xl group-hover:bg-purple-600/10 group-hover:text-purple-400 transition-all">
                          <ArrowRight size={14} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
