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
};

/** True when this model has any run results worth keeping. */
export function hasResults(r: TabResults): boolean {
  return Boolean(
    r.lastResult ||
      r.parametricResult ||
      r.parametricStudies.length > 0 ||
      r.integralTable ||
      r.integralCSV
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

  // User unit overrides (GUI-specified units)
  userUnitOverrides: UserUnitOverride[];

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
    libraryId?: string
  ) => void;
  clearModel: () => void;
  addParametricStudy: (study: SavedParametricStudy) => void;
  removeParametricStudy: (id: string) => void;
  setIntegralTable: (table: IntegralTableData | null) => void;
  setIntegralCSV: (csv: string) => void;
  setUserUnit: (variableName: string, units: string) => void;
  setSelectedLookupTable: (name: string | null) => void;
  setLookupTables: (tables: LookupTableInfo[]) => void;
  setLookupTableCSV: (name: string, csv: string) => void;
  removeLookupTable: (name: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  /** Write the current conf to the server once typing pauses (not per keystroke). */
  scheduleConfPut: () => void;
}

/**
 * Push one tab's files to the server session. The three writes are queued in
 * this order (see api/client.ts), so fast tab switches can never leave the
 * server holding two models mixed together. Failures show in the console.
 */
function pushFiles(eescode: string, initials: string, conf: string): void {
  const writes = [
    api.putEescode(eescode),
    api.putInitials(initials),
    api.putConf(conf),
  ];
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

  userUnitOverrides: [],
  lookupTableDirty: false,
  // Switching tables swaps the grid, so any unsaved cell edits are gone: clear
  // the flag with the selection. Callers must confirm before switching when it
  // is set (see LookupTablesSetup).
  setSelectedLookupTable: (selectedLookupTable) => set({ selectedLookupTable, lookupTableDirty: false }),
  setLookupTableDirty: (lookupTableDirty) => set({ lookupTableDirty }),

  consoleLines: [],

  switchTab: (id) =>
    set((state) => {
      if (id === state.activeTabId) return state;
      const target = state.openTabs.find((t) => t.id === id);
      if (!target) return state;
      // Park the outgoing tab's content and results; nothing is deleted.
      const updatedTabs = parkActiveTab(state);
      pushFiles(target.eescode, target.initials, target.conf);
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
    }),

  closeTab: (id) =>
    set((state) => {
      const tabIndex = state.openTabs.findIndex((t) => t.id === id);
      if (tabIndex < 0) return state;

      // Park the active tab first so only the closed tab's results die.
      const parked = parkActiveTab(state);
      const remaining = parked.filter((t) => t.id !== id);
      if (remaining.length === 0) {
        const blankId = `tab-${Date.now()}`;
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
        pushFiles('', '', '');
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
        pushFiles(nextTab.eescode, nextTab.initials, nextTab.conf);
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
    }),

  closeOtherTabs: (id) =>
    set((state) => {
      const target = state.openTabs.find((t) => t.id === id);
      if (!target) return state;
      // Park first: if the kept tab is the active one, its results are in the
      // flat state, not in its entry yet.
      const kept = parkActiveTab(state).find((t) => t.id === id);
      if (!kept) return state;
      pushFiles(kept.eescode, kept.initials, kept.conf);
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
    }),

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

  newTab: () =>
    set((state) => {
      const untitledCount = state.openTabs.filter((t) => t.name.startsWith('untitled')).length;
      const name = untitledCount === 0 ? 'untitled.eescode' : `untitled-${untitledCount + 1}.eescode`;
      const id = `tab-${Date.now()}`;
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
      pushFiles('', '', '');
      return {
        openTabs: [...parkActiveTab(state), newTab],
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
    }),

  setEescode: (code) =>
    set((state) => {
      const dirty = code !== state.eescode ? true : state.dirty;
      const openTabs = state.openTabs.map((t) =>
        t.id === state.activeTabId ? { ...t, eescode: code, dirty } : t
      );
      return { eescode: code, dirty, openTabs, tryHarderAvailable: false };
    }),
  setInitials: (initials) =>
    set((state) => {
      const dirty = initials !== state.initials ? true : state.dirty;
      const openTabs = state.openTabs.map((t) =>
        t.id === state.activeTabId ? { ...t, initials, dirty } : t
      );
      return { initials, dirty, openTabs, tryHarderAvailable: false };
    }),
  setConf: (conf) =>
    set((state) => {
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
  setSolveResult: (result) => set({ lastResult: result, resultIsLive: true }),
  setParametricResult: (parametricResult) => set({ parametricResult }),
  setActiveStudyId: (activeStudyId) => set({ activeStudyId }),
  setSol: (sol) =>
    set((state) => {
      const openTabs = state.openTabs.map((t) =>
        t.id === state.activeTabId ? { ...t, sol } : t
      );
      return { sol, openTabs };
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

  loadFile: (path, eescode, initials, sol, conf, modelName, libraryId) =>
    set((state) => {
      const name = modelName
        ? `${modelName}.eescode`
        : path
          ? path.split(/[\\/]/).pop() || 'untitled.eescode'
          : 'untitled.eescode';
      const id = path || libraryId || (modelName ? `model-${modelName}` : `tab-${Date.now()}`);

      // Park the outgoing model's results in its tab: opening a file must not
      // delete the runs of whatever is on screen.
      const parked = parkActiveTab(state);
      const existingIndex = parked.findIndex(
        (t) => (path && t.filePath === path) || (libraryId && t.libraryId === libraryId) || t.id === id
      );
      let newTabs: EditorTab[];
      // A reloaded tab keeps its runs; a brand-new tab starts without any.
      let results: TabResults = NO_RESULTS;
      if (existingIndex >= 0) {
        results = tabResults(parked[existingIndex]);
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
        newTabs = isSingleUntouched ? [newTab] : [...parked, newTab];
      }

      pushFiles(eescode, initials, conf);

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
    }),

  // New Model: deliberately discards the runs of the current model (the UI
  // confirms first), and blanks the active tab entry so they cannot come back.
  clearModel: () =>
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
      userUnitOverrides: [],
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
    })),
  // Keep only the newest studies: each holds a full sweep result grid.
  addParametricStudy: (study) =>
    set((state) => ({ parametricStudies: [...state.parametricStudies, study].slice(-20) })),
  removeParametricStudy: (id) =>
    set((state) => ({ parametricStudies: state.parametricStudies.filter((s) => s.id !== id) })),
  setIntegralTable: (table) => set({ integralTable: table }),
  setIntegralCSV: (csv) => set({ integralCSV: csv }),
  setUserUnit: (variableName, units) =>
    set((state) => {
      const existing = state.userUnitOverrides.filter((o) => o.variableName !== variableName);
      if (units) existing.push({ variableName, units });
      return { userUnitOverrides: existing };
    }),
  setLookupTables: (tables) => set({ lookupTables: tables }),
  setLookupTableCSV: (name, csv) =>
    set((state) => ({
      lookupTableCSVs: { ...state.lookupTableCSVs, [name]: csv },
      lookupTables: state.lookupTables.some((t) => t.name === name)
        ? state.lookupTables
        : [...state.lookupTables, { name, columns: [], rows: 0 }],
    })),
  removeLookupTable: (name) =>
    set((state) => {
      const { [name]: _removed, ...rest } = state.lookupTableCSVs;
      return { lookupTableCSVs: rest, lookupTables: state.lookupTables.filter((t) => t.name !== name) };
    }),
  scheduleConfPut: () => {
    if (confPutTimer) clearTimeout(confPutTimer);
    confPutTimer = setTimeout(() => {
      // Read the conf at fire time: after a quick tab switch this must write
      // the active tab's conf, not the text that was current when typing began.
      const { conf } = get();
      api.putConf(conf).catch((err) =>
        useModelStore.getState().addConsoleLine(`>>> ERROR saving coolsolve.conf: ${toErrMsg(err)}`)
      );
    }, 400);
  },
}));
