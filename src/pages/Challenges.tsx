import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, Target, Users, Zap, Crown, ChevronRight, Bell, HelpCircle, Gamepad2, Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Challenges() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Diários');

  const tabs = ['Diários', 'Semanais', 'Temporários', 'Concluídos'];

  const dailyChallenges = [
    { 
      id: 1, 
      title: 'Jogar 3 partidas', 
      desc: 'Jogue qualquer modo 3 vezes', 
      progress: 2, 
      total: 3, 
      reward: '50 MOEDAS', 
      rewardIcon: 'https://cdn-icons-png.flaticon.com/512/2489/2489756.png',
      color: 'blue' 
    },
    { 
      id: 2, 
      title: 'Convidar 1 amigo', 
      desc: 'Convide 1 amigo para a plataforma', 
      progress: 1, 
      total: 1, 
      reward: '100 XP', 
      rewardIcon: 'https://cdn-icons-png.flaticon.com/512/6165/6165577.png',
      completed: true,
      color: 'green' 
    },
    { 
      id: 3, 
      title: 'Fazer 10 eliminações', 
      desc: 'Consiga 10 eliminações em qualquer modo', 
      progress: 6, 
      total: 10, 
      reward: '120 MOEDAS', 
      rewardIcon: 'https://cdn-icons-png.flaticon.com/512/2489/2489756.png',
      color: 'pink' 
    },
    { 
      id: 4, 
      title: 'Vencer 2 partidas', 
      desc: 'Vença 2 partidas em qualquer modo', 
      progress: 0, 
      total: 2, 
      reward: '150 XP', 
      rewardIcon: 'https://cdn-icons-png.flaticon.com/512/6165/6165577.png',
      color: 'purple' 
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 md:p-6 pb-32 space-y-6 min-h-screen bg-transparent"
    >
      {/* Header and Quick Stats */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white italic tracking-tighter uppercase">
            Desafios
          </h1>
          <p className="text-[10px] font-bold text-zinc-400 dark:text-white/30 uppercase tracking-wider mt-0.5">
            Complete metas e resgate suas recompensas
          </p>
        </div>
        <div className="flex gap-2.5">
          <button className="w-10 h-10 bg-zinc-100 dark:bg-[#0c0c0c] rounded-xl flex items-center justify-center border border-zinc-200 dark:border-white/5 relative hover:border-zinc-300 dark:hover:border-white/20 transition-all">
            <Bell size={16} className="text-zinc-500 dark:text-white/40" />
            <div className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-pink-500 rounded-full shadow-[0_0_8px_#ec4899]"></div>
          </button>
          <button className="w-10 h-10 bg-zinc-100 dark:bg-[#0c0c0c] rounded-xl flex items-center justify-center border border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/20 transition-all">
            <HelpCircle size={16} className="text-zinc-500 dark:text-white/40" />
          </button>
        </div>
      </div>

      {/* Main Campaign/Target Banner simplified */}
      <div className="bg-zinc-100/80 dark:bg-[#0c0c0c]/80 rounded-2xl border border-zinc-200 dark:border-white/[0.08] p-5 shadow-sm relative overflow-hidden backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 relative z-10">
          <div className="w-14 h-14 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/20 shrink-0">
            <Target size={26} className="text-purple-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-black text-zinc-900 dark:text-white italic uppercase tracking-tight">Campanha Diária</h2>
            <p className="text-[10px] font-medium text-zinc-500 dark:text-white/40 mt-1 uppercase leading-snug">
              Conclua 5 desafios hoje para desbloquear o baú místico
            </p>
            
            <div className="mt-3.5 flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-black rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-600 to-pink-500 w-3/5 shadow-[0_0_10px_rgba(168,85,247,0.3)]"></div>
              </div>
              <span className="text-[10px] font-black text-zinc-400 dark:text-white/40 italic font-mono shrink-0">3/5</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto mt-2 sm:mt-0">
            <div className="relative">
               <img src="https://cdn-icons-png.flaticon.com/512/8141/8141477.png" className="w-14 h-14 object-contain filter drop-shadow-[0_4px_10px_rgba(168,85,247,0.2)]" alt="Chest" />
            </div>
            <span className="text-[8px] font-black text-purple-500 border border-purple-500/15 bg-purple-500/5 px-2 py-1 rounded-md uppercase tracking-wider italic animate-pulse">Andamento</span>
          </div>
        </div>
      </div>

      {/* Tabs list streamlined */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap italic border ${
              activeTab === tab 
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-black border-transparent shadow-sm' 
                : 'bg-zinc-100/50 hover:bg-zinc-150 border-zinc-200/60 dark:bg-[#0c0c0c] dark:border-white/5 text-zinc-400 dark:text-white/30 hover:text-zinc-500 dark:hover:text-white/50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Challenges List rendered in a very clean grid */}
      <div className="space-y-3">
        {dailyChallenges.map((ch) => (
          <div key={ch.id} className="bg-zinc-100/60 dark:bg-[#0c0c0c]/80 rounded-2xl border border-zinc-200/60 dark:border-white/[0.06] p-4 flex items-center justify-between gap-4 hover:border-zinc-300 dark:hover:border-white/10 transition-all">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 bg-white/50 dark:bg-zinc-950/40 ${
                ch.color === 'blue' ? 'border-blue-500/20 text-blue-500' : 
                ch.color === 'green' ? 'border-green-500/20 text-green-500' :
                ch.color === 'pink' ? 'border-pink-500/20 text-pink-500' : 'border-purple-500/20 text-purple-500'
              }`}>
                {ch.id === 1 && <Gamepad2 size={18} />}
                {ch.id === 2 && <Users size={18} />}
                {ch.id === 3 && <Target size={18} />}
                {ch.id === 4 && <Trophy size={18} />}
              </div>
              
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-black text-zinc-900 dark:text-white italic uppercase tracking-tight truncate leading-tight">
                  {ch.title}
                </h4>
                <p className="text-[9px] font-medium text-zinc-400 dark:text-white/30 mt-0.5 uppercase truncate leading-none">
                  {ch.desc}
                </p>
                
                {/* Slimmer progress bar */}
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-zinc-200 dark:bg-zinc-900 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(ch.progress / ch.total) * 100}%` }}
                      className={`h-full ${
                        ch.color === 'blue' ? 'bg-blue-500' : 
                        ch.color === 'green' ? 'bg-green-500' :
                        ch.color === 'pink' ? 'bg-pink-500' : 'bg-purple-500'
                      }`} 
                    />
                  </div>
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-white/30 font-mono shrink-0">{ch.progress}/{ch.total}</span>
                </div>
              </div>
            </div>

            {/* Quick Reward Badge */}
            <div className="flex items-center gap-2 shrink-0">
              <div className={`p-2.5 rounded-xl border flex flex-col items-center justify-center min-w-[76px] ${
                ch.completed 
                  ? 'border-green-500/20 bg-green-500/5 text-green-500' 
                  : 'border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-zinc-900/40'
              }`}>
                 {ch.completed ? (
                   <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-black">
                     <Check size={12} strokeWidth={4} />
                   </div>
                 ) : (
                   <div className="text-center">
                     <div className={`text-[10px] font-black italic mt-0.5 ${
                       ch.reward.includes('MOEDAS') ? 'text-yellow-600 dark:text-yellow-500' : 'text-green-600 dark:text-green-500'
                     }`}>
                       {ch.reward.split(' ')[0]}
                     </div>
                     <div className="text-[7px] font-bold text-zinc-400 dark:text-white/20 uppercase tracking-widest leading-none mt-0.5">
                       {ch.reward.split(' ')[1]}
                     </div>
                   </div>
                 )}
              </div>
              {!ch.completed && (
                <ChevronRight size={14} className="text-zinc-300 dark:text-white/10" />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Premium Upgrades Banner redefined and refined */}
      <div className="bg-gradient-to-r from-yellow-500/5 via-yellow-500/10 to-transparent dark:from-yellow-500/10 dark:via-yellow-500/5 dark:to-transparent rounded-2xl border border-yellow-500/20 p-5 shadow-sm relative overflow-hidden group">
         <div className="flex items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3.5">
               <div className="w-11 h-11 bg-yellow-500 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-yellow-400/20">
                  <Crown size={22} className="text-white" />
               </div>
               <div>
                  <h3 className="text-xs font-black text-yellow-600 dark:text-yellow-500 italic uppercase">Assinatura Premium</h3>
                  <p className="text-[9px] font-medium text-zinc-500 dark:text-yellow-500/40 uppercase tracking-wider mt-0.5">
                     Desbloqueie conquistas secretas e aceleradores
                  </p>
               </div>
            </div>
            <button className="bg-zinc-900 text-white dark:bg-[#0c0c0c] border border-zinc-800 dark:border-white/10 hover:bg-zinc-800 hover:text-white dark:hover:bg-white dark:hover:text-black px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all italic shrink-0">
              Assinar Premium
            </button>
         </div>
      </div>
    </motion.div>
  );
}

function Check({ size, className, strokeWidth }: { size: number, className?: string, strokeWidth?: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth={strokeWidth || 2} 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
