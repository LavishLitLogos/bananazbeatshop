import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { Beat, Room } from '../types';
import { canBuyBeat } from '../utils/beatAccess';
import { useAdmin } from './AdminContext';
import { useThemeMode } from './ThemeContext';

export { AudioProvider, useAudio } from './AudioContext';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface NotifItem {
  id: string;
  title: string;
  body?: string;
  type: string;
  read: boolean;
  created_at: string;
}

interface RoomCountMap {
  total: number;
  beatlab: number;
  freedls: number;
  beattapes: number;
  bananazroom: number;
  prodby: number;
  exclusives: number;
  credits: number;
  thelab: number;
  submission: number;
  profile: number;
  beatbayngr: number;
  supamaster: number;
}

interface AppContextType {
  currentRoom: Room;
  setCurrentRoom: (room: Room) => void;
  roomHistory: Room[];
  goBack: () => void;
  goHome: () => void;

  isAdmin: boolean;
  setIsAdmin: (value: boolean) => void;
  logoutAdmin: () => void;

  cart: Beat[];
  addToCart: (beat: Beat) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  cartOpen: boolean;
  setCartOpen: (value: boolean) => void;

  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;

  guestName: string;
  setGuestName: (name: string) => void;

  bananazMode: boolean;
  setBananazMode: (value: boolean) => void;
  toggleBananazMode: () => void;
  bananazTheme: string;
  setBananazTheme: (theme: any) => void;
  triggerBananazSplash: () => void;

  notifications: NotifItem[];
  setNotifications: React.Dispatch<React.SetStateAction<NotifItem[]>>;
  addNotification: (notification: Omit<NotifItem, 'id' | 'read' | 'created_at'>) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  unreadCount: number;

  roomCounts: RoomCountMap;
  setRoomCounts: React.Dispatch<React.SetStateAction<RoomCountMap>>;
  refreshKey: number;
  refreshContent: () => void;

  adminEditMode: boolean;
  setAdminEditMode: (value: boolean) => void;
  reorderMode: boolean;
  setReorderMode: (value: boolean) => void;

  activeModal: string | null;
  activeModalData: any;
  openModal: (modal: string, data?: any) => void;
  closeModal: () => void;
}

const AppCtx = createContext<AppContextType | null>(null);

const DEFAULT_ROOM_COUNTS: RoomCountMap = {
  total: 0,
  beatlab: 0,
  freedls: 0,
  beattapes: 0,
  bananazroom: 0,
  prodby: 0,
  exclusives: 0,
  credits: 0,
  thelab: 0,
  submission: 0,
  profile: 0,
  beatbayngr: 0,
  supamaster: 0,
};

const ALLOWED_NOTIFICATION_TYPES = new Set([
  'sale',
  'dm',
  'request',
  'inquiry',
  'error',
  'bug',
]);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const admin = useAdmin();
  const theme = useThemeMode();

  const [currentRoom, setCurrentRoomState] = useState<Room>('home');
  const [roomHistory, setRoomHistory] = useState<Room[]>([]);
  const [cart, setCart] = useState<Beat[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [guestName, setGuestName] = useState('');
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [roomCounts, setRoomCounts] = useState<RoomCountMap>(DEFAULT_ROOM_COUNTS);
  const [refreshKey, setRefreshKey] = useState(0);
  const [adminEditMode, setAdminEditMode] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [activeModalData, setActiveModalData] = useState<any>(null);

  const setCurrentRoom = useCallback(
    (room: Room) => {
      if (room === currentRoom) return;

      setRoomHistory((history) => [...history, currentRoom]);
      setCurrentRoomState(room);
    },
    [currentRoom]
  );

  const goBack = useCallback(() => {
    setRoomHistory((history) => {
      if (history.length === 0) {
        setCurrentRoomState('home');
        return history;
      }

      const previousRoom = history[history.length - 1];
      setCurrentRoomState(previousRoom);

      return history.slice(0, -1);
    });
  }, []);

  const goHome = useCallback(() => {
    setRoomHistory((history) => {
      if (currentRoom !== 'home') return [...history, currentRoom];
      return history;
    });

    setCurrentRoomState('home');
  }, [currentRoom]);

  const setIsAdmin = useCallback(
    (value: boolean) => {
      if (!value) {
        admin.logoutAdmin();
        setAdminEditMode(false);
        setReorderMode(false);
        setCurrentRoomState('home');
        setRoomHistory([]);
      }
    },
    [admin]
  );

  const logoutAdmin = useCallback(() => {
    admin.logoutAdmin();
    setAdminEditMode(false);
    setReorderMode(false);
    setActiveModal(null);
    setActiveModalData(null);
    setCurrentRoomState('home');
    setRoomHistory([]);
  }, [admin]);

  const addToCart = useCallback((beat: Beat) => {
    if (!canBuyBeat(beat)) return;

    setCart((currentCart) => {
      const alreadyInCart = currentCart.some((item) => item.id === beat.id);

      if (alreadyInCart) return currentCart;

      return [...currentCart, beat];
    });
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart((currentCart) => currentCart.filter((beat) => beat.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((currentToasts) =>
      currentToasts.filter((toast) => toast.id !== id)
    );
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      setToasts((currentToasts) => {
        const duplicate = currentToasts.some(
          (toast) => toast.message === message && toast.type === type
        );

        if (duplicate) return currentToasts;

        const id =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2);

        window.setTimeout(() => {
          removeToast(id);
        }, 3000);

        return [
          ...currentToasts,
          {
            id,
            message,
            type,
          },
        ];
      });
    },
    [removeToast]
  );

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const addNotification = useCallback(
    (notification: Omit<NotifItem, 'id' | 'read' | 'created_at'>) => {
      if (!ALLOWED_NOTIFICATION_TYPES.has(notification.type)) return;

      setNotifications((currentNotifications) => {
        const duplicate = currentNotifications.some(
          (item) =>
            item.type === notification.type &&
            item.title === notification.title &&
            item.body === notification.body
        );

        if (duplicate) return currentNotifications;

        const id =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2);

        return [
          {
            id,
            ...notification,
            read: false,
            created_at: new Date().toISOString(),
          },
          ...currentNotifications,
        ];
      });

      addToast(notification.title, notification.type === 'error' || notification.type === 'bug' ? 'error' : 'info');
    },
    [addToast]
  );

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) =>
        notification.id === id
          ? {
              ...notification,
              read: true,
            }
          : notification
      )
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const refreshContent = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  const openModal = useCallback((modal: string, data?: any) => {
    setActiveModal(modal);
    setActiveModalData(data ?? null);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setActiveModalData(null);
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  const value = useMemo<AppContextType>(
    () => ({
      currentRoom,
      setCurrentRoom,
      roomHistory,
      goBack,
      goHome,

      isAdmin: admin.isAdmin,
      setIsAdmin,
      logoutAdmin,

      cart,
      addToCart,
      removeFromCart,
      clearCart,
      cartOpen,
      setCartOpen,

      toasts,
      addToast,
      removeToast,
      clearToasts,

      guestName,
      setGuestName,

      bananazMode: theme.bananazMode,
      setBananazMode: theme.setBananazMode,
      toggleBananazMode: theme.toggleBananazMode,
      bananazTheme: theme.bananazTheme,
      setBananazTheme: theme.setBananazTheme,
      triggerBananazSplash: theme.triggerBananazSplash,

      notifications,
      setNotifications,
      addNotification,
      markNotificationRead,
      clearNotifications,
      unreadCount,

      roomCounts,
      setRoomCounts,
      refreshKey,
      refreshContent,

      adminEditMode,
      setAdminEditMode,
      reorderMode,
      setReorderMode,

      activeModal,
      activeModalData,
      openModal,
      closeModal,
    }),
    [
      currentRoom,
      setCurrentRoom,
      roomHistory,
      goBack,
      goHome,
      admin.isAdmin,
      setIsAdmin,
      logoutAdmin,
      cart,
      addToCart,
      removeFromCart,
      clearCart,
      cartOpen,
      toasts,
      addToast,
      removeToast,
      clearToasts,
      guestName,
      theme.bananazMode,
      theme.setBananazMode,
      theme.toggleBananazMode,
      theme.bananazTheme,
      theme.setBananazTheme,
      theme.triggerBananazSplash,
      notifications,
      addNotification,
      markNotificationRead,
      clearNotifications,
      unreadCount,
      roomCounts,
      refreshKey,
      refreshContent,
      adminEditMode,
      reorderMode,
      activeModal,
      activeModalData,
      openModal,
      closeModal,
    ]
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);

  if (!ctx) {
    throw new Error('useApp must be used within AppProvider');
  }

  return ctx;
}
