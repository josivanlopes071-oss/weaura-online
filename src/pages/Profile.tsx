import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Shield, Trophy, MapPin, Calendar, LogOut, Edit2, X, Check, Camera, RefreshCw, UserMinus, Search, ChevronRight, UserPlus, MessageCircle, Star, Flame, Gamepad2, Gift, Play, Unlock, Sparkles, Smile, Clock, Users, ShieldAlert, Lock, MessageSquareText, HelpCircle, HeartHandshake, Crown, TrendingUp, Eye, Trash2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { compressImage } from '../lib/imageCompressor';
import { doc, getDoc, updateDoc, onSnapshot, collection, query, where, getDocs, limit, serverTimestamp, orderBy } from 'firebase/firestore';
import AdminMenu from '../components/AdminMenu';
import UserAvatar from '../components/UserAvatar';
import PremiumTag from '../components/PremiumTag';
import { getAuraLevelInfo, AURA_LEVELS, GIFTS } from '../lib/aura';
import GiftAnimationOverlay from '../components/GiftAnimationOverlay';
import { useToast } from '../contexts/ToastContext';

// Import Drawers
import VIPDrawer from '../components/VIPDrawer';
import MomentsDrawer from '../components/MomentsDrawer';
import StatusDrawer from '../components/StatusDrawer';
import VisitorsDrawer from '../components/VisitorsDrawer';
import InviteFriendsDrawer from '../components/InviteFriendsDrawer';
import NobilityDrawer from '../components/NobilityDrawer';
import SecurityCenterDrawer from '../components/SecurityCenterDrawer';
import NetworkDrawer from '../components/NetworkDrawer';

export default function Profile() {
  const idParam = useParams();
  const id = idParam.id;
  const navigate = useNavigate();
  const { user, profile: myProfile, logout, updateProfile, followUser, sendGift } = useAuth();
  const { success, error: toastError, info: toastInfo } = useToast();
  
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

  // Real-time fetched state variables
  const [recentVisitors, setRecentVisitors] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [selectedAchievement, setSelectedAchievement] = useState<any | null>(null);

  // New states for the interactive drawers/modes
  const [isVipOpen, setIsVipOpen] = useState(false);
  const [isMomentsOpen, setIsMomentsOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isVisitorsOpen, setIsVisitorsOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isNobilityOpen, setIsNobilityOpen] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  
  // Custom states added for followers, games, sent gifts, and medals
  const [isNetworkOpen, setIsNetworkOpen] = useState(false);
  const [networkInitialTab, setNetworkInitialTab] = useState<'followers' | 'following'>('followers');
  const [games, setGames] = useState<any[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [sentGifts, setSentGifts] = useState<any[]>([]);
  const [selectedMedal, setSelectedMedal] = useState<any | null>(null);
  const [visibleActivitiesCount, setVisibleActivitiesCount] = useState(5);

  // States for simplified popups
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isParentalOpen, setIsParentalOpen] = useState(false);
  const [parentalPin, setParentalPin] = useState('');
  const [parentalEnabled, setParentalEnabled] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

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

      // Register profile visits
      const registerProfileVisit = async () => {
        try {
          const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
          await addDoc(collection(db, 'profile_visits'), {
            targetUserId: id,
            visitorId: user.uid,
            visitorName: myProfile.displayName || 'Membro do WeAura',
            visitorPhoto: myProfile.photoURL || '',
            visitedAt: serverTimestamp()
          });
        } catch (visitErr) {
          console.warn("Could not record profile visitor metadata: ", visitErr);
        }
      };
      registerProfileVisit();

      return () => unsubscribe();
    }
  }, [id, user, myProfile]);

  useEffect(() => {
    if (!displayProfile?.uid) return;
    const q = query(collection(db, 'gift_transactions'), where('receiverId', '==', displayProfile.uid), limit(100));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => doc.data());
      list.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setReceivedGifts(list);
    }, (err) => {
      console.warn("Could not retrieve received gifts in real-time:", err);
    });
    return () => unsubscribe();
  }, [displayProfile?.uid]);

  useEffect(() => {
    if (!user) return;
    // Load global leaderboard to calculate user's real-time ranking
    const qLeaderboard = query(
      collection(db, 'users'),
      orderBy('aura', 'desc'),
      limit(100)
    );
    const unsubscribeLeaderboard = onSnapshot(qLeaderboard, (snap) => {
      const uList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLeaderboard(uList);
    }, (err) => {
      console.warn("Could not retrieve global leaderboard in real-time:", err);
    });
    return () => unsubscribeLeaderboard();
  }, [user]);

  useEffect(() => {
    // Load real-time recent visitors
    if (!displayProfile?.uid) return;
    const qVisitors = query(
      collection(db, 'profile_visits'),
      where('targetUserId', '==', displayProfile.uid),
      limit(25)
    );
    const unsubscribeVisitors = onSnapshot(qVisitors, (snap) => {
      const visitList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort in memory to avoid index requirement
      visitList.sort((a: any, b: any) => {
        const secondsA = a.visitedAt?.seconds || 0;
        const secondsB = b.visitedAt?.seconds || 0;
        return secondsB - secondsA;
      });
      setRecentVisitors(visitList.slice(0, 5));
    }, (err) => {
      console.warn("Could not retrieve real-time visitors:", err);
    });
    return () => unsubscribeVisitors();
  }, [displayProfile?.uid]);

  useEffect(() => {
    if (!displayProfile?.uid) return;
    const q = query(collection(db, 'gift_transactions'), where('senderId', '==', displayProfile.uid), limit(100));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => doc.data());
      list.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setSentGifts(list);
    }, (err) => {
      console.warn("Could not retrieve sent gifts in real-time:", err);
    });
    return () => unsubscribe();
  }, [displayProfile?.uid]);

  useEffect(() => {
    if (!displayProfile?.uid) return;
    setLoadingGames(true);

    const fetchGamesData = async () => {
      try {
        const targetId = displayProfile.uid;
        
        // Checkers matches where targetId is player1 or player2
        const checkersRef = collection(db, 'checkers_matches');
        const qCheckersP1 = query(checkersRef, where('player1', '==', targetId));
        const qCheckersP2 = query(checkersRef, where('player2', '==', targetId));
        
        // TicTacToe matches where targetId is player1 or player2
        const tttRef = collection(db, 'tictactoe_matches');
        const qTTTP1 = query(tttRef, where('player1', '==', targetId));
        const qTTTP2 = query(tttRef, where('player2', '==', targetId));

        const [snapCP1, snapCP2, snapTP1, snapTP2] = await Promise.all([
          getDocs(qCheckersP1),
          getDocs(qCheckersP2),
          getDocs(qTTTP1),
          getDocs(qTTTP2)
        ]);

        const checkersP1 = snapCP1.docs.map(doc => ({ ...doc.data(), id: doc.id, gameType: 'checkers' }));
        const checkersP2 = snapCP2.docs.map(doc => ({ ...doc.data(), id: doc.id, gameType: 'checkers' }));
        const tttP1 = snapTP1.docs.map(doc => ({ ...doc.data(), id: doc.id, gameType: 'tictactoe' }));
        const tttP2 = snapTP2.docs.map(doc => ({ ...doc.data(), id: doc.id, gameType: 'tictactoe' }));

        // Deduplicate using a Map
        const allMatchesMap: { [id: string]: any } = {};
        [...checkersP1, ...checkersP2, ...tttP1, ...tttP2].forEach(m => {
          allMatchesMap[m.id] = m;
        });

        const mergedGames = Object.values(allMatchesMap);
        // Sort by updatedAt or createdAt desc
        mergedGames.sort((a: any, b: any) => {
          const timeA = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
          const timeB = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
          return timeB - timeA;
        });

        setGames(mergedGames);
      } catch (err) {
        console.warn("Could not retrieve game matches data:", err);
      } finally {
        setLoadingGames(false);
      }
    };

    fetchGamesData();
  }, [displayProfile?.uid]);

  if (!displayProfile || !user || !myProfile) return null;

  const SUPER_ADMINS = ['josivanlopes071@gmail.com', 'manoeldasilva631kejr@gmail.com'];
  const isSuperAdmin = SUPER_ADMINS.includes((user.email || '').toLowerCase());

  const formatTimeAgo = (timestamp: any) => {
    if (!timestamp) return 'Agora';
    try {
      const date = timestamp?.seconds ? new Date(timestamp.seconds * 1000) : (timestamp?.toDate ? timestamp.toDate() : new Date(timestamp));
      const diffMs = Date.now() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHr = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHr / 24);

      if (diffSec < 60) return 'Há instantes';
      if (diffMin < 60) return `${diffMin}m atrás`;
      if (diffHr < 24) return `${diffHr}h atrás`;
      return `${diffDays}d atrás`;
    } catch (e) {
      return 'Recentemente';
    }
  };

  const calculateAchievements = () => {
    const u = displayProfile;
    if (!u) return [];

    const levelVal = u.level || 1;
    const auraVal = u.aura || 0;
    const coinsVal = u.coins || 0;
    const followersCount = u.followers?.length || 0;
    const followingCount = u.following?.length || 0;
    const giftsCount = receivedGifts.reduce((acc: number, t: any) => acc + (t.quantity || 1), 0);

    return [
      {
        id: 'first_step',
        name: 'Primeiro Passo',
        description: 'Chegue ao Nível 2 e inicie sua jornada na Aurora',
        icon: '🌱',
        unlocked: levelVal >= 2,
        progress: levelVal,
        maxProgress: 2,
        colorClass: 'text-green-400',
        borderColorClass: 'border-green-500/20 shadow-[0_0_12px_rgba(34,197,94,0.15)] bg-green-500/5',
        bgIconColor: 'bg-green-500/10'
      },
      {
        id: 'aura_pioneer',
        name: 'Desbravador da Luz',
        description: 'Acumule 100 pontos de prestígio de Aura',
        icon: '✨',
        unlocked: auraVal >= 100,
        progress: auraVal,
        maxProgress: 100,
        colorClass: 'text-emerald-400',
        borderColorClass: 'border-emerald-400/20 shadow-[0_0_12px_rgba(16,185,129,0.15)] bg-emerald-500/5',
        bgIconColor: 'bg-emerald-400/10'
      },
      {
        id: 'clan_master',
        name: 'Mestre do Clã',
        description: 'Alcance o imponente Nível 10',
        icon: '🏆',
        unlocked: levelVal >= 10,
        progress: levelVal,
        maxProgress: 10,
        colorClass: 'text-purple-400',
        borderColorClass: 'border-purple-500/20 shadow-[0_0_12px_rgba(168,85,247,0.15)] bg-purple-500/5',
        bgIconColor: 'bg-purple-500/10'
      },
      {
        id: 'ego_tycoon',
        name: 'Magnata do EGO',
        description: 'Acumule 1.000 moedas na carteira',
        icon: '💰',
        unlocked: coinsVal >= 1000,
        progress: coinsVal,
        maxProgress: 1000,
        colorClass: 'text-yellow-400',
        borderColorClass: 'border-yellow-400/20 shadow-[0_0_12px_rgba(250,204,21,0.15)] bg-yellow-400/5',
        bgIconColor: 'bg-yellow-400/10'
      },
      {
        id: 'influencer',
        name: 'Influenciador',
        description: 'Tenha pelo menos 3 seguidores no seu clã',
        icon: '📣',
        unlocked: followersCount >= 3,
        progress: followersCount,
        maxProgress: 3,
        colorClass: 'text-pink-400',
        borderColorClass: 'border-pink-500/20 shadow-[0_0_12px_rgba(244,63,94,0.15)] bg-pink-500/5',
        bgIconColor: 'bg-pink-500/10'
      },
      {
        id: 'radiant_legend',
        name: 'Lenda Radiante',
        description: 'Atinja 5.000 pontos prestigiados de Aura',
        icon: '🌌',
        unlocked: auraVal >= 5000,
        progress: auraVal,
        maxProgress: 5000,
        colorClass: 'text-cyan-400',
        borderColorClass: 'border-cyan-400/20 shadow-[0_0_12px_rgba(34,211,238,0.15)] bg-cyan-400/5',
        bgIconColor: 'bg-cyan-400/10'
      },
      {
        id: 'philanthropist',
        name: 'Afeição Recebida',
        description: 'Receba pelo menos 10 presentes enviados por amigos',
        icon: '🎁',
        unlocked: giftsCount >= 10,
        progress: giftsCount,
        maxProgress: 10,
        colorClass: 'text-indigo-400',
        borderColorClass: 'border-indigo-500/20 shadow-[0_0_12px_rgba(99,102,241,0.15)] bg-indigo-500/5',
        bgIconColor: 'bg-indigo-500/10'
      },
      {
        id: 'social_explorer',
        name: 'Explorador Social',
        description: 'Siga pelo menos 3 parceiros para acompanhar novidades',
        icon: '❤️',
        unlocked: followingCount >= 3,
        progress: followingCount,
        maxProgress: 3,
        colorClass: 'text-red-400',
        borderColorClass: 'border-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.15)] bg-red-500/5',
        bgIconColor: 'bg-red-500/10'
      }
    ];
  };

  const calculateMedals = () => {
    const u = displayProfile;
    if (!u) return [];

    const auraVal = u.aura || 0;
    const levelVal = u.level || 1;
    const receivedCount = receivedGifts.reduce((acc: number, t: any) => acc + (t.quantity || 1), 0);
    const sentCount = sentGifts.reduce((acc: number, t: any) => acc + (t.quantity || 1), 0);
    const totalWinsCount = totalWins;

    return [
      {
        id: 'aura_supreme',
        name: 'Medalha Suprema de Aura',
        description: 'Concedida aos membros mais ilustres e brilhantes que ultrapassam o patamar de 1.500 pontos de prestígio de Aura ou nível 15 do clã.',
        icon: '👑',
        unlocked: auraVal >= 1500 || levelVal >= 15,
        progressText: `${auraVal.toLocaleString()} / 1.500 Aura`,
        rarity: 'Lendário',
        glowColor: 'shadow-[0_0_20px_rgba(245,158,11,0.3)] border-amber-500/30',
        borderColor: 'hover:border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-amber-950/20',
      },
      {
        id: 'philanthropy_master',
        name: 'Benfeitor do Ano',
        description: 'Demonstre calor humano de WeAura doando 5 ou mais presentes luxuosos aos seus companheiros.',
        icon: '💖',
        unlocked: sentCount >= 5,
        progressText: `${sentCount} / 5 Enviados`,
        rarity: 'Épico',
        glowColor: 'shadow-[0_0_15px_rgba(236,72,153,0.3)] border-pink-500/20',
        borderColor: 'hover:border-pink-500/40 bg-gradient-to-b from-pink-500/10 to-pink-950/20',
      },
      {
        id: 'gift_prestige',
        name: 'Ícone de Encanto',
        description: 'Sua presença é magnética! Conquistado ao acumular 8 ou mais presentes em seu estojo pessoal.',
        icon: '💎',
        unlocked: receivedCount >= 8,
        progressText: `${receivedCount} / 8 Recebidos`,
        rarity: 'Épico',
        glowColor: 'shadow-[0_0_15px_rgba(59,130,246,0.3)] border-blue-500/20',
        borderColor: 'hover:border-blue-500/40 bg-gradient-to-b from-blue-500/10 to-blue-950/20',
      },
      {
        id: 'grandmaster_checkers',
        name: 'Mestre da Estratégia',
        description: 'Concedido por dominar o tabuleiro ganhando 3 ou mais jogos em tempo real (Damas ou Jogo da Velha).',
        icon: '🎯',
        unlocked: totalWinsCount >= 3,
        progressText: `${totalWinsCount} / 3 Vitórias`,
        rarity: 'Raro',
        glowColor: 'shadow-[0_0_12px_rgba(168,85,247,0.25)] border-purple-500/20',
        borderColor: 'hover:border-purple-500/40 bg-gradient-to-b from-purple-500/10 to-purple-950/20',
      },
      {
        id: 'clan_veteran',
        name: 'Determinação Radiante',
        description: 'Exclusivo para membros que alcançaram o nível 5 de status na comunidade secreta do clã.',
        icon: '🛡️',
        unlocked: levelVal >= 5,
        progressText: `Lvl ${levelVal} / Lvl 5`,
        rarity: 'Raro',
        glowColor: 'shadow-[0_0_12px_rgba(16,185,129,0.25)] border-emerald-500/20',
        borderColor: 'hover:border-emerald-500/40 bg-gradient-to-b from-emerald-500/10 to-emerald-950/20',
      }
    ];
  };

  const getActivityTimeline = () => {
    const timelines: any[] = [];
    const u = displayProfile;
    if (!u) return [];

    // 1. Game play activities
    games.forEach((g) => {
      const matchTime = g.updatedAt?.toMillis ? g.updatedAt.toMillis() : (g.createdAt?.toMillis ? g.createdAt.toMillis() : (g.updatedAt?.seconds ? g.updatedAt.seconds * 1000 : Date.now()));
      const oppName = g.player1 === u.uid ? (g.player2Name || 'Membro do Clã') : (g.player1Name || 'Membro do Clã');
      let isWin = false;
      let isDraw = false;
      
      if (g.gameType === 'checkers') {
        isWin = g.winnerId === u.uid;
        isDraw = g.status === 'ended' && !g.winnerId;
      } else {
        isWin = (g.winner === 'X' && g.player1 === u.uid) || (g.winner === 'O' && g.player2 === u.uid) || g.winner === u.uid;
        isDraw = g.status === 'draw' || g.winner === 'draw';
      }

      let title = g.gameType === 'checkers' ? 'Partida de Damas' : 'Partida de Jogo da Velha';
      let desc = '';
      let icon = '⚔️';
      let color = 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      let xpBadge = '';

      if (isWin) {
        desc = `Vitória épica jogando com ${oppName}`;
        icon = '🏆';
        color = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        xpBadge = '+15 XP';
      } else if (isDraw) {
        desc = `Terminou em empate contra ${oppName}`;
        icon = '🤝';
        color = 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
        xpBadge = '+5 XP';
      } else if (g.status === 'waiting' || g.status === 'waiting_peer') {
        desc = `Abriu nova sala e aguarda oponente`;
        icon = '⏳';
        color = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      } else {
        desc = `Jogou uma disputa desafiadora com ${oppName}`;
        icon = '🎮';
        color = 'text-purple-400 bg-purple-500/10 border-purple-500/20';
        xpBadge = '+2 XP';
      }

      timelines.push({
        id: g.id,
        time: matchTime,
        title,
        desc,
        icon,
        color,
        xpBadge
      });
    });

    // 2. Received gift activities
    receivedGifts.forEach((t, index) => {
      const giftTime = t.createdAt?.toMillis ? t.createdAt.toMillis() : (t.createdAt?.seconds ? t.createdAt.seconds * 1000 : Date.now());
      timelines.push({
        id: `received_${index}_${t.createdAt?.seconds || index}`,
        time: giftTime,
        title: 'Presente Recebido',
        desc: `Ganhou ${t.giftName} de ${t.senderName || 'um amigo'}`,
        icon: t.giftIcon || '🎁',
        color: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
        xpBadge: `+${t.auraGained || 5} Aura`
      });
    });

    // 3. Sent gift activities
    sentGifts.forEach((t, index) => {
      const giftTime = t.createdAt?.toMillis ? t.createdAt.toMillis() : (t.createdAt?.seconds ? t.createdAt.seconds * 1000 : Date.now());
      timelines.push({
        id: `sent_${index}_${t.createdAt?.seconds || index}`,
        time: giftTime,
        title: 'Presente Enviado',
        desc: `Presenteou ${t.receiverName || 'um amigo'} com ${t.giftName}`,
        icon: t.giftIcon || '🎁',
        color: 'text-red-400 bg-red-500/10 border-red-500/20',
        xpBadge: 'Doador'
      });
    });

    // 4. Baseline Milestone (Joined)
    const joinTime = u.joinedAt?.toMillis ? u.joinedAt.toMillis() : (u.joinedAt?.seconds ? u.joinedAt.seconds * 1000 : (Date.now() - 3600000 * 24));
    timelines.push({
      id: 'join_milestone',
      time: joinTime,
      title: 'Aurora Iniciada',
      desc: 'Foi admitido na rede exclusiva e iniciou seu prestígio',
      icon: '✨',
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      xpBadge: 'WeAura'
    });

    // Sort timelines chronologically (newest first)
    timelines.sort((a, b) => b.time - a.time);
    return timelines;
  };

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
    success("ID Copiado para a área de transferência!");
  };

  const totalWins = games.filter(g => {
    if (g.gameType === 'checkers') {
      return g.winnerId === displayProfile.uid;
    } else { // tictactoe
      if (g.winner === 'X' && g.player1 === displayProfile.uid) return true;
      if (g.winner === 'O' && g.player2 === displayProfile.uid) return true;
      if (g.winner === displayProfile.uid) return true;
    }
    return false;
  }).length;

  const stats = [
    { label: 'Jogos', value: String(games.length), color: 'text-purple-500' },
    { label: 'Vitórias', value: String(totalWins), color: 'text-blue-500' },
    { label: 'Seguidores', value: String(displayProfile.followers?.length || 0), color: 'text-pink-500', action: () => { setNetworkInitialTab('followers'); setIsNetworkOpen(true); } },
    { label: 'Seguindo', value: String(displayProfile.following?.length || 0), color: 'text-indigo-400', action: () => { setNetworkInitialTab('following'); setIsNetworkOpen(true); } },
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

    try {
      const compressedBase64 = await compressImage(file);
      await updateProfile({ photoURL: compressedBase64 });
      success("Foto de perfil atualizada com sucesso! 📷");
    } catch (err) {
      console.warn("Erro ao comprimir imagem, tentando carregar original:", err);
      if (file.size > 1024 * 1024) { // 1MB limit for base64 storage
        alert("A imagem deve ter menos de 1MB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        try {
          await updateProfile({ photoURL: base64String });
          success("Foto de perfil atualizada!");
        } catch (err) {
          console.error("Erro ao salvar foto:", err);
        }
      };
      reader.readAsDataURL(file);
    }
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
        {displayProfile.isVip ? (
          <>
            {displayProfile.vipPlan === 'Bronze' && (
              <>
                <div className="absolute inset-0 bg-gradient-to-b from-amber-700/20 via-black to-[#020202]" />
                <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-amber-500/30 to-transparent blur-3xl opacity-60" />
                <div className="absolute top-10 right-10 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl animate-pulse" />
              </>
            )}
            {displayProfile.vipPlan === 'Prata' && (
              <>
                <div className="absolute inset-0 bg-gradient-to-b from-slate-400/20 via-black to-[#020202]" />
                <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-slate-300/30 to-transparent blur-3xl opacity-60" />
                <div className="absolute top-10 right-10 w-24 h-24 bg-slate-400/10 rounded-full blur-2xl" />
              </>
            )}
            {displayProfile.vipPlan === 'Ouro' && (
              <>
                <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/25 via-black to-[#020202]" />
                <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-yellow-400/35 to-transparent blur-3xl opacity-70 animate-pulse" />
                <div className="absolute top-10 right-10 w-32 h-32 bg-yellow-400/15 rounded-full blur-3xl animate-pulse" />
              </>
            )}
            {displayProfile.vipPlan === 'Diamante' && (
              <>
                <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/25 via-purple-900/10 to-[#020202]" />
                <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-400/40 via-purple-500/20 to-transparent blur-3xl opacity-80 animate-pulse" />
                <div className="absolute top-8 right-8 w-32 h-32 bg-cyan-400/20 rounded-full blur-3xl animate-pulse" />
              </>
            )}
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 via-[#020202] to-[#020202]"></div>
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-purple-500/20 to-transparent blur-3xl opacity-50" />
          </>
        )}
        
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

            {isMyProfile && myProfile?.photoURL && (
               <button 
                onClick={async () => {
                  if (window.confirm("Deseja realmente excluir sua foto de perfil e voltar ao padrão?")) {
                    try {
                      await updateProfile({ photoURL: "" });
                      success("Foto de perfil excluída!");
                    } catch (e) {
                      toastError("Erro ao excluir a foto de perfil.");
                    }
                  }
                }}
                className="absolute bottom-2 left-2 bg-red-600 text-white p-3 rounded-full border-4 border-[#0c0c0c] shadow-lg active:scale-110 transition-all z-30 hover:bg-red-500"
                title="Excluir Foto"
               >
                <Trash2 size={18} />
               </button>
            )}
          </div>

          <div className="text-center space-y-2 mb-8 flex flex-col items-center">
            <h2 className="text-4xl font-black italic tracking-tighter uppercase flex items-center justify-center gap-2.5 flex-wrap">
              {displayProfile.isVip ? (
                <span className={`
                  ${displayProfile.vipPlan === 'Bronze' ? 'text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]' : ''}
                  ${displayProfile.vipPlan === 'Prata' ? 'text-slate-300 drop-shadow-[0_0_10px_rgba(203,213,225,0.4)]' : ''}
                  ${displayProfile.vipPlan === 'Ouro' ? 'text-yellow-400 bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(234,179,8,0.6)]' : ''}
                  ${displayProfile.vipPlan === 'Diamante' ? 'bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(6,182,212,0.8)]' : ''}
                `}>
                  {displayProfile.displayName}
                </span>
              ) : (
                <span className="text-white">{displayProfile.displayName}</span>
              )}
              {displayProfile.isVip && (
                <button
                  onClick={() => setIsVipOpen(true)}
                  className="bg-gradient-to-r from-yellow-400 via-amber-500 to-rose-500 text-black text-[8.5px] font-black px-2.5 py-1 rounded-full hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(234,179,8,0.5)] cursor-pointer tracking-wider"
                  title="Benefícios VIP Ativos"
                >
                  👑 VIP {displayProfile.vipPlan || 'Membro'}
                </button>
              )}
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
          <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            {stats.map((stat) => {
              const hasAction = !!stat.action;
              return (
                <div 
                  key={stat.label} 
                  onClick={stat.action}
                  className={`premium-card p-6 flex flex-col items-center justify-center text-center ${
                    hasAction ? 'cursor-pointer active:scale-95 hover:border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.04)]' : ''
                  } transition-all`}
                >
                   <div className={`text-3xl font-black italic tracking-tighter mb-1 ${stat.color} filter drop-shadow-[0_0_10px_currentColor]`}>
                     {stat.value}
                   </div>
                   <div className="text-[10px] text-white/20 font-black uppercase tracking-widest italic flex items-center justify-center gap-1 leading-none select-none">
                     {stat.label} {hasAction && <span className="text-[8px] text-purple-400">➔</span>}
                   </div>
                </div>
              );
            })}
          </div>

          {/* Real-time Aura Cards - Grid layout */}
          <section className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            {/* Card A: Certificado / Prestígio de Aura */}
             {(() => {
               const auraPoints = displayProfile.aura || 0;
               const auraInfo = getAuraLevelInfo(auraPoints);
               const currentAuraLevel = auraInfo.level;
               
               return (
                  <div className="premium-card p-8 relative flex flex-col justify-between overflow-hidden group border border-purple-500/10 min-h-[300px]">
                     {/* Halo spinning visual */}
                     <div className="absolute -top-12 -right-12 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none group-hover:scale-150 transition-transform duration-700" />
                     <div className="absolute right-4 top-4 opacity-5 pointer-events-none">
                        <Sparkles size={80} className="text-purple-400 group-hover:rotate-12 transition-transform duration-700" />
                     </div>
                     
                     <div className="relative z-10">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-400 italic mb-2 block flex items-center gap-1.5">
                           <Sparkles size={11} className="text-pink-500/80" /> Certificado de Aura WeAura
                        </span>
                        <h3 className="text-3xl font-black text-white italic uppercase tracking-tight leading-tight mt-1">
                           {auraInfo.name}
                        </h3>
                        <p className="text-[11px] font-semibold text-white/40 mt-2 uppercase tracking-wider italic flex items-center gap-1">
                           Insígnia Ativa: <span className="text-purple-400 font-extrabold">{auraInfo.insignia}</span>
                        </p>
                     </div>

                     <div className="relative z-10 flex items-end justify-between mt-10">
                        <div className="text-left">
                           <span className="text-[9px] font-black uppercase tracking-widest text-white/30 block">Aura Acumulada</span>
                           <span className="text-4xl font-black italic tracking-tighter text-white filter drop-shadow-[0_0_15px_rgba(168,85,247,0.4)] flex items-center gap-1">
                              ✨ <span className="tabular-nums">{auraPoints.toLocaleString('pt-BR')}</span>
                           </span>
                        </div>
                        <div className={`p-4 rounded-[22px] border ${auraInfo.badgeBorder} ${auraInfo.badgeBg} flex items-center justify-center shrink-0`}>
                           <span className="text-2xl font-bold font-mono text-white">Lvl {currentAuraLevel}</span>
                        </div>
                     </div>
                  </div>
               );
             })()}

             {/* Card B: Progresso de Aura & Prerrogativas */}
             {(() => {
               const auraPoints = displayProfile.aura || 0;
               const auraInfo = getAuraLevelInfo(auraPoints);
               const minPoints = auraInfo.minAura;
               const maxPoints = auraInfo.maxAura || 50000;
               const targetDiff = maxPoints - minPoints;
               const earnedInLevel = auraPoints - minPoints;
               const auraProgressPct = Math.max(0, Math.min(100, targetDiff > 0 ? Math.floor((earnedInLevel / targetDiff) * 100) : 100));

               return (
                  <div className="premium-card p-8 relative flex flex-col justify-between overflow-hidden border border-white/[0.04] min-h-[300px]">
                     <div className="space-y-4">
                        <div className="flex justify-between items-center">
                           <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 italic">Aura Milestone</span>
                           <span className="text-xs font-black text-purple-400 font-mono tracking-tighter italic">
                              {auraPoints - minPoints} / {targetDiff} AURA ({auraProgressPct}%)
                           </span>
                        </div>
                        <div className="w-full h-3.5 bg-black rounded-full overflow-hidden p-0.5 border border-white/5">
                           <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${auraProgressPct}%` }}
                              className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-full shadow-[0_0_20px_rgba(168,85,247,0.6)]"
                           />
                        </div>
                     </div>

                     <div className="bg-black/40 border border-white/[0.03] p-4 rounded-2xl space-y-2 mt-4 flex-1 flex flex-col justify-center">
                        <h4 className="text-[9px] font-black text-white/30 uppercase tracking-widest italic flex items-center gap-1.5 mb-1.5">
                           <Unlock size={11} className="text-emerald-400" /> Prerrogativas do Nível
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-[10px] font-black text-white/60 text-left">
                           {auraInfo.benefits.slice(0, 4).map((b, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 truncate">
                                 <span className="text-emerald-400">✓</span> {b}
                              </div>
                           ))}
                           {auraInfo.benefits.length === 0 && (
                              <div className="col-span-2 text-white/35 italic">Benefícios de Prestígio Base</div>
                           )}
                        </div>
                     </div>
                  </div>
               );
             })()}
          </section>

          {/* Real-time Personal Ranking & Recent Visitors - Side-by-Side Flex/Grid layout */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
             {/* Ranking Pessoal - Carregado em tempo real */}
             <div className="premium-card p-8 border border-white/[0.04] flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
                <div className="flex-1 flex flex-col justify-between">
                   <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={16} className="text-amber-500" />
                        <h3 className="text-xs font-black text-white uppercase tracking-[0.25em] italic">Ranking Pessoal</h3>
                      </div>
                      <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 font-extrabold px-2 py-0.5 rounded-lg uppercase tracking-wider italic">
                         Global
                      </span>
                   </div>

                   {(() => {
                      const rankPos = leaderboard.findIndex(u => u.id === displayProfile.uid) + 1;
                      return (
                         <div className="text-left mt-2">
                            <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Sua Posição no Server</p>
                            <h2 className="text-4xl font-black italic tracking-tighter text-amber-500 leading-none mt-1.5 filter drop-shadow-[0_0_12px_rgba(245,158,11,0.35)] flex items-baseline gap-1.5">
                               #{rankPos > 0 ? rankPos : '100+'} 
                               <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest italic">entre {leaderboard.length || 100} membros</span>
                            </h2>
                         </div>
                      );
                   })()}

                   {/* Micro Podium of Top 3 */}
                   <div className="mt-6 border-t border-white/[0.04] pt-4 space-y-2.5">
                      <span className="text-[9px] font-black text-white/20 uppercase tracking-widest block mb-1 text-left">Topo do Servidor:</span>
                      {leaderboard.slice(0, 3).map((leadUser, idx) => (
                         <div key={leadUser.id || idx} className="flex items-center justify-between bg-white/[0.01] p-2 rounded-xl border border-white/[0.02]">
                            <div className="flex items-center gap-2">
                               <span className="text-xs font-black italic text-amber-400 w-4 text-left">{idx + 1}º</span>
                               <img 
                                  src={leadUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${leadUser.displayName}`} 
                                  alt="" 
                                  className="w-6 h-6 rounded-lg object-cover" 
                               />
                               <span className="text-[11px] font-bold text-white/80 max-w-[120px] truncate">{leadUser.displayName}</span>
                            </div>
                            <span className="text-[10px] font-black text-purple-400 italic">✨ {leadUser.aura || 0}</span>
                         </div>
                      ))}
                   </div>
                </div>
             </div>

             {/* Visitantes Recentes - Carregados em tempo real (onSnapshot) */}
             <div className="premium-card p-8 border border-white/[0.04] flex flex-col justify-between relative overflow-hidden">
                <div className="flex-1 flex flex-col justify-between">
                   <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                         <Eye size={16} className="text-cyan-400 animate-pulse" />
                         <h3 className="text-xs font-black text-white uppercase tracking-[0.25em] italic">Visitantes Recentes</h3>
                      </div>
                      <span className="text-[9px] font-semibold text-white/25 uppercase tracking-wider">
                         Live Sync
                      </span>
                   </div>

                   <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider mb-4 text-left">Navegaram pelo seu perfil:</p>

                   {recentVisitors.length === 0 ? (
                      <div className="bg-black/35 border border-white/[0.02] p-6 rounded-2xl text-center text-[10px] text-white/25 italic uppercase tracking-wider my-auto">
                         Nenhum visitante recente ainda.
                      </div>
                   ) : (
                      <div className="space-y-3">
                         {recentVisitors.map((visit) => (
                            <button 
                               key={visit.id}
                               onClick={() => {
                                  if (visit.visitorId) {
                                     navigate(`/profile/${visit.visitorId}`);
                                  }
                               }}
                               className="w-full flex items-center justify-between p-2.5 bg-white/[0.01] hover:bg-white/[0.04] border border-white/[0.02] rounded-2xl transition-all hover:scale-[1.01] cursor-pointer text-left group"
                            >
                               <div className="flex items-center gap-2">
                                  <img 
                                     src={visit.visitorPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${visit.visitorName}`} 
                                     alt="" 
                                     className="w-7 h-7 rounded-xl object-cover border border-white/10 group-hover:border-purple-500/20 transition-all" 
                                  />
                                  <div>
                                     <span className="text-[11px] font-extrabold text-white leading-none block group-hover:text-purple-400 transition-colors">{visit.visitorName}</span>
                                     <span className="text-[9px] font-semibold text-white/25 uppercase tracking-wide block mt-0.5">Membro Clã</span>
                                  </div>
                               </div>
                               <span className="text-[9px] font-bold text-white/30 italic mr-1">{formatTimeAgo(visit.visitedAt)}</span>
                            </button>
                         ))}
                      </div>
                   )}
                </div>
             </div>
          </div>

          {/* Conquistas (Achievements Live Grid) */}
          <section className="w-full space-y-6 mb-10">
             <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                   <Shield size={20} className="text-purple-500" />
                   <h3 className="text-lg font-black text-white italic uppercase tracking-tight">Conquistas</h3>
                </div>
                <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest italic">
                   {calculateAchievements().filter(a => a.unlocked).length} / {calculateAchievements().length} DESBLOQUEADAS
                </span>
             </div>
             
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {calculateAchievements().map((badge) => (
                  <button 
                     key={badge.id} 
                     onClick={() => setSelectedAchievement(badge)}
                     className={`flex flex-col items-center p-4 bg-[#080808] border rounded-[28px] transition-all hover:scale-105 cursor-pointer outline-none select-none text-center ${
                        badge.unlocked 
                           ? `border-[#8A2EFF]/25 shadow-[0_5px_15px_rgba(138,46,255,0.06)] opacity-100` 
                           : 'border-white/[0.03] opacity-45 hover:opacity-75'
                     }`}
                  >
                     <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-3 ${badge.bgIconColor} border border-white/[0.04]`}>
                        {badge.icon}
                     </div>
                     <span className="text-xs font-black text-white uppercase italic tracking-tighter truncate max-w-full px-1">{badge.name}</span>
                     
                     {/* Micro progress bar */}
                     <div className="w-full h-1 bg-black rounded-full overflow-hidden mt-3 max-w-[80px] mx-auto">
                        <div 
                           className={`h-full rounded-full ${badge.unlocked ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-white/10'}`} 
                           style={{ width: `${Math.min(100, Math.floor((badge.progress / badge.maxProgress) * 100))}%` }}
                        />
                     </div>
                  </button>
                ))}
             </div>
          </section>

          {/* Dynamic Achievement Details Modal popup */}
          <AnimatePresence>
             {selectedAchievement && (
                <>
                   <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setSelectedAchievement(null)}
                      className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[90]"
                   />
                   <motion.div
                      initial={{ scale: 0.95, opacity: 0, y: 20 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.95, opacity: 0, y: 20 }}
                      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm p-6 bg-[#0c0c0c] border border-white/5 rounded-[36px] z-[100] outline-none text-center"
                   >
                      <button 
                         onClick={() => setSelectedAchievement(null)}
                         className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-white/30 hover:text-white transition-all scale-95"
                      >
                         <X size={16} />
                      </button>

                      <div className="w-20 h-20 mx-auto rounded-[24px] bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-5xl mb-4 animate-pulse">
                         {selectedAchievement.icon}
                      </div>

                      <span className={`inline-block text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg italic mb-2 ${
                         selectedAchievement.unlocked ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-white/30 border border-white/5'
                      }`}>
                         {selectedAchievement.unlocked ? '❖ DESBLOQUEADA' : '❖ BLOQUEADA'}
                      </span>

                      <h3 className="text-xl font-black text-white italic uppercase tracking-tight mt-1">{selectedAchievement.name}</h3>
                      <p className="text-xs font-semibold text-white/50 mt-3 px-3 leading-relaxed">{selectedAchievement.description}</p>

                      {/* Progression details */}
                      <div className="mt-6 border-t border-white/[0.04] pt-5 space-y-2">
                         <div className="flex justify-between items-center text-[10px] font-black text-white/40 uppercase tracking-wide">
                            <span>Progresso Atual</span>
                            <span>{selectedAchievement.progress.toLocaleString()} / {selectedAchievement.maxProgress.toLocaleString()}</span>
                         </div>
                         <div className="w-full h-2.5 bg-black rounded-full overflow-hidden p-0.5 border border-white/5">
                            <div 
                               className="h-full rounded-full bg-gradient-to-r from-[#8A2EFF] via-[#FF4D9D] to-blue-500"
                               style={{ width: `${Math.min(100, Math.floor((selectedAchievement.progress / selectedAchievement.maxProgress) * 100))}%` }}
                            />
                         </div>
                      </div>

                      <button 
                         onClick={() => setSelectedAchievement(null)}
                         className="w-full mt-6 py-3 bg-white/5 border border-white/5 hover:bg-white/10 rounded-2xl text-xs font-black text-white uppercase tracking-wider italic transition-all hover:scale-102"
                      >
                         Entendido
                      </button>
                   </motion.div>
                </>
             )}
          </AnimatePresence>

          {/* Dynamic Medal Details Modal popup */}
          <AnimatePresence>
             {selectedMedal && (
                <>
                   <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setSelectedMedal(null)}
                      className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[90]"
                   />
                   <motion.div
                      initial={{ scale: 0.95, opacity: 0, y: 20 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.95, opacity: 0, y: 20 }}
                      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm p-7 bg-[#0c0c0c] border border-white/5 rounded-[36px] z-[100] outline-none text-center shadow-2xl"
                   >
                      <button 
                         onClick={() => setSelectedMedal(null)}
                         className="absolute top-4 right-4 p-2.5 bg-white/5 rounded-full text-white/30 hover:text-white transition-all scale-95"
                      >
                         <X size={16} />
                      </button>

                      <div className={`w-24 h-24 mx-auto rounded-[28px] bg-black/80 border border-white/10 flex items-center justify-center text-6xl mb-5 shadow-lg ${selectedMedal.unlocked ? selectedMedal.glowColor : ''}`}>
                         {selectedMedal.icon}
                      </div>

                      <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl italic mb-3 ${
                         selectedMedal.unlocked 
                           ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.1)]' 
                           : 'bg-white/5 text-white/30 border border-white/5'
                      }`}>
                         {selectedMedal.unlocked ? '❖ MEDALHA CONQUISTADA' : '❖ MEDALHA BLOQUEADA'}
                      </span>

                      <h3 className="text-xl font-black text-white italic uppercase tracking-tight mt-1 leading-tight">{selectedMedal.name}</h3>
                      <p className="text-xs font-semibold text-white/50 mt-3.5 px-3 leading-relaxed">{selectedMedal.description}</p>

                      {/* Progression details */}
                      <div className="mt-6 border-t border-white/[0.04] pt-5">
                         <div className="flex justify-between items-center text-[10px] font-mono font-black text-purple-400 uppercase tracking-widest">
                            <span>Status ou Requisito</span>
                            <span className="text-white/60">{selectedMedal.progressText}</span>
                          </div>
                       </div>

                       <button 
                          onClick={() => setSelectedMedal(null)}
                          className="w-full mt-7 py-3.5 bg-white text-black hover:bg-neutral-200 rounded-xl text-xs font-black uppercase tracking-wider italic transition-all active:scale-95 shadow-lg shadow-white/5"
                       >
                          Retornar ao Mural
                       </button>
                    </motion.div>
                 </>
              )}
           </AnimatePresence>

           {/* Vertical Navigation Options List */}
          {isMyProfile && (
            <motion.section 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full space-y-6 mb-10"
            >
              <div className="flex items-center gap-3 px-2">
                 <Settings size={20} className="text-purple-500" />
                 <h3 className="text-lg font-black text-white italic uppercase tracking-tight">Painel de Utilidades WeAura</h3>
              </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { label: 'Momentos', desc: 'Stories temporários de 24h', icon: Clock, color: 'text-purple-400 border-purple-500/20 bg-purple-500/5', action: () => setIsMomentsOpen(true) },
                    { label: 'Status Ativo', desc: 'Sua mensagem & humor ativo', icon: Smile, color: 'text-rose-400 border-rose-500/20 bg-rose-500/5', action: () => setIsStatusOpen(true) },
                    { label: 'Visitantes Recentes', desc: 'Quem andou visitando seu perfil', icon: Users, color: 'text-blue-400 border-blue-500/20 bg-blue-500/5', action: () => setIsVisitorsOpen(true) },
                    { label: 'Convidar Amigos', desc: 'Indique amigos e fature moedas', icon: Gift, color: 'text-pink-400 border-pink-500/20 bg-pink-500/5', action: () => setIsInviteOpen(true) },
                    { label: 'Grau de Nobreza', desc: 'Confira sua influência no clã', icon: Crown, color: 'text-amber-400 border-amber-500/20 bg-amber-500/5', action: () => setIsNobilityOpen(true) },
                    { label: 'Centro de Segurança', desc: 'Proteção 2FA, SMS & Aparelhos', icon: ShieldAlert, color: 'text-green-400 border-green-500/20 bg-green-500/5', action: () => setIsSecurityOpen(true) },
                    { label: 'Tópicos de Contribuição', desc: 'Deixe feedbacks e colabore', icon: MessageSquareText, color: 'text-cyan-400 border-cyan-500/20 bg-cyan-500/5', action: () => setIsFeedbackOpen(true) },
                    { label: 'Controle Parental', desc: 'Limite de chat e bloqueios', icon: HeartHandshake, color: 'text-red-400 border-red-500/20 bg-red-500/5', action: () => setIsParentalOpen(true) },
                    { label: 'Central de Ajuda WeAura', desc: 'Guia de XP, Moedas e Regras', icon: HelpCircle, color: 'text-zinc-400 border-zinc-500/20 bg-zinc-500/5', action: () => setIsHelpOpen(true) },
                  ].map((opt, i) => {
                     const Icon = opt.icon;
                     return (
                        <button
                          key={i}
                          onClick={opt.action}
                          className="flex items-center justify-between p-5 bg-[#0c0c0c] border border-white/[0.04] hover:border-purple-500/30 transition-all rounded-[24px] text-left group"
                        >
                           <div className="flex items-center gap-4 min-w-0">
                              <div className={`w-12 h-12 rounded-2xl border ${opt.color} flex items-center justify-center shrink-0`}>
                                 <Icon size={20} />
                              </div>
                              <div className="truncate">
                                 <h4 className="text-sm font-black text-white uppercase italic tracking-wide group-hover:text-purple-400 transition-colors">{opt.label}</h4>
                                 <p className="text-[9px] font-bold text-white/35 uppercase tracking-widest mt-1 truncate">{opt.desc}</p>
                              </div>
                           </div>
                           <ChevronRight size={16} className="text-white/20 group-hover:text-white transition-colors shrink-0" />
                        </button>
                     );
                  })}
               </div>
            </motion.section>
          )}

          {/* Medalhas de Honra (Gold/Silver Badge Wall) */}
          <section className="w-full space-y-6 mb-10">
             <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                   <Trophy size={20} className="text-amber-500" />
                   <h3 className="text-lg font-black text-white italic uppercase tracking-tight">Medalhas de Honra</h3>
                </div>
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest italic animate-pulse">
                   {calculateMedals().filter(m => m.unlocked).length} / {calculateMedals().length} Desbloqueadas
                </span>
             </div>

             <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {calculateMedals().map((med) => (
                  <button 
                     key={med.id}
                     onClick={() => setSelectedMedal(med)}
                     className={`flex flex-col items-center justify-center p-5 rounded-[32px] border transition-all hover:scale-105 cursor-pointer outline-none select-none text-center relative overflow-hidden group hover:brightness-125 ${
                        med.unlocked 
                           ? `border-white/10 ${med.glowColor} ${med.borderColor}` 
                           : 'border-white/[0.02] bg-[#060606] opacity-35 hover:opacity-60'
                     }`}
                  >
                     <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center text-4xl mb-4 bg-black/60 border border-white/5 shadow-inner`}>
                        {med.icon}
                     </div>
                     
                     <h4 className="text-xs font-black text-white uppercase italic tracking-tighter truncate max-w-full px-1">{med.name}</h4>
                     
                     <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md mt-2 ${
                        med.rarity === 'Lendário' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.15)]' :
                        med.rarity === 'Épico' ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20 shadow-[0_0_8px_rgba(236,72,153,0.15)]' :
                        'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                     }`}>
                        {med.rarity}
                     </span>
                  </button>
                ))}
             </div>
          </section>

          {/* Histórico de Atividades (Real-time Timeline) */}
          <section className="w-full space-y-6 mb-10">
             <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                   <Clock size={20} className="text-purple-500" />
                   <h3 className="text-lg font-black text-white italic uppercase tracking-tight">Histórico de Atividades</h3>
                </div>
                <span className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none">
                   Stream de Eventos
                </span>
             </div>

             {loadingGames ? (
                <div className="premium-card p-12 text-center flex justify-center items-center gap-2 text-white/40">
                  <RefreshCw size={20} className="animate-spin text-purple-500" />
                  <span>Sincronizando atividades do clã...</span>
                </div>
             ) : getActivityTimeline().length === 0 ? (
                <div className="premium-card p-12 text-center text-white/20 italic text-sm">
                   Nenhum registro de atividade recente encontrado.
                </div>
             ) : (
                <div className="space-y-4">
                   <div className="relative pl-6 border-l border-white/5 space-y-6 ml-4">
                      {getActivityTimeline().slice(0, visibleActivitiesCount).map((act) => {
                         const dateObj = new Date(act.time);
                         const dateString = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + ' às ' + dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                         
                         return (
                            <div key={act.id} className="relative group">
                               {/* Dot Indicator */}
                               <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-black border-2 border-purple-500 flex items-center justify-center text-[9px] filter drop-shadow-[0_0_6px_#a855f7]">
                                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400 group-hover:scale-125 transition-transform" />
                               </div>
                               
                               <div className="premium-card p-4 flex items-start sm:items-center justify-between gap-4 bg-[#080808]/40 border-white/[0.03] hover:border-purple-500/25 transition-all">
                                  <div className="flex items-center gap-3.5 min-w-0">
                                     <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 border border-white/5 ${act.color}`}>
                                        {act.icon}
                                     </div>
                                     <div className="min-w-0">
                                        <h4 className="text-xs font-black text-white uppercase italic tracking-wide group-hover:text-purple-400 transition-colors">{act.title}</h4>
                                        <p className="text-[11px] font-semibold text-white/50 leading-relaxed mt-0.5">{act.desc}</p>
                                        <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest block mt-1.5 flex items-center gap-1.5">
                                           <Calendar size={10} /> {dateString}
                                        </span>
                                     </div>
                                  </div>
                                  
                                  {act.xpBadge && (
                                     <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/25 text-purple-400 font-mono text-[9px] font-black uppercase rounded-lg tracking-widest shrink-0 self-start sm:self-center">
                                        {act.xpBadge}
                                     </span>
                                  )}
                               </div>
                            </div>
                         );
                      })}
                   </div>

                   {/* Pagination button */}
                   {getActivityTimeline().length > visibleActivitiesCount && (
                      <div className="flex justify-center pt-2">
                         <button 
                            type="button"
                            onClick={() => setVisibleActivitiesCount(prev => prev + 5)}
                            className="px-6 py-3 bg-[#0a0a0a] border border-white/5 hover:border-purple-500/30 text-white font-black uppercase tracking-widest text-[9px] rounded-xl cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
                         >
                            <RefreshCw size={12} /> Carregar Mais Atividades
                         </button>
                      </div>
                   )}
                </div>
             )}
          </section>

          {/* Virtual Gifts Chest Received Gallery */}
          <section className="w-full space-y-6 mb-10">
            <div className="flex items-center justify-between px-2">
               <div className="flex items-center gap-3">
                  <Gift size={20} className="text-pink-500" />
                  <h3 className="text-lg font-black text-white italic uppercase tracking-tight">Estojo de Presentes Recebidos</h3>
               </div>
               <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                 {receivedGifts.reduce((acc: number, t: any) => acc + (t.quantity || 1), 0)} Recebidos
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
                    acc[t.giftId] = (acc[t.giftId] || 0) + (t.quantity || 1);
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
                                // Live listener automatically updates the UI
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
                <div className={`grid ${myProfile?.photoURL ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-2.5 bg-white/5 border border-white/5 rounded-2xl p-4 text-white hover:bg-white/10 transition-all group"
                  >
                    <Camera size={20} className="text-purple-400 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Galeria</span>
                  </button>
                  <button 
                    type="button"
                    onClick={regenerateAvatar}
                    className="flex flex-col items-center justify-center gap-2.5 bg-white/5 border border-white/5 rounded-2xl p-4 text-white hover:bg-white/10 transition-all group"
                  >
                    <RefreshCw size={20} className="text-blue-400 group-hover:rotate-180 transition-all duration-500" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Gerar</span>
                  </button>
                  {myProfile?.photoURL && (
                    <button 
                      type="button"
                      onClick={async () => {
                        if (window.confirm("Deseja realmente excluir sua foto de perfil e voltar ao padrão?")) {
                          try {
                            await updateProfile({ photoURL: "" });
                            success("Foto de perfil excluída!");
                          } catch (e) {
                            toastError("Erro ao excluir a foto de perfil.");
                          }
                        }
                      }}
                      className="flex flex-col items-center justify-center gap-2.5 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-400 hover:bg-red-500/20 transition-all group cursor-pointer"
                    >
                      <Trash2 size={20} className="text-red-400 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">Excluir</span>
                    </button>
                  )}
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

      {/* Render All Secondary Functional Drawers */}
      {displayProfile && (
        <NetworkDrawer 
           isOpen={isNetworkOpen} 
           onClose={() => setIsNetworkOpen(false)} 
           userId={displayProfile.uid} 
           initialTab={networkInitialTab} 
        />
      )}
      <VIPDrawer isOpen={isVipOpen} onClose={() => setIsVipOpen(false)} />
      <MomentsDrawer isOpen={isMomentsOpen} onClose={() => setIsMomentsOpen(false)} />
      <StatusDrawer isOpen={isStatusOpen} onClose={() => setIsStatusOpen(false)} />
      <VisitorsDrawer isOpen={isVisitorsOpen} onClose={() => setIsVisitorsOpen(false)} />
      <InviteFriendsDrawer isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} />
      <NobilityDrawer isOpen={isNobilityOpen} onClose={() => setIsNobilityOpen(false)} />
      <SecurityCenterDrawer isOpen={isSecurityOpen} onClose={() => setIsSecurityOpen(false)} />

      {/* Contribution Feedback Popup */}
      <AnimatePresence>
         {isFeedbackOpen && (
            <>
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsFeedbackOpen(false)} className="fixed inset-0 bg-black/90 backdrop-blur-md z-[80]" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0c0c0c] border border-white/5 p-8 rounded-[36px] w-[90vw] max-w-md z-[90] shadow-2xl space-y-6">
                  <div className="flex justify-between items-start">
                     <div>
                        <span className="text-[9px] font-black tracking-widest text-[#00F0FF] uppercase block">Colabore com a Aurora</span>
                        <h4 className="text-xl font-black text-white uppercase italic tracking-tight flex items-center gap-2 mt-1">
                           <MessageSquareText size={20} className="text-[#00F0FF]" /> Sugestão de Melhoria
                        </h4>
                     </div>
                     <button onClick={() => setIsFeedbackOpen(false)} className="p-2 bg-white/5 rounded-xl text-white/40"><X size={16} /></button>
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed font-semibold">Deixe sua opinião, relate breves bugs ou sugira recursos para a equipe de devs do WeAura!</p>
                  <textarea
                     rows={4}
                     value={feedbackText}
                     onChange={(e) => setFeedbackText(e.target.value)}
                     placeholder="Escreva sua contribuição construtiva..."
                     className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-xs font-semibold text-white focus:border-[#00F0FF]/25 outline-none resize-none"
                  />
                  <button
                     onClick={async () => {
                        if (!feedbackText.trim()) return;
                        try {
                           const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
                           await addDoc(collection(db, 'contributions'), {
                              userId: user.uid,
                              userName: myProfile?.displayName || 'Membro WeAura',
                              text: feedbackText.trim(),
                              createdAt: serverTimestamp()
                           });
                           success("Contribuição enviada com sucesso! Obrigado por ajudar a otimizar o WeAura!");
                           setFeedbackText('');
                           setIsFeedbackOpen(false);
                        } catch(e) {
                           toastError("Houve um erro ao registrar feedback.");
                        }
                     }}
                     className="w-full bg-[#00F0FF] hover:bg-[#00f0ff]/95 text-black font-black uppercase tracking-widest py-4 rounded-xl text-[10px] active:scale-95 transition-all"
                  >
                     Enviar Contribuição Especial
                  </button>
               </motion.div>
            </>
         )}
      </AnimatePresence>

      {/* Parental Control Pin Toggle */}
      <AnimatePresence>
         {isParentalOpen && (
            <>
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsParentalOpen(false)} className="fixed inset-0 bg-black/90 backdrop-blur-md z-[80]" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0c0c0c] border border-white/5 p-8 rounded-[36px] w-[90vw] max-w-md z-[90] shadow-2xl space-y-6">
                  <div className="flex justify-between items-start">
                     <div>
                        <span className="text-[9px] font-black tracking-widest text-red-500 uppercase block">Ambiente Saudável</span>
                        <h4 className="text-xl font-black text-white uppercase italic tracking-tight flex items-center gap-2 mt-1">
                           <HeartHandshake size={20} className="text-red-500" /> Controle Parental
                        </h4>
                     </div>
                     <button onClick={() => setIsParentalOpen(false)} className="p-2 bg-white/5 rounded-xl text-white/40"><X size={16} /></button>
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed font-semibold">Ative filtros de conversação agressivos e oculte salas com limite de idade utilizando sua senha PIN pessoal de 4 dígitos.</p>
                  
                  <div className="space-y-4">
                     <div className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-2xl">
                        <span className="text-xs font-black text-white uppercase">Modo Seguro WeAura</span>
                        <button
                           onClick={() => setParentalEnabled(!parentalEnabled)}
                           className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${parentalEnabled ? 'bg-red-500 text-black' : 'bg-white/5 text-white/40 border border-white/5'}`}
                        >
                           {parentalEnabled ? 'ATIVO' : 'DESATIVADO'}
                        </button>
                     </div>
                     <div className="space-y-2">
                        <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest ml-1">Senha PIN de Controle</span>
                        <input
                           type="password"
                           maxLength={4}
                           value={parentalPin}
                           onChange={(e) => setParentalPin(e.target.value.replace(/\D/g, ''))}
                           placeholder="Ex: 1234"
                           className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-xs font-semibold text-white tracking-[1em] text-center focus:border-red-500/25 outline-none"
                        />
                     </div>
                  </div>

                  <button
                     onClick={async () => {
                        if (parentalPin.length !== 4) {
                           toastError("O PIN de segurança deve ter exatamente 4 dígitos!");
                           return;
                        }
                        try {
                           await updateProfile({
                              parentalEnabled,
                              parentalPin
                           });
                           success(`Controle parental atualizado! Filtros ativos: ${parentalEnabled ? 'LIGADOS' : 'DESLIGADOS'}.`);
                           setIsParentalOpen(false);
                        } catch(e) {
                           toastError("Houve um erro ao aplicar configurações parentais.");
                        }
                     }}
                     className="w-full bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest py-4 rounded-xl text-[10px] active:scale-95 transition-all shadow-[0_10px_20px_rgba(220,38,38,0.2)]"
                  >
                     Salvar Proteção
                  </button>
               </motion.div>
            </>
         )}
      </AnimatePresence>

      {/* Help Center Guide Modal */}
      <AnimatePresence>
         {isHelpOpen && (
            <>
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsHelpOpen(false)} className="fixed inset-0 bg-black/90 backdrop-blur-md z-[80]" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0c0c0c] border border-white/5 p-8 rounded-[36px] w-[95vw] max-w-lg z-[90] shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto">
                  <div className="flex justify-between items-start">
                     <div>
                        <span className="text-[9px] font-black tracking-widest text-zinc-500 uppercase block">Central de Regras & Guias</span>
                        <h4 className="text-xl font-black text-white uppercase italic tracking-tight flex items-center gap-2 mt-1">
                           <HelpCircle size={20} className="text-zinc-500" /> CENTRAL DE AJUDA WEAURA
                        </h4>
                     </div>
                     <button onClick={() => setIsHelpOpen(false)} className="p-2 bg-white/5 rounded-xl text-white/40"><X size={16} /></button>
                  </div>

                  <div className="space-y-4 pt-2">
                     <div className="border-b border-white/5 pb-4 space-y-1.5">
                        <h5 className="text-xs font-black text-purple-400 uppercase tracking-widest italic">Como ganhar XP e subir de nível?</h5>
                        <p className="text-[11px] text-white/60 leading-relaxed font-semibold">Toda atividade em salas de voz confere XP passivo a cada 2 minutos. Enviar presentes especiais a amigos rende grandes quantidades de XP de prestígio instantâneo!</p>
                     </div>

                     <div className="border-b border-white/5 pb-4 space-y-1.5">
                        <h5 className="text-xs font-black text-yellow-400 uppercase tracking-widest italic">O que são as EGO Coins?</h5>
                        <p className="text-[11px] text-white/60 leading-relaxed font-semibold font-sans">Moedas do mercado para comprar cosméticos luxuosos, rastros de perfil, novos balões de chat e habilitar pacotes VIP.</p>
                     </div>

                     <div className="border-b border-white/5 pb-4 space-y-1.5">
                        <h5 className="text-xs font-black text-rose-500 uppercase tracking-widest italic">Termos de Conduta Básica</h5>
                        <p className="text-[11px] text-white/60 leading-relaxed font-semibold">Pedimos tolerância e respeito em canais de voz pública. Racismo, discursos de ódio ou assédio resultarão em banimento imediato e irreversível.</p>
                     </div>
                  </div>

                  <button
                     onClick={() => setIsHelpOpen(false)}
                     className="w-full bg-white text-black font-black uppercase tracking-widest py-4 rounded-xl text-[10px] active:scale-95 transition-all mt-4"
                  >
                     Entendido, retornar
                  </button>
               </motion.div>
            </>
         )}
      </AnimatePresence>
    </motion.div>
  );
}

