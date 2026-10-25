import { useModelStore } from '../stores/modelStore.ts';
import { useUIStore } from '../stores/uiStore.ts';
import { useParametricStore } from '../stores/parametricStore.ts';
import { api } from '../api/client.ts';
import { isRunBusy, setRunBusy } from './runBusy.ts';
import { toErrMsg } from './errors.ts';
import type { SSEEvent, SolveResponse } from '../api/types';

let activeEventSource: EventSource | null = null;
/** Every run gets a new id. Late answers from a superseded run are ignored. */
let runSeq = 0;

/**
 * End a run: close its stream and clear the running flags. Every path that can
 * end a run (done, error, stop, dropped connection) goes through here, so the
 * UI can never get stuck on "Solving…". Stale runs only close their stream.
 */
function finishRun(es: EventSource | null, seq: number): void {
  if (es) es.close();
  if (seq !== runSeq) return;
  if (activeEventSource === es) activeEventSource = null;
  const s = useModelStore.getState();
  s.setSolving(false);
  s.setDeepSearchRunning(false);
  setRunBusy(false, 'solve');
}

/** Start a solve run (or a Deep Search when `deepSearch`). Progress arrives via SSE. */
export async function handleSolve(debug = false, deepSearch = false): Promise<void> {
  const model = useModelStore.getState();
  if (!model.eescode.trim()) return;
  if (useParametricStore.getState().running) {
    useUIStore.getState().setBottomTab('console');
    model.addConsoleLine('>>> Cannot solve while a parametric study is in progress.');
    return;
  }
  // The buttons are disabled while running, but F2/Enter reach here directly.
  if (isRunBusy()) {
    model.addConsoleLine('>>> Cannot solve while a run is in progress.');
    return;
  }
  const seq = ++runSeq;
  setRunBusy(true, 'solve');
  const tabId = model.activeTabId;
  // Explicit snapshot push below covers typing: drop pending debounces first
  // so a stale timer cannot overwrite the snapshot.
  model.cancelPendingPuts();
  // Snapshot: the run solves exactly this text even if the user keeps typing.
  const pushed = { eescode: model.eescode, initials: model.initials, conf: model.conf, tableRev: model.tableRev };
  model.setSolving(true);
  model.setDeepSearchRunning(deepSearch);
  model.setTryHarderAvailable(false);
  model.clearConsole();
  useUIStore.getState().setBottomTab('console');
  model.addConsoleLine(
    deepSearch
      ? '>>> Starting deep search (try harder)...'
      : '>>> Starting solve...'
  );

  try {
    // Push the whole model so the solve always matches what the editor shows.
    await api.putEescode(pushed.eescode);
    await api.putInitials(pushed.initials);
    await api.putConf(pushed.conf);

    await api.solve({ debug, deepSearch });
    // A stop (or a newer run) during the uploads supersedes this run.
    if (seq !== runSeq) return;

    if (activeEventSource) activeEventSource.close();
    // At most 5 progress lines per second: a verbose trace must not jank the UI.
    // Fail lines always show: dropping them hides the failing block.
    let lastProgressAt = 0;
    const noteProgress = (line: string, force = false) => {
      const now = Date.now();
      if (!force && now - lastProgressAt < 200) return;
      lastProgressAt = now;
      useModelStore.getState().addConsoleLine(line);
    };
    const es = api.subscribeSolveProgress(
      (event: SSEEvent) => {
        if (seq !== runSeq) {
          es.close();
          return;
        }
        switch (event.type) {
          case 'start':
            useModelStore.getState().addConsoleLine(`>>> ${event.message}`);
            break;
          case 'progress':
            noteProgress(`    ${event.message}`);
            break;
          case 'block':
            if (event.event === 'start' || event.event === 'done' || event.event === 'fail') {
              noteProgress(`    ${event.message}`, event.event === 'fail');
            }
            break;
          case 'done': {
            const s = useModelStore.getState();
            s.addConsoleLine('>>> Solve SUCCESS');
            const result = event.result as SolveResponse;
            if (result && typeof result === 'object') {
              s.patchTabResults(tabId, { lastResult: result, resultIsLive: true });
              if (editedSincePush(pushed)) {
                s.addConsoleLine('>>> WARNING: the model was edited during the run; this result matches the uploaded text.');
                s.patchTabResults(tabId, { resultIsLive: false });
              }
              s.addConsoleLine(`    Equations: ${result.equationCount ?? '?'}, Variables: ${result.variableCount ?? '?'}`);
              s.addConsoleLine(`    Blocks: ${result.totalBlocks ?? '?'}, Largest: ${result.largestBlock ?? '?'}`);
              s.addConsoleLine(`    Total iterations: ${result.totalIterations ?? '?'}`);
              const totalMs = result.timing?.total_ms;
              const solveMs = result.timing?.solve_ms;
              s.addConsoleLine(`    Time: ${typeof totalMs === 'number' ? totalMs.toFixed(0) : '?'} ms (solve: ${typeof solveMs === 'number' ? solveMs.toFixed(0) : '?'} ms)`);
              s.addConsoleLine(`    Variables solved: ${result.variables ? Object.keys(result.variables).length : 0}`);
              const diags = Array.isArray(result.diagnostics) ? result.diagnostics.slice(0, 50) : [];
              if (result.diagnostics && result.diagnostics.length > 50) {
                s.addConsoleLine(`--- Diagnostics (${result.diagnostics.length}, showing 50) ---`);
              } else if (diags.length > 0) {
                s.addConsoleLine(`--- Diagnostics (${diags.length}) ---`);
              }
              for (const d of diags) {
                const loc = d.line ? ` (line ${d.line})` : '';
                s.addConsoleLine(`    [${d.severity}]${loc}: ${d.message}`);
              }
              // Follow-ups belong to this run: drop them when a newer run started.
              // Also drop table follow-ups when the grid moved on: a table
              // created/deleted mid-run must not be clobbered by stale data.
              api.getSol().then((r) => { if (seq === runSeq) useModelStore.getState().setSolForTab(tabId, r.content); }).catch(() => {});
              api.getTables().then((r) => {
                if (seq !== runSeq) return;
                const s = useModelStore.getState();
                if (s.lookupTableDirty) return;
                s.patchTabResults(tabId, { lookupTables: r.tables });
              }).catch(() => {});
              if (result.integralTable) {
                s.patchTabResults(tabId, { integralTable: result.integralTable, integralCSV: '' });
                s.addConsoleLine('>>> Integral trajectory recorded - open the Integral panel to view it.');
              } else {
                s.patchTabResults(tabId, { integralTable: null });
                useUIStore.getState().setRightTab('solution');
                api.getIntegralCSV().then((csv) => {
                  if (seq !== runSeq) return;
                  if (useModelStore.getState().lookupTableDirty) return;
                  useModelStore.getState().patchTabResults(tabId, { integralCSV: csv ?? '' });
                }).catch(() => {});
              }
            }
            finishRun(es, seq);
            break;
          }
          case 'error': {
            const s = useModelStore.getState();
            const result = event.result as SolveResponse | undefined;
            if (result) {
              s.patchTabResults(tabId, { lastResult: result, resultIsLive: true });
              if (editedSincePush(pushed)) {
                s.addConsoleLine('>>> WARNING: the model was edited during the run; this result matches the uploaded text.');
                s.patchTabResults(tabId, { resultIsLive: false });
              }
              if (result.isSquare === false) {
                s.addConsoleLine(`>>> Solve FAILED: System is not square (${result.equationCount} equations, ${result.variableCount} variables)`);
              } else if (result.status === 'ParseFailed') {
                s.addConsoleLine('>>> Solve FAILED: Parse error');
              } else {
                s.addConsoleLine(`>>> Solve FAILED: ${result.errorMessage || result.status}`);
              }
              if (result.detailedError) s.addConsoleLine(`    ${result.detailedError}`);
              if (result.status !== 'ParseFailed' && result.status !== 'InvalidInput') {
                const failed = Array.isArray(result.blockResults) ? result.blockResults.filter((b) => !b.success).slice(0, 20) : [];
                for (const block of failed) {
                  const res = typeof block.maxResidual === 'number' ? block.maxResidual.toExponential(2) : '?';
                  s.addConsoleLine(
                    `    Block ${block.id}: ${block.status} (res=${res}) ${block.errorMessage ?? ''}`
                  );
                }
              }
              const ediags = Array.isArray(result.diagnostics) ? result.diagnostics.slice(0, 50) : [];
              if (result.diagnostics && result.diagnostics.length > 50) {
                s.addConsoleLine(`--- Diagnostics (${result.diagnostics.length}, showing 50) ---`);
              } else if (ediags.length > 0) {
                s.addConsoleLine(`--- Diagnostics (${ediags.length}) ---`);
              }
              for (const d of ediags) {
                const loc = d.line ? ` (line ${d.line})` : '';
                s.addConsoleLine(`    [${d.severity}]${loc}: ${d.message}`);
              }
              const rescueable =
                result.status !== 'ParseFailed' &&
                result.status !== 'InvalidInput' &&
                result.isSquare !== false &&
                !deepSearch; // a failed deep search has already tried hard
              if (rescueable) s.setTryHarderAvailable(true);
            } else {
              s.addConsoleLine(`>>> ERROR: ${event.message}`);
            }
            finishRun(es, seq);
            break;
          }
        }
      },
      () => {
        // Stream dropped mid-run (server restart, network): try one direct
        // fetch so the result is not lost, then idle the UI either way.
        const s = useModelStore.getState();
        if (seq === runSeq && s.solving) {
          s.addConsoleLine('>>> ERROR: lost connection to the solver.');
          api.getSolveResult().then(
            (result) => {
              if (seq !== runSeq) return;
              if (result) {
                useModelStore.getState().patchTabResults(tabId, { lastResult: result, resultIsLive: false });
                useModelStore.getState().addConsoleLine('>>> Recovered the last result via a direct fetch (it may belong to the interrupted run).');
              }
            },
            () => {}
          );
        }
        finishRun(es, seq);
      }
    );
    activeEventSource = es;
  } catch (err: unknown) {
    useModelStore.getState().addConsoleLine(`>>> ERROR: ${toErrMsg(err)}`);
    finishRun(null, seq);
  }
}

/** True when the editor text or lookup tables moved on while the run was in flight. */
function editedSincePush(pushed: { eescode: string; initials: string; conf: string; tableRev?: number }): boolean {
  const s = useModelStore.getState();
  if (s.eescode !== pushed.eescode || s.initials !== pushed.initials || s.conf !== pushed.conf) return true;
  if ((pushed.tableRev !== undefined && s.tableRev !== pushed.tableRev) || s.lookupTableDirty) return true;
  return false;
}

/** Ask the server to cancel the running solve and return the UI to idle. */
export async function handleStopSolve(): Promise<void> {
  // Idle stop must be silent: without this every stray Esc/F2 logs a cancel
  // and bumps the sequence a live run may rely on.
  if (!isRunBusy()) return;
  // Invalidate the stream first: late answers from the cancelled run are ignored.
  runSeq++;
  try {
    await api.cancelSolve();
    useModelStore.getState().addConsoleLine('>>> Cancel requested...');
  } catch (err: unknown) {
    useModelStore.getState().addConsoleLine(`>>> ${toErrMsg(err)}`);
  }
  finishRun(activeEventSource, runSeq);
}

/**
 * Thin React wrapper: subscribes to the run flags and exposes the plain
 * handlers above (kept as module functions so tests can drive them directly).
 */
export function useSolveRunner() {
  const solving = useModelStore((s) => s.solving);
  const tryHarderAvailable = useModelStore((s) => s.tryHarderAvailable);
  const deepSearchRunning = useModelStore((s) => s.deepSearchRunning);
  return {
    handleSolve,
    handleStopSolve,
    solving,
    tryHarderAvailable,
    deepSearchRunning,
  };
}
