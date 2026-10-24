
export interface BackgroundPalette {
  id: string;
  label: string;
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
  {
    id: 'default',
    label: 'Default',
    dark: true,
    bgPrimary: '#121316',
    bgSecondary: '#16171b',
    bgTertiary: '#1e2025',
    bgHover: 'rgba(255, 255, 255, 0.05)',
    border: 'rgba(255, 255, 255, 0.07)',
    textPrimary: '#ededed',
    textSecondary: '#9ca3af',
    textMuted: '#5e636e',
    toolbarBg: '#16171b',
    panelBg: '#121316',
    consoleBg: '#121316',
  },
  {
    id: 'graphene',
    label: 'Graphene (OLED)',
    dark: true,
    bgPrimary: '#0a0a0c',
    bgSecondary: '#0f1013',
    bgTertiary: '#17181d',
    bgHover: 'rgba(255, 255, 255, 0.04)',
    border: 'rgba(255, 255, 255, 0.06)',
    textPrimary: '#e5e7eb',
    textSecondary: '#9ca3af',
    textMuted: '#4b5563',
    toolbarBg: '#0f1013',
    panelBg: '#0a0a0c',
    consoleBg: '#0a0a0c',
  },
  {
    id: 'nord',
    label: 'Nord',
    dark: true,
    bgPrimary: '#2e3440',
    bgSecondary: '#242933',
    bgTertiary: '#3b4252',
    bgHover: 'rgba(236, 239, 244, 0.06)',
    border: 'rgba(216, 222, 233, 0.09)',
    textPrimary: '#eceff4',
    textSecondary: '#d8dee9',
    textMuted: '#7b88a1',
    toolbarBg: '#242933',
    panelBg: '#2e3440',
    consoleBg: '#2e3440',
  },
  {
    id: 'github',
    label: 'GitHub Dark',
    dark: true,
    bgPrimary: '#0d1117',
    bgSecondary: '#161b22',
    bgTertiary: '#21262d',
    bgHover: 'rgba(240, 246, 252, 0.05)',
    border: 'rgba(240, 246, 252, 0.08)',
    textPrimary: '#f0f6fc',
    textSecondary: '#8b949e',
    textMuted: '#6e7681',
    toolbarBg: '#161b22',
    panelBg: '#0d1117',
    consoleBg: '#0d1117',
  },
  {
    id: 'dracula',
    label: 'Dracula',
    dark: true,
    bgPrimary: '#282a36',
    bgSecondary: '#21222c',
    bgTertiary: '#343746',
    bgHover: 'rgba(248, 248, 242, 0.06)',
    border: 'rgba(248, 248, 242, 0.08)',
    textPrimary: '#f8f8f2',
    textSecondary: '#b9bbcf',
    textMuted: '#6272a4',
    toolbarBg: '#21222c',
    panelBg: '#282a36',
    consoleBg: '#282a36',
  },
  {
    id: 'onedark',
    label: 'One Dark',
    dark: true,
    bgPrimary: '#21252b',
    bgSecondary: '#1d2026',
    bgTertiary: '#2c313a',
    bgHover: 'rgba(171, 178, 191, 0.06)',
    border: 'rgba(171, 178, 191, 0.08)',
    textPrimary: '#abb2bf',
    textSecondary: '#828997',
    textMuted: '#5c6370',
    toolbarBg: '#1d2026',
    panelBg: '#21252b',
    consoleBg: '#21252b',
  },
  {
    id: 'light',
    label: 'Clean Light',
    dark: false,
    bgPrimary: '#ffffff',
    bgSecondary: '#f8f9fa',
    bgTertiary: '#f1f3f5',
    bgHover: 'rgba(0, 0, 0, 0.04)',
    border: 'rgba(0, 0, 0, 0.08)',
    textPrimary: '#1a1d20',
    textSecondary: '#5f6368',
    textMuted: '#80868b',
    toolbarBg: '#f8f9fa',
    panelBg: '#ffffff',
    consoleBg: '#ffffff',
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

export const systemTheme = (): 'light' | 'dark' =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

export function applyAppearance(paletteId: string, accentId: string) {
  const p = APP_PALETTES.find((x) => x.id === paletteId) ?? APP_PALETTES[0];
  const a = ACCENTS.find((x) => x.id === accentId) ?? ACCENTS[0];
  const root = document.documentElement;

  root.setAttribute('data-theme', p.dark ? 'dark' : 'light');
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
  const c = p.dark ? a.dark : a.light;
  root.style.setProperty('--accent-color', c);
  root.style.setProperty('--tab-border', c);
  root.style.setProperty('--accent-hover', `color-mix(in srgb, ${c} 85%, ${p.dark ? 'white' : 'black'})`);
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

export const EDITOR_FONT_SIZES = [
  { id: '10', value: 10, label: '10 px' },
  { id: '11', value: 11, label: '11 px' },
  { id: '12', value: 12, label: '12 px' },
  { id: '13', value: 13, label: '13 px' },
  { id: '14', value: 14, label: '14 px (Default)' },
  { id: '15', value: 15, label: '15 px' },
  { id: '16', value: 16, label: '16 px' },
  { id: '18', value: 18, label: '18 px' },
  { id: '20', value: 20, label: '20 px' },
  { id: '22', value: 22, label: '22 px' },
  { id: '24', value: 24, label: '24 px' },
] as const;
