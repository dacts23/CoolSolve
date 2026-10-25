import { create } from 'zustand';
import type { FluidInfo, SaturationResponse, InferredVariable } from '../api/types';
import { api } from '../api/client.ts';

export type DiagramType = 'T-s' | 'P-h' | 'h-s' | 'T-h';

export type LineDash = 'solid' | 'dash' | 'dot' | 'dashdot';

export type MarkerSymbol = 'circle' | 'square' | 'diamond' | 'triangle-up' | 'triangle-down' | 'star' | 'cross' | 'x';

export const MARKER_SYMBOL_OPTIONS = [
  { value: 'circle', label: 'Circle' },
  { value: 'square', label: 'Square' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'triangle-up', label: 'Triangle up' },
  { value: 'triangle-down', label: 'Triangle down' },
  { value: 'star', label: 'Star' },
  { value: 'cross', label: 'Cross' },
  { value: 'x', label: 'X' },
] as const;

export interface DomeLineStyle {
  color: string;
  width: number;
  dash: LineDash;
}

export interface MarkerStyle {
  color: string;
  size: number;
  symbol: MarkerSymbol;
}

export interface CycleLineStyle {
  color: string;
  width: number;
  dash: LineDash;
  markerSize: number;
  markerSymbol: MarkerSymbol;
}

export type LegendPosition = 'off' | 'tl' | 'tr' | 'bl' | 'br';

export interface DiagramConfig {
  xProp: 'T' | 'P' | 'H' | 'S' | 'D';
  yProp: 'T' | 'P' | 'H' | 'S' | 'D';
  xLabel: string;
  yLabel: string;
  yLog: boolean;
}

export const DIAGRAM_CONFIGS: Record<DiagramType, DiagramConfig> = {
  'T-s': { xProp: 'S', yProp: 'T', xLabel: 'Entropy [J/(kg·K)]', yLabel: 'Temperature [°C]', yLog: false },
  'P-h': { xProp: 'H', yProp: 'P', xLabel: 'Enthalpy [J/kg]', yLabel: 'Pressure [Pa]', yLog: true },
  'h-s': { xProp: 'S', yProp: 'H', xLabel: 'Entropy [J/(kg·K)]', yLabel: 'Enthalpy [J/kg]', yLog: false },
  'T-h': { xProp: 'H', yProp: 'T', xLabel: 'Enthalpy [J/kg]', yLabel: 'Temperature [°C]', yLog: false },
};

export const DIAGRAM_TYPE_OPTIONS = [
  { value: 'T-s', label: 'T-s (Temperature – Entropy)' },
  { value: 'P-h', label: 'P-h (Pressure – Enthalpy)' },
  { value: 'h-s', label: 'h-s (Enthalpy – Entropy / Mollier)' },
  { value: 'T-h', label: 'T-h (Temperature – Enthalpy)' },
] as const;

export const PROP_UNITS: Record<string, string> = {
  T: '[°C]',
  P: '[Pa]',
  H: '[J/kg]',
  S: '[J/(kg·K)]',
  D: '[kg/m³]',
  Q: '',
};

interface DiagramState {
  fluids: FluidInfo[];
  modelFluids: string[];
  selectedFluid: string;
  diagramType: DiagramType;
  satData: SaturationResponse | null;
  loading: boolean;
  error: string;
  computeTime: number | null;
  showStates: boolean;
  inferredVars: InferredVariable[];
  showArrayOverlay: boolean;
  arrayXVar: string;
  arrayYVar: string;
  closeCycle: boolean;
  plotTitle: string;
  plotXLabel: string;
  plotYLabel: string;
  plotBackground: 'auto' | 'light' | 'dark';
  domeStyle: DomeLineStyle;
  critStyle: MarkerStyle;
  stateStyle: MarkerStyle;
  cycleStyle: CycleLineStyle;
  legendPosition: LegendPosition;

  setFluids: (fluids: FluidInfo[]) => void;
  setModelFluids: (mf: string[]) => void;
  setSelectedFluid: (f: string) => void;
  setDiagramType: (dt: DiagramType) => void;
  setSatData: (data: SaturationResponse | null) => void;
  setLoading: (l: boolean) => void;
  setError: (e: string) => void;
  setComputeTime: (t: number | null) => void;
  setShowStates: (s: boolean) => void;
  setInferredVars: (vars: InferredVariable[]) => void;
  setShowArrayOverlay: (s: boolean) => void;
  setArrayXVar: (v: string) => void;
  setArrayYVar: (v: string) => void;
  setCloseCycle: (c: boolean) => void;
  setPlotTitle: (v: string) => void;
  setPlotXLabel: (v: string) => void;
  setPlotYLabel: (v: string) => void;
  setPlotBackground: (v: 'auto' | 'light' | 'dark') => void;
  setDomeStyle: (patch: Partial<DomeLineStyle>) => void;
  setCritStyle: (patch: Partial<MarkerStyle>) => void;
  setStateStyle: (patch: Partial<MarkerStyle>) => void;
  setCycleStyle: (patch: Partial<CycleLineStyle>) => void;
  setLegendPosition: (v: LegendPosition) => void;
  generate: () => Promise<void>;
  initFluids: () => Promise<void>;
}

/** In-flight fetch guard so StrictMode double-mount or rapid visits do not duplicate calls. */
let inFlight: Promise<void> | null = null;

export const useDiagramStore = create<DiagramState>((set, get) => ({
  fluids: [],
  modelFluids: [],
  selectedFluid: '',
  diagramType: 'T-s',
  satData: null,
  loading: false,
  error: '',
  computeTime: null,
  showStates: true,
  inferredVars: [],
  showArrayOverlay: false,
  arrayXVar: '',
  arrayYVar: '',
  closeCycle: false,
  plotTitle: '',
  plotXLabel: '',
  plotYLabel: '',
  plotBackground: 'auto',
  domeStyle: { color: '#1f77b4', width: 2, dash: 'solid' },
  critStyle: { color: '#d62728', size: 8, symbol: 'diamond' },
  stateStyle: { color: '#2ca02c', size: 8, symbol: 'circle' },
  cycleStyle: { color: '#ff7f0e', width: 2, dash: 'dot', markerSize: 6, markerSymbol: 'circle' },
  legendPosition: 'tl',

  setFluids: (fluids) => set({ fluids }),
  setModelFluids: (modelFluids) => set({ modelFluids }),
  setSelectedFluid: (selectedFluid) => set({ selectedFluid, satData: null }),
  setDiagramType: (diagramType) => set({ diagramType }),
  setSatData: (satData) => set({ satData }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setComputeTime: (computeTime) => set({ computeTime }),
  setShowStates: (showStates) => set({ showStates }),
  setInferredVars: (inferredVars) => set({ inferredVars }),
  setShowArrayOverlay: (showArrayOverlay) => set({ showArrayOverlay }),
  setArrayXVar: (arrayXVar) => set({ arrayXVar }),
  setArrayYVar: (arrayYVar) => set({ arrayYVar }),
  setCloseCycle: (closeCycle) => set({ closeCycle }),
  setPlotTitle: (plotTitle) => set({ plotTitle }),
  setPlotXLabel: (plotXLabel) => set({ plotXLabel }),
  setPlotYLabel: (plotYLabel) => set({ plotYLabel }),
  setPlotBackground: (plotBackground) => set({ plotBackground }),
  setDomeStyle: (patch) => set((s) => ({ domeStyle: { ...s.domeStyle, ...patch } })),
  setCritStyle: (patch) => set((s) => ({ critStyle: { ...s.critStyle, ...patch } })),
  setStateStyle: (patch) => set((s) => ({ stateStyle: { ...s.stateStyle, ...patch } })),
  setCycleStyle: (patch) => set((s) => ({ cycleStyle: { ...s.cycleStyle, ...patch } })),
  setLegendPosition: (legendPosition) => set({ legendPosition }),

  generate: async () => {
    const { selectedFluid, loading } = get();
    if (!selectedFluid) return;
    // One flight at a time: a click mid-flight is remembered via
    // selectedFluid and chained below, so the dome always matches the selector.
    if (loading) return;
    const fluid = selectedFluid;
    set({ loading: true, error: '', satData: null, computeTime: null });
    // The user may pick another fluid mid-flight: drop this answer and run
    // the newly selected one instead of showing the wrong dome.
    const finishFor = (patch: Partial<DiagramState>): void => {
      if (get().selectedFluid !== fluid) {
        set({ ...patch, loading: false, satData: null });
        void get().generate();
        return;
      }
      set({ ...patch, loading: false });
    };
    try {
      const res = await api.getSaturationDome(fluid);
      finishFor({ satData: res, computeTime: res.computeTime_ms });
    } catch (e: unknown) {
      finishFor({
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  initFluids: async () => {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const res = await api.getCoolPropFluids();
        const withDome = res.fluids.filter((f) => f.hasDome);
        const modelWithDome = withDome.filter((f) => res.modelFluids.includes(f.name));
        const def = modelWithDome.length > 0 ? modelWithDome[0].name : withDome[0]?.name || '';
        const current = get().selectedFluid;
        set({
          fluids: res.fluids,
          modelFluids: res.modelFluids,
          selectedFluid: current && withDome.some((f) => f.name === current) ? current : def,
        });
      } catch {
        // Backend unavailable: retry on next visit
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  },
}));
