import Select from './Select';
import { EmptyState, PlotRow, NumInput, TablePager } from './SetupShell';
import { Download, Sigma, SlidersHorizontal, X } from 'lucide-react';
import { MARKER_SYMBOL_OPTIONS, type MarkerSymbol } from '../stores/diagramStore';
import SyntaxFooter from './SyntaxFooter';
/**
 * IntegralTable.tsx — Bottom-panel tab for the equation-based dynamic
 * (INTEGRAL / $IntegralTable) trajectory.
 *
 * Mirrors the Parametric Study panel's UX: a scrollable columnar table
 * (integration variable always first), a row count, an "Export CSV"
 * button, an optional line plot of one tabulated variable versus the
 * integration variable, and an empty-state message when no integral has
 * been solved. Read-only — Integral Tables are generated from solution trajectories.
 *
 * Data sources (in priority order):
 *   1. `integralTable` (columnar JSON from a live solve response)
 *   2. `integralCSV`   (raw CSV text, restored from a ZIP bundle when the
 *                       columnar JSON is unavailable)
 *
 * The CSV round-trip is the persistence contract: download bundle →
 * upload bundle → the same columns and rows reappear here (see
 * `tests/test_integral_api.py`).
 */
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import Plot from './PlotlyChart';
import { useModelStore } from '../stores/modelStore';
import { fmt } from '../stores/parametricStore';
import { downloadCsv, serializeCSV, safeSpreadsheetCell } from '../utils/csv';
import { savePlotPng } from '../utils/exportPlots';
import { resolveIntegralTable } from '../utils/integralTable.ts';
import { TABLE_PAGE_SIZE, pageCount, clampPage } from '../utils/paging.ts';
import type { IntegralTableData } from '../api/types';

// ============================================================================
// Main component
// ============================================================================

export default function IntegralTable() {
  const integralTable = useModelStore((s) => s.integralTable);
  const integralCSV = useModelStore((s) => s.integralCSV);
  const addConsoleLine = useModelStore((s) => s.addConsoleLine);
  const plotBoxRef = useRef<HTMLDivElement>(null);

  // Resolve the active table: prefer the live columnar JSON; fall back to
  // parsing the restored CSV (bundle round-trip). Shared with IntegralSetup.
  const table = useMemo<IntegralTableData | null>(
    () => resolveIntegralTable(integralTable, integralCSV),
    [integralTable, integralCSV]
  );

  // Plot axes: X defaults to the integration variable (time), Y to the first
  // other column. Selections reset when the table swaps underneath them.
  const [plotXVar, setPlotXVar] = useState('');
  const [plotYVar, setPlotYVar] = useState('');

  // Plot cosmetics live here (not in a store): they belong to this panel and
  // must never leak into another model's tab.
  const [plotSettingsOpen, setPlotSettingsOpen] = useState(false);
  const [plotSettingsTab, setPlotSettingsTab] = useState<'labels' | 'style'>('labels');
  const [plotTitle, setPlotTitle] = useState('');
  const [plotXLabel, setPlotXLabel] = useState('');
  const [plotYLabel, setPlotYLabel] = useState('');
  const [plotBackground, setPlotBackground] = useState<'auto' | 'light' | 'dark'>('auto');
  const [plotLineColor, setPlotLineColor] = useState('#3b82f6');
  const [plotLineWidth, setPlotLineWidth] = useState(2);
  const [plotLineDash, setPlotLineDash] = useState<'solid' | 'dash' | 'dot' | 'dashdot'>('solid');
  const [plotMarkerSymbol, setPlotMarkerSymbol] = useState<MarkerSymbol | 'hidden'>('circle');
  const [plotMarkerSize, setPlotMarkerSize] = useState(5);

  // Long trajectories build thousands of DOM rows: page the table.
  const PAGE_SIZE = TABLE_PAGE_SIZE;
  const [page, setPage] = useState(0);
  const totalPages = pageCount(table?.numRows ?? 0, PAGE_SIZE);
  const safePage = clampPage(page, table?.numRows ?? 0, PAGE_SIZE);
  useEffect(() => { setPage(0); }, [table?.csvName, table?.numRows, table?.columns.length]);

  const plotCandidates = useMemo(() => {
    if (!table) return [];
    return table.columns.filter((c) => c !== table.integrationVar);
  }, [table]);

  // Keep both plot selectors valid as the table changes.
  useEffect(() => {
    if (!table) return;
    if (!table.columns.includes(plotXVar)) {
      setPlotXVar(table.integrationVar);
    }
    if (plotCandidates.length > 0 && !plotCandidates.includes(plotYVar)) {
      setPlotYVar(plotCandidates[0]);
    }
  }, [table, table?.columns, table?.integrationVar, plotCandidates, plotXVar, plotYVar]);

  const resolvedXVar = plotXVar || (table?.integrationVar ?? '');
  const xTitle = plotXLabel.trim() || resolvedXVar;
  const yTitle = plotYLabel.trim() || plotYVar;

  const plotData = useMemo<{ data: Plotly.Data[]; layout: Partial<Plotly.Layout> }>(() => {
    if (!table || !resolvedXVar || !plotYVar) return { data: [], layout: {} };
    const x = table.data[resolvedXVar] ?? [];
    const y = table.data[plotYVar] ?? [];
    const n = Math.min(x.length, y.length);
    return {
      data: [{
        x: x.slice(0, n),
        y: y.slice(0, n),
        type: 'scatter' as const,
        mode: plotMarkerSymbol === 'hidden' ? 'lines' as const : 'lines+markers' as const,
        marker: plotMarkerSymbol === 'hidden'
          ? { size: 0, color: 'rgba(0,0,0,0)', symbol: 'circle' as const, opacity: 0, line: { width: 0, color: 'rgba(0,0,0,0)' } }
          : { size: plotMarkerSize, color: plotLineColor, symbol: plotMarkerSymbol, line: { width: 1, color: '#ffffff' } },
        line: { color: plotLineColor, width: plotLineWidth, dash: plotLineDash },
        name: plotYVar,
      }],
      layout: {
        title: { text: plotTitle },
        xaxis: { title: { text: xTitle } },
        yaxis: { title: { text: yTitle } },
        margin: { t: 35, r: 45, b: 45, l: 60 },
      },
    };
  }, [table, resolvedXVar, plotYVar, plotTitle, xTitle, yTitle, plotLineColor, plotLineWidth, plotLineDash, plotMarkerSymbol, plotMarkerSize]);

  // Same save path as the other plots: the modebar camera downloads straight
  // to Downloads with no name choice.
  const handleSavePlot = useCallback(() => {
    const base = (table?.csvName ?? '').replace(/\.csv$/i, '') || 'integral';
    return savePlotPng(plotBoxRef.current, `${base}-plot.png`, addConsoleLine);
  }, [table, addConsoleLine]);

  // ---- Export CSV ----
  const handleExport = useCallback(async () => {
    if (!table) return;
    const csv = serializeCSV([
      table.columns.map(safeSpreadsheetCell),
      ...Array.from({ length: table.numRows }, (_, r) =>
        table.columns.map((c) => {
          const v = table.data[c]?.[r];
          return v === undefined || Number.isNaN(v) ? '' : String(v);
        })
      ),
    ]);
    await downloadCsv(table.csvName || 'integral.csv', csv);
  }, [table]);

  // ---- Empty state ----
  if (!table) {
    return (
      <div className="table-editor-container">
        <div className="table-title-header">
          <div className="table-title-display">
            <h2 className="table-main-title">Integral Table</h2>
          </div>
        </div>
        <EmptyState
          style={{ flex: 1 }}
          icon={<Sigma size={36} />}
          title="Dynamic Integral Trajectories"
          description="Simulate initial-value differential-algebraic equations (DAEs) and plot time-marching state variables."
          steps={[
            <>Define differential equations using <strong>y = y0 + INTEGRAL(dydt, t, t0, tf)</strong></>,
            <>Add <strong>$IntegralTable t:step, var1, var2</strong> to record variables</>,
            <>Click <strong>Solve (F2)</strong> to compute and explore the dynamic solution table here</>,
          ]}
        />
        <SyntaxFooter
          items={[
            { code: 'x = INTEGRAL(dx_dt, t, 0, 10)' },
            { code: '$IntegralTable t:0.1, x, dx_dt' },
          ]}
          fileHint="<model>-integral.csv"
        />
      </div>
    );
  }

  const stepInfo = [
    table.totalSteps !== undefined && `${table.totalSteps} steps`,
    table.rejectedSteps !== undefined && table.rejectedSteps > 0
      ? `${table.rejectedSteps} rejected` : null,
    table.csvName,
  ].filter(Boolean).join(' · ');

  return (
    <div className="table-editor-container">
      <div className="table-title-header">
        <div className="table-title-display">
          <h2 className="table-main-title">Integral Table</h2>
          <span className="table-meta-badge">{table.numRows} rows</span>
          {stepInfo && <span className="integral-meta">· {stepInfo}</span>}
        </div>
        <button
          className="table-btn-pill"
          onClick={handleExport}
          title={`Export the trajectory as ${table.csvName || 'integral.csv'}`}
        >
          <Download size={11} /> Export CSV
        </button>
      </div>

      <div className="parametric-results-content">
        {/* Plot */}
        {plotCandidates.length > 0 && (
          <>
            <div className="parametric-plot-controls">
              <label>X variable:</label>
              <Select
                value={resolvedXVar}
                options={table?.columns ?? []}
                onChange={setPlotXVar}
                style={{ minWidth: 120 }}
              />
              <label>Y variable:</label>
              <Select
                value={plotYVar}
                options={plotCandidates}
                onChange={setPlotYVar}
                style={{ minWidth: 120 }}
              />
              <button
                className="table-btn-pill"
                onClick={() => setPlotSettingsOpen(true)}
                title="Edit plot labels and style"
              >
                <SlidersHorizontal size={11} /> Plot settings
              </button>
              <button
                className="table-btn-pill"
                onClick={handleSavePlot}
                disabled={plotData.data.length === 0}
                title="Save plot as PNG (choose location and name)"
              >
                <Download size={11} /> Save plot
              </button>
            </div>
            {plotSettingsOpen && (
              <div className="modal-backdrop" onMouseDown={() => setPlotSettingsOpen(false)}>
                <div className="modal-card modal-settings" onMouseDown={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <span style={{ fontWeight: 600 }}>Plot settings</span>
                    <button className="icon-btn" onClick={() => setPlotSettingsOpen(false)}>
                      <X size={14} />
                    </button>
                  </div>
                  <div className="settings-layout">
                    <aside className="settings-sidebar">
                      <button
                        className={`settings-nav-item ${plotSettingsTab === 'labels' ? 'active' : ''}`}
                        onClick={() => setPlotSettingsTab('labels')}
                      >
                        Labels
                      </button>
                      <button
                        className={`settings-nav-item ${plotSettingsTab === 'style' ? 'active' : ''}`}
                        onClick={() => setPlotSettingsTab('style')}
                      >
                        Style
                      </button>
                    </aside>
                    <section className="settings-content">
                      {plotSettingsTab === 'labels' ? (
                        <>
                          <PlotRow title="Plot title" hint="Empty shows no title">
                            <input
                              className="settings-input"
                              style={{ width: '100%', minWidth: 260 }}
                              value={plotTitle}
                              placeholder="Untitled plot"
                              onChange={(e) => setPlotTitle(e.target.value)}
                            />
                          </PlotRow>
                          <PlotRow title="X axis label" hint="Empty shows the variable name">
                            <input
                              className="settings-input"
                              style={{ width: '100%', minWidth: 260 }}
                              value={plotXLabel}
                              placeholder={resolvedXVar}
                              onChange={(e) => setPlotXLabel(e.target.value)}
                            />
                          </PlotRow>
                          <PlotRow title="Y axis label" hint="Empty shows the variable name">
                            <input
                              className="settings-input"
                              style={{ width: '100%', minWidth: 260 }}
                              value={plotYLabel}
                              placeholder={plotYVar}
                              onChange={(e) => setPlotYLabel(e.target.value)}
                            />
                          </PlotRow>
                        </>
                      ) : (
                        <>
                          <PlotRow title="Plot background" hint="Light background keeps axes readable in dark mode">
                            <Select
                              value={plotBackground}
                              options={[
                                { value: 'auto', label: 'Match app' },
                                { value: 'light', label: 'Light' },
                                { value: 'dark', label: 'Dark' },
                              ]}
                              onChange={(v) => setPlotBackground(v as 'auto' | 'light' | 'dark')}
                              style={{ minWidth: 140 }}
                            />
                          </PlotRow>
                          <PlotRow title="Line color" hint="Trajectory curve color">
                            <input
                              type="color"
                              value={plotLineColor}
                              onChange={(e) => setPlotLineColor(e.target.value)}
                              title={plotLineColor}
                              style={{ width: 44, height: 26, padding: 0, border: '1px solid var(--border-color)', borderRadius: 4, background: 'none', cursor: 'pointer' }}
                            />
                          </PlotRow>
                          <PlotRow title="Line width" hint="Pixels (0.5 – 6)">
                            <NumInput value={plotLineWidth} min={0.5} max={6} step={0.5} onChange={setPlotLineWidth} title="Line width in pixels" />
                          </PlotRow>
                          <PlotRow title="Line style" hint="Solid, dashed, dotted">
                            <Select
                              value={plotLineDash}
                              options={[
                                { value: 'solid', label: 'Solid' },
                                { value: 'dash', label: 'Dashed' },
                                { value: 'dot', label: 'Dotted' },
                                { value: 'dashdot', label: 'Dash-dot' },
                              ]}
                              onChange={(v) => setPlotLineDash(v as typeof plotLineDash)}
                              style={{ minWidth: 140 }}
                            />
                          </PlotRow>
                          <PlotRow title="Markers" hint="Point shape on the curve, or hidden">
                            <Select
                              value={plotMarkerSymbol}
                              options={[...MARKER_SYMBOL_OPTIONS, { value: 'hidden', label: 'Hidden' }]}
                              onChange={(v) => setPlotMarkerSymbol(v as MarkerSymbol | 'hidden')}
                              style={{ minWidth: 140 }}
                            />
                          </PlotRow>
                          {plotMarkerSymbol !== 'hidden' && (
                            <PlotRow title="Marker size" hint="Point size in pixels (2 – 20)">
                              <NumInput value={plotMarkerSize} min={2} max={20} step={1} onChange={setPlotMarkerSize} title="Marker size in pixels" />
                            </PlotRow>
                          )}
                        </>
                      )}
                    </section>
                  </div>
                </div>
              </div>
            )}
            {plotData.data.length > 0 && (
              <div className="parametric-plot-wrapper">
                <div className="parametric-plot">
                  <div className="parametric-plot-box" ref={plotBoxRef}>
                    <Plot
                      data={plotData.data}
                      layout={plotData.layout}
                      themeOverride={plotBackground === 'auto' ? undefined : plotBackground}
                      config={{
                        responsive: true,
                        displaylogo: false,
                        // No camera button: it downloads straight to Downloads with no
                        // name choice. handleSavePlot (Save plot button) is the save path.
                        modeBarButtonsToRemove: ['toImage', 'sendDataToCloud'],
                        toImageButtonOptions: {
                          format: 'png',
                          scale: 3,
                          filename: `${(table?.csvName ?? 'integral').replace(/\.csv$/i, '')}_plot`,
                        },
                      }}
                      useResizeHandler
                      style={{
                        width: '100%',
                        height: '100%',
                        background: plotBackground === 'light' ? '#ffffff' : plotBackground === 'dark' ? '#111827' : undefined,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Columnar table (integration variable first) */}
        <div className="parametric-table-container">
          <table className="variable-table parametric-table">
            <thead>
              <tr>
                {table.columns.map((c) => (
                  <th
                    key={c}
                    className={c === table.integrationVar ? 'sweep-col' : 'value-cell'}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from(
                { length: Math.min(PAGE_SIZE, table.numRows - safePage * PAGE_SIZE) },
                (_, i) => {
                  const r = safePage * PAGE_SIZE + i;
                  return (
                    <tr key={r}>
                      {table.columns.map((c) => (
                        <td
                          key={c}
                          className={c === table.integrationVar ? 'sweep-col' : 'value-cell'}
                        >
                          {fmt(table.data[c]?.[r] ?? NaN)}
                        </td>
                      ))}
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
          <TablePager page={safePage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </div>

      <SyntaxFooter
        items={[
          { code: 'x = INTEGRAL(dx_dt, t, 0, 10)' },
          { code: '$IntegralTable t:0.1, x, dx_dt' },
        ]}
        fileHint={table.csvName || '<model>-integral.csv'}
      />
    </div>
  );
}