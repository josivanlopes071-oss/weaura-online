import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, addDoc, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from './AuthContext';

export type NotificationType = 'message' | 'friend_request' | 'mention' | 'gift';

export interface Notification {
  id: string;
  type: NotificationType;
  fromId: string;
  fromName: string;
  toId: string;
  roomId?: string;
  text?: string;
  read: boolean;
  createdAt: any;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  sendNotification: (data: Omit<Notification, 'id' | 'read' | 'createdAt'>) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const notificationsRef = collection(db, 'users', user.uid, 'notifications');
    const q = query(
      notificationsRef,
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/notifications`);
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    if (!user) return;
    try {
      const notifRef = doc(db, 'users', user.uid, 'notifications', notificationId);
      await updateDoc(notifRef, { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/notifications/${notificationId}`);
    }
  };

  const clearAllNotifications = async () => {
    if (!user) return;
    try {
      const { writeBatch, getDocs } = await import('firebase/firestore');
      const notificationsRef = collection(db, 'users', user.uid, 'notifications');
      const snapshot = await getDocs(notificationsRef);
      const batch = writeBatch(db);
      
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/notifications`);
    }
  };

  const sendNotification = async (data: Omit<Notification, 'id' | 'read' | 'createdAt'>) => {
    try {
      const targetNotifsRef = collection(db, 'users', data.toId, 'notifications');
      await addDoc(targetNotifsRef, {
        ...data,
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${data.toId}/notifications`);
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, clearAllNotifications, sendNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
