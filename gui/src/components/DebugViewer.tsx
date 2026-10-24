import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useModelStore } from '../stores/modelStore';
import { toErrMsg } from '../utils/errors';
import { FileText, RefreshCw, ChevronDown, ChevronRight, X, Maximize2, Minimize2 } from 'lucide-react';
import SplitPane from './SplitPane';

interface DebugFile {
  name: string;
  size: number;
}

export default function DebugViewer() {
  const [files, setFiles] = useState<DebugFile[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [blocksOpen, setBlocksOpen] = useState(true);
  const [filesOpen, setFilesOpen] = useState(true);
  const [maximized, setMaximized] = useState(false);
  const lastResult = useModelStore((s) => s.lastResult);

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
    setSelected(name);
    setLoading(true);
    try {
      const res = await api.getDebugFile(name);
      setContent(res.content);
    } catch (err: unknown) {
      setContent(`Error loading file: ${toErrMsg(err)}`);
    }
    setLoading(false);
  }, []);

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
        <div className="debug-empty">
          <p>No block residuals or debug trace available yet.</p>
          <p>Solve a model (<kbd>F2</kbd>) to inspect block convergence, or run <strong>Calculate → Debug Solve</strong> (<kbd>Ctrl+Shift+Enter</kbd>) for full trace files.</p>
          <button className="toolbar-btn" onClick={refresh} style={{ marginTop: 8 }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>
    );
  }

  const blocksPane = (
    <div className={`debug-blocks-summary ${!blocksOpen ? 'collapsed' : ''}`}>
      <div className="debug-file-list-header clickable" onClick={() => setBlocksOpen((o) => !o)}>
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
      <div className="debug-file-list-header clickable" onClick={() => setFilesOpen((o) => !o)}>
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
              className={`debug-file-item ${selected === f.name ? 'active' : ''}`}
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

  const previewSection = selected ? (
    <div className="debug-content">
      <div className="debug-content-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText size={12} />
          <span>{selected}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            className="icon-btn"
            onClick={() => setMaximized((m) => !m)}
            title={maximized ? 'Restore pane' : 'Maximize pane'}
            style={{ width: 22, height: 22 }}
          >
            {maximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <button
            className="icon-btn"
            onClick={() => {
              setSelected(null);
              setMaximized(false);
            }}
            title="Close preview"
            style={{ width: 22, height: 22 }}
          >
            <X size={12} />
          </button>
        </div>
      </div>
      {loading ? (
        <div className="debug-loading"><span className="spinner" /></div>
      ) : (
        <pre className="debug-pre">{content}</pre>
      )}
    </div>
  ) : (
    <div className="debug-hint">
      Select a trace file above to inspect equations, residuals, or solver steps.
    </div>
  );

  const filesPane = files.length > 0 ? (
    selected ? (
      <SplitPane
        direction="vertical"
        defaultSize={35}
        minSize={30}
        collapsed={!filesOpen ? 'first' : false}
        className="debug-trace-split"
      >
        {filesListSection}
        {previewSection}
      </SplitPane>
    ) : (
      <div className="debug-trace-container">
        {filesListSection}
        {previewSection}
      </div>
    )
  ) : (
    <div className="debug-hint">
      Run <strong>Calculate → Debug Solve</strong> (<kbd>Ctrl+Shift+Enter</kbd>) to generate detailed equation &amp; residual trace files.
    </div>
  );

  return (
    <div className={`debug-viewer ${maximized ? 'is-maximized' : ''}`}>
      {maximized && selected ? (
        previewSection
      ) : blocks.length > 0 && files.length > 0 ? (
        <SplitPane
          direction="vertical"
          defaultSize={selected ? 35 : 50}
          minSize={30}
          collapsed={!blocksOpen ? 'first' : false}
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
