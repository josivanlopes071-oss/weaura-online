export interface GiftItem {
  id: string;
  name: string;
  icon: string;
  price: number;
  aura: number;
  color: string; // Tailwind textual color
  bgColor: string; // Tailwind badge background
  borderColor: string;
  glowColor: string; // Hex color for box-shadows / particles
}

export const GIFTS: GiftItem[] = [
  { 
    id: 'amor', 
    name: 'Amor', 
    icon: '💖', 
    price: 10, 
    aura: 10, 
    color: 'text-rose-500', 
    bgColor: 'bg-rose-500/10', 
    borderColor: 'border-rose-500/20',
    glowColor: '#f43f5e'
  },
  { 
    id: 'estrela', 
    name: 'Estrela', 
    icon: '⭐', 
    price: 50, 
    aura: 55, 
    color: 'text-amber-400', 
    bgColor: 'bg-amber-400/10', 
    borderColor: 'border-amber-400/20',
    glowColor: '#eab308'
  },
  { 
    id: 'fogo', 
    name: 'Fogo', 
    icon: '🔥', 
    price: 100, 
    aura: 120, 
    color: 'text-orange-500', 
    bgColor: 'bg-orange-500/10', 
    borderColor: 'border-orange-500/20',
    glowColor: '#ef4444'
  },
  { 
    id: 'trofeu', 
    name: 'Troféu', 
    icon: '🏆', 
    price: 500, 
    aura: 650, 
    color: 'text-cyan-400', 
    bgColor: 'bg-cyan-400/10', 
    borderColor: 'border-cyan-400/20',
    glowColor: '#06b6d4'
  },
  { 
    id: 'crown_vip', 
    name: 'Crown VIP', 
    icon: '👑', 
    price: 1000, 
    aura: 1400, 
    color: 'text-indigo-400', 
    bgColor: 'bg-indigo-400/10', 
    borderColor: 'border-indigo-400/20',
    glowColor: '#6366f1'
  },
  { 
    id: 'aura_divina', 
    name: 'Aura Divina', 
    icon: '✨', 
    price: 5000, 
    aura: 7500, 
    color: 'text-purple-400', 
    bgColor: 'bg-purple-500/10', 
    borderColor: 'border-purple-500/20',
    glowColor: '#a855f7'
  },
  { 
    id: 'foguete', 
    name: 'Foguete', 
    icon: '🚀', 
    price: 10000, 
    aura: 16000, 
    color: 'text-fuchsia-500', 
    bgColor: 'bg-fuchsia-500/10', 
    borderColor: 'border-fuchsia-500/20',
    glowColor: '#d946ef'
  },
  { 
    id: 'nirvana', 
    name: 'Nirvana', 
    icon: '💎', 
    price: 50000, 
    aura: 90000, 
    color: 'text-emerald-400', 
    bgColor: 'bg-emerald-400/10', 
    borderColor: 'border-emerald-400/20',
    glowColor: '#10b981'
  }
];

export interface AuraLevelInfo {
  level: number;
  name: string;
  minAura: number;
  maxAura: number | null;
  textColor: string;
  badgeBg: string;
  badgeBorder: string;
  gradient: string; // Tailwind gradient background
  glowColor: string; // Glow hex code
  frameStyle?: string; // Border style or class modifier
  benefits: string[];
  insignia: string;
  isLegendary?: boolean;
}

export const AURA_LEVELS: AuraLevelInfo[] = [
  {
    level: 1,
    name: "Aura Nível 1",
    minAura: 0,
    maxAura: 99,
    textColor: "text-zinc-500 dark:text-zinc-400",
    badgeBg: "bg-zinc-500/10",
    badgeBorder: "border-zinc-500/20",
    gradient: "from-zinc-150 via-zinc-100 to-zinc-50 dark:from-zinc-950/20 dark:via-zinc-900/10 dark:to-zinc-950/5",
    glowColor: "#71717a",
    benefits: ["Insígnia Básica", "Rank Diário Inicial"],
    insignia: "⚪ Iniciante"
  },
  {
    level: 2,
    name: "Aura Nível 2",
    minAura: 100,
    maxAura: 499,
    textColor: "text-emerald-600 dark:text-emerald-400",
    badgeBg: "bg-emerald-500/10",
    badgeBorder: "border-emerald-500/20",
    gradient: "from-emerald-500/10 via-emerald-400/5 to-transparent",
    glowColor: "#10b981",
    frameStyle: "border-2 border-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.3)]",
    benefits: ["Moldura de Esmeralda", "Emote Especial no Chat"],
    insignia: "🟢 Aura Esmeralda"
  },
  {
    level: 3,
    name: "Aura Nível 3",
    minAura: 500,
    maxAura: 1499,
    textColor: "text-blue-600 dark:text-blue-400",
    badgeBg: "bg-blue-500/10",
    badgeBorder: "border-blue-500/20",
    gradient: "from-blue-500/10 via-indigo-500/5 to-transparent",
    glowColor: "#3b82f6",
    frameStyle: "border-2 border-blue-500 animate-pulse shadow-[0_0_18px_rgba(59,130,246,0.45)]",
    benefits: ["Moldura de Safira", "Efeito de Entrada Suave", "Insígnia Prata no Perfil"],
    insignia: "🔵 Aura Safira"
  },
  {
    level: 4,
    name: "Aura Nível 4",
    minAura: 1500,
    maxAura: 4999,
    textColor: "text-purple-600 dark:text-purple-400",
    badgeBg: "bg-purple-500/10",
    badgeBorder: "border-purple-500/20",
    gradient: "from-purple-500/15 via-fuchsia-500/5 to-transparent",
    glowColor: "#a855f7",
    frameStyle: "border-[2.5px] border-purple-500 border-dashed animate-spin-slow shadow-[0_0_22px_rgba(168,85,247,0.65)]",
    benefits: ["Moldura de Ametista Animada", "Efeito de Entrada Pródigo", "Insígnia de Ouro", "Prioridade na Lista de Jogos"],
    insignia: "🟣 Aura Ametista"
  },
  {
    level: 5,
    name: "Aura Nível 5",
    minAura: 5000,
    maxAura: 14999,
    textColor: "text-amber-600 dark:text-amber-400",
    badgeBg: "bg-amber-500/10",
    badgeBorder: "border-amber-500/25",
    gradient: "from-amber-500/15 via-orange-500/5 to-transparent",
    glowColor: "#f59e0b",
    frameStyle: "border-[3px] border-double border-amber-500 shadow-[0_0_28px_rgba(245,158,11,0.8)] animate-pulse",
    benefits: ["Moldura Imperial de Ouro", "Entrada com Anúncio Escrito", "Insígnia Real Elevada", "Recompensas Sazonais Adicionais"],
    insignia: "👑 Aura Imperial"
  },
  {
    level: 6,
    name: "Aura Lendária",
    minAura: 15000,
    maxAura: null,
    textColor: "text-fuchsia-600 dark:text-[#FF4D9D] font-black italic",
    badgeBg: "bg-gradient-to-r from-fuchsia-500/10 via-[#8A2EFF]/10 to-[#00F0FF]/10",
    badgeBorder: "border-[#8A2EFF]/35",
    gradient: "from-[#FF4D9D]/20 via-[#8A2EFF]/10 to-[#00F0FF]/20",
    glowColor: "#a855f7", // Purple/magenta base
    frameStyle: "border-[3px] border-gradient-aura animate-rainbow shadow-[0_0_35px_rgba(138,46,255,0.9)]",
    benefits: ["Moldura Lendária Cósmica", "Efeito de Entrada Lendário Global", "Nome Arco-íris em Chats e Salas", "Super Insígnia Dourada Triunfante", "Recompensas Sazonais Superiores", "Destaque Supremo no Ranking"],
    insignia: "🌌 Aura Lendária",
    isLegendary: true
  }
];

export function getAuraLevelInfo(auraPoints: number): AuraLevelInfo {
  const currentAura = auraPoints || 0;
  for (const info of AURA_LEVELS) {
    if (info.maxAura === null) return info;
    if (currentAura >= info.minAura && currentAura <= info.maxAura) {
      return info;
    }
  }
  return AURA_LEVELS[AURA_LEVELS.length - 1]; // Fallback to legendary
}
