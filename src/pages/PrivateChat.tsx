import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { 
  doc, onSnapshot, collection, addDoc, serverTimestamp, query, orderBy, limit, setDoc, getDoc, updateDoc 
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  ChevronLeft, Send, Gift, MoreVertical, Search, 
  MessageSquare, Volume2, X, Star, Heart, Flame, Trophy, Gamepad2
} from 'lucide-react';

interface Message {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  type: 'text' | 'gift';
  giftType?: string;
  timestamp: any;
}

export default function PrivateChat() {
  const { id } = useParams(); // This is the target userId
  const navigate = useNavigate();
  const { profile, user, updateProfile, updateCoins, gainXp } = useAuth();
  const { sendNotification } = useNotifications();
  const [targetUser, setTargetUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [showGifts, setShowGifts] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [targetIsTyping, setTargetIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Derive chatId: min(uid1, uid2)_max(uid1, uid2)
  const chatId = user && id ? [user.uid, id].sort().join('_') : null;

  useEffect(() => {
    if (!id) return;
    const fetchTarget = async () => {
      const uRef = doc(db, 'users', id);
      const snap = await getDoc(uRef);
      if (snap.exists()) setTargetUser(snap.data());
    };
    fetchTarget();
  }, [id]);

  useEffect(() => {
    if (!chatId || !user) return;
    const chatRef = doc(db, 'private_chats', chatId);
    setDoc(chatRef, { participants: [user.uid, id], updatedAt: serverTimestamp() }, { merge: true });

    const messagesQuery = query(collection(db, 'private_chats', chatId, 'messages'), orderBy('timestamp', 'asc'), limit(100));
    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (error) => { handleFirestoreError(error, OperationType.LIST, `private_chats/${chatId}/messages`); });

    const typingUnsubscribe = onSnapshot(chatRef, (snapshot) => {
      if (snapshot.exists()) {
        const typing = snapshot.data().typing || {};
        if (id) setTargetIsTyping(typing[id] || false);
      }
    }, (error) => { handleFirestoreError(error, OperationType.GET, `private_chats/${chatId}`); });

    return () => { unsubscribe(); typingUnsubscribe(); };
  }, [chatId, user, id]);

  const handleTyping = (isTypingNow: boolean) => {
    if (!chatId || !user) return;
    setIsTyping(isTypingNow);
    updateDoc(doc(db, 'private_chats', chatId), { [`typing.${user.uid}`]: isTypingNow }).catch(() => {});
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !chatId || !profile || !id) return;
    const messageText = text.trim();
    setText('');
    handleTyping(false);
    try {
      await addDoc(collection(db, 'private_chats', chatId, 'messages'), {
        authorId: profile.uid,
        authorName: profile.displayName,
        text: messageText,
        type: 'text',
        timestamp: serverTimestamp()
      });
      await gainXp(5);
      await setDoc(doc(db, 'private_chats', chatId), { lastMessage: messageText, lastMessageAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
      await sendNotification({ type: 'message', fromId: profile.uid, fromName: profile.displayName, toId: id, text: messageText });
    } catch (err) { console.error(err); }
  };

  const sendGift = async (gift: { label: string; cost: number }) => {
    if (!chatId || !profile || !profile.coins || profile.coins < gift.cost || !id) {
      alert("Aura insuficiente! Recarregue na Loja.");
      return;
    }
    try {
      await updateCoins(gift.cost, 'subtract');
      await addDoc(collection(db, 'private_chats', chatId, 'messages'), {
        authorId: profile.uid,
        authorName: profile.displayName,
        text: `enviou um presente: ${gift.label}!`,
        type: 'gift',
        giftType: gift.label,
        timestamp: serverTimestamp()
      });
      await gainXp(20);
      await sendNotification({ type: 'gift', fromId: profile.uid, fromName: profile.displayName, toId: id, text: `Enviou um ${gift.label} para você!` });
      setShowGifts(false);
    } catch (err: any) { alert(err.message || "Erro no envio."); }
  };

  if (!targetUser) return <div className="min-h-screen bg-[#020202] flex items-center justify-center text-xs font-black uppercase text-white/20 tracking-widest italic animate-pulse">Sincronizando Aura...</div>;

  return (
    <div className="fixed inset-0 bg-[#020202] flex flex-col z-[60] font-sans">
      {/* Premium Chat Header */}
      <div className="flex items-center justify-between p-8 pt-16 border-b border-white/[0.04] glass-dark backdrop-blur-3xl z-10 shadow-premium">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => navigate(-1)} 
            className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white/40 hover:text-white transition-all active:scale-90 border border-white/10"
          >
            <ChevronLeft size={26} />
          </button>
          <div 
            onClick={() => navigate(`/profile/${id}`)}
            className="flex items-center gap-5 cursor-pointer group"
          >
            <div className="relative">
               <div className="p-0.5 rounded-[22px] bg-white/10 group-hover:bg-purple-500/50 transition-colors duration-500 shadow-2xl">
                  <img src={targetUser.photoURL} className="w-14 h-14 rounded-[20px] bg-[#0c0c0c] border-4 border-[#0c0c0c] object-cover" alt="" />
               </div>
               <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-[#0c0c0c] ${targetUser.status === 'online' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-gray-600'}`}></div>
            </div>
            <div>
              <h2 className="font-black italic uppercase text-xl text-white leading-none tracking-tight group-hover:text-purple-400 transition-colors">{targetUser.displayName}</h2>
              <p className="text-[10px] font-black italic text-white/20 uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
                 <span className="w-1.5 h-1.5 bg-purple-500/40 rounded-full"></span>
                 LV.{targetUser.level || 1} • {targetUser.status === 'online' ? 'Status Ativo' : 'Conexão Offline'}
              </p>
            </div>
          </div>
        </div>
        <button className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white/40 hover:text-white transition-all border border-white/10">
           <MoreVertical size={24} />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-12 space-y-10 bg-[#020202] scrollbar-hide">
        {messages.map((msg, idx) => {
          const isMe = msg.authorId === user?.uid;
          const showTime = idx === 0 || (msg.timestamp?.seconds - messages[idx-1]?.timestamp?.seconds > 300);
          
          return (
            <div key={msg.id} className="flex flex-col">
              {showTime && (
                <div className="text-center py-10 opacity-40">
                  <span className="text-[10px] uppercase tracking-[0.5em] text-white/40 font-black italic flex items-center justify-center gap-4">
                    <span className="w-12 h-px bg-white/10"></span>
                    {msg.timestamp?.toDate ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(msg.timestamp.toDate()) : 'Sincronizado'}
                    <span className="w-12 h-px bg-white/10"></span>
                  </span>
                </div>
              )}
              <motion.div 
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] px-8 py-6 rounded-[40px] text-base relative group transition-all font-medium leading-relaxed italic card-shine ${
                  isMe 
                    ? 'bg-white text-black rounded-tr-none shadow-[0_20px_40px_rgba(255,255,255,0.05)]' 
                    : 'glass-dark text-white/80 border border-white/[0.08] rounded-tl-none shadow-premium'
                }`}>
                  {msg.type === 'gift' ? (
                     <div className="flex flex-col items-center gap-5 py-4 min-w-[160px]">
                        <div className={`w-20 h-20 rounded-[30px] flex items-center justify-center bg-black/40 border border-white/10 shadow-2xl ${isMe ? 'text-purple-600' : 'text-yellow-400'}`}>
                           <Gift size={48} className="drop-shadow-[0_0_15px_currentColor]" />
                        </div>
                        <div className="text-center">
                           <span className="font-black uppercase text-[11px] tracking-[0.2em] block italic">Mimo Aura</span>
                           <span className={`text-[10px] font-bold uppercase tracking-widest mt-1 block opacity-40 italic ${isMe ? 'text-black' : 'text-white'}`}>{msg.giftType}</span>
                        </div>
                     </div>
                  ) : (
                    <span className="block">{msg.text}</span>
                  )}
                  <div className={`absolute -bottom-8 ${isMe ? 'right-4' : 'left-4'} opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 text-[9px] font-black uppercase text-white/20 tracking-widest italic`}>
                    {msg.timestamp?.toDate ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(msg.timestamp.toDate()) : ''}
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })}
        {targetIsTyping && (
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-4 ml-4">
            <div className="flex gap-2 p-4 px-6 glass-dark rounded-full border border-white/[0.08] shadow-premium">
              <motion.div animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-2 h-2 bg-purple-500 rounded-full shadow-[0_0_8px_#a855f7]" />
              <motion.div animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }} className="w-2 h-2 bg-purple-500 rounded-full shadow-[0_0_8px_#a855f7]" />
              <motion.div animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.6 }} className="w-2 h-2 bg-purple-500 rounded-full shadow-[0_0_8px_#a855f7]" />
            </div>
          </motion.div>
        )}
        <div ref={chatEndRef} className="h-10" />
      </div>

      {/* Premium Input Area */}
      <div className="p-8 glass-dark border-t border-white/[0.04] pb-16 relative z-20 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
        <AnimatePresence>
          {showGifts && (
            <motion.div
              initial={{ y: 50, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 50, opacity: 0, scale: 0.9 }}
              className="absolute bottom-full left-6 right-6 mb-8 glass-dark border border-white/[0.1] rounded-[50px] p-10 shadow-[0_40px_100px_rgba(0,0,0,1)] z-30"
            >
              <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-px bg-purple-500 rounded-full shadow-[0_0_8px_#a855f7]"></div>
                   <h3 className="text-white text-[11px] font-black italic uppercase tracking-[0.4em] italic leading-none">Mimos VIP Aura</h3>
                </div>
                <button onClick={() => setShowGifts(false)} className="w-10 h-10 bg-white/5 rounded-xl text-white/30 hover:text-white transition-colors border border-white/5"><X size={20} /></button>
              </div>
              <div className="grid grid-cols-4 gap-6">
                {[
                  { icon: Heart, label: 'Amor', color: 'text-red-500 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.2)]', cost: 10 },
                  { icon: Star, label: 'Estrela', color: 'text-yellow-500 bg-yellow-500/10 shadow-[0_0_20px_rgba(234,179,8,0.2)]', cost: 25 },
                  { icon: Flame, label: 'Fogo', color: 'text-orange-500 bg-orange-500/10 shadow-[0_0_20px_rgba(249,115,22,0.2)]', cost: 50 },
                  { icon: Trophy, label: 'Elite', color: 'text-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.2)]', cost: 100 },
                ].map((g) => (
                  <button
                    key={g.label}
                    onClick={() => sendGift(g)}
                    className="flex flex-col items-center gap-5 p-6 bg-black/40 rounded-[35px] hover:bg-white/5 active:scale-95 transition-all group border border-white/[0.05] card-shine"
                  >
                     <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center ${g.color} border border-white/5 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
                        <g.icon size={32} className="drop-shadow-lg" />
                     </div>
                    <div className="flex flex-col items-center space-y-2">
                      <span className="text-[11px] font-black text-white uppercase italic tracking-tighter">{g.label}</span>
                      <div className="flex items-center gap-1.5 bg-yellow-500 px-3 py-1 rounded-full shadow-lg">
                         <Gamepad2 size={10} className="text-black" />
                         <span className="text-[9px] font-black italic text-black uppercase tabular-nums">{g.cost}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSendMessage} className="flex items-center gap-5">
          <button 
            type="button" 
            onClick={() => setShowGifts(!showGifts)}
            className={`w-16 h-16 rounded-[28px] flex items-center justify-center transition-all border duration-500 ${showGifts ? 'bg-purple-600 text-white border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.5)]' : 'bg-white/5 text-white/30 border-white/5 hover:text-white hover:border-white/10'}`}
          >
            <Gift size={28} />
          </button>
          
          <div className="flex-1 relative group">
            <input
              type="text"
              value={text}
              onFocus={() => handleTyping(true)}
              onBlur={() => handleTyping(false)}
              onChange={(e) => { setText(e.target.value); if (!isTyping) handleTyping(true); }}
              placeholder="Sintonize sua Aura aqui..."
              className="w-full bg-black/60 border border-white/[0.08] rounded-[32px] px-10 py-6 text-base text-white focus:outline-none focus:border-purple-500/30 focus:shadow-[0_0_25px_rgba(168,85,247,0.1)] transition-all font-black placeholder:text-white/10 shadow-inner italic"
            />
            <button 
              type="submit" 
              disabled={!text.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-white text-black w-14 h-14 rounded-[24px] flex items-center justify-center disabled:opacity-5 disabled:grayscale transition-all active:scale-90 shadow-2xl hover:scale-105"
            >
              <Send size={24} className="ml-1" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
