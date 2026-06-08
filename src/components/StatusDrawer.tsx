import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Smile, MessageSquare, Check, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface StatusDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMOJI_PRESETS = ['🔋', '☕', '⚡', '🎮', '🔥', '👑', '🎭', '🍿', '💡', '🎵', '💔', '💤', '💭', '🚀', '🔮', '🧸'];

export default function StatusDrawer({ isOpen, onClose }: StatusDrawerProps) {
  const { profile, updateProfile } = useAuth();
  const { success, error } = useToast();
  
  const [statusText, setStatusText] = useState((profile as any)?.statusMessage || '');
  const [selectedEmoji, setSelectedEmoji] = useState((profile as any)?.statusEmoji || '☕');
  const [submitting, setSubmitting] = useState(false);

  const handleApplyStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSubmitting(true);
    try {
      await updateProfile({
        statusMessage: statusText.trim(),
        statusEmoji: selectedEmoji
      } as any);
      
      success("Status atualizado com sucesso!");
      onClose();
    } catch (err) {
      error("Erro ao aplicar status.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearStatus = async () => {
    if (!profile) return;
    setSubmitting(true);
    try {
      await updateProfile({
        statusMessage: '',
        statusEmoji: ''
      } as any);
      setStatusText('');
      setSelectedEmoji('☕');
      success("Status limpo com sucesso!");
      onClose();
    } catch (err) {
      error("Erro ao limpar status.");
    } finally {
      setSubmitting(false);
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
            className="fixed inset-x-0 bottom-0 bg-[#0a0a0a] rounded-t-[40px] border-t border-white/5 p-6 z-[70] pb-12 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.25em] italic">Mensagem Temporária</span>
                <h3 className="text-2xl font-black text-white leading-tight uppercase tracking-tight italic flex items-center gap-2">
                  <Smile size={22} className="text-rose-500 animate-pulse" /> DEFINIR STATUS ATIVO
                </h3>
              </div>
              <button 
                onClick={onClose} 
                className="p-2.5 bg-white/5 rounded-2xl text-white/30 hover:text-white transition-all hover:scale-105"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleApplyStatus} className="space-y-6">
              {/* Message Input with integrated emoji tag */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">Mensagem de Status</label>
                <div className="relative flex items-center bg-white/5 border border-white/5 focus-within:border-white/10 rounded-2xl p-4 transition-all">
                  <span className="text-2xl mr-3 bg-black/30 p-1.5 rounded-xl border border-white/5">{selectedEmoji}</span>
                  <input
                    type="text"
                    maxLength={35}
                    value={statusText}
                    onChange={(e) => setStatusText(e.target.value)}
                    placeholder="O que está rolando agora? (máx. 35 chars)"
                    className="flex-1 bg-transparent text-sm font-bold text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Grid of EMOJI presets */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-1">Selecione seu Humor</label>
                <div className="grid grid-cols-8 gap-2">
                  {EMOJI_PRESETS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setSelectedEmoji(emoji)}
                      className={`aspect-square rounded-xl text-xl flex items-center justify-center p-2.5 transition-all ${
                        selectedEmoji === emoji
                          ? 'bg-rose-500/10 border-rose-500/50 scale-[1.08]'
                          : 'bg-white/5 hover:bg-white/10 border border-transparent'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description summary */}
              <p className="text-[10px] leading-relaxed text-zinc-500 uppercase tracking-wider text-center py-2 italic font-semibold">
                Seu status aparecerá ao lado do seu nome de exibição nos canais de voz pública.
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-3">
                {((profile as any)?.statusMessage || (profile as any)?.statusEmoji) && (
                  <button
                    type="button"
                    onClick={handleClearStatus}
                    className="flex-1 bg-white/5 border border-white/5 hover:bg-white/10 hover:text-red-400 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Limpar Atual
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-white hover:bg-zinc-100 text-black font-black uppercase text-[10px] tracking-widest py-4 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  Salvar Mudança
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
