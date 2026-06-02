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
import { GIFTS } from '../lib/aura';
import UserAvatar from '../components/UserAvatar';
import PremiumTag from '../components/PremiumTag';
import GiftAnimationOverlay from '../components/GiftAnimationOverlay';
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
  const { profile, user, updateProfile, updateCoins, gainXp, sendGift } = useAuth();
  const { sendNotification } = useNotifications();
  const [targetUser, setTargetUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [showGifts, setShowGifts] = useState(false);
  const [giftQuantity, setGiftQuantity] = useState<number>(1);
  const [activeAnimation, setActiveAnimation] = useState<any | null>(null);
  const sessionStartTimeRef = useRef(Date.now() - 5000);
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
      // Trigger live animations for any newly arriving gift messages
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const m = change.doc.data();
          const msgTime = m.timestamp && typeof m.timestamp.toMillis === 'function' 
            ? m.timestamp.toMillis() 
            : Date.now();
          if (m.type === 'gift' && msgTime >= sessionStartTimeRef.current && msgTime > Date.now() - 15000) {
            setActiveAnimation({
              id: change.doc.id,
              senderName: m.authorName || 'Usuário',
              receiverName: m.receiverName || (m.authorId === user?.uid ? (targetUser?.displayName || 'Membro') : (profile?.displayName || 'Você')),
              giftName: m.giftType || m.text,
              giftIcon: m.giftIcon || '🎁',
              auraGained: m.auraGained || 0,
              quantity: m.giftQuantity || 1,
              coinsGained: m.coinsGained || 0
            });
          }
        }
      });

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

  const handleSendGift = async (giftId: string) => {
    if (!id || !profile) return;
    const gift = GIFTS.find(g => g.id === giftId);
    if (!gift) return;

    const totalCost = gift.price * giftQuantity;
    if (!profile.coins || profile.coins < totalCost) {
      alert(`Saldo EGO insuficiente! Você precisa de ${totalCost} moedas para enviar ${giftQuantity}x ${gift.name}.`);
      return;
    }

    try {
      const result = await sendGift(id, giftId, undefined, chatId || undefined, giftQuantity);
      if (result.success) {
        if (chatId) {
          await addDoc(collection(db, 'private_chats', chatId, 'messages'), {
            authorId: profile.uid,
            authorName: profile.displayName,
            text: `enviou ${giftQuantity}x ${gift.name} ${gift.icon}! Ganhos de sorte: +${result.coinsGained} Moedas EGO!`,
            type: 'gift',
            giftType: gift.name,
            giftIcon: gift.icon,
            giftQuantity,
            receiverName: targetUser?.displayName || "Membro Aura",
            auraGained: result.auraGained,
            coinsGained: result.coinsGained,
            timestamp: serverTimestamp()
          });
          await setDoc(doc(db, 'private_chats', chatId), { lastMessage: `Presente: ${giftQuantity}x ${gift.name} ${gift.icon}`, lastMessageAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
        }

        const xpEarned = Math.max(20, totalCost);
        await gainXp(xpEarned);

        await sendNotification({ 
          type: 'gift', 
          fromId: profile.uid, 
          fromName: profile.displayName, 
          toId: id, 
          text: `Enviou ${giftQuantity}x ${gift.name} para você!` 
        });

        setShowGifts(false);
      }
    } catch (err: any) {
      console.error("Erro no envio:", err);
      alert(err.message || "Erro no envio do presente.");
    }
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
              <UserAvatar uid={id} className="w-14 h-14" />
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-[#0c0c0c] z-20 ${targetUser.status === 'online' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-gray-600'}`}></div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="font-black italic uppercase text-xl text-white leading-none tracking-tight group-hover:text-purple-400 transition-colors">{targetUser.displayName}</h2>
                <PremiumTag email={targetUser.email} role={targetUser.role} size="xs" />
              </div>
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
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6 bg-[#050505] scrollbar-hide">
        {messages.map((msg, idx) => {
          const isMe = msg.authorId === user?.uid;
          const showTime = idx === 0 || (msg.timestamp?.seconds - messages[idx-1]?.timestamp?.seconds > 300);
          
          return (
            <div key={msg.id} className="flex flex-col">
              {showTime && (
                <div className="text-center py-6 opacity-40">
                  <span className="text-[9px] uppercase tracking-[0.3em] text-white/30 font-black flex items-center justify-center gap-3">
                    <span className="w-8 h-px bg-white/5"></span>
                    {msg.timestamp?.toDate ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(msg.timestamp.toDate()) : 'Sincronizado'}
                    <span className="w-8 h-px bg-white/5"></span>
                  </span>
                </div>
              )}
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1.5`}
              >
                <div className={`max-w-[75%] px-4.5 py-3 rounded-[20px] text-[13px] sm:text-[14px] relative group transition-all font-medium leading-relaxed ${
                  isMe 
                    ? 'bg-gradient-to-r from-[#8A2EFF] to-purple-600 text-white rounded-tr-none shadow-[0_8px_25px_rgba(138,46,255,0.18)] border border-[#8A2EFF]/20' 
                    : 'bg-[#121214] text-white/90 border border-white/[0.04] rounded-tl-none shadow-premium'
                }`}>
                  {msg.type === 'gift' ? (
                     <div className="flex flex-col items-center gap-4 py-3 min-w-[140px]">
                        <div className={`w-16 h-16 rounded-[20px] flex items-center justify-center bg-black/40 border border-white/5 shadow-xl ${isMe ? 'text-purple-300' : 'text-yellow-400'}`}>
                           <Gift size={36} className="drop-shadow-[0_0_12px_currentColor]" />
                        </div>
                        <div className="text-center">
                           <span className="font-black uppercase text-[10px] tracking-[0.15em] block text-purple-200">Mimo Aura</span>
                           <span className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 block opacity-50 ${isMe ? 'text-white/80' : 'text-white'}`}>{msg.giftType}</span>
                        </div>
                     </div>
                  ) : (
                    <span className="block break-words whitespace-pre-wrap">{msg.text}</span>
                  )}
                  <div className={`absolute -bottom-5 ${isMe ? 'right-2' : 'left-2'} opacity-0 group-hover:opacity-100 transition-all duration-300 text-[8px] font-bold uppercase text-white/30 tracking-widest`}>
                    {msg.timestamp?.toDate ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(msg.timestamp.toDate()) : ''}
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })}
        {targetIsTyping && (
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 ml-2">
            <div className="flex gap-1.5 p-3 px-4 bg-[#121214] rounded-full border border-white/[0.04] shadow-premium">
              <motion.div animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-1.5 h-1.5 bg-[#8A2EFF] rounded-full shadow-[0_0_6px_#a855f7]" />
              <motion.div animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }} className="w-1.5 h-1.5 bg-[#8A2EFF] rounded-full shadow-[0_0_6px_#a855f7]" />
              <motion.div animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.6 }} className="w-1.5 h-1.5 bg-[#8A2EFF] rounded-full shadow-[0_0_6px_#a855f7]" />
            </div>
          </motion.div>
        )}
        <div ref={chatEndRef} className="h-4" />
      </div>

      {/* Premium Input Area */}
      <div className="p-4 sm:p-6 bg-[#0c0c0d] border-t border-white/[0.04] pb-[env(safe-area-inset-bottom,16px)] relative z-20 shadow-[0_-15px_40px_rgba(0,0,0,0.6)]">
        <AnimatePresence>
          {showGifts && (
            <motion.div
              initial={{ y: 30, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 30, opacity: 0, scale: 0.95 }}
              className="absolute bottom-full left-4 right-4 mb-4 bg-[#121215]/95 border border-white/[0.08] rounded-[28px] p-6 shadow-[0_25px_60px_rgba(0,0,0,0.95)] z-30 backdrop-blur-md"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                   <div className="w-4 h-px bg-[#8A2EFF] rounded-full"></div>
                   <h3 className="text-white text-[10px] font-black uppercase tracking-[0.3em] leading-none">Mimos VIP Aura</h3>
                </div>
                <button onClick={() => setShowGifts(false)} className="w-8 h-8 bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors flex items-center justify-center border border-white/5"><X size={16} /></button>
              </div>

              {/* Quantity Selector */}
              <div className="mb-4 bg-white/[0.02] border border-white/[0.04] p-3 rounded-2xl flex items-center justify-between">
                <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] italic">
                  Quantidade:
                </span>
                <div className="flex items-center gap-1.5">
                  {[1, 5, 10, 50, 100].map((q) => (
                    <button
                      key={q}
                      onClick={() => setGiftQuantity(q)}
                      className={`px-2.5 py-1 rounded-xl text-[10px] font-black transition-all ${
                        giftQuantity === q
                          ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md'
                          : 'bg-white/5 text-white/40 hover:text-white/60 hover:bg-white/10'
                      }`}
                    >
                      x{q}
                    </button>
                  ))}
                  {/* Custom Input */}
                  <div className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-xl border border-white/5">
                    <span className="text-[8px] font-bold text-white/20 uppercase">Custom</span>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={giftQuantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setGiftQuantity(isNaN(val) || val < 1 ? 1 : val);
                      }}
                      className="w-10 bg-transparent text-center text-[10px] font-black text-pink-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 max-h-48 overflow-y-auto pr-1">
                {GIFTS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => handleSendGift(g.id)}
                    className="flex flex-col items-center gap-2 p-3 bg-black/20 rounded-[22px] hover:bg-white/5 active:scale-95 transition-all group border border-white/[0.03]"
                  >
                     <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center border border-white/5 group-hover:scale-105 transition-all duration-300 ${g.bgColor} ${g.color}`}>
                        <span className="text-lg">{g.icon}</span>
                     </div>
                     <div className="flex flex-col items-center space-y-1">
                       <span className="text-[10px] font-bold text-white uppercase tracking-tight truncate max-w-[65px]">{g.name}</span>
                       <div className="flex items-center gap-1 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/10">
                          <span className="text-[8px] font-black text-purple-400 uppercase tabular-nums">{g.price}</span>
                       </div>
                     </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSendMessage} className="flex items-center gap-3">
          <button 
            type="button" 
            onClick={() => setShowGifts(!showGifts)}
            className={`w-12 h-12 rounded-[18px] flex items-center justify-center transition-all border duration-300 ${showGifts ? 'bg-[#8A2EFF] text-white border-[#8A2EFF] shadow-[0_0_15px_rgba(138,46,255,0.4)]' : 'bg-white/5 text-white/40 border-white/5 hover:text-white hover:border-white/10'}`}
          >
            <Gift size={20} />
          </button>
          
          <div className="flex-1 relative group">
            <input
              type="text"
              value={text}
              onFocus={() => handleTyping(true)}
              onBlur={() => handleTyping(false)}
              onChange={(e) => { setText(e.target.value); if (!isTyping) handleTyping(true); }}
              placeholder="Sintonize sua mensagem..."
              className="w-full bg-[#121214]/60 border border-white/[0.06] rounded-[20px] pl-5 pr-14 py-3.5 text-sm text-white focus:outline-none focus:border-[#8A2EFF]/30 focus:shadow-[0_0_15px_rgba(138,46,255,0.05)] transition-all font-medium placeholder:text-white/25 shadow-inner"
            />
            <button 
              type="submit" 
              disabled={!text.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-[#8A2EFF] text-white w-9 h-9 rounded-[14px] flex items-center justify-center disabled:opacity-10 transition-all active:scale-90 hover:scale-105"
            >
              <Send size={14} className="ml-0.5" />
            </button>
          </div>
        </form>
      </div>
      {activeAnimation && (
        <GiftAnimationOverlay 
          activeAnimation={activeAnimation} 
          onAnimationComplete={() => setActiveAnimation(null)} 
        />
      )}
    </div>
  );
}
