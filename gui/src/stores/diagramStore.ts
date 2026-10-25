import { create } from 'zustand';
import type { FluidInfo, SaturationResponse, InferredVariable } from '../api/types';
import { api } from '../api/client';

export type DiagramType = 'T-s' | 'P-h' | 'h-s' | 'T-h';

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
  generate: () => Promise<void>;
  initFluids: () => Promise<void>;
}

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

  generate: async () => {
    const { selectedFluid, loading } = get();
    if (!selectedFluid || loading) return;
    set({ loading: true, error: '', satData: null, computeTime: null });
    try {
      const res = await api.getSaturationDome(selectedFluid);
      set({ satData: res, computeTime: res.computeTime_ms, loading: false });
    } catch (e: unknown) {
      set({
        error: e instanceof Error ? e.message : String(e),
        loading: false,
      });
    }
  },

  initFluids: async () => {
    try {
      const res = await api.getCoolPropFluids();
      const withDome = res.fluids.filter((f) => f.hasDome);
      const modelWithDome = withDome.filter((f) => res.modelFluids.includes(f.name));
      const def = modelWithDome.length > 0 ? modelWithDome[0].name : withDome[0]?.name || '';
      set({
        fluids: res.fluids,
        modelFluids: res.modelFluids,
        selectedFluid: get().selectedFluid || def,
      });
    } catch {
      // Backend unavailable
    }
  },
}));
