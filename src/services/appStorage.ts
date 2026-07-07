export type BananazThemeName =
  | "gold"
  | "lava"
  | "neonGreen"
  | "purpleHaze"
  | "iceBlue"
  | "bloodRed"
  | "midnight"
  | "chrome"
  | "pinkGlow"
  | "toxic";

export type SocialHandles = {
  instagram: string;
  threads: string;
  youtube: string;
  facebook: string;
};

export type ProducerProfileState = {
  displayName: string;
  headline: string;
  sloganQuote: string;
  aboutProducer: string;
  bio: string;
  label: string;
  topFiveProducers: string[];
  favoriteProducers: string[];
  favoriteDaws: string[];
  partners: string;
  socials: SocialHandles;
  additionalInfo: string;
  showQrFooter: boolean;
};

export type LicensingInfoState = {
  beats: string;
  freeDownloads: string;
  producedBy: string;
};

export type ContactInfoState = {
  socials: SocialHandles;
  cashApp: string;
  paypal: string;
  additionalContact: string;
};

export type ManualSaleState = {
  id: string;
  beatId: string;
  beatName: string;
  price: number;
  buyerName: string;
  buyerEmail: string;
  notes: string;
  createdAt: string;
};

export type AdminSettingsState = {
  allowSubmissions: boolean;
  famzCount: number;
  bananazAppFamzCount: number;
  bananazAppSalesCount: number;
  lifetimePaidOrders: number;
  lifetimeRevenue: number;
  creditedOrderIds: string[];
  manualSales: ManualSaleState[];
  licensingInfo: LicensingInfoState;
  contactInfo: ContactInfoState;
};

export type BananazPaletteColor = {
  name: BananazThemeName;
  label: string;
  primary: string;
  secondary: string;
  glow: string;
  background: string;
};

export type BananazModeState = {
  enabled: boolean;
  selectedTheme: BananazThemeName;
  broadcastTitle: string;
  broadcastMessage: string;
  glowEnabled: boolean;
  animationsEnabled: boolean;
  updatedAt: string;
};

export type BananazAppState = {
  profile: ProducerProfileState;
  adminSettings: AdminSettingsState;
  bananazMode: BananazModeState;
};

const STORAGE_KEY = "thisbeatizbananaz.appState.v1";

export const BANANAZ_THEME_PALETTE: BananazPaletteColor[] = [
  {
    name: "gold",
    label: "Golden Cookup",
    primary: "#f5c518",
    secondary: "#ffef9a",
    glow: "rgba(245, 197, 24, 0.55)",
    background: "#050505",
  },
  {
    name: "lava",
    label: "Lava Stove",
    primary: "#ff5a1f",
    secondary: "#ffd166",
    glow: "rgba(255, 90, 31, 0.55)",
    background: "#0a0503",
  },
  {
    name: "neonGreen",
    label: "Toxic Bounce",
    primary: "#39ff14",
    secondary: "#ccff00",
    glow: "rgba(57, 255, 20, 0.5)",
    background: "#020802",
  },
  {
    name: "purpleHaze",
    label: "Purple Haze",
    primary: "#a855f7",
    secondary: "#f0abfc",
    glow: "rgba(168, 85, 247, 0.55)",
    background: "#080312",
  },
  {
    name: "iceBlue",
    label: "Icebox Blue",
    primary: "#38bdf8",
    secondary: "#bae6fd",
    glow: "rgba(56, 189, 248, 0.5)",
    background: "#020617",
  },
  {
    name: "bloodRed",
    label: "Red Alert",
    primary: "#ef4444",
    secondary: "#fecaca",
    glow: "rgba(239, 68, 68, 0.52)",
    background: "#0b0303",
  },
  {
    name: "midnight",
    label: "Midnight Knock",
    primary: "#6366f1",
    secondary: "#c4b5fd",
    glow: "rgba(99, 102, 241, 0.5)",
    background: "#030513",
  },
  {
    name: "chrome",
    label: "Chrome Plate",
    primary: "#e5e7eb",
    secondary: "#94a3b8",
    glow: "rgba(229, 231, 235, 0.42)",
    background: "#050505",
  },
  {
    name: "pinkGlow",
    label: "Pink Slip",
    primary: "#fb7185",
    secondary: "#fbcfe8",
    glow: "rgba(251, 113, 133, 0.5)",
    background: "#10030a",
  },
  {
    name: "toxic",
    label: "Radioactive Sauce",
    primary: "#d9f99d",
    secondary: "#84cc16",
    glow: "rgba(132, 204, 22, 0.5)",
    background: "#050806",
  },
];

const defaultSocials: SocialHandles = {
  instagram: "",
  threads: "",
  youtube: "",
  facebook: "",
};

export const defaultProducerProfile: ProducerProfileState = {
  displayName: "ThisBeatIzBananaz",
  headline: "",
  sloganQuote: "",
  aboutProducer: "",
  bio: "",
  label: "",
  topFiveProducers: [],
  favoriteProducers: [],
  favoriteDaws: [],
  partners: "",
  socials: { ...defaultSocials },
  additionalInfo: "",
  showQrFooter: true,
};

export const defaultLicensingInfo: LicensingInfoState = {
  beats:
    'Usable for all purposes. Must credit "prod. by ThisBeatIzBananaz" with song title/displays. Available for submissions.',
  freeDownloads:
    'Usable for all purposes. Must credit "prod. by ThisBeatIzBananaz" with song title/displays. Not available for submissions.',
  producedBy:
    'All songs are considered demos, even though they are singles. They showcase song-writing, production, arrangements & concepts of the producer. All rights reserved, Rawheart Waymakerz Music Group© 2025. Owned by ThisBeatIzBananaz™',
};

export const defaultContactInfo: ContactInfoState = {
  socials: { ...defaultSocials },
  cashApp: "",
  paypal: "",
  additionalContact: "",
};

export const defaultAdminSettings: AdminSettingsState = {
  allowSubmissions: true,
  famzCount: 11203,
  bananazAppFamzCount: 0,
  bananazAppSalesCount: 0,
  lifetimePaidOrders: 0,
  lifetimeRevenue: 0,
  creditedOrderIds: [],
  manualSales: [],
  licensingInfo: { ...defaultLicensingInfo },
  contactInfo: { ...defaultContactInfo, socials: { ...defaultSocials } },
};

export const defaultBananazMode: BananazModeState = {
  enabled: false,
  selectedTheme: "gold",
  broadcastTitle: "",
  broadcastMessage: "",
  glowEnabled: true,
  animationsEnabled: true,
  updatedAt: new Date(0).toISOString(),
};

export const defaultBananazAppState: BananazAppState = {
  profile: {
    ...defaultProducerProfile,
    socials: { ...defaultSocials },
  },
  adminSettings: {
    ...defaultAdminSettings,
    manualSales: [],
    licensingInfo: { ...defaultLicensingInfo },
    contactInfo: { ...defaultContactInfo, socials: { ...defaultSocials } },
  },
  bananazMode: { ...defaultBananazMode },
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function safeNumber(value: unknown, fallback = 0): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function safeBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function stripLicensingPrefix(value: string): string {
  return value
    .replace(/^Beats\s*-\s*/i, "")
    .replace(/^Free DL'?s\s*-\s*/i, "")
    .replace(/^Produced by\s*-\s*/i, "");
}

type CreditableOrderLike = {
  id: string;
  amount?: number | string | null;
  payment_received?: boolean | null;
  status?: string | null;
};

function safeSocials(value: unknown): SocialHandles {
  const maybeSocials = value && typeof value === "object" ? (value as Partial<SocialHandles>) : {};

  return {
    instagram: safeString(maybeSocials.instagram),
    threads: safeString(maybeSocials.threads),
    youtube: safeString(maybeSocials.youtube),
    facebook: safeString(maybeSocials.facebook),
  };
}

function safeManualSales(value: unknown): ManualSaleState[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((sale) => {
    const item = sale && typeof sale === "object" ? (sale as Partial<ManualSaleState>) : {};

    return {
      id: safeString(item.id) || crypto.randomUUID(),
      beatId: safeString(item.beatId),
      beatName: safeString(item.beatName),
      price: safeNumber(item.price),
      buyerName: safeString(item.buyerName),
      buyerEmail: safeString(item.buyerEmail),
      notes: safeString(item.notes),
      createdAt: safeString(item.createdAt) || new Date().toISOString(),
    };
  });
}

function normalizeThemeName(value: unknown): BananazThemeName {
  const found = BANANAZ_THEME_PALETTE.find((theme) => theme.name === value);
  return found ? found.name : defaultBananazMode.selectedTheme;
}

function normalizeProfile(value: unknown): ProducerProfileState {
  const profile = value && typeof value === "object" ? (value as Partial<ProducerProfileState>) : {};

  return {
    displayName: safeString(profile.displayName) || defaultProducerProfile.displayName,
    headline: safeString(profile.headline),
    sloganQuote: safeString(profile.sloganQuote),
    aboutProducer: safeString(profile.aboutProducer),
    bio: safeString(profile.bio),
    label: safeString(profile.label),
    topFiveProducers: safeStringArray(profile.topFiveProducers),
    favoriteProducers: safeStringArray(profile.favoriteProducers),
    favoriteDaws: safeStringArray(profile.favoriteDaws),
    partners: safeString(profile.partners),
    socials: safeSocials(profile.socials),
    additionalInfo: safeString(profile.additionalInfo),
    showQrFooter: safeBoolean(profile.showQrFooter, true),
  };
}

function normalizeLicensingInfo(value: unknown): LicensingInfoState {
  const licensing = value && typeof value === "object" ? (value as Partial<LicensingInfoState>) : {};

  return {
    beats: stripLicensingPrefix(safeString(licensing.beats) || defaultLicensingInfo.beats),
    freeDownloads: stripLicensingPrefix(safeString(licensing.freeDownloads) || defaultLicensingInfo.freeDownloads),
    producedBy: stripLicensingPrefix(safeString(licensing.producedBy) || defaultLicensingInfo.producedBy),
  };
}

function normalizeContactInfo(value: unknown): ContactInfoState {
  const contact = value && typeof value === "object" ? (value as Partial<ContactInfoState>) : {};

  return {
    socials: safeSocials(contact.socials),
    cashApp: safeString(contact.cashApp),
    paypal: safeString(contact.paypal),
    additionalContact: safeString(contact.additionalContact),
  };
}

function normalizeAdminSettings(value: unknown): AdminSettingsState {
  const settings = value && typeof value === "object" ? (value as Partial<AdminSettingsState>) : {};

  return {
    allowSubmissions: safeBoolean(settings.allowSubmissions, true),
    famzCount: safeNumber(settings.famzCount, 11203),
    bananazAppFamzCount: safeNumber(settings.bananazAppFamzCount),
    bananazAppSalesCount: safeNumber(settings.bananazAppSalesCount),
    lifetimePaidOrders: safeNumber(settings.lifetimePaidOrders),
    lifetimeRevenue: safeNumber(settings.lifetimeRevenue),
    creditedOrderIds: safeStringArray(settings.creditedOrderIds),
    manualSales: safeManualSales(settings.manualSales),
    licensingInfo: normalizeLicensingInfo(settings.licensingInfo),
    contactInfo: normalizeContactInfo(settings.contactInfo),
  };
}

function normalizeBananazMode(value: unknown): BananazModeState {
  const mode = value && typeof value === "object" ? (value as Partial<BananazModeState>) : {};

  return {
    enabled: safeBoolean(mode.enabled),
    selectedTheme: normalizeThemeName(mode.selectedTheme),
    broadcastTitle: safeString(mode.broadcastTitle),
    broadcastMessage: safeString(mode.broadcastMessage),
    glowEnabled: safeBoolean(mode.glowEnabled, true),
    animationsEnabled: safeBoolean(mode.animationsEnabled, true),
    updatedAt: safeString(mode.updatedAt) || new Date(0).toISOString(),
  };
}

function normalizeAppState(value: unknown): BananazAppState {
  const state = value && typeof value === "object" ? (value as Partial<BananazAppState>) : {};

  return {
    profile: normalizeProfile(state.profile),
    adminSettings: normalizeAdminSettings(state.adminSettings),
    bananazMode: normalizeBananazMode(state.bananazMode),
  };
}

function readAppState(): BananazAppState {
  if (!isBrowser()) {
    return normalizeAppState(defaultBananazAppState);
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return normalizeAppState(defaultBananazAppState);
    }

    return normalizeAppState(JSON.parse(raw));
  } catch {
    return normalizeAppState(defaultBananazAppState);
  }
}

function writeAppState(nextState: BananazAppState): BananazAppState {
  const normalized = normalizeAppState(nextState);

  if (isBrowser()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(
      new CustomEvent<BananazAppState>("bananaz-app-storage:update", {
        detail: normalized,
      }),
    );
  }

  return normalized;
}

function updateAppState(updater: (current: BananazAppState) => BananazAppState): BananazAppState {
  const current = readAppState();
  return writeAppState(updater(current));
}

export const appStorage = {
  storageKey: STORAGE_KEY,

  getState(): BananazAppState {
    return readAppState();
  },

  saveState(state: BananazAppState): BananazAppState {
    return writeAppState(state);
  },

  resetState(): BananazAppState {
    return writeAppState(defaultBananazAppState);
  },

  getProfile(): ProducerProfileState {
    return readAppState().profile;
  },

  saveProfile(profile: ProducerProfileState): ProducerProfileState {
    return updateAppState((current) => ({
      ...current,
      profile: normalizeProfile(profile),
    })).profile;
  },

  getAdminSettings(): AdminSettingsState {
    return readAppState().adminSettings;
  },

  saveAdminSettings(adminSettings: AdminSettingsState): AdminSettingsState {
    return updateAppState((current) => ({
      ...current,
      adminSettings: normalizeAdminSettings(adminSettings),
    })).adminSettings;
  },

  getBananazMode(): BananazModeState {
    return readAppState().bananazMode;
  },

  saveBananazMode(bananazMode: BananazModeState): BananazModeState {
    return updateAppState((current) => ({
      ...current,
      bananazMode: normalizeBananazMode({
        ...bananazMode,
        updatedAt: new Date().toISOString(),
      }),
    })).bananazMode;
  },

  getThemePalette(): BananazPaletteColor[] {
    return BANANAZ_THEME_PALETTE;
  },

  getTheme(name: BananazThemeName): BananazPaletteColor {
    return (
      BANANAZ_THEME_PALETTE.find((theme) => theme.name === name) ||
      BANANAZ_THEME_PALETTE[0]
    );
  },

  addManualSale(sale: Omit<ManualSaleState, "id" | "createdAt">): ManualSaleState {
    const newSale: ManualSaleState = {
      ...sale,
      id: crypto.randomUUID(),
      price: safeNumber(sale.price),
      createdAt: new Date().toISOString(),
    };

    updateAppState((current) => ({
      ...current,
      adminSettings: {
        ...current.adminSettings,
        bananazAppSalesCount: current.adminSettings.bananazAppSalesCount + 1,
        lifetimePaidOrders: current.adminSettings.lifetimePaidOrders + 1,
        lifetimeRevenue: current.adminSettings.lifetimeRevenue + safeNumber(sale.price),
        manualSales: [newSale, ...current.adminSettings.manualSales].slice(0, 4),
      },
    }));

    return newSale;
  },

  removeManualSale(id: string): void {
    updateAppState((current) => ({
      ...current,
      adminSettings: {
        ...current.adminSettings,
        manualSales: current.adminSettings.manualSales.filter((sale) => sale.id !== id),
      },
    }));
  },

  syncPaidOrderStats(orders: CreditableOrderLike[]): AdminSettingsState {
    return updateAppState((current) => {
      const creditedIds = new Set(current.adminSettings.creditedOrderIds);
      let addedOrders = 0;
      let addedRevenue = 0;

      for (const order of orders) {
        const id = safeString(order.id);
        const isPaid = Boolean(order.payment_received) || order.status === "Sold" || order.status === "Released";

        if (!id || !isPaid || creditedIds.has(id)) {
          continue;
        }

        creditedIds.add(id);
        addedOrders += 1;
        addedRevenue += safeNumber(order.amount);
      }

      if (addedOrders === 0 && addedRevenue === 0) {
        return current;
      }

      return {
        ...current,
        adminSettings: {
          ...current.adminSettings,
          lifetimePaidOrders: current.adminSettings.lifetimePaidOrders + addedOrders,
          lifetimeRevenue: current.adminSettings.lifetimeRevenue + addedRevenue,
          creditedOrderIds: Array.from(creditedIds),
        },
      };
    }).adminSettings;
  },

  exportState(): string {
    return JSON.stringify(readAppState(), null, 2);
  },

  importState(rawState: string): BananazAppState {
    return writeAppState(JSON.parse(rawState));
  },
};

