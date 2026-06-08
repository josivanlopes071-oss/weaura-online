/**
 * Utility to convert Google Drive sharing URLs into direct image hotlinks.
 */
export function getDirectDriveUrl(url: string, isVideo = false): string {
  if (!url) return '';
  
  // Extract id from drive URL format: https://drive.google.com/file/d/FILE_ID/view?usp=drivesdk
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    if (isVideo) {
      // Use the direct export download stream URL for HTML5 `<video>` source parsing
      return `https://docs.google.com/uc?export=download&id=${match[1]}`;
    }
    // Images stream flawlessly and with CORS support from the Google User Content endpoint
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  
  return url;
}

export interface FrameItem {
  id: string;
  name: string;
  description: string;
  price: number;
  driveUrl: string;
  imageUrl: string;
  videoUrl?: string;
  glowColor: string;
  glowClass: string;
  isVip: boolean;
  category: 'Aura' | 'Elite' | 'Special';
  badge: string;
  isVideo?: boolean;
}

export const PREMIUM_FRAMES: FrameItem[] = [
  {
    id: 'weplay_aura_guardiao',
    name: 'Aura Guardião',
    description: 'Moldura Elite Oficial do Aura Room. Glow sagrado e efeitos de aura pulsante.',
    price: 350,
    driveUrl: 'https://drive.google.com/file/d/1up3OJYPGNi9pXxdUsukkMTgK-DVjLuwv/view?usp=drivesdk',
    imageUrl: getDirectDriveUrl('https://drive.google.com/file/d/1up3OJYPGNi9pXxdUsukkMTgK-DVjLuwv/view?usp=drivesdk'),
    glowColor: '#a855f7', // Purple-magenta glow
    glowClass: 'shadow-purple-500/50',
    isVip: true,
    category: 'Elite',
    badge: 'Elite VIP'
  },
  {
    id: 'fr_celestial',
    name: 'Guardião Celestial',
    description: 'Glow azul royal cintilante vindo das altas dimensões celestes.',
    price: 200,
    driveUrl: '',
    imageUrl: '',
    glowColor: '#00F0FF',
    glowClass: 'shadow-[0_0_20px_#00F0FF]',
    isVip: false,
    category: 'Aura',
    badge: 'Celestial'
  },
  {
    id: 'fr_gold_royale',
    name: 'Ouro Real Dynas',
    description: 'Bordas robustas de ouro real com pulsos metálicos espelhados.',
    price: 450,
    driveUrl: '',
    imageUrl: '',
    glowColor: '#eab308',
    glowClass: 'shadow-[0_0_20px_#eab308]',
    isVip: false,
    category: 'Elite',
    badge: 'Realeza'
  },
  {
    id: 'fr_cyber',
    name: 'Cibernética Grid',
    description: 'Estruturação de grade hacker neon eletrizante com feixe de laser.',
    price: 300,
    driveUrl: '',
    imageUrl: '',
    glowColor: '#ec4899',
    glowClass: 'shadow-[0_0_20px_#ec4899]',
    isVip: false,
    category: 'Special',
    badge: 'Cyber'
  },
  {
    id: 'fr_vip_bronze',
    name: 'Guerreiro de Bronze',
    description: 'Moldura antiga forjada em bronze celestial. Desbloqueado com VIP Bronze.',
    price: 0,
    driveUrl: '',
    imageUrl: '',
    glowColor: '#d97706',
    glowClass: 'shadow-[0_0_20px_rgba(217,119,6,0.8)] border border-amber-600/30',
    isVip: true,
    category: 'Special',
    badge: 'Bronze VIP'
  },
  {
    id: 'fr_vip_prata',
    name: 'Soberano de Prata',
    description: 'Bordas polidas em prata cintilante estelar. Desbloqueado com VIP Prata.',
    price: 0,
    driveUrl: '',
    imageUrl: '',
    glowColor: '#94a3b8',
    glowClass: 'shadow-[0_0_20px_rgba(148,163,184,0.8)] border border-slate-400/30',
    isVip: true,
    category: 'Special',
    badge: 'Prata VIP'
  },
  {
    id: 'fr_vip_ouro',
    name: 'Império Dourado',
    description: 'Glow radiante em ouro imperial ultra polido. Desbloqueado com VIP Ouro.',
    price: 0,
    driveUrl: '',
    imageUrl: '',
    glowColor: '#eab308',
    glowClass: 'shadow-[0_0_25px_rgba(234,179,8,0.9)] border border-yellow-400/30',
    isVip: true,
    category: 'Elite',
    badge: 'Ouro VIP'
  },
  {
    id: 'fr_vip_diamante',
    name: 'Prisma de Diamante',
    description: 'A joia mais reluzente do clã WeAura. Desbloqueado com VIP Diamante.',
    price: 0,
    driveUrl: '',
    imageUrl: '',
    glowColor: '#06b6d4',
    glowClass: 'shadow-[0_0_30px_rgba(6,182,212,1)] border border-cyan-400/40 animate-pulse',
    isVip: true,
    category: 'Elite',
    badge: 'Diamante VIP'
  }
];

export function getFrameById(id: string): FrameItem | undefined {
  return PREMIUM_FRAMES.find(f => f.id === id);
}
