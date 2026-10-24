import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play, Sun, Moon, Square, Zap,
  PanelLeft, PanelRight, PanelBottom, Check, Settings,
} from 'lucide-react';
import { useModelStore } from '../stores/modelStore';
import { useUIStore } from '../stores/uiStore';
import { api } from '../api/client';
import {
  editorInstance,
  toggleBraceComment,
  toggleQuoteComment,
  triggerEditorAction,
} from './editorUtils';
import { exportAllPlots } from '../utils/exportPlots';
import { toErrMsg } from '../utils/errors';
import { showSessionModel } from '../utils/sessionModel';
import { useParametricStore } from '../stores/parametricStore';
import { exportArrayTableToCsv, exportParametricStudyToCsv } from '../utils/csv';
import type { SSEEvent, SolveResponse } from '../api/types';

type MenuId = 'file' | 'edit' | 'options' | 'calculate' | 'tables' | 'plots' | 'help' | null;

interface MenuItem {
  label?: string;
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
  divider?: boolean;
  action?: () => void;
}

export default function Toolbar() {
  const solving = useModelStore((s) => s.solving);
  const setSolving = useModelStore((s) => s.setSolving);
  const setSolveResult = useModelStore((s) => s.setSolveResult);
  const addConsoleLine = useModelStore((s) => s.addConsoleLine);
  const clearConsole = useModelStore((s) => s.clearConsole);
  const eescode = useModelStore((s) => s.eescode);
  const initials = useModelStore((s) => s.initials);
  const sol = useModelStore((s) => s.sol);
  const conf = useModelStore((s) => s.conf);
  const modelName = useModelStore((s) => s.modelName);
  const setModelName = useModelStore((s) => s.setModelName);
  const setLookupTables = useModelStore((s) => s.setLookupTables);
  const setIntegralTable = useModelStore((s) => s.setIntegralTable);
  const setIntegralCSV = useModelStore((s) => s.setIntegralCSV);
  const canGoBack = useModelStore((s) => s.canGoBack);
  const setSol = useModelStore((s) => s.setSol);
  const setInitials = useModelStore((s) => s.setInitials);
  const setCanGoBack = useModelStore((s) => s.setCanGoBack);
  const clearModel = useModelStore((s) => s.clearModel);
  const loadFile = useModelStore((s) => s.loadFile);
  const lastResult = useModelStore((s) => s.lastResult);
  const tryHarderAvailable = useModelStore((s) => s.tryHarderAvailable);
  const setTryHarderAvailable = useModelStore((s) => s.setTryHarderAvailable);
  const deepSearchRunning = useModelStore((s) => s.deepSearchRunning);
  const setDeepSearchRunning = useModelStore((s) => s.setDeepSearchRunning);
  const activeTabId = useModelStore((s) => s.activeTabId);
  const closeTab = useModelStore((s) => s.closeTab);
  const renameTab = useModelStore((s) => s.renameTab);

  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const setRightTab = useUIStore((s) => s.setRightTab);
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const toggleLeftPanel = useUIStore((s) => s.toggleLeftPanel);
  const setActivityMode = useUIStore((s) => s.setActivityMode);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);
  const bottomPanelOpen = useUIStore((s) => s.bottomPanelOpen);
  const toggleBottomPanel = useUIStore((s) => s.toggleBottomPanel);
  const setBottomPanelOpen = useUIStore((s) => s.setBottomPanelOpen);
  const setBottomTab = useUIStore((s) => s.setBottomTab);
  const activeModal = useUIStore((s) => s.activeModal);
  const setActiveModal = useUIStore((s) => s.setActiveModal);
  const openSettings = useUIStore((s) => s.openSettings);
  const activeParametricResult = useParametricStore((s) => s.activeResult);

  const hasArrayVariables = Boolean(
    lastResult?.variables &&
    Object.keys(lastResult.variables).some((k) => /^.+\[\d+\]$/.test(k))
  );

  const [openMenu, setOpenMenu] = useState<MenuId>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Update page title when model name changes
  useEffect(() => {
    document.title = modelName ? `CoolSolve-Canary - ${modelName}` : 'CoolSolve-Canary';
  }, [modelName]);

  // Close top menu on outside click or Escape
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenu]);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  // Solve handler - async with SSE progress streaming.
  const handleSolve = useCallback(
    async (debug = false, deepSearch = false) => {
      if (!eescode.trim()) return;
      setSolving(true);
      setDeepSearchRunning(deepSearch);
      setTryHarderAvailable(false);
      clearConsole();
      setBottomPanelOpen(true);
      addConsoleLine(deepSearch
        ? '>>> Starting deep search (try harder)...'
        : '>>> Starting solve...');

      try {
        await api.putEescode(eescode);
        if (initials) await api.putInitials(initials);

        await api.solve({ debug, deepSearch });

        if (eventSourceRef.current) eventSourceRef.current.close();
        const es = api.subscribeSolveProgress((event: SSEEvent) => {
          switch (event.type) {
            case 'start':
              addConsoleLine(`>>> ${event.message}`);
              break;
            case 'progress':
              addConsoleLine(`    ${event.message}`);
              break;
            case 'block':
              if (event.event === 'start' || event.event === 'done' || event.event === 'fail') {
                addConsoleLine(`    ${event.message}`);
              }
              break;
            case 'done': {
              addConsoleLine(`>>> Solve SUCCESS`);
              const result = event.result as SolveResponse;
              if (result) {
                setSolveResult(result);
                addConsoleLine(`    Equations: ${result.equationCount}, Variables: ${result.variableCount}`);
                addConsoleLine(`    Blocks: ${result.totalBlocks}, Largest: ${result.largestBlock}`);
                addConsoleLine(`    Total iterations: ${result.totalIterations}`);
                addConsoleLine(`    Time: ${result.timing.total_ms.toFixed(0)} ms (solve: ${result.timing.solve_ms.toFixed(0)} ms)`);
                addConsoleLine(`    Variables solved: ${Object.keys(result.variables).length}`);
                if (result.diagnostics && result.diagnostics.length > 0) {
                  addConsoleLine(`--- Diagnostics (${result.diagnostics.length}) ---`);
                  for (const d of result.diagnostics) {
                    const loc = d.line ? ` (line ${d.line})` : '';
                    addConsoleLine(`    [${d.severity}]${loc}: ${d.message}`);
                  }
                }
                api.getSol().then((s) => setSol(s.content)).catch(() => {});
                api.getTables().then((r) => setLookupTables(r.tables)).catch(() => {});
                if (result.integralTable) {
                  setIntegralTable(result.integralTable);
                  setIntegralCSV('');
                  setBottomTab('integral');
                } else {
                  setIntegralTable(null);
                  api.getIntegralCSV().then((csv) => setIntegralCSV(csv ?? '')).catch(() => {});
                }
              }
              setSolving(false);
              setDeepSearchRunning(false);
              es.close();
              break;
            }
            case 'error': {
              const result = event.result as SolveResponse | undefined;
              if (result) {
                setSolveResult(result);
                if (result.isSquare === false) {
                  addConsoleLine(`>>> Solve FAILED: System is not square (${result.equationCount} equations, ${result.variableCount} variables)`);
                } else if (result.status === 'ParseFailed') {
                  addConsoleLine(`>>> Solve FAILED: Parse error`);
                } else {
                  addConsoleLine(`>>> Solve FAILED: ${result.errorMessage || result.status}`);
                }
                if (result.detailedError) addConsoleLine(`    ${result.detailedError}`);
                if (result.status !== 'ParseFailed' && result.status !== 'InvalidInput') {
                  for (const block of result.blockResults) {
                    if (!block.success) {
                      addConsoleLine(
                        `    Block ${block.id}: ${block.status} (res=${block.maxResidual.toExponential(2)}) ${block.errorMessage}`
                      );
                    }
                  }
                }
                if (result.diagnostics && result.diagnostics.length > 0) {
                  addConsoleLine(`--- Diagnostics (${result.diagnostics.length}) ---`);
                  for (const d of result.diagnostics) {
                    const loc = d.line ? ` (line ${d.line})` : '';
                    addConsoleLine(`    [${d.severity}]${loc}: ${d.message}`);
                  }
                }
                const rescueable =
                  result.status !== 'ParseFailed' &&
                  result.status !== 'InvalidInput' &&
                  result.isSquare !== false &&
                  !deepSearchRunning;
                if (rescueable) setTryHarderAvailable(true);
              } else {
                addConsoleLine(`>>> ERROR: ${event.message}`);
              }
              setSolving(false);
              setDeepSearchRunning(false);
              es.close();
              break;
            }
          }
        });
        eventSourceRef.current = es;
      } catch (err: unknown) {
        addConsoleLine(`>>> ERROR: ${toErrMsg(err)}`);
        setSolving(false);
        setDeepSearchRunning(false);
      }
    },
    [eescode, initials, setSolving, clearConsole, addConsoleLine, setSolveResult, setSol, setBottomPanelOpen, setBottomTab, setLookupTables, setIntegralTable, setIntegralCSV, setDeepSearchRunning, setTryHarderAvailable, deepSearchRunning]
  );

  // Check / Format Equations
  const handleCheckEquations = useCallback(async () => {
    if (!eescode.trim()) return;
    setBottomTab('console');
    try {
      const res = await api.parse(eescode);
      const nEq = res.equationCount;
      const nVar = res.variableCount ?? 0;
      addConsoleLine(`>>> Check Equations: ${nEq} equation(s), ${nVar} variable(s)`);
      if (res.errors.length > 0) {
        for (const err of res.errors) {
          addConsoleLine(`    [Error] Line ${err.line}: ${err.message}`);
        }
      } else if (nEq === nVar) {
        addConsoleLine(`    SUCCESS: System is square (0 degrees of freedom). Ready to solve.`);
      } else {
        const diff = nVar - nEq;
        addConsoleLine(`    [Warning] System is not square (${diff > 0 ? `${diff} free variable(s)` : `${-diff} over-specified equation(s)`}).`);
      }
      if (res.diagnostics && res.diagnostics.length > 0) {
        for (const d of res.diagnostics) {
          addConsoleLine(`    [${d.severity}]${d.line ? ` Line ${d.line}:` : ''} ${d.message}`);
        }
      }
    } catch (err: unknown) {
      addConsoleLine(`>>> ERROR: ${toErrMsg(err)}`);
    }
  }, [eescode, addConsoleLine, setBottomTab]);

  // New - clear everything
  const handleNew = useCallback(async () => {
    try {
      const res = await api.newModel();
      clearModel();
      setCanGoBack(res.hadContent);
      addConsoleLine('>>> New model');
    } catch (err: unknown) {
      addConsoleLine(`>>> ERROR: ${toErrMsg(err)}`);
    }
  }, [clearModel, addConsoleLine, setCanGoBack]);

  // Open - supports equation files and .zip bundles
  const handleOpen = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.eescode,.ees,.txt,.zip';
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;
      const file = files[0];
      try {
        if (file.name.toLowerCase().endsWith('.zip')) {
          const formData = new FormData();
          formData.append('file', file);
          const res = await api.uploadFiles(formData);
          if (res.success) {
            await showSessionModel();
            setCanGoBack(true);
            addConsoleLine(`>>> Opened bundle: ${res.files.join(', ')}`);
          }
        } else {
          const text = await file.text();
          const stem = file.name.replace(/\.[^.]+$/, '') || 'model';
          const res = await api.newModel();
          await api.setModelName(stem);
          await api.putEescode(text);
          loadFile(file.name, text, '', '', '', stem, '');
          setCanGoBack(res.hadContent);
          addConsoleLine(`>>> Opened file: ${file.name}`);
        }
      } catch (err: unknown) {
        addConsoleLine(`>>> ERROR: ${toErrMsg(err)}`);
      }
    };
    input.click();
  }, [addConsoleLine, setCanGoBack, loadFile]);

  // Helper: trigger a file download from a Blob
  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }, []);

  // Save - download ZIP bundle
  const handleSave = useCallback(async () => {
    if (!eescode.trim()) {
      addConsoleLine('>>> Nothing to save');
      return;
    }
    try {
      await api.putEescode(eescode);
      if (initials) await api.putInitials(initials);

      let name = modelName;
      if (!name) {
        const input = prompt('Enter model name:', 'model');
        if (!input) return;
        name = input.trim() || 'model';
        setModelName(name);
        await api.setModelName(name);
      }

      const fileNames: string[] = [name + '.eescode'];
      if (initials) fileNames.push(name + '.initials');
      if (sol) fileNames.push(name + '.sol');
      if (conf) fileNames.push('coolsolve.conf');
      try {
        const debugRes = await api.getDebugFiles();
        if (debugRes.files.length > 0) fileNames.push('debug_output/');
      } catch { /* no debug */ }

      addConsoleLine(`>>> Saved bundle: ${fileNames.join(', ')}`);
      window.location.href = api.bundleUrl();
    } catch (err: unknown) {
      addConsoleLine(`>>> ERROR: ${toErrMsg(err)}`);
    }
  }, [eescode, initials, sol, conf, modelName, setModelName, addConsoleLine]);

  // Export plain .eescode
  const handleExportEescode = useCallback(() => {
    if (!eescode.trim()) return;
    const filename = (modelName || 'model') + '.eescode';
    downloadBlob(new Blob([eescode], { type: 'text/plain;charset=utf-8' }), filename);
    addConsoleLine(`>>> Exported: ${filename}`);
  }, [eescode, modelName, downloadBlob, addConsoleLine]);

  // Save As
  const handleSaveAs = useCallback(async () => {
    if (!eescode.trim()) {
      addConsoleLine('>>> Nothing to save');
      return;
    }
    const currentName = modelName || 'model';
    const input = prompt('Save As - enter model name:', currentName);
    if (!input || !input.trim()) return;
    const stem = input.trim().replace(/\.[^.]+$/, '');
    setModelName(stem);
    api.setModelName(stem).catch(() => {});
    renameTab(activeTabId, `${stem}.eescode`);
    const filename = `${stem}.eescode`;
    downloadBlob(new Blob([eescode], { type: 'text/plain;charset=utf-8' }), filename);
    addConsoleLine(`>>> Saved As: ${filename}`);
  }, [eescode, modelName, setModelName, renameTab, activeTabId, downloadBlob, addConsoleLine]);

  // Open Folder
  const handleOpenFolder = useCallback(() => {
    setActivityMode('code');
    if (!leftPanelOpen) toggleLeftPanel();
    addConsoleLine('>>> Use the folder icon in the Explorer header to select a workspace directory');
  }, [setActivityMode, leftPanelOpen, toggleLeftPanel, addConsoleLine]);

  // Export .sol
  const handleExportSol = useCallback(() => {
    if (!sol.trim()) return;
    const filename = (modelName || 'model') + '.sol';
    downloadBlob(new Blob([sol], { type: 'text/plain;charset=utf-8' }), filename);
    addConsoleLine(`>>> Exported: ${filename}`);
  }, [sol, modelName, downloadBlob, addConsoleLine]);

  const handleExportArrays = useCallback(() => {
    if (!lastResult?.variables) return;
    const entries: { baseName: string; index: number; value: number }[] = [];
    for (const [name, val] of Object.entries(lastResult.variables)) {
      const match = name.match(/^(.+)\[(\d+)\]$/);
      if (match) {
        entries.push({ baseName: match[1], index: parseInt(match[2], 10), value: val });
      }
    }
    const baseSet = new Set<string>();
    const indexSet = new Set<number>();
    const grid = new Map<string, Map<number, number>>();
    for (const e of entries) {
      baseSet.add(e.baseName);
      indexSet.add(e.index);
      if (!grid.has(e.baseName)) grid.set(e.baseName, new Map());
      grid.get(e.baseName)!.set(e.index, e.value);
    }
    const baseNames = Array.from(baseSet).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
    const indices = Array.from(indexSet).sort((a, b) => a - b);
    exportArrayTableToCsv(baseNames, indices, grid, modelName);
    addConsoleLine(`>>> Exported array table to CSV`);
  }, [lastResult, modelName, addConsoleLine]);

  const handleExportParametric = useCallback(() => {
    if (!activeParametricResult) return;
    exportParametricStudyToCsv(
      activeParametricResult.sweepVariables,
      activeParametricResult.results,
      undefined,
      modelName
    );
    addConsoleLine(`>>> Exported parametric study to CSV`);
  }, [activeParametricResult, modelName, addConsoleLine]);

  // Back - restore previous model
  const handleBack = useCallback(async () => {
    try {
      const res = await api.goBack();
      if (res.success) {
        await showSessionModel();
        setCanGoBack(false);
        addConsoleLine('>>> Restored previous model');
      }
    } catch (err: unknown) {
      addConsoleLine(`>>> ERROR: ${toErrMsg(err)}`);
    }
  }, [addConsoleLine, setCanGoBack]);

  // Stop/cancel solve
  const handleStopSolve = useCallback(async () => {
    try {
      await api.cancelSolve();
      addConsoleLine('>>> Cancel requested...');
    } catch (err: unknown) {
      addConsoleLine(`>>> ${toErrMsg(err)}`);
    }
  }, [addConsoleLine]);

  // Update guesses
  const handleUpdateGuesses = useCallback(async () => {
    try {
      await api.updateGuesses();
      const init = await api.getInitials();
      setInitials(init.content);
      addConsoleLine('>>> Guesses updated from last solution');
    } catch (err: unknown) {
      addConsoleLine(`>>> ERROR: ${toErrMsg(err)}`);
    }
  }, [setInitials, addConsoleLine]);

  // Reset guesses
  const handleResetGuesses = useCallback(async () => {
    try {
      await api.putInitials('');
      setInitials('');
      addConsoleLine('>>> Initial guesses reset to default (1.0)');
    } catch (err: unknown) {
      addConsoleLine(`>>> ERROR: ${toErrMsg(err)}`);
    }
  }, [setInitials, addConsoleLine]);

  // Compile LaTeX report to PDF
  const handleLatexReport = useCallback(async () => {
    try {
      addConsoleLine('>>> Exporting plots...');
      let plots: { name: string; data: string }[] = [];
      try {
        plots = await exportAllPlots();
      } catch (plotErr: unknown) {
        addConsoleLine(`    Plot export error: ${toErrMsg(plotErr)} (continuing without plots)`);
      }
      addConsoleLine('>>> Compiling LaTeX report to PDF...');
      const pdfBlob = await api.compileLatexReport({ plots });
      const filename = (modelName || 'model') + '_report.pdf';
      downloadBlob(pdfBlob, filename);
      addConsoleLine(`>>> PDF report downloaded: ${filename}`);
    } catch (err: unknown) {
      addConsoleLine(`>>> PDF compilation failed: ${toErrMsg(err)}`);
      addConsoleLine('>>> Falling back to .tex download...');
      try {
        const res = await api.getLatexReport();
        if (res.available && res.content) {
          const blob = new Blob([res.content], { type: 'application/x-tex' });
          const filename = (modelName || 'model') + '_report.tex';
          downloadBlob(blob, filename);
          addConsoleLine(`>>> LaTeX source downloaded: ${filename}`);
        } else {
          addConsoleLine('>>> No LaTeX report available');
        }
      } catch {
        addConsoleLine('>>> Could not download .tex fallback either');
      }
    }
  }, [modelName, addConsoleLine, downloadBlob]);

  // Global keyboard shortcuts (IDE conventions)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
        e.preventDefault();
        if (!solving) handleSolve(e.shiftKey, tryHarderAvailable && !e.shiftKey);
      } else if (e.key === 'F9') {
        e.preventDefault();
        setRightTab('variables');
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveAs();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleOpen();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        closeTab(activeTabId);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNew();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        handleUpdateGuesses();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleCheckEquations();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setActiveModal('functionInfo');
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleLeftPanel();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        toggleBottomPanel();
      } else if (e.key === 'Escape' && solving) {
        e.preventDefault();
        handleStopSolve();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    solving, handleSolve, handleSave, handleOpen, handleNew,
    handleUpdateGuesses, handleCheckEquations, handleStopSolve,
    tryHarderAvailable, setRightTab, setActiveModal, toggleLeftPanel, toggleRightPanel, toggleBottomPanel,
  ]);

  const menus: Record<Exclude<MenuId, null>, { label: string; items: MenuItem[] }> = {
    file: {
      label: 'File',
      items: [
        { label: 'New Model', shortcut: 'Ctrl+N', action: handleNew },
        { label: 'Open File…', shortcut: 'Ctrl+O', action: handleOpen },
        { label: 'Open Folder…', action: handleOpenFolder },
        { label: 'Open from Model Library…', action: () => setActiveModal('library') },
        { label: 'Revert to Previous Model', disabled: !canGoBack, action: handleBack },
        { divider: true },
        { label: 'Save', shortcut: 'Ctrl+S', disabled: !eescode.trim(), action: handleSave },
        { label: 'Save As…', shortcut: 'Ctrl+Shift+S', disabled: !eescode.trim(), action: handleSaveAs },
        { label: 'Save Bundle (.zip)…', disabled: !eescode.trim(), action: handleSave },
        { divider: true },
        { label: 'Close File', shortcut: 'Ctrl+W', action: () => closeTab(activeTabId) },
        { divider: true },
        { label: 'Export Equations (.eescode)', disabled: !eescode.trim(), action: handleExportEescode },
        { label: 'Export Solution (.sol)', disabled: !sol.trim(), action: handleExportSol },
        {
          label: 'Export Array Table (.csv)',
          disabled: !hasArrayVariables,
          action: handleExportArrays,
        },
        {
          label: 'Export Parametric Study (.csv)',
          disabled: !activeParametricResult,
          action: handleExportParametric,
        },
        {
          label: 'Export LaTeX / PDF Report…',
          disabled: !lastResult?.success || !lastResult?.latexReportAvailable,
          action: handleLatexReport,
        },
      ],
    },
    edit: {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: () => triggerEditorAction('undo') },
        { label: 'Redo', shortcut: 'Ctrl+Y', action: () => triggerEditorAction('redo') },
        { divider: true },
        { label: 'Find…', shortcut: 'Ctrl+F', action: () => triggerEditorAction('actions.find') },
        { label: 'Find & Replace…', shortcut: 'Ctrl+H', action: () => triggerEditorAction('editor.action.startFindReplaceAction') },
        { divider: true },
        { label: 'Toggle { } Invisible Comment', shortcut: 'Ctrl+/', action: () => toggleBraceComment(editorInstance) },
        { label: 'Toggle " " Display Comment', shortcut: 'Ctrl+Shift+/', action: () => toggleQuoteComment(editorInstance) },
      ],
    },
    options: {
      label: 'Options',
      items: [
        { label: 'Variable Info & Guesses…', shortcut: 'F9', action: () => setRightTab('variables') },
        { label: 'Function Info…', shortcut: 'Ctrl+I', action: () => setActiveModal('functionInfo') },
        { label: 'Unit System ($UnitSystem)…', action: () => setActiveModal('unitSystem') },
        { label: 'Solver Configuration (coolsolve.conf)…', action: () => setRightTab('config') },
      ],
    },
    calculate: {
      label: 'Calculate',
      items: [
        { label: 'Check / Format Equations', shortcut: 'Ctrl+K', disabled: !eescode.trim(), action: handleCheckEquations },
        { label: 'Solve', shortcut: 'F2', disabled: solving || !eescode.trim(), action: () => handleSolve(false, false) },
        { label: 'Solve with Deep Search (Try Harder)', disabled: solving || !eescode.trim(), action: () => handleSolve(false, true) },
        { label: 'Debug Solve (Full Trace)', shortcut: 'Ctrl+Shift+Enter', disabled: solving || !eescode.trim(), action: () => handleSolve(true, false) },
        { label: 'Stop Calculation', shortcut: 'Esc', disabled: !solving, action: handleStopSolve },
        { divider: true },
        { label: 'Update Guesses from Solution', shortcut: 'Ctrl+G', disabled: !lastResult?.success, action: handleUpdateGuesses },
        { label: 'Reset Guesses to Default', disabled: !initials.trim(), action: handleResetGuesses },
      ],
    },
    tables: {
      label: 'Tables',
      items: [
        { label: 'Parametric Table (Sensitivity Study)', action: () => setActivityMode('parametric') },
        { label: 'Lookup Tables', action: () => setBottomTab('lookuptables') },
        { label: 'Arrays Table', action: () => setRightTab('arrays') },
        { label: 'Integral Table ($IntegralTable)', action: () => setBottomTab('integral') },
        { divider: true },
        { label: 'Export Arrays Table to CSV', disabled: !hasArrayVariables, action: handleExportArrays },
        { label: 'Export Parametric Study to CSV', disabled: !activeParametricResult, action: handleExportParametric },
      ],
    },
    plots: {
      label: 'Plots',
      items: [
        { label: 'Property Diagram (T-s, P-h, h-s, T-h)', action: () => setActivityMode('diagrams') },
        { label: 'Parametric X-Y & Contour Plots', action: () => setActivityMode('parametric') },
        { label: 'Integral Trajectory Plot', action: () => setBottomTab('integral') },
      ],
    },
    help: {
      label: 'Help',
      items: [
        {
          label: 'Language & Fluid Reference',
          action: () => window.open('/docs/#docs%2Flanguage_reference.md', '_blank', 'noopener,noreferrer'),
        },
        { label: 'Browse Model Library…', action: () => setActiveModal('library') },
        { divider: true },
        { label: 'About CoolSolve-Canary', action: () => setActiveModal('about') },
      ],
    },
  };

  const menuKeys = Object.keys(menus) as Array<Exclude<MenuId, null>>;

  return (
    <header className="topbar">
      {/* Left: Brand mark + top menu bar */}
      <div className="topbar-left" ref={menuBarRef}>
        <nav className="menubar" aria-label="Main menu">
          {menuKeys.map((key) => {
            const m = menus[key];
            const isOpen = openMenu === key;
            return (
              <div key={key} className="menu-root">
                <button
                  className={`menu-trigger ${isOpen ? 'active' : ''}`}
                  onClick={() => setOpenMenu(isOpen ? null : key)}
                  onMouseEnter={() => { if (openMenu) setOpenMenu(key); }}
                >
                  {m.label}
                </button>
                {isOpen && (
                  <div className="menu-dropdown" role="menu">
                    {m.items.map((item, idx) =>
                      item.divider ? (
                        <div key={idx} className="menu-divider" />
                      ) : (
                        <button
                          key={idx}
                          className="menu-item"
                          disabled={item.disabled}
                          onClick={() => {
                            setOpenMenu(null);
                            item.action?.();
                          }}
                        >
                          <span className="menu-check">
                            {item.checked ? <Check size={12} /> : null}
                          </span>
                          <span className="menu-item-label">{item.label}</span>
                          {item.shortcut && <kbd className="menu-shortcut">{item.shortcut}</kbd>}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Right: Only immediate actions at hand */}
      <div className="topbar-right">
        {solving && (
          <button
            className="toolbar-btn danger"
            onClick={handleStopSolve}
            title="Stop calculation (Esc)"
          >
            <Square size={12} /> Stop
          </button>
        )}
        <button
          className={`toolbar-btn primary${tryHarderAvailable ? ' try-harder' : ''}`}
          onClick={() => handleSolve(false, tryHarderAvailable)}
          disabled={solving || !eescode.trim()}
          title={
            solving
              ? (deepSearchRunning ? 'Deep search in progress…' : 'Solving…')
              : tryHarderAvailable
                ? 'Try Harder: re-run with Deep Search pipeline (F2)'
                : 'Solve equations (F2 / Ctrl+Enter)'
          }
        >
          {solving ? <span className="spinner" /> : tryHarderAvailable ? <Zap size={13} /> : <Play size={13} />}
          <span>
            {solving
              ? (deepSearchRunning ? 'Searching…' : 'Solving…')
              : tryHarderAvailable
                ? 'Try Harder'
                : 'Solve'}
          </span>
        </button>

        <div className="topbar-divider" />

        <button
          className={`icon-btn ${leftPanelOpen ? 'active' : ''}`}
          onClick={toggleLeftPanel}
          title="Toggle Primary Sidebar (Ctrl+B)"
        >
          <PanelLeft size={15} />
        </button>
        <button
          className={`icon-btn ${rightPanelOpen ? 'active' : ''}`}
          onClick={toggleRightPanel}
          title="Toggle Right Inspector"
        >
          <PanelRight size={15} />
        </button>
        <button
          className={`icon-btn ${bottomPanelOpen ? 'active' : ''}`}
          onClick={toggleBottomPanel}
          title="Toggle Bottom Panel (Ctrl+`)"
        >
          <PanelBottom size={15} />
        </button>
        <button
          className="icon-btn"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button
          className={`icon-btn ${activeModal === 'settings' ? 'active' : ''}`}
          onClick={() => openSettings('appearance')}
          title="Settings"
        >
          <Settings size={15} />
        </button>
      </div>
    </header>
  );
}
