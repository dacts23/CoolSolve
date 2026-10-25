// REST API client for CoolSolve backend

import type {
  ParseResponse,
  SolveResponse,
  FileOpenResponse,
  LibraryMenuResponse,
  LibraryOpenResponse,
  UploadResponse,
  SSEEvent,
  InferredVariablesResponse,
  CoolPropFluidsResponse,
  SaturationResponse,
  ParametricStudyResult,
  SweepVariable,
  LatexReportResponse,
  LatexCompileRequest,
  LookupTablesResponse,
  IntegralTableData,
  UsageStatsResponse,
} from './types';
import { sessionHeaders, withSession } from './session.ts';

const API_BASE = '/api/v1';

/** fetch() on the API with this tab's session (see session.ts). */
function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...sessionHeaders(), ...(init.headers as Record<string, string> | undefined) },
  });
}

/** Throw the server's error message for a failed response. */
async function apiError(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({ error: res.statusText }));
  throw new Error(body.error || `HTTP ${res.status}`);
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) await apiError(res);
  return res.json();
}

/**
 * Writes to the session files run one at a time, in call order. Without this,
 * overlapping callers (tab switches, config edits, solve) can interleave and
 * leave the server holding two different models mixed together.
 */
let writeQueue: Promise<unknown> = Promise.resolve();

function queued<T>(start: () => Promise<T>): Promise<T> {
  const done = writeQueue.then(start);
  writeQueue = done.catch(() => {});
  return done;
}

async function requestOptional<T>(path: string): Promise<T | null> {
  const res = await apiFetch(path, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.status === 204 || res.status === 404) return null;
  if (!res.ok) return null;
  return res.json();
}

export const api = {
  /** URL of the model bundle (ZIP) download: a plain navigation, so the session goes in the URL. */
  bundleUrl: () => withSession(`${API_BASE}/files/bundle`),

  // Health
  /** Marks this tab's session as in use: the server drops sessions idle for 24 h. */
  keepAlive: async (): Promise<void> => {
    await apiFetch('/keepalive', { method: 'POST' });
  },

  // Warmup
  warmup: () => request<{ warmupMs: number }>('/warmup', { method: 'POST' }),

  // Initial file (set by CLI when launched with a file argument)
  getInitialFile: () => requestOptional<{ path: string }>('/initial-file'),

  // Files
  getEescode: () =>
    request<{ content: string; filePath: string; modelName: string; libraryId: string }>('/files/eescode'),
  putEescode: (content: string) =>
    queued(() =>
      request<{ success: boolean }>('/files/eescode', {
        method: 'PUT',
        body: JSON.stringify({ content }),
      })
    ),

  getInitials: () => request<{ content: string }>('/files/initials'),
  putInitials: (content: string) =>
    queued(() =>
      request<{ success: boolean }>('/files/initials', {
        method: 'PUT',
        body: JSON.stringify({ content }),
      })
    ),

  getSol: () => request<{ content: string }>('/files/sol'),
  getConf: () => request<{ content: string }>('/files/conf'),
  putConf: (content: string) =>
    queued(() =>
      request<{ success: boolean }>('/files/conf', {
        method: 'PUT',
        body: JSON.stringify({ content }),
      })
    ),

  openFile: (path: string) =>
    request<FileOpenResponse>('/files/open', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  // New model (clear session)
  newModel: () =>
    request<{ success: boolean; hadContent: boolean }>('/new', { method: 'POST' }),

  // Back (restore previous model)
  goBack: () =>
    request<{ success: boolean; modelName: string }>('/back', { method: 'POST' }),

  // Model name
  getModelName: () =>
    request<{ modelName: string }>('/model-name'),
  setModelName: (modelName: string) =>
    request<{ success: boolean }>('/model-name', {
      method: 'PUT',
      body: JSON.stringify({ modelName }),
    }),

  // Parse
  parse: (source: string) =>
    request<ParseResponse>('/parse', {
      method: 'POST',
      body: JSON.stringify({ source }),
    }),

  // Solve (async — returns immediately, results come via SSE)
  // `deepSearch: true` triggers a "Try Harder" run: the deep-search pipeline
  // is used and tearing + symbolic reduction are forced on.
  solve: (options?: { eescode?: string; initials?: string; debug?: boolean; deepSearch?: boolean }) =>
    request<{ status: string }>('/solve', {
      method: 'POST',
      body: JSON.stringify(options || {}),
    }),

  // Subscribe to solve progress via SSE. `onError` runs when the stream drops.
  subscribeSolveProgress: (onEvent: (event: SSEEvent) => void, onError?: () => void): EventSource => {
    const es = new EventSource(withSession(`${API_BASE}/solve/stream`));
    es.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data) as SSEEvent;
        onEvent(data);
      } catch {
        // Ignore unparseable events
      }
    };
    es.onerror = () => {
      es.close();
      onError?.();
    };
    return es;
  },

  getSolveResult: () => request<SolveResponse>('/solve/result'),

  cancelSolve: () =>
    request<{ success: boolean; message: string }>('/solve/cancel', { method: 'POST' }),

  // Update guesses
  updateGuesses: () =>
    request<{ success: boolean }>('/update-guesses', { method: 'POST' }),

  // Model library (the CoolSolve Library embedded in the server)
  getLibraryMenu: () => request<LibraryMenuResponse>('/library/menu'),
  openLibraryModel: (id: string, file?: string) =>
    request<LibraryOpenResponse>('/library/open', {
      method: 'POST',
      body: JSON.stringify({ id, file: file ?? '' }),
    }),

  // Debug output
  getDebugFiles: () => request<{ files: { name: string; size: number }[] }>('/debug/files'),
  getDebugFile: (name: string) => request<{ name: string; content: string }>(`/debug/file?name=${encodeURIComponent(name)}`),

  // Upload ZIP file
  uploadFiles: async (formData: FormData): Promise<UploadResponse> => {
    const res = await apiFetch('/files/upload', { method: 'POST', body: formData });
    if (!res.ok) await apiError(res);
    return res.json();
  },

  // Inferred variables (thermodynamic property inference)
  getInferredVariables: () =>
    request<InferredVariablesResponse>('/variables/inferred'),

  // CoolProp fluids
  getCoolPropFluids: () =>
    request<CoolPropFluidsResponse>('/coolprop/fluids'),

  // Saturation dome
  getSaturationDome: (fluid: string, nPoints?: number) =>
    request<SaturationResponse>('/coolprop/saturation', {
      method: 'POST',
      body: JSON.stringify({ fluid, nPoints: nPoints || 200 }),
    }),

  // Parametric study (async — returns immediately, results come via SSE)
  runParametricStudy: (
    sweepVariables: SweepVariable[],
    options?: { timeout?: number; updateGuesses?: boolean },
  ) =>
    request<{ status: string; totalPoints: number }>('/parametric', {
      method: 'POST',
      body: JSON.stringify({
        sweepVariables,
        timeout: options?.timeout ?? 0,
        updateGuesses: options?.updateGuesses ?? false,
      }),
    }),

  // Get last parametric study result
  getParametricResult: () =>
    request<ParametricStudyResult>('/parametric/result'),

  // Integral (INTEGRAL/$IntegralTable) — columnar JSON of the last trajectory
  getIntegralResult: () =>
    requestOptional<{ integralTable?: IntegralTableData; integralCsvName?: string }>('/integral/result'),

  // Integral trajectory as raw CSV text (survives ZIP bundle round-trip;
  // the GUI tab parses this on bundle load when no live JSON is present)
  getIntegralCSV: async (): Promise<string | null> => {
    const res = await apiFetch('/integral/csv');
    if (res.status === 204 || res.status === 404) return null;
    if (!res.ok) return null;
    return res.text();
  },

  // LaTeX report
  getLatexReport: () =>
    request<LatexReportResponse>('/latex/report'),

  // Compile LaTeX report to PDF (returns binary PDF blob)
  compileLatexReport: async (body: LatexCompileRequest): Promise<Blob> => {
    const res = await apiFetch('/latex/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const errBody = await res.json();
        if (errBody.error) errMsg = errBody.error;
        if (errBody.log) console.warn('LaTeX log:', errBody.log);
      } catch {
        errMsg += ` ${res.statusText}`;
      }
      throw new Error(errMsg);
    }
    return res.blob();
  },

  // Lookup Tables
  getTables: () => request<LookupTablesResponse>('/tables'),

  getTableCSV: async (name: string): Promise<string> => {
    const res = await apiFetch(`/tables/${encodeURIComponent(name)}`);
    if (!res.ok) await apiError(res);
    return res.text();
  },

  putTable: async (name: string, csvContent: string): Promise<{ success: boolean; name: string; created: boolean }> => {
    const res = await apiFetch(`/tables/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/csv' },
      body: csvContent,
    });
    if (!res.ok) await apiError(res);
    return res.json();
  },

  deleteTable: (name: string) =>
    request<{ success: boolean; name: string }>(
      `/tables/${encodeURIComponent(name)}`,
      { method: 'DELETE' }
    ),

  // Usage log statistics (hidden dashboard at /stats)
  getUsageStats: () => request<UsageStatsResponse>('/stats/log'),
};
