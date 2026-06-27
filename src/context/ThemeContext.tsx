import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

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
  splashActive: boolean;
  triggerBananazSplash: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const BANANAZ_MODE_KEY = 'bananaz_mode_public';
const BANANAZ_THEME_KEY = 'bananaz_theme_public';
const BROADCAST_MS = 3500;

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'gambit',
    label: 'Gambit Glow',
    hex: '#b547ff',
    rgb: '181 71 255',
    effect: 'plasma',
  },
  {
    id: 'slimer',
    label: 'Slimer Sauce',
    hex: '#39ff14',
    rgb: '57 255 20',
    effect: 'goo',
  },
  {
    id: 'blueRush',
    label: 'Blue Rush',
    hex: '#00b7ff',
    rgb: '0 183 255',
    effect: 'ripple',
  },
  {
    id: 'lightning',
    label: 'Lightning Gold',
    hex: '#f5c518',
    rgb: '245 197 24',
    effect: 'lightning',
  },
  {
    id: 'cosmic',
    label: 'Cosmic Violet',
    hex: '#8b5cf6',
    rgb: '139 92 246',
    effect: 'cosmic',
  },
  {
    id: 'smoked',
    label: 'Smoked Out',
    hex: '#6d727c',
    rgb: '109 114 124',
    effect: 'smoke',
  },
  {
    id: 'flamethrower',
    label: 'Flamethrower',
    hex: '#ff5a00',
    rgb: '255 90 0',
    effect: 'ember',
  },
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

function rgbForCss(rgb: string) {
  return rgb.split(' ').join(',');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [bananazMode, setBananazModeState] = useState(false);
  const [bananazTheme, setBananazThemeState] = useState<BananazTheme>(getStoredTheme);
  const [splashActive, setSplashActive] = useState(false);

  const activeTheme = useMemo(() => getThemeOption(bananazTheme), [bananazTheme]);

  const applyTheme = useCallback((themeId: BananazTheme, active: boolean) => {
    const theme = getThemeOption(themeId);
    const glowRgb = rgbForCss(theme.rgb);
    const root = document.documentElement;

    root.style.setProperty('--bananaz-accent', theme.hex);
    root.style.setProperty('--bananaz-accent-rgb', theme.rgb);
    root.style.setProperty('--bananaz-glow-soft', `rgba(${glowRgb}, 0.14)`);
    root.style.setProperty('--bananaz-glow-mid', `rgba(${glowRgb}, 0.26)`);
    root.style.setProperty('--bananaz-glow-strong', `rgba(${glowRgb}, 0.48)`);
    root.dataset.bananazTheme = theme.id;
    root.dataset.bananazEffect = theme.effect;

    if (active) {
      root.classList.add('bananaz-mode');
    } else {
      root.classList.remove('bananaz-mode');
    }
  }, []);

  useEffect(() => {
    clearStoredMode();
  }, []);

  useEffect(() => {
    applyTheme(bananazTheme, bananazMode);

    try {
      localStorage.removeItem(BANANAZ_MODE_KEY);
      localStorage.setItem(BANANAZ_THEME_KEY, bananazTheme);
    } catch {
      // Storage can be blocked in private browsers.
    }
  }, [applyTheme, bananazMode, bananazTheme]);

  const triggerBananazSplash = useCallback(() => {
    setSplashActive(true);

    window.setTimeout(() => {
      setSplashActive(false);
    }, 700);
  }, []);

  const setBananazMode = useCallback(
    (value: boolean) => {
      if (!value) {
        setBananazModeState(false);
        clearStoredMode();
        return;
      }

      setBananazModeState(true);
      triggerBananazSplash();

      window.setTimeout(() => {
        setBananazModeState(false);
        clearStoredMode();
      }, BROADCAST_MS);
    },
    [triggerBananazSplash]
  );

  const toggleBananazMode = useCallback(() => {
    setBananazMode(!bananazMode);
  }, [bananazMode, setBananazMode]);

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
      bananazMode,
      setBananazMode,
      toggleBananazMode,
      bananazTheme,
      setBananazTheme,
      themeOptions: THEME_OPTIONS,
      splashActive,
      triggerBananazSplash,
    }),
    [
      bananazMode,
      setBananazMode,
      toggleBananazMode,
      bananazTheme,
      setBananazTheme,
      splashActive,
      triggerBananazSplash,
    ]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}

      {splashActive && (
        <div className="fixed top-4 left-1/2 z-[99999] -translate-x-1/2 pointer-events-none">
          <div
            className="rounded-full border px-4 py-2 text-xs font-display font-900 uppercase tracking-[0.22em] bg-black/80 shadow-lg"
            style={{
              borderColor: activeTheme.hex,
              color: activeTheme.hex,
              boxShadow: `0 0 22px rgba(${rgbForCss(activeTheme.rgb)}, 0.32)`,
            }}
          >
            {activeTheme.label}
          </div>
        </div>
      )}
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);

  if (!ctx) {
    throw new Error('useThemeMode must be used within ThemeProvider');
  }

  return ctx;
}
