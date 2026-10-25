import { useModelStore } from '../stores/modelStore.ts';
import { useUIStore } from '../stores/uiStore.ts';
import { useParametricStore } from '../stores/parametricStore.ts';
import { api } from '../api/client.ts';
import { toErrMsg } from './errors.ts';
import type { SSEEvent, SolveResponse } from '../api/types';

let activeEventSource: EventSource | null = null;

/**
 * End a run: close its stream and clear the running flags. Every path that can
 * end a run (done, error, stop, dropped connection) goes through here, so the
 * UI can never get stuck on "Solving…".
 */
function finishRun(es: EventSource | null): void {
  if (es) es.close();
  if (activeEventSource === es) activeEventSource = null;
  const s = useModelStore.getState();
  s.setSolving(false);
  s.setDeepSearchRunning(false);
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
    await api.putEescode(model.eescode);
    await api.putInitials(model.initials);
    await api.putConf(model.conf);

    await api.solve({ debug, deepSearch });

    if (activeEventSource) activeEventSource.close();
    const es = api.subscribeSolveProgress(
      (event: SSEEvent) => {
        switch (event.type) {
          case 'start':
            useModelStore.getState().addConsoleLine(`>>> ${event.message}`);
            break;
          case 'progress':
            useModelStore.getState().addConsoleLine(`    ${event.message}`);
            break;
          case 'block':
            if (event.event === 'start' || event.event === 'done' || event.event === 'fail') {
              useModelStore.getState().addConsoleLine(`    ${event.message}`);
            }
            break;
          case 'done': {
            const s = useModelStore.getState();
            s.addConsoleLine('>>> Solve SUCCESS');
            const result = event.result as SolveResponse;
            if (result) {
              s.setSolveResult(result);
              s.addConsoleLine(`    Equations: ${result.equationCount}, Variables: ${result.variableCount}`);
              s.addConsoleLine(`    Blocks: ${result.totalBlocks}, Largest: ${result.largestBlock}`);
              s.addConsoleLine(`    Total iterations: ${result.totalIterations}`);
              s.addConsoleLine(`    Time: ${result.timing.total_ms.toFixed(0)} ms (solve: ${result.timing.solve_ms.toFixed(0)} ms)`);
              s.addConsoleLine(`    Variables solved: ${Object.keys(result.variables).length}`);
              if (result.diagnostics && result.diagnostics.length > 0) {
                s.addConsoleLine(`--- Diagnostics (${result.diagnostics.length}) ---`);
                for (const d of result.diagnostics) {
                  const loc = d.line ? ` (line ${d.line})` : '';
                  s.addConsoleLine(`    [${d.severity}]${loc}: ${d.message}`);
                }
              }
              api.getSol().then((r) => useModelStore.getState().setSol(r.content)).catch(() => {});
              api.getTables().then((r) => useModelStore.getState().setLookupTables(r.tables)).catch(() => {});
              if (result.integralTable) {
                s.setIntegralTable(result.integralTable);
                s.setIntegralCSV('');
                s.addConsoleLine('>>> Integral trajectory recorded - open the Integral panel to view it.');
              } else {
                s.setIntegralTable(null);
                useUIStore.getState().setRightTab('solution');
                api.getIntegralCSV().then((csv) => useModelStore.getState().setIntegralCSV(csv ?? '')).catch(() => {});
              }
            }
            finishRun(es);
            break;
          }
          case 'error': {
            const s = useModelStore.getState();
            const result = event.result as SolveResponse | undefined;
            if (result) {
              s.setSolveResult(result);
              if (result.isSquare === false) {
                s.addConsoleLine(`>>> Solve FAILED: System is not square (${result.equationCount} equations, ${result.variableCount} variables)`);
              } else if (result.status === 'ParseFailed') {
                s.addConsoleLine('>>> Solve FAILED: Parse error');
              } else {
                s.addConsoleLine(`>>> Solve FAILED: ${result.errorMessage || result.status}`);
              }
              if (result.detailedError) s.addConsoleLine(`    ${result.detailedError}`);
              if (result.status !== 'ParseFailed' && result.status !== 'InvalidInput') {
                for (const block of result.blockResults) {
                  if (!block.success) {
                    s.addConsoleLine(
                      `    Block ${block.id}: ${block.status} (res=${block.maxResidual.toExponential(2)}) ${block.errorMessage}`
                    );
                  }
                }
              }
              if (result.diagnostics && result.diagnostics.length > 0) {
                s.addConsoleLine(`--- Diagnostics (${result.diagnostics.length}) ---`);
                for (const d of result.diagnostics) {
                  const loc = d.line ? ` (line ${d.line})` : '';
                  s.addConsoleLine(`    [${d.severity}]${loc}: ${d.message}`);
                }
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
            finishRun(es);
            break;
          }
        }
      },
      () => {
        // Stream dropped mid-run (server restart, network): don't leave the UI stuck.
        const s = useModelStore.getState();
        if (s.solving) s.addConsoleLine('>>> ERROR: lost connection to the solver.');
        finishRun(es);
      }
    );
    activeEventSource = es;
  } catch (err: unknown) {
    useModelStore.getState().addConsoleLine(`>>> ERROR: ${toErrMsg(err)}`);
    finishRun(null);
  }
}

/** Ask the server to cancel the running solve and return the UI to idle. */
export async function handleStopSolve(): Promise<void> {
  try {
    finishRun(activeEventSource);
    await api.cancelSolve();
    useModelStore.getState().addConsoleLine('>>> Cancel requested...');
  } catch (err: unknown) {
    useModelStore.getState().addConsoleLine(`>>> ${toErrMsg(err)}`);
    finishRun(null);
  }
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
