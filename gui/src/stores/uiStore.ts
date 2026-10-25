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
  minimapSliderAlways: boolean;
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
  toggleMinimapSliderAlways: () => void;
  toggleWordWrap: () => void;
  toggleStickyScroll: () => void;
  toggleShowUnderlines: () => void;
  setWordWrap: (wrap: boolean) => void;
  setMinimap: (minimap: boolean) => void;
  setMinimapSliderAlways: (always: boolean) => void;
  setStickyScroll: (sticky: boolean) => void;
  setShowUnderlines: (underlines: boolean) => void;
  setActiveModal: (modal: ModalType) => void;
}

type StoreSet = (
  partial: Partial<UIState> | ((s: UIState) => Partial<UIState>)
) => void;

/** Storage reads/writes that never throw (private mode, blocked cookies). */
function load(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the setting stays in memory for this session.
  }
}

/** Write one persisted value (all plain setters share this shape). */
function put<K extends keyof UIState>(set: StoreSet, key: K, storageKey: string, value: UIState[K]): void {
  save(storageKey, String(value));
  set({ [key]: value } as Partial<UIState>);
}

/** Flip one persisted boolean (all plain toggles share this shape). */
function flip(
  set: StoreSet,
  key: 'minimap' | 'minimapSliderAlways' | 'wordWrap' | 'stickyScroll' | 'showUnderlines' | 'forceAppBg',
  storageKey: string
): void {
  set((s) => {
    const next = !s[key];
    save(storageKey, String(next));
    return { [key]: next } as Partial<UIState>;
  });
}

const savedTheme = (load('coolsolve-theme') as ThemeMode) || 'dark';
const rawPalette = load('coolsolve-palette') || 'catppuccin';
const savedPalette = (rawPalette === 'light' || rawPalette === 'default') ? 'catppuccin' : rawPalette.replace(/-(dark|light)$/, '');
const savedEditorTheme = (load('coolsolve-editor-theme') || savedPalette).replace(/-(dark|light)$/, '');
const resolve = (m: ThemeMode) => (m === 'system' ? systemTheme() : m);

export const useUIStore = create<UIState>((set) => ({
  theme: resolve(savedTheme),
  themeMode: savedTheme,
  accent: load('coolsolve-accent') || 'blue',
  editorTheme: savedEditorTheme,
  editorFont: load('coolsolve-editor-font') || 'consolas',
  editorFontSize: Number(load('coolsolve-editor-font-size')) || DEFAULT_EDITOR_FONT_SIZE,
  forceAppBg: load('coolsolve-force-app-bg') === 'true',
  settingsTab: 'appearance',
  activityMode: 'code',
  leftPanelWidth: Number(load('coolsolve-left-width')) || 240,
  palette: savedPalette,
  rightTab: 'variables',
  rightPanelOpen: true,
  bottomTab: 'console',
  debugFile: null,
  bottomPanelOpen: true,
  consolePosition: (load('coolsolve-console-pos') as 'bottom' | 'rhs') || 'rhs',
  minimap: load('coolsolve-minimap') !== 'false',
  minimapSliderAlways: load('coolsolve-minimap-slider') === 'true',
  wordWrap: load('coolsolve-word-wrap') === 'true',
  stickyScroll: load('coolsolve-sticky-scroll') !== 'false',
  showUnderlines: load('coolsolve-show-underlines') !== 'false',
  activeModal: null,

  setTheme: (theme) => {
    save('coolsolve-theme', theme);
    set({ theme, themeMode: theme });
  },
  setThemeMode: (mode) => {
    save('coolsolve-theme', mode);
    set({ themeMode: mode, theme: resolve(mode) });
  },
  setAccent: (accent) => {
    save('coolsolve-accent', accent);
    set({ accent });
  },
  setEditorTheme: (editorTheme) => {
    const family = editorTheme.replace(/-(dark|light)$/, '');
    save('coolsolve-editor-theme', family);
    save('coolsolve-palette', family);
    set({ editorTheme: family, palette: family });
  },
  setEditorFont: (editorFont) => {
    save('coolsolve-editor-font', editorFont);
    set({ editorFont });
  },
  setEditorFontSize: (editorFontSize) => {
    save('coolsolve-editor-font-size', String(editorFontSize));
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
      save('coolsolve-editor-font-size', String(next));
      return { editorFontSize: next };
    });
  },
  setForceAppBg: (forceAppBg) => put(set, 'forceAppBg', 'coolsolve-force-app-bg', forceAppBg),
  toggleForceAppBg: () => flip(set, 'forceAppBg', 'coolsolve-force-app-bg'),
  setSettingsTab: (settingsTab) => set({ settingsTab }),
  openSettings: (tab = 'appearance') => set({ activeModal: 'settings', settingsTab: tab }),
  setPalette: (palette) => {
    const family = palette.replace(/-(dark|light)$/, '');
    save('coolsolve-palette', family);
    save('coolsolve-editor-theme', family);
    set({ palette: family, editorTheme: family });
  },
  setLeftPanelWidth: (leftPanelWidth) => {
    save('coolsolve-left-width', String(leftPanelWidth));
    set({ leftPanelWidth });
  },
  toggleTheme: () =>
    set((s) => {
      const nextTheme = s.theme === 'dark' ? 'light' : 'dark';
      save('coolsolve-theme', nextTheme);
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
    save('coolsolve-console-pos', consolePosition);
    set({ consolePosition });
  },
  toggleConsolePosition: () =>
    set((s) => {
      const next = s.consolePosition === 'bottom' ? 'rhs' : 'bottom';
      save('coolsolve-console-pos', next);
      return { consolePosition: next };
    }),
  toggleMinimap: () => flip(set, 'minimap', 'coolsolve-minimap'),
  toggleMinimapSliderAlways: () => flip(set, 'minimapSliderAlways', 'coolsolve-minimap-slider'),
  toggleWordWrap: () => flip(set, 'wordWrap', 'coolsolve-word-wrap'),
  toggleStickyScroll: () => flip(set, 'stickyScroll', 'coolsolve-sticky-scroll'),
  toggleShowUnderlines: () => flip(set, 'showUnderlines', 'coolsolve-show-underlines'),
  setWordWrap: (wordWrap) => put(set, 'wordWrap', 'coolsolve-word-wrap', wordWrap),
  setMinimap: (minimap) => put(set, 'minimap', 'coolsolve-minimap', minimap),
  setMinimapSliderAlways: (always) => put(set, 'minimapSliderAlways', 'coolsolve-minimap-slider', always),
  setStickyScroll: (stickyScroll) => put(set, 'stickyScroll', 'coolsolve-sticky-scroll', stickyScroll),
  setShowUnderlines: (showUnderlines) => put(set, 'showUnderlines', 'coolsolve-show-underlines', showUnderlines),
  setActiveModal: (modal) => set({ activeModal: modal }),
}));

// Follow the OS while in 'system' mode.
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (useUIStore.getState().themeMode === 'system') useUIStore.setState({ theme: systemTheme() });
});
