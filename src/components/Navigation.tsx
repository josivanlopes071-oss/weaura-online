import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, ShoppingBag, User, Gamepad2 } from 'lucide-react';
import { motion } from 'motion/react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const handleCreateRoom = async () => {
    if (!user || !profile) return;
    try {
      const { query, where, getDocs, limit } = await import('firebase/firestore');
      const q = query(collection(db, 'rooms'), where('ownerId', '==', user.uid), limit(1));
      const existingRooms = await getDocs(q);
      
      if (!existingRooms.empty) {
        navigate(`/room/${existingRooms.docs[0].id}`);
        return;
      }

      const docRef = await addDoc(collection(db, 'rooms'), {
        name: `Sala de ${profile.displayName || 'Membro'}`,
        description: 'Vem bater um papo!',
        ownerId: user.uid,
        hostInfo: {
          displayName: profile.displayName,
          photoURL: profile.photoURL
        },
        type: 'public',
        members: [user.uid],
        activeSpeakers: [],
        slots: { 0: user.uid },
        category: 'Chat',
        participantLimit: 12,
        isLocked: false,
        password: '',
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
      });
      navigate(`/room/${docRef.id}`);
    } catch (err) {
      console.error("Erro ao criar sala na navegação:", err);
    }
  };

  const navItems = [
    { icon: Home, path: '/', label: 'Início' },
    { icon: Users, path: '/social', label: 'Social' },
    { icon: Gamepad2, path: '/create', label: '', primary: true },
    { icon: ShoppingBag, path: '/shop', label: 'Loja' },
    { icon: User, path: '/profile', label: 'Perfil' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2">
      <div className="max-w-md mx-auto relative h-[88px] flex items-center justify-around bg-[#0c0c0c]/80 backdrop-blur-[40px] border border-white/[0.08] rounded-[44px] shadow-[0_40px_100px_rgba(0,0,0,0.8)] px-2">
        {navItems.map((item, index) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          if (item.primary) {
            return (
              <div key="center" className="relative -top-8 px-2">
                <div className="absolute inset-0 bg-purple-500/20 blur-[50px] -z-10 rounded-full" />
                <motion.button
                  whileHover={{ scale: 1.1, y: -6 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleCreateRoom}
                  className="w-[72px] h-[72px] bg-gradient-to-tr from-purple-700 via-purple-500 to-blue-600 rounded-[30px] shadow-[0_20px_50px_rgba(168,85,247,0.4)] flex items-center justify-center text-white border-[5px] border-[#020202] transition-all relative z-10 group overflow-hidden"
                >
                   <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                   <Icon size={32} className="relative z-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]" />
                </motion.button>
              </div>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center transition-all duration-500 py-4 px-3 rounded-[24px] gap-1.5 relative ${
                isActive ? 'text-white' : 'text-white/20 hover:text-white/40'
              }`}
            >
              <div className={`relative ${isActive ? 'scale-110 mb-0.5' : ''} transition-all duration-500`}>
                <Icon size={22} className={isActive ? 'text-purple-400 drop-shadow-[0_0_12px_rgba(168,85,247,0.8)]' : ''} />
                {item.label === 'Social' && isActive && <div className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full border-2 border-[#0c0c0c]" />}
              </div>
              <span className={`text-[8.5px] font-black uppercase tracking-[0.25em] italic ${isActive ? 'opacity-100 text-purple-400' : 'opacity-0'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
