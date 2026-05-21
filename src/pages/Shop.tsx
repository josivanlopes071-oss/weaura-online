import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, Star, Zap, Shield, Sparkles, Check, Loader2, Crown, Gem, Gift, Flame, Award } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import UserAvatar from '../components/UserAvatar';

export default function Shop() {
  const { profile, updateCoins, updateProfile } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const coinPacks = [
    { id: 'p1', coins: 100, price: 'R$ 4,90', bonus: '+10', color: 'from-blue-500/20 to-blue-600/20' },
    { id: 'p2', coins: 500, price: 'R$ 19,90', bonus: '+60', color: 'from-purple-500/20 to-purple-600/20' },
    { id: 'p3', coins: 1200, price: 'R$ 39,90', bonus: '+200', popular: true, color: 'from-pink-500/20 to-pink-600/20' },
    { id: 'p4', coins: 3000, price: 'R$ 89,90', bonus: '+650', color: 'from-indigo-500/20 to-indigo-600/20' },
  ];

  const items = [
    { id: 'guardiao_67', name: 'Moldura Guardião Elite 67', cost: 67000, icon: Shield, color: 'text-fuchsia-400', glow: 'shadow-[0_0_20px_rgba(168,85,247,0.6)]', desc: 'Edição mitológica. Chifres obsidian, detalhes em ouro e ametistas resplandecentes com brasão 67!' },
    { id: 'vip', name: 'Moldura VIP', cost: 3500, icon: Crown, color: 'text-amber-300', glow: 'shadow-[0_0_15px_rgba(251,191,36,0.5)]', desc: 'Brilho ouro imperial digno de verdadeiras lendas e reis' },
    { id: 'legendary', name: 'Moldura Lendária', cost: 8500, icon: Award, color: 'text-amber-500', glow: 'shadow-[0_0_15px_rgba(245,158,11,0.5)]', desc: 'Aura solar dourada cintilante de um verdadeiro guerreiro' },
    { id: 'supreme', name: 'Moldura Suprema', cost: 15020, icon: Crown, color: 'text-red-500', glow: 'shadow-[0_0_15px_rgba(239,68,68,0.5)]', desc: 'Pulsar escarlate rubi que impõe respeito supremo por onde passa' },
    { id: 'galaxy', name: 'Moldura Galaxy', cost: 25000, icon: Star, color: 'text-indigo-400', glow: 'shadow-[0_0_15px_rgba(129,140,248,0.5)]', desc: 'Espiral cósmica e poeira intergaláctica orbitando o seu avatar' },
    { id: 'cyber', name: 'Moldura Cyber Neon', cost: 1500, icon: Sparkles, color: 'text-cyan-400', glow: 'shadow-[0_0_15px_rgba(34,211,238,0.4)]', desc: 'Efeito neon cintilante em ciano cyberpunk com partículas de dados' },
    { id: 'blue_fire', name: 'Moldura Fogo Azul', cost: 12000, icon: Flame, color: 'text-cyan-300', glow: 'shadow-[0_0_15px_rgba(34,211,238,0.5)]', desc: 'Labaredas de chama fria azul e partículas termais flutuando' },
    { id: 'purple_aura', name: 'Moldura Aura Roxa', cost: 18500, icon: Zap, color: 'text-purple-400', glow: 'shadow-[0_0_15px_rgba(192,132,252,0.5)]', desc: 'Tempestade de plasma e relâmpagos em tom ametista intenso' },
    { id: 'diamond', name: 'Moldura Diamante', cost: 30000, icon: Gem, color: 'text-sky-300', glow: 'shadow-[0_0_15px_rgba(147,197,253,0.5)]', desc: 'Brilho e refração cristalina de diamantes lapidados suspensos' },
    { id: 'special_event', name: 'Moldura Evento Especial', cost: 45000, icon: Sparkles, color: 'text-rose-400', glow: 'shadow-[0_0_15px_rgba(244,63,94,0.5)]', desc: 'Aura festiva lendária de eventos sazonais com confetes mágicos' },
    { id: 'ranking_special', name: 'Moldura Exclusiva de Ranking', cost: 85000, icon: Shield, color: 'text-yellow-450', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.6)]', desc: 'Para campeões absolutos do ranking de elite. Brilho platina e coroa' }
  ];

  const handleBuyCoins = async (pack: typeof coinPacks[0]) => {
    if (!profile) return;
    setLoading(pack.id);
    setTimeout(async () => {
      try {
        const totalCoins = pack.coins + parseInt(pack.bonus);
        await updateCoins(totalCoins, 'add');
        alert(`Recarga realizada! +${totalCoins} EGO adicionados ao seu perfil.`);
      } catch (err) { 
        alert("Erro na transação"); 
      } finally { 
        setLoading(null); 
      }
    }, 1500);
  };

  const handleBuyItem = async (item: typeof items[0]) => {
    if (!profile) return;
    
    const userCoins = profile.coins || 0;
    if (userCoins < item.cost) {
      alert("Saldo de EGO insuficiente! Realize uma recarga.");
      return;
    }

    try {
      setLoading(item.id);
      await updateCoins(item.cost, 'subtract');
      
      const currentPurchased = profile.purchasedFrames || [];
      await updateProfile({
        purchasedFrames: [...currentPurchased, item.id],
        equippedFrame: item.id // Auto-equip on buy
      });
      
      alert(`Item adquirido e equipado com sucesso: ${item.name}!`);
    } catch (err: any) { 
      alert(err.message || "Erro na compra"); 
    } finally {
      setLoading(null);
    }
  };

  const handleEquipItem = async (itemId: string) => {
    if (!profile) return;
    try {
      await updateProfile({
        equippedFrame: itemId
      });
      alert("Moldura equipada com sucesso!");
    } catch (err: any) {
      alert("Erro ao equipar moldura");
    }
  };

  const handleUnequipItem = async () => {
    if (!profile) return;
    try {
      await updateProfile({
        equippedFrame: ''
      });
      alert("Moldura desequipada!");
    } catch (err: any) {
      alert("Erro ao desequipar");
    }
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
            <h2 className="text-3xl font-black text-white tracking-tight italic">Loja EGO</h2>
            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.35em] leading-none mt-2 italic">Coleção de Elite • Cosméticos • Status</p>
          </div>
          <div className="glass-dark px-6 py-4 rounded-[30px] border border-white/[0.08] flex items-center gap-4 shadow-premium group">
             <div className="w-12 h-12 bg-pink-500 rounded-[20px] flex items-center justify-center border-4 border-[#020202] shadow-[0_5px_15px_rgba(236,72,153,0.4)] group-hover:scale-110 transition-transform duration-500">
                <Sparkles size={24} className="text-[#020202] drop-shadow-md animate-pulse" />
             </div>
             <div>
                <span className="block text-[10px] font-black text-white/20 uppercase tracking-widest mb-1 italic">Saldo EGO</span>
                <span className="text-2xl font-black text-white leading-none tabular-nums italic">{profile?.coins || 0} EGO</span>
             </div>
          </div>
        </div>

        {/* Featured Subscription Card - Ultra Premium */}
        <div className="bg-gradient-to-br from-pink-600 via-indigo-950 to-[#020202] p-10 rounded-[45px] overflow-hidden relative shadow-premium group border border-white/10 card-shine">
          <div className="relative z-10 space-y-6">
            <div className="bg-white/10 backdrop-blur-3xl w-fit px-4 py-2 rounded-2xl flex items-center gap-2.5 border border-white/10">
              <Sparkles className="text-yellow-400 animate-pulse" size={16} />
              <span className="text-[11px] font-black uppercase text-white tracking-[0.2em] italic">Aura VIP Ultra</span>
            </div>
            <div className="space-y-2">
               <h3 className="text-3xl font-black text-white leading-tight uppercase tracking-tight italic">Domine o <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-yellow-400">Cosmos</span></h3>
               <p className="text-sm text-white/40 max-w-[240px] leading-relaxed font-medium italic">Molduras lendárias neon, multiplicador de 5x XP e o selo de autenticidade VIP We Aura.</p>
            </div>
            <button className="bg-white text-black px-10 py-5 rounded-[22px] font-black uppercase text-[12px] tracking-[0.2em] shadow-2xl hover:scale-105 active:scale-95 transition-all w-full md:w-auto italic">
              Assinar Agora
            </button>
          </div>
          
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/5 rounded-full blur-[100px] group-hover:bg-white/10 transition-colors duration-1000" />
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.6, 0.4] }}
            transition={{ duration: 8, repeat: Infinity }}
            className="absolute top-0 right-0 w-80 h-80 bg-pink-500/30 blur-[120px] rounded-full -mr-32 -mt-32"
          />
        </div>
      </div>

      {/* Recarga Packs */}
      <section className="space-y-8">
        <div className="flex items-center justify-between px-4">
           <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/20 ml-2 flex items-center gap-3">
              <span className="w-1.5 h-1.5 bg-pink-500 rounded-full shadow-[0_0_10px_rgba(236,72,153,0.5)]"></span>
              Comprar Moedas EGO
           </h3>
           <div className="flex items-center gap-2 bg-pink-500/10 px-3 py-1.5 rounded-full border border-pink-500/10">
             <Zap size={12} className="text-pink-400" />
             <span className="text-[10px] font-black text-pink-500 uppercase tracking-widest italic font-bold">Promoção</span>
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
                ? 'border-pink-500/40 bg-pink-500/[0.04] shadow-[0_20px_50px_rgba(236,72,153,0.15)]' 
                : 'border-white/[0.08]'
              }`}
            >
               {pack.popular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-gradient-to-r from-pink-600 to-purple-600 px-4 py-1.5 rounded-b-2xl font-black uppercase text-[9px] tracking-[0.15em] text-white shadow-lg italic">
                    RECOMENDADO
                  </div>
               )}

              {loading === pack.id ? (
                <div className="py-8"><Loader2 className="animate-spin text-white/20 mx-auto" size={38} /></div>
              ) : (
                <div className="relative z-10 flex flex-col items-center w-full">
                   <div className="w-16 h-16 bg-gradient-to-br from-pink-400 to-purple-500 rounded-[22px] flex items-center justify-center mb-6 border-4 border-[#0c0c0c] shadow-lg group-hover:rotate-12 transition-transform duration-500">
                      <Sparkles size={32} className="text-black drop-shadow-md" />
                   </div>
                   <div className="text-3xl font-black text-white tracking-tight tabular-nums italic leading-none">{pack.coins}</div>
                   <div className="text-[11px] font-black text-white/20 uppercase tracking-[0.2em] mt-2 italic">EGO Coins</div>
                   
                   <div className="mt-8 w-full flex flex-col gap-3">
                      <div className="bg-white text-black py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] group-hover:bg-pink-50 transition-all shadow-xl italic">
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
          Molduras e cosméticos
        </h3>
        
        <div className="grid grid-cols-1 gap-4">
          {items.map((item) => {
            const purchasedFrames = profile?.purchasedFrames || [];
            const isPurchased = purchasedFrames.includes(item.id);
            const isEquipped = profile?.equippedFrame === item.id;
            const canAfford = (profile?.coins || 0) >= item.cost;

            return (
              <div key={item.id} className="glass-dark p-5 pr-6 rounded-[35px] border border-white/[0.08] flex items-center justify-between group hover:bg-white/[0.04] transition-all duration-500 active:scale-[0.98] card-shine">
                <div className="flex items-center gap-5">
                   <div className="w-16 h-16 flex-shrink-0">
                     <UserAvatar uid={profile?.uid} forceFrameId={item.id} className="w-16 h-16" />
                   </div>
                   <div className="min-w-0">
                     <h4 className="font-black text-lg text-white tracking-tight italic leading-tight">{item.name}</h4>
                     <p className="text-[11px] text-white/20 font-bold uppercase tracking-tight mt-1 truncate max-w-[200px] italic">{item.desc}</p>
                   </div>
                </div>
                
                {loading === item.id ? (
                  <Loader2 className="animate-spin text-white/40" size={20} />
                ) : isPurchased ? (
                  <div className="flex gap-2">
                    {isEquipped ? (
                      <button 
                        onClick={() => handleUnequipItem()}
                        className="h-10 px-6 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-black uppercase tracking-wider hover:opacity-85 active:scale-95 transition-all"
                      >
                        Equipado
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleEquipItem(item.id)}
                        className="h-10 px-6 rounded-xl bg-white text-black text-xs font-black uppercase tracking-wider hover:scale-105 active:scale-95 transition-all"
                      >
                        Equipar
                      </button>
                    )}
                  </div>
                ) : (
                  <button 
                    onClick={() => handleBuyItem(item)}
                    disabled={!canAfford}
                    className={`h-12 px-6 rounded-2xl border transition-all duration-500 active:scale-95 flex items-center gap-2.5 shadow-premium ${
                      canAfford
                        ? 'bg-gradient-to-r from-pink-500 to-purple-600 border-pink-500 text-white hover:scale-105'
                        : 'bg-black/40 border-white/[0.05] text-white/20'
                    }`}
                  >
                    <Sparkles size={14} className={canAfford ? 'text-white animate-pulse' : 'text-white/20'} />
                    <span className="text-xs font-black tabular-nums italic tracking-wider">{item.cost} EGO</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </motion.div>
  );
}
