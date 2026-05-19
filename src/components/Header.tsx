import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Bell, Search, Coins, X, MessageCircle, UserPlus, AtSign, Gift } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export default function Header() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, clearAllNotifications } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);

  const getIcon = (type: string) => {
    switch (type) {
      case 'message': return <MessageCircle size={14} className="text-blue-400" />;
      case 'friend_request': return <UserPlus size={14} className="text-green-400" />;
      case 'mention': return <AtSign size={14} className="text-purple-400" />;
      case 'gift': return <Gift size={14} className="text-pink-400" />;
      default: return <Bell size={14} className="text-gray-400" />;
    }
  };

  const handleNotificationClick = (notif: any) => {
    if (!notif.read) markAsRead(notif.id);
    setShowNotifications(false);
    if (notif.type === 'message' && notif.fromId) {
      navigate(`/chat/${notif.fromId}`);
    } else if (notif.type === 'friend_request') {
      navigate('/social');
    }
  };

  return (
    <header className="sticky top-0 left-0 right-0 z-40 bg-black/40 backdrop-blur-3xl border-b border-white/[0.08] px-6 py-5 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <motion.div 
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/profile')}
          className="relative cursor-pointer"
        >
          <div className="p-[1.5px] rounded-[22px] bg-gradient-to-tr from-purple-500/30 to-pink-500/30">
            <div className="bg-zinc-900 rounded-[20px] p-[1.5px] overflow-hidden">
               <img
                src={profile?.photoURL}
                alt={profile?.displayName}
                className="w-12 h-12 rounded-[18px] object-cover bg-zinc-800"
              />
            </div>
          </div>
          <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-[9px] px-2 py-0.5 rounded-lg font-black border-2 border-[#020202] shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
            {profile?.level || 1}
          </div>
        </motion.div>
        
        <div className="flex flex-col">
          <h1 className="text-lg font-black uppercase tracking-[0.15em] text-white leading-none">
            WE<span className="text-purple-500">AURA</span>
          </h1>
          <div 
            onClick={() => navigate('/shop')}
            className="flex items-center gap-1.5 cursor-pointer mt-2 bg-white/5 px-2.5 py-1 rounded-full border border-white/5 hover:bg-white/10 transition-all active:scale-95 group w-fit"
          >
            <Coins size={12} className="text-yellow-500 group-hover:rotate-12 transition-transform" />
            <span className="text-[10px] font-black text-white/40 group-hover:text-white transition-colors tabular-nums tracking-wider">{profile?.coins || 0}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <button className="w-12 h-12 bg-white/5 rounded-2xl text-white/30 hover:text-white transition-all active:scale-90 flex items-center justify-center border border-white/5">
          <Search size={22} />
        </button>
        <button 
          onClick={() => setShowNotifications(!showNotifications)}
          className="w-12 h-12 bg-white/5 rounded-2xl text-white/30 hover:text-white transition-all relative active:scale-90 flex items-center justify-center border border-white/5"
        >
          <Bell size={22} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full border-[3.5px] border-[#020202] flex items-center justify-center text-[8px] font-black text-white shadow-lg shadow-purple-500/40">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence>
        {showNotifications && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" 
              onClick={() => setShowNotifications(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="absolute top-20 right-6 w-80 bg-zinc-900 border border-white/10 rounded-[32px] shadow-[0_30px_100px_rgba(0,0,0,0.8)] z-50 overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
                <h3 className="text-[10px] font-black uppercase text-white tracking-[0.2em]">Notificações</h3>
                <button onClick={() => setShowNotifications(false)} className="w-8 h-8 bg-white/5 rounded-lg text-white/20 hover:text-white flex items-center justify-center">
                  <X size={14} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto py-2 max-h-[400px]">
                {notifications.length === 0 ? (
                  <div className="py-20 text-center px-10">
                    <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white-[0.03]">
                       <Bell size={24} className="text-white/10" />
                    </div>
                    <p className="text-[9px] font-black uppercase text-white/10 tracking-widest">Tudo limpo por aqui</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div 
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`px-6 py-5 flex items-start gap-4 hover:bg-white/[0.02] transition-colors cursor-pointer border-b border-white/5 last:border-0 ${!notif.read ? 'bg-purple-500/[0.03]' : ''}`}
                    >
                      <div className={`mt-1 p-2.5 rounded-2xl ${!notif.read ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-white/30'}`}>
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-white mb-0.5 truncate gap-2 flex items-center">
                          {notif.fromName}
                          {!notif.read && <div className="w-1.5 h-1.5 bg-purple-500 rounded-full shadow-[0_0_8px_#a855f7]" />}
                        </p>
                        <p className="text-[11px] text-white/40 font-medium leading-relaxed line-clamp-2">
                          {notif.text || (
                            notif.type === 'friend_request' ? 'Enviou uma solicitação' :
                            notif.type === 'mention' ? 'Mencionou você' :
                            notif.type === 'gift' ? 'Te enviou um presente!' : 'Nova mensagem'
                          )}
                        </p>
                        <p className="text-[9px] text-white/10 mt-2 uppercase font-black tracking-widest">
                          Agora
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {notifications.length > 0 && (
                <div className="p-4 border-t border-white/5 text-center bg-black/20">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      clearAllNotifications();
                    }}
                    className="text-[9px] font-black uppercase text-purple-500 tracking-[0.2em] hover:text-purple-400 transition-colors"
                  >
                    Marcar tudo como lido
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
