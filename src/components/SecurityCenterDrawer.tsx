import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, Smartphone, Mail, Lock, History, Laptop, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface SecurityCenterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SecurityCenterDrawer({ isOpen, onClose }: SecurityCenterDrawerProps) {
  const { profile, updateProfile } = useAuth();
  const { success, error } = useToast();

  const [emailVerify, setEmailVerify] = useState((profile as any)?.emailVerified || false);
  const [phoneVerify, setPhoneVerify] = useState((profile as any)?.phoneVerified || false);
  const [allow2fa, setAllow2fa] = useState((profile as any)?.twoFactorEnabled || false);
  const [submitting, setSubmitting] = useState(false);

  // Simulated Login Devices
  const devices = [
    { name: 'Redmi Note 12 (Este Aparelho)', location: 'São Paulo, BR', ip: '177.105.12.92', date: 'Ativo agora', type: 'mobile' },
    { name: 'Chrome on Windows Desktop', location: 'Rio de Janeiro, BR', ip: '189.4.52.203', date: 'Há 2 dias', type: 'desktop' },
  ];

  const handleToggleEmail = async () => {
    setSubmitting(true);
    try {
      const nextVal = !emailVerify;
      await updateProfile({ emailVerified: nextVal } as any);
      setEmailVerify(nextVal);
      success(nextVal ? "E-mail verificado com sucesso!" : "Verificação de e-mail desativada.");
    } catch (e) {
      error("Falha ao salvar alteração.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePhone = async () => {
    setSubmitting(true);
    try {
      const nextVal = !phoneVerify;
      await updateProfile({ phoneVerified: nextVal } as any);
      setPhoneVerify(nextVal);
      success(nextVal ? "Número de celular autenticado!" : "Vínculo de celular removido.");
    } catch (e) {
      error("Falha ao salvar alteração.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle2fa = async () => {
    setSubmitting(true);
    try {
      const nextVal = !allow2fa;
      await updateProfile({ twoFactorEnabled: nextVal } as any);
      setAllow2fa(nextVal);
      success(nextVal ? "Autenticação em duas etapas (2FA) HABILITADA!" : "2FA desativado para o perfil.");
    } catch (e) {
      error("Erro ao alterar 2FA.");
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
            className="fixed inset-x-0 bottom-0 bg-[#0a0a0a] rounded-t-[40px] border-t border-white/5 p-6 z-[70] pb-12 shadow-2xl h-[80vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-green-500 uppercase tracking-[0.25em] italic">Segurança & Privacidade</span>
                <h3 className="text-2xl font-black text-white leading-tight uppercase tracking-tight italic flex items-center gap-2">
                  <Shield size={22} className="text-green-500 animate-pulse" /> CENTRO DE SEGURANÇA
                </h3>
              </div>
              <button 
                onClick={onClose} 
                className="p-2.5 bg-white/5 rounded-2xl text-white/30 hover:text-white transition-all hover:scale-105"
              >
                <X size={20} />
              </button>
            </div>

            {/* Shield Security Status Widget */}
            <div className="mb-6 p-4 rounded-3xl bg-green-500/10 border border-green-500/20 flex gap-4 items-center">
              <CheckCircle size={32} className="text-green-400 shrink-0" />
              <div>
                <h4 className="text-sm font-black text-white uppercase italic">Sua Conta está Protegida</h4>
                <p className="text-[10.5px] font-semibold text-white/60 leading-relaxed mt-1">
                  Recomendamos ativar o vínculo de celular e o 2FA para garantir que suas moedas EGO fiquem totalmente seguras.
                </p>
              </div>
            </div>

            {/* Toggle Configuration List */}
            <div className="space-y-4 mb-8">
              <h4 className="text-[9px] font-black text-white/35 uppercase tracking-[0.15em] ml-1">VÍNCULOS E PROTEÇÃO DA AURORA</h4>
              
              {/* Email verify button */}
              <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                <div className="flex items-center gap-3">
                  <Mail size={18} className="text-green-400" />
                  <div>
                    <span className="text-xs font-black text-white uppercase block leading-none">Verificação de E-mail</span>
                    <span className="text-[9px] font-bold text-white/30 uppercase mt-1 block">Aumenta XP ganho no app</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleEmail}
                  disabled={submitting}
                  className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${emailVerify ? 'bg-green-500 text-black' : 'bg-white/5 text-white/50 border border-white/5'}`}
                >
                  {emailVerify ? 'VERIFICADO' : 'ATIVAR'}
                </button>
              </div>

              {/* Phone verify button */}
              <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                <div className="flex items-center gap-3">
                  <Smartphone size={18} className="text-blue-400" />
                  <div>
                    <span className="text-xs font-black text-white uppercase block leading-none">Celular Autenticado (SMS)</span>
                    <span className="text-[9px] font-bold text-white/30 uppercase mt-1 block">Proteção contra bots</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleTogglePhone}
                  disabled={submitting}
                  className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${phoneVerify ? 'bg-blue-500 text-black' : 'bg-white/5 text-white/50 border border-white/5'}`}
                >
                  {phoneVerify ? 'VINCULADO' : 'VINCULAR'}
                </button>
              </div>

              {/* 2fa configure */}
              <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                <div className="flex items-center gap-3">
                  <Lock size={18} className="text-purple-400" />
                  <div>
                    <span className="text-xs font-black text-white uppercase block leading-none">Autenticação 2FA</span>
                    <span className="text-[9px] font-bold text-white/30 uppercase mt-1 block">Código temporário de acesso</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggle2fa}
                  disabled={submitting}
                  className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${allow2fa ? 'bg-purple-600 text-white shadow-lg' : 'bg-white/5 text-white/50 border border-white/5'}`}
                >
                  {allow2fa ? 'ATIVADO' : 'HABILITAR'}
                </button>
              </div>
            </div>

            {/* Display Active Devices logs */}
            <div className="space-y-4">
              <h4 className="text-[9px] font-black text-white/35 uppercase tracking-[0.15em] ml-1 flex items-center gap-2">
                <History size={12} /> HISTÓRICO DE ACESSO RECENTE
              </h4>

              <div className="space-y-3">
                {devices.map((device, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-white/[0.01] border border-white/[0.03] rounded-2xl">
                    <div className="flex items-center gap-3">
                      <Laptop size={16} className="text-zinc-500" />
                      <div>
                        <span className="text-xs font-black text-white block uppercase leading-none">{device.name}</span>
                        <span className="text-[9px] font-semibold text-zinc-500 block mt-1">{device.location} • {device.ip}</span>
                      </div>
                    </div>
                    <span className="text-[8px] font-black text-green-400 tracking-wider uppercase bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-lg">
                      {device.date}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
