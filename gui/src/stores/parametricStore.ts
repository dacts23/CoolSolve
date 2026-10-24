import { create } from 'zustand';
import type {
  SweepVariable,
  ParametricStudyResult,
  SavedParametricStudy,
} from '../api/types';
import { api } from '../api/client';
import { withSession } from '../api/session';
import { useModelStore } from './modelStore';

export function linspace(min: number, max: number, n: number): number[] {
  if (n <= 1) return [min];
  const step = (max - min) / (n - 1);
  return Array.from({ length: n }, (_, i) => min + i * step);
}

export function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

export function fmt(val: number): string {
  if (Number.isInteger(val) && Math.abs(val) < 1e9) return val.toString();
  if (Math.abs(val) < 0.01 || Math.abs(val) >= 1e6) return val.toExponential(4);
  return val.toPrecision(5);
}

let activeEventSource: EventSource | null = null;

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
  activeResult: ParametricStudyResult | null;
  activeStudyId: string | null;
  plotXVar: string;
  plotYVar: string;
  plotType: 'line' | 'contour';

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
  activeResult: null,
  activeStudyId: null,
  plotXVar: '',
  plotYVar: '',
  plotType: 'line',

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

  runStudy: async () => {
    const {
      var1Name, var1Min, var1Max, var1Steps,
      var2Name, var2Min, var2Max, var2Steps,
      timeout, updateGuesses, running,
    } = get();

    if (running) return;

    const sweeps: SweepVariable[] = [];
    const n1 = parseInt(var1Steps, 10) || 10;
    const min1 = parseFloat(var1Min);
    const max1 = parseFloat(var1Max);
    if (!var1Name || isNaN(min1) || isNaN(max1)) {
      set({ error: 'Please select a variable and enter valid min/max for Sweep 1.' });
      return;
    }
    sweeps.push({ name: var1Name, values: linspace(min1, max1, n1) });

    if (var2Name) {
      const n2 = parseInt(var2Steps, 10) || 10;
      const min2 = parseFloat(var2Min);
      const max2 = parseFloat(var2Max);
      if (isNaN(min2) || isNaN(max2)) {
        set({ error: 'Please enter valid min/max for Sweep 2.' });
        return;
      }
      sweeps.push({ name: var2Name, values: linspace(min2, max2, n2) });
    }

    set({
      error: '',
      running: true,
      progress: 'Starting parametric study...',
      activeResult: null,
      activeStudyId: null,
    });

    try {
      const timeoutSec = Math.max(0, Math.round(parseFloat(timeout) || 0));
      await api.runParametricStudy(sweeps, {
        timeout: timeoutSec,
        updateGuesses,
      });

      if (activeEventSource) {
        activeEventSource.close();
      }

      const es = new EventSource(withSession('/api/v1/solve/stream'));
      activeEventSource = es;

      es.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.type === 'progress' || data.type === 'block') {
            set({ progress: data.message || `Point ${data.block || '?'}...` });
          } else if (data.type === 'done') {
            es.close();
            activeEventSource = null;
            api.getParametricResult()
              .then((result) => {
                set({ activeResult: result, running: false, progress: '' });
                const study: SavedParametricStudy = {
                  id: makeId(),
                  name: sweeps.map((s) => s.name).join(' × '),
                  sweepVariables: sweeps,
                  result,
                  timestamp: Date.now(),
                };
                useModelStore.getState().addParametricStudy(study);
                set({ activeStudyId: study.id });
              })
              .catch((err) => {
                set({ error: 'Failed to fetch results: ' + err.message, running: false });
              });
          } else if (data.type === 'error') {
            es.close();
            activeEventSource = null;
            set({ error: data.message || 'Parametric study failed' });
            api.getParametricResult()
              .then((result) => {
                set({ activeResult: result, running: false });
                if (result.successCount > 0) {
                  const study: SavedParametricStudy = {
                    id: makeId(),
                    name: sweeps.map((s) => s.name).join(' × '),
                    sweepVariables: sweeps,
                    result,
                    timestamp: Date.now(),
                  };
                  useModelStore.getState().addParametricStudy(study);
                  set({ activeStudyId: study.id });
                }
              })
              .catch(() => {
                set({ running: false });
              });
          }
        } catch {
        }
      };

      es.onerror = () => {
        es.close();
        activeEventSource = null;
        if (get().running) {
          api.getParametricResult()
            .then((result) => {
              set({ activeResult: result, running: false });
            })
            .catch(() => {
              set({ error: 'Lost connection during parametric study.', running: false });
            });
        }
      };
    } catch (err: unknown) {
      set({
        error: err instanceof Error ? err.message : 'Failed to start parametric study',
        running: false,
      });
    }
  },

  stopStudy: async () => {
    try {
      await api.cancelSolve();
      if (activeEventSource) {
        activeEventSource.close();
        activeEventSource = null;
      }
      set({ running: false, progress: 'Stopped.' });
    } catch {
    }
  },

  loadStudy: (study: SavedParametricStudy) => {
    set({
      activeResult: study.result,
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
