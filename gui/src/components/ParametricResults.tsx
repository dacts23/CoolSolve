import { useMemo, useEffect, useCallback } from 'react';
import { LineChart, CheckCircle2, AlertCircle } from 'lucide-react';
import Plot from './PlotlyChart';
import Select from './Select';
import ExportCsvIcon from './ExportCsvIcon';
import { useParametricStore, fmt } from '../stores/parametricStore';
import { useUIStore } from '../stores/uiStore';
import { useModelStore } from '../stores/modelStore';
import { exportParametricStudyToCsv } from '../utils/csv';

export default function ParametricResults() {
  const theme = useUIStore((s) => s.theme);
  const modelName = useModelStore((s) => s.modelName);
  const {
    activeResult,
    plotXVar,
    setPlotXVar,
    plotYVar,
    setPlotYVar,
    plotType,
    setPlotType,
  } = useParametricStore();
  const outputVarNames = useMemo(() => {
    if (!activeResult || activeResult.results.length === 0) return [];
    const firstSuccess = activeResult.results.find((r) => r.success && r.variables);
    if (!firstSuccess?.variables) return [];
    return Object.keys(firstSuccess.variables).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  }, [activeResult]);
  const sweepDim = useMemo(() => {
    if (!activeResult) return 0;
    return activeResult.sweepVariables.length;
  }, [activeResult]);
  const availableXVars = useMemo(() => {
    if (!activeResult || activeResult.results.length === 0) return [];
    const sweepNames = activeResult.sweepVariables.map((s) => s.name);
    return Array.from(new Set([...sweepNames, ...outputVarNames]));
  }, [activeResult, outputVarNames]);

  const defaultXVar = activeResult?.sweepVariables[0]?.name || availableXVars[0] || '';
  const resolvedXVar = plotXVar && availableXVars.includes(plotXVar) ? plotXVar : defaultXVar;
  useEffect(() => {
    if (availableXVars.length > 0 && (!plotXVar || !availableXVars.includes(plotXVar))) {
      setPlotXVar(defaultXVar);
    }
  }, [availableXVars, plotXVar, defaultXVar, setPlotXVar]);
  const handleExportCsv = useCallback(() => {
    if (!activeResult) return;
    exportParametricStudyToCsv(
      activeResult.sweepVariables,
      activeResult.results,
      outputVarNames,
      modelName
    );
  }, [activeResult, outputVarNames, modelName]);
  const sortedResults = useMemo(() => {
    if (!activeResult || activeResult.results.length === 0) return [];
    const sweepNames = activeResult.sweepVariables.map((s) => s.name);
    return [...activeResult.results].sort((a, b) => {
      for (const name of sweepNames) {
        const diff = (a.overrides[name] ?? 0) - (b.overrides[name] ?? 0);
        if (diff !== 0) return diff;
      }
      return 0;
    });
  }, [activeResult]);
  useEffect(() => {
    if (outputVarNames.length > 0 && !outputVarNames.includes(plotYVar)) {
      setPlotYVar(outputVarNames[0]);
    }
  }, [outputVarNames, plotYVar, setPlotYVar]);
  const plotData = useMemo((): { data: Plotly.Data[]; layout: Partial<Plotly.Layout> } => {
    if (!activeResult || !plotYVar || !resolvedXVar) return { data: [], layout: {} };

    const isDark = theme === 'dark';
    const textCol = isDark ? '#9ca3af' : '#4b5563';
    const valCol = isDark ? '#f3f4f6' : '#111827';
    const sepCol = isDark ? '#374151' : '#cbd5e1';
    const sepLine = `<span style="color:${sepCol};">────────────────────────</span>`;

    const sweepNames = activeResult.sweepVariables.map((s) => s.name);
    const dim = sweepNames.length;

    if (dim === 1) {
      const sweep = activeResult.sweepVariables[0];
      const pts: { x: number; y: number }[] = [];

      for (const pt of sortedResults) {
        if (!pt.success || !pt.variables) continue;
        const xVal = pt.overrides[resolvedXVar] ?? pt.variables[resolvedXVar];
        const yVal = pt.overrides[plotYVar] ?? pt.variables[plotYVar];
        if (xVal !== undefined && yVal !== undefined) {
          pts.push({ x: xVal, y: yVal });
        }
      }

      if (resolvedXVar !== sweep.name) {
        pts.sort((a, b) => a.x - b.x);
      }

      const xVals = pts.map((p) => p.x);
      const yVals = pts.map((p) => p.y);

      return {
        data: [{
          x: xVals,
          y: yVals,
          type: 'scatter' as const,
          mode: 'lines+markers' as const,
          marker: { size: 6, color: '#1f77b4', line: { width: 1, color: '#ffffff' } },
          line: { color: '#1f77b4', width: 2 },
          name: `${plotYVar} vs ${resolvedXVar}`,
          hovertemplate:
            `<b>${plotYVar} vs ${resolvedXVar}</b><br>` +
            `${sepLine}<br>` +
            `<span style="color:${textCol};">${resolvedXVar}:</span> <span style="color:${valCol};">%{x:.4g}</span><br>` +
            `<span style="color:${textCol};">${plotYVar}:</span> <span style="color:${valCol};">%{y:.4g}</span>` +
            `<extra></extra>`,
        }],
        layout: {
          xaxis: { title: { text: resolvedXVar } },
          yaxis: { title: { text: plotYVar } },
          margin: { t: 35, r: 50, b: 50, l: 65 },
          hovermode: 'closest' as const,
        },
      };
    }

    if (dim === 2) {
      const s0 = activeResult.sweepVariables[0];
      const s1 = activeResult.sweepVariables[1];
      const isSwapped = resolvedXVar === s1.name;
      const xAxisVar = isSwapped ? s1 : s0;
      const yAxisVar = isSwapped ? s0 : s1;

      const xVals = xAxisVar.values;
      const yVals = yAxisVar.values;

      const z: (number | null)[][] = [];
      for (let j = 0; j < yVals.length; j++) {
        const row: (number | null)[] = [];
        for (let i = 0; i < xVals.length; i++) {
          const pt = activeResult.results.find(
            (r) =>
              r.overrides[xAxisVar.name] === xVals[i] &&
              r.overrides[yAxisVar.name] === yVals[j]
          );
          row.push(pt?.success && pt.variables ? (pt.variables[plotYVar] ?? null) : null);
        }
        z.push(row);
      }

      const hovertemplate =
        `<b>${plotYVar}</b><br>` +
        `${sepLine}<br>` +
        `<span style="color:${textCol};">${xAxisVar.name}:</span> <span style="color:${valCol};">%{x:.4g}</span><br>` +
        `<span style="color:${textCol};">${yAxisVar.name}:</span> <span style="color:${valCol};">%{y:.4g}</span><br>` +
        `<span style="color:${textCol};">${plotYVar}:</span> <span style="color:${valCol};">%{z:.4g}</span>` +
        `<extra></extra>`;

      if (plotType === 'contour') {
        return {
          data: [{
            x: xVals,
            y: yVals,
            z,
            type: 'contour' as const,
            colorscale: 'Viridis',
            hovertemplate,
            colorbar: {
              title: { text: plotYVar, font: { size: 11 } },
              tickfont: { size: 10 },
              len: 0.9,
              thickness: 16,
            },
          } as Plotly.Data],
          layout: {
            xaxis: { title: { text: xAxisVar.name } },
            yaxis: { title: { text: yAxisVar.name } },
            margin: { t: 35, r: 50, b: 50, l: 65 },
          },
        };
      }
      return {
        data: [{
          x: xVals,
          y: yVals,
          z,
          type: 'heatmap' as const,
          colorscale: 'Viridis',
          hovertemplate,
          colorbar: {
            title: { text: plotYVar, font: { size: 11 } },
            tickfont: { size: 10 },
            len: 0.9,
            thickness: 16,
          },
        } as Plotly.Data],
        layout: {
          xaxis: { title: { text: xAxisVar.name } },
          yaxis: { title: { text: yAxisVar.name } },
          margin: { t: 35, r: 50, b: 50, l: 65 },
        },
      };
    }

    return { data: [], layout: {} };
  }, [activeResult, sortedResults, resolvedXVar, plotYVar, plotType, theme]);

  if (!activeResult) {
    return (
      <div className="parametric-empty-state">
        <div className="empty-state-content">
          <div className="empty-state-icon">
            <LineChart size={40} />
          </div>
          <h2>Parametric Study Workspace</h2>
          <p>
            Perform sensitivity analyses across single or dual variables with warm-starting.
          </p>
          <div className="empty-state-steps">
            <div className="step-item">
              <span className="step-num">1</span>
              <span>Select an imposed variable in the left sidebar</span>
            </div>
            <div className="step-item">
              <span className="step-num">2</span>
              <span>Set minimum, maximum, and number of steps</span>
            </div>
            <div className="step-item">
              <span className="step-num">3</span>
              <span>Click <strong>Run Study</strong> to solve and visualize results here</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const allConverged = activeResult.successCount === activeResult.totalPoints;

  return (
    <div className="parametric-results-view">
      <div className="parametric-results-header">
        <div className="results-summary">
          {allConverged ? (
            <CheckCircle2 size={16} className="text-success" />
          ) : (
            <AlertCircle size={16} className="text-warning" />
          )}
          <span className="results-title">
            Parametric Sweep Results:
          </span>
          <span className="results-badge">
            {activeResult.successCount} of {activeResult.totalPoints} converged
          </span>
          <span className="results-sweep-names">
            ({activeResult.sweepVariables.map((s) => s.name).join(' × ')})
          </span>
        </div>

        <div className="results-controls">
          <label className="results-ctrl-label">X Variable:</label>
          <Select
            value={resolvedXVar}
            options={availableXVars}
            onChange={setPlotXVar}
            style={{ minWidth: 130 }}
          />

          <label className="results-ctrl-label">Y Variable:</label>
          <Select
            value={plotYVar}
            options={outputVarNames}
            onChange={setPlotYVar}
            style={{ minWidth: 130 }}
          />

          {sweepDim === 2 && (
            <>
              <label className="results-ctrl-label">Type:</label>
              <Select
                value={plotType}
                options={[
                  { value: 'contour', label: 'Contour' },
                  { value: 'line', label: 'Heatmap' },
                ]}
                onChange={(v) => setPlotType(v as 'line' | 'contour')}
                style={{ minWidth: 100 }}
              />
            </>
          )}

          <button
            className="export-csv-btn"
            onClick={handleExportCsv}
            title="Export sweep results to CSV"
            style={{ marginLeft: 6 }}
          >
            <ExportCsvIcon size={15} />
          </button>
        </div>
      </div>
      <div className="parametric-results-content">
        {plotData.data.length > 0 && (
          <div className="parametric-plot-wrapper">
            <div className="parametric-plot-box">
              <Plot
                data={plotData.data}
                layout={plotData.layout}
                config={{
                  responsive: true,
                  displaylogo: false,
                  toImageButtonOptions: {
                    format: 'png',
                    scale: 3,
                    filename: `parametric_${resolvedXVar}_vs_${plotYVar}`,
                  },
                }}
                useResizeHandler
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        )}
        <div className="parametric-table-wrapper">
          <table className="variable-table parametric-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                {activeResult.sweepVariables.map((s) => (
                  <th key={s.name} className="sweep-col">{s.name}</th>
                ))}
                <th style={{ width: 70 }}>Status</th>
                {outputVarNames.map((n) => (
                  <th key={n}>{n}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((pt, idx) => (
                <tr key={idx} className={pt.success ? '' : 'failed-row'}>
                  <td className="row-num">{idx + 1}</td>
                  {activeResult.sweepVariables.map((s) => (
                    <td key={s.name} className="sweep-col">{fmt(pt.overrides[s.name])}</td>
                  ))}
                  <td className={pt.success ? 'status-ok' : 'status-fail'}>
                    {pt.success ? '✓ Ok' : '✗ Failed'}
                  </td>
                  {outputVarNames.map((n) => (
                    <td key={n} className="value-cell">
                      {pt.success && pt.variables ? fmt(pt.variables[n]) : '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
