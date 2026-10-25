import { escapeHtml } from './escapeHtml.ts';

/** Only CSS colors the app itself passes: anything else falls back to inherit. */
function safeColor(color: string): string {
  if (/^(#[0-9a-fA-F]{3,8}|[a-z]+|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|hsl\(\s*\d+\s*,\s*[\d.]+%\s*,\s*[\d.]+%\s*\))$/.test(color.trim())) return color;
  return 'inherit';
}

/** Separator line used in Plotly hover boxes (the only intentional HTML). */
export function hoverSep(color: string): string {
  return `<span style="color:${safeColor(color)};">────────────────────────</span>`;
}

/**
 * Escape a variable name, label or unit for hovertemplate text. A literal "%{"
 * would open a Plotly format tag, so it is neutralized to an HTML entity.
 */
export function escHover(s: string): string {
  return escapeHtml(s).replace(/%\{/g, '&#37;{');
}
