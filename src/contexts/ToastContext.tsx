import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X, Sparkles } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Native synth sound feed for custom interface feel
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        
        let freq = 600;
        if (type === 'success') {
          freq = 800;
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
        } else if (type === 'error') {
          freq = 300;
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.2);
        } else {
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
        }
        
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch {
      // Audio context blocked or unsupported
    }

    // Auto-remove after 4.5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const success = useCallback((msg: string) => showToast(msg, 'success'), [showToast]);
  const error = useCallback((msg: string) => showToast(msg, 'error'), [showToast]);
  const warn = useCallback((msg: string) => showToast(msg, 'warning'), [showToast]);
  const info = useCallback((msg: string) => showToast(msg, 'info'), [showToast]);

  // Handle high-jack of standard alerts inside sandbox
  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (message: any) => {
      const msgStr = String(message);
      if (msgStr.toLowerCase().includes('sucesso') || msgStr.toLowerCase().includes('salvo') || msgStr.toLowerCase().includes('adquirida')) {
        success(msgStr);
      } else if (msgStr.toLowerCase().includes('erro') || msgStr.toLowerCase().includes('falha') || msgStr.toLowerCase().includes('insuficiente') || msgStr.toLowerCase().includes('negada')) {
        error(msgStr);
      } else if (msgStr.toLowerCase().includes('atenção') || msgStr.toLowerCase().includes('aviso')) {
        warn(msgStr);
      } else {
        info(msgStr);
      }
      console.log(`[Alert Interceptor] Intercepted: "${msgStr}"`);
    };

    return () => {
      window.alert = originalAlert;
    };
  }, [success, error, warn, info]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast, success, error, warn, info }}>
      {children}
      
      {/* Toast Overlay HUD portal */}
      <div 
        id="toast-overlay-container" 
        className="fixed bottom-24 right-4 md:right-8 z-[200] max-w-sm w-full flex flex-col gap-3 pointer-events-none"
      >
        <AnimatePresence>
          {toasts.map((toast) => {
            const isSuccess = toast.type === 'success';
            const isError = toast.type === 'error';
            const isWarning = toast.type === 'warning';

            let accentBg = 'border-[#8A2EFF]/30 bg-black/90';
            let iconColor = 'text-purple-400';
            let progressColor = 'bg-purple-500';
            let IconComponent = Info;

            if (isSuccess) {
              accentBg = 'border-[#10b981]/30 bg-[#021f15]/95';
              iconColor = 'text-[#10b981]';
              progressColor = 'bg-[#10b981]';
              IconComponent = CheckCircle2;
            } else if (isError) {
              accentBg = 'border-[#ef4444]/30 bg-[#250909]/95';
              iconColor = 'text-[#ef4444]';
              progressColor = 'bg-[#ef4444]';
              IconComponent = AlertCircle;
            } else if (isWarning) {
              accentBg = 'border-[#eab308]/30 bg-[#221703]/95';
              iconColor = 'text-[#eab308]';
              progressColor = 'bg-[#eab308]';
              IconComponent = AlertCircle;
            }

            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
                className={`pointer-events-auto rounded-[24px] border border-white/5 p-4 flex items-start gap-3.5 shadow-2xl backdrop-blur-md relative overflow-hidden group ${accentBg}`}
              >
                {/* Accent glow bar */}
                <div className={`absolute top-0 bottom-0 left-0 w-[4px] ${progressColor}`} />

                {/* Left Icon */}
                <div className={`rounded-xl p-2 bg-white/5 flex-shrink-0 ${iconColor}`}>
                  <IconComponent size={16} />
                </div>

                {/* Right message textual information */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="text-[9px] font-black uppercase text-white/30 tracking-widest leading-none">
                    {toast.type}
                  </div>
                  <p className="text-white text-xs font-bold leading-relaxed mt-1 pr-1 break-words">
                    {toast.message}
                  </p>
                </div>

                {/* Dismiss Button */}
                <button
                  onClick={() => removeToast(toast.id)}
                  className="flex-shrink-0 text-white/20 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all self-center"
                >
                  <X size={13} strokeWidth={2.5} />
                </button>

                {/* Timing bar */}
                <motion.div 
                  initial={{ width: '100%' }}
                  animate={{ width: 0 }}
                  transition={{ duration: 4.5, easing: 'linear' }}
                  className={`absolute bottom-0 left-0 h-[2px] ${progressColor}`}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
