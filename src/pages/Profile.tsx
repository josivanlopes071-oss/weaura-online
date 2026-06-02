import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Shield, Trophy, MapPin, Calendar, LogOut, Edit2, X, Check, Camera, RefreshCw, UserMinus, Search, ChevronRight, UserPlus, MessageCircle, Star, Flame, Gamepad2, Gift, Play, Unlock, Sparkles } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, onSnapshot, collection, query, where, getDocs, limit, serverTimestamp } from 'firebase/firestore';
import AdminMenu from '../components/AdminMenu';
import UserAvatar from '../components/UserAvatar';
import PremiumTag from '../components/PremiumTag';
import { getAuraLevelInfo, AURA_LEVELS, GIFTS } from '../lib/aura';
import GiftAnimationOverlay from '../components/GiftAnimationOverlay';

export default function Profile() {
  const idParam = useParams();
  const id = idParam.id;
  const navigate = useNavigate();
  const { user, profile: myProfile, logout, updateProfile, followUser, sendGift } = useAuth();
  
  const [displayProfile, setDisplayProfile] = useState<any>(null);
  const [isMyProfile, setIsMyProfile] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [targetUid, setTargetUid] = useState('');
  const [foundUser, setFoundUser] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchType, setSearchType] = useState<'uid' | 'displayId'>('displayId');
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [receivedGifts, setReceivedGifts] = useState<any[]>([]);
  const [isGiftBoxOpen, setIsGiftBoxOpen] = useState(false);
  const [isSendingGift, setIsSendingGift] = useState(false);
  const [giftQuantity, setGiftQuantity] = useState<number>(1);
  const [activeAnimation, setActiveAnimation] = useState<any | null>(null);

  useEffect(() => {
    if (!user || !myProfile) return;

    if (!id || id === user.uid) {
      setDisplayProfile(myProfile);
      setIsMyProfile(true);
      setEditName(myProfile.displayName);
      setEditBio(myProfile.bio || '');
    } else {
      setIsMyProfile(false);
      const userRef = doc(db, 'users', id);
      const unsubscribe = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          setDisplayProfile({ ...snap.data(), uid: snap.id });
        } else {
          navigate('/profile');
        }
      });
      return () => unsubscribe();
    }
  }, [id, user, myProfile]);

  useEffect(() => {
    if (!displayProfile?.uid) return;
    const fetchUnorderedGifts = async () => {
      try {
        const q = query(collection(db, 'gift_transactions'), where('receiverId', '==', displayProfile.uid), limit(24));
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => doc.data());
        list.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setReceivedGifts(list);
      } catch (err) {
        console.warn("Could not retrieve received gifts:", err);
      }
    };
    fetchUnorderedGifts();
  }, [displayProfile?.uid]);

  if (!displayProfile || !user || !myProfile) return null;

  const SUPER_ADMINS = ['josivanlopes071@gmail.com', 'manoeldasilva631kejr@gmail.com'];
  const isSuperAdmin = SUPER_ADMINS.includes((user.email || '').toLowerCase());

  const handleSearchUser = async () => {
    if (!targetUid) return;
    setIsSearching(true);
    try {
      if (searchType === 'uid') {
        const userRef = doc(db, 'users', targetUid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          setFoundUser({ ...snap.data(), id: snap.id });
        } else {
          alert("Usuário não encontrado");
          setFoundUser(null);
        }
      } else {
        // Search by numeric ID
        const numericalId = parseInt(targetUid);
        if (isNaN(numericalId)) {
          alert("Insira um número válido");
          return;
        }
        const { collection, query, where, getDocs, limit } = await import('firebase/firestore');
        const q = query(collection(db, 'users'), where('displayId', '==', numericalId), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const userDoc = snap.docs[0];
          setFoundUser({ ...userDoc.data(), id: userDoc.id });
        } else {
          alert("ID Numérico não encontrado");
          setFoundUser(null);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleBanUser = async (duration?: number) => {
    if (!foundUser) return;
    
    // Super Admin Protection
    if (SUPER_ADMINS.includes((foundUser.email || '').toLowerCase())) {
      alert("Operação negada: Este usuário é um Administrador Mestre e não pode ser banido.");
      return;
    }

    const newBanState = !foundUser.isBanned;
    const bannedUntil = duration ? new Date(Date.now() + duration) : null;

    try {
      const userRef = doc(db, 'users', foundUser.id);
      await updateDoc(userRef, { 
        isBanned: newBanState,
        bannedUntil: newBanState ? bannedUntil : null
      });
      setFoundUser({ ...foundUser, isBanned: newBanState, bannedUntil: newBanState ? bannedUntil : null });
      alert(newBanState ? (duration ? `Banido por ${Math.round(duration/3600000)}h!` : "Banido Permanentemente!") : "Desbanido!");
    } catch (err) {
      console.error(err);
      alert("Erro ao realizar ação");
    }
  };

  const toggleAdminRole = async () => {
    if (!foundUser) return;
    if (!isSuperAdmin) {
      alert("Apenas administradores mestre podem realizar esta ação.");
      return;
    }

    // Super Admin Protection
    if (SUPER_ADMINS.includes((foundUser.email || '').toLowerCase())) {
      alert("Operação negada: Este usuário é um Administrador Mestre.");
      return;
    }

    const nextRole = foundUser.role === 'admin' ? 'user' : 'admin';
    try {
      const userRef = doc(db, 'users', foundUser.id);
      await updateDoc(userRef, { role: nextRole });
      setFoundUser({ ...foundUser, role: nextRole });
      alert(nextRole === 'admin' ? "Promovido a ADM!" : "Rebaixado a Usuário!");
    } catch (err) {
      console.error(err);
      alert("Erro ao alterar cargo. Verifique suas permissões.");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("ID Copiado!");
  };

  const stats = [
    { label: 'Jogos', value: '0', color: 'text-purple-500' },
    { label: 'Vitórias', value: '0', color: 'text-blue-500' },
    { label: 'Seguidores', value: String(displayProfile.followers?.length || 0), color: 'text-pink-500' },
  ];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateProfile({
        displayName: editName,
        bio: editBio
      });
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const regenerateAvatar = () => {
    const newSeed = Math.random().toString(36).substring(7);
    updateProfile({
      photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newSeed}`
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) { // 1MB limit for base64 storage
      alert("A imagem deve ter menos de 1MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        await updateProfile({ photoURL: base64String });
      } catch (err) {
        console.error("Erro ao salvar foto:", err);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pb-32 bg-[#020202] min-h-screen"
    >
      {/* Hidden File Input for Gallery */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="image/*" 
      />

      {/* Premium Header/Cover */}
      <div className="relative h-72 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 via-[#020202] to-[#020202]"></div>
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-purple-500/20 to-transparent blur-3xl opacity-50" />
        
        {/* Top Actions */}
        <div className="absolute top-14 left-6 right-6 flex items-center justify-between z-20">
          <button 
            onClick={() => navigate(-1)}
            className="w-12 h-12 bg-black/40 backdrop-blur-3xl rounded-2xl border border-white/5 text-white/40 flex items-center justify-center active:scale-90 transition-all hover:text-white"
          >
            <ChevronRight className="rotate-180" size={24} />
          </button>
          
          <div className="flex gap-3">
            {isMyProfile && myProfile.role === 'admin' && (
              <button 
                onClick={() => setIsAdminPanelOpen(true)}
                className="w-12 h-12 bg-red-500 rounded-2xl text-white shadow-[0_10px_30px_rgba(239,68,68,0.3)] flex items-center justify-center active:scale-90 transition-all"
              >
                <Shield size={22} />
              </button>
            )}
            {isMyProfile && (
              <button 
                onClick={() => navigate('/settings')}
                className="w-12 h-12 bg-white/5 backdrop-blur-3xl rounded-2xl border border-white/10 text-white/40 flex items-center justify-center active:scale-90 transition-all hover:text-white"
              >
                <Settings size={22} />
              </button>
            )}
            {isMyProfile && (
              <button 
                onClick={logout}
                className="w-12 h-12 bg-red-500/10 backdrop-blur-3xl rounded-2xl border border-red-500/10 text-red-500 flex items-center justify-center active:scale-90 transition-all"
              >
                <LogOut size={22} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Profile Main Section */}
      <div className="px-6 -mt-28 relative z-20">
        <div className="flex flex-col items-center">
          <div className="relative mb-8">
            {/* Ultra Premium Avatar Ring with Premium Frame Support */}
            <UserAvatar uid={displayProfile.uid} className="w-40 h-40" />
            
            <div className="absolute top-2 right-2 bg-yellow-500 text-black text-[10px] font-black px-3 py-1 rounded-full shadow-[0_0_15px_rgba(234,179,8,0.5)] border-4 border-[#0c0c0c] z-30">
              LV.{displayProfile.level || 1}
            </div>

            {isMyProfile && (
               <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-2 right-2 bg-purple-600 text-white p-3 rounded-full border-4 border-[#0c0c0c] shadow-lg active:scale-110 transition-all z-30"
               >
                <Camera size={18} />
               </button>
            )}
          </div>

          <div className="text-center space-y-2 mb-8">
            <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">
              {displayProfile.displayName}
            </h2>
            <div className="flex justify-center py-1">
              <PremiumTag email={displayProfile.email} role={displayProfile.role} size="md" />
            </div>
            <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.4em] italic mb-4">
              {displayProfile.role === 'admin' ? 'ADM + AURA + EGO' : 'AURORA • EXPLORADOR'}
            </p>
            
            <div className="flex items-center justify-center gap-3">
               <div 
                  className="bg-white/5 px-4 py-2 rounded-2xl flex items-center gap-3 border border-white/5"
               >
                 <span className="text-[10px] font-black text-white/40 tracking-widest uppercase">ID: {displayProfile.displayId}</span>
                 <div className="w-1 h-1 bg-green-500 rounded-full glow-green"></div>
               </div>
            </div>
          </div>

          <div className="w-full flex justify-center gap-4 mb-10">
            {isMyProfile ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="flex-1 max-w-[200px] h-14 bg-white/5 border border-purple-500/30 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white hover:bg-purple-500/10 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <Edit2 size={18} className="text-purple-400" /> Editar Perfil
              </button>
            ) : (
              <div className="flex w-full gap-3 flex-col sm:flex-row">
                <button 
                  onClick={() => followUser(displayProfile.uid)}
                  className={`flex-1 h-14 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl ${
                    myProfile.following?.includes(displayProfile.uid)
                      ? 'bg-zinc-900 border border-white/5 text-white/40'
                      : 'bg-white text-black'
                  }`}
                >
                  {myProfile.following?.includes(displayProfile.uid) ? 'Seguindo' : 'Seguir'}
                </button>
                <button 
                  onClick={() => setIsGiftBoxOpen(true)}
                  className="flex-1 h-14 bg-gradient-to-r from-pink-500 to-rose-600 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-pink-500/10 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Gift size={16} /> Presentear
                </button>
                <button 
                  onClick={() => navigate(`/chat/${displayProfile.uid}`)}
                  className="w-14 h-14 bg-purple-600 rounded-2xl flex items-center justify-center text-white shrink-0"
                >
                  <MessageCircle size={22} />
                </button>
              </div>
            )}
          </div>

          {!isMyProfile && isSuperAdmin && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full border border-red-500/20 bg-red-950/10 rounded-[28px] p-6 mb-10 space-y-4 shadow-xl"
            >
              <div className="flex items-center gap-2 text-red-400 font-extrabold text-xs uppercase tracking-widest">
                <Shield size={16} className="text-red-500" /> PAINEL MESTRE DE MODERAÇÃO
              </div>
              <p className="text-[10px] text-white/40 leading-relaxed font-semibold uppercase tracking-wider">Ajuste de cargo e status para {displayProfile.displayName}</p>
              
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={async () => {
                    const nextRole = displayProfile.role === 'admin' ? 'user' : 'admin';
                    try {
                      const userRef = doc(db, 'users', displayProfile.uid);
                      await updateDoc(userRef, { role: nextRole });
                      setDisplayProfile({ ...displayProfile, role: nextRole });
                      alert(nextRole === 'admin' ? "Promovido a ADM!" : "Rebaixado a Usuário!");
                    } catch (err) {
                      console.error(err);
                      alert("Erro ao alterar cargo.");
                    }
                  }}
                  className={`py-3.5 px-2 rounded-2xl border text-[10px] font-black uppercase tracking-wider text-center transition-all cursor-pointer active:scale-95 ${
                    displayProfile.role === 'admin'
                      ? 'bg-red-500/20 border-red-500/40 text-red-300'
                      : 'bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                  }`}
                >
                  {displayProfile.role === 'admin' ? 'Remover ADM' : 'Tornar ADM'}
                </button>

                <button
                  onClick={async () => {
                    const nextVip = !displayProfile.isVip;
                    try {
                      const userRef = doc(db, 'users', displayProfile.uid);
                      await updateDoc(userRef, { isVip: nextVip });
                      setDisplayProfile({ ...displayProfile, isVip: nextVip });
                      alert(nextVip ? "Status VIP Concedido!" : "Status VIP Removido!");
                    } catch (err) {
                      console.error(err);
                      alert("Erro ao alterar VIP.");
                    }
                  }}
                  className={`py-3.5 px-2 rounded-2xl border text-[10px] font-black uppercase tracking-wider text-center transition-all cursor-pointer active:scale-95 ${
                    displayProfile.isVip
                      ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.15)]'
                      : 'bg-white/5 border-white/5 text-white/40 hover:text-white'
                  }`}
                >
                  {displayProfile.isVip ? 'Remover VIP' : 'Tornar VIP'}
                </button>

                <button
                  onClick={async () => {
                    const nextBan = !displayProfile.isBanned;
                    try {
                      const userRef = doc(db, 'users', displayProfile.uid);
                      await updateDoc(userRef, { isBanned: nextBan, bannedUntil: null });
                      setDisplayProfile({ ...displayProfile, isBanned: nextBan });
                      alert(nextBan ? "Usuário Banido!" : "Usuário Desbanido!");
                    } catch (err) {
                      console.error(err);
                      alert("Erro ao alterar Ban.");
                    }
                  }}
                  className={`py-3.5 px-2 rounded-2xl border text-[10px] font-black uppercase tracking-wider text-center transition-all cursor-pointer active:scale-95 ${
                    displayProfile.isBanned
                      ? 'bg-red-600 border-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                      : 'bg-white/5 border-white/5 text-white/40 hover:text-white'
                  }`}
                >
                  {displayProfile.isBanned ? 'Desbanir' : 'Banir'}
                </button>
              </div>
            </motion.div>
          )}

          {/* Stats Bar Grid */}
          <div className="w-full grid grid-cols-3 gap-4 mb-10">
            {stats.map((stat) => (
              <div key={stat.label} className="premium-card p-6 flex flex-col items-center justify-center text-center">
                 <div className={`text-3xl font-black italic tracking-tighter mb-1 ${stat.color} filter drop-shadow-[0_0_10px_currentColor]`}>
                   {stat.value}
                 </div>
                 <div className="text-[10px] text-white/20 font-black uppercase tracking-widest italic">
                   {stat.label}
                 </div>
              </div>
            ))}
          </div>

          {/* Achievements - Screenshot Style */}
          <section className="w-full space-y-6 mb-10">
             <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                   <Shield size={20} className="text-purple-500" />
                   <h3 className="text-lg font-black text-white italic uppercase tracking-tight">Conquistas</h3>
                </div>
                <button className="text-[10px] font-black text-purple-500 uppercase tracking-widest flex items-center gap-1">
                   Ver Tudo <ChevronRight size={14} />
                </button>
             </div>
             
             <div className="grid grid-cols-4 gap-4">
                {[
                  { icon: Trophy, color: 'neon-border-yellow text-yellow-500', name: 'Mestre' },
                  { icon: Shield, color: 'neon-border-blue text-blue-500', name: 'Fiel' },
                  { icon: Calendar, color: 'neon-border-green text-green-500', name: 'Veterano' },
                  { icon: MapPin, color: 'neon-border-pink text-pink-500', name: 'Explorador' },
                ].map((badge, i) => (
                  <div key={i} className="flex flex-col items-center gap-3">
                    <div className={`w-full aspect-square bg-[#0c0c0c] rounded-[24px] flex items-center justify-center transition-all hover:scale-110 ${badge.color}`}>
                       <badge.icon size={32} />
                    </div>
                    <span className="text-[9px] font-black uppercase text-white/30 tracking-tighter italic">{badge.name}</span>
                  </div>
                ))}
             </div>
          </section>

          {/* Progress Bar - Screenshot Style */}
          <section className="w-full premium-card p-8 mb-10 relative group overflow-hidden">
             <div className="absolute right-[-20px] bottom-[-20px] opacity-20 group-hover:scale-110 transition-transform duration-700">
                <Gamepad2 size={120} className="text-purple-500" />
             </div>
             
             <div className="flex justify-between items-center mb-6 relative z-10">
                <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] italic opacity-60">Progresso de Nível</h3>
                <span className="text-xs font-black text-purple-400 italic">750 / 1000 XP</span>
             </div>
             
             <div className="relative z-10">
                <div className="w-full h-2.5 bg-black rounded-full overflow-hidden">
                   <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: '75%' }}
                     className="h-full bg-gradient-to-r from-purple-600 via-purple-400 to-blue-500 rounded-full shadow-[0_0_20px_rgba(168,85,247,0.5)]"
                   />
                </div>
                <p className="text-[10px] text-white/20 font-medium italic mt-6">Continue jogando para subir de nível!</p>
             </div>
          </section>

          {/* WeAura Prestige & Social Influence Tracker */}
          {(() => {
            const auraPoints = displayProfile.aura || 0;
            const auraInfo = getAuraLevelInfo(auraPoints);
            const currentAuraLevel = auraInfo.level;
            const minPoints = auraInfo.minAura;
            const maxPoints = auraInfo.maxAura || 50000;
            const targetDiff = maxPoints - minPoints;
            const earnedInLevel = auraPoints - minPoints;
            const auraProgressPct = Math.max(0, Math.min(100, targetDiff > 0 ? Math.floor((earnedInLevel / targetDiff) * 100) : 100));

            return (
              <section className="w-full premium-card p-8 mb-10 relative group overflow-hidden border border-purple-500/10">
                {/* Background Ambient Glow */}
                <div className="absolute top-0 right-0 w-36 h-36 bg-purple-500/10 rounded-full blur-3xl pointer-events-none transition-transform duration-700 group-hover:scale-150" />
                
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-400 italic mb-1.5 flex items-center gap-1.5">
                      <Sparkles size={11} className="text-pink-500/80" /> WeAura Prestige
                    </span>
                    <h3 className="text-2xl font-black text-white italic truncate uppercase">
                      Nível {currentAuraLevel} • {auraInfo.name}
                    </h3>
                  </div>
                  <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-2xl flex items-center gap-1.5 shrink-0">
                     <span className="text-lg">✨</span>
                     <span className="text-sm font-extrabold text-white tabular-nums">{auraPoints}</span>
                  </div>
                </div>

                <div className="relative z-10 space-y-6">
                  {/* Progress Bar with Aura Colors */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-white/40 uppercase">
                      <span>Progresso da Popularidade</span>
                      <span>{auraPoints - minPoints} / {targetDiff} AURA</span>
                    </div>
                    <div className="w-full h-3.5 bg-black rounded-full overflow-hidden p-0.5 border border-white/5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${auraProgressPct}%` }}
                        className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-full shadow-[0_0_20px_rgba(168,85,247,0.6)]"
                      />
                    </div>
                  </div>

                  {/* Level Benefits unlocked list */}
                  <div className="bg-black/40 border border-white/[0.04] p-5 rounded-3xl space-y-3.5">
                    <h4 className="text-[10px] font-black text-white/30 uppercase tracking-widest italic flex items-center gap-2">
                      <Unlock size={11} className="text-emerald-400" /> Benefícios do Nível
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-semibold text-white/70">
                      {currentAuraLevel >= 1 && <div className="flex items-center gap-2">🟢 <span className="opacity-95">Insígnia {auraInfo.name}</span></div>}
                      {currentAuraLevel >= 2 && <div className="flex items-center gap-2">🟢 <span className="opacity-95">Moldura Esmeralda no Avatar</span></div>}
                      {currentAuraLevel >= 3 && <div className="flex items-center gap-2">🟢 <span className="opacity-95">Efeito Pulso Luminoso</span></div>}
                      {currentAuraLevel >= 4 && <div className="flex items-center gap-2">🟢 <span className="opacity-95">Holograma Rotativo VIP</span></div>}
                      {currentAuraLevel >= 5 && <div className="flex items-center gap-2">🟢 <span className="opacity-95">Glow Imperial Dourado</span></div>}
                      {currentAuraLevel >= 6 && <div className="flex items-center gap-2">🟢 <span className="opacity-95">Aura Cósmica Multicromática</span></div>}
                    </div>
                  </div>
                </div>
              </section>
            );
          })()}

          {/* Virtual Gifts Chest Received Gallery */}
          <section className="w-full space-y-6 mb-10">
            <div className="flex items-center justify-between px-2">
               <div className="flex items-center gap-3">
                  <Gift size={20} className="text-pink-500" />
                  <h3 className="text-lg font-black text-white italic uppercase tracking-tight">Estojo de Presentes Recebidos</h3>
               </div>
               <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                 {receivedGifts.length} Recebidos
               </span>
            </div>

            {receivedGifts.length === 0 ? (
              <div className="premium-card p-12 text-center text-white/20 italic text-sm border-dashed">
                <Gift className="mx-auto mb-4 opacity-10 animate-bounce" size={40} />
                Nenhum presente recebido ainda. Seja o primeiro a animar o perfil!
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {(() => {
                  const giftCounts = receivedGifts.reduce((acc: any, t: any) => {
                    acc[t.giftId] = (acc[t.giftId] || 0) + 1;
                    return acc;
                  }, {});

                  return GIFTS.map((gift) => {
                    const count = giftCounts[gift.id] || 0;
                    return (
                      <div 
                        key={gift.id} 
                        className={`relative p-5 rounded-[28px] border bg-[#0c0c0c] flex flex-col items-center justify-center transition-all ${
                          count > 0 ? 'border-pink-500/20 shadow-[0_5px_15px_rgba(244,63,94,0.05)]' : 'border-white/[0.04] opacity-35'
                        }`}
                      >
                        {count > 0 && (
                          <div className="absolute top-3 right-3 bg-pink-500 text-white text-[9px] font-black leading-none px-2 py-1 rounded-lg">
                            x{count}
                          </div>
                        )}
                        <span className="text-4xl mb-2.5 filter drop-shadow-[0_5px_10px_rgba(0,0,0,0.5)]">{gift.icon}</span>
                        <span className="text-xs font-bold text-white uppercase tracking-wider text-center">{gift.name}</span>
                        <span className="text-[10px] font-semibold text-purple-400 mt-1 uppercase">+{gift.aura} Aura</span>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </section>

          {/* Gift Selection slide-up Modal drawer */}
          <AnimatePresence>
            {isGiftBoxOpen && !isMyProfile && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsGiftBoxOpen(false)}
                  className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[60]"
                />
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  className="fixed inset-x-0 bottom-0 bg-[#0a0a0a] rounded-t-[40px] border-t border-pink-500/20 p-8 z-[70] pb-12 shadow-2xl"
                >
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex flex-col">
                      <h3 className="text-xl font-black text-white italic tracking-tighter uppercase flex items-center gap-2">
                        <Gift size={20} className="text-pink-500" /> Baú de Presentes
                      </h3>
                      <span className="text-[10px] font-black text-white/30 uppercase tracking-widest mt-1">
                        Seu Saldo: <span className="text-yellow-400">🪙 {myProfile?.coins || 0} Moedas</span>
                      </span>
                    </div>
                    <button 
                      onClick={() => setIsGiftBoxOpen(false)} 
                      className="p-2.5 bg-white/5 rounded-2xl text-white/30 hover:text-white transition-all hover:scale-105 active:scale-95"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Quantity Selector */}
                  <div className="mb-6 bg-white/[0.02] border border-white/[0.04] p-4 rounded-[24px] flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.25em] italic">
                      Selecione a Quantidade de Envio:
                    </span>
                    <div className="flex items-center gap-2">
                      {[1, 5, 10, 50, 100].map((q) => (
                        <button
                          key={q}
                          onClick={() => setGiftQuantity(q)}
                          className={`px-3 py-1.5 rounded-2xl text-xs font-black transition-all ${
                            giftQuantity === q
                              ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg shadow-pink-500/25'
                              : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          x{q}
                        </button>
                      ))}
                      {/* Custom Input */}
                      <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-2xl border border-white/5">
                        <span className="text-[9px] font-black text-white/20 uppercase">Custom</span>
                        <input
                          type="number"
                          min="1"
                          max="999"
                          value={giftQuantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setGiftQuantity(isNaN(val) || val < 1 ? 1 : val);
                          }}
                          className="w-12 bg-transparent text-center text-xs font-black text-pink-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Gifts Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {GIFTS.map((gift) => {
                      const totalCost = gift.price * giftQuantity;
                      const hasEnough = (myProfile?.coins || 0) >= totalCost;
                      return (
                        <button
                          key={gift.id}
                          disabled={isSendingGift || !hasEnough}
                          onClick={async () => {
                            setIsSendingGift(true);
                            try {
                              const result = await sendGift(displayProfile.uid, gift.id, undefined, undefined, giftQuantity);
                              if (result.success) {
                                setIsGiftBoxOpen(false);
                                // Set local animation trigger
                                setActiveAnimation({
                                  id: Math.random().toString(),
                                  senderName: myProfile?.displayName || "Usuário",
                                  receiverName: displayProfile.displayName,
                                  giftName: result.giftName,
                                  giftIcon: result.giftIcon,
                                  auraGained: result.auraGained,
                                  quantity: result.quantity,
                                  coinsGained: result.coinsGained
                                });
                                // Reload gift shelf
                                const q = query(collection(db, 'gift_transactions'), where('receiverId', '==', displayProfile.uid), limit(24));
                                const snap = await getDocs(q);
                                const list = snap.docs.map(doc => doc.data());
                                list.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                                setReceivedGifts(list);
                              }
                            } catch (err: any) {
                              alert(err.message || "Erro ao presentear.");
                            } finally {
                              setIsSendingGift(false);
                            }
                          }}
                          className={`p-6 rounded-[32px] border flex flex-col items-center justify-center text-center transition-all bg-black/40 hover:bg-white/[0.02] ${
                            hasEnough 
                              ? 'border-white/5 hover:border-pink-500/30 active:scale-95 cursor-pointer' 
                              : 'border-red-500/10 opacity-40 cursor-not-allowed'
                          }`}
                        >
                          <span className="text-5xl mb-3 filter drop-shadow-[0_5px_12px_rgba(0,0,0,0.5)]">{gift.icon}</span>
                          <span className="font-extrabold text-sm text-white uppercase tracking-wide">{gift.name}</span>
                          <span className="text-xs font-black text-yellow-400 mt-2">🪙 {totalCost} moedas</span>
                          <span className="text-[9px] font-bold text-pink-400 mt-1 uppercase tracking-widest bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-lg">
                            +{gift.aura * giftQuantity} Aura
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="text-center text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">
                    O destinatário receberá pontos de aura de prestígio instantaneamente.
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <GiftAnimationOverlay activeAnimation={activeAnimation} onAnimationComplete={() => setActiveAnimation(null)} />
        </div>
      </div>

      <AdminMenu isOpen={isAdminPanelOpen} onClose={() => setIsAdminPanelOpen(false)} />

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditing && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditing(false)}
              className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[60]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="fixed inset-x-0 bottom-0 bg-[#0a0a0a] rounded-t-[40px] border-t border-white/5 p-8 z-[70] pb-12 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <div className="flex flex-col">
                  <h3 className="text-xl font-bold text-white leading-tight">Editar Perfil</h3>
                  <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest mt-0.5">Atualize seus dados</span>
                </div>
                <button onClick={() => setIsEditing(false)} className="p-2.5 bg-white/5 rounded-2xl text-white/30 hover:text-white transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4 mb-8">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/20 ml-1">Foto de Perfil</label>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-3 bg-white/5 border border-white/5 rounded-2xl p-5 text-white hover:bg-white/10 transition-all group"
                  >
                    <Camera size={20} className="text-purple-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold uppercase tracking-widest">Galeria</span>
                  </button>
                  <button 
                    type="button"
                    onClick={regenerateAvatar}
                    className="flex items-center justify-center gap-3 bg-white/5 border border-white/5 rounded-2xl p-5 text-white hover:bg-white/10 transition-all group"
                  >
                    <RefreshCw size={20} className="text-blue-400 group-hover:rotate-180 transition-all duration-500" />
                    <span className="text-xs font-bold uppercase tracking-widest">Gerar</span>
                  </button>
                </div>

                <div className="space-y-2 mt-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/20 ml-1">Ou cole uma URL de imagem</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="https://exemplo.com/imagem.png"
                      className="flex-1 bg-white/5 border border-white/5 rounded-2xl p-4 text-white text-sm font-semibold outline-none focus:border-white/20 transition-all pointer-events-auto"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (imageUrlInput.trim()) {
                          try {
                            await updateProfile({ photoURL: imageUrlInput.trim() });
                            alert("Foto de perfil atualizada!");
                            setImageUrlInput('');
                          } catch (e) {
                            alert("Erro ao salvar link da imagem.");
                          }
                        }
                      }}
                      className="bg-white text-black px-6 rounded-2xl font-bold uppercase text-[10px] tracking-widest transition-all active:scale-95 cursor-pointer"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/20 ml-1">Nome de exibição</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-white text-sm font-bold outline-none focus:border-white/20 transition-all"
                    placeholder="Seu nome..."
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/20 ml-1">Bio</label>
                  <textarea
                    rows={3}
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-white text-sm outline-none focus:border-white/20 transition-all resize-none"
                    placeholder="Sua bio..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full bg-white text-black py-5 rounded-2xl font-bold uppercase text-xs tracking-widest active:scale-95 transition-all disabled:opacity-20 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                     <div className="w-4 h-4 border-2 border-black/10 border-t-black rounded-full animate-spin"></div>
                  ) : 'Salvar Alterações'}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

