import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type BananazTheme =
  | 'gambit'
  | 'slimer'
  | 'blueRush'
  | 'lightning'
  | 'cosmic'
  | 'smoked'
  | 'flamethrower';

interface ThemeOption {
  id: BananazTheme;
  label: string;
  hex: string;
  rgb: string;
  effect: 'plasma' | 'goo' | 'ripple' | 'lightning' | 'cosmic' | 'smoke' | 'ember';
}

interface ThemeContextType {
  bananazMode: boolean;
  setBananazMode: (value: boolean) => void;
  toggleBananazMode: () => void;
  bananazTheme: BananazTheme;
  setBananazTheme: (theme: BananazTheme) => void;
  themeOptions: ThemeOption[];
  triggerBananazSplash: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const BANANAZ_MODE_KEY = 'bananaz_mode_public';
const BANANAZ_THEME_KEY = 'bananaz_theme_public';

const THEME_OPTIONS: ThemeOption[] = [
  { id: 'gambit', label: 'Gambit Energy', hex: '#ff00c8', rgb: '255 0 200', effect: 'plasma' },
  { id: 'slimer', label: 'Slimer Primer', hex: '#7dff00', rgb: '125 255 0', effect: 'goo' },
  { id: 'blueRush', label: 'Blue Rush', hex: '#00b7ff', rgb: '0 183 255', effect: 'ripple' },
  { id: 'lightning', label: 'Lightning Rush', hex: '#ffe600', rgb: '255 230 0', effect: 'lightning' },
  { id: 'cosmic', label: 'Cosmic Wonder', hex: '#8c2cff', rgb: '140 44 255', effect: 'cosmic' },
  { id: 'smoked', label: 'Smoked Out', hex: '#6d727c', rgb: '109 114 124', effect: 'smoke' },
  { id: 'flamethrower', label: 'Flamethrower', hex: '#ff5a00', rgb: '255 90 0', effect: 'ember' },
];

function clearStoredMode() {
  try {
    localStorage.removeItem(BANANAZ_MODE_KEY);
    localStorage.removeItem('bananazMode');
    localStorage.removeItem('bananazTheme');
  } catch {
    // Storage can be blocked in private browsers.
  }
}

function getStoredTheme(): BananazTheme {
  try {
    const stored = localStorage.getItem(BANANAZ_THEME_KEY) as BananazTheme | null;
    return THEME_OPTIONS.some((theme) => theme.id === stored) ? stored! : 'lightning';
  } catch {
    return 'lightning';
  }
}

function getThemeOption(themeId: BananazTheme) {
  return THEME_OPTIONS.find((option) => option.id === themeId) || THEME_OPTIONS[3];
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [bananazTheme, setBananazThemeState] = useState<BananazTheme>(getStoredTheme());

  const applyTheme = useCallback((themeId: BananazTheme) => {
    const theme = getThemeOption(themeId);
    const root = document.documentElement;

    root.style.setProperty('--bananaz-accent', theme.hex);
    root.style.setProperty('--bananaz-accent-rgb', theme.rgb);
    root.dataset.bananazTheme = theme.id;
    root.dataset.bananazEffect = theme.effect;
    root.classList.remove('bananaz-mode');
  }, []);

  useEffect(() => {
    applyTheme(bananazTheme);

    try {
      localStorage.removeItem(BANANAZ_MODE_KEY);
      localStorage.setItem(BANANAZ_THEME_KEY, bananazTheme);
    } catch {
      // Storage can be blocked in private browsers.
    }
  }, [applyTheme, bananazTheme]);

  useEffect(() => {
    clearStoredMode();
  }, []);

  const setBananazMode = useCallback((value: boolean) => {
    void value;
    clearStoredMode();
  }, []);

  const toggleBananazMode = useCallback(() => {
    clearStoredMode();
  }, []);

  const setBananazTheme = useCallback((theme: BananazTheme) => {
    setBananazThemeState(theme);

    try {
      localStorage.setItem(BANANAZ_THEME_KEY, theme);
    } catch {
      // Storage can be blocked in private browsers.
    }
  }, []);

  const value = useMemo<ThemeContextType>(
    () => ({
      bananazMode: false,
      setBananazMode,
      toggleBananazMode,
      bananazTheme,
      setBananazTheme,
      themeOptions: THEME_OPTIONS,
      triggerBananazSplash: () => undefined,
    }),
    [bananazTheme, setBananazMode, toggleBananazMode, setBananazTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);

  if (!ctx) {
    throw new Error('useThemeMode must be used within ThemeProvider');
  }

  return ctx;
}
