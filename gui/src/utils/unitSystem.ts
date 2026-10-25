/** unitSystem.ts - read the $UnitSystem directive out of model text. */

const UNIT_SYSTEM_RE = /^\s*\$UnitSystem\s+([^\r\n{"]+)/im;

/** The default token string when no $UnitSystem directive is present. */
export const DEFAULT_UNIT_SYSTEM = 'SI C Pa J mass deg';

/** The active "$UnitSystem …" token string, or the default when absent. */
export function parseUnitSystemString(eescode: string): string {
  const m = eescode.match(UNIT_SYSTEM_RE);
  if (!m) return DEFAULT_UNIT_SYSTEM;
  // Strip // or # comments that follow the directive on the same line.
  const line = m[1].split('//')[0].split('#')[0];
  return line.trim() || DEFAULT_UNIT_SYSTEM;
}

/** The directive split into tokens (e.g. ["SI","C","kPa","kJ","mass","deg"]). */
export function parseUnitSystemTokens(eescode: string): string[] {
  const s = parseUnitSystemString(eescode);
  return s === DEFAULT_UNIT_SYSTEM && !UNIT_SYSTEM_RE.test(eescode) ? [] : s.split(/\s+/).filter(Boolean);
}
