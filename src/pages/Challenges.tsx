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
      className="p-6 pb-36 bg-[#020202] min-h-screen space-y-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between pt-4">
        <div>
          <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">Desafios</h1>
          <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mt-1">Complete desafios e ganhe recompensas!</p>
        </div>
        <div className="flex gap-3">
          <button className="w-12 h-12 bg-[#0c0c0c] rounded-2xl flex items-center justify-center border border-white/5 relative">
            <Bell size={20} className="text-white/40" />
            <div className="absolute top-3 right-3 w-2 h-2 bg-pink-500 rounded-full shadow-[0_0_10px_#ec4899]"></div>
          </button>
          <button className="w-12 h-12 bg-[#0c0c0c] rounded-2xl flex items-center justify-center border border-white/5">
            <HelpCircle size={20} className="text-white/40" />
          </button>
        </div>
      </div>

      {/* Main Banner */}
      <div className="bg-[#0c0c0c] rounded-[48px] border border-white/[0.08] p-8 shadow-premium relative overflow-hidden card-shine">
        <div className="absolute right-[-20px] top-6 opacity-30">
          <Gift size={140} className="text-purple-500 blur-sm" />
        </div>
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-24 h-24 bg-purple-500/10 rounded-[32px] flex items-center justify-center border border-purple-500/20 shadow-[0_0_40px_rgba(168,85,247,0.2)]">
            <Target size={48} className="text-purple-500 glow-purple" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-black text-white italic uppercase tracking-tight">Desafio Diário</h2>
            <p className="text-[10px] font-medium text-white/30 leading-relaxed mt-2 uppercase">Conclua todos os desafios diários e ganhe uma recompensa especial!</p>
            
            <div className="mt-4 flex items-center justify-between">
              <div className="flex-1 h-2 bg-black rounded-full overflow-hidden mr-4">
                <div className="h-full bg-gradient-to-r from-purple-600 to-purple-400 w-3/5 shadow-[0_0_15px_#a855f7]"></div>
              </div>
              <span className="text-[10px] font-black text-white/40 italic">3/5</span>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="relative">
               <img src="https://cdn-icons-png.flaticon.com/512/8141/8141477.png" className="w-24 h-24 object-contain filter drop-shadow-[0_0_20px_rgba(168,85,247,0.4)]" alt="Chest" />
               <div className="absolute inset-0 bg-purple-500/20 blur-2xl -z-10 rounded-full" />
            </div>
            <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest mt-2 italic animate-pulse">Em andamento</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 overflow-x-auto scrollbar-hide py-2 px-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-8 py-4 rounded-[28px] border text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap italic ${
              activeTab === tab 
                ? 'bg-white text-black border-white shadow-xl scale-[1.05]' 
                : 'bg-[#0c0c0c] border-white/5 text-white/20 hover:text-white/40'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Challenges List */}
      <div className="space-y-4">
        {dailyChallenges.map((ch) => (
          <div key={ch.id} className="bg-[#0c0c0c] rounded-[40px] border border-white/[0.08] p-6 flex items-center gap-6 group hover:border-white/20 transition-all card-shine">
            <div className={`w-18 h-18 rounded-[28px] flex items-center justify-center border bg-zinc-950/50 ${
              ch.color === 'blue' ? 'border-blue-500/30 text-blue-500' : 
              ch.color === 'green' ? 'border-green-500/30 text-green-500' :
              ch.color === 'pink' ? 'border-pink-500/30 text-pink-500' : 'border-purple-500/30 text-purple-500'
            }`}>
              {ch.id === 1 && <Gamepad2 size={28} />}
              {ch.id === 2 && <Users size={28} />}
              {ch.id === 3 && <Target size={28} />}
              {ch.id === 4 && <Trophy size={28} />}
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-black text-white italic leading-tight uppercase tracking-tight">{ch.title}</h4>
              <p className="text-[10px] font-medium text-white/20 mt-1 uppercase truncate">{ch.desc}</p>
              
              <div className="mt-4 flex items-center justify-between">
                <div className="flex-1 h-1.5 bg-black rounded-full overflow-hidden mr-4">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(ch.progress / ch.total) * 100}%` }}
                    className={`h-full shadow-[0_0_10px_currentColor] ${
                      ch.color === 'blue' ? 'bg-blue-500 text-blue-500' : 
                      ch.color === 'green' ? 'bg-green-500 text-green-500' :
                      ch.color === 'pink' ? 'bg-pink-500 text-pink-500' : 'bg-purple-500 text-purple-500'
                    }`} 
                  />
                </div>
                <span className="text-[10px] font-black text-white/30 italic">{ch.progress}/{ch.total}</span>
              </div>
            </div>

            <div className={`bg-zinc-950/50 p-4 rounded-[28px] border border-white/5 flex flex-col items-center justify-center min-w-[100px] text-center ${ch.completed ? 'border-green-500/30 bg-green-500/5' : ''}`}>
               {ch.completed ? (
                 <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-black shadow-[0_0_15px_#22c55e]">
                   <Check size={20} strokeWidth={4} />
                 </div>
               ) : (
                 <>
                   <div className={`text-xl font-black italic tracking-tighter mb-1 ${
                     ch.reward.includes('MOEDAS') ? 'text-yellow-500' : 'text-green-500'
                   }`}>
                     {ch.reward.split(' ')[0]}
                   </div>
                   <div className="text-[8px] font-black text-white/20 uppercase tracking-widest leading-none">
                     {ch.reward.split(' ')[1]}
                   </div>
                 </>
               )}
            </div>
            {!ch.completed && (
               <ChevronRight size={20} className="text-white/10 group-hover:text-white transition-colors" />
            )}
          </div>
        ))}
      </div>

      {/* Premium Banner */}
      <div className="bg-gradient-to-r from-yellow-500/10 via-yellow-500/20 to-orange-500/10 rounded-[48px] border border-yellow-500/20 p-8 shadow-premium relative overflow-hidden group">
         <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-6">
               <div className="w-16 h-16 bg-yellow-500 rounded-[28px] flex items-center justify-center shadow-[0_10px_30px_rgba(234,179,8,0.4)] border-4 border-black/10">
                  <Crown size={32} className="text-white animate-bounce" />
               </div>
               <div>
                  <h3 className="text-lg font-black text-yellow-500 italic uppercase leading-none">Desafio Premium</h3>
                  <p className="text-[10px] font-bold text-yellow-500/40 uppercase tracking-widest mt-2 max-w-[180px]">Assine o Premium e desbloqueie desafios exclusivos!</p>
               </div>
            </div>
            <button className="bg-[#0c0c0c] border border-white/10 text-white px-8 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-[0.25em] italic hover:bg-white hover:text-black transition-all">Ver Premium</button>
         </div>
         <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400 blur-[80px] opacity-10 group-hover:opacity-20 transition-opacity" />
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
