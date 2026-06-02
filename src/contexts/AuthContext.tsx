import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInAnonymously, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, runTransaction, updateDoc } from 'firebase/firestore';

interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  bio: string;
  level: number;
  xp: number;
  coins: number;
  role: 'user' | 'admin';
  displayId: number;
  following?: string[];
  followers?: string[];
  isBanned?: boolean;
  bannedUntil?: any; // Timestamp
  status: 'online' | 'offline' | 'away';
  email?: string;
  equippedFrame?: string;
  purchasedFrames?: string[];
  aura?: number;
  auraLevel?: number;
}

const SUPER_ADMINS = ['josivanlopes071@gmail.com', 'manoeldasilva631kejr@gmail.com'];

export function isSuperAdmin(email?: string | null) {
  return SUPER_ADMINS.includes((email || '').toLowerCase());
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isOnline: boolean;
  connectionError: string | null;
  loginAnonymously: () => Promise<void>;
  loginWithEmail: (email: string, pass: string, isNew: boolean) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  updateCoins: (amount: number, type: 'add' | 'subtract') => Promise<void>;
  gainXp: (amount: number) => Promise<void>;
  followUser: (targetId: string) => Promise<void>;
  refreshConnection: () => Promise<void>;
  sendGift: (targetUserId: string, giftId: string, roomId?: string, chatId?: string) => Promise<{ success: boolean; auraGained: number; giftName: string; giftIcon: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const refreshConnection = async () => {
    setConnectionError(null);
    try {
      const { enableNetwork, disableNetwork, db } = await import('../lib/firebase');
      await disableNetwork(db);
      await enableNetwork(db);
      console.log("Conexão reiniciada manualmente");
    } catch (err) {
      console.warn("Falha ao reiniciar rede:", err);
    }
  };

  useEffect(() => {
    let heartbeat: any = null;
    const handleOnline = () => {
      setIsOnline(true);
      refreshConnection();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = onAuthStateChanged(auth, async (authenticatedUser) => {
      setUser(authenticatedUser);
      setConnectionError(null);
      
      if (heartbeat) clearInterval(heartbeat);

      if (authenticatedUser) {
        // Set online status
        const userRef = doc(db, 'users', authenticatedUser.uid);
        updateDoc(userRef, { status: 'online', lastSeen: serverTimestamp() }).catch(() => {});

        // Heartbeat to keep online status fresh
        heartbeat = setInterval(() => {
          updateDoc(userRef, { lastSeen: serverTimestamp(), status: 'online' }).catch(() => {});
        }, 120000); // Every 2 minutes

        // Perfil Firestore
        const userPath = `users/${authenticatedUser.uid}`;
        try {
          const userRef = doc(db, 'users', authenticatedUser.uid);
          const docSnap = await getDoc(userRef);
          
          if (!docSnap.exists()) {
            const isAdminEmail = SUPER_ADMINS.includes((authenticatedUser.email || '').toLowerCase());
            
            // Transaction to get sequential ID
            let numericalId: number;
            try {
              numericalId = await runTransaction(db, async (transaction) => {
                const counterRef = doc(db, 'counters', 'users');
                const counterSnap = await transaction.get(counterRef);
                
                let newId = 1;
                if (counterSnap.exists()) {
                  newId = (counterSnap.data().lastId || 0) + 1;
                }
                
                transaction.set(counterRef, { lastId: newId }, { merge: true });
                return newId;
              });
            } catch (trError: any) {
              handleFirestoreError(trError, OperationType.WRITE, 'counters/users');
              throw trError;
            }
                         const newProfile: UserProfile = {
              uid: authenticatedUser.uid,
              displayName: authenticatedUser.email?.split('@')[0] || 'Usuário',
              email: authenticatedUser.email || '',
              photoURL: authenticatedUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${authenticatedUser.uid}`,
              bio: 'Bem-vindo ao WE AURA!',
              level: 1,
              xp: 0,
              coins: 100,
              role: isAdminEmail ? 'admin' : 'user',
              displayId: numericalId,
              following: [],
              followers: [],
              isBanned: false,
              status: 'online',
              aura: 0,
              auraLevel: 1,
            };
            try {
              await setDoc(userRef, {
                ...newProfile,
                createdAt: serverTimestamp(),
              });
            } catch (setErr: any) {
              handleFirestoreError(setErr, OperationType.WRITE, userPath);
              throw setErr;
            }
            setProfile(newProfile);
          } else {
            const data = docSnap.data() as UserProfile;
            const isAdminEmail = SUPER_ADMINS.includes((authenticatedUser.email || '').toLowerCase());
            
            let needsUpdate = false;
            const updates: any = {};

            // Ensure email is saved in Firestore for searching
            if (!data.email && authenticatedUser.email) {
              data.email = authenticatedUser.email;
              updates.email = authenticatedUser.email;
              needsUpdate = true;
            }

            // Auto-upgrade to admin if email is in the list but role is not admin
            if (isAdminEmail && data.role !== 'admin') {
              data.role = 'admin';
              updates.role = 'admin';
              needsUpdate = true;
            }

            // Migration: Ensure existing users have a sequential displayId
            if (!data.displayId || data.displayId > 9999999) {
              let numericalId: number;
              try {
                numericalId = await runTransaction(db, async (transaction) => {
                  const counterRef = doc(db, 'counters', 'users');
                  const counterSnap = await transaction.get(counterRef);
                  
                  let newId = 1;
                  if (counterSnap.exists()) {
                    newId = (counterSnap.data().lastId || 0) + 1;
                  }
                  
                  transaction.set(counterRef, { lastId: newId }, { merge: true });
                  return newId;
                });
                data.displayId = numericalId;
                updates.displayId = numericalId;
                needsUpdate = true;
              } catch (trError: any) {
                handleFirestoreError(trError, OperationType.WRITE, 'counters/users');
                throw trError;
              }
            }

            if (needsUpdate) {
              try {
                await setDoc(userRef, updates, { merge: true });
              } catch (updateErr: any) {
                handleFirestoreError(updateErr, OperationType.WRITE, userPath);
                throw updateErr;
              }
            }
            
            // Check for ban expiration
            const now = new Date();
            let isCurrentlyBanned = data.isBanned;
            if (isCurrentlyBanned && data.bannedUntil) {
              const expireDate = data.bannedUntil.toDate ? data.bannedUntil.toDate() : new Date(data.bannedUntil);
              if (expireDate < now) {
                isCurrentlyBanned = false;
                data.isBanned = false;
                data.bannedUntil = null;
                updates.isBanned = false;
                updates.bannedUntil = null;
                needsUpdate = true;
              }
            }

            setProfile({
              uid: authenticatedUser.uid,
              ...data,
              level: data.level || 1,
              xp: data.xp || 0,
              aura: data.aura || 0,
              auraLevel: data.auraLevel || 1,
              following: data.following || [],
              followers: data.followers || []
            });
          }
        } catch (error: any) {
          console.error("Erro ao carregar perfil:", error);
          if (error.code === 'permission-denied' && !error.message.includes('counters/users')) {
            handleFirestoreError(error, OperationType.GET, userPath);
          }
          if (error.code === 'unavailable' || error.message?.includes('offline')) {
            setConnectionError("Firestore inacessível. O app funcionará em modo limitado.");
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe();
    };
  }, []);

  const loginAnonymously = async () => {
    try {
      await signInAnonymously(auth);
    } catch (error: any) {
      if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/admin-restricted-operation') {
        throw new Error("O login anônimo não está ativado no Console do Firebase. Ative-o em 'Authentication > Sign-in method'.");
      }
      throw error;
    }
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/admin-restricted-operation') {
        throw new Error("O login do Google não está ativado ou está restrito. Verifique as configurações de 'Authentication' no Console do Firebase.");
      }
      throw error;
    }
  };

  const loginWithEmail = async (email: string, pass: string, isNew: boolean) => {
    try {
      if (isNew) {
        await createUserWithEmailAndPassword(auth, email, pass);
      } else {
        await signInWithEmailAndPassword(auth, email, pass);
      }
    } catch (error: any) {
      if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/admin-restricted-operation') {
        throw new Error("O login por E-mail não está ativado ou está restrito no Console do Firebase. Ative-o em 'Authentication > Sign-in method'.");
      }
      throw error;
    }
  };

  const logout = async () => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { status: 'offline', lastSeen: serverTimestamp() }).catch(() => {});
    }
    await signOut(auth);
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    const userPath = `users/${user.uid}`;
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
      setProfile(prev => prev ? { ...prev, ...data } : null);

      // If photo or name changed, update all rooms owned by this user
      if (data.photoURL || data.displayName) {
        const { collection, query, where, getDocs, writeBatch } = await import('firebase/firestore');
        const roomsQuery = query(collection(db, 'rooms'), where('ownerId', '==', user.uid));
        const roomsSnap = await getDocs(roomsQuery);
        
        if (!roomsSnap.empty) {
          const batch = writeBatch(db);
          roomsSnap.docs.forEach(roomDoc => {
            const hostInfoUpdate: any = {};
            if (data.displayName) hostInfoUpdate['hostInfo.displayName'] = data.displayName;
            if (data.photoURL) hostInfoUpdate['hostInfo.photoURL'] = data.photoURL;
            batch.update(roomDoc.ref, hostInfoUpdate);
          });
          await batch.commit();
        }
      }
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, userPath);
    }
  };

  const updateCoins = async (amount: number, type: 'add' | 'subtract') => {
    if (!user || !profile) return;
    
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await transaction.get(userRef);
        
        if (!userSnap.exists()) throw new Error("Usuário não encontrado!");
        
        const currentCoins = userSnap.data().coins || 0;
        let newCoins = currentCoins;
        
        if (type === 'add') {
          newCoins += amount;
        } else {
          if (currentCoins < amount) throw new Error("Saldo EGO insuficiente!");
          newCoins -= amount;
        }
        
        transaction.update(userRef, { coins: newCoins, updatedAt: serverTimestamp() });
        setProfile(prev => prev ? { ...prev, coins: newCoins } : null);
      });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      throw error;
    }
  };

  const gainXp = async (amount: number) => {
    if (!user || !profile) return;
    
    // Level logic: each level needs (level * 100) XP
    let newXp = (profile.xp || 0) + amount;
    let newLevel = profile.level || 1;
    
    while (true) {
      const xpNeeded = newLevel * 100;
      if (newXp >= xpNeeded) {
        newXp -= xpNeeded;
        newLevel += 1;
      } else {
        break;
      }
    }
    
    await updateProfile({ xp: newXp, level: newLevel });
  };

  const followUser = async (targetId: string) => {
    if (!user || !profile || user.uid === targetId) return;
    
    try {
      const { arrayUnion, arrayRemove } = await import('firebase/firestore');
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid);
        const targetRef = doc(db, 'users', targetId);
        
        const userSnap = await transaction.get(userRef);
        const targetSnap = await transaction.get(targetRef);
        
        if (!userSnap.exists() || !targetSnap.exists()) throw new Error("Usuário não encontrado!");
        
        const userData = userSnap.data();
        const following = userData.following || [];
        const isFollowing = following.includes(targetId);
        
        if (isFollowing) {
          transaction.update(userRef, { following: arrayRemove(targetId), updatedAt: serverTimestamp() });
          transaction.update(targetRef, { followers: arrayRemove(user.uid), updatedAt: serverTimestamp() });
          setProfile(prev => prev ? { ...prev, following: (prev.following || []).filter(id => id !== targetId) } : null);
        } else {
          transaction.update(userRef, { following: arrayUnion(targetId), updatedAt: serverTimestamp() });
          transaction.update(targetRef, { followers: arrayUnion(user.uid), updatedAt: serverTimestamp() });
          setProfile(prev => prev ? { ...prev, following: [...(prev.following || []), targetId] } : null);
        }
      });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      throw error;
    }
  };

  const sendGift = async (targetUserId: string, giftId: string, roomId?: string, chatId?: string, quantity: number = 1) => {
    if (!user || !profile) throw new Error("Você precisa estar logado.");
    if (user.uid === targetUserId) throw new Error("Você não pode enviar um presente para si mesmo!");
    if (quantity < 1) throw new Error("Quantidade inválida.");

    const { GIFTS, getAuraLevelInfo } = await import('../lib/aura');
    const { addDoc, collection } = await import('firebase/firestore');

    const gift = GIFTS.find(g => g.id === giftId);
    if (!gift) throw new Error("Presente inválido.");

    const totalCost = gift.price * quantity;
    const totalAuraGained = gift.aura * quantity;

    // Roll random EGO coins received by the recipient: between 5 and 150 coins per gift!
    const randomCoinsPerGift = Math.floor(Math.random() * 116) + 5; // 5 to 120 EGO coins
    const totalCoinsGained = randomCoinsPerGift * quantity;

    try {
      const result = await runTransaction(db, async (transaction) => {
        const senderRef = doc(db, 'users', user.uid);
        const receiverRef = doc(db, 'users', targetUserId);

        const senderSnap = await transaction.get(senderRef);
        const receiverSnap = await transaction.get(receiverRef);

        if (!senderSnap.exists()) throw new Error("Seu perfil não foi encontrado.");
        if (!receiverSnap.exists()) throw new Error("Destinatário não encontrado.");

        const senderData = senderSnap.data();
        const receiverData = receiverSnap.data();

        const currentCoins = senderData.coins || 0;
        if (currentCoins < totalCost) {
          throw new Error(`Saldo insuficiente! Você precisa de ${totalCost} moedas.`);
        }

        const receiverAura = (receiverData.aura || 0) + totalAuraGained;
        const auraLevelInfo = getAuraLevelInfo(receiverAura);
        const receiverAuraLevel = auraLevelInfo.level;

        const newSenderCoins = currentCoins - totalCost;
        const newReceiverCoins = (receiverData.coins || 0) + totalCoinsGained;

        // Deduct coins from sender
        transaction.update(senderRef, {
          coins: newSenderCoins,
          updatedAt: serverTimestamp()
        });

        // Add aura points and random coins to receiver
        transaction.update(receiverRef, {
          aura: receiverAura,
          auraLevel: receiverAuraLevel,
          coins: newReceiverCoins,
          updatedAt: serverTimestamp()
        });

        return {
          senderCoins: newSenderCoins,
          receiverAura,
          receiverAuraLevel,
          receiverName: receiverData.displayName || "Membro Aura"
        };
      });

      // Update local sender state
      setProfile(prev => prev ? { ...prev, coins: result.senderCoins } : null);

      // Save transaction to gift_transactions catalog for live animation overlays & records
      await addDoc(collection(db, 'gift_transactions'), {
        senderId: user.uid,
        senderName: profile.displayName || "Usuário",
        senderPhoto: profile.photoURL || "",
        receiverId: targetUserId,
        receiverName: result.receiverName,
        giftId,
        giftName: gift.name,
        giftIcon: gift.icon,
        price: gift.price,
        quantity,
        totalPrice: totalCost,
        auraGained: totalAuraGained,
        coinsGained: totalCoinsGained,
        createdAt: serverTimestamp(),
        roomId: roomId || null,
        chatId: chatId || null
      });

      return {
        success: true,
        quantity,
        auraGained: totalAuraGained,
        coinsGained: totalCoinsGained,
        giftName: gift.name,
        giftIcon: gift.icon
      };
    } catch (err: any) {
      console.error("Erro ao enviar presente:", err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, profile, loading, isOnline, connectionError, 
      loginAnonymously, loginWithEmail, loginWithGoogle, logout, 
      updateProfile, updateCoins, gainXp, followUser, refreshConnection,
      sendGift
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
