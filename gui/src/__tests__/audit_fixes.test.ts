import { describe, it } from 'node:test';
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
  closed = false;
  url: string;
  constructor(url: string) {
    this.url = url;
    FakeEventSource.last = this;
  }
  close(): void {
    this.closed = true;
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
  it('keeps only the newest 20 studies', () => {
    for (let i = 0; i < 25; i++) {
      useModelStore
        .getState()
        .addParametricStudy({ id: `s${i}`, name: `s${i}`, sweepVariables: [], result: {} as never, timestamp: i });
    }
    const studies = useModelStore.getState().parametricStudies;
    assert.strictEqual(studies.length, 20);
    assert.strictEqual(studies[0].id, 's5');
    assert.strictEqual(studies[19].id, 's24');
  });
});
