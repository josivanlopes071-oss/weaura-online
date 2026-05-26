import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, ChevronRight, X, Sparkles, Mic, Gift, Crown, Users } from 'lucide-react';

interface TourStep {
  targetId: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  badge: string;
  position: 'top' | 'bottom' | 'center';
}

interface OnboardingTourProps {
  onComplete?: () => void;
  forceShow?: boolean;
}

export default function OnboardingTour({ onComplete, forceShow = false }: OnboardingTourProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  
  const steps: TourStep[] = [
    {
      targetId: 'tour-host-seat',
      title: 'Palco Principal',
      description: 'Este é o assento do Anfitrião (Host). Quem estiver aqui gerencia a sala, dá as boas-vindas aos usuários e brilha no topo!',
      icon: Crown,
      badge: 'Assento Principal',
      position: 'bottom',
    },
    {
      targetId: 'tour-audience-seats',
      title: 'Assentos da Plateia',
      description: 'Quer subir para conversar por voz? Basta dar um toque em qualquer um dos assentos vazios numerados para "subir" e começar a interagir.',
      icon: Users,
      badge: 'Canais de Voz',
      position: 'bottom',
    },
    {
      targetId: 'tour-mic-button',
      title: 'Controle de Microfone',
      description: 'Quando estiver sentado, use este botão para mutar e desmutar seu microfone instantaneamente. Lembre-se de dar permissão ao navegador!',
      icon: Mic,
      badge: 'Controle de Áudio',
      position: 'top',
    },
    {
      targetId: 'tour-gift-button',
      title: 'Mimos & Presentes',
      description: 'Demonstre apoio enviando mimos interativos! Enviar presentes ajuda a subir no Ranking e ativa reações animadas de áudio.',
      icon: Gift,
      badge: 'Apoio à Comunidade',
      position: 'top',
    }
  ];

  // Check if user has already seen the onboarding
  useEffect(() => {
    if (forceShow) {
      setIsOpen(true);
      setCurrentStep(0);
      return;
    }
    
    let wasCompleted = null;
    try {
      wasCompleted = localStorage.getItem('weplay_voice_onboarding_done');
    } catch (e) {
      console.warn("Storage item reading failed inside private mode:", e);
    }
    if (!wasCompleted) {
      // Delay slightly for smooth transition on room enter
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  // Update target coordinates whenever currentStep, window size or open state changes
  useEffect(() => {
    if (!isOpen) return;

    const updateCoordinates = () => {
      const step = steps[currentStep];
      const element = document.getElementById(step.targetId);
      
      if (element) {
        // Ensure element is scrolled into view gently if needed
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Wait minor delay for scroll completion
        setTimeout(() => {
          const rect = element.getBoundingClientRect();
          setCoords({
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
            height: rect.height
          });
        }, 150);
      } else {
        setCoords(null); // Fallback to centered modal
      }
    };

    updateCoordinates();
    window.addEventListener('resize', updateCoordinates);
    return () => window.removeEventListener('resize', updateCoordinates);
  }, [isOpen, currentStep]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const handleSkip = () => {
    handleClose();
  };

  const handleClose = () => {
    setIsOpen(false);
    try {
      localStorage.setItem('weplay_voice_onboarding_done', 'true');
    } catch (e) {
      console.warn("Storage item setting failed inside private mode:", e);
    }
    if (onComplete) onComplete();
  };

  if (!isOpen) return null;

  const step = steps[currentStep];
  const StepIcon = step.icon;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden pointer-events-auto">
      {/* Immersive darker animated mask or overlay */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-[2px]"
        onClick={handleSkip}
      />

      {/* SVG Spotlight mask for highlighting the targeted DOM element */}
      {coords && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 hidden sm:block">
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {/* Carve-out hole with matching padding */}
              <rect 
                x={coords.left - 8} 
                y={coords.top - 8} 
                width={coords.width + 16} 
                height={coords.height + 16} 
                rx="24" 
                fill="black" 
              />
            </mask>
          </defs>
          <rect x="0" y="0" width="100%" height="100%" fill="transparent" mask="url(#spotlight-mask)" />
        </svg>
      )}

      {/* Glowing spotlight ring around the target */}
      {coords && (
        <motion.div
          key={`ring-${currentStep}`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute border-[2.5px] border-purple-500 rounded-[24px] pointer-events-none z-20 shadow-[0_0_30px_rgba(168,85,247,0.7)]"
          style={{
            top: coords.top - 8,
            left: coords.left - 8,
            width: coords.width + 16,
            height: coords.height + 16,
          }}
        >
          {/* Pulsing sub-ring */}
          <div className="absolute inset-0 border border-purple-400 rounded-[22px] animate-ping opacity-30" />
        </motion.div>
      )}

      {/* Popover / Tooltip Card Container */}
      <div className="absolute inset-0 flex items-center justify-center p-4 z-50 pointer-events-none">
        <motion.div
          key={`card-${currentStep}`}
          initial={{ opacity: 0, y: 15, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="w-full max-w-sm glass-dark border border-white/10 rounded-[32px] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] pointer-events-auto relative overflow-hidden flex flex-col"
          style={
            coords && window.innerWidth > 640
              ? {
                  position: 'absolute',
                  // Target coordinates plus/minus position adjustments offset
                  top: step.position === 'bottom' 
                    ? Math.min(window.innerHeight - 340, coords.top + coords.height + 20) 
                    : Math.max(20, coords.top - 320),
                  left: Math.max(20, Math.min(window.innerWidth - 400, coords.left + (coords.width / 2) - 192)),
                }
              : undefined
          }
        >
          {/* Top subtle visual rainbow-glow gradient bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500" />
          
          <div className="flex items-center justify-between mb-4 mt-2">
            <span className="flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase text-purple-400 tracking-wider">
              <Sparkles size={10} className="animate-spin-slow" />
              {step.badge}
            </span>
            <button 
              onClick={handleSkip}
              className="w-7 h-7 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all active:scale-90"
              title="Pular Tutorial"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex items-start gap-4 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(168,85,247,0.4)]">
              <StepIcon size={22} className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]" />
            </div>
            <div>
              <h4 className="text-base font-black text-white tracking-tight leading-snug">
                {step.title}
              </h4>
              <p className="text-xs text-white/60 mt-1 leading-relaxed font-medium">
                {step.description}
              </p>
            </div>
          </div>

          {/* Progress / Buttons Bottom Row */}
          <div className="flex items-center justify-between pt-1 border-t border-white/5 mt-auto">
            {/* Step Indicators */}
            <div className="flex items-center gap-1.5">
              {steps.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentStep ? 'w-5 bg-purple-500' : 'w-1.5 bg-white/10'
                  }`}
                />
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {currentStep < steps.length - 1 ? (
                <>
                  <button 
                    onClick={handleSkip}
                    className="px-3.5 py-2 rounded-xl text-[10px] font-black uppercase text-white/40 hover:text-white/80 transition-colors"
                  >
                    Pular
                  </button>
                  <button 
                    onClick={handleNext}
                    className="flex items-center gap-1 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] active:scale-95"
                  >
                    Próximo
                    <ChevronRight size={12} />
                  </button>
                </>
              ) : (
                <button 
                  onClick={handleClose}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all hover:shadow-[0_0_20px_rgba(236,72,153,0.4)] active:scale-95"
                >
                  Concluir Tour
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
