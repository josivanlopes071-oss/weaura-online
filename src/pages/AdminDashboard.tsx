import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, Users, MessageSquare, Layout, Lock, Bell, BarChart3, 
  Search, Filter, Trash2, Edit3, CheckCircle2, XCircle, 
  AlertTriangle, History, Info, ExternalLink, Settings, 
  Crown, Zap, Coins, Flag, Eye, EyeOff, Globe, 
  Server, Database, Activity, Terminal, Ban, Megaphone,
  UserPlus, UserMinus, ShieldAlert, Monitor, Fingerprint,
  Mail, Calendar, ArrowUpRight, ArrowDownRight, MoreVertical,
  ChevronRight, RefreshCw, Smartphone, Laptop, Tablet, 
  X, Check, Plus, Minus, Download, Save, Undo2
} from 'lucide-react';
import { useAuth, UserRole, getRoleLevel } from '../contexts/AuthContext';
import { auth, db } from '../lib/firebase';
import { 
  collection, query, getDocs, doc, getDoc, updateDoc, 
  onSnapshot, where, orderBy, limit, serverTimestamp, 
  addDoc, deleteDoc, writeBatch, Timestamp, increment, setDoc
} from 'firebase/firestore';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  Cell, PieChart, Pie
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type AdminTab = 'overview' | 'users' | 'rooms' | 'reports' | 'finance' | 'security' | 'announcements' | 'logs' | 'team';

export default function AdminDashboard() {
  const { profile, user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    onlineUsers: 0,
    totalRooms: 0,
    activeReports: 0,
    dailyActive: 0,
    monthlyRevenue: 0,
  });

  // Role verification - must be at least Moderator to see the panel
  // but some tabs might be Owner-only
  const userRole = profile?.role || 'user';
  const roleLevel = getRoleLevel(userRole);

  useEffect(() => {
    // Permission check: Redirect if not staff
    if (roleLevel < 1) {
      window.location.href = '/';
      return;
    }

    setLoading(true);
    // Real-time stats
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const total = snap.size;
      const online = snap.docs.filter(d => d.data().status === 'online').length;
      setStats(prev => ({ ...prev, totalUsers: total, onlineUsers: online }));
    }, (err) => console.log("Users snapshot restricted:", err));

    const unsubRooms = onSnapshot(collection(db, 'rooms'), (snap) => {
      setStats(prev => ({ ...prev, totalRooms: snap.size }));
    }, (err) => console.log("Rooms snapshot restricted:", err));

    const unsubReports = onSnapshot(query(collection(db, 'reports'), where('status', '==', 'pending')), (snap) => {
      setStats(prev => ({ ...prev, activeReports: snap.size }));
    }, (err) => console.log("Reports snapshot restricted:", err));

    setLoading(false);

    return () => {
      unsubUsers();
      unsubRooms();
      unsubReports();
    };
  }, [profile, roleLevel]);

  if (loading || !profile) return <div className="min-h-screen bg-[#050505] flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
  </div>;

  return (
    <div className="min-h-screen bg-[#020202] text-white flex flex-col md:flex-row font-sans selection:bg-purple-500/30">
      {/* Dynamic Sidebar */}
      <aside className="w-full md:w-72 bg-[#080808] border-r border-white/5 flex flex-col h-screen sticky top-0 z-50">
        <div className="p-8">
           <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-blue-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                 <Shield size={24} className="text-white" />
              </div>
              <h1 className="text-xl font-black italic tracking-tighter uppercase whitespace-nowrap">Aura Global</h1>
           </div>
           <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.3em] ml-1">Terminal de Comando Staff</p>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto scrollbar-hide py-4">
           <NavItem icon={BarChart3} label="Dashboard" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
           <div className="h-px bg-white/5 my-4 mx-4"></div>
           <NavItem icon={Users} label="Usuários" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
           <NavItem icon={Layout} label="Salas & Eventos" active={activeTab === 'rooms'} onClick={() => setActiveTab('rooms')} />
           <NavItem icon={Flag} label="Denúncias" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} count={stats.activeReports} />
           <div className="h-px bg-white/5 my-4 mx-4"></div>
           {roleLevel >= 2 && <NavItem icon={Coins} label="Economia & Shop" active={activeTab === 'finance'} onClick={() => setActiveTab('finance')} />}
           {roleLevel >= 2 && <NavItem icon={ShieldAlert} label="Segurança" active={activeTab === 'security'} onClick={() => setActiveTab('security')} />}
           {roleLevel >= 2 && <NavItem icon={Megaphone} label="Notificações" active={activeTab === 'announcements'} onClick={() => setActiveTab('announcements')} />}
           <div className="h-px bg-white/5 my-4 mx-4"></div>
           <NavItem icon={Terminal} label="Logs do Sistema" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
           {roleLevel >= 3 && <NavItem icon={Crown} label="Equipe Staff" active={activeTab === 'team'} onClick={() => setActiveTab('team')} />}
        </nav>

        <div className="p-6 mt-auto border-t border-white/5">
           <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
              <img src={profile.photoURL} className="w-10 h-10 rounded-xl object-cover ring-2 ring-purple-500/20" alt="" />
              <div className="min-w-0">
                 <p className="text-xs font-black text-white truncate uppercase italic">{profile.displayName}</p>
                 <p className="text-[8px] font-bold text-purple-400 uppercase tracking-widest">{profile.role}</p>
              </div>
           </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
         {/* Top Header Barra */}
         <header className="h-20 border-b border-white/5 px-8 flex items-center justify-between bg-[#020202]/50 backdrop-blur-xl sticky top-0 z-40">
            <div className="flex items-center gap-2">
               <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Painel Automático</span>
               <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
            </div>

            <div className="flex items-center gap-6">
               <div className="flex items-center gap-4 text-xs font-bold text-white/40 uppercase tracking-widest border-r border-white/10 pr-6">
                  <span>Server 01: <span className="text-green-500">Normal</span></span>
                  <span>RT: <span className="text-blue-500">22ms</span></span>
               </div>
               <button className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white/40 hover:text-white transition-all">
                  <RefreshCw size={18} />
               </button>
            </div>
         </header>

         {/* Content container */}
         <div className="p-8 md:p-12 max-w-7xl w-full mx-auto pb-40">
            <AnimatePresence mode="wait">
               {activeTab === 'overview' && <OverviewTab stats={stats} />}
               {activeTab === 'users' && <UsersTab roleLevel={roleLevel} />}
               {activeTab === 'rooms' && <RoomsTab roleLevel={roleLevel} />}
               {activeTab === 'security' && <SecurityTab roleLevel={roleLevel} />}
               {activeTab === 'finance' && <FinanceTab />}
               {activeTab === 'reports' && <ReportsTab />}
               {activeTab === 'logs' && <LogsTab />}
               {activeTab === 'announcements' && <AnnouncementsTab />}
               {activeTab === 'team' && <TeamTab userRole={userRole} />}
            </AnimatePresence>
         </div>
      </main>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick, count }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group ${active ? 'bg-purple-600 text-white shadow-[0_10px_20px_rgba(168,85,247,0.2)]' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}
    >
      <div className="flex items-center gap-4">
        <Icon size={20} className={active ? 'text-white' : 'group-hover:text-purple-400 transition-colors'} />
        <span className="text-[11px] font-black uppercase tracking-widest italic">{label}</span>
      </div>
      {count !== undefined && count > 0 && (
        <span className="bg-red-500 text-white text-[9px] font-black w-5 h-5 rounded-lg flex items-center justify-center shadow-lg animate-bounce">
          {count}
        </span>
      )}
    </button>
  );
}

// --- TAB COMPONENTS ---

function OverviewTab({ stats }: { stats: any }) {
  const chartData = [
    { name: 'Seg', users: 120, rooms: 15 },
    { name: 'Ter', users: 150, rooms: 22 },
    { name: 'Qua', users: 180, rooms: 18 },
    { name: 'Qui', users: 220, rooms: 30 },
    { name: 'Sex', users: 310, rooms: 45 },
    { name: 'Sáb', users: 450, rooms: 60 },
    { name: 'Dom', users: 400, rooms: 40 },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
      <div className="flex items-end justify-between">
         <div>
            <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-2">Visão Geral</h2>
            <p className="text-white/30 text-xs font-bold uppercase tracking-widest">Estatísticas Vitais do Sistema</p>
         </div>
         <div className="bg-white/5 px-6 py-3 rounded-2xl border border-white/5 text-[10px] font-black uppercase tracking-widest text-white/30 italic">
            Atualizado: {format(new Date(), 'HH:mm:ss')}
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <StatCard label="Total de Usuários" value={stats.totalUsers} icon={Users} color="text-blue-500" trend="+12% vs ontem" />
         <StatCard label="Online Agora" value={stats.onlineUsers} icon={Activity} color="text-green-500" trend="Pico de 1.2k esperado" />
         <StatCard label="Salas Ativas" value={stats.totalRooms} icon={Layout} color="text-purple-500" trend="8 salas premium" />
         <StatCard label="Denúncias Pendentes" value={stats.activeReports} icon={Flag} color="text-red-500" trend="Prioridade: Alta" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 bg-[#0c0c0c] rounded-[40px] border border-white/5 p-10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform duration-1000">
               <ArrowUpRight size={200} className="text-purple-500" />
            </div>
            <div className="flex items-center justify-between mb-10 relative z-10">
               <h3 className="text-lg font-black uppercase italic tracking-tight">Atividade de Usuários</h3>
               <select className="bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase p-2 outline-none">
                  <option value="7d">Últimos 7 dias</option>
                  <option value="30d">Último Mês</option>
               </select>
            </div>
            <div className="h-80 w-full relative z-10">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                     <defs>
                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                           <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff08" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#ffffff30', fontSize: 10, fontWeight: 900}} dy={10} />
                     <YAxis axisLine={false} tickLine={false} tick={{fill: '#ffffff30', fontSize: 10, fontWeight: 900}} />
                     <Tooltip 
                        contentStyle={{backgroundColor: '#0c0c0c', border: '1px solid #ffffff10', borderRadius: '16px', fontSize: '12px'}}
                        itemStyle={{color: '#fff', fontWeight: 900}}
                     />
                     <Area type="monotone" dataKey="users" stroke="#8b5cf6" strokeWidth={4} fillOpacity={1} fill="url(#colorUsers)" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="bg-[#0c0c0c] rounded-[40px] border border-white/5 p-10 flex flex-col justify-between">
            <div>
               <h3 className="text-lg font-black uppercase italic tracking-tight mb-8">Saúde do Sistema</h3>
               <div className="space-y-6">
                  <HealthBar label="Banco de Dados" percent={98} color="bg-green-500" />
                  <HealthBar label="Servidor Media" percent={82} color="bg-blue-500" />
                  <HealthBar label="WebSocket Latência" percent={95} color="bg-purple-500" />
                  <HealthBar label="Armazenamento" percent={45} color="bg-yellow-500" />
               </div>
            </div>
            <div className="mt-10 p-6 bg-white/5 rounded-3xl border border-white/5 space-y-3">
               <div className="flex items-center gap-3 text-[10px] font-black uppercase text-white/30 tracking-widest">
                  <Server size={14} className="text-purple-500" /> Host: Google Cloud Run
               </div>
               <div className="flex items-center gap-3 text-[10px] font-black uppercase text-white/30 tracking-widest">
                  <Database size={14} className="text-blue-500" /> DB: Firestore (us-east1)
               </div>
            </div>
         </div>
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, icon: Icon, color, trend }: any) {
  return (
    <div className="bg-[#0c0c0c] p-8 rounded-[32px] border border-white/5 hover:border-purple-500/20 transition-all group card-shine">
      <div className="flex items-start justify-between mb-6">
         <div className={`p-4 rounded-2xl bg-white/5 ${color} group-hover:scale-110 transition-transform duration-500`}>
            <Icon size={24} />
         </div>
         <span className="text-[9px] font-bold text-green-500 uppercase bg-green-500/10 px-2 py-1 rounded-lg">{trend}</span>
      </div>
      <p className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em] italic mb-1">{label}</p>
      <h4 className="text-4xl font-black text-white italic tracking-tighter">{value.toLocaleString()}</h4>
    </div>
  );
}

function HealthBar({ label, percent, color }: any) {
   return (
      <div className="space-y-2">
         <div className="flex justify-between text-[10px] font-black uppercase tracking-widest italic">
            <span className="text-white/40">{label}</span>
            <span className="text-white">{percent}%</span>
         </div>
         <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${percent}%` }} className={`h-full ${color} shadow-[0_0_10px_currentColor]`} />
         </div>
      </div>
   );
}

function UsersTab({ roleLevel }: { roleLevel: number }) {
   const [searchQuery, setSearchQuery] = useState('');
   const [users, setUsers] = useState<any[]>([]);
   const [loadingUsers, setLoadingUsers] = useState(false);
   const [selectedUser, setSelectedUser] = useState<any>(null);

   const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
         const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(50));
         const snap = await getDocs(q);
         setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
         console.error(err);
      } finally {
         setLoadingUsers(false);
      }
   };

   const handleGlobalSearch = async () => {
      if (!searchQuery.trim()) return;
      setLoadingUsers(true);
      try {
         // 1. Try search by UID
         const userDoc = await getDoc(doc(db, 'users', searchQuery.trim()));
         if (userDoc.exists()) {
            const foundUser = { id: userDoc.id, ...userDoc.data() };
            setUsers(prev => {
               const exists = prev.find(u => u.id === foundUser.id);
               if (exists) return prev;
               return [foundUser, ...prev];
            });
            setSelectedUser(foundUser);
            return;
         }

         // 2. Try search by Display ID (numerical)
         const numericId = parseInt(searchQuery.trim());
         if (!isNaN(numericId)) {
            const q = query(collection(db, 'users'), where('displayId', '==', numericId), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty) {
               const foundUser = { id: snap.docs[0].id, ...snap.docs[0].data() };
               setUsers(prev => {
                  const exists = prev.find(u => u.id === foundUser.id);
                  if (exists) return prev;
                  return [foundUser, ...prev];
               });
               setSelectedUser(foundUser);
               return;
            }
         }
         
         alert("Usuário não encontrado no banco de dados.");
      } catch (err) {
         console.error("Search error:", err);
         alert("Erro ao realizar busca.");
      } finally {
         setLoadingUsers(false);
      }
   };

   useEffect(() => { fetchUsers(); }, []);

   const filteredUsers = useMemo(() => {
      if (!searchQuery) return users;
      const lower = searchQuery.toLowerCase();
      return users.filter(u => 
         u.displayName?.toLowerCase().includes(lower) || 
         u.displayId?.toString().includes(searchQuery) ||
         u.id.toLowerCase().includes(lower)
      );
   }, [users, searchQuery]);

   const toggleBan = async (u: any, durationMs?: number) => {
      // Owner protection
      if (getRoleLevel(u.role) >= roleLevel && u.role !== 'user') {
         alert("Permissão insuficiente para alterar moderadores deste nível.");
         return;
      }
      
      const newBanState = !u.isBanned;
      const bannedUntil = durationMs ? Timestamp.fromDate(new Date(Date.now() + durationMs)) : null;

      try {
         await updateDoc(doc(db, 'users', u.id), {
            isBanned: newBanState,
            bannedUntil: newBanState ? bannedUntil : null,
            updatedAt: serverTimestamp()
         });
         setUsers(prev => prev.map(usr => usr.id === u.id ? { ...usr, isBanned: newBanState, bannedUntil } : usr));
         if (selectedUser?.id === u.id) setSelectedUser({ ...selectedUser, isBanned: newBanState, bannedUntil });
      } catch (err) {
         console.error(err);
      }
   };

   const toggleMute = async (u: any) => {
      const newMuteState = !u.isMuted;
      try {
         await updateDoc(doc(db, 'users', u.id), {
            isMuted: newMuteState,
            updatedAt: serverTimestamp()
         });
         setUsers(prev => prev.map(usr => usr.id === u.id ? { ...usr, isMuted: newMuteState } : usr));
         if (selectedUser?.id === u.id) setSelectedUser({ ...selectedUser, isMuted: newMuteState });
      } catch (err) {
         console.error(err);
      }
   };

   const changeRole = async (u: any, newRole: UserRole) => {
      if (roleLevel < 3) return; // Only superadmin+ can change roles
      try {
         await updateDoc(doc(db, 'users', u.id), { role: newRole });
         setUsers(prev => prev.map(usr => usr.id === u.id ? { ...usr, role: newRole } : usr));
         if (selectedUser?.id === u.id) setSelectedUser({ ...selectedUser, role: newRole });
         alert(`Cargo de ${u.displayName} alterado para ${newRole}`);
      } catch (err) {
         console.error(err);
      }
   };

   return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
               <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-1">Gerenciar Usuários</h2>
               <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest italic">Base de Dados Global • {users.length} Registros</p>
            </div>
            
            <form 
               onSubmit={(e) => { e.preventDefault(); handleGlobalSearch(); }}
               className="flex items-center gap-4 bg-[#0c0c0c] border border-white/5 rounded-3xl p-2 pl-6 focus-within:border-purple-500/50 transition-all w-full max-w-md"
            >
               <Search size={18} className="text-white/20" />
               <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nome, ID ou UID..." 
                  className="bg-transparent border-none outline-none text-xs font-bold text-white p-3 w-full" 
               />
               <button 
                  type="submit"
                  disabled={loadingUsers}
                  className="p-3 bg-purple-500/20 rounded-2xl text-purple-400 hover:bg-purple-500 hover:text-white transition-all disabled:opacity-50"
               >
                  <Search size={18} />
               </button>
            </form>
         </div>

         <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
            <div className="xl:col-span-3 bg-[#0c0c0c] rounded-[40px] border border-white/5 overflow-hidden shadow-2xl">
               <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                     <thead className="bg-white/[0.02] border-bottom border-white/5 text-[9px] font-black uppercase tracking-widest">
                        <tr>
                           <th className="px-8 py-6">Status</th>
                           <th className="px-8 py-6">Usuário</th>
                           <th className="px-8 py-6">Cargo</th>
                           <th className="px-8 py-6">Nível</th>
                           <th className="px-8 py-6 text-right">Ações</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-white/[0.03]">
                        {filteredUsers.map(u => (
                           <tr 
                              key={u.id} 
                              onClick={() => setSelectedUser(u)} 
                              className={`group cursor-pointer hover:bg-white/[0.03] transition-all ${selectedUser?.id === u.id ? 'bg-purple-500/5 border-l-2 border-purple-500' : ''}`}
                           >
                              <td className="px-8 py-5">
                                 {u.status === 'online' ? (
                                    <div className="flex items-center gap-2">
                                       <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]"></div>
                                       <span className="text-[9px] font-black text-green-500 uppercase italic">Online</span>
                                    </div>
                                 ) : (
                                    <div className="flex items-center gap-2">
                                       <div className="w-1.5 h-1.5 rounded-full bg-white/10"></div>
                                       <span className="text-[9px] font-black text-white/20 uppercase italic">Offline</span>
                                    </div>
                                 )}
                              </td>
                              <td className="px-8 py-5">
                                 <div className="flex items-center gap-4">
                                    <div className="relative">
                                       <img src={u.photoURL} className="w-10 h-10 rounded-xl object-cover" alt="" />
                                       {u.verified && <div className="absolute -top-1 -right-1 bg-blue-500 text-white rounded-full p-0.5 border-2 border-[#0c0c0c]"><Check size={8} strokeWidth={4} /></div>}
                                    </div>
                                    <div className="min-w-0">
                                       <p className="text-[13px] font-black text-white truncate uppercase italic">{u.displayName}</p>
                                       <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest mt-0.5">ID: {u.displayId}</p>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-8 py-5">
                                 <span className={`text-[9px] font-black px-3 py-1 rounded-lg uppercase italic ${
                                    u.role === 'owner' ? 'bg-red-500/10 text-red-500' : 
                                    u.role === 'admin' ? 'bg-orange-500/10 text-orange-500' : 
                                    u.role === 'moderator' ? 'bg-blue-500/10 text-blue-500' : 'bg-white/5 text-white/40'
                                 }`}>
                                    {u.role}
                                 </span>
                              </td>
                              <td className="px-8 py-5 text-xs font-black text-white/60 italic">LV.{u.level || 1}</td>
                              <td className="px-8 py-5 text-right">
                                 <div className="flex items-center justify-end gap-3 translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                                    <button className="p-2.5 bg-white/5 rounded-xl text-white/40 hover:text-white"><Eye size={16} /></button>
                                    <button className="p-2.5 bg-red-500/10 rounded-xl text-red-500 hover:bg-red-500 hover:text-white"><Ban size={16} /></button>
                                 </div>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
               {loadingUsers && (
                  <div className="p-12 flex justify-center"><RefreshCw className="animate-spin text-purple-500" /></div>
               )}
            </div>

            {/* Sidebar User Details */}
            <div className="xl:col-span-1 space-y-6">
               <AnimatePresence mode="wait">
                  {selectedUser ? (
                     <motion.div 
                        key={selectedUser.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="bg-[#0c0c0c] rounded-[40px] border border-white/5 p-8 shadow-2xl relative overflow-hidden"
                     >
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                           <ShieldAlert size={140} className="text-red-500" />
                        </div>

                        <div className="text-center relative z-10">
                           <div className="relative inline-block mb-6">
                              <img src={selectedUser.photoURL} className="w-24 h-24 rounded-[32px] border-4 border-[#1a1a1a] shadow-2xl mx-auto object-cover" alt="" />
                              <div className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-2xl flex items-center justify-center text-white shadow-xl ${
                                 selectedUser.status === 'online' ? 'bg-green-500' : 'bg-white/10'
                              }`}>
                                 <Monitor size={16} />
                              </div>
                           </div>
                           <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-1">{selectedUser.displayName}</h3>
                           <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-8 italic">UID: {selectedUser.id}</p>

                           <div className="grid grid-cols-2 gap-3 mb-8">
                              <button 
                                 onClick={async () => {
                                    const amount = prompt("Quantidade de moedas para ADICIONAR (use sinal de - para remover):");
                                    if (!amount || isNaN(parseInt(amount))) return;
                                    try {
                                       await updateDoc(doc(db, 'users', selectedUser.id), {
                                          coins: increment(parseInt(amount))
                                       });
                                       alert("Saldo atualizado!");
                                    } catch (err) { console.error(err); }
                                 }}
                                 className="bg-white/5 p-4 rounded-3xl border border-white/5 text-center group/btn"
                              >
                                 <p className="text-[8px] font-black text-white/20 uppercase mb-1">Saldo</p>
                                 <p className="flex items-center justify-center gap-1.5 text-xs font-black text-yellow-500 italic group-hover/btn:scale-110 transition-transform"><Coins size={12} /> {selectedUser.coins || 0}</p>
                              </button>
                              <div className="bg-white/5 p-4 rounded-3xl border border-white/5">
                                 <p className="text-[8px] font-black text-white/20 uppercase mb-1">ID</p>
                                 <p className="text-xs font-black text-white italic">#{selectedUser.displayId}</p>
                              </div>
                           </div>

                           <div className="space-y-4 mb-10">
                              <label className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] italic block text-left ml-2">Punições Temporais</label>
                              <div className="grid grid-cols-2 gap-2">
                                 {[
                                    { l: '1 Hora', v: 3600000 },
                                    { l: '24 Horas', v: 86400000 },
                                    { l: '7 Dias', v: 604800000 },
                                    { l: '30 Dias', v: 2592000000 }
                                 ].map(t => (
                                    <button 
                                       key={t.l}
                                       onClick={() => toggleBan(selectedUser, t.v)} 
                                       className="py-3 rounded-xl text-[9px] font-black bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all border border-white/5"
                                    >
                                       {t.l}
                                    </button>
                                 ))}
                              </div>

                              <button 
                                 onClick={() => toggleBan(selectedUser)}
                                 className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all ${
                                    selectedUser.isBanned ? 'bg-green-600 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'bg-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                                 }`}
                              >
                                 {selectedUser.isBanned ? <CheckCircle2 size={16} /> : <Ban size={16} />} 
                                 {selectedUser.isBanned ? 'Desbanir Global' : 'Banimento Permanente'}
                              </button>
                              
                              {selectedUser.isBanned && selectedUser.bannedUntil && (
                                 <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                                    <p className="text-[9px] font-black text-red-500 uppercase italic">
                                       Banido até: {format(selectedUser.bannedUntil.toDate(), 'dd/MM/yyyy HH:mm')}
                                    </p>
                                 </div>
                              )}

                              <button 
                                 onClick={() => toggleMute(selectedUser)}
                                 className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all bg-white/5 text-white border border-white/5 ${selectedUser.isMuted ? 'border-yellow-500/50' : ''}`}
                              >
                                 <MessageSquare size={16} className={selectedUser.isMuted ? 'text-yellow-500' : 'text-white/40'} /> 
                                 {selectedUser.isMuted ? 'Desmutar' : 'Mute Global'}
                              </button>
                           </div>

                           {roleLevel >= 3 && (
                              <div className="space-y-4 pt-10 border-t border-white/5">
                                 <label className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] italic block text-left ml-2 mb-4">Hierarquia</label>
                                 <div className="grid grid-cols-2 gap-2">
                                    {(['moderator', 'admin', 'superadmin', 'owner'] as UserRole[]).map(r => (
                                       <button 
                                          key={r}
                                          onClick={() => changeRole(selectedUser, r)}
                                          className={`py-3 rounded-xl text-[8px] font-black uppercase transition-all tracking-widest ${
                                             selectedUser.role === r ? 'bg-purple-600 text-white shadow-lg' : 'bg-white/5 text-white/30 hover:bg-white/10'
                                          }`}
                                       >
                                          {r}
                                       </button>
                                    ))}
                                 </div>
                              </div>
                           )}

                           {selectedUser.deviceInfo && (
                              <div className="mt-10 p-6 bg-white/5 rounded-3xl border border-white/5 text-left">
                                 <div className="flex items-center gap-3 mb-4 text-[9px] font-black uppercase text-purple-400 tracking-widest italic">
                                    <Fingerprint size={14} /> Dados Técnicos
                                 </div>
                                 <div className="space-y-2">
                                    <p className="text-[9px] font-bold text-white/20 uppercase">Plataforma: <span className="text-white/60">{selectedUser.deviceInfo.platform}</span></p>
                                    <p className="text-[8px] font-medium text-white/20 whitespace-normal break-all leading-tight">{selectedUser.deviceInfo.userAgent}</p>
                                 </div>
                              </div>
                           )}
                        </div>
                     </motion.div>
                  ) : (
                     <div className="bg-[#0c0c0c] rounded-[40px] border border-white/5 p-12 text-center h-[600px] flex flex-col items-center justify-center space-y-6">
                        <div className="w-20 h-20 bg-white/5 rounded-[32px] flex items-center justify-center text-white/10">
                           <Info size={40} />
                        </div>
                        <div>
                           <h4 className="text-lg font-black text-white/30 italic uppercase tracking-tight">Seleção Suspensa</h4>
                           <p className="text-[9px] font-bold text-white/10 uppercase tracking-widest mt-2 max-w-[180px] mx-auto">Selecione um perfil na lista para ver detalhes e ações.</p>
                        </div>
                     </div>
                  )}
               </AnimatePresence>
            </div>
         </div>
      </motion.div>
   );
}

function RoomsTab({ roleLevel }: { roleLevel: number }) {
   const [rooms, setRooms] = useState<any[]>([]);
   const [loading, setLoading] = useState(false);

   const deleteRoom = async (roomId: string) => {
      if (roleLevel < 1) return;
      if (!window.confirm("Você tem certeza que deseja APAGAR DEFINITIVAMENTE esta sala?")) return;
      try {
         await deleteDoc(doc(db, 'rooms', roomId));
         await addDoc(collection(db, 'adminLogs'), {
            action: 'DELETE_ROOM',
            roomId,
            adminId: auth.currentUser?.uid,
            timestamp: serverTimestamp()
         });
      } catch (err) {
         console.error(err);
      }
   };

   useEffect(() => {
      setLoading(true);
      const q = query(collection(db, 'rooms'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(q, (snap) => {
         setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
         setLoading(false);
      }, (err) => console.log("Rooms list restricted:", err));
      return unsub;
   }, []);

   const deleteRoom = async (roomId: string) => {
      if (confirm("Deseja realmente EXCLUIR esta sala globalmente? Esta ação não pode ser desfeita.")) {
         try {
            await deleteDoc(doc(db, 'rooms', roomId));
            
            await addDoc(collection(db, 'adminLogs'), {
               action: 'DELETE_ROOM',
               adminId: auth.currentUser?.uid,
               roomId,
               timestamp: serverTimestamp()
            });

            alert("Sala removida permanentemente.");
         } catch (err) {
            console.error(err);
         }
      }
   };

   const toggleSpotlight = async (roomId: string, current: boolean) => {
      try {
         await updateDoc(doc(db, 'rooms', roomId), { isSpotlight: !current });
         
         await addDoc(collection(db, 'adminLogs'), {
            action: 'TOGGLE_SPOTLIGHT',
            adminId: auth.currentUser?.uid,
            roomId,
            enabled: !current,
            timestamp: serverTimestamp()
         });
      } catch (err) {
         console.error(err);
      }
   };

   const toggleEventStatus = async (roomId: string, current: boolean) => {
      try {
         await updateDoc(doc(db, 'rooms', roomId), { isEvent: !current });
         
         await addDoc(collection(db, 'adminLogs'), {
            action: 'TOGGLE_EVENT_STATUS',
            adminId: auth.currentUser?.uid,
            roomId,
            enabled: !current,
            timestamp: serverTimestamp()
         });
      } catch (err) {
         console.error(err);
      }
   };

   return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
         <div className="flex items-end justify-between">
            <div>
               <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-1">Nexus de Salas</h2>
               <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest italic">Monitoramento em Tempo Real das Instâncias</p>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence>
               {rooms.map(room => (
                  <motion.div 
                     layout
                     initial={{ opacity: 0, scale: 0.9 }}
                     animate={{ opacity: 1, scale: 1 }}
                     key={room.id} 
                     className="bg-[#0c0c0c] rounded-[40px] border border-white/5 p-8 relative group overflow-hidden hover:border-purple-500/30 transition-all card-shine"
                  >
                     <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000">
                        <Layout size={120} />
                     </div>

                     <div className="flex items-center gap-5 mb-8 relative z-10">
                        <div className="relative">
                           <img src={room.coverURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${room.id}`} className="w-16 h-16 rounded-3xl object-cover border-2 border-white/10" alt="" />
                           {room.isSpotlight && (
                              <div className="absolute -top-2 -right-2 bg-yellow-500 text-black rounded-lg p-1 animate-pulse shadow-lg">
                                 <Crown size={12} strokeWidth={3} />
                              </div>
                           )}
                        </div>
                        <div className="min-w-0">
                           <h4 className="text-lg font-black text-white italic uppercase tracking-tighter truncate">{room.name}</h4>
                           <div className="flex items-center gap-2 mt-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${room.participants?.length > 0 ? 'bg-green-500' : 'bg-white/10'}`}></span>
                              <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">{room.participants?.length || 0} conectados</p>
                           </div>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-4 mb-8 relative z-10">
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                           <p className="text-[8px] font-bold text-white/20 uppercase mb-1">Host</p>
                           <p className="text-[10px] font-black text-white italic truncate">{room.hostInfo?.displayName || 'Desconhecido'}</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                           <p className="text-[8px] font-bold text-white/20 uppercase mb-1">Tema</p>
                           <p className="text-[10px] font-black text-white italic truncate">{room.theme || 'Clássico'}</p>
                        </div>
                     </div>

                     <div className="flex gap-2 relative z-10">
                        <button 
                           onClick={() => toggleSpotlight(room.id, !!room.isSpotlight)}
                           className={`flex-1 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
                              room.isSpotlight ? 'bg-yellow-500 text-black shadow-lg' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                           }`}
                        >
                           {room.isSpotlight ? 'Destacado' : 'Destacar'}
                        </button>
                        <button 
                           onClick={() => toggleEventStatus(room.id, !!room.isEvent)}
                           className={`flex-1 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
                              room.isEvent ? 'bg-blue-500 text-white shadow-lg' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                           }`}
                        >
                           {room.isEvent ? 'Em Evento' : 'Marcar Evento'}
                        </button>
                        <button 
                           onClick={() => deleteRoom(room.id)}
                           className="w-14 h-14 bg-red-600/10 text-red-500 rounded-2xl flex items-center justify-center hover:bg-red-600 hover:text-white transition-all shadow-premium"
                        >
                           <Trash2 size={20} />
                        </button>
                     </div>
                  </motion.div>
               ))}
            </AnimatePresence>
         </div>
      </motion.div>
   );
}

function SecurityTab({ roleLevel }: { roleLevel: number }) {
   const [config, setConfig] = useState({
      antiSpam: true,
      antiFake: true,
      minLevelToCreateRoom: 5,
      maintenanceMode: false,
      blacklistedWords: 'palavrão, ofensa, proibido',
   });
   const [saving, setSaving] = useState(false);

   useEffect(() => {
      const unsub = onSnapshot(doc(db, 'settings', 'security'), (snap) => {
         if (snap.exists()) setConfig(snap.data() as any);
      }, (err) => console.log("Security config restricted:", err));
      return unsub;
   }, []);

   const handleSave = async () => {
      if (roleLevel < 3) {
         alert("Permissão insuficiente para alterar configurações críticas.");
         return;
      }
      setSaving(true);
      try {
         await setDoc(doc(db, 'settings', 'security'), {
            ...config,
            updatedAt: serverTimestamp(),
            updatedBy: auth.currentUser?.uid
         }, { merge: true });
         
         await addDoc(collection(db, 'adminLogs'), {
            action: 'UPDATE_SECURITY_CONFIG',
            adminId: auth.currentUser?.uid,
            details: config,
            timestamp: serverTimestamp()
         });

         alert("Configurações de segurança atualizadas!");
      } catch (err) {
         console.error(err);
         alert("Erro ao salvar configurações.");
      } finally {
         setSaving(false);
      }
   };

   const toggle = (key: keyof typeof config) => {
      if (roleLevel < 3) return;
      setConfig(prev => ({ ...prev, [key]: !prev[key] }));
   };

   return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
         <div>
            <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-1">Central de Segurança</h2>
            <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest italic">Protocolos Anti-Ataque e Regras Globais</p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#0c0c0c] rounded-[40px] border border-white/5 p-10 space-y-10">
               <h3 className="text-lg font-black uppercase italic tracking-tight flex items-center gap-3">
                  <Shield size={20} className="text-purple-500" /> Defesas Ativas
               </h3>
               
               <div className="space-y-4">
                  <ToggleOption 
                     label="Sistema Anti-Spam" 
                     desc="Bloqueia mensagens repetitivas e bots de chat." 
                     active={config.antiSpam} 
                     onToggle={() => toggle('antiSpam')} 
                  />
                  <ToggleOption 
                     label="Protocolo Anti-Fake" 
                     desc="Impede criação massiva de contas com o mesmo IP." 
                     active={config.antiFake} 
                     onToggle={() => toggle('antiFake')} 
                  />
                  <ToggleOption 
                     label="Modo Manutenção" 
                     desc="Apenas equipe staff consegue acessar o app." 
                     active={config.maintenanceMode} 
                     onToggle={() => toggle('maintenanceMode')} 
                     color="bg-red-600"
                  />
               </div>
            </div>

            <div className="bg-[#0c0c0c] rounded-[40px] border border-white/5 p-10 space-y-10">
               <h3 className="text-lg font-black uppercase italic tracking-tight flex items-center gap-3">
                  <Lock size={20} className="text-blue-500" /> Restrições de Sistema
               </h3>

               <div className="space-y-8">
                  <div className="space-y-3">
                     <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] italic ml-2">Nível Mínimo para Criar Salas</label>
                     <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/5 w-full">
                        <button onClick={() => setConfig(prev => ({...prev, minLevelToCreateRoom: Math.max(0, prev.minLevelToCreateRoom - 1)}))} className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-white"><Minus size={18} /></button>
                        <div className="flex-1 text-center font-black italic text-xl">{config.minLevelToCreateRoom}</div>
                        <button onClick={() => setConfig(prev => ({...prev, minLevelToCreateRoom: prev.minLevelToCreateRoom + 1}))} className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-white"><Plus size={18} /></button>
                     </div>
                  </div>

                  <div className="space-y-3">
                     <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] italic ml-2">Blacklist de Palavras (CSV)</label>
                     <textarea 
                        value={config.blacklistedWords}
                        onChange={(e) => setConfig(prev => ({ ...prev, blacklistedWords: e.target.value }))}
                        rows={3}
                        className="w-full bg-white/5 border border-white/5 rounded-3xl p-6 text-xs text-white/60 outline-none focus:border-purple-500/30 transition-all resize-none"
                     />
                  </div>

                  <button 
                     onClick={handleSave}
                     disabled={saving}
                     className="w-full py-5 bg-purple-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest italic shadow-xl active:scale-95 transition-all disabled:opacity-50"
                  >
                     {saving ? 'Processando...' : 'Salvar Configurações'}
                  </button>
               </div>
            </div>
         </div>
      </motion.div>
   );
}

function ToggleOption({ label, desc, active, onToggle, color = 'bg-purple-600' }: any) {
   return (
      <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/5 flex items-center justify-between">
         <div className="space-y-1">
            <h4 className="text-[13px] font-black text-white uppercase italic">{label}</h4>
            <p className="text-[9px] font-bold text-white/20 uppercase tracking-tight">{desc}</p>
         </div>
         <button 
            onClick={onToggle}
            className={`w-14 h-8 rounded-full relative transition-all duration-500 ${active ? color : 'bg-white/10'}`}
         >
            <motion.div 
               animate={{ x: active ? 28 : 4 }}
               className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg"
            />
         </button>
      </div>
   );
}

function FinanceTab() {
   const [financeConfig, setFinanceConfig] = useState({
      xpMultiplier: 1,
      dailyCoins: 100,
      dailyXp: 50
   });
   const [saving, setSaving] = useState(false);

   useEffect(() => {
      const unsub = onSnapshot(doc(db, 'settings', 'finance'), (snap) => {
         if (snap.exists()) setFinanceConfig(snap.data() as any);
      }, (err) => console.log("Finance config restricted:", err));
      return unsub;
   }, []);

   const saveFinance = async () => {
      setSaving(true);
      try {
         await setDoc(doc(db, 'settings', 'finance'), {
            ...financeConfig,
            updatedAt: serverTimestamp()
         }, { merge: true });
         
         await addDoc(collection(db, 'adminLogs'), {
            action: 'UPDATE_FINANCE_CONFIG',
            adminId: auth.currentUser?.uid,
            details: financeConfig,
            timestamp: serverTimestamp()
         });

         alert("Configurações financeiras atualizadas!");
      } catch (err) {
         console.error(err);
         alert("Erro ao salvar configurações financeiras.");
      } finally {
         setSaving(false);
      }
   };

   const injectGlobalCoins = async () => {
      const amount = prompt("Quantidade de moedas para injetar GLOBALMENTE para TODOS usuários:");
      if (!amount || isNaN(parseInt(amount))) return;
      
      const confirmMsg = confirm(`Deseja injetar ${amount} moedas para TODOS os usuários? Esta ação é irreversível.`);
      if (!confirmMsg) return;

      try {
         // In a real high-scale app, this would be a cloud function.
         // For smaller scale, we demonstrate the intent.
         alert("Comando de injeção global enviado para processamento em background (Simulado).");
         
         await addDoc(collection(db, 'adminLogs'), {
            action: 'GLOBAL_COIN_INJECTION',
            amount: parseInt(amount),
            adminId: auth.currentUser?.uid,
            timestamp: serverTimestamp()
         });
      } catch (err) {
         console.error(err);
      }
   };

   return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
         <div>
            <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-1">Painel Financeiro</h2>
            <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest italic">Gestão de Moedas, Recompensas e Economia</p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="bg-[#0c0c0c] rounded-[40px] border border-white/5 p-10 space-y-10">
                <h3 className="text-lg font-black uppercase italic tracking-tight flex items-center gap-3">
                   <Megaphone size={20} className="text-yellow-500" /> Eventos de Bônus
                </h3>
                <div className="space-y-6">
                   <div className="flex items-center justify-between p-6 bg-yellow-500/5 rounded-3xl border border-yellow-500/10">
                      <div>
                         <h4 className="text-sm font-black text-yellow-500 uppercase italic">Multiplicador de XP</h4>
                         <p className="text-[9px] font-bold text-yellow-500/40 uppercase">Atualmente: {financeConfig.xpMultiplier}x (Global)</p>
                      </div>
                      <button 
                        onClick={() => setFinanceConfig(prev => ({ ...prev, xpMultiplier: prev.xpMultiplier === 1 ? 2 : 1 }))}
                        className="px-4 py-2 bg-yellow-500 text-black text-[10px] font-black rounded-xl italic"
                      >
                         ALTERAR
                      </button>
                   </div>

                   <div className="p-8 bg-white/5 rounded-[32px] border border-white/5 space-y-6">
                      <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Recompensa Diária Padrão</p>
                      <div className="flex items-center gap-6">
                         <div className="flex-1 space-y-2">
                            <label className="text-[8px] font-black text-white/30 uppercase ml-2">Moedas</label>
                            <input 
                              type="number" 
                              value={financeConfig.dailyCoins}
                              onChange={(e) => setFinanceConfig(prev => ({ ...prev, dailyCoins: parseInt(e.target.value) }))}
                              className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-black outline-none focus:border-yellow-500/30" 
                            />
                         </div>
                         <div className="flex-1 space-y-2">
                            <label className="text-[8px] font-black text-white/30 uppercase ml-2">XP</label>
                            <input 
                              type="number" 
                              value={financeConfig.dailyXp} 
                              onChange={(e) => setFinanceConfig(prev => ({ ...prev, dailyXp: parseInt(e.target.value) }))}
                              className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-black outline-none focus:border-yellow-500/30" 
                            />
                         </div>
                      </div>
                      <button 
                        onClick={saveFinance}
                        disabled={saving}
                        className="w-full py-4 bg-white text-black rounded-2xl text-[10px] font-black uppercase italic disabled:opacity-50"
                      >
                        {saving ? 'Salvando...' : 'Atualizar Recompensas'}
                      </button>
                   </div>
                </div>
             </div>

             <div className="bg-gradient-to-br from-[#0c0c0c] to-[#121212] rounded-[40px] border border-white/5 p-10 flex flex-col justify-center items-center text-center space-y-6 relative overflow-hidden group">
                <div className="absolute inset-0 bg-yellow-500 opacity-0 group-hover:opacity-[0.02] transition-opacity duration-1000"></div>
                <div className="w-24 h-24 bg-yellow-500/10 rounded-[32px] flex items-center justify-center text-yellow-500 shadow-[0_0_50px_rgba(234,179,8,0.1)] relative z-10">
                   <Coins size={48} />
                </div>
                <h3 className="text-2xl font-black italic tracking-tighter uppercase relative z-10">Injetar Moedas</h3>
                <p className="text-white/30 text-xs font-bold uppercase tracking-widest max-w-[200px] relative z-10">Adicione ou remova saldo em massa ou para usuários específicos.</p>
                <div className="w-full flex gap-3 relative z-10">
                   <button 
                     onClick={() => alert("Selecione um usuário na aba 'Usuários' para injetar individualmente.")}
                     className="flex-1 py-5 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase text-white hover:bg-white/10 transition-all"
                   >
                      Individual
                   </button>
                   <button 
                     onClick={injectGlobalCoins}
                     className="flex-1 py-5 bg-yellow-600 text-white rounded-2xl text-[10px] font-black uppercase italic shadow-xl active:scale-95 transition-all"
                   >
                      Injeção Global
                   </button>
                </div>
             </div>
         </div>
      </motion.div>
   );
}

function ReportsTab() {
   const [reports, setReports] = useState<any[]>([]);

   useEffect(() => {
      const q = query(collection(db, 'reports'), orderBy('status', 'asc'), orderBy('createdAt', 'desc'), limit(50));
      return onSnapshot(q, (snap) => {
         setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => console.error("Reports Tab snapshot error:", err));
   }, []);

   const resolveReport = async (reportId: string, status: 'resolved' | 'dismissed') => {
      try {
         await updateDoc(doc(db, 'reports', reportId), { 
            status, 
            resolvedAt: serverTimestamp(),
            resolvedBy: auth.currentUser?.uid 
         });
         
         await addDoc(collection(db, 'adminLogs'), {
            action: 'RESOLVE_REPORT',
            reportId,
            status,
            adminId: auth.currentUser?.uid,
            timestamp: serverTimestamp()
         });
      } catch (err) {
         console.error("Report resolution error:", err);
      }
   };

   return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
         <div>
            <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-1">Central de Denúncias</h2>
            <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest italic">Mediação e Julgamento Ético Staff</p>
         </div>

         <div className="grid grid-cols-1 gap-6">
            {reports.length === 0 ? (
               <div className="p-20 text-center bg-[#0c0c0c] border border-white/5 rounded-[40px] space-y-4">
                  <div className="w-16 h-16 bg-white/5 rounded-3xl mx-auto flex items-center justify-center text-white/10"><Flag size={32} /></div>
                  <h4 className="text-lg font-black text-white/20 uppercase italic">Céu Limpo</h4>
                  <p className="text-[10px] font-bold text-white/10 uppercase tracking-widest">Nenhuma denúncia no radar</p>
               </div>
            ) : (
               reports.map(report => (
                  <div key={report.id} className={`bg-[#0c0c0c] rounded-[32px] border border-white/5 p-8 flex flex-col md:flex-row md:items-center justify-between gap-8 group hover:border-red-500/30 transition-all card-shine ${report.status !== 'pending' ? 'opacity-40' : ''}`}>
                     <div className="flex items-start gap-6">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${report.status === 'pending' ? 'bg-red-500/10 text-red-500' : 'bg-white/5 text-white/20'}`}>
                           <AlertTriangle size={24} />
                        </div>
                        <div className="space-y-2 min-w-0">
                           <div className="flex items-center gap-3">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${report.status === 'pending' ? 'bg-red-500 text-white' : 'bg-white/10 text-white/40'}`}>
                                 {report.status === 'pending' ? 'PENDENTE' : report.status.toUpperCase()}
                              </span>
                              <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">
                                 {report.createdAt ? format(report.createdAt.toDate(), "dd MMM, HH:mm", { locale: ptBR }) : '...'}
                              </span>
                           </div>
                           <h4 className="text-sm font-black text-white italic truncate uppercase tracking-tight">Motivo: {report.reason}</h4>
                           <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Alvo: <span className="text-white underline">{report.targetName || report.targetId || 'Desconhecido'}</span></p>
                        </div>
                     </div>

                     <div className="flex items-center gap-3">
                        {report.status === 'pending' ? (
                           <>
                              <button 
                                 onClick={() => resolveReport(report.id, 'dismissed')} 
                                 className="px-6 py-4 bg-white/5 rounded-2xl text-[9px] font-black uppercase tracking-widest text-white/30 hover:bg-white/10 hover:text-white transition-all"
                              >
                                 Arquivar
                              </button>
                              <button 
                                 onClick={() => resolveReport(report.id, 'resolved')} 
                                 className="px-6 py-4 bg-red-600 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest italic shadow-xl shadow-red-500/20 active:scale-95 transition-all"
                              >
                                 Resolver
                              </button>
                           </>
                        ) : (
                           <div className="flex flex-col items-end">
                              <div className="px-6 py-3 bg-white/5 border border-white/5 rounded-2xl text-[9px] font-black uppercase text-white/20 italic">Resolvido</div>
                              <p className="text-[8px] font-black text-white/10 uppercase mt-1">Por: @usr_{report.resolvedBy?.substring(0, 5)}</p>
                           </div>
                        )}
                     </div>
                  </div>
               ))
            )}
         </div>
      </motion.div>
   );
}

function LogsTab() {
   const [logs, setLogs] = useState<any[]>([]);

   useEffect(() => {
      const q = query(collection(db, 'adminLogs'), orderBy('timestamp', 'desc'), limit(50));
      const unsub = onSnapshot(q, (snap) => {
         setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (err) => console.error("Logs snapshot error:", err));
      return unsub;
   }, []);

   return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
         <div>
            <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-1">Registros de Auditoria</h2>
            <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest italic">Histórico Imutável de Ações Staff</p>
         </div>

         <div className="bg-[#0c0c0c] rounded-[40px] border border-white/5 overflow-hidden">
            <div className="p-8 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
               <h3 className="text-xs font-black uppercase tracking-[0.2em] italic flex items-center gap-3"><Terminal size={18} className="text-purple-500" /> Log em tempo real</h3>
               <button className="p-3 bg-white/5 rounded-xl text-white/40 hover:text-white transition-all"><Download size={18} /></button>
            </div>
            <div className="divide-y divide-white/[0.03] overflow-y-auto max-h-[600px] scrollbar-hide font-mono">
               {logs.length === 0 ? (
                  <div className="p-12 text-center text-white/10 text-[10px] font-black italic uppercase">Nenhum log registrado hoje</div>
               ) : (
                  logs.map(log => (
                     <div key={log.id} className="p-6 flex items-start gap-6 hover:bg-white/[0.02] transition-colors border-l-2 border-transparent hover:border-purple-500 group">
                        <div className="text-[10px] font-black text-white/20 uppercase shrink-0 pt-1">
                           {format(log.timestamp?.toDate?.() || new Date(), "HH:mm:ss")}
                        </div>
                        <div className="flex-1 space-y-1">
                           <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-purple-400 uppercase italic group-hover:text-purple-300 transition-colors">{log.adminName}</span>
                              <ChevronRight size={10} className="text-white/10" />
                              <span className="text-[10px] font-black text-white/60 uppercase">{log.action}</span>
                           </div>
                           <p className="text-[11px] text-white/30 break-all">{log.details}</p>
                        </div>
                        {log.targetId && <div className="text-[8px] font-bold bg-white/5 px-2 py-1 rounded text-white/20 uppercase">Target: {log.targetId.slice(0, 8)}...</div>}
                     </div>
                  ))
               )}
            </div>
         </div>
      </motion.div>
   );
}

function AnnouncementsTab() {
   const [content, setContent] = useState('');
   const [type, setType] = useState<'info' | 'alert' | 'event'>('info');
   const [roomId, setRoomId] = useState('');
   const [isSending, setIsSending] = useState(false);

   const sendBroadcast = async () => {
      if (!content) return;
      setIsSending(true);
      try {
         await addDoc(collection(db, 'announcements'), {
            content,
            type,
            roomId: roomId || null,
            senderId: auth.currentUser?.uid,
            timestamp: serverTimestamp(),
            active: true
         });
         
         await addDoc(collection(db, 'adminLogs'), {
            action: 'SEND_ANNOUNCEMENT',
            adminId: auth.currentUser?.uid,
            type,
            roomId: roomId || null,
            message: content.substring(0, 100),
            timestamp: serverTimestamp()
         });

         alert("Comunicado Global Enviado!");
         setContent('');
         setRoomId('');
      } catch (err) {
         console.error(err);
      } finally {
         setIsSending(false);
      }
   };

   return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
         <div>
            <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-1">Broadcasting Global</h2>
            <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest italic">Comunicados, Eventos e Avisos em Massa</p>
         </div>

         <div className="max-w-2xl mx-auto space-y-8 bg-[#0c0c0c] rounded-[40px] border border-white/5 p-12 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5 scale-150">
               <Megaphone size={200} className="text-blue-500" />
            </div>

            <div className="space-y-6 relative z-10">
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                     <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] italic ml-2">Classificação</label>
                     <div className="flex gap-2">
                        {(['info', 'alert', 'event'] as const).map(t => (
                           <button 
                              key={t}
                              onClick={() => setType(t)}
                              className={`flex-1 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
                                 type === t ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-white/30'
                              }`}
                           >
                              {t === 'info' ? 'SISTEMA' : t === 'alert' ? 'CRÍTICO' : 'EVENTO'}
                           </button>
                        ))}
                     </div>
                  </div>
                  
                  <div className="space-y-3">
                     <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] italic ml-2">ID da Sala (Opcional)</label>
                     <input 
                        type="text"
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                        placeholder="Ex: d8c1af9..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-black text-white outline-none focus:border-blue-500/30"
                     />
                  </div>
               </div>

               <div className="space-y-3">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] italic ml-2">Conteúdo da Notificação</label>
                  <textarea 
                     value={content}
                     onChange={(e) => setContent(e.target.value)}
                     rows={5}
                     className="w-full bg-white/5 border border-white/10 rounded-3xl p-8 text-sm text-white/80 outline-none focus:border-blue-500/30 transition-all resize-none shadow-inner"
                     placeholder="Digite a mensagem que aparecerá para todos..."
                  />
               </div>

               <button 
                  onClick={sendBroadcast}
                  disabled={isSending || !content}
                  className="w-full py-6 bg-blue-600 text-white rounded-3xl font-black uppercase text-xs tracking-[0.2em] italic shadow-2xl shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-20 flex items-center justify-center gap-4"
               >
                  {isSending ? <RefreshCw size={20} className="animate-spin" /> : <><Globe size={20} /> PROPAGAR AO UNIVERSO</>}
               </button>
            </div>
         </div>
      </motion.div>
   );
}

function TeamTab({ userRole }: { userRole: string }) {
   const [staff, setStaff] = useState<any[]>([]);

   useEffect(() => {
     const q = query(collection(db, 'users'), where('role', 'in', ['moderator', 'admin', 'superadmin', 'owner']));
     const unsub = onSnapshot(q, (snap) => {
        setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })));
     }, (err) => console.log("Staff collection restricted:", err));
     return unsub;
   }, []);

   return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
         <div>
            <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-1">Assembleia da Equipe</h2>
            <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest italic">Gerenciamento de Hierarquia e Colaboradores</p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence>
               {staff.sort((a, b) => getRoleLevel(b.role) - getRoleLevel(a.role)).map(member => (
                  <motion.div layout key={member.id} className="bg-[#0c0c0c] rounded-[40px] border border-white/5 p-8 flex items-center gap-6 group hover:border-purple-500/40 transition-all card-shine">
                     <div className="relative">
                        <img src={member.photoURL} className="w-16 h-16 rounded-[28px] object-cover border-2 border-white/10" alt="" />
                        <div className={`absolute -top-2 -right-2 p-1.5 rounded-xl shadow-lg border-2 border-[#0c0c0c] ${
                           member.role === 'owner' ? 'bg-red-500' : member.role === 'superadmin' ? 'bg-orange-500' : 'bg-blue-500'
                        }`}>
                           <Crown size={12} className="text-white" />
                        </div>
                     </div>
                     <div className="min-w-0">
                        <h4 className="text-lg font-black text-white italic uppercase tracking-tighter truncate">{member.displayName}</h4>
                        <div className="flex items-center gap-3 mt-1">
                           <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded italic ${
                              member.role === 'owner' ? 'bg-red-500/10 text-red-500' : member.role === 'superadmin' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'
                           }`}>{member.role}</span>
                           <span className={`text-[8px] font-black uppercase italic ${member.status === 'online' ? 'text-green-500' : 'text-white/20'}`}>
                              {member.status === 'online' ? '● Ativo' : '● Inativo'}
                           </span>
                        </div>
                     </div>
                  </motion.div>
               ))}
            </AnimatePresence>
         </div>
      </motion.div>
   );
}
