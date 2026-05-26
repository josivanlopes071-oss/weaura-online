import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { 
  doc, onSnapshot, collection, addDoc, serverTimestamp, query, orderBy, limit, updateDoc, arrayUnion, arrayRemove, setDoc, getDoc, deleteField, increment, getDocs, deleteDoc, where 
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { useVoiceChat } from '../hooks/useVoiceChat';
import UserAvatar from '../components/UserAvatar';
import { UserPremiumTag } from '../components/PremiumTag';
import OnboardingTour from '../components/OnboardingTour';
import { 
  Mic, MicOff, Send, Gift, ChevronLeft, MoreVertical, 
  Users, MessageSquare, Volume2, X, Star, Heart, Flame, Trophy,
  Smile, ThumbsUp, PartyPopper, Ghost as GhostIcon,
  Music, Lock, Plus, LayoutGrid, ShoppingBag, VolumeX, MessageCircle,
  Settings, Shield, Camera, Palette, UserMinus, BellOff, Crown, Eye, EyeOff,
  Trash2, LogOut, AlertCircle, Sparkles, Rocket, Gem, Coins, Zap, HelpCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Reaction {
  id: string;
  emoji: string;
  userId: string;
  timestamp: any;
}

interface Message {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  type: 'text' | 'gift' | 'system';
  giftType?: string;
  timestamp: any;
  clientCreatedAt?: number;
}

interface RoomData {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: string[];
  activeSpeakers: string[];
  isLocked?: boolean;
  slots?: { [key: number]: string }; // slotId -> userId
  category?: string;
  participantLimit?: number;
  password?: string;
  theme?: string;
  neonColor?: string;
  moderators?: string[];
  mutedUsers?: string[];
  coHosts?: string[];
  coverURL?: string;
  voicePeerIds?: { [userId: string]: string };
  giftRank?: { [userId: string]: { displayName: string, photoURL: string, totalSpent: number } };
}

const nameCache: { [uid: string]: string } = {};
const photoCache: { [uid: string]: string } = {};

function UserDisplayName({ uid, fallback }: { uid?: string | null, fallback: string }) {
  const { profile, user } = useAuth();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setName(null);
      return;
    }
    
    // If it's the current user, use the profile name directly for real-time updates
    if (user && uid === user.uid && profile?.displayName) {
      setName(profile.displayName);
      return;
    }

    if (nameCache[uid]) {
      setName(nameCache[uid]);
      return;
    }

    const userRef = doc(db, 'users', uid);
    getDoc(userRef).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        const displayName = data.displayName;
        const photoURL = data.photoURL;
        nameCache[uid] = displayName;
        if (photoURL) photoCache[uid] = photoURL;
        setName(displayName);
      }
    }).catch(err => console.warn("Error fetching user name:", err));
  }, [uid, user?.uid, profile?.displayName]);

  if (!uid) return <>{fallback}</>;
  return <>{name || '...'}</>;
}

const VOICE_SLOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const ROOM_THEMES = [
  { id: 'aura', name: 'Aura', primary: '#a855f7', secondary: '#ec4899', bg: '#020202' },
  { id: 'cyberpunk', name: 'Cyberpunk', primary: '#00f3ff', secondary: '#ff00ff', bg: '#050505' },
  { id: 'synthwave', name: 'Synthwave', primary: '#7b1fa2', secondary: '#01cdfe', bg: '#1a0633' },
  { id: 'glitch', name: 'Glitch', primary: '#ef4444', secondary: '#22c55e', bg: '#0a0a0a' },
  { id: 'emerald', name: 'Esmeralda', primary: '#10b981', secondary: '#3b82f6', bg: '#020504' },
];

export default function Room() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, user, updateProfile, updateCoins, gainXp } = useAuth();
  const [room, setRoom] = useState<RoomData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [text, setText] = useState('');
  const sessionStartTimeRef = useRef<number>(Date.now());
  const [isMicOn, setIsMicOn] = useState(false);
  const [forceShowTour, setForceShowTour] = useState(false);

  // Set session start time on mount or whenever the room ID changes, and clear messages cache
  useEffect(() => {
    setMessages([]);
    sessionStartTimeRef.current = Date.now();
  }, [id]);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isPasswordVerified, setIsPasswordVerified] = useState(location.state?.passwordVerified || false);
  const [passwordInput, setPasswordInput] = useState('');
  const [localPasswordError, setLocalPasswordError] = useState(false);
  
  // Voice Chat Logic
  const slotParticipants = React.useMemo(() => {
    if (!room?.slots) return [];
    return Object.values(room.slots).filter(uid => !!uid) as string[];
  }, [room?.slots]);

  const sortedContributors = React.useMemo(() => {
    if (!room?.giftRank) return [];
    return Object.entries(room.giftRank)
      .map(([uid, info]) => ({
        uid,
        displayName: (info as any).displayName || '',
        photoURL: (info as any).photoURL || '',
        totalSpent: (info as any).totalSpent || 0
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }, [room?.giftRank]);

  const { remoteStreams, volumes, micError, setMicError, hasAnotherTabOpen } = useVoiceChat(
    id || '', 
    user?.uid || '', 
    isMicOn, 
    slotParticipants,
    room?.voicePeerIds,
    async (peerId) => {
      if (id && user && db) {
        try {
          const rRef = doc(db, 'rooms', id);
          await updateDoc(rRef, {
            [`voicePeerIds.${user.uid}`]: peerId
          });
          console.log(`[Room] Registered active voice Peer ID ${peerId} in Firestore`);
        } catch (err) {
          console.warn("[Room] Error updating voicePeerIds in Firestore:", err);
        }
      }
    }
  );

  // Handle reset of microfone state if permission is denied / mic error occurs
  useEffect(() => {
    if (micError) {
      if (isMicOn) {
        setIsMicOn(false);
        if (id && user) {
          const roomRef = doc(db, 'rooms', id);
          updateDoc(roomRef, { activeSpeakers: arrayRemove(user.uid) }).catch(() => {});
        }
      }
    }
  }, [micError, isMicOn, id, user]);

  const [showGifts, setShowGifts] = useState(false);
  const [giftActiveTab, setGiftActiveTab] = useState<'gifts' | 'ranking'>('gifts');
  const [showSettings, setShowSettings] = useState(false);
  const [showUserActions, setShowUserActions] = useState<string | null>(null);
  
  // Settings Panel State
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editLimit, setEditLimit] = useState(12);
  const [editPassword, setEditPassword] = useState('');
  const [editNeon, setEditNeon] = useState('#a855f7');
  const [editTheme, setEditTheme] = useState('aura');
  const [editCover, setEditCover] = useState('');
  const [editFreeMic, setEditFreeMic] = useState(true);
  const [editLayout, setEditLayout] = useState('standard');
  const [isSaving, setIsSaving] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const roomRefData = useRef<RoomData | null>(null);

  useEffect(() => {
    roomRefData.current = room;
  }, [room]);

  useEffect(() => {
    if (showSettings && room) {
      setEditName(room.name);
      setEditDescription(room.description);
      setEditCategory(room.category || 'Chat');
      setEditLimit(room.participantLimit || 12);
      setEditPassword(room.password || '');
      setEditNeon(room.neonColor || '#a855f7');
      setEditTheme(room.theme || 'aura');
      setEditCover(room.coverURL || '');
    }
  }, [showSettings, room]);

  const copyDisplayId = (displayId: number) => {
    navigator.clipboard.writeText(String(displayId));
    alert("ID Numérico copiado: " + displayId);
  };

  const copyUid = (uid: string) => {
    navigator.clipboard.writeText(uid);
    alert("UID copiado: " + uid);
  };

  useEffect(() => {
    if (!id || !user) return;

    const roomRef = doc(db, 'rooms', id);
    
    // Join room
    updateDoc(roomRef, {
      members: arrayUnion(user.uid)
    }).catch(() => {});

    // Listen for room updates
    const unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        
        // Locking logic
        setRoom({
          id: snapshot.id,
          name: data.name || 'Sala de Voz',
          description: data.description || '',
          ownerId: data.ownerId || '',
          members: data.members || [],
          activeSpeakers: data.activeSpeakers || [],
          isLocked: data.isLocked || false,
          slots: data.slots || {},
          category: data.category || 'Chat',
          participantLimit: data.participantLimit || 12,
          password: data.password || '',
          neonColor: data.neonColor || '#a855f7',
          theme: data.theme || 'aura',
          coverURL: data.coverURL || '',
          allowFreeMic: data.allowFreeMic !== false,
          stageLayout: data.stageLayout || 'standard',
          voicePeerIds: data.voicePeerIds || {},
          giftRank: data.giftRank || {}
        });
      } else {
        // Room deleted
        navigate('/');
      }
    }, (error) => {
      console.warn("Firestore Room snapshot warning (non-fatal):", error.message || error);
    });

    // Listen for messages using client-side sorting for zero-latency instant updates
    const messagesQuery = query(
      collection(db, 'rooms', id, 'messages'),
      orderBy('clientCreatedAt', 'desc'),
      limit(30)
    );

    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const msgs = snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data } as Message;
      });

      // Sort client-side so they appear chronologically (oldest to newest)
      msgs.sort((a, b) => {
        const valA = a.clientCreatedAt || 0;
        const valB = b.clientCreatedAt || 0;
        return valA - valB;
      });
      
      // Filter out messages that were there BEFORE the user clicked to enter this current room session
      // This guarantees each room session is separate and older chats do not clutter the fresh feed.
      const currentSessionMsgs = msgs.filter(m => {
        const msgTime = m.clientCreatedAt || 0;
        return msgTime >= sessionStartTimeRef.current - 60000;
      });

      setMessages(currentSessionMsgs);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (error) => {
      console.warn("Firestore Messages snapshot warning (non-fatal):", error.message || error);
    });

    // Listen for reactions
    const reactionsQuery = query(
      collection(db, 'rooms', id, 'reactions'),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    const unsubscribeReactions = onSnapshot(reactionsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reaction));
      setReactions(data);
    }, (error) => {
      console.warn("Firestore Reactions snapshot warning (non-fatal):", error.message || error);
    });

    // Heartbeat logic to prevent ghost rooms
    const heartbeat = setInterval(() => {
      if (id && user && roomRefData.current && roomRefData.current.ownerId === user.uid) {
        updateDoc(roomRef, { lastActive: serverTimestamp() }).catch(() => {});
      }
    }, 60000); // 1 minute

    return () => {
      unsubscribeRoom();
      unsubscribeMessages();
      unsubscribeReactions();
      clearInterval(heartbeat);
      
      const exitRoom = async () => {
        if (!id || !user) return;
        const roomRef = doc(db, 'rooms', id);
        try {
          const updateData: any = {
            members: arrayRemove(user.uid),
            activeSpeakers: arrayRemove(user.uid),
            [`voicePeerIds.${user.uid}`]: deleteField()
          };

          // Find if user is in a slot and remove them
          if (roomRefData.current?.slots) {
            const userSlot = Object.entries(roomRefData.current.slots).find(([_, uid]) => uid === user.uid);
            if (userSlot) {
              updateData[`slots.${userSlot[0]}`] = null;
            }
          }

          await updateDoc(roomRef, updateData).catch(() => {});

          // Clear messages if owner is leaving or if it was the last person in the room
          const isOwner = roomRefData.current?.ownerId === user.uid;
          const membersList = roomRefData.current?.members || [];
          const isLastPerson = membersList.length <= 1 || (membersList.length === 2 && membersList.includes(user.uid));
          if (isOwner || isLastPerson) {
            const messagesQuery = query(collection(db, 'rooms', id, 'messages'));
            const snapshot = await getDocs(messagesQuery);
            const deletePromises = snapshot.docs.map(docSnap => deleteDoc(doc(db, 'rooms', id, 'messages', docSnap.id)));
            await Promise.all(deletePromises);
          }
        } catch (e) {}
      };
      exitRoom();
    };
  }, [id, user]);

  const sendReaction = async (emoji: string) => {
    if (!id || !user) return;
    await addDoc(collection(db, 'rooms', id, 'reactions'), {
      emoji,
      userId: user.uid,
      timestamp: serverTimestamp()
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const messageText = text.trim();
    if (!messageText || !id) return;
    if (!user) {
      alert("Você precisa estar logado para enviar mensagens.");
      return;
    }

    // Clear input instantly for zero-latency user feedback
    setText('');

    // Award XP optimistically
    gainXp(5).catch((e) => console.warn("Erro ao acumular XP:", e));

    try {
      const authorId = user.uid;
      const authorName = profile?.displayName || user.displayName || user.email?.split('@')[0] || 'Usuário';
      
      // Fire-and-forget the document addition so that Firestore's offline local cache 
      // renders the message instantly on screen. This prevents any loading freezes.
      addDoc(collection(db, 'rooms', id, 'messages'), {
        authorId,
        authorName,
        text: messageText,
        type: 'text',
        timestamp: serverTimestamp(),
        clientCreatedAt: Date.now()
      }).catch((err: any) => {
        console.error("Erro assíncrono ao enviar mensagem:", err);
      });
    } catch (err: any) {
      console.error("Erro ao estruturar mensagem:", err);
    }
  };

  const toggleMic = async () => {
    if (!id || !user || !room) return;
    
    // Check if user is in a slot
    const userSlot = Object.entries(room.slots || {}).find(([_, uid]) => uid === user.uid);
    if (!userSlot) {
      alert("Você precisa estar em um assento para falar.");
      return;
    }

    const newState = !isMicOn;
    setIsMicOn(newState);

    const roomRef = doc(db, 'rooms', id);
    if (newState) {
      await updateDoc(roomRef, { activeSpeakers: arrayUnion(user.uid) }).catch(() => {});
    } else {
      await updateDoc(roomRef, { activeSpeakers: arrayRemove(user.uid) }).catch(() => {});
    }
  };

  const toggleRoomLock = async () => {
    if (!id || !room || room.ownerId !== user?.uid) return;
    const roomRef = doc(db, 'rooms', id);
    await updateDoc(roomRef, { isLocked: !room.isLocked });
  };

  const takeSlot = async (slotId: number) => {
    if (!id || !user || !room) return;
    
    // Check if slot is locked or taken
    if (room.slots?.[slotId] && room.slots[slotId] !== user.uid) return;

    // Check if user is already in a slot
    const currentSlotEntry = Object.entries(room.slots || {}).find(([_, uid]) => uid === user.uid);
    const roomRef = doc(db, 'rooms', id);

    const updateData: any = {};

    if (currentSlotEntry) {
      const oldSlotId = Number(currentSlotEntry[0]);
      if (oldSlotId === slotId) {
        return;
      }
      // Free old slot in the same operation
      updateData[`slots.${oldSlotId}`] = null;
    }

    // Occupy new slot
    updateData[`slots.${slotId}`] = user.uid;

    try {
      await updateDoc(roomRef, updateData);
    } catch (err) {
      console.error("Error setting slot:", err);
    }
  };

  const leaveSlot = async () => {
    if (!id || !user || !room) return;
    
    const currentSlotEntry = Object.entries(room.slots || {}).find(([_, uid]) => uid === user.uid);
    if (!currentSlotEntry) return;

    const roomRef = doc(db, 'rooms', id);
    
    // Stop mic first
    setIsMicOn(false);
    
    try {
      await updateDoc(roomRef, { 
        [`slots.${currentSlotEntry[0]}`]: null,
        activeSpeakers: arrayRemove(user.uid)
      });
      setShowUserActions(null);
    } catch (err) {
      console.error("Error leaving slot:", err);
    }
  };

  const handleLeaveRoom = () => {
    // 1. Immediately toggle local microfone and states off
    setIsMicOn(false);
    
    // 2. Perform the Firestore removals asynchronously in the background so they do not block instant navigation
    if (id && user && room) {
      const roomRef = doc(db, 'rooms', id);
      const updateData: any = {
        members: arrayRemove(user.uid),
        activeSpeakers: arrayRemove(user.uid),
        [`voicePeerIds.${user.uid}`]: deleteField()
      };

      const currentSlotEntry = Object.entries(room.slots || {}).find(([_, uid]) => uid === user.uid);
      if (currentSlotEntry) {
        updateData[`slots.${currentSlotEntry[0]}`] = null;
      }

      // Fire-and-forget the document updating to keep exit instant
      updateDoc(roomRef, updateData).catch((err) => {
        console.warn("Backend error during silent exit update:", err);
      });

      // Clear messages asynchronously if user is owner or if it was the last person in the room
      const isOwner = room.ownerId === user.uid;
      const membersList = room.members || [];
      const isLastPerson = membersList.length <= 1 || (membersList.length === 2 && membersList.includes(user.uid));
      if (isOwner || isLastPerson) {
        const messagesQuery = query(collection(db, 'rooms', id, 'messages'));
        getDocs(messagesQuery).then((snapshot) => {
          const deletePromises = snapshot.docs.map(docSnap => deleteDoc(doc(db, 'rooms', id, 'messages', docSnap.id)));
          return Promise.all(deletePromises);
        }).catch((err) => {
          console.warn("Silent messages cleanup error or permission warning:", err);
        });
      }
    }

    // 3. Drive transition immediately with zero delay
    navigate('/');
  };

  const handleSaveSettings = async () => {
    if (!id || !room || room.ownerId !== user?.uid) return;
    setIsSaving(true);
    try {
      const roomRef = doc(db, 'rooms', id);
      await updateDoc(roomRef, {
        name: editName || room.name,
        description: editDescription,
        category: editCategory || room.category,
        participantLimit: editLimit || room.participantLimit,
        password: editPassword,
        neonColor: ROOM_THEMES.find(t => t.id === editTheme)?.primary || room.neonColor,
        theme: editTheme,
        coverURL: editCover,
        allowFreeMic: editFreeMic,
        stageLayout: editLayout,
        isLocked: !!editPassword,
      });
      setShowSettings(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!id || !room || room.ownerId !== user?.uid) return;
    if (!window.confirm("Você tem certeza que deseja APAGAR DEFINITIVAMENTE esta sala? Esta ação não pode ser desfeita.")) return;
    
    setIsSaving(true);
    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'rooms', id));
      navigate('/');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const kickUser = async (uid: string) => {
    if (!id || !room || room.ownerId !== user?.uid) return;
    if (uid === user.uid) return;
    
    try {
      const roomRef = doc(db, 'rooms', id);
      await updateDoc(roomRef, {
        members: arrayRemove(uid),
        activeSpeakers: arrayRemove(uid),
        // Remove from slots
        ...Object.keys(room.slots || {}).reduce((acc: any, key: string) => {
          if (room.slots[key] === uid) acc[`slots.${key}`] = null;
          return acc;
        }, {})
      });
      setShowUserActions(null);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleMuteUser = async (uid: string) => {
    if (!id || !room || room.ownerId !== user?.uid) return;
    const isMuted = room.mutedUsers?.includes(uid);
    const roomRef = doc(db, 'rooms', id);
    if (isMuted) {
      await updateDoc(roomRef, { mutedUsers: arrayRemove(uid) });
    } else {
      await updateDoc(roomRef, { mutedUsers: arrayUnion(uid) });
    }
    setShowUserActions(null);
  };

  const sendGift = async (gift: { label: string; cost: number }) => {
    if (!id || !profile || !profile.coins || profile.coins < gift.cost) {
      alert("Saldo EGO insuficiente!");
      return;
    }
    
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    try {
      const uid = user?.uid || profile?.uid || '';
      const dName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Usuário';
      const uPhoto = profile?.photoURL || user?.photoURL || '';
      
      await updateCoins(gift.cost, 'subtract');

      // Track generosity ranking inside the room document in Firestore
      const roomRef = doc(db, 'rooms', id);
      const userRankKey = `giftRank.${uid}`;
      await updateDoc(roomRef, {
        [userRankKey]: {
          displayName: dName,
          photoURL: uPhoto,
          totalSpent: increment(gift.cost)
        }
      }).catch((e) => console.warn("Erro ao atualizar ranking de presentes:", e));

      await addDoc(collection(db, 'rooms', id, 'messages'), {
        authorId: uid,
        authorName: dName,
        text: `enviou um presente: ${gift.label}!`,
        type: 'gift',
        giftType: gift.label,
        timestamp: serverTimestamp(),
        clientCreatedAt: Date.now()
      });

      // Gain XP proportional to the gift's value (1 XP per EGO, min 20 XP)
      const xpEarned = Math.max(20, gift.cost);
      await gainXp(xpEarned);

      setShowGifts(false);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Erro ao processar presente.");
    }
  };

  const handleLocalPasswordVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (room?.password === passwordInput) {
      setIsPasswordVerified(true);
      setLocalPasswordError(false);
    } else {
      setLocalPasswordError(true);
    }
  };

  if (!room) return (
    <div className="fixed inset-0 bg-[#020202] flex flex-col items-center justify-center text-white p-10 text-center">
      <div className="w-20 h-20 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-6 shadow-[0_0_30px_rgba(168,85,247,0.3)]"></div>
      <h2 className="text-2xl font-black italic uppercase tracking-tighter">Conectando Aura...</h2>
    </div>
  );

  if (room.isLocked && room.ownerId !== user?.uid && !isPasswordVerified) {
    return (
      <div className="fixed inset-0 bg-[#020202] z-[200] flex items-center justify-center p-8">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-[48px] p-10 shadow-2xl relative z-10"
        >
          <div className="flex flex-col items-center text-center space-y-8">
            <div className="w-20 h-20 bg-purple-500/10 rounded-[30px] flex items-center justify-center border border-purple-500/20 shadow-[0_0_40px_rgba(168,85,247,0.1)]">
              <Lock className="text-purple-500" size={40} />
            </div>

            <div>
              <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Acesso Restrito</h2>
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em] mt-3">{room.name}</p>
            </div>

            <form onSubmit={handleLocalPasswordVerify} className="w-full space-y-6">
              <div className="space-y-4">
                <input 
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="CHAVE DE ACESSO"
                  className={`w-full bg-black/40 border ${localPasswordError ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'border-white/5'} rounded-3xl py-6 px-8 text-white text-center text-xl font-black outline-none focus:border-purple-500/40 transition-all placeholder:text-white/5 uppercase tracking-[0.2em]`}
                  autoFocus
                />
                {localPasswordError && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[10px] font-black text-red-500 uppercase tracking-widest italic"
                  >
                    Chave Inválida • Tente Novamente
                  </motion.p>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <button 
                  type="submit"
                  className="w-full py-6 bg-white text-black rounded-3xl text-[11px] font-black uppercase tracking-[0.2em] shadow-[0_20px_40px_rgba(255,255,255,0.1)] active:scale-95 transition-all italic"
                >
                  Confirmar Acesso
                </button>
                <button 
                  type="button"
                  onClick={() => navigate('/')}
                  className="w-full py-4 bg-white/5 rounded-2xl text-[9px] font-black text-white/20 uppercase tracking-widest hover:text-white transition-all italic"
                >
                  Voltar para o Início
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  const currentTheme = ROOM_THEMES.find(t => t.id === (room.theme || 'aura')) || ROOM_THEMES[0];

  return (
    <div 
      className="fixed inset-0 flex flex-col z-50 font-sans h-[100dvh] overflow-hidden transition-colors duration-1000"
      style={{ backgroundColor: currentTheme.bg }}
    >
      {/* Hidden Audio Elements for Voice Chat */}
      <div className="hidden">
        {Object.entries(remoteStreams).map(([uid, stream]) => (
          <audio
            key={uid}
            autoPlay
            playsInline
            muted={!isSpeakerOn}
            ref={(el) => {
              if (el) {
                if (el.srcObject !== stream) {
                  el.srcObject = stream;
                }
                // Programmatic play fallback to bypass Android/iOS touch-to-play restrictions 
                el.play().catch((err) => {
                  console.warn(`[Audio] Programmatic play blocked for peer ${uid}:`, err);
                });
              }
            }}
          />
        ))}
      </div>

      {/* Background Neon Glows */}
      <div 
        className="absolute top-0 left-0 w-full h-[50vh] blur-[120px] rounded-full pointer-events-none opacity-10 transition-all duration-1000"
        style={{ backgroundColor: currentTheme.primary }}
      ></div>
      {/* Refined Header */}
      <header className="flex-none flex items-center justify-between px-8 pt-16 pb-6 glass-dark border-b border-white/[0.04] relative z-20 shadow-premium">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleLeaveRoom}
            className="w-12 h-12 flex items-center justify-center bg-white/5 border border-white/10 rounded-2xl text-white/40 hover:text-white transition-all active:scale-90"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-base font-black italic uppercase text-white tracking-widest">{room.name}</h1>
              <div className="flex items-center gap-2 px-2 py-0.5 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">ID:{id?.slice(0, 6)}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-1.5">
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 italic">{room.category || 'Mundo'}</span>
               <div className="w-1 h-1 bg-white/10 rounded-full" />
               <div className="flex items-center gap-1.5">
                 <Users size={12} className="text-purple-500/50" />
                 <span className="text-[11px] font-black text-white/30 tabular-nums">{room.members.length} Ativos</span>
               </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setForceShowTour(true)}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-white/30 hover:text-white hover:border-white/20 transition-all active:scale-90"
            title="Como Funciona"
          >
            <HelpCircle size={22} />
          </button>
          {room.ownerId === user?.uid && (
            <button 
              onClick={() => setShowSettings(true)}
              className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-white/30 hover:text-white hover:border-white/20 transition-all active:scale-90"
            >
              <Settings size={22} />
            </button>
          )}
          <button 
            onClick={handleLeaveRoom}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white text-black hover:bg-red-500 hover:text-white transition-all active:scale-90 shadow-[0_10px_20px_rgba(255,255,255,0.1)]"
          >
            <LogOut size={22} />
          </button>
        </div>
      </header>

      {/* Stage Layout */}
      <main className="flex-1 overflow-y-auto px-6 relative z-10 pt-10 pb-48 no-scrollbar scroll-smooth">
        {/* Host Area - The "Stage" */}
        <div className="relative mb-16">
            <div className="flex flex-col items-center relative z-10">
                <div className="relative">
                  {/* Premium Specialist Tool Ring */}
                  <div 
                    id="tour-host-seat"
                    className={`p-1.5 rounded-full transition-all duration-1000 relative ${
                      room.activeSpeakers.includes(room.slots?.[0] || '') || (volumes[room.slots?.[0] || ''] > 5) 
                        ? 'shadow-[0_0_60px_rgba(168,85,247,0.3)]' 
                        : 'bg-white/5 border border-white/5'
                    }`}
                    style={{ 
                      background: room.activeSpeakers.includes(room.slots?.[0] || '') || (volumes[room.slots?.[0] || ''] > 5) 
                        ? `linear-gradient(to tr, ${currentTheme.primary}, ${currentTheme.secondary}, #fb923c)` 
                        : undefined 
                    }}
                  >
                    {/* Inner Hardware Ring */}
                    <div className="absolute inset-1 rounded-full border border-white/10 border-dashed animate-[spin_20s_linear_infinite] opacity-30 pointer-events-none" />
                    
                    <VoiceSeat 
                      slotId={0} 
                      userId={room.slots?.[0]} 
                      size="large" 
                      isActive={room.activeSpeakers.includes(room.slots?.[0] || '') || (volumes[room.slots?.[0] || ''] > 5)}
                      isOwner={room.slots?.[0] === room.ownerId}
                      volumeLevel={volumes[room.slots?.[0] || '']}
                      activeColor={currentTheme.primary}
                      onTake={takeSlot}
                      onUserClick={setShowUserActions}
                    />
                  </div>
                  
                  {/* Luxury Badge */}
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-zinc-900 px-4 py-1 rounded-full border border-white/20 shadow-2xl z-20">
                     <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />
                     <span className="text-[9px] font-black uppercase text-white tracking-[0.15em] whitespace-nowrap">HOST PRINCIPAL</span>
                  </div>
                </div>
                
                <div className="mt-8 text-center">
                  <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2 justify-center">
                    <UserDisplayName uid={room.slots?.[0]} fallback="Esperando Host" />
                    {room.slots?.[0] === room.ownerId && <Crown size={14} className="text-yellow-500 fill-yellow-500/20" />}
                    <UserPremiumTag uid={room.slots?.[0]} size="xs" />
                  </h3>
                  <div className="flex items-center justify-center gap-1.5 mt-1 bg-white/5 px-3 py-1 rounded-full border border-white/5 w-fit mx-auto">
                    <Flame size={10} className="text-orange-500" />
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Ativo Agora</span>
                  </div>
                </div>
            </div>
        </div>

        {/* Audience Seats - Perfectly Circular Grid */}
        <div id="tour-audience-seats" className="grid grid-cols-4 gap-y-10 gap-x-4 mb-20 max-w-sm mx-auto bg-white/[0.02] p-8 rounded-[40px] border border-white/[0.03] backdrop-blur-sm">
          {Array.from({ length: 8 }).map((_, i) => {
            const slotId = i + 1;
            const uid = room.slots?.[slotId];
            return (
              <motion.div 
                key={slotId} 
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: i * 0.05 + 0.5, duration: 0.5 }}
                className="flex flex-col items-center"
              >
                <VoiceSeat 
                  slotId={slotId} 
                  userId={uid} 
                  size="medium"
                  isActive={room.activeSpeakers.includes(uid || '') || (volumes[uid || ''] > 5)}
                  isOwner={uid === room.ownerId}
                  volumeLevel={volumes[uid || '']}
                  activeColor={currentTheme.primary}
                  onTake={takeSlot}
                  onUserClick={setShowUserActions}
                />
                <div className="mt-2.5 w-16 text-center">
                   <p className="text-[9px] font-bold text-white/30 truncate leading-none overflow-hidden">
                     <UserDisplayName uid={uid} fallback={`${slotId}`} />
                   </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Chat Feed - Floating style on top of stage area */}
        <div className="fixed bottom-24 sm:bottom-32 left-4 right-4 sm:left-6 sm:right-6 z-30 pointer-events-none h-48 sm:h-64 flex flex-col justify-end overflow-hidden">
          <div className="space-y-2 pb-4">
            <AnimatePresence mode="popLayout">
              {messages.slice(-15).map((msg, idx) => {
                const isHost = room && msg.authorId === room.ownerId;
                return (
                  <motion.div 
                    key={msg.id || idx}
                    initial={{ opacity: 0, y: 15, x: -15, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85, y: -10 }}
                    transition={{ type: "spring", stiffness: 380, damping: 24 }}
                    layout
                    className="flex items-start gap-2.5 pointer-events-auto max-w-[85%]"
                  >
                    {msg.type === 'system' ? (
                      <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/5 mx-auto backdrop-blur-md shadow-lg">
                         <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">{msg.text}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex-none w-8 h-8 rounded-full bg-white/5 border border-white/10 overflow-visible shadow-lg relative shrink-0">
                          <UserAvatar uid={msg.authorId} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <div 
                            className={`px-3.5 py-2 rounded-2xl backdrop-blur-xl border relative shadow-2xl transition-all ${
                              msg.type === 'gift' 
                                ? 'bg-gradient-to-r from-yellow-500/15 to-amber-500/10 border-yellow-500/40 shadow-[0_0_15px_rgba(234,179,8,0.15)]' 
                                : isHost
                                  ? 'bg-gradient-to-r from-purple-500/15 via-black/60 to-black/60 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                                  : 'bg-black/70 border-white/[0.06]'
                            }`}
                          >
                             <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                               <span 
                                 className="text-[9.5px] font-black uppercase tracking-wider flex items-center gap-1" 
                                 style={{ color: isHost ? '#fbbf24' : currentTheme.primary }}
                               >
                                 {msg.authorName}
                                 {isHost && <Crown size={9} className="text-yellow-500 fill-yellow-500/30" />}
                               </span>
                               <UserPremiumTag uid={msg.authorId} size="xs" />
                             </div>
                             <span className={`text-[11.5px] font-medium leading-relaxed ${msg.type === 'gift' ? 'text-yellow-100 font-bold tracking-wide animate-pulse' : 'text-white/95'}`}>
                               {msg.text}
                             </span>
                          </div>
                        </div>
                      </>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
          <div ref={chatEndRef} />
        </div>
      </main>

      {/* Modern Bottom Bar - Ultra Premium Floating Pill */}
      <div className="fixed bottom-3 sm:bottom-10 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-md z-40 pb-[env(safe-area-inset-bottom,0px)] pointer-events-auto">
        <div className="w-full bg-[#0c0c0c] border border-white/[0.08] rounded-[28px] sm:rounded-[48px] p-2 sm:p-3 flex items-center gap-1.5 sm:gap-3 shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative card-shine overflow-hidden">
          <button 
             onClick={() => setIsSpeakerOn(!isSpeakerOn)}
             className={`w-11 h-11 sm:w-14 sm:h-14 rounded-2xl sm:rounded-[28px] flex items-center justify-center transition-all active:scale-90 border flex-shrink-0 ${
               isSpeakerOn 
                 ? 'bg-white/5 border-white/5 text-white/40' 
                 : 'bg-red-500/20 border-red-500/30 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
             }`}
          >
            {isSpeakerOn ? <Volume2 size={20} className="sm:size-[24px]" /> : <VolumeX size={20} className="sm:size-[24px]" />}
          </button>

          <button 
             id="tour-gift-button"
             onClick={() => setShowGifts(true)}
             className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl sm:rounded-[28px] flex items-center justify-center bg-white/5 border border-white/5 text-yellow-500 active:scale-90 transition-all flex-shrink-0"
          >
            <Gift size={20} className="sm:size-[24px]" />
          </button>

          <form onSubmit={handleSendMessage} className="flex-1 h-11 sm:h-14 bg-black/60 border border-white/[0.08] rounded-2xl sm:rounded-[30px] flex items-center px-3 sm:px-6 focus-within:border-purple-500/30 transition-all min-w-[70px]">
            <input 
               type="text"
               value={text}
               onChange={(e) => setText(e.target.value)}
               placeholder="Mensagem..."
               className="flex-1 bg-transparent text-[11px] sm:text-[13px] text-white outline-none placeholder:text-white/10 font-bold italic w-full"
            />
            <button type="submit" disabled={!text.trim()} className="text-white hover:text-purple-400 disabled:opacity-0 transition-all p-0.5 sm:p-1 flex-shrink-0">
              <Send size={16} className="sm:size-[20px]" />
            </button>
          </form>

          {room?.slots && Object.entries(room.slots).some(([_, uid]) => uid === user?.uid) && (
            <button 
              onClick={leaveSlot}
              className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl sm:rounded-[28px] flex items-center justify-center bg-white/5 border border-white/5 text-white/10 hover:text-red-500 transition-all active:scale-90 flex-shrink-0"
              title="Descer"
            >
              <LogOut size={18} className="rotate-180 sm:size-[22px]" />
            </button>
          )}

          <button 
            id="tour-mic-button"
            onClick={toggleMic}
            className={`w-12 h-12 sm:w-18 sm:h-18 rounded-2xl sm:rounded-[32px] flex items-center justify-center transition-all active:scale-95 border-2 flex-shrink-0 ${
              isMicOn 
                ? 'bg-purple-600 border-purple-400 shadow-[0_0_50px_rgba(168,85,247,0.4)]' 
                : 'bg-white/5 border-white/10 text-white/20'
            }`}
          >
            {isMicOn ? <Mic size={22} className="text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.4)] sm:size-[28px]" /> : <MicOff size={22} className="sm:size-[28px]" />}
          </button>
        </div>
      </div>


      {/* User Actions Sheet */}
      <AnimatePresence>
        {showUserActions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex flex-col justify-end"
            onClick={() => setShowUserActions(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-[#0c0c0c] rounded-t-[40px] p-8 w-full max-w-lg mx-auto border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-10" />

              <div className="flex items-center gap-6 mb-10">
                <div className="relative">
                   <UserAvatar 
                      uid={showUserActions} 
                      className="w-24 h-24 rounded-[32px] border-2 border-white/10 shadow-2xl bg-zinc-900 object-cover"
                   />
                  {showUserActions === room.ownerId && (
                    <div className="absolute -top-3 -right-3 w-10 h-10 bg-yellow-500 rounded-2xl flex items-center justify-center text-black shadow-xl rotate-12">
                      <Crown size={20} />
                    </div>
                  )}
                </div>
                <div className="flex flex-col">
                  <h3 className="text-2xl font-bold text-white tracking-tight leading-none mb-2">
                    <UserDisplayName uid={showUserActions} fallback="Buscando..." />
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-purple-500 uppercase tracking-[0.2em]">MEMBRO AURORA</span>
                    <div className="w-1 h-1 bg-white/20 rounded-full" />
                    <span className="text-[10px] font-bold text-white/40 uppercase">LEVEL {(profile as any)?.level || 1}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => navigate(`/profile/${showUserActions}`)}
                  className="flex flex-col items-center justify-center gap-3 p-6 bg-white/5 border border-white/5 rounded-3xl text-xs font-bold text-white hover:bg-white/10 transition-all active:scale-95"
                >
                  <div className="p-3 rounded-2xl bg-white/5"><Eye size={20} className="text-white/60" /></div>
                  Perfil Completo
                </button>
                <button 
                  onClick={() => navigate(`/chat/${showUserActions}`)}
                  className="flex flex-col items-center justify-center gap-3 p-6 bg-white/5 border border-white/5 rounded-3xl text-xs font-bold text-white hover:bg-white/10 transition-all active:scale-95"
                >
                  <div className="p-3 rounded-2xl bg-white/5"><MessageCircle size={20} className="text-purple-400" /></div>
                  Mensagem Privada
                </button>
              </div>

              {showUserActions === user?.uid && (
                <div className="mt-4">
                  <button 
                    onClick={leaveSlot}
                    className="w-full flex items-center justify-center gap-2 p-5 bg-red-500/10 border border-red-500/20 rounded-3xl text-sm font-bold text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95 group"
                  >
                    <div className="p-2 rounded-xl bg-red-500/10 group-hover:bg-white/20 transition-colors">
                      <LogOut size={18} />
                    </div>
                    Descer do Assento
                  </button>
                </div>
              )}

              {room.ownerId === user?.uid && showUserActions !== user.uid && (
                <div className="grid grid-cols-2 gap-3 mt-6 pt-6 border-t border-white/5">
                  <button 
                    onClick={() => toggleMuteUser(showUserActions!)}
                    className="flex items-center justify-center gap-2 p-4 bg-yellow-500/10 border border-yellow-500/10 rounded-2xl text-xs font-bold text-yellow-500 active:scale-95 transition-all"
                  >
                    <BellOff size={16} /> {room.mutedUsers?.includes(showUserActions!) ? 'Unmute' : 'Silenciar'}
                  </button>
                  <button 
                    onClick={() => kickUser(showUserActions!)}
                    className="flex items-center justify-center gap-2 p-4 bg-red-500/10 border border-red-500/10 rounded-2xl text-xs font-bold text-red-500 active:scale-95 transition-all"
                  >
                    <UserMinus size={16} /> Expulsar
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gift Panel */}
      <AnimatePresence>
        {showGifts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] flex flex-col justify-end"
            onClick={() => setShowGifts(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-[#0c0c0c] rounded-t-[40px] p-8 pb-12 w-full max-w-lg mx-auto border-t border-white/10"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
              
              <div className="flex justify-between items-center mb-8">
                <div className="flex gap-4">
                  <button 
                    onClick={() => setGiftActiveTab('gifts')}
                    className={`text-lg font-black tracking-tight uppercase ${giftActiveTab === 'gifts' ? 'text-white border-b-2 border-pink-500 pb-1' : 'text-white/40'}`}
                  >
                    Mimos
                  </button>
                  <button 
                    onClick={() => setGiftActiveTab('ranking')}
                    className={`text-lg font-black tracking-tight uppercase flex items-center gap-2 ${giftActiveTab === 'ranking' ? 'text-white border-b-2 border-purple-500 pb-1' : 'text-white/40'}`}
                  >
                    <Crown size={14} className="text-purple-400" /> Rank Doadores
                  </button>
                </div>
                
                <div className="bg-pink-500/10 px-4 py-2 rounded-2xl border border-pink-500/20 flex items-center gap-2 transition-transform active:scale-95 cursor-pointer">
                  <span className="text-pink-400 font-bold tabular-nums">{(profile as any)?.coins || 0} EGO</span>
                  <Sparkles size={14} className="text-pink-500 fill-pink-500/20 animate-pulse" />
                </div>
              </div>
              
              {giftActiveTab === 'gifts' ? (
                <div className="grid grid-cols-4 gap-4 max-h-[320px] overflow-y-auto pr-1">
                  {[
                    { icon: Heart, label: 'Amor', color: 'text-rose-500', cost: 10, bg: 'bg-rose-500/10 shadow-[0_0_15px_rgba(244,63,94,0.15)]' },
                    { icon: Star, label: 'Estrela', color: 'text-amber-400', cost: 50, bg: 'bg-amber-400/10 shadow-[0_0_15px_rgba(251,191,36,0.15)]' },
                    { icon: Flame, label: 'Fogo', color: 'text-orange-500', cost: 100, bg: 'bg-orange-500/10 shadow-[0_0_15px_rgba(249,115,22,0.15)]' },
                    { icon: Trophy, label: 'Troféu', color: 'text-cyan-400', cost: 500, bg: 'bg-cyan-400/10 shadow-[0_0_15px_rgba(34,211,238,0.15)]' },
                    { icon: Crown, label: 'Crown VIP', color: 'text-indigo-400', cost: 1000, bg: 'bg-indigo-400/10 shadow-[0_0_20px_rgba(129,140,248,0.25)] border border-indigo-400/20 animate-pulse' },
                    { icon: Sparkles, label: 'Aura Divina', color: 'text-purple-400', cost: 5000, bg: 'bg-purple-400/10 shadow-[0_0_25px_rgba(192,132,252,0.3)] border border-purple-400/30' },
                    { icon: Rocket, label: 'Foguete', color: 'text-fuchsia-500', cost: 10000, bg: 'bg-fuchsia-400/10 shadow-[0_0_30px_rgba(217,70,239,0.35)] border border-fuchsia-500/30' },
                    { icon: Gem, label: 'Nirvana', color: 'text-emerald-400', cost: 50000, bg: 'bg-emerald-400/10 shadow-[0_0_40px_rgba(52,211,153,0.4)] border border-emerald-400/40 animate-bounce' },
                  ].map((g) => (
                    <button
                      key={g.label}
                      onClick={() => { sendGift(g); }}
                      className="flex flex-col items-center gap-3 p-4 bg-white/5 rounded-3xl border border-white/5 hover:border-white/10 active:scale-90 transition-all group"
                    >
                      <div className={`p-3 rounded-2xl transition-transform group-hover:scale-110 ${g.bg} ${g.color}`}>
                        <g.icon size={22} className="fill-current/20" />
                      </div>
                      <div className="text-center">
                        <span className="block text-[9px] font-bold text-white/40 uppercase tracking-widest">{g.label}</span>
                        <span className="block text-xs text-pink-500 font-black mt-0.5">{g.cost}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                  {sortedContributors.length === 0 ? (
                    <div className="text-center py-12 text-white/20 text-sm font-medium italic">
                      Nenhum presente enviado ainda nesta sala.<br/>Seja o primeiro a enviar!
                    </div>
                  ) : (
                    sortedContributors.slice(0, 20).map((c, idx) => {
                      let medalColor = "text-white/40";
                      let borderGlow = "border-white/5";
                      if (idx === 0) {
                        medalColor = "text-yellow-400 drop-shadow-[0_0_8px_#f59e0b]";
                        borderGlow = "border-yellow-400/30 bg-yellow-500/5";
                      } else if (idx === 1) {
                        medalColor = "text-slate-300 drop-shadow-[0_0_8px_#cbd5e1]";
                        borderGlow = "border-slate-300/20 bg-slate-400/5";
                      } else if (idx === 2) {
                        medalColor = "text-amber-600 drop-shadow-[0_0_8px_#b45309]";
                        borderGlow = "border-amber-600/20 bg-amber-700/5";
                      }
                      return (
                        <div key={c.uid} className={`flex items-center justify-between p-3 rounded-2xl border ${borderGlow} transition-all`}>
                          <div className="flex items-center gap-3">
                            <span className={`font-black text-sm w-5 text-center ${medalColor}`}>{idx + 1}º</span>
                            <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10">
                              <UserAvatar uid={c.uid} className="w-full h-full object-cover" showFrame={false} />
                            </div>
                            <div>
                              <span className="block text-sm font-bold text-white leading-tight">{c.displayName}</span>
                              <span className="text-[10px] uppercase font-black tracking-widest text-[#a855f7] italic">DOADOR ROYAL</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 bg-pink-500/5 px-3 py-1.5 rounded-xl border border-pink-500/10">
                            <span className="text-xs font-black text-pink-400 tabular-nums">{c.totalSpent}</span>
                            <span className="text-[9px] uppercase font-black text-pink-400/40">EGO</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#020202]/95 backdrop-blur-xl z-[100] flex flex-col pt-16 px-6"
          >
            <div className="flex justify-between items-center mb-10 max-w-sm mx-auto w-full">
              <div>
                 <h2 className="text-xl font-bold text-white">Configurações</h2>
                 <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mt-1">Gestão da Sala</p>
              </div>
              <button onClick={() => setShowSettings(false)} className="p-2.5 bg-white/5 rounded-2xl text-white/40 border border-white/5 active:scale-90 transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto max-w-sm mx-auto w-full pb-32 no-scrollbar">
              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/20 pl-1">Nome da Sala</label>
                  <input 
                    type="text" 
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Dê um nome..."
                    className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-sm text-white font-medium outline-none focus:border-white/20 transition-all"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/20 pl-1">Descrição</label>
                  <textarea 
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    placeholder="O que rola por aqui?"
                    className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-sm text-white font-medium outline-none focus:border-white/20 transition-all min-h-[100px] resize-none"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/20 pl-1">Tema da Sala</label>
                  <div className="grid grid-cols-2 gap-3">
                    {ROOM_THEMES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setEditTheme(t.id)}
                        className={`p-4 rounded-2xl border transition-all flex flex-col gap-2 ${editTheme === t.id ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/5'}`}
                      >
                         <div className="flex gap-1">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.primary }} />
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.secondary }} />
                         </div>
                         <span className={`text-[10px] font-bold ${editTheme === t.id ? 'text-white' : 'text-white/20'}`}>{t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/20 pl-1">Imagem de Capa (URL)</label>
                  <input 
                    type="text" 
                    value={editCover}
                    onChange={e => setEditCover(e.target.value)}
                    placeholder="Link da imagem..."
                    className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-sm text-white font-medium outline-none focus:border-white/20 transition-all"
                  />
                  {editCover && <img src={editCover} className="w-full h-32 object-cover rounded-2xl border border-white/5 mt-2" alt="Preview" />}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/20 pl-1">Categoria</label>
                    <select 
                      value={editCategory}
                      onChange={e => setEditCategory(e.target.value)}
                      className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-sm text-white font-medium outline-none appearance-none"
                    >
                      <option value="Chat">Chat</option>
                      <option value="Games">Games</option>
                      <option value="Música">Música</option>
                      <option value="Social">Social</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/20 pl-1">Limite</label>
                    <select 
                      value={editLimit}
                      onChange={e => setEditLimit(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-sm text-white font-medium outline-none appearance-none"
                    >
                      {[4, 8, 12, 20, 50].map(n => <option key={n} value={n}>{n} Pessoas</option>)}
                    </select>
                  </div>
                </div>

                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">Microfone Livre</h4>
                    <p className="text-[10px] text-white/20 font-medium">Permitir que todos falem</p>
                  </div>
                  <button 
                    onClick={() => setEditFreeMic(!editFreeMic)}
                    className={`w-12 h-6 rounded-full relative transition-all ${editFreeMic ? 'bg-purple-600 shadow-lg shadow-purple-500/20' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editFreeMic ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/20 pl-1">Senha (Opcional)</label>
                  <div className="relative">
                    <input 
                      type="password" 
                      value={editPassword}
                      onChange={e => setEditPassword(e.target.value)}
                      placeholder="Sala privada"
                      className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-sm text-white font-medium outline-none focus:border-white/20 transition-all pr-12"
                    />
                    <Lock size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/10" />
                  </div>
                </div>

                <div className="pt-6 flex flex-col gap-3">
                  <button 
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                    className="w-full bg-white text-black py-4 rounded-2xl font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                  <button 
                    onClick={handleDeleteRoom}
                    className="w-full py-4 rounded-2xl font-bold text-xs text-red-500/40 hover:text-red-500 transition-colors"
                  >
                    Excluir Sala Permanentemente
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mic Error Modal warning */}
      <AnimatePresence>
        {micError && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-6 animate-fade-in"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#121214] border border-white/10 rounded-3xl p-8 max-w-md w-full relative overflow-hidden shadow-[0_0_50px_rgba(168,85,247,0.15)]"
            >
              {/* Decorative top pulse */}
              <div className="absolute top-0 left-12 right-12 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
              
              <div className="flex flex-col items-center text-center font-sans">
                <div className="w-16 h-16 bg-red-500/10 rounded-2xl border border-red-500/20 flex items-center justify-center mb-6">
                  <AlertCircle size={32} className="text-red-400" />
                </div>
                
                <h3 className="text-xl font-black uppercase tracking-wider text-white mb-3">
                  Microfone Bloqueado
                </h3>
                
                <p className="text-sm text-white/60 leading-relaxed mb-6">
                  {micError.toLowerCase().includes("not allowed by the user agent") || 
                   micError.toLowerCase().includes("permission denied") || 
                   micError.toLowerCase().includes("not allowed") ? (
                    <span>
                      O navegador bloqueou o acesso ao microfone na visualização atual. Para usar o chat de voz, clique em <strong>Abrir em Nova Guia</strong> ou conceda permissão de microfone nas configurações do seu navegador.
                    </span>
                  ) : (
                    micError
                  )}
                </p>
                
                <div className="flex flex-col gap-3 w-full">
                  <button
                    onClick={() => {
                      window.open(window.location.href, '_blank');
                    }}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-bold text-xs uppercase tracking-widest text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                     Abrir em Nova Guia
                  </button>
                  <button
                    onClick={() => setMicError(null)}
                    className="w-full py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 font-bold text-xs uppercase tracking-widest text-white/60 hover:text-white transition-all"
                  >
                    Entendido / Fechar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Another Tab Warning Modal */}
      <AnimatePresence>
        {hasAnotherTabOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-xl z-[210] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#121214] border border-red-500/20 rounded-3xl p-8 max-w-md w-full relative overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.15)]"
            >
              <div className="absolute top-0 left-12 right-12 h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent" />
              
              <div className="flex flex-col items-center text-center font-sans">
                <div className="w-16 h-16 bg-red-500/10 rounded-2xl border border-red-500/20 flex items-center justify-center mb-6">
                  <AlertCircle size={32} className="text-red-400" />
                </div>
                
                <h3 className="text-xl font-black uppercase tracking-wider text-white mb-3">
                  Conexão de Voz Ocupada
                </h3>
                
                <p className="text-sm text-white/60 leading-relaxed mb-6">
                  O sistema de voz detectou que seu ID já está em uso nesta sala. Isso geralmente ocorre se você estiver com <strong>outra guia aberta</strong> para esta mesma sala, ou por uma conexão fantasma temporária após atualizar a página (que fechará em alguns segundos).
                </p>
                
                <div className="flex flex-col gap-3 w-full">
                  <button
                    onClick={() => {
                      window.location.reload();
                    }}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 font-bold text-xs uppercase tracking-widest text-white shadow-lg active:scale-95 transition-all"
                  >
                     Recarregar Conexão
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Onboarding Tour */}
      <OnboardingTour 
        forceShow={forceShowTour} 
        onComplete={() => setForceShowTour(false)} 
      />
    </div>
  );
}

function VoiceSeat({ 
  slotId, 
  userId, 
  isActive, 
  isOwner, 
  onTake,
  onUserClick,
  volumeLevel = 0,
  activeColor = '#a855f7',
  size = 'medium' 
}: { 
  slotId: number, 
  userId?: string | null, 
  isActive: boolean, 
  isOwner: boolean, 
  onTake: (id: number) => void,
  onUserClick?: (uid: string) => void,
  volumeLevel?: number,
  activeColor?: string,
  size?: 'medium' | 'large'
}) {
  const sizeClasses = size === 'large' ? 'w-24 h-24' : 'w-16 h-16';

  return (
    <div className="relative group flex flex-col items-center select-none">
      {/* Speaking Aura - Ultra Premium */}
      <AnimatePresence>
        {isActive && (
          <>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ 
                scale: [0.95, 1.45, 0.95], 
                opacity: [0, 0.3, 0] 
              }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className={`absolute inset-0 border-[3px] rounded-full z-0 pointer-events-none`}
              style={{ 
                borderColor: activeColor, 
                boxShadow: `0 0 30px ${activeColor}60` 
              }}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ 
                scale: [0.9, 1.2, 0.9], 
                opacity: [0, 0.5, 0] 
              }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut", delay: 0.5 }}
              className={`absolute inset-0 border-2 rounded-full z-0 pointer-events-none opacity-40`}
              style={{ borderColor: activeColor }}
            />
          </>
        )}
      </AnimatePresence>
      
      <button 
        onClick={() => userId ? onUserClick?.(userId) : onTake(slotId)}
        className={`
          ${sizeClasses} rounded-full flex items-center justify-center relative z-10 transition-all duration-500
          ${userId 
            ? 'p-1 bg-[#0c0c0c] border-[3px] shadow-[0_0_40px_rgba(0,0,0,0.8)]' 
            : 'bg-white/5 border-2 border-dashed border-white/10 hover:bg-white/10 hover:border-white/20 hover:scale-105'
          }
          active:scale-95
        `}
        style={{ borderColor: userId && isActive ? activeColor : 'rgba(255,255,255,0.08)' }}
      >
        {userId ? (
          <div className="w-full h-full rounded-full overflow-visible relative group shadow-inner">
             {/* Hardware Shine Effect */}
             <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none z-20 rounded-full overflow-hidden" />
            
            <UserAvatar 
              uid={userId!} 
              className={`w-full h-full object-cover transition-all duration-700 ${isActive ? 'grayscale-0' : 'grayscale-[0.3] group-hover:grayscale-0 group-hover:scale-110'}`}
            />
            
            {/* Thinking / Speaking indicator Overlay - Premium Visualizer */}
            <AnimatePresence>
              {isActive && (
                <div 
                  className="absolute inset-0 flex flex-col items-center justify-end pb-2 z-30 rounded-full overflow-hidden"
                  style={{ background: `linear-gradient(to top, ${activeColor}99, transparent 60%)` }}
                >
                  <div className="flex gap-1 mb-2 items-end h-6">
                    {[0, 0.15, 0.3, 0.45, 0.6].map(d => {
                      const h = 4 + (volumeLevel / 4) * (1 - Math.abs(d - 0.3)*2);
                      return (
                        <motion.div 
                          key={d}
                          animate={{ height: h }}
                          transition={{ type: "spring", stiffness: 220, damping: 15 }}
                          className="w-1 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                        />
                      );
                    })}
                  </div>
                   <div className="text-[7px] font-black text-white uppercase tracking-widest animate-pulse italic">Sintonizado</div>
               </div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
             <Plus size={size === 'large' ? 26 : 20} className="text-white/20 group-hover:text-purple-400 transition-colors" />
             <span className="text-[7px] font-black text-white/5 uppercase tracking-widest group-hover:text-white/20 transition-colors">{slotId}</span>
          </div>
        )}
      </button>

      {/* Mic Status Icon for occupied slots */}
      {userId && (
         <div className={`absolute -top-1 -right-1 w-7 h-7 rounded-xl border border-white/10 flex items-center justify-center z-40 transition-all duration-500 shadow-2xl ${isActive ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)] scale-110' : 'bg-[#1a1a1a] text-white/20'}`}>
            {isActive ? <Mic size={14} className="animate-pulse" /> : <MicOff size={14} />}
         </div>
      )}
    </div>
  );
}

