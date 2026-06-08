import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, Eye, Heart, Send, Sparkles, Flame, Clock, Plus, Loader2 } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import UserAvatar from './UserAvatar';
import { compressImage } from '../lib/imageCompressor';

interface MomentsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Story {
  id: string;
  userId: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  photoURL?: string;
  createdAt: any;
  expiresAt: any;
  views: string[];
  reactions: { [emoji: string]: number };
}

export default function MomentsDrawer({ isOpen, onClose }: MomentsDrawerProps) {
  const { profile, user } = useAuth();
  const { success, error } = useToast();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeStory, setActiveStory] = useState<Story | null>(null);

  // Post form fields
  const [showCreate, setShowCreate] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [submittingStory, setSubmittingStory] = useState(false);

  // Private reply state
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const fetchActiveStories = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'stories')
      );
      const snap = await getDocs(q);
      const now = new Date();
      
      const activeList = snap.docs
        .map((docSnap) => {
          const data = docSnap.data();
          const expiresDate = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
          return {
            id: docSnap.id,
            ...data,
            expiresDate
          } as any;
        })
        .filter((story) => story.expiresDate > now);

      activeList.sort((a: any, b: any) => b.createdAt?.seconds - a.createdAt?.seconds);
      setStories(activeList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchActiveStories();
    }
  }, [isOpen]);

  const handlePostStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !newContent.trim()) return;

    setSubmittingStory(true);
    try {
      const expDate = new Date();
      expDate.setHours(expDate.getHours() + 24);

      const storyPayload = {
        userId: user.uid,
        authorName: profile.displayName || 'Membro WeAura',
        authorPhoto: profile.photoURL || '',
        content: newContent.trim(),
        photoURL: newPhotoUrl.trim() || null,
        createdAt: serverTimestamp(),
        expiresAt: expDate.toISOString(),
        views: [user.uid],
        reactions: { '❤️': 0, '🔥': 0, '😂': 0, '😮': 0 }
      };

      await addDoc(collection(db, 'stories'), storyPayload);
      success("Momento compartilhado com sucesso!");
      
      // Reset forms
      setNewContent('');
      setNewPhotoUrl('');
      setShowCreate(false);
      fetchActiveStories();
    } catch (err) {
      error("Erro ao postar momento.");
      handleFirestoreError(err, OperationType.CREATE, 'stories');
    } finally {
      setSubmittingStory(false);
    }
  };

  const handleViewStory = async (story: Story) => {
    setActiveStory(story);
    if (!user || story.views.includes(user.uid)) return;

    try {
      const storyRef = doc(db, 'stories', story.id);
      await updateDoc(storyRef, {
        views: arrayUnion(user.uid)
      });
      // Update local story view list
      setStories(prev => prev.map(s => s.id === story.id ? { ...s, views: [...s.views, user.uid] } : s));
    } catch (e) {
      console.error(e);
    }
  };

  const reactStory = async (emoji: string) => {
    if (!user || !activeStory) return;
    try {
      const storyRef = doc(db, 'stories', activeStory.id);
      const currentCount = activeStory.reactions?.[emoji] || 0;
      await updateDoc(storyRef, {
        [`reactions.${emoji}`]: currentCount + 1
      });

      // Update local states
      const updatedReactions = {
        ...activeStory.reactions,
        [emoji]: currentCount + 1
      };
      setActiveStory({ ...activeStory, reactions: updatedReactions });
      setStories(prev => prev.map(s => s.id === activeStory.id ? { ...s, reactions: updatedReactions } : s));
      success("Reação enviada!");
    } catch (e) {
      error("Erro ao reagir ao momento.");
    }
  };

  const handleSendPrivateReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !activeStory || !replyText.trim()) return;

    setSendingReply(true);
    try {
      // Find private chat thread between user and story owner
      const chatsRef = collection(db, 'private_chats');
      const q = query(chatsRef, where('participants', 'array-contains', user.uid));
      const snap = await getDocs(q);
      
      let chatDoc = snap.docs.find(d => {
        const parts = d.data().participants || [];
        return parts.includes(activeStory.userId);
      });

      let chatId = chatDoc?.id;

      if (!chatId) {
        // Create new private chat
        const newChat = await addDoc(chatsRef, {
          participants: [user.uid, activeStory.userId],
          lastMessage: `Respondeu ao seu momento: "${replyText.trim()}"`,
          lastMessageAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        chatId = newChat.id;
      } else {
        await updateDoc(doc(db, 'private_chats', chatId), {
          lastMessage: `Respondeu ao seu momento: "${replyText.trim()}"`,
          lastMessageAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      // Add actual reply message as subdocument
      await addDoc(collection(db, 'private_chats', chatId, 'messages'), {
        authorId: user.uid,
        authorName: profile.displayName,
        text: `⚡ Respondeu ao seu momento ("${activeStory.content}"): \n\n ${replyText.trim()}`,
        timestamp: serverTimestamp(),
        type: 'text'
      });

      success("Resposta privada enviada com sucesso!");
      setReplyText('');
    } catch (err) {
      error("Falha ao enviar resposta privada.");
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[60]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 180 }}
            className="fixed inset-x-0 bottom-0 bg-[#0a0a0a] rounded-t-[40px] border-t border-white/5 p-6 z-[70] pb-12 max shadow-2xl h-[85vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-purple-400 uppercase tracking-[0.25em] italic">Rede Coletiva</span>
                <h3 className="text-2xl font-black text-white leading-tight uppercase tracking-tight italic flex items-center gap-2">
                  <Clock size={22} className="text-purple-400 animate-pulse" /> MOMENTOS (STORIES)
                </h3>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowCreate(!showCreate)}
                  className="bg-purple-600 hover:bg-purple-500 text-white p-2.5 rounded-2xl flex items-center justify-center transition-all"
                >
                  <Plus size={20} />
                </button>
                <button 
                  onClick={onClose} 
                  className="p-2.5 bg-white/5 rounded-2xl text-white/30 hover:text-white transition-all hover:scale-105"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Posting Story Form */}
            {showCreate && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-8 p-6 bg-white/[0.02] border border-white/5 rounded-3xl"
              >
                <h4 className="text-xs font-black text-white uppercase tracking-wider mb-4">Compartilhar um Novo Momento</h4>
                <form onSubmit={handlePostStory} className="space-y-4">
                  <textarea
                    rows={3}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="Mande sua mensagem, humor ou pensamento..."
                    required
                    className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white text-xs outline-none focus:border-purple-500/20 transition-all resize-none font-bold"
                  />
                  <div className="flex items-center gap-2 bg-black/40 px-4 py-1 rounded-2xl border border-white/5">
                    <span className="text-[9px] font-black text-white/20 uppercase">Foto (Link ou upload)</span>
                    <input
                      type="text"
                      value={newPhotoUrl}
                      onChange={(e) => setNewPhotoUrl(e.target.value)}
                      placeholder="https://exemplo.com/story.png ou envie do celular..."
                      className="flex-1 bg-transparent text-xs font-semibold text-white focus:outline-none py-3"
                    />
                    <input 
                      id="story-image-file-input"
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const compressed = await compressImage(file);
                            setNewPhotoUrl(compressed);
                            success("Foto para o stories carregada! 📸");
                          } catch (err) {
                            console.error("Erro ao comprimir imagem:", err);
                            const reader = new FileReader();
                            reader.onload = async (event) => {
                              const rawBase64 = event.target?.result as string;
                              try {
                                const compressedFallback = await compressImage(rawBase64);
                                setNewPhotoUrl(compressedFallback);
                                success("Foto carregada com sucesso! 📸");
                              } catch (compressErr) {
                                setNewPhotoUrl(rawBase64);
                                success("Foto carregada com sucesso! 📸");
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        document.getElementById('story-image-file-input')?.click();
                      }}
                      className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-purple-400 transition-all cursor-pointer flex items-center justify-center shrink-0"
                      title="Fazer Upload de Foto Local"
                    >
                      <Camera size={14} />
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={submittingStory}
                    className="w-full bg-white text-black py-4 rounded-xl flex items-center justify-center font-black uppercase text-[10px] tracking-widest hover:bg-zinc-100 transition-all"
                  >
                    {submittingStory ? <Loader2 size={16} className="animate-spin" /> : 'Publicar nos Momentos (24H)'}
                  </button>
                </form>
              </motion.div>
            )}

            {/* Stories Horizontal Swipe Layout */}
            {loading ? (
              <div className="py-20 flex justify-center"><Loader2 size={36} className="animate-spin text-purple-500" /></div>
            ) : stories.length === 0 ? (
              <div className="text-center py-24 bg-white/[0.01] rounded-3xl border border-dashed border-white/5 p-8">
                <span className="text-sm font-semibold text-zinc-500 block">Nenhum Momento Compartilhado</span>
                <span className="text-[10px] text-zinc-600 font-bold block mt-2 uppercase tracking-wider">Seja o primeiro a postar!</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                {stories.map((story) => (
                  <button
                    key={story.id}
                    onClick={() => handleViewStory(story)}
                    className="relative aspect-[3/4] p-5 rounded-3xl overflow-hidden border border-white/5 flex flex-col justify-between text-left group bg-[#0e0c15]"
                  >
                    {story.photoURL ? (
                      <>
                        <img src={story.photoURL} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/90 via-black/20 to-black/30" />
                      </>
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 to-indigo-950/20" />
                    )}
                    
                    {/* Floating Author Info */}
                    <div className="relative z-10 flex gap-2 items-center">
                      <UserAvatar uid={story.userId} className="w-8 h-8 pointer-events-none" showLevel={false} />
                      <span className="text-[10px] font-black text-white/90 truncate max-w-[80px]">{story.authorName}</span>
                    </div>

                    <p className="relative z-10 text-[10.5px] font-black text-white/90 leading-normal line-clamp-3 italic uppercase mt-auto">
                      "{story.content}"
                    </p>

                    {/* Left Time banner */}
                    <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded-xl text-[8px] font-bold text-white/40">
                      <Clock size={10} /> 24h
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* ACTIVE STORY LIGHTBOX VIEW */}
            <AnimatePresence>
              {activeStory && (
                <div className="fixed inset-0 bg-black/95 z-[80] p-6 flex flex-col justify-between">
                  {/* Top Bar info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <UserAvatar uid={activeStory.userId} className="w-11 h-11" showLevel={false} />
                      <div>
                        <h4 className="text-sm font-black text-white leading-none uppercase italic">{activeStory.authorName}</h4>
                        <span className="text-[8px] font-bold text-white/30 uppercase tracking-widest mt-1 block">Momento Ativo</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setActiveStory(null)} 
                      className="p-2.5 bg-white/5 rounded-2xl text-white/50 hover:text-white transition-all"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Body Content */}
                  <div className="my-auto flex flex-col items-center justify-center text-center px-4 max-w-md mx-auto">
                    {activeStory.photoURL && (
                      <img src={activeStory.photoURL} className="max-h-[300px] rounded-3xl object-contain mb-6 border border-white/5" alt="Story Media" referrerPolicy="no-referrer" />
                    )}
                    <p className="text-xl font-black text-white leading-relaxed italic uppercase">
                      "{activeStory.content}"
                    </p>

                    {/* View and Reaction Stats */}
                    <div className="flex items-center gap-6 mt-8">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-white/40">
                        <Eye size={14} />
                        <span>{activeStory.views?.length || 1} visualizações</span>
                      </div>
                    </div>

                    {/* Reactions Quick Click Panel */}
                    <div className="flex items-center justify-center gap-4 mt-6">
                      {['❤️', '🔥', '😂', '😮'].map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => reactStory(emoji)}
                          className="px-4 py-2.5 bg-white/5 rounded-2xl hover:bg-white/10 active:scale-95 transition-all border border-white/5 flex items-center gap-2"
                        >
                          <span className="text-lg">{emoji}</span>
                          <span className="text-xs font-black text-white/60">{activeStory.reactions?.[emoji] || 0}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Private Reply Inputs */}
                  <form onSubmit={handleSendPrivateReply} className="w-full max-w-md mx-auto bg-white/[0.02] border border-white/5 rounded-2xl p-2 flex gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Enviar resposta privada..."
                      className="flex-1 bg-transparent px-4 text-xs font-semibold text-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={sendingReply}
                      className="bg-purple-600 hover:bg-purple-500 text-white p-3 rounded-xl flex items-center justify-center active:scale-95 transition-all"
                    >
                      {sendingReply ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    </button>
                  </form>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
