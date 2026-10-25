/**
 * exportPlots.ts — Capture all visible Plotly charts as PNG data URIs.
 *
 * Uses Plotly.toImage() on every <div class="js-plotly-plot"> in the DOM.
 * Returns an array of { name, data } suitable for the /api/v1/latex/compile
 * endpoint.
 *
 * Naming convention:
 *   - The first chart inside a ".thermo-diagram" ancestor → "thermo_diagrams.png"
 *   - Charts inside a ".parametric-plot" ancestor → "parametric_1.png", "parametric_2.png", …
 *   - Any other chart → "plot_<n>.png"
 */

import Plotly from 'plotly.js-cartesian-dist-min';
import type { LatexPlotImage } from '../api/types';
import { saveFileWithPicker } from './fileSave.ts';

/**
 * The `plotly.js-cartesian-dist-min` type definitions omit the imperative
 * `toImage` method that ships with the runtime bundle. Define the minimal
 * slice we call so the cast stays scoped instead of `any`.
 */
interface PlotlyImperative {
  toImage(gd: HTMLDivElement, opts: Record<string, unknown>): Promise<string>;
}
type PlotlyWithImperative = typeof Plotly & PlotlyImperative;

/** Minimal typing for a Plotly-rendered DOM element (has .data attached). */
interface PlotlyGraphDiv extends HTMLDivElement {
  data?: unknown[];
}

export interface PlotExportResult {
  plots: LatexPlotImage[];
  total: number;
  skipped: number;
}

export async function exportAllPlots(): Promise<PlotExportResult> {
  const plots: LatexPlotImage[] = [];

  // Plotly attaches the class "js-plotly-plot" to every rendered chart div.
  // Cap the count: each export renders at print size, so unbounded
  // pages would block the UI and blow up memory.
  const MAX_PLOTS = 6;
  // Filter hidden/empty plots first: slicing before the filter can starve a
  // visible chart behind six hidden ones and cut it from the report.
  const visibleDivs = Array.from(document.querySelectorAll<HTMLDivElement>('.js-plotly-plot')).filter((div) => {
    if (div.getClientRects().length === 0) return false;
    const gd = div as unknown as PlotlyGraphDiv;
    return !!gd.data && gd.data.length > 0;
  });
  if (visibleDivs.length > MAX_PLOTS) {
    console.warn(`Plot export: ${visibleDivs.length} charts found, only the first ${MAX_PLOTS} are included.`);
  }
  const chartDivs = visibleDivs.slice(0, MAX_PLOTS);
  const skipped = Math.max(0, visibleDivs.length - chartDivs.length);
  if (chartDivs.length === 0) return { plots, total: visibleDivs.length, skipped };

  let parametricIdx = 0;
  let genericIdx = 0;
  let thermoIdx = 0;
  // Name every chart first (order-dependent), then render one by one:
  // parallel toImage calls spike peak memory.
  const named = chartDivs.map((div) => {
    let name: string;
    if (div.closest('.thermo-diagram')) {
      thermoIdx++;
      name = thermoIdx === 1 ? 'thermo_diagrams.png' : `thermo_diagrams_${thermoIdx}.png`;
    } else if (div.closest('.parametric-plot, .parametric-plot-box')) {
      parametricIdx++;
      name = `parametric_${parametricIdx}.png`;
    } else {
      genericIdx++;
      name = `plot_${genericIdx}.png`;
    }
    return { div: div as unknown as PlotlyGraphDiv, name };
  });

  for (const { div, name } of named) {
    try {
      const dataUrl: string = await (Plotly as PlotlyWithImperative).toImage(div, {
        format: 'png',
        width: 1200,
        height: 800,
        scale: 1.5,
      });
      plots.push({ name, data: dataUrl });
    } catch (err) {
      // Surface export failures instead of returning an empty bundle silently.
      console.warn('Plot export failed:', err);
    }
  }

  return { plots, total: visibleDivs.length, skipped };
}

/** Save a rendered Plotly chart inside `boxEl` as a 3x PNG using the file picker. */
export async function savePlotPng(
  boxEl: HTMLElement | null,
  filename: string,
  addConsoleLine: (line: string) => void
): Promise<void> {
  const gd = boxEl?.querySelector<HTMLDivElement>('.js-plotly-plot');
  if (!gd) {
    addConsoleLine('>>> ERROR: plot is not ready yet.');
    return;
  }
  try {
    const url = await (Plotly as PlotlyWithImperative).toImage(gd, { format: 'png', scale: 3 });
    const blob = await (await fetch(url)).blob();
    const result = await saveFileWithPicker(blob, filename, [
      { description: 'PNG image (*.png)', accept: { 'image/png': ['.png'] } },
    ]);
    if (result.saved) addConsoleLine(`>>> Saved plot: ${result.name || filename}`);
  } catch {
    addConsoleLine('>>> ERROR: could not save plot.');
  }
}
