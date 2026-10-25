export interface BackgroundPalette {
  id: string;
  family: string;
  label: string;
  variantLabel: string;
  dark: boolean;
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgHover: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  toolbarBg: string;
  panelBg: string;
  consoleBg: string;
}

export const APP_PALETTES: BackgroundPalette[] = [
  // 1. Catppuccin (Mocha & Latte)
  {
    id: 'catppuccin-dark',
    family: 'catppuccin',
    label: 'Catppuccin',
    variantLabel: 'Catppuccin Mocha',
    dark: true,
    bgPrimary: '#1e1e2e',
    bgSecondary: '#181825',
    bgTertiary: '#313244',
    bgHover: 'rgba(205, 214, 244, 0.06)',
    border: 'rgba(205, 214, 244, 0.05)',
    textPrimary: '#cdd6f4',
    textSecondary: '#a6adc8',
    textMuted: '#6c7086',
    toolbarBg: '#181825',
    panelBg: '#1e1e2e',
    consoleBg: '#181825',
  },
  {
    id: 'catppuccin-light',
    family: 'catppuccin',
    label: 'Catppuccin',
    variantLabel: 'Catppuccin Latte',
    dark: false,
    bgPrimary: '#eff1f5',
    bgSecondary: '#e6e9ef',
    bgTertiary: '#ccd0da',
    bgHover: 'rgba(76, 79, 105, 0.05)',
    border: 'rgba(76, 79, 105, 0.06)',
    textPrimary: '#4c4f69',
    textSecondary: '#6c6f85',
    textMuted: '#9ca0b0',
    toolbarBg: '#e6e9ef',
    panelBg: '#eff1f5',
    consoleBg: '#e6e9ef',
  },

  // 2. Atom One / One Dark (One Dark Pro & Atom One Light)
  {
    id: 'onedark-dark',
    family: 'onedark',
    label: 'Atom One / One Dark',
    variantLabel: 'One Dark Pro',
    dark: true,
    bgPrimary: '#282c34',
    bgSecondary: '#21252b',
    bgTertiary: '#2c313a',
    bgHover: 'rgba(171, 178, 191, 0.06)',
    border: 'rgba(171, 178, 191, 0.05)',
    textPrimary: '#abb2bf',
    textSecondary: '#828997',
    textMuted: '#5c6370',
    toolbarBg: '#21252b',
    panelBg: '#282c34',
    consoleBg: '#21252b',
  },
  {
    id: 'onedark-light',
    family: 'onedark',
    label: 'Atom One / One Dark',
    variantLabel: 'Atom One Light',
    dark: false,
    bgPrimary: '#fafafa',
    bgSecondary: '#f0f0f1',
    bgTertiary: '#e5e5e6',
    bgHover: 'rgba(56, 58, 66, 0.05)',
    border: 'rgba(56, 58, 66, 0.06)',
    textPrimary: '#383a42',
    textSecondary: '#696c77',
    textMuted: '#a0a1a7',
    toolbarBg: '#f0f0f1',
    panelBg: '#fafafa',
    consoleBg: '#f0f0f1',
  },

  // 3. Shades of Purple (Super Dark & Light)
  {
    id: 'shades-of-purple-dark',
    family: 'shades-of-purple',
    label: 'Shades of Purple',
    variantLabel: 'Shades of Purple (Super Dark)',
    dark: true,
    bgPrimary: '#1e1e3f',
    bgSecondary: '#16162f',
    bgTertiary: '#2d2b55',
    bgHover: 'rgba(165, 153, 233, 0.08)',
    border: 'rgba(165, 153, 233, 0.06)',
    textPrimary: '#ffffff',
    textSecondary: '#a599e9',
    textMuted: '#b362ff',
    toolbarBg: '#16162f',
    panelBg: '#1e1e3f',
    consoleBg: '#16162f',
  },
  {
    id: 'shades-of-purple-light',
    family: 'shades-of-purple',
    label: 'Shades of Purple',
    variantLabel: 'Shades of Purple (Light)',
    dark: false,
    bgPrimary: '#faf8ff',
    bgSecondary: '#f3f0fc',
    bgTertiary: '#e8e2f8',
    bgHover: 'rgba(45, 43, 85, 0.05)',
    border: 'rgba(45, 43, 85, 0.06)',
    textPrimary: '#2d2b55',
    textSecondary: '#6c5b9c',
    textMuted: '#8b7ab8',
    toolbarBg: '#f3f0fc',
    panelBg: '#faf8ff',
    consoleBg: '#f3f0fc',
  },

  // 4. Tokyo Night (Tokyo Night & Tokyo Night Day)
  {
    id: 'tokyo-night-dark',
    family: 'tokyo-night',
    label: 'Tokyo Night',
    variantLabel: 'Tokyo Night',
    dark: true,
    bgPrimary: '#1a1b26',
    bgSecondary: '#16161e',
    bgTertiary: '#24283b',
    bgHover: 'rgba(192, 202, 245, 0.06)',
    border: 'rgba(192, 202, 245, 0.05)',
    textPrimary: '#c0caf5',
    textSecondary: '#a9b1d6',
    textMuted: '#565f89',
    toolbarBg: '#16161e',
    panelBg: '#1a1b26',
    consoleBg: '#16161e',
  },
  {
    id: 'tokyo-night-light',
    family: 'tokyo-night',
    label: 'Tokyo Night',
    variantLabel: 'Tokyo Night Day',
    dark: false,
    bgPrimary: '#e1e2e7',
    bgSecondary: '#d5d6db',
    bgTertiary: '#c4c8da',
    bgHover: 'rgba(52, 59, 88, 0.05)',
    border: 'rgba(52, 59, 88, 0.06)',
    textPrimary: '#343b58',
    textSecondary: '#565f89',
    textMuted: '#848cb5',
    toolbarBg: '#d5d6db',
    panelBg: '#e1e2e7',
    consoleBg: '#d5d6db',
  },

  // 5. Ayu (Ayu Dark & Ayu Light)
  {
    id: 'ayu-dark',
    family: 'ayu',
    label: 'Ayu',
    variantLabel: 'Ayu Dark',
    dark: true,
    bgPrimary: '#0d1017',
    bgSecondary: '#080b10',
    bgTertiary: '#131721',
    bgHover: 'rgba(191, 204, 223, 0.05)',
    border: 'rgba(191, 204, 223, 0.05)',
    textPrimary: '#bfccdf',
    textSecondary: '#738299',
    textMuted: '#5a6673',
    toolbarBg: '#080b10',
    panelBg: '#0d1017',
    consoleBg: '#080b10',
  },
  {
    id: 'ayu-light',
    family: 'ayu',
    label: 'Ayu',
    variantLabel: 'Ayu Light',
    dark: false,
    bgPrimary: '#fcfcfc',
    bgSecondary: '#f3f4f5',
    bgTertiary: '#e6e8eb',
    bgHover: 'rgba(92, 97, 102, 0.05)',
    border: 'rgba(92, 97, 102, 0.06)',
    textPrimary: '#5c6166',
    textSecondary: '#828c99',
    textMuted: '#a0a6ad',
    toolbarBg: '#f3f4f5',
    panelBg: '#fcfcfc',
    consoleBg: '#f3f4f5',
  },

  // 6. Gruvbox Material (Dark Medium & Light Medium)
  {
    id: 'gruvbox-dark',
    family: 'gruvbox',
    label: 'Gruvbox Material',
    variantLabel: 'Gruvbox Material Dark',
    dark: true,
    bgPrimary: '#282828',
    bgSecondary: '#1d2021',
    bgTertiary: '#32302f',
    bgHover: 'rgba(223, 191, 142, 0.06)',
    border: 'rgba(223, 191, 142, 0.05)',
    textPrimary: '#dfbf8e',
    textSecondary: '#a89984',
    textMuted: '#7c6f64',
    toolbarBg: '#1d2021',
    panelBg: '#282828',
    consoleBg: '#1d2021',
  },
  {
    id: 'gruvbox-light',
    family: 'gruvbox',
    label: 'Gruvbox Material',
    variantLabel: 'Gruvbox Material Light',
    dark: false,
    bgPrimary: '#fbf1c7',
    bgSecondary: '#f2e5bc',
    bgTertiary: '#ebdbb2',
    bgHover: 'rgba(101, 71, 53, 0.05)',
    border: 'rgba(101, 71, 53, 0.06)',
    textPrimary: '#654735',
    textSecondary: '#7c6f64',
    textMuted: '#928374',
    toolbarBg: '#f2e5bc',
    panelBg: '#fbf1c7',
    consoleBg: '#f2e5bc',
  },

  // 7. GitHub Theme (GitHub Dark Default & GitHub Light Default)
  {
    id: 'github-dark',
    family: 'github',
    label: 'GitHub Theme',
    variantLabel: 'GitHub Dark Default',
    dark: true,
    bgPrimary: '#0d1117',
    bgSecondary: '#161b22',
    bgTertiary: '#21262d',
    bgHover: 'rgba(230, 237, 243, 0.06)',
    border: 'rgba(230, 237, 243, 0.05)',
    textPrimary: '#e6edf3',
    textSecondary: '#8b949e',
    textMuted: '#6e7681',
    toolbarBg: '#161b22',
    panelBg: '#0d1117',
    consoleBg: '#0d1117',
  },
  {
    id: 'github-light',
    family: 'github',
    label: 'GitHub Theme',
    variantLabel: 'GitHub Light Default',
    dark: false,
    bgPrimary: '#ffffff',
    bgSecondary: '#f6f8fa',
    bgTertiary: '#eaeef2',
    bgHover: 'rgba(31, 35, 40, 0.05)',
    border: 'rgba(31, 35, 40, 0.06)',
    textPrimary: '#1f2328',
    textSecondary: '#656d76',
    textMuted: '#8c959f',
    toolbarBg: '#f6f8fa',
    panelBg: '#ffffff',
    consoleBg: '#f6f8fa',
  },

  // 8. Solarized (Solarized Dark & Solarized Light)
  {
    id: 'solarized-dark',
    family: 'solarized',
    label: 'Solarized',
    variantLabel: 'Solarized Dark',
    dark: true,
    bgPrimary: '#002b36',
    bgSecondary: '#073642',
    bgTertiary: '#094250',
    bgHover: 'rgba(131, 148, 150, 0.08)',
    border: 'rgba(131, 148, 150, 0.07)',
    textPrimary: '#839496',
    textSecondary: '#93a1a1',
    textMuted: '#586e75',
    toolbarBg: '#073642',
    panelBg: '#002b36',
    consoleBg: '#073642',
  },
  {
    id: 'solarized-light',
    family: 'solarized',
    label: 'Solarized',
    variantLabel: 'Solarized Light',
    dark: false,
    bgPrimary: '#fdf6e3',
    bgSecondary: '#eee8d5',
    bgTertiary: '#e4dcba',
    bgHover: 'rgba(101, 123, 131, 0.08)',
    border: 'rgba(101, 123, 131, 0.07)',
    textPrimary: '#657b83',
    textSecondary: '#586e75',
    textMuted: '#93a1a1',
    toolbarBg: '#eee8d5',
    panelBg: '#fdf6e3',
    consoleBg: '#eee8d5',
  },
];

export const ACCENTS = [
  { id: 'blue', label: 'CoolSolve Blue', dark: '#4f86f7', light: '#2563eb' },
  { id: 'steel', label: 'Steel', dark: '#8196ad', light: '#4f6479' },
  { id: 'teal', label: 'Teal', dark: '#38bdf8', light: '#0284c7' },
  { id: 'sage', label: 'Sage', dark: '#34d399', light: '#059669' },
  { id: 'mauve', label: 'Mauve', dark: '#a78bfa', light: '#7c3aed' },
  { id: 'amber', label: 'Amber', dark: '#fbbf24', light: '#d97706' },
  { id: 'rose', label: 'Rose', dark: '#fb7185', light: '#e11d48' },
] as const;

export type AccentId = (typeof ACCENTS)[number]['id'];
export type ThemeMode = 'light' | 'dark' | 'system';

export const systemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export function normalizePaletteFamily(choice: string): string {
  const base = (choice || 'catppuccin').replace(/-(dark|light)$/, '');
  const legacy: Record<string, string> = {
    default: 'onedark', graphene: 'onedark', light: 'onedark', classic: 'onedark',
    atom: 'onedark', 'atom-app': 'onedark', nord: 'tokyo-night', dracula: 'shades-of-purple',
  };
  return legacy[base] ?? base;
}

export function getPalette(paletteId: string, mode: 'light' | 'dark'): BackgroundPalette {
  const isDark = mode === 'dark';
  const family = normalizePaletteFamily(paletteId);

  // Explicit id wins (a light request for catppuccin-light must stay light).
  let found = APP_PALETTES.find((p) => p.id === paletteId);
  if (!found) found = APP_PALETTES.find((p) => p.id === `${family}-${mode}`);
  if (!found) found = APP_PALETTES.find((p) => p.family === family && p.dark === isDark);
  if (!found) {
    found = APP_PALETTES.find((p) => p.dark === isDark) ?? APP_PALETTES[0];
  }
  return found;
}

export function applyAppearance(paletteId: string, accentId: string, mode: 'light' | 'dark' = 'dark') {
  const p = getPalette(paletteId, mode);
  const a = ACCENTS.find((x) => x.id === accentId) ?? ACCENTS[0];
  const root = document.documentElement;

  root.setAttribute('data-theme', mode);
  root.setAttribute('data-palette', p.id);
  root.style.setProperty('--bg-primary', p.bgPrimary);
  root.style.setProperty('--bg-secondary', p.bgSecondary);
  root.style.setProperty('--bg-tertiary', p.bgTertiary);
  root.style.setProperty('--bg-hover', p.bgHover);
  root.style.setProperty('--border-color', p.border);
  root.style.setProperty('--toolbar-bg', p.toolbarBg);
  root.style.setProperty('--panel-bg', p.panelBg);
  root.style.setProperty('--console-bg', p.consoleBg);
  root.style.setProperty('--text-primary', p.textPrimary);
  root.style.setProperty('--text-secondary', p.textSecondary);
  root.style.setProperty('--text-muted', p.textMuted);
  root.style.setProperty('--console-text', p.textPrimary);
  const c = mode === 'dark' ? a.dark : a.light;
  root.style.setProperty('--accent-color', c);
  root.style.setProperty('--tab-border', c);
  root.style.setProperty('--accent-hover', `color-mix(in srgb, ${c} 85%, ${mode === 'dark' ? 'white' : 'black'})`);
}

export const EDITOR_FONTS = [
  { id: 'consolas', label: 'Consolas (Windows default)', css: "Consolas, 'Courier New', monospace" },
  { id: 'cascadia', label: 'Cascadia Code', css: "'Cascadia Code', Consolas, 'Courier New', monospace" },
  { id: 'jetbrains', label: 'JetBrains Mono', css: "'JetBrains Mono', Consolas, 'Courier New', monospace" },
  { id: 'fira', label: 'Fira Code', css: "'Fira Code', Consolas, 'Courier New', monospace" },
  { id: 'lucida', label: 'Lucida Console', css: "'Lucida Console', 'Courier New', monospace" },
  { id: 'courier', label: 'Courier New', css: "'Courier New', monospace" },
  { id: 'menlo', label: 'Menlo / SF Mono (macOS)', css: "'SF Mono', Menlo, Consolas, monospace" },
  { id: 'system', label: 'System monospace', css: 'monospace' },
] as const;

export const fontCss = (id: string) => (EDITOR_FONTS.find((f) => f.id === id) ?? EDITOR_FONTS[0]).css;

export const DEFAULT_EDITOR_FONT_SIZE = 14;

export const STANDARD_FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24] as const;

export const EDITOR_FONT_SIZES = STANDARD_FONT_SIZES.map((value) => ({
  id: String(value),
  value,
  label: value === DEFAULT_EDITOR_FONT_SIZE ? `${value} px (Default)` : `${value} px`,
})) as readonly { id: string; value: number; label: string }[];
