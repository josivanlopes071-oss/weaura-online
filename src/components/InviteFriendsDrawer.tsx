import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Gift, Share2, Clipboard, HeartCrack, Sparkles, Check, HelpCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface InviteFriendsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InviteFriendsDrawer({ isOpen, onClose }: InviteFriendsDrawerProps) {
  const { profile, updateCoins, updateProfile } = useAuth();
  const { success, error } = useToast();

  const [inputReferrer, setInputReferrer] = useState('');
  const [submittingReferral, setSubmittingReferral] = useState(false);

  const myInviteCode = profile ? `AURA-${profile.displayId || '102943'}` : 'AURA-1229';

  const handleCopyCode = () => {
    navigator.clipboard.writeText(myInviteCode);
    success("Código de Convite Copiado!");
  };

  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !inputReferrer.trim()) return;

    if (inputReferrer.trim() === myInviteCode) {
      error("Erro: Você não pode resgatar seu próprio código!");
      return;
    }

    if ((profile as any).referredBy) {
      error("Você já resgatou um bônus de indicação!");
      return;
    }

    setSubmittingReferral(true);
    try {
      // Decode user displayId
      const targetIdStr = inputReferrer.replace('AURA-', '').trim();
      const targetDisplayId = parseInt(targetIdStr);
      
      if (isNaN(targetDisplayId)) {
        error("Código de indicação inválido.");
        setSubmittingReferral(false);
        return;
      }

      // Find the user on Firestore that owns this displayId
      const q = query(collection(db, 'users'), where('displayId', '==', targetDisplayId));
      const snap = await getDocs(q);

      if (snap.empty) {
        error("Código não encontrado. Certifique-se de que o código de indicação do seu amigo está correto.");
        setSubmittingReferral(false);
        return;
      }

      const referrerUserDoc = snap.docs[0];
      const referrerUser = referrerUserDoc.data();

      // Award both users!
      // Current user gets 200 coins
      await updateCoins(200, 'add');
      
      // Update our profile with referredBy information
      await updateProfile({
        referredBy: referrerUser.uid
      } as any);

      // Award the friend 100 coins (done passively on cloud/direct update)
      const currentFriendCoins = referrerUser.coins || 0;
      await updateDoc(doc(db, 'users', referrerUser.uid), {
        coins: currentFriendCoins + 100
      });

      success(`Sucesso! Você e seu amigo @${referrerUser.displayName} ganharam bônus de indicação especial de 🪙 EGO Coins!`);
      setInputReferrer('');
      onClose();
    } catch (err: any) {
      console.error(err);
      error("Erro ao validar indicação.");
    } finally {
      setSubmittingReferral(false);
    }
  };

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
                <span className="text-[10px] font-black text-[#FF00F0] uppercase tracking-[0.25em] italic">Indique e Ganhe</span>
                <h3 className="text-2xl font-black text-white leading-tight uppercase tracking-tight italic flex items-center gap-2">
                  <Gift size={22} className="text-[#FF00F0] animate-pulse" /> CONVIDAR AMIGOS
                </h3>
              </div>
              <button 
                onClick={onClose} 
                className="p-2.5 bg-white/5 rounded-2xl text-white/30 hover:text-white transition-all hover:scale-105"
              >
                <X size={20} />
              </button>
            </div>

            {/* Campaign Header banner */}
            <div className="bg-gradient-to-tr from-purple-600 via-[#FF00F0]/20 to-black p-6 rounded-[32px] border border-fuchsia-500/20 mb-6 text-center">
              <Sparkles className="text-yellow-400 mx-auto animate-spin-slow mb-3" size={32} />
              <h4 className="text-sm font-black text-white uppercase italic tracking-wider">RECOMPENSAS DE INDICAÇÃO ATIVAS</h4>
              <p className="text-xs text-white/60 leading-relaxed font-semibold mt-2">
                Compartilhe seu código com um novo amigo. Quando ele resgatar, você ganha <span className="text-yellow-400 font-extrabold">🪙 100</span> e ele ganha <span className="text-yellow-400 font-extrabold">🪙 200</span> de bônus na hora!
              </p>
            </div>

            {/* Share Code Details */}
            <div className="space-y-3 mb-8">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1 block">Seu Código de Convite Único</label>
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex justify-between items-center gap-4">
                <span className="font-mono text-lg font-black text-[#FF00F0] tracking-wider italic uppercase">{myInviteCode}</span>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyCode}
                    className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all"
                    title="Copiar código"
                  >
                    <Clipboard size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Redeem Friend Code Form */}
            {!(profile as any)?.referredBy ? (
              <form onSubmit={handleRedeemCode} className="space-y-4">
                <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1 block">Quem te convidou? Insira o código:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={inputReferrer}
                    onChange={(e) => setInputReferrer(e.target.value.toUpperCase())}
                    placeholder="AURA-OOOOOO"
                    disabled={submittingReferral}
                    className="flex-1 bg-white/5 border border-white/5 focus:border-white/10 rounded-2xl p-4 text-sm font-black text-white outline-none font-mono"
                  />
                  <button
                    type="submit"
                    disabled={submittingReferral || !inputReferrer}
                    className="bg-white text-black font-black uppercase text-[10px] tracking-widest px-6 rounded-2xl active:scale-95 transition-all disabled:opacity-20 hover:bg-zinc-100"
                  >
                    Resgatar Boas-Vindas
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-3.5 text-green-400">
                <Check size={18} className="shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider">Você já recebeu o bônus de indicação de boas-vindas!</span>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
