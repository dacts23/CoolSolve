import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';

import { parseKeyValueText, updateKeyValueLines } from '../utils/conf.ts';
import { parseCSV, serializeCSV, parseCSVToTable } from '../utils/csv.ts';
import { extractArrayGrid, extractArrayColumns } from '../utils/arrayData.ts';

describe('Audit Fixes: Configuration & Key-Value Preservation (Item 10 & 13)', () => {
  it('parses key-value text ignoring comments and blank lines', () => {
    const text = `# Solver configuration\ntolerance = 1e-6\n\n# Advanced options\nmax_iter = 100\n`;
    const parsed = parseKeyValueText(text);
    assert.strictEqual(parsed.get('tolerance'), '1e-6');
    assert.strictEqual(parsed.get('max_iter'), '100');
    assert.strictEqual(parsed.size, 2);
  });

  it('keeps # inside values, strips it only after whitespace', () => {
    assert.strictEqual(parseKeyValueText('path = C#lib\n').get('path'), 'C#lib');
    assert.strictEqual(parseKeyValueText('tolerance = 1e-6 # tight\n').get('tolerance'), '1e-6');
    // Legacy compact `1#note` stays a value: files must use `1 #note`.
    assert.strictEqual(parseKeyValueText('tolerance = 1e-6#tight\n').get('tolerance'), '1e-6#tight');
  });

  it('updates existing keys in-place while preserving comments and line structure', () => {
    const original = `# Main config\n# Do not change tolerance lightly\ntolerance = 1e-6\nmax_iter = 50\n# End of config\n`;
    const updated = updateKeyValueLines(original, { tolerance: '1e-8', max_iter: '100' });
    assert.match(updated, /# Main config/);
    assert.match(updated, /# Do not change tolerance lightly/);
    assert.match(updated, /tolerance = 1e-8/);
    assert.match(updated, /max_iter = 100/);
    assert.match(updated, /# End of config/);
    // Ensure order is preserved
    const lines = updated.trim().split(/\r?\n/).filter(Boolean);
    assert.strictEqual(lines[0], '# Main config');
    assert.strictEqual(lines[1], '# Do not change tolerance lightly');
    assert.strictEqual(lines[2], 'tolerance = 1e-8');
    assert.strictEqual(lines[3], 'max_iter = 100');
    assert.strictEqual(lines[4], '# End of config');
  });

  it('appends new keys at bottom when not previously present', () => {
    const original = `tolerance = 1e-6\n`;
    const updated = updateKeyValueLines(original, { tolerance: '1e-6', new_param: 'true' });
    const lines = updated.trim().split(/\r?\n/).filter(Boolean);
    assert.strictEqual(lines[0], 'tolerance = 1e-6');
    assert.strictEqual(lines[1], 'new_param = true');
  });
});

describe('Audit Fixes: CSV RFC 4180 Escaping & Round-Trip (Item 3 & 9)', () => {
  it('handles double-quote unescaping and embedded commas', () => {
    const csv = `Col1,Col2,Col3\n"value, with comma","value with ""escaped quotes""",123.45\n`;
    const rows = parseCSV(csv);
    assert.strictEqual(rows.length, 2);
    assert.deepStrictEqual(rows[0], ['Col1', 'Col2', 'Col3']);
    assert.strictEqual(rows[1][0], 'value, with comma');
    assert.strictEqual(rows[1][1], 'value with "escaped quotes"');
    assert.strictEqual(rows[1][2], '123.45');
  });

  it('round-trips quotes and commas through serializeCSV and parseCSV', () => {
    const originalRows = [
      ['Name', 'Description', 'Formula'],
      ['Fluid', 'Water, pure', 'H2O'],
      ['QuoteTest', 'Has "quotes" inside', 'X = 42'],
    ];
    const serialized = serializeCSV(originalRows);
    const parsed = parseCSV(serialized);
    assert.deepStrictEqual(parsed, originalRows);
  });

  it('round-trips cells that contain line breaks', () => {
    const originalRows = [
      ['Name', 'Note'],
      ['row1', 'line1\nline2'],
      ['row2', 'plain'],
    ];
    assert.deepStrictEqual(parseCSV(serializeCSV(originalRows)), originalRows);
  });

  it('skips blank lines but keeps empty quoted cells', () => {
    assert.deepStrictEqual(parseCSV('a,b\n\n"","x"\n   \n'), [['a', 'b'], ['', 'x']]);
  });
});

describe('Audit Fixes: Array Data Extraction & Numeric Ordering (Item 13)', () => {
  it('extracts and sorts 1D array variables by numeric index, ignoring scalars', () => {
    const variables: Record<string, number> = {
      'T[1]': 300,
      'T[10]': 450,
      'T[2]': 320,
      'P[1]': 101325,
      'P[2]': 200000,
      'P[10]': 500000,
      'ambient_temp': 298.15,
      'total_mass': 10.5,
    };
    const { baseNames, indices, grid } = extractArrayGrid(variables);
    assert.deepStrictEqual(baseNames, ['P', 'T']);
    assert.deepStrictEqual(indices, [1, 2, 10]); // Numeric, not lexicographic [1, 10, 2]
    assert.strictEqual(grid.get('T')?.get(1), 300);
    assert.strictEqual(grid.get('T')?.get(2), 320);
    assert.strictEqual(grid.get('T')?.get(10), 450);

    const columns = extractArrayColumns(variables);
    assert.deepStrictEqual(columns.get('T'), [300, 320, 450]);
    assert.deepStrictEqual(columns.get('P'), [101325, 200000, 500000]);
  });
});

describe('Audit Fixes: Integral Table CSV Parser (Item 10)', () => {
  it('parses valid trajectory CSV into IntegralTableData', () => {
    const csv = `time,temp,pressure\n0.0,293.15,101325\n1.0,305.20,105000\n2.0,320.00,110000\n`;
    const table = parseCSVToTable(csv, 'run1.csv');
    assert.ok(table);
    assert.strictEqual(table!.integrationVar, 'time');
    assert.deepStrictEqual(table!.columns, ['time', 'temp', 'pressure']);
    assert.strictEqual(table!.numRows, 3);
    assert.deepStrictEqual(table!.data['time'], [0.0, 1.0, 2.0]);
    assert.deepStrictEqual(table!.data['temp'], [293.15, 305.20, 320.00]);
  });

  it('gracefully returns null for empty or invalid CSV text', () => {
    assert.strictEqual(parseCSVToTable('', 'empty.csv'), null);
    assert.strictEqual(parseCSVToTable('single_header_only\n', 'one_row.csv'), null);
  });
});

// ============================================================================
// GUI flow tests: the solve lifecycle and the writes a tab switch sends.
// The app stores expect browser globals at load time, so they are stubbed
// first and the stores are loaded dynamically afterwards.
// ============================================================================

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => {
      map.delete(k);
    },
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
}

interface RecordedCall {
  method: string;
  path: string;
  body: string | null;
}
const calls: RecordedCall[] = [];

class FakeEventSource {
  static last: FakeEventSource | null = null;
  onmessage: ((msg: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  listeners = new Map<string, ((msg: { data: string }) => void)[]>();
  closed = false;
  url: string;
  constructor(url: string) {
    this.url = url;
    FakeEventSource.last = this;
  }
  addEventListener(type: string, fn: (msg: { data: string }) => void): void {
    const arr = this.listeners.get(type) ?? [];
    arr.push(fn);
    this.listeners.set(type, arr);
  }
  removeEventListener(type: string, fn: (msg: { data: string }) => void): void {
    const arr = this.listeners.get(type) ?? [];
    this.listeners.set(type, arr.filter((f) => f !== fn));
  }
  close(): void {
    this.closed = true;
  }
}

const savedGlobals: Record<string, unknown> = {};
for (const k of ['localStorage', 'sessionStorage', 'window', 'EventSource', 'fetch'] as const) {
  savedGlobals[k] = (globalThis as Record<string, unknown>)[k];
}
// Restored at the end of the file so this suite never leaks into others.
function restoreGlobals(): void {
  const g = globalThis as Record<string, unknown>;
  for (const [k, v] of Object.entries(savedGlobals)) {
    if (v === undefined) delete g[k];
    else g[k] = v;
  }
}

const globals = globalThis as Record<string, unknown>;
globals.localStorage = memoryStorage();
globals.sessionStorage = memoryStorage();
globals.window = {
  location: { hostname: 'localhost', pathname: '/', search: '' },
  matchMedia: () => ({ addEventListener: () => {} }),
  addEventListener: () => {},
  removeEventListener: () => {},
};
globals.EventSource = FakeEventSource;
globals.fetch = async (url: string | URL | Request, init?: RequestInit) => {
  calls.push({
    method: init?.method ?? 'GET',
    path: String(url),
    body: typeof init?.body === 'string' ? init.body : null,
  });
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ success: true }),
    text: async () => '',
  };
};

const { fmt, useParametricStore } = await import('../stores/parametricStore.ts');
const { setRunBusy } = await import('../utils/runBusy.ts');
const { useModelStore, hasResults } = await import('../stores/modelStore.ts');
const { handleSolve, handleStopSolve } = await import('../utils/useSolveRunner.ts');

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

/** The empty run-results state every fresh tab starts with. */
function noResults() {
  return {
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
}

describe('Audit Fixes: solve lifecycle always returns to idle (Item 1)', () => {
  it('returns to idle when the run finishes', async () => {
    useModelStore.getState().setEescode('x = 1');
    await handleSolve();
    assert.strictEqual(useModelStore.getState().solving, true);
    const es = FakeEventSource.last!;
    es.onmessage!({ data: JSON.stringify({ type: 'done', message: 'ok' }) });
    assert.strictEqual(useModelStore.getState().solving, false);
    assert.strictEqual(es.closed, true);
  });

  it('returns to idle when the user stops the run', async () => {
    useModelStore.getState().setEescode('x = 1');
    await handleSolve();
    assert.strictEqual(useModelStore.getState().solving, true);
    await handleStopSolve();
    assert.strictEqual(useModelStore.getState().solving, false);
  });

  it('returns to idle when the progress stream drops', async () => {
    useModelStore.getState().setEescode('x = 1');
    await handleSolve();
    assert.strictEqual(useModelStore.getState().solving, true);
    FakeEventSource.last!.onerror!();
    assert.strictEqual(useModelStore.getState().solving, false);
    assert.match(useModelStore.getState().consoleLines.join('\n'), /lost connection/);
  });
});

describe('Audit Fixes: Try Harder is not re-offered after a deep search (Item 5)', () => {
  it('offers the rescue run only after an ordinary failed solve', async () => {
    const failure = JSON.stringify({
      type: 'error',
      message: 'failed',
      result: { status: 'Failed', isSquare: true, blockResults: [], errorMessage: 'nope' },
    });

    useModelStore.getState().setEescode('x = 1');
    await handleSolve(false, true); // deep search run
    FakeEventSource.last!.onmessage!({ data: failure });
    assert.strictEqual(useModelStore.getState().tryHarderAvailable, false);

    await handleSolve(false, false); // ordinary run can be rescued
    FakeEventSource.last!.onmessage!({ data: failure });
    assert.strictEqual(useModelStore.getState().tryHarderAvailable, true);
  });
});

describe('Audit Fixes: tab switches write one model at a time (Item 2)', () => {
  it('writes the switched-to tab last and never mixes two tabs', async () => {
    const tab = (id: string) => ({
      id,
      name: `${id}.eescode`,
      filePath: '',
      modelName: '',
      libraryId: '',
      eescode: `code${id}`,
      initials: `init${id}`,
      sol: '',
      conf: `conf${id}`,
      dirty: false,
      ...noResults(),
    });
    useModelStore.setState({
      openTabs: [tab('a'), tab('b')],
      activeTabId: 'a',
      eescode: 'codea',
      initials: 'inita',
      conf: 'confa',
    });
    calls.length = 0;

    useModelStore.getState().switchTab('b');
    useModelStore.getState().switchTab('a');
    await tick();

    // Queued in call order: tab b written fully, then tab a fully.
    assert.deepStrictEqual(
      calls.map((c) => [c.path.replace('/api/v1/files/', ''), JSON.parse(c.body ?? '{}').content]),
      [
        ['eescode', 'codeb'],
        ['initials', 'initb'],
        ['conf', 'confb'],
        ['eescode', 'codea'],
        ['initials', 'inita'],
        ['conf', 'confa'],
      ]
    );
  });

  it('solves exactly what the editor holds, conf included', async () => {
    useModelStore.setState({ eescode: 'y = 2', initials: 'y=1', conf: 'maxIterations = 5' });
    calls.length = 0;
    await handleSolve();
    assert.deepStrictEqual(
      calls.slice(0, 3).map((c) => [c.path.replace('/api/v1/files/', ''), JSON.parse(c.body ?? '{}').content]),
      [
        ['eescode', 'y = 2'],
        ['initials', 'y=1'],
        ['conf', 'maxIterations = 5'],
      ]
    );
    // Finish the run so the busy flag does not leak into later suites.
    FakeEventSource.last!.onmessage!({ data: JSON.stringify({ type: 'done', message: 'ok' }) });
    await tick();
    assert.strictEqual(useModelStore.getState().solving, false);
  });
});

describe('Audit Fixes: number formatting never throws (Item 8 & 11)', () => {
  it('prints "-" for missing or non-finite values', () => {
    assert.strictEqual(fmt(undefined as unknown as number), '-');
    assert.strictEqual(fmt(NaN), '-');
    assert.strictEqual(fmt(Infinity), '-');
  });

  it('formats ordinary values', () => {
    assert.strictEqual(fmt(42), '42');
  });
});

describe('Run results live with their tab (tab results fix)', () => {
  const tab = (id: string, code: string) => ({
    id,
    name: `${id}.eescode`,
    filePath: '',
    modelName: '',
    libraryId: '',
    eescode: code,
    initials: '',
    sol: '',
    conf: '',
    dirty: false,
    ...noResults(),
  });

  it('keeps results across tab switches and restores them', () => {
    setRunBusy(false);
    useModelStore.setState({
      openTabs: [tab('a', 'codea'), tab('b', 'codeb')],
      activeTabId: 'a',
      eescode: 'codea',
      initials: '',
      conf: '',
      sol: '',
      dirty: false,
      ...noResults(),
    });

    useModelStore.getState().setSolveResult({ success: true, status: 'a-run' } as never);
    useModelStore.getState().setParametricResult({ success: true, totalPoints: 4 } as never);
    assert.strictEqual(hasResults(useModelStore.getState()), true);

    useModelStore.getState().switchTab('b');
    assert.strictEqual(useModelStore.getState().lastResult, null);
    assert.strictEqual(useModelStore.getState().parametricResult, null);
    assert.strictEqual(hasResults(useModelStore.getState()), false);

    useModelStore.getState().switchTab('a');
    assert.strictEqual(useModelStore.getState().lastResult?.status, 'a-run');
    assert.strictEqual(useModelStore.getState().parametricResult?.totalPoints, 4);
  });

  it('keeps the other tabs results when one tab is closed', () => {
    useModelStore.setState({
      openTabs: [tab('a', 'codea'), tab('b', 'codeb')],
      activeTabId: 'a',
      eescode: 'codea',
      initials: '',
      conf: '',
      sol: '',
      dirty: false,
      ...noResults(),
    });

    useModelStore.getState().setSolveResult({ success: true, status: 'a-run' } as never);
    useModelStore.getState().switchTab('b');
    useModelStore.getState().setSolveResult({ success: true, status: 'b-run' } as never);
    useModelStore.getState().closeTab('a');

    assert.strictEqual(useModelStore.getState().openTabs.length, 1);
    assert.strictEqual(useModelStore.getState().lastResult?.status, 'b-run');
  });

  it('New Model discards the runs of the current model', () => {
    useModelStore.setState({
      openTabs: [tab('a', 'codea')],
      activeTabId: 'a',
      eescode: 'codea',
      initials: '',
      conf: '',
      sol: '',
      dirty: false,
      ...noResults(),
    });
    useModelStore.getState().setSolveResult({ success: true, status: 'a-run' } as never);
    assert.strictEqual(hasResults(useModelStore.getState()), true);

    useModelStore.getState().clearModel();
    assert.strictEqual(useModelStore.getState().lastResult, null);
    assert.strictEqual(hasResults(useModelStore.getState()), false);
  });
});

describe('Audit Fixes: table dirty flag and conf debounce (Item 1 & 9)', () => {
  it('clears the table-dirty flag when the table selection changes', () => {
    useModelStore.getState().setLookupTableDirty(true);
    useModelStore.getState().setSelectedLookupTable('T1');
    assert.strictEqual(useModelStore.getState().lookupTableDirty, false);
  });

  it('writes the conf once after typing pauses', async () => {
    await tick(); // let queued writes from earlier tests land before counting
    useModelStore.getState().setConf('tolerance = 1e-8');
    calls.length = 0;
    useModelStore.getState().scheduleConfPut();
    useModelStore.getState().scheduleConfPut();
    await new Promise((resolve) => setTimeout(resolve, 500));
    const confWrites = calls.filter((c) => c.path.endsWith('/files/conf'));
    assert.strictEqual(confWrites.length, 1);
    assert.strictEqual(JSON.parse(confWrites[0].body ?? '{}').content, 'tolerance = 1e-8');
  });
});

describe('Audit Fixes: sweep steps are validated before allocating (Item 2)', () => {
  it('rejects a huge step count without sending anything', async () => {
    calls.length = 0;
    useModelStore.setState({ solving: false }); // an earlier test left a run in flight
    setRunBusy(false); // the busy flag travels with it
    useParametricStore.setState({
      var1Name: 'x',
      var1Min: '0',
      var1Max: '1',
      var1Steps: '1000000000',
      error: '',
      running: false,
    });
    await useParametricStore.getState().runStudy();
    assert.match(useParametricStore.getState().error, /Sweep 1 steps/);
    assert.strictEqual(useParametricStore.getState().running, false);
    assert.strictEqual(calls.length, 0);
  });
});

describe('Audit Fixes: saved studies are capped (Item 4)', () => {
  it('keeps only the newest 5 studies', () => {
    for (let i = 0; i < 10; i++) {
      useModelStore
        .getState()
        .addParametricStudy({ id: `s${i}`, name: `s${i}`, sweepVariables: [], result: {} as never, timestamp: i });
    }
    const studies = useModelStore.getState().parametricStudies;
    assert.strictEqual(studies.length, 5);
    assert.strictEqual(studies[0].id, 's5');
    assert.strictEqual(studies[4].id, 's9');
  });
});

describe('Audit Fixes: shared helpers and risky paths have tests (Item 17)', () => {
  it('converts units across dimensions and formats numbers', async () => {
    const { convertUnits, formatSolNumber } = await import('../utils/solutionFormat.ts');
    assert.strictEqual(convertUnits(0, 'C', 'K'), 273.15);
    assert.strictEqual(convertUnits(1, 'kPa', 'Pa'), 1000);
    assert.strictEqual(convertUnits(1, 'kPa', 'C'), null);
    assert.strictEqual(formatSolNumber(NaN), '-');
    assert.strictEqual(formatSolNumber(42), '42');
    assert.strictEqual(formatSolNumber(0.000001), (0.000001).toExponential(3));
  });

  it('detects pipeline presets including custom and deep defaults', async () => {
    const { detectPipelinePreset } = await import('../utils/pipelinePreset.ts');
    assert.strictEqual(detectPipelinePreset(new Map()), 'newton-only');
    assert.strictEqual(detectPipelinePreset(new Map(), 'solverPipeline', 'pipelineMode', true), 'sequential');
    assert.strictEqual(
      detectPipelinePreset(new Map([['solverPipeline', 'Newton'], ['pipelineMode', 'sequential']])),
      'newton-only'
    );
    assert.strictEqual(
      detectPipelinePreset(new Map([['solverPipeline', 'Newton, TrustRegion'], ['pipelineMode', 'parallel']])),
      'custom'
    );
    assert.strictEqual(
      detectPipelinePreset(new Map([['solverPipeline', 'Nope'], ['pipelineMode', 'sequential']])),
      'custom'
    );
  });

  it('resolves units with user overrides winning and spots imposed vars', async () => {
    const { buildParsedMap, resolveUnitFromMap, isImposedFromMap } =
      await import('../utils/parsedUnits.ts');
    const parsed = [
      { name: 'T_in', units: 'C', unitSource: 'code', isArray: false, isImposed: true },
    ] as never[];
    const map = buildParsedMap(parsed);
    assert.deepStrictEqual(resolveUnitFromMap('t_in', map, []), { units: 'C', source: 'code' });
    assert.deepStrictEqual(
      resolveUnitFromMap('T_IN', map, [{ variableName: 't_in', units: 'K' }]),
      { units: 'K', source: 'user' }
    );
    assert.strictEqual(isImposedFromMap('T_in', map), true);
    assert.strictEqual(isImposedFromMap('other', map), false);
    assert.strictEqual(resolveUnitFromMap('T_IN', map, []).units, 'C');
  });

  it('reads the $UnitSystem directive or falls back to the default', async () => {
    const { parseUnitSystemString, parseUnitSystemTokens } = await import('../utils/unitSystem.ts');
    assert.strictEqual(parseUnitSystemString('$UnitSystem SI C kPa kJ mass deg\nx=1'), 'SI C kPa kJ mass deg');
    assert.strictEqual(parseUnitSystemString('x = 1'), 'SI C Pa J mass deg');
    assert.deepStrictEqual(parseUnitSystemTokens('$UnitSystem SI C kPa kJ mass deg'), ['SI', 'C', 'kPa', 'kJ', 'mass', 'deg']);
  });

  it('manages one tab session id and appends it to session URLs', async () => {
    const session = await import('../api/session.ts');
    (globals.sessionStorage as Storage).clear();
    assert.strictEqual(session.getTabSessionId(), null);
    const id = session.enableTabSession();
    assert.match(id ?? '', /^[0-9a-f]{32}$/);
    assert.strictEqual(session.enableTabSession(), id); // idempotent
    assert.ok(session.withSession('/api/v1/x').includes('?sid='));
  });

  it('clamps stepping the editor font size at both ends', async () => {
    const { useUIStore } = await import('../stores/uiStore.ts');
    useUIStore.setState({ editorFontSize: 24 });
    useUIStore.getState().stepEditorFontSize(1);
    assert.strictEqual(useUIStore.getState().editorFontSize, 24);
    useUIStore.setState({ editorFontSize: 10 });
    useUIStore.getState().stepEditorFontSize(-1);
    assert.strictEqual(useUIStore.getState().editorFontSize, 10);
  });

  it('rejects a sweep with no variable before sending anything', async () => {
    calls.length = 0;
    useModelStore.setState({ solving: false });
    setRunBusy(false);
    useParametricStore.setState({
      var1Name: '',
      var1Min: '0',
      var1Max: '1',
      var1Steps: '10',
      error: '',
      running: false,
    });
    await useParametricStore.getState().runStudy();
    assert.match(useParametricStore.getState().error, /Sweep 1/);
    assert.strictEqual(useParametricStore.getState().running, false);
    assert.strictEqual(calls.length, 0);
  });

  it('removes a conf key when its value is cleared', async () => {
    const { updateKeyValueLines } = await import('../utils/conf.ts');
    assert.strictEqual(updateKeyValueLines('a = 1\nb = 2\n', { a: '' }), 'b = 2\n');
  });

  it('reloads a tab without losing its runs and drops table data on delete', () => {
    useModelStore.setState({
      openTabs: [{ id: 'a', name: 'a.eescode', filePath: '', modelName: '', libraryId: '', eescode: 'x=1', initials: '', sol: '', conf: '', dirty: false, ...noResults() }],
      activeTabId: 'a',
      eescode: 'x=1',
      initials: '',
      conf: '',
      sol: '',
      dirty: false,
      ...noResults(),
    });
    useModelStore.getState().setSolveResult({ success: true, status: 'kept' } as never);
    useModelStore.getState().loadFile('a', 'x=2', '', '', '', '', '');
    assert.strictEqual(useModelStore.getState().lastResult?.status, 'kept');
    assert.strictEqual(useModelStore.getState().eescode, 'x=2');
    useModelStore.getState().setLookupTableCSV('T', 'a,b\n1,2');
    useModelStore.getState().removeLookupTable('T');
    assert.ok(!('T' in useModelStore.getState().lookupTableCSVs));
    assert.ok(!useModelStore.getState().lookupTables.some((t) => t.name === 'T'));
  });

  it('loads a session model and ignores a stale generation', async () => {
    const { showSessionModel } = await import('../utils/sessionModel.ts');
    const realFetch = globals.fetch;
    try {
      let mode = 'A';
      globals.fetch = (async (url: string | URL | Request) => {
        const p = String(url);
        const ok = (v: unknown) => ({ ok: true, status: 200, statusText: 'OK', json: async () => v, text: async () => (typeof v === 'string' ? v : '') });
        const missing = () => ({ ok: false, status: 404, statusText: 'x', json: async () => ({ error: 'x' }), text: async () => '' });
        if (p.endsWith('/files/eescode')) {
          if (mode === 'A') await new Promise((r) => setTimeout(r, 30));
          const tag = mode;
          return ok({ content: `x=${tag}`, filePath: '', modelName: tag, libraryId: '' });
        }
        if (p.endsWith('/files/initials')) return ok({ content: '' });
        if (p.endsWith('/files/sol')) return ok({ content: '' });
        if (p.endsWith('/files/conf')) return ok({ content: '' });
        if (p.endsWith('/tables')) return ok({ tables: [] });
        return missing();
      }) as typeof fetch;
      const first = showSessionModel();
      mode = 'B';
      await showSessionModel();
      await first;
      assert.strictEqual(useModelStore.getState().eescode, 'x=B');
    } finally {
      globals.fetch = realFetch;
    }
  });

  it('reports a failed library open in the console and returns false', async () => {
    const { openLibraryModel } = await import('../utils/library.ts');
    const realFetch = globals.fetch;
    try {
      globals.fetch = (async () => ({
        ok: false, status: 500, statusText: 'x', json: async () => ({ error: 'nope' }), text: async () => '',
      })) as typeof fetch;
      useModelStore.getState().clearConsole();
      assert.strictEqual(await openLibraryModel('CSL-1'), false);
      assert.match(useModelStore.getState().consoleLines.join('\n'), /ERROR opening library model/);
    } finally {
      globals.fetch = realFetch;
    }
  });

  it('prefers a model fluid with a dome and stores the saturation dome', async () => {
    const { useDiagramStore } = await import('../stores/diagramStore.ts');
    const realFetch = globals.fetch;
    try {
      globals.fetch = (async (url: string | URL | Request) => {
        const p = String(url);
        const ok = (v: unknown) => ({ ok: true, status: 200, statusText: 'OK', json: async () => v, text: async () => '' });
        if (p.endsWith('/coolprop/fluids')) {
          return ok({
            fluids: [
              { name: 'Water', coolpropName: 'Water', type: 'pure', hasDome: true },
              { name: 'Air', coolpropName: 'Air', type: 'pure', hasDome: false },
            ],
            modelFluids: ['Water'],
          });
        }
        return ok({ fluid: 'Water', critical: { T: 1, P: 2, H: 3, S: 4, D: 5 }, triplePoint: { T: 1 }, liquid: {}, vapor: {}, nPoints: 3, computeTime_ms: 5 });
      }) as typeof fetch;
      await useDiagramStore.getState().initFluids();
      assert.strictEqual(useDiagramStore.getState().selectedFluid, 'Water');
      await useDiagramStore.getState().generate();
      assert.strictEqual(useDiagramStore.getState().satData?.fluid, 'Water');
    } finally {
      globals.fetch = realFetch;
    }
  });

  it('tracks the shared run flag without leaking', async () => {
    const runBusy = await import('../utils/runBusy.ts');
    runBusy.setRunBusy(true);
    assert.strictEqual(runBusy.isRunBusy(), true);
    runBusy.setRunBusy(false);
    assert.strictEqual(runBusy.isRunBusy(), false);
  });

  it('registers lazy editor theme variants on demand', async () => {
    const { ensureEditorTheme } = await import('../languages/editorThemes.ts');
    const defined: string[] = [];
    const fakeMonaco = {
      editor: {
        defineTheme: (name: string) => { defined.push(name); },
      },
    };
    ensureEditorTheme(fakeMonaco as never, 'coolsolve-catppuccin-dark-appbg-catppuccin-dark');
    assert.ok(defined.includes('coolsolve-catppuccin-dark-appbg-catppuccin-dark'));
  });

  it('preserves tab ordering and never evicts dirty tabs', async () => {
    const makeTab = (id: string, dirty: boolean) => ({
      id, name: id + '.eescode', filePath: '', modelName: '', libraryId: '',
      eescode: '', initials: '', sol: '', conf: '', dirty,
      lastResult: null, parametricResult: null, parametricStudies: [], activeStudyId: null,
      integralTable: null, integralCSV: '', lookupTables: [], lookupTableCSVs: {},
      selectedLookupTable: null, resultIsLive: false, userUnitOverrides: [],
    });
    // Fill with 10 dirty tabs: newTab should not drop any dirty tab
    const tabs = Array.from({ length: 10 }, (_, i) => makeTab('tab' + i, true));
    useModelStore.setState({ openTabs: tabs, activeTabId: 'tab9', dirty: true });
    useModelStore.getState().newTab();
    const currentTabs = useModelStore.getState().openTabs;
    // 10 dirty tabs + 1 new tab = 11 tabs (none of the dirty tabs evicted)
    assert.strictEqual(currentTabs.length, 11);
    assert.ok(tabs.every((t) => currentTabs.some((ct) => ct.id === t.id)));
    await tick();
  });

  it('clearModel cancels pending conf debounce write', async () => {
    await tick();
    calls.length = 0;
    useModelStore.setState({ conf: 'testConf = true', activeTabId: 'testTab' });
    useModelStore.getState().scheduleConfPut();
    useModelStore.getState().clearModel();
    await new Promise((r) => setTimeout(r, 600));
    assert.strictEqual(calls.some((c) => c.body?.includes('testConf = true')), false);
  });

  it('safeSpreadsheetCell preserves valid numbers and escapes formula injection', async () => {
    const { safeSpreadsheetCell } = await import('../utils/csv.ts');
    // Genuine numbers (positive, negative, exponents) remain untouched
    assert.strictEqual(safeSpreadsheetCell('-15.2'), '-15.2');
    assert.strictEqual(safeSpreadsheetCell('+42'), '+42');
    assert.strictEqual(safeSpreadsheetCell('0'), '0');
    assert.strictEqual(safeSpreadsheetCell('-1e-4'), '-1e-4');
    // Non-numeric spreadsheet formula triggers are quoted
    assert.strictEqual(safeSpreadsheetCell('=1+1'), "'=1+1");
    assert.strictEqual(safeSpreadsheetCell('-cmd|'), "'-cmd|");
    assert.strictEqual(safeSpreadsheetCell('@SUM(A1:A5)'), "'@SUM(A1:A5)");
    assert.strictEqual(safeSpreadsheetCell('+malicious'), "'+malicious");
  });

  it('insertAtCursor returns false when editor is unmounted', async () => {
    const { insertAtCursor } = await import('../components/editorUtils.ts');
    assert.strictEqual(insertAtCursor('test\n'), false);
  });

  it('resolveUnitFromMap consistently lets last duplicate win for array and Map', async () => {
    const { buildParsedMap, resolveUnitFromMap } = await import('../utils/parsedUnits.ts');
    const pMap = buildParsedMap([{ name: 'T', units: 'C', unitSource: 'code', isImposed: false }]);
    const overrides = [
      { variableName: 't', units: 'K' },
      { variableName: 't', units: 'F' },
    ];
    // Array format
    const resArray = resolveUnitFromMap('T', pMap, overrides);
    assert.strictEqual(resArray.units, 'F');
    // Map format
    const { buildOverrideMap } = await import('../utils/parsedUnits.ts');
    const resMap = resolveUnitFromMap('T', pMap, buildOverrideMap(overrides));
    assert.strictEqual(resMap.units, 'F');
  });

  it('diagramStore initFluids updates modelFluids on subsequent calls', async () => {
    const { useDiagramStore } = await import('../stores/diagramStore.ts');
    const realFetch = globals.fetch;
    try {
      let currentModelFluids = ['Ammonia'];
      globals.fetch = (async (url: string | URL | Request) => {
        const p = String(url);
        const ok = (v: unknown) => ({ ok: true, status: 200, statusText: 'OK', json: async () => v, text: async () => '' });
        if (p.endsWith('/coolprop/fluids')) {
          return ok({
            fluids: [
              { name: 'Water', coolpropName: 'Water', type: 'pure', hasDome: true },
              { name: 'Ammonia', coolpropName: 'Ammonia', type: 'pure', hasDome: true },
            ],
            modelFluids: currentModelFluids,
          });
        }
        return ok({ fluid: 'Ammonia', critical: { T: 1, P: 2, H: 3, S: 4, D: 5 }, triplePoint: { T: 1 }, liquid: {}, vapor: {}, nPoints: 3, computeTime_ms: 5 });
      }) as typeof fetch;

      await useDiagramStore.getState().initFluids();
      assert.deepStrictEqual(useDiagramStore.getState().modelFluids, ['Ammonia']);

      // Switch model / tab to Water
      currentModelFluids = ['Water'];
      await useDiagramStore.getState().initFluids();
      assert.deepStrictEqual(useDiagramStore.getState().modelFluids, ['Water']);
    } finally {
      globals.fetch = realFetch;
    }
  });
});

describe('Audit round 2: sparse arrays, colors, conf, strict CSV, paging, names, presets', () => {
  it('aligns sparse array columns by subscript with NaN gaps', async () => {
    const { extractArrayColumns } = await import('../utils/arrayData.ts');
    const cols = extractArrayColumns({ 'A[1]': 10, 'A[3]': 30, 'B[2]': 20, 'B[3]': 40 });
    assert.deepStrictEqual(cols.get('A'), [10, NaN, 30]);
    assert.deepStrictEqual(cols.get('B'), [NaN, 20, 40]);
  });

  it('rejects style-breaking colors in hover separators', async () => {
    const { hoverSep } = await import('../utils/plotHover.ts');
    assert.ok(!hoverSep('rgb(1,1,1);evil:1').includes('evil'));
    assert.ok(!hoverSep('#fff;color:red').includes('color:red'));
    assert.ok(hoverSep('#374151').includes('#374151'));
  });

  it('keeps # inside a value but still strips real comments', async () => {
    const { parseKeyValueText, updateKeyValueLines } = await import('../utils/conf.ts');
    assert.strictEqual(parseKeyValueText('path = C#lib\n').get('path'), 'C#lib');
    assert.strictEqual(parseKeyValueText('k = 1 # note\n').get('k'), '1');
    assert.ok(updateKeyValueLines('path = C#lib\n', { other: '2' }).includes('path = C#lib'));
  });

  it('rejects short CSV rows instead of padding NaN', async () => {
    const { parseCSVToTable } = await import('../utils/csv.ts');
    assert.throws(() => parseCSVToTable('a,b,c\n1,2\n', 'short.csv'), /Malformed CSV/);
  });

  it('never returns Infinity or NaN page counts', async () => {
    const { pageCount, clampPage } = await import('../utils/paging.ts');
    assert.strictEqual(pageCount(100, 0), 1);
    assert.strictEqual(clampPage(NaN, 100), 0);
    assert.strictEqual(clampPage(99, 10), 0);
  });

  it('blocks Windows reserved file names', async () => {
    const { sanitizeFilename } = await import('../utils/csv.ts');
    assert.ok(!/^(con|nul)(\..*)?$/i.test(sanitizeFilename('CON')));
    assert.strictEqual(sanitizeFilename('file.'), 'file');
  });

  it('matches full solver sets and the LM alias only', async () => {
    const { detectPipelinePreset, ALL_SOLVERS } = await import('../utils/pipelinePreset.ts');
    assert.strictEqual(detectPipelinePreset(new Map([['solverPipeline', ALL_SOLVERS], ['pipelineMode', 'sequential']])), 'sequential');
    assert.strictEqual(detectPipelinePreset(new Map([['solverPipeline', 'LM'], ['pipelineMode', 'sequential']])), 'lm-only');
    assert.strictEqual(detectPipelinePreset(new Map([['solverPipeline', 'Newton, TrustRegion'], ['pipelineMode', 'sequential']])), 'custom');
  });
});

describe('Parametric studies: delete clears the display, new runs take over', () => {
  const study = (id: string) => ({
    id, name: id, sweepVariables: [], result: { successCount: 1, totalPoints: 1, results: [] }, timestamp: 0,
  });
  const studyTab = (id: string, studies: never[], activeId: string | null, result: unknown) => ({
    id,
    name: `${id}.eescode`,
    filePath: '',
    modelName: '',
    libraryId: '',
    eescode: '',
    initials: '',
    sol: '',
    conf: '',
    dirty: false,
    ...noResults(),
    parametricStudies: studies,
    activeStudyId: activeId,
    parametricResult: result,
  });

  it('deleting the displayed study clears its table and plot', () => {
    const s1 = study('s1');
    const s2 = study('s2');
    useModelStore.setState({
      openTabs: [studyTab('a', [s1, s2] as never[], 's1', { marker: 'R1' })],
      activeTabId: 'a',
      parametricStudies: [s1, s2],
      activeStudyId: 's1',
      parametricResult: { marker: 'R1' },
    } as never);
    useModelStore.getState().removeParametricStudy('s1');
    const s = useModelStore.getState();
    assert.deepStrictEqual(s.parametricStudies.map((x) => x.id), ['s2']);
    assert.strictEqual(s.parametricResult, null);
    assert.strictEqual(s.activeStudyId, null);
    const entry = s.openTabs.find((t) => t.id === 'a')!;
    assert.deepStrictEqual(entry.parametricStudies.map((x) => x.id), ['s2']);
    assert.strictEqual(entry.parametricResult, null);
    assert.strictEqual(entry.activeStudyId, null);
  });

  it('deleting another study leaves the display alone', () => {
    const s1 = study('s1');
    const s2 = study('s2');
    useModelStore.setState({
      openTabs: [studyTab('a', [s1, s2] as never[], 's1', { marker: 'R1' })],
      activeTabId: 'a',
      parametricStudies: [s1, s2],
      activeStudyId: 's1',
      parametricResult: { marker: 'R1' },
    } as never);
    useModelStore.getState().removeParametricStudy('s2');
    const s = useModelStore.getState();
    assert.deepStrictEqual(s.parametricStudies.map((x) => x.id), ['s1']);
    assert.deepStrictEqual(s.parametricResult, { marker: 'R1' });
    assert.strictEqual(s.activeStudyId, 's1');
  });

  it('saving a finished study switches the display to it', () => {
    const s1 = study('s1');
    const s3 = study('s3');
    useModelStore.setState({
      openTabs: [studyTab('a', [s1] as never[], 's1', { marker: 'R1' })],
      activeTabId: 'a',
      parametricStudies: [s1],
      activeStudyId: 's1',
      parametricResult: { marker: 'R1' },
    } as never);
    useModelStore.getState().saveParametricStudy('a', s3 as never, { marker: 'R3' } as never);
    const s = useModelStore.getState();
    assert.deepStrictEqual(s.parametricResult, { marker: 'R3' });
    assert.strictEqual(s.activeStudyId, 's3');
    assert.deepStrictEqual(s.parametricStudies.map((x) => x.id), ['s1', 's3']);
    const entry = s.openTabs.find((t) => t.id === 'a')!;
    assert.deepStrictEqual(entry.parametricResult, { marker: 'R3' });
    assert.strictEqual(entry.activeStudyId, 's3');
  });

  it('loadStudy switches between studies without modal prompt and sets sweep inputs', () => {
    useParametricStore.setState({ var1Name: 'old_var', var2Name: '' });
    const studyToLoad = {
      id: 's2',
      name: 's2',
      sweepVariables: [
        { name: 'T', values: [300, 350, 400] },
        { name: 'P', values: [1, 2] },
      ],
      result: { successCount: 6, totalPoints: 6, results: [] },
      timestamp: 0,
    };
    useModelStore.setState({
      openTabs: [studyTab('a', [] as never[], 's1', null)],
      activeTabId: 'a',
      activeStudyId: 's1',
      parametricResult: null,
    } as never);

    useParametricStore.getState().loadStudy(studyToLoad as never);

    const m = useModelStore.getState();
    assert.strictEqual(m.activeStudyId, 's2');
    assert.deepStrictEqual(m.parametricResult, studyToLoad.result);

    const p = useParametricStore.getState();
    assert.strictEqual(p.var1Name, 'T');
    assert.strictEqual(p.var1Min, '300');
    assert.strictEqual(p.var1Max, '400');
    assert.strictEqual(p.var1Steps, '3');
    assert.strictEqual(p.var2Name, 'P');
    assert.strictEqual(p.var2Min, '1');
    assert.strictEqual(p.var2Max, '2');
    assert.strictEqual(p.var2Steps, '2');
  });
});

describe('Audit round 3: debounces, tab modelName sync, parametric stop race, table cache vs edit, ragged CSV', () => {
  it('loadFile and switchTab cancel pending eescode/conf debounces instead of overwriting the new model', async () => {
    await tick();
    calls.length = 0;
    useModelStore.setState({
      openTabs: [
        { id: 'a', name: 'a.eescode', filePath: '', modelName: 'modelA', libraryId: '', eescode: 'old_code', initials: '', sol: '', conf: 'old_conf', dirty: true, ...noResults() },
        { id: 'b', name: 'b.eescode', filePath: '', modelName: 'modelB', libraryId: '', eescode: 'new_code', initials: '', sol: '', conf: 'new_conf', dirty: false, ...noResults() },
      ],
      activeTabId: 'a',
      modelName: 'modelA',
      eescode: 'old_code',
      initials: '',
      conf: 'old_conf',
      dirty: true,
    } as never);
    useModelStore.getState().scheduleConfPut();
    useModelStore.getState().scheduleEescodePut();

    // Switching tabs cancels both timers and syncs the new tab's modelName
    useModelStore.getState().switchTab('b');
    await tick();
    const switchPaths = calls.map((c) => c.path);
    assert.deepStrictEqual(switchPaths, [
      '/api/v1/files/eescode',
      '/api/v1/files/initials',
      '/api/v1/files/conf',
      '/api/v1/model-name',
    ]);
    assert.strictEqual(JSON.parse(calls[3].body ?? '{}').modelName, 'modelB');
  });

  it('showSessionModel cancels pending debounces and does not re-upload session files', async () => {
    const { showSessionModel } = await import('../utils/sessionModel.ts');
    useModelStore.getState().setEescode('stale_typing');
    useModelStore.getState().scheduleEescodePut();
    calls.length = 0;
    await showSessionModel();
    const putCalls = calls.filter((c) => c.method === 'PUT');
    assert.strictEqual(putCalls.length, 0);
  });

  it('stopStudy closes the stream immediately and ignores late SSE events', async () => {
    setRunBusy(false);
    useModelStore.setState({ solving: false, eescode: 'x = 1', initials: '', conf: '' });
    useParametricStore.setState({
      var1Name: 'x',
      var1Min: '1',
      var1Max: '2',
      var1Steps: '2',
      var2Name: '',
      running: false,
      error: '',
    });
    await useParametricStore.getState().runStudy();
    assert.strictEqual(useParametricStore.getState().running, true);
    const es = FakeEventSource.last!;
    await useParametricStore.getState().stopStudy();
    assert.strictEqual(es.closed, true);
    assert.strictEqual(useParametricStore.getState().running, false);

    // A late message on the old EventSource must be ignored
    const beforeCount = useModelStore.getState().parametricStudies.length;
    es.onmessage?.({ data: JSON.stringify({ type: 'done' }) });
    await tick();
    assert.strictEqual(useModelStore.getState().parametricStudies.length, beforeCount);
  });

  it('lazy-caching a lookup table CSV during a solve keeps resultIsLive true', async () => {
    setRunBusy(false);
    useModelStore.setState({ solving: false, eescode: 'x = 1', initials: '', conf: '', lookupTableDirty: false });
    await handleSolve();
    const es = FakeEventSource.last!;
    // Read-only cache populate from getTableCSV
    useModelStore.getState().setLookupTableCSV('T1', 'a,b\n1,2\n', true);
    es.onmessage!({
      data: JSON.stringify({
        type: 'done',
        message: 'ok',
        result: { success: true, status: 'Solved', variables: { x: 1 } },
      }),
    });
    assert.strictEqual(useModelStore.getState().resultIsLive, true);
  });

  it('normalizeGridRows pads ragged rows and header-only imports into a rectangular grid', async () => {
    const { normalizeGridRows } = await import('../utils/csv.ts');
    assert.deepStrictEqual(normalizeGridRows([['A'], ['1', '2', '3'], ['4']]), [
      ['A', 'Column2', 'Column3'],
      ['1', '2', '3'],
      ['4', '', ''],
    ]);
    assert.deepStrictEqual(normalizeGridRows([['X', 'Y']]), [
      ['X', 'Y'],
      ['', ''],
    ]);
  });
});

after(restoreGlobals);
