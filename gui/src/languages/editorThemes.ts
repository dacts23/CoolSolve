import type * as Monaco from 'monaco-editor';
import { APP_PALETTES } from '../utils/appearance';

type Syntax = {
  comment: string; string: string; number: string; keyword: string; directive: string;
  type: string; predefined: string; identifier: string; operator: string;
};
interface EditorPalette extends Syntax {
  id: string; label: string; dark: boolean;
  bg: string; fg: string; sel: string; line: string; gutter: string; cursor: string;
}

export const EDITOR_THEMES: EditorPalette[] = [
  {
    id: 'default-dark', label: 'Default', dark: true,
    bg: '#121316', fg: '#abb2bf', sel: '#3e4451', line: '#1e2025', gutter: '#5e636e', cursor: '#528bff',
    comment: '#5c6370', string: '#98c379', number: '#d19a66', keyword: '#c678dd', directive: '#56b6c2',
    type: '#e5c07b', predefined: '#61afef', identifier: '#abb2bf', operator: '#56b6c2',
  },
  {
    id: 'default-light', label: 'Default', dark: false,
    bg: '#ffffff', fg: '#383a42', sel: '#e5e5e6', line: '#f0f0f1', gutter: '#9d9d9f', cursor: '#526fff',
    comment: '#a0a1a7', string: '#50a14f', number: '#986801', keyword: '#a626a4', directive: '#0184bc',
    type: '#c18401', predefined: '#4078f2', identifier: '#383a42', operator: '#0184bc',
  },
  {
    id: 'onedark-dark', label: 'One Dark', dark: true,
    bg: '#282c34', fg: '#abb2bf', sel: '#3e4451', line: '#2c313c', gutter: '#6f6f6f', cursor: '#528bff',
    comment: '#5c6370', string: '#98c379', number: '#d19a66', keyword: '#c678dd', directive: '#56b6c2',
    type: '#e5c07b', predefined: '#61afef', identifier: '#abb2bf', operator: '#56b6c2',
  },
  {
    id: 'onedark-light', label: 'One Dark', dark: false,
    bg: '#fafafa', fg: '#383a42', sel: '#e5e5e6', line: '#f0f0f1', gutter: '#9d9d9f', cursor: '#526fff',
    comment: '#a0a1a7', string: '#50a14f', number: '#986801', keyword: '#a626a4', directive: '#0184bc',
    type: '#c18401', predefined: '#4078f2', identifier: '#383a42', operator: '#0184bc',
  },
  {
    id: 'classic-dark', label: 'Classic', dark: true,
    bg: '#1e1e1e', fg: '#d4d4d4', sel: '#264f78', line: '#262626', gutter: '#6e7681', cursor: '#5b8fd6',
    comment: '#6a9955', string: '#ce9178', number: '#b5cea8', keyword: '#c586c0', directive: '#569cd6',
    type: '#4ec9b0', predefined: '#dcdcaa', identifier: '#9cdcfe', operator: '#d4d4d4',
  },
  {
    id: 'classic-light', label: 'Classic', dark: false,
    bg: '#ffffff', fg: '#2e3338', sel: '#add6ff', line: '#f6f6f6', gutter: '#8c959f', cursor: '#2f5fa8',
    comment: '#008000', string: '#a31515', number: '#098658', keyword: '#af00db', directive: '#0000ff',
    type: '#267f99', predefined: '#795e26', identifier: '#001080', operator: '#000000',
  },
  {
    id: 'catppuccin-dark', label: 'Catppuccin', dark: true,
    bg: '#1e1e2e', fg: '#cdd6f4', sel: '#45475a', line: '#313244', gutter: '#6c7086', cursor: '#f5e0dc',
    comment: '#6c7086', string: '#a6e3a1', number: '#fab387', keyword: '#cba6f7', directive: '#f5c2e7',
    type: '#f9e2af', predefined: '#89b4fa', identifier: '#f38ba8', operator: '#89dceb',
  },
  {
    id: 'catppuccin-light', label: 'Catppuccin', dark: false,
    bg: '#eff1f5', fg: '#4c4f69', sel: '#ccd0da', line: '#e6e9ef', gutter: '#9ca0b0', cursor: '#dc8a78',
    comment: '#9ca0b0', string: '#40a02b', number: '#fe640b', keyword: '#8839ef', directive: '#ea76cb',
    type: '#df8e1d', predefined: '#1e66f5', identifier: '#d20f39', operator: '#04a5e5',
  },
  {
    id: 'dracula-dark', label: 'Dracula', dark: true,
    bg: '#282a36', fg: '#f8f8f2', sel: '#44475a', line: '#313342', gutter: '#6272a4', cursor: '#f8f8f0',
    comment: '#6272a4', string: '#f1fa8c', number: '#bd93f9', keyword: '#ff79c6', directive: '#ffb86c',
    type: '#ffb86c', predefined: '#50fa7b', identifier: '#8be9fd', operator: '#ff79c6',
  },
  {
    id: 'dracula-light', label: 'Dracula', dark: false,
    bg: '#f8f9fa', fg: '#282a36', sel: '#e2e8f0', line: '#f1f5f9', gutter: '#6272a4', cursor: '#7c3aed',
    comment: '#6272a4', string: '#16a34a', number: '#7c3aed', keyword: '#db2777', directive: '#ea580c',
    type: '#d97706', predefined: '#059669', identifier: '#0284c7', operator: '#db2777',
  },
  {
    id: 'nord-dark', label: 'Nord', dark: true,
    bg: '#2e3440', fg: '#d8dee9', sel: '#434c5e', line: '#3b4252', gutter: '#4c566a', cursor: '#d8dee9',
    comment: '#616e88', string: '#a3be8c', number: '#b48ead', keyword: '#81a1c1', directive: '#5e81ac',
    type: '#ebcb8b', predefined: '#88c0d0', identifier: '#8fbcbb', operator: '#81a1c1',
  },
  {
    id: 'nord-light', label: 'Nord', dark: false,
    bg: '#eceff4', fg: '#2e3440', sel: '#d8dee9', line: '#e5e9f0', gutter: '#7b88a1', cursor: '#5e81ac',
    comment: '#616e88', string: '#2e7d32', number: '#8f438a', keyword: '#0366d6', directive: '#005cc5',
    type: '#b45309', predefined: '#0277bd', identifier: '#00838f', operator: '#5e81ac',
  },
  {
    id: 'tokyo-night-dark', label: 'Tokyo Night', dark: true,
    bg: '#1a1b26', fg: '#c0caf5', sel: '#33467c', line: '#202233', gutter: '#3b4261', cursor: '#c0caf5',
    comment: '#565f89', string: '#9ece6a', number: '#ff9e64', keyword: '#bb9af7', directive: '#7dcfff',
    type: '#e0af68', predefined: '#7aa2f7', identifier: '#f7768e', operator: '#89ddff',
  },
  {
    id: 'tokyo-night-light', label: 'Tokyo Night', dark: false,
    bg: '#f4f5f9', fg: '#343b58', sel: '#dfe2ec', line: '#ebedf3', gutter: '#848cb5', cursor: '#7aa2f7',
    comment: '#6f7bb6', string: '#388e3c', number: '#b15c00', keyword: '#7c3aed', directive: '#0284c7',
    type: '#b45309', predefined: '#2563eb', identifier: '#e11d48', operator: '#0891b2',
  },
  {
    id: 'gruvbox-dark', label: 'Gruvbox', dark: true,
    bg: '#282828', fg: '#ebdbb2', sel: '#504945', line: '#32302f', gutter: '#7c6f64', cursor: '#ebdbb2',
    comment: '#928374', string: '#b8bb26', number: '#d3869b', keyword: '#fb4934', directive: '#fe8019',
    type: '#fabd2f', predefined: '#fe8019', identifier: '#83a598', operator: '#8ec07c',
  },
  {
    id: 'gruvbox-light', label: 'Gruvbox', dark: false,
    bg: '#fbf1c7', fg: '#3c3836', sel: '#ebdbb2', line: '#f2e5bc', gutter: '#928374', cursor: '#3c3836',
    comment: '#928374', string: '#79740e', number: '#8f3f71', keyword: '#9d0006', directive: '#af3a03',
    type: '#b57614', predefined: '#af3a03', identifier: '#076678', operator: '#427b58',
  },
  {
    id: 'solarized-dark', label: 'Solarized', dark: true,
    bg: '#002b36', fg: '#839496', sel: '#073642', line: '#073642', gutter: '#586e75', cursor: '#839496',
    comment: '#586e75', string: '#2aa198', number: '#d33682', keyword: '#859900', directive: '#cb4b16',
    type: '#b58900', predefined: '#268bd2', identifier: '#6c71c4', operator: '#859900',
  },
  {
    id: 'solarized-light', label: 'Solarized', dark: false,
    bg: '#fdf6e3', fg: '#657b83', sel: '#eee8d5', line: '#eee8d5', gutter: '#93a1a1', cursor: '#657b83',
    comment: '#93a1a1', string: '#2aa198', number: '#d33682', keyword: '#859900', directive: '#cb4b16',
    type: '#b58900', predefined: '#268bd2', identifier: '#6c71c4', operator: '#859900',
  },
];

export const EDITOR_THEME_CHOICES = [
  { id: 'default', label: 'Default' },
  { id: 'onedark', label: 'One Dark' },
  { id: 'classic', label: 'Classic' },
  { id: 'catppuccin', label: 'Catppuccin' },
  { id: 'dracula', label: 'Dracula' },
  { id: 'nord', label: 'Nord' },
  { id: 'tokyo-night', label: 'Tokyo Night' },
  { id: 'gruvbox', label: 'Gruvbox' },
  { id: 'solarized', label: 'Solarized' },
];

export function resolveEditorTheme(
  choice: string,
  appTheme: 'light' | 'dark',
  forceAppBg = true,
  paletteId = 'default'
): string {
  let base = choice || 'default';
  if (base === 'atom' || base === 'atom-app') base = 'default';

  const mode = appTheme === 'light' ? 'light' : 'dark';
  const family = base.replace(/-(dark|light)$/, '');
  const candidate = `${family}-${mode}`;
  const exists = EDITOR_THEMES.some((t) => t.id === candidate);
  const themeId = exists ? candidate : (mode === 'dark' ? 'default-dark' : 'default-light');
  if (!forceAppBg) {
    return `coolsolve-${themeId}`;
  }
  const validPal = APP_PALETTES.some((p) => p.id === paletteId) ? paletteId : (mode === 'light' ? 'light' : 'default');
  return `coolsolve-${themeId}-appbg-${validPal}`;
}

export function getActiveEditorBg(
  choice: string,
  appTheme: 'light' | 'dark',
  forceAppBg = true,
  paletteId = 'default'
): string {
  const mode = appTheme === 'light' ? 'light' : 'dark';
  if (forceAppBg) {
    const pal = APP_PALETTES.find((p) => p.id === paletteId);
    if (pal) return pal.bgPrimary;
    return mode === 'dark' ? '#121316' : '#ffffff';
  }
  let base = choice || 'default';
  if (base === 'atom' || base === 'atom-app') base = 'default';
  const family = base.replace(/-(dark|light)$/, '');
  const candidate = `${family}-${mode}`;
  const found = EDITOR_THEMES.find((t) => t.id === candidate);
  if (found) return found.bg;
  return mode === 'dark' ? '#282c34' : '#fafafa';
}

export function defineEditorThemes(monaco: typeof Monaco) {
  for (const p of EDITOR_THEMES) {
    const register = (suffix: string, bg: string, line: string, gutter: string) => {
      const rule = (token: string, foreground: string, fontStyle?: string) => [
        { token, foreground: foreground.slice(1), ...(fontStyle ? { fontStyle } : {}) },
        { token: `${token}.coolsolve`, foreground: foreground.slice(1), ...(fontStyle ? { fontStyle } : {}) },
      ];
      monaco.editor.defineTheme(`coolsolve-${p.id}${suffix}`, {
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
          'editor.inactiveSelectionBackground': p.sel + '99',
          'editor.selectionHighlightBackground': p.sel + '66',
          'editor.selectionHighlightBorder': '#00000000',
          'editor.wordHighlightBackground': p.sel + '66',
          'editor.wordHighlightStrongBackground': p.sel + '66',
          'editorBracketMatch.background': '#00000000',
          'editorBracketMatch.border': gutter,
          'editorLineNumber.foreground': gutter,
          'editorLineNumber.activeForeground': p.fg,
          'editorCursor.foreground': p.cursor,
          'editorGutter.background': bg,
          'editorIndentGuide.background1': gutter + '55',
          'editorIndentGuide.activeBackground1': gutter,
          'editorWidget.background': line,
          'editorWidget.border': gutter + '88',
          'minimap.background': bg,
          'scrollbarSlider.background': gutter + '44',
          'scrollbarSlider.hoverBackground': gutter + '77',
          'scrollbarSlider.activeBackground': gutter + 'aa',
        },
      });
    };
    register('', p.bg, p.line, p.gutter);
    for (const appPal of APP_PALETTES) {
      const appGutter = appPal.dark ? '#5e636e' : '#8c959f';
      register(`-appbg-${appPal.id}`, appPal.bgPrimary, appPal.bgTertiary, appGutter);
    }
  }
}
