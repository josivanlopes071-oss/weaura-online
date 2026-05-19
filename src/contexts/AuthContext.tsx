import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInAnonymously, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, runTransaction, updateDoc } from 'firebase/firestore';

export type UserRole = 'user' | 'moderator' | 'admin' | 'superadmin' | 'owner';

interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  bio: string;
  level: number;
  xp: number;
  coins: number;
  role: UserRole;
  displayId: number;
  following?: string[];
  followers?: string[];
  isBanned?: boolean;
  bannedUntil?: any; // Timestamp
  isMuted?: boolean;
  mutedUntil?: any; // Timestamp
  status: 'online' | 'offline' | 'away';
  lastSeen?: any;
  deviceInfo?: {
    platform: string;
    userAgent: string;
  };
  verified?: boolean;
}

const SUPER_ADMINS = ['josivanlopes071@gmail.com', 'manoeldasilva631kejr@gmail.com'];

export function getRoleLevel(role: UserRole): number {
  switch (role) {
    case 'user': return 0;
    case 'moderator': return 1;
    case 'admin': return 2;
    case 'superadmin': return 3;
    case 'owner': return 4;
    default: return 0;
  }
}

export function isSuperAdmin(email?: string | null) {
  return SUPER_ADMINS.includes(email || '');
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
            const isAdminEmail = SUPER_ADMINS.includes(authenticatedUser.email || '');
            
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
              photoURL: authenticatedUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${authenticatedUser.uid}`,
              bio: 'Bem-vindo ao WE AURA!',
              level: 1,
              xp: 0,
              coins: 100,
              role: isAdminEmail ? 'owner' : 'user',
              displayId: numericalId,
              following: [],
              followers: [],
              isBanned: false,
              status: 'online',
              deviceInfo: {
                platform: navigator.platform,
                userAgent: navigator.userAgent
              }
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
            const isAdminEmail = SUPER_ADMINS.includes(authenticatedUser.email || '');
            
            let needsUpdate = false;
            const updates: any = {};

            // Auto-upgrade to owner if email is in the list but role is not owner
            if (isAdminEmail && data.role !== 'owner') {
              data.role = 'owner';
              updates.role = 'owner';
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
              ...data,
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
          if (currentCoins < amount) throw new Error("Moedas insuficientes!");
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
    const xpNeeded = profile.level * 100;
    let newXp = (profile.xp || 0) + amount;
    let newLevel = profile.level;
    
    if (newXp >= xpNeeded) {
      newXp -= xpNeeded;
      newLevel += 1;
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

  return (
    <AuthContext.Provider value={{ 
      user, profile, loading, isOnline, connectionError, 
      loginAnonymously, loginWithEmail, loginWithGoogle, logout, 
      updateProfile, updateCoins, gainXp, followUser, refreshConnection 
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
