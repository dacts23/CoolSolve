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

/**
 * PUT a session file with a timeout. Without it one hung upload blocks the
 * whole write queue (and every later save, switch and solve) with no error.
 */
async function putWithTimeout(path: string, content: string): Promise<{ success: boolean }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    return await request<{ success: boolean }>(path, {
      method: 'PUT',
      body: JSON.stringify({ content }),
      signal: ctrl.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Upload timed out after 30 s');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function postWithTimeout<T>(path: string, body: unknown, timeoutMs = 30000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
      signal: ctrl.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)} s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
async function requestOptional<T>(path: string): Promise<T | null> {
  const res = await apiFetch(path, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.status === 204 || res.status === 404) return null;
  if (!res.ok) await apiError(res);
  return res.json();
}

/** Table names become a URL path + server file: allow only safe chars. */
export function assertValidTableName(name: string): void {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(name)) {
    throw new Error('Table name must be 1-64 chars: letters, numbers, - or _');
  }
}

export const api = {
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
    queued(() => putWithTimeout('/files/eescode', content)),

  getInitials: () => request<{ content: string }>('/files/initials'),
  putInitials: (content: string) =>
    queued(() => putWithTimeout('/files/initials', content)),

  getSol: () => request<{ content: string }>('/files/sol'),
  getConf: () => request<{ content: string }>('/files/conf'),
  putConf: (content: string) =>
    queued(() => putWithTimeout('/files/conf', content)),

  openFile: (path: string) =>
    queued(() => postWithTimeout<FileOpenResponse>('/files/open', { path })),

  // New model (clear session)
  newModel: () =>
    queued(() => postWithTimeout<{ success: boolean; hadContent: boolean }>('/new', {})),

  // Back (restore previous model)
  goBack: () =>
    queued(() => postWithTimeout<{ success: boolean; modelName: string }>('/back', {})),

  // Model name
  getModelName: () =>
    request<{ modelName: string }>('/model-name'),
  setModelName: (modelName: string) =>
    queued(() =>
      request<{ success: boolean }>('/model-name', {
        method: 'PUT',
        body: JSON.stringify({ modelName }),
      })
    ),

  // Parse
  parse: (source: string) =>
    request<ParseResponse>('/parse', {
      method: 'POST',
      body: JSON.stringify({ source }),
    }),

  // Solve (async — returns immediately, results come via SSE)
  // `deepSearch: true` triggers a "Try Harder" run: the deep-search pipeline
  // is used and tearing + symbolic reduction are forced on.
  // Queued: a solve started right after edits must see the pushed files.
  solve: (options?: { eescode?: string; initials?: string; debug?: boolean; deepSearch?: boolean }) =>
    queued(() => postWithTimeout<{ status: string }>('/solve', options || {})),

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

  // Update guesses: rewrites the session initials, so it joins the write
  // queue like the other file writes.
  updateGuesses: () =>
    queued(() => postWithTimeout<{ success: boolean }>('/update-guesses', {})),

  // Model library (the CoolSolve Library embedded in the server)
  getLibraryMenu: () => request<LibraryMenuResponse>('/library/menu'),
  openLibraryModel: (id: string, file?: string) =>
    queued(() => postWithTimeout<LibraryOpenResponse>('/library/open', { id, file: file ?? '' })),

  // Debug output
  getDebugFiles: () => request<{ files: { name: string; size: number }[] }>('/debug/files'),
  getDebugFile: (name: string) => request<{ name: string; content: string }>(`/debug/file?name=${encodeURIComponent(name)}`),

  // Upload ZIP file (10 MB cap + timeout: without them a huge or stuck
  // upload hangs with no error. The server must enforce the cap too.)
  // Queued: an upload replaces the session files, so it must not interleave
  // with the file pushes of a tab switch or solve. cancelSolve stays outside
  // the queue so a stop never waits behind a stuck upload.
  uploadFiles: (formData: FormData): Promise<UploadResponse> =>
    queued(async (): Promise<UploadResponse> => {
    const f = formData.get('file');
    if (f instanceof File && f.size > 10 * 1024 * 1024) {
      throw new Error('File exceeds 10 MB limit');
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120000);
    try {
      const res = await apiFetch('/files/upload', { method: 'POST', body: formData, signal: ctrl.signal });
      if (!res.ok) await apiError(res);
      return res.json();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('Upload timed out after 120 s');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
    }),

  // Model bundle (ZIP) download via an authenticated request, so the tab
  // session id never lands in a URL (history, logs, pasted links).
  downloadBundle: async (): Promise<Blob> => {
    const res = await apiFetch('/files/bundle');
    if (!res.ok) await apiError(res);
    return res.blob();
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
  // Queued for the same reason as solve: the sweep must see the pushed files.
  runParametricStudy: (
    sweepVariables: SweepVariable[],
    options?: { timeout?: number; updateGuesses?: boolean },
  ) =>
    queued(() =>
      postWithTimeout<{ status: string; totalPoints: number }>('/parametric', {
        sweepVariables,
        timeout: options?.timeout ?? 0,
        updateGuesses: options?.updateGuesses ?? false,
      })
    ),

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
    assertValidTableName(name);
    const res = await apiFetch(`/tables/${encodeURIComponent(name)}`);
    if (!res.ok) await apiError(res);
    return res.text();
  },

  putTable: (name: string, csvContent: string): Promise<{ success: boolean; name: string; created: boolean }> =>
    queued(async () => {
      assertValidTableName(name);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30000);
      try {
        const res = await apiFetch(`/tables/${encodeURIComponent(name)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'text/csv' },
          body: csvContent,
          signal: ctrl.signal,
        });
        if (!res.ok) await apiError(res);
        return res.json();
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw new Error('Table upload timed out after 30 s');
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    }),

  deleteTable: (name: string) => {
    assertValidTableName(name);
    return queued(() =>
      request<{ success: boolean; name: string }>(
        `/tables/${encodeURIComponent(name)}`,
        { method: 'DELETE' }
      )
    );
  },

  // Usage log statistics (hidden dashboard at /stats)
  getUsageStats: () => {
    // The dashboard hides itself off-localhost, but a GUI check alone cannot
    // protect this URL (anyone can fetch it directly): refuse remote calls
    // here too. The server must gate /stats/log the same way.
    // Browsers strip brackets: [::1] arrives as ::1.
    const host = window.location.hostname;
    if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(host)) {
      return Promise.reject(new Error('Usage statistics are only available on a local install.'));
    }
    return request<UsageStatsResponse>('/stats/log');
  },
};
