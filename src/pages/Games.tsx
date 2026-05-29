import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Gamepad2, Trophy, Coins, Zap, RefreshCw, X, Play, 
  Cpu, User, Check, Flame, ChevronRight, HelpCircle, 
  Bomb, AlertOctagon, TrendingUp, Sparkles, Star, Target,
  Globe, Search
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  limit, 
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore';

const SEED_AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Ane',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Jack'
];

export default function Games() {
  const { user, profile, updateCoins, updateProfile } = useAuth();
  const navigate = useNavigate();

  // Navigation Profile Sync
  const coins = profile?.coins || 0;
  const checkersElo = profile ? ((profile as any).checkersElo || 1200) : 1200;
  const checkersWins = profile ? ((profile as any).checkersWins || 0) : 0;
  const checkersLosses = profile ? ((profile as any).checkersLosses || 0) : 0;
  const checkersStreak = profile ? ((profile as any).checkersStreak || 0) : 0;
  const totalCheckersGames = checkersWins + checkersLosses;
  const checkersWinRate = totalCheckersGames > 0 ? Math.round((checkersWins / totalCheckersGames) * 100) : 0;

  // Active game modal states
  const [activeModal, setActiveModal] = useState<'ticTac' | 'mines' | 'reflex' | null>(null);

  // Sound generator helper
  const playSynthSound = (type: 'win' | 'lose' | 'click' | 'explosion' | 'reveal' | 'tick') => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      if (type === 'click') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'reveal') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(350, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'win') {
        // High Arpeggio
        [0, 0.1, 0.2].forEach((delay, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
          osc.frequency.setValueAtTime(freqs[i], ctx.currentTime + delay);
          gain.gain.setValueAtTime(0.05, ctx.currentTime + delay);
          gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + delay + 0.25);
          osc.start(ctx.currentTime + delay);
          osc.stop(ctx.currentTime + delay + 0.25);
        });
      } else if (type === 'lose' || type === 'explosion') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(40, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } else if (type === 'tick') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.03, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      }
    } catch (e) {
      console.warn("Browser block on AudioContext:", e);
    }
  };

  const getEloRankName = (elo: number) => {
    if (elo < 1100) return { name: 'Bronze', bg: 'bg-[#C5A059]/10 border-[#C5A059]/20', color: 'text-[#C5A059]' };
    if (elo < 1250) return { name: 'Prata', bg: 'bg-zinc-400/10 border-zinc-400/20', color: 'text-zinc-400' };
    if (elo < 1400) return { name: 'Ouro', bg: 'bg-yellow-500/10 border-yellow-500/20', color: 'text-yellow-500' };
    if (elo < 1600) return { name: 'Platina', bg: 'bg-[#00F0FF]/10 border-[#00F0FF]/20', color: 'text-[#00F0FF]' };
    return { name: 'Lenda', bg: 'bg-indigo-500/10 border-indigo-500/20', color: 'text-indigo-400' };
  };

  // ==========================================
  // JOGO 2 CORE: TIC-TAC-TOE (VELHA) WITH BOT / ONLINE
  // ==========================================
  const [ticBoard, setTicBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [ticIsXNext, setTicIsXNext] = useState<boolean>(true);
  const [ticMode, setTicMode] = useState<'bot' | 'local' | 'online'>('bot');
  const [ticDifficulty, setTicDifficulty] = useState<'easy' | 'medium' | 'impossible'>('medium');
  const [ticWinner, setTicWinner] = useState<string | 'Draw' | null>(null);
  const [ticWinningLine, setTicWinningLine] = useState<number[] | null>(null);
  const [ticStatusMsg, setTicStatusMsg] = useState<string>('Sua vez! Faça a jogada.');

  // Online Multiplayer state
  const [onlineMatches, setOnlineMatches] = useState<any[]>([]);
  const [activeOnlineMatch, setActiveOnlineMatch] = useState<any>(null);
  const [loadingMatches, setLoadingMatches] = useState<boolean>(false);
  const [creatingMatch, setCreatingMatch] = useState<boolean>(false);
  const [joiningMatch, setJoiningMatch] = useState<string | null>(null);
  const [onlineBetAmount, setOnlineBetAmount] = useState<number>(0);
  const processedMatchIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (activeModal === 'ticTac') {
      resetTicGame();
    }
  }, [activeModal]);

  // Cancel match logic when exiting game or switching mode
  const cancelWaitingMatch = async () => {
    if (!activeOnlineMatch || !user) return;
    playSynthSound('click');
    try {
      const matchId = activeOnlineMatch.id;
      const bet = activeOnlineMatch.betAmount;
      await deleteDoc(doc(db, 'tictactoe_matches', matchId));
      if (bet > 0) {
        await updateCoins(bet, 'add');
      }
      setActiveOnlineMatch(null);
    } catch (e) {
      console.error("Erro ao cancelar partida:", e);
      handleFirestoreError(e, OperationType.DELETE, `tictactoe_matches/${activeOnlineMatch.id}`);
    }
  };

  const leaveOnlineMatch = async () => {
    if (!activeOnlineMatch || !user) return;
    playSynthSound('click');
    try {
      const matchRef = doc(db, 'tictactoe_matches', activeOnlineMatch.id);
      if (activeOnlineMatch.status === 'playing') {
        const opponentId = activeOnlineMatch.player1 === user.uid ? activeOnlineMatch.player2 : activeOnlineMatch.player1;
        await updateDoc(matchRef, {
          status: 'ended',
          winner: opponentId,
          winningLine: null,
          updatedAt: serverTimestamp()
        });
      } else if (activeOnlineMatch.status === 'waiting') {
        await cancelWaitingMatch();
        return;
      }
      setActiveOnlineMatch(null);
      resetTicGame();
    } catch (e) {
      console.error("Erro ao sair da partida:", e);
      setActiveOnlineMatch(null);
      resetTicGame();
      handleFirestoreError(e, OperationType.UPDATE, `tictactoe_matches/${activeOnlineMatch.id}`);
    }
  };

  const resetTicGame = () => {
    setTicBoard(Array(9).fill(null));
    setTicIsXNext(true);
    setTicWinner(null);
    setTicWinningLine(null);
    setTicStatusMsg('Escolha sua casa! Você joga com X.');
  };

  // Subscribe to open matches
  useEffect(() => {
    if (ticMode !== 'online' || activeModal !== 'ticTac') {
      setOnlineMatches([]);
      return;
    }

    setLoadingMatches(true);
    const q = query(
      collection(db, 'tictactoe_matches'),
      where('status', '==', 'waiting')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const matches = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setOnlineMatches(matches);
      setLoadingMatches(false);
    }, (err) => {
      console.error("Error fetching online tictactoe matches:", err);
      setLoadingMatches(false);
      handleFirestoreError(err, OperationType.LIST, 'tictactoe_matches');
    });

    return () => unsubscribe();
  }, [ticMode, activeModal]);

  // Subscribe to the active online match
  useEffect(() => {
    if (!activeOnlineMatch?.id || ticMode !== 'online' || activeModal !== 'ticTac' || !user?.uid) {
      return;
    }

    const docRef = doc(db, 'tictactoe_matches', activeOnlineMatch.id);
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const currentMatchState = { id: snap.id, ...data };
        setActiveOnlineMatch(currentMatchState);

        if (data.board) {
          setTicBoard(data.board);
        }
        
        if (data.winner) {
          setTicWinner(data.winner);
          setTicWinningLine(data.winningLine || null);
          
          if (data.status === 'ended') {
            const mId = snap.id;
            if (processedMatchIdRef.current !== mId) {
              processedMatchIdRef.current = mId;
              
              if (data.winner === user.uid) {
                if (data.betAmount > 0 && !data.potClaimedByWinner) {
                  const totalPot = data.betAmount * 2;
                  updateCoins(totalPot, 'add').catch(console.error);
                  updateDoc(docRef, { potClaimedByWinner: true }).catch(() => {});
                  setTicStatusMsg(`Você venceu a partida online! +${totalPot} Aura Coins creditados! 🎉`);
                } else {
                  setTicStatusMsg('Você venceu! Incrível! 🎉');
                }
                playSynthSound('win');
                confetti({ particleCount: 60, spread: 40 });
              } else if (data.winner === 'Draw') {
                setTicStatusMsg('Empate online! Ótimo jogo.');
                playSynthSound('click');
                if (data.betAmount > 0 && !(data.refundedUsers || []).includes(user.uid)) {
                  updateCoins(data.betAmount, 'add').catch(console.error);
                  updateDoc(docRef, {
                    refundedUsers: arrayUnion(user.uid)
                  }).catch(() => {});
                }
              } else {
                setTicStatusMsg('Seu oponente venceu! Boa sorte na próxima.');
                playSynthSound('lose');
              }
            }
          }
        } else {
          if (data.turn === user.uid) {
            setTicStatusMsg('Sua vez de jogar! Pensa bem.');
          } else {
            const opponentName = data.player1 === user.uid ? (data.player2Name || 'Oponente') : data.player1Name;
            setTicStatusMsg(`Vez de ${opponentName}...`);
          }
        }
      } else {
        setActiveOnlineMatch(null);
        resetTicGame();
      }
    }, (err) => {
      console.error("Error subscribing to active online match:", err);
      handleFirestoreError(err, OperationType.GET, `tictactoe_matches/${activeOnlineMatch.id}`);
    });

    return () => unsubscribe();
  }, [activeOnlineMatch?.id, ticMode, activeModal, user?.uid]);

  const createOnlineMatch = async (bet: number) => {
    if (!user) return;
    if (coins < bet) {
      alert("Moedas insuficientes para essa aposta!");
      return;
    }

    setCreatingMatch(true);
    playSynthSound('click');

    try {
      if (bet > 0) {
        await updateCoins(bet, 'remove');
      }

      const matchId = `ttt_${user.uid}_${Date.now()}`;
      const matchDoc = {
        player1: user.uid,
        player1Name: profile?.displayName || 'Jogador Aura',
        player1Photo: profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
        player2: null,
        player2Name: null,
        player2Photo: null,
        status: 'waiting',
        betAmount: bet,
        board: Array(9).fill(null),
        turn: user.uid,
        winner: null,
        winningLine: null,
        updatedAt: serverTimestamp(),
        potClaimedByWinner: false,
        refundedUsers: []
      };

      await setDoc(doc(db, 'tictactoe_matches', matchId), matchDoc);
      processedMatchIdRef.current = null;
      setActiveOnlineMatch({ id: matchId, ...matchDoc });
    } catch (e) {
      console.error("Erro ao criar partida online:", e);
      if (bet > 0) {
        await updateCoins(bet, 'add');
      }
      handleFirestoreError(e, OperationType.CREATE, 'tictactoe_matches');
    } finally {
      setCreatingMatch(false);
    }
  };

  const joinOnlineMatch = async (match: any) => {
    if (!user) return;
    if (coins < match.betAmount) {
      alert("Moedas insuficientes para entrar nessa partida!");
      return;
    }
    
    setJoiningMatch(match.id);
    playSynthSound('click');

    try {
      if (match.betAmount > 0) {
        await updateCoins(match.betAmount, 'remove');
      }

      const matchRef = doc(db, 'tictactoe_matches', match.id);
      await updateDoc(matchRef, {
        player2: user.uid,
        player2Name: profile?.displayName || 'Jogador Aura',
        player2Photo: profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
        status: 'playing',
        updatedAt: serverTimestamp()
      });

      processedMatchIdRef.current = null;
      setActiveOnlineMatch({
        ...match,
        player2: user.uid,
        player2Name: profile?.displayName || 'Jogador Aura',
        player2Photo: profile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
        status: 'playing'
      });
    } catch (e) {
      console.error("Erro ao entrar na partida:", e);
      if (match.betAmount > 0) {
        await updateCoins(match.betAmount, 'add');
      }
      handleFirestoreError(e, OperationType.UPDATE, `tictactoe_matches/${match.id}`);
    } finally {
      setJoiningMatch(null);
    }
  };

  // Calculate winner
  const checkWinner = (board: (string | null)[]) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
      [0, 4, 8], [2, 4, 6]             // diagonals
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a], line: lines[i] };
      }
    }
    if (board.every(cell => cell !== null)) {
      return { winner: 'Draw', line: null };
    }
    return null;
  };

  const handleTicCellClick = async (index: number) => {
    if (ticBoard[index] || ticWinner || !user) return;
    playSynthSound('click');

    if (ticMode === 'online') {
      if (!activeOnlineMatch || activeOnlineMatch.status !== 'playing') return;
      if (activeOnlineMatch.turn !== user.uid) return;

      const symbol = activeOnlineMatch.player1 === user.uid ? 'X' : 'O';
      const newBoard = [...ticBoard];
      newBoard[index] = symbol;

      const winResult = checkWinner(newBoard);
      const matchRef = doc(db, 'tictactoe_matches', activeOnlineMatch.id);

      try {
        if (winResult) {
          let matchWinner = null;
          if (winResult.winner === 'X') {
            matchWinner = activeOnlineMatch.player1;
          } else if (winResult.winner === 'O') {
            matchWinner = activeOnlineMatch.player2;
          } else {
            matchWinner = 'Draw';
          }

          const totalPot = activeOnlineMatch.betAmount * 2;
          
          await updateDoc(matchRef, {
            board: newBoard,
            winner: matchWinner,
            winningLine: winResult.line,
            status: 'ended',
            updatedAt: serverTimestamp()
          });

          if (matchWinner === user.uid && totalPot > 0) {
            await updateCoins(totalPot, 'add');
            await updateDoc(matchRef, { potClaimedByWinner: true });
            setTicStatusMsg(`Você venceu a partida online! +${totalPot} Aura Coins creditados! 🎉`);
          } else if (matchWinner === 'Draw' && activeOnlineMatch.betAmount > 0) {
            await updateCoins(activeOnlineMatch.betAmount, 'add');
            await updateDoc(matchRef, {
              refundedUsers: arrayUnion(user.uid)
            });
          }
        } else {
          const nextTurn = activeOnlineMatch.player1 === user.uid ? activeOnlineMatch.player2 : activeOnlineMatch.player1;
          await updateDoc(matchRef, {
            board: newBoard,
            turn: nextTurn,
            updatedAt: serverTimestamp()
          });
        }
      } catch (e) {
        console.error("Erro ao registrar jogada:", e);
        handleFirestoreError(e, OperationType.UPDATE, `tictactoe_matches/${activeOnlineMatch.id}`);
      }
    } else {
      const newBoard = [...ticBoard];
      newBoard[index] = ticIsXNext ? 'X' : 'O';
      setTicBoard(newBoard);

      const winResult = checkWinner(newBoard);
      if (winResult) {
        concludeTicGame(winResult.winner, winResult.line, newBoard);
        return;
      }

      if (ticMode === 'bot') {
        setTicIsXNext(false);
        setTicStatusMsg('IA pensando...');
        setTimeout(() => {
          makeBotMove(newBoard);
        }, 500);
      } else {
        setTicIsXNext(!ticIsXNext);
        setTicStatusMsg(`Vez do jogador ${!ticIsXNext ? 'X' : 'O'}`);
      }
    }
  };

  const makeBotMove = (currentBoard: (string | null)[]) => {
    const emptyCells = currentBoard.map((c, idx) => c === null ? idx : null).filter((v): v is number => v !== null);
    if (emptyCells.length === 0) return;

    let targetIndex = -1;

    if (ticDifficulty === 'easy') {
      // Complete random
      targetIndex = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    } else if (ticDifficulty === 'medium') {
      // 50% minimax capability, 50% direct block
      // 1. Try to win
      const botWinIdx = findWinningMove(currentBoard, 'O');
      if (botWinIdx !== -1) {
        targetIndex = botWinIdx;
      } else {
        // 2. Try to block player win
        const playerWinIdx = findWinningMove(currentBoard, 'X');
        if (playerWinIdx !== -1) {
          targetIndex = playerWinIdx;
        } else {
          targetIndex = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        }
      }
    } else {
      // 'impossible' - pure minimax algorithm
      let bestScore = -Infinity;
      for (const idx of emptyCells) {
        const boardCopy = [...currentBoard];
        boardCopy[idx] = 'O';
        const score = runMinimax(boardCopy, 0, false);
        if (score > bestScore) {
          bestScore = score;
          targetIndex = idx;
        }
      }
    }

    if (targetIndex !== -1) {
      const finalBoard = [...currentBoard];
      finalBoard[targetIndex] = 'O';
      setTicBoard(finalBoard);
      playSynthSound('click');

      const winResult = checkWinner(finalBoard);
      if (winResult) {
        concludeTicGame(winResult.winner, winResult.line, finalBoard);
      } else {
        setTicIsXNext(true);
        setTicStatusMsg('Sua vez! Faça de novo.');
      }
    }
  };

  // Helper helper to find if there's a winning cell right away
  const findWinningMove = (board: (string | null)[], symbol: string): number => {
    const emptyIndices = board.map((c, i) => c === null ? i : null).filter((v): v is number => v !== null);
    for (const idx of emptyIndices) {
      const boardCopy = [...board];
      boardCopy[idx] = symbol;
      const res = checkWinner(boardCopy);
      if (res && res.winner === symbol) {
        return idx;
      }
    }
    return -1;
  };

  // Minimax calculations
  const runMinimax = (board: (string | null)[], depth: number, isMaximizing: boolean): number => {
    const res = checkWinner(board);
    if (res) {
      if (res.winner === 'O') return 10 - depth; // Bot wins is plus
      if (res.winner === 'X') return depth - 10; // Player wins is minus
      if (res.winner === 'Draw') return 0;
    }

    const empty = board.map((c, i) => c === null ? i : null).filter((v): v is number => v !== null);

    if (isMaximizing) {
      let bScore = -Infinity;
      for (const idx of empty) {
        board[idx] = 'O';
        bScore = Math.max(bScore, runMinimax(board, depth + 1, false));
        board[idx] = null;
      }
      return bScore;
    } else {
      let bScore = Infinity;
      for (const idx of empty) {
        board[idx] = 'X';
        bScore = Math.min(bScore, runMinimax(board, depth + 1, true));
        board[idx] = null;
      }
      return bScore;
    }
  };

  const concludeTicGame = async (winnerSymbol: string, winningLine: number[] | null, finalBoard: (string | null)[]) => {
    setTicWinner(winnerSymbol);
    setTicWinningLine(winningLine);

    if (winnerSymbol === 'Draw') {
      setTicStatusMsg('Empate! Ótimo jogo.');
      playSynthSound('click');
    } else if (winnerSymbol === 'X') {
      setTicStatusMsg('Você venceu! Incrível! 🎉');
      playSynthSound('win');
      confetti({ particleCount: 60, spread: 40 });

      // Calculate reward based on bot difficulty
      if (ticMode === 'bot') {
        let coinPayout = 3;
        if (ticDifficulty === 'medium') coinPayout = 8;
        if (ticDifficulty === 'impossible') coinPayout = 20;

        try {
          await updateCoins(coinPayout, 'add');
          setTicStatusMsg(`Você venceu! +${coinPayout} Moedas creditadas! 🎉`);
        } catch (e) {
          console.error(e);
        }
      }
    } else {
      setTicStatusMsg('IA venceu! Treine mais um pouco.');
      playSynthSound('lose');
    }
  };


  // ==========================================
  // JOGO 3 CORE: CAMPO MINADO (MINES CASHOUT)
  // ==========================================
  const [mineGrid, setMineGrid] = useState<('safe' | 'bomb')[]>(Array(25).fill('safe'));
  const [revealedCells, setRevealedCells] = useState<boolean[]>(Array(25).fill(false));
  const [minesBet, setMinesBet] = useState<number>(10);
  const [minesPot, setMinesPot] = useState<number>(0);
  const [minesMultiplier, setMinesMultiplier] = useState<number>(1.0);
  const [minesActive, setMinesActive] = useState<boolean>(false);
  const [minesLost, setMinesLost] = useState<boolean>(false);
  const [minesWon, setMinesWon] = useState<boolean>(false);
  const [minesStatus, setMinesStatus] = useState<string>('Escolha sua aposta e inicie a partida.');

  const initMinesGame = async () => {
    if (minesBet > coins && minesBet !== 0) {
      setMinesStatus('Moedas insuficientes para essa aposta!');
      return;
    }

    playSynthSound('click');
    setMinesLost(false);
    setMinesWon(false);
    setRevealedCells(Array(25).fill(false));
    setMinesMultiplier(1.0);
    setMinesPot(minesBet);

    // Grid creation: 4 random mines out of 25 nodes
    const sample = Array(25).fill('safe');
    let mineCount = 0;
    while (mineCount < 5) {
      const luckyIndex = Math.floor(Math.random() * 25);
      if (sample[luckyIndex] === 'safe') {
        sample[luckyIndex] = 'bomb';
        mineCount++;
      }
    }

    setMineGrid(sample);

    if (minesBet > 0) {
      try {
        await updateCoins(minesBet, 'subtract');
      } catch (err) {
        console.error(err);
        return;
      }
    }

    setMinesActive(true);
    setMinesStatus('Partida iniciada! Clique em casas seguras.');
  };

  const handleMineCellClick = async (idx: number) => {
    if (!minesActive || revealedCells[idx] || minesLost) return;
    
    const isBomb = mineGrid[idx] === 'bomb';
    const newRevealed = [...revealedCells];
    newRevealed[idx] = true;
    setRevealedCells(newRevealed);

    if (isBomb) {
      // Boom! Game Over
      playSynthSound('explosion');
      setMinesActive(false);
      setMinesLost(true);
      setMinesStatus('BOOM! Você acertou uma mina e perdeu a aposta. 💥');
      // Reveal all mines to user
      const revealAll = Array(25).fill(true);
      setRevealedCells(revealAll);
    } else {
      // Safe find! Increment multiplier
      playSynthSound('reveal');
      const safeClicks = newRevealed.filter((rev, cellIdx) => rev && mineGrid[cellIdx] === 'safe').length;
      
      // Calculate growth multiplier: e.g. exponential
      const nextMultiplier = parseFloat((1 + safeClicks * 0.23).toFixed(2));
      const nextPot = Math.round(minesBet * nextMultiplier);

      setMinesMultiplier(nextMultiplier);
      setMinesPot(minesBet > 0 ? nextPot : safeClicks); // If free, just count coins
      
      const safeCountRemaining = mineGrid.filter(v => v === 'safe').length;
      if (safeClicks === safeCountRemaining) {
        // Complete clear! Instant big pay
        concludeMinesSuccess(nextPot);
      } else {
        setMinesStatus(`Casa segura! Multiplicador atual: ${nextMultiplier}x`);
      }
    }
  };

  const handleMinesCashout = async () => {
    if (!minesActive || minesLost) return;
    concludeMinesSuccess(minesPot);
  };

  const concludeMinesSuccess = async (earnAmount: number) => {
    setMinesActive(false);
    setMinesWon(true);
    playSynthSound('win');
    confetti({ particleCount: 50, spread: 35 });

    let finalCoinsAwarded = earnAmount;
    if (minesBet === 0) {
      // Free play gives tiny fraction
      finalCoinsAwarded = Math.min(3, earnAmount); 
      setMinesStatus(`Cashout realizado! Você faturou +${finalCoinsAwarded} Moedas no modo gratuito! 💰`);
    } else {
      setMinesStatus(`Espetacular! Você resgatou +${finalCoinsAwarded} Moedas! (${minesMultiplier}x) 💰`);
    }

    if (finalCoinsAwarded > 0) {
      try {
        await updateCoins(finalCoinsAwarded, 'add');
      } catch (err) {
        console.error(err);
      }
    }
    
    // Reveal everything
    setRevealedCells(Array(25).fill(true));
  };


  // ==========================================
  // JOGO 4 CORE: REFLEX MATCH / SPEED TAP
  // ==========================================
  const [reflexActive, setReflexActive] = useState<boolean>(false);
  const [reflexScore, setReflexScore] = useState<number>(0);
  const [reflexTimeleft, setReflexTimeleft] = useState<number>(10);
  const [reflexTargetPos, setReflexTargetPos] = useState({ top: '50%', left: '50%' });
  const [targetSize, setTargetSize] = useState<number>(70);
  const reflexTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startReflexGame = () => {
    playSynthSound('click');
    setReflexScore(0);
    setReflexTimeleft(10);
    setReflexActive(true);
    moveReflexTarget();

    if (reflexTimerRef.current) clearInterval(reflexTimerRef.current);
    reflexTimerRef.current = setInterval(() => {
      setReflexTimeleft((prev) => {
        if (prev <= 1) {
          clearInterval(reflexTimerRef.current!);
          setReflexActive(false);
          concludeReflexGame();
          return 0;
        }
        playSynthSound('tick');
        return prev - 1;
      });
    }, 1000);
  };

  const moveReflexTarget = () => {
    const randomTop = Math.floor(Math.random() * 75) + 10;
    const randomLeft = Math.floor(Math.random() * 75) + 10;
    const size = Math.floor(Math.random() * 25) + 50; // Between 50px and 75px
    setReflexTargetPos({ top: `${randomTop}%`, left: `${randomLeft}%` });
    setTargetSize(size);
  };

  const handleReflexTargetClick = () => {
    if (!reflexActive) return;
    playSynthSound('reveal');
    setReflexScore((s) => s + 1);
    moveReflexTarget();
  };

  const concludeReflexGame = async () => {
    playSynthSound('win');
    // Calculate final payout: 1 coin for every 3 scores
    const reward = Math.floor(reflexScore / 3);
    if (reward > 0) {
      try {
        await updateCoins(reward, 'add');
      } catch (err) {
        console.error(err);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (reflexTimerRef.current) clearInterval(reflexTimerRef.current);
    };
  }, []);


  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 pb-36 space-y-8 bg-[#020202] min-h-screen"
    >
      {/* Header Back Button & Page Introduction */}
      <div className="flex items-center justify-between pt-4">
        <div>
          <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase flex items-center gap-2">
            Aura <span className="text-purple-500">Arena</span>
          </h1>
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-1">
            Minijogos interativos para faturar moedas e aumentar de nível!
          </p>
        </div>
        
        {/* Wallet Balance Widget */}
        <div 
          onClick={() => navigate('/shop')}
          className="flex items-center gap-2 bg-[#0c0c0c] border border-white/[0.08] px-4 py-2.5 rounded-2xl cursor-pointer hover:border-purple-500/30 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
        >
          <Coins size={14} className="text-yellow-500 animate-pulse" />
          <span className="text-xs font-black text-yellow-500 uppercase tracking-wider">
            {coins} <span className="text-[9px] text-white/40 font-bold">MOEDAS</span>
          </span>
        </div>
      </div>

      {/* Featured Arena Banner: Damas Neon */}
      <section 
        className="relative h-56 rounded-[48px] overflow-hidden group cursor-pointer shadow-premium border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 transform hover:-translate-y-1"
        onClick={() => navigate('/checkers')}
      >
        <div className="absolute inset-0 bg-[#06030c]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#00F0FF]/20 via-transparent to-[#FF4D9D]/20 animate-pulse" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-600/10 blur-[100px] rounded-full" />
        </div>
        
        <div className="absolute inset-0 p-8 flex flex-col justify-between relative z-10">
          <div className="flex items-center justify-between">
            <div className="bg-[#00F0FF]/15 px-3 py-1.5 rounded-full border border-[#00F0FF]/30 flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,240,255,0.2)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] animate-ping" />
              <span className="text-[9px] font-black uppercase text-[#00F0FF] tracking-[0.25em] italic">JOGO PRINCIPAL 1V1</span>
            </div>
            
            {/* User checkers status */}
            <div className={`px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-wider flex items-center gap-1 bg-black/40 ${getEloRankName(checkersElo).bg} ${getEloRankName(checkersElo).color}`}>
              <Star size={10} className="fill-current" />
              {getEloRankName(checkersElo).name} ({checkersElo} ELO)
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-black text-white leading-none uppercase tracking-tighter italic">
              DAMAS NEON <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-[#FF4D9D] to-[#00F0FF]">COIN ARENA</span>
            </h2>
            <p className="text-white/40 text-[9px] font-bold mt-2 uppercase tracking-[0.2em] italic">
              Aposte moedas em tempo real • Sistema automático de matchmaking
            </p>
          </div>

          {/* Real-time statistics banner */}
          <div className="flex items-center gap-5 border-t border-white/5 pt-3 mt-3 text-[10px] font-black uppercase tracking-wider text-white/50">
            <div>Taxa Variação: <span className="text-emerald-400">{checkersWinRate}% WR</span></div>
            <div>Vitórias: <span className="text-purple-400">{checkersWins}</span></div>
            <div>Streak: <span className="text-[#FF4D9D]">🔥 {checkersStreak}</span></div>
          </div>
        </div>

        <div className="absolute right-[-10px] bottom-[-10px] opacity-20 group-hover:scale-105 group-hover:rotate-6 transition-transform duration-1000">
          <Gamepad2 size={180} className="text-[#FF4D9D] blur-xs" />
        </div>
      </section>

      {/* Grid title */}
      <div>
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40 border-b border-white/5 pb-2">
          Mini-Arcade Individual (Fature Moedas)
        </h3>
      </div>

      {/* Grid of other playables */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card 1: Jogo da Velha */}
        <motion.div 
          onClick={() => { playSynthSound('click'); setActiveModal('ticTac'); }}
          whileHover={{ y: -4, scale: 1.01 }}
          className="bg-[#0c0c0c] border border-white/[0.08] hover:border-emerald-500/20 rounded-[40px] p-8 relative overflow-hidden group cursor-pointer transition-all"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full" />
          <div className="flex flex-col justify-between h-full space-y-6">
            <div className="flex items-center justify-between">
              <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                <Cpu size={24} />
              </div>
              <span className="text-[9px] font-black uppercase text-emerald-400 tracking-widest bg-emerald-500/5 px-2.5 py-1 rounded-md border border-emerald-500/10">
                Ganhe até 20 Coins
              </span>
            </div>

            <div>
              <h4 className="text-xl font-black text-white italic uppercase tracking-tight leading-tight">
                VELHA NEON IA
              </h4>
              <p className="text-[10px] font-bold text-white/30 uppercase mt-1">
                Derrote nossa Inteligência Artificial ou jogue localmente!
              </p>
            </div>
          </div>
        </motion.div>

        {/* Card 2: Minesweeper Risk Game */}
        <motion.div 
          onClick={() => { playSynthSound('click'); setActiveModal('mines'); }}
          whileHover={{ y: -4, scale: 1.01 }}
          className="bg-[#0c0c0c] border border-white/[0.08] hover:border-amber-500/20 rounded-[40px] p-8 relative overflow-hidden group cursor-pointer transition-all"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full" />
          <div className="flex flex-col justify-between h-full space-y-6">
            <div className="flex items-center justify-between">
              <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
                <Bomb size={24} />
              </div>
              <span className="text-[9px] font-black uppercase text-amber-400 tracking-widest bg-amber-500/5 px-2.5 py-1 rounded-md border border-amber-500/10">
                Multiplicador Ativo
              </span>
            </div>

            <div>
              <h4 className="text-xl font-black text-white italic uppercase tracking-tight leading-tight">
                CAMPO MINADO AURA
              </h4>
              <p className="text-[10px] font-bold text-white/30 uppercase mt-1">
                Ache canais seguros para subir de multiplicador e faça cashout!
              </p>
            </div>
          </div>
        </motion.div>

        {/* Card 3: Reflexo Rápido */}
        <motion.div 
          onClick={() => { playSynthSound('click'); setActiveModal('reflex'); }}
          whileHover={{ y: -4, scale: 1.01 }}
          className="bg-[#0c0c0c] border border-white/[0.08] hover:border-blue-500/20 rounded-[40px] p-8 relative overflow-hidden group cursor-pointer transition-all"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full" />
          <div className="flex flex-col justify-between h-full space-y-6">
            <div className="flex items-center justify-between">
              <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                <Target size={24} />
              </div>
              <span className="text-[9px] font-black uppercase text-blue-400 tracking-widest bg-blue-500/5 px-2.5 py-1 rounded-md border border-blue-500/10">
                Treino de Reação
              </span>
            </div>

            <div>
              <h4 className="text-xl font-black text-white italic uppercase tracking-tight leading-tight">
                REFLEXO RADIAL
              </h4>
              <p className="text-[10px] font-bold text-white/30 uppercase mt-1">
                Acerte os alvos mutantes o mais rápido possível em 10 segundos!
              </p>
            </div>
          </div>
        </motion.div>

      </section>


      {/* ==========================================
          MODAL: JOGO DA VELHA IA
      ========================================== */}
      <AnimatePresence>
        {activeModal === 'ticTac' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveModal(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#0b0b0d] border border-white/10 rounded-[36px] overflow-hidden shadow-2xl p-6 space-y-6"
            >
              {/* Modal Head */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <Cpu className="text-emerald-400" size={18} />
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Velha Neon IA</span>
                </div>
                <button 
                  onClick={() => setActiveModal(null)}
                  className="w-8 h-8 rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Setting controls */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-white/30">
                  <span>Modo de Jogo</span>
                  {ticMode === 'bot' && <span>Dificuldade</span>}
                  {ticMode === 'online' && !activeOnlineMatch && <span>Multiplayer</span>}
                  {ticMode === 'online' && activeOnlineMatch && (
                    <div className="flex items-center gap-1 text-emerald-400">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      <span>Conectado</span>
                    </div>
                  )}
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex bg-black/60 p-1.5 rounded-2xl border border-white/5 gap-1">
                    <button 
                      onClick={() => { setTicMode('bot'); resetTicGame(); }}
                      disabled={activeOnlineMatch && activeOnlineMatch.status === 'playing'}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${ticMode === 'bot' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white disabled:opacity-30'}`}
                    >
                      VS IA
                    </button>
                    <button 
                      onClick={() => { setTicMode('local'); resetTicGame(); }}
                      disabled={activeOnlineMatch && activeOnlineMatch.status === 'playing'}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${ticMode === 'local' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white disabled:opacity-30'}`}
                    >
                      Local 1v1
                    </button>
                    <button 
                      onClick={() => { setTicMode('online'); resetTicGame(); }}
                      disabled={activeOnlineMatch && activeOnlineMatch.status === 'playing'}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${ticMode === 'online' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white disabled:opacity-30'}`}
                    >
                      Online 1v1
                    </button>
                  </div>

                  {ticMode === 'bot' && !ticBoard.some(c => c !== null) && !ticWinner && (
                    <div className="flex bg-black/60 p-1.5 rounded-2xl border border-white/5 justify-between">
                      {(['easy', 'medium', 'impossible'] as const).map((diff) => (
                        <button
                          key={diff}
                          onClick={() => { setTicDifficulty(diff); resetTicGame(); }}
                          className={`px-2.5 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-widest transition-all ${
                            ticDifficulty === diff 
                              ? 'bg-emerald-500 text-black shadow-md' 
                              : 'text-white/30 hover:text-white/60'
                          }`}
                        >
                          {diff === 'easy' ? 'Fác' : diff === 'medium' ? 'Méd' : 'Imp'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ONLINE LOBBY MANAGEMENT (If online mode selected and not inside an active game) */}
              {ticMode === 'online' && !activeOnlineMatch ? (
                <div className="space-y-5 py-2">
                  {/* Create Mesa Panel */}
                  <div className="bg-black/40 border border-white/5 p-4 rounded-3xl space-y-3 text-left">
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest block">
                      Criar Partida Online
                    </span>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <span className="text-[10px] font-bold text-white/60">Aposta de Moedas:</span>
                      <div className="flex gap-1 bg-black/20 p-1 rounded-xl border border-white/5">
                        {[0, 5, 10, 20].map((amt) => (
                          <button
                            key={amt}
                            onClick={() => setOnlineBetAmount(amt)}
                            className={`px-2 py-1 rounded-lg text-[9px] font-black tracking-wider transition-all flex items-center gap-0.5 ${
                              onlineBetAmount === amt 
                                ? 'bg-white text-black shadow-md' 
                                : 'text-white/40 hover:text-white'
                            }`}
                          >
                            <Coins size={9} />
                            {amt === 0 ? 'Grátis' : amt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => createOnlineMatch(onlineBetAmount)}
                      disabled={creatingMatch}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-black py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {creatingMatch ? 'Criando...' : 'Criar Mesa de Jogo'}
                    </button>
                  </div>

                  {/* Available Lobbies List */}
                  <div className="space-y-2 text-left">
                    <div className="flex items-center justify-between text-[10px] font-black text-white/30 uppercase tracking-widest">
                      <span>Mesas Disponíveis ({onlineMatches.length})</span>
                      <span className="flex items-center gap-1"><Globe size={10} /> AO VIVO</span>
                    </div>

                    {loadingMatches ? (
                      <div className="text-center py-8 text-[10px] uppercase font-bold text-white/20 tracking-wider">
                        Carregando salas...
                      </div>
                    ) : onlineMatches.length === 0 ? (
                      <div className="text-center py-10 rounded-2xl border border-white/5 border-dashed text-[10px] uppercase font-bold text-white/30 tracking-wider">
                        Nenhuma sala aberta. Crie uma!
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {onlineMatches.map((match) => (
                          <div 
                            key={match.id} 
                            className="bg-black/40 border border-white/5 p-3 rounded-2xl flex items-center justify-between hover:border-white/10 transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <img 
                                src={match.player1Photo} 
                                className="w-8 h-8 rounded-xl object-cover bg-neutral-800 border border-white/5"
                                alt=""
                              />
                              <div className="text-left">
                                <span className="text-[10px] font-black text-white block truncate max-w-[110px]">
                                  {match.player1Name}
                                </span>
                                <span className="text-[8px] font-bold text-white/30 uppercase tracking-wider block">
                                  Dono da Mesa
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-0.5 bg-yellow-500/10 border border-yellow-500/10 px-2 py-1 rounded-lg">
                                <Coins size={9} className="text-yellow-500" />
                                <span className="text-[9px] font-black text-[#f59e0b]">{match.betAmount}</span>
                              </div>

                              <button
                                onClick={() => joinOnlineMatch(match)}
                                disabled={joiningMatch === match.id}
                                className="bg-white hover:bg-zinc-200 text-black font-black text-[9px] uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all"
                              >
                                {joiningMatch === match.id ? 'Entrando' : 'Jogar'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : activeOnlineMatch && activeOnlineMatch.status === 'waiting' ? (
                /* WAITING IN LOBBY SCREEN */
                <div className="py-8 text-center bg-black/40 border border-white/5 rounded-3xl space-y-6">
                  <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border border-emerald-500/20 animate-ping" />
                    <div className="absolute inset-2 rounded-full border border-emerald-500/40 animate-pulse" />
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Globe size={20} className="animate-spin duration-[10s]" />
                    </div>
                  </div>
                  <div className="space-y-1.5 animate-pulse">
                    <span className="text-xs font-black uppercase text-white tracking-widest block">
                      Aguardando Oponente...
                    </span>
                    <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider block">
                      Aposta: {activeOnlineMatch.betAmount} Aura Coins
                    </span>
                  </div>
                  <button
                    onClick={cancelWaitingMatch}
                    className="mx-auto bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                  >
                    Excluir Sala
                  </button>
                </div>
              ) : (
                /* REGULAR GAME (LOCAL / BOT OR ONLINE ACTIVE MATCH) */
                <>
                  {/* Players Arena Header for Active Online Match */}
                  {ticMode === 'online' && activeOnlineMatch && (
                    <div className="grid grid-cols-3 items-center bg-black/40 border border-white/5 px-4 py-3 rounded-2xl gap-1">
                      <div className="flex flex-col items-center gap-1">
                        <img 
                          src={activeOnlineMatch.player1Photo} 
                          className={`w-9 h-9 rounded-xl object-cover bg-neutral-800 border-2 transition-all ${
                            activeOnlineMatch.turn === activeOnlineMatch.player1 && !ticWinner
                              ? 'border-[#00F0FF] shadow-[0_0_12px_rgba(0,240,255,0.5)]' 
                              : 'border-transparent'
                          }`}
                          alt=""
                        />
                        <span className="text-[9px] font-black text-white truncate max-w-[80px]">
                          {activeOnlineMatch.player1Name}
                        </span>
                        <span className="text-[8px] font-black text-[#00F0FF] tracking-wider uppercase">
                          X
                        </span>
                      </div>

                      <div className="flex flex-col items-center gap-1.5">
                        <span className="text-[10px] font-black text-white/20 tracking-widest italic">VS</span>
                        <div className="flex items-center gap-0.5 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-md">
                          <Coins size={8} className="text-yellow-500" />
                          <span className="text-[8px] font-black text-yellow-500">{activeOnlineMatch.betAmount * 2}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <img 
                          src={activeOnlineMatch.player2Photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=opponent`} 
                          className={`w-9 h-9 rounded-xl object-cover bg-neutral-800 border-2 transition-all ${
                            activeOnlineMatch.turn === activeOnlineMatch.player2 && !ticWinner
                              ? 'border-[#FF4D9D] shadow-[0_0_12px_rgba(255,77,157,0.5)]' 
                              : 'border-transparent'
                          }`}
                          alt=""
                        />
                        <span className="text-[9px] font-black text-white truncate max-w-[80px]">
                          {activeOnlineMatch.player2Name || 'Aguardando'}
                        </span>
                        <span className="text-[8px] font-black text-[#FF4D9D] tracking-wider uppercase">
                          O
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Status Message */}
                  <div className="text-center">
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] animate-pulse">
                      {ticStatusMsg}
                    </span>
                  </div>

                  {/* The Tic Board Grid */}
                  <div className="grid grid-cols-3 gap-3.5 max-w-[280px] mx-auto aspect-square bg-[#121216] p-3.5 rounded-[28px] border border-white/5 shadow-2xl">
                    {ticBoard.map((cell, idx) => {
                      const isWinningCell = ticWinningLine?.includes(idx);
                      const isOnlineTurn = ticMode === 'online' ? (activeOnlineMatch?.status === 'playing' && activeOnlineMatch?.turn === user?.uid) : true;
                      const isBotWaiting = ticMode === 'bot' && !ticIsXNext;
                      return (
                        <motion.button
                          key={idx}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleTicCellClick(idx)}
                          disabled={cell !== null || ticWinner !== null || !isOnlineTurn || isBotWaiting}
                          className={`relative aspect-square rounded-[20px] transition-all flex items-center justify-center text-3xl font-black ${
                            isWinningCell 
                              ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_20px_#10b981]' 
                              : 'bg-black/40 hover:bg-white/[0.04] border border-white/5'
                          }`}
                        >
                          {cell === 'X' && (
                            <motion.span 
                              initial={{ scale: 0 }} 
                              animate={{ scale: 1 }}
                              className={isWinningCell ? 'text-black' : 'text-[#00F0FF] drop-shadow-[0_0_10px_#00f0ff]'}
                            >
                              X
                            </motion.span>
                          )}
                          {cell === 'O' && (
                            <motion.span 
                              initial={{ scale: 0 }} 
                              animate={{ scale: 1 }}
                              className={isWinningCell ? 'text-black' : 'text-[#FF4D9D] drop-shadow-[0_0_10px_#ff4d9d]'}
                            >
                              O
                            </motion.span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Reset / Quit Control */}
                  <div className="flex justify-center flex-col gap-3">
                    {ticMode === 'online' ? (
                      <button
                        onClick={leaveOnlineMatch}
                        className="w-full bg-red-650 hover:bg-red-600 bg-red-500/10 text-red-500 hover:text-white border border-red-500/20 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] flex items-center justify-center gap-2 transition-all cursor-pointer font-bold"
                      >
                        Sair da Partida
                      </button>
                    ) : (
                      <button
                        onClick={resetTicGame}
                        className="w-full bg-white text-black hover:bg-neutral-200 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <RefreshCw size={12} />
                        Reiniciar Jogo
                      </button>
                    )}
                    
                    {ticMode !== 'online' && (
                      <span className="text-[8px] text-white/20 uppercase text-center tracking-widest font-bold">
                        Vitória no Impossível = 20 Aura Coins • Médio = 8 Aura Coins
                      </span>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* ==========================================
          MODAL: CAMPO MINADO STAKEOUT
      ========================================== */}
      <AnimatePresence>
        {activeModal === 'mines' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (!minesActive) setActiveModal(null); }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#0b0b0d] border border-white/10 rounded-[36px] overflow-hidden shadow-2xl p-6 space-y-6"
            >
              {/* Modal Head */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <Bomb className="text-amber-500 animate-bounce" size={18} />
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Campo Minado Aura</span>
                </div>
                <button 
                  onClick={() => { if (!minesActive) setActiveModal(null); }}
                  disabled={minesActive}
                  className="w-8 h-8 rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Status information */}
              <div className="text-center bg-black/40 py-3 rounded-2xl border border-white/5">
                <p className="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em] px-4 leading-relaxed">
                  {minesStatus}
                </p>
                {minesActive && (
                  <p className="text-[9px] text-white/40 uppercase tracking-widest mt-1">
                    Multiplicador Atual: <span className="text-emerald-400 font-extrabold">{minesMultiplier}x</span>
                  </p>
                )}
              </div>

              {/* Betting & Actions bar */}
              {!minesActive && (
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-white/30">
                    <span>Aposta (Aura Coins)</span>
                    <span>Mina Total: 5 / 25</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 bg-black/60 p-1.5 rounded-2xl border border-white/5">
                    {/* Free Play */}
                    <button 
                      onClick={() => setMinesBet(0)}
                      className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${minesBet === 0 ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-white/40 hover:text-white/60'}`}
                    >
                      Grátis
                    </button>
                    {[10, 50, 100].map((betVal) => (
                      <button 
                        key={betVal}
                        onClick={() => setMinesBet(betVal)}
                        className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${minesBet === betVal ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-white/40 hover:text-white/60'}`}
                      >
                        {betVal}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={initMinesGame}
                    className="w-full bg-gradient-to-tr from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-black py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.25em] flex items-center justify-center gap-2 shadow-xl shadow-amber-500/10 cursor-pointer"
                  >
                    <Play size={12} className="fill-current" />
                    Iniciar com {minesBet === 0 ? 'Modo Grátis' : `${minesBet} Coins`}
                  </button>
                </div>
              )}

              {minesActive && (
                <button
                  onClick={handleMinesCashout}
                  className="w-full bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-black py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.25em] flex flex-col items-center justify-center gap-1 shadow-xl shadow-emerald-500/10 cursor-pointer"
                >
                  <span className="leading-none text-xs">RESGATAR ACUMULADO</span>
                  <span className="text-[10px] opacity-80 font-extrabold flex items-center gap-1">
                    <Coins size={10} /> +{minesPot} Coins ({minesMultiplier}x)
                  </span>
                </button>
              )}

              {/* The Mines Grid (5x5) */}
              <div className="grid grid-cols-5 gap-2 bg-[#121216] p-3 rounded-[28px] border border-white/5 max-w-[280px] mx-auto">
                {mineGrid.map((value, idx) => {
                  const isRevealed = revealedCells[idx];
                  const isBomb = value === 'bomb';

                  return (
                    <motion.button
                      key={idx}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleMineCellClick(idx)}
                      disabled={!minesActive || isRevealed}
                      className={`relative aspect-square rounded-[14px] transition-all flex items-center justify-center ${
                        isRevealed 
                          ? isBomb 
                            ? 'bg-red-500 border-red-500 shadow-[0_0_15px_#ef4444] text-white'
                            : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                          : 'bg-black/60 hover:bg-neutral-800 border border-white/5'
                      }`}
                    >
                      {isRevealed && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>
                          {isBomb ? (
                            <Bomb size={16} />
                          ) : (
                            <Check size={16} className="text-emerald-400 font-black drop-shadow-[0_0_5px_#10b981]" />
                          )}
                        </motion.span>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Warnings and Disclosures */}
              <div className="text-center text-[8px] text-white/20 uppercase tracking-wider space-y-1">
                <p>Selecione casas seguras para acumular fundos.</p>
                <p>Se você colidir com uma mina, perde toda a aposta do round.</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* ==========================================
          MODAL: REFLEX TIME TARGET
      ========================================== */}
      <AnimatePresence>
        {activeModal === 'reflex' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (!reflexActive) setActiveModal(null); }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#0b0b0d] border border-white/10 rounded-[36px] overflow-hidden shadow-2xl p-6 space-y-6"
            >
              {/* Modal Head */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <Target className="text-blue-500 animate-spin" size={18} />
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Reflexo Radial</span>
                </div>
                <button 
                  onClick={() => { if (!reflexActive) setActiveModal(null); }}
                  disabled={reflexActive}
                  className="w-8 h-8 rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Status and values */}
              <div className="flex items-center justify-around bg-black/40 py-3 rounded-2xl border border-white/5 text-center text-[10px] font-black uppercase tracking-wider">
                <div>
                  <span className="text-white/30 block mb-0.5">Tempo</span>
                  <span className="text-blue-400 text-lg">{reflexTimeleft}s</span>
                </div>
                <div className="h-6 w-px bg-white/5" />
                <div>
                  <span className="text-white/30 block mb-0.5">Pontuação</span>
                  <span className="text-yellow-500 text-lg">{reflexScore}</span>
                </div>
                <div className="h-6 w-px bg-white/5" />
                <div>
                  <span className="text-white/30 block mb-0.5">Potencial</span>
                  <span className="text-emerald-400 text-lg">+{Math.floor(reflexScore / 3)} Coins</span>
                </div>
              </div>

              {/* Play / Action Control */}
              {!reflexActive && (
                <button
                  onClick={startReflexGame}
                  className="w-full bg-gradient-to-tr from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-black py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.25em] flex items-center justify-center gap-2 shadow-xl shadow-blue-500/10 cursor-pointer"
                >
                  <Play size={12} className="fill-current" />
                  Iniciar Treino Grátis
                </button>
              )}

              {/* The Reflex Tap Canvas */}
              <div className="relative w-full aspect-square bg-[#07070a]/60 border border-white/5 rounded-[32px] overflow-hidden">
                {reflexActive ? (
                  <button
                    onClick={handleReflexTargetClick}
                    style={{
                      position: 'absolute',
                      top: reflexTargetPos.top,
                      left: reflexTargetPos.left,
                      width: `${targetSize}px`,
                      height: `${targetSize}px`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className="bg-gradient-to-tr from-blue-500 to-cyan-400 rounded-full flex items-center justify-center text-black border-4 border-[#07070a] shadow-[0_0_25px_#3b82f6] hover:scale-110 active:scale-95 transition-all text-xs font-black cursor-pointer"
                  >
                    AURA
                  </button>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-3">
                    <Target size={40} className="text-white/10" />
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-relaxed">
                      {reflexScore > 0 
                        ? `Treino Finalizado! Você pontuou ${reflexScore} vezes, convertendo +${Math.floor(reflexScore / 3)} Coins!` 
                        : 'Aperte no botão acima para iniciar os tiros reflex.'
                      }
                    </p>
                  </div>
                )}
              </div>

              {/* Warning */}
              <div className="text-center text-[8px] text-white/20 uppercase tracking-wider">
                Treino de reflexo rápido. Ganhe 1 Moeda a cada 3 alvos acertados!
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
