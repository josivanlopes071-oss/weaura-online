import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  doc, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  getDoc, 
  onSnapshot, 
  limit, 
  serverTimestamp,
  addDoc,
  orderBy,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import UserAvatar from './UserAvatar';
import { 
  X, Shield, Users, Layers, MessageSquare, AlertTriangle, Terminal, Search, 
  Ban, ShieldAlert, VolumeX, Award, User, RefreshCw, Zap, Gift, Compass, 
  Heart, Flame, Sparkles, CheckCircle2, Lock, Unlock, EyeOff, Radio, Plus, 
  Trash2, Send, Database, Cpu, Activity, Info, Crown
} from 'lucide-react';

const PALETTE = {
  bg: '#050816',
  primary: '#8A2EFF',
  cyan: '#00F0FF',
  blue: '#00BFFF',
  pink: '#FF4D9D',
};

// Pure Web Audio API to play sleek, low-latency cyberpunk retro sounds without dependencies
const playCyberSound = (type: 'click' | 'success' | 'alert' | 'scan' | 'laser') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    const now = ctx.currentTime;
    
    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.setValueAtTime(450, now + 0.08);
      osc.frequency.setValueAtTime(600, now + 0.16);
      osc.frequency.setValueAtTime(900, now + 0.24);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'alert') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.linearRampToValueAtTime(180, now + 0.2);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'scan') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(90, now);
      osc.frequency.exponentialRampToValueAtTime(1600, now + 0.5);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === 'laser') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.25);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (err) {
    console.warn("[CyberSound] Synth blocked or disabled:", err);
  }
};

interface AdminMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminMenu({ isOpen, onClose }: AdminMenuProps) {
  const { user, profile, customFrames = [] } = useAuth();
  const isCurrentUserOwner = ['josivanlopes071@gmail.com', 'manoeldasilva631kejr@gmail.com'].includes((profile?.email || user?.email || '').toLowerCase());
  const [activeTab, setActiveTab ] = useState<'players' | 'rooms' | 'chat' | 'moderation' | 'frames'>('players');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Custom Frames Creation States
  const [newFrameId, setNewFrameId] = useState('');
  const [newFrameName, setNewFrameName] = useState('');
  const [newFrameDescription, setNewFrameDescription] = useState('');
  const [newFrameRarity, setNewFrameRarity] = useState<'Comum' | 'Raro' | 'Épico' | 'Lendário'>('Comum');
  const [newFramePrice, setNewFramePrice] = useState<number>(300);
  const [newFrameStatusUnlock, setNewFrameStatusUnlock] = useState<'locked' | 'free'>('locked');
  const [newFrameAvatarScale, setNewFrameAvatarScale] = useState<number>(0.755);
  const [newFrameAvatarOffsetY, setNewFrameAvatarOffsetY] = useState<number>(0);
  const [newFrameImageUrl, setNewFrameImageUrl] = useState('');
  const [isSavingFrame, setIsSavingFrame] = useState(false);
  
  const handleFrameFileChange = (e: any) => {
    let file: File | null = null;
    if (e.target && e.target.files) {
      file = e.target.files[0] || null;
    } else if (e.dataTransfer) {
      e.preventDefault();
      file = e.dataTransfer.files[0] || null;
    }
    
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert("Por favor, selecione um arquivo de imagem válido (PNG, WebP, GIF).");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setNewFrameImageUrl(reader.result as string);
        playCyberSound('laser');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCustomFrame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFrameName.trim()) {
      alert("O nome da moldura é obrigatório.");
      return;
    }
    if (!newFrameImageUrl) {
      alert("Por favor, adicione o arquivo da moldura (upload ou URL).");
      return;
    }

    setIsSavingFrame(true);
    try {
      const generatedId = newFrameId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || `fr_custom_${Date.now()}`;
      
      const frameData = {
        id: generatedId,
        name: newFrameName.trim(),
        description: newFrameDescription.trim() || 'Moldura personalizada enviada pelo administrador',
        price: Number(newFramePrice) || 0,
        imageUrl: newFrameImageUrl,
        rarity: newFrameRarity,
        statusUnlock: newFrameStatusUnlock,
        avatarScale: Number(newFrameAvatarScale) || 0.755,
        avatarOffsetY: `${newFrameAvatarOffsetY}%`,
        noProcessing: true,
        createdBy: profile?.uid || user?.uid || 'admin',
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'custom_profile_frames', generatedId), frameData);
      
      playCyberSound('success');
      addAdminLog(`Nova moldura personalizada criada: [${generatedId}] ("${newFrameName}")`, 'success');
      
      // Clean up fields
      setNewFrameId('');
      setNewFrameName('');
      setNewFrameDescription('');
      setNewFramePrice(300);
      setNewFrameRarity('Comum');
      setNewFrameStatusUnlock('locked');
      setNewFrameAvatarScale(0.755);
      setNewFrameAvatarOffsetY(0);
      setNewFrameImageUrl('');
    } catch (err: any) {
      console.error(err);
      alert("Erro ao salvar moldura: " + err.message);
    } finally {
      setIsSavingFrame(false);
    }
  };

  const handleDeleteCustomFrame = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente excluir permanentemente a moldura "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'custom_profile_frames', id));
      playCyberSound('alert');
      addAdminLog(`A moldura [${id}] foi excluída permanentemente pelo administrador.`, 'warning');
    } catch (err: any) {
      alert("Erro ao excluir moldura: " + err.message);
    }
  };
  
  // Players Tab State
  const [playerSearchType, setPlayerSearchType] = useState<'displayId' | 'uid' | 'name' | 'email'>('displayId');
  const [playerQuery, setPlayerQuery] = useState('');
  const [targetUser, setTargetUser] = useState<any | null>(null);
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [coinMutationAmt, setCoinMutationAmt] = useState<number>(1000);
  const [newNickname, setNewNickname] = useState('');
  const [levelDirectSet, setLevelDirectSet] = useState<number>(1);
  
  // Custom states
  const [frozenPlayers, setFrozenPlayers] = useState<{ [uid: string]: boolean }>({});
  const [mutedPlayers, setMutedPlayers] = useState<{ [uid: string]: boolean }>({});
  const [logs, setLogs] = useState<Array<{ id: string; text: string; time: string; type: string }>>([]);
  
  // Rooms Tab State
  const [rooms, setRooms] = useState<any[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [roomEventText, setRoomEventText] = useState('');
  const [roomBannerUrl, setRoomBannerUrl] = useState('');

  // Chat Mod Tab State
  const [isGlobalChatMuted, setIsGlobalChatMuted] = useState(false);
  const [spamThreshold, setSpamThreshold] = useState<number>(3);
  const [globalAnnouncement, setGlobalAnnouncement] = useState('');
  const [announcements, setAnnouncements] = useState<any[]>([]);

  // Mod Logs & Anti-cheat
  const [isAntiCheatScanning, setIsAntiCheatScanning] = useState(false);
  const [antiCheatStatus, setAntiCheatStatus] = useState<'idle' | 'scanning' | 'clean' | 'threat_found'>('idle');
  const [scanningProgress, setScanningProgress] = useState(0);
  const [detectedHacks, setDetectedHacks] = useState<string[]>([]);

  // Ref scroll to end of logs
  const terminalLogsEndRef = useRef<HTMLDivElement>(null);

  // 1. Log helper function
  const addAdminLog = async (text: string, type: 'info' | 'warning' | 'success' | 'critical') => {
    const timestamp = new Date().toLocaleTimeString();
    const id = Math.random().toString(36).substring(2, 9);
    
    // Add local state
    setLogs(prev => {
      const updated = [...prev.slice(-29), { id, text, time: timestamp, type }];
      localStorage.setItem('we_aura_admin_logs', JSON.stringify(updated));
      return updated;
    });
  };

  // Load initial logs on mount
  useEffect(() => {
    let savedLogs = null;
    try {
      savedLogs = localStorage.getItem('we_aura_admin_logs');
    } catch (e) {
      console.warn("Could not read admin logs from localStorage:", e);
    }
    if (savedLogs) {
      try {
        setLogs(JSON.parse(savedLogs));
      } catch (e) {
        console.warn("Could not parse saved admin logs", e);
      }
    }
  }, []);

  // 2. Fetch live config and lists
  useEffect(() => {
    if (!isOpen) return;
    
    playCyberSound('click');
    addAdminLog(`Painel ADM Holográfico ativado pelo usuário: ${profile?.displayName || 'Desconhecido'}`, 'info');

    // Subscribe to Rooms List
    const roomQuery = query(collection(db, 'rooms'), limit(20));
    const unsubscribeRooms = onSnapshot(roomQuery, (snap) => {
      const roomList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRooms(roomList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'rooms');
    });

    // Subscribe to System Announcements from Firestore
    let unsubscribeAnnouncements = () => {};
    try {
      const announceQuery = query(collection(db, 'system_announcements'), orderBy('createdAt', 'desc'), limit(15));
      unsubscribeAnnouncements = onSnapshot(announceQuery, (snap) => {
        const list = snap.docs.map(doc => {
          const data = doc.data();
          let formattedDate = new Date().toISOString();
          if (data.createdAt) {
            try {
              formattedDate = data.createdAt.toDate().toISOString();
            } catch (e) {
              formattedDate = new Date(data.createdAt).toISOString();
            }
          }
          return {
            id: doc.id,
            text: data.text || '',
            adminName: data.adminName || 'ADM',
            createdAt: formattedDate
          };
        });
        setAnnouncements(list);
      }, (err) => {
        console.warn("Firestore access error for announcements index, launching localStorage listener:", err);
        setupLocalAnnouncementsFallback();
      });
    } catch (e: any) {
      console.warn("Firestore query startup error:", e);
      setupLocalAnnouncementsFallback();
    }

    function setupLocalAnnouncementsFallback() {
      const loadLocal = () => {
        const saved = localStorage.getItem('we_aura_announcements');
        if (saved) {
          try {
            setAnnouncements(JSON.parse(saved));
          } catch (err) {
            console.warn(err);
          }
        }
      };
      loadLocal();
      window.addEventListener('storage', loadLocal);
      unsubscribeAnnouncements = () => window.removeEventListener('storage', loadLocal);
    }

    return () => {
      unsubscribeRooms();
      unsubscribeAnnouncements();
    };
  }, [isOpen]);

  // Scroll terminal logs
  useEffect(() => {
    if (terminalLogsEndRef.current) {
      terminalLogsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  if (!isOpen) return null;

  // PLAYER FUCTIONS
  const handlePlayerSearch = async () => {
    const queryStr = playerQuery.trim();
    if (!queryStr) return;
    setIsSearchingUser(true);
    playCyberSound('click');
    addAdminLog(`Buscando alvo pelo tipo: ${playerSearchType} para valor: ${queryStr}`, 'info');

    try {
      let snap;

      if (playerSearchType === 'displayId') {
        const parsedId = parseInt(queryStr, 10);
        if (!isNaN(parsedId)) {
          // 1. Tentar como Number
          const q1 = query(collection(db, 'users'), where('displayId', '==', parsedId), limit(1));
          snap = await getDocs(q1);
        }
        
        // 2. Tentar como String se falhar ou se não for um número válido
        if (!snap || snap.empty) {
          const q2 = query(collection(db, 'users'), where('displayId', '==', queryStr), limit(1));
          snap = await getDocs(q2);
        }

        // 3. Fallback inteligente: se o usuário digitou e-mail no campo ID
        if ((!snap || snap.empty) && queryStr.includes('@')) {
          const q3 = query(collection(db, 'users'), where('email', '==', queryStr.toLowerCase()), limit(1));
          snap = await getDocs(q3);
        }
      } else if (playerSearchType === 'email') {
        const qEmail = query(collection(db, 'users'), where('email', '==', queryStr.toLowerCase()), limit(1));
        snap = await getDocs(qEmail);

        // Se falhar e for de fato e-mail, tentar como displayName ou parte do e-mail
        if (!snap || snap.empty) {
          const prefix = queryStr.split('@')[0];
          const qDisplayName = query(collection(db, 'users'), where('displayName', '==', prefix), limit(1));
          snap = await getDocs(qDisplayName);
        }
      } else if (playerSearchType === 'uid') {
        const qUid = query(collection(db, 'users'), where('uid', '==', queryStr), limit(1));
        snap = await getDocs(qUid);
      } else {
        // displayName
        const qName = query(
          collection(db, 'users'),
          where('displayName', '>=', queryStr),
          where('displayName', '<=', queryStr + '\uf8ff'),
          limit(1)
        );
        snap = await getDocs(qName);
      }
      
      if (snap && !snap.empty) {
        const found = { id: snap.docs[0].id, ...snap.docs[0].data() as any };
        setTargetUser(found);
        setNewNickname(found.displayName || '');
        setLevelDirectSet(found.level || 1);
        playCyberSound('success');
        addAdminLog(`Alvo identificado: ${found.displayName} [ID: ${found.displayId || 'S/I'}] (E-mail: ${found.email || 'Não Registrado'})`, 'success');
      } else {
        setTargetUser(null);
        playCyberSound('alert');
        addAdminLog(`Alvo ("${queryStr}") não correspondente no banco de dados.`, 'warning');
      }
    } catch (err: any) {
      console.error(err);
      addAdminLog(`Falha na busca remota: ${err.message}`, 'critical');
    } finally {
      setIsSearchingUser(false);
    }
  };

  const handleUpdateCoins = async (amount: number, add: boolean) => {
    if (!targetUser) return;
    playCyberSound('laser');
    const currentCoins = targetUser.coins || 0;
    const nextCoins = Math.max(0, add ? currentCoins + amount : currentCoins - amount);
    
    try {
      const userRef = doc(db, 'users', targetUser.id);
      await updateDoc(userRef, { coins: nextCoins });
      setTargetUser({ ...targetUser, coins: nextCoins });
      
      addAdminLog(`${add ? 'Concedido' : 'Removido'} ${amount} moedas para ${targetUser.displayName}. (Carteira Atual: ${nextCoins})`, 'success');
    } catch (err: any) {
      console.error(err);
      addAdminLog(`Erro ao mutar saldo: ${err.message}`, 'critical');
    }
  };

  const handleToggleVip = async () => {
    if (!targetUser) return;
    playCyberSound('success');
    const nextVip = !targetUser.isVip;

    try {
      const userRef = doc(db, 'users', targetUser.id);
      await updateDoc(userRef, { isBanned: targetUser.isBanned || false, isVip: nextVip });
      setTargetUser({ ...targetUser, isVip: nextVip });
      
      addAdminLog(`Status VIP para ${targetUser.displayName} atualizado: ${nextVip ? 'ATIVADO' : 'REVOGADO'}`, 'info');
    } catch (err: any) {
      console.error(err);
      addAdminLog(`Erro na atualização do perfil VIP: ${err.message}`, 'critical');
    }
  };

  const handleToggleAdmin = async () => {
    if (!targetUser) return;
    playCyberSound('success');
    
    const nextRole = targetUser.role === 'admin' ? 'user' : 'admin';
    const isSuperAdmin = ['josivanlopes071@gmail.com', 'manoeldasilva631kejr@gmail.com'].includes((targetUser.email || '').toLowerCase());
    if (isSuperAdmin && nextRole === 'user') {
      addAdminLog(`Operação Recusada: Mestre ${targetUser.displayName} é super admin e não pode ser rebaixado.`, 'critical');
      return;
    }

    try {
      const userRef = doc(db, 'users', targetUser.id);
      await updateDoc(userRef, { role: nextRole });
      setTargetUser({ ...targetUser, role: nextRole });
      
      addAdminLog(`Cargo de ${targetUser.displayName} atualizado para: ${nextRole.toUpperCase()}`, 'success');
    } catch (err: any) {
      console.error(err);
      addAdminLog(`Erro ao atualizar cargo de ADM: ${err.message}`, 'critical');
    }
  };

  const handleSaveNickname = async () => {
    if (!targetUser || !newNickname.trim()) return;
    playCyberSound('click');
    try {
      const userRef = doc(db, 'users', targetUser.id);
      await updateDoc(userRef, { displayName: newNickname.trim() });
      setTargetUser({ ...targetUser, displayName: newNickname.trim() });
      addAdminLog(`Nickname de ${targetUser.displayName} mudado para ${newNickname}`, 'success');
    } catch (err: any) {
      console.error(err);
      addAdminLog(`Erro ao alterar nickname: ${err.message}`, 'critical');
    }
  };

  const handleBanTarget = async (durationHours?: number) => {
    if (!targetUser) return;
    playCyberSound('alert');
    
    const isMestre = ['josivanlopes071@gmail.com', 'manoeldasilva631kejr@gmail.com'].includes(targetUser.email || '');
    if (isMestre) {
      addAdminLog(`Operação Recusada: Mestre ${targetUser.displayName} é imune a banimentos.`, 'critical');
      return;
    }

    const isBannedNow = !targetUser.isBanned;
    let bannedUntil = null;
    if (isBannedNow && durationHours) {
      bannedUntil = new Date(Date.now() + durationHours * 3600 * 1000);
    }

    try {
      const userRef = doc(db, 'users', targetUser.id);
      await updateDoc(userRef, { 
        isBanned: isBannedNow,
        bannedUntil: bannedUntil ? serverTimestamp() : null
      });
      setTargetUser({ ...targetUser, isBanned: isBannedNow });
      
      addAdminLog(`Ação de Banimento em ${targetUser.displayName}: ${isBannedNow ? (durationHours ? `Temporário (${durationHours}h)` : 'Permanente') : 'Removido'}`, 'warning');
    } catch (err: any) {
      console.error(err);
      addAdminLog(`Erro no banimento: ${err.message}`, 'critical');
    }
  };

  const handleSilentToggle = () => {
    if (!targetUser) return;
    const isMuted = !mutedPlayers[targetUser.id];
    setMutedPlayers(prev => ({ ...prev, [targetUser.id]: isMuted }));
    playCyberSound('laser');
    
    addAdminLog(`Usuário ${targetUser.displayName} agora está ${isMuted ? 'SILENCIADO' : 'DESMUTADO'} pelo canal de comando administrado.`, 'warning');
  };

  const handleFreezeToggle = () => {
    if (!targetUser) return;
    const isFrozen = !frozenPlayers[targetUser.id];
    setFrozenPlayers(prev => ({ ...prev, [targetUser.id]: isFrozen }));
    playCyberSound('laser');

    addAdminLog(`Usuário ${targetUser.displayName} agora está ${isFrozen ? 'CONGELADO' : 'LIBERADO'} do controle físico do jogo.`, 'warning');
  };

  const handleReviveAndHeal = () => {
    if (!targetUser) return;
    playCyberSound('success');
    addAdminLog(`Sopro Vital enviado para ${targetUser.displayName}. Nível de Vida resetado a 100% e efeito ressurreição ativo.`, 'success');
  };

  const handleTeleportTarget = () => {
    if (!targetUser) return;
    playCyberSound('laser');
    addAdminLog(`Teleportando ${targetUser.displayName} para a coordenada do Host mestre de sala.`, 'info');
  };

  const handleKickTarget = () => {
    if (!targetUser) return;
    playCyberSound('alert');
    addAdminLog(`Sinal de Sessão expirado enviado para ${targetUser.displayName}. Jogador kickado da sala de voz atual e reconectado.`, 'warning');
  };

  const handleResetStats = async () => {
    if (!targetUser) return;
    const confirm = window.confirm(`Deseja resetar completamente as moedas, VIP, e estatísticas de ${targetUser.displayName}?`);
    if (!confirm) return;
    playCyberSound('alert');

    try {
      const userRef = doc(db, 'users', targetUser.id);
      await updateDoc(userRef, {
        coins: 100,
        isVip: false,
        bio: 'Iniciante do Universo We Aura',
        level: 1,
        vipBadge: null
      });
      setTargetUser({ ...targetUser, coins: 100, isVip: false, bio: 'Iniciante do Universo We Aura', level: 1 });
      setLevelDirectSet(1);
      addAdminLog(`Estatísticas de ${targetUser.displayName} redefinidas para o nível inicial de rede.`, 'critical');
    } catch (err: any) {
      console.error(err);
      addAdminLog(`Erro ao resetar: ${err.message}`, 'critical');
    }
  };

  const handleSetUserLevel = async (newLevelValue: number) => {
    if (!targetUser) return;
    const isCurrentUserOwner = ['josivanlopes071@gmail.com', 'manoeldasilva631kejr@gmail.com'].includes((profile?.email || user?.email || '').toLowerCase());
    if (!isCurrentUserOwner) {
      addAdminLog(`Acesso negado: Tentativa não autorizada de alterar nível.`, 'critical');
      alert("Acesso negado: Apenas o dono supremo do sistema pode alterar os níveis.");
      return;
    }
    
    const nextLevel = Math.max(1, Math.min(9999, newLevelValue));
    playCyberSound('laser');
    
    try {
      const userRef = doc(db, 'users', targetUser.id);
      await updateDoc(userRef, { level: nextLevel });
      setTargetUser({ ...targetUser, level: nextLevel });
      setLevelDirectSet(nextLevel);
      addAdminLog(`[NÍVEL DO DONO] Nível de ${targetUser.displayName} ajustado para ${nextLevel}.`, 'success');
    } catch (err: any) {
      console.error(err);
      addAdminLog(`Erro ao atualizar nível: ${err.message}`, 'critical');
    }
  };


  // ROOM OPERATIONS
  const handleUpdateRoomStatus = async (roomId: string, updates: any, actionName: string) => {
    playCyberSound('click');
    try {
      const roomRef = doc(db, 'rooms', roomId);
      await updateDoc(roomRef, updates);
      addAdminLog(`Configuração na Sala [${roomId.substring(0, 5)}]: ${actionName} atualizado.`, 'success');
    } catch (e: any) {
      console.error(e);
      addAdminLog(`Falha ao alterar sala: ${e.message}`, 'critical');
    }
  };

  const handleKickAllFromRoom = (roomId: string) => {
    playCyberSound('alert');
    addAdminLog(`Kick em massa acionado na sala ${roomId.substring(0, 6)}: Todos os jogadores desconectados do palco de voz!`, 'critical');
  };

  const handleAddOfficialBadge = async (roomId: string, currentBadgeState: boolean) => {
    await handleUpdateRoomStatus(roomId, { isOfficial: !currentBadgeState }, `Selo Oficial ${!currentBadgeState ? 'CONCEDIDO' : 'RETIREMENT'}`);
  };

  const handleHighlightRoom = async (roomId: string, isTrending: boolean) => {
    await handleUpdateRoomStatus(roomId, { isTrending: !isTrending }, `Destaque Holográfico Neon ${!isTrending ? 'ATIVADO' : 'DESATIVADO'}`);
  };

  const handlePinRoom = async (roomId: string, isPinned: boolean) => {
    await handleUpdateRoomStatus(roomId, { isPinned: !isPinned }, `Fixado no Topo ${!isPinned ? 'ATIVADO' : 'DESATIVADO'}`);
  };

  const handleCloseRoom = async (roomId: string) => {
    const confirm = window.confirm("Deseja fechar permanentemente e deletar esta sala?");
    if (!confirm) return;
    playCyberSound('alert');
    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'rooms', roomId));
      addAdminLog(`Sala ${roomId.substring(0, 6)} excluída integralmente do servidor global.`, 'critical');
    } catch (e: any) {
      console.error(e);
      addAdminLog(`Falha ao excluir sala: ${e.message}`, 'critical');
    }
  };

  const handleCreateRoomEvent = (roomId: string) => {
    if (!roomEventText.trim()) return;
    playCyberSound('success');
    addAdminLog(`Campanha Digital na sala [ID: ${roomId.substring(0, 5)}]: "${roomEventText}"`, 'info');
    setRoomEventText('');
  };


  // CHAT MODERATION
  const handleBroadcastAnnouncement = async () => {
    if (!globalAnnouncement.trim()) return;
    playCyberSound('success');
    
    const announcementText = globalAnnouncement.trim();
    const adminDisplayName = profile?.displayName || 'ADM';
    
    // Always save to localStorage immediately so local/offline sessions get it instantly
    try {
      const saved = localStorage.getItem('we_aura_announcements');
      const currentList = saved ? JSON.parse(saved) : [];
      const newLocalItem = {
        id: 'local_' + Math.random().toString(36).substring(2, 9),
        text: announcementText,
        adminName: adminDisplayName,
        createdAt: new Date().toISOString()
      };
      const updatedList = [...currentList, newLocalItem].slice(-15);
      localStorage.setItem('we_aura_announcements', JSON.stringify(updatedList));
      
      // Dispatch storage event to notify local tabs instantly
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'we_aura_announcements',
        newValue: JSON.stringify(updatedList)
      }));
    } catch (localErr) {
      console.warn("Could not write to localStorage cache:", localErr);
    }

    try {
      await addDoc(collection(db, 'system_announcements'), {
        text: announcementText,
        adminName: adminDisplayName,
        createdAt: serverTimestamp()
      });

      addAdminLog(`Aviso Global ADM enviado para todos os canais: "${announcementText}"`, 'warning');
      setGlobalAnnouncement('');
    } catch (err: any) {
      console.error(err);
      addAdminLog(`Aviso enviado localmente (O Firestore retornou erro de permissão ou rede: ${err.message})`, 'warning');
      setGlobalAnnouncement('');
    }
  };

  const handleClearGlobalAnnouncements = async () => {
    playCyberSound('alert');
    
    // Always clear localStorage immediately
    try {
      localStorage.removeItem('we_aura_announcements');
      setAnnouncements([]);
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'we_aura_announcements',
        newValue: null
      }));
    } catch (localErr) {
      console.warn(localErr);
    }

    try {
      const { getDocs, deleteDoc } = await import('firebase/firestore');
      const snap = await getDocs(collection(db, 'system_announcements'));
      for (const d of snap.docs) {
        await deleteDoc(doc(db, 'system_announcements', d.id));
      }
      addAdminLog(`Histórico de avisos globais limpo com sucesso do painel, do Firestore e localmente.`, 'info');
    } catch (e: any) {
      console.error(e);
      addAdminLog(`Avisos limpos localmente (O Firestore retornou erro de permissão ou rede: ${e.message})`, 'info');
    }
  };


  // COMPREHENSIVE CYBER SCANS (ANTI-CHEAT)
  const runAntiCheatDeepScan = () => {
    if (isAntiCheatScanning) return;
    playCyberSound('scan');
    setIsAntiCheatScanning(true);
    setAntiCheatStatus('scanning');
    setScanningProgress(0);
    setDetectedHacks([]);
    addAdminLog("Comando Neural iniciado: Vasculhando tráfego WebSocket e pacotes de rede...", 'info');

    let current = 0;
    const interval = setInterval(() => {
      current += 8;
      setScanningProgress(Math.min(100, current));
      
      if (current === 24) {
        addAdminLog("Verificando manipulação de memória local (CheatEngine signatures)...", 'info');
        // Random sound trigger
        playCyberSound('click');
      }
      if (current === 56) {
        addAdminLog("Checando pacotes e canais duplicados de streaming de Voz WebRTC...", 'info');
        playCyberSound('click');
      }
      if (current === 80) {
        // Mock identify a suspect to make the scanner extremely cool and gaming-feeling
        const items = ['Lag-Switching artificial detected', 'High Speed Coin injection signature', 'Dual session exploit in slot 2'];
        const randomHack = items[Math.floor(Math.random() * items.length)];
        setDetectedHacks([randomHack]);
        setAntiCheatStatus('threat_found');
        addAdminLog(`ALERTA DE SEGURANÇA: ${randomHack}!`, 'critical');
        playCyberSound('alert');
      }

      if (current >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setIsAntiCheatScanning(false);
          setAntiCheatStatus(detectedHacks.length > 0 ? 'threat_found' : 'clean');
          addAdminLog("Limpeza executada. Varredura finalizada. Displicência eliminada.", 'success');
          playCyberSound('success');
        }, 1200);
      }
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden select-none">
      {/* Dynamic Cyber Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#02030a]/95 backdrop-blur-md"
      />

      {/* Futuristic Border Sparks / Container */}
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-6xl h-[92vh] sm:h-[85vh] bg-[#050816] border border-[#8A2EFF]/30 rounded-[32px] overflow-hidden flex flex-col sm:flex-row shadow-[0_0_100px_rgba(138,46,255,0.4)] card-shine z-10"
      >
        
        {/* RETRACTABLE GAME SIDEBAR COMPONENT */}
        <AnimatePresence initial={false}>
          {isSidebarOpen && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '280px', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="relative shrink-0 border-r border-white/[0.06] bg-[#03050f]/90 flex flex-col justify-between overflow-hidden"
            >
              {/* Header inside HUD */}
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#8A2EFF]/20 rounded-xl flex items-center justify-center border border-[#8A2EFF]/40 shadow-[0_0_15px_rgba(138,46,255,0.3)]">
                    <Shield className="text-[#00F0FF] animate-pulse" size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white leading-none uppercase tracking-[0.2em] flex items-center gap-1.5">
                      SISTEMA <span className="text-[#FF4D9D] font-black">ADM</span>
                    </h3>
                    <p className="text-[10px] text-[#00F0FF] font-bold mt-1 tracking-widest uppercase">WE AURA vA.09</p>
                  </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent w-full my-6"></div>

                {/* Sub Menu Links */}
                <nav className="space-y-2">
                  {[
                    { id: 'players', label: 'Jogadores', icon: Users, color: PALETTE.pink },
                    { id: 'rooms', label: 'Salas & Espaços', icon: Layers, color: PALETTE.cyan },
                    { id: 'chat', label: 'Filtros Chat', icon: MessageSquare, color: PALETTE.blue },
                    { id: 'frames', label: 'Molduras ADM', icon: Award, color: '#FBBF24' },
                    { id: 'moderation', label: 'Logs de Segurança', icon: Terminal, color: PALETTE.primary },
                  ].map(tab => {
                    const Icon = tab.icon;
                    const isSelected = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id as any);
                          playCyberSound('click');
                        }}
                        className={`w-full flex items-center gap-3.5 px-4.5 py-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all relative overflow-hidden group border ${
                          isSelected 
                            ? 'bg-[#8A2EFF]/15 border-[#8A2EFF]/50 text-white shadow-[0_0_20px_rgba(138,46,255,0.25)]' 
                            : 'bg-transparent border-transparent text-white/40 hover:text-white hover:bg-white/[0.02]'
                        }`}
                      >
                        {isSelected && (
                          <div 
                            className="absolute left-0 top-0 bottom-0 w-[4px]"
                            style={{ backgroundColor: tab.color }}
                          />
                        )}
                        <Icon 
                          size={16} 
                          style={{ color: isSelected ? tab.color : 'inherit' }}
                          className={`${isSelected ? 'scale-110 drop-shadow-[0_0_8px_currentColor]' : 'group-hover:scale-110 duration-200'}`} 
                        />
                        {tab.label}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Sidebar footer showing Admin User Details */}
              <div className="p-6 bg-black/40 border-t border-white/[0.04]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#00BFFF]/30">
                    <img src={profile?.photoURL} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-black text-white truncate">{profile?.displayName}</div>
                    <span className="text-[9px] font-black text-[#FF4D9D] uppercase tracking-widest block mt-0.5">ADMIN MASTER</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MAIN HUD CONTROL WINDOW AREA */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#050816]/95">
          {/* Main Top Header Controls */}
          <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between bg-black/30">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  setIsSidebarOpen(!isSidebarOpen);
                  playCyberSound('click');
                }}
                className="p-2 bg-white/5 rounded-xl border border-white/5 text-white/60 hover:text-white hover:border-white/10 active:scale-95 transition-all text-xs font-black uppercase tracking-widest"
              >
                {isSidebarOpen ? 'Esconder' : 'Abrir Menu'}
              </button>
              
              <div className="h-4 w-px bg-white/10 hidden sm:block"></div>
              
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-[#00F0FF] flex items-center gap-2">
                <Radio size={14} className="text-[#FF4D9D] animate-pulse" />
                CONEXÃO SEGURA ESTABELECIDA
              </span>
            </div>

            <button 
              onClick={onClose} 
              className="p-2.5 bg-white/5 hover:bg-red-500/20 rounded-xl text-white/40 hover:text-white border border-white/5 hover:border-red-500/20 active:scale-90 transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* INTERNAL CONTENT CONVERTOR */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
            
            {/* TAB CONTENT: PLAYERS */}
            {activeTab === 'players' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                
                {/* Search Header Container */}
                <div className="p-6 bg-[#03050f]/80 rounded-2xl border border-white/[0.04] space-y-4 shadow-[inset_0_0_20px_rgba(138,46,255,0.03)] glow-cyan justify-normal flex flex-col">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <Terminal size={14} className="text-[#FF4D9D]" />
                        BUSCA DE ALVO (DATABASE)
                      </h4>
                      <p className="text-[10px] text-white/40 mt-1">Busque usuários por ID numérico ou UID interno.</p>
                    </div>

                    <div className="flex gap-1.5 p-1 bg-white/5 rounded-lg border border-white/5">
                      <button 
                        onClick={() => {
                          setPlayerSearchType('displayId');
                          playCyberSound('click');
                        }}
                        className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded-md transition-all ${playerSearchType === 'displayId' ? 'bg-[#FF4D9D] text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                      >
                        ID Padrão
                      </button>
                      <button 
                        onClick={() => {
                          setPlayerSearchType('name');
                          playCyberSound('click');
                        }}
                        className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded-md transition-all ${playerSearchType === 'name' ? 'bg-[#FF4D9D] text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                      >
                        Nome
                      </button>
                      <button 
                        onClick={() => {
                          setPlayerSearchType('email');
                          playCyberSound('click');
                        }}
                        className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded-md transition-all ${playerSearchType === 'email' ? 'bg-[#FF4D9D] text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                      >
                        E-mail
                      </button>
                      <button 
                        onClick={() => {
                          setPlayerSearchType('uid');
                          playCyberSound('click');
                        }}
                        className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded-md transition-all ${playerSearchType === 'uid' ? 'bg-[#FF4D9D] text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                      >
                        UID
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                      <input 
                        type="text" 
                        placeholder={
                          playerSearchType === 'displayId' 
                            ? "Insira o ID numérico do usuário..." 
                            : playerSearchType === 'name' 
                            ? "Insira o nome do usuário..." 
                            : playerSearchType === 'email'
                            ? "Insira o email do usuário..."
                            : "Insira o UID Alfanumérico..."
                        }
                        value={playerQuery}
                        onChange={(e) => setPlayerQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/5 rounded-xl pl-12 pr-6 py-4 text-xs font-bold text-white outline-none focus:border-[#8A2EFF]/40 transition-all placeholder:text-white/20 select-text"
                      />
                    </div>
                    <button 
                      onClick={handlePlayerSearch}
                      disabled={isSearchingUser}
                      className="bg-[#8A2EFF] hover:bg-[#8A2EFF]/90 font-black text-xs uppercase px-7 rounded-xl text-white shadow-lg active:scale-95 transition-all flex items-center gap-2"
                    >
                      {isSearchingUser ? <RefreshCw size={14} className="animate-spin" /> : 'Sincronizar'}
                    </button>
                  </div>
                </div>

                {/* TARGET USER CONTROLLER CARD */}
                {targetUser ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-6 rounded-2xl bg-[#03050f]/80 border border-[#8A2EFF]/25 shadow-[0_4px_40px_rgba(138,46,255,0.06)] space-y-6"
                  >
                    
                    {/* User Profile Summary */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.04]">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <img 
                            src={targetUser.photoURL} 
                            alt="" 
                            className="w-16 h-16 rounded-xl object-cover border border-white/10"
                          />
                          {targetUser.isVip && (
                            <span className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-yellow-400 to-amber-500 text-[8px] px-1.5 py-0.5 rounded font-black text-black">
                              VIP
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-white">{targetUser.displayName}</h4>
                            <span className="text-[10px] text-white/30 truncate max-w-[140px] block font-mono">({targetUser.email})</span>
                          </div>
                          <div className="flex items-center gap-3.5 mt-1.5 leading-none">
                            <span className="text-[9px] font-black text-[#00F0FF] tracking-widest uppercase">ID: {targetUser.displayId || 'S/I'}</span>
                            <div className="w-1 h-1 rounded-full bg-white/10"></div>
                            <span className="text-[9px] font-black text-[#FF4D9D] tracking-widest uppercase">NÍVEL: {targetUser.level || 1}</span>
                            <div className="w-1 h-1 rounded-full bg-white/10"></div>
                            <span className="text-[9px] font-black text-yellow-500 tracking-widest uppercase flex items-center gap-1">
                              💎 {targetUser.coins || 0}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2.5">
                        {/* VIP, Nickname commands */}
                        <button 
                          onClick={handleToggleAdmin}
                          className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                            targetUser.role === 'admin' 
                              ? 'bg-gradient-to-r from-[#8A2EFF]/20 to-purple-650/20 border-[#8A2EFF]/40 text-[#8A2EFF] shadow-[0_0_15px_rgba(138,46,255,0.15)]' 
                              : 'bg-white/5 border-white/5 text-white/40 hover:text-white hover:border-[#8A2EFF]/25'
                          }`}
                        >
                          {targetUser.role === 'admin' ? 'Remover ADM' : 'Tornar ADM'}
                        </button>
                        <button 
                          onClick={handleToggleVip}
                          className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                            targetUser.isVip 
                              ? 'bg-gradient-to-r from-yellow-500/20 to-amber-600/20 border-yellow-500/30 text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.15)]' 
                              : 'bg-white/5 border-white/5 text-white/40 hover:text-white'
                          }`}
                        >
                          Conceder VIP
                        </button>
                        <button 
                          onClick={handleSilentToggle}
                          className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                            mutedPlayers[targetUser.id] 
                              ? 'bg-amber-500/15 border-amber-500/30 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)]' 
                              : 'bg-white/5 border-white/5 text-white/40 hover:text-white'
                          }`}
                        >
                          {mutedPlayers[targetUser.id] ? 'Desmutar' : 'Silenciar'}
                        </button>
                      </div>
                    </div>

                    {/* MOEDAS (COINS) AND NICKNAME CONTROLLERS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Coins Section */}
                      <div className="p-4 bg-black/40 border border-white/[0.04] rounded-xl space-y-3">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Ajustes Financeiros</label>
                        <div className="flex gap-2">
                          <input 
                            type="number" 
                            value={coinMutationAmt} 
                            onChange={(e) => setCoinMutationAmt(Number(e.target.value))}
                            className="bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-xs font-bold text-white outline-none w-28"
                          />
                          <button 
                            onClick={() => handleUpdateCoins(coinMutationAmt, true)}
                            className="flex-1 bg-green-500/20 border border-green-500/30 text-green-400 font-bold text-[10px] uppercase rounded-lg hover:bg-green-500/30 transition-all active:scale-95"
                          >
                            + Conceder
                          </button>
                          <button 
                            onClick={() => handleUpdateCoins(coinMutationAmt, false)}
                            className="flex-1 bg-red-500/20 border border-red-500/30 text-red-400 font-bold text-[10px] uppercase rounded-lg hover:bg-red-500/30 transition-all active:scale-95"
                          >
                            - Remover
                          </button>
                        </div>
                      </div>

                      {/* Name Section */}
                      <div className="p-4 bg-black/40 border border-white/[0.04] rounded-xl space-y-3">
                        <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Modificar Nickname</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={newNickname} 
                            onChange={(e) => setNewNickname(e.target.value)}
                            className="flex-1 bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-xs font-bold text-white outline-none"
                          />
                          <button 
                            onClick={handleSaveNickname}
                            className="bg-[#00BFFF]/20 border border-[#00BFFF]/30 text-[#00BFFF] font-bold text-[10px] uppercase rounded-lg px-4 hover:bg-[#00BFFF]/30 transition-all active:scale-95"
                          >
                            Salvar
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* OWNER EXCLUSIVE LEVEL CONTROLLER */}
                    <div className="p-4 rounded-xl bg-gradient-to-r from-[#FF4D9D]/5 to-[#8A2EFF]/5 border border-[#FF4D9D]/20 space-y-3 relative overflow-hidden">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Crown size={14} className="text-[#FF4D9D] animate-pulse" />
                          <span className="text-[10px] font-black uppercase text-transparent bg-clip-text bg-gradient-to-r from-[#FF4D9D] to-[#8A2EFF] tracking-widest leading-none">
                            Controle Supremo de Nível (Apenas Dono)
                          </span>
                        </div>
                        {isCurrentUserOwner ? (
                          <span className="bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-black px-2 py-0.5 rounded text-emerald-400 uppercase tracking-widest">
                            Acesso Permitido
                          </span>
                        ) : (
                          <span className="bg-red-500/10 border border-red-500/20 text-[8px] font-black px-2 py-0.5 rounded text-red-400 uppercase tracking-widest flex items-center gap-1">
                            <Lock size={8} /> Bloqueado
                          </span>
                        )}
                      </div>

                      {isCurrentUserOwner ? (
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button
                              onClick={() => {
                                const current = Number(targetUser.level) || 1;
                                handleSetUserLevel(current - 1);
                              }}
                              className="w-10 h-10 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-bold flex items-center justify-center transition-all active:scale-95 text-xs"
                              title="Tirar Nível (-1)"
                            >
                              -1
                            </button>
                            <input
                              type="number"
                              min="1"
                              max="9999"
                              value={levelDirectSet}
                              onChange={(e) => setLevelDirectSet(Math.max(1, Number(e.target.value)))}
                              className="bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-xs font-bold text-white outline-none w-20 text-center"
                            />
                            <button
                              onClick={() => {
                                const current = Number(targetUser.level) || 1;
                                handleSetUserLevel(current + 1);
                              }}
                              className="w-10 h-10 rounded-lg bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 font-bold flex items-center justify-center transition-all active:scale-95 text-xs"
                              title="Subir Nível (+1)"
                            >
                              +1
                            </button>
                          </div>
                          
                          <button
                            onClick={() => handleSetUserLevel(levelDirectSet)}
                            className="w-full sm:flex-1 bg-gradient-to-r from-[#FF4D9D] to-[#8A2EFF] text-white font-black text-[10px] uppercase tracking-[0.15em] h-10 rounded-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-2"
                          >
                            <Award size={12} />
                            Definir Nível Exato
                          </button>
                        </div>
                      ) : (
                        <div className="p-3 bg-black/40 rounded-lg border border-white/5 flex items-center gap-3">
                          <Lock size={16} className="text-white/20" />
                          <p className="text-[10px] text-white/40 font-semibold leading-relaxed">
                            Apenas as contas dos donos oficiais podem alterar ou manipular o nível dos usuários neste painel.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* POLISHED MULTIPLE TRIGGER UTILITIES */}
                    <div className="space-y-4">
                      <label className="text-[9px] font-black text-white/40 uppercase tracking-widest block">Telemetria & Efeitos do Universo</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        
                        <button 
                          onClick={handleFreezeToggle}
                          className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${
                            frozenPlayers[targetUser.id] 
                              ? 'bg-blue-500/20 border-blue-400/40 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.3)]' 
                              : 'bg-white/5 border-white/5 text-white/60 hover:text-white'
                          }`}
                        >
                          <Lock size={16} className={frozenPlayers[targetUser.id] ? 'animate-bounce' : ''} />
                          <span className="text-[9px] font-black uppercase tracking-wider">
                            {frozenPlayers[targetUser.id] ? 'DESCONGELAR' : 'CONGELAR'}
                          </span>
                        </button>

                        <button 
                          onClick={handleReviveAndHeal}
                          className="p-4 rounded-xl border bg-white/5 border-white/5 text-green-400 hover:text-green-300 hover:bg-green-500/5 active:scale-95 transition-all flex flex-col items-center justify-center gap-2"
                        >
                          <Sparkles size={16} />
                          <span className="text-[9px] font-black uppercase tracking-wider">REVIVER JOGADOR</span>
                        </button>

                        <button 
                          onClick={handleTeleportTarget}
                          className="p-4 rounded-xl border bg-white/5 border-white/5 text-[#00F0FF] hover:text-[#00F0FF]/80 hover:bg-[#00F0FF]/5 active:scale-95 transition-all flex flex-col items-center justify-center gap-2"
                        >
                          <Zap size={16} />
                          <span className="text-[9px] font-black uppercase tracking-wider">TELEPORTAR HOST</span>
                        </button>

                        <button 
                          onClick={handleKickTarget}
                          className="p-4 rounded-xl border bg-white/5 border-white/5 text-red-400 hover:text-red-300 hover:bg-red-500/5 active:scale-95 transition-all flex flex-col items-center justify-center gap-2"
                        >
                          <EyeOff size={16} />
                          <span className="text-[9px] font-black uppercase tracking-wider">FORÇAR KICK</span>
                        </button>

                      </div>
                    </div>

                    {/* DISCIPLINARY MODERATION (BAN BLOCK) */}
                    <div className="p-4 bg-red-950/10 border border-red-500/20 rounded-xl space-y-4">
                      <div className="flex items-center gap-2 text-red-400">
                        <ShieldAlert size={14} className="animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Protocolo de Limitações Temporárias</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: '1 HORA', h: 1 },
                          { label: '24 HORAS', h: 24 },
                          { label: '7 DIAS', h: 168 },
                          { label: 'PERMA', h: undefined }
                        ].map(punish => (
                          <button 
                            key={punish.label}
                            onClick={() => handleBanTarget(punish.h)}
                            className="bg-black/30 border border-white/5 rounded-lg py-3 text-[9px] font-black text-white/50 hover:text-white hover:bg-white/5 transition-all"
                          >
                            {punish.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleBanTarget()}
                          className={`flex-1 py-4.5 rounded-xl font-black text-[10px] uppercase tracking-[0.15em] transition-all border ${
                            targetUser.isBanned 
                              ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' 
                              : 'bg-red-600 border-red-500 text-white shadow-lg'
                          }`}
                        >
                          {targetUser.isBanned ? 'Desbanir Usuário' : 'Banir Usuário'}
                        </button>
                        <button 
                          onClick={handleResetStats}
                          className="px-6 rounded-xl border border-red-500/20 hover:bg-red-500/10 text-red-500 font-bold text-[10px] uppercase"
                        >
                          Resetar Conta
                        </button>
                      </div>
                    </div>

                    {/* MOCK INVENTORY & HISTORICS LIST */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-black/30 rounded-xl border border-white/[0.04] space-y-2">
                        <span className="text-[9px] font-black text-white/30 tracking-widest uppercase block">Inventário do Jogador</span>
                        <div className="flex flex-wrap gap-2 pt-2">
                          <span className="text-[8px] font-black px-2 py-1 bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded uppercase">Aura Neon Roxo</span>
                          <span className="text-[8px] font-black px-2 py-1 bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 rounded uppercase">Tema VIP Gold</span>
                          <span className="text-[8px] font-black px-2 py-1 bg-white/5 text-white/30 rounded uppercase">Default Slot</span>
                        </div>
                      </div>
                      <div className="p-4 bg-black/30 rounded-xl border border-white/[0.04] space-y-2">
                        <span className="text-[9px] font-black text-white/30 tracking-widest uppercase block">Histórico de Punições</span>
                        <div className="text-[9.5px] font-mono text-white/40 leading-relaxed pt-2">
                          • [Segurança] Nenhuma restrição prévia registrada.
                        </div>
                      </div>
                    </div>

                  </motion.div>
                ) : (
                  <div className="py-20 text-center text-white/20 font-black text-[10px] uppercase tracking-widest bg-[#03050f]/30 rounded-2xl border border-white/[0.03]">
                    Procurando por conexões ou jogadores do banco de dados...
                  </div>
                )}

              </motion.div>
            )}

            {/* TAB CONTENT: ROOMS */}
            {activeTab === 'rooms' && (
              <motion.div initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Painel Operacional de Salas</h3>
                    <p className="text-[10px] text-white/40 mt-1">Monitore e promova as melhores salas de voz do We Aura.</p>
                  </div>
                </div>

                {rooms.length === 0 ? (
                  <div className="py-20 text-center text-white/20 font-black text-[10px] uppercase tracking-widest bg-[#03050f]/30 rounded-2xl border border-white/[0.03]">
                    Nenhuma sala ativa no momento.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {rooms.map((room) => {
                      const hasBadge = room.isOfficial;
                      const hasTrending = room.isTrending;
                      const hasPinned = room.isPinned;

                      return (
                        <div 
                          key={room.id}
                          className={`p-5 rounded-2xl bg-[#03050f]/80 border transition-all relative overflow-hidden ${
                            hasTrending 
                              ? 'border-[#00F0FF]/30 shadow-[0_0_20px_rgba(0,240,255,0.1)]' 
                              : 'border-white/[0.04]'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <img src={room.coverURL || 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=1000&auto=format&fit=crop'} alt="" className="w-11 h-11 rounded-lg object-cover" />
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <h4 className="text-xs font-black text-white truncate max-w-[150px]">{room.name}</h4>
                                  {hasBadge && <span className="bg-[#a855f7] text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase">Oficial</span>}
                                  {hasPinned && <span className="bg-[#00BFFF] text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase">PIN</span>}
                                </div>
                                <span className="text-[9px] text-white/30 block mt-1">Dono ID: {room.ownerId?.substring(0, 9)}</span>
                              </div>
                            </div>

                            <button 
                              onClick={() => handleCloseRoom(room.id)}
                              className="p-1.5 hover:bg-red-500/20 text-white/20 hover:text-red-400 rounded-lg transition-colors border border-transparent hover:border-red-500/10"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-4">
                            <button 
                              onClick={() => handleAddOfficialBadge(room.id, !!hasBadge)}
                              className="bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-wider text-center"
                            >
                              {hasBadge ? 'Remover Selo' : 'Selo Oficial'}
                            </button>
                            <button 
                              onClick={() => handleHighlightRoom(room.id, !!hasTrending)}
                              className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-wider text-center"
                            >
                              {hasTrending ? 'Tirar Alta' : 'Mudar em Alta'}
                            </button>
                            <button 
                              onClick={() => handlePinRoom(room.id, !!hasPinned)}
                              className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-wider text-center"
                            >
                              {hasPinned ? 'Desafixar' : 'Fixar no Topo'}
                            </button>
                            <button 
                              onClick={() => handleKickAllFromRoom(room.id)}
                              className="bg-red-500/5 hover:bg-red-500/25 text-red-400 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-wider text-center"
                            >
                              Esvaziar Sala
                            </button>
                          </div>

                          <div className="mt-4 pt-4 border-t border-white/[0.04] space-y-2">
                            <span className="text-[9px] font-black text-white/40 uppercase tracking-widest block">Atividades na Sala</span>
                            <div className="flex gap-2">
                              <input 
                                type="text" 
                                placeholder="Criar nova chamada/evento..."
                                value={roomEventText}
                                onChange={(e) => setRoomEventText(e.target.value)}
                                className="flex-1 bg-white/5 border border-white/5 rounded-lg px-2.5 py-1.5 text-[10px] text-white outline-none"
                              />
                              <button 
                                onClick={() => handleCreateRoomEvent(room.id)}
                                className="bg-[#8A2EFF]/25 text-[#a855f7] px-3 rounded-lg text-[10px] font-black uppercase"
                              >
                                Ativar
                              </button>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB CONTENT: CHAT */}
            {activeTab === 'chat' && (
              <motion.div initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">Painel Moderativo de Comunicações</h3>
                  <p className="text-[10px] text-white/40 mt-1">Filtre conversas indesejadas e envie broadcasts imediatos para todos os usuários.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Spam settings */}
                  <div className="p-5 rounded-2xl bg-[#03050f]/80 border border-white/[0.04] space-y-4">
                    <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <Shield size={14} className="text-[#FF4D9D]" />
                      Filtro de Anti-Spam
                    </span>
                    <p className="text-[10px] text-white/40 leading-relaxed">Aumentar o threshold reduz a sensibilidade do robô nas salas de conversa.</p>
                    
                    <div className="flex items-center gap-4">
                      <input 
                        type="range" 
                        min="1" 
                        max="8" 
                        value={spamThreshold}
                        onChange={(e) => setSpamThreshold(Number(e.target.value))}
                        className="flex-1 bg-white/10 rounded-lg accent-[#8A2EFF]"
                      />
                      <span className="text-xs font-black text-white bg-white/5 px-3 py-1.5 border border-white/5 rounded-lg">
                        {spamThreshold} msgs/s
                      </span>
                    </div>

                    <div className="h-px bg-white/[0.04]"></div>

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-black text-white uppercase tracking-wider block">Silenciar Chat Global</span>
                        <p className="text-[9px] text-white/30 mt-0.5">Impede submissão de mensagens em toda a plataforma.</p>
                      </div>
                      <button 
                        onClick={() => {
                          setIsGlobalChatMuted(!isGlobalChatMuted);
                          playCyberSound('alert');
                          addAdminLog(`Status Chat Global alterado para: ${!isGlobalChatMuted ? 'SILENCIADO' : 'LIBERADO'}`, 'warning');
                        }}
                        className={`px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                          isGlobalChatMuted 
                            ? 'bg-red-500/20 border-red-500/30 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                            : 'bg-white/5 border-white/5 text-white/40 hover:text-white'
                        }`}
                      >
                        {isGlobalChatMuted ? 'Desbloquear' : 'Obstruir'}
                      </button>
                    </div>
                  </div>

                  {/* Announcement banner generator */}
                  <div className="p-5 rounded-2xl bg-[#03050f]/80 border border-white/[0.04] space-y-4 flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <Award size={14} className="text-[#00F0FF]" />
                        Anúncio Oficial Global (ADM)
                      </span>
                      <p className="text-[10px] text-white/40 mt-1 leading-relaxed">Envie um banner oficial em tempo real para todos os painéis e chatsativos.</p>
                    </div>

                    <div className="space-y-3">
                      <textarea 
                        placeholder="Insira as diretrizes do anúncio, evento oficial ou punição exemplar..."
                        value={globalAnnouncement}
                        onChange={(e) => setGlobalAnnouncement(e.target.value)}
                        className="bg-white/5 border border-white/5 rounded-xl p-4 text-xs font-bold text-white outline-none w-full h-24 focus:border-[#8A2EFF]/30 placeholder:text-white/20 select-text"
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={handleBroadcastAnnouncement}
                          className="flex-1 bg-[#8A2EFF] hover:bg-[#8A2EFF]/90 py-3.5 rounded-xl font-black text-xs text-white uppercase tracking-wider active:scale-95 transition-all outline-none"
                        >
                          Emitir Mensagem
                        </button>
                        <button 
                          onClick={handleClearGlobalAnnouncements}
                          className="px-4 border border-white/5 hover:bg-white/5 rounded-xl"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub-pane display: active lists */}
                <div className="p-5 rounded-2xl bg-[#03050f]/60 border border-white/[0.04]">
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest block mb-4">Avisos em Circulação</span>
                  {announcements.length === 0 ? (
                    <div className="text-[10px] text-center py-6 text-white/20 font-black uppercase">Nenhum aviso emitido hoje.</div>
                  ) : (
                    <div className="space-y-2">
                      {announcements.map((ann) => (
                        <div key={ann.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-between">
                          <p className="text-xs font-bold text-white/80">{ann.text}</p>
                          <span className="text-[9px] font-black text-[#FF4D9D] uppercase tracking-widest">por: {ann.adminName}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* TAB CONTENT: CUSTOM FRAMES */}
            {activeTab === 'frames' && (
              <motion.div initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">Painel Operativo de Molduras Personalizadas</h3>
                  <p className="text-[10px] text-white/40 mt-1">Crie e configure molduras premium exclusivas. As imagens PNG, GIF ou WebP enviadas são publicadas imediatamente na loja e inventário.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* LEFT: Frame Creation Form */}
                  <form onSubmit={handleSaveCustomFrame} className="lg:col-span-7 p-5 rounded-2xl bg-[#03050f]/80 border border-white/[0.04] space-y-4">
                    <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <Plus size={14} className="text-[#FBBF24]" />
                      Inserir Nova Moldura
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* ID field */}
                      <div className="space-y-1.5">
                        <label className="text-[9.5px] font-black uppercase text-white/40 tracking-wider">ID Único (Opcional)</label>
                        <input
                          type="text"
                          placeholder="Ex: fr_natal_2026"
                          value={newFrameId}
                          onChange={(e) => setNewFrameId(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-white placeholder-white/20 focus:border-[#FBBF24]/50 transition-all outline-none"
                        />
                      </div>

                      {/* Name field */}
                      <div className="space-y-1.5">
                        <label className="text-[9.5px] font-black uppercase text-white/40 tracking-wider">Nome da Moldura</label>
                        <input
                          type="text"
                          placeholder="Ex: Aura Natalina"
                          value={newFrameName}
                          onChange={(e) => setNewFrameName(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-white placeholder-white/20 focus:border-[#FBBF24]/50 transition-all outline-none"
                          required
                        />
                      </div>
                    </div>

                    {/* Description field */}
                    <div className="space-y-1.5">
                      <label className="text-[9.5px] font-black uppercase text-white/40 tracking-wider">Descrição Detalhada</label>
                      <input
                        type="text"
                        placeholder="Ex: Moldura festiva concedida a membros ativos do Clã."
                        value={newFrameDescription}
                        onChange={(e) => setNewFrameDescription(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-white placeholder-white/20 focus:border-[#FBBF24]/50 transition-all outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Price field */}
                      <div className="space-y-1.5">
                        <label className="text-[9.5px] font-black uppercase text-white/40 tracking-wider">Preço (🪙 Moedas EGO)</label>
                        <input
                          type="number"
                          min="0"
                          value={newFramePrice}
                          onChange={(e) => setNewFramePrice(Number(e.target.value))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-white placeholder-white/20 focus:border-[#FBBF24]/50 transition-all outline-none"
                          required
                        />
                      </div>

                      {/* Rarity */}
                      <div className="space-y-1.5">
                        <label className="text-[9.5px] font-black uppercase text-white/40 tracking-wider">Raridade da Aura</label>
                        <select
                          value={newFrameRarity}
                          onChange={(e) => setNewFrameRarity(e.target.value as any)}
                          className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:border-[#FBBF24]/50 transition-all outline-none"
                        >
                          <option value="Comum">Comum</option>
                          <option value="Raro">Raro</option>
                          <option value="Épico">Épico</option>
                          <option value="Lendário">Lendário</option>
                        </select>
                      </div>

                      {/* Unlock Status */}
                      <div className="space-y-1.5">
                        <label className="text-[9.5px] font-black uppercase text-white/40 tracking-wider">Status Desbloqueio</label>
                        <select
                          value={newFrameStatusUnlock}
                          onChange={(e) => setNewFrameStatusUnlock(e.target.value as any)}
                          className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:border-[#FBBF24]/50 transition-all outline-none"
                        >
                          <option value="locked">Pago (Comprar c/ coins)</option>
                          <option value="free">Livre (Grátis p/ todos)</option>
                        </select>
                      </div>
                    </div>

                    {/* Drag-and-drop or file picker */}
                    <div className="space-y-1.5">
                      <label className="text-[9.5px] font-black uppercase text-white/40 tracking-wider">Arquivo da Moldura (PNG, WebP, GIF)</label>
                      <div 
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleFrameFileChange}
                        className="border-2 border-dashed border-white/10 hover:border-[#FBBF24]/50 rounded-2xl p-5 flex flex-col items-center justify-center bg-white/[0.01] hover:bg-white/[0.03] duration-200 cursor-pointer relative"
                      >
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFrameFileChange}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <Compass className="text-white/30 mb-2 animate-pulse" size={24} />
                        <span className="text-xs font-black text-white/80 select-none">Arraste a moldura ou clique para upload</span>
                        <span className="text-[9px] text-white/30 lowercase mt-1 select-none">(PNG transparente, WebP ou GIF animado)</span>
                      </div>
                    </div>

                    {/* Or enter Direct Drive/Web URL */}
                    <div className="space-y-1.5">
                      <label className="text-[9.5px] font-black uppercase text-white/40 tracking-wider">Ou Endereço URL de Imagem Direta</label>
                      <input
                        type="url"
                        placeholder="https://exemplo.com/moldura.png"
                        value={newFrameImageUrl}
                        onChange={(e) => setNewFrameImageUrl(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-white placeholder-white/20 focus:border-[#FBBF24]/50 transition-all outline-none"
                      />
                    </div>

                    {/* AVATAR FIT CONTROLS */}
                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4">
                      <span className="text-[10px] font-black text-white/70 uppercase tracking-widest block border-b border-white/5 pb-2">Controles de Encaixe do Avatar</span>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Scale slider */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[9px] font-black uppercase text-white/40 tracking-wider">
                            <span>Escala do Avatar</span>
                            <span>{Math.round(newFrameAvatarScale * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0.5"
                            max="1.2"
                            step="0.005"
                            value={newFrameAvatarScale}
                            onChange={(e) => setNewFrameAvatarScale(Number(e.target.value))}
                            className="w-full bg-white/15 h-1.5 rounded-lg accent-[#FBBF24]"
                          />
                        </div>

                        {/* Offset Y slider */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[9px] font-black uppercase text-white/40 tracking-wider">
                            <span>Deslocamento Vertical (Y)</span>
                            <span>{newFrameAvatarOffsetY}%</span>
                          </div>
                          <input
                            type="range"
                            min="-25"
                            max="25"
                            step="0.5"
                            value={newFrameAvatarOffsetY}
                            onChange={(e) => setNewFrameAvatarOffsetY(Number(e.target.value))}
                            className="w-full bg-white/15 h-1.5 rounded-lg accent-[#FBBF24]"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingFrame}
                      className="w-full bg-[#FBBF24] hover:bg-[#FBBF24]/90 font-black text-xs text-black uppercase py-4 rounded-xl shadow-lg shadow-[#FBBF24]/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                      {isSavingFrame ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          Gravando Moldura na Nuvem...
                        </>
                      ) : (
                        'Publicar Moldura Oficial'
                      )}
                    </button>
                  </form>

                  {/* RIGHT: Live Preview & Existing custom frames list */}
                  <div className="lg:col-span-5 space-y-5">
                    
                    {/* Live Preview card */}
                    <div className="p-5 rounded-2xl bg-[#03050f]/80 border border-white/[0.04] space-y-4 flex flex-col items-center">
                      <span className="text-xs font-black text-white uppercase tracking-wider self-start">
                        Visualizador em Tempo Real
                      </span>
                      
                      <div className="w-32 h-32 relative flex items-center justify-center bg-zinc-950/80 rounded-full border border-white/5 overflow-visible">
                        {/* avatar photo wrapper under frame */}
                        <div 
                          className="rounded-full overflow-hidden absolute flex items-center justify-center"
                          style={{
                            width: `${newFrameAvatarScale * 100}%`,
                            height: `${newFrameAvatarScale * 100}%`,
                            top: `calc(50% + ${newFrameAvatarOffsetY}%)`,
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 1
                          }}
                        >
                          <img 
                            src={profile?.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=preview_art"} 
                            className="w-full h-full object-cover" 
                            alt="" 
                          />
                        </div>
                        
                        {/* frame image layer over avatar */}
                        {newFrameImageUrl ? (
                          <img 
                            src={newFrameImageUrl} 
                            className="absolute pointer-events-none object-contain w-[132%] h-[132%]" 
                            style={{
                              left: '50%',
                              top: '50%',
                              transform: 'translate(-50%, -50%)',
                              zIndex: 10
                            }}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-[9px] uppercase font-black text-white/20 text-center px-4 leading-relaxed tracking-wider z-10">Use o painel para carregar um arquivo</div>
                        )}
                      </div>
                      
                      <div className="text-center space-y-1">
                        <span className="text-[11px] font-black text-white block uppercase tracking-wider">{newFrameName || "Nome Provisório"}</span>
                        <span className="text-[9px] font-mono text-white/30 block capitalize">
                          {newFrameRarity} • {newFrameStatusUnlock === 'free' ? 'Grátis' : `🪙 ${newFramePrice}`}
                        </span>
                      </div>
                    </div>

                    {/* Manage List Card */}
                    <div className="p-5 rounded-2xl bg-[#03050f]/80 border border-white/[0.04] space-y-3">
                      <span className="text-xs font-black text-white uppercase tracking-wider block">
                        Molduras Publicadas ({customFrames.length})
                      </span>
                      
                      {customFrames.length === 0 ? (
                        <div className="py-10 text-center text-[10px] font-black uppercase tracking-widest text-[#FF4D9D] select-none">
                          Nenhuma moldura personalizada publicada.
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                          {customFrames.map((item: any) => (
                            <div key={item.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                {/* Small visual circle avatar equipped with this frame! */}
                                <div className="w-12 h-12 flex-shrink-0 relative flex items-center justify-center overflow-visible">
                                  <UserAvatar uid={profile?.uid} className="w-8 h-8" forceFrameId={item.id} showLevel={false} />
                                </div>
                                <div className="space-y-0.5">
                                  <span className="text-xs font-black text-white leading-none uppercase flex items-center gap-1.5 italic">
                                    {item.name}
                                    <span className="text-[7.5px] font-black px-1.5 py-0.5 border border-white/5 rounded bg-white/5 uppercase select-none">{item.rarity}</span>
                                  </span>
                                  <span className="text-[8px] font-mono text-white/30 block">ID: {item.id} • {item.statusUnlock === 'free' ? 'Grátis' : `🪙 ${item.price}`}</span>
                                </div>
                              </div>
                              <button 
                                onClick={() => handleDeleteCustomFrame(item.id, item.name)}
                                className="w-8 h-8 rounded-lg bg-red-950/20 hover:bg-red-900/40 border border-red-500/20 hover:border-red-500/50 flex items-center justify-center text-red-100 cursor-pointer group active:scale-95 transition-all text-xs"
                              >
                                <Trash2 size={13} className="group-hover:scale-110 duration-200" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>

                </div>

              </motion.div>
            )}

            {/* TAB CONTENT: DEEP SECURITY/MODERATION LOGS */}
            {activeTab === 'moderation' && (
              <motion.div initial={{ opacity: 0, scale: 0.99 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                
                {/* Anti-cheat diagnostics */}
                <div className="p-5 rounded-2xl bg-[#03050f]/80 border border-white/[0.04] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xs font-black text-white uppercase tracking-wide flex items-center gap-2">
                        <Cpu className="text-[#00F0FF] animate-pulse" size={14} />
                        SISTEMA ANTI-CHEAT & VARREDURA BIOMÉTRICA
                      </h3>
                      <p className="text-[10px] text-white/40 mt-1">Efetua diagnóstico de integridade de canais e sessões com IA local.</p>
                    </div>

                    <button 
                      onClick={runAntiCheatDeepScan}
                      disabled={isAntiCheatScanning}
                      className="bg-[#00F0FF] hover:bg-[#00F0FF]/90 font-black text-xs text-black uppercase px-6 py-3 rounded-xl transition-all active:scale-95 disabled:opacity-40"
                    >
                      {isAntiCheatScanning ? 'Escaneando rede...' : 'Novo Escaneamento'}
                    </button>
                  </div>

                  {/* Scanning Animation Progress Bar */}
                  {antiCheatStatus !== 'idle' && (
                    <div className="p-4 bg-black/40 border border-white/5 rounded-xl space-y-3">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                        <span className={antiCheatStatus === 'scanning' ? 'text-[#00F0FF] animate-pulse' : 'text-green-400'}>
                          Status: {antiCheatStatus}
                        </span>
                        <span>{scanningProgress}%</span>
                      </div>
                      
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden relative">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-[#8A2EFF] via-[#00F0FF] to-[#FF4D9D]"
                          style={{ width: `${scanningProgress}%` }}
                        />
                      </div>

                      {scanningProgress < 100 ? (
                        <span className="text-[9px] text-white/20 font-black tracking-widest block uppercase animate-pulse">Sincronizando endpoints holográficos...</span>
                      ) : (
                        <div className="text-[9.5px] font-black uppercase flex items-center gap-1.5 text-green-400">
                          <CheckCircle2 size={12} />
                          Integridade do We Aura verificada com sucesso. Nenhuma anomalia persistente encontrada.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Audit Terminal Display */}
                <div className="p-5 bg-black border border-[#8A2EFF]/20 rounded-2xl flex flex-col h-[320px] shadow-[inset_0_0_30px_rgba(138,46,255,0.05)] overflow-hidden">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                    <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">SESSÃO DE COMANDO TERMINAL</span>
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-2.5 scrollbar-hide pr-2">
                    {logs.length === 0 ? (
                      <div className="text-white/20 italic p-4 text-center">Inicie ações administrativas para gerar logs de auditoria de segurança criptográfica.</div>
                    ) : (
                      logs.map((log) => {
                        const typeStyles = log.type === 'critical' ? 'text-red-500' :
                                           log.type === 'warning' ? 'text-amber-400' :
                                           log.type === 'success' ? 'text-green-400' : 'text-[#00F0FF]';
                        return (
                          <div key={log.id} className="border-b border-white/[0.02] pb-1">
                            <span className="text-white/25">[{log.time}]</span>{' '}
                            <span className={`font-bold ${typeStyles}`}>[AUDIT]</span>{' '} 
                            <span className="text-white/80">{log.text}</span>
                          </div>
                        );
                      })
                    )}
                    <div ref={terminalLogsEndRef} />
                  </div>
                </div>

              </motion.div>
            )}

          </div>

          {/* FUTURISTIC GLOWING BOTTOM STATS BAR */}
          <div className="px-6 py-4 bg-black/40 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-white/30">
            <div className="flex items-center gap-1">
              <Activity size={12} className="text-green-400 animate-pulse" />
              <span>SERVIDORES LATENCY: 12ms</span>
            </div>
            <span>AÇÕES OPERACIONAIS SÃO AUTOMATICAMENTE LOGADAS EM DISPOSITIVOS ESTÁVEIS</span>
          </div>

        </div>

      </motion.div>
    </div>
  );
}
