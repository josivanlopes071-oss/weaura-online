import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Zap, Loader2, Check, ShieldCheck, Flame, ShoppingBag, Eye, User, Trophy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PREMIUM_FRAMES, FrameItem, getDirectDriveUrl } from '../lib/frames';
import UserAvatar from '../components/UserAvatar';

export default function Shop() {
  const { profile, updateCoins, updateProfile } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [transactionLoading, setTransactionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'coins' | 'frames'>('frames');

  // Preview frame state: defaults to current equipped frame, or first premium frame
  const [previewFrameId, setPreviewFrameId] = useState<string>(() => {
    return profile?.equippedFrame || PREMIUM_FRAMES[0].id;
  });

  const coinPacks = [
    { id: 'p1', coins: 100, price: 'R$ 4,90', bonus: '+10', color: 'from-blue-500/20 to-blue-600/20' },
    { id: 'p2', coins: 500, price: 'R$ 19,90', bonus: '+60', color: 'from-purple-500/20 to-purple-600/20' },
    { id: 'p3', coins: 1200, price: 'R$ 39,90', bonus: '+200', popular: true, color: 'from-pink-500/20 to-pink-600/20' },
    { id: 'p4', coins: 3000, price: 'R$ 89,90', bonus: '+650', color: 'from-indigo-500/20 to-indigo-600/20' },
  ];

  const handleBuyCoins = async (pack: typeof coinPacks[0]) => {
    if (!profile) return;
    setLoading(pack.id);
    setTimeout(async () => {
      try {
        const totalCoins = pack.coins + parseInt(pack.bonus);
        await updateCoins(totalCoins, 'add');
        alert(`Recarga realizada! +${totalCoins} EGO adicionados ao seu perfil.`);
      } catch (err) { 
        alert("Erro na transação"); 
      } finally { 
        setLoading(null); 
      }
    }, 1200);
  };

  const handleBuyFrame = async (frame: FrameItem) => {
    if (!profile) return;
    const purchased = profile.purchasedFrames || [];
    
    // Is already purchased, toggle equip
    if (purchased.includes(frame.id)) {
      await handleEquipFrame(frame.id);
      return;
    }

    if (profile.coins < frame.price) {
      alert("Saldo de EGO Coins insuficiente para adquirir esta moldura premium!");
      return;
    }

    setTransactionLoading(frame.id);
    try {
      // Deduct coins via Cloud transaction
      await updateCoins(frame.price, 'subtract');

      // Update database profile
      const newPurchased = [...purchased, frame.id];
      await updateProfile({
        purchasedFrames: newPurchased,
        equippedFrame: frame.id
      });

      // Update local preview
      setPreviewFrameId(frame.id);
      alert(`Sucesso! Moldura "${frame.name}" adquirida e equipada com sucesso!`);
    } catch (err: any) {
      console.error("[Shop] Buy frame failed:", err);
      alert("Houve um problema ao processar a compra: " + err.message);
    } finally {
      setTransactionLoading(null);
    }
  };

  const handleEquipFrame = async (frameId: string) => {
    if (!profile) return;
    setTransactionLoading(frameId);
    try {
      await updateProfile({
        equippedFrame: frameId
      });
      setPreviewFrameId(frameId);
    } catch (err) {
      alert("Erro ao equipar moldura");
    } finally {
      setTransactionLoading(null);
    }
  };

  const handleUnequipFrame = async () => {
    if (!profile) return;
    setTransactionLoading('unequip');
    try {
      await updateProfile({
        equippedFrame: ''
      });
    } catch (err) {
      alert("Erro ao desequipar moldura");
    } finally {
      setTransactionLoading(null);
    }
  };

  const purchasedList = profile?.purchasedFrames || [];
  const currentlyEquipped = profile?.equippedFrame || '';
  const selectedPreviewFrameObj = PREMIUM_FRAMES.find(f => f.id === previewFrameId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 md:p-6 pb-36 space-y-8 bg-[#020202] min-h-screen"
    >
      {/* Dynamic Header */}
      <div className="flex flex-col gap-6 pt-4 md:pt-8 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight italic">MERCADO WE AURA</h2>
          <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.35em] leading-none mt-2 italic">Aura Vip • Cosméticos Avançados • WePlay Frames</p>
        </div>

        {/* EGO Coin Wallet Balance Display */}
        <div className="glass-dark px-5 py-3 rounded-[24px] border border-white/[0.08] flex items-center gap-3.5 shadow-premium w-fit self-start md:self-auto">
           <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-600 rounded-[15px] flex items-center justify-center border-2 border-black shadow-[0_5px_15px_rgba(236,72,153,0.3)]">
              <Sparkles size={18} className="text-white drop-shadow-md animate-pulse" />
           </div>
           <div>
              <span className="block text-[8px] font-black text-white/30 uppercase tracking-widest mb-0.5 italic">Seu Saldo</span>
              <span className="text-lg font-black text-white leading-none tabular-nums italic">{profile?.coins || 0} EGO</span>
           </div>
        </div>
      </div>

      {/* Tabs Selector: WePlay Premium Frames vs Refill Coins */}
      <div className="flex bg-[#0a0a0a] p-1.5 rounded-2xl border border-white/5 w-full max-w-md mx-auto">
        <button
          onClick={() => setActiveTab('frames')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold uppercase text-xs tracking-wider transition-all duration-300 ${
            activeTab === 'frames' 
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' 
              : 'text-white/40 hover:text-white hover:bg-white/5'
          }`}
        >
          <ShieldCheck size={14} />
          Molduras WePlay
        </button>
        <button
          onClick={() => setActiveTab('coins')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold uppercase text-xs tracking-wider transition-all duration-300 ${
            activeTab === 'coins' 
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' 
              : 'text-white/40 hover:text-white hover:bg-white/5'
          }`}
        >
          <Zap size={14} />
          Comprar EGO
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'frames' ? (
          <motion.div
            key="frames-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-8"
          >
            {/* Live Interactive Frame Preview Studio */}
            <div className="bg-gradient-to-r from-[#0c051a] via-[#100725] to-[#0c051a] p-6 md:p-8 rounded-[36px] border border-purple-500/10 shadow-[0_20px_50px_rgba(138,46,255,0.1)] relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
              
              <div className="space-y-4 max-w-md text-center md:text-left">
                <div className="bg-purple-500/10 border border-purple-500/20 w-fit px-3.5 py-1.5 rounded-xl flex items-center gap-2 mx-auto md:mx-0">
                  <Flame className="text-purple-400 animate-pulse" size={14} />
                  <span className="text-[10px] font-black uppercase text-purple-400 tracking-widest">Estúdio de Customização</span>
                </div>
                <h3 className="text-2xl font-black text-white leading-tight uppercase tracking-tight">
                  Visualização em Tempo Real
                </h3>
                <p className="text-xs text-white/40 leading-relaxed font-semibold">
                  Selecione qualquer moldura abaixo para visualizar como ela se ajusta perfeitamente e envolve seu avatar, com transparência PNG realista, renderização ultra nítida e efeitos de iluminação holográficos premium!
                </p>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
                  <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 text-[10px] text-zinc-400">
                    <Check size={12} className="text-purple-500" /> Fundo Transparente
                  </div>
                  <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 text-[10px] text-zinc-400">
                    <Check size={12} className="text-purple-500" /> Ajuste Automático
                  </div>
                  <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5 text-[10px] text-zinc-400">
                    <Check size={12} className="text-purple-500" /> Sem Bordas Pretas
                  </div>
                </div>
              </div>

              {/* Central Avatar Preview Hub with live equipped state */}
              <div className="flex flex-col items-center gap-4 bg-black/30 p-6 rounded-3xl border border-white/5 w-full max-w-[280px] hover:border-purple-500/20 transition-colors duration-500">
                <div className="text-[9px] font-black uppercase text-purple-400 tracking-widest bg-purple-500/10 px-2.5 py-1 rounded-full mb-1">
                  Preview do Avatar
                </div>

                {/* Simulated Container rendering UserAvatar with previewFrameId */}
                <UserAvatar 
                  uid={profile?.uid} 
                  className="w-24 h-24" 
                  forceFrameId={previewFrameId}
                  showLevel={true}
                />

                <div className="text-center mt-2">
                  <span className="text-white font-black text-sm block">
                    {profile?.displayName || 'Seu Nickname'}
                  </span>
                  <span className="text-white/30 text-[9px] font-bold uppercase tracking-wider block mt-0.5">
                    {selectedPreviewFrameObj ? selectedPreviewFrameObj.name : 'Nenhuma Moldura'}
                  </span>
                </div>

                {/* Direct interaction footer */}
                {currentlyEquipped === previewFrameId ? (
                  <button 
                    onClick={handleUnequipFrame}
                    disabled={transactionLoading !== null}
                    className="w-full bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-white/80 py-2.5 rounded-xl font-bold uppercase text-[10px] tracking-wider transition-all flex items-center justify-center gap-1.5 mt-2"
                  >
                    {transactionLoading === 'unequip' ? (
                      <Loader2 className="animate-spin" size={12} />
                    ) : (
                      'Remover Moldura'
                    )}
                  </button>
                ) : purchasedList.includes(previewFrameId) ? (
                  <button 
                    onClick={() => handleEquipFrame(previewFrameId)}
                    disabled={transactionLoading !== null}
                    className="w-full bg-white text-black hover:bg-zinc-200 py-2.5 rounded-xl font-bold uppercase text-[10px] tracking-wider transition-all flex items-center justify-center gap-1.5 mt-2"
                  >
                    {transactionLoading === previewFrameId ? (
                      <Loader2 className="animate-spin" size={12} />
                    ) : (
                      'Equipar Moldura'
                    )}
                  </button>
                ) : (
                  selectedPreviewFrameObj && (
                    <button 
                      onClick={() => handleBuyFrame(selectedPreviewFrameObj)}
                      disabled={transactionLoading !== null}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-2.5 rounded-xl font-bold uppercase text-[10px] tracking-wider transition-all flex items-center justify-center gap-1.5 mt-2 shadow-[0_10px_20px_rgba(168,85,247,0.3)] animate-pulse"
                    >
                      {transactionLoading === previewFrameId ? (
                        <Loader2 className="animate-spin" size={12} />
                      ) : (
                        `Adquirir por ${selectedPreviewFrameObj.price} EGO`
                      )}
                    </button>
                  )
                )}
              </div>

              {/* Decorative radial blur elements */}
              <div className="absolute -left-10 -bottom-10 w-44 h-44 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -right-20 -top-20 w-52 h-52 bg-pink-500/5 rounded-full blur-3xl pointer-events-none" />
            </div>

            {/* List of available frames in grid */}
            <div className="space-y-6">
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30 ml-2 flex items-center gap-3">
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]"></span>
                Molduras Disponíveis ({PREMIUM_FRAMES.length})
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {PREMIUM_FRAMES.map((frame) => {
                  const isPurchased = purchasedList.includes(frame.id);
                  const isCurrentlyEquipped = currentlyEquipped === frame.id;
                  const isSelectedForPreview = previewFrameId === frame.id;

                  return (
                    <div
                      key={frame.id}
                      className={`relative glass-dark p-6 rounded-[32px] border transition-all duration-500 flex flex-col justify-between group ${
                        isSelectedForPreview 
                          ? 'border-purple-500/50 bg-purple-500/[0.04] shadow-[0_15px_30px_rgba(168,85,247,0.1)]' 
                          : 'border-white/5 hover:border-white/10'
                      }`}
                    >
                      {/* Premium Badge overlay */}
                      <span className="absolute top-4 right-4 bg-white/5 backdrop-blur-md px-3 py-1 rounded-full text-[8px] font-black tracking-widest text-white/50 uppercase border border-white/5 group-hover:text-purple-400 group-hover:border-purple-500/20 transition-all duration-500">
                        {frame.badge}
                      </span>

                      {/* Header details with miniature layout */}
                      <div className="space-y-4">
                        {/* Dynamic Render Frame Sandbox for immediate attraction */}
                        <div className="w-20 h-20 mx-auto bg-zinc-950/60 rounded-full border border-white/5 flex items-center justify-center relative shadow-inner overflow-visible">
                          
                          {/* Inner preview sandbox centered around target user */}
                          <UserAvatar 
                            uid={profile?.uid} 
                            className="w-12 h-12" 
                            forceFrameId={frame.id} 
                            showLevel={false}
                          />

                          {/* Quick Eye indicator when hover */}
                          <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                            <Eye size={12} className="text-purple-400 animate-pulse" />
                          </div>
                        </div>

                        {/* Title and details */}
                        <div className="text-center space-y-1">
                          <h4 className="text-base font-black text-white hover:text-purple-400 transition-all italic tracking-tight">
                            {frame.name}
                          </h4>
                          <p className="text-[10px] text-white/40 leading-relaxed font-semibold max-w-[190px] mx-auto">
                            {frame.description}
                          </p>
                        </div>
                      </div>

                      {/* Frame actions container */}
                      <div className="mt-6 pt-5 border-t border-white/5 space-y-3.5">
                        
                        {/* Display EGO Coin tag price if not purchased */}
                        {!isPurchased && (
                          <div className="flex items-center justify-center gap-1.5 text-yellow-400 font-extrabold text-xs">
                            <Sparkles size={12} className="animate-spin-slow" />
                            <span>{frame.price} EGO Coins</span>
                          </div>
                        )}

                        {/* Equip, Buy, Preview layout actions */}
                        <div className="flex items-center gap-2">
                          
                          {/* Preview trigger */}
                          <button
                            onClick={() => setPreviewFrameId(frame.id)}
                            className={`px-3 py-3 rounded-2xl border transition-all ${
                              isSelectedForPreview 
                                ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' 
                                : 'bg-white/5 text-white/60 border-white/5 hover:text-white hover:bg-white/10'
                            }`}
                            title="Visualizar em tamanho real"
                          >
                            <Eye size={14} />
                          </button>

                          {/* Secondary Main Purchase or Equip Toggle */}
                          {isCurrentlyEquipped ? (
                            <button
                              onClick={handleUnequipFrame}
                              disabled={transactionLoading !== null}
                              className="flex-1 bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-white/50 text-[10px] h-10 rounded-2xl font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                            >
                              {transactionLoading === 'unequip' ? (
                                <Loader2 className="animate-spin" size={14} />
                              ) : (
                                'Remover X'
                              )}
                            </button>
                          ) : isPurchased ? (
                            <button
                              onClick={() => handleEquipFrame(frame.id)}
                              disabled={transactionLoading !== null}
                              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[10px] h-10 rounded-2xl font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] shadow-md"
                            >
                              {transactionLoading === frame.id ? (
                                <Loader2 className="animate-spin" size={14} />
                              ) : (
                                'Equipar'
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBuyFrame(frame)}
                              disabled={transactionLoading !== null}
                              className="flex-1 bg-white text-black hover:bg-zinc-200 text-[10px] h-10 rounded-2xl font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-[0.98]"
                            >
                              {transactionLoading === frame.id ? (
                                <Loader2 className="animate-spin" size={14} />
                              ) : (
                                'Adquirir'
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="coins-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-8"
          >
            {/* Featured Bonus Banner */}
            <div className="bg-gradient-to-br from-pink-600 via-indigo-950 to-[#020202] p-10 rounded-[45px] overflow-hidden relative shadow-premium group border border-white/10 card-shine">
              <div className="relative z-10 space-y-6">
                <div className="bg-white/10 backdrop-blur-3xl w-fit px-4 py-2 rounded-2xl flex items-center gap-2.5 border border-white/10">
                  <Sparkles className="text-yellow-400 animate-pulse" size={16} />
                  <span className="text-[11px] font-black uppercase text-white tracking-[0.2em] italic">Aura VIP Ultra</span>
                </div>
                <div className="space-y-2">
                   <h3 className="text-3xl font-black text-white leading-tight uppercase tracking-tight italic">Aproveite Descontos</h3>
                   <p className="text-sm text-white/40 max-w-[240px] leading-relaxed font-medium italic">Multiplicador de moedas ativado! Troque EGO por molduras raras do aplicativo.</p>
                </div>
              </div>
              <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/5 rounded-full blur-[100px]" />
            </div>

            <div className="grid grid-cols-2 gap-5">
              {coinPacks.map((pack) => (
                <motion.button
                  key={pack.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleBuyCoins(pack)}
                  disabled={loading !== null}
                  className={`relative glass-dark p-8 rounded-[40px] border transition-all duration-500 group card-shine ${
                    pack.popular 
                    ? 'border-pink-500/40 bg-pink-500/[0.04] shadow-[0_20px_50px_rgba(236,72,153,0.15)]' 
                    : 'border-white/[0.08]'
                  }`}
                >
                   {pack.popular && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-gradient-to-r from-pink-600 to-purple-600 px-4 py-1.5 rounded-b-2xl font-black uppercase text-[9px] tracking-[0.15em] text-white shadow-lg italic">
                        RECOMENDADO
                      </div>
                   )}

                  {loading === pack.id ? (
                    <div className="py-8"><Loader2 className="animate-spin text-white/20 mx-auto" size={38} /></div>
                  ) : (
                    <div className="relative z-10 flex flex-col items-center w-full">
                       <div className="w-16 h-16 bg-gradient-to-br from-pink-400 to-purple-500 rounded-[22px] flex items-center justify-center mb-6 border-4 border-[#0c0c0c] shadow-lg group-hover:rotate-12 transition-transform duration-500">
                          <Sparkles size={32} className="text-black drop-shadow-md" />
                       </div>
                       <div className="text-3xl font-black text-white tracking-tight tabular-nums italic leading-none">{pack.coins}</div>
                       <div className="text-[11px] font-black text-white/20 uppercase tracking-[0.2em] mt-2 italic">EGO Coins</div>
                       
                       <div className="mt-8 w-full flex flex-col gap-3">
                          <div className="bg-white text-black py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] group-hover:bg-pink-50 transition-all shadow-xl italic">
                            {pack.price}
                          </div>
                          <div className="text-[10px] font-black text-green-500 uppercase tracking-[0.25em] italic">
                             +{pack.bonus} bônus
                          </div>
                       </div>
                    </div>
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
