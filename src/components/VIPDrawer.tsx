import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldCheck, Gem, Sparkles, Flame, Check, Coins } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface VIPDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VIP_PLANS = [
  {
    id: 'Bronze',
    name: 'VIP Bronze',
    price: 150,
    icon: '🥉',
    color: 'from-amber-600/20 via-amber-700/20 to-black',
    borderColor: 'border-amber-500/30',
    tagColor: 'bg-amber-500 text-black',
    accentColor: 'text-amber-500',
    benefits: [
      'Distintivo Bronze Exclusivo no Perfil',
      'Boost de +10% nos ganhos de XP',
      'Desconto de 5% no Mercado Aura',
      'Tag "Bronze Member" brilhante'
    ]
  },
  {
    id: 'Prata',
    name: 'VIP Prata',
    price: 300,
    icon: '🥈',
    color: 'from-slate-400/20 via-slate-500/20 to-black',
    borderColor: 'border-slate-400/40',
    tagColor: 'bg-slate-300 text-black',
    accentColor: 'text-slate-300',
    benefits: [
      'Distintivo Prata de Destaque',
      'Moldura Premium "Silver Sovereign" Desbloqueada',
      'Boost de +25% nos ganhos de XP',
      'Desconto de 10% no Mercado Aura',
      'Acesso a Presentes Exclusivos VIP Bronze'
    ]
  },
  {
    id: 'Ouro',
    name: 'VIP Ouro',
    price: 600,
    icon: '🥇',
    color: 'from-yellow-500/20 via-yellow-600/10 to-black',
    borderColor: 'border-yellow-400/40',
    tagColor: 'bg-yellow-400 text-black font-black',
    accentColor: 'text-yellow-400',
    benefits: [
      'Distintivo Estrela de Ouro Supremo',
      'Moldura Premium "Gold Celestial" Desbloqueada',
      'Balão de Chat "Solar Flare" Exclusivo',
      'Boost de +40% nos ganhos de XP',
      'Desconto de 15% em Cosméticos',
      'Acesso a Presentes Exclusivos VIP Prata/Bronze'
    ]
  },
  {
    id: 'Diamante',
    name: 'VIP Diamante',
    price: 1500,
    icon: '💎',
    color: 'from-cyan-500/25 via-blue-600/15 to-black',
    borderColor: 'border-cyan-400/50 shadow-[0_0_20px_rgba(34,211,238,0.25)]',
    tagColor: 'bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-black',
    accentColor: 'text-cyan-400',
    benefits: [
      'Distintivo Real de Diamante Infinito',
      'Moldura Premium "Diamond Aura" Desbloqueada',
      'Efeito de Rastro Flutuante no Perfil',
      'Balão de Chat Animado "Cosmic Nebula"',
      'Boost de +60% nos ganhos de XP',
      'Desconto de 25% em toda a Loja',
      'Presentes Ultra Exclusivos Diamante'
    ]
  }
];

export default function VIPDrawer({ isOpen, onClose }: VIPDrawerProps) {
  const { profile, updateCoins, updateProfile } = useAuth();
  const { success, error } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<typeof VIP_PLANS[0]>(VIP_PLANS[0]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubscribe = async () => {
    if (!profile) return;

    if (profile.coins < selectedPlan.price) {
      error(`Saldo insuficiente! O plano ${selectedPlan.name} custa 🪙 ${selectedPlan.price} moedas.`);
      return;
    }

    setSubmitting(true);
    try {
      // Deduct coins
      await updateCoins(selectedPlan.price, 'subtract');

      // Update VIP records
      const oneMonthLater = new Date();
      oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

      await updateProfile({
        isVip: true,
        vipPlan: selectedPlan.id as any,
        vipUntil: oneMonthLater.toISOString()
      } as any);

      success(`Sucesso! Você agora é um membro ${selectedPlan.name}! Distintivo e benefícios ativos até ${oneMonthLater.toLocaleDateString('pt-BR')}.`);
      onClose();
    } catch (err: any) {
      console.error(err);
      error("Houve um erro ao processar sua assinatura VIP.");
    } finally {
      setSubmitting(false);
    }
  };

  const activeVip = (profile as any)?.vipPlan || 'None';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[60]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 180 }}
            className="fixed inset-x-0 bottom-0 bg-[#0a0a0a] rounded-t-[40px] border-t border-white/5 p-6 z-[70] pb-12 max shadow-2xl h-[85vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.25em] italic">Assinatura Premium</span>
                <h3 className="text-2xl font-black text-white leading-tight uppercase tracking-tight italic flex items-center gap-2">
                  <Gem size={22} className="text-rose-500 animate-pulse" /> CLUBE WEAURA VIP
                </h3>
              </div>
              <button 
                onClick={onClose} 
                className="p-2.5 bg-white/5 rounded-2xl text-white/30 hover:text-white transition-all hover:scale-105"
              >
                <X size={20} />
              </button>
            </div>

            {/* Current VIP Banner */}
            {activeVip !== 'None' ? (
              <div className="mb-6 bg-gradient-to-r from-purple-900/30 via-pink-900/10 to-transparent border border-pink-500/20 p-4 rounded-3xl flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black text-pink-400 uppercase tracking-widest block">Sua Assinatura Ativa</span>
                  <span className="text-base font-black text-white italic uppercase">{activeVip} Member</span>
                </div>
                <div className="text-right">
                  <span className="text-[8px] font-bold text-white/30 uppercase block">Expiração</span>
                  <span className="text-xs font-bold text-pink-400">
                    {profile && (profile as any).vipUntil ? new Date((profile as any).vipUntil).toLocaleDateString('pt-BR') : 'Mensal'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mb-6 bg-white/[0.02] border border-white/5 p-4 rounded-3xl text-center">
                <p className="text-xs text-white/40 font-semibold leading-relaxed">
                  Desbloqueie tags coloridas, distintivos de luxo no avatar, impulsos de XP absurdos e presentes de aura exclusivos do plano!
                </p>
              </div>
            )}

            {/* VIP Quick Select Cards */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              {VIP_PLANS.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  className={`relative p-3.5 rounded-3xl border flex flex-col items-center justify-center transition-all ${
                    selectedPlan.id === plan.id
                      ? 'bg-purple-900/10 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.15)] scale-[1.03]'
                      : 'bg-black/40 border-white/5 hover:border-white/10'
                  }`}
                >
                  <span className="text-2xl mb-1">{plan.icon}</span>
                  <span className="text-[9px] font-black text-white uppercase tracking-wider text-center">{plan.id}</span>
                  <span className="text-[8px] font-bold text-yellow-500 mt-1">🪙 {plan.price}</span>
                </button>
              ))}
            </div>

            {/* Selected Plan Details */}
            <div className={`p-6 rounded-[36px] bg-gradient-to-b ${selectedPlan.color} border ${selectedPlan.borderColor} mb-8`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{selectedPlan.icon}</span>
                    <div>
                      <h4 className="text-lg font-black text-white uppercase leading-none">{selectedPlan.name}</h4>
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[8.5px] font-black uppercase mt-1.5 ${selectedPlan.tagColor}`}>
                        Benefícios Exclusivos
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest block">Mensalidade</span>
                  <span className="text-xl font-black text-yellow-400 italic">🪙 {selectedPlan.price} EGO</span>
                </div>
              </div>

              {/* Benefits Checklist */}
              <div className="space-y-3 pt-2">
                {selectedPlan.benefits.map((benefit, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-5 h-5 rounded-full bg-white/5 border border-white/5 flex items-center justify-center shrink-0 mt-0.5">
                      <Check size={12} className={selectedPlan.accentColor} />
                    </div>
                    <span className="text-xs text-white/70 font-semibold leading-normal">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Subscribe Action */}
            <button
              onClick={handleSubscribe}
              disabled={submitting}
              className="w-full bg-white text-black hover:bg-zinc-100 font-black uppercase text-xs tracking-[0.25em] py-5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl disabled:opacity-20"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-black/10 border-t-black rounded-full animate-spin" />
              ) : (
                `Assinar VIP ${selectedPlan.id} • 🪙 ${selectedPlan.price} EGO`
              )}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
