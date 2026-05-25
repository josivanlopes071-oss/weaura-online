/**
 * Utility to convert Google Drive sharing URLs into direct image hotlinks.
 */
export function getDirectDriveUrl(url: string): string {
  if (!url) return '';
  
  // Extract id from drive URL format: https://drive.google.com/file/d/FILE_ID/view?usp=drivesdk
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    // lh3.googleusercontent.com is highly reliable, supports CORS headers without cookie errors, and serves raw stream instantly
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
  glowColor: string;
  glowClass: string;
  isVip: boolean;
  category: 'Aura' | 'Elite' | 'Special';
  badge: string;
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
  }
];

export function getFrameById(id: string): FrameItem | undefined {
  return PREMIUM_FRAMES.find(f => f.id === id);
}
