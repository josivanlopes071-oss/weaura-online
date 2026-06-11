import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { Plus, Users, Mic, Flame, MessageSquare, X, Lock, Gamepad2, Music, Coffee, MessageCircle, Trophy, Sparkles, Check, Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface Room {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: string[];
  activeSpeakers: string[];
  type: string;
  category?: string;
  isLocked?: boolean;
  participantLimit?: number;
  hostInfo?: {
    displayName: string;
    photoURL: string;
  };
  isPinned?: boolean;
  isOfficial?: boolean;
  isTrending?: boolean;
}

const CATEGORIES = [
  { id: 'Tudo', label: 'Tudo', icon: Flame },
  { id: 'Jogos', label: 'Jogos 🎮', icon: Gamepad2 },
  { id: 'Música', label: 'Música 🎵', icon: Music },
  { id: 'Chat', label: 'Papo 🎤', icon: MessageCircle },
  { id: 'Amizade', label: 'Amizade 🤝', icon: Users },
  { id: 'Namoro', label: 'Namoro 💖', icon: Flame },
  { id: 'Anime', label: 'Anime 🎎', icon: Gamepad2 },
];

export default function Home() {
  const [rooms, setRooms] = useState<Room[]>(() => {
    try {
      const cached = sessionStorage.getItem('weplay_cached_rooms');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn("Error reading cached rooms from sessionStorage:", e);
    }
    return [];
  });
  const [showCreate, setShowCreate] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Chat');
  const [activeFilter, setActiveFilter] = useState('Tudo');
  const [roomPasswordInput, setRoomPasswordInput] = useState('');
  const [roomLimitInput, setRoomLimitInput] = useState(12);
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [showPatchNotes, setShowPatchNotes] = useState(() => sessionStorage.getItem('dismissed_patch_notes_lightmode') !== 'true');

  useEffect(() => {
    if (!user) return;
    // 1. We remove orderBy from snapshot to prevent rooms from temporarily disappearing 
    // when created inside the local cache during the serverTimestamp() resolved phase.
    const q = query(collection(db, 'rooms'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const roomList = snapshot.docs.map(doc => {
        const data = doc.data();
        let createdAtMs = Date.now();
        if (data.createdAt) {
          if (typeof data.createdAt.toDate === 'function') {
            createdAtMs = data.createdAt.toDate().getTime();
          } else if (typeof data.createdAt === 'number') {
            createdAtMs = data.createdAt;
          } else if (data.createdAt.seconds) {
            createdAtMs = data.createdAt.seconds * 1000;
          } else if (typeof data.createdAt === 'string') {
            createdAtMs = new Date(data.createdAt).getTime() || Date.now();
          }
        }
        return {
          id: doc.id,
          ...data,
          createdAt: createdAtMs,
        } as any;
      });
      
      // 2. We sort them in memory on the client side smoothly
      roomList.sort((a, b) => {
        const timeA = typeof a.createdAt === 'number' ? a.createdAt : Date.now();
        const timeB = typeof b.createdAt === 'number' ? b.createdAt : Date.now();
        return timeB - timeA;
      });
      
      setRooms(roomList);
      try {
        sessionStorage.setItem('weplay_cached_rooms', JSON.stringify(roomList));
      } catch (err) {
        console.warn("Failed to set cached rooms in sessionStorage:", err);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'rooms');
    });

    return () => unsubscribe();
  }, [user]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim() || !user || !profile) return;

    try {
      const { query: fsQuery, where, getDocs, deleteDoc, doc } = await import('firebase/firestore');
      
      // Clear any prior owned rooms to avoid ghost locks and ensure instant fresh creation
      const q = fsQuery(collection(db, 'rooms'), where('ownerId', '==', user.uid));
      const existingRooms = await getDocs(q);
      
      if (!existingRooms.empty) {
        const deletePromises = existingRooms.docs.map(docSnap => deleteDoc(doc(db, 'rooms', docSnap.id)));
        await Promise.all(deletePromises);
      }

      const hasPass = roomPasswordInput.trim().length > 0;

      const roomPayload = {
        name: newRoomName.trim(),
        description: `Bem-vindo à sala de ${profile.displayName}!`,
        ownerId: user.uid,
        hostInfo: {
          displayName: profile.displayName,
          photoURL: profile.photoURL
        },
        members: [user.uid],
        activeSpeakers: [],
        slots: { 0: user.uid },
        type: 'public',
        category: selectedCategory,
        participantLimit: roomLimitInput,
        isLocked: hasPass,
        password: hasPass ? roomPasswordInput.trim() : '',
        theme: 'default',
        neonColor: '#a855f7',
        stageLayout: 'standard',
        allowFreeMic: true,
        moderators: [],
        mutedUsers: [],
        coHosts: [],
        coverURL: 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=1000&auto=format&fit=crop',
        lastActive: serverTimestamp(),
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'rooms'), roomPayload);
      setShowCreate(false);
      setNewRoomName('');
      setRoomPasswordInput('');
      setRoomLimitInput(12);
      navigate(`/room/${docRef.id}`);
    } catch (err) {
      console.error("Erro ao criar sala:", err);
    }
  };

  const filteredRooms = (activeFilter === 'Tudo' 
    ? rooms 
    : rooms.filter(r => r.category === activeFilter))
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      if (a.isOfficial && !b.isOfficial) return -1;
      if (!a.isOfficial && b.isOfficial) return 1;
      return 0;
    });

  const [passwordRoom, setPasswordRoom] = useState<Room | null>(null);
  const [roomPassword, setRoomPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleRoomClick = async (room: Room) => {
    if (room.ownerId === user?.uid) {
      navigate(`/room/${room.id}`);
      return;
    }

    if (room.isLocked) {
      setPasswordRoom(room);
      setRoomPassword('');
      setPasswordError(false);
    } else {
      navigate(`/room/${room.id}`);
    }
  };

  const verifyPassword = async () => {
    if (!passwordRoom) return;
    setIsVerifying(true);
    setPasswordError(false);

    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const roomRef = doc(db, 'rooms', passwordRoom.id);
      const roomSnap = await getDoc(roomRef);

      if (roomSnap.exists()) {
        const actualPassword = roomSnap.data().password;
        if (actualPassword === roomPassword) {
          navigate(`/room/${passwordRoom.id}`, { state: { passwordVerified: true } });
          setPasswordRoom(null);
        } else {
          setPasswordError(true);
        }
      }
    } catch (err) {
      console.error("Erro ao verificar senha:", err);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 pb-32 space-y-4.5 bg-transparent min-h-screen"
    >
      <AnimatePresence>
        {passwordRoom && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPasswordRoom(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-zinc-900 border border-white/10 rounded-[40px] p-8 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center border border-purple-500/20">
                  <Lock className="text-purple-500" size={32} />
                </div>
                
                <div>
                  <h3 className="text-xl font-black text-white italic uppercase tracking-tight">Sala Trancada</h3>
                  <p className="text-xs text-white/40 mt-2 font-medium">Esta sala requer uma chave de acesso para entrar.</p>
                </div>
 
                <div className="w-full space-y-4">
                  <input 
                    type="password"
                    value={roomPassword}
                    onChange={(e) => setRoomPassword(e.target.value)}
                    placeholder="Digite a senha..."
                    className={`w-full bg-black/40 border ${passwordError ? 'border-red-500/50' : 'border-white/5'} rounded-2xl py-4 px-6 text-white text-center text-lg font-bold outline-none focus:border-purple-500/40 transition-all`}
                    autoFocus
                  />
                  {passwordError && (
                    <p className="text-[10px] font-black text-red-500 uppercase tracking-widest animate-pulse">Senha Incorreta</p>
                  )}
                </div>
 
                <div className="w-full flex gap-3">
                  <button 
                    onClick={() => setPasswordRoom(null)}
                    className="flex-1 py-4 bg-white/5 rounded-2xl text-[10px] font-black text-white/40 uppercase tracking-widest hover:bg-white/10 transition-all"
                  >
                    Voltar
                  </button>
                  <button 
                    onClick={verifyPassword}
                    disabled={isVerifying || !roomPassword}
                    className="flex-2 py-4 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {isVerifying ? 'Verificando...' : 'Entrar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
 
      {/* Refined Welcome Message */}
      <div className="pt-2 px-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white uppercase italic">
            Olá, {(profile?.displayName || 'Membro').split(' ')[0]} 👋
          </h2>
          <p className="text-[10px] font-black text-zinc-450 dark:text-white/30 uppercase tracking-[0.25em] leading-none mt-1.5 italic">
            Nível {profile?.level || 1} • Id {profile?.displayId || '000000'}
          </p>
        </div>
        <p className="text-[11px] text-zinc-400 dark:text-white/20 font-semibold italic select-none hidden sm:block">
          Sintonize sua frequência e conheça pessoas
        </p>
      </div>
 
      <AnimatePresence>
        {showPatchNotes && (
          <motion.section 
            initial={{ height: 0, opacity: 0, y: -10 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -10 }}
            className="overflow-hidden mb-4"
          >
            <div className="p-3.5 pr-10 relative rounded-2xl bg-gradient-to-r from-purple-500/10 via-pink-500/5 to-transparent border border-purple-500/10 shadow-sm flex items-center justify-between gap-3 text-left">
              <div className="flex items-center gap-2.5">
                <Sparkles size={16} className="text-purple-600 dark:text-purple-400 shrink-0" />
                <p className="text-[11px] font-medium text-zinc-700 dark:text-white/80">
                  <strong className="font-extrabold text-purple-700 dark:text-purple-300">Nova v1.1:</strong> Tema Claro aprimorado, inteligência de cores do clã e performance de layout otimizada!
                </p>
              </div>
              <button 
                onClick={() => {
                  sessionStorage.setItem('dismissed_patch_notes_lightmode', 'true');
                  setShowPatchNotes(false);
                }}
                className="absolute top-1/2 -translate-y-1/2 right-3 p-1.5 rounded-lg bg-zinc-250/50 dark:bg-white/5 text-zinc-500 dark:text-white/40 hover:text-zinc-700 dark:hover:text-white transition-all"
              >
                <X size={12} />
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
 
      {/* Featured Banners - Horizontal Swipe Carousel */}
      <section className="flex gap-3 overflow-x-auto pb-3 px-1 scrollbar-hide snap-x snap-mandatory w-full mb-1">
        {/* Banner 1: Missão Especial */}
        <div 
          className="relative h-26 rounded-xl overflow-hidden group cursor-pointer border border-purple-500/10 dark:border-white/5 bg-zinc-100 dark:bg-[#0c0c0c] w-[75vw] sm:w-[48%] min-w-[240px] md:flex-1 shrink-0 snap-center transition-all duration-300"
          onClick={() => navigate('/challenges')}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5 dark:from-purple-600/10 dark:to-blue-600/5 pointer-events-none" />
          <div className="absolute inset-0 p-4 flex flex-col justify-between relative z-10">
              <div className="bg-purple-100 dark:bg-purple-500/10 w-fit px-2.5 py-0.5 rounded-full border border-purple-200 dark:border-purple-500/20">
                 <span className="text-[8px] font-black uppercase text-purple-605 dark:text-purple-400 tracking-wider">Missão Especial</span>
              </div>
              <div>
                 <h2 className="text-sm font-extrabold text-zinc-900 dark:text-white leading-tight uppercase tracking-tight italic">Desafios <span className="text-purple-500">Temporários</span></h2>
                 <p className="text-zinc-505 dark:text-white/30 text-[8.5px] font-semibold mt-0.5 uppercase tracking-wider leading-none">Complete e ganhe Aura Coins</p>
              </div>
          </div>
          <div className="absolute right-3 bottom-1.5 text-purple-500/10 dark:text-purple-550/10 group-hover:scale-105 transition-transform duration-750 pointer-events-none">
             <Trophy size={60} className="stroke-[1.5]" />
          </div>
        </div>
 
        {/* Banner 2: Arena de Jogos */}
        <div 
          className="relative h-26 rounded-xl overflow-hidden group cursor-pointer border border-pink-500/10 dark:border-white/5 bg-zinc-100 dark:bg-[#06030c] w-[75vw] sm:w-[48%] min-w-[240px] md:flex-1 shrink-0 snap-center transition-all duration-300"
          onClick={() => navigate('/games')}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-indigo-500/5 dark:from-pink-600/10 dark:to-indigo-600/5 pointer-events-none" />
          <div className="absolute inset-0 p-4 flex flex-col justify-between relative z-10">
              <div className="bg-pink-100 dark:bg-pink-500/10 w-fit px-2.5 py-0.5 rounded-full border border-pink-200 dark:border-pink-500/20 flex items-center gap-1">
                 <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-ping" />
                 <span className="text-[8px] font-bold uppercase text-pink-600 dark:text-pink-400 tracking-wider">Arena de Jogos</span>
              </div>
              <div>
                 <h2 className="text-sm font-extrabold text-zinc-900 dark:text-white leading-tight uppercase tracking-tight italic">Arena de <span className="text-pink-500">Minijogos</span></h2>
                 <p className="text-zinc-505 dark:text-white/30 text-[8.5px] font-semibold mt-0.5 uppercase tracking-wider leading-none">Damas • Jogo da Velha • Campo Minado</p>
              </div>
          </div>
          <div className="absolute right-3 bottom-1.5 text-pink-500/10 dark:text-pink-550/10 group-hover:scale-105 group-hover:rotate-3 transition-transform duration-750 pointer-events-none">
             <Gamepad2 size={60} className="stroke-[1.5]" />
          </div>
        </div>
      </section>
 
      {/* Modern Categories */}
      <div className="space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-2.5 px-1 scrollbar-hide">
          {CATEGORIES.map((cat, idx) => {
            const Icon = cat.icon;
            const isActive = activeFilter === cat.id;
            return (
              <button 
                key={cat.id} 
                onClick={() => setActiveFilter(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-[10px] font-black uppercase tracking-wider transition-all duration-350 shrink-0 cursor-pointer ${
                  isActive 
                    ? 'bg-purple-600 border-purple-500 text-white shadow-sm' 
                    : 'bg-zinc-150 dark:bg-white/5 border-zinc-200 dark:border-white/5 text-zinc-500 dark:text-white/30 hover:border-zinc-300 dark:hover:border-white/10'
                }`}
              >
                <Icon size={12} className={isActive ? 'text-white' : 'text-zinc-400 dark:text-zinc-505'} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Room Grid */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between px-2">
          <div className="flex flex-col">
             <h3 className="text-lg font-black italic uppercase text-white tracking-tighter">Salas ao vivo</h3>
             <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mt-0.5">Sintonize sua frequência</span>
          </div>
          <div className="flex items-center gap-1.5 p-1.5 bg-purple-500/10 rounded-lg border border-purple-500/20">
             <Mic size={12} className="text-purple-400" />
             <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest leading-none">12 Ativas</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {filteredRooms.map((room, idx) => {
            const category = room.category || 'Geral';
            let tagColor = 'bg-blue-500/10 border-blue-500/20 text-blue-500 dark:text-blue-400';
            if (category.toLowerCase().includes('jogo')) tagColor = 'bg-orange-500/10 border-orange-500/20 text-orange-500 dark:text-orange-400';
            if (category.toLowerCase().includes('fundo') || category.toLowerCase().includes('família') || category.toLowerCase().includes('amizade')) tagColor = 'bg-green-500/10 border-green-500/20 text-green-500 dark:text-green-400';

            return (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.03, duration: 0.3 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleRoomClick(room)}
                className="bg-zinc-100 dark:bg-[#0c0c0c] rounded-xl border border-zinc-200 dark:border-white/[0.05] p-3 flex gap-3 group cursor-pointer active:border-purple-500/30 transition-all duration-300 relative overflow-hidden"
              >
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-550 pointer-events-none" />
                
                {/* Left: Refined Compact Avatar */}
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-zinc-250 dark:border-white/10 shadow-sm relative z-10">
                    <img 
                      src={room.hostInfo?.photoURL || (room as any).coverURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${room.id}`} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      alt={room.name}
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-40" />
                  </div>
                  {/* Status Indicator */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-550 dark:bg-green-500 border-2 border-zinc-100 dark:border-[#0c0c0c] rounded-full z-20 shadow-sm"></div>
                </div>

                {/* Right: Room Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-between relative z-10">
                  <div className="space-y-0.5">
                    {/* Category Tag */}
                    <div className="flex flex-wrap gap-1 items-center">
                      <div className={`w-fit px-2 py-0.5 rounded-full border text-[7.5px] font-bold uppercase tracking-[0.1em] ${tagColor}`}>
                        {category}
                      </div>
                      {room.isPinned && (
                        <div className="bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 px-2 py-0.5 rounded-full text-[7.5px] font-black uppercase tracking-[0.08em]">
                          📌 FIXADA
                        </div>
                      )}
                      {room.isOfficial && (
                        <div className="bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-full text-[7.5px] font-black uppercase tracking-[0.08em]">
                          ⭐️ OFICIAL
                        </div>
                      )}
                    </div>
                    
                    {/* Room Name */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white truncate uppercase tracking-tight leading-normal group-hover:text-purple-650 dark:group-hover:text-purple-400 transition-colors">
                        {room.name}
                      </h3>
                      <span className="text-xs grayscale group-hover:grayscale-0 transition-all opacity-40 group-hover:opacity-100">🇧🇷</span>
                    </div>

                    {/* Host & Description */}
                    <p className="text-[10px] font-medium text-zinc-400 dark:text-white/30 truncate uppercase tracking-wider leading-none">
                      {(room as any).description || 'Sintonize nesta vibração agora'}
                    </p>
                  </div>

                  {/* Footer Stats */}
                  <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-zinc-200/40 dark:border-white/[0.03]">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-200/50 dark:bg-white/5 rounded-full border border-zinc-300/30 dark:border-white/5">
                        <Users size={9} className="text-zinc-550 dark:text-white/40" />
                        <span className="text-[8.5px] font-black text-zinc-700 dark:text-white tabular-nums tracking-wide">{room.members?.length || 0}</span>
                      </div>
                      
                      <div className="flex -space-x-1">
                        {room.members && room.members.length > 0 ? (
                          room.members.slice(0, 3).map((memberUid: string) => (
                            <div key={memberUid} className="w-[14px] h-[14px] rounded-full border border-zinc-100 dark:border-[#0c0c0c] bg-zinc-800 overflow-hidden" title="Membro Ativo">
                              <img 
                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${memberUid}`} 
                                className="w-full h-full object-cover" 
                                alt="" 
                                loading="lazy" 
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ))
                        ) : (
                          <div className="text-[8px] text-zinc-400 dark:text-white/20 font-bold uppercase tracking-wider pl-1 font-mono">
                            Sala Vazia
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-1 items-center h-3.5 text-purple-600 dark:text-purple-400">
                      <span className="w-1 h-1 rounded-full bg-purple-500 dark:bg-purple-400 animate-pulse" />
                      <span className="text-[8px] font-bold tracking-wider pl-0.5 uppercase font-mono">AO VIVO</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}

          
          {filteredRooms.length === 0 && (
             <div className="col-span-full py-16 text-center bg-zinc-150 dark:bg-zinc-900/40 rounded-3xl border border-zinc-200 dark:border-white/5">
                <div className="w-12 h-12 bg-zinc-200 dark:bg-white/5 rounded-xl flex items-center justify-center mx-auto mb-3 border border-zinc-350 dark:border-white/[0.03]">
                   <MessageCircle className="text-zinc-400 dark:text-white/15" size={18} />
                </div>
                <h4 className="text-zinc-900 dark:text-white font-extrabold text-sm uppercase">Silêncio no universo</h4>
                <p className="text-zinc-450 dark:text-white/20 text-[10px] mt-1 max-w-[190px] mx-auto font-semibold uppercase tracking-wider leading-relaxed">Explore outras categorias ou crie sua própria sala.</p>
             </div>
          )}
        </div>
      </div>

      {/* Create Room Modal */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreate(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="relative w-full max-w-md bg-zinc-950 border border-white/[0.08] rounded-[42px] p-8 shadow-2xl overflow-hidden"
            >
              {/* Background Glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none" />

              <div className="flex items-center justify-between pb-6 border-b border-white/5 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/20">
                    <Mic className="text-purple-400" size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white italic uppercase tracking-tight">Criar Nova Sala</h3>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Defina seu ambiente premium</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all hover:bg-white/10"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateRoom} className="space-y-6 pt-6 relative z-10">
                {/* Room Name */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Nome do Templo</label>
                  <input 
                    type="text"
                    required
                    maxLength={32}
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="Ex: Mansão dos Deuses 🔮"
                    className="w-full bg-black/50 border border-white/5 rounded-2xl py-4 px-5 text-white text-sm font-bold placeholder:text-white/10 outline-none focus:border-purple-500/30 focus:bg-black/70 transition-all font-sans"
                  />
                </div>

                {/* Categories Wrapper */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Sintonia / Estilo</label>
                  <div className="grid grid-cols-3 gap-2">
                    {CATEGORIES.filter(c => c.id !== 'Tudo').map((cat) => {
                      const isSel = selectedCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`py-3.5 px-2 rounded-xl border text-[10px] font-black uppercase tracking-wider text-center transition-all ${
                            isSel 
                              ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.15)]' 
                              : 'bg-black/30 border-white/5 text-white/30 hover:border-white/10'
                          }`}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Row: Participant Limit & Password */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Capacidade</label>
                    <select
                      value={roomLimitInput}
                      onChange={(e) => setRoomLimitInput(Number(e.target.value))}
                      className="w-full bg-black/50 border border-white/5 rounded-2xl py-4 px-4 text-white text-sm font-bold outline-none focus:border-purple-500/30 transition-all cursor-pointer"
                    >
                      <option value={4} className="bg-zinc-950">4 Assentos</option>
                      <option value={8} className="bg-zinc-950">8 Assentos</option>
                      <option value={12} className="bg-zinc-950">12 Assentos</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Senha (Opcional)</label>
                    <div className="relative">
                      <input 
                        type="password"
                        maxLength={12}
                        value={roomPasswordInput}
                        onChange={(e) => setRoomPasswordInput(e.target.value)}
                        placeholder="Trancar sala..."
                        className="w-full bg-black/50 border border-white/5 rounded-2xl py-4 pl-10 pr-4 text-white text-sm font-bold placeholder:text-white/10 outline-none focus:border-purple-500/30 transition-all font-sans"
                      />
                      <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                    </div>
                  </div>
                </div>

                {/* Create Trigger */}
                <button 
                  type="submit"
                  disabled={!newRoomName.trim()}
                  className="w-full py-4.5 bg-gradient-to-r from-purple-600 to-indigo-600 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-white/20 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-purple-950/20 active:scale-95 transition-all text-center mt-2 cursor-pointer"
                >
                  Sintonizar Frequência
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
