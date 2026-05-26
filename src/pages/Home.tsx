import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { Plus, Users, Mic, Flame, MessageSquare, X, Lock, Gamepad2, Music, Coffee, MessageCircle, Trophy } from 'lucide-react';

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
  const [rooms, setRooms] = useState<Room[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Chat');
  const [activeFilter, setActiveFilter] = useState('Tudo');
  const [roomPasswordInput, setRoomPasswordInput] = useState('');
  const [roomLimitInput, setRoomLimitInput] = useState(12);
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // 1. We remove orderBy from snapshot to prevent rooms from temporarily disappearing 
    // when created inside the local cache during the serverTimestamp() resolved phase.
    const q = query(collection(db, 'rooms'), limit(100));
    return onSnapshot(q, (snapshot) => {
      const roomList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room));
      
      // 2. We sort them in memory on the client side smoothly
      roomList.sort((a, b) => {
        const timeA = (a as any).createdAt?.toDate ? (a as any).createdAt.toDate().getTime() : (a as any).createdAt || Date.now();
        const timeB = (b as any).createdAt?.toDate ? (b as any).createdAt.toDate().getTime() : (b as any).createdAt || Date.now();
        return timeB - timeA;
      });
      
      setRooms(roomList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'rooms');
    });
  }, []);

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
      className="p-6 pb-36 space-y-8 bg-[#020202] min-h-screen"
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

      {/* Premium Header */}
      <section className="flex items-center justify-between pt-4">
        <div className="flex items-center gap-3">
           <div className="relative group" onClick={() => navigate('/profile')}>
             <img 
               src={profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} 
               className="w-11 h-11 rounded-2xl border border-white/5 object-cover bg-zinc-900 active:scale-95 transition-transform"
               alt=""
               loading="lazy"
             />
             <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-[#020202] rounded-full"></div>
           </div>
           <div>
             <h2 className="text-sm font-bold text-white tracking-tight">Olá, {(profile?.displayName || 'Membro').split(' ')[0]}</h2>
             <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.1em]">LV.{profile?.level || 1} • {profile?.displayId || '000000'}</p>
           </div>
        </div>
        <div className="flex items-center gap-2.5">
           <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-2xl border border-white/5">
              <span className="text-[11px] font-bold text-yellow-500">{(profile as any)?.coins || 0}</span>
              <Gamepad2 size={12} className="text-yellow-500" />
           </div>
           
           <button 
             onClick={() => {
               setNewRoomName('');
               setRoomPasswordInput('');
               setRoomLimitInput(12);
               setShowCreate(true);
             }}
             className="p-2.5 bg-purple-500/10 rounded-2xl text-purple-400 hover:text-purple-300 hover:bg-purple-500/20 transition-all active:scale-90 border border-purple-500/20 flex items-center justify-center cursor-pointer"
             title="Criar Sala"
           >
             <Plus size={20} />
           </button>

           <button onClick={() => navigate('/social')} className="p-2.5 bg-white/5 rounded-2xl text-white/30 hover:text-white transition-all active:scale-90 border border-white/5">
             <MessageSquare size={20} />
           </button>
        </div>
      </section>

      {/* Featured Banner - Screenshot 1 Style */}
      <section className="relative h-48 rounded-[48px] overflow-hidden group cursor-pointer shadow-premium" onClick={() => navigate('/challenges')}>
        <div className="absolute inset-0 bg-[#0c0c0c] border border-white/[0.08]">
           <div className="absolute inset-0 bg-gradient-to-br from-purple-600/30 via-transparent to-blue-600/10" />
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/20 blur-[100px] rounded-full animate-pulse" />
        </div>
        <div className="absolute inset-0 p-10 flex flex-col justify-center relative z-10">
            <div className="bg-white/10 w-fit px-4 py-1.5 rounded-full border border-white/10 mb-5">
               <span className="text-[10px] font-black uppercase text-purple-400 tracking-[0.3em] italic">Missão Especial</span>
            </div>
            <h2 className="text-3xl font-black text-white leading-none uppercase tracking-tighter italic">Desafios <br/><span className="text-purple-500">Temporários</span></h2>
            <p className="text-white/30 text-[10px] font-bold mt-4 uppercase tracking-[0.2em] italic">Complete e ganhe Aura Coins</p>
        </div>
        <div className="absolute right-[-20px] bottom-[-20px] opacity-20 group-hover:scale-110 transition-transform duration-1000">
           <Trophy size={180} className="text-white blur-sm" />
        </div>
      </section>

      {/* Modern Categories */}
      <div className="space-y-4">
        <div className="flex gap-4 overflow-x-auto pb-4 px-1 scrollbar-hide">
          {CATEGORIES.map((cat, idx) => {
            const Icon = cat.icon;
            const isActive = activeFilter === cat.id;
            const colors = [
              'border-purple-500 text-purple-400 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.2)]',
              'border-blue-500 text-blue-400 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.2)]',
              'border-pink-500 text-pink-400 bg-pink-500/10 shadow-[0_0_20px_rgba(236,72,153,0.2)]',
              'border-yellow-500 text-yellow-400 bg-yellow-500/10 shadow-[0_0_20_px_rgba(234,179,8,0.2)]',
              'border-green-500 text-green-400 bg-green-500/10 shadow-[0_0_20_px_rgba(34,197,94,0.2)]',
              'border-orange-500 text-orange-400 bg-orange-500/10 shadow-[0_0_20_px_rgba(249,115,22,0.2)]',
            ];
            const colorClass = isActive ? colors[idx % colors.length] : 'bg-[#0c0c0c] border-white/5 text-white/30 hover:border-white/20';

            return (
              <button 
                key={cat.id} 
                onClick={() => setActiveFilter(cat.id)}
                className={`flex flex-col items-center gap-3 transition-all min-w-[72px] group`}
              >
                <div className={`w-18 h-18 rounded-[28px] flex items-center justify-center border transition-all active:scale-95 ${colorClass}`}>
                  <Icon size={26} className={isActive ? 'scale-110' : ''} />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-tight ${isActive ? 'text-white' : 'text-white/20'}`}>
                  {cat.label.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Room Grid */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div className="flex flex-col">
             <h3 className="text-xl font-black italic uppercase text-white tracking-tighter">Salas ao vivo</h3>
             <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mt-1">Sintonize sua frequência</span>
          </div>
          <div className="flex items-center gap-1.5 p-2 bg-purple-500/10 rounded-xl border border-purple-500/20">
             <Mic size={14} className="text-purple-400" />
             <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest leading-none">12 Ativas</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {filteredRooms.map((room, idx) => {
            const category = room.category || 'Geral';
            let tagColor = 'bg-blue-500/10 border-blue-500/20 text-blue-400';
            if (category.toLowerCase().includes('jogo')) tagColor = 'bg-orange-500/10 border-orange-500/20 text-orange-400';
            if (category.toLowerCase().includes('fundo') || category.toLowerCase().includes('família') || category.toLowerCase().includes('amizade')) tagColor = 'bg-green-500/10 border-green-500/20 text-green-400';

            return (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05, duration: 0.5 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleRoomClick(room)}
                className="bg-[#0c0c0c] rounded-[32px] border border-white/[0.05] p-4 flex gap-5 group cursor-pointer active:border-purple-500/30 transition-all shadow-[0_10px_40px_rgba(0,0,0,0.6)] relative overflow-hidden active:bg-zinc-900/50"
              >
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                {/* Left: Large Avatar */}
                <div className="relative shrink-0">
                  <div className="w-[110px] h-[110px] rounded-[28px] overflow-hidden border border-white/10 shadow-premium relative z-10 transition-all duration-500 group-hover:rounded-[22px]">
                    <img 
                      src={room.hostInfo?.photoURL || (room as any).coverURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${room.id}`} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      alt={room.name}
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                  </div>
                  {/* Status Indicator */}
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-4 border-[#0c0c0c] rounded-full z-20 shadow-lg"></div>
                </div>

                {/* Right: Room Info */}
                <div className="flex-1 min-w-0 py-1 flex flex-col justify-between relative z-10">
                  <div className="space-y-1.5">
                    {/* Category Tag */}
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <div className={`w-fit px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-[0.15em] italic ${tagColor}`}>
                        {category}
                      </div>
                      {room.isPinned && (
                        <div className="bg-[#00BFFF]/20 border border-[#00BFFF]/40 text-[#00BFFF] px-2.5 py-1 rounded-full text-[8.5px] font-black uppercase tracking-[0.1em]">
                          📌 FIXADA
                        </div>
                      )}
                      {room.isOfficial && (
                        <div className="bg-[#a855f7]/20 border border-[#a855f7]/40 text-purple-300 px-2.5 py-1 rounded-full text-[8.5px] font-black uppercase tracking-[0.1em]">
                          ⭐️ OFICINA
                        </div>
                      )}
                    </div>
                    
                    {/* Room Name */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-black text-white truncate italic uppercase tracking-tighter leading-tight group-hover:text-purple-400 transition-colors">
                        {room.name}
                      </h3>
                      <span className="text-lg grayscale group-hover:grayscale-0 transition-all opacity-40 group-hover:opacity-100">🇧🇷</span>
                    </div>

                    {/* Host & Info */}
                    <p className="text-[11px] font-medium text-white/30 truncate uppercase tracking-widest italic">
                      {(room as any).description || 'Sintonize nesta vibração agora'}
                    </p>
                  </div>

                  {/* Footer Stats */}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-2xl border border-white/5">
                        <Users size={12} className="text-white/40" />
                        <span className="text-[10px] font-black text-white tabular-nums tracking-wide">{room.members?.length || 0}</span>
                      </div>
                      
                      <div className="flex -space-x-2">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="w-5 h-5 rounded-full border-2 border-[#0c0c0c] bg-zinc-800 overflow-hidden">
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=user${room.id}${i}`} className="w-full h-full object-cover" alt="" loading="lazy" />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-0.5 items-end h-5">
                       {[1, 2, 3, 4].map(i => (
                         <div key={i} className="w-[3px] bg-purple-500/30 rounded-full animate-bounce" 
                           style={{ height: `${20 + Math.random() * 80}%`, animationDelay: `${i * 0.1}s`, animationDuration: `${0.5 + Math.random()}s` }} 
                         />
                       ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}

          
          {filteredRooms.length === 0 && (
             <div className="col-span-full py-20 text-center bg-zinc-900/40 rounded-[40px] border border-white/5">
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/[0.03]">
                   <MessageCircle className="text-white/10" size={24} />
                </div>
                <h4 className="text-white font-bold text-base">Silêncio no universo</h4>
                <p className="text-white/20 text-[11px] mt-2 max-w-[180px] mx-auto font-medium">Explore outras categorias ou crie sua própria sala.</p>
             </div>
          )}
        </div>
      </div>

      {/* Floating Action Button */}
      <motion.button
        whileHover={{ scale: 1.05, shadow: "0 0 25px rgba(168,85,247,0.5)" }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          setNewRoomName('');
          setRoomPasswordInput('');
          setRoomLimitInput(12);
          setShowCreate(true);
        }}
        className="fixed bottom-24 right-6 sm:right-10 z-50 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-[0_8px_32px_rgba(168,85,247,0.4)] border border-purple-400/20 cursor-pointer"
        title="Criar Sala"
      >
        <Plus size={28} className="animate-pulse" />
      </motion.button>

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
