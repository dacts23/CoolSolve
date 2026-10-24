// Use the cartesian plotly.js distribution (scatter, bar, heatmap, contour, etc.)
// This avoids the massive full plotly.js bundle while supporting 2D plots.
import { useEffect, useRef, type ComponentProps } from 'react';
import PlotlyLib from 'plotly.js-cartesian-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';
import { useUIStore } from '../stores/uiStore';

const BasePlot = createPlotlyComponent(PlotlyLib);

export const DEFAULT_PLOT_FONT =
  '"DejaVu Sans", "STIXGeneral", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// Matplotlib scientific paper look: boxed axes (4 spines), outward ticks on all sides, major + minor grid.
const axis = (c: { text: string; line: string; grid: string; minor: string }) => ({
  showline: true,
  mirror: 'allticks' as const,
  linecolor: c.line,
  linewidth: 1.1,
  ticks: 'outside' as const,
  tickcolor: c.line,
  ticklen: 5,
  tickwidth: 1.1,
  tickfont: { family: DEFAULT_PLOT_FONT, size: 10, color: c.text },
  titlefont: { family: DEFAULT_PLOT_FONT, size: 11, color: c.text },
  showgrid: true,
  gridcolor: c.grid,
  gridwidth: 0.8,
  zeroline: false,
  minor: {
    ticks: 'outside' as const,
    ticklen: 3,
    tickwidth: 0.8,
    tickcolor: c.line,
    showgrid: true,
    gridcolor: c.minor,
    gridwidth: 0.5,
  },
});

const theme = (c: { text: string; line: string; grid: string; minor: string; hover: string }) => ({
  layout: {
    font: { family: DEFAULT_PLOT_FONT, size: 11, color: c.text },
    titlefont: { family: DEFAULT_PLOT_FONT, size: 12, color: c.text },
    xaxis: axis(c),
    yaxis: axis(c),
    colorway: [
      '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
      '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
    ],
    legend: {
      font: { family: DEFAULT_PLOT_FONT, size: 10, color: c.text },
      bordercolor: c.line,
      borderwidth: 0.8,
      bgcolor: 'transparent',
    },
    hoverlabel: {
      bgcolor: c.hover,
      bordercolor: c.line,
      font: { family: DEFAULT_PLOT_FONT, size: 11, color: c.text },
    },
    modebar: { orientation: 'v' as const, bgcolor: 'transparent', color: c.line, activecolor: c.text },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
  },
});

const TEMPLATES = {
  dark: theme({
    text: '#d8dee9',
    line: '#6b7280',
    grid: 'rgba(255, 255, 255, 0.08)',
    minor: 'rgba(255, 255, 255, 0.03)',
    hover: '#1e222b',
  }),
  light: theme({
    text: '#1f242d',
    line: '#4a5568',
    grid: 'rgba(0, 0, 0, 0.08)',
    minor: 'rgba(0, 0, 0, 0.03)',
    hover: '#f8fafc',
  }),
};

export default function Plot(props: ComponentProps<typeof BasePlot>) {
  const mode = useUIStore((s) => s.theme);
  const box = useRef<HTMLDivElement>(null);
  const t = TEMPLATES[mode === 'dark' ? 'dark' : 'light'];

  const layout = {
    template: t,
    autosize: true,
    ...props.layout,
    modebar: { ...t.layout.modebar, ...props.layout?.modebar, orientation: 'v' as const },
    xaxis: { ...t.layout.xaxis, ...props.layout?.xaxis },
    yaxis: { ...t.layout.yaxis, ...props.layout?.yaxis },
  } as ComponentProps<typeof BasePlot>['layout'];

  // The built-in resize handler only reacts to window resizes; panes dragged by split dividers need this.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const gd = el.querySelector('.js-plotly-plot');
      if (gd) PlotlyLib.Plots.resize(gd as HTMLElement);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={box} style={{ width: '100%', height: '100%', ...props.style }}>
      <BasePlot
        {...props}
        layout={layout}
        config={{
          displaylogo: false,
          toImageButtonOptions: {
            format: 'png',
            scale: 3, // 300+ DPI publication resolution
          },
          ...props.config,
        }}
        style={{ width: '100%', height: '100%' }}
        useResizeHandler
      />
    </div>
  );
}
