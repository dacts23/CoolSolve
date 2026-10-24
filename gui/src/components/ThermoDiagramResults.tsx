import { useMemo } from 'react';
import Plot from './PlotlyChart';
import ThermoDiagramIcon from './ThermoDiagramIcon';
import { useDiagramStore, DIAGRAM_CONFIGS, PROP_UNITS } from '../stores/diagramStore';
import { useUIStore } from '../stores/uiStore';
import { useModelStore } from '../stores/modelStore';

export default function ThermoDiagramResults() {
  const theme = useUIStore((s) => s.theme);
  const lastResult = useModelStore((s) => s.lastResult);

  const {
    selectedFluid,
    diagramType,
    satData,
    loading,
    showStates,
    inferredVars,
    showArrayOverlay,
    arrayXVar,
    arrayYVar,
    closeCycle,
  } = useDiagramStore();

  const cfg = DIAGRAM_CONFIGS[diagramType];
  const arrayColumns = useMemo(() => {
    if (!lastResult?.variables) return new Map<string, number[]>();
    const cols = new Map<string, { indices: number[]; values: number[] }>();
    for (const [name, val] of Object.entries(lastResult.variables)) {
      const match = name.match(/^(.+)\[(\d+)\]$/);
      if (match) {
        const base = match[1];
        const idx = parseInt(match[2]);
        if (!cols.has(base)) cols.set(base, { indices: [], values: [] });
        cols.get(base)!.indices.push(idx);
        cols.get(base)!.values.push(val);
      }
    }
    const result = new Map<string, number[]>();
    for (const [base, data] of cols) {
      const sorted = data.indices
        .map((idx, i) => ({ idx, val: data.values[i] }))
        .sort((a, b) => a.idx - b.idx);
      result.set(base, sorted.map((s) => s.val));
    }
    return result;
  }, [lastResult]);
  const traces = useMemo(() => {
    if (!satData) return [];
    const t: Plotly.Data[] = [];

    const isDark = theme === 'dark';
    const textCol = isDark ? '#9ca3af' : '#4b5563';
    const valCol = isDark ? '#f3f4f6' : '#111827';
    const sepCol = isDark ? '#374151' : '#cbd5e1';
    const sepLine = `<span style="color:${sepCol};">────────────────────────</span>`;
    const liqX = satData.liquid[cfg.xProp];
    const liqY = satData.liquid[cfg.yProp];
    const vapX = [...satData.vapor[cfg.xProp]].reverse();
    const vapY = [...satData.vapor[cfg.yProp]].reverse();

    t.push({
      x: [...liqX, ...vapX],
      y: [...liqY, ...vapY],
      type: 'scatter',
      mode: 'lines',
      name: 'Saturation Dome',
      line: { color: '#1f77b4', width: 2 }, // Matplotlib C0
      hovertemplate:
        `<b>Saturation Dome</b><br>` +
        `${sepLine}<br>` +
        `<span style="color:${textCol};">${cfg.xLabel}:</span> <span style="color:${valCol};">%{x:.4g}</span><br>` +
        `<span style="color:${textCol};">${cfg.yLabel}:</span> <span style="color:${valCol};">%{y:.4g}</span>` +
        `<extra></extra>`,
    });
    t.push({
      x: [satData.critical[cfg.xProp]],
      y: [satData.critical[cfg.yProp]],
      type: 'scatter',
      mode: 'markers',
      name: 'Critical Point',
      marker: { color: '#d62728', size: 8, symbol: 'diamond', line: { width: 1, color: '#ffffff' } }, // Matplotlib C3
      hovertemplate:
        `<b>Critical Point</b><br>` +
        `${sepLine}<br>` +
        `<span style="color:${textCol};">${cfg.xLabel}:</span> <span style="color:${valCol};">%{x:.4g}</span><br>` +
        `<span style="color:${textCol};">${cfg.yLabel}:</span> <span style="color:${valCol};">%{y:.4g}</span>` +
        `<extra></extra>`,
    });
    if (showStates && inferredVars.length > 0) {
      const statesForFluid = inferredVars.filter(
        (v) => !v.isArray && v.inferredFluid === selectedFluid
      );

      const stateMap = new Map<string, Record<string, { value: number; varName: string }>>();
      for (const v of statesForFluid) {
        const baseName = v.name.replace(/^[A-Za-z]+_?/, '');
        const key = baseName || v.name;
        if (!stateMap.has(key)) stateMap.set(key, {});
        stateMap.get(key)![v.inferredProperty] = { value: v.value, varName: v.name };
      }

      const stateX: number[] = [];
      const stateY: number[] = [];
      const stateLabels: string[] = [];
      const stateHovers: string[] = [];

      for (const [key, props] of stateMap) {
        if (cfg.xProp in props && cfg.yProp in props) {
          stateX.push(props[cfg.xProp].value);
          stateY.push(props[cfg.yProp].value);
          stateLabels.push(key);
          const lines: string[] = [];
          for (const [prop, info] of Object.entries(props)) {
            const unit = PROP_UNITS[prop] || '';
            const unitStr = unit ? ` <span style="color:${textCol};">${unit}</span>` : '';
            lines.push(
              `<span style="color:${textCol};">${info.varName}:</span> <span style="color:${valCol};">${info.value.toPrecision(5)}</span>${unitStr}`
            );
          }
          stateHovers.push(
            `<b>State Point ${key}</b><br>` +
            `${sepLine}<br>` +
            lines.join('<br>') +
            `<extra></extra>`
          );
        }
      }

      if (stateX.length > 0) {
        t.push({
          x: stateX,
          y: stateY,
          type: 'scatter',
          mode: 'text+markers',
          name: 'State Points',
          marker: { color: '#2ca02c', size: 8, symbol: 'circle', line: { width: 1, color: '#ffffff' } }, // Matplotlib C2
          text: stateLabels,
          textposition: 'top center',
          textfont: { size: 11, color: '#2ca02c' },
          hovertemplate: stateHovers,
        });
      }
    }
    if (showArrayOverlay && arrayXVar && arrayYVar) {
      const xData = arrayColumns.get(arrayXVar);
      const yData = arrayColumns.get(arrayYVar);

      if (xData && yData) {
        const len = Math.min(xData.length, yData.length);
        const pathX = xData.slice(0, len);
        const pathY = yData.slice(0, len);

        if (closeCycle && pathX.length > 0) {
          pathX.push(pathX[0]);
          pathY.push(pathY[0]);
        }

        if (pathX.length > 0) {
          t.push({
            x: pathX,
            y: pathY,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Array Cycle',
            line: { color: '#ff7f0e', width: 2, dash: 'dot' }, // Matplotlib C1
            marker: { color: '#ff7f0e', size: 6 },
            hovertemplate:
              `<b>Array Cycle</b><br>` +
              `${sepLine}<br>` +
              `<span style="color:${textCol};">${arrayXVar}:</span> <span style="color:${valCol};">%{x:.4g}</span><br>` +
              `<span style="color:${textCol};">${arrayYVar}:</span> <span style="color:${valCol};">%{y:.4g}</span>` +
              `<extra></extra>`,
          });
        }
      }
    }

    return t;
  }, [satData, cfg, showStates, inferredVars, selectedFluid, showArrayOverlay, arrayXVar, arrayYVar, closeCycle, arrayColumns, theme]);

  const layout = useMemo((): Partial<Plotly.Layout> => {
    return {
      title: { text: satData ? `${satData.fluid} - ${diagramType} Diagram` : '' },
      xaxis: { title: { text: cfg.xLabel } },
      yaxis: {
        title: { text: cfg.yLabel },
        type: cfg.yLog ? 'log' : 'linear',
      },
      margin: { l: 70, r: 50, t: 45, b: 50 },
      legend: { x: 0.02, y: 0.98, bgcolor: 'transparent' },
      hovermode: 'closest' as const,
    };
  }, [satData, diagramType, cfg]);

  if (!satData && !loading) {
    return (
      <div className="parametric-empty-state">
        <div className="empty-state-content">
          <div className="empty-state-icon">
            <ThermoDiagramIcon size={40} />
          </div>
          <h2>Thermodynamic Property Diagrams</h2>
          <p>
            Generate publication-quality saturation domes and plot cycle state overlays.
          </p>
          <div className="empty-state-steps">
            <div className="step-item">
              <span className="step-num">1</span>
              <span>Select a working fluid in the left sidebar</span>
            </div>
            <div className="step-item">
              <span className="step-num">2</span>
              <span>Choose diagram coordinates (T-s, P-h, h-s, or T-h)</span>
            </div>
            <div className="step-item">
              <span className="step-num">3</span>
              <span>Click <strong>Generate Diagram</strong> to render the saturation envelope</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="parametric-results-view">
      <div className="parametric-results-header">
        <div className="results-summary">
          <span className="results-title">
            {satData?.fluid ?? selectedFluid}
          </span>
          <span className="results-badge">
            {diagramType}
          </span>
          {satData?.critical && (
            <span className="results-sweep-names">
              (T_crit = {satData.critical.T.toFixed(2)} °C, P_crit = {(satData.critical.P / 1e5).toFixed(2)} bar)
            </span>
          )}
        </div>
      </div>
      <div className="parametric-results-content" style={{ justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
        <div className="parametric-plot-box" style={{ maxWidth: 880, height: '100%', minHeight: 380 }}>
          <Plot
            data={traces}
            layout={layout}
            config={{
              responsive: true,
              displaylogo: false,
              toImageButtonOptions: {
                format: 'png',
                filename: `${selectedFluid}_${diagramType}_diagram`,
                scale: 3, // 300+ DPI publication quality
              },
            }}
            useResizeHandler
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
