import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Loader2, Check, Flame, Zap, ShieldCheck, Star, Trophy, Gift, Palette, MessageSquare, Coins } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PREMIUM_FRAMES, FrameItem } from '../lib/frames';
import UserAvatar from '../components/UserAvatar';
import { useToast } from '../contexts/ToastContext';

// 1. Effects specifications
export interface EffectItem {
  id: string;
  name: string;
  description: string;
  price: number;
  glowColor: string;
  glowClass: string;
  icon: string;
}

export const PREMIUM_EFFECTS: EffectItem[] = [
  { id: 'eff_neon', name: 'Zênite Neon Glow', description: 'Impactante pulsar multicolorido futurista atrás do seu avatar.', price: 100, glowColor: 'rgba(34, 197, 94, 0.4)', glowClass: 'shadow-[0_0_25px_rgba(34,197,94,0.6)] animate-pulse', icon: '🟢' },
  { id: 'eff_cosmic', name: 'Oráculo Cósmico', description: 'Partículas cósmicas flutuantes orbitando no hiperespaço.', price: 250, glowColor: 'rgba(168, 85, 247, 0.4)', glowClass: 'shadow-[0_0_35px_rgba(168,85,247,0.7)] hover:scale-105', icon: '✨' },
  { id: 'eff_hearts', name: 'Corações Protetores', description: 'Corações orbitando com glow apaixonante.', price: 180, glowColor: 'rgba(236, 72, 153, 0.4)', glowClass: 'shadow-[0_0_20px_rgba(236,72,153,0.5)] animate-bounce', icon: '💖' },
  { id: 'eff_imperial', name: 'Brilho Imperial', description: 'Aura radiante dourada exclusiva digna dos nobres herdeiros.', price: 400, glowColor: 'rgba(245,158,11,0.5)', glowClass: 'shadow-[0_0_30px_rgba(245,158,11,0.8)] border border-yellow-500/20', icon: '👑' }
];

// 2. Balloon options
export interface BalloonItem {
  id: string;
  name: string;
  description: string;
  price: number;
  style: string;
  textColor: string;
  icon: string;
}

export const PREMIUM_BALLOONS: BalloonItem[] = [
  { id: 'bal_emerald', name: 'Soberano Esmeralda', description: 'Design real esmeralda profundo polido com bordados de ouro.', price: 150, style: 'bg-emerald-950/90 border-2 border-yellow-500/50', textColor: 'text-emerald-200 font-bold', icon: '🕌' },
  { id: 'bal_vulcan', name: 'Fúria Vulcânica', description: 'Esquema vulcânico brilhante laranja-solar cintilante.', price: 200, style: 'bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 border-2 border-orange-400', textColor: 'text-black font-black', icon: '🔥' },
  { id: 'bal_nebula', name: 'Nebulosa Abissal', description: 'Nuvem estrelada com pulso holográfico intergaláctico.', price: 300, style: 'bg-[#120a21] border border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]', textColor: 'text-purple-100 font-bold', icon: '🌌' }
];

// 3. Avatar items
export interface AvatarItem {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  badge: string;
}

export const PREMIUM_AVATARS: AvatarItem[] = [
  { id: 'av_cyber', name: 'Cyber Caçador', description: 'Avatar ilustrativo estilo androide pós-moderno neon.', price: 250, imageUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=cyber', badge: '🤖 Cyber' },
  { id: 'av_samurai', name: 'Ronin Lendário', description: 'Poderoso samurai ancestral pixel-art com detalhes clássicos.', price: 350, imageUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=samurai_art', badge: '⚔️ Ronin' },
  { id: 'av_magic', name: 'Magnus Mago Astrologer', description: 'Mago celestial que conjura estrelas cósmicas reais.', price: 400, imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=cosmic_magic', badge: '🚀 Mago' }
];

// 4. Special Gifts System
export interface SpecialGiftItem {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  auraValue: number;
  color: string;
}

export const SPECIAL_GIFTS: SpecialGiftItem[] = [
  { id: 'gift_aurora_divina', name: 'Aura Divina Suprema', description: 'O presente mais luminoso do clã. Concede +1.500 pontos de prestígio.', price: 1000, icon: '✨', auraValue: 1500, color: 'text-purple-400' },
  { id: 'gift_foguete_helios', name: 'Foguete de Hélios', description: 'Viaje pelas estrelas com seu amigo. Concede +3.500 pontos de prestígio.', price: 2500, icon: '🚀', auraValue: 3500, color: 'text-pink-500' },
  { id: 'gift_tron_crown', name: 'Coroa Suprema Tron', description: 'Consagre seu parceiro como realeza absoluta. Concede +7.500 pontos de prestígio.', price: 5000, icon: '👑', auraValue: 7500, color: 'text-yellow-400' },
  { id: 'gift_diamond_nirvana', name: 'Diamante Eterno Nirvana', description: 'O ápice da espiritualidade de WeAura. Concede +16.000 pontos de prestígio.', price: 10000, icon: '💎', auraValue: 16000, color: 'text-cyan-400' },
  { id: 'gift_phoenix_soul', name: 'Lendária Alma de Fênix', description: 'A ressurreição mítica do poder da Aura de WeAura. Concede +90.000 pontos de prestígio.', price: 50000, icon: '🐦‍🔥', auraValue: 90000, color: 'text-orange-500' }
];

// 5. App & Profile Themes System
export interface ThemeItem {
  id: string;
  name: string;
  description: string;
  price: number;
  previewClass: string;
  icon: string;
}

export const PREMIUM_THEMES: ThemeItem[] = [
  { id: 'theme_cyberpunk', name: 'Cyber Neon Matrix', description: 'Sintonize as cores futuristas da web: rosa, roxo e contornos azuis elétricos em toda sua jornada.', price: 300, previewClass: 'bg-gradient-to-br from-indigo-950 via-[#0e071e] to-black border-2 border-pink-500/40', icon: '⚡' },
  { id: 'theme_royal_gold', name: 'Dinastia do Ouro Imperial', description: 'Transforme o app em um palácio nobre com detalhes majestosos dourados e fundos pretos sedosos de alto prestígio.', price: 500, previewClass: 'bg-gradient-to-br from-amber-950 via-[#120a02] to-black border-2 border-yellow-500/40', icon: '👑' },
  { id: 'theme_emerald', name: 'Soberano de Jade', description: 'Ative um visual verde esmeralda místico, celebrando serenidade espiritual e clareza mental do clã.', price: 200, previewClass: 'bg-gradient-to-br from-emerald-950 via-[#041207] to-black border-2 border-emerald-500/40', icon: '🐉' },
  { id: 'theme_amethyst', name: 'Profundezas de Ametista', description: 'Deite-se no poço estelar das ametistas cósmicas com detalhes roxos e sombras brilhantes profundas.', price: 250, previewClass: 'bg-gradient-to-br from-purple-950 via-[#0a0418] to-[#010005] border-2 border-purple-500/40', icon: '🔮' },
  { id: 'theme_sakura', name: 'Flores de Cerejeira Sakura', description: 'Deixe sua interface romântica, calma e delicada tingindo o WeAura com cores de pétalas de sakura.', price: 180, previewClass: 'bg-gradient-to-br from-rose-950 via-[#10030c] to-black border-2 border-pink-400/40', icon: '🌸' }
];

export default function Shop() {
  const { profile, updateCoins, updateProfile } = useAuth();
  const { success, error } = useToast();
  const [transactionLoading, setTransactionLoading] = useState<string | null>(null);
  const [loadingCoins, setLoadingCoins] = useState<string | null>(null);
  
  // Custom 6 main shop tabs
  const [activeTab, setActiveTab] = useState<'frames' | 'effects' | 'balloons' | 'avatars' | 'gifts' | 'themes' | 'coins'>('frames');
  const [previewFrameId, setPreviewFrameId] = useState<string>(() => profile?.equippedFrame || PREMIUM_FRAMES[0]?.id || '');

  // Coin packages definitions (with bonus)
  const coinPacks = [
    { id: 'p1', coins: 150, price: 'R$ 4,90', bonus: '+25', color: 'from-blue-500/10 to-blue-600/10' },
    { id: 'p2', coins: 800, price: 'R$ 19,90', bonus: '+150', color: 'from-purple-500/10 to-purple-600/10' },
    { id: 'p3', coins: 2500, price: 'R$ 39,90', bonus: '+650', popular: true, color: 'from-pink-500/10 to-pink-600/10' },
    { id: 'p4', coins: 6000, price: 'R$ 89,90', bonus: '+2000', color: 'from-indigo-500/10 to-indigo-600/10' }
  ];

  const handleBuyCoins = async (pack: typeof coinPacks[0]) => {
    if (!profile) return;
    setLoadingCoins(pack.id);
    try {
      // Simulate/Trigger official recharge awards coins
      const bonusNum = parseInt(pack.bonus.replace('+',''));
      const totalCoins = pack.coins + (isNaN(bonusNum) ? 0 : bonusNum);
      await updateCoins(totalCoins, 'add');
      success(`Sucesso! Recarga concluída: 🪙 ${totalCoins} Moedas EGO foram adicionadas ao seu saldo.`);
    } catch(err) {
      error("Falha ao processar pagamento.");
    } finally {
      setLoadingCoins(null);
    }
  };

  // 1. BUY FRAMES TRANSACTION LOGIC
  const handleBuyFrame = async (frame: FrameItem) => {
    if (!profile) return;
    const purchased = profile.purchasedFrames || [];
    
    if (purchased.includes(frame.id)) {
      if (profile.equippedFrame === frame.id) {
        await updateProfile({ equippedFrame: "" });
        success("Moldura desequipada!");
      } else {
        await updateProfile({ equippedFrame: frame.id });
        setPreviewFrameId(frame.id);
        success("Moldura equipada com sucesso!");
      }
      return;
    }

    if (profile.coins < frame.price) {
      error("Saldo insuficiente de Moedas EGO!");
      return;
    }

    setTransactionLoading(frame.id);
    try {
      await updateCoins(frame.price, 'subtract');
      await updateProfile({
        purchasedFrames: [...purchased, frame.id],
        equippedFrame: frame.id
      });
      setPreviewFrameId(frame.id);
      success(`Sucesso! Moldura elite "${frame.name}" adquirida e equipada!`);
    } catch (err: any) {
      error("Erro na transação: " + err.message);
    } finally {
      setTransactionLoading(null);
    }
  };

  // 2. BUY EFFECTS TRANSACTION LOGIC
  const handleBuyEffect = async (effect: EffectItem) => {
    if (!profile) return;
    const purchased = profile.purchasedEffects || [];
    
    if (purchased.includes(effect.id)) {
      if (profile.equippedEffect === effect.id) {
        await updateProfile({ equippedEffect: "" });
        success("Efeito desequipado!");
      } else {
        await updateProfile({ equippedEffect: effect.id });
        success("Efeito de entrada equipado!");
      }
      return;
    }

    if (profile.coins < effect.price) {
      error("Saldo insuficiente de Moedas EGO!");
      return;
    }

    setTransactionLoading(effect.id);
    try {
      await updateCoins(effect.price, 'subtract');
      await updateProfile({
        purchasedEffects: [...purchased, effect.id],
        equippedEffect: effect.id
      });
      success(`Efeito de Entrada "${effect.name}" adquirido e equipado com sucesso!`);
    } catch (err) {
      error("Erro ao efetuar compra.");
    } finally {
      setTransactionLoading(null);
    }
  };

  // 3. BUY BALLOONS TRANSACTION LOGIC
  const handleBuyBalloon = async (balloon: BalloonItem) => {
    if (!profile) return;
    const purchased = profile.purchasedBalloons || [];

    if (purchased.includes(balloon.id)) {
      if (profile.equippedBalloon === balloon.id) {
        await updateProfile({ equippedBalloon: "" });
        success("Balão desequipado!");
      } else {
        await updateProfile({ equippedBalloon: balloon.id });
        success("Balão de chat equipado!");
      }
      return;
    }

    if (profile.coins < balloon.price) {
      error("Saldo insuficiente de Moedas EGO!");
      return;
    }

    setTransactionLoading(balloon.id);
    try {
      await updateCoins(balloon.price, 'subtract');
      await updateProfile({
        purchasedBalloons: [...purchased, balloon.id],
        equippedBalloon: balloon.id
      });
      success(`Belo balão "${balloon.name}" adquirido e equipado!`);
    } catch (err) {
      error("Erro ao efetuar transação.");
    } finally {
      setTransactionLoading(null);
    }
  };

  // 4. BUY EXCLUSIVE AVATARS LOGIC
  const handleBuyAvatar = async (avatar: AvatarItem) => {
    if (!profile) return;
    const purchased = profile.purchasedAvatars || [];

    if (purchased.includes(avatar.id)) {
      await updateProfile({ photoURL: avatar.imageUrl });
      success("Avatar exclusivo ativado no perfil!");
      return;
    }

    if (profile.coins < avatar.price) {
      error("Saldo insuficiente de Moedas EGO!");
      return;
    }

    setTransactionLoading(avatar.id);
    try {
      await updateCoins(avatar.price, 'subtract');
      await updateProfile({
        purchasedAvatars: [...purchased, avatar.id],
        photoURL: avatar.imageUrl
      });
      success(`Parabéns! Avatar "${avatar.name}" adquirido com sucesso!`);
    } catch (err) {
      error("Erro ao efetuar transação.");
    } finally {
      setTransactionLoading(null);
    }
  };

  // 5. BUY SPECIAL GIFTS TRANSACTION LOGIC
  const handleBuySpecialGift = async (gift: SpecialGiftItem) => {
    if (!profile) return;
    
    if (profile.coins < gift.price) {
      error("Saldo insuficiente de Moedas EGO!");
      return;
    }

    setTransactionLoading(gift.id);
    try {
      await updateCoins(gift.price, 'subtract');
      const currentGifts = profile.purchasedGifts || {};
      const newQty = (currentGifts[gift.id] || 0) + 1;
      
      await updateProfile({
        purchasedGifts: {
          ...currentGifts,
          [gift.id]: newQty
        }
      });
      success(`Adquirido! 1x "${gift.name}" foi guardado em seu inventário de presentes especiais!`);
    } catch (err: any) {
      error("Erro ao comprar presente: " + err.message);
    } finally {
      setTransactionLoading(null);
    }
  };

  // 6. BUY THEMES TRANSACTION LOGIC
  const handleBuyTheme = async (themeItem: ThemeItem) => {
    if (!profile) return;
    const purchased = profile.purchasedThemes || [];
    
    if (purchased.includes(themeItem.id)) {
      if (profile.equippedTheme === themeItem.id) {
        await updateProfile({ equippedTheme: "" });
        success("Tema desequipado!");
      } else {
        await updateProfile({ equippedTheme: themeItem.id });
        success(`Tema de interface "${themeItem.name}" equipado com sucesso!`);
      }
      return;
    }

    if (profile.coins < themeItem.price) {
      error("Saldo insuficiente de Moedas EGO!");
      return;
    }

    setTransactionLoading(themeItem.id);
    try {
      await updateCoins(themeItem.price, 'subtract');
      await updateProfile({
        purchasedThemes: [...purchased, themeItem.id],
        equippedTheme: themeItem.id
      });
      success(`Sucesso! Tema de luxo "${themeItem.name}" adquirido e equipado com sucesso!`);
    } catch (err: any) {
      error("Erro ao equipar tema: " + err.message);
    } finally {
      setTransactionLoading(null);
    }
  };

  const purchasedFrames = profile?.purchasedFrames || [];
  const currentlyEquippedFrame = profile?.equippedFrame || '';
  const currentlyEquippedEffect = profile?.equippedEffect || '';
  const currentlyEquippedBalloon = profile?.equippedBalloon || '';
  const currentlyEquippedTheme = profile?.equippedTheme || '';
  const purchasedEffects = profile?.purchasedEffects || [];
  const purchasedBalloons = profile?.purchasedBalloons || [];
  const purchasedAvatars = profile?.purchasedAvatars || [];
  const purchasedThemes = profile?.purchasedThemes || [];
  const purchasedGifts = profile?.purchasedGifts || {};

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 md:p-6 pb-36 space-y-8 min-h-screen relative"
    >
      {/* Wallet Balance Display Header */}
      <div className="flex flex-col gap-6 pt-4 md:pt-8 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight italic">MERCADO AURA</h2>
          <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.35em] leading-none mt-2 italic">Aura Vip • Cosméticos Avançados • Molduras Premium • Temas do Clã</p>
        </div>

        <div className="glass-dark px-5 py-3 rounded-[24px] border border-white/[0.08] flex items-center gap-3.5 shadow-premium w-fit self-start md:self-auto hover:border-purple-500/20 transition-all duration-500 bg-black/60">
           <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-[15px] flex items-center justify-center border-2 border-black shadow-[0_5px_15px_rgba(245,158,11,0.3)]">
              <Sparkles size={18} className="text-black drop-shadow-md animate-pulse" />
           </div>
           <div>
              <span className="block text-[8px] font-black text-white/30 uppercase tracking-widest mb-0.5 italic">Seu Saldo EGO</span>
              <span className="text-lg font-black text-white leading-none tabular-nums italic flex items-center gap-1.5">
                {profile?.coins || 0} 🪙
              </span>
           </div>
        </div>
      </div>

      {/* Tabs Selector for Categories */}
      <div className="flex bg-[#0a0a0a]/80 p-1.5 rounded-3xl border border-white/[0.08] w-full overflow-x-auto scrollbar-hide gap-1.5 backdrop-blur">
        {[
          { id: 'frames', label: 'Molduras', icon: '🖼️' },
          { id: 'effects', label: 'Efeitos Entrada', icon: '✨' },
          { id: 'balloons', label: 'Balões', icon: '💬' },
          { id: 'avatars', label: 'Avatares', icon: '🤖' },
          { id: 'gifts', label: 'Presentes', icon: '🎁' },
          { id: 'themes', label: 'Temas', icon: '🎨' },
          { id: 'coins', label: 'Comprar Moedas', icon: '🪙' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 min-w-[124px] flex items-center justify-center gap-2 py-3.5 rounded-[20px] font-black uppercase text-[10px] tracking-wider transition-all duration-500 italic ${
              activeTab === tab.id 
                ? 'bg-white text-black shadow-xl scale-[1.02]' 
                : 'text-white/20 hover:text-white/40'
            }`}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* TAB 1: PREMIUM MOULDS (FRAMES) */}
        {activeTab === 'frames' && (
          <motion.div key="frames-view" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30 flex items-center gap-2">Molduras Elite de Perfil ({PREMIUM_FRAMES.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PREMIUM_FRAMES.map((frame) => {
                const isBought = purchasedFrames.includes(frame.id);
                const isEquipped = currentlyEquippedFrame === frame.id;
                return (
                  <div key={frame.id} className="relative bg-[#0c0c0c]/80 border border-white/5 p-6 rounded-[32px] flex flex-col justify-between hover:border-purple-500/20 transition-all duration-300">
                    <span className="absolute top-4 right-4 bg-white/5 px-2.5 py-1 rounded-full text-[8px] font-black text-white/50 lowercase tracking-wider uppercase">{(frame as any).badge || 'Elite'}</span>
                    <div>
                      <div className="w-20 h-20 bg-black rounded-full border border-white/10 mx-auto relative flex items-center justify-center mb-4">
                        <UserAvatar uid={profile?.uid} className="w-14 h-14" forceFrameId={frame.id} showLevel={false} />
                      </div>
                      <h4 className="text-sm font-black text-white uppercase text-center mt-2 italic">{frame.name}</h4>
                      <p className="text-[10px] text-white/30 font-semibold text-center mt-1 leading-relaxed max-w-[190px] mx-auto">{frame.description}</p>
                    </div>

                    <div className="pt-6">
                      <button
                        onClick={() => handleBuyFrame(frame as any)}
                        disabled={transactionLoading !== null}
                        className={`w-full py-3.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
                          isEquipped
                            ? 'bg-purple-900/25 border border-purple-500/50 text-purple-400'
                            : isBought
                            ? 'bg-white text-black hover:bg-zinc-100'
                            : 'bg-white/5 border border-white/5 text-white/70 hover:bg-white/10 hover:border-white/10'
                        }`}
                      >
                        {isEquipped ? 'Equipada' : isBought ? 'Equipar' : `Comprar • 🪙 ${frame.price}`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* TAB 2: ACTIVE EFFECTS TAB */}
        {activeTab === 'effects' && (
          <motion.div key="effects-view" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30 flex items-center gap-2">Efeitos de Entrada e Lobby ({PREMIUM_EFFECTS.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {PREMIUM_EFFECTS.map((effect) => {
                const isBought = purchasedEffects.includes(effect.id);
                const isEquipped = currentlyEquippedEffect === effect.id;
                return (
                  <div key={effect.id} className="bg-[#0c0c0c]/80 border border-white/5 p-6 rounded-[32px] flex flex-col justify-between hover:border-green-500/20 transition-all duration-300">
                    <div className="text-center">
                      <span className="text-4xl block mb-4 filter drop-shadow-[0_5px_15px_rgba(0,0,0,0.5)]">{effect.icon}</span>
                      <h4 className="text-sm font-black text-white uppercase italic">{effect.name}</h4>
                      <p className="text-[10px] text-white/30 font-semibold mt-1 leading-relaxed">{effect.description}</p>
                    </div>

                    <div className="pt-6">
                      <button
                        onClick={() => handleBuyEffect(effect)}
                        disabled={transactionLoading !== null}
                        className={`w-full py-3.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
                          isEquipped
                            ? 'bg-green-900/25 border border-green-500/50 text-green-400'
                            : isBought
                            ? 'bg-white text-black hover:bg-zinc-100'
                            : 'bg-white/5 border border-white/5 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        {isEquipped ? 'Ativo' : isBought ? 'Equipar' : `Comprar • 🪙 ${effect.price}`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* TAB 3: CHAT BALLOONS TAB */}
        {activeTab === 'balloons' && (
          <motion.div key="balloons-view" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30 flex items-center gap-2">Balões Personalizados para o Chat ({PREMIUM_BALLOONS.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PREMIUM_BALLOONS.map((balloon) => {
                const isBought = purchasedBalloons.includes(balloon.id);
                const isEquipped = currentlyEquippedBalloon === balloon.id;
                return (
                  <div key={balloon.id} className="bg-[#0c0c0c]/80 border border-white/5 p-6 rounded-[32px] flex flex-col justify-between hover:border-purple-500/20 transition-all duration-300">
                    <div>
                      <div className="flex justify-center mb-4"><span className="text-3xl">{balloon.icon}</span></div>
                      <h4 className="text-sm font-black text-white uppercase italic text-center">{balloon.name}</h4>
                      <p className="text-[10px] text-white/30 font-semibold text-center mt-1 leading-relaxed max-w-[180px] mx-auto">{balloon.description}</p>
                      
                      {/* Chat Balloon preview mock bubble */}
                      <div className={`mt-4 p-4 rounded-2xl text-center ${balloon.style}`}>
                        <span className={`text-[11px] ${balloon.textColor}`}>Mensagem com Balão Diferenciado!</span>
                      </div>
                    </div>

                    <div className="pt-6">
                      <button
                        onClick={() => handleBuyBalloon(balloon)}
                        disabled={transactionLoading !== null}
                        className={`w-full py-3.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
                          isEquipped
                            ? 'bg-purple-900/25 border border-purple-500/50 text-purple-400'
                            : isBought
                            ? 'bg-white text-black hover:bg-zinc-100'
                            : 'bg-white/5 border border-white/5 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        {isEquipped ? 'Ativo' : isBought ? 'Equipar' : `Comprar • 🪙 ${balloon.price}`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* TAB 4: EXCLUSIVE COLLECTIBLE IN-STORE AVATARS */}
        {activeTab === 'avatars' && (
          <motion.div key="avatars-view" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30 flex items-center gap-2">Avatares Iluminados Exclusivos ({PREMIUM_AVATARS.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PREMIUM_AVATARS.map((avatar) => {
                const isBought = purchasedAvatars.includes(avatar.id);
                const isApplied = profile?.photoURL === avatar.imageUrl;
                return (
                  <div key={avatar.id} className="relative bg-[#0c0c0c]/80 border border-white/5 p-6 rounded-[32px] flex flex-col justify-between hover:border-[#00F0FF]/25 transition-all duration-300">
                    <span className="absolute top-4 right-4 bg-[#00F0FF]/15 px-2.5 py-1 rounded-full text-[8.5px] font-black text-[#00F0FF] uppercase border border-[#00F0FF]/10">{avatar.badge}</span>
                    <div className="text-center">
                      <img src={avatar.imageUrl} className="w-20 h-20 rounded-[24px] bg-black border border-white/10 mx-auto object-cover mb-4" alt={avatar.name} referrerPolicy="no-referrer" />
                      <h4 className="text-sm font-black text-white uppercase italic">{avatar.name}</h4>
                      <p className="text-[10px] text-white/30 font-semibold mt-1 leading-relaxed max-w-[180px] mx-auto">{avatar.description}</p>
                    </div>

                    <div className="pt-6">
                      <button
                        onClick={() => handleBuyAvatar(avatar)}
                        disabled={transactionLoading !== null}
                        className={`w-full py-3.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
                          isApplied
                            ? 'bg-[#00F0FF]/10 border border-[#00F0FF]/40 text-[#00F0FF]'
                            : isBought
                            ? 'bg-white text-black hover:bg-neutral-200'
                            : 'bg-white/5 border border-white/5 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        {isApplied ? 'Em Uso' : isBought ? 'Ativar no Perfil' : `Comprar • 🪙 ${avatar.price}`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* TAB 5: SPECIAL COLLECTIBLE GIFTS */}
        {activeTab === 'gifts' && (
          <motion.div key="gifts-view" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30 flex items-center gap-2">Baú de Presentes Especiais Colecionáveis ({SPECIAL_GIFTS.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {SPECIAL_GIFTS.map((gift) => {
                const inventoryCount = purchasedGifts[gift.id] || 0;
                return (
                  <div key={gift.id} className="relative bg-[#0c0c0c]/80 border border-white/5 p-6 rounded-[32px] flex flex-col justify-between hover:border-pink-500/20 transition-all duration-300">
                    {inventoryCount > 0 && (
                      <span className="absolute top-4 right-4 bg-pink-500/10 border border-pink-500/20 text-pink-400 px-3 py-1 rounded-full text-[9px] font-mono font-black uppercase tracking-widest">
                         Possui: {inventoryCount}x
                      </span>
                    )}
                    <div className="text-center">
                      <span className="text-5xl block mb-4 filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">{gift.icon}</span>
                      <h4 className={`text-base font-black uppercase italic ${gift.color}`}>{gift.name}</h4>
                      <p className="text-[11px] text-white/40 font-semibold mt-1 leading-relaxed max-w-[240px] mx-auto">{gift.description}</p>
                      
                      <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-purple-500/5 border border-purple-500/10 rounded-xl text-[9px] font-black tracking-widest uppercase text-purple-400">
                         Concede: +{gift.auraValue} Aura Estelar
                      </div>
                    </div>

                    <div className="pt-6">
                      <button
                        onClick={() => handleBuySpecialGift(gift)}
                        disabled={transactionLoading !== null}
                        className="w-full py-3.5 bg-gradient-to-r from-pink-500/10 to-purple-600/10 border border-pink-500/20 hover:border-pink-500/50 text-white font-black uppercase text-[9px] tracking-widest rounded-2xl transition-all hover:scale-[1.01]"
                      >
                        {transactionLoading === gift.id ? <Loader2 size={12} className="animate-spin mx-auto text-pink-500" /> : `Adquirir • 🪙 ${gift.price}`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* TAB 6: PREMIUM GENERAL THEMES */}
        {activeTab === 'themes' && (
          <motion.div key="themes-view" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30 flex items-center gap-2">Personalização Estilizada de Temas ({PREMIUM_THEMES.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {PREMIUM_THEMES.map((themeItem) => {
                const isBought = purchasedThemes.includes(themeItem.id);
                const isEquipped = currentlyEquippedTheme === themeItem.id;
                return (
                  <div key={themeItem.id} className="relative bg-[#0c0c0c]/80 border border-white/5 p-6 rounded-[32px] flex flex-col justify-between hover:border-amber-500/25 transition-all duration-300">
                    <div>
                      {/* Theme preview box mock */}
                      <div className={`w-full h-24 rounded-2xl mb-4 relative overflow-hidden flex flex-col items-center justify-center ${themeItem.previewClass}`}>
                         <span className="text-4xl filter drop-shadow-md">{themeItem.icon}</span>
                         <span className="absolute bottom-2.5 text-[8.5px] font-mono font-black uppercase tracking-widest text-white/60">PRÉ-VISUALIZAÇÃO DE TEMA</span>
                      </div>

                      <h4 className="text-base font-black text-white px-1 uppercase italic leading-tight">{themeItem.name}</h4>
                      <p className="text-[11.5px] text-white/40 font-semibold mt-2 leading-relaxed px-1 text-justify">{themeItem.description}</p>
                    </div>

                    <div className="pt-6">
                      <button
                        onClick={() => handleBuyTheme(themeItem)}
                        disabled={transactionLoading !== null}
                        className={`w-full py-3.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${
                          isEquipped
                            ? 'bg-amber-950/20 border border-amber-500/50 text-all text-amber-400'
                            : isBought
                            ? 'bg-white text-black hover:bg-neutral-200'
                            : 'bg-white/5 border border-white/5 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        {isEquipped ? 'Equipado • Desequipar' : isBought ? 'Equipar Tema' : `Comprar • 🪙 ${themeItem.price}`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* TAB 7: TOP-UP COINS */}
        {activeTab === 'coins' && (
          <motion.div key="coins-view" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30 flex items-center gap-2">Adquirir Moedas EGO</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {coinPacks.map((pack) => (
                <div key={pack.id} className="bg-[#0c0c0c]/80 border border-white/5 p-6 rounded-[28px] hover:border-yellow-500/20 transition-all duration-300 flex flex-col justify-between text-center relative overflow-hidden group">
                  {pack.popular && (
                    <div className="absolute top-3 right-3 bg-pink-500 text-black text-[7.5px] font-black uppercase px-2 py-0.5 rounded italic">
                      POPULAR
                    </div>
                  )}
                  <div>
                    <span className="text-3xl block mb-2 filter drop-shadow">🪙</span>
                    <h4 className="text-xl font-black text-white tabular-nums italic uppercase">{pack.coins} EGO</h4>
                    <span className="inline-block bg-yellow-500 text-black text-[8.5px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider mt-1">{pack.bonus} BÔNUS</span>
                  </div>

                  <div className="pt-6">
                    <button
                      onClick={() => handleBuyCoins(pack)}
                      className="w-full bg-white text-black py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-100 transition-all"
                    >
                      {loadingCoins === pack.id ? <Loader2 size={12} className="animate-spin mx-auto text-black" /> : pack.price}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
