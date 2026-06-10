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
  rarity: 'Lendário' | 'Épico' | 'Raro' | 'Comum';
  noProcessing?: boolean;
  avatarScale?: number;
  avatarOffsetY?: string;
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
    badge: 'Elite VIP',
    rarity: 'Lendário'
  }
];

export let CUSTOM_FRAMES_CACHE: FrameItem[] = [];

export function registerCustomFramesInCache(frames: FrameItem[]) {
  CUSTOM_FRAMES_CACHE = frames;
}

export function getAllFrames(): FrameItem[] {
  return [...PREMIUM_FRAMES, ...CUSTOM_FRAMES_CACHE];
}

export function getFrameById(id: string): FrameItem | undefined {
  return PREMIUM_FRAMES.find(r => r.id === id) || CUSTOM_FRAMES_CACHE.find(r => r.id === id);
}
