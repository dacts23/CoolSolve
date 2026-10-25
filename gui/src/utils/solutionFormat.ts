/**
 * solutionFormat.ts - unit conversion and number formatting for result display.
 * Shared by the Solution view (per-variable units, alternate units) and the
 * parametric store's table formatter, so every panel prints the same way.
 * Display only: file writes (.sol, CSV exports) must keep full precision and
 * never use formatSolNumber/fmt.
 */
export interface UnitConv {
  dim: string;
  toSI: (v: number) => number;
  fromSI: (v: number) => number;
}

const lin = (dim: string, factor: number): UnitConv => ({
  dim,
  toSI: (v) => v * factor,
  fromSI: (v) => v / factor,
});

export const UNIT_TABLE: Record<string, UnitConv> = {
  // shortcut: T conversions are absolute (C/F offsets apply); a delta-T in C
  // converts wrong. Upgrade when variables carry absolute-vs-delta metadata.
  K: { dim: 'T', toSI: (v) => v, fromSI: (v) => v },
  C: { dim: 'T', toSI: (v) => v + 273.15, fromSI: (v) => v - 273.15 },
  '°C': { dim: 'T', toSI: (v) => v + 273.15, fromSI: (v) => v - 273.15 },
  F: { dim: 'T', toSI: (v) => (v - 32) * (5 / 9) + 273.15, fromSI: (v) => (v - 273.15) * (9 / 5) + 32 },
  '°F': { dim: 'T', toSI: (v) => (v - 32) * (5 / 9) + 273.15, fromSI: (v) => (v - 273.15) * (9 / 5) + 32 },
  R: { dim: 'T', toSI: (v) => v * (5 / 9), fromSI: (v) => v * (9 / 5) },
  Pa: lin('P', 1),
  kPa: lin('P', 1e3),
  MPa: lin('P', 1e6),
  GPa: lin('P', 1e9),
  bar: lin('P', 1e5),
  mbar: lin('P', 100),
  atm: lin('P', 101325),
  psi: lin('P', 6894.757293168),
  psia: lin('P', 6894.757293168),
  mmHg: lin('P', 133.322387415),
  inHg: lin('P', 3386.389),
  m: lin('L', 1),
  cm: lin('L', 0.01),
  mm: lin('L', 0.001),
  km: lin('L', 1000),
  in: lin('L', 0.0254),
  ft: lin('L', 0.3048),
  yd: lin('L', 0.9144),
  mi: lin('L', 1609.344),
  'm^2': lin('A', 1),
  'm²': lin('A', 1),
  'cm^2': lin('A', 1e-4),
  'cm²': lin('A', 1e-4),
  'mm^2': lin('A', 1e-6),
  'mm²': lin('A', 1e-6),
  'in^2': lin('A', 0.00064516),
  'in²': lin('A', 0.00064516),
  'ft^2': lin('A', 0.09290304),
  'ft²': lin('A', 0.09290304),
  'm^3': lin('V', 1),
  'm³': lin('V', 1),
  L: lin('V', 1e-3),
  l: lin('V', 1e-3),
  mL: lin('V', 1e-6),
  'cm^3': lin('V', 1e-6),
  'cm³': lin('V', 1e-6),
  'ft^3': lin('V', 0.028316846592),
  'ft³': lin('V', 0.028316846592),
  'in^3': lin('V', 1.6387064e-5),
  'in³': lin('V', 1.6387064e-5),
  gal: lin('V', 0.003785411784),
  kg: lin('M', 1),
  g: lin('M', 1e-3),
  ton: lin('M', 1000),
  lbm: lin('M', 0.45359237),
  lb: lin('M', 0.45359237),
  oz: lin('M', 0.028349523125),
  'kg/s': lin('Mdot', 1),
  'kg/h': lin('Mdot', 1 / 3600),
  'kg/hr': lin('Mdot', 1 / 3600),
  'g/s': lin('Mdot', 1e-3),
  'lbm/s': lin('Mdot', 0.45359237),
  'lbm/h': lin('Mdot', 0.45359237 / 3600),
  'lbm/hr': lin('Mdot', 0.45359237 / 3600),
  'm/s': lin('Vel', 1),
  'km/h': lin('Vel', 1 / 3.6),
  'ft/s': lin('Vel', 0.3048),
  'ft/min': lin('Vel', 0.00508),
  mph: lin('Vel', 0.44704),
  'm^3/kg': lin('v', 1),
  'm³/kg': lin('v', 1),
  'ft^3/lbm': lin('v', 0.028316846592 / 0.45359237),
  'ft³/lbm': lin('v', 0.028316846592 / 0.45359237),
  'kg/m^3': lin('rho', 1),
  'kg/m³': lin('rho', 1),
  'g/cm^3': lin('rho', 1000),
  'g/cm³': lin('rho', 1000),
  'lbm/ft^3': lin('rho', 0.45359237 / 0.028316846592),
  'lbm/ft³': lin('rho', 0.45359237 / 0.028316846592),
  J: lin('E', 1),
  kJ: lin('E', 1e3),
  MJ: lin('E', 1e6),
  GJ: lin('E', 1e9),
  Wh: lin('E', 3600),
  kWh: lin('E', 3.6e6),
  Btu: lin('E', 1055.05585262),
  cal: lin('E', 4.184),
  kcal: lin('E', 4184),
  W: lin('W', 1),
  kW: lin('W', 1e3),
  MW: lin('W', 1e6),
  GW: lin('W', 1e9),
  hp: lin('W', 745.699871582),
  'Btu/h': lin('W', 0.29307107),
  'Btu/hr': lin('W', 0.29307107),
  'Btu/s': lin('W', 1055.05585262),
  'J/kg': lin('h', 1),
  'kJ/kg': lin('h', 1e3),
  'Btu/lbm': lin('h', 1055.05585262 / 0.45359237),
  'J/kg-K': lin('s', 1),
  'J/(kg-K)': lin('s', 1),
  'J/(kg·K)': lin('s', 1),
  'kJ/kg-K': lin('s', 1e3),
  'kJ/(kg-K)': lin('s', 1e3),
  'kJ/(kg·K)': lin('s', 1e3),
  'Btu/lbm-R': lin('s', 4186.8),
  'Btu/(lbm-R)': lin('s', 4186.8),
  N: lin('F', 1),
  kN: lin('F', 1e3),
  lbf: lin('F', 4.4482216152605),
};

export function convertUnits(val: number, fromUnit: string, toUnit: string): number | null {
  const f = UNIT_TABLE[fromUnit.trim()];
  const t = UNIT_TABLE[toUnit.trim()];
  if (!f || !t || f.dim !== t.dim) return null;
  return t.fromSI(f.toSI(val));
}

export function formatPrettyUnit(u: string): string {
  return u
    .replace(/\^2\b/g, '²')
    .replace(/\^3\b/g, '³')
    .replace(/\^4\b/g, '⁴')
    .replace(/\^-1\b/g, '⁻¹')
    .replace(/\^(-?\d+)/g, (_, n: string) => {
      const sup: Record<string, string> = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
      return String(n).split('').map((c) => sup[c] ?? c).join('');
    });
}

/**
 * Format a solved number for display. One rule for every table: very large or
 * tiny values use exponential form, integers print plain, the rest use the
 * requested significant figures. Non-finite values print as '-'. Magnitude
 * decides, not integer-ness, so one column never mixes "-393 522 000" with
 * "-8.9414e+6" at the same size.
 */
export function formatSolNumber(val: number, sigFigs = 4): string {
  if (!Number.isFinite(val)) return '-';
  if (val === 0) return '0';
  const abs = Math.abs(val);
  if (abs >= 1e6 || abs < 0.01) {
    return val.toExponential(Math.max(1, sigFigs - 1));
  }
  if (Number.isInteger(val)) {
    return val.toString();
  }
  return Number(val.toPrecision(sigFigs)).toString();
}
