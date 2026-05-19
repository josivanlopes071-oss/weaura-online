import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, Coins, Star, Zap, Shield, Sparkles, Check, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Shop() {
  const { profile, updateCoins, updateProfile } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [purchased, setPurchased] = useState<number[]>([]);

  const coinPacks = [
    { id: 'p1', coins: 100, price: 'R$ 4,90', bonus: '+10', color: 'from-blue-500/20 to-blue-600/20' },
    { id: 'p2', coins: 500, price: 'R$ 19,90', bonus: '+60', color: 'from-purple-500/20 to-purple-600/20' },
    { id: 'p3', coins: 1200, price: 'R$ 39,90', bonus: '+200', popular: true, color: 'from-pink-500/20 to-pink-600/20' },
    { id: 'p4', coins: 3000, price: 'R$ 89,90', bonus: '+650', color: 'from-indigo-500/20 to-indigo-600/20' },
  ];

  const items = [
    { id: 1, name: 'Aura Neon', cost: 200, icon: Shield, color: 'text-cyan-400', glow: 'shadow-[0_0_15px_rgba(34,211,238,0.3)]', desc: 'Moldura futurista exclusiva' },
    { id: 2, name: 'Efeito Vortex', cost: 450, icon: Sparkles, color: 'text-purple-400', glow: 'shadow-[0_0_15px_rgba(192,132,252,0.3)]', desc: 'Animação de entrada épica' },
    { id: 3, name: 'Badge Elite', cost: 1000, icon: Star, color: 'text-yellow-400', glow: 'shadow-[0_0_15px_rgba(250,204,21,0.3)]', desc: 'Status global verificado' },
    { id: 4, name: 'Vibe Master', cost: 150, icon: Zap, color: 'text-pink-400', glow: 'shadow-[0_0_15px_rgba(244,114,182,0.3)]', desc: 'Sua voz com clareza cristalina' },
  ];

  const handleBuyCoins = async (pack: typeof coinPacks[0]) => {
    if (!profile) return;
    setLoading(pack.id);
    setTimeout(async () => {
      try {
        const totalCoins = pack.coins + parseInt(pack.bonus);
        await updateCoins(totalCoins, 'add');
        alert(`Recarga realizada! +${totalCoins} Moedas Aura`);
      } catch (err) { alert("Erro na transação"); } finally { setLoading(null); }
    }, 1500);
  };

  const handleBuyItem = async (item: typeof items[0]) => {
    if (!profile || (profile.coins || 0) < item.cost) {
      alert("Aura insuficiente! Recarregue agora.");
      return;
    }
    if (purchased.includes(item.id)) return;
    try {
      await updateCoins(item.cost, 'subtract');
      setPurchased(prev => [...prev, item.id]);
      alert(`Item adquirido: ${item.name}!`);
    } catch (err: any) { alert(err.message || "Erro na compra"); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 pb-40 space-y-10 bg-[#020202] min-h-screen"
    >
      {/* Header with Balance */}
      <div className="flex flex-col gap-10 pt-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tight italic">Loja Aura</h2>
            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.35em] leading-none mt-2 italic">Artigos • Elite • Aura</p>
          </div>
          <div className="glass-dark px-6 py-4 rounded-[30px] border border-white/[0.08] flex items-center gap-4 shadow-premium group">
             <div className="w-12 h-12 bg-yellow-500 rounded-[20px] flex items-center justify-center border-4 border-[#020202] shadow-[0_5px_15px_rgba(234,179,8,0.4)] group-hover:scale-110 transition-transform duration-500">
                <Coins size={24} className="text-[#020202] drop-shadow-md" />
             </div>
             <div>
                <span className="block text-[10px] font-black text-white/20 uppercase tracking-widest mb-1 italic">Saldo VIP</span>
                <span className="text-2xl font-black text-white leading-none tabular-nums italic">{profile?.coins || 0}</span>
             </div>
          </div>
        </div>

        {/* Featured Subscription Card - Ultra Premium */}
        <div className="bg-gradient-to-br from-purple-600 via-indigo-950 to-[#020202] p-10 rounded-[45px] overflow-hidden relative shadow-premium group border border-white/10 card-shine">
          <div className="relative z-10 space-y-6">
            <div className="bg-white/10 backdrop-blur-3xl w-fit px-4 py-2 rounded-2xl flex items-center gap-2.5 border border-white/10">
              <Sparkles className="text-yellow-400 animate-pulse" size={16} />
              <span className="text-[11px] font-black uppercase text-white tracking-[0.2em] italic">Aura VIP Ultra</span>
            </div>
            <div className="space-y-2">
               <h3 className="text-3xl font-black text-white leading-tight uppercase tracking-tight italic">Domine o <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-500">Cosmos</span></h3>
               <p className="text-sm text-white/40 max-w-[240px] leading-relaxed font-medium italic">Molduras lendárias, multiplicador de 5x XP e o selo de autenticidade Aura.</p>
            </div>
            <button className="bg-white text-black px-10 py-5 rounded-[22px] font-black uppercase text-[12px] tracking-[0.2em] shadow-2xl hover:scale-105 active:scale-95 transition-all w-full md:w-auto italic">
              Assinar Agora
            </button>
          </div>
          
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/5 rounded-full blur-[100px] group-hover:bg-white/10 transition-colors duration-1000" />
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.6, 0.4] }}
            transition={{ duration: 8, repeat: Infinity }}
            className="absolute top-0 right-0 w-80 h-80 bg-purple-500/30 blur-[120px] rounded-full -mr-32 -mt-32"
          />
        </div>
      </div>

      {/* Recarga Packs */}
      <section className="space-y-8">
        <div className="flex items-center justify-between px-4">
           <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/20 ml-2 flex items-center gap-3">
              <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]"></span>
              Créditos Aura
           </h3>
           <div className="flex items-center gap-2 bg-yellow-500/10 px-3 py-1.5 rounded-full border border-yellow-500/10">
             <Zap size={12} className="text-yellow-400" />
             <span className="text-[10px] font-black text-yellow-500 uppercase tracking-widest italic">Promoção</span>
           </div>
        </div>
        
        <div className="grid grid-cols-2 gap-5">
          {coinPacks.map((pack) => (
            <motion.button
              key={pack.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleBuyCoins(pack)}
              disabled={loading !== null}
              className={`relative glass-dark p-8 rounded-[40px] border transition-all duration-500 group card-shine ${
                pack.popular 
                ? 'border-purple-500/40 bg-purple-500/[0.04] shadow-[0_20px_50px_rgba(168,85,247,0.15)]' 
                : 'border-white/[0.08]'
              }`}
            >
               {pack.popular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-1.5 rounded-b-2xl font-black uppercase text-[9px] tracking-[0.15em] text-white shadow-lg italic">
                    TOP VENDAS
                  </div>
               )}

              {loading === pack.id ? (
                <div className="py-8"><Loader2 className="animate-spin text-white/20" size={38} /></div>
              ) : (
                <div className="relative z-10 flex flex-col items-center w-full">
                   <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-[22px] flex items-center justify-center mb-6 border-4 border-[#0c0c0c] shadow-lg group-hover:rotate-12 transition-transform duration-500">
                      <Coins size={32} className="text-black drop-shadow-md" />
                   </div>
                   <div className="text-3xl font-black text-white tracking-tight tabular-nums italic leading-none">{pack.coins}</div>
                   <div className="text-[11px] font-black text-white/20 uppercase tracking-[0.2em] mt-2 italic">Aura Coins</div>
                   
                   <div className="mt-8 w-full flex flex-col gap-3">
                      <div className="bg-white text-black py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] group-hover:bg-purple-50 transition-all shadow-xl italic">
                        {pack.price}
                      </div>
                      <div className="text-[10px] font-black text-green-500 uppercase tracking-[0.25em] italic">
                         +{pack.bonus} bônus
                      </div>
                   </div>
                </div>
              )}
            </motion.button>
          ))}
        </div>
      </section>

      {/* Cosmetics & Aura Mods */}
      <section className="space-y-8 pb-32">
        <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/20 ml-6 flex items-center gap-3">
          <span className="w-1.5 h-1.5 bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]"></span>
          Artigos Premium
        </h3>
        
        <div className="grid grid-cols-1 gap-4">
          {items.map((item) => {
            const isPurchased = purchased.includes(item.id);
            const canAfford = (profile?.coins || 0) >= item.cost;

            return (
              <div key={item.id} className="glass-dark p-5 pr-6 rounded-[35px] border border-white/[0.08] flex items-center justify-between group hover:bg-white/[0.04] transition-all duration-500 active:scale-[0.98] card-shine">
                <div className="flex items-center gap-5">
                   <div className={`w-16 h-16 rounded-[24px] bg-black/60 border border-white/10 flex items-center justify-center ${item.color} shadow-2xl transition-all duration-700 group-hover:scale-110 group-hover:rotate-6`}>
                     <item.icon size={28} className="drop-shadow-[0_0_12px_currentColor]" />
                   </div>
                   <div className="min-w-0">
                     <h4 className="font-black text-lg text-white tracking-tight italic leading-tight">{item.name}</h4>
                     <p className="text-[11px] text-white/20 font-bold uppercase tracking-tight mt-1 truncate max-w-[140px] italic">{item.desc}</p>
                   </div>
                </div>
                
                <button 
                  onClick={() => handleBuyItem(item)}
                  disabled={isPurchased || !canAfford}
                  className={`h-12 px-8 rounded-2xl border transition-all duration-500 active:scale-95 flex items-center gap-3 shadow-premium ${
                    isPurchased 
                      ? 'bg-white/5 border-white/5 text-white/10' 
                      : canAfford
                        ? 'bg-white text-black border-white hover:scale-105'
                        : 'bg-black/40 border-white/[0.05] text-white/5'
                  }`}
                >
                  {isPurchased ? (
                     <Check size={20} className="text-white/20" />
                  ) : (
                    <>
                      <Coins size={16} className={canAfford ? 'text-yellow-500' : 'text-zinc-800'} />
                      <span className="text-sm font-black tabular-nums italic tracking-wider">{item.cost}</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </motion.div>
  );
}

