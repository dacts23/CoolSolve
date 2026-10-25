import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useModelStore } from '../stores/modelStore';
import { useUIStore } from '../stores/uiStore';
import { toErrMsg } from '../utils/errors';
import { FileText, RefreshCw, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import SplitPane from './SplitPane';

interface DebugFile {
  name: string;
  size: number;
}

export default function DebugViewer() {
  const [files, setFiles] = useState<DebugFile[]>([]);
  const [blocksOpen, setBlocksOpen] = useState(true);
  const [filesOpen, setFilesOpen] = useState(true);
  const lastResult = useModelStore((s) => s.lastResult);
  const eescode = useModelStore((s) => s.eescode);
  const debugFile = useUIStore((s) => s.debugFile);
  const openDebugFile = useUIStore((s) => s.openDebugFile);

  // Dynamic (INTEGRAL) models are marched step by step, so the solver reports
  // no static block decomposition for them - say so instead of promising one.
  const isDynamic = /\binegral\s*\(/i.test(eescode);

  const refresh = useCallback(async () => {
    try {
      const res = await api.getDebugFiles();
      setFiles(res.files);
    } catch {
      setFiles([]);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, lastResult]);

  const handleSelectFile = useCallback(async (name: string) => {
    openDebugFile(name, '', true);
    try {
      const res = await api.getDebugFile(name);
      openDebugFile(name, res.content, false);
    } catch (err: unknown) {
      openDebugFile(name, `Error loading file: ${toErrMsg(err)}`, false);
    }
  }, [openDebugFile]);

  const blocks = lastResult?.blockResults ?? [];
  const fileOrder = ['report.md', 'solver_errors.md', 'equations.md', 'variables.md', 'variables.csv', 'analysis.json', 'residuals.md', 'residuals.txt', 'original.eescode', 'coolsolve.conf'];
  const sortedFiles = [...files].sort((a, b) => {
    const ai = fileOrder.indexOf(a.name);
    const bi = fileOrder.indexOf(b.name);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.name.localeCompare(b.name);
  });

  if (blocks.length === 0 && files.length === 0) {
    return (
      <div className="debug-viewer">
        <div className="parametric-empty-state" style={{ height: '100%' }}>
          <div className="empty-state-content">
            <div className="empty-state-icon">
              <Layers size={36} />
            </div>
            <h2>Solver Debug & Decomposition</h2>
            {isDynamic ? (
              <>
                <p>
                  Block decomposition is not available for dynamic (INTEGRAL) models: the
                  trajectory is marched step by step, so there is no static block table.
                  The <strong>Integral</strong> panel shows the recorded trajectory instead.
                </p>
                <div className="empty-state-steps">
                  <div className="step-item">
                    <span className="step-num">1</span>
                    <span>Press <strong>Ctrl+Shift+Enter</strong> (Debug Solve) to generate the trace files</span>
                  </div>
                  <div className="step-item">
                    <span className="step-num">2</span>
                    <span>Open <strong>integral.md</strong> or <strong>integral_table.csv</strong> below to inspect the run</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p>
                  Inspect equation block partitioning, Tarjan SCC decomposition, and per-block solver residuals.
                </p>
                <div className="empty-state-steps">
                  <div className="step-item">
                    <span className="step-num">1</span>
                    <span>Open or edit your model in the Code Editor</span>
                  </div>
                  <div className="step-item">
                    <span className="step-num">2</span>
                    <span>Press <strong>F2</strong> (Solve) or <strong>Ctrl+Shift+Enter</strong> (Debug Solve)</span>
                  </div>
                  <div className="step-item">
                    <span className="step-num">3</span>
                    <span>Examine block-by-block convergence and generated analysis files</span>
                  </div>
                </div>
              </>
            )}
            <button className="toolbar-btn" onClick={refresh} style={{ marginTop: 8 }}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  const blocksPane = (
    <div className={`debug-blocks-summary ${!blocksOpen ? 'collapsed' : ''}`}>
      <div className="debug-file-list-header clickable" onClick={() => setBlocksOpen((o) => !o)} title={blocksOpen ? "Fold Tarjan Block Decomposition" : "Unfold Tarjan Block Decomposition"}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {blocksOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <span>Tarjan Block Decomposition ({blocks.length} blocks · {lastResult?.totalIterations ?? 0} total iters)</span>
        </div>
      </div>
      {blocksOpen && (
        <div className="debug-blocks-scroll">
          <table className="variable-table">
            <thead>
              <tr>
                <th>Block</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Iters</th>
                <th style={{ textAlign: 'right' }}>Max Residual</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((b) => (
                <tr key={b.id}>
                  <td>#{b.id}</td>
                  <td style={{ color: b.success ? 'var(--success-color)' : 'var(--error-color)' }}>
                    {b.status}
                  </td>
                  <td className="value-cell">{b.iterations}</td>
                  <td className="value-cell">{Number.isFinite(b.maxResidual) ? b.maxResidual.toExponential(2) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const filesListSection = (
    <div className={`debug-file-list-wrap ${!filesOpen ? 'collapsed' : ''}`}>
      <div className="debug-file-list-header clickable" onClick={() => setFilesOpen((o) => !o)} title={filesOpen ? "Fold Debug Trace Files" : "Unfold Debug Trace Files"}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {filesOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <span>Debug Trace Files ({files.length})</span>
        </div>
        <button
          className="icon-btn"
          onClick={(e) => { e.stopPropagation(); refresh(); }}
          title="Refresh trace files"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {filesOpen && (
        <div className="debug-file-list">
          {sortedFiles.map((f) => (
            <button
              key={f.name}
              className={`debug-file-item ${debugFile?.name === f.name ? 'active' : ''}`}
              onClick={() => handleSelectFile(f.name)}
            >
              <FileText size={12} />
              <span>{f.name}</span>
              <span className="debug-file-size">{formatSize(f.size)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const filesPane = files.length > 0 ? (
    filesListSection
  ) : (
    <div className="debug-hint">
      Run <strong>Calculate → Debug Solve</strong> (<kbd>Ctrl+Shift+Enter</kbd>) to generate detailed equation &amp; residual trace files.
    </div>
  );

  return (
    <div className="debug-viewer">
      {blocks.length > 0 && files.length > 0 ? (
        <SplitPane
          direction="vertical"
          defaultSize={50}
          minSize={30}
          collapsed={
            !blocksOpen && !filesOpen
              ? 'both'
              : !blocksOpen
                ? 'first'
                : !filesOpen
                  ? 'second'
                  : false
          }
          className="debug-main-split"
        >
          {blocksPane}
          {filesPane}
        </SplitPane>
      ) : blocks.length > 0 ? (
        blocksPane
      ) : (
        filesPane
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
