import { useMemo, useRef, useState, useCallback } from 'react';
import { Download, SlidersHorizontal, X } from 'lucide-react';
import Plot from './PlotlyChart';
import Select from './Select';
import ThermoDiagramIcon from './ThermoDiagramIcon';
import { extractArrayColumns } from '../utils/arrayData';
import { useDiagramStore, DIAGRAM_CONFIGS, PROP_UNITS, type LineDash, type MarkerSymbol, MARKER_SYMBOL_OPTIONS } from '../stores/diagramStore';
import { useUIStore } from '../stores/uiStore';
import { useModelStore } from '../stores/modelStore';
import { savePlotPng } from '../utils/exportPlots';
import { EmptyState, PlotRow, NumInput } from './SetupShell';
import { escHover, hoverSep } from '../utils/plotHover.ts';

// Legend corners: the key follows the plot when it moves.
const LEGEND_POS: Record<string, { x: number; y: number; xanchor: 'left' | 'right'; yanchor: 'top' | 'bottom' }> = {
  tl: { x: 0.02, y: 0.98, xanchor: 'left', yanchor: 'top' },
  tr: { x: 0.98, y: 0.98, xanchor: 'right', yanchor: 'top' },
  bl: { x: 0.02, y: 0.02, xanchor: 'left', yanchor: 'bottom' },
  br: { x: 0.98, y: 0.02, xanchor: 'right', yanchor: 'bottom' },
};

export default function ThermoDiagramResults() {
  const theme = useUIStore((s) => s.theme);
  const lastResult = useModelStore((s) => s.lastResult);

  const {
    selectedFluid,
    diagramType,
    satData,
    loading,
    error: diagramError,
    showStates,
    inferredVars,
    showArrayOverlay,
    arrayXVar,
    arrayYVar,
    closeCycle,
    plotTitle,
    plotXLabel,
    plotYLabel,
    plotBackground,
    domeStyle,
    critStyle,
    stateStyle,
    cycleStyle,
    legendPosition,
    setPlotTitle,
    setPlotXLabel,
    setPlotYLabel,
    setPlotBackground,
    setDomeStyle,
    setCritStyle,
    setStateStyle,
    setCycleStyle,
    setLegendPosition,
  } = useDiagramStore();
  const [diagramSettingsOpen, setDiagramSettingsOpen] = useState(false);
  const [diagramSettingsTab, setDiagramSettingsTab] = useState<'labels' | 'style' | 'dome' | 'points' | 'cycle'>('labels');
  // Artists actually on screen: their tabs/controls only appear when drawn.
  const hasStates = showStates && inferredVars.length > 0;

  const cfg = DIAGRAM_CONFIGS[diagramType];
  // Forced light/dark plot background independent of the app theme so axes
  // stay readable. All plot colors follow the effective theme.
  const plotTheme = plotBackground === 'auto' ? theme : plotBackground;
  const plotBoxRef = useRef<HTMLDivElement>(null);
  const addConsoleLine = useModelStore((s) => s.addConsoleLine);
  // Same save path as the parametric plot: the modebar camera downloads
  // straight to Downloads with no name choice.
  const handleSavePlot = useCallback(
    () => savePlotPng(plotBoxRef.current, `${selectedFluid || 'model'}_${diagramType}_diagram.png`, addConsoleLine),
    [selectedFluid, diagramType, addConsoleLine]
  );
  const arrayColumns = useMemo(
    () => extractArrayColumns(lastResult?.variables),
    [lastResult]
  );
  const arrayXData = arrayXVar ? arrayColumns.get(arrayXVar) : undefined;
  const arrayYData = arrayYVar ? arrayColumns.get(arrayYVar) : undefined;
  const hasCycleData = (d: number[] | undefined) => !!d && d.some((v) => Number.isFinite(v));
  // Array-cycle artists exist only when the overlay resolves to real points.
  const hasActiveCycle = showArrayOverlay && hasCycleData(arrayXData) && hasCycleData(arrayYData);
  // A tab for artists that are no longer drawn falls back to Labels.
  const activeDiagramTab = diagramSettingsTab === 'cycle' && !hasActiveCycle ? 'labels' : diagramSettingsTab;
  const traces = useMemo(() => {
    if (!satData) return [];
    const t: Plotly.Data[] = [];

    const isDark = plotTheme === 'dark';
    const textCol = isDark ? '#9ca3af' : '#4b5563';
    const valCol = isDark ? '#f3f4f6' : '#111827';
    const sepCol = isDark ? '#374151' : '#cbd5e1';
    const sepLine = hoverSep(sepCol);
    const escXLabel = escHover(cfg.xLabel);
    const escYLabel = escHover(cfg.yLabel);
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
      line: { color: domeStyle.color, width: domeStyle.width, dash: domeStyle.dash },
      hovertemplate:
        `<b>Saturation Dome</b><br>` +
        `${sepLine}<br>` +
        `<span style="color:${textCol};">${escXLabel}:</span> <span style="color:${valCol};">%{x:.4g}</span><br>` +
        `<span style="color:${textCol};">${escYLabel}:</span> <span style="color:${valCol};">%{y:.4g}</span>` +
        `<extra></extra>`,
    });
    t.push({
      x: [satData.critical[cfg.xProp]],
      y: [satData.critical[cfg.yProp]],
      type: 'scatter',
      mode: 'markers',
      name: 'Critical Point',
      marker: { color: critStyle.color, size: critStyle.size, symbol: critStyle.symbol, line: { width: 1, color: '#ffffff' } },
      hovertemplate:
        `<b>Critical Point</b><br>` +
        `${sepLine}<br>` +
        `<span style="color:${textCol};">${escXLabel}:</span> <span style="color:${valCol};">%{x:.4g}</span><br>` +
        `<span style="color:${textCol};">${escYLabel}:</span> <span style="color:${valCol};">%{y:.4g}</span>` +
        `<extra></extra>`,
    });
    if (showStates && inferredVars.length > 0) {
      const statesForFluid = inferredVars.filter(
        (v) => !v.isArray && v.inferredFluid === selectedFluid
      );

      const stateMap = new Map<string, Record<string, { value: number; varName: string }>>();
      for (const v of statesForFluid) {
        // Group by trailing _<id> only (e.g. P_comp_out -> comp_out stays distinct
        // from P_out). Bare prefix strip merged unrelated vars.
        const m = v.name.match(/^([A-Za-z]+)_([A-Za-z0-9]+_.+|[A-Za-z0-9]+)$/);
        const baseName = m ? m[2] : v.name;
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
            const unitStr = unit ? ` <span style="color:${textCol};">${escHover(unit)}</span>` : '';
            lines.push(
              `<span style="color:${textCol};">${escHover(info.varName)}:</span> <span style="color:${valCol};">${escHover(info.value.toPrecision(5))}</span>${unitStr}`
            );
          }
          stateHovers.push(
            `<b>State Point ${escHover(key)}</b><br>` +
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
          marker: { color: stateStyle.color, size: stateStyle.size, symbol: stateStyle.symbol, line: { width: 1, color: '#ffffff' } },
          text: stateLabels,
          textposition: 'top center',
          textfont: { size: 11, color: stateStyle.color },
          hovertemplate: stateHovers,
        });
      }
    }
    if (showArrayOverlay && arrayXVar && arrayYVar) {
      const xData = arrayColumns.get(arrayXVar);
      const yData = arrayColumns.get(arrayYVar);

      if (xData && yData) {
        // Columns align by subscript with NaN for missing entries: pair by
        // position and drop gaps so sparse arrays cannot mis-pair points.
        const pathX: number[] = [];
        const pathY: number[] = [];
        for (let i = 0; i < Math.min(xData.length, yData.length); i++) {
          if (Number.isFinite(xData[i]) && Number.isFinite(yData[i])) {
            pathX.push(xData[i]);
            pathY.push(yData[i]);
          }
        }

        if (closeCycle && pathX.length > 0) {
          pathX.push(pathX[0]);
          pathY.push(pathY[0]);
        }

        if (pathX.length > 0) {
          const escAX = escHover(arrayXVar);
          const escAY = escHover(arrayYVar);
          t.push({
            x: pathX,
            y: pathY,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Array Cycle',
            line: { color: cycleStyle.color, width: cycleStyle.width, dash: cycleStyle.dash },
            marker: { color: cycleStyle.color, size: cycleStyle.markerSize, symbol: cycleStyle.markerSymbol },
            hovertemplate:
              `<b>Array Cycle</b><br>` +
              `${sepLine}<br>` +
              `<span style="color:${textCol};">${escAX}:</span> <span style="color:${valCol};">%{x:.4g}</span><br>` +
              `<span style="color:${textCol};">${escAY}:</span> <span style="color:${valCol};">%{y:.4g}</span>` +
              `<extra></extra>`,
          });
        }
      }
    }

    return t;
  }, [satData, cfg, showStates, inferredVars, selectedFluid, showArrayOverlay, arrayXVar, arrayYVar, closeCycle, arrayColumns, plotTheme, domeStyle, critStyle, stateStyle, cycleStyle]);

  const layout = useMemo((): Partial<Plotly.Layout> => {
    return {
      title: { text: plotTitle.trim() || (satData ? `${satData.fluid} - ${diagramType} Diagram` : '') },
      xaxis: { title: { text: plotXLabel.trim() || cfg.xLabel } },
      yaxis: {
        title: { text: plotYLabel.trim() || cfg.yLabel },
        type: cfg.yLog ? 'log' : 'linear',
      },
      margin: { l: 70, r: 50, t: 45, b: 50 },
      legend: { ...(legendPosition === 'off' ? LEGEND_POS.tl : LEGEND_POS[legendPosition]), bgcolor: 'transparent' },
      showlegend: legendPosition !== 'off',
      hovermode: 'closest' as const,
    };
  }, [satData, diagramType, cfg, plotTitle, plotXLabel, plotYLabel, legendPosition]);

  if (!satData && !loading) {
    if (diagramError) {
      return (
        <EmptyState
          icon={<ThermoDiagramIcon size={40} />}
          title="Diagram failed"
          description={diagramError}
          steps={['Try another fluid or check the console for details.']}
        />
      );
    }
    return (
      <EmptyState
        icon={<ThermoDiagramIcon size={40} />}
        title="Thermodynamic Property Diagrams"
        description="Generate publication-quality saturation domes and plot cycle state overlays."
        steps={[
          'Select a working fluid in the left sidebar',
          'Choose diagram coordinates (T-s, P-h, h-s, or T-h)',
          <>Click <strong>Generate Diagram</strong> to render the saturation envelope</>,
        ]}
      />
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          className="table-btn-pill"
          onClick={() => setDiagramSettingsOpen(true)}
          title="Edit diagram labels and style"
        >
          <SlidersHorizontal size={11} /> Diagram settings
        </button>
        <button
          className="table-btn-pill"
          onClick={handleSavePlot}
          disabled={traces.length === 0}
          title="Save plot as PNG (choose location and name)"
        >
          <Download size={11} /> Save plot
          </button>
        </div>
      </div>
      {diagramSettingsOpen && (
        <div className="modal-backdrop" onMouseDown={() => setDiagramSettingsOpen(false)}>
          <div className="modal-card modal-settings" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span style={{ fontWeight: 600 }}>Diagram settings</span>
              <button className="icon-btn" onClick={() => setDiagramSettingsOpen(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="settings-layout">
              <aside className="settings-sidebar">
                <button
                  className={`settings-nav-item ${activeDiagramTab === 'labels' ? 'active' : ''}`}
                  onClick={() => setDiagramSettingsTab('labels')}
                >
                  Labels
                </button>
                <button
                  className={`settings-nav-item ${activeDiagramTab === 'style' ? 'active' : ''}`}
                  onClick={() => setDiagramSettingsTab('style')}
                >
                  Style
                </button>
                <button
                  className={`settings-nav-item ${activeDiagramTab === 'dome' ? 'active' : ''}`}
                  onClick={() => setDiagramSettingsTab('dome')}
                >
                  Dome
                </button>
                <button
                  className={`settings-nav-item ${activeDiagramTab === 'points' ? 'active' : ''}`}
                  onClick={() => setDiagramSettingsTab('points')}
                >
                  Points
                </button>
                {hasActiveCycle && (
                  <button
                    className={`settings-nav-item ${activeDiagramTab === 'cycle' ? 'active' : ''}`}
                    onClick={() => setDiagramSettingsTab('cycle')}
                  >
                    Cycle
                  </button>
                )}
              </aside>
              <section className="settings-content">
                {activeDiagramTab === 'labels' ? (
                  <>
                    <PlotRow title="Plot title" hint="Empty shows the fluid and diagram type">
                      <input
                        className="settings-input"
                        style={{ width: '100%', minWidth: 260 }}
                        value={plotTitle}
                        placeholder={satData ? `${satData.fluid} - ${diagramType} Diagram` : 'Diagram title'}
                        onChange={(e) => setPlotTitle(e.target.value)}
                      />
                    </PlotRow>
                    <PlotRow title="X axis label" hint="Empty shows the property and units">
                      <input
                        className="settings-input"
                        style={{ width: '100%', minWidth: 260 }}
                        value={plotXLabel}
                        placeholder={cfg.xLabel}
                        onChange={(e) => setPlotXLabel(e.target.value)}
                      />
                    </PlotRow>
                    <PlotRow title="Y axis label" hint="Empty shows the property and units">
                      <input
                        className="settings-input"
                        style={{ width: '100%', minWidth: 260 }}
                        value={plotYLabel}
                        placeholder={cfg.yLabel}
                        onChange={(e) => setPlotYLabel(e.target.value)}
                      />
                    </PlotRow>
                  </>
                ) : activeDiagramTab === 'style' ? (
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
                    <PlotRow title="Legend" hint="Position of the trace key, or hide it">
                      <Select
                        value={legendPosition}
                        options={[
                          { value: 'tl', label: 'Top left' },
                          { value: 'tr', label: 'Top right' },
                          { value: 'bl', label: 'Bottom left' },
                          { value: 'br', label: 'Bottom right' },
                          { value: 'off', label: 'Hidden' },
                        ]}
                        onChange={(v) => setLegendPosition(v as typeof legendPosition)}
                        style={{ minWidth: 140 }}
                      />
                    </PlotRow>
                  </>
                ) : activeDiagramTab === 'dome' ? (
                  <>
                    <PlotRow title="Dome line color" hint="Saturation envelope">
                      <input
                        type="color"
                        value={domeStyle.color}
                        onChange={(e) => setDomeStyle({ color: e.target.value })}
                        title={domeStyle.color}
                        style={{ width: 44, height: 26, padding: 0, border: '1px solid var(--border-color)', borderRadius: 4, background: 'none', cursor: 'pointer' }}
                      />
                    </PlotRow>
                    <PlotRow title="Dome line width" hint="Pixels (0.5 – 6)">
                      <NumInput value={domeStyle.width} min={0.5} max={6} step={0.5} onChange={(v) => setDomeStyle({ width: v })} title="Dome line width in pixels" />
                    </PlotRow>
                    <PlotRow title="Dome line style" hint="Solid, dashed, dotted">
                      <Select
                        value={domeStyle.dash}
                        options={[
                          { value: 'solid', label: 'Solid' },
                          { value: 'dash', label: 'Dashed' },
                          { value: 'dot', label: 'Dotted' },
                          { value: 'dashdot', label: 'Dash-dot' },
                        ]}
                        onChange={(v) => setDomeStyle({ dash: v as LineDash })}
                        style={{ minWidth: 140 }}
                      />
                    </PlotRow>
                  </>
                ) : activeDiagramTab === 'points' ? (
                  <>
                    <PlotRow title="Critical point color" hint="Diamond marker">
                      <input
                        type="color"
                        value={critStyle.color}
                        onChange={(e) => setCritStyle({ color: e.target.value })}
                        title={critStyle.color}
                        style={{ width: 44, height: 26, padding: 0, border: '1px solid var(--border-color)', borderRadius: 4, background: 'none', cursor: 'pointer' }}
                      />
                    </PlotRow>
                    <PlotRow title="Critical point size" hint="Marker size in pixels (2 – 20)">
                      <NumInput value={critStyle.size} min={2} max={20} step={1} onChange={(v) => setCritStyle({ size: v })} title="Critical point marker size" />
                    </PlotRow>
                    <PlotRow title="Critical marker shape" hint="Diamond, circle, star, cross and more">
                      <Select
                        value={critStyle.symbol}
                        options={[...MARKER_SYMBOL_OPTIONS]}
                        onChange={(v) => setCritStyle({ symbol: v as MarkerSymbol })}
                        style={{ minWidth: 140 }}
                      />
                    </PlotRow>
                    {hasStates ? (
                      <>
                        <PlotRow title="State point color" hint="Solved state markers and labels">
                          <input
                            type="color"
                            value={stateStyle.color}
                            onChange={(e) => setStateStyle({ color: e.target.value })}
                            title={stateStyle.color}
                            style={{ width: 44, height: 26, padding: 0, border: '1px solid var(--border-color)', borderRadius: 4, background: 'none', cursor: 'pointer' }}
                          />
                        </PlotRow>
                        <PlotRow title="State point size" hint="Marker size in pixels (2 – 20)">
                          <NumInput value={stateStyle.size} min={2} max={20} step={1} onChange={(v) => setStateStyle({ size: v })} title="State point marker size" />
                        </PlotRow>
                        <PlotRow title="State marker shape" hint="Circle, square, diamond, star and more">
                          <Select
                            value={stateStyle.symbol}
                            options={[...MARKER_SYMBOL_OPTIONS]}
                            onChange={(v) => setStateStyle({ symbol: v as MarkerSymbol })}
                            style={{ minWidth: 140 }}
                          />
                        </PlotRow>
                      </>
                    ) : (
                      <div className="parametric-notice">Solve the model to overlay state points.</div>
                    )}
                  </>
                ) : (
                  <>
                    <PlotRow title="Cycle line color" hint="Array cycle path">
                      <input
                        type="color"
                        value={cycleStyle.color}
                        onChange={(e) => setCycleStyle({ color: e.target.value })}
                        title={cycleStyle.color}
                        style={{ width: 44, height: 26, padding: 0, border: '1px solid var(--border-color)', borderRadius: 4, background: 'none', cursor: 'pointer' }}
                      />
                    </PlotRow>
                    <PlotRow title="Cycle line width" hint="Pixels (0.5 – 6)">
                      <NumInput value={cycleStyle.width} min={0.5} max={6} step={0.5} onChange={(v) => setCycleStyle({ width: v })} title="Cycle line width in pixels" />
                    </PlotRow>
                    <PlotRow title="Cycle line style" hint="Solid, dashed, dotted">
                      <Select
                        value={cycleStyle.dash}
                        options={[
                          { value: 'solid', label: 'Solid' },
                          { value: 'dash', label: 'Dashed' },
                          { value: 'dot', label: 'Dotted' },
                          { value: 'dashdot', label: 'Dash-dot' },
                        ]}
                        onChange={(v) => setCycleStyle({ dash: v as LineDash })}
                        style={{ minWidth: 140 }}
                      />
                    </PlotRow>
                    <PlotRow title="Cycle marker size" hint="Marker size in pixels (2 – 20)">
                      <NumInput value={cycleStyle.markerSize} min={2} max={20} step={1} onChange={(v) => setCycleStyle({ markerSize: v })} title="Cycle marker size" />
                    </PlotRow>
                    <PlotRow title="Cycle marker shape" hint="Circle, diamond, star, cross and more">
                      <Select
                        value={cycleStyle.markerSymbol}
                        options={[...MARKER_SYMBOL_OPTIONS]}
                        onChange={(v) => setCycleStyle({ markerSymbol: v as MarkerSymbol })}
                        style={{ minWidth: 140 }}
                      />
                    </PlotRow>
                  </>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
      <div className="parametric-results-content thermo-diagram" style={{ justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
        <div className="parametric-plot-box" ref={plotBoxRef} style={{ maxWidth: 880, height: '100%', minHeight: 380 }}>
          <Plot
            data={traces}
            layout={layout}
            themeOverride={plotBackground === 'auto' ? undefined : plotBackground}
            config={{
              responsive: true,
              displaylogo: false,
              // No camera button: it downloads straight to Downloads with no
              // name choice. handleSavePlot (Save plot button) is the save path.
              modeBarButtonsToRemove: ['toImage', 'sendDataToCloud'],
              toImageButtonOptions: {
                format: 'png',
                filename: `${selectedFluid}_${diagramType}_diagram`,
                scale: 3, // 300+ DPI publication quality
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
  );
}
