import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
const SPLASH_MS = 1200;
const BROADCAST_MS = 4500;

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'gambit',
    label: 'Gambit Energy',
    hex: '#ff00c8',
    rgb: '255 0 200',
    effect: 'plasma',
  },
  {
    id: 'slimer',
    label: 'Slimer Primer',
    hex: '#7dff00',
    rgb: '125 255 0',
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
    label: 'Lightning Rush',
    hex: '#ffe600',
    rgb: '255 230 0',
    effect: 'lightning',
  },
  {
    id: 'cosmic',
    label: 'Cosmic Wonder',
    hex: '#8c2cff',
    rgb: '140 44 255',
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
    return THEME_OPTIONS.some((theme) => theme.id === stored)
      ? stored!
      : 'lightning';
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

function ModeParticles({ effect }: { effect: ThemeOption['effect'] }) {
  if (effect === 'lightning') {
    return (
      <>
        <span className="bananaz-particle bananaz-lightning bolt-a" />
        <span className="bananaz-particle bananaz-lightning bolt-b" />
        <span className="bananaz-particle bananaz-lightning bolt-c" />
      </>
    );
  }

  if (effect === 'smoke') {
    return (
      <>
        <span className="bananaz-particle bananaz-smoke smoke-a" />
        <span className="bananaz-particle bananaz-smoke smoke-b" />
        <span className="bananaz-particle bananaz-smoke smoke-c" />
        <span className="bananaz-particle bananaz-smoke smoke-d" />
      </>
    );
  }

  if (effect === 'ember') {
    return (
      <>
        <span className="bananaz-particle bananaz-ember ember-a" />
        <span className="bananaz-particle bananaz-ember ember-b" />
        <span className="bananaz-particle bananaz-ember ember-c" />
        <span className="bananaz-particle bananaz-ember ember-d" />
        <span className="bananaz-particle bananaz-ember ember-e" />
      </>
    );
  }

  if (effect === 'cosmic') {
    return (
      <>
        <span className="bananaz-particle bananaz-star star-a" />
        <span className="bananaz-particle bananaz-star star-b" />
        <span className="bananaz-particle bananaz-star star-c" />
        <span className="bananaz-particle bananaz-star star-d" />
        <span className="bananaz-particle bananaz-star star-e" />
      </>
    );
  }

  if (effect === 'goo') {
    return (
      <>
        <span className="bananaz-particle bananaz-goo goo-a" />
        <span className="bananaz-particle bananaz-goo goo-b" />
        <span className="bananaz-particle bananaz-goo goo-c" />
      </>
    );
  }

  if (effect === 'ripple') {
    return (
      <>
        <span className="bananaz-particle bananaz-ripple ripple-a" />
        <span className="bananaz-particle bananaz-ripple ripple-b" />
        <span className="bananaz-particle bananaz-ripple ripple-c" />
      </>
    );
  }

  return (
    <>
      <span className="bananaz-particle bananaz-plasma plasma-a" />
      <span className="bananaz-particle bananaz-plasma plasma-b" />
      <span className="bananaz-particle bananaz-plasma plasma-c" />
    </>
  );
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [bananazMode, setBananazModeState] = useState(false);
  const [bananazTheme, setBananazThemeState] =
    useState<BananazTheme>(getStoredTheme);
  const [splashActive, setSplashActive] = useState(false);
  const splashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeTheme = useMemo(
    () => getThemeOption(bananazTheme),
    [bananazTheme]
  );

  const applyTheme = useCallback((themeId: BananazTheme, active: boolean) => {
    const theme = getThemeOption(themeId);
    const glowRgb = rgbForCss(theme.rgb);

    const root = document.documentElement;

    root.style.setProperty('--bananaz-accent', theme.hex);
    root.style.setProperty('--bananaz-accent-rgb', theme.rgb);
    root.style.setProperty('--bananaz-glow-soft', `rgba(${glowRgb}, 0.18)`);
    root.style.setProperty('--bananaz-glow-mid', `rgba(${glowRgb}, 0.34)`);
    root.style.setProperty('--bananaz-glow-strong', `rgba(${glowRgb}, 0.65)`);
    root.dataset.bananazTheme = theme.id;
    root.dataset.bananazEffect = theme.effect;

    if (active) {
      root.classList.add('bananaz-mode');
    } else {
      root.classList.remove('bananaz-mode');
    }
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

  useEffect(() => {
    clearStoredMode();

    return () => {
      if (splashTimerRef.current) {
        clearTimeout(splashTimerRef.current);
      }

      if (modeTimerRef.current) {
        clearTimeout(modeTimerRef.current);
      }
    };
  }, []);

  const triggerBananazSplash = useCallback(() => {
    if (splashTimerRef.current) {
      clearTimeout(splashTimerRef.current);
    }

    setSplashActive(true);

    splashTimerRef.current = setTimeout(() => {
      setSplashActive(false);
      splashTimerRef.current = null;
    }, SPLASH_MS);
  }, []);

  const stopBananazMode = useCallback(() => {
    if (modeTimerRef.current) {
      clearTimeout(modeTimerRef.current);
      modeTimerRef.current = null;
    }

    setBananazModeState(false);
    clearStoredMode();
  }, []);

  const startBananazMode = useCallback(() => {
    if (modeTimerRef.current) {
      clearTimeout(modeTimerRef.current);
    }

    setBananazModeState(true);
    triggerBananazSplash();

    modeTimerRef.current = setTimeout(() => {
      setBananazModeState(false);
      modeTimerRef.current = null;
      clearStoredMode();
    }, BROADCAST_MS);
  }, [triggerBananazSplash]);

  const setBananazMode = useCallback(
    (value: boolean) => {
      if (value) {
        startBananazMode();
        return;
      }

      stopBananazMode();
    },
    [startBananazMode, stopBananazMode]
  );

  const toggleBananazMode = useCallback(() => {
    if (bananazMode) {
      stopBananazMode();
      return;
    }

    startBananazMode();
  }, [bananazMode, startBananazMode, stopBananazMode]);

  const setBananazTheme = useCallback(
    (theme: BananazTheme) => {
      setBananazThemeState(theme);

      try {
        localStorage.setItem(BANANAZ_THEME_KEY, theme);
      } catch {
        // Storage can be blocked in private browsers.
      }
    },
    []
  );

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

      {bananazMode && (
        <div className="fixed inset-0 z-[1] pointer-events-none overflow-hidden bananaz-mode-layer">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,var(--bananaz-glow-soft),transparent_48%)]" />
          <ModeParticles effect={activeTheme.effect} />
        </div>
      )}

      {splashActive && (
        <div className="fixed inset-0 z-[99999] pointer-events-none flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(var(--bananaz-accent-rgb),0.42)_0%,rgba(0,0,0,0)_62%)] animate-ping" />

          <div className="absolute w-[28rem] h-[28rem] rounded-full border-4 border-[var(--bananaz-accent)] opacity-60 animate-ping" />

          <div className="absolute w-[18rem] h-[18rem] rounded-full bg-[radial-gradient(circle,rgba(var(--bananaz-accent-rgb),0.42)_0%,rgba(0,0,0,0)_68%)] animate-pulse" />

          <ModeParticles effect={activeTheme.effect} />

          <img
            src="/assets/images/thisbeatizbananazmainlogo copy.png"
            alt="ThisBeatIzBananaz"
            className="relative z-10 w-52 h-52 object-contain drop-shadow-[0_0_45px_rgba(var(--bananaz-accent-rgb),0.95)] animate-logo-burst"
          />

          <div className="absolute bottom-[22%] z-10 px-5 py-2 rounded-full bg-black/50 border border-[var(--bananaz-accent)] text-[var(--bananaz-accent)] font-display font-900 uppercase tracking-[0.24em] text-xs shadow-[0_0_28px_var(--bananaz-glow-mid)]">
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