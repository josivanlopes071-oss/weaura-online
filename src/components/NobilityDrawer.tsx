import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trophy, Crown, Gem, Sparkles, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface NobilityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const NOBILITY_RANKS = [
  {
    rank: 'Barão 🛡️',
    xpMin: 0,
    coinsMin: 100,
    color: 'from-zinc-500/10 to-transparent',
    borderColor: 'border-zinc-500/30',
    perks: ['Distintivo de Barão de Prata no Perfil', 'Multiplier de Aura +5%', 'Tag especial de canal']
  },
  {
    rank: 'Visconde ⚔️',
    xpMin: 500,
    coinsMin: 500,
    color: 'from-blue-500/10 to-transparent',
    borderColor: 'border-blue-500/30',
    perks: ['Distintivo de Visconde Militar', 'Multiplier de Aura +15%', 'Desconto de 5% na Loja Aura', 'Reação de chat personalizada']
  },
  {
    rank: 'Conde 🏰',
    xpMin: 1500,
    coinsMin: 2000,
    color: 'from-purple-500/10 to-transparent',
    borderColor: 'border-purple-500/30',
    perks: ['Distintivo Nobre de Conde das Sombras', 'Multiplier de Aura +30%', 'Desconto de 10% na Loja Aura', 'Acesso a canais VIP exclusivos']
  },
  {
    rank: 'Duque 👑',
    xpMin: 4000,
    coinsMin: 5000,
    color: 'from-pink-500/10 to-transparent',
    borderColor: 'border-pink-500/30',
    perks: ['Distintivo Majestoso de Duque Celestial', 'Multiplier de Aura +50%', 'Desconto de 15% em todas as Molduras', 'Rastro luminoso em canais de voz']
  },
  {
    rank: 'Rei ⚜️',
    xpMin: 10000,
    coinsMin: 15000,
    color: 'from-amber-500/10 to-transparent',
    borderColor: 'border-amber-500/40',
    perks: ['Coroa e Trono Real no perfil', 'Multiplier de Aura +75%', 'Desconto de 20% em Cosméticos', 'Prioridade máxima em subida ao palco de voz']
  },
  {
    rank: 'Imperador 🌌',
    xpMin: 25000,
    coinsMin: 50000,
    color: 'from-cyan-500/15 to-transparent',
    borderColor: 'border-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]',
    perks: ['Emblema Cosmogônico de Imperador WeAura', 'Multiplier de Aura +100% (Dobrado!)', 'Desconto Geral de 30% na Loja', 'Anúncio de Entrada em qualquer sala (Efeito de rastro cósmico)']
  }
];

export default function NobilityDrawer({ isOpen, onClose }: NobilityDrawerProps) {
  const { profile } = useAuth();

  const userXpTotal = (profile?.level || 1) * 100 + (profile?.xp || 0);
  const userCoins = profile?.coins || 100;

  // Find active nobility rank
  let currentRank = NOBILITY_RANKS[0];
  for (let i = NOBILITY_RANKS.length - 1; i >= 0; i--) {
    if (userXpTotal >= NOBILITY_RANKS[i].xpMin && userCoins >= NOBILITY_RANKS[i].coinsMin) {
      currentRank = NOBILITY_RANKS[i];
      break;
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[60]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 180 }}
            className="fixed inset-x-0 bottom-0 bg-[#0a0a0a] rounded-t-[40px] border-t border-white/5 p-6 z-[70] pb-12 shadow-2xl h-[80vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.25em] italic">Prestígio & Influência</span>
                <h3 className="text-2xl font-black text-white leading-tight uppercase tracking-tight italic flex items-center gap-2">
                  <Crown size={22} className="text-amber-500 animate-pulse" /> CLÃ DA NOBREZA WEAURA
                </h3>
              </div>
              <button 
                onClick={onClose} 
                className="p-2.5 bg-white/5 rounded-2xl text-white/30 hover:text-white transition-all hover:scale-105"
              >
                <X size={20} />
              </button>
            </div>

            {/* Current Rank Panel */}
            <div className="p-6 rounded-[32px] bg-gradient-to-r from-amber-600/10 to-transparent border border-amber-500/20 mb-8 flex justify-between items-center">
              <div>
                <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest block">Seu Grau de Nobreza Atual</span>
                <span className="text-xl font-black text-white tracking-wide uppercase italic mt-1.5 block">{currentRank.rank}</span>
              </div>
              <div className="text-center bg-black/60 px-4 py-2 rounded-2xl border border-white/5">
                <span className="text-[8px] font-black text-white/35 block uppercase tracking-widest leading-none">Bônus Aura</span>
                <span className="text-sm font-black text-amber-400 mt-1 block">Aura Ativa</span>
              </div>
            </div>

            {/* List rankings */}
            <div className="space-y-4">
              <h4 className="text-[9px] font-black tracking-[0.2em] text-white/35 uppercase ml-1 block">GRAUS DISPONÍVEIS E BENEFÍCIOS</h4>
              
              {NOBILITY_RANKS.map((item, index) => {
                const isMyRank = currentRank.rank === item.rank;
                return (
                  <div
                    key={index}
                    className={`p-6 rounded-[32px] border bg-gradient-to-r ${item.color} ${
                      isMyRank 
                        ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)] bg-amber-500/[0.02]' 
                        : 'border-white/5'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-md font-black text-white uppercase italic">{item.rank}</h4>
                      {isMyRank && (
                        <span className="bg-amber-500 text-black px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider">
                          Seu Rank
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] font-bold text-white/20 uppercase tracking-widest mb-4">
                      Requisitos: Nível proporcional ({item.xpMin} XP total) & Saldo ({item.coinsMin} EGO)
                    </div>
                    
                    {/* Perks checklist */}
                    <div className="space-y-1.5 ml-1">
                      {item.perks.map((p, i) => (
                        <div key={i} className="flex gap-2 items-center text-xs text-white/50">
                          <Check size={11} className="text-amber-500 shrink-0" />
                          <span className="font-semibold leading-relaxed">{p}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
