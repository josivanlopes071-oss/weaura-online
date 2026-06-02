import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Trophy } from 'lucide-react';

interface ActiveGiftAnimation {
  id: string;
  senderName: string;
  receiverName: string;
  giftName: string;
  giftIcon: string;
  auraGained: number;
  quantity?: number;
  coinsGained?: number;
}

interface GiftAnimationOverlayProps {
  onAnimationComplete?: () => void;
  // Can be triggered locally via props
  activeAnimation?: ActiveGiftAnimation | null;
}

export default function GiftAnimationOverlay({ activeAnimation, onAnimationComplete }: GiftAnimationOverlayProps) {
  const [animation, setAnimation] = useState<ActiveGiftAnimation | null>(null);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; size: number; color: string }[]>([]);

  useEffect(() => {
    if (activeAnimation) {
      setAnimation(activeAnimation);
      
      // Generate confetti particles
      const colors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];
      const newParticles = Array.from({ length: 45 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100 - 50, // center offset x
        y: Math.random() * 100 - 50, // center offset y
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)]
      }));
      setParticles(newParticles);

      const timer = setTimeout(() => {
        setAnimation(null);
        if (onAnimationComplete) onAnimationComplete();
      }, 4200);

      return () => clearTimeout(timer);
    }
  }, [activeAnimation]);

  return (
    <AnimatePresence>
      {animation && (
        <div id="gift-animation-overlay-root" className="fixed inset-0 pointer-events-none z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          
          {/* Cosmic Glow Backplane */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute w-[350px] h-[350px] rounded-full filter blur-3xl opacity-30 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(168,85,247,0.8) 0%, rgba(236,72,153,0.3) 50%, transparent 100%)'
            }}
          />

          {/* Core Anim Container */}
          <div className="relative flex flex-col items-center justify-center p-8 text-center max-w-sm pointer-events-auto">
            
            {/* Exploding particles */}
            {particles.map((p) => (
              <motion.div
                key={p.id}
                initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                animate={{
                  x: p.x * 3.5,
                  y: p.y * 3.5 - 60,
                  scale: [1, 1.5, 0],
                  opacity: [1, 1, 0]
                }}
                transition={{
                  duration: 2.2,
                  ease: "easeOut",
                  delay: 0.8
                }}
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                  boxShadow: `0 0 10px ${p.color}`
                }}
              />
            ))}

            {/* Rising Floating Giant Gift Icon */}
            <motion.div
              initial={{ y: 280, scale: 0.2, rotate: -45, opacity: 0 }}
              animate={[
                { y: 0, scale: 1.3, rotate: 15, opacity: 1 }, // emerge & peak
                { rotate: -15, scale: 1.1, y: -20 }, // floating dance
                { scale: 1.4, rotate: 360, y: -15 } // final spin pop
              ]}
              exit={{ scale: 0, opacity: 0, y: -150 }}
              transition={{
                duration: 3.8,
                times: [0, 0.4, 0.8, 1],
                ease: "easeInOut"
              }}
              className="text-7xl mb-6 relative z-10 filter drop-shadow-[0_15px_25px_rgba(168,85,247,0.7)] hover:scale-125 transition-transform"
            >
              {animation.giftIcon}
              
              {animation.quantity && animation.quantity > 1 && (
                <span className="absolute -top-3 -right-3 bg-red-500 text-white font-black text-xs px-2.5 py-1 rounded-full select-none shadow-lg border border-red-400 animate-pulse">
                  x{animation.quantity}
                </span>
              )}

              {/* Spinning Halo */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
                className="absolute inset-[-12px] border-2 border-dashed border-purple-500/40 rounded-full"
              />
            </motion.div>

            {/* Animated Text Bubble */}
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="bg-black/85 border border-white/10 p-6 rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl relative z-10 min-w-[280px]"
            >
              <div className="flex items-center justify-center gap-1.5 text-pink-500/90 font-black text-[10px] uppercase tracking-[0.3em] mb-2.5 italic">
                <Sparkles size={11} className="animate-spin" /> PRESENTE ENVIADO <Sparkles size={11} className="animate-spin" />
              </div>

              <h3 className="text-sm font-bold text-white/50 mb-1 leading-relaxed">
                <span className="text-white font-extrabold text-base italic uppercase">{animation.senderName}</span> enviou <span className="text-pink-500 font-extrabold text-base">{animation.quantity && animation.quantity > 1 ? `${animation.quantity}x` : 'um'}</span> presente para <span className="text-white font-extrabold text-base italic uppercase">{animation.receiverName}</span>
              </h3>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-center gap-2 bg-purple-500/10 border border-purple-500/20 py-2.5 px-5 rounded-2xl">
                  <span className="text-xl font-bold">{animation.giftIcon}</span>
                  <span className="text-xs font-black text-purple-300 uppercase tracking-widest truncate max-w-[120px]">
                    {animation.giftName} {animation.quantity && animation.quantity > 1 ? `x${animation.quantity}` : ''}
                  </span>
                  <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20 whitespace-nowrap">
                    +{animation.auraGained} Aura
                  </span>
                </div>

                {animation.coinsGained && animation.coinsGained > 0 ? (
                  <div className="flex items-center justify-center gap-2 bg-yellow-500/10 border border-yellow-500/20 py-2 px-3 rounded-xl max-w-sm mx-auto animate-bounce mt-1">
                    <span className="text-sm">🪙</span>
                    <span className="text-[10px] font-black text-yellow-400 uppercase tracking-wider leading-tight">
                      Destinatário sorteado com: +{animation.coinsGained} Moedas EGO!
                    </span>
                  </div>
                ) : null}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
