import { useMemo, useEffect, useCallback, useState, useRef } from 'react';
import { LineChart, CheckCircle2, AlertCircle, Download, SlidersHorizontal, X } from 'lucide-react';
import Plot from './PlotlyChart';
import Select from './Select';
import { EmptyState, PlotRow, PlotToggle, NumInput, TablePager } from './SetupShell';
import { useParametricStore, fmt } from '../stores/parametricStore';
import { MARKER_SYMBOL_OPTIONS, type MarkerSymbol } from '../stores/diagramStore';
import { useUIStore } from '../stores/uiStore';
import { useModelStore } from '../stores/modelStore';
import { exportParametricStudyToCsv } from '../utils/csv';
import { savePlotPng } from '../utils/exportPlots';
import { escHover, hoverSep } from '../utils/plotHover.ts';
import { TABLE_PAGE_SIZE, pageCount, clampPage } from '../utils/paging.ts';

// Palette anchors (dark → light) for the heatmap's discrete color bands.
// Contour traces use the matching built-in Plotly scale by name (exact).
const VIRIDIS: Array<[number, number, number]> = [
  [68, 1, 84], [72, 40, 120], [62, 73, 137], [49, 104, 142],
  [38, 130, 142], [31, 158, 137], [53, 183, 121],
  [110, 206, 88], [184, 222, 41], [253, 231, 37],
];
const PLASMA: Array<[number, number, number]> = [
  [13, 8, 135], [92, 1, 166], [156, 23, 158], [204, 71, 120],
  [237, 121, 83], [253, 180, 47], [240, 249, 33],
];
const INFERNO: Array<[number, number, number]> = [
  [0, 0, 4], [31, 12, 72], [85, 15, 109], [136, 34, 106],
  [169, 50, 92], [221, 81, 58], [243, 119, 26], [252, 165, 10], [252, 255, 164],
];
const HOT: Array<[number, number, number]> = [
  [0, 0, 0], [255, 0, 0], [255, 255, 0], [255, 255, 255],
];
const GREYSCALE: Array<[number, number, number]> = [
  [0, 0, 0], [255, 255, 255],
];
const COOLWARM: Array<[number, number, number]> = [
  [59, 76, 192], [133, 148, 216], [199, 197, 221], [221, 221, 221],
  [228, 186, 178], [220, 109, 99], [180, 4, 38],
];

const PALETTES: Record<string, { contour: string; anchors: Array<[number, number, number]> }> = {
  Viridis: { contour: 'Viridis', anchors: VIRIDIS },
  Plasma: { contour: 'Plasma', anchors: PLASMA },
  Inferno: { contour: 'Inferno', anchors: INFERNO },
  Hot: { contour: 'Hot', anchors: HOT },
  Greyscale: { contour: 'Greys', anchors: GREYSCALE },
  Coolwarm: { contour: 'Bluered', anchors: COOLWARM },
};

function lerpAnchors(anchors: Array<[number, number, number]>, t: number): string {
  const x = Math.min(1, Math.max(0, t)) * (anchors.length - 1);
  const i = Math.min(anchors.length - 2, Math.floor(x));
  const f = x - i;
  const a = anchors[i];
  const b = anchors[i + 1];
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** N flat color bands, so the heatmap's Levels control visibly discretizes it. */
function discreteBands(anchors: Array<[number, number, number]>, n: number): Array<[number, string]> {
  const scale: Array<[number, string]> = [];
  for (let i = 0; i < n; i++) {
    const color = lerpAnchors(anchors, (i + 0.5) / n);
    scale.push([i / n, color]);
    scale.push([(i + 1) / n, color]);
  }
  return scale;
}

export default function ParametricResults() {
  const theme = useUIStore((s) => s.theme);
  const modelName = useModelStore((s) => s.modelName);
  const addConsoleLine = useModelStore((s) => s.addConsoleLine);
  const plotBoxRef = useRef<HTMLDivElement>(null);
  const {
    plotXVar,
    setPlotXVar,
    plotYVar,
    setPlotYVar,
    plotType,
    setPlotType,
    levels,
    setLevels,
    plotXLabel,
    setPlotXLabel,
    plotYLabel,
    setPlotYLabel,
    plotZLabel,
    setPlotZLabel,
    showContourLabels,
    setShowContourLabels,
    contourFill,
    setContourFill,
    contourLabelFormat,
    setContourLabelFormat,
    plotPalette,
    setPlotPalette,
    plotTitle,
    setPlotTitle,
    plotBackground,
    setPlotBackground,
    plotLineColor,
    setPlotLineColor,
    plotLineWidth,
    setPlotLineWidth,
    plotLineDash,
    setPlotLineDash,
    plotMarkerSymbol,
    setPlotMarkerSymbol,
    plotMarkerSize,
    setPlotMarkerSize,
  } = useParametricStore();
  const [plotSettingsOpen, setPlotSettingsOpen] = useState(false);
  const [plotSettingsTab, setPlotSettingsTab] = useState<'labels' | 'style'>('labels');
  // Sweep results live with the tab (see modelStore) so switching files keeps them.
  const activeResult = useModelStore((s) => s.parametricResult);
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
  // Double sweep: the heatmap has 3 axes (x, y, color) but only 2 sweeps, so
  // X and Y are both real handles — picking one moves the other to the
  // remaining sweep, and Z picks the plotted output variable.
  const sweepAxisNames = sweepDim === 2 && activeResult ? activeResult.sweepVariables.map((s) => s.name) : [];
  const xChoice = sweepAxisNames.includes(resolvedXVar) ? resolvedXVar : (sweepAxisNames[0] ?? resolvedXVar);
  const yChoice = sweepAxisNames.find((n) => n !== xChoice) ?? xChoice;
  // Axis/colorbar titles: a custom label wins, otherwise the variable name.
  // Trimmed once here so every layout branch uses the same titles.
  const xTitle = plotXLabel.trim() || (sweepDim === 2 ? xChoice : resolvedXVar);
  const yTitle = plotYLabel.trim() || (sweepDim === 2 ? yChoice : plotYVar);
  const zTitle = plotZLabel.trim() || plotYVar;
  // Plot background can be forced light/dark independent of the app theme so
  // axes stay readable. All theme-derived plot colors follow the effective one.
  const plotTheme = plotBackground === 'auto' ? theme : plotBackground;
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
  // Save the plot as PNG with a file picker (name + location): the modebar
  // camera button downloads straight to Downloads with no choice, so it is
  // removed below and this is the only save path.
  const handleSavePlot = useCallback(
    () => savePlotPng(plotBoxRef.current, `${modelName || 'model'}_parametric.png`, addConsoleLine),
    [modelName, addConsoleLine]
  );
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
  // A max-size sweep is 10,000 rows: page the table so the DOM stays small.
  const PAGE_SIZE = TABLE_PAGE_SIZE;
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [activeResult]);
  const totalPages = pageCount(sortedResults.length, PAGE_SIZE);
  const safePage = clampPage(page, sortedResults.length, PAGE_SIZE);
  const pagedResults = sortedResults.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  useEffect(() => {
    if (outputVarNames.length > 0 && !outputVarNames.includes(plotYVar)) {
      setPlotYVar(outputVarNames[0]);
    }
  }, [outputVarNames, plotYVar, setPlotYVar]);
  const plotData = useMemo((): { data: Plotly.Data[]; layout: Partial<Plotly.Layout> } => {
    if (!activeResult || !plotYVar || !resolvedXVar) return { data: [], layout: {} };

    const isDark = plotTheme === 'dark';
    const textCol = isDark ? '#9ca3af' : '#4b5563';
    const valCol = isDark ? '#f3f4f6' : '#111827';
    const sepCol = isDark ? '#374151' : '#cbd5e1';
    const sepLine = hoverSep(sepCol);
    const escX = escHover(resolvedXVar);
    const escY = escHover(plotYVar);

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
          // Hidden markers: plain line mode plus a zero-size transparent
          // marker, so the points stay hidden however the update is applied.
          mode: plotMarkerSymbol === 'hidden' ? 'lines' as const : 'lines+markers' as const,
          marker: plotMarkerSymbol === 'hidden'
            ? { size: 0, color: 'rgba(0,0,0,0)', symbol: 'circle' as const, opacity: 0, line: { width: 0, color: 'rgba(0,0,0,0)' } }
            : { size: plotMarkerSize, color: plotLineColor, symbol: plotMarkerSymbol, line: { width: 1, color: '#ffffff' } },
          line: { color: plotLineColor, width: plotLineWidth, dash: plotLineDash },
          name: `${escY} vs ${escX}`,
          hovertemplate:
            `<b>${escY} vs ${escX}</b><br>` +
            `${sepLine}<br>` +
            `<span style="color:${textCol};">${escX}:</span> <span style="color:${valCol};">%{x:.4g}</span><br>` +
            `<span style="color:${textCol};">${escY}:</span> <span style="color:${valCol};">%{y:.4g}</span>` +
            `<extra></extra>`,
        }],
        layout: {
          title: { text: plotTitle },
          xaxis: { title: { text: xTitle } },
          yaxis: { title: { text: yTitle } },
          margin: { t: 35, r: 50, b: 50, l: 65 },
          hovermode: 'closest' as const,
        },
      };
    }

    if (dim === 2) {
      const s0 = activeResult.sweepVariables[0];
      const s1 = activeResult.sweepVariables[1];
      const isSwapped = xChoice === s1.name;
      const xAxisVar = isSwapped ? s1 : s0;
      const yAxisVar = isSwapped ? s0 : s1;
      const escXAxis = escHover(xAxisVar.name);
      const escYAxis = escHover(yAxisVar.name);

      const xVals = xAxisVar.values;
      const yVals = yAxisVar.values;

      // Pre-index points by exact coordinate: O(N) instead of O(N^2).
      // A miss stays null (a visible hole): never guess a neighbour's value.
      const key = (v: number) => String(v);
      const ptMap = new Map<string, typeof activeResult.results[number]>();
      for (const r of activeResult.results) {
        ptMap.set(`${key(r.overrides[xAxisVar.name] ?? NaN)}:${key(r.overrides[yAxisVar.name] ?? NaN)}`, r);
      }

      const z: (number | null)[][] = [];
      for (let j = 0; j < yVals.length; j++) {
        const row: (number | null)[] = [];
        for (let i = 0; i < xVals.length; i++) {
          const pt = ptMap.get(`${key(xVals[i])}:${key(yVals[j])}`);
          row.push(pt?.success && pt.variables && pt.variables[plotYVar] !== undefined ? (pt.variables[plotYVar] ?? null) : null);
        }
        z.push(row);
      }

      const hovertemplate =
        `<b>${escY}</b><br>` +
        `${sepLine}<br>` +
        `<span style="color:${textCol};">${escXAxis}:</span> <span style="color:${valCol};">%{x:.4g}</span><br>` +
        `<span style="color:${textCol};">${escYAxis}:</span> <span style="color:${valCol};">%{y:.4g}</span><br>` +
        `<span style="color:${textCol};">${escY}:</span> <span style="color:${valCol};">%{z:.4g}</span>` +
        `<extra></extra>`;

      if (plotType === 'contour') {
        return {
          data: [{
            x: xVals,
            y: yVals,
            z,
            type: 'contour' as const,
            colorscale: PALETTES[plotPalette]?.contour ?? 'Viridis',
            ncontours: levels,
            hovertemplate,
            contours: {
              // Value labels on the constant-value lines: black on the
              // colored fill, theme text on pure contour lines.
              showlabels: showContourLabels,
              coloring: contourFill ? 'fill' : 'lines',
              labelfont: { size: 10, color: contourFill ? '#000000' : textCol },
              labelformat: contourLabelFormat,
            },
            colorbar: {
              title: { text: zTitle, font: { size: 11 } },
              tickfont: { size: 10 },
              len: 0.8,
              thickness: 16,
            },
          } as Plotly.Data],
          layout: {
            title: { text: plotTitle },
            xaxis: { title: { text: xTitle } },
            yaxis: { title: { text: yTitle } },
            margin: { t: 35, r: 50, b: 50, l: 65 },
            // Horizontal modebar: the default vertical strip sits on the same
            // right edge as the colorbar and overlaps it.
            modebar: { orientation: 'h' as const },
          },
        };
      }
      return {
        data: [{
          x: xVals,
          y: yVals,
          z,
          type: 'heatmap' as const,
          colorscale: discreteBands(PALETTES[plotPalette]?.anchors ?? VIRIDIS, levels),
          hovertemplate,
          colorbar: {
            title: { text: zTitle, font: { size: 11 } },
            tickfont: { size: 10 },
            len: 0.8,
            thickness: 16,
          },
        } as Plotly.Data],
        layout: {
          title: { text: plotTitle },
          xaxis: { title: { text: xTitle } },
          yaxis: { title: { text: yTitle } },
          margin: { t: 35, r: 50, b: 50, l: 65 },
          modebar: { orientation: 'h' as const },
        },
      };
    }

    return { data: [], layout: {} };
  }, [activeResult, sortedResults, resolvedXVar, xChoice, plotYVar, plotType, levels, plotTheme, showContourLabels, contourFill, contourLabelFormat, plotPalette, plotTitle, xTitle, yTitle, zTitle, plotLineColor, plotLineWidth, plotLineDash, plotMarkerSymbol, plotMarkerSize]);

  if (!activeResult) {
    return (
      <EmptyState
        icon={<LineChart size={40} />}
        title="Parametric Study Workspace"
        description="Perform sensitivity analyses across single or dual variables with warm-starting."
        steps={[
          'Select an imposed variable in the left sidebar',
          'Set minimum, maximum, and number of steps',
          <>Click <strong>Run Study</strong> to solve and visualize results here</>,
        ]}
      />
    );
  }

  const allConverged = activeResult.successCount === activeResult.totalPoints;

  return (
    <div className="parametric-results-view">
      <div className="table-title-header">
        <div className="table-title-display">
          <h2 className="table-main-title">Parametric Sweep</h2>
          {allConverged ? (
            <CheckCircle2 size={16} className="text-success" />
          ) : (
            <AlertCircle size={16} className="text-warning" />
          )}
          <span className="table-meta-badge">
            {activeResult.successCount} of {activeResult.totalPoints} converged
          </span>
          <span className="integral-meta">
            · {activeResult.sweepVariables.map((s) => s.name).join(' × ')}
          </span>
        </div>
        <button
          className="table-btn-pill"
          onClick={handleExportCsv}
          title="Export sweep results to CSV"
        >
          <Download size={11} /> Export CSV
        </button>
      </div>
      <div className="parametric-results-content">
        <div className="parametric-plot-controls">
          {sweepDim === 2 ? (
            <>
              <label title="Swap X/Y sweep axes">X axis:</label>
              <Select
                value={xChoice}
                options={sweepAxisNames}
                onChange={setPlotXVar}
                style={{ minWidth: 130 }}
              />

              <label title="Swap X/Y sweep axes (X becomes the other sweep)">Y axis:</label>
              <Select
                value={yChoice}
                options={sweepAxisNames}
                onChange={(v) => setPlotXVar(sweepAxisNames.find((n) => n !== v) ?? v)}
                style={{ minWidth: 130 }}
              />

              <label>Z (color):</label>
              <Select
                value={plotYVar}
                options={outputVarNames}
                onChange={setPlotYVar}
                style={{ minWidth: 130 }}
              />
            </>
          ) : (
            <>
              <label>X axis:</label>
              <Select
                value={resolvedXVar}
                options={availableXVars}
                onChange={setPlotXVar}
                style={{ minWidth: 130 }}
              />

              <label>Y axis:</label>
              <Select
                value={plotYVar}
                options={outputVarNames}
                onChange={setPlotYVar}
                style={{ minWidth: 130 }}
              />
            </>
          )}

          {sweepDim === 2 && (
            <>
              <label>Type:</label>
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
                          placeholder={sweepDim === 2 ? xChoice : resolvedXVar}
                          onChange={(e) => setPlotXLabel(e.target.value)}
                        />
                      </PlotRow>
                      <PlotRow title="Y axis label" hint="Empty shows the variable name">
                        <input
                          className="settings-input"
                          style={{ width: '100%', minWidth: 260 }}
                          value={plotYLabel}
                          placeholder={sweepDim === 2 ? yChoice : plotYVar}
                          onChange={(e) => setPlotYLabel(e.target.value)}
                        />
                      </PlotRow>
                      {sweepDim === 2 && (
                        <PlotRow title="Colorbar label" hint="Z variable: empty shows the variable name">
                          <input
                            className="settings-input"
                            style={{ width: '100%', minWidth: 260 }}
                            value={plotZLabel}
                            placeholder={plotYVar}
                            onChange={(e) => setPlotZLabel(e.target.value)}
                          />
                        </PlotRow>
                      )}
                    </>
                  ) : (
                    <>
                      <PlotRow title="Levels" hint="Number of contour lines / heatmap color bands (2–100)">
                        <NumInput value={levels} min={2} max={100} onChange={setLevels} width={64} title="Number of contour levels / heatmap color bands" />
                      </PlotRow>
                      {sweepDim === 2 && (
                        <PlotRow title="Color palette" hint="Contour scale and heatmap bands">
                          <Select
                            value={plotPalette}
                            options={Object.keys(PALETTES).map((p) => ({ value: p, label: p }))}
                            onChange={setPlotPalette}
                            style={{ minWidth: 140 }}
                          />
                        </PlotRow>
                      )}
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
                      {sweepDim === 1 && (
                        <>
                          <PlotRow title="Line color" hint="Sweep curve color">
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
                      {sweepDim === 2 && plotType === 'contour' && (
                        <>
                          <PlotRow title="Contour labels" hint="Print values on the constant-value lines">
                            <PlotToggle checked={showContourLabels} onChange={setShowContourLabels} />
                          </PlotRow>
                          <PlotRow title="Label format" hint="d3 number format for the contour labels">
                            <Select
                              value={contourLabelFormat}
                              options={[
                                { value: '.3g', label: '.3g (default)' },
                                { value: '.2g', label: '.2g (short)' },
                                { value: '.4g', label: '.4g (precise)' },
                                { value: '.3e', label: '.3e (scientific)' },
                                { value: '.2f', label: '.2f (fixed)' },
                              ]}
                              onChange={setContourLabelFormat}
                              style={{ minWidth: 140 }}
                            />
                          </PlotRow>
                          <PlotRow title="Fill contours" hint="Color the bands between lines; off gives pure contour lines">
                            <PlotToggle checked={contourFill} onChange={setContourFill} />
                          </PlotRow>
                        </>
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
                    filename: `parametric_${resolvedXVar}_vs_${plotYVar}`,
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
        <div className="parametric-table-wrapper">
          <div className="parametric-table-container">
          <table className="variable-table parametric-table">
            <thead>
              <tr>
                <th className="row-num" style={{ width: 40 }}>#</th>
                {activeResult.sweepVariables.map((s) => (
                  <th key={s.name} className="sweep-col">{s.name}</th>
                ))}
                <th style={{ width: 70 }}>Status</th>
                {outputVarNames.map((n) => (
                  <th key={n} className="value-cell">{n}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedResults.map((pt, idx) => (
                <tr key={safePage * PAGE_SIZE + idx} className={pt.success ? '' : 'failed-row'}>
                  <td className="row-num">{safePage * PAGE_SIZE + idx + 1}</td>
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
          <TablePager page={safePage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}
