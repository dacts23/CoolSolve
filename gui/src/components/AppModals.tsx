import { useState, useEffect, useMemo } from 'react';
import { X, Search, ExternalLink, Copy, Check, ChevronRight, Folder, FolderOpen, FileCode } from 'lucide-react';
import { useModelStore } from '../stores/modelStore';
import { useUIStore } from '../stores/uiStore';
import { api } from '../api/client';
import SettingsModal from './SettingsModal';
import UsageStats from './UsageStats';
import { insertAtCursor } from './editorUtils';
import { openLibraryModel, LIBRARY_DASHBOARD_URL, libraryModelPageUrl } from '../utils/library';
import { parseUnitSystemTokens } from '../utils/unitSystem';
import type { LibraryMenuResponse, LibraryMenuCategory, LibraryMenuModel } from '../api/types';

const THERMO_PROPERTIES = [
  { fn: 'enthalpy', lhs: 'h', desc: 'Specific enthalpy [J/kg or kJ/kg]' },
  { fn: 'entropy', lhs: 's', desc: 'Specific entropy [J/(kg·K) or kJ/(kg·K)]' },
  { fn: 'temperature', lhs: 'T', desc: 'Temperature [°C or K]' },
  { fn: 'pressure', lhs: 'P', desc: 'Pressure [Pa, kPa, bar, or MPa]' },
  { fn: 'density', lhs: 'rho', desc: 'Density [kg/m³]' },
  { fn: 'volume', lhs: 'v', desc: 'Specific volume [m³/kg]' },
  { fn: 'quality', lhs: 'x', desc: 'Vapor quality [-] (0 = sat. liquid, 1 = sat. vapor)' },
  { fn: 'cp', lhs: 'cp', desc: 'Isobaric specific heat [J/(kg·K)]' },
  { fn: 'cv', lhs: 'cv', desc: 'Isochoric specific heat [J/(kg·K)]' },
  { fn: 'internalenergy', lhs: 'u', desc: 'Specific internal energy [J/kg]' },
  { fn: 'viscosity', lhs: 'mu', desc: 'Dynamic viscosity [Pa·s]' },
  { fn: 'conductivity', lhs: 'k', desc: 'Thermal conductivity [W/(m·K)]' },
  { fn: 'prandtl', lhs: 'Pr', desc: 'Prandtl number [-]' },
  { fn: 'soundspeed', lhs: 'c', desc: 'Speed of sound [m/s]' },
  { fn: 'surfacetension', lhs: 'sigma', desc: 'Surface tension [N/m] (two-phase)' },
  { fn: 'T_sat', lhs: 'T_sat', desc: 'Saturation temperature at given P' },
  { fn: 'P_sat', lhs: 'P_sat', desc: 'Saturation pressure at given T' },
  { fn: 'humrat', lhs: 'omega', desc: 'Humidity ratio [kg/kg_da] (Air_ha moist air)' },
  { fn: 'relhum', lhs: 'RH', desc: 'Relative humidity [-] (Air_ha moist air)' },
  { fn: 'wetbulb', lhs: 'T_wb', desc: 'Wet-bulb temperature [°C] (Air_ha moist air)' },
  { fn: 'dewpoint', lhs: 'T_dp', desc: 'Dew-point temperature [°C] (Air_ha moist air)' },
];

const STATE_PAIRS = [
  { label: 'T, P (Temperature & Pressure)', inputs: ['T', 'P'] },
  { label: 'P, h (Pressure & Enthalpy)', inputs: ['P', 'h'] },
  { label: 'P, s (Pressure & Entropy)', inputs: ['P', 's'] },
  { label: 'P, x (Pressure & Quality)', inputs: ['P', 'x'] },
  { label: 'T, x (Temperature & Quality)', inputs: ['T', 'x'] },
  { label: 'h, s (Enthalpy & Entropy)', inputs: ['h', 's'] },
  { label: 'T, v (Temperature & Volume)', inputs: ['T', 'v'] },
];

const DEFAULT_FLUIDS = [
  'Water', 'R134a', 'CO2', 'Air', 'Air_ha', 'Ammonia', 'NH3H2O',
  'Propane', 'R410A', 'R32', 'R1234yf', 'R1234ze', 'R245fa',
  'Nitrogen', 'Oxygen', 'Butane', 'Isobutane',
  'EG-20%', 'PG-30%', 'LiBr-20%', 'DowQ',
];

const MATH_FUNCTIONS = [
  { label: 'CALL psychprops(T, P, RH : ...)', snippet: 'CALL psychprops(T_1, P_1, RH_1 : T_out, v_1, h_1, s_1, u_1, W_1, R_1, T_wb, T_dp)', desc: 'Moist air psychrometric procedure (computes up to 9 state outputs)' },
  { label: 'CALL Colebrook(Re, RR : f)', snippet: 'CALL Colebrook(Re, eps_D : f)', desc: 'Darcy friction factor via implicit Colebrook-White correlation' },
  { label: "H_LIBR('SI', T, X) / X_LIBR / T_LIBR / P_LIBR", snippet: "h_1 = H_LIBR('SI', T_1, x_1)", desc: 'ASHRAE LiBr-H2O absorption solution routines (H_LIBR, X_LIBR, T_LIBR, P_LIBR)' },
  { label: 'convert(from, to)', snippet: "convert('kW', 'W')", desc: 'Unit conversion factor between two compatible units' },
  { label: 'converttemp(from, to, T)', snippet: "T_K = converttemp('C', 'K', T_C)", desc: 'Convert temperature value between C, K, F, and R scales' },
  { label: 'SUM(expr, i=1, N)', snippet: 'total = SUM(x[i], i=1, N)', desc: 'Indexed summation over array elements or expressions' },
  { label: 'CALL WARNING(msg$, val)', snippet: "CALL WARNING('Temperature exceeds limit: XXXA1', T_1)", desc: 'Emit non-fatal runtime warning (W001) inside a PROCEDURE' },
  { label: 'CALL ERROR(msg$, val)', snippet: "CALL ERROR('Invalid pressure: XXXA1', P_1)", desc: 'Halt calculation with a formatted error inside a PROCEDURE' },
  { label: 'sqrt(x) / exp(x) / ln(x) / log10(x)', snippet: 'sqrt(x)', desc: 'Elementary power, exponential, and logarithmic functions' },
  { label: 'sin(x) / cos(x) / tan(x) / arctan(x)', snippet: 'sin(theta)', desc: 'Trigonometric functions (degrees inCoolSolve)' },
  { label: 'min(a, b, ...) / max(a, b, ...) / abs(x)', snippet: 'min(a, b)', desc: 'Extrema and absolute value' },
];

const TABLE_INTEGRAL_FUNCTIONS = [
  { label: 'interpolate(Table, ColX, ColY, x)', snippet: "y = interpolate('Table1', 'ColX', 'ColY', x)", desc: '1D linear interpolation on a Lookup Table' },
  { label: 'interpolate2(Table, ColX, ColY, ColZ, x, y)', snippet: "z = interpolate2('Table1', 'ColX', 'ColY', 'ColZ', x, y)", desc: '2D bilinear surface interpolation on a Lookup Table' },
  { label: 'lookup(Table, Row, Col)', snippet: "val = lookup('Table1', 1, 'Col1')", desc: 'Read numeric cell at given row and column (interpolates non-integer rows)' },
  { label: 'lookup$(Table, Row, Col)', snippet: "name$ = lookup$('Table1', 1, 'Fluid')", desc: 'Read text/string cell at given row and column' },
  { label: 'lookup$row(Table, Col, Key)', snippet: "r = lookup$row('Table1', 'Col1', key)", desc: 'Find row index where Col holds string or numeric Key' },
  { label: 'sumlookup / avglookup / minlookup / maxlookup / stddevlookup', snippet: "s = sumlookup('Table1', 'Col1')", desc: 'Aggregate statistics over a Lookup Table column' },
  { label: 'nlookuprows(Table) / nlookupcolumns(Table)', snippet: "n = nlookuprows('Table1')", desc: 'Number of rows or columns in a Lookup Table' },
  { label: 'lookup(Table, Row, Col) = expr', snippet: "lookup('Table1', 1, 'Col1') = y", desc: 'Write solved value back into a Lookup Table cell' },
  { label: 'integral(dydt, t, t0, tf[, step])', snippet: 'y = y_0 + integral(dydt, t, 0, t_end)', desc: 'Equation-based ODE/DAE dynamic integration' },
  { label: '$IntegralTable directive', snippet: '$IntegralTable t: y, dydt', desc: 'Record trajectory columns during INTEGRAL evaluation' },
  { label: "integralvalue(t, 'var')", snippet: "y_mid = integralvalue(5.0, 'y')", desc: 'Interpolate a recorded variable from the Integral Table at time t' },
];

function FunctionInfoModal({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState<'thermo' | 'math' | 'tables'>('thermo');
  const [propIdx, setPropIdx] = useState(0);
  const [fluid, setFluid] = useState('Water');
  const [pairIdx, setPairIdx] = useState(0);
  const [suffix, setSuffix] = useState('1');
  const [selectedSnippet, setSelectedSnippet] = useState(MATH_FUNCTIONS[0].snippet);
  const [copied, setCopied] = useState(false);

  const prop = THERMO_PROPERTIES[propIdx];
  const pair = STATE_PAIRS[pairIdx];

  const preview = useMemo(() => {
    if (category !== 'thermo') return selectedSnippet;
    // Suffix lands in pasted equations: keep it a safe identifier fragment.
    const sfx = suffix.trim().replace(/[^A-Za-z0-9_]/g, '').slice(0, 20) ? `_${suffix.trim().replace(/[^A-Za-z0-9_]/g, '').slice(0, 20)}` : '';
    const fArg = /[-%]/.test(fluid) ? `'${fluid}'` : fluid;
    if (prop.fn === 'T_sat') return `T_sat${sfx} = T_sat(${fArg}, P=P${sfx})`;
    if (prop.fn === 'P_sat') return `P_sat${sfx} = P_sat(${fArg}, T=T${sfx})`;
    if (prop.fn === 'surfacetension') return `sigma${sfx} = surfacetension(${fArg}, T=T${sfx})`;
    if (fluid === 'Air_ha' || ['humrat', 'relhum', 'wetbulb', 'dewpoint'].includes(prop.fn)) {
      const third = prop.fn === 'relhum' ? `w=omega${sfx}` : `R=RH${sfx}`;
      return `${prop.lhs}${sfx} = ${prop.fn}(Air_ha, T=T${sfx}, P=P${sfx}, ${third})`;
    }
    if (fluid === 'NH3H2O') {
      return `${prop.lhs}${sfx} = ${prop.fn}(NH3H2O, T=T${sfx}, P=P${sfx}, x=x${sfx})`;
    }
    const args = pair.inputs.map((inp) => `${inp}=${inp}${sfx}`).join(', ');
    return `${prop.lhs}${sfx} = ${prop.fn}(${fArg}, ${args})`;
  }, [category, prop, fluid, pair, suffix, selectedSnippet]);

  const handlePaste = () => {
    insertAtCursor(preview + '\n');
    onClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(preview);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal-card modal-lg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>Function Information</span>
          <button className="icon-btn" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="modal-tabs">
          <button
            className={`modal-tab ${category === 'thermo' ? 'active' : ''}`}
            onClick={() => setCategory('thermo')}
            title="CoolProp & RefProp thermophysical property functions"
          >
            Thermophysical Properties
          </button>
          <button
            className={`modal-tab ${category === 'math' ? 'active' : ''}`}
            onClick={() => { setCategory('math'); setSelectedSnippet(MATH_FUNCTIONS[0].snippet); }}
            title="Trigonometric, logarithmic, hyperbolic & engineering math functions"
          >
            Math &amp; Engineering
          </button>
          <button
            className={`modal-tab ${category === 'tables' ? 'active' : ''}`}
            onClick={() => { setCategory('tables'); setSelectedSnippet(TABLE_INTEGRAL_FUNCTIONS[0].snippet); }}
            title="Lookup tables & numerical integration functions"
          >
            Lookup &amp; Integral
          </button>
        </div>

        <div className="modal-body">
          {category === 'thermo' ? (
            <div className="fn-grid">
              <div className="fn-col">
                <label className="fn-label">Property Function</label>
                <div className="fn-list">
                  {THERMO_PROPERTIES.map((p, i) => (
                    <button
                      key={p.fn}
                      className={`fn-list-item ${i === propIdx ? 'active' : ''}`}
                      onClick={() => setPropIdx(i)}
                    >
                      <code>{p.fn}</code>
                      <span>{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="fn-col">
                <label className="fn-label">Working Fluid</label>
                <select className="fn-select" value={fluid} onChange={(e) => setFluid(e.target.value)}>
                  {DEFAULT_FLUIDS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>

                <label className="fn-label" style={{ marginTop: 10 }}>Independent Properties</label>
                <select
                  className="fn-select"
                  value={pairIdx}
                  onChange={(e) => setPairIdx(Number(e.target.value))}
                  disabled={prop.fn === 'T_sat' || prop.fn === 'P_sat' || prop.fn === 'surfacetension'}
                >
                  {STATE_PAIRS.map((p, i) => (
                    <option key={p.label} value={i}>{p.label}</option>
                  ))}
                </select>

                <label className="fn-label" style={{ marginTop: 10 }}>State Point Subscript</label>
                <input
                  className="fn-input"
                  type="text"
                  value={suffix}
                  onChange={(e) => setSuffix(e.target.value)}
                  placeholder="e.g. 1, 2, in, out"
                />
              </div>
            </div>
          ) : (
            <div className="fn-list" style={{ maxHeight: 260 }}>
              {(category === 'math' ? MATH_FUNCTIONS : TABLE_INTEGRAL_FUNCTIONS).map((item) => (
                <button
                  key={item.label}
                  className={`fn-list-item ${selectedSnippet === item.snippet ? 'active' : ''}`}
                  onClick={() => setSelectedSnippet(item.snippet)}
                >
                  <code>{item.label}</code>
                  <span>{item.desc}</span>
                </button>
              ))}
            </div>
          )}

          <div className="fn-preview-box">
            <span className="fn-label">Statement Preview</span>
            <div className="fn-preview-row">
              <code className="fn-preview-code">{preview}</code>
              <button className="icon-btn" onClick={handleCopy} title="Copy to clipboard">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handlePaste}>Paste into Editor</button>
        </div>
      </div>
    </div>
  );
}

function UnitSystemModal({ onClose }: { onClose: () => void }) {
  const eescode = useModelStore((s) => s.eescode);
  const setEescode = useModelStore((s) => s.setEescode);
  const existingTokens = parseUnitSystemTokens(eescode);

  const pick = (opts: string[], fallback: string) =>
    opts.find((o) => existingTokens.some((t) => t.toLowerCase() === o.toLowerCase())) || fallback;

  const [temp, setTemp] = useState(() => pick(['C', 'K', 'F', 'R'], 'C'));
  const [press, setPress] = useState(() => pick(['Pa', 'kPa', 'bar', 'MPa', 'atm', 'psia'], 'kPa'));
  const [energy, setEnergy] = useState(() => pick(['J', 'kJ', 'cal', 'kcal', 'Btu'], 'kJ'));
  const [basis, setBasis] = useState(() => pick(['mass', 'molar'], 'mass'));
  const [trig, setTrig] = useState(() => pick(['deg', 'rad'], 'deg'));

  const directive = `$UnitSystem SI ${temp} ${press} ${energy} ${basis} ${trig}`;

  const handleApply = () => {
    let next: string;
    if (/^\s*\$UnitSystem\s+[^\r\n]+/im.test(eescode)) {
      next = eescode.replace(/^\s*\$UnitSystem\s+[^\r\n]+/im, directive);
    } else {
      next = `${directive}\n${eescode}`;
    }
    // Direct push (not debounced): drop any pending typing write first so a
    // stale timer cannot overwrite this directive change.
    useModelStore.getState().cancelPendingPuts();
    setEescode(next);
    api.putEescode(next).catch(() => {});
    onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>Unit System ($UnitSystem)</span>
          <button className="icon-btn" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="unit-grid">
            <label className="fn-label">Temperature</label>
            <div className="segmented-row">
              {['C', 'K', 'F', 'R'].map((u) => (
                <button key={u} className={`seg-btn ${temp === u ? 'active' : ''}`} onClick={() => setTemp(u)}>{u}</button>
              ))}
            </div>

            <label className="fn-label">Pressure</label>
            <div className="segmented-row">
              {['Pa', 'kPa', 'bar', 'MPa', 'atm', 'psia'].map((u) => (
                <button key={u} className={`seg-btn ${press === u ? 'active' : ''}`} onClick={() => setPress(u)}>{u}</button>
              ))}
            </div>

            <label className="fn-label">Energy</label>
            <div className="segmented-row">
              {['J', 'kJ', 'cal', 'kcal', 'Btu'].map((u) => (
                <button key={u} className={`seg-btn ${energy === u ? 'active' : ''}`} onClick={() => setEnergy(u)}>{u}</button>
              ))}
            </div>

            <label className="fn-label">Specific Basis</label>
            <div className="segmented-row">
              {['mass', 'molar'].map((u) => (
                <button key={u} className={`seg-btn ${basis === u ? 'active' : ''}`} onClick={() => setBasis(u)}>{u}</button>
              ))}
            </div>

            <label className="fn-label">Angles</label>
            <div className="segmented-row">
              {['deg', 'rad'].map((u) => (
                <button key={u} className={`seg-btn ${trig === u ? 'active' : ''}`} onClick={() => setTrig(u)}>{u}</button>
              ))}
            </div>
          </div>

          <div className="fn-preview-box" style={{ marginTop: 12 }}>
            <span className="fn-label">Directive</span>
            <code className="fn-preview-code">{directive}</code>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleApply}>Apply to Model</button>
        </div>
      </div>
    </div>
  );
}

const LEVEL_TITLES: Record<number, string> = {
  1: 'Level 1 · Introductory',
  2: 'Level 2 · Intermediate',
  3: 'Level 3 · Advanced',
  4: 'Level 4 · Research',
};

function LibraryModal({ onClose }: { onClose: () => void }) {
  const [menu, setMenu] = useState<LibraryMenuResponse | null>(null);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.getLibraryMenu().then((res) => {
      setMenu(res);
      if (res?.categories?.[0]) {
        setExpanded(new Set([res.categories[0].key]));
      }
    }).catch(() => setMenu(null));
  }, []);

  const q = query.trim().toLowerCase();
  const categories = useMemo(() => {
    if (!menu) return [];
    const matches = (m: LibraryMenuModel) =>
      !q || m.title.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q);
    if (!q) return menu.categories;
    const out: LibraryMenuCategory[] = [];
    for (const cat of menu.categories) {
      const models = cat.models.filter(matches);
      const children = cat.children
        .map((c) => ({ ...c, models: c.models.filter(matches) }))
        .filter((c) => c.models.length > 0);
      const count = models.length + children.reduce((n, c) => n + c.models.length, 0);
      if (count > 0) out.push({ ...cat, models, children, count });
    }
    return out;
  }, [menu, q]);

  const totalMatching = useMemo(() => {
    return categories.reduce((sum, c) => sum + c.count, 0);
  }, [categories]);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    if (!menu) return;
    const keys = new Set<string>();
    for (const cat of menu.categories) {
      keys.add(cat.key);
      for (const sub of cat.children) {
        keys.add(`${cat.key}/${sub.key}`);
      }
    }
    setExpanded(keys);
  };

  const collapseAll = () => setExpanded(new Set());

  const renderModel = (m: LibraryMenuModel) => (
    <div key={m.id} className="library-model">
      <button
        className="library-model-open"
        title={`${m.id} · ${LEVEL_TITLES[m.level] ?? ''} · ${m.kind}`}
        onClick={() => {
          onClose();
          openLibraryModel(m.id);
        }}
      >
        <FileCode size={13} className="library-file-icon" />
        <span className="library-model-title">{m.title}</span>
        <span className="library-model-id">{m.id}</span>
        <span className={`library-level level-${m.level}`} title={LEVEL_TITLES[m.level]}>
          L{m.level}
        </span>
      </button>
      <a
        className="library-model-info"
        href={libraryModelPageUrl(m.id)}
        target="_blank"
        rel="noopener noreferrer"
        title="Model documentation"
      >
        <ExternalLink size={12} />
      </a>
    </div>
  );

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal-card modal-lg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>CoolSolve Model Library</span>
          <button className="icon-btn" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body" style={{ padding: 0 }}>
          {!menu || !menu.available ? (
            <div className="library-empty">{menu?.reason ?? 'Loading library…'}</div>
          ) : (
            <>
              <div className="library-search">
                <Search size={13} className="library-search-icon" />
                <input
                  autoFocus
                  placeholder={`Search ${menu.total} verified models by topic, name, or ID…`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button className="library-search-clear" onClick={() => setQuery('')} title="Clear search">
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="library-tree-toolbar">
                <span className="library-tree-summary">{totalMatching} model{totalMatching !== 1 ? 's' : ''}</span>
                <div className="library-tree-actions">
                  <button type="button" onClick={expandAll}>Expand all</button>
                  <button type="button" onClick={collapseAll}>Collapse all</button>
                </div>
              </div>

              <div className="library-tree">
                {categories.length === 0 && (
                  <div className="library-empty">
                    {query ? `No model matches "${query}".` : 'No models found.'}
                  </div>
                )}
                {categories.map((cat) => {
                  const isCatOpen = !!q || expanded.has(cat.key);
                  return (
                    <div key={cat.key} className="library-category">
                      <button className="library-group-header" onClick={() => toggle(cat.key)}>
                        <ChevronRight size={13} className={`library-chevron ${isCatOpen ? 'open' : ''}`} />
                        {isCatOpen ? (
                          <FolderOpen size={14} className="library-folder-icon" />
                        ) : (
                          <Folder size={14} className="library-folder-icon" />
                        )}
                        <span className="library-group-title">{cat.title}</span>
                        <span className="library-count-pill">{cat.count}</span>
                      </button>

                      {isCatOpen && (
                        <div className="library-children">
                          {cat.models.map(renderModel)}
                          {cat.children.map((sub) => {
                            const subKey = `${cat.key}/${sub.key}`;
                            const isSubOpen = !!q || expanded.has(subKey);
                            return (
                              <div key={subKey} className="library-group depth-1">
                                <button className="library-group-header" onClick={() => toggle(subKey)}>
                                  <ChevronRight size={13} className={`library-chevron ${isSubOpen ? 'open' : ''}`} />
                                  {isSubOpen ? (
                                    <FolderOpen size={14} className="library-folder-icon" />
                                  ) : (
                                    <Folder size={14} className="library-folder-icon" />
                                  )}
                                  <span className="library-group-title">{sub.title}</span>
                                  <span className="library-count-pill">{sub.models.length}</span>
                                </button>
                                {isSubOpen && (
                                  <div className="library-children">
                                    {sub.models.map(renderModel)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <a className="library-footer" href={LIBRARY_DASHBOARD_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={13} /> Browse full online model dashboard
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>About CoolSolve-Canary</span>
          <button className="icon-btn" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body" style={{ gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            CoolSolve-Canary
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Experimental GUI fork of{' '}
            <a href="https://github.com/CoolProp/CoolSolve" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)' }}>
              CoolProp/CoolSolve
            </a>
            , originally created and developed by{' '}
            <a href="https://www.uliege.be/cms/c_9054334/en/directory?uid=U203754" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)' }}>
              <strong>Sylvain Quoilin</strong>
            </a>{' '}
            (<a href="https://www.ises.uliege.be/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)' }}>ISES Research Group</a>, Université de Liège) as part of the{' '}
            <a href="https://github.com/CoolProp/CoolProp" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)' }}>
              CoolProp
            </a>{' '}
            project. Released under the MIT License (Copyright (c) 2026 CoolProp).
          </p>
          <div className="shortcut-table">
            <div><span>Solve Model</span><kbd>F2</kbd> / <kbd>Ctrl+Enter</kbd></div>
            <div><span>Debug Solve</span><kbd>Ctrl+Shift+Enter</kbd></div>
            <div><span>Function Info</span><kbd>Ctrl+I</kbd></div>
            <div><span>Variable Info</span><kbd>F9</kbd></div>
            <div><span>Update Guesses</span><kbd>Ctrl+G</kbd></div>
            <div><span>Toggle &#123; &#125; Comment</span><kbd>Ctrl+/</kbd></div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export function AppModals() {
  const activeModal = useUIStore((s) => s.activeModal);
  const setActiveModal = useUIStore((s) => s.setActiveModal);

  useEffect(() => {
    if (!activeModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveModal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeModal, setActiveModal]);

  if (!activeModal) return null;
  const close = () => setActiveModal(null);

  switch (activeModal) {
    case 'functionInfo':
      return <FunctionInfoModal onClose={close} />;
    case 'unitSystem':
      return <UnitSystemModal onClose={close} />;
    case 'library':
      return <LibraryModal onClose={close} />;
    case 'settings':
      return <SettingsModal onClose={close} />;
    case 'stats':
      return (
        <div className="modal-backdrop" onMouseDown={close}>
          <div
            className="modal-card modal-lg"
            style={{ width: 'min(920px, 94vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <span>Solve Usage Statistics</span>
              <button className="icon-btn" onClick={close}><X size={14} /></button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', padding: 12 }}>
              <UsageStats />
            </div>
          </div>
        </div>
      );
    case 'about':
      return <AboutModal onClose={close} />;
    default:
      return null;
  }
}
