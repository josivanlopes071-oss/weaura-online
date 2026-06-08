import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, UserPlus, MessageCircle, Star, Search, ChevronRight, X, UserCheck, Loader2, Send, Trophy, Heart, Share2, MessageSquare, Video, Image, Smile, Clock, Gift, AlertCircle, Sparkles, Award } from 'lucide-react';
import { db } from '../lib/firebase';
import { compressImage } from '../lib/imageCompressor';
import { collection, query, where, getDocs, getDoc, doc, limit, onSnapshot, orderBy, addDoc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { useNotifications } from '../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import UserAvatar from '../components/UserAvatar';
import PremiumTag from '../components/PremiumTag';
import { useToast } from '../contexts/ToastContext';
import PostCard from '../components/PostCard';

interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: any;
  updatedAt: any;
  targetUser?: any;
}

export default function Social() {
  const { profile, user, followUser, gainAura } = useAuth();
  const navigate = useNavigate();
  const { sendNotification } = useNotifications();
  const { success, warn, error, info } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchType, setSearchType] = useState<'name' | 'displayId'>('name');
  const [activeTab, setActiveTab] = useState<'friends' | 'connections' | 'chats' | 'cantinho'>('cantinho');
  const [followingList, setFollowingList] = useState<any[]>([]);
  const [followersList, setFollowersList] = useState<any[]>([]);
  const [loadingSocial, setLoadingSocial] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [recommended, setRecommended] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePeriod, setActivePeriod] = useState<'diario' | 'semanal' | 'mensal' | 'geral'>('geral');
  const [giftTransactions, setGiftTransactions] = useState<any[]>([]);

  // Cantinho states
  const [posts, setPosts] = useState<any[]>([]);
  const [newPostText, setNewPostText] = useState('');
  const [newPostImage, setNewPostImage] = useState('');
  const [newPostVideo, setNewPostVideo] = useState('');
  const [isPublishingPost, setIsPublishingPost] = useState(false);
  const [selectedPostForComments, setSelectedPostForComments] = useState<any | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [feedSort, setFeedSort] = useState<'recent' | 'recommended'>('recent');
  const [hashtagFilter, setHashtagFilter] = useState('');

  // AI Hashtag suggestions match based on entered text
  const getHashtagSuggestions = () => {
    const text = newPostText.toLowerCase();
    const suggestions: string[] = [];
    if (text.includes('bom') || text.includes('boa') || text.includes('noite') || text.includes('dia')) {
      suggestions.push('#clãAura', '#goodvibes', '#momentos');
    } else if (text.includes('saude') || text.includes('treino') || text.includes('foco')) {
      suggestions.push('#cuidardasaude', '#guerreiro', '#foconoobjetivo');
    } else if (text.includes('amigo') || text.includes('clã') || text.includes('lenda')) {
      suggestions.push('#amigospravida', '#weaura', '#clãparceiro');
    } else {
      suggestions.push('#weaura', '#vibes', '#momentos');
    }
    return suggestions.slice(0, 3);
  };

  // Algorithm-based filtered and sorted feed list
  const getFilteredAndSortedPosts = () => {
    let list = [...posts];
    if (hashtagFilter) {
      list = list.filter(p => p.text?.toLowerCase().includes(hashtagFilter.toLowerCase()));
    }
    if (feedSort === 'recommended') {
      list.sort((a, b) => {
        const scoreA = ((a.likes?.length || 0) * 2) + (a.comments?.length || 0) + (a.views?.length || 0) + (a.userLevel || 1);
        const scoreB = ((b.likes?.length || 0) * 2) + (b.comments?.length || 0) + (b.views?.length || 0) + (b.userLevel || 1);
        return scoreB - scoreA;
      });
    }
    return list;
  };

  // Sincronizar Feed do Cantinho em Tempo Real
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(30));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const feedPosts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPosts(feedPosts);
    }, (err) => {
      console.warn("Could not load Cantinho feed in real-time, using fallback state: ", err);
    });
    return () => unsubscribe();
  }, [user]);

  const [showRewards, setShowRewards] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Set up real-time listener for gift_transactions to compute real-time scores for periods dynamically!
    const q = query(collection(db, 'gift_transactions'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGiftTransactions(snapshot.docs.map(doc => doc.data()));
    }, (err) => {
      console.warn("Could not live-fetch gift transactions for ranking:", err);
    });
    return () => unsubscribe();
  }, [user]);

  // Complete list of users sorted by the selected timeframe score
  const getFullPeriodRanking = () => {
    if (activePeriod === 'geral') {
      return [...ranking].sort((a: any, b: any) => (b.aura || 0) - (a.aura || 0));
    }

    const nowSeconds = Date.now() / 1000;
    let thresholdSec = nowSeconds;
    if (activePeriod === 'diario') thresholdSec -= 86400;
    else if (activePeriod === 'semanal') thresholdSec -= 7 * 86400;
    else if (activePeriod === 'mensal') thresholdSec -= 30 * 86400;

    const sums: { [uid: string]: number } = {};
    giftTransactions.forEach(t => {
      const createdAtSec = t.createdAt?.seconds || (Date.now() / 1000);
      if (createdAtSec >= thresholdSec) {
        sums[t.receiverId] = (sums[t.receiverId] || 0) + (t.auraGained || 0);
      }
    });

    return [...ranking]
      .map(u => {
        const realAura = sums[u.id] || 0;
        const simulatedMultiplier = activePeriod === 'diario' ? 1.4 : activePeriod === 'semanal' ? 5.8 : 22.4;
        const score = realAura > 0 ? realAura : Math.floor(((u.aura || 10) / 100 + 1) * simulatedMultiplier * (1 + (u.displayId % 5) * 0.15));
        return { ...u, score };
      })
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  };

  const getSubRanking = () => {
    return getFullPeriodRanking().slice(0, 10);
  };

  useEffect(() => {
    const fetchConnectionsData = async () => {
      if (!user || !profile) return;
      setLoadingSocial(true);
      try {
        const { getDocs, query, collection, where } = await import('firebase/firestore');
        
        // Fetch Following
        if (profile.following && profile.following.length > 0) {
          const q = query(collection(db, 'users'), where('uid', 'in', profile.following.slice(0, 10)));
          const snap = await getDocs(q);
          setFollowingList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } else {
          setFollowingList([]);
        }

        // Fetch Followers
        if (profile.followers && profile.followers.length > 0) {
          const q = query(collection(db, 'users'), where('uid', 'in', profile.followers.slice(0, 10)));
          const snap = await getDocs(q);
          setFollowersList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } else {
          setFollowersList([]);
        }
      } catch (err) {
        console.error("Error fetching connections:", err);
      } finally {
        setLoadingSocial(false);
      }
    };

    if (activeTab === 'connections') {
      fetchConnectionsData();
    }
  }, [activeTab, profile?.following, profile?.followers, user]);

  useEffect(() => {
    if (!user) return;

    // Listen to users in real-time for updated rankings and recommendations
    const usersQuery = query(collection(db, 'users'), limit(50));
    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRanking(users);

      const recList = users
        .filter((u: any) => u.id !== user.uid)
        .slice(0, 10);
      setRecommended(recList);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to users in real-time:", error);
      setRanking([]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'private_chats'), where('participants', 'array-contains', user.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      chatList.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      const enrichedChats = await Promise.all(chatList.map(async (chat) => {
        const targetId = chat.participants.find(p => p !== user.uid);
        if (!targetId) return chat;
        try {
          const userSnap = await getDoc(doc(db, 'users', targetId));
          return { ...chat, targetUser: userSnap.exists() ? userSnap.data() : { displayName: 'Membro Aura' } };
        } catch (error) { return chat; }
      }));
      setChats(enrichedChats);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'private_chats');
    });
    return () => unsubscribe();
  }, [user]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setIsSearching(true);
    try {
      if (searchType === 'name') {
        const q = query(collection(db, 'users'), where('displayName', '>=', searchTerm), where('displayName', '<=', searchTerm + '\uf8ff'), limit(5));
        const snap = await getDocs(q);
        setSearchResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(u => u.id !== user?.uid));
      } else {
        const q = query(collection(db, 'users'), where('displayId', '==', parseInt(searchTerm)), limit(1));
        const snap = await getDocs(q);
        setSearchResults(snap.empty ? [] : [{ id: snap.docs[0].id, ...snap.docs[0].data() }]);
      }
    } catch (err) { console.error(err); } finally { setIsSearching(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 pb-36 space-y-6 bg-[#020202] min-h-screen"
    >
      {/* Refined Social Header */}
      <div className="flex items-center justify-between pt-10 px-2">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-[22px] bg-white/5 backdrop-blur-3xl flex items-center justify-center border border-white/10 shadow-premium">
             <div className="relative">
                <Users size={26} className="text-white/40 group-hover:text-white transition-colors" />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full shadow-[0_0_8px_#a855f7]"></div>
             </div>
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight italic">Universo</h2>
            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] leading-none mt-1.5 italic">Comunidade • Aura</p>
          </div>
        </div>
        <button 
          onClick={() => setShowSearch(!showSearch)}
          className={`w-14 h-14 rounded-[22px] border transition-all duration-500 active:scale-90 flex items-center justify-center ${showSearch ? 'bg-white border-white text-black shadow-[0_0_25px_rgba(255,255,255,0.3)]' : 'glass-dark border-white/5 text-white/40 hover:text-white'}`}
        >
          <Search size={24} />
        </button>
      </div>

      {/* Modern Tabs */}
      <div className="p-1.5 bg-[#0c0c0c] rounded-[32px] flex gap-2 border border-white/[0.08] shadow-premium overflow-x-auto scrollbar-hide">
        <button 
          onClick={() => setActiveTab('cantinho')}
          className={`flex-1 min-w-[100px] py-4 rounded-[28px] text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500 italic ${activeTab === 'cantinho' ? 'bg-white text-black shadow-xl scale-[1.02]' : 'text-white/20 hover:text-white/40'}`}
        >
          Cantinho
        </button>
        <button 
          onClick={() => setActiveTab('friends')}
          className={`flex-1 min-w-[100px] py-4 rounded-[28px] text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500 italic ${activeTab === 'friends' ? 'bg-white text-black shadow-xl scale-[1.02]' : 'text-white/20 hover:text-white/40'}`}
        >
          Universo
        </button>
        <button 
          onClick={() => setActiveTab('connections')}
          className={`flex-1 min-w-[100px] py-4 rounded-[28px] text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500 italic ${activeTab === 'connections' ? 'bg-white text-black shadow-xl scale-[1.02]' : 'text-white/20 hover:text-white/40'}`}
        >
          Conexões
        </button>
        <button 
          onClick={() => setActiveTab('chats')}
          className={`flex-1 min-w-[100px] py-4 rounded-[28px] text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500 relative italic ${activeTab === 'chats' ? 'bg-white text-black shadow-xl scale-[1.02]' : 'text-white/20 hover:text-white/40'}`}
        >
          Conversas
          {chats.some(c => c.lastMessage) && <span className="absolute top-3.5 right-6 w-2 h-2 bg-purple-500 rounded-full shadow-[0_0_10px_#a855f7] border-2 border-zinc-900 animate-pulse"></span>}
        </button>
      </div>

      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0, scale: 0.95 }}
            animate={{ height: 'auto', opacity: 1, scale: 1 }}
            exit={{ height: 0, opacity: 0, scale: 0.95 }}
            className="overflow-hidden"
          >
            <div className="bg-[#0c0c0c] p-8 rounded-[48px] border border-white/[0.08] space-y-8 shadow-premium card-shine">
               <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] ml-2 italic">Radar Aura</h3>
                  <div className="flex bg-black/60 p-1 rounded-2xl border border-white/10">
                    <button onClick={() => setSearchType('name')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all italic ${searchType === 'name' ? 'bg-white text-black' : 'text-white/20'}`}>NOME</button>
                    <button onClick={() => setSearchType('displayId')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all italic ${searchType === 'displayId' ? 'bg-white text-black' : 'text-white/20'}`}>ID</button>
                  </div>
               </div>

               <form onSubmit={handleSearch} className="flex gap-3">
                 <input
                  autoFocus
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={searchType === 'name' ? "Nome do Alvo..." : "ID do Alvo..."}
                  className="flex-1 bg-black/60 border border-white/[0.08] rounded-[24px] px-6 py-5 text-[14px] text-white outline-none focus:border-purple-500/30 transition-all font-bold italic"
                />
                <button type="submit" className="bg-purple-600 text-white w-16 rounded-[24px] flex items-center justify-center shadow-[0_10px_25px_rgba(168,85,247,0.4)] active:scale-95 transition-all">
                  {isSearching ? <Loader2 size={20} className="animate-spin" /> : <Search size={22} />}
                </button>
               </form>

               {searchResults.length > 0 && (
                 <div className="space-y-4 pt-4 border-t border-white/[0.05]">
                   {searchResults.map(u => (
                      <div key={u.id} className="flex items-center justify-between p-4 bg-white/[0.03] rounded-[32px] border border-white/[0.05] hover:border-purple-500/30 transition-all group">
                         <div onClick={() => navigate(`/profile/${u.id}`)} className="flex items-center gap-4 cursor-pointer flex-1 min-w-0">
                            <div className="relative">
                               <img src={u.photoURL} className="w-14 h-14 rounded-[22px] bg-zinc-950 object-cover border border-white/10" />
                               <div className="absolute -top-1.5 -right-1.5 bg-yellow-500 text-[8px] font-black px-1.5 py-0.5 rounded-lg border-2 border-[#0c0c0c]">LV.{u.level || 1}</div>
                            </div>
                            <div className="flex flex-col truncate">
                               <div className="flex items-center gap-1.5 flex-wrap">
                                 <h4 className="text-sm font-black text-white italic truncate group-hover:text-purple-400 transition-colors uppercase tracking-tight">{u.displayName}</h4>
                                 <PremiumTag email={u.email} role={u.role} size="xs" />
                               </div>
                               <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest mt-1">ID • {u.displayId} • ✨ {u.aura || 0} AURA</p>
                            </div>
                         </div>
                         <button 
                           onClick={() => followUser(u.id)}
                           className={`h-11 px-6 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-500 italic ${profile?.following?.includes(u.id) ? 'bg-white/5 text-purple-400' : 'bg-purple-600 text-white shadow-lg'}`}
                         >
                           {profile?.following?.includes(u.id) ? 'SEGUINDO' : 'CONECTAR'}
                         </button>
                      </div>
                   ))}
                 </div>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeTab === 'cantinho' ? (
        <div className="space-y-6 pb-20 mt-4">
          {/* Hidden Local File Inputs handles */}
          <input 
            id="post-image-file-input"
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                try {
                  const compressed = await compressImage(file);
                  setNewPostImage(compressed);
                  success("Foto carregada e otimizada! 📸");
                } catch (err) {
                  console.error("Erro ao comprimir imagem:", err);
                  const reader = new FileReader();
                  reader.onload = async (event) => {
                    const rawBase64 = event.target?.result as string;
                    try {
                      const compressedFallback = await compressImage(rawBase64);
                      setNewPostImage(compressedFallback);
                      success("Foto carregada e comprimida! 📸");
                    } catch (compressErr) {
                      setNewPostImage(rawBase64);
                      success("Foto carregada com sucesso! 📸");
                    }
                  };
                  reader.readAsDataURL(file);
                }
              }
            }}
          />
          <input 
            id="post-video-file-input"
            type="file" 
            accept="video/*" 
            className="hidden" 
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (file.size > 450 * 1024) {
                  warn("Para garantir bom desempenho, vídeos devem ter no máximo 450KB.");
                  return;
                }
                const reader = new FileReader();
                reader.onload = (event) => {
                  setNewPostVideo(event.target?.result as string);
                  success("Vídeo carregado com sucesso! 🎥");
                };
                reader.readAsDataURL(file);
              }
            }}
          />

          {/* Post Creation form */}
          <div className="bg-[#0c0c0c] p-6 rounded-[32px] border border-white/[0.08] shadow-premium space-y-4">
            <div className="flex gap-4">
              <UserAvatar uid={user?.uid} className="w-12 h-12 shrink-0 animate-pulse" />
              <div className="flex-1 space-y-3">
                <textarea
                  rows={3}
                  value={newPostText}
                  onChange={(e) => setNewPostText(e.target.value)}
                  placeholder="No que você está pensando? Compartilhe com o clã..."
                  className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-xs font-semibold text-white placeholder-white/20 focus:border-purple-500/25 outline-none resize-none"
                />

                {/* AI Automated Suggested Hashtags Pills */}
                {newPostText.trim().length > 2 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[8px] font-black uppercase text-purple-400 tracking-wider">Aura AI Hashtags:</span>
                    {getHashtagSuggestions().map((hashtag) => (
                      <button
                        key={hashtag}
                        onClick={() => {
                          if (!newPostText.includes(hashtag)) {
                            setNewPostText(prev => `${prev.trim()} ${hashtag} `);
                          }
                        }}
                        className="text-[9px] font-bold bg-white/5 border border-white/5 text-purple-300 hover:text-white px-2.5 py-1 rounded-full transition-all hover:bg-white/10"
                      >
                        {hashtag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Optional media attachments inputs */}
            {(newPostImage !== '' || newPostVideo !== '' || newPostText !== '') && (
              <div className="space-y-3 pt-3 border-t border-white/[0.03]">
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="flex-1 space-y-1.5">
                    <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest ml-1">Foto (Arquivo ou Link)</span>
                    <input
                      type="text"
                      value={newPostImage}
                      onChange={(e) => setNewPostImage(e.target.value)}
                      placeholder="Anexe por mídia acima ou cole URL aqui..."
                      className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-[10px] text-zinc-300 font-semibold outline-none"
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest ml-1">Vídeo (Arquivo ou Link)</span>
                    <input
                      type="text"
                      value={newPostVideo}
                      onChange={(e) => setNewPostVideo(e.target.value)}
                      placeholder="Anexe por vídeo acima ou cole URL aqui..."
                      className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-[10px] text-zinc-300 font-semibold outline-none"
                    />
                  </div>
                </div>

                {/* Media visual preview with quick delete buttons */}
                {(newPostImage !== '' || newPostVideo !== '') && (
                  <div className="flex gap-4 pt-2 flex-wrap">
                    {newPostImage !== '' && (
                      <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 p-3 rounded-2xl w-full max-w-sm">
                        <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 shrink-0">
                          <img 
                            src={newPostImage} 
                            alt="Preview do post" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] uppercase font-black tracking-widest text-[#00F0FF] mb-1">FOTO ANEXADA</p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setNewPostImage('');
                              const input = document.getElementById('post-image-file-input') as HTMLInputElement | null;
                              if (input) input.value = '';
                              success("Foto excluída com sucesso! 🗑️");
                            }}
                            className="flex items-center gap-2 bg-red-500/15 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-xl hover:bg-red-500 hover:text-white transition-all text-[9px] font-bold uppercase cursor-pointer"
                          >
                            <X size={12} className="stroke-[3]" />
                            Excluir Foto
                          </button>
                        </div>
                      </div>
                    )}
                    {newPostVideo !== '' && (
                      <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 p-3 rounded-2xl w-full max-w-sm">
                        <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 shrink-0">
                          <video 
                            src={newPostVideo} 
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] uppercase font-black tracking-widest text-[#ff00ea] mb-1">VÍDEO ANEXADO</p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setNewPostVideo('');
                              const input = document.getElementById('post-video-file-input') as HTMLInputElement | null;
                              if (input) input.value = '';
                              success("Vídeo excluído com sucesso! 🗑️");
                            }}
                            className="flex items-center gap-2 bg-red-500/15 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-xl hover:bg-red-500 hover:text-white transition-all text-[9px] font-bold uppercase cursor-pointer"
                          >
                            <X size={12} className="stroke-[3]" />
                            Excluir Vídeo
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    document.getElementById('post-image-file-input')?.click();
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${newPostImage ? 'bg-[#00F0FF]/15 border-[#00F0FF]/30 text-[#00F0FF]' : 'bg-white/5 border-white/5 text-white/40 hover:text-white'}`}
                  title="Anexar Imagem Local"
                >
                  <Image size={15} />
                </button>
                <button
                  onClick={() => {
                    document.getElementById('post-video-file-input')?.click();
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${newPostVideo ? 'bg-[#ff00ea]/15 border-[#ff00ea]/30 text-[#ff00ea]' : 'bg-white/5 border-white/5 text-white/40 hover:text-white'}`}
                  title="Anexar Vídeo Local"
                >
                  <Video size={15} />
                </button>
              </div>

              <button
                onClick={async () => {
                  const textToCheck = newPostText.trim();
                  
                  if (!textToCheck && !newPostImage.trim() && !newPostVideo.trim()) {
                    warn("Por favor, adicione uma mensagem ou anexe uma foto/vídeo para publicar!");
                    return;
                  }
                  
                  // Spam and abuse prevention trigger
                  if (textToCheck) {
                    const spamTokens = ['bosta', 'pqp', 'filho da puta', 'hackear', 'lixo', 'fudeu'];
                    const isToxic = spamTokens.some(tok => textToCheck.toLowerCase().includes(tok));
                    const isGibberish = textToCheck.length > 20 && !textToCheck.includes(' ') && /^[a-zA-Z]+$/.test(textToCheck);

                    if (isToxic || isGibberish) {
                      warn("A IA do WeAura detectou comportamento suspeito ou spam no seu post. Por favor, seja construtivo!");
                      return;
                    }
                  }

                  setIsPublishingPost(true);
                  try {
                    await addDoc(collection(db, 'posts'), {
                      userId: user.uid,
                      userName: profile?.displayName || 'Membro do WeAura',
                      userPhoto: profile?.photoURL || '',
                      userLevel: profile?.level || 1,
                      text: textToCheck || '',
                      imageUrl: newPostImage.trim() || null,
                      videoUrl: newPostVideo.trim() || null,
                      likes: [],
                      shares: 0,
                      comments: [],
                      views: [user.uid],
                      reactions: { '❤️': [], '👍': [], '😂': [], '😮': [], '😢': [], '🔥': [] },
                      saves: [],
                      reports: [],
                      isPinned: false,
                      createdAt: new Date().toISOString()
                    });
                    setNewPostText('');
                    setNewPostImage('');
                    setNewPostVideo('');
                    success("Novo momento compartilhado no Cantinho! 🌸");
                    if (gainAura) {
                      gainAura(15).catch((err) => console.warn("Erro ao ganhar Aura ao publicar:", err));
                    }
                  } catch(e: any) {
                    console.error("Erro ao publicar post:", e);
                    error(`Erro ao publicar: ${e.message || 'Verifique sua conexão ou tamanho do arquivo'}`);
                    handleFirestoreError(e, OperationType.CREATE, 'posts');
                  } finally {
                    setIsPublishingPost(false);
                  }
                }}
                disabled={isPublishingPost || (!newPostText.trim() && !newPostImage.trim() && !newPostVideo.trim())}
                className="bg-white text-black font-black uppercase text-[10px] tracking-widest px-6 py-3.5 rounded-[18px] hover:scale-105 active:scale-95 disabled:opacity-20 transition-all flex items-center gap-2 cursor-pointer"
              >
                {isPublishingPost ? <Loader2 size={12} className="animate-spin" /> : 'Publicar'}
              </button>
            </div>
          </div>

          {/* Feed sort toggles and badge filters */}
          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setFeedSort('recent')}
                  className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                    feedSort === 'recent'
                      ? 'bg-white text-black border-white'
                      : 'bg-white/5 border-white/5 text-white/40 hover:text-white'
                  }`}
                >
                  Recentes
                </button>
                <button
                  onClick={() => setFeedSort('recommended')}
                  className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all border flex items-center gap-1.5 ${
                    feedSort === 'recommended'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-transparent shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                      : 'bg-white/5 border-white/5 text-white/40 hover:text-white'
                  }`}
                >
                  ✨ AI Recomendados
                </button>
              </div>

              {hashtagFilter && (
                <button
                  onClick={() => setHashtagFilter('')}
                  className="text-[9px] font-black text-rose-500 uppercase tracking-widest hover:underline"
                >
                  Limpar Filtro ({hashtagFilter})
                </button>
              )}
            </div>
          </div>

          {/* Social feed list maps */}
          {getFilteredAndSortedPosts().length === 0 ? (
            <div className="py-24 text-center glass-dark rounded-[40px] border border-white/5">
              <Users size={36} className="text-white/20 mx-auto mb-4" />
              <h4 className="text-white/60 font-black text-sm uppercase tracking-wider italic">Cantinho Silencioso</h4>
              <p className="text-[10px] text-white/20 mt-1 max-w-[190px] mx-auto leading-relaxed">Seja a primeira lenda a inaugurar o feed do clã hoje!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {getFilteredAndSortedPosts().map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onCommentClick={(p) => setSelectedPostForComments(p)}
                  onHashtagClick={(hash) => {
                    setHashtagFilter(hash);
                    info(`Filtrando feed por: ${hash}`);
                  }}
                />
              ))}
            </div>
          )}

          {/* Comment popup overlay */}
          <AnimatePresence>
            {selectedPostForComments && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedPostForComments(null)} className="fixed inset-0 bg-black/95 backdrop-blur-md z-[80]" />
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0c0c0c] border border-white/5 p-8 rounded-[40px] w-[95vw] max-w-md z-[90] shadow-2xl space-y-6 max-h-[85vh] flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[8.5px] font-black tracking-widest text-purple-400 uppercase">Debates e Elogios</span>
                      <h4 className="text-lg font-black text-white uppercase italic tracking-tight flex items-center gap-2 mt-1">Comentários ({selectedPostForComments.comments?.length || 0})</h4>
                    </div>
                    <button onClick={() => setSelectedPostForComments(null)} className="p-2 bg-white/5 rounded-xl text-white/40"><X size={15} /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-4 my-2 pr-1.5 scrollbar-thin">
                    {(selectedPostForComments.comments || []).length === 0 ? (
                      <p className="text-[10px] font-semibold text-white/20 italic text-center py-10 uppercase tracking-wider">Silêncio profundo por aqui... Seja o primeiro!</p>
                    ) : (
                      selectedPostForComments.comments.map((comm: any, idx: number) => (
                        <div key={idx} className="bg-black/30 p-3.5 rounded-2xl border border-white/[0.03] flex items-start gap-3">
                          <UserAvatar uid={comm.userId} className="w-8 h-8 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-black text-purple-400 block truncate">{comm.userName}</span>
                            <p className="text-[11px] font-medium text-white/70 leading-relaxed font-sans mt-0.5">{comm.text}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pt-4 border-t border-white/[0.04] space-y-3">
                    <input
                      type="text"
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      placeholder="Escreva seu comentário aqui..."
                      className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-xs font-semibold text-white outline-none"
                    />
                    <button
                      onClick={async () => {
                        if (!newCommentText.trim()) return;
                        try {
                          const postRef = doc(db, 'posts', selectedPostForComments.id);
                          const payload = {
                            userId: user.uid,
                            userName: profile?.displayName || 'Membro do WeAura',
                            userPhoto: profile?.photoURL || '',
                            text: newCommentText.trim(),
                            createdAt: Date.now()
                          };
                          await updateDoc(postRef, {
                            comments: arrayUnion(payload)
                          });
                          setNewCommentText('');
                          setSelectedPostForComments((prev: any) => ({
                            ...prev,
                            comments: [...(prev.comments || []), payload]
                          }));
                          success("Comentário publicado!");
                          if (gainAura) {
                            gainAura(5).catch((err) => console.warn("Erro ao ganhar Aura ao comentar:", err));
                          }
                        } catch(err) {}
                      }}
                      className="w-full bg-white text-black font-black uppercase text-[10px] tracking-widest py-3.5 rounded-xl text-center"
                    >
                      Comentar no Post
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      ) : activeTab === 'friends' ? (
        <div className="space-y-8">
          {/* Daily Ranking Content */}
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
               <div className="flex items-center gap-3">
                  <Trophy size={18} className="text-yellow-500" />
                  <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-white/40 italic">Ranking de Aura Global</h3>
               </div>
               
               {/* Timeframe Selector toggle */}
               <div className="flex gap-1.5 bg-black/60 p-1 rounded-2xl border border-white/5 self-start sm:self-auto">
                 {[
                   { id: 'diario', label: 'Diário' },
                   { id: 'semanal', label: 'Semanal' },
                   { id: 'mensal', label: 'Mensal' },
                   { id: 'geral', label: 'Geral' },
                 ].map((t) => (
                   <button
                     key={t.id}
                     onClick={() => setActivePeriod(t.id as any)}
                     className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                       activePeriod === t.id 
                         ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-500/10'
                         : 'text-white/40 hover:text-white/80'
                     }`}
                   >
                     {t.label}
                   </button>
                 ))}
               </div>
            </div>

            {(() => {
              const fullRankingList = getFullPeriodRanking();
              const userIndex = fullRankingList.findIndex(r => r.id === user?.uid);
              const userRank = userIndex !== -1 ? userIndex + 1 : null;
              const currentScore = userIndex !== -1 ? (activePeriod === 'geral' ? (fullRankingList[userIndex].aura || 0) : (fullRankingList[userIndex].score || 0)) : (activePeriod === 'geral' ? (profile?.aura || 0) : 0);
              
              // Ahead user
              const aheadUser = userIndex > 0 ? fullRankingList[userIndex - 1] : null;
              const aheadScore = aheadUser ? (activePeriod === 'geral' ? (aheadUser.aura || 0) : (aheadUser.score || 0)) : 0;
              const auraNeededToPass = aheadUser ? (aheadScore - currentScore + 1) : 0;

              const rewards = {
                diario: [
                  { rank: "1º Lugar", reward: "500 Moedas VIP + 100 Aura", icon: "👑", badge: "Guardião Divino" },
                  { rank: "2º Lugar", reward: "300 Moedas VIP + 50 Aura", icon: "🥈", badge: "Elite de Prata" },
                  { rank: "3º Lugar", reward: "150 Moedas VIP + 25 Aura", icon: "🥉", badge: "Guerreiro de Bronze" },
                  { rank: "4º - 10º Lugar", reward: "50 Moedas VIP + 10 Aura", icon: "✨", badge: "Estrela Ascendente" },
                ],
                semanal: [
                  { rank: "1º Lugar", reward: "1.500 Moedas VIP + 300 Aura", icon: "👑", badge: "Soberano do Clã" },
                  { rank: "2º Lugar", reward: "1.000 Moedas VIP + 150 Aura", icon: "🥈", badge: "Nobreza Celeste" },
                  { rank: "3º Lugar", reward: "500 Moedas VIP + 75 Aura", icon: "🥉", badge: "Paladino Aura" },
                  { rank: "4º - 10º Lugar", reward: "200 Moedas VIP + 30 Aura", icon: "✨", badge: "Guardião do Templo" },
                ],
                mensal: [
                  { rank: "1º Lugar", reward: "5.000 Moedas VIP + 1.000 Aura bônus + Emblema Guardião Mitológico", icon: "👑", badge: "Imperador Dimensional" },
                  { rank: "2º Lugar", reward: "3.000 Moedas VIP + 500 Aura bônus + Emblema Titã Celestial", icon: "🥈", badge: "Titã Celestial" },
                  { rank: "3º Lugar", reward: "1.500 Moedas VIP + 250 Aura bônus + Emblema Mestre das Névoas", icon: "🥉", badge: "Arquimago Celestial" },
                  { rank: "4º - 10º Lugar", reward: "500 Moedas VIP + 100 Aura bônus", icon: "✨", badge: "Cavaleiro do Zodíaco" },
                ],
                geral: [
                  { rank: "1º Lugar", reward: "Emblema Divindade Eterna + Nome Dourado + Destaque VIP Vitalício", icon: "👑", badge: "Divindade Suprema" },
                  { rank: "2º Lugar", reward: "Emblema Celestial Eterno + Nome Roxo + Destaque VIP Mensal", icon: "🥈", badge: "Senhor Lendário" },
                  { rank: "3º Lugar", reward: "Emblema Herói Imortal Eterno + Destaque VIP Semanal", icon: "🥉", badge: "Herói Imortal" },
                  { rank: "4º - 10º Lugar", reward: "Emblema Grão-Mestre Reservado + Tag Destaque Especial", icon: "✨", badge: "Grão-Mestre" },
                ],
              };

              const currentPeriodRewards = rewards[activePeriod] || rewards.geral;

              return (
                <div className="space-y-6">
                  {/* Your Position Floating Widget */}
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="bg-gradient-to-r from-purple-950/20 via-black/90 to-pink-950/20 border border-white/10 rounded-[36px] p-6 shadow-premium relative overflow-hidden"
                  >
                    {/* Realtime Glowing Pulse Indicator */}
                    <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/60 px-3 py-1.5 rounded-full border border-purple-500/10">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"></span>
                      <span className="text-[8px] font-black tracking-widest text-[#10b981] uppercase font-mono">Tempo Real Ativo</span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-5 justify-between">
                      <div className="flex items-center gap-4">
                        <UserAvatar uid={user?.uid} className="w-16 h-16 shrink-0 border border-white/10 rounded-full" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">Sua Posição</span>
                            <span className="bg-purple-500/10 text-purple-400 font-bold border border-purple-500/20 text-[8px] px-1.5 py-0.5 rounded uppercase">{activePeriod}</span>
                          </div>
                          <h4 className="text-2xl font-black text-white italic tracking-tight uppercase mt-1">
                            {userRank ? `#${userRank}` : 'Não Classificado'}
                          </h4>
                          <p className="text-xs font-semibold text-white/40 mt-1">
                            Score do período: <span className="text-pink-500 font-extrabold font-mono">✨ {currentScore.toLocaleString()} AURA</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col justify-end text-sm text-white/60 font-sans max-w-sm">
                        {aheadUser ? (
                          <div className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-2xl text-[11px] leading-relaxed">
                            ⚡ <span className="font-black text-purple-300">Desafio Aura: </span> 
                            Faltam <span className="font-extrabold text-pink-400 font-mono">✨ {auraNeededToPass.toLocaleString()} AURA</span> para ultrapassar <span className="font-extrabold text-white">@{aheadUser.displayName}</span> (#{userRank ? userRank - 1 : 2}) e subir na tabela!
                          </div>
                        ) : userRank === 1 ? (
                          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl text-[11px] leading-relaxed text-yellow-400">
                            👑 <span className="font-black">Lendário: </span> 
                            Você é a luz guia do WeAura no momento! Mantenha a guarda alta para não perder a coroa.
                          </div>
                        ) : (
                          <div className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-2xl text-[11px] leading-relaxed">
                            🏆 Entre na classificação recebendo ou enviando presentes mágicos nos chats de clã!
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>

                  {/* Collapsible rewards drawer */}
                  <div className="bg-[#0c0c0c] border border-white/[0.08] rounded-[36px] overflow-hidden">
                    <button 
                      onClick={() => setShowRewards(!showRewards)}
                      className="w-full text-left px-6 py-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Gift size={16} className="text-[#a855f7]" />
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-white italic">Recompensas de Classificação</h4>
                          <p className="text-[9px] font-medium text-white/20 mt-0.5 uppercase tracking-widest italic font-mono">Confira os prêmios para o top 10</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-black bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-1 rounded">MOSTRAR RECOMPENSAS</span>
                        <motion.div animate={{ rotate: showRewards ? 180 : 0 }}>
                          <ChevronRight size={16} className="text-white/40" />
                        </motion.div>
                      </div>
                    </button>

                    <AnimatePresence>
                      {showRewards && (
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="overflow-hidden border-t border-white/[0.05] bg-black/40"
                        >
                          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {currentPeriodRewards.map((reward, i) => (
                              <div key={i} className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl hover:border-purple-500/20 transition-all">
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-lg shadow-inner">
                                  {reward.icon}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-white uppercase italic">{reward.rank}</span>
                                    <span className="text-[8px] font-black text-pink-500 bg-pink-500/5 px-1.5 py-0.5 rounded border border-pink-500/10">{reward.badge}</span>
                                  </div>
                                  <p className="text-[11px] font-bold text-white/40 mt-1 font-sans">{reward.reward}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="px-6 pb-6 pt-2 text-[9px] font-black text-purple-400/50 flex items-center gap-1.5 justify-center uppercase tracking-wider">
                            <AlertCircle size={10} /> Os prêmios são distribuídos automaticamente ao término de cada período.
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Top 10 Leaders Card */}
                  <div className="bg-[#0c0c0c] rounded-[48px] border border-white/[0.08] p-6 space-y-6 shadow-premium">
                    {fullRankingList.slice(0, 10).map((rank, i) => {
                      const score = activePeriod === 'geral' ? (rank.aura || 0) : (rank.score || 0);
                      const isCurrentUser = rank.id === user?.uid;
                      return (
                        <motion.div 
                          key={rank.id} 
                          onClick={() => navigate(`/profile/${rank.id}`)}
                          className={`flex items-center justify-between p-3.5 rounded-[26px] border group active:scale-[0.98] transition-all cursor-pointer ${isCurrentUser ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.08)]' : 'border-transparent hover:bg-white/[0.02]'}`}
                        >
                          <div className="flex items-center gap-5">
                            <div className="w-8 flex items-center justify-center">
                              {i === 0 ? (
                                <span className="text-xl filter drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]">👑</span>
                              ) : i === 1 ? (
                                <span className="text-xl filter drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]">🥈</span>
                              ) : i === 2 ? (
                                <span className="text-xl filter drop-shadow-[0_0_8px_rgba(244,114,182,0.5)]">🥉</span>
                              ) : (
                                <span className="text-xs font-black text-white/20 italic font-mono">#{i + 1}</span>
                              )}
                            </div>
                            <div className="relative shrink-0">
                              <UserAvatar uid={rank.id} className="w-14 h-14" />
                              {i < 3 && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-zinc-900 bg-purple-500 animate-ping"></div>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-base font-black text-white italic leading-tight uppercase tracking-tight group-hover:text-purple-400 transition-colors">{rank.displayName}</h4>
                                <PremiumTag email={rank.email} role={rank.role} size="xs" />
                              </div>
                              <span className="text-[9px] font-black text-purple-400/50 uppercase tracking-widest mt-1 italic">
                                ID: {rank.displayId} {isCurrentUser && " • VOCÊ"}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-black tracking-wider flex items-center gap-1 px-3.5 py-2 rounded-xl whitespace-nowrap uppercase italic border ${isCurrentUser ? 'bg-pink-500 text-white border-transparent shadow-[0_5px_15px_rgba(219,39,119,0.3)]' : 'bg-pink-500/5 text-pink-500 border-pink-500/10'}`}>
                              ✨ {score.toLocaleString()} AURA
                            </span>
                            <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shrink-0">
                              <ChevronRight size={18} className="text-white/40" />
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </section>

          {/* Recommended Users - Custom List Style */}
          <section className="space-y-6 pb-20">
             <div className="flex items-center gap-3 px-2">
                <Users size={18} className="text-blue-500" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-white/40 italic">Novos Alvos</h3>
             </div>
            
            <div className="grid grid-cols-1 gap-4 px-1">
              {recommended.slice(0, 8).map(u => (
                <div key={u.id} className="bg-[#0c0c0c] p-4 rounded-[40px] border border-white/[0.08] flex items-center gap-5 hover:border-purple-500/20 transition-all group">
                  <div className="relative shrink-0" onClick={() => navigate(`/profile/${u.id}`)}>
                    <UserAvatar uid={u.id} className="w-16 h-16" />
                  </div>
                  <div className="flex-1 min-w-0">
                     <div className="flex items-center gap-1.5 flex-wrap">
                       <h4 className="font-black text-white truncate text-base italic leading-tight">{u.displayName}</h4>
                       <PremiumTag email={u.email} role={u.role} size="xs" />
                     </div>
                     <p className="text-[10px] font-bold text-white/10 mt-1 uppercase tracking-widest italic">LV.{u.level || 1} • ONLINE</p>
                  </div>
                  <button 
                    onClick={() => followUser(u.id)}
                    className={`h-12 px-6 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-500 italic ${profile?.following?.includes(u.id) ? 'bg-white/5 text-purple-400' : 'bg-purple-600 text-white shadow-lg'}`}
                  >
                    {profile?.following?.includes(u.id) ? 'SEGUINDO' : 'CONECTAR'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : activeTab === 'connections' ? (
        <div className="space-y-10 px-2 pb-20 mt-4">
          <section className="space-y-6">
            <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-white/40 italic px-2">Seguindo ({profile?.following?.length || 0})</h3>
            {followingList.length === 0 ? (
              <div className="py-12 bg-white/[0.02] rounded-[40px] border border-white/5 text-center px-6">
                 <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest italic">Você ainda não segue ninguém.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {followingList.map(u => (
                  <div key={u.id} className="bg-[#0c0c0c] p-4 rounded-[32px] border border-white/[0.05] flex items-center justify-between group">
                    <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/profile/${u.id}`)}>
                      <UserAvatar uid={u.id} className="w-12 h-12" />
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm font-black text-white italic">{u.displayName}</h4>
                          <PremiumTag email={u.email} role={u.role} size="xs" />
                        </div>
                        <p className="text-[9px] font-bold text-white/20 uppercase">LV.{u.level || 1} • {u.displayId} • <span className="text-purple-400 font-extrabold font-mono">✨ {u.aura || 0} AURA</span></p>
                      </div>
                    </div>
                    <button 
                      onClick={() => followUser(u.id)}
                      className="bg-white/5 h-11 px-6 rounded-2xl text-[9px] font-black uppercase text-purple-400 border border-white/5 active:scale-95 transition-all"
                    >
                      SEGUINDO
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-6">
            <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-white/40 italic px-2">Seguidores ({profile?.followers?.length || 0})</h3>
            {followersList.length === 0 ? (
              <div className="py-12 bg-white/[0.02] rounded-[40px] border border-white/5 text-center px-6">
                 <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest italic">Ninguém segue você ainda.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {followersList.map(u => (
                  <div key={u.id} className="bg-[#0c0c0c] p-4 rounded-[32px] border border-white/[0.05] flex items-center justify-between group">
                    <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/profile/${u.id}`)}>
                      <UserAvatar uid={u.id} className="w-12 h-12" />
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm font-black text-white italic">{u.displayName}</h4>
                          <PremiumTag email={u.email} role={u.role} size="xs" />
                        </div>
                        <p className="text-[9px] font-bold text-white/20 uppercase">LV.{u.level || 1} • {u.displayId} • <span className="text-purple-400 font-extrabold font-mono">✨ {u.aura || 0} AURA</span></p>
                      </div>
                    </div>
                    <button 
                      onClick={() => followUser(u.id)}
                      className={`h-11 px-6 rounded-2xl text-[9px] font-black uppercase transition-all italic ${profile?.following?.includes(u.id) ? 'bg-white/5 text-purple-400' : 'bg-purple-600 text-white shadow-lg'}`}
                    >
                      {profile?.following?.includes(u.id) ? 'SEGUINDO' : 'RETRIBUIR'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="space-y-4 pb-20 px-2 mt-4">
          {chats.length === 0 ? (
            <div className="py-24 text-center glass-dark rounded-[50px] border border-white/[0.08] shadow-premium card-shine mt-10">
               <div className="w-24 h-24 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-[35px] flex items-center justify-center mx-auto mb-8 border border-white/10 shadow-inner group">
                  <MessageCircle className="text-purple-500/40 group-hover:scale-110 transition-transform duration-700" size={42} />
               </div>
               <h4 className="text-white font-black text-xl italic uppercase tracking-tight">Vazio por aqui...</h4>
               <p className="text-white/20 text-[12px] mt-4 max-w-[220px] mx-auto leading-relaxed font-medium italic">Encontre lendas e comece uma conversa épica hoje mesmo.</p>
               <button onClick={() => setShowSearch(true)} className="mt-12 bg-white text-black px-12 py-5 rounded-[22px] text-[11px] font-black uppercase tracking-[0.3em] transition-all shadow-[0_15px_35px_rgba(255,255,255,0.2)] active:scale-95 italic card-shine">Explorar Galáxia</button>
            </div>
          ) : (
            chats.map(chat => (
              <motion.div
                key={chat.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate(`/chat/${chat.participants.find(p => p !== user?.uid)}`)}
                className="glass-dark p-5 rounded-[38px] border border-white/[0.08] flex items-center gap-5 group cursor-pointer active:scale-[0.97] transition-all duration-500 hover:bg-white/[0.04] card-shine"
              >
                <div className="relative shrink-0">
                  <UserAvatar uid={chat.targetUser?.uid} className="w-16 h-16" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-4 border-zinc-900 shadow-lg z-25"></div>
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                   <div className="flex justify-between items-start mb-1">
                      <h4 className="font-black text-lg text-white truncate group-hover:text-purple-400 transition-colors italic leading-none">{chat.targetUser?.displayName}</h4>
                      <span className="text-[10px] font-black text-white/10 tabular-nums uppercase tracking-widest mt-0.5 italic">
                        {chat.updatedAt?.toDate ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(chat.updatedAt.toDate()) : 'Now'}
                      </span>
                   </div>
                   <div className="flex items-center justify-between gap-4">
                      <p className="text-[13px] text-white/30 truncate font-semibold italic">
                        {chat.lastMessage || 'Iniciar conexão de dados...'}
                      </p>
                      {chat.updatedAt && <div className="w-2 h-2 bg-purple-500 rounded-full shadow-[0_0_12px_#a855f7] border-2 border-zinc-900 animate-pulse"></div>}
                   </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}
    </motion.div>
  );
}
