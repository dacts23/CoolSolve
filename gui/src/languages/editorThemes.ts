import type * as Monaco from 'monaco-editor';
import { APP_PALETTES, normalizePaletteFamily } from '../utils/appearance.ts';

export type Syntax = {
  comment: string;
  string: string;
  number: string;
  keyword: string;
  directive: string;
  type: string;
  predefined: string;
  identifier: string;
  operator: string;
};

export interface EditorPalette extends Syntax {
  id: string;
  family: string;
  label: string;
  variantLabel: string;
  dark: boolean;
  bg: string;
  fg: string;
  sel: string;
  line: string;
  gutter: string;
  cursor: string;
}

export const EDITOR_THEMES: EditorPalette[] = [
  // 1. Catppuccin (Mocha & Latte)
  {
    id: 'catppuccin-dark', family: 'catppuccin', label: 'Catppuccin', variantLabel: 'Catppuccin Mocha', dark: true,
    bg: '#1e1e2e', fg: '#cdd6f4', sel: '#45475a', line: '#31324466', gutter: '#6c7086', cursor: '#f5e0dc',
    comment: '#6c7086', string: '#a6e3a1', number: '#fab387', keyword: '#cba6f7', directive: '#f5c2e7',
    type: '#f9e2af', predefined: '#89b4fa', identifier: '#cdd6f4', operator: '#89dceb',
  },
  {
    id: 'catppuccin-light', family: 'catppuccin', label: 'Catppuccin', variantLabel: 'Catppuccin Latte', dark: false,
    bg: '#eff1f5', fg: '#4c4f69', sel: '#ccd0da', line: '#e6e9ef', gutter: '#9ca0b0', cursor: '#dc8a78',
    comment: '#9ca0b0', string: '#40a02b', number: '#fe640b', keyword: '#8839ef', directive: '#ea76cb',
    type: '#df8e1d', predefined: '#1e66f5', identifier: '#4c4f69', operator: '#04a5e5',
  },

  // 2. Atom One / One Dark (One Dark Pro & Atom One Light)
  {
    id: 'onedark-dark', family: 'onedark', label: 'Atom One / One Dark', variantLabel: 'One Dark Pro', dark: true,
    bg: '#282c34', fg: '#abb2bf', sel: '#3e4451', line: '#2c313c', gutter: '#6f6f6f', cursor: '#528bff',
    comment: '#5c6370', string: '#98c379', number: '#d19a66', keyword: '#c678dd', directive: '#56b6c2',
    type: '#e5c07b', predefined: '#61afef', identifier: '#abb2bf', operator: '#56b6c2',
  },
  {
    id: 'onedark-light', family: 'onedark', label: 'Atom One / One Dark', variantLabel: 'Atom One Light', dark: false,
    bg: '#fafafa', fg: '#383a42', sel: '#e5e5e6', line: '#f0f0f1', gutter: '#9d9d9f', cursor: '#526fff',
    comment: '#a0a1a7', string: '#50a14f', number: '#986801', keyword: '#a626a4', directive: '#0184bc',
    type: '#c18401', predefined: '#4078f2', identifier: '#383a42', operator: '#0184bc',
  },

  // 3. Shades of Purple (Super Dark & Light)
  {
    id: 'shades-of-purple-dark', family: 'shades-of-purple', label: 'Shades of Purple', variantLabel: 'Shades of Purple (Super Dark)', dark: true,
    bg: '#1e1e3f', fg: '#a599e9', sel: '#5a3e85', line: '#16162f', gutter: '#4d4677', cursor: '#fad000',
    comment: '#b362ff', string: '#a5ff90', number: '#ff628c', keyword: '#ff9d00', directive: '#fad000',
    type: '#ff628c', predefined: '#fb94ff', identifier: '#9effff', operator: '#ff9d00',
  },
  {
    id: 'shades-of-purple-light', family: 'shades-of-purple', label: 'Shades of Purple', variantLabel: 'Shades of Purple (Light)', dark: false,
    bg: '#faf8ff', fg: '#2d2b55', sel: '#e1d8f7', line: '#f3eefc', gutter: '#8b7ab8', cursor: '#d97706',
    comment: '#7e57c2', string: '#2e7d32', number: '#c2185b', keyword: '#e65100', directive: '#d97706',
    type: '#c2185b', predefined: '#6a1b9a', identifier: '#00695c', operator: '#e65100',
  },

  // 4. Tokyo Night (Tokyo Night & Tokyo Night Day)
  {
    id: 'tokyo-night-dark', family: 'tokyo-night', label: 'Tokyo Night', variantLabel: 'Tokyo Night', dark: true,
    bg: '#1a1b26', fg: '#c0caf5', sel: '#33467c', line: '#202233', gutter: '#3b4261', cursor: '#c0caf5',
    comment: '#565f89', string: '#9ece6a', number: '#ff9e64', keyword: '#bb9af7', directive: '#7dcfff',
    type: '#e0af68', predefined: '#7aa2f7', identifier: '#c0caf5', operator: '#89ddff',
  },
  {
    id: 'tokyo-night-light', family: 'tokyo-night', label: 'Tokyo Night', variantLabel: 'Tokyo Night Day', dark: false,
    bg: '#e1e2e7', fg: '#343b58', sel: '#b7c1e3', line: '#d5d6db', gutter: '#848cb5', cursor: '#3760bf',
    comment: '#6c6e75', string: '#385f0d', number: '#965027', keyword: '#5a3e8e', directive: '#0f4b6e',
    type: '#8f5e15', predefined: '#2e58a6', identifier: '#343b58', operator: '#006a83',
  },

  // 5. Ayu (Ayu Dark & Ayu Light)
  {
    id: 'ayu-dark', family: 'ayu', label: 'Ayu', variantLabel: 'Ayu Dark', dark: true,
    bg: '#0d1017', fg: '#bfccdf', sel: '#273747', line: '#131721', gutter: '#3e4b59', cursor: '#e6b450',
    comment: '#5a6673', string: '#aad94c', number: '#d2a6ff', keyword: '#ff8f40', directive: '#ffb454',
    type: '#ffb454', predefined: '#59c2ff', identifier: '#bfccdf', operator: '#f29668',
  },
  {
    id: 'ayu-light', family: 'ayu', label: 'Ayu', variantLabel: 'Ayu Light', dark: false,
    bg: '#fcfcfc', fg: '#5c6166', sel: '#e7e8e9', line: '#f3f4f5', gutter: '#828c99', cursor: '#ffaa33',
    comment: '#787b80', string: '#86b300', number: '#a37acc', keyword: '#fa8d3e', directive: '#f2ae49',
    type: '#f2ae49', predefined: '#399ee6', identifier: '#5c6166', operator: '#ed9366',
  },

  // 6. Gruvbox Material (Dark Medium & Light Medium)
  {
    id: 'gruvbox-dark', family: 'gruvbox', label: 'Gruvbox Material', variantLabel: 'Gruvbox Material Dark', dark: true,
    bg: '#282828', fg: '#dfbf8e', sel: '#504945', line: '#32302f', gutter: '#7c6f64', cursor: '#d4be98',
    comment: '#928374', string: '#a9b665', number: '#d3869b', keyword: '#ea6962', directive: '#e78a4e',
    type: '#e78a4e', predefined: '#7daea3', identifier: '#d4be98', operator: '#89b482',
  },
  {
    id: 'gruvbox-light', family: 'gruvbox', label: 'Gruvbox Material', variantLabel: 'Gruvbox Material Light', dark: false,
    bg: '#fbf1c7', fg: '#654735', sel: '#ebdbb2', line: '#f2e5bc', gutter: '#928374', cursor: '#654735',
    comment: '#a89984', string: '#6c782e', number: '#945e80', keyword: '#c14a4a', directive: '#c35e0a',
    type: '#c35e0a', predefined: '#45707a', identifier: '#654735', operator: '#4c7a5d',
  },

  // 7. GitHub Theme (GitHub Dark Default & GitHub Light Default)
  {
    id: 'github-dark', family: 'github', label: 'GitHub Theme', variantLabel: 'GitHub Dark Default', dark: true,
    bg: '#0d1117', fg: '#e6edf3', sel: '#264f78', line: '#161b22', gutter: '#6e7681', cursor: '#2f81f7',
    comment: '#8b949e', string: '#a5d6ff', number: '#79c0ff', keyword: '#ff7b72', directive: '#ffa657',
    type: '#ffa657', predefined: '#d2a8ff', identifier: '#e6edf3', operator: '#ff7b72',
  },
  {
    id: 'github-light', family: 'github', label: 'GitHub Theme', variantLabel: 'GitHub Light Default', dark: false,
    bg: '#ffffff', fg: '#1f2328', sel: '#b6e3ff', line: '#f6f8fa', gutter: '#8c959f', cursor: '#0969da',
    comment: '#6e7781', string: '#0a3069', number: '#0550ae', keyword: '#cf222e', directive: '#953800',
    type: '#953800', predefined: '#8250df', identifier: '#1f2328', operator: '#cf222e',
  },

  // 8. Solarized (Solarized Dark & Solarized Light)
  {
    id: 'solarized-dark', family: 'solarized', label: 'Solarized', variantLabel: 'Solarized Dark', dark: true,
    bg: '#002b36', fg: '#839496', sel: '#073642', line: '#073642', gutter: '#586e75', cursor: '#839496',
    comment: '#586e75', string: '#2aa198', number: '#d33682', keyword: '#859900', directive: '#cb4b16',
    type: '#b58900', predefined: '#268bd2', identifier: '#839496', operator: '#859900',
  },
  {
    id: 'solarized-light', family: 'solarized', label: 'Solarized', variantLabel: 'Solarized Light', dark: false,
    bg: '#fdf6e3', fg: '#657b83', sel: '#eee8d5', line: '#eee8d5', gutter: '#93a1a1', cursor: '#657b83',
    comment: '#93a1a1', string: '#2aa198', number: '#d33682', keyword: '#859900', directive: '#cb4b16',
    type: '#b58900', predefined: '#268bd2', identifier: '#657b83', operator: '#859900',
  },
];

export const THEME_CHOICES = [
  { id: 'catppuccin', label: 'Catppuccin' },
  { id: 'onedark', label: 'Atom One / One Dark' },
  { id: 'shades-of-purple', label: 'Shades of Purple' },
  { id: 'tokyo-night', label: 'Tokyo Night' },
  { id: 'ayu', label: 'Ayu' },
  { id: 'gruvbox', label: 'Gruvbox Material' },
  { id: 'github', label: 'GitHub Theme' },
  { id: 'solarized', label: 'Solarized' },
] as const;

export const EDITOR_THEME_CHOICES = THEME_CHOICES;

function normalizeFamily(choice: string): string {
  const base = normalizePaletteFamily(choice);
  return THEME_CHOICES.some((t) => t.id === base) ? base : 'catppuccin';
}

export function resolveEditorTheme(
  choice: string,
  appTheme: 'light' | 'dark',
  forceAppBg = false,
  paletteId = 'catppuccin'
): string {
  const mode = appTheme === 'light' ? 'light' : 'dark';
  const family = normalizeFamily(choice);
  const candidate = `${family}-${mode}`;
  const themeId = EDITOR_THEMES.some((t) => t.id === candidate)
    ? candidate
    : (mode === 'dark' ? 'catppuccin-dark' : 'catppuccin-light');

  if (!forceAppBg) {
    return `coolsolve-${themeId}`;
  }
  const cleanPal = normalizeFamily(paletteId);
  const palCandidate = `${cleanPal}-${mode}`;
  const validPal = APP_PALETTES.some((p) => p.id === palCandidate)
    ? palCandidate
    : (mode === 'light' ? 'catppuccin-light' : 'catppuccin-dark');
  return `coolsolve-${themeId}-appbg-${validPal}`;
}

export function getActiveEditorBg(
  choice: string,
  appTheme: 'light' | 'dark',
  forceAppBg = false,
  paletteId = 'catppuccin'
): string {
  const mode = appTheme === 'light' ? 'light' : 'dark';
  if (forceAppBg) {
    const cleanPal = normalizeFamily(paletteId);
    const pal = APP_PALETTES.find((p) => p.id === `${cleanPal}-${mode}`);
    if (pal) return pal.bgPrimary;
    return mode === 'dark' ? '#1e1e2e' : '#eff1f5';
  }
  const family = normalizeFamily(choice);
  const candidate = `${family}-${mode}`;
  const found = EDITOR_THEMES.find((t) => t.id === candidate);
  if (found) return found.bg;
  return mode === 'dark' ? '#1e1e2e' : '#eff1f5';
}

const definedByMonaco = new WeakMap<object, Set<string>>();

function definedSet(monaco: object): Set<string> {
  let s = definedByMonaco.get(monaco);
  if (!s) {
    s = new Set();
    definedByMonaco.set(monaco, s);
  }
  return s;
}

export function defineEditorThemes(monaco: typeof Monaco) {
  // Lazy by default: define the 16 base themes now, app-bg variants on demand
  // (16x16=256 full definitions at startup janked load). ensureEditorTheme
  // below registers the exact variant when the user picks it.
  for (const p of EDITOR_THEMES) {
    defineOne(monaco, p, '', p.bg, p.line, p.gutter);
  }
}

/** Define one theme id on demand (base or one app-bg variant). */
export function ensureEditorTheme(monaco: typeof Monaco, themeId: string): void {
  const seen = definedSet(monaco);
  if (seen.has(themeId)) return;
  const base = themeId.replace(/^coolsolve-/, '').replace(/-appbg-.*$/, '');
  const appBg = themeId.includes('-appbg-') ? themeId.split('-appbg-')[1] : null;
  const p = EDITOR_THEMES.find((t) => t.id === base)
    ?? EDITOR_THEMES.find((t) => t.id === 'catppuccin-dark')!;
  if (!appBg) {
    defineOne(monaco, p, '', p.bg, p.line, p.gutter);
    return;
  }
  const appPal = APP_PALETTES.find((a) => a.id === appBg);
  if (!appPal) {
    defineOne(monaco, p, '', p.bg, p.line, p.gutter);
    return;
  }
  const appGutter = appPal.dark ? '#6c7086' : '#9ca0b0';
  defineOne(monaco, p, `-appbg-${appPal.id}`, appPal.bgPrimary, appPal.bgTertiary, appGutter);
}

function defineOne(
  monaco: typeof Monaco,
  p: (typeof EDITOR_THEMES)[number],
  suffix: string,
  bg: string,
  line: string,
  gutter: string
): void {
  const id = `coolsolve-${p.id}${suffix}`;
  const seen = definedSet(monaco);
  if (seen.has(id)) return;
  seen.add(id);
  const rule = (token: string, foreground: string, fontStyle?: string) => [
    { token, foreground: foreground.slice(1), ...(fontStyle ? { fontStyle } : {}) },
    { token: `${token}.coolsolve`, foreground: foreground.slice(1), ...(fontStyle ? { fontStyle } : {}) },
  ];
  // Assume 6-digit hex (all bundled themes are); short alpha suffix keeps selection translucent.
  const alpha = (hex: string, a: string) => (hex.length === 7 ? hex + a : hex);
  monaco.editor.defineTheme(id, {
    base: p.dark ? 'vs-dark' : 'vs',
    inherit: false,
    rules: [
      { token: '', foreground: p.fg.slice(1), background: bg.slice(1) },
      ...rule('comment', p.comment, 'italic'),
      ...rule('string', p.string),
      ...rule('string.escape', p.directive),
      ...rule('number', p.number),
      ...rule('keyword', p.keyword),
      ...rule('keyword.directive', p.directive),
      ...rule('type', p.type),
      ...rule('type.identifier', p.type),
      ...rule('predefined', p.predefined),
      ...rule('identifier', p.identifier),
      ...rule('operator', p.operator),
      ...rule('delimiter', p.fg),
      ...rule('delimiter.bracket', p.fg),
    ],
    colors: {
      'editor.background': bg,
      'editor.foreground': p.fg,
      'editor.lineHighlightBackground': line,
      'editor.lineHighlightBorder': '#00000000',
      'editor.selectionBackground': p.sel,
      'editor.inactiveSelectionBackground': alpha(p.sel, '99'),
      'editor.selectionHighlightBackground': alpha(p.sel, '66'),
      'editor.selectionHighlightBorder': '#00000000',
      'editor.wordHighlightBackground': alpha(p.sel, '66'),
      'editor.wordHighlightStrongBackground': alpha(p.sel, '66'),
      'editorBracketMatch.background': '#00000000',
      'editorBracketMatch.border': gutter,
      'editorLineNumber.foreground': gutter,
      'editorLineNumber.activeForeground': p.fg,
      'editorCursor.foreground': p.cursor,
      'editorGutter.background': bg,
      'editorIndentGuide.background1': alpha(gutter, '55'),
      'editorIndentGuide.activeBackground1': gutter,
      'editorWidget.background': line,
      'editorWidget.border': alpha(gutter, '88'),
      'minimap.background': bg,
      'scrollbarSlider.background': alpha(gutter, '44'),
      'scrollbarSlider.hoverBackground': alpha(gutter, '77'),
      'scrollbarSlider.activeBackground': alpha(gutter, 'aa'),
    },
  });
}
