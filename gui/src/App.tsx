import { useEffect, useState, useMemo } from 'react';
import { PanelRight, PanelBottom, ChevronDown } from 'lucide-react';
import Toolbar from './components/Toolbar';
import CodeEditor from './components/CodeEditor';
import VariableTable from './components/VariableTable';
import ArrayTable from './components/ArrayTable';
import ConfigEditor from './components/ConfigEditor';
import DebugViewer from './components/DebugViewer';
import ThermoDiagramSetup from './components/ThermoDiagramSetup';
import ThermoDiagramResults from './components/ThermoDiagramResults';
import Console from './components/Console';
import LookupTableEditor from './components/LookupTableEditor';
import IntegralTable from './components/IntegralTable';
import UsageStats from './components/UsageStats';
import SplitPane from './components/SplitPane';
import ActivityBar from './components/ActivityBar';
import ParametricSetup from './components/ParametricSetup';
import ParametricResults from './components/ParametricResults';
import LookupTablesSetup from './components/LookupTablesSetup';
import IntegralSetup from './components/IntegralSetup';
import { AppModals } from './components/AppModals';
import { useModelStore } from './stores/modelStore';
import { useUIStore } from './stores/uiStore';
import { api } from './api/client';
import { enableTabSession, getTabSessionId } from './api/session';
import { openLibraryModel } from './utils/library';
import { showSessionModel } from './utils/sessionModel';
import { applyAppearance } from './utils/appearance';
import './App.css';

// Hidden utility page (solve usage statistics) — reachable at /stats only,
// deliberately not linked from anywhere in the UI.
const STATS_PATH = '/stats';

// An open tab tells the server that its session is in use at this interval: the server drops
// sessions idle for 24 h, which would otherwise lose the model of a tab left open overnight.
const KEEPALIVE_INTERVAL_MS = 15 * 60 * 1000;

export default function App() {
  if (window.location.pathname === STATS_PATH) {
    return <UsageStats />;
  }
  return <MainApp />;
}

function MainApp() {
  const theme = useUIStore((s) => s.theme);
  const palette = useUIStore((s) => s.palette);
  const accent = useUIStore((s) => s.accent);
  const activityMode = useUIStore((s) => s.activityMode);
  const leftPanelWidth = useUIStore((s) => s.leftPanelWidth);
  const setLeftPanelWidth = useUIStore((s) => s.setLeftPanelWidth);
  const rightTab = useUIStore((s) => s.rightTab);
  const setRightTab = useUIStore((s) => s.setRightTab);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const bottomPanelOpen = useUIStore((s) => s.bottomPanelOpen);
  const toggleBottomPanel = useUIStore((s) => s.toggleBottomPanel);
  const consolePosition = useUIStore((s) => s.consolePosition);
  const toggleConsolePosition = useUIStore((s) => s.toggleConsolePosition);
  const setActiveModal = useUIStore((s) => s.setActiveModal);

  const eescode = useModelStore((s) => s.eescode);
  const equationCount = useModelStore((s) => s.equationCount);
  const variableCount = useModelStore((s) => s.variableCount);
  const isSquare = useModelStore((s) => s.isSquare);
  const parseErrors = useModelStore((s) => s.parseErrors);
  const lastResult = useModelStore((s) => s.lastResult);
  const solving = useModelStore((s) => s.solving);

  const [ready, setReady] = useState(false);

  // Extract active $UnitSystem string for the status bar
  const unitSystemBadge = useMemo(() => {
    const m = eescode.match(/^\s*\$UnitSystem\s+([^\r\n{"]+)/im);
    return m ? m[1].trim() : 'SI C Pa J mass deg';
  }, [eescode]);

  // Initialize: warmup CoolProp, then open what was asked for
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const libraryParam = params.get('library');
    if (libraryParam) enableTabSession();
    api.warmup()
      .catch(() => {})
      .finally(async () => {
        try {
          if (libraryParam) {
            await openLibraryModel(libraryParam, params.get('file') ?? undefined, false);
            window.history.replaceState(null, '', window.location.pathname);
          } else if (getTabSessionId()) {
            await showSessionModel();
          } else {
            const initial = await api.getInitialFile();
            if (initial?.path) {
              await api.openFile(initial.path);
              await showSessionModel();
            }
          }
        } catch {
          // Not critical — user can open files manually
        }
        setReady(true);
      });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => { api.keepAlive().catch(() => {}); }, KEEPALIVE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  // Apply theme & modern palette
  useEffect(() => {
    applyAppearance(palette, accent);
  }, [palette, accent]);

  // Prevent default browser context menu and accidental text selection globally
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      // Allow Monaco editor's in-app HTML context menu
      if (target?.closest?.('.monaco-editor')) {
        return;
      }
      e.preventDefault();
    };

    const handleDblClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable ||
        target?.closest?.('.monaco-editor')
      ) {
        return;
      }
      window.getSelection()?.removeAllRanges();
    };

    window.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('dblclick', handleDblClick);
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('dblclick', handleDblClick);
    };
  }, []);

  if (!ready) {
    return (
      <div className="loading-splash" data-theme={theme}>
        <div className="app-mark-dot" style={{ width: 10, height: 10 }} />
        <h1>CoolSolve-Canary</h1>
        <div className="spinner" style={{ width: 22, height: 22 }} />
        <p>Initializing thermodynamic engine…</p>
      </div>
    );
  }

  const consoleHeader = (
    <div className="tab-bar bottom-panel-header" style={{ justifyContent: 'space-between', paddingRight: 6 }}>
      <button
        className="tab-btn active"
        onClick={toggleBottomPanel}
        title="Toggle console output"
      >
        Console
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          className="icon-btn small"
          onClick={(e) => {
            e.stopPropagation();
            toggleConsolePosition();
          }}
          title={consolePosition === 'bottom' ? 'Dock console below RHS panel (Maximize code area)' : 'Dock console at bottom (Full width)'}
          aria-label="Toggle console position"
        >
          {consolePosition === 'bottom' ? <PanelRight size={13} /> : <PanelBottom size={13} />}
        </button>
        <button
          className="icon-btn small"
          onClick={(e) => {
            e.stopPropagation();
            toggleBottomPanel();
          }}
          title="Collapse console"
          aria-label="Collapse console"
        >
          <ChevronDown size={13} />
        </button>
      </div>
    </div>
  );

  const consoleView = (
    <div className="bottom-panel" style={{ height: '100%', minHeight: 0 }}>
      {consoleHeader}
      <Console />
    </div>
  );

  const rightInspectorBase = (
    <div className="right-panel" style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="tab-bar">
        <button
          className={`tab-btn ${rightTab === 'variables' ? 'active' : ''}`}
          onClick={() => setRightTab('variables')}
        >
          Solution
        </button>
        <button
          className={`tab-btn ${rightTab === 'arrays' ? 'active' : ''}`}
          onClick={() => setRightTab('arrays')}
        >
          Arrays
        </button>
        <button
          className={`tab-btn ${rightTab === 'debug' ? 'active' : ''}`}
          onClick={() => setRightTab('debug')}
        >
          Residuals
        </button>
        <button
          className={`tab-btn ${rightTab === 'config' ? 'active' : ''}`}
          onClick={() => setRightTab('config')}
        >
          Config
        </button>
      </div>
      <div className="tab-content">
        {rightTab === 'variables' && <VariableTable />}
        {rightTab === 'arrays' && <ArrayTable />}
        {rightTab === 'config' && <ConfigEditor />}
        {rightTab === 'debug' && <DebugViewer />}
      </div>
    </div>
  );

  const rightInspector = consolePosition === 'rhs' && bottomPanelOpen ? (
    <SplitPane direction="vertical" defaultSize={62} minSize={80}>
      {rightInspectorBase}
      {consoleView}
    </SplitPane>
  ) : (
    rightInspectorBase
  );

  const centerWorkspace = activityMode === 'code' ? (
    rightPanelOpen ? (
      <SplitPane direction="horizontal" defaultSize={67} minSize={240}>
        <CodeEditor />
        {rightInspector}
      </SplitPane>
    ) : (
      <CodeEditor />
    )
  ) : activityMode === 'parametric' ? (
    <ParametricResults />
  ) : activityMode === 'diagrams' ? (
    <ThermoDiagramResults />
  ) : activityMode === 'tables' ? (
    <div className="parametric-results-view">
      <LookupTableEditor />
    </div>
  ) : (
    <div className="parametric-results-view">
      <IntegralTable />
    </div>
  );

  const handleSidebarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = leftPanelWidth;
    const onMove = (ev: MouseEvent) => {
      const newW = Math.max(180, Math.min(420, startW + (ev.clientX - startX)));
      setLeftPanelWidth(newW);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('is-resizing-pane');
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.body.classList.add('is-resizing-pane');
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const topWorkspace = (
    <div className="workspace-row" style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
      {activityMode !== 'code' && (
        <div className="left-sidebar-container" style={{ width: leftPanelWidth, display: 'flex', flexShrink: 0, height: '100%', position: 'relative' }}>
          <div className="left-panel" style={{ flex: 1, minWidth: 0 }}>
            {activityMode === 'parametric' && <ParametricSetup />}
            {activityMode === 'diagrams' && <ThermoDiagramSetup />}
            {activityMode === 'tables' && <LookupTablesSetup />}
            {activityMode === 'integral' && <IntegralSetup />}
          </div>
          <div
            className="sidebar-resizer"
            onMouseDown={handleSidebarMouseDown}
            title="Drag to resize sidebar"
          />
        </div>
      )}
      <div className="center-workspace-container" style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
        {centerWorkspace}
      </div>
    </div>
  );

  return (
    <div className="app">
      <Toolbar />

      <div className="app-body">
        <ActivityBar />

        <div className="app-main-content">
          {bottomPanelOpen && consolePosition === 'bottom' ? (
            <SplitPane
              direction="vertical"
              defaultSize={80}
              minSize={32}
              className="main-vertical-split"
            >
              {topWorkspace}
              {consoleView}
            </SplitPane>
          ) : (
            <div className="main-vertical-split" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                {topWorkspace}
              </div>
              {!bottomPanelOpen && (
                <div className="tab-bar bottom-panel-header collapsed-bottom-bar">
                  <button className="tab-btn" onClick={toggleBottomPanel}>Console</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <footer className="status-bar">
        <div className="status-left">
          <span className={`status-dot ${
            solving ? 'solving' : lastResult ? (lastResult.success ? 'ok' : 'err') : 'idle'
          }`} />
          <span>
            {solving
              ? 'Solving…'
              : lastResult
                ? (lastResult.success
                    ? `Solved (${lastResult.timing?.total_ms?.toFixed(0) ?? 0} ms)`
                    : 'Solve Failed')
                : 'Ready'}
          </span>
          <span className="status-sep">·</span>
          <span>
            {equationCount > 0
              ? `${equationCount} eq, ${variableCount} var`
              : 'Empty model'}
          </span>
          {equationCount > 0 && (
            <>
              <span className="status-sep">·</span>
              <span className={isSquare ? 'status-ok-text' : 'status-warn-text'}>
                {isSquare
                  ? 'Square'
                  : variableCount > equationCount
                    ? `${variableCount - equationCount} free`
                    : `${equationCount - variableCount} over`}
              </span>
            </>
          )}
          {parseErrors.length > 0 && (
            <>
              <span className="status-sep">·</span>
              <span
                className="status-err-text"
                style={{ cursor: 'help' }}
                title={parseErrors.map((e) => `Line ${e.line}: ${e.message}`).join('\n')}
              >
                Line {parseErrors[0].line}: {parseErrors[0].message}
              </span>
            </>
          )}
        </div>

        <div className="status-right">
          <button
            className="status-unit-btn"
            onClick={() => setActiveModal('unitSystem')}
            title="Click to configure $UnitSystem"
          >
            {unitSystemBadge}
          </button>
        </div>
      </footer>

      <AppModals />
    </div>
  );
}
