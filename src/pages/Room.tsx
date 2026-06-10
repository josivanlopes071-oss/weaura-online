import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { 
  doc, onSnapshot, collection, addDoc, serverTimestamp, query, orderBy, limit, updateDoc, arrayUnion, arrayRemove, setDoc, getDoc, deleteField, increment, getDocs, deleteDoc, where 
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firebase';
import { GIFTS } from '../lib/aura';
import GiftAnimationOverlay from '../components/GiftAnimationOverlay';
import { useVoiceChat } from '../hooks/useVoiceChat';
import UserAvatar from '../components/UserAvatar';
import { UserPremiumTag } from '../components/PremiumTag';
import OnboardingTour from '../components/OnboardingTour';
import { 
  Mic, MicOff, Send, Gift, ChevronLeft, MoreVertical, 
  Users, MessageSquare, Volume2, X, Star, Heart, Flame, Trophy,
  Smile, ThumbsUp, PartyPopper, Ghost as GhostIcon,
  Music, Lock, Plus, LayoutGrid, ShoppingBag, VolumeX, MessageCircle,
  Settings, Shield, Camera, Palette, UserMinus, UserPlus, BellOff, Crown, Eye, EyeOff, Share2,
  Trash2, LogOut, AlertCircle, Sparkles, Rocket, Gem, Coins, Zap, HelpCircle,
  Activity, Wifi, WifiOff, Hand
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
  allowFreeMic?: boolean;
  stageLayout?: string;
  allowGuestsNextToHost?: boolean;
  speakRequests?: string[];
  totalGifts?: number;
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
  const { profile, user, updateProfile, updateCoins, gainXp, sendGift: authSendGift, gainAura } = useAuth();
  const [room, setRoom] = useState<RoomData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [text, setText] = useState('');
  const [userVolumes, setUserVolumes] = useState<{ [uid: string]: number }>(() => {
    try {
      const saved = localStorage.getItem('weplay_user_volumes');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const audioRefs = useRef<{ [uid: string]: HTMLAudioElement }>({});

  const handleUserVolumeChange = (uid: string, value: number) => {
    setUserVolumes(prev => {
      const updated = { ...prev, [uid]: value };
      try {
        localStorage.setItem('weplay_user_volumes', JSON.stringify(updated));
      } catch (e) {
        console.warn("Could not save updated user volumes:", e);
      }
      return updated;
    });

    if (audioRefs.current[uid]) {
      audioRefs.current[uid].volume = value;
    }
  };
  const sessionStartTimeRef = useRef<number>(Date.now());
  const [isMicOn, setIsMicOn] = useState(false);
  const [forceShowTour, setForceShowTour] = useState(false);

  // Microphone connection latency & stability monitor states
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);
  const [currentLatency, setCurrentLatency] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'excelente' | 'bom' | 'instavel' | 'critico'>('excelente');
  const [averageLatency, setAverageLatency] = useState<number>(0);
  const [jitter, setJitter] = useState<number>(0);

  // Active microsecond-accurate connection pinging loop
  useEffect(() => {
    let intervalId: any;
    let active = true;

    const measureLatency = async () => {
      const start = performance.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        await fetch('/api/health', { 
          method: 'GET',
          signal: controller.signal,
          headers: { 'Cache-Control': 'no-cache' }
        });
        
        clearTimeout(timeoutId);
        const end = performance.now();
        const latency = Math.round(end - start);

        if (!active) return;

        setLatencyHistory(prev => {
          const next = [...prev, latency].slice(-10);
          const avg = Math.round(next.reduce((sum, val) => sum + val, 0) / next.length);
          setAverageLatency(avg);

          let deviation = 0;
          if (next.length > 1) {
            let sumDiff = 0;
            for (let i = 1; i < next.length; i++) {
              sumDiff += Math.abs(next[i] - next[i - 1]);
            }
            deviation = Math.round(sumDiff / (next.length - 1));
          }
          setJitter(deviation);

          if (avg >= 300 || deviation >= 55) {
            setConnectionStatus('critico');
          } else if (avg >= 150 || deviation >= 25) {
            setConnectionStatus('instavel');
          } else if (avg >= 65) {
            setConnectionStatus('bom');
          } else {
            setConnectionStatus('excelente');
          }

          return next;
        });
        setCurrentLatency(latency);
      } catch (err) {
        if (!active) return;
        console.warn("[Monitor] Ping check timed out or network of user is slow:", err);
        setLatencyHistory(prev => {
          const next = [...prev, 1000].slice(-10);
          setAverageLatency(1000);
          setJitter(50);
          setConnectionStatus('critico');
          return next;
        });
        setCurrentLatency(1000);
      }
    };

    measureLatency();
    intervalId = setInterval(measureLatency, 3000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, []);

  // References to keep unsubscribe callbacks and state perfectly manageable for instant cleanup
  const unsubscribeRoomRef = useRef<(() => void) | null>(null);
  const unsubscribeMessagesRef = useRef<(() => void) | null>(null);
  const unsubscribeReactionsRef = useRef<(() => void) | null>(null);
  const heartbeatIntervalRef = useRef<any>(null);
  const hasLeftRef = useRef<boolean>(false);

  // Set session start time on mount or whenever the room ID changes, and clear messages cache
  useEffect(() => {
    setMessages([]);
    setReactions([]);
    sessionStartTimeRef.current = Date.now();
    hasLeftRef.current = false;
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
  const [selectedReceiverId, setSelectedReceiverId] = useState<string | null>(null);
  const [giftQuantity, setGiftQuantity] = useState<number>(1);
  const [activeAnimation, setActiveAnimation] = useState<any | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showUserActions, setShowUserActions] = useState<string | null>(null);
  const [showSignalModal, setShowSignalModal] = useState(false);
  
  // Interactive Live Features
  const [showSpeakRequestsQueue, setShowSpeakRequestsQueue] = useState(false);
  const [showRoomRank, setShowRoomRank] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);
  const [uptime, setUptime] = useState('00:00');
  const [entranceAnnouncements, setEntranceAnnouncements] = useState<{ id: string, uid: string, name: string, photoURL: string, role?: string, isVip?: boolean, vipPlan?: string | null }[]>([]);
  
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
  const [editAllowGuestsNextToHost, setEditAllowGuestsNextToHost] = useState(true);
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
      setEditAllowGuestsNextToHost(room.allowGuestsNextToHost !== false);
    }
  }, [showSettings, room]);

  useEffect(() => {
    const interval = setInterval(() => {
      const start = sessionStartTimeRef.current || Date.now();
      const diffSecs = Math.floor((Date.now() - start) / 1000);
      const hrs = Math.floor(diffSecs / 3600);
      const mins = Math.floor((diffSecs % 3600) / 60);
      const secs = diffSecs % 60;
      
      const formatted = `${hrs > 0 ? String(hrs).padStart(2, '0') + ':' : ''}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      setUptime(formatted);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleShareRoom = () => {
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 3000);
    }).catch(err => {
      console.warn("Share copy error:", err);
    });
  };

  const copyDisplayId = (displayId: number) => {
    navigator.clipboard.writeText(String(displayId));
    alert("ID Numérico copiado: " + displayId);
  };

  const copyUid = (uid: string) => {
    navigator.clipboard.writeText(uid);
    alert("UID copiado: " + uid);
  };

  useEffect(() => {
    if (!id || !user?.uid) return;

    const roomRef = doc(db, 'rooms', id);

    const cleanupGhostPlayers = async () => {
      if (!id || !user?.uid) return;
      try {
        const snap = await getDoc(roomRef);
        if (!snap.exists()) return;
        const roomData = snap.data();
        const currentMembers: string[] = roomData.members || [];
        const slots: { [slotId: string]: string | null } = roomData.slots || {};
        
        // Collect all distinct uids from members and slots, excluding current user and not empty
        const uidsToCheck = Array.from(new Set([
          ...currentMembers,
          ...Object.values(slots).filter((uid): uid is string => typeof uid === 'string' && !!uid)
        ])).filter(uid => uid !== user.uid);

        if (uidsToCheck.length === 0) return;

        const inactiveUids: string[] = [];
        const now = Date.now();
        
        for (const uid of uidsToCheck) {
          try {
            const userSnap = await getDoc(doc(db, 'users', uid));
            if (userSnap.exists()) {
              const userData = userSnap.data();
              const lastSeen = userData.lastSeen;
              let lastSeenMs = 0;
              if (lastSeen) {
                if (typeof lastSeen.toDate === 'function') {
                  lastSeenMs = lastSeen.toDate().getTime();
                } else if (lastSeen.seconds) {
                  lastSeenMs = lastSeen.seconds * 1000;
                } else if (typeof lastSeen === 'number') {
                  lastSeenMs = lastSeen;
                }
              }
              
              // If status is offline or heartbeat is older than 3 minutes, they are offline
              const isOffline = userData.status === 'offline' || 
                                (lastSeenMs > 0 && (now - lastSeenMs > 180000));
              
              if (isOffline) {
                inactiveUids.push(uid);
              }
            } else {
              // User doc doesn't exist anymore, treat as inactive
              inactiveUids.push(uid);
            }
          } catch (e) {
            console.warn("Failed to check user presence for", uid, e);
          }
        }

        if (inactiveUids.length > 0) {
          console.log("[Room Cleanup] Removing offline members/slots:", inactiveUids);
          const newMembers = currentMembers.filter(m => !inactiveUids.includes(m));
          const newSlots = { ...slots };
          let slotsUpdated = false;
          
          Object.entries(newSlots).forEach(([slotKey, slotUid]) => {
            if (slotUid && inactiveUids.includes(slotUid)) {
              newSlots[slotKey] = null;
              slotsUpdated = true;
            }
          });

          const updateObj: any = {
            members: newMembers
          };
          if (slotsUpdated) {
            updateObj.slots = newSlots;
          }
          
          if (roomData.activeSpeakers) {
            updateObj.activeSpeakers = (roomData.activeSpeakers as string[]).filter(uid => !inactiveUids.includes(uid));
          }

          // Clean voicePeerIds
          inactiveUids.forEach(uid => {
            if (roomData.voicePeerIds && roomData.voicePeerIds[uid]) {
              updateObj[`voicePeerIds.${uid}`] = deleteField();
            }
          });

          await updateDoc(roomRef, updateObj).catch(() => {});
        }
      } catch (err) {
        console.warn("Error in cleanupGhostPlayers:", err);
      }
    };
    
    // Check if the room has no other members before joining to clean leftovers from past sessions
    const checkAndCleanupLeftovers = async () => {
      try {
        const snap = await getDoc(roomRef);
        if (snap.exists()) {
          const roomData = snap.data();
          const currentMembers = roomData.members || [];
          const isReallyEmpty = currentMembers.length === 0 || 
            (currentMembers.length === 1 && currentMembers.includes(user.uid));

          if (isReallyEmpty) {
            console.log("[Room] Clean slate detected as first user enters. Deleting leftover messages...");
            const messagesQuery = query(collection(db, 'rooms', id, 'messages'));
            const messagesSnap = await getDocs(messagesQuery);
            const deletePromises = messagesSnap.docs.map(docSnap => 
              deleteDoc(doc(db, 'rooms', id, 'messages', docSnap.id))
            );
            await Promise.all(deletePromises);
          } else {
            // Run a clean up call after short delay so room state is fresh and doesn't display ghosts
            setTimeout(() => {
              cleanupGhostPlayers();
            }, 3000);
          }
        }
      } catch (err) {
        console.warn("[Room] Error cleaning leftover messages on room join:", err);
      }
    };
    checkAndCleanupLeftovers();

    // Join room
    updateDoc(roomRef, {
      members: arrayUnion(user.uid)
    }).then(() => {
      if (gainAura) {
        gainAura(10).catch((e) => console.warn("Erro ao ganhar Aura ao participar da sala:", e));
      }
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
          giftRank: data.giftRank || {},
          moderators: data.moderators || [],
          mutedUsers: data.mutedUsers || [],
          speakRequests: data.speakRequests || [],
          allowGuestsNextToHost: data.allowGuestsNextToHost !== false,
          totalGifts: data.totalGifts || 0
        });
      } else {
        // Room deleted
        navigate('/');
      }
    }, (error) => {
      console.warn("Firestore Room snapshot warning (non-fatal):", error.message || error);
    });
    unsubscribeRoomRef.current = unsubscribeRoom;

    // Listen for messages using client-side sorting for zero-latency instant updates
    const messagesQuery = query(
      collection(db, 'rooms', id, 'messages'),
      orderBy('clientCreatedAt', 'desc'),
      limit(30)
    );

    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      // Trigger live animations for any newly arriving gift messages
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const m = change.doc.data();
          const msgTime = m.clientCreatedAt || 0;
          if (m.type === 'gift' && msgTime >= sessionStartTimeRef.current && msgTime > Date.now() - 15000) {
            if (m.authorId !== user?.uid) {
              setActiveAnimation({
                id: change.doc.id,
                senderName: m.authorName || 'Usuário',
                receiverName: m.receiverName || 'Membro',
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
        const msgTime = m.clientCreatedAt || (m.timestamp && typeof m.timestamp.toMillis === 'function' ? m.timestamp.toMillis() : 0);
        return msgTime >= sessionStartTimeRef.current;
      });

      // Deduplicate messages by Firestore Id to prevent duplication bugs
      const seenIds = new Set<string>();
      const finalMsgs: Message[] = [];
      for (const m of currentSessionMsgs) {
        if (!seenIds.has(m.id)) {
          seenIds.add(m.id);
          finalMsgs.push(m);
        }
      }

      setMessages(finalMsgs);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (error) => {
      console.warn("Firestore Messages snapshot warning (non-fatal):", error.message || error);
    });
    unsubscribeMessagesRef.current = unsubscribeMessages;

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
    unsubscribeReactionsRef.current = unsubscribeReactions;

    // Heartbeat logic to prevent ghost rooms and periodically clean offline members
    const heartbeat = setInterval(() => {
      if (id && user?.uid && roomRefData.current) {
        if (roomRefData.current.ownerId === user.uid) {
          updateDoc(roomRef, { lastActive: serverTimestamp() }).catch(() => {});
        }
        
        // Coordinated presence cleanup check (only run by owner, or sorted first member if owner is missing)
        const sortedMembers = [...(roomRefData.current.members || [])].sort();
        const amITheCleaner = roomRefData.current.ownerId === user.uid || 
                              (!sortedMembers.includes(roomRefData.current.ownerId) && sortedMembers[0] === user.uid);
        
        if (amITheCleaner) {
          cleanupGhostPlayers();
        }
      }
    }, 60000); // 1 minute
    heartbeatIntervalRef.current = heartbeat;

    return () => {
      // Detach listeners immediately
      if (unsubscribeRoomRef.current) unsubscribeRoomRef.current();
      if (unsubscribeMessagesRef.current) unsubscribeMessagesRef.current();
      if (unsubscribeReactionsRef.current) unsubscribeReactionsRef.current();
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);

      unsubscribeRoomRef.current = null;
      unsubscribeMessagesRef.current = null;
      unsubscribeReactionsRef.current = null;
      heartbeatIntervalRef.current = null;
      
      const exitRoom = async () => {
        if (hasLeftRef.current) return; // Skip if manually triggered handleLeaveRoom to avoid race conditions
        if (!id || !user?.uid) return;
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
  }, [id, user?.uid]);

  // Synchronize server-side muting
  useEffect(() => {
    if (!room || !user) return;
    const userIsMutedByModerator = room.mutedUsers?.includes(user.uid);
    if (userIsMutedByModerator && isMicOn) {
      setIsMicOn(false);
      const roomRef = doc(db, 'rooms', id || '');
      updateDoc(roomRef, { activeSpeakers: arrayRemove(user.uid) }).catch(() => {});
    }
  }, [room?.mutedUsers, user?.uid, isMicOn, id]);

  // Seating the owner automatically in slot 0 if they join and are not seated anywhere
  useEffect(() => {
    if (!room || !user || !id) return;
    const isOwner = room.ownerId === user.uid;
    if (isOwner) {
      // Check if user is in any slot
      const currentSlotEntry = Object.entries(room.slots || {}).find(([_, uid]) => uid === user.uid);
      if (!currentSlotEntry && !room.slots?.[0]) {
        const roomRef = doc(db, 'rooms', id);
        updateDoc(roomRef, { 'slots.0': user.uid }).catch((e) => {
          console.warn("[Room] Error seating host automatically:", e);
        });
      }
    }
  }, [room?.slots, user?.uid, id]);

  // Entrance Announcements Effect
  const prevMembersRef = useRef<string[]>([]);
  useEffect(() => {
    if (!room?.members || !user) return;
    const currentMembers = room.members;
    const oldMembers = prevMembersRef.current;
    
    if (oldMembers.length > 0) {
      const newJoined = currentMembers.filter(m => !oldMembers.includes(m) && m !== user.uid);
      const leftMembers = oldMembers.filter(m => !currentMembers.includes(m) && m !== user.uid);

      newJoined.forEach(async (uid) => {
        try {
          const userSnap = await getDoc(doc(db, 'users', uid));
          if (userSnap.exists()) {
            const data = userSnap.data();
            const displayName = data.displayName || 'Voz do Espaço';
            const ann = {
              id: Math.random().toString(),
              uid: uid,
              name: displayName,
              photoURL: data.photoURL || '',
              role: data.role || 'user',
              isVip: data.isVip || false,
              vipPlan: data.vipPlan || null
            };
            setEntranceAnnouncements(prev => {
              // Avoid duplicates
              if (prev.some(p => p.uid === ann.uid)) return prev;
              return [...prev, ann];
            });
            setTimeout(() => {
              setEntranceAnnouncements(prev => prev.filter(item => item.id !== ann.id));
            }, 6000);

            // Local system join message
            setMessages(prev => {
              const sysMsg: Message = {
                id: `system-joined-${uid}-${Date.now()}`,
                authorId: 'system',
                authorName: 'Sistema',
                text: `${displayName} entrou na sala.`,
                type: 'system',
                timestamp: null,
                clientCreatedAt: Date.now()
              };
              if (prev.some(m => m.id === sysMsg.id)) return prev;
              return [...prev, sysMsg];
            });
          }
        } catch (err) {
          console.warn("Error triggering entrance announcement:", err);
        }
      });

      leftMembers.forEach(async (uid) => {
        try {
          const userSnap = await getDoc(doc(db, 'users', uid));
          let displayName = 'Membro Aura';
          if (userSnap.exists()) {
            displayName = userSnap.data().displayName || 'Membro Aura';
          }

          // Local system exit message
          setMessages(prev => {
            const sysMsg: Message = {
              id: `system-left-${uid}-${Date.now()}`,
              authorId: 'system',
              authorName: 'Sistema',
              text: `${displayName} saiu da sala.`,
              type: 'system',
              timestamp: null,
              clientCreatedAt: Date.now()
            };
            if (prev.some(m => m.id === sysMsg.id)) return prev;
            return [...prev, sysMsg];
          });
        } catch (err) {
          console.warn("Error tracking exit log:", err);
        }
      });
    }
    prevMembersRef.current = currentMembers;
  }, [room?.members, user?.uid]);

  const sendReaction = async (emoji: string) => {
    if (!id || !user) return;
    await addDoc(collection(db, 'rooms', id, 'reactions'), {
      emoji,
      userId: user.uid,
      timestamp: serverTimestamp()
    });
    if (gainAura) {
      gainAura(2).catch((e) => console.warn("Erro ao ganhar Aura ao reagir na sala:", e));
    }
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
    if (gainAura) {
      gainAura(2).catch((e) => console.warn("Erro ao ganhar Aura ao conversar na sala:", e));
    }

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
      alert("Você precisa estar em um assento de voz para falar.");
      return;
    }

    if (room.mutedUsers?.includes(user.uid)) {
      alert("Você está silenciado pelos moderadores desta sala.");
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
    
    // Check if slot is taken and the occupant is actually still inside the room
    const occupant = room.slots?.[slotId];
    if (occupant && occupant !== user.uid && room.members.includes(occupant)) return;

    // Stage/Seats verification
    const isOwner = room.ownerId === user.uid;
    const isModerator = isOwner || room.moderators?.includes(user.uid);
    const isStageSlot = slotId <= 2;

    // Center Primary Host Slot is strictly reserved for the Host
    if (slotId === 0 && !isOwner) {
      alert("Apenas o Dono (Host) da sala pode se sentar no assento principal!");
      return;
    }

    // Slots 1 and 2 next to host might be blocked by the host
    if ((slotId === 1 || slotId === 2) && room.allowGuestsNextToHost === false && !isOwner) {
      alert("O Dono (Host) desativou ou bloqueou os assentos ao seu lado!");
      return;
    }

    if (isStageSlot && !isOwner && !isModerator && !room.allowFreeMic) {
      alert("Apenas o Dono, Moderadores ou Oradores autorizados podem sentar no Palco (assentos 0, 1, 2) quando o palco está moderado. Use o botão de mãozinha para pedir voz.");
      return;
    }

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
    // 1. Immediately toggle local microphone and states off
    setIsMicOn(false);

    // 2. Mark manual leave flag to bypass double-deletion/race-conditions in useEffect cleanup
    hasLeftRef.current = true;

    // 3. Detach all real-time snapshot listeners immediately to avoid ghost logs or residual events
    if (unsubscribeRoomRef.current) {
      unsubscribeRoomRef.current();
      unsubscribeRoomRef.current = null;
    }
    if (unsubscribeMessagesRef.current) {
      unsubscribeMessagesRef.current();
      unsubscribeMessagesRef.current = null;
    }
    if (unsubscribeReactionsRef.current) {
      unsubscribeReactionsRef.current();
      unsubscribeReactionsRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    // 4. Force empty memories of room chat/reactions instantly so no legacy items show up in UI
    setMessages([]);
    setReactions([]);
    
    // 5. Perform the Firestore removals asynchronously in the background so they do not block instant navigation
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

    // 6. Drive transition immediately with zero delay
    navigate('/');
  };

  const handleSaveSettings = async () => {
    if (!id || !room || room.ownerId !== user?.uid) return;
    setIsSaving(true);
    try {
      const roomRef = doc(db, 'rooms', id);
      const updates: any = {
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
        allowGuestsNextToHost: editAllowGuestsNextToHost,
      };

      // If disabling co-hosts next to host, automatically eject any non-host occupant from slot 1 and 2
      if (!editAllowGuestsNextToHost) {
        if (room.slots?.[1] && room.slots?.[1] !== room.ownerId) {
          updates['slots.1'] = null;
        }
        if (room.slots?.[2] && room.slots?.[2] !== room.ownerId) {
          updates['slots.2'] = null;
        }
      }

      await updateDoc(roomRef, updates);
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
    if (!id || !room || !user) return;
    const isOwner = room.ownerId === user.uid;
    const isMod = room.moderators?.includes(user.uid);
    if (!isOwner && !isMod) return;
    if (uid === user.uid) return;
    if (uid === room.ownerId) return;
    
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
    if (!id || !room || !user) return;
    const isOwner = room.ownerId === user.uid;
    const isMod = room.moderators?.includes(user.uid);
    if (!isOwner && !isMod) return;
    if (uid === room.ownerId) return;
    
    const isMuted = room.mutedUsers?.includes(uid);
    const roomRef = doc(db, 'rooms', id);
    if (isMuted) {
      await updateDoc(roomRef, { mutedUsers: arrayRemove(uid) });
    } else {
      await updateDoc(roomRef, { mutedUsers: arrayUnion(uid) });
    }
    setShowUserActions(null);
  };

  const toggleModeratorUser = async (uid: string) => {
    if (!id || !room || room.ownerId !== user?.uid) return;
    if (uid === user.uid) return;
    
    const isMod = room.moderators?.includes(uid);
    const roomRef = doc(db, 'rooms', id);
    if (isMod) {
      await updateDoc(roomRef, { moderators: arrayRemove(uid) });
    } else {
      await updateDoc(roomRef, { moderators: arrayUnion(uid) });
    }
    setShowUserActions(null);
  };

  const sendGift = async (giftId: string) => {
    if (!id || !profile) return;
    const gift = GIFTS.find(g => g.id === giftId);
    if (!gift) return;

    const totalCost = gift.price * giftQuantity;
    if (!profile.coins || profile.coins < totalCost) {
      alert(`Saldo EGO insuficiente! Você precisa de ${totalCost} moedas para enviar ${giftQuantity}x ${gift.name}.`);
      return;
    }

    let targetId = selectedReceiverId;
    if (!targetId) {
      if (room?.ownerId && room.ownerId !== user?.uid) {
        targetId = room.ownerId;
      } else {
        const otherM = room?.members ? room.members.find(m => m !== user?.uid) : null;
        if (otherM) {
          targetId = otherM;
        }
      }
    }

    if (!targetId) {
      alert("Nenhum destinatário válido selecionado ou disponível na sala!");
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
      
      let targetName = "Membro";
      try {
        const targetSnap = await getDoc(doc(db, 'users', targetId));
        if (targetSnap.exists()) {
          targetName = targetSnap.data().displayName || targetSnap.data().email?.split('@')[0] || "Membro";
        }
      } catch (e) {
        console.warn("Failed to fetch target user name:", e);
      }

      const result = await authSendGift(targetId, giftId, id, undefined, giftQuantity);
      if (result.success) {
        const roomRef = doc(db, 'rooms', id);
        const userRankKey = `giftRank.${uid}`;
        await updateDoc(roomRef, {
          [userRankKey]: {
            displayName: dName,
            photoURL: uPhoto,
            totalSpent: increment(totalCost)
          },
          totalGifts: increment(giftQuantity)
        }).catch((e) => console.warn("Erro ao atualizar ranking de presentes:", e));

        await addDoc(collection(db, 'rooms', id, 'messages'), {
          authorId: uid,
          authorName: dName,
          text: `enviou ${giftQuantity}x ${gift.name} ${gift.icon} para @${targetName}! Ganhos extras para o destinatário: +${result.coinsGained} Moedas EGO!`,
          type: 'gift',
          giftType: gift.name,
          giftIcon: gift.icon,
          giftQuantity: giftQuantity,
          receiverName: targetName,
          auraGained: result.auraGained,
          coinsGained: result.coinsGained,
          timestamp: serverTimestamp(),
          clientCreatedAt: Date.now()
        });

        const xpEarned = Math.max(20, totalCost);
        await gainXp(xpEarned);

        setActiveAnimation({
          id: Math.random().toString(),
          senderName: dName,
          receiverName: targetName,
          giftName: gift.name,
          giftIcon: gift.icon,
          auraGained: result.auraGained || (gift.aura * giftQuantity),
          quantity: giftQuantity,
          coinsGained: result.coinsGained || 0
        });

        setShowGifts(false);
      }
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
  const isMeOwner = room.ownerId === user?.uid;
  const isMeMod = isMeOwner || room.moderators?.includes(user?.uid || '');

  return (
    <div 
      className="fixed inset-0 flex flex-col z-50 font-sans h-[100dvh] overflow-hidden transition-colors duration-1000"
      style={{ backgroundColor: currentTheme.bg }}
    >
      {/* Hidden Audio Elements for Voice Chat */}
      <div className="absolute w-0 h-0 opacity-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {Object.entries(remoteStreams).map(([uid, stream]) => (
          <audio
            key={uid}
            autoPlay
            playsInline
            muted={!isSpeakerOn}
            ref={(el) => {
              if (el) {
                audioRefs.current[uid] = el;
                if (el.srcObject !== stream) {
                  el.srcObject = stream;
                }
                // Apply individual volume (default to 1.0)
                const storedVol = userVolumes[uid] !== undefined ? userVolumes[uid] : 1.0;
                el.volume = storedVol;
                
                // Programmatic play fallback to bypass Android/iOS touch-to-play restrictions 
                el.play().catch((err) => {
                  console.warn(`[Audio] Programmatic play blocked for peer ${uid}:`, err);
                });
              } else {
                delete audioRefs.current[uid];
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
      {/* Refined Minimal Header */}
      <header className="flex-none flex items-center justify-between px-8 pt-16 pb-6 glass-dark border-b border-white/[0.04] relative z-20 shadow-premium">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleLeaveRoom}
            className="w-12 h-12 flex items-center justify-center bg-white/5 border border-white/10 rounded-2xl text-white/30 hover:text-white transition-all active:scale-90"
            title="Sair da Sala"
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
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 italic mt-1.5">{room.category || 'Mundo'}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Unified Stats & Diagnostics Icon */}
          <button 
            onClick={() => setShowSignalModal(true)}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-purple-400 hover:text-purple-300 transition-all active:scale-90 relative cursor-pointer"
            title="Estatísticas, Membros & Diagnósticos da Conexão"
          >
            <Activity size={20} className={
              connectionStatus === 'excelente' ? 'text-emerald-400' :
              connectionStatus === 'bom' ? 'text-purple-400' :
              connectionStatus === 'instavel' ? 'text-orange-400 animate-pulse' :
              'text-red-400 animate-bounce'
            } />
            <span className={`absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full ${
              connectionStatus === 'excelente' ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]' :
              connectionStatus === 'bom' ? 'bg-purple-400 shadow-[0_0_6px_#a855f7]' :
              connectionStatus === 'instavel' ? 'bg-orange-400 shadow-[0_0_6px_#f97316] animate-pulse' :
              'bg-red-500 shadow-[0_0_6px_#ef4444] animate-ping'
            }`} />
          </button>

          {isMeMod && (
            <button 
              onClick={() => setShowSettings(true)}
              className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-[#a855f7] hover:text-[#c084fc] hover:border-purple-500/20 transition-all active:scale-90"
              title="Configurações da Sala"
            >
              <Settings size={22} style={{ color: currentTheme.primary }} />
            </button>
          )}
          
          {(() => {
            const pendingCount = room.speakRequests?.length || 0;
            if (!isMeMod || pendingCount === 0) return null;
            
            return (
              <button 
                onClick={() => setShowSpeakRequestsQueue(true)}
                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-all active:scale-90 relative"
                title="Fila de Oradores"
              >
                <Hand size={18} className="animate-bounce" />
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white font-mono font-black text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center border border-[#0c0c0c]">{pendingCount}</span>
              </button>
            );
          })()}

          <button 
            onClick={() => setForceShowTour(true)}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-white/30 hover:text-white hover:border-white/20 transition-all active:scale-90"
            title="Como Funciona"
          >
            <HelpCircle size={22} />
          </button>
          <button 
            onClick={handleShareRoom}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-pink-400 hover:text-pink-300 hover:border-pink-500/20 transition-all active:scale-90"
            title="Compartilhar Link da Sala"
          >
            <Share2 size={20} />
          </button>
          <button 
            onClick={handleLeaveRoom}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white text-black hover:bg-red-500 hover:text-white transition-all active:scale-90 shadow-[0_10px_20px_rgba(255,255,255,0.1)]"
            title="Sair Canal"
          >
            <LogOut size={22} />
          </button>
        </div>
      </header>

      {/* Stage Layout */}
      <main className="flex-1 overflow-y-auto px-5 relative z-10 pt-3 pb-36 no-scrollbar scroll-smooth">

        {/* El Palco de Voz ✨ (The Voice Stage) */}
        <div id="tour-voice-stage" className="relative mb-4 bg-white/[0.02] border border-white/[0.04] p-3.5 rounded-[24px] backdrop-blur-md max-w-[350px] mx-auto shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          {/* Header title for Stage */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0c0c0c] px-4 py-1.5 rounded-full border border-purple-500/30 flex items-center gap-1.5 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
            <Sparkles size={11} className="text-purple-400 animate-pulse" />
            <span className="text-[9px] font-black uppercase text-white tracking-[0.2em] whitespace-nowrap">PALCO PRINCIPAL ✨</span>
          </div>

          <div className="flex items-center justify-center gap-8 pt-2">
            {/* Slot 0: Center Primary Host */}
            {(() => {
              const hostUid = room.slots?.[0] && room.members.includes(room.slots?.[0]) ? room.slots?.[0] : null;
              return (
                <div className="flex flex-col items-center">
                  <VoiceSeat 
                    slotId={0} 
                    userId={hostUid} 
                    isActive={!!(hostUid && (room.activeSpeakers.includes(hostUid) || (volumes[hostUid] > 5)))}
                    isOwner={hostUid === room.ownerId}
                    volumeLevel={hostUid ? volumes[hostUid] : 0}
                    activeColor={currentTheme.primary}
                    onTake={takeSlot}
                    onUserClick={setShowUserActions}
                    isMuted={!!(hostUid && (room.mutedUsers?.includes(hostUid) || (hostUid === user?.uid && !isMicOn)))}
                  />
                  <span className="text-[10px] font-black text-yellow-400 truncate w-24 text-center mt-1.5 flex items-center justify-center gap-1 leading-none">
                    <Crown size={10} className="fill-yellow-400/20 shrink-0" />
                    <UserDisplayName uid={hostUid} fallback="Host" />
                  </span>
                </div>
              );
            })()}

            {/* Slot 1: Left Co-Host */}
            {(() => {
              const uid1 = room.slots?.[1] && room.members.includes(room.slots?.[1]) ? room.slots?.[1] : null;
              const isLockedByHost = room.allowGuestsNextToHost === false;
              return (
                <div className="flex flex-col items-center">
                  <VoiceSeat 
                    slotId={1} 
                    userId={uid1} 
                    isActive={!!(uid1 && (room.activeSpeakers.includes(uid1) || (volumes[uid1] > 5)))}
                    isOwner={uid1 === room.ownerId}
                    volumeLevel={uid1 ? volumes[uid1] : 0}
                    activeColor={currentTheme.primary}
                    onTake={takeSlot}
                    onUserClick={setShowUserActions}
                    isLocked={isLockedByHost}
                    isMuted={!!(uid1 && (room.mutedUsers?.includes(uid1) || (uid1 === user?.uid && !isMicOn)))}
                  />
                  <span className="text-[10px] font-black tracking-wider text-center mt-1.5 leading-none block w-24">
                    {isLockedByHost && !uid1 ? (
                      <span className="text-red-500/60 flex items-center justify-center gap-1 font-black">
                        <Lock size={9} /> FECHADO
                      </span>
                    ) : (
                      <span className="text-white/50 truncate block"><UserDisplayName uid={uid1} fallback="Convidado" /></span>
                    )}
                  </span>
                </div>
              );
            })()}
          </div>

          {isMeMod && (
            <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-white/5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[9px] font-black uppercase text-white/20 tracking-wider">Painel do Palco</span>
                <span className="text-[8px] font-medium text-white/15 italic">Mod / Dono</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {/* Free Mic Toggle Button */}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const roomRef = doc(db, 'rooms', id || '');
                      const newVal = room.allowFreeMic !== false ? false : true;
                      await updateDoc(roomRef, { allowFreeMic: newVal });
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                  className={`py-1.5 px-2 rounded-xl text-[8px] font-black uppercase tracking-wider flex items-center justify-center gap-1 border transition-all active:scale-95 ${
                    room.allowFreeMic !== false
                      ? 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400'
                      : 'bg-[#a855f7]/10 border-[#a855f7]/15 text-[#a855f7]'
                  }`}
                >
                  <Mic size={10} /> {room.allowFreeMic !== false ? "Mic Livre" : "Moderado"}
                </button>

                {/* Co-host Allowed Toggle Button */}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const roomRef = doc(db, 'rooms', id || '');
                      const newVal = room.allowGuestsNextToHost !== false ? false : true;
                      const updates: any = { allowGuestsNextToHost: newVal };
                      if (!newVal) {
                        if (room.slots?.[1] && room.slots?.[1] !== room.ownerId) updates['slots.1'] = null;
                        if (room.slots?.[2] && room.slots?.[2] !== room.ownerId) updates['slots.2'] = null;
                      }
                      await updateDoc(roomRef, updates);
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                  className={`py-1.5 px-2 rounded-xl text-[8px] font-black uppercase tracking-wider flex items-center justify-center gap-1 border transition-all active:scale-95 ${
                    room.allowGuestsNextToHost !== false
                      ? 'bg-pink-500/10 border-pink-500/15 text-pink-400'
                      : 'bg-red-500/10 border-red-500/15 text-red-400'
                  }`}
                >
                  {room.allowGuestsNextToHost !== false ? <UserMinus size={10} /> : <UserPlus size={10} />}
                  {room.allowGuestsNextToHost !== false ? "Convidado ON" : "Convidado OFF"}
                </button>

                {/* General Settings Button */}
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="col-span-2 py-2 px-3 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/15 transition-all active:scale-95 cursor-pointer"
                >
                  <Settings size={10} /> Configurar Sala
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Assentos da Plateia de Voz 🎙️ (Audience Seats) */}
        <div id="tour-audience-seats" className="mb-6 max-w-[350px] mx-auto bg-white/[0.01] p-4 rounded-[24px] border border-white/[0.02] backdrop-blur-sm">
          {/* Section subtitle */}
          <div className="flex items-center gap-1.5 mb-3.5 justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
            <span className="text-[8px] font-black uppercase text-white/20 tracking-widest">Assentos de Voz ({Array.from({ length: 8 }).filter((_, i) => room.slots?.[i + 2]).length}/8)</span>
          </div>

          <div className="grid grid-cols-4 gap-y-4.5 gap-x-3.5">
            {Array.from({ length: 8 }).map((_, i) => {
              const slotId = i + 2; // Slots 2 to 9
              const rawUid = room.slots?.[slotId];
              const uid = rawUid && room.members.includes(rawUid) ? rawUid : null;
              return (
                <motion.div 
                  key={slotId} 
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: i * 0.04 + 0.05, duration: 0.3 }}
                  className="flex flex-col items-center"
                >
                  <VoiceSeat 
                    slotId={slotId} 
                    userId={uid} 
                    isActive={!!(uid && (room.activeSpeakers.includes(uid) || (volumes[uid] > 5)))}
                    isOwner={uid === room.ownerId}
                    volumeLevel={uid ? volumes[uid] : 0}
                    activeColor={currentTheme.primary}
                    onTake={takeSlot}
                    onUserClick={setShowUserActions}
                    isMuted={!!(uid && (room.mutedUsers?.includes(uid) || (uid === user?.uid && !isMicOn)))}
                  />
                  <div className="mt-1.5 w-12 text-center">
                     <p className="text-[9px] font-bold text-white/30 truncate leading-none overflow-hidden block">
                       <UserDisplayName uid={uid} fallback={`${slotId - 1}º`} />
                     </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* VIP & Member Entrance Announcements Floating Layer */}
        <div className="fixed top-24 left-4 right-4 z-40 pointer-events-none flex flex-col items-center gap-3">
          <AnimatePresence>
            {entranceAnnouncements.map((ann) => (
              <motion.div
                key={ann.id}
                initial={{ opacity: 0, y: -40, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, y: -20, transition: { duration: 0.2 } }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`pointer-events-auto px-5 py-3.5 rounded-2xl flex items-center gap-3 shadow-2xl backdrop-blur-xl border select-none ${
                  ann.isVip
                    ? (ann.vipPlan === 'Bronze' ? 'bg-amber-950/80 border-amber-500/30 text-amber-200' :
                       ann.vipPlan === 'Prata' ? 'bg-slate-900/80 border-slate-400/30 text-slate-200' :
                       ann.vipPlan === 'Ouro' ? 'bg-yellow-950/85 border-yellow-500/40 text-yellow-105 shadow-[0_0_15px_rgba(234,179,8,0.2)]' :
                       'bg-gradient-to-r from-cyan-950/90 to-purple-950/90 border-cyan-400/50 text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.25)]')
                    : 'bg-black/85 border-white/5 text-white shadow-black/80'
                }`}
              >
                <div className="relative shrink-0 w-9 h-9">
                  <UserAvatar uid={ann.uid} className="w-full h-full object-cover rounded-full" showFrame={true} />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wide">
                    <span className={
                      ann.isVip
                        ? (ann.vipPlan === 'Bronze' ? 'text-amber-400' :
                           ann.vipPlan === 'Prata' ? 'text-slate-300' :
                           ann.vipPlan === 'Ouro' ? 'text-yellow-400' :
                           'text-cyan-400 bg-gradient-to-r from-cyan-400 to-fuchsia-400 bg-clip-text text-transparent')
                        : 'text-purple-400'
                    }>
                      {ann.name}
                    </span>
                    {ann.isVip && (
                      <span className="text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded-full bg-white/10 shrink-0">
                        👑 VIP {ann.vipPlan}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-white/50 leading-tight">
                    {ann.isVip 
                      ? `entrou espalhando sua Aura Divina ${ann.vipPlan}! ✨`
                      : 'entrou na sala.'}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
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
                    initial={{ opacity: 0, y: 12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, y: -8 }}
                    transition={{ 
                      opacity: { duration: 0.35, ease: "easeOut" },
                      y: { type: "spring", stiffness: 240, damping: 22 },
                      scale: { type: "spring", stiffness: 240, damping: 22 },
                      layout: { type: "spring", stiffness: 200, damping: 25 }
                    }}
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

          {(() => {
            const isSeated = room?.slots && Object.values(room.slots).includes(user?.uid || '');
            const hasRequestedSpeak = room?.speakRequests?.includes(user?.uid || '');

            if (isSeated) {
              return (
                <button 
                  onClick={leaveSlot}
                  className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl sm:rounded-[28px] flex items-center justify-center bg-red-500/10 border border-red-500/20 text-red-400 hover:text-red-300 transition-all active:scale-90 flex-shrink-0"
                  title="Descer do Palco/Assento"
                >
                  <LogOut size={18} className="rotate-180 sm:size-[22px]" />
                </button>
              );
            }

            return (
              <button 
                onClick={async () => {
                  if (!id || !user) return;
                  const roomRef = doc(db, 'rooms', id);
                  if (hasRequestedSpeak) {
                    await updateDoc(roomRef, {
                      speakRequests: arrayRemove(user.uid)
                    });
                  } else {
                    await updateDoc(roomRef, {
                      speakRequests: arrayUnion(user.uid)
                    });
                  }
                }}
                className={`w-11 h-11 sm:w-14 sm:h-14 rounded-2xl sm:rounded-[28px] flex items-center justify-center border transition-all active:scale-90 flex-shrink-0 relative ${
                  hasRequestedSpeak 
                    ? 'bg-amber-600/20 border-amber-500/40 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)]' 
                    : 'bg-white/5 border-white/5 text-white/40 hover:text-white hover:bg-white/10'
                }`}
                title={hasRequestedSpeak ? "Cancelar pedido para falar" : "Solicitar para falar / subir ao palco"}
              >
                <Hand size={18} className={hasRequestedSpeak ? "animate-pulse text-amber-400" : "sm:size-[22px] text-white/50"} />
                {hasRequestedSpeak && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-400 rounded-full border border-[#0c0c0c]" />
                )}
              </button>
            );
          })()}

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

              {showUserActions !== user?.uid && (
                <div className="mt-6 p-5 bg-white/5 border border-white/5 rounded-3xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Volume2 size={18} className="text-purple-400" style={{ color: currentTheme.primary }} />
                      <span className="text-sm font-bold text-white">Volume Individual</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-white/60">
                      {Math.round((userVolumes[showUserActions] !== undefined ? userVolumes[showUserActions] : 1.0) * 100)}%
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => {
                        const isMuted = (userVolumes[showUserActions] !== undefined ? userVolumes[showUserActions] : 1.0) === 0;
                        handleUserVolumeChange(showUserActions, isMuted ? 1.0 : 0);
                      }}
                      className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all active:scale-95 text-white/70 hover:text-white"
                      title={ (userVolumes[showUserActions] !== undefined ? userVolumes[showUserActions] : 1.0) === 0 ? "Ativar som" : "Desativar som" }
                    >
                      {(userVolumes[showUserActions] !== undefined ? userVolumes[showUserActions] : 1.0) === 0 ? (
                        <VolumeX size={18} className="text-red-400" />
                      ) : (
                        <Volume2 size={18} />
                      )}
                    </button>
                    
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={userVolumes[showUserActions] !== undefined ? userVolumes[showUserActions] : 1.0}
                      onChange={(e) => handleUserVolumeChange(showUserActions, parseFloat(e.target.value))}
                      className="flex-1 h-2 rounded-lg appearance-none cursor-pointer bg-white/10 accent-purple-500"
                      style={{ accentColor: currentTheme.primary }}
                    />
                  </div>
                  <p className="text-[10px] text-white/40 mt-3 font-semibold leading-relaxed">
                    Ajuste o volume deste participante para você. Mudanças aqui não afetam outras pessoas na sala.
                  </p>
                </div>
              )}

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

              {(() => {
                const isMeOwner = room?.ownerId === user?.uid;
                const isMeMod = isMeOwner || room?.moderators?.includes(user?.uid || '');
                const isTargetOwner = showUserActions === room?.ownerId;
                const isTargetMod = room?.moderators?.includes(showUserActions || '');

                if (showUserActions === user?.uid || isTargetOwner) return null;
                if (!isMeMod) return null;

                return (
                  <div className="space-y-3 mt-6 pt-6 border-t border-white/5">
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => toggleMuteUser(showUserActions!)}
                        className="flex items-center justify-center gap-2 p-4 bg-yellow-500/10 border border-yellow-500/10 rounded-2xl text-xs font-bold text-yellow-500 active:scale-95 transition-all"
                      >
                        <BellOff size={16} /> {room.mutedUsers?.includes(showUserActions!) ? 'Desmutar' : 'Silenciar'}
                      </button>
                      <button 
                        onClick={() => kickUser(showUserActions!)}
                        className="flex items-center justify-center gap-2 p-4 bg-red-500/10 border border-red-500/10 rounded-2xl text-xs font-bold text-red-500 active:scale-95 transition-all"
                      >
                        <UserMinus size={16} /> Expulsar
                      </button>
                    </div>

                    {isMeOwner && (
                      <button 
                        onClick={() => toggleModeratorUser(showUserActions!)}
                        className="w-full flex items-center justify-center gap-2 p-4 bg-purple-500/10 border border-purple-500/15 rounded-2xl text-xs font-black uppercase text-purple-400 active:scale-95 transition-all"
                      >
                        <Shield size={16} /> {isTargetMod ? 'Remover Moderador' : 'Tornar Moderador'}
                      </button>
                    )}
                  </div>
                );
              })()}
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
                  <span className="text-lg font-black tracking-tight uppercase text-white border-b-2 border-pink-500 pb-1">
                    Mimos
                  </span>
                </div>
                
                <div className="bg-pink-500/10 px-4 py-2 rounded-2xl border border-pink-500/20 flex items-center gap-2 transition-transform active:scale-95 cursor-pointer">
                  <span className="text-pink-400 font-bold tabular-nums">{(profile as any)?.coins || 0} EGO</span>
                  <Sparkles size={14} className="text-pink-500 fill-pink-500/20 animate-pulse" />
                </div>
              </div>
              
              <div>
                  {/* Recipient Selection Bar */}
                  <div className="mb-6 bg-white/[0.02] border border-white/[0.04] p-4 rounded-3xl">
                    <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] block mb-3 italic">
                      Selecione o Destinatário:
                    </span>
                    <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                      {/* Option: Host/Default */}
                      <button
                        onClick={() => setSelectedReceiverId(null)}
                        className={`px-4 py-2.5 rounded-2xl text-[10px] font-black transition-all border shrink-0 flex items-center gap-2 ${
                          !selectedReceiverId 
                            ? 'bg-gradient-to-r from-pink-600 to-purple-600 border-pink-400 text-white shadow-lg' 
                            : 'bg-white/5 border-white/5 text-white/40 hover:text-white/60'
                        }`}
                      >
                        🎙️ Sala / Host
                      </button>
                      
                      {/* Room members (filtered except current user) */}
                      {(room?.members || []).filter(m => m !== user?.uid).map((memberUid) => {
                        const isSelected = selectedReceiverId === memberUid;
                        return (
                          <button
                            key={memberUid}
                            onClick={() => setSelectedReceiverId(memberUid)}
                            className={`px-3 py-1.5 rounded-2xl text-[10px] font-black transition-all border shrink-0 flex items-center gap-2 ${
                              isSelected 
                                ? 'bg-gradient-to-r from-pink-600 to-purple-600 border-pink-400 text-white shadow-lg' 
                                : 'bg-white/5 border-white/5 text-white/40 hover:text-white/60'
                            }`}
                          >
                            <UserAvatar uid={memberUid} className="w-5 h-5 rounded-full shrink-0" />
                            <span className="max-w-[70px] truncate">
                              <UserDisplayName uid={memberUid} fallback="Membro" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
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

                  {/* Standardized Gifts Grid */}
                  <div className="grid grid-cols-4 gap-3 max-h-[240px] overflow-y-auto pr-1">
                    {GIFTS.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => { sendGift(g.id); }}
                        className="flex flex-col items-center gap-3 p-3 bg-white/5 rounded-3xl border border-white/5 hover:border-white/10 active:scale-90 transition-all group"
                      >
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${g.bgColor} ${g.color}`}>
                          <span className="text-xl">{g.icon}</span>
                        </div>
                        <div className="text-center">
                          <span className="block text-[8px] font-bold text-white/40 uppercase tracking-widest truncate max-w-[55px]">{g.name}</span>
                          <span className="block text-xs text-pink-500 font-black mt-0.5">{g.price}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
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

                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">Convidados ao Lado do Host</h4>
                    <p className="text-[10px] text-white/20 font-medium">Permitir assentos de co-host (1 e 2)</p>
                  </div>
                  <button 
                    onClick={() => setEditAllowGuestsNextToHost(!editAllowGuestsNextToHost)}
                    className={`w-12 h-6 rounded-full relative transition-all ${editAllowGuestsNextToHost ? 'bg-purple-600 shadow-lg shadow-purple-500/20' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editAllowGuestsNextToHost ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/20 pl-1">Layout do Palco</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'standard', name: 'Padrão Grid', desc: 'Mesa de assentos clássicos lateralizados' },
                      { id: 'focus', name: 'Foco Host', desc: 'Destaca radialmente o anfitrião no circuito' }
                    ].map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setEditLayout(l.id)}
                        className={`p-4 rounded-3xl border transition-all flex flex-col gap-1.5 text-left ${editLayout === l.id ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/5'}`}
                      >
                         <h5 className={`text-xs font-bold leading-none ${editLayout === l.id ? 'text-white' : 'text-[#a855f7]/60'}`}>{l.name}</h5>
                         <span className="text-[9px] text-white/20 font-medium leading-[1.3]">{l.desc}</span>
                      </button>
                    ))}
                  </div>
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

      {activeAnimation && (
        <GiftAnimationOverlay 
          activeAnimation={activeAnimation} 
          onAnimationComplete={() => setActiveAnimation(null)} 
        />
      )}

      {/* Unified Stats & Diagnostics Modal */}
      <AnimatePresence>
        {showSignalModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-[999] flex items-center justify-center p-4 scroll-smooth"
            onClick={() => setShowSignalModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 180 }}
              className="bg-[#0b0b0b] border border-white/[0.08] w-full max-w-sm rounded-[32px] p-6 text-center space-y-4.5 relative shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowSignalModal(false)}
                className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="flex flex-col items-center gap-1.5 mt-2">
                <div className={`p-3.5 rounded-2xl ${
                  connectionStatus === 'excelente' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  connectionStatus === 'bom' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                  connectionStatus === 'instavel' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                  'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  <Activity size={24} className={
                    connectionStatus === 'excelente' ? 'animate-pulse' :
                    connectionStatus === 'bom' ? '' :
                    'animate-bounce'
                  } />
                </div>
                <h3 className="text-base font-black uppercase text-white tracking-wider mt-1">Painel & Diagnósticos</h3>
                <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest font-mono">Estatísticas Operacionais</p>
              </div>

              {/* Barra de Status de Conectividade */}
              <div className={`mx-auto px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border flex items-center justify-center gap-1.5 w-max ${
                connectionStatus === 'excelente' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' :
                connectionStatus === 'bom' ? 'bg-purple-500/15 text-purple-300 border-purple-500/25' :
                connectionStatus === 'instavel' ? 'bg-orange-500/15 text-orange-300 border-orange-500/25' :
                'bg-red-500/15 text-red-300 border-red-500/25'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping shrink-0" />
                Sinal: {connectionStatus === 'excelente' ? 'Excelente' :
                 connectionStatus === 'bom' ? 'Bom / Estável' :
                 connectionStatus === 'instavel' ? 'Instável / Oscilação' :
                 'Crítico / Lento'}
              </div>

              {/* Grid 1: Diagnostic Metrics (Ping, Média, Oscilação) */}
              <div className="grid grid-cols-3 gap-2 bg-black/50 p-3 rounded-2xl border border-white/5 text-center">
                <div className="space-y-0.5">
                  <span className="text-[8px] text-white/30 font-black uppercase tracking-widest block">Ping</span>
                  <span className="text-xs font-black text-white font-mono block">
                    {currentLatency !== null ? `${currentLatency}ms` : '--'}
                  </span>
                </div>
                <div className="space-y-0.5 border-x border-white/5">
                  <span className="text-[8px] text-white/30 font-black uppercase tracking-widest block">Média</span>
                  <span className="text-xs font-black text-purple-300 font-mono block">
                    {averageLatency > 0 ? `${averageLatency}ms` : '--'}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[8px] text-white/30 font-black uppercase tracking-widest block">Oscilação</span>
                  <span className="text-xs font-black text-white font-mono block">
                    {jitter > 0 ? `${jitter}ms` : '0ms'}
                  </span>
                </div>
              </div>

              {/* Grid 2: Room Operational statistics */}
              <div className="grid grid-cols-2 gap-2">
                {/* Uptime Stat Box */}
                <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl text-left flex flex-col justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-xs">⏱️</span>
                    <span className="text-[8px] text-white/40 font-black uppercase tracking-widest">Tempo de Sala</span>
                  </div>
                  <span className="text-xs font-black text-emerald-300 font-mono tracking-wide tabular-nums mt-1">{uptime}</span>
                </div>

                {/* Total Gifts Box */}
                <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl text-left flex flex-col justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-xs">🎁</span>
                    <span className="text-[8px] text-white/40 font-black uppercase tracking-widest">Enviados</span>
                  </div>
                  <span className="text-xs font-black text-pink-400 font-mono tracking-wide mt-1">{room.totalGifts || 0} mimos</span>
                </div>
              </div>

              {/* Section 3: Active Members Carousel list with Ranking shortcut */}
              <div className="border-t border-white/[0.06] pt-4 text-left space-y-3">
                <div className="flex items-center justify-between select-none">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    Membros Ativos ({room.members.length})
                  </span>
                  
                  <button
                    onClick={() => {
                      setShowSignalModal(false);
                      setShowRoomRank(true);
                    }}
                    className="text-[9px] font-black uppercase tracking-widest text-yellow-400 hover:text-yellow-300 flex items-center gap-1 bg-yellow-400/10 border border-yellow-400/15 px-2 py-1 rounded-lg transition-all active:scale-95 cursor-pointer"
                  >
                    <Trophy size={10} className="fill-yellow-400/10" />
                    Ranking
                  </button>
                </div>

                <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1 scroll-smooth max-h-16">
                  {room.members.map((uid) => (
                    <button 
                      key={uid}
                      onClick={() => {
                        setShowSignalModal(false);
                        setShowUserActions(uid);
                      }}
                      className="relative flex-none hover:scale-105 active:scale-95 transition-all outline-none"
                      title="Ver Ações"
                    >
                      <div className="relative">
                        <UserAvatar 
                          uid={uid} 
                          className="w-10 h-10 rounded-full border border-white/5" 
                          showLevel={false} 
                        />
                        {room.ownerId === uid && (
                          <div className="absolute -top-1.5 -right-1.5 bg-yellow-500 text-black rounded-full p-0.5 border border-[#0c0c0c] scale-[0.55] shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                            <Crown size={8} className="fill-yellow-500/20" />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Informative advice */}
              <div className="text-left text-[11px] text-white/40 bg-white/[0.01] border border-white/5 p-3.5 rounded-2xl leading-relaxed">
                {connectionStatus === 'excelente' && (
                  <p className="text-emerald-300/60 font-semibold">
                    Conexão fantástica! Sem perdas de áudio, com atraso imperceptível. ✨
                  </p>
                )}
                {connectionStatus === 'bom' && (
                  <p className="text-purple-300/60 font-semibold">
                    Conexão normal e saudável. Ótima qualidade de voz. 👍
                  </p>
                )}
                {connectionStatus === 'instavel' && (
                  <p className="text-orange-300/60 font-semibold">
                    Sinal oscilando parciamente. Fique perto do roteador. 📡
                  </p>
                )}
                {connectionStatus === 'critico' && (
                  <p className="text-red-300/60 font-semibold">
                    Latência muito alta. A voz pode engasgar um pouco. ⚠️
                  </p>
                )}
              </div>

              <button 
                onClick={() => setShowSignalModal(false)}
                className="w-full py-3 bg-white text-black hover:bg-neutral-200 transition-colors font-black uppercase text-[10px] tracking-wider rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                Fechar Painel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Room Ranking Modal (Mimos Leaderboard) */}
      <AnimatePresence>
        {showRoomRank && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[999] flex items-center justify-center p-4 select-none"
            onClick={() => setShowRoomRank(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 180 }}
              className="bg-[#0b0b0b] border border-white/[0.08] w-full max-w-sm rounded-[32px] p-6 text-center space-y-5 relative shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowRoomRank(false)}
                className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="flex flex-col items-center gap-1 mt-2">
                <div className="p-4 bg-yellow-500/10 text-yellow-400 rounded-2xl border border-yellow-500/20 shadow-[0_0_20px_rgba(234,179,8,0.15)]">
                  <Trophy size={32} className="fill-yellow-500/10" />
                </div>
                <h3 className="text-lg font-black uppercase text-white tracking-wider mt-3 font-sans italic">Ranking de Mimos</h3>
                <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest font-mono">Maiores Contribuidores</p>
              </div>

              {/* Leaderboard content scroll */}
              <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1 no-scrollbar">
                {sortedContributors.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-white/20">
                    <Gift size={28} className="stroke-1.5 opacity-20 mb-2 animate-bounce text-pink-500" />
                    <p className="text-[10px] uppercase font-black tracking-wider">Ainda não há mimos nesta sala!</p>
                  </div>
                ) : (
                  sortedContributors.map((c, index) => {
                    const isGold = index === 0;
                    const isSilver = index === 1;
                    const isBronze = index === 2;
                    
                    return (
                      <div 
                        key={c.uid}
                        className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                          isGold ? 'bg-yellow-500/10 border-yellow-500/25 shadow-[0_0_15px_rgba(234,179,8,0.1)]' :
                          isSilver ? 'bg-slate-300/5 border-slate-300/10' :
                          isBronze ? 'bg-amber-700/5 border-amber-700/10' :
                          'bg-white/[0.01] border-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Rank badge */}
                          <div className="w-6 flex items-center justify-center">
                            {isGold ? <span className="text-lg">🥇</span> :
                             isSilver ? <span className="text-lg">🥈</span> :
                             isBronze ? <span className="text-lg">🥉</span> :
                             <span className="font-mono text-[10px] font-black text-white/20">#{index + 1}</span>
                            }
                          </div>

                          <div className="w-10 h-10 rounded-full relative">
                            <UserAvatar 
                              uid={c.uid} 
                              className="w-full h-full rounded-full object-cover" 
                              showLevel={false} 
                            />
                          </div>

                          <div className="flex flex-col items-start text-left">
                            <span className="text-xs font-black text-white leading-tight">{c.displayName}</span>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">Benfeitor</span>
                          </div>
                        </div>

                        {/* Total Spent in coins */}
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-black text-rose-450 font-mono text-pink-400 tabular-nums">{c.totalSpent}</span>
                          <span className="text-[9px] font-black uppercase tracking-wider text-pink-500/50">Moedas</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <button 
                onClick={() => setShowRoomRank(false)}
                className="w-full py-3 bg-white text-black hover:bg-neutral-200 transition-colors font-black uppercase text-[10px] tracking-wider rounded-2xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                Fechar Ranking
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Share Copy Toast */}
      <AnimatePresence>
        {showShareToast && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.9, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, scale: 0.9, y: 20, transition: { duration: 0.2 }, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 22 }}
            className="fixed bottom-28 left-1/2 z-[999] px-6 py-4 bg-[#0c0c0c]/90 border border-pink-500/30 text-pink-300 rounded-[20px] flex items-center gap-2.5 shadow-2xl backdrop-blur-xl shrink-0 select-none text-[10px] font-black uppercase tracking-widest text-center"
          >
            <Sparkles size={13} className="animate-pulse text-pink-400 shrink-0" /> 
            Link de convite copiado! Convide seus amigos ✨
          </motion.div>
        )}
      </AnimatePresence>
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
  size = 'medium',
  isLocked = false,
  isMuted = false
}: { 
  slotId: number, 
  userId?: string | null, 
  isActive: boolean, 
  isOwner: boolean, 
  onTake: (id: number) => void,
  onUserClick?: (uid: string) => void,
  volumeLevel?: number,
  activeColor?: string,
  size?: 'medium' | 'large',
  isLocked?: boolean,
  isMuted?: boolean
}) {
  const sizeClasses = size === 'large' ? 'w-22 h-22' : 'w-14 h-14';

  return (
    <div className="relative group flex flex-col items-center select-none">
      {/* Speaking Aura - Ultra Premium Smooth Pulsing visualizer */}
      <AnimatePresence>
        {isActive && (
          <>
            {/* 1st outer smooth wave pulse */}
            <motion.div 
              initial={{ scale: 1, opacity: 0 }}
              animate={{ 
                scale: [1, 1.45 + (volumeLevel / 120), 1], 
                opacity: [0, 0.45, 0] 
              }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
              className="absolute inset-0 rounded-full z-0 pointer-events-none"
              style={{ 
                border: `3px solid ${activeColor}`, 
                boxShadow: `0 0 40px ${activeColor}80` 
              }}
            />
            {/* 2nd inner high-speed aura ring */}
            <motion.div 
              initial={{ scale: 1, opacity: 0 }}
              animate={{ 
                scale: [1, 1.25 + (volumeLevel / 180), 1], 
                opacity: [0, 0.7, 0] 
              }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut", delay: 0.2 }}
              className="absolute inset-0 rounded-full z-0 pointer-events-none"
              style={{ 
                border: `2px solid ${activeColor}`,
                boxShadow: `inset 0 0 20px ${activeColor}55`
              }}
            />
            {/* Ambient pulsing background radial projection */}
            <motion.div
              animate={{ 
                scale: [1, 1.15, 1],
                opacity: [0.15, 0.35, 0.15]
              }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "linear" }}
              className="absolute inset-[-12px] rounded-full blur-xl pointer-events-none z-0"
              style={{ backgroundColor: activeColor }}
            />
          </>
        )}
      </AnimatePresence>
      
      <button 
        onClick={() => {
          if (isLocked && !userId) {
            alert("Este assento está temporariamente desativado ou bloqueado pelo Host!");
            return;
          }
          userId ? onUserClick?.(userId) : onTake(slotId);
        }}
        className={`
          ${sizeClasses} rounded-full flex items-center justify-center relative z-10 transition-all duration-300
          ${userId 
            ? 'p-1 bg-[#0c0c0c] border-[3px] shadow-[0_4px_25px_rgba(0,0,0,0.7)]' 
            : isLocked 
              ? 'bg-red-500/10 border-2 border-dashed border-red-500/20 opacity-40 cursor-not-allowed'
              : 'bg-white/5 border-2 border-dashed border-white/10 hover:bg-white/10 hover:border-white/20 hover:scale-105'
          }
          active:scale-95
        `}
        style={{ 
          borderColor: userId && isActive ? activeColor : 'rgba(255,255,255,0.08)',
          boxShadow: userId && isActive 
            ? `0 0 25px ${activeColor}, inset 0 0 15px rgba(255,255,255,0.2)` 
            : '0 4px 20px rgba(0,0,0,0.5)',
          transform: userId && isActive ? `scale(${1 + Math.min(volumeLevel / 200, 0.08)})` : undefined
        }}
        disabled={isLocked && !userId}
      >
        {userId ? (
          <div className="w-full h-full rounded-full overflow-visible relative group shadow-inner">
             {/* Hardware Shine Effect */}
             <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none z-20 rounded-full overflow-hidden" />
            
            <UserAvatar 
              uid={userId!} 
              className={`w-full h-full object-cover transition-all duration-700 ${isActive ? 'grayscale-0' : 'grayscale-[0.1] group-hover:grayscale-0 group-hover:scale-110'}`}
              showLevel={false} // Don't show extra levels on stage avatars as requested
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
                   <div className="text-[7px] font-black text-white uppercase tracking-widest animate-pulse italic">Falando</div>
               </div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
             {isLocked ? (
               <Lock size={16} className="text-red-500/40" />
             ) : (
               <Plus size={size === 'large' ? 26 : 20} className="text-white/20 group-hover:text-purple-400 transition-colors" />
             )}
             <span className="text-[7px] font-black text-white/5 uppercase tracking-widest group-hover:text-white/20 transition-colors">{slotId}</span>
          </div>
        )}
      </button>

      {/* Visual Indicator: Anfitrião da Sala (Crown at top-left) */}
      {userId && isOwner && (
        <div 
          className="absolute -top-1.5 -left-1.5 bg-gradient-to-r from-yellow-400 via-amber-500 to-rose-500 text-black w-6.5 h-6.5 rounded-xl flex items-center justify-center z-40 shadow-[0_4px_12px_rgba(234,179,8,0.5)] border border-yellow-300"
          title="Anfitrião do Clã"
        >
          <Crown size={12} className="fill-black/10 text-black" />
        </div>
      )}

      {/* Visual Indicator: Mic Status (Green/Indigo/Red micro-capsule at top-right) */}
      {userId && (
        isMuted ? (
          <div 
            className="absolute -top-1.5 -right-1.5 w-6.5 h-6.5 rounded-xl border border-red-500/30 bg-red-600 text-white flex items-center justify-center z-40 shadow-[0_4px_12px_rgba(239,68,68,0.45)]"
            title="Microfone Mutado"
          >
            <MicOff size={11} />
          </div>
        ) : (
          <div 
            className={`absolute -top-1.5 -right-1.5 w-6.5 h-6.5 rounded-xl border flex items-center justify-center z-40 transition-all duration-500 shadow-2xl ${
              isActive 
                ? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-110' 
                : 'bg-indigo-600 text-white border-indigo-400/50 shadow-[0_4px_10px_rgba(79,70,229,0.3)]'
            }`}
            title={isActive ? "Microfone Ligado • Falando Ativamente" : "Microfone Ligado • Em Silêncio"}
          >
            <Mic size={11} className={isActive ? "animate-pulse" : ""} />
          </div>
        )
      )}
    </div>
  );
}

