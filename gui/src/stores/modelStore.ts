import { create } from 'zustand';
import type {
  SolveResponse,
  ParseError,
  Diagnostic,
  VariableInfo,
  SavedParametricStudy,
  ParametricStudyResult,
  UserUnitOverride,
  LookupTableInfo,
  IntegralTableData,
} from '../api/types';
import { api } from '../api/client.ts';
import { toErrMsg } from '../utils/errors.ts';
import { isRunBusy } from '../utils/runBusy.ts';

/**
 * Everything a run of a model produces. It lives with its tab: switching files
 * shows that file's results again instead of deleting them. `resultIsLive` is
 * true only for results the server produced for the model on screen (a fresh
 * solve or a session load), so server-side follow-up actions (Update Guesses,
 * LaTeX report) are only offered for those.
 */
export interface TabResults {
  lastResult: SolveResponse | null;
  parametricResult: ParametricStudyResult | null;
  activeStudyId: string | null;
  parametricStudies: SavedParametricStudy[];
  integralTable: IntegralTableData | null;
  integralCSV: string;
  lookupTables: LookupTableInfo[];
  lookupTableCSVs: Record<string, string>; // name → raw CSV content
  selectedLookupTable: string | null;
  resultIsLive: boolean;
  /** GUI unit overrides belong to the model, so they travel with its tab. */
  userUnitOverrides: UserUnitOverride[];
}

export interface EditorTab extends TabResults {
  id: string;
  name: string;
  filePath: string;
  modelName: string;
  libraryId: string;
  eescode: string;
  initials: string;
  sol: string;
  conf: string;
  dirty: boolean;
}

const NO_RESULTS: TabResults = {
  lastResult: null,
  parametricResult: null,
  activeStudyId: null,
  parametricStudies: [],
  integralTable: null,
  integralCSV: '',
  lookupTables: [],
  lookupTableCSVs: {},
  selectedLookupTable: null,
  resultIsLive: false,
  userUnitOverrides: [],
};

/** True when this model has any run results worth keeping. */
export function hasResults(r: TabResults): boolean {
  return Boolean(
    r.lastResult ||
      r.parametricResult ||
      r.parametricStudies.length > 0 ||
      r.integralTable ||
      r.integralCSV ||
      r.lookupTables.length > 0 ||
      Object.keys(r.lookupTableCSVs).length > 0
  );
}

export const tabHasResults = (t: EditorTab): boolean => hasResults(t);

interface ModelState extends TabResults {
  // File state
  filePath: string;
  modelName: string;
  /** Library ID ("CSL-0012") when the model was opened from the model library, else ''. */
  libraryId: string;
  eescode: string;
  initials: string;
  sol: string;
  conf: string;
  dirty: boolean;
  canGoBack: boolean;
  setDirty: (dirty: boolean) => void;

  // Multi-tab open files
  openTabs: EditorTab[];
  activeTabId: string;
  switchTab: (id: string) => void;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  renameTab: (id: string, newName: string) => void;
  newTab: () => void;

  // Parse state
  parseErrors: ParseError[];
  parseDiagnostics: Diagnostic[];
  equationCount: number;
  variableCount: number;
  isSquare: boolean;
  parsedVariables: VariableInfo[]; // Variable info from last parse (units, imposed, etc.)

  // Solve state
  solving: boolean;
  /** True when the last solve failed (and nothing has changed since), so the
   *  toolbar can morph the "Solve" button into "Try Harder".  Cleared by any
   *  edit to eescode / initials / conf, and by a successful (or restarted) solve. */
  tryHarderAvailable: boolean;
  /** True while a Deep Search ("Try Harder") run is in flight, so the toolbar
   *  can label the spinner accordingly. */
  deepSearchRunning: boolean;

  /** True while the table grid holds cell edits that were not saved yet. */
  lookupTableDirty: boolean;
  setLookupTableDirty: (dirty: boolean) => void;
  /** Bumped on user table create/save/delete (never on read-only CSV cache). */
  tableRev: number;

  // Console log
  consoleLines: string[];

  // Actions
  setEescode: (code: string) => void;
  setInitials: (initials: string) => void;
  setConf: (conf: string) => void;
  setFilePath: (path: string) => void;
  setModelName: (name: string) => void;
  setParseResult: (errors: ParseError[], eqCount: number, varCount: number, isSquare: boolean, diagnostics?: Diagnostic[]) => void;
  setParsedVariables: (vars: VariableInfo[]) => void;
  setSolving: (solving: boolean) => void;
  setTryHarderAvailable: (available: boolean) => void;
  setDeepSearchRunning: (running: boolean) => void;
  setSolveResult: (result: SolveResponse) => void;
  setParametricResult: (result: ParametricStudyResult | null) => void;
  setActiveStudyId: (id: string | null) => void;
  setSol: (sol: string) => void;
  /** Write .sol text into one tab (late answers must not land on another tab). */
  setSolForTab: (tabId: string, sol: string) => void;
  setCanGoBack: (canGoBack: boolean) => void;
  addConsoleLine: (line: string) => void;
  clearConsole: () => void;
  loadFile: (
    path: string,
    eescode: string,
    initials: string,
    sol: string,
    conf: string,
    modelName?: string,
    libraryId?: string,
    syncServer?: boolean
  ) => void;
  clearModel: () => void;
  addParametricStudy: (study: SavedParametricStudy) => void;
  removeParametricStudy: (id: string) => void;
  /**
   * Write run output into one tab's entry (and the flat state when it is the
   * active tab). Runners capture the tab id at start so late answers cannot
   * land on a tab the user switched to meanwhile.
   */
  patchTabResults: (tabId: string, patch: Partial<TabResults>) => void;
  /** Save a finished sweep (result grid + study entry + selection) into one tab. */
  saveParametricStudy: (tabId: string, study: SavedParametricStudy, result: ParametricStudyResult | null) => void;
  setIntegralTable: (table: IntegralTableData | null) => void;
  setIntegralCSV: (csv: string) => void;
  setUserUnit: (variableName: string, units: string) => void;
  setSelectedLookupTable: (name: string | null) => void;
  setLookupTables: (tables: LookupTableInfo[]) => void;
  setLookupTableCSV: (name: string, csv: string, fromCache?: boolean) => void;
  removeLookupTable: (name: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  /** Write the current conf to the server once typing pauses (not per keystroke). */
  scheduleConfPut: () => void;
  /** Write the current eescode to the server once typing pauses. Solve/sweep
   *  push a snapshot directly, so this only keeps refresh/reload from losing
   *  text that was never pushed. Callers: CodeEditor onChange. */
  scheduleEescodePut: () => void;
  /** Drop pending debounced writes (bundle/solve push memory directly). */
  cancelPendingPuts: () => void;
}

/**
 * Push one tab's files to the server session. The writes are queued in
 * this order (see api/client.ts), so fast tab switches can never leave the
 * server holding two models mixed together. Failures show in the console.
 */
function pushFiles(eescode: string, initials: string, conf: string, modelName?: string): void {
  const writes: Promise<unknown>[] = [
    api.putEescode(eescode),
    api.putInitials(initials),
    api.putConf(conf),
  ];
  if (modelName !== undefined) writes.push(api.setModelName(modelName));
  Promise.all(writes).catch((err) =>
    useModelStore.getState().addConsoleLine(`>>> ERROR saving model to server: ${toErrMsg(err)}`)
  );
}

/** The run results of a model (flat state or a tab entry). */
const tabResults = (s: TabResults): TabResults => ({
  lastResult: s.lastResult,
  parametricResult: s.parametricResult,
  activeStudyId: s.activeStudyId,
  parametricStudies: s.parametricStudies,
  integralTable: s.integralTable,
  integralCSV: s.integralCSV,
  lookupTables: s.lookupTables,
  lookupTableCSVs: s.lookupTableCSVs,
  selectedLookupTable: s.selectedLookupTable,
  resultIsLive: s.resultIsLive,
  userUnitOverrides: s.userUnitOverrides,
});

/** Park the active tab's current content and results into its tab entry. */
const parkActiveTab = (state: ModelState): EditorTab[] =>
  state.openTabs.map((t) =>
    t.id === state.activeTabId
      ? {
          ...t,
          eescode: state.eescode,
          initials: state.initials,
          conf: state.conf,
          sol: state.sol,
          dirty: state.dirty,
          ...tabResults(state),
        }
      : t
  );

/** State belonging to the model on screen (parse state, grid edit flag):
 *  it resets whenever the model swaps. */
const SWAP_RESET = {
  parseErrors: [] as ParseError[],
  parseDiagnostics: [] as Diagnostic[],
  equationCount: 0,
  variableCount: 0,
  isSquare: true,
  parsedVariables: [] as VariableInfo[],
  lookupTableDirty: false,
};

let confPutTimer: ReturnType<typeof setTimeout> | undefined;
let eescodePutTimer: ReturnType<typeof setTimeout> | undefined;

/** Cap open tabs: each holds full text + sweep grids + CSVs. */
const MAX_TABS = 10;
function enforceTabCap(tabs: EditorTab[], activeId: string): EditorTab[] {
  if (tabs.length <= MAX_TABS) return tabs;
  // Never evict dirty tabs or tabs with results; only drop clean expendable ones.
  // Tab order is preserved; the oldest expendable tabs are dropped first.
  const dropCount = tabs.length - MAX_TABS;
  const toDrop = new Set<string>();
  for (const t of tabs) {
    if (toDrop.size >= dropCount) break;
    if (t.id !== activeId && !t.dirty && !tabHasResults(t)) {
      toDrop.add(t.id);
    }
  }
  return tabs.filter((t) => !toDrop.has(t.id));
}

export const useModelStore = create<ModelState>((set, get) => ({
  filePath: '',
  modelName: '',
  libraryId: '',
  eescode: '',
  initials: '',
  sol: '',
  conf: '',
  dirty: false,
  canGoBack: false,

  openTabs: [
    {
      id: 'default',
      name: 'untitled.eescode',
      filePath: '',
      modelName: '',
      libraryId: '',
      eescode: '',
      initials: '',
      sol: '',
      conf: '',
      dirty: false,
      ...NO_RESULTS,
    },
  ],
  activeTabId: 'default',

  ...NO_RESULTS,
  parseErrors: [],
  parseDiagnostics: [],
  equationCount: 0,
  variableCount: 0,
  isSquare: true,
  parsedVariables: [],

  solving: false,
  tryHarderAvailable: false,
  deepSearchRunning: false,

  setDirty: (dirty) =>
    set((state) => ({
      dirty,
      openTabs: state.openTabs.map((t) =>
        t.id === state.activeTabId ? { ...t, dirty } : t
      ),
    })),

  lookupTableDirty: false,
  tableRev: 0,
  // Switching tables swaps the grid, so any unsaved cell edits are gone: clear
  // the flag with the selection. Callers must confirm before switching when it
  // is set (see LookupTablesSetup).
  setSelectedLookupTable: (selectedLookupTable) => set({ selectedLookupTable, lookupTableDirty: false }),
  setLookupTableDirty: (lookupTableDirty) => set({ lookupTableDirty }),

  consoleLines: [],

  switchTab: (id) => {
    const s = get();
    if (id === s.activeTabId) return;
    // All tabs share one server session: swapping files mid-run would solve
    // the wrong model and attribute the result to the wrong file.
    if (isRunBusy()) {
      s.addConsoleLine('>>> Cannot switch files while a run is in progress.');
      return;
    }
    s.cancelPendingPuts();
    set((state) => {
      const target = state.openTabs.find((t) => t.id === id);
      if (!target) return state;
      // Park the outgoing tab's content and results; nothing is deleted.
      const updatedTabs = parkActiveTab(state);
      pushFiles(
        target.eescode,
        target.initials,
        target.conf,
        target.modelName !== state.modelName ? target.modelName : undefined
      );
      return {
        openTabs: updatedTabs,
        activeTabId: id,
        filePath: target.filePath,
        modelName: target.modelName,
        libraryId: target.libraryId,
        eescode: target.eescode,
        initials: target.initials,
        sol: target.sol,
        conf: target.conf,
        dirty: target.dirty,
        ...tabResults(target),
        ...SWAP_RESET,
      };
    });
  },

  closeTab: (id) => {
    const s = get();
    if (isRunBusy()) {
      s.addConsoleLine('>>> Cannot close files while a run is in progress.');
      return;
    }
    s.cancelPendingPuts();
    set((state) => {
      const tabIndex = state.openTabs.findIndex((t) => t.id === id);
      if (tabIndex < 0) return state;

      // Park the active tab first so only the closed tab's results die.
      const parked = parkActiveTab(state);
      const remaining = parked.filter((t) => t.id !== id);
      if (remaining.length === 0) {
        const blankId = `tab-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
        const blankTab: EditorTab = {
          id: blankId,
          name: 'untitled.eescode',
          filePath: '',
          modelName: '',
          libraryId: '',
          eescode: '',
          initials: '',
          sol: '',
          conf: '',
          dirty: false,
          ...NO_RESULTS,
        };
        pushFiles('', '', '', state.modelName ? '' : undefined);
        return {
          openTabs: [blankTab],
          activeTabId: blankId,
          filePath: '',
          modelName: '',
          libraryId: '',
          eescode: '',
          initials: '',
          sol: '',
          conf: '',
          dirty: false,
          ...NO_RESULTS,
          ...SWAP_RESET,
        };
      }

      if (id === state.activeTabId) {
        const nextIndex = Math.min(tabIndex, remaining.length - 1);
        const nextTab = remaining[nextIndex];
        pushFiles(
          nextTab.eescode,
          nextTab.initials,
          nextTab.conf,
          nextTab.modelName !== state.modelName ? nextTab.modelName : undefined
        );
        return {
          openTabs: remaining,
          activeTabId: nextTab.id,
          filePath: nextTab.filePath,
          modelName: nextTab.modelName,
          libraryId: nextTab.libraryId,
          eescode: nextTab.eescode,
          initials: nextTab.initials,
          sol: nextTab.sol,
          conf: nextTab.conf,
          dirty: nextTab.dirty,
          ...tabResults(nextTab),
          ...SWAP_RESET,
        };
      }

      return { openTabs: remaining };
    });
  },

  closeOtherTabs: (id) => {
    const s = get();
    if (isRunBusy()) {
      s.addConsoleLine('>>> Cannot close files while a run is in progress.');
      return;
    }
    s.cancelPendingPuts();
    set((state) => {
      const target = state.openTabs.find((t) => t.id === id);
      if (!target) return state;
      // Park first: if the kept tab is the active one, its results are in the
      // flat state, not in its entry yet.
      const kept = parkActiveTab(state).find((t) => t.id === id);
      if (!kept) return state;
      pushFiles(
        kept.eescode,
        kept.initials,
        kept.conf,
        kept.modelName !== state.modelName ? kept.modelName : undefined
      );
      return {
        openTabs: [kept],
        activeTabId: kept.id,
        filePath: kept.filePath,
        modelName: kept.modelName,
        libraryId: kept.libraryId,
        eescode: kept.eescode,
        initials: kept.initials,
        sol: kept.sol,
        conf: kept.conf,
        dirty: kept.dirty,
        ...tabResults(kept),
        ...SWAP_RESET,
      };
    });
  },

  renameTab: (id, newName) =>
    set((state) => {
      const stem = newName.replace(/\.[^.]+$/, '') || 'model';
      const ext = newName.includes('.') ? '' : '.eescode';
      const fullName = `${newName}${ext}`;
      const openTabs = state.openTabs.map((t) =>
        t.id === id ? { ...t, name: fullName, modelName: stem } : t
      );
      if (id === state.activeTabId) {
        api.setModelName(stem).catch(() => {});
        return { openTabs, modelName: stem };
      }
      return { openTabs };
    }),

  reorderTabs: (fromIndex, toIndex) =>
    set((state) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= state.openTabs.length ||
        toIndex >= state.openTabs.length
      ) {
        return state;
      }
      const updated = [...state.openTabs];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return { openTabs: updated };
    }),

  newTab: () => {
    const s = get();
    if (isRunBusy()) {
      s.addConsoleLine('>>> Cannot create a file while a run is in progress.');
      return;
    }
    s.cancelPendingPuts();
    set((state) => {
      const untitledCount = state.openTabs.filter((t) => t.name.startsWith('untitled')).length;
      const name = untitledCount === 0 ? 'untitled.eescode' : `untitled-${untitledCount + 1}.eescode`;
      // Random suffix: two tabs created in the same millisecond must not share an id.
      const id = `tab-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      const newTab: EditorTab = {
        id,
        name,
        filePath: '',
        modelName: '',
        libraryId: '',
        eescode: '',
        initials: '',
        sol: '',
        conf: '',
        dirty: false,
        ...NO_RESULTS,
      };
      pushFiles('', '', '', state.modelName ? '' : undefined);
      return {
        openTabs: enforceTabCap([...parkActiveTab(state), newTab], id),
        activeTabId: id,
        filePath: '',
        modelName: '',
        libraryId: '',
        eescode: '',
        initials: '',
        sol: '',
        conf: '',
        dirty: false,
        ...NO_RESULTS,
        ...SWAP_RESET,
      };
    });
  },

  setEescode: (code) =>
    set((state) => {
      // shortcut: dirty stays true after revert-to-saved; upgrade when a disk baseline is tracked.
      const dirty = code !== state.eescode ? true : state.dirty;
      const openTabs = state.openTabs.map((t) =>
        t.id === state.activeTabId ? { ...t, eescode: code, dirty } : t
      );
      return { eescode: code, dirty, openTabs, tryHarderAvailable: false };
    }),
  setInitials: (initials) =>
    set((state) => {
      // shortcut: dirty stays true after revert-to-saved; upgrade when a disk baseline is tracked.
      const dirty = initials !== state.initials ? true : state.dirty;
      const openTabs = state.openTabs.map((t) =>
        t.id === state.activeTabId ? { ...t, initials, dirty } : t
      );
      return { initials, dirty, openTabs, tryHarderAvailable: false };
    }),
  setConf: (conf) =>
    set((state) => {
      // shortcut: dirty stays true after revert-to-saved; upgrade when a disk baseline is tracked.
      const dirty = conf !== state.conf ? true : state.dirty;
      const openTabs = state.openTabs.map((t) =>
        t.id === state.activeTabId ? { ...t, conf, dirty } : t
      );
      return { conf, dirty, openTabs, tryHarderAvailable: false };
    }),
  setFilePath: (path) => set({ filePath: path }),
  setModelName: (name) => set({ modelName: name }),
  setParseResult: (errors, eqCount, varCount, isSquare, diagnostics = []) =>
    set({ parseErrors: errors, parseDiagnostics: diagnostics, equationCount: eqCount, variableCount: varCount, isSquare }),
  setParsedVariables: (vars) => set({ parsedVariables: vars }),
  setSolving: (solving) => set({ solving }),
  setTryHarderAvailable: (available) => set({ tryHarderAvailable: available }),
  setDeepSearchRunning: (running) => set({ deepSearchRunning: running }),
  // A result that arrives from a live run belongs to the model on screen.
  // Flat setters route through the tab-safe writers so late answers use one path.
  // Runners must still pass the captured tabId (see patchTabResults/setSolForTab).
  setSolveResult: (result) => get().patchTabResults(get().activeTabId, { lastResult: result, resultIsLive: true }),
  setParametricResult: (parametricResult) => get().patchTabResults(get().activeTabId, { parametricResult }),
  setActiveStudyId: (activeStudyId) => get().patchTabResults(get().activeTabId, { activeStudyId }),
  setSol: (sol) => get().setSolForTab(get().activeTabId, sol),
  setSolForTab: (tabId, sol) =>
    set((state) => {
      const openTabs = state.openTabs.map((t) =>
        t.id === tabId ? { ...t, sol } : t
      );
      if (tabId === state.activeTabId) return { sol, openTabs };
      return { openTabs };
    }),
  setCanGoBack: (canGoBack) => set({ canGoBack }),
  addConsoleLine: (line) =>
    set((state) => ({
      consoleLines:
        state.consoleLines.length >= 1000
          ? [...state.consoleLines.slice(-999), line]
          : [...state.consoleLines, line],
    })),
  clearConsole: () => set({ consoleLines: [] }),

  loadFile: (path, eescode, initials, sol, conf, modelName, libraryId, syncServer = true) => {
    get().cancelPendingPuts();
    set((state) => {
      const name = modelName
        ? `${modelName}.eescode`
        : path
          ? path.split(/[\\/]/).pop() || 'untitled.eescode'
          : 'untitled.eescode';
      const id = path || libraryId || (modelName ? `model-${modelName}` : `tab-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`);

      // Park the outgoing model's results in its tab: opening a file must not
      // delete the runs of whatever is on screen.
      const parked = parkActiveTab(state);
      const existingIndex = parked.findIndex(
        (t) => (path && t.filePath === path) || (libraryId && t.libraryId === libraryId) || t.id === id
      );
      let newTabs: EditorTab[];
      // A reloaded tab keeps its runs and its unit overrides: the new content
      // brings its own unit annotations, but user overrides stay until changed.
      let results: TabResults = NO_RESULTS;
      if (existingIndex >= 0) {
        results = { ...tabResults(parked[existingIndex]) };
        newTabs = [...parked];
        newTabs[existingIndex] = {
          ...newTabs[existingIndex],
          name,
          filePath: path,
          modelName: modelName ?? '',
          libraryId: libraryId ?? '',
          eescode,
          initials,
          sol,
          conf,
          dirty: false,
        };
      } else {
        const isSingleUntouched =
          parked.length === 1 &&
          parked[0].name === 'untitled.eescode' &&
          !parked[0].dirty &&
          !parked[0].eescode.trim() &&
          !tabHasResults(parked[0]);

        const newTab: EditorTab = {
          id,
          name,
          filePath: path,
          modelName: modelName ?? '',
          libraryId: libraryId ?? '',
          eescode,
          initials,
          sol,
          conf,
          dirty: false,
          ...NO_RESULTS,
        };
        newTabs = isSingleUntouched ? [newTab] : enforceTabCap([...parked, newTab], id);
      }

      if (syncServer) {
        pushFiles(eescode, initials, conf, modelName !== state.modelName ? (modelName ?? '') : undefined);
      }

      return {
        filePath: path,
        eescode,
        initials,
        sol,
        conf,
        dirty: false,
        consoleLines: [],
        modelName: modelName ?? '',
        libraryId: libraryId ?? '',
        ...results,
        ...SWAP_RESET,
        tryHarderAvailable: false,
        deepSearchRunning: false,
        openTabs: newTabs,
        activeTabId: id,
      };
    });
  },

  // New Model: deliberately discards the runs of the current model (the UI
  // confirms first), and blanks the active tab entry so they cannot come back.
  clearModel: () => {
    get().cancelPendingPuts();
    set((state) => ({
      filePath: '',
      modelName: '',
      libraryId: '',
      eescode: '',
      initials: '',
      sol: '',
      conf: '',
      dirty: false,
      consoleLines: [],
      ...NO_RESULTS,
      ...SWAP_RESET,
      tryHarderAvailable: false,
      deepSearchRunning: false,
      openTabs: state.openTabs.map((t) =>
        t.id === state.activeTabId
          ? {
              ...t,
              name: 'untitled.eescode',
              filePath: '',
              modelName: '',
              libraryId: '',
              eescode: '',
              initials: '',
              sol: '',
              conf: '',
              dirty: false,
              ...NO_RESULTS,
            }
          : t
      ),
    }));
  },
  // Keep only the newest studies: each holds a full sweep result grid.
  // Eviction is silent in the store, so log it: the user must know old work is gone.
  addParametricStudy: (study) =>
    set((state) => {
      const next = [...state.parametricStudies, study].slice(-5);
      if (state.parametricStudies.length + 1 > next.length) {
        setTimeout(() =>
          useModelStore.getState().addConsoleLine('>>> Oldest parametric study dropped (keeps newest 5).')
        , 0);
      }
      return { parametricStudies: next };
    }),
  removeParametricStudy: (id) =>
    set((state) => {
      // Deleting the displayed study must clear its table and plot, and the
      // tab entry (not just the flat state) must forget it — otherwise the
      // study pops back open the next time its tab is shown.
      const tabId = state.activeTabId;
      const prev = state.openTabs.find((t) => t.id === tabId);
      const wasActive = (prev && prev.activeStudyId === id) || state.activeStudyId === id;
      const openTabs = state.openTabs.map((t) =>
        t.id !== tabId
          ? t
          : {
              ...t,
              parametricStudies: t.parametricStudies.filter((s) => s.id !== id),
              ...(wasActive ? { parametricResult: null, activeStudyId: null } : {}),
            }
      );
      const entry = openTabs.find((t) => t.id === tabId);
      return {
        openTabs,
        parametricStudies: entry ? entry.parametricStudies : state.parametricStudies,
        ...(wasActive ? { parametricResult: null, activeStudyId: null } : {}),
      };
    }),
  patchTabResults: (tabId, patch) =>
    set((state) => {
      const openTabs = state.openTabs.map((t) =>
        t.id === tabId ? { ...t, ...patch } : t
      );
      // TabResults fields also exist on the flat state: keep both in sync
      // when the patched tab is the one on screen.
      if (tabId === state.activeTabId) return { ...patch, openTabs };
      return { openTabs };
    }),
  saveParametricStudy: (tabId, study, result) =>
    set((state) => {
      const prev = state.openTabs.find((t) => t.id === tabId);
      const dropped = prev && prev.parametricStudies.length + 1 > 5;
      const openTabs = state.openTabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              parametricResult: result,
              parametricStudies: [...t.parametricStudies, study].slice(-5),
              activeStudyId: study.id,
            }
          : t
      );
      if (dropped) {
        setTimeout(() =>
          useModelStore.getState().addConsoleLine('>>> Oldest parametric study dropped (keeps newest 5).')
        , 0);
      }
      if (tabId === state.activeTabId) {
        const entry = openTabs.find((t) => t.id === tabId);
        return {
          parametricResult: result,
          parametricStudies: entry ? entry.parametricStudies : state.parametricStudies,
          activeStudyId: study.id,
          openTabs,
        };
      }
      return { openTabs };
    }),
  setIntegralTable: (table) => get().patchTabResults(get().activeTabId, { integralTable: table }),
  setIntegralCSV: (csv) => get().patchTabResults(get().activeTabId, { integralCSV: csv }),
  setUserUnit: (variableName, units) =>
    set((state) => {
      const existing = state.userUnitOverrides.filter((o) => o.variableName !== variableName);
      if (units) existing.push({ variableName, units });
      return {
        userUnitOverrides: existing,
        openTabs: state.openTabs.map((t) =>
          t.id === state.activeTabId ? { ...t, userUnitOverrides: existing } : t
        ),
      };
    }),
  setLookupTables: (tables) => get().patchTabResults(get().activeTabId, { lookupTables: tables }),
  setLookupTableCSV: (name, csv, fromCache = false) => {
    const s = get();
    const lookupTableCSVs = { ...s.lookupTableCSVs, [name]: csv };
    const currentTables = s.lookupTables ?? [];
    const lookupTables = currentTables.some((t) => t.name === name)
      ? currentTables
      : [...currentTables, { name, columns: [], rows: 0 }];
    s.patchTabResults(s.activeTabId, { lookupTableCSVs, lookupTables });
    if (!fromCache) set((state) => ({ tableRev: state.tableRev + 1 }));
  },
  removeLookupTable: (name) => {
    const s = get();
    const { [name]: _removed, ...lookupTableCSVs } = s.lookupTableCSVs;
    const currentTables = s.lookupTables ?? [];
    const lookupTables = currentTables.filter((t) => t.name !== name);
    s.patchTabResults(s.activeTabId, { lookupTableCSVs, lookupTables });
    set((state) => ({ tableRev: state.tableRev + 1 }));
    if (s.selectedLookupTable === name) {
      // setSelectedLookupTable also clears a stale cell-edit flag.
      get().setSelectedLookupTable(null);
    }
  },
  scheduleConfPut: () => {
    if (confPutTimer) clearTimeout(confPutTimer);
    // Capture the text and its tab now: if the user switches tabs before the
    // timer fires, the write belongs to this tab, not to the newly shown one.
    const { conf, activeTabId } = get();
    confPutTimer = setTimeout(() => {
      if (get().activeTabId !== activeTabId) return;
      api.putConf(conf).catch((err) =>
        useModelStore.getState().addConsoleLine(`>>> ERROR saving coolsolve.conf: ${toErrMsg(err)}`)
      );
    }, 400);
  },
  scheduleEescodePut: () => {
    if (eescodePutTimer) clearTimeout(eescodePutTimer);
    const { eescode, activeTabId } = get();
    eescodePutTimer = setTimeout(() => {
      if (get().activeTabId !== activeTabId) return;
      api.putEescode(eescode).catch((err) =>
        useModelStore.getState().addConsoleLine(`>>> ERROR saving model: ${toErrMsg(err)}`)
      );
    }, 1000);
  },
  cancelPendingPuts: () => {
    if (confPutTimer) {
      clearTimeout(confPutTimer);
      confPutTimer = undefined;
    }
    if (eescodePutTimer) {
      clearTimeout(eescodePutTimer);
      eescodePutTimer = undefined;
    }
  },
}));
