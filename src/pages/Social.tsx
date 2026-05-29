import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, UserPlus, MessageCircle, Star, Search, ChevronRight, X, UserCheck, Loader2, Send, Trophy } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, getDoc, doc, limit, onSnapshot, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { useNotifications } from '../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import UserAvatar from '../components/UserAvatar';
import PremiumTag from '../components/PremiumTag';

interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: any;
  updatedAt: any;
  targetUser?: any;
}

export default function Social() {
  const { profile, user, followUser } = useAuth();
  const navigate = useNavigate();
  const { sendNotification } = useNotifications();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchType, setSearchType] = useState<'name' | 'displayId'>('name');
  const [activeTab, setActiveTab] = useState<'friends' | 'connections' | 'chats'>('friends');
  const [followingList, setFollowingList] = useState<any[]>([]);
  const [followersList, setFollowersList] = useState<any[]>([]);
  const [loadingSocial, setLoadingSocial] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [recommended, setRecommended] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePeriod, setActivePeriod] = useState<'diario' | 'semanal' | 'mensal' | 'geral'>('geral');
  const [giftTransactions, setGiftTransactions] = useState<any[]>([]);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const snap = await getDocs(collection(db, 'gift_transactions'));
        setGiftTransactions(snap.docs.map(doc => doc.data()));
      } catch (err) {
        console.warn("Could not fetch gift transactions for aggregated rankings:", err);
      }
    };
    if (user) fetchTransactions();
  }, [user]);

  const getSubRanking = () => {
    if (activePeriod === 'geral') {
      return [...ranking].sort((a: any, b: any) => (b.aura || 0) - (a.aura || 0)).slice(0, 10);
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
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 10);
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
    const fetchSocialData = async () => {
      try {
        const recSnap = await getDocs(query(collection(db, 'users'), limit(10)));
        const recList = recSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(u => u.id !== user?.uid);
        setRecommended(recList);

        const rankSnap = await getDocs(query(collection(db, 'users'), limit(50)));
        const users = rankSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRanking(users);
      } catch (error) {
        console.error("fetchSocialData error:", error);
        setRanking([]);
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchSocialData();
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
                               <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest mt-1">ID • {u.displayId}</p>
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

      {activeTab === 'friends' ? (
        <div className="space-y-10">
          {/* Daily Ranking Content */}
          {/* Daily Ranking - Screenshot Style */}
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
            
            <div className="bg-[#0c0c0c] rounded-[48px] border border-white/[0.08] p-6 space-y-6 shadow-premium">
                  {getSubRanking().slice(0, 10).map((rank, i) => {
                    const score = activePeriod === 'geral' ? (rank.aura || 0) : (rank.score || 0);
                    return (
                      <motion.div 
                        key={rank.id} 
                        onClick={() => navigate(`/profile/${rank.id}`)}
                        className="flex items-center justify-between group active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-5">
                           <div className={`w-6 text-sm font-black italic ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-blue-400' : i === 2 ? 'text-pink-400' : 'text-white/10'}`}>
                             #{i + 1}
                           </div>
                           <UserAvatar uid={rank.id} className="w-14 h-14 shrink-0" />
                           <div className="flex flex-col">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-base font-black text-white italic leading-tight">{rank.displayName}</h4>
                                <PremiumTag email={rank.email} role={rank.role} size="xs" />
                              </div>
                              <span className="text-[9px] font-black text-purple-400/50 uppercase tracking-widest mt-1">
                                {rank.displayId}
                              </span>
                           </div>
                        </div>
                        <div className="flex items-center gap-3">
                           <span className="text-[10px] font-extrabold text-pink-500 tracking-wider flex items-center gap-1 bg-pink-500/5 border border-pink-500/10 px-3 py-1.5 rounded-xl whitespace-nowrap">
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
                        <p className="text-[9px] font-bold text-white/20 uppercase">LV.{u.level || 1} • {u.displayId}</p>
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
                        <p className="text-[9px] font-bold text-white/20 uppercase">LV.{u.level || 1} • {u.displayId}</p>
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
