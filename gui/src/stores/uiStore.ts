import { create } from 'zustand';
import { systemTheme, type ThemeMode, DEFAULT_EDITOR_FONT_SIZE, STANDARD_FONT_SIZES } from '../utils/appearance.ts';

export type ActivityMode = 'code' | 'parametric' | 'diagrams' | 'tables' | 'integral';
export type RightTab = 'solution' | 'variables' | 'arrays' | 'config' | 'debug';
export type ModalType = 'library' | 'functionInfo' | 'unitSystem' | 'about' | 'settings' | 'stats' | null;
export type SettingsTab = 'appearance' | 'editor';
export type BottomTab = 'console' | 'diagnostics' | 'debug';

interface UIState {
  /** Resolved theme (what is actually shown). */
  theme: 'light' | 'dark';
  themeMode: ThemeMode;
  accent: string;
  editorTheme: string;
  editorFont: string;
  editorFontSize: number;
  forceAppBg: boolean;
  settingsTab: SettingsTab;
  activityMode: ActivityMode;
  leftPanelWidth: number;
  palette: string;
  rightTab: RightTab;
  rightPanelOpen: boolean;
  bottomTab: BottomTab;
  debugFile: { name: string; content: string; loading: boolean } | null;
  bottomPanelOpen: boolean;
  consolePosition: 'bottom' | 'rhs';
  minimap: boolean;
  wordWrap: boolean;
  stickyScroll: boolean;
  showUnderlines: boolean;
  activeModal: ModalType;

  setTheme: (theme: 'light' | 'dark') => void;
  setThemeMode: (mode: ThemeMode) => void;
  setPalette: (palette: string) => void;
  setAccent: (id: string) => void;
  setLeftPanelWidth: (width: number) => void;
  setEditorTheme: (id: string) => void;
  setEditorFont: (id: string) => void;
  setEditorFontSize: (size: number) => void;
  stepEditorFontSize: (direction: 1 | -1) => void;
  setForceAppBg: (force: boolean) => void;
  toggleForceAppBg: () => void;
  setSettingsTab: (tab: SettingsTab) => void;
  openSettings: (tab?: SettingsTab) => void;
  toggleTheme: () => void;
  setActivityMode: (mode: ActivityMode) => void;
  setRightTab: (tab: RightTab) => void;
  setRightPanelOpen: (open: boolean) => void;
  toggleRightPanel: () => void;
  setBottomTab: (tab: BottomTab) => void;
  openDebugFile: (name: string, content: string, loading?: boolean) => void;
  closeDebugFile: () => void;
  setBottomPanelOpen: (open: boolean) => void;
  toggleBottomPanel: () => void;
  setConsolePosition: (pos: 'bottom' | 'rhs') => void;
  toggleConsolePosition: () => void;
  toggleMinimap: () => void;
  toggleWordWrap: () => void;
  toggleStickyScroll: () => void;
  toggleShowUnderlines: () => void;
  setWordWrap: (wrap: boolean) => void;
  setMinimap: (minimap: boolean) => void;
  setStickyScroll: (sticky: boolean) => void;
  setShowUnderlines: (underlines: boolean) => void;
  setActiveModal: (modal: ModalType) => void;
}

const savedTheme = (localStorage.getItem('coolsolve-theme') as ThemeMode) || 'dark';
const rawPalette = localStorage.getItem('coolsolve-palette') || 'catppuccin';
const savedPalette = (rawPalette === 'light' || rawPalette === 'default') ? 'catppuccin' : rawPalette.replace(/-(dark|light)$/, '');
const savedEditorTheme = (localStorage.getItem('coolsolve-editor-theme') || savedPalette).replace(/-(dark|light)$/, '');
const resolve = (m: ThemeMode) => (m === 'system' ? systemTheme() : m);

export const useUIStore = create<UIState>((set) => ({
  theme: resolve(savedTheme),
  themeMode: savedTheme,
  accent: localStorage.getItem('coolsolve-accent') || 'blue',
  editorTheme: savedEditorTheme,
  editorFont: localStorage.getItem('coolsolve-editor-font') || 'consolas',
  editorFontSize: Number(localStorage.getItem('coolsolve-editor-font-size')) || DEFAULT_EDITOR_FONT_SIZE,
  forceAppBg: localStorage.getItem('coolsolve-force-app-bg') === 'true',
  settingsTab: 'appearance',
  activityMode: 'code',
  leftPanelWidth: Number(localStorage.getItem('coolsolve-left-width')) || 240,
  palette: savedPalette,
  rightTab: 'variables',
  rightPanelOpen: true,
  bottomTab: 'console',
  debugFile: null,
  bottomPanelOpen: true,
  consolePosition: (localStorage.getItem('coolsolve-console-pos') as 'bottom' | 'rhs') || 'rhs',
  minimap: localStorage.getItem('coolsolve-minimap') !== 'false',
  wordWrap: localStorage.getItem('coolsolve-word-wrap') !== 'false',
  stickyScroll: localStorage.getItem('coolsolve-sticky-scroll') !== 'false',
  showUnderlines: localStorage.getItem('coolsolve-show-underlines') !== 'false',
  activeModal: null,

  setTheme: (theme) => {
    localStorage.setItem('coolsolve-theme', theme);
    set({ theme, themeMode: theme });
  },
  setThemeMode: (mode) => {
    localStorage.setItem('coolsolve-theme', mode);
    set({ themeMode: mode, theme: resolve(mode) });
  },
  setAccent: (accent) => {
    localStorage.setItem('coolsolve-accent', accent);
    set({ accent });
  },
  setEditorTheme: (editorTheme) => {
    const family = editorTheme.replace(/-(dark|light)$/, '');
    localStorage.setItem('coolsolve-editor-theme', family);
    localStorage.setItem('coolsolve-palette', family);
    set({ editorTheme: family, palette: family });
  },
  setEditorFont: (editorFont) => {
    localStorage.setItem('coolsolve-editor-font', editorFont);
    set({ editorFont });
  },
  setEditorFontSize: (editorFontSize) => {
    localStorage.setItem('coolsolve-editor-font-size', String(editorFontSize));
    set({ editorFontSize });
  },
  stepEditorFontSize: (direction) => {
    set((state) => {
      const cur = state.editorFontSize;
      let next: number;
      if (direction > 0) {
        const found = STANDARD_FONT_SIZES.find((s) => s > cur);
        next = found ?? STANDARD_FONT_SIZES[STANDARD_FONT_SIZES.length - 1];
      } else {
        const smaller = STANDARD_FONT_SIZES.filter((s) => s < cur);
        next = smaller.length > 0 ? smaller[smaller.length - 1] : STANDARD_FONT_SIZES[0];
      }
      localStorage.setItem('coolsolve-editor-font-size', String(next));
      return { editorFontSize: next };
    });
  },
  setForceAppBg: (forceAppBg) => {
    localStorage.setItem('coolsolve-force-app-bg', String(forceAppBg));
    set({ forceAppBg });
  },
  toggleForceAppBg: () =>
    set((s) => {
      const next = !s.forceAppBg;
      localStorage.setItem('coolsolve-force-app-bg', String(next));
      return { forceAppBg: next };
    }),
  setSettingsTab: (settingsTab) => set({ settingsTab }),
  openSettings: (tab = 'appearance') => set({ activeModal: 'settings', settingsTab: tab }),
  setPalette: (palette) => {
    const family = palette.replace(/-(dark|light)$/, '');
    localStorage.setItem('coolsolve-palette', family);
    localStorage.setItem('coolsolve-editor-theme', family);
    set({ palette: family, editorTheme: family });
  },
  setLeftPanelWidth: (leftPanelWidth) => {
    localStorage.setItem('coolsolve-left-width', String(leftPanelWidth));
    set({ leftPanelWidth });
  },
  toggleTheme: () =>
    set((s) => {
      const nextTheme = s.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('coolsolve-theme', nextTheme);
      return { theme: nextTheme, themeMode: nextTheme };
    }),
  setActivityMode: (activityMode) => set({ activityMode }),
  setRightTab: (tab) => set({ rightTab: tab, rightPanelOpen: true }),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  setBottomTab: (bottomTab) => set({ bottomTab, bottomPanelOpen: true }),
  openDebugFile: (name, content, loading = false) =>
    set({ debugFile: { name, content, loading }, bottomTab: 'debug', bottomPanelOpen: true }),
  closeDebugFile: () => set({ debugFile: null, bottomTab: 'console' }),
  setBottomPanelOpen: (open) => set({ bottomPanelOpen: open }),
  toggleBottomPanel: () => set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen })),
  setConsolePosition: (consolePosition) => {
    localStorage.setItem('coolsolve-console-pos', consolePosition);
    set({ consolePosition });
  },
  toggleConsolePosition: () =>
    set((s) => {
      const next = s.consolePosition === 'bottom' ? 'rhs' : 'bottom';
      localStorage.setItem('coolsolve-console-pos', next);
      return { consolePosition: next };
    }),
  toggleMinimap: () =>
    set((s) => {
      const next = !s.minimap;
      localStorage.setItem('coolsolve-minimap', String(next));
      return { minimap: next };
    }),
  toggleWordWrap: () =>
    set((s) => {
      const next = !s.wordWrap;
      localStorage.setItem('coolsolve-word-wrap', String(next));
      return { wordWrap: next };
    }),
  toggleStickyScroll: () =>
    set((s) => {
      const next = !s.stickyScroll;
      localStorage.setItem('coolsolve-sticky-scroll', String(next));
      return { stickyScroll: next };
    }),
  toggleShowUnderlines: () =>
    set((s) => {
      const next = !s.showUnderlines;
      localStorage.setItem('coolsolve-show-underlines', String(next));
      return { showUnderlines: next };
    }),
  setWordWrap: (wordWrap) => {
    localStorage.setItem('coolsolve-word-wrap', String(wordWrap));
    set({ wordWrap });
  },
  setMinimap: (minimap) => {
    localStorage.setItem('coolsolve-minimap', String(minimap));
    set({ minimap });
  },
  setStickyScroll: (stickyScroll) => {
    localStorage.setItem('coolsolve-sticky-scroll', String(stickyScroll));
    set({ stickyScroll });
  },
  setShowUnderlines: (showUnderlines) => {
    localStorage.setItem('coolsolve-show-underlines', String(showUnderlines));
    set({ showUnderlines });
  },
  setActiveModal: (modal) => set({ activeModal: modal }),
}));

// Follow the OS while in 'system' mode.
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (useUIStore.getState().themeMode === 'system') useUIStore.setState({ theme: systemTheme() });
});
