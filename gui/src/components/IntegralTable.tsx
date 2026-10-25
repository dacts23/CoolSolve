import Select from './Select';
import { Download, Sigma } from 'lucide-react';
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
import { useMemo, useState, useCallback, useEffect } from 'react';
import Plot from './PlotlyChart';
import { useModelStore } from '../stores/modelStore';
import { fmt } from '../stores/parametricStore';
import { downloadCsv, parseCSVToTable } from '../utils/csv';
import type { IntegralTableData } from '../api/types';

// ============================================================================
// Helpers
// ============================================================================

/** Build a CSV string from an IntegralTableData. */
function tableToCSV(table: IntegralTableData): string {
  const lines: string[] = [table.columns.join(',')];
  for (let r = 0; r < table.numRows; r++) {
    lines.push(table.columns.map((c) => table.data[c]?.[r] ?? '').join(','));
  }
  return lines.join('\n') + '\n';
}

// ============================================================================
// Main component
// ============================================================================

export default function IntegralTable() {
  const integralTable = useModelStore((s) => s.integralTable);
  const integralCSV = useModelStore((s) => s.integralCSV);

  // Resolve the active table: prefer the live columnar JSON; fall back to
  // parsing the restored CSV (bundle round-trip).
  const table = useMemo<IntegralTableData | null>(() => {
    if (integralTable && integralTable.numRows > 0) return integralTable;
    if (integralCSV) {
      const name = integralTable?.csvName ?? 'model-integral.csv';
      return parseCSVToTable(integralCSV, name);
    }
    return null;
  }, [integralTable, integralCSV]);

  // Plot Y-variable selector — default to the first non-integration column.
  const [plotYVar, setPlotYVar] = useState('');

  const plotCandidates = useMemo(() => {
    if (!table) return [];
    return table.columns.filter((c) => c !== table.integrationVar);
  }, [table]);

  // Keep the plot selector valid as the table changes.
  useEffect(() => {
    if (plotCandidates.length > 0 && !plotCandidates.includes(plotYVar)) {
      setPlotYVar(plotCandidates[0]);
    }
  }, [plotCandidates, plotYVar]);

  const plotData = useMemo<{ data: Plotly.Data[]; layout: Partial<Plotly.Layout> }>(() => {
    if (!table || !plotYVar) return { data: [], layout: {} };
    const x = table.data[table.integrationVar] ?? [];
    const y = table.data[plotYVar] ?? [];
    const n = Math.min(x.length, y.length);
    return {
      data: [{
        x: x.slice(0, n),
        y: y.slice(0, n),
        type: 'scatter' as const,
        mode: 'lines+markers' as const,
        marker: { size: 5, color: '#3b82f6' },
        line: { color: '#3b82f6', width: 2 },
        name: plotYVar,
      }],
      layout: {
        xaxis: { title: { text: table.integrationVar } },
        yaxis: { title: { text: plotYVar } },
        margin: { t: 20, r: 45, b: 45, l: 60 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { family: 'system-ui, sans-serif', size: 11 },
      },
    };
  }, [table, plotYVar]);

  // ---- Export CSV ----
  const handleExport = useCallback(async () => {
    if (!table) return;
    const csv = tableToCSV(table);
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
        <div className="parametric-empty-state" style={{ flex: 1 }}>
          <div className="empty-state-content">
            <div className="empty-state-icon">
              <Sigma size={36} />
            </div>
            <h2>Dynamic Integral Trajectories</h2>
            <p>
              Simulate initial-value differential-algebraic equations (DAEs) and plot time-marching state variables.
            </p>
            <div className="empty-state-steps">
              <div className="step-item">
                <span className="step-num">1</span>
                <span>Define differential equations using <strong>y = y0 + INTEGRAL(dydt, t, t0, tf)</strong></span>
              </div>
              <div className="step-item">
                <span className="step-num">2</span>
                <span>Add <strong>$IntegralTable t:step, var1, var2</strong> to record variables</span>
              </div>
              <div className="step-item">
                <span className="step-num">3</span>
                <span>Click <strong>Solve (F2)</strong> to compute and explore the dynamic solution table here</span>
              </div>
            </div>
          </div>
        </div>
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
              <label>Y variable:</label>
              <Select
                value={plotYVar}
                options={plotCandidates}
                onChange={setPlotYVar}
                style={{ minWidth: 120 }}
              />
            </div>
            {plotData.data.length > 0 && (
              <div className="parametric-plot-wrapper">
                <div className="parametric-plot">
                  <div className="parametric-plot-box">
                    <Plot
                      data={plotData.data}
                      layout={plotData.layout}
                      config={{ responsive: true, displaylogo: false }}
                      useResizeHandler
                      style={{ width: '100%', height: '100%' }}
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
              {Array.from({ length: table.numRows }, (_, r) => (
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
              ))}
            </tbody>
          </table>
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