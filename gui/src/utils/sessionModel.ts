/**
 * sessionModel.ts — show in the editor the model held by this tab's server session.
 *
 * The server session holds the reference state of the model (files, lookup tables, last
 * result). After an operation that replaces it (opening a library model or the file given on
 * the command line, Back, ZIP upload) and on the reload of a tab that has its own session,
 * the editor state is read back from it by this one function.
 */

import { api } from '../api/client.ts';
import { useModelStore } from '../stores/modelStore.ts';
import { isRunBusy } from '../utils/runBusy.ts';

/**
 * Load the session's model into the store: its files, name and library ID, its lookup tables
 * (the Lookup Tables panel does not fetch them by itself) and, when the model was solved, its
 * result and integral trajectory.
 */
let sessionGen = 0;

export async function showSessionModel(): Promise<void> {
  // Swapping the session files mid-run would solve the wrong model and
  // attribute the result to the wrong file: callers must be idle.
  if (isRunBusy()) {
    useModelStore.getState().addConsoleLine('>>> Cannot load a model while a run is in progress.');
    return;
  }
  // Drop pending editor debounces so they cannot overwrite the session we are reading.
  useModelStore.getState().cancelPendingPuts();
  // Two fetch phases with a loadFile() in between: a newer call must win.
  const gen = ++sessionGen;
  let codeFile, init, sol, conf, tables;
  try {
    [codeFile, init, sol, conf, tables] = await Promise.all([
      api.getEescode(),
      api.getInitials(),
      api.getSol(),
      api.getConf(),
      api.getTables(),
    ]);
  } catch (err) {
    if (gen !== sessionGen) return;
    useModelStore.getState().addConsoleLine(`>>> ERROR loading session: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  if (gen !== sessionGen) return;
  const store = useModelStore.getState();
  store.loadFile(codeFile.filePath, codeFile.content, init.content, sol.content, conf.content, codeFile.modelName, codeFile.libraryId, false);
  // loadFile() activates the tab it created or reused: route the run output
  // there, not to whatever tab is active when the fetches below resolve.
  const tabId = useModelStore.getState().activeTabId;
  store.setLookupTables(tables.tables);

  const [result, integral, integralCSV] = await Promise.all([
    api.getSolveResult().catch(() => null),  // 404 when the model was not solved
    api.getIntegralResult().catch(() => null),
    api.getIntegralCSV().catch(() => null),
  ]);
  if (gen !== sessionGen) return;
  if (result) store.patchTabResults(tabId, { lastResult: result, resultIsLive: true });
  store.patchTabResults(tabId, {
    integralTable: integral?.integralTable ?? null,
    integralCSV: integralCSV ?? '',
  });
}

/** Upload a .zip bundle or an equation file into the current session and editor. */
export async function openModelFile(file: File): Promise<boolean> {
  useModelStore.getState().cancelPendingPuts();
  if (file.name.toLowerCase().endsWith('.zip')) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.uploadFiles(formData);
    if (!res.success) return false;
    await showSessionModel();
    useModelStore.getState().setCanGoBack(true);
    useModelStore.getState().addConsoleLine(`>>> Opened bundle: ${res.files.join(', ')}`);
    return true;
  }
  const text = await file.text();
  const stem = file.name.replace(/\.[^.]+$/, '') || 'model';
  const res = await api.newModel();
  await api.setModelName(stem);
  await api.putEescode(text);
  useModelStore.getState().loadFile(file.name, text, '', '', '', stem, '', false);
  useModelStore.getState().setCanGoBack(res.hadContent);
  useModelStore.getState().addConsoleLine(`>>> Opened file: ${file.name}`);
  return true;
}
