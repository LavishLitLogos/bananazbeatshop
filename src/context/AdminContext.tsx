import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

type AdminStep = 'idle' | 'first-code' | 'second-code' | 'granted';

interface AdminSubmitResult {
  success: boolean;
  message: string;
}

interface AdminContextType {
  isAdmin: boolean;
  adminStep: AdminStep;
  gatewayOpen: boolean;
  tapCount: number;
  registerAdminTap: () => void;
  closeGateway: () => void;
  submitAdminCode: (code: string) => AdminSubmitResult;
  logoutAdmin: () => void;
}

const AdminContext = createContext<AdminContextType | null>(null);

const FIRST_CODE = 'rwmg25';
const SECOND_CODE = 'GLOKEY';
const REQUIRED_TAPS = 3;
const TAP_RESET_MS = 1200;
const ADMIN_STORAGE_KEY = 'thisbeatizbananaz_admin_session';

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [gatewayOpen, setGatewayOpen] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [adminStep, setAdminStep] = useState<AdminStep>(() => {
    try {
      return localStorage.getItem(ADMIN_STORAGE_KEY) === 'granted'
        ? 'granted'
        : 'idle';
    } catch {
      return 'idle';
    }
  });

  const isAdmin = adminStep === 'granted';

  const registerAdminTap = useCallback(() => {
    if (isAdmin) {
      setGatewayOpen(false);
      setTapCount(0);
      return;
    }

    setTapCount((current) => {
      const next = current + 1;

      if (next >= REQUIRED_TAPS) {
        setGatewayOpen(true);
        setAdminStep('first-code');
        return 0;
      }

      window.setTimeout(() => {
        setTapCount(0);
      }, TAP_RESET_MS);

      return next;
    });
  }, [isAdmin]);

  const closeGateway = useCallback(() => {
    setGatewayOpen(false);
    setTapCount(0);

    if (!isAdmin) {
      setAdminStep('idle');
    }
  }, [isAdmin]);

  const submitAdminCode = useCallback(
    (rawCode: string): AdminSubmitResult => {
      const code = rawCode.trim();

      if (adminStep === 'first-code') {
        if (code === FIRST_CODE) {
          setAdminStep('second-code');

          return {
            success: true,
            message: 'Step 1 accepted.',
          };
        }

        return {
          success: false,
          message: 'Wrong admin code.',
        };
      }

      if (adminStep === 'second-code') {
        if (code === SECOND_CODE) {
          try {
            localStorage.setItem(ADMIN_STORAGE_KEY, 'granted');
          } catch {
            // Browser storage blocked. Admin still works for this session.
          }

          setAdminStep('granted');
          setGatewayOpen(false);
          setTapCount(0);

          return {
            success: true,
            message: 'WELCOME ADMIN.',
          };
        }

        return {
          success: false,
          message: 'Wrong owner code.',
        };
      }

      return {
        success: false,
        message: 'Admin gateway is not active.',
      };
    },
    [adminStep]
  );

  const logoutAdmin = useCallback(() => {
    try {
      localStorage.removeItem(ADMIN_STORAGE_KEY);
    } catch {
      // Ignore blocked storage.
    }

    setAdminStep('idle');
    setGatewayOpen(false);
    setTapCount(0);
  }, []);

  const value = useMemo<AdminContextType>(
    () => ({
      isAdmin,
      adminStep,
      gatewayOpen,
      tapCount,
      registerAdminTap,
      closeGateway,
      submitAdminCode,
      logoutAdmin,
    }),
    [
      isAdmin,
      adminStep,
      gatewayOpen,
      tapCount,
      registerAdminTap,
      closeGateway,
      submitAdminCode,
      logoutAdmin,
    ]
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);

  if (!ctx) {
    throw new Error('useAdmin must be used within AdminProvider');
  }

  return ctx;
}