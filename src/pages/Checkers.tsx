import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  limit, 
  serverTimestamp 
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Trophy, 
  Coins, 
  Gamepad2, 
  ArrowLeft, 
  User, 
  Info, 
  AlertCircle,
  HelpCircle,
  Check,
  ChevronRight,
  Sparkles,
  Zap,
  Flame,
  Award,
  Crown
} from 'lucide-react';
import confetti from 'canvas-confetti';

// Game Rules & Index Math:
// 8x8 checkers board uses indices 0 to 63
// Top-Left is (col 0, row 0).
// Dark cells are cells where (row + col) % 2 === 1
const BOARD_SIZE = 8;

interface MatchState {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorPhoto: string;
  player1: string; // creator UID
  player2: string | null; // joiner UID
  player2Name: string | null;
  player2Photo: string | null;
  status: 'waiting_peer' | 'playing' | 'ended';
  betAmount: number;
  winnerId: string | null;
  winnerName: string | null;
  reason: 'victory' | 'abandoned' | 'draw' | null;
  turn: 'player1' | 'player2';
  board: number[]; // 64 slots representation
  potClaimed: boolean;
  player1AuraActive: boolean;
  player2AuraActive: boolean;
}

const getInitialBoard = () => {
  const board = Array(64).fill(0);
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if ((row + col) % 2 === 1) {
        if (row < 3) {
          board[row * 8 + col] = 1; // Player 1 (Creator) - Blue Piece
        } else if (row > 4) {
          board[row * 8 + col] = 2; // Player 2 (Joiner) - Pink Piece
        }
      }
    }
  }
  return board;
};

// Retro Arcade Audio FX using Web Audio API
const playFX = (type: 'move' | 'capture' | 'win' | 'lose' | 'click' | 'claim') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    if (type === 'move') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(480, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else if (type === 'capture') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.setValueAtTime(510, ctx.currentTime + 0.08);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.28);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } else if (type === 'win') {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);
        gain.gain.setValueAtTime(0.06, ctx.currentTime + idx * 0.1);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.35);
        osc.start(ctx.currentTime + idx * 0.1);
        osc.stop(ctx.currentTime + idx * 0.1 + 0.35);
      });
    } else if (type === 'lose') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.6);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } else if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } else if (type === 'claim') {
      const notes = [587.33, 880.00, 1174.66]; // D5, A5, D6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0.06, ctx.currentTime + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.2);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.2);
      });
    }
  } catch (err) {
    console.warn("Audio blocked:", err);
  }
};

// Checkers Progression Rank ELO mapper
const getEloRankName = (elo: number) => {
  if (elo < 1100) return { name: 'Bronze III 🥉', color: 'text-amber-600', bg: 'bg-amber-600/10 border-amber-600/20' };
  if (elo < 1200) return { name: 'Bronze II 🥉', color: 'text-amber-600', bg: 'bg-amber-600/10 border-amber-600/20' };
  if (elo < 1300) return { name: 'Bronze I 🥉', color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' };
  if (elo < 1400) return { name: 'Prata III 🥈', color: 'text-zinc-400', bg: 'bg-zinc-400/10 border-zinc-400/20' };
  if (elo < 1500) return { name: 'Prata II 🥈', color: 'text-zinc-400', bg: 'bg-zinc-400/10 border-zinc-400/20' };
  if (elo < 1600) return { name: 'Prata I 🥈', color: 'text-zinc-300', bg: 'bg-zinc-300/10 border-zinc-300/20' };
  if (elo < 1700) return { name: 'Ouro III 🥇', color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/20' };
  if (elo < 1850) return { name: 'Ouro II 🥇', color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/20' };
  if (elo < 2000) return { name: 'Ouro I 🥇', color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' };
  if (elo < 2200) return { name: 'Platina II 💎', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' };
  if (elo < 2400) return { name: 'Platina I 💎', color: 'text-cyan-300', bg: 'bg-cyan-400/15 border-cyan-300/30' };
  if (elo < 2600) return { name: 'Diamante II 🔮', color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10 border-fuchsia-500/20' };
  if (elo < 2800) return { name: 'Diamante I 🔮', color: 'text-fuchsia-300', bg: 'bg-fuchsia-500/15 border-fuchsia-300/30' };
  return { name: 'Mestre da Dama 👑', color: 'text-red-400 animate-pulse', bg: 'bg-red-500/10 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]' };
};

export default function Checkers() {
  const { user, profile, updateCoins, updateProfile } = useAuth();
  const navigate = useNavigate();

  // Matchmaking / general states
  const [activeMatch, setActiveMatch] = useState<MatchState | null>(null);
  const [matchmakingBet, setMatchmakingBet] = useState<number>(100);
  const [matchmakingStatus, setMatchmakingStatus] = useState<'idle' | 'searching' | 'playing'>('idle');
  const [matchmakingDocId, setMatchmakingDocId] = useState<string | null>(null);
  
  // Game Board interactive states
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [validMovesForPiece, setValidMovesForPiece] = useState<number[]>([]);
  const [isMyTurn, setIsMyTurn] = useState<boolean>(false);
  const [myPlayerRole, setMyPlayerRole] = useState<'player1' | 'player2' | null>(null);
  const [lastBoardSync, setLastBoardSync] = useState<number[]>([]);
  const [hasCoinDeductedForThisGame, setHasCoinDeductedForThisGame] = useState<boolean>(false);
  const [showRules, setShowRules] = useState<boolean>(false);

  // Firestore reference holders to handle safe unmount state changes
  const activeMatchListenerRef = useRef<(() => void) | null>(null);
  const activeMatchDataRef = useRef<MatchState | null>(null);
  const activeIntervalRef = useRef<any>(null);
  
  // Stats inside profile helper
  const checkersElo = profile ? ((profile as any).checkersElo || 1200) : 1200;
  const checkersWins = profile ? ((profile as any).checkersWins || 0) : 0;
  const checkersLosses = profile ? ((profile as any).checkersLosses || 0) : 0;
  const checkersStreak = profile ? ((profile as any).checkersStreak || 0) : 0;
  const totalGames = checkersWins + checkersLosses;
  const winRate = totalGames > 0 ? Math.round((checkersWins / totalGames) * 100) : 0;

  // Track daily claim state
  const lastDailyClaim = profile ? ((profile as any).lastDailyClaimCheckers) : null;
  const claimCooldownMs = 24 * 60 * 60 * 1000; // 24 Hours
  const [timeUntilNextClaim, setTimeUntilNextClaim] = useState<string>('');

  useEffect(() => {
    // Check if user is already inside an active matched game to auto-reconnect
    if (user) {
      findAndReconnectActiveMatch();
    }
    
    // Auto sync daily CD text
    const interval = setInterval(() => {
      if (lastDailyClaim) {
        const lastClaimMs = typeof lastDailyClaim.toDate === 'function' ? lastDailyClaim.toDate().getTime() : new Date(lastDailyClaim).getTime();
        const now = Date.now();
        const diff = lastClaimMs + claimCooldownMs - now;
        if (diff > 0) {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const secs = Math.floor((diff % (1000 * 60)) / 1000);
          setTimeUntilNextClaim(`${hours}h ${mins}m ${secs}s`);
        } else {
          setTimeUntilNextClaim('');
        }
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      cleanupListener();
    };
  }, [user, lastDailyClaim]);

  // Clean listeners smoothly
  const cleanupListener = () => {
    if (activeMatchListenerRef.current) {
      activeMatchListenerRef.current();
      activeMatchListenerRef.current = null;
    }
    if (activeIntervalRef.current) {
      clearInterval(activeIntervalRef.current);
      activeIntervalRef.current = null;
    }
  };

  const claimDailyCoins = async () => {
    if (!user || !profile) return;
    playFX('click');
    
    if (timeUntilNextClaim !== '') {
      return;
    }

    try {
      // Award 150 Aura Coins and save claim timestamp
      await updateCoins(150, 'add');
      await updateProfile({
        lastDailyClaimCheckers: new Date().toISOString()
      });
      playFX('claim');
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#00F0FF', '#FF4D9D', '#FFD700']
      });
    } catch (err) {
      console.error("Error claiming daily frequency coins:", err);
    }
  };

  const findAndReconnectActiveMatch = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'checkers_matches'),
        where('status', '==', 'playing'),
        limit(20)
      );
      const snapshot = await getDocs(q);
      const myActiveGame = snapshot.docs.find(docSnap => {
        const d = docSnap.data();
        return d.player1 === user.uid || d.player2 === user.uid;
      });

      if (myActiveGame) {
        console.log("[Checkers] Active checkers game found on load, reconnecting instantly...", myActiveGame.id);
        setupGameListener(myActiveGame.id);
      }
    } catch (err) {
      console.error("Safe error checking for reconnection matches:", err);
      handleFirestoreError(err, OperationType.GET, 'checkers_matches');
    }
  };

  // Matchmaking Rápido
  const startMatchmaking = async () => {
    if (!user || !profile) return;
    playFX('click');

    if (profile.coins < matchmakingBet) {
      alert("Aura Coins insuficientes para esta aposta!");
      return;
    }

    setMatchmakingStatus('searching');

    try {
      // Scan for open public waiting matches with matching bet size
      const q = query(
        collection(db, 'checkers_matches'),
        where('status', '==', 'waiting_peer'),
        where('betAmount', '==', matchmakingBet),
        limit(10)
      );

      const snap = await getDocs(q);
      // Filter out any we might have created
      const availableMatches = snap.docs.filter(docSnap => docSnap.data().player1 !== user.uid);

      if (availableMatches.length > 0) {
        // Peer found! Let's join the first one
        const matchedDoc = availableMatches[0];
        const matchId = matchedDoc.id;

        // 1. Deduct our coin bet (Joiner side)
        await updateCoins(matchmakingBet, 'subtract');

        // 2. Hydrate the matchup
        const matchRef = doc(db, 'checkers_matches', matchId);
        await updateDoc(matchRef, {
          player2: user.uid,
          player2Name: profile.displayName || 'Jogador Dama',
          player2Photo: profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
          status: 'playing',
          turn: 'player1', // Creator plays first
          board: getInitialBoard(),
          lastMoveAt: serverTimestamp()
        });

        setHasCoinDeductedForThisGame(true);
        setupGameListener(matchId);
      } else {
        // No match found - create a new Match Queue Document
        const newMatchId = `checkers_match_${user.uid}_${Date.now()}`;
        const matchRef = doc(db, 'checkers_matches', newMatchId);
        
        await setDoc(matchRef, {
          id: newMatchId,
          creatorId: user.uid,
          creatorName: profile.displayName || 'Jogador Dama',
          creatorPhoto: profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
          player1: user.uid,
          player2: null,
          player2Name: null,
          player2Photo: null,
          status: 'waiting_peer',
          betAmount: matchmakingBet,
          winnerId: null,
          winnerName: null,
          reason: null,
          turn: 'player1',
          board: getInitialBoard(),
          potClaimed: false,
          player1AuraActive: true,
          player2AuraActive: false,
          createdAt: serverTimestamp()
        });

        setMatchmakingDocId(newMatchId);
        setupGameListener(newMatchId);
      }
    } catch (e) {
      console.error("Matchmaking error:", e);
      setMatchmakingStatus('idle');
      handleFirestoreError(e, OperationType.WRITE, 'checkers_matches');
    }
  };

  const cancelMatchmaking = async () => {
    playFX('click');
    cleanupListener();
    if (matchmakingDocId) {
      try {
        await deleteDoc(doc(db, 'checkers_matches', matchmakingDocId));
      } catch (e) {
        console.warn("Matches document already deleted/filled:", e);
        handleFirestoreError(e, OperationType.DELETE, `checkers_matches/${matchmakingDocId}`);
      }
    }
    setMatchmakingStatus('idle');
    setMatchmakingDocId(null);
    setActiveMatch(null);
  };

  // Subscribe to Match State Synchronization
  const setupGameListener = (matchId: string) => {
    cleanupListener();
    setMatchmakingStatus('playing');

    const matchRef = doc(db, 'checkers_matches', matchId);
    activeMatchListenerRef.current = onSnapshot(matchRef, async (snapshot) => {
      if (!snapshot.exists()) {
        console.warn("[Checkers] Game document was deleted");
        setMatchmakingStatus('idle');
        setActiveMatch(null);
        return;
      }

      const data = snapshot.data() as MatchState;
      activeMatchDataRef.current = data;
      setActiveMatch(data);

      if (data.status === 'playing') {
        const role = data.player1 === user?.uid ? 'player1' : 'player2';
        setMyPlayerRole(role);
        
        // Check coin deduction for standard creators
        if (role === 'player1' && !hasCoinDeductedForThisGame) {
          // If a player joined, deduct Creator bet amount automatically
          try {
            await updateCoins(data.betAmount, 'subtract');
            setHasCoinDeductedForThisGame(true);
          } catch (trErr) {
            console.error("Coin subtraction error for creator:", trErr);
          }
        }

        // Detect Turn shifts and play gentle audio cue
        const turnIsMine = (role === 'player1' && data.turn === 'player1') || 
                           (role === 'player2' && data.turn === 'player2');
        
        setIsMyTurn(turnIsMine);

        if (JSON.stringify(data.board) !== JSON.stringify(lastBoardSync)) {
          if (lastBoardSync.length > 0) {
            // Check if capture occurred (comparing remaining pieces count)
            const countPieces = (b: number[], types: number[]) => b.filter(val => types.includes(val)).length;
            const p1Prev = countPieces(lastBoardSync, [1, 3]);
            const p2Prev = countPieces(lastBoardSync, [2, 4]);
            const p1Curr = countPieces(data.board, [1, 3]);
            const p2Curr = countPieces(data.board, [2, 4]);
            
            if (p1Curr < p1Prev || p2Curr < p2Prev) {
              playFX('capture');
            } else {
              playFX('move');
            }
          }
          setLastBoardSync(data.board);
          setSelectedCell(null);
          setValidMovesForPiece([]);
        }
      }

      if (data.status === 'ended') {
        // Prevent double claim of the pot using doc properties as a lock
        if (data.winnerId === user?.uid && !data.potClaimed) {
          try {
            // Prevent racing conditions by claiming pot first
            await updateDoc(matchRef, { potClaimed: true });
            
            // Add full pot to user's wallet!
            const potWon = data.betAmount * 2;
            await updateCoins(potWon, 'add');
            
            // Update Elo (+25 points) and Win tally
            const newWins = checkersWins + 1;
            const newStreak = checkersStreak + 1;
            const newElo = checkersElo + 25;
            
            await updateProfile({
              checkersElo: newElo,
              checkersWins: newWins,
              checkersStreak: newStreak,
            });

            playFX('win');
            confetti({
              particleCount: 120,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#00F0FF', '#FF4D9D', '#9333EA']
            });
          } catch (claimErr) {
            console.error("Error processing winner payout transaction:", claimErr);
            handleFirestoreError(claimErr, OperationType.UPDATE, `checkers_matches/${matchId}`);
          }
        } else if (data.winnerId && data.winnerId !== user?.uid) {
          // Record local loss if we are the other player
          const isParticipant = data.player1 === user?.uid || data.player2 === user?.uid;
          if (isParticipant && checkersLosses === profile?.checkersLosses) {
            const newLosses = checkersLosses + 1;
            const newElo = Math.max(1000, checkersElo - 15);
            
            await updateProfile({
              checkersElo: newElo,
              checkersLosses: newLosses,
              checkersStreak: 0
            });
            playFX('lose');
          }
        }
        
        // Reset matchmaking coin safety flag after match completes
        setHasCoinDeductedForThisGame(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `checkers_matches/${matchId}`);
    });
  };

  // Give Up/Abandon match to enforce anti-fraud
  const forfeitMatch = async () => {
    if (!activeMatch || !user) return;
    if (window.confirm("Você tem certeza que quer desistir? Você perderá suas moedas apostadas!")) {
      playFX('click');
      const otherUid = activeMatch.player1 === user.uid ? activeMatch.player2 : activeMatch.player1;
      const otherName = activeMatch.player1 === user.uid ? activeMatch.player2Name : activeMatch.creatorName;

      try {
        const matchRef = doc(db, 'checkers_matches', activeMatch.id);
        await updateDoc(matchRef, {
          status: 'ended',
          winnerId: otherUid || 'offline_player',
          winnerName: otherName || 'Adversário',
          reason: 'abandoned',
          lastMoveAt: serverTimestamp()
        });
      } catch (err) {
        console.error("Forfeit submission failed:", err);
        handleFirestoreError(err, OperationType.UPDATE, `checkers_matches/${activeMatch.id}`);
      }
    }
  };

  // INTERACTIVE CHECKERS RULES & MATH ENGINE
  // Checkers pieces types:
  // 1 = Player 1 Standard (Blue)
  // 2 = Player 2 Standard (Pink)
  // 3 = Player 1 Dama (Blue King)
  // 4 = Player 2 Dama (Pink King)

  const getCellRowCol = (index: number) => ({
    row: Math.floor(index / 8),
    col: index % 8
  });

  const getIndex = (row: number, col: number) => row * 8 + col;

  const isValidBounds = (row: number, col: number) => {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  };

  const getOpponentTypes = (player: 'player1' | 'player2') => {
    return player === 'player1' ? [2, 4] : [1, 3];
  };

  const getMyTypes = (player: 'player1' | 'player2') => {
    return player === 'player1' ? [1, 3] : [2, 4];
  };

  // Helper: check jumps (captures) for a single cell belonging to player
  const getJumpsForCell = (board: number[], cellIndex: number, player: 'player1' | 'player2') => {
    const { row, col } = getCellRowCol(cellIndex);
    const piece = board[cellIndex];
    const opponentTypes = getOpponentTypes(player);
    const jumps: { to: number; captured: number }[] = [];

    if (piece === 0) return jumps;

    // Jumps directions: diagonal left-up, right-up, left-down, right-down
    const dirs = [
      { r: -1, c: -1 },
      { r: -1, c: 1 },
      { r: 1, c: -1 },
      { r: 1, c: 1 }
    ];

    dirs.forEach(d => {
      const oppRow = row + d.r;
      const oppCol = col + d.c;
      const landRow = row + d.r * 2;
      const landCol = col + d.c * 2;

      if (isValidBounds(oppRow, oppCol) && isValidBounds(landRow, landCol)) {
        const oppIndex = getIndex(oppRow, oppCol);
        const landIndex = getIndex(landRow, landCol);

        const oppPiece = board[oppIndex];
        const landPiece = board[landIndex];

        // Must hop over opponent piece onto an empty cell
        if (opponentTypes.includes(oppPiece) && landPiece === 0) {
          // Standard piece validation: Brazilian Damas allow standard pieces to capture forward AND backward !
          // Let's implement full active capturing (extremely fun, tactical, and standard for Damas!)
          jumps.push({
            to: landIndex,
            captured: oppIndex
          });
        }
      }
    });

    return jumps;
  };

  // Scan all entire board positions for active user jumps to enforce "Movimento Obrigatório de Captura"
  const getActivePlayerJumps = (board: number[], player: 'player1' | 'player2') => {
    const myTypes = getMyTypes(player);
    const allJumps: { from: number; to: number; captured: number }[] = [];

    for (let idx = 0; idx < board.length; idx++) {
      if (myTypes.includes(board[idx])) {
        const cellJumps = getJumpsForCell(board, idx, player);
        cellJumps.forEach(j => {
          allJumps.push({
            from: idx,
            to: j.to,
            captured: j.captured
          });
        });
      }
    }
    return allJumps;
  };

  // Simple diagonal single steps (only allowed if NO captures exist!)
  const getSimpleMovesForCell = (board: number[], cellIndex: number, player: 'player1' | 'player2') => {
    const { row, col } = getCellRowCol(cellIndex);
    const piece = board[cellIndex];
    const moves: number[] = [];

    if (piece === 0) return moves;

    const isKing = piece === 3 || piece === 4;

    // Movement directions based on rules
    // P1 (Blue) goes down (row + 1)
    // P2 (Pink) goes up (row - 1)
    // Kings (Damas) can go both directions!
    let dirs: { r: number; c: number }[] = [];
    if (isKing) {
      dirs = [
        { r: -1, c: -1 }, { r: -1, c: 1 },
        { r: 1, c: -1 }, { r: 1, c: 1 }
      ];
    } else {
      if (player === 'player1') {
        dirs = [{ r: 1, c: -1 }, { r: 1, c: 1 }]; // Cyan moves down
      } else {
        dirs = [{ r: -1, c: -1 }, { r: -1, c: 1 }]; // Pink moves up
      }
    }

    dirs.forEach(d => {
      const targetRow = row + d.r;
      const targetCol = col + d.c;
      if (isValidBounds(targetRow, targetCol)) {
        const idx = getIndex(targetRow, targetCol);
        if (board[idx] === 0) {
          moves.push(idx);
        }
      }
    });

    return moves;
  };

  // Handles clicking on cells for highlights and selection triggers
  const handleCellClick = (index: number) => {
    if (!activeMatch || !isMyTurn || !myPlayerRole) return;

    const board = activeMatch.board;
    const piece = board[index];
    const myTypes = getMyTypes(myPlayerRole);

    // 1. Clicked on own piece: select and calculate targets
    if (myTypes.includes(piece)) {
      playFX('click');
      setSelectedCell(index);

      // Analyze if there are ANY captures active on the board first
      const boardJumps = getActivePlayerJumps(board, myPlayerRole);
      
      if (boardJumps.length > 0) {
        // Enforce FORCED CAPTURE rule: only show highlight landing spaces for the selected capturing piece
        const jumpsThisPiece = boardJumps.filter(j => j.from === index);
        setValidMovesForPiece(jumpsThisPiece.map(j => j.to));
      } else {
        // Safe to show normal moves since no captures are active
        const normalMoves = getSimpleMovesForCell(board, index, myPlayerRole);
        setValidMovesForPiece(normalMoves);
      }
      return;
    }

    // 2. Clicked on highlighed landing circle target: execute move/capture !
    if (selectedCell !== null && validMovesForPiece.includes(index)) {
      executePlayerMove(selectedCell, index);
    } else {
      // De-select
      setSelectedCell(null);
      setValidMovesForPiece([]);
    }
  };

  // Rules executor: move piece and trigger syncing to Firestore
  const executePlayerMove = async (fromIndex: number, toIndex: number) => {
    if (!activeMatch || !myPlayerRole) return;

    const board = [...activeMatch.board];
    const piece = board[fromIndex];
    const { row: toRow } = getCellRowCol(toIndex);

    // Analyze if this was a capture jump
    const jumps = getActivePlayerJumps(board, myPlayerRole);
    const resolvedJump = jumps.find(j => j.from === fromIndex && j.to === toIndex);

    if (resolvedJump) {
      // 1. Remove opponent captured piece
      board[resolvedJump.captured] = 0;
    }

    // 2. Perform the step/move
    board[toIndex] = piece;
    board[fromIndex] = 0;

    // 3. Check for Automaticpromotion to Dama (King!)
    // Player 1 (Blue) becomes Dama (3) if it reaches row 7
    if (myPlayerRole === 'player1' && piece === 1 && toRow === 7) {
      board[toIndex] = 3;
    }
    // Player 2 (Pink) becomes Dama (4) if it reaches row 0
    if (myPlayerRole === 'player2' && piece === 2 && toRow === 0) {
      board[toIndex] = 4;
    }

    // Determine next turn
    const nextTurn: 'player1' | 'player2' = myPlayerRole === 'player1' ? 'player2' : 'player1';

    // 4. Validate if opponent has any legal moves left. If they don't, current player wins!
    const opponentRole = myPlayerRole === 'player1' ? 'player2' : 'player1';
    const oppJumps = getActivePlayerJumps(board, opponentRole);
    
    // Check normal moves for all opponents
    let oppHasNormalMoves = false;
    const oppTypes = getMyTypes(opponentRole);
    for (let i = 0; i < board.length; i++) {
      if (oppTypes.includes(board[i])) {
        const moves = getSimpleMovesForCell(board, i, opponentRole);
        if (moves.length > 0) {
          oppHasNormalMoves = true;
          break;
        }
      }
    }

    const myTypes = getMyTypes(myPlayerRole);

    // Detect Draw status automatically: if no elements left of either player
    const countPieces = (b: number[], types: number[]) => b.filter(val => types.includes(val)).length;
    const myPiecesLeft = countPieces(board, myTypes);
    const oppPiecesLeft = countPieces(board, oppTypes);

    let isEnded = false;
    let winnerId = activeMatch.winnerId;
    let winnerName = activeMatch.winnerName;
    let endReason = activeMatch.reason;

    if (oppPiecesLeft === 0) {
      isEnded = true;
      winnerId = user?.uid || '';
      winnerName = profile?.displayName || 'Vencedor';
      endReason = 'victory';
    } else if (myPiecesLeft === 0) {
      isEnded = true;
      winnerId = myPlayerRole === 'player1' ? activeMatch.player2 : activeMatch.player1;
      winnerName = myPlayerRole === 'player1' ? activeMatch.player2Name : activeMatch.creatorName;
      endReason = 'victory';
    } else if (oppJumps.length === 0 && !oppHasNormalMoves) {
      // Opponent is locked (no valid moves)! Current player wins standard rules
      isEnded = true;
      winnerId = user?.uid || '';
      winnerName = profile?.displayName || 'Vencedor';
      endReason = 'victory';
    } else if (oppPiecesLeft === 1 && myPiecesLeft === 1) {
      // Quick Draw detection: if only 1 pieces left on each side (both Damas, usually leads to draw loop)
      const countDamas = (b: number[], types: number[]) => b.filter(val => types.includes(val)).length;
      if (countDamas(board, [3, 4]) === 2) {
        isEnded = true;
        winnerId = 'draw';
        winnerName = 'Empate';
        endReason = 'draw';
      }
    }

    // Resets client selectors
    setSelectedCell(null);
    setValidMovesForPiece([]);

    // 5. Update Firestore matched status
    const matchRef = doc(db, 'checkers_matches', activeMatch.id);
    try {
      await updateDoc(matchRef, {
        board: board,
        turn: nextTurn,
        status: isEnded ? 'ended' : 'playing',
        winnerId,
        winnerName,
        reason: endReason,
        lastMoveAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Board sync failed:", e);
      handleFirestoreError(e, OperationType.UPDATE, `checkers_matches/${activeMatch.id}`);
    }
  };

  // Auto clean when player clicks Voltar Ao Lobby
  const returnToLobby = () => {
    cleanupListener();
    setMatchmakingStatus('idle');
    setMatchmakingDocId(null);
    setActiveMatch(null);
    setHasCoinDeductedForThisGame(false);
  };

  // Inline styling classes based on role/turn
  const pulseAuraClass = isMyTurn 
    ? 'border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.5)] scale-105' 
    : 'border-white/10 opacity-70';

  return (
    <div className="p-6 pb-28 min-h-screen bg-[#020202] text-white font-sans flex flex-col relative overflow-hidden">
      {/* Premium Ambient grid neon glow */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0c0a15_1px,transparent_1px),linear-gradient(to_bottom,#0c0a15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
      <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[350px] h-[350px] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />

      {/* HEADER SECTION */}
      <div className="relative z-10 flex items-center justify-between mb-8">
        <button 
          onClick={() => matchmakingStatus === 'playing' ? forfeitMatch() : navigate('/')}
          className="w-11 h-11 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>
        
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-black italic uppercase tracking-[0.2em] text-[#00F0FF] flex items-center gap-1.5 drop-shadow-[0_0_10px_rgba(0,240,255,0.3)]">
            <Gamepad2 size={16} />
            Damas Neon 1v1
          </h1>
          <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest mt-1">Inspired by WePlay</span>
        </div>

        <button 
          onClick={() => { playFX('click'); setShowRules(!showRules); }}
          className="w-11 h-11 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all cursor-pointer"
        >
          <Info size={18} />
        </button>
      </div>

      {/* LOBBY INTERFACE */}
      {matchmakingStatus === 'idle' && (
        <div className="flex-1 max-w-md mx-auto w-full flex flex-col gap-8 relative z-10">
          
          {/* PROFILE SUMMARY COINS AND RANK */}
          <section className="bg-[#0a0518]/60 p-6 rounded-[32px] border border-fuchsia-500/10 shadow-[0_0_50px_rgba(168,85,247,0.05)] backdrop-blur-md flex items-center justify-between relative overflow-hidden">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <img 
                  src={profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} 
                  className="w-14 h-14 rounded-2xl border border-white/10 object-cover bg-zinc-900"
                  alt=""
                />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-[#020202] rounded-full"></div>
              </div>
              
              <div>
                <h3 className="text-base font-black uppercase text-white tracking-tight italic">
                  {profile?.displayName || 'Dama Master'}
                </h3>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${getEloRankName(checkersElo).bg} ${getEloRankName(checkersElo).color}`}>
                    {getEloRankName(checkersElo).name}
                  </span>
                  <span className="text-[10px] text-white/40 font-bold font-mono">
                    {checkersElo} ELO
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[9px] text-white/30 font-bold uppercase tracking-wider">Seu Saldo</div>
              <div className="flex items-center gap-1 bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl text-yellow-500 font-bold text-sm mt-1">
                {(profile as any)?.coins || 0}
                <Coins size={14} className="animate-spin-slow text-yellow-500" />
              </div>
            </div>
          </section>

          {/* GAME STATS ROW */}
          <section className="grid grid-cols-3 gap-3">
            <div className="bg-[#08080a] p-4 rounded-3xl border border-white/[0.03] text-center">
              <span className="text-[9px] text-white/30 font-bold uppercase tracking-wider block">Vitórias</span>
              <span className="text-xl font-black text-emerald-400 mt-1 block">{checkersWins}</span>
            </div>
            <div className="bg-[#08080a] p-4 rounded-3xl border border-white/[0.03] text-center">
              <span className="text-[9px] text-white/30 font-bold uppercase tracking-wider block">Taxa de Vitória</span>
              <span className="text-xl font-black text-[#00F0FF] mt-1 block">{winRate}%</span>
            </div>
            <div className="bg-[#08080a] p-4 rounded-3xl border border-white/[0.03] text-center">
              <span className="text-[9px] text-white/30 font-bold uppercase tracking-wider block">Série Ativa</span>
              <span className="text-xl font-black text-[#FF4D9D] mt-1 block">🔥 {checkersStreak}</span>
            </div>
          </section>

          {/* DAILY RECLAIM SYSTEM BOOSTS RETENTION */}
          <section className="bg-gradient-to-r from-purple-950/20 to-[#FF4D9D]/5 border border-purple-500/10 p-5 rounded-3xl flex items-center justify-between relative overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                <Sparkles size={20} className="animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-black text-white uppercase tracking-tight">Frequência Diária</h4>
                <p className="text-[10px] text-white/40 mt-1">Ganhe +150 Aura Coins grátis se estiver zerado!</p>
              </div>
            </div>
            
            <button
              onClick={claimDailyCoins}
              disabled={timeUntilNextClaim !== ''}
              className={`px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-wider shadow-lg active:scale-95 transition-all outline-none ${
                timeUntilNextClaim !== ''
                  ? 'bg-white/5 border border-white/5 text-white/20'
                  : 'bg-yellow-500 text-black hover:bg-yellow-400'
              }`}
            >
              {timeUntilNextClaim !== '' ? timeUntilNextClaim : 'Resgatar'}
            </button>
          </section>

          {/* BET PICKER DIALOG */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-black italic uppercase text-white/60 tracking-wider">Escolha a Aposta da Partida</h3>
              <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest bg-purple-500/5 px-2 py-0.5 rounded border border-purple-500/10">Vencedor Leva Tudo</span>
            </div>

            <div className="grid grid-cols-5 gap-2 bg-black/60 p-2.5 rounded-[28px] border border-white/5">
              {[50, 100, 200, 500, 1000].map((bet) => {
                const isSelected = matchmakingBet === bet;
                return (
                  <button
                    key={bet}
                    onClick={() => { playFX('click'); setMatchmakingBet(bet); }}
                    className={`py-4 px-2.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all text-xs outline-none cursor-pointer ${
                      isSelected 
                        ? 'bg-gradient-to-tr from-purple-600 to-[#FF4D9D] border border-pink-500 text-white font-black scale-105 shadow-[0_0_15px_rgba(249,115,22,0.15)]' 
                        : 'bg-[#0f0f12] text-white/40 hover:text-white/60 hover:bg-zinc-900 border border-white/[0.02]'
                    }`}
                  >
                    <Coins size={12} className={isSelected ? 'text-yellow-300' : 'text-white/20'} />
                    <span className="font-mono font-bold leading-none">{bet}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* START SEACH TRIGGER BUTTON */}
          <button
            onClick={startMatchmaking}
            className="w-full py-5 bg-gradient-to-r from-[#00F0FF] via-purple-600 to-[#FF4D9D] font-black uppercase text-xs tracking-[0.25em] text-white rounded-[32px] shadow-[0_0_40px_rgba(168,85,247,0.35)] hover:shadow-[0_0_60px_rgba(168,85,247,0.5)] active:scale-95 transition-all text-center flex items-center justify-center gap-2 cursor-pointer mt-auto border border-white/10"
          >
            <Zap size={14} className="animate-bounce" />
            PARTIDA MULTIPLAYER RÁPIDA
          </button>
        </div>
      )}

      {/* SEARCHING / MATCHMAKING QUEUE HUD */}
      {matchmakingStatus === 'searching' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 relative z-10 max-w-sm mx-auto">
          <div className="relative">
            {/* Ambient loading pulses */}
            <div className="absolute inset-0 bg-[#00F0FF]/10 blur-[50px] rounded-full animate-ping" />
            <div className="w-24 h-24 rounded-[36px] bg-[#0c0c0e] border border-purple-500/30 flex items-center justify-center shadow-2xl relative">
              <Gamepad2 size={40} className="text-[#00F0FF] animate-bounce" />
              <div className="absolute -inset-1 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>

          <div className="text-center space-y-3">
            <h3 className="text-xl font-black italic uppercase tracking-widest text-white leading-none">Buscando Oponente...</h3>
            <p className="text-xs text-white/30 leading-normal max-w-xs uppercase tracking-wider font-semibold font-mono">
              Aposta: <span className="text-yellow-500 font-black">{matchmakingBet} Aura Coins</span>
            </p>
            <p className="text-[10px] text-white/20 mt-4 leading-relaxed max-w-[200px] mx-auto text-center font-medium">
              Sugerimos manter a página aberta. Matchmaking leva em torno de 10 a 20 segundos.
            </p>
          </div>

          <button
            onClick={cancelMatchmaking}
            className="py-4 px-10 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all outline-none mt-4 cursor-pointer"
          >
            Cancelar Busca
          </button>
        </div>
      )}

      {/* ACTIVE GAMEBOARD SCREEN */}
      {matchmakingStatus === 'playing' && activeMatch && (
        <div className="flex-1 w-full max-w-md mx-auto flex flex-col justify-between relative z-10">
          
          {/* TOP COMBAT HEADS HUD */}
          <section className="bg-black/40 border border-white/5 p-4 rounded-3xl backdrop-blur-md flex items-center justify-between gap-4">
            
            {/* Player 1 Details */}
            <div className={`flex items-center gap-2.5 p-2 rounded-2xl border transition-all ${
              activeMatch.turn === 'player1' ? 'bg-[#00F0FF]/5 border-[#00F0FF]/30 shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'border-transparent opacity-60'
            }`}>
              <div className="relative">
                <img 
                  src={activeMatch.creatorPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=p1`} 
                  className="w-10 h-10 rounded-xl object-cover border border-[#00F0FF]/40 bg-zinc-900"
                  alt=""
                />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#00F0FF]/25 border border-[#00F0FF] rounded-lg text-[8px] font-black text-white flex items-center justify-center">P1</span>
              </div>
              <div className="text-left w-24">
                <h4 className="text-xs font-black uppercase text-white truncate">{activeMatch.creatorName.split(' ')[0]}</h4>
                <span className="text-[9px] text-[#00F0FF] font-black block mt-0.5">Azul</span>
              </div>
            </div>

            {/* Battle Pot Container */}
            <div className="flex flex-col items-center shrink-0">
              <span className="text-[8px] text-white/30 font-bold uppercase tracking-widest">Pote Total</span>
              <div className="flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded-full mt-1 animate-pulse">
                <Coins size={14} className="text-yellow-400" />
                <span className="text-xs font-black text-yellow-300 font-mono leading-none">{activeMatch.betAmount * 2}</span>
              </div>
            </div>

            {/* Player 2 Details */}
            <div className={`flex items-center gap-2.5 p-2 rounded-2xl border transition-all ${
              activeMatch.turn === 'player2' ? 'bg-[#FF4D9D]/5 border-[#FF4D9D]/30 shadow-[0_0_15px_rgba(255,77,157,0.1)]' : 'border-transparent opacity-60'
            }`}>
              <div className="text-right w-24">
                <h4 className="text-xs font-black uppercase text-white truncate">{activeMatch.player2Name ? activeMatch.player2Name.split(' ')[0] : 'Buscando...'}</h4>
                <span className="text-[9px] text-[#FF4D9D] font-black block mt-0.5">Rosa</span>
              </div>
              <div className="relative">
                <img 
                  src={activeMatch.player2Photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=p2`} 
                  className="w-10 h-10 rounded-xl object-cover border border-[#FF4D9D]/40 bg-zinc-900"
                  alt=""
                />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#FF4D9D]/25 border border-[#FF4D9D] rounded-lg text-[8px] font-black text-white flex items-center justify-center">P2</span>
              </div>
            </div>
          </section>

          {/* TURN BAR CARD INDICATOR */}
          <div className="my-4 text-center">
            {activeMatch.status === 'playing' ? (
              <div className={`inline-flex items-center gap-2.5 px-6 py-2.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${
                isMyTurn 
                  ? 'bg-purple-600/10 border-purple-500 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]' 
                  : 'bg-white/5 border-white/5 text-white/30'
              }`}>
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isMyTurn ? 'bg-purple-400' : 'bg-white/30'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isMyTurn ? 'bg-purple-400' : 'bg-white/30'}`}></span>
                </span>
                {isMyTurn ? 'Sua vez de Jogar!' : 'Escrevendo estratégia...'}
              </div>
            ) : (
              <div className="text-yellow-400 font-bold uppercase text-xs tracking-widest">Partida Terminada</div>
            )}
          </div>

          {/* CHECKERS BOARD CONTAINER FRAME */}
          <section className="relative aspect-square w-full bg-[#050505] rounded-[36px] border border-purple-900/40 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
            {/* Neon corner glowing highlights */}
            <div className="absolute top-0 left-0 w-24 h-24 bg-purple-500/5 blur-[40px] pointer-events-none rounded-full" />
            <div className="absolute bottom-0 right-0 w-24 h-24 bg-cyan-500/5 blur-[40px] pointer-events-none rounded-full" />

            <div className="grid grid-cols-8 grid-rows-8 h-full w-full gap-1 p-1 rounded-2xl bg-[#09090b] relative z-10 border border-white/[0.04]">
              {Array(64).fill(0).map((_, index) => {
                const { row, col } = getCellRowCol(index);
                const isDarkCell = (row + col) % 2 === 1;
                const cellPieceValue = activeMatch.board[index];
                const isSelected = selectedCell === index;
                const isValidTarget = validMovesForPiece.includes(index);

                // Colors for pieces: player 1 standard (1), player 2 standard (2), player 1 king (3), player 2 king (4)
                const isP1Piece = cellPieceValue === 1 || cellPieceValue === 3;
                const isP2Piece = cellPieceValue === 2 || cellPieceValue === 4;
                const isKing = cellPieceValue === 3 || cellPieceValue === 4;

                let cellBgClass = 'bg-[#151518]'; // Alternate light-dark cells
                if (isDarkCell) {
                  cellBgClass = 'bg-[#0b0b0d]'; 
                }

                // Interactive target indicators
                return (
                  <div
                    key={index}
                    onClick={() => handleCellClick(index)}
                    className={`relative rounded-lg flex items-center justify-center transition-all cursor-pointer select-none ${cellBgClass} ${
                      isSelected ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-black' : ''
                    }`}
                  >
                    {/* Dark coordinates coordinates (subtle) */}
                    {index % 8 === 0 && (
                      <span className="absolute bottom-0.5 left-1 text-[6.5px] font-black text-white/10 uppercase leading-none">{8 - row}</span>
                    )}
                    {row === 7 && (
                      <span className="absolute bottom-0.5 right-1 text-[6.5px] font-black text-white/10 uppercase leading-none">{String.fromCharCode(65 + col)}</span>
                    )}

                    {/* Valid targets glow rings */}
                    {isValidTarget && (
                      <div className="absolute w-7 h-7 rounded-full border-2 border-purple-500/80 bg-purple-500/15 shadow-[0_0_12px_rgba(168,85,247,0.4)] animate-pulse flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                      </div>
                    )}

                    {/* PIECE EMBELLISHMENT */}
                    {cellPieceValue !== 0 && (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`w-4/5 h-4/5 rounded-full flex items-center justify-center transition-all pointer-events-none relative active:scale-95 ${
                          isP1Piece 
                            ? 'bg-gradient-to-tr from-[#00A3FF] to-[#00F0FF] border border-[#d2f3ff]/30 shadow-[0_0_15px_rgba(0,240,255,0.45)]' 
                            : 'bg-gradient-to-tr from-[#E10074] to-[#FF4D9D] border border-[#ffd2ed]/30 shadow-[0_0_15px_rgba(255,77,157,0.45)]'
                        }`}
                      >
                        {/* Radial ridged 3D checkers ridges */}
                        <div className="absolute inset-1 border border-white/10 rounded-full" />
                        <div className="absolute inset-2 border border-black/10 rounded-full" />
                        
                        {/* Crown icon on Damas (Kings!) */}
                        {isKing && (
                          <Crown size={14} className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] fill-white/10 animate-pulse relative z-10" />
                        )}
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* LOWER ACTIONS BUTTON & FORFEIT RESIGN ACTIONS */}
          <section className="mt-6 flex flex-col gap-3">
            {/* Show Captura Obrigatória alert if any jump is active */}
            {isMyTurn && getActivePlayerJumps(activeMatch.board, myPlayerRole || 'player1').length > 0 && (
              <div className="p-3 bg-fuchsia-500/5 border border-fuchsia-500/20 rounded-2xl flex items-center gap-2 justify-center">
                <AlertCircle size={14} className="text-[#FF4D9D] animate-bounce" />
                <span className="text-[10px] font-black text-[#FF4D9D] uppercase tracking-wider">Captura Obrigatória Ativa!</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={forfeitMatch}
                className="flex-1 py-4.5 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 hover:border-red-500/30 text-red-400 font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all cursor-pointer"
              >
                Render-se / Abandonar
              </button>
            </div>
          </section>
        </div>
      )}

      {/* GAME ENDED SUMMARY SCREEN */}
      {matchmakingStatus === 'playing' && activeMatch && activeMatch.status === 'ended' && (
        <AnimatePresence>
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/85 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm bg-[#0e0a1b] border border-purple-500/35 rounded-[38px] p-8 shadow-2xl relative text-center overflow-hidden"
            >
              {/* Background gradient decorative glowing circles */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-purple-500/10 blur-[80px] pointer-events-none rounded-full" />
              
              <div className="flex flex-col items-center">
                <div className={`w-18 h-18 rounded-3xl flex items-center justify-center border mb-6 ${
                  activeMatch.winnerId === user?.uid 
                    ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.3)] animate-bounce' 
                    : 'bg-[#FF4D9D]/10 border-[#FF4D9D]/30 text-[#FF4D9D]'
                }`}>
                  <Trophy size={36} />
                </div>

                <h3 className="text-xl font-black italic uppercase tracking-tighter text-white leading-none">
                  {activeMatch.winnerId === 'draw' ? 'Empate Técnico!' : (activeMatch.winnerId === user?.uid ? 'Vitória Estelar!' : 'Derrota!')}
                </h3>
                
                <p className="text-xs text-white/40 uppercase tracking-widest font-black font-mono mt-2">
                  {activeMatch.reason === 'abandoned' ? 'Por Abandono/W.O' : 'Partida Encerrada'}
                </p>

                <div className="w-full bg-black/30 border border-white/5 p-4 rounded-3xl my-6 flex flex-col gap-2.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/40 font-bold uppercase text-[9px] tracking-wider">Pote Vencedor</span>
                    <span className="font-mono font-black text-yellow-400">🪙 {activeMatch.betAmount * 2} Aura Coins</span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-white/5 pt-2.5">
                    <span className="text-white/40 font-bold uppercase text-[9px] tracking-wider">Ajuste de Classificação</span>
                    <span className={`font-mono font-black ${activeMatch.winnerId === user?.uid ? 'text-emerald-400' : 'text-red-400'}`}>
                      {activeMatch.winnerId === 'draw' ? '+0 ELO' : (activeMatch.winnerId === user?.uid ? '+25 ELO' : '-15 ELO')}
                    </span>
                  </div>
                </div>

                <button
                  onClick={returnToLobby}
                  className="w-full py-4.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all text-center cursor-pointer"
                >
                  Voltar ao Lobby
                </button>
              </div>
            </motion.div>
          </div>
        </AnimatePresence>
      )}

      {/* RULES / INSTRUCTIONS MODAL DRAWER */}
      <AnimatePresence>
        {showRules && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRules(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-[#09090b] border border-white/10 rounded-[36px] p-6 shadow-2xl text-left"
            >
              <div className="flex items-center gap-3 pb-4 border-b border-white/5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#00F0FF]/10 flex items-center justify-center text-[#00F0FF] border border-[#00F0FF]/25">
                  <Info size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-black italic uppercase tracking-widest text-white leading-none">Regras da Dama Neon</h4>
                  <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Guia Rápido de Combate</span>
                </div>
              </div>

              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1 text-xs text-white/70 leading-relaxed font-sans no-scrollbar">
                <div className="space-y-1">
                  <h5 className="font-black text-white uppercase text-[9px] tracking-wider text-purple-400">1. SISTEMA COIN & APOSTA</h5>
                  <p>Antes de carregar a busca de Peer, escolha a aposta. Ambos os jogadores pagam o valor da aposta de forma segura, criando o Pote de Batalha de moedas.</p>
                </div>
                <div className="space-y-1">
                  <h5 className="font-black text-white uppercase text-[9px] tracking-wider text-purple-400">2. CAPTURA OBRIGATÓRIA</h5>
                  <p>Regra de Ouro: Se houver qualquer captura disponível em qualquer lugar do tabuleiro, o jogo desativa movimentos normais. Você é obrigado a capturar o peão adversário!</p>
                </div>
                <div className="space-y-1">
                  <h5 className="font-black text-white uppercase text-[9px] tracking-wider text-[#00F0FF]">3. MOVIMENTO ULTRA-RÁPIDO</h5>
                  <p>As peças normais movem-se 1 casa diagonal para frente. Jumps de captura ocorrem tanto para frente quanto para trás. Ao atingir o lado extremo adversário, sua peça é automaticamente coroada como Dama (King)!</p>
                </div>
                <div className="space-y-1">
                  <h5 className="font-black text-white uppercase text-[9px] tracking-wider text-[#FF4D9D]">4. PROTEÇÃO ANTI-FRAUDE</h5>
                  <p>Para evitar trapaças por abandono, se o jogador render-se ou sair da página durante a batalha, o adversário ganha o pote instantaneamente por WO!</p>
                </div>
              </div>

              <button
                onClick={() => { playFX('click'); setShowRules(false); }}
                className="w-full mt-6 py-4 bg-white/5 border border-white/5 hover:bg-white/10 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all outline-none text-center cursor-pointer"
              >
                Entendido, Vamos Jogar!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
