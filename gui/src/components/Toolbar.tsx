import { useState, useEffect, useCallback, useRef } from 'react';
import ConfirmModal from './ConfirmModal';
import {
  Sun, Moon,
  PanelRight, PanelBottom, Check, Settings,
} from 'lucide-react';
import { useModelStore, tabHasResults, hasResults } from '../stores/modelStore';
import { useUIStore } from '../stores/uiStore';
import { api } from '../api/client';
import { useSolveRunner } from '../utils/useSolveRunner';
import {
  editorInstance,
  toggleBraceComment,
  toggleQuoteComment,
  triggerEditorAction,
} from './editorUtils';
import { exportAllPlots } from '../utils/exportPlots';
import { extractArrayGrid } from '../utils/arrayData';
import { toErrMsg } from '../utils/errors';
import { isRunBusy } from '../utils/runBusy';
import { showSessionModel, openModelFile } from '../utils/sessionModel';
import { STATS_LOCAL_ONLY } from './UsageStats';
import { useParametricStore } from '../stores/parametricStore';
import { exportArrayTableToCsv, exportParametricStudyToCsv } from '../utils/csv';
import { saveFileWithPicker } from '../utils/fileSave';

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
  const addConsoleLine = useModelStore((s) => s.addConsoleLine);
  const eescode = useModelStore((s) => s.eescode);
  const initials = useModelStore((s) => s.initials);
  const sol = useModelStore((s) => s.sol);
  const dirty = useModelStore((s) => s.dirty);
  const setDirty = useModelStore((s) => s.setDirty);
  const openTabs = useModelStore((s) => s.openTabs);
  const modelName = useModelStore((s) => s.modelName);
  const setModelName = useModelStore((s) => s.setModelName);
  const canGoBack = useModelStore((s) => s.canGoBack);
  const setInitials = useModelStore((s) => s.setInitials);
  const setCanGoBack = useModelStore((s) => s.setCanGoBack);
  const clearModel = useModelStore((s) => s.clearModel);
  const lastResult = useModelStore((s) => s.lastResult);
  const resultIsLive = useModelStore((s) => s.resultIsLive);
  const activeTabId = useModelStore((s) => s.activeTabId);
  const closeTab = useModelStore((s) => s.closeTab);

  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const setRightTab = useUIStore((s) => s.setRightTab);
  const activityMode = useUIStore((s) => s.activityMode);
  const setActivityMode = useUIStore((s) => s.setActivityMode);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);
  const bottomPanelOpen = useUIStore((s) => s.bottomPanelOpen);
  const toggleBottomPanel = useUIStore((s) => s.toggleBottomPanel);
  const setBottomTab = useUIStore((s) => s.setBottomTab);
  const activeModal = useUIStore((s) => s.activeModal);
  const setActiveModal = useUIStore((s) => s.setActiveModal);
  const openSettings = useUIStore((s) => s.openSettings);
  const activeParametricResult = useModelStore((s) => s.parametricResult);
  const parametricRunning = useParametricStore((s) => s.running);

  const [confirmNew, setConfirmNew] = useState(false);
  const [confirmCloseTab, setConfirmCloseTab] = useState<{ id: string; name: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingOpenFile, setPendingOpenFile] = useState<File | null>(null);
  const [confirmBack, setConfirmBack] = useState(false);
  const [confirmResetGuesses, setConfirmResetGuesses] = useState(false);

  // Same parser as the Arrays panel: the button is on exactly when export has rows.
  const hasArrayVariables = Boolean(
    lastResult?.variables && extractArrayGrid(lastResult.variables).baseNames.length > 0
  );

  const [openMenu, setOpenMenu] = useState<MenuId>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const { handleSolve, handleStopSolve, solving, tryHarderAvailable } = useSolveRunner();

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

  // Check / Format Equations
  const handleCheckEquations = useCallback(async () => {
    if (!eescode.trim()) return;
    setActivityMode('code');
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
  }, [eescode, addConsoleLine, setBottomTab, setActivityMode]);

  // New - clear everything
  const doNew = useCallback(async () => {
    try {
      const res = await api.newModel();
      clearModel();
      setCanGoBack(res.hadContent);
      setActivityMode('code');
      addConsoleLine('>>> New model');
    } catch (err: unknown) {
      addConsoleLine(`>>> ERROR: ${toErrMsg(err)}`);
    }
  }, [clearModel, addConsoleLine, setCanGoBack, setActivityMode]);

  const handleNew = useCallback(() => {
    // New Model discards the current model's code and run results: say so first.
    const needsConfirm =
      dirty ||
      openTabs.some((t) => t.dirty || tabHasResults(t)) ||
      hasResults(useModelStore.getState());
    if (needsConfirm) {
      setConfirmNew(true);
    } else {
      doNew();
    }
  }, [openTabs, dirty, doNew]);

  const handleCloseActiveTab = useCallback(() => {
    const activeTab = openTabs.find((t) => t.id === activeTabId);
    if (activeTab?.dirty || dirty || (activeTab && tabHasResults(activeTab)) || hasResults(useModelStore.getState())) {
      setConfirmCloseTab({ id: activeTabId, name: activeTab?.name || 'File' });
    } else {
      setActivityMode('code');
      closeTab(activeTabId);
    }
  }, [openTabs, activeTabId, dirty, setActivityMode, closeTab]);

  // Open - supports equation files and .zip bundles
  // Unsaved screen edits (dirty text or grid) are lost when the session is
  // replaced, so confirm first instead of silently overwriting the tab.
  const doOpenFile = useCallback(async (file: File) => {
    try {
      if (await openModelFile(file)) setActivityMode('code');
    } catch (err: unknown) {
      addConsoleLine(`>>> ERROR: ${toErrMsg(err)}`);
    }
  }, [addConsoleLine, setActivityMode]);

  const handleOpen = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.eescode,.ees,.txt,.zip';
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;
      const file = files[0];
      if (file.size > 10 * 1024 * 1024) {
        addConsoleLine('>>> ERROR: File exceeds 10 MB limit');
        return;
      }
      if (isRunBusy()) {
        addConsoleLine('>>> Cannot open a file while a run is in progress.');
        return;
      }
      const s = useModelStore.getState();
      if (s.dirty || s.lookupTableDirty) {
        setPendingOpenFile(file);
        setConfirmOpen(true);
        return;
      }
      await doOpenFile(file);
    };
    input.click();
  }, [addConsoleLine, doOpenFile]);

  // Save / Save As - download the equation file from the editor (.eescode only)
  // This downloads code only: it must not clear the tab dirty flag (which also
  // tracks initials/conf) and must not rename the tab or server model.
  const handleSaveScript = useCallback(async (logLabel: string) => {
    if (!eescode.trim()) {
      addConsoleLine('>>> Nothing to save');
      return;
    }
    const stem = modelName || 'model';
    const filename = `${stem}.eescode`;
    try {
      const result = await saveFileWithPicker(
        new Blob([eescode], { type: 'text/plain;charset=utf-8' }),
        filename,
        [{ description: 'CoolSolve Equation File (*.eescode)', accept: { 'text/plain': ['.eescode', '.ees', '.txt'] } }]
      );
      if (result.saved) {
        addConsoleLine(`>>> ${logLabel}: ${result.name || filename} (code only — use Bundle for full model)`);
      }
    } catch (err: unknown) {
      addConsoleLine(`>>> ERROR: ${toErrMsg(err)}`);
    }
  }, [eescode, modelName, addConsoleLine]);

  // Save Bundle - download the whole model as a .zip (script, config, tables, results)
  const handleSaveBundle = useCallback(async () => {
    if (!eescode.trim()) {
      addConsoleLine('>>> Nothing to save');
      return;
    }
    {
      const s = useModelStore.getState();
      if (s.lookupTableDirty) {
        addConsoleLine('>>> Cannot save bundle: a lookup table has unsaved edits. Save the table first.');
        setActivityMode('tables');
        return;
      }
      // Bundle pushes memory directly, so drop pending debounces (no duplicate writes).
      s.cancelPendingPuts();
    }
    try {
      // Flush the whole model so the bundle matches what the editor shows.
      await api.putEescode(eescode);
      if (initials) await api.putInitials(initials);
      await api.putConf(useModelStore.getState().conf);

      let name = modelName;
      if (!name) {
        name = 'model';
      }

      // Authenticated request (session id in a header, not in the URL).
      const blob = await api.downloadBundle();
      const filename = `${name}.zip`;
      const result = await saveFileWithPicker(blob, filename, [
        { description: 'ZIP Bundle (*.zip)', accept: { 'application/zip': ['.zip'] } },
      ]);

      if (result.saved) {
        setDirty(false);
        if (result.name) {
          const stem = result.name.replace(/\.[^.]+$/, '');
          if (stem && stem !== modelName) {
            setModelName(stem);
            api.setModelName(stem).catch(() => {});
          }
        }
        addConsoleLine(`>>> Saved bundle: ${result.name || filename}`);
      }
    } catch (err: unknown) {
      addConsoleLine(`>>> ERROR: ${toErrMsg(err)}`);
    }
  }, [eescode, initials, modelName, setModelName, addConsoleLine, setDirty, setActivityMode]);

  // Export .sol
  const handleExportSol = useCallback(async () => {
    if (!sol.trim()) return;
    const filename = (modelName || 'model') + '.sol';
    try {
      const result = await saveFileWithPicker(
        new Blob([sol], { type: 'text/plain;charset=utf-8' }),
        filename,
        [{ description: 'Solution File (*.sol)', accept: { 'text/plain': ['.sol', '.txt'] } }]
      );
      if (result.saved) {
        addConsoleLine(`>>> Exported: ${result.name || filename}`);
      }
    } catch (err: unknown) {
      addConsoleLine(`>>> ERROR: ${toErrMsg(err)}`);
    }
  }, [sol, modelName, addConsoleLine]);

  const handleExportArrays = useCallback(() => {
    if (!lastResult?.variables) return;
    const { baseNames, indices, grid } = extractArrayGrid(lastResult.variables);
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

  // Back - restore previous model (replaces session, so confirm unsaved work)
  const doBack = useCallback(async () => {
    try {
      const res = await api.goBack();
      if (res.success) {
        await showSessionModel();
        setCanGoBack(false);
        setActivityMode('code');
        addConsoleLine('>>> Restored previous model');
      }
    } catch (err: unknown) {
      addConsoleLine(`>>> ERROR: ${toErrMsg(err)}`);
    }
  }, [addConsoleLine, setCanGoBack, setActivityMode]);

  const handleBack = useCallback(async () => {
    if (isRunBusy()) {
      addConsoleLine('>>> Cannot restore a model while a run is in progress.');
      return;
    }
    const s = useModelStore.getState();
    if (s.dirty || s.lookupTableDirty) {
      setConfirmBack(true);
      return;
    }
    await doBack();
  }, [addConsoleLine, doBack]);

  // Update guesses
  const handleUpdateGuesses = useCallback(async () => {
    // The server updates guesses from its own last solve, which is only the
    // model on screen when the shown result came from a live run of it.
    if (!useModelStore.getState().resultIsLive) {
      addConsoleLine('>>> Re-solve this model before updating guesses from its solution.');
      return;
    }
    try {
      await api.updateGuesses();
      const init = await api.getInitials();
      setInitials(init.content);
      addConsoleLine('>>> Guesses updated from last solution');
    } catch (err: unknown) {
      addConsoleLine(`>>> ERROR: ${toErrMsg(err)}`);
    }
  }, [setInitials, addConsoleLine]);

  // Reset guesses (wipes all initials: confirm first, one click is too easy)
  const doResetGuesses = useCallback(async () => {
    try {
      await api.putInitials('');
      setInitials('');
      addConsoleLine('>>> Initial guesses reset to default (1.0)');
    } catch (err: unknown) {
      addConsoleLine(`>>> ERROR: ${toErrMsg(err)}`);
    }
  }, [setInitials, addConsoleLine]);

  const handleResetGuesses = useCallback(() => {
    setConfirmResetGuesses(true);
  }, []);

  // Compile LaTeX report to PDF
  const handleLatexReport = useCallback(async () => {
    try {
      addConsoleLine('>>> Exporting plots...');
      let plots: { name: string; data: string }[] = [];
      try {
        const exported = await exportAllPlots();
        plots = exported.plots;
        if (exported.skipped > 0) {
          addConsoleLine(`>>> Plot export: ${exported.total} charts found, only the first ${exported.plots.length} are included.`);
        }
      } catch (plotErr: unknown) {
        addConsoleLine(`    Plot export error: ${toErrMsg(plotErr)} (continuing without plots)`);
      }
      addConsoleLine('>>> Compiling LaTeX report to PDF...');
      const pdfBlob = await api.compileLatexReport({ plots });
      const filename = (modelName || 'model') + '_report.pdf';
      const result = await saveFileWithPicker(pdfBlob, filename, [
        { description: 'PDF Document (*.pdf)', accept: { 'application/pdf': ['.pdf'] } },
      ]);
      if (result.saved) {
        addConsoleLine(`>>> PDF report downloaded: ${result.name || filename}`);
      }
    } catch (err: unknown) {
      addConsoleLine(`>>> PDF compilation failed: ${toErrMsg(err)}`);
      addConsoleLine('>>> Falling back to .tex download...');
      try {
        const res = await api.getLatexReport();
        if (res.available && res.content) {
          const blob = new Blob([res.content], { type: 'application/x-tex' });
          const filename = (modelName || 'model') + '_report.tex';
          const result = await saveFileWithPicker(blob, filename, [
            { description: 'LaTeX Source File (*.tex)', accept: { 'application/x-tex': ['.tex', '.txt'] } },
          ]);
          if (result.saved) {
            addConsoleLine(`>>> LaTeX source downloaded: ${result.name || filename}`);
          }
        } else {
          addConsoleLine('>>> No LaTeX report available');
        }
      } catch {
        addConsoleLine('>>> Could not download .tex fallback either');
      }
    }
  }, [modelName, addConsoleLine]);

  // Global keyboard shortcuts (IDE conventions)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Text fields keep their own keys (Ctrl+N while typing must not open a
      // new model). Monaco's hidden textarea is the editor: keep shortcuts there.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) &&
        !target.closest('.monaco-editor')
      ) {
        return;
      }
      if (e.key === 'F2' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
        e.preventDefault();
        if (!solving) handleSolve(e.shiftKey, tryHarderAvailable && !e.shiftKey);
      } else if (e.key === 'F9') {
        e.preventDefault();
        setActivityMode('code');
        setRightTab('variables');
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveScript('Saved As');
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveScript('Saved');
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleOpen();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        handleCloseActiveTab();
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

      } else if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        toggleBottomPanel();
      } else if (e.key === 'Escape' && (solving || parametricRunning)) {
        e.preventDefault();
        if (parametricRunning) void useParametricStore.getState().stopStudy();
        else void handleStopSolve();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    solving, parametricRunning, handleSolve, handleSaveScript, handleOpen, handleNew, handleCloseActiveTab,
    handleUpdateGuesses, handleCheckEquations, handleStopSolve,
    tryHarderAvailable, setRightTab, setActiveModal, toggleRightPanel, toggleBottomPanel, setActivityMode,
  ]);

  const menus: Record<Exclude<MenuId, null>, { label: string; items: MenuItem[] }> = {
    file: {
      label: 'File',
      items: [
        { label: 'New Model', shortcut: 'Ctrl+N', action: handleNew },
        { label: 'Open File…', shortcut: 'Ctrl+O', action: handleOpen },
        { label: 'Open from Model Library…', action: () => setActiveModal('library') },
        { label: 'Revert to Previous Model', disabled: !canGoBack, action: handleBack },
        { divider: true },
        { label: 'Save', shortcut: 'Ctrl+S', disabled: !eescode.trim(), action: () => handleSaveScript('Saved') },
        { label: 'Save As…', shortcut: 'Ctrl+Shift+S', disabled: !eescode.trim(), action: () => handleSaveScript('Saved As') },
        { divider: true },
        { label: 'Save Bundle (.zip)…', disabled: !eescode.trim(), action: handleSaveBundle },
        { divider: true },
        { label: 'Close File', shortcut: 'Ctrl+W', action: handleCloseActiveTab },
        { divider: true },
        { label: 'Export Solution (.sol)', disabled: !sol.trim(), action: handleExportSol },
        {
          label: 'Export LaTeX / PDF Report…',
          disabled: !lastResult?.success || !lastResult?.latexReportAvailable || !resultIsLive,
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
        { label: 'Variable Info & Guesses…', shortcut: 'F9', action: () => { setActivityMode('code'); useUIStore.getState().setRightPanelOpen(true); setRightTab('variables'); } },
        { label: 'Function Info…', shortcut: 'Ctrl+I', action: () => setActiveModal('functionInfo') },
        { label: 'Unit System ($UnitSystem)…', action: () => setActiveModal('unitSystem') },
        { label: 'Integration Options (INTEGRAL)…', action: () => setActivityMode('integral') },
        { label: 'Solver Configuration (coolsolve.conf)…', action: () => { setActivityMode('code'); useUIStore.getState().setRightPanelOpen(true); setRightTab('config'); } },
        { divider: true },
        { label: 'Warnings & Diagnostics', action: () => { useUIStore.getState().setBottomPanelOpen(true); setBottomTab('diagnostics'); } },
      ],
    },
    calculate: {
      label: 'Calculate',
      items: [
        { label: 'Check / Format Equations', shortcut: 'Ctrl+K', disabled: !eescode.trim(), action: handleCheckEquations },
        { label: 'Solve', shortcut: 'F2', disabled: solving || parametricRunning || !eescode.trim(), action: () => handleSolve(false, false) },
        { label: 'Solve with Deep Search (Try Harder)', disabled: solving || parametricRunning || !eescode.trim(), action: () => handleSolve(false, true) },
        { label: 'Debug Solve (Full Trace)', shortcut: 'Ctrl+Shift+Enter', disabled: solving || parametricRunning || !eescode.trim(), action: () => handleSolve(true, false) },
        {
          label: 'Stop Calculation',
          shortcut: 'Esc',
          disabled: !solving && !parametricRunning,
          action: () => {
            if (parametricRunning) void useParametricStore.getState().stopStudy();
            else void handleStopSolve();
          },
        },
        { divider: true },
        { label: 'Update Guesses from Solution', shortcut: 'Ctrl+G', disabled: !lastResult?.success || !resultIsLive, action: handleUpdateGuesses },
        { label: 'Reset Guesses to Default', disabled: !initials.trim(), action: handleResetGuesses },
      ],
    },
    tables: {
      label: 'Tables',
      items: [
        { label: 'Parametric Table (Sensitivity Study)', action: () => setActivityMode('parametric') },
        { label: 'Lookup Tables', action: () => setActivityMode('tables') },
        { label: 'Arrays Table', action: () => { setActivityMode('code'); useUIStore.getState().setRightPanelOpen(true); setRightTab('arrays'); } },
        { label: 'Integral Table ($IntegralTable)', action: () => setActivityMode('integral') },
        { divider: true },
        { label: 'Export Arrays Table to CSV', disabled: !hasArrayVariables, action: handleExportArrays },
        { label: 'Export Parametric Study to CSV', disabled: !activeParametricResult, action: handleExportParametric },
      ],
    },
    plots: {
      label: 'Plots',
      items: [
        { label: 'Property Diagram (T-s, P-h, h-s, T-h)', action: () => setActivityMode('diagrams') },
      ],
    },
    help: {
      label: 'Help',
      items: [
        { label: 'Language & Fluid Reference',
          action: () => window.open('/docs/#docs%2Flanguage_reference.md', '_blank', 'noopener,noreferrer'),
        },
        // Usage stats list every client's IPs/model names: local installs only.
        ...(STATS_LOCAL_ONLY
          ? [{ label: 'Solve Usage Statistics…', action: () => setActiveModal('stats') }]
          : []),
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

      {/* Right: Window controls & tools */}
      <div className="topbar-right">
        <button
          className={`icon-btn ${rightPanelOpen && activityMode === 'code' ? 'active' : ''}`}
          onClick={toggleRightPanel}
          disabled={activityMode !== 'code'}
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

      {confirmNew && (
        <ConfirmModal
          title="Discard Unsaved Work?"
          message="Creating a new model will discard this model's code and its run results (solution, sweeps, integral table)."
          confirmLabel="Discard & Create New"
          onConfirm={() => {
            setConfirmNew(false);
            doNew();
          }}
          onCancel={() => setConfirmNew(false)}
        />
      )}
      {confirmCloseTab && (
        <ConfirmModal
          title="Discard Unsaved Work?"
          message={`"${confirmCloseTab.name}" has unsaved changes or run results. Closing it will discard them.`}
          confirmLabel="Discard & Close"
          onConfirm={() => {
            setActivityMode('code');
            closeTab(confirmCloseTab.id);
            setConfirmCloseTab(null);
          }}
          onCancel={() => setConfirmCloseTab(null)}
        />
      )}
      {confirmOpen && (
        <ConfirmModal
          title="Discard Unsaved Work?"
          message="Opening a file replaces the current session. Unsaved editor text or table edits will be lost."
          confirmLabel="Discard & Open"
          onConfirm={async () => {
            const f = pendingOpenFile;
            setConfirmOpen(false);
            setPendingOpenFile(null);
            if (f) {
              useModelStore.getState().setLookupTableDirty(false);
              await doOpenFile(f);
            }
          }}
          onCancel={() => {
            setConfirmOpen(false);
            setPendingOpenFile(null);
          }}
        />
      )}
      {confirmBack && (
        <ConfirmModal
          title="Discard Unsaved Work?"
          message="Restoring the previous model replaces the current session. Unsaved edits will be lost."
          confirmLabel="Discard & Restore"
          onConfirm={async () => {
            setConfirmBack(false);
            useModelStore.getState().setLookupTableDirty(false);
            await doBack();
          }}
          onCancel={() => setConfirmBack(false)}
        />
      )}
      {confirmResetGuesses && (
        <ConfirmModal
          title="Reset All Guesses?"
          message="This clears every initial guess. This cannot be undone."
          confirmLabel="Reset Guesses"
          onConfirm={async () => {
            setConfirmResetGuesses(false);
            await doResetGuesses();
          }}
          onCancel={() => setConfirmResetGuesses(false)}
        />
      )}
    </header>
  );
}
