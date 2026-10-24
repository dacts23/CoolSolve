import { create } from 'zustand';
import { systemTheme, type ThemeMode, DEFAULT_EDITOR_FONT_SIZE, STANDARD_FONT_SIZES } from '../utils/appearance';

export type ActivityMode = 'code' | 'parametric' | 'diagrams' | 'tables' | 'integral';
export type RightTab = 'variables' | 'arrays' | 'config' | 'debug';
export type ModalType = 'library' | 'functionInfo' | 'unitSystem' | 'about' | 'settings' | null;
export type SettingsTab = 'appearance' | 'editor';

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
  leftPanelOpen: boolean;
  leftPanelWidth: number;
  palette: string;
  rightTab: RightTab;
  rightPanelOpen: boolean;
  bottomPanelOpen: boolean;
  consolePosition: 'bottom' | 'rhs';
  minimap: boolean;
  wordWrap: boolean;
  stickyScroll: boolean;
  showUnderlines: boolean;
  activeModal: ModalType;
  splitPosition: number; // percentage for left pane

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
  setLeftPanelOpen: (open: boolean) => void;
  toggleLeftPanel: () => void;
  setRightTab: (tab: RightTab) => void;
  setRightPanelOpen: (open: boolean) => void;
  toggleRightPanel: () => void;
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
  setSplitPosition: (pos: number) => void;
}

const savedPalette = localStorage.getItem('coolsolve-palette') || 'default';
const savedMode: ThemeMode = savedPalette === 'light' ? 'light' : 'dark';
const resolve = (m: ThemeMode) => (m === 'system' ? systemTheme() : m);

export const useUIStore = create<UIState>((set) => ({
  theme: resolve(savedMode),
  themeMode: savedMode,
  accent: localStorage.getItem('coolsolve-accent') || 'blue',
  editorTheme: localStorage.getItem('coolsolve-editor-theme') || 'default',
  editorFont: localStorage.getItem('coolsolve-editor-font') || 'consolas',
  editorFontSize: Number(localStorage.getItem('coolsolve-editor-font-size')) || DEFAULT_EDITOR_FONT_SIZE,
  forceAppBg: localStorage.getItem('coolsolve-force-app-bg') === 'true',
  settingsTab: 'appearance',
  activityMode: 'code',
  leftPanelOpen: false,
  leftPanelWidth: Number(localStorage.getItem('coolsolve-left-width')) || 240,
  palette: localStorage.getItem('coolsolve-palette') || 'default',
  rightTab: 'variables',
  rightPanelOpen: true,
  bottomPanelOpen: true,
  consolePosition: (localStorage.getItem('coolsolve-console-pos') as 'bottom' | 'rhs') || 'rhs',
  minimap: localStorage.getItem('coolsolve-minimap') !== 'false',
  wordWrap: localStorage.getItem('coolsolve-word-wrap') !== 'false',
  stickyScroll: localStorage.getItem('coolsolve-sticky-scroll') !== 'false',
  showUnderlines: localStorage.getItem('coolsolve-show-underlines') !== 'false',
  activeModal: null,
  splitPosition: 58,

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
    localStorage.setItem('coolsolve-editor-theme', editorTheme);
    set({ editorTheme });
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
    localStorage.setItem('coolsolve-palette', palette);
    const nextTheme = palette === 'light' ? 'light' : 'dark';
    localStorage.setItem('coolsolve-theme', nextTheme);
    const paletteToEditorTheme: Record<string, string> = {
      default: 'default',
      onedark: 'onedark',
      nord: 'nord',
      dracula: 'dracula',
    };
    const nextEditorTheme = paletteToEditorTheme[palette] || 'default';
    localStorage.setItem('coolsolve-editor-theme', nextEditorTheme);
    set({ palette, theme: nextTheme, themeMode: nextTheme, editorTheme: nextEditorTheme });
  },
  setLeftPanelWidth: (leftPanelWidth) => {
    localStorage.setItem('coolsolve-left-width', String(leftPanelWidth));
    set({ leftPanelWidth });
  },
  toggleTheme: () =>
    set((s) => {
      const nextPalette = s.palette === 'light' ? 'default' : 'light';
      const nextTheme = nextPalette === 'light' ? 'light' : 'dark';
      localStorage.setItem('coolsolve-palette', nextPalette);
      localStorage.setItem('coolsolve-theme', nextTheme);
      return { palette: nextPalette, theme: nextTheme, themeMode: nextTheme };
    }),
  setActivityMode: (activityMode) => set({ activityMode, leftPanelOpen: activityMode !== 'code' }),
  setLeftPanelOpen: (leftPanelOpen) => set((s) => (s.activityMode === 'code' ? s : { leftPanelOpen })),
  toggleLeftPanel: () => set((s) => (s.activityMode === 'code' ? s : { leftPanelOpen: !s.leftPanelOpen })),
  setRightTab: (tab) => set({ rightTab: tab, rightPanelOpen: true }),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
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
  setSplitPosition: (pos) => set({ splitPosition: pos }),
}));

// Follow the OS while in 'system' mode.
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (useUIStore.getState().themeMode === 'system') useUIStore.setState({ theme: systemTheme() });
});
