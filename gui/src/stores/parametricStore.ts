import { create } from 'zustand';
import { formatSolNumber } from '../utils/solutionFormat.ts';
import type {
  SweepVariable,
  SavedParametricStudy,
} from '../api/types';
import { api } from '../api/client.ts';
import { withSession } from '../api/session.ts';
import { useModelStore } from './modelStore.ts';
import type { LineDash, MarkerSymbol } from './diagramStore.ts';
import { isRunBusy, setRunBusy } from '../utils/runBusy.ts';

/** Max steps per axis; the total is capped separately below. */
const MAX_STEPS = 10000;

/** Max sweep points total: every point is a full solve. */
const MAX_TOTAL_POINTS = 10000;

/** Parse a Steps field: blank means the default 10, anything else must be 1..MAX_STEPS. */
function parseSteps(raw: string): number | null {
  if (!raw.trim()) return 10;
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n >= 1 && n <= MAX_STEPS ? n : null;
}

export function linspace(min: number, max: number, n: number): number[] {
  if (n <= 1) return [min];
  const step = (max - min) / (n - 1);
  return Array.from({ length: n }, (_, i) => min + i * step);
}

export function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

export function fmt(val: number): string {
  return formatSolNumber(val, 5);
}

let activeEventSource: EventSource | null = null;
/** Every sweep gets a new id so late answers from a stopped/superseded run are ignored. */
let studySeq = 0;

interface ParametricState {
  var1Name: string;
  var1Min: string;
  var1Max: string;
  var1Steps: string;
  var2Name: string;
  var2Min: string;
  var2Max: string;
  var2Steps: string;
  timeout: string;
  updateGuesses: boolean;
  running: boolean;
  progress: string;
  error: string;
  plotXVar: string;
  plotYVar: string;
  plotType: 'line' | 'contour';
  levels: number;

  setVar1Name: (name: string) => void;
  setVar1Min: (val: string) => void;
  setVar1Max: (val: string) => void;
  setVar1Steps: (val: string) => void;
  setVar2Name: (name: string) => void;
  setVar2Min: (val: string) => void;
  setVar2Max: (val: string) => void;
  setVar2Steps: (val: string) => void;
  setTimeoutVal: (t: string) => void;
  setUpdateGuesses: (ug: boolean) => void;
  setPlotXVar: (v: string) => void;
  setPlotYVar: (v: string) => void;
  setPlotType: (t: 'line' | 'contour') => void;
  setLevels: (n: number) => void;
  plotXLabel: string;
  plotYLabel: string;
  plotZLabel: string;
  setPlotXLabel: (v: string) => void;
  setPlotYLabel: (v: string) => void;
  setPlotZLabel: (v: string) => void;
  showContourLabels: boolean;
  setShowContourLabels: (v: boolean) => void;
  contourFill: boolean;
  setContourFill: (v: boolean) => void;
  contourLabelFormat: string;
  setContourLabelFormat: (v: string) => void;
  plotPalette: string;
  setPlotPalette: (v: string) => void;
  plotTitle: string;
  setPlotTitle: (v: string) => void;
  plotBackground: 'auto' | 'light' | 'dark';
  setPlotBackground: (v: 'auto' | 'light' | 'dark') => void;
  plotLineColor: string;
  setPlotLineColor: (v: string) => void;
  plotLineWidth: number;
  setPlotLineWidth: (v: number) => void;
  plotLineDash: LineDash;
  setPlotLineDash: (v: LineDash) => void;
  plotMarkerSymbol: MarkerSymbol | 'hidden';
  setPlotMarkerSymbol: (v: MarkerSymbol | 'hidden') => void;
  plotMarkerSize: number;
  setPlotMarkerSize: (v: number) => void;
  runStudy: () => Promise<void>;
  stopStudy: () => Promise<void>;
  loadStudy: (study: SavedParametricStudy) => void;
}

export const useParametricStore = create<ParametricState>((set, get) => ({
  var1Name: '',
  var1Min: '',
  var1Max: '',
  var1Steps: '10',
  var2Name: '',
  var2Min: '',
  var2Max: '',
  var2Steps: '10',
  timeout: '1',
  updateGuesses: false,
  running: false,
  progress: '',
  error: '',
  plotXVar: '',
  plotYVar: '',
  plotType: 'line',
  levels: 10,
  plotXLabel: '',
  plotYLabel: '',
  plotZLabel: '',
  showContourLabels: false,
  contourFill: true,
  contourLabelFormat: '.3g',
  plotPalette: 'Viridis',
  plotTitle: '',
  plotBackground: 'auto',
  plotLineColor: '#1f77b4',
  plotLineWidth: 2,
  plotLineDash: 'solid',
  plotMarkerSymbol: 'circle',
  plotMarkerSize: 6,

  setVar1Name: (var1Name) => set({ var1Name }),
  setVar1Min: (var1Min) => set({ var1Min }),
  setVar1Max: (var1Max) => set({ var1Max }),
  setVar1Steps: (var1Steps) => set({ var1Steps }),
  setVar2Name: (var2Name) => set({ var2Name }),
  setVar2Min: (var2Min) => set({ var2Min }),
  setVar2Max: (var2Max) => set({ var2Max }),
  setVar2Steps: (var2Steps) => set({ var2Steps }),
  setTimeoutVal: (timeout) => set({ timeout }),
  setUpdateGuesses: (updateGuesses) => set({ updateGuesses }),
  setPlotXVar: (plotXVar) => set({ plotXVar }),
  setPlotYVar: (plotYVar) => set({ plotYVar }),
  setPlotType: (plotType) => set({ plotType }),
  setPlotXLabel: (plotXLabel) => set({ plotXLabel }),
  setPlotYLabel: (plotYLabel) => set({ plotYLabel }),
  setPlotZLabel: (plotZLabel) => set({ plotZLabel }),
  setShowContourLabels: (showContourLabels) => set({ showContourLabels }),
  setContourFill: (contourFill) => set({ contourFill }),
  setContourLabelFormat: (contourLabelFormat) => set({ contourLabelFormat }),
  setPlotPalette: (plotPalette) => set({ plotPalette }),
  setPlotTitle: (plotTitle) => set({ plotTitle }),
  setPlotBackground: (plotBackground) => set({ plotBackground }),
  setPlotLineColor: (plotLineColor) => set({ plotLineColor }),
  setPlotLineWidth: (plotLineWidth) => set({ plotLineWidth }),
  setPlotLineDash: (plotLineDash) => set({ plotLineDash }),
  setPlotMarkerSymbol: (plotMarkerSymbol) => set({ plotMarkerSymbol }),
  setPlotMarkerSize: (plotMarkerSize) => set({ plotMarkerSize }),
  setLevels: (levels) => set({
    levels: Number.isFinite(levels) ? Math.min(100, Math.max(2, Math.round(levels))) : 10,
  }),

  runStudy: async () => {
    const {
      var1Name, var1Min, var1Max, var1Steps,
      var2Name, var2Min, var2Max, var2Steps,
      timeout, updateGuesses, running,
    } = get();

    if (running) return;
    if (useModelStore.getState().solving || isRunBusy()) {
      set({ error: 'Cannot run parametric sweep while a solve calculation is in progress.' });
      return;
    }

    const sweeps: SweepVariable[] = [];
    const n1 = parseSteps(var1Steps);
    const min1 = parseFloat(var1Min);
    const max1 = parseFloat(var1Max);
    if (!var1Name || isNaN(min1) || isNaN(max1)) {
      set({ error: 'Please select a variable and enter valid min/max for Sweep 1.' });
      return;
    }
    if (n1 === null) {
      set({ error: `Sweep 1 steps must be a whole number between 1 and ${MAX_STEPS}.` });
      return;
    }
    sweeps.push({ name: var1Name, values: linspace(min1, max1, n1) });

    if (var2Name) {
      const n2 = parseSteps(var2Steps);
      const min2 = parseFloat(var2Min);
      const max2 = parseFloat(var2Max);
      if (isNaN(min2) || isNaN(max2)) {
        set({ error: 'Please enter valid min/max for Sweep 2.' });
        return;
      }
      if (n2 === null) {
        set({ error: `Sweep 2 steps must be a whole number between 1 and ${MAX_STEPS}.` });
        return;
      }
      sweeps.push({ name: var2Name, values: linspace(min2, max2, n2) });
    }

    const totalPoints = sweeps.reduce((n, s) => n * s.values.length, 1);
    if (totalPoints > MAX_TOTAL_POINTS) {
      set({ error: `That sweep is ${totalPoints} solves (max ${MAX_TOTAL_POINTS}). Reduce steps or drop a sweep axis.` });
      return;
    }

    const seq = ++studySeq;
    const tabId = useModelStore.getState().activeTabId;
    // Explicit snapshot push below covers typing: drop pending debounces first.
    useModelStore.getState().cancelPendingPuts();
    // Snapshot: the sweep runs exactly this text even if the user keeps typing.
    const ms = useModelStore.getState();
    const pushed = { eescode: ms.eescode, initials: ms.initials, conf: ms.conf, tableRev: ms.tableRev };

    set({
      error: '',
      running: true,
      progress: 'Starting parametric study...',
    });
    setRunBusy(true, 'parametric');

    try {
      // Push the whole model so the sweep runs what the editor shows.
      await api.putEescode(pushed.eescode);
      await api.putInitials(pushed.initials);
      await api.putConf(pushed.conf);

      const timeoutSec = Math.max(0, Math.round(parseFloat(timeout) || 0));
      await api.runParametricStudy(sweeps, {
        timeout: timeoutSec,
        updateGuesses,
      });
      if (seq !== studySeq) return;

      if (activeEventSource) {
        activeEventSource.close();
      }

      const es = new EventSource(withSession('/api/v1/solve/stream'));
      activeEventSource = es;

    // Warn once when the model moved on mid-sweep: the points belong to the
    // uploaded text, not to what the editor shows now. Skipped after a tab
    // switch: the current tab is a different model, the result went home.
    const warnIfEdited = () => {
      const s = useModelStore.getState();
      if (s.activeTabId !== tabId) return false;
      if (s.eescode !== pushed.eescode || s.initials !== pushed.initials || s.conf !== pushed.conf) {
        s.addConsoleLine('>>> WARNING: the model was edited during the sweep; these points match the uploaded text.');
        return true;
      }
      if (s.tableRev !== pushed.tableRev || s.lookupTableDirty) {
        s.addConsoleLine('>>> WARNING: a lookup table was edited during the sweep; these points match the uploaded tables.');
        return true;
      }
      return false;
    };
    // At most 5 progress updates per second: thousands of points must not jank the UI.
    let lastProgressAt = 0;

      es.onmessage = (msg) => {
        if (seq !== studySeq) {
          es.close();
          return;
        }
        try {
          const data = JSON.parse(msg.data);
          if (data.type === 'progress' || data.type === 'block') {
            const now = Date.now();
            if (now - lastProgressAt >= 200) {
              lastProgressAt = now;
              set({ progress: data.message || `Point ${data.block || '?'}...` });
            }
          } else if (data.type === 'done') {
            es.close();
            activeEventSource = null;
            api.getParametricResult()
              .then((result) => {
                if (seq !== studySeq) return;
                set({ running: false, progress: '' });
                setRunBusy(false, 'parametric');
                warnIfEdited();
                const study: SavedParametricStudy = {
                  id: makeId(),
                  name: sweeps.map((s) => s.name).join(' × '),
                  sweepVariables: sweeps,
                  result,
                  timestamp: Date.now(),
                };
                useModelStore.getState().saveParametricStudy(tabId, study, result);
              })
              .catch((err) => {
                if (seq !== studySeq) return;
                set({ error: 'Failed to fetch results: ' + err.message, running: false });
                setRunBusy(false, 'parametric');
              });
          } else if (data.type === 'error') {
            es.close();
            activeEventSource = null;
            set({ error: data.message || 'Parametric study failed' });
            api.getParametricResult()
              .then((result) => {
                if (seq !== studySeq) return;
                set({ running: false });
                setRunBusy(false, 'parametric');
                warnIfEdited();
                if (result.successCount > 0) {
                  const study: SavedParametricStudy = {
                    id: makeId(),
                    name: sweeps.map((s) => s.name).join(' × '),
                    sweepVariables: sweeps,
                    result,
                    timestamp: Date.now(),
                  };
                  useModelStore.getState().saveParametricStudy(tabId, study, result);
                } else {
                  useModelStore.getState().patchTabResults(tabId, { parametricResult: result });
                }
              })
              .catch(() => {
                if (seq !== studySeq) return;
                set({ running: false });
                setRunBusy(false, 'parametric');
              });
          }
        } catch {
          // Ignore parse errors on malformed SSE frames
        }
      };

      es.onerror = () => {
        es.close();
        if (seq !== studySeq) return;
        activeEventSource = null;
        if (get().running) {
          api.getParametricResult()
            .then((result) => {
              if (seq !== studySeq) return;
              set({ running: false });
              setRunBusy(false, 'parametric');
              useModelStore.getState().patchTabResults(tabId, { parametricResult: result });
            })
            .catch(() => {
              if (seq !== studySeq) return;
              set({ error: 'Lost connection during parametric study.', running: false });
              setRunBusy(false, 'parametric');
            });
        } else {
          setRunBusy(false, 'parametric');
        }
      };
    } catch (err: unknown) {
      if (seq !== studySeq) return;
      set({
        error: err instanceof Error ? err.message : 'Failed to start parametric study',
        running: false,
      });
      setRunBusy(false, 'parametric');
    }
  },

  stopStudy: async () => {
    // Idle stop must be silent and must not touch the other runner's flag.
    // Never cancel another owner's run (e.g. a live solve).
    if (!get().running) return;
    studySeq++;
    if (activeEventSource) {
      activeEventSource.close();
      activeEventSource = null;
    }
    set({ running: false, progress: 'Stopped.' });
    setRunBusy(false, 'parametric');
    try {
      await api.cancelSolve();
    } catch {
      // Ignore cancel errors if solver already stopped
    }
  },

  loadStudy: (study: SavedParametricStudy) => {
    const tabId = useModelStore.getState().activeTabId;
    useModelStore.getState().patchTabResults(tabId, {
      parametricResult: study.result,
      activeStudyId: study.id,
    });
    if (study.sweepVariables[0]) {
      const s = study.sweepVariables[0];
      set({
        var1Name: s.name,
        var1Min: s.values[0]?.toString() || '',
        var1Max: s.values[s.values.length - 1]?.toString() || '',
        var1Steps: s.values.length.toString(),
      });
    }
    if (study.sweepVariables[1]) {
      const s = study.sweepVariables[1];
      set({
        var2Name: s.name,
        var2Min: s.values[0]?.toString() || '',
        var2Max: s.values[s.values.length - 1]?.toString() || '',
        var2Steps: s.values.length.toString(),
      });
    } else {
      set({ var2Name: '' });
    }
  },
}));
