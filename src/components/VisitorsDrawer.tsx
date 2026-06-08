import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Users, Calendar, ArrowRight, Loader2 } from 'lucide-react';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import UserAvatar from './UserAvatar';
import { useNavigate } from 'react-router-dom';

interface VisitorsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Visit {
  id: string;
  visitorId: string;
  visitorName: string;
  visitorPhoto: string;
  visitedAt: any;
}

export default function VisitorsDrawer({ isOpen, onClose }: VisitorsDrawerProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterDays, setFilterDays] = useState<3 | 7 | 30>(7);

  const fetchProfileVisits = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'profile_visits'),
        where('targetUserId', '==', profile.uid),
        limit(40)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Visit[];

      // Filter local by dates and sort
      list.sort((a, b) => {
        const timeA = a.visitedAt?.seconds || 0;
        const timeB = b.visitedAt?.seconds || 0;
        return timeB - timeA;
      });

      setVisits(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProfileVisits();
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[60]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 180 }}
            className="fixed inset-x-0 bottom-0 bg-[#0a0a0a] rounded-t-[40px] border-t border-white/5 p-6 z-[70] pb-12 shadow-2xl h-[80vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.25em] italic">Visitas ao Perfil</span>
                <h3 className="text-2xl font-black text-white leading-tight uppercase tracking-tight italic flex items-center gap-2">
                  <Users size={22} className="text-blue-400 animate-pulse" /> HISTÓRICO DE VISITANTES
                </h3>
              </div>
              <button 
                onClick={onClose} 
                className="p-2.5 bg-white/5 rounded-2xl text-white/30 hover:text-white transition-all hover:scale-105"
              >
                <X size={20} />
              </button>
            </div>

            {/* Total count and filters */}
            <div className="mb-6 bg-white/[0.02] border border-white/5 p-4 rounded-[24px] flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="text-center sm:text-left">
                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest block leading-none">Total Unidades</span>
                <span className="text-lg font-black text-white italic">{visits.length} Visitantes no total</span>
              </div>
              <div className="flex bg-black/60 p-1 rounded-2xl border border-white/10">
                {[3, 7, 30].map(days => (
                  <button
                    key={days}
                    onClick={() => setFilterDays(days as any)}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filterDays === days ? 'bg-white text-black font-black' : 'text-white/20'}`}
                  >
                    {days} Dias
                  </button>
                ))}
              </div>
            </div>

            {/* List visitors */}
            {loading ? (
              <div className="py-20 flex justify-center"><Loader2 size={36} className="animate-spin text-blue-500" /></div>
            ) : visits.length === 0 ? (
              <div className="text-center py-20 bg-white/[0.01] rounded-3xl border border-dashed border-white/5 p-8">
                <span className="text-sm font-semibold text-zinc-500 block">Ninguém visitou ainda</span>
                <span className="text-[10px] text-zinc-600 font-bold block mt-2 uppercase tracking-wider">Mostre sua aura nos canais e consiga mais visitas!</span>
              </div>
            ) : (
              <div className="space-y-4">
                {visits.map((visit) => {
                  const visitDate = visit.visitedAt?.toDate ? visit.visitedAt.toDate() : new Date(visit.visitedAt || Date.now());
                  return (
                    <div
                      key={visit.id}
                      onClick={() => {
                        navigate(`/profile/${visit.visitorId}`);
                        onClose();
                      }}
                      className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 hover:border-blue-500/30 transition-all rounded-[28px] cursor-pointer group"
                    >
                      <div className="flex items-center gap-4">
                        <UserAvatar uid={visit.visitorId} className="w-12 h-12" />
                        <div>
                          <h4 className="text-sm font-black text-white uppercase group-hover:text-blue-400 transition-colors">{visit.visitorName}</h4>
                          <span className="text-[9px] font-bold text-white/30 tracking-widest uppercase mt-1 block flex items-center gap-1.5">
                            <Calendar size={10} /> {visitDate.toLocaleDateString('pt-BR')} às {visitDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <div className="p-2 bg-white/5 rounded-xl group-hover:bg-blue-600/10 group-hover:text-blue-400 transition-all">
                        <ArrowRight size={14} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
