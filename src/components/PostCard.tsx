import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageSquare, Share2, Bookmark, Flag, Pin, Volume2, VolumeX, Eye, Globe, Languages, Trash2, Edit3, Check, Loader2, ZoomIn, ZoomOut, RotateCcw, X, Maximize2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, increment, deleteDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import UserAvatar from './UserAvatar';

// Basic language translations fallback map
const POPULAR_TRANSLATIONS: { [key: string]: string } = {
  "sou bom nisso.": "I am good at this.",
  "boa noite meus amores": "Good night my loves ❤️",
  "dia incrível com a galera!": "An amazing day with the crew!",
  "foco no objetivo do clã": "Focus on the clan's goal ⚔️",
  "amigos para sempre": "friends forever ❤️🫵🫶",
  "cuidar da saúde": "take care of your health",
  "weaura é o melhor": "WeAura matches the perfect vibe!",
  "novas atualizações chegando": "epic new updates on the way!",
};

interface PostCardProps {
  key?: any;
  post: any;
  onCommentClick: (post: any) => void;
  onHashtagClick?: (hashtag: string) => void;
}

export default function PostCard({ post, onCommentClick, onHashtagClick }: PostCardProps) {
  const { user, profile, gainAura } = useAuth();
  const { success, error, warn, info } = useToast();
  const navigate = useNavigate();

  // Interaction collections indicators
  const isLiked = post.likes?.includes(user?.uid);
  const likesCount = post.likes?.length || 0;
  const commentsCount = post.comments?.length || 0;
  const sharesCount = post.shares || 0;
  const isSaved = post.saves?.includes(user?.uid);
  const viewsCount = post.views?.length || 0;

  // React local states
  const [showReactions, setShowReactions] = useState(false);
  const [doubleLikedAnim, setDoubleLikedAnim] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(post.text || '');
  const [editImageUrl, setEditImageUrl] = useState<string | null>(post.imageUrl || null);
  const [editVideoUrl, setEditVideoUrl] = useState<string | null>(post.videoUrl || null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReportConfirm, setShowReportConfirm] = useState(false);
  const [showPhotoDeleteConfirm, setShowPhotoDeleteConfirm] = useState(false);
  const [showVideoDeleteConfirm, setShowVideoDeleteConfirm] = useState(false);
  const [isZoomedOpen, setIsZoomedOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [resetKey, setResetKey] = useState(0);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reactionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Unique view increment logic
  useEffect(() => {
    if (!user || !post.id) return;
    const viewsArray = post.views || [];
    if (!viewsArray.includes(user.uid)) {
      const postRef = doc(db, 'posts', post.id);
      updateDoc(postRef, {
        views: arrayUnion(user.uid)
      }).catch(err => console.warn("Error incrementing post unique views: ", err));
    }
  }, [user?.uid, post?.id, post?.views]);

  // Video Autoplay when scrolled in viewport using IntersectionObserver
  useEffect(() => {
    if (!post.videoUrl || !videoRef.current) return;
    const videoElement = videoRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            videoElement.play().catch(() => {});
          } else {
            videoElement.pause();
          }
        });
      },
      { threshold: 0.6 }
    );

    observer.observe(videoElement);
    return () => {
      observer.unobserve(videoElement);
    };
  }, [post.videoUrl]);

  // Double Click / Double Tap animation mechanism on image
  const handleImageDoubleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    setDoubleLikedAnim(true);
    setTimeout(() => setDoubleLikedAnim(false), 900);

    if (!isLiked) {
      try {
        const postRef = doc(db, 'posts', post.id);
        await updateDoc(postRef, {
          likes: arrayUnion(user.uid)
        });
        success("Apoio duplo confirmado! ❤️");
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Toggle Standard Custom Reaction Love / Laugh / Wow / Fire
  const addReaction = async (emoji: string) => {
    setShowReactions(false);
    if (!user) return;

    try {
      const postRef = doc(db, 'posts', post.id);
      const activeReactions = post.reactions || {};
      const emojiUsers = activeReactions[emoji] || [];

      if (emojiUsers.includes(user.uid)) {
        // Remove reaction
        await updateDoc(postRef, {
          [`reactions.${emoji}`]: arrayRemove(user.uid)
        });
      } else {
        // Add reaction & remove other previous emojis from same user if helpful
        const updatePayload: any = {
          [`reactions.${emoji}`]: arrayUnion(user.uid)
        };
        // Clean from other lists in reactions to avoid duplicate emoji identity
        Object.keys(activeReactions).forEach(k => {
          if (k !== emoji && activeReactions[k]?.includes(user.uid)) {
            updatePayload[`reactions.${k}`] = arrayRemove(user.uid);
          }
        });
        await updateDoc(postRef, updatePayload);
        success(`Reagiu com ${emoji}!`);
        if (gainAura) {
          gainAura(2).catch(() => {});
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle regular Heart click state
  const handleLikeToggle = async () => {
    try {
      const postRef = doc(db, 'posts', post.id);
      if (isLiked) {
        await updateDoc(postRef, { likes: arrayRemove(user.uid) });
      } else {
        await updateDoc(postRef, { likes: arrayUnion(user.uid) });
        if (gainAura) {
          gainAura(2).catch(() => {});
        }
      }
    } catch (e) {
      console.error("Like toggle error: ", e);
    }
  };

  // Toggle Bookmark item save
  const handleSaveToggle = async () => {
    try {
      const postRef = doc(db, 'posts', post.id);
      if (isSaved) {
        await updateDoc(postRef, { saves: arrayRemove(user.uid) });
        info("Publicidade removida dos seus salvos.");
      } else {
        await updateDoc(postRef, { saves: arrayUnion(user.uid) });
        success("Publicação salva com sucesso! Acesse em seus favoritos.");
      }
    } catch (err) {
      console.error("Save error: ", err);
    }
  };

  // Set Post pin state
  const handlePinToggle = async () => {
    try {
      const postRef = doc(db, 'posts', post.id);
      const newPinnedState = !post.isPinned;
      await updateDoc(postRef, { isPinned: newPinnedState });
      if (newPinnedState) {
        success("Publicação fixada no topo do seu perfil! 📌");
      } else {
        info("Publicação desfixada do perfil.");
      }
    } catch (err) {
      console.error("Pin toggle error: ", err);
    }
  };

  // Report a publication
  const handleReport = async () => {
    const isReported = post.reports?.includes(user?.uid);
    if (isReported) {
      warn("Você já denunciou esta publicação. Nossa equipe de moderação está analisando!");
      return;
    }

    try {
      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, {
        reports: arrayUnion(user.uid)
      });
      success("Denúncia registrada! Obrigado por manter a WeAura segura. 🛡️");
    } catch (err) {
      console.error("Report error: ", err);
    }
  };

  // Delete matching publication
  const handleDeletePost = async () => {
    setIsDeleting(true);
    try {
      const postRef = doc(db, 'posts', post.id);
      await deleteDoc(postRef);
      success("Sua publicação foi removida.");
    } catch (err) {
      console.error("Delete error: ", err);
      error("Erro ao excluir publicação.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Update existing publication
  const handleUpdatePost = async () => {
    if (!editText.trim()) return;
    setIsUpdating(true);
    try {
      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, {
        text: editText.trim(),
        imageUrl: editImageUrl,
        videoUrl: editVideoUrl
      });
      setIsEditing(false);
      success("Publicação atualizada com sucesso!");
    } catch (err) {
      console.error("Update text error: ", err);
      error("Não foi possível salvar as alterações.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Parse hashtags and mentions @ into styled interactive JSX
  const formatPostText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\s+)/);

    return parts.map((part, index) => {
      // Hashtags click handle
      if (part.startsWith('#') && part.length > 1) {
        return (
          <span
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              if (onHashtagClick) onHashtagClick(part);
            }}
            className="text-purple-400 font-bold hover:underline cursor-pointer italic pr-1"
          >
            {part}
          </span>
         );
      }
      // User mentions handle
      if (part.startsWith('@') && part.length > 1) {
        const username = part.slice(1);
        return (
          <span
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              // In this design, clicking names redirects to profile. Let's redirect securely!
              navigate(`/social?search=${username}`);
              info(`Procurando clã por @${username}...`);
            }}
            className="text-[#00F0FF] font-black hover:underline cursor-pointer tracking-wider pr-1"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Dynamic automatic language translation text provider
  const getTranslatedText = () => {
    const rawText = post.text ? post.text.toLowerCase().trim().replace(/[.,!?:;❤️🔥😂😮😢👍]/g, '') : '';
    // Look up popular matches
    for (const key of Object.keys(POPULAR_TRANSLATIONS)) {
      if (rawText.includes(key)) {
        return POPULAR_TRANSLATIONS[key];
      }
    }
    // Simple automated fallback translation reverse
    return `[Traduzido]: ${post.text || ''}`;
  };

  const isOwner = post.userId === user?.uid;
  const isReportedByMe = post.reports?.includes(user?.uid);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-[#0b0b0b] border border-white/[0.04] p-3 sm:p-3.5 rounded-2xl space-y-2.5 hover:border-purple-500/10 transition-colors relative ${
        post.isPinned ? 'border-indigo-500/30 bg-indigo-950/5' : ''
      }`}
    >
      {/* Pinned label indicators */}
      {post.isPinned && (
        <div className="absolute top-3 right-12 flex items-center gap-1 bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-500/30 text-[7px] font-black tracking-widest text-indigo-300 uppercase">
          <Pin size={8} className="rotate-45" />
          <span>Fixado</span>
        </div>
      )}

      {/* Author Row Header */}
      <div className="flex items-center justify-between">
        <div 
          className="flex items-center gap-2.5 cursor-pointer" 
          onClick={() => navigate(`/profile/${post.userId}`)}
        >
          <UserAvatar uid={post.userId} className="w-10 h-10" />
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-[11px] md:text-xs font-extrabold text-white uppercase italic tracking-wide leading-none hover:text-purple-400 transition-colors">
                {post.userName}
              </h4>
              <span className="bg-yellow-500 text-black text-[7px] font-black px-1 py-0.5 rounded-full">
                LV.{post.userLevel || 1}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <Globe size={9} className="text-white/20" />
              <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest pointer-events-none">
                Cantinho • {post.createdAt ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(post.createdAt)) : 'Recente'}
              </span>
            </div>
          </div>
        </div>

        {/* Action controls for Owners & Admins */}
        <div className="flex items-center gap-1.5">
          {isOwner && (
            <>
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 p-1 px-2 rounded-xl animate-pulse">
                  <span className="text-[9.5px] font-bold text-rose-400 uppercase tracking-wider">Excluir?</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePost();
                    }}
                    disabled={isDeleting}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 active:scale-90 text-white text-[9.5px] font-black uppercase rounded-lg transition-all cursor-pointer"
                  >
                    {isDeleting ? <Loader2 size={10} className="animate-spin" /> : 'Sim'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(false);
                    }}
                    disabled={isDeleting}
                    className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white text-[9.5px] font-black uppercase rounded-lg transition-all cursor-pointer"
                  >
                    Não
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={handlePinToggle}
                    className={`p-1.5 rounded-lg border transition-all ${
                      post.isPinned ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400' : 'bg-white/5 border-white/5 text-white/30 hover:text-white'
                    }`}
                    title={post.isPinned ? "Desfixar do perfil" : "Fixar no topo do perfil"}
                  >
                    <Pin size={11.5} />
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(!isEditing);
                      setEditText(post.text || '');
                      setEditImageUrl(post.imageUrl || null);
                      setEditVideoUrl(post.videoUrl || null);
                    }}
                    className={`p-1.5 rounded-lg border transition-all ${
                      isEditing ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-white/5 border-white/5 text-white/30 hover:text-white'
                    }`}
                    title="Editar publicação"
                  >
                    <Edit3 size={11.5} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(true);
                    }}
                    className="p-1.5 bg-rose-500/15 border border-rose-500/20 text-rose-400 hover:text-rose-300 rounded-lg active:scale-95 transition-all"
                    title="Excluir publicação"
                  >
                    <Trash2 size={11.5} />
                  </button>
                </>
              )}
            </>
          )}

          {!isOwner && (
            <>
              {showReportConfirm ? (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 p-1 px-2 rounded-xl animate-pulse">
                  <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">Denunciar?</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReport();
                      setShowReportConfirm(false);
                    }}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-[9px] font-black uppercase rounded-lg cursor-pointer"
                  >
                    Sim
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowReportConfirm(false);
                    }}
                    className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white text-[9px] font-black uppercase rounded-lg cursor-pointer"
                  >
                    Não
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const isReported = post.reports?.includes(user?.uid);
                    if (isReported) {
                      warn("Você já denunciou esta publicação. Nossa equipe de moderação está analisando!");
                      return;
                    }
                    setShowReportConfirm(true);
                  }}
                  className={`p-1.5 rounded-lg border transition-all ${
                    isReportedByMe ? 'bg-red-500/20 border-red-500/30 text-red-500' : 'bg-white/5 border-white/5 text-white/20 hover:text-white'
                  }`}
                  title="Denunciar conteúdo impróprio"
                >
                  <Flag size={11.5} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Post Text Description Block */}
      <div className="space-y-2">
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs font-semibold text-white outline-none focus:border-purple-500/35 resize-none font-sans"
              rows={2}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
            />

            {/* Show image under editing with delete option */}
            {editImageUrl && (
              <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 p-3 rounded-2xl w-full max-w-sm">
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 shrink-0">
                  <img 
                    src={editImageUrl} 
                    alt="Preview do post" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase font-black tracking-widest text-[#00F0FF] mb-1">FOTO ANEXADA</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setEditImageUrl(null);
                      success("Foto marcada para exclusão! Clique em 'Salvar' para confirmar.");
                    }}
                    className="flex items-center gap-2 bg-red-500/15 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-xl hover:bg-red-500 hover:text-white transition-all text-[9.5px] font-bold uppercase cursor-pointer"
                  >
                    <Trash2 size={12} />
                    Excluir Foto
                  </button>
                </div>
              </div>
            )}

            {/* Show video under editing with delete option */}
            {editVideoUrl && (
              <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 p-3 rounded-2xl w-full max-w-sm">
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 shrink-0">
                  <video 
                    src={editVideoUrl} 
                    className="w-full h-full object-cover"
                    muted
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase font-black tracking-widest text-[#ff00ea] mb-1">VÍDEO ANEXADO</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setEditVideoUrl(null);
                      success("Vídeo marcado para exclusão! Clique em 'Salvar' para confirmar.");
                    }}
                    className="flex items-center gap-2 bg-red-500/15 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-xl hover:bg-red-500 hover:text-white transition-all text-[9.5px] font-bold uppercase cursor-pointer"
                  >
                    <Trash2 size={12} />
                    Excluir Vídeo
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase text-zinc-400"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdatePost}
                disabled={isUpdating}
                className="px-4 py-2 bg-white hover:scale-105 active:scale-95 duration-200 text-black rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5"
              >
                {isUpdating ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                Salvar
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            {isReportedByMe ? (
              <div className="p-4 bg-red-950/10 border border-red-500/10 rounded-2xl flex flex-col gap-2">
                <p className="text-[10px] uppercase font-black tracking-wider text-red-400 flex items-center gap-1">
                  <Flag size={11} className="fill-red-400" /> Publicação Denunciada
                </p>
                <p className="text-[11px] text-white/40 italic font-medium">Buscando o bem-estar do clã, o conteúdo foi ocultado temporariamente.</p>
              </div>
            ) : (
              <p className="text-xs md:text-sm font-medium text-zinc-200 leading-normal font-sans pr-1 break-words">
                {formatPostText(isTranslated ? getTranslatedText() : post.text)}
              </p>
            )}

            {/* Translation interface indicator option */}
            {post.text && !isReportedByMe && (
              <button
                onClick={() => setIsTranslated(!isTranslated)}
                className={`flex items-center gap-1 mt-1.5 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border transition-all ${
                  isTranslated
                    ? 'bg-purple-500/15 border-purple-500/20 text-purple-400'
                    : 'bg-white/5 border-white/5 text-white/30 hover:text-white'
                }`}
              >
                <Languages size={9} />
                <span>{isTranslated ? "Ver Original" : "Traduzir"}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Post Image Attachment Media block (with full-screen capability & double click like) */}
      {post.imageUrl && !isReportedByMe && (
        <div 
          onClick={() => {
            setIsZoomedOpen(true);
            setZoomScale(1);
          }}
          onDoubleClick={handleImageDoubleClick}
          className="w-full h-40 sm:h-48 rounded-xl overflow-hidden border border-white/5 cursor-zoom-in group relative select-none flex items-center justify-center bg-[#070707] text-white"
        >
          <img 
            src={post.imageUrl} 
            className="w-full h-full object-cover rounded-xl group-hover:scale-[1.01] transition-transform duration-500" 
            alt="Anexo do Cantinho" 
            referrerPolicy="no-referrer"
          />

          {/* Delete Photo Button directly on the image for the owner */}
          {isOwner && (
            <div className="absolute top-3 left-3 z-30" onClick={(e) => e.stopPropagation()}>
              {showPhotoDeleteConfirm ? (
                <div className="flex items-center gap-1.5 bg-black/80 backdrop-blur-md p-1.5 px-2.5 rounded-xl border border-red-500/30 shadow-lg">
                  <span className="text-[8px] font-black text-red-400 uppercase tracking-wider">Remover foto?</span>
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      try {
                        const postRef = doc(db, 'posts', post.id);
                        await updateDoc(postRef, {
                          imageUrl: null
                        });
                        success("Foto removida da publicação com sucesso! 🗑️");
                      } catch (err: any) {
                        console.error("Erro ao remover foto do post:", err);
                        error(`Erro ao remover foto: ${err.message || 'Erro Desconhecido'}`);
                      } finally {
                        setShowPhotoDeleteConfirm(false);
                      }
                    }}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-[8px] font-black uppercase rounded-lg cursor-pointer transition-all"
                  >
                    Sim
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowPhotoDeleteConfirm(false);
                    }}
                    className="px-2 py-1 bg-white/15 hover:bg-white/25 text-white text-[8px] font-black uppercase rounded-lg cursor-pointer transition-all"
                  >
                    Não
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowPhotoDeleteConfirm(true);
                  }}
                  className="bg-red-600 hover:bg-red-700 active:scale-95 text-white px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5 transition-all text-[9px] font-bold uppercase tracking-wider cursor-pointer border border-red-500/30"
                  title="Excluir Foto da Publicação"
                >
                  <Trash2 size={11} />
                  <span>Excluir Foto</span>
                </button>
              )}
            </div>
          )}

          {/* Double Click Floating Heart Overlay */}
          <AnimatePresence>
            {doubleLikedAnim && (
              <motion.div
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: 1.2 }}
                exit={{ opacity: 0, scale: 1.8, y: -40 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
              >
                <Heart size={82} className="fill-rose-500 text-rose-500 drop-shadow-[0_4px_25px_rgba(244,63,94,0.65)]" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Expand Icon Overlay */}
          <div className="absolute bottom-3 right-3 p-2 bg-black/60 backdrop-blur-md text-white/70 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <Maximize2 size={13} className="text-white" />
          </div>

          {/* Hint Overlay information info */}
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-xl pointer-events-none text-[8.5px] font-black text-white/50 border border-white/5 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
            Toque para ampliar 🔍
          </div>
        </div>
      )}

      {/* Post Video Attachment with autoplay & control options */}
      {post.videoUrl && !isReportedByMe && (
        <div className="rounded-xl overflow-hidden border border-white/5 bg-black max-h-[250px] mb-1 relative flex items-center justify-center group text-white">
          <video 
            ref={videoRef}
            src={post.videoUrl} 
            controls 
            muted
            loop
            playsInline
            className="w-full rounded-xl object-contain max-h-[250px] cursor-pointer" 
          />

          {/* Delete Video Button directly on the video for the owner */}
          {isOwner && (
            <div className="absolute top-3 left-3 z-30">
              {showVideoDeleteConfirm ? (
                <div className="flex items-center gap-1.5 bg-black/80 backdrop-blur-md p-1.5 px-2.5 rounded-xl border border-red-500/30 shadow-lg">
                  <span className="text-[8px] font-black text-red-400 uppercase tracking-wider">Remover vídeo?</span>
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      try {
                        const postRef = doc(db, 'posts', post.id);
                        await updateDoc(postRef, {
                          videoUrl: null
                        });
                        success("Vídeo removido da publicação com sucesso! 🗑️");
                      } catch (err: any) {
                        console.error("Erro ao remover vídeo do post:", err);
                        error(`Erro ao remover vídeo: ${err.message || 'Erro Desconhecido'}`);
                      } finally {
                        setShowVideoDeleteConfirm(false);
                      }
                    }}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-[8px] font-black uppercase rounded-lg cursor-pointer transition-all"
                  >
                    Sim
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowVideoDeleteConfirm(false);
                    }}
                    className="px-2 py-1 bg-white/15 hover:bg-white/25 text-white text-[8px] font-black uppercase rounded-lg cursor-pointer transition-all"
                  >
                    Não
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowVideoDeleteConfirm(true);
                  }}
                  className="absolute top-3 left-3 z-30 bg-red-600 hover:bg-red-700 active:scale-95 text-white px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5 transition-all text-[9px] font-bold uppercase tracking-wider cursor-pointer border border-red-500/30"
                  title="Excluir Vídeo da Publicação"
                >
                  <Trash2 size={11} />
                  <span>Excluir Vídeo</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Interaction Icons bar & indicators list */}
      <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.03] relative select-none">
        
        {/* Dynamic Reaction Popover overlay (Love, Laugh, Fire etc) */}
        <AnimatePresence>
          {showReactions && (
            <motion.div 
              initial={{ opacity: 0, y: 15, scale: 0.85 }}
              animate={{ opacity: 1, y: -48, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.85 }}
              className="absolute left-2 bg-zinc-950/95 backdrop-blur-xl border border-white/10 px-4 py-2.5 rounded-full flex gap-3.5 z-40 shadow-[0_15px_40px_rgba(0,0,5,0.7)]"
              onMouseEnter={() => {
                if (reactionsTimeoutRef.current) clearTimeout(reactionsTimeoutRef.current);
              }}
              onMouseLeave={() => setShowReactions(false)}
            >
              {['❤️', '👍', '😂', '😮', '😢', '🔥'].map((emoji) => {
                const activeReactions = post.reactions || {};
                const usersList = activeReactions[emoji] || [];
                const userReacted = usersList.includes(user?.uid);

                return (
                  <motion.button
                    key={emoji}
                    whileHover={{ scale: 1.3, y: -4 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => addReaction(emoji)}
                    className={`text-lg md:text-xl transition-all relative ${userReacted ? 'filter drop-shadow-[0_0_8px_rgba(168,85,247,0.7)]' : ''}`}
                  >
                    {emoji}
                    {usersList.length > 0 && (
                      <span className="absolute -bottom-1 -right-1 bg-purple-600 font-sans text-[7px] font-black text-white rounded-full px-1 py-0.5 leading-none shadow-sm shadow-black">
                        {usersList.length}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2">
          {/* Reaction/Like action */}
          <div 
            className="relative"
            onMouseEnter={() => {
              if (reactionsTimeoutRef.current) clearTimeout(reactionsTimeoutRef.current);
              reactionsTimeoutRef.current = setTimeout(() => setShowReactions(true), 400);
            }}
            onMouseLeave={() => {
              reactionsTimeoutRef.current = setTimeout(() => setShowReactions(false), 900);
            }}
          >
            <button
              onClick={handleLikeToggle}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[9px] font-black uppercase transition-all tracking-wider cursor-pointer ${
                isLiked ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-white/5 border-white/5 text-white/40'
              }`}
            >
              <Heart size={11} className={isLiked ? 'fill-rose-500 text-rose-500' : ''} />
              <span>{likesCount} {likesCount === 1 ? 'Apoio' : 'Apoios'}</span>
            </button>
          </div>

          {/* Comment access */}
          <button
            onClick={() => onCommentClick(post)}
            className="flex items-center gap-1.5 bg-white/5 border border-white/5 text-white/40 hover:text-white px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
          >
            <MessageSquare size={11} />
            <span>{commentsCount}</span>
          </button>
        </div>

        {/* Floating actions right (Bookmark, view counts etc) */}
        <div className="flex items-center gap-2">
          {/* View count indicator display badge */}
          <div className="flex items-center gap-1 bg-white/[0.02] border border-white/5 text-white/20 px-2 py-1 rounded-full text-[8.5px] font-bold tracking-wider pointer-events-none">
            <Eye size={10} className="text-white/30" />
            <span className="tabular-nums">{viewsCount}</span>
          </div>

          {/* Save Post Bookmark action */}
          <button
            onClick={handleSaveToggle}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              isSaved ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-white/5 border-white/5 text-white/30 hover:text-white'
            }`}
            title="Salvar publicação nos favoritos"
          >
            <Bookmark size={11} className={isSaved ? 'fill-amber-500' : ''} />
          </button>

          {/* Share Action */}
          <button
            onClick={async () => {
              try {
                const postRef = doc(db, 'posts', post.id);
                await updateDoc(postRef, { shares: increment(1) });
                navigator.clipboard.writeText(`https://weaura.app/post/${post.id}`);
                success("Link do post copiado! Compartilhe com sua galera.");
                if (gainAura) {
                  gainAura(5).catch(() => {});
                }
              } catch(err) {
                console.error(err);
              }
            }}
            className="p-1.5 bg-white/5 border border-white/5 text-white/30 hover:text-white rounded-lg active:scale-90 transition-all cursor-pointer"
            title="Copiar link de compartilhamento"
          >
            <Share2 size={11.5} />
          </button>
        </div>

      </div>

      {/* Full-Screen Zoom Interactive Viewer modal */}
      <AnimatePresence>
        {isZoomedOpen && post.imageUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 backdrop-blur-md z-[9999] flex flex-col items-center justify-center p-4 select-none"
            onClick={() => setIsZoomedOpen(false)}
          >
             {/* Modal Header controls */}
             <div className="absolute top-4 right-4 flex items-center gap-2.5 z-50 animate-fade-in" onClick={e => e.stopPropagation()}>
                <button 
                  onClick={() => setZoomScale(prev => Math.min(4, prev + 0.5))}
                  className="p-3 bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/20 text-white rounded-2xl transition-all cursor-pointer hover:scale-105 active:scale-95"
                  title="Aproximar Zoom (In)"
                >
                  <ZoomIn size={16} />
                </button>
                <button 
                  onClick={() => setZoomScale(prev => Math.max(1, prev - 0.5))}
                  className="p-3 bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/20 text-white rounded-2xl transition-all cursor-pointer hover:scale-105 active:scale-95"
                  title="Afastar Zoom (Out)"
                >
                  <ZoomOut size={16} />
                </button>
                <button 
                  onClick={() => { setZoomScale(1); setResetKey(prev => prev + 1); }}
                  className="p-3 bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/20 text-white rounded-2xl transition-all cursor-pointer hover:scale-105 active:scale-95"
                  title="Resetar Posição e Zoom"
                >
                  <RotateCcw size={16} />
                </button>
                <button 
                  onClick={() => setIsZoomedOpen(false)}
                  className="p-3 bg-red-600/90 hover:bg-red-700/95 border border-red-500/30 text-white rounded-2xl transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-lg shadow-red-950/40"
                  title="Fechar"
                >
                  <X size={16} />
                </button>
             </div>

             {/* Zoom/Pan image display area wrapper */}
             <div className="relative w-full h-full flex items-center justify-center overflow-hidden" onClick={e => e.stopPropagation()}>
                <motion.img 
                  key={resetKey}
                  drag={zoomScale > 1}
                  dragConstraints={{
                    left: -200 * (zoomScale - 1),
                    right: 200 * (zoomScale - 1),
                    top: -200 * (zoomScale - 1),
                    bottom: 200 * (zoomScale - 1),
                  }}
                  dragElastic={0.1}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: zoomScale, opacity: 1 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                  src={post.imageUrl}
                  className={`max-w-full max-h-[85vh] object-contain rounded-xl select-none shadow-2xl ${zoomScale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
                  referrerPolicy="no-referrer"
                />
             </div>

             {/* Dynamic tooltip details overlay */}
             <div className="absolute bottom-6 bg-black/70 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/5 text-[9px] font-black uppercase tracking-widest text-white/50 pointer-events-none">
                Zoom Ativo: {zoomScale.toFixed(1)}x {zoomScale > 1 ? '• Arraste a imagem para navegar' : '• Use os botões no topo para focar'}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
