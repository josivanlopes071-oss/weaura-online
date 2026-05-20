import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Shield, Trophy, MapPin, Calendar, LogOut, Edit2, X, Check, Camera, RefreshCw, UserMinus, Search, ChevronRight, UserPlus, MessageCircle, Star, Flame, Gamepad2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import AdminMenu from '../components/AdminMenu';
import UserAvatar from '../components/UserAvatar';

export default function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile: myProfile, logout, updateProfile, followUser } = useAuth();
  
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
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  if (!displayProfile || !user || !myProfile) return null;

  const SUPER_ADMINS = ['josivanlopes071@gmail.com', 'manoeldasilva631kejr@gmail.com'];
  const isSuperAdmin = SUPER_ADMINS.includes(user.email || '');

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
    if (SUPER_ADMINS.includes(foundUser.email || '')) {
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
    if (SUPER_ADMINS.includes(foundUser.email || '')) {
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
              <div className="flex w-full gap-3">
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
                  onClick={() => navigate(`/chat/${displayProfile.uid}`)}
                  className="w-14 h-14 bg-purple-600 rounded-2xl flex items-center justify-center text-white"
                >
                  <MessageCircle size={22} />
                </button>
              </div>
            )}
          </div>

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

