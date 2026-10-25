import { useState, useMemo, useCallback, useEffect } from 'react';
import { Star, X } from 'lucide-react';
import { useModelStore } from '../stores/modelStore';
import type { VariableInfo } from '../api/types';

const GREEK_MAP: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ',
  epsilon: 'ε', eps: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', Theta: 'Θ',
  iota: 'ι', kappa: 'κ', lambda: 'λ', Lambda: 'Λ', mu: 'μ', nu: 'ν',
  xi: 'ξ', pi: 'π', Pi: 'Π', rho: 'ρ', sigma: 'σ', Sigma: 'Σ',
  tau: 'τ', upsilon: 'υ', phi: 'φ', Phi: 'Φ', chi: 'χ', psi: 'ψ',
  Psi: 'Ψ', omega: 'ω', Omega: 'Ω',
};

interface UnitConv {
  dim: string;
  toSI: (v: number) => number;
  fromSI: (v: number) => number;
}

const lin = (dim: string, factor: number): UnitConv => ({
  dim,
  toSI: (v) => v * factor,
  fromSI: (v) => v / factor,
});

const UNIT_TABLE: Record<string, UnitConv> = {
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
  'Btu/lbm': lin('h', 2326),
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

function convertUnits(val: number, fromUnit: string, toUnit: string): number | null {
  const f = UNIT_TABLE[fromUnit.trim()];
  const t = UNIT_TABLE[toUnit.trim()];
  if (!f || !t || f.dim !== t.dim) return null;
  return t.fromSI(f.toSI(val));
}

function formatPrettyUnit(u: string): string {
  return u
    .replace(/\^2\b/g, '²')
    .replace(/\^3\b/g, '³')
    .replace(/\^4\b/g, '⁴')
    .replace(/\^-1\b/g, '⁻¹');
}

function formatSolNumber(val: number, sigFigs = 4): string {
  if (!Number.isFinite(val)) return String(val);
  if (val === 0) return '0';
  const abs = Math.abs(val);
  if (Number.isInteger(val) && abs < 1e6) return val.toString();
  if (abs >= 1e5 || abs < 1e-3) {
    return val.toExponential(Math.max(1, sigFigs - 1));
  }
  return Number(val.toPrecision(sigFigs)).toString();
}

function renderSolVarName(name: string) {
  let base = name;
  let sub = '';
  let hasDot = false;

  const dotMatch = name.match(/^([A-Za-z]+)_dot(?:_(.*))?$/i);
  if (dotMatch) {
    base = dotMatch[1];
    sub = dotMatch[2] || '';
    hasDot = true;
  } else {
    const idx = name.indexOf('_');
    if (idx > 0) {
      base = name.slice(0, idx);
      sub = name.slice(idx + 1);
    }
  }

  let displayBase = GREEK_MAP[base] || GREEK_MAP[base.toLowerCase()] || base;
  if (displayBase === base && /^delta[A-Za-z]/i.test(base)) {
    displayBase = (base[0] === 'D' ? 'Δ' : 'δ') + base.slice(5);
  }
  if (hasDot && displayBase.length > 0) {
    displayBase = displayBase[0] + '\u0307' + displayBase.slice(1);
  }
  const formattedSub = sub ? sub.replace(/_/g, ',') : '';

  return (
    <span className="sol-var-name">
      <span>{displayBase}</span>
      {formattedSub && <sub>{formattedSub}</sub>}
    </span>
  );
}

interface VarMeta {
  altUnits?: string;
  isKey?: boolean;
  comment?: string;
  sigFigs?: number;
}

const META_STORAGE_KEY = 'coolsolve-solution-meta';

function loadMeta(): Record<string, VarMeta> {
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function SolutionView() {
  const [subTab, setSubTab] = useState<'main' | 'key'>('main');
  const [metaMap, setMetaMap] = useState<Record<string, VarMeta>>(loadMeta);
  const [editingVar, setEditingVar] = useState<string | null>(null);
  const [unitDraft, setUnitDraft] = useState('');
  const [altUnitDraft, setAltUnitDraft] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [keyDraft, setKeyDraft] = useState(false);

  const lastResult = useModelStore((s) => s.lastResult);
  const eescode = useModelStore((s) => s.eescode);
  const parsedVariables = useModelStore((s) => s.parsedVariables);
  const userUnitOverrides = useModelStore((s) => s.userUnitOverrides);
  const setUserUnit = useModelStore((s) => s.setUserUnit);

  useEffect(() => {
    try {
      localStorage.setItem(META_STORAGE_KEY, JSON.stringify(metaMap));
    } catch {
      // Storage unavailable or quota exceeded
    }
  }, [metaMap]);

  const unitSystemStr = useMemo(() => {
    const m = eescode.match(/^\s*\$UnitSystem\s+([^\r\n{"]+)/im);
    return m ? m[1].trim() : 'SI C Pa J mass deg';
  }, [eescode]);

  const parsedMap = useMemo(() => {
    const map = new Map<string, VariableInfo>();
    for (const v of parsedVariables) {
      map.set(v.name.toLowerCase(), v);
    }
    return map;
  }, [parsedVariables]);

  const getUnit = useCallback(
    (name: string): string => {
      const userOvr = userUnitOverrides.find(
        (o) => o.variableName.toLowerCase() === name.toLowerCase()
      );
      if (userOvr) return userOvr.units;
      const info = parsedMap.get(name.toLowerCase());
      return info?.units || '';
    },
    [parsedMap, userUnitOverrides]
  );

  const scalarVars = useMemo(() => {
    if (!lastResult || !lastResult.variables) return [];
    const list: { name: string; numVal?: number; strVal?: string }[] = [];
    for (const [name, val] of Object.entries(lastResult.variables)) {
      if (name.includes('[')) continue;
      list.push({ name, numVal: val });
    }
    if (lastResult.stringVariables) {
      for (const [name, val] of Object.entries(lastResult.stringVariables)) {
        if (name.includes('[')) continue;
        list.push({ name, strVal: val });
      }
    }
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return list;
  }, [lastResult]);

  const keyVars = useMemo(
    () => scalarVars.filter((v) => metaMap[v.name]?.isKey),
    [scalarVars, metaMap]
  );

  const compatibleAltUnits = useMemo(() => {
    if (!editingVar) return [];
    const u = unitDraft.trim();
    const entry = UNIT_TABLE[u];
    if (!entry) return [];
    return Object.keys(UNIT_TABLE).filter(
      (k) => UNIT_TABLE[k].dim === entry.dim && k !== u && !k.includes('²') && !k.includes('³') && !k.includes('°')
    );
  }, [editingVar, unitDraft]);

  const openVarEditor = (name: string) => {
    const curUnit = getUnit(name);
    const meta = metaMap[name] || {};
    setEditingVar(name);
    setUnitDraft(curUnit);
    setAltUnitDraft(meta.altUnits || '');
    setCommentDraft(meta.comment || '');
    setKeyDraft(Boolean(meta.isKey));
  };

  const saveVarEditor = () => {
    if (!editingVar) return;
    setUserUnit(editingVar, unitDraft.trim());
    setMetaMap((prev) => ({
      ...prev,
      [editingVar]: {
        ...prev[editingVar],
        altUnits: altUnitDraft.trim() || undefined,
        comment: commentDraft.trim() || undefined,
        isKey: keyDraft,
      },
    }));
    setEditingVar(null);
  };

  if (!lastResult || (!scalarVars.length && !lastResult.success)) {
    return (
      <div className="sol-view-empty">
        <p>No solution available yet. Solve the model (<kbd>F2</kbd>) to display results.</p>
      </div>
    );
  }

  const compileMs = Math.round(
    (lastResult.timing?.parse_ms ?? 0) +
    (lastResult.timing?.ir_ms ?? 0) +
    (lastResult.timing?.infer_ms ?? 0) +
    (lastResult.timing?.analysis_ms ?? 0)
  );
  const calcMs = Math.round(lastResult.timing?.solve_ms ?? lastResult.timing?.total_ms ?? 0);
  const unitWarnings = (lastResult.diagnostics ?? []).filter(
    (d) => d.message.toLowerCase().includes('unit') || d.source.toLowerCase().includes('unit')
  );

  const renderVarItem = (v: { name: string; numVal?: number; strVal?: string }, showComment = false) => {
    const rawUnit = getUnit(v.name);
    const meta = metaMap[v.name] || {};
    const valStr = v.strVal !== undefined ? `'${v.strVal}'` : formatSolNumber(v.numVal ?? 0, meta.sigFigs ?? 4);

    let altDisplay: string | null = null;
    if (meta.altUnits && v.numVal !== undefined) {
      const converted = rawUnit ? convertUnits(v.numVal, rawUnit, meta.altUnits) : null;
      if (converted !== null) {
        altDisplay = `${formatSolNumber(converted, meta.sigFigs ?? 4)} [${formatPrettyUnit(meta.altUnits)}]`;
      } else {
        altDisplay = `[${formatPrettyUnit(meta.altUnits)}]`;
      }
    }

    return (
      <div
        key={v.name}
        className={`sol-view-item ${meta.isKey ? 'is-key' : ''}`}
        onClick={() => openVarEditor(v.name)}
        onContextMenu={(e) => {
          e.preventDefault();
          openVarEditor(v.name);
        }}
        title="Click to set units, alternate units, or Key Variable status"
      >
        <span className="sol-view-expr">
          {renderSolVarName(v.name)}
          <span className="sol-view-eq"> = </span>
          <span className="sol-view-val">{valStr}</span>
          {rawUnit && <span className="sol-view-unit"> [{formatPrettyUnit(rawUnit)}]</span>}
          {altDisplay && <span className="sol-view-alt"> {`{${altDisplay}}`}</span>}
        </span>
        {showComment && meta.comment && (
          <span className="sol-view-comment">{meta.comment}</span>
        )}
      </div>
    );
  };

  return (
    <div className="sol-view-panel">
      <div className="sol-view-subtabs">
        <button
          className={`sol-subtab ${subTab === 'main' ? 'active' : ''}`}
          onClick={() => setSubTab('main')}
        >
          Main
        </button>
        <button
          className={`sol-subtab ${subTab === 'key' ? 'active' : ''}`}
          onClick={() => setSubTab('key')}
        >
          Key Variables{keyVars.length > 0 ? ` (${keyVars.length})` : ''}
        </button>
      </div>

      <div className="sol-view-body">
        <div className="sol-unit-settings-line">
          Unit Settings: {unitSystemStr}
        </div>

        {subTab === 'main' ? (
          <div className="sol-view-grid">
            {scalarVars.map((v) => renderVarItem(v, false))}
          </div>
        ) : keyVars.length > 0 ? (
          <div className="sol-key-list">
            {keyVars.map((v) => renderVarItem(v, true))}
          </div>
        ) : (
          <div className="sol-key-empty">
            Click any variable in the <strong>Main</strong> tab to mark it as a Key Variable or configure alternate units.
          </div>
        )}

        <div className="sol-view-footer">
          <div className={unitWarnings.length > 0 ? 'sol-unit-warn' : 'sol-unit-ok'}>
            {unitWarnings.length > 0
              ? `${unitWarnings.length} unit warning(s) detected.`
              : 'No unit problems were detected.'}
          </div>
          <div className="sol-timing-line">
            <span>Compilation time = {compileMs} ms</span>
            <span>Calculation time = {calcMs} ms</span>
          </div>
        </div>
      </div>

      {editingVar && (
        <div className="sol-var-popover-backdrop" onMouseDown={() => setEditingVar(null)}>
          <div className="sol-var-popover" onMouseDown={(e) => e.stopPropagation()}>
            <div className="sol-var-popover-header">
              <span>Format Variable: <strong>{editingVar}</strong></span>
              <button className="icon-btn small" onClick={() => setEditingVar(null)}>
                <X size={13} />
              </button>
            </div>
            <div className="sol-var-popover-body">
              <div className="sol-popover-field">
                <label>Units</label>
                <input
                  type="text"
                  className="fn-input"
                  value={unitDraft}
                  onChange={(e) => setUnitDraft(e.target.value)}
                  placeholder="e.g. kPa, kJ/kg, m^2"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveVarEditor();
                    if (e.key === 'Escape') setEditingVar(null);
                  }}
                />
              </div>
              <div className="sol-popover-field">
                <label>Alternate Units {compatibleAltUnits.length > 0 ? `(${compatibleAltUnits.slice(0, 5).join(', ')})` : ''}</label>
                <input
                  type="text"
                  className="fn-input"
                  value={altUnitDraft}
                  onChange={(e) => setAltUnitDraft(e.target.value)}
                  placeholder="e.g. ft^2, psi, Btu/lbm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveVarEditor();
                    if (e.key === 'Escape') setEditingVar(null);
                  }}
                />
              </div>
              <div className="sol-popover-field">
                <label>Comment (shown in Key Variables)</label>
                <input
                  type="text"
                  className="fn-input"
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  placeholder="Optional description"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveVarEditor();
                    if (e.key === 'Escape') setEditingVar(null);
                  }}
                />
              </div>
              <label className="sol-popover-check">
                <input
                  type="checkbox"
                  checked={keyDraft}
                  onChange={(e) => setKeyDraft(e.target.checked)}
                />
                <Star size={13} style={{ color: keyDraft ? 'var(--warning-color)' : 'var(--text-muted)' }} />
                <span>Include in Key Variables tab</span>
              </label>
            </div>
            <div className="sol-var-popover-footer">
              <button className="btn-secondary" onClick={() => setEditingVar(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveVarEditor}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
