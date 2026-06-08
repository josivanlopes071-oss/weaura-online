import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { compressImage } from '../lib/imageCompressor';
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
  MessageSquare, Volume2, X, Star, Heart, Flame, Trophy, Gamepad2,
  Paperclip, Trash2, Mic, Square, CornerUpLeft, Image, Video, Headphones, Smile
} from 'lucide-react';

interface Message {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  type: 'text' | 'gift' | 'media';
  giftType?: string;
  giftIcon?: string;
  giftQuantity?: number;
  receiverName?: string;
  auraGained?: number;
  coinsGained?: number;
  timestamp: any;
  // Enhanced Private Chat features
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio';
  isDeleted?: boolean;
  replyTo?: {
    id: string;
    authorName: string;
    text: string;
    type: string;
    mediaType?: string;
  };
  reactions?: { [emoji: string]: string[] };
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Enhanced features state
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<any>(null);

  // Debounced Typing Indicator State
  const typingTimeoutRef = useRef<any>(null);

  // Derive chatId: min(uid1, uid2)_max(uid1, uid2)
  const chatId = user && id ? [user.uid, id].sort().join('_') : null;

  // Track target user with real-time onSnapshot for precise online indicator
  useEffect(() => {
    if (!id) return;
    const uRef = doc(db, 'users', id);
    const unsubscribeTarget = onSnapshot(uRef, (snap) => {
      if (snap.exists()) {
        setTargetUser(snap.data());
      }
    }, (error) => {
      console.error("Error watching user:", error);
    });
    return () => unsubscribeTarget();
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
            if (m.authorId !== user?.uid) {
              setActiveAnimation({
                id: change.doc.id,
                senderName: m.authorName || 'Usuário',
                receiverName: m.receiverName || (targetUser?.displayName || 'Membro'),
                giftName: m.giftType || m.text,
                giftIcon: m.giftIcon || '🎁',
                auraGained: m.auraGained || 0,
                quantity: m.giftQuantity || 1,
                coinsGained: m.coinsGained || 0
              });
            }
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

    return () => { 
      unsubscribe(); 
      typingUnsubscribe(); 
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, [chatId, user, id]);

  // Debounced Typing notifier
  const handleTyping = (isTypingNow: boolean) => {
    if (!chatId || !user) return;
    
    if (isTypingNow) {
      if (!isTyping) {
        setIsTyping(true);
        updateDoc(doc(db, 'private_chats', chatId), { [`typing.${user.uid}`]: true }).catch(() => {});
      }
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        updateDoc(doc(db, 'private_chats', chatId), { [`typing.${user.uid}`]: false }).catch(() => {});
      }, 2500);
    } else {
      if (isTyping) {
        setIsTyping(false);
        updateDoc(doc(db, 'private_chats', chatId), { [`typing.${user.uid}`]: false }).catch(() => {});
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !chatId || !profile || !id) return;
    const messageText = text.trim();
    setText('');
    handleTyping(false);
    
    const replyPayload = replyingTo ? {
      id: replyingTo.id,
      authorName: replyingTo.authorName,
      text: replyingTo.isDeleted ? 'Mensagem apagada' : replyingTo.type === 'gift' ? `Presente: ${replyingTo.giftType}` : replyingTo.text,
      type: replyingTo.type,
      ...(replyingTo.mediaType ? { mediaType: replyingTo.mediaType } : {})
    } : null;

    setReplyingTo(null);

    try {
      await addDoc(collection(db, 'private_chats', chatId, 'messages'), {
        authorId: profile.uid,
        authorName: profile.displayName,
        text: messageText,
        type: 'text',
        timestamp: serverTimestamp(),
        ...(replyPayload ? { replyTo: replyPayload } : {})
      });
      await gainXp(5);
      await setDoc(doc(db, 'private_chats', chatId), { lastMessage: messageText, lastMessageAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
      await sendNotification({ type: 'message', fromId: profile.uid, fromName: profile.displayName, toId: id, text: messageText });
    } catch (err) { console.error(err); }
  };

  // Delete message for all (soft delete)
  const deleteMessage = async (messageId: string) => {
    if (!chatId) return;
    try {
      const msgRef = doc(db, 'private_chats', chatId, 'messages', messageId);
      await updateDoc(msgRef, {
        isDeleted: true,
        text: 'Esta mensagem foi apagada',
        mediaUrl: null,
        mediaType: null
      });
      setSelectedMessageId(null);
    } catch (err) {
      console.error("Erro ao apagar mensagem:", err);
    }
  };

  // Emoji Reaction Toggle
  const handleReact = async (messageId: string, emoji: string) => {
    if (!chatId || !user) return;
    try {
      const msgRef = doc(db, 'private_chats', chatId, 'messages', messageId);
      const msgSnap = await getDoc(msgRef);
      if (!msgSnap.exists()) return;
      
      const reactions = msgSnap.data().reactions || {};
      const currentReactors = reactions[emoji] || [];
      
      let updatedReactors: string[];
      if (currentReactors.includes(user.uid)) {
        updatedReactors = currentReactors.filter((uid: string) => uid !== user.uid);
      } else {
        updatedReactors = [...currentReactors, user.uid];
      }

      await updateDoc(msgRef, {
        [`reactions.${emoji}`]: updatedReactors
      });
      setSelectedMessageId(null);
    } catch (err) {
      console.error("Erro ao gerenciar reação:", err);
    }
  };

  // Media Attachment Selector
  const handleFileSelect = async (file: File) => {
    if (!file || !chatId || !profile || !id) return;
    
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    
    if (!isImage && !isVideo && !isAudio) {
      alert("Formato de arquivo não suportado. Envie fotos, vídeos ou áudios.");
      return;
    }

    if (!isImage && file.size > 800 * 1024) {
      alert("O arquivo é muito grande. O limite máximo é de 800KB para sincronização instantânea em tempo real.");
      return;
    }

    let base64Data = "";
    if (isImage) {
      try {
        base64Data = await compressImage(file);
      } catch (err) {
        console.error("Erro ao comprimir imagem:", err);
      }
    }

    const sendAttachment = async (dataUrl: string) => {
      const replyPayload = replyingTo ? {
        id: replyingTo.id,
        authorName: replyingTo.authorName,
        text: replyingTo.isDeleted ? 'Mensagem apagada' : replyingTo.type === 'gift' ? `Presente: ${replyingTo.giftType}` : replyingTo.text,
        type: replyingTo.type,
        ...(replyingTo.mediaType ? { mediaType: replyingTo.mediaType } : {})
      } : null;

      setReplyingTo(null);

      try {
        const typeLabel = isImage ? 'uma foto 📷' : isVideo ? 'um vídeo 🎥' : 'um áudio 🎵';
        await addDoc(collection(db, 'private_chats', chatId, 'messages'), {
          authorId: profile.uid,
          authorName: profile.displayName,
          text: `Enviou ${typeLabel}`,
          type: 'media',
          mediaType: isImage ? 'image' : isVideo ? 'video' : 'audio',
          mediaUrl: dataUrl,
          timestamp: serverTimestamp(),
          ...(replyPayload ? { replyTo: replyPayload } : {})
        });
        
        await gainXp(10);
        await setDoc(doc(db, 'private_chats', chatId), { 
          lastMessage: isImage ? '📷 Foto' : isVideo ? '🎥 Vídeo' : '🎵 Áudio', 
          lastMessageAt: serverTimestamp(), 
          updatedAt: serverTimestamp() 
        }, { merge: true });
        
        await sendNotification({ 
          type: 'message', 
          fromId: profile.uid, 
          fromName: profile.displayName, 
          toId: id, 
          text: `Enviou ${isImage ? 'uma foto' : isVideo ? 'um vídeo' : 'um áudio'}` 
        });
      } catch (err) {
        console.error("Erro ao enviar mídia:", err);
      }
    };

    if (base64Data) {
      await sendAttachment(base64Data);
    } else {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const resultData = e.target?.result as string;
        if (resultData) {
          await sendAttachment(resultData);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Web Audio Direct Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setRecordingSeconds(0);
      setIsRecording(true);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Stop all media tracks
        stream.getTracks().forEach(track => track.stop());

        if (audioBlob.size > 800 * 1024) {
          alert("O áudio gravado é muito grande. Tente gravar uma mensagem mais curta.");
          return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Data = reader.result as string;
          if (!base64Data || !chatId || !profile || !id) return;

          const replyPayload = replyingTo ? {
            id: replyingTo.id,
            authorName: replyingTo.authorName,
            text: replyingTo.isDeleted ? 'Mensagem apagada' : replyingTo.type === 'gift' ? `Presente: ${replyingTo.giftType}` : replyingTo.text,
            type: replyingTo.type,
            ...(replyingTo.mediaType ? { mediaType: replyingTo.mediaType } : {})
          } : null;

          setReplyingTo(null);

          try {
            await addDoc(collection(db, 'private_chats', chatId, 'messages'), {
              authorId: profile.uid,
              authorName: profile.displayName,
              text: 'Enviou uma mensagem de voz 🎙️',
              type: 'media',
              mediaType: 'audio',
              mediaUrl: base64Data,
              timestamp: serverTimestamp(),
              ...(replyPayload ? { replyTo: replyPayload } : {})
            });

            await setDoc(doc(db, 'private_chats', chatId), { 
              lastMessage: '🎵 Áudio Gravado', 
              lastMessageAt: serverTimestamp(), 
              updatedAt: serverTimestamp() 
            }, { merge: true });

            await sendNotification({ 
              type: 'message', 
              fromId: profile.uid, 
              fromName: profile.displayName, 
              toId: id, 
              text: 'Enviou uma mensagem de voz' 
            });
            await gainXp(12);
          } catch (err) {
            console.error("Erro ao enviar áudio gravado:", err);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Erro ao acessar microfone:", err);
      alert("Não foi possível acessar seu microfone. Verifique suas permissões.");
    }
  };

  const stopRecording = (cancel = false) => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      if (cancel) {
        mediaRecorderRef.current.onstop = () => {};
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      } else {
        mediaRecorderRef.current.stop();
      }
    }
    setIsRecording(false);
  };

  // Drag and Drop handler
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Formatting minutes/seconds
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Precise getLastSeen with automatic computations
  const getLastSeenText = () => {
    if (!targetUser) return 'Conexão Offline';
    if (targetUser.status === 'online') return 'Online agora';
    
    if (targetUser.lastSeen) {
      const date = typeof targetUser.lastSeen.toDate === 'function' 
        ? targetUser.lastSeen.toDate() 
        : new Date(targetUser.lastSeen);
      
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return 'Online há poucos instantes';
      if (diffMins < 60) return `Visto há ${diffMins} min`;
      if (diffHours < 24) return `Visto há ${diffHours} h`;
      return `Visto em ${date.toLocaleDateString()}`;
    }
    return 'Offline';
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
            text: `Enviou ${giftQuantity}x ${gift.name} ${gift.icon}! Ganhos de sorte: +${result.coinsGained} Moedas EGO!`,
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

        setActiveAnimation({
          id: Math.random().toString(),
          senderName: profile.displayName || "Usuário",
          receiverName: targetUser?.displayName || "Membro Aura",
          giftName: gift.name,
          giftIcon: gift.icon,
          auraGained: result.auraGained || (gift.aura * giftQuantity),
          quantity: giftQuantity,
          coinsGained: result.coinsGained || 0
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
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="fixed inset-0 bg-[#020202] flex flex-col z-[60] font-sans overflow-hidden"
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="absolute inset-4 bg-[#0c0c0d]/95 backdrop-blur-md flex flex-col items-center justify-center border-4 border-dashed border-[#8A2EFF]/45 z-[100] rounded-[36px] pointer-events-none">
           <Paperclip size={48} className="text-[#8A2EFF] animate-bounce mb-4" />
           <p className="text-sm font-black text-white uppercase tracking-widest italic">Solte o arquivo de mídia aqui...</p>
           <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1.5">(Fotos, vídeos ou áudios até 800KB)</p>
        </div>
      )}

      {/* Premium Chat Header */}
      <div className="flex items-center justify-between p-6 pt-14 border-b border-white/[0.04] glass-dark backdrop-blur-3xl z-10 shadow-premium">
        <div className="flex items-center gap-5">
          <button 
            onClick={() => navigate(-1)} 
            className="w-11 h-11 bg-white/5 rounded-2xl flex items-center justify-center text-white/40 hover:text-white transition-all active:scale-90 border border-white/10"
          >
            <ChevronLeft size={24} />
          </button>
          <div 
            onClick={() => navigate(`/profile/${id}`)}
            className="flex items-center gap-4 cursor-pointer group"
          >
            <div className="relative">
              <UserAvatar uid={id} className="w-12 h-12" />
              <div className={`absolute -bottom-1 -right-0.5 w-4 h-4 rounded-full border-3 border-[#0c0c0c] z-20 ${targetUser.status === 'online' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-gray-600'}`}></div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="font-black italic uppercase text-lg text-white leading-none tracking-tight group-hover:text-purple-400 transition-colors">{targetUser.displayName}</h2>
                <PremiumTag email={targetUser.email} role={targetUser.role} size="xs" />
              </div>
              <p className="text-[10px] font-black italic text-white/30 uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
                 <span className={`w-1.5 h-1.5 rounded-full ${targetUser.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-purple-500/30'}`}></span>
                 {getLastSeenText()}
              </p>
            </div>
          </div>
        </div>
        <button className="w-11 h-11 bg-white/5 rounded-2xl flex items-center justify-center text-white/40 hover:text-white transition-all border border-white/10">
           <MoreVertical size={20} />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6 bg-[#050505] scrollbar-hide">
        {messages.map((msg, idx) => {
          const isMe = msg.authorId === user?.uid;
          const showTime = idx === 0 || (msg.timestamp?.seconds - messages[idx-1]?.timestamp?.seconds > 300);
          const hasReactions = msg.reactions && Object.values(msg.reactions).some((users: any) => users && users.length > 0);
          
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
              
              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-1.5`}>
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="flex items-center gap-2 group relative max-w-[75%]"
                >
                  {/* Left Side Quote Line Helper if responding */}
                  {msg.replyTo && !msg.isDeleted && (
                    <div className="absolute top-0 bottom-0 -left-6 border-l border-white/10 h-full pointer-events-none" />
                  )}

                  <div className="flex flex-col w-full">
                    {/* Render Reply Reference header inside bubble block */}
                    {msg.replyTo && !msg.isDeleted && (
                      <div className={`text-[10px] py-1 px-3 bg-black/40 border-b border-white/[0.03] text-white/40 flex items-center gap-1.5 max-w-full ${isMe ? 'rounded-t-[18px]' : 'rounded-t-[18px]'}`}>
                         <CornerUpLeft size={10} className="text-purple-400" />
                         <span className="font-extrabold text-white/50">{msg.replyTo.authorName}:</span>
                         <span className="truncate max-w-[120px] italic">{msg.replyTo.text}</span>
                      </div>
                    )}

                    <div 
                      onClick={() => setSelectedMessageId(selectedMessageId === msg.id ? null : msg.id)}
                      className={`px-4.5 py-3 text-[13px] sm:text-[14px] relative group transition-all font-medium leading-relaxed cursor-pointer select-none ${
                        msg.replyTo ? 'rounded-b-[18px]' : 'rounded-[18px]'
                      } ${
                        msg.isDeleted 
                          ? 'bg-white/[0.01] text-white/20 border border-white/[0.02] italic'
                          : isMe 
                            ? 'bg-gradient-to-r from-[#8A2EFF] to-purple-600 text-white shadow-[0_8px_25px_rgba(138,46,255,0.18)] border border-[#8A2EFF]/20' 
                            : 'bg-[#121214] text-white/90 border border-white/[0.04]'
                      }`}
                    >
                      {msg.isDeleted ? (
                        <div className="flex items-center gap-2">
                          <X size={12} className="text-white/20" />
                          <span>Mensagem apagada</span>
                        </div>
                      ) : msg.type === 'gift' ? (
                        <div className="flex flex-col items-center gap-3 py-2 px-4 min-w-[160px]">
                           <div className="relative">
                             <div className="w-16 h-16 rounded-[22px] flex items-center justify-center bg-black/40 border border-white/10 shadow-xl text-3xl filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]">
                                {msg.giftIcon || '🎁'}
                             </div>
                             {msg.giftQuantity && msg.giftQuantity > 1 && (
                               <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white font-black text-[9px] px-2 py-0.5 rounded-full select-none shadow-md border border-red-400 animate-pulse">
                                 x{msg.giftQuantity}
                               </span>
                             )}
                           </div>
                           <div className="text-center space-y-1 w-full">
                              <span className="font-black uppercase text-[8px] tracking-[0.2em] block text-pink-400">PRESENTE ENVIADO</span>
                              <span className="text-xs font-black uppercase tracking-wider block text-white/90">
                                {msg.giftType || 'Aura Mimo'}
                              </span>
                              <div className="flex flex-col gap-1 items-center justify-center mt-2 w-full">
                                <span className="text-[9px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/10 leading-none whitespace-nowrap">
                                  +{msg.auraGained || 0} Aura
                                </span>
                                {msg.coinsGained && msg.coinsGained > 0 ? (
                                  <span className="text-[9px] font-extrabold text-yellow-400 bg-yellow-500/10 px-2.5 py-0.5 rounded-full border border-yellow-500/10 leading-none whitespace-nowrap flex items-center gap-1">
                                    🪙 +{msg.coinsGained} Moedas EGO
                                  </span>
                                ) : null}
                              </div>
                           </div>
                        </div>
                      ) : msg.type === 'media' ? (
                        <div className="space-y-2">
                           {msg.mediaType === 'image' && (
                             <div className="relative rounded-xl overflow-hidden max-h-48 border border-white/10 shadow-lg cursor-zoom-in group max-w-[240px]">
                                <img 
                                  src={msg.mediaUrl} 
                                  alt="Mídia" 
                                  onClick={(e) => { e.stopPropagation(); setFullScreenImage(msg.mediaUrl || null); }}
                                  className="w-full h-auto object-cover max-h-48"
                                  referrerPolicy="no-referrer"
                                />
                             </div>
                           )}
                           
                           {msg.mediaType === 'video' && (
                             <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-lg max-w-[240px]">
                                <video 
                                  src={msg.mediaUrl} 
                                  controls 
                                  className="w-full max-h-48"
                                  referrerPolicy="no-referrer"
                                />
                             </div>
                           )}

                           {msg.mediaType === 'audio' && (
                             <div className="flex items-center gap-3 p-1.5 rounded-xl bg-black/30 border border-white/5">
                                 <div className="w-8 h-8 rounded-full bg-[#8A2EFF]/20 border border-[#8A2EFF]/35 flex items-center justify-center text-[#8A2EFF] animate-pulse">
                                    <MessageSquare size={13} />
                                 </div>
                                 <audio 
                                   src={msg.mediaUrl} 
                                   controls 
                                   className="h-10 text-white max-w-[150px] inline-audio"
                                   style={{ filter: 'invert(1) hue-rotate(180deg)' }}
                                 />
                             </div>
                           )}

                           {msg.text && (
                             <span className="block mt-1 break-words">{msg.text}</span>
                           )}
                        </div>
                      ) : (
                        <span className="block break-words whitespace-pre-wrap">{msg.text}</span>
                      )}

                      {/* Time display indicator on hover */}
                      <div className={`absolute -bottom-5 ${isMe ? 'right-2' : 'left-2'} opacity-0 group-hover:opacity-100 transition-all duration-300 text-[8px] font-bold uppercase text-white/20 tracking-widest pointer-events-none`}>
                        {msg.timestamp?.toDate ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(msg.timestamp.toDate()) : ''}
                      </div>
                    </div>
                  </div>

                  {/* Actions context popover toggle */}
                  {selectedMessageId === msg.id && !msg.isDeleted && (
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0, y: 10 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      className="absolute z-40 bg-[#0e0e0f] border border-white/10 rounded-2xl p-2.5 shadow-[0_15px_30px_rgba(0,0,0,0.8)] flex flex-col gap-2 min-w-[155px]"
                      style={{
                        top: 'auto',
                        bottom: '110%',
                        left: isMe ? 'auto' : '0',
                        right: isMe ? '0' : 'auto'
                      }}
                    >
                      {/* Emojis row */}
                      <div className="flex items-center gap-1.5 pb-2 border-b border-white/5">
                        {QUICK_EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => handleReact(msg.id, emoji)}
                            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/10 text-sm transition-all active:scale-90"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-wider">
                         <button 
                           onClick={() => { setReplyingTo(msg); setSelectedMessageId(null); }}
                           className="flex items-center gap-2 p-2 hover:bg-white/5 rounded-xl text-white/70 hover:text-white transition-colors"
                         >
                           <CornerUpLeft size={13} className="text-purple-400" />
                           <span>Responder</span>
                         </button>

                         {isMe && (
                           <button 
                             onClick={() => deleteMessage(msg.id)}
                             className="flex items-center gap-2 p-2 hover:bg-red-500/10 rounded-xl text-red-500/70 hover:text-red-400 transition-colors"
                           >
                             <Trash2 size={13} className="text-red-400" />
                             <span>Apagar para Todos</span>
                           </button>
                         )}
                      </div>
                    </motion.div>
                  )}
                </motion.div>

                {/* Sub message details: reactions lists */}
                {hasReactions && !msg.isDeleted && (
                  <div className={`flex flex-wrap gap-1 mt-1 max-w-[70%] ${isMe ? 'self-end' : 'self-start'}`}>
                    {Object.entries(msg.reactions || {})
                      .filter(([_, users]) => (users as any).length > 0)
                      .map(([emoji, users]) => {
                        const reactedByMe = (users as any).includes(user?.uid || '');
                        return (
                          <button
                            key={emoji}
                            onClick={() => handleReact(msg.id, emoji)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                              reactedByMe 
                                ? 'bg-[#8A2EFF]/10 border border-[#8A2EFF]/25 text-[#8A2EFF]' 
                                : 'bg-white/5 border border-white/[0.04] text-white/40 hover:text-white'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="text-[9px] tabular-nums font-black">{(users as any).length}</span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
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
        {/* Reply reference banner displaying */}
        {replyingTo && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="bg-[#121214] border border-white/[0.04] p-3 px-4 rounded-[18px] mb-3 flex items-center justify-between text-xs"
          >
            <div className="flex items-start gap-3">
               <div className="w-1 bg-[#8A2EFF] self-stretch rounded-full"></div>
               <div>
                  <span className="font-extrabold text-[#8A2EFF] uppercase tracking-wider text-[9px]">Respondendo a {replyingTo.authorName}</span>
                  <p className="text-white/60 truncate max-w-[240px] mt-0.5 font-medium">
                     {replyingTo.isDeleted ? 'Mensagem apagada' : replyingTo.type === 'gift' ? `Presente: ${replyingTo.giftType}` : replyingTo.text}
                  </p>
               </div>
            </div>
            <button onClick={() => setReplyingTo(null)} className="text-white/40 hover:text-white transition-all p-1 bg-white/5 rounded-md">
               <X size={14} />
            </button>
          </motion.div>
        )}

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

        {/* Action controllers input box switcher depending on Audio Recording */}
        {isRecording ? (
          <div className="flex items-center justify-between p-3.5 bg-red-500/5 border border-red-500/20 rounded-[24px] gap-4 w-full">
            <div className="flex items-center gap-3">
               <span className="relative flex h-3 w-3">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
               </span>
               <span className="text-xs font-black uppercase text-red-400 tracking-widest">
                  Gravando Áudio: {formatTime(recordingSeconds)}
               </span>
            </div>
            <div className="flex items-center gap-2">
               <button 
                 type="button" 
                 onClick={() => stopRecording(true)}
                 className="px-4.5 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/10"
               >
                  Descartar
               </button>
               <button 
                 type="button" 
                 onClick={() => stopRecording(false)}
                 className="px-4.5 py-2.5 bg-red-600 hover:bg-red-500 text-white transition-colors text-[10px] font-black uppercase tracking-widest rounded-xl border border-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
               >
                  Enviar Áudio
               </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="flex items-center gap-2.5">
            {/* Invisibile media file attachment input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={(e) => { if(e.target.files?.[0]) handleFileSelect(e.target.files[0]) }}
              className="hidden" 
              accept="image/*,video/*,audio/*"
            />

            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              className="w-12 h-12 rounded-[18px] flex items-center justify-center bg-white/5 text-white/40 border-white/5 hover:text-white hover:border-white/10 transition-all active:scale-90"
              title="Anexar Foto, Vídeo ou Áudio"
            >
              <Paperclip size={20} />
            </button>

            <button 
              type="button" 
              onClick={startRecording}
              className="w-12 h-12 rounded-[18px] flex items-center justify-center bg-white/5 text-white/40 border-white/5 hover:text-white hover:border-white/10 transition-all active:scale-90"
              title="Gravar Mensagem de Voz"
            >
              <Mic size={20} />
            </button>

            <button 
              type="button" 
              onClick={() => setShowGifts(!showGifts)}
              className={`w-12 h-12 rounded-[18px] flex items-center justify-center transition-all border duration-300 ${showGifts ? 'bg-[#8A2EFF] text-white border-[#8A2EFF] shadow-[0_0_15px_rgba(138,46,255,0.4)]' : 'bg-white/5 text-white/40 border-white/5 hover:text-white hover:border-white/10'}`}
              title="Enviar Presente"
            >
              <Gift size={20} />
            </button>
            
            <div className="flex-1 relative group">
              <input
                type="text"
                value={text}
                onKeyDown={() => handleTyping(true)}
                onChange={(e) => { setText(e.target.value); handleTyping(true); }}
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
        )}
      </div>

      {activeAnimation && (
        <GiftAnimationOverlay 
          activeAnimation={activeAnimation} 
          onAnimationComplete={() => setActiveAnimation(null)} 
        />
      )}

      {/* Full Screen Image Modal Viewer overlay popup */}
      <AnimatePresence>
        {fullScreenImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFullScreenImage(null)}
            className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-4 cursor-zoom-out"
          >
            <button 
              onClick={() => setFullScreenImage(null)}
              className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <X size={24} />
            </button>
            <motion.img
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              src={fullScreenImage}
              alt="Visualização Completa"
              className="max-w-full max-h-[90vh] object-contain rounded-3xl border border-white/10 shadow-2xl"
              referrerPolicy="no-referrer"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }
