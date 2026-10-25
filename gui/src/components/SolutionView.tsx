import { useState, useMemo, useCallback, useEffect } from 'react';
import { Star, X } from 'lucide-react';
import { useModelStore } from '../stores/modelStore';
import { UNIT_TABLE, convertUnits, formatPrettyUnit, formatSolNumber } from '../utils/solutionFormat.ts';
import { buildOverrideMap, buildParsedMap, resolveUnitFromMap } from '../utils/parsedUnits.ts';
import { parseUnitSystemString } from '../utils/unitSystem.ts';

const GREEK_MAP: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ',
  epsilon: 'ε', eps: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', Theta: 'Θ',
  iota: 'ι', kappa: 'κ', lambda: 'λ', Lambda: 'Λ', mu: 'μ', nu: 'ν',
  xi: 'ξ', pi: 'π', Pi: 'Π', rho: 'ρ', sigma: 'σ', Sigma: 'Σ',
  tau: 'τ', upsilon: 'υ', phi: 'φ', Phi: 'Φ', chi: 'χ', psi: 'ψ',
  Psi: 'Ψ', omega: 'ω', Omega: 'Ω',
};


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

function loadMeta(tabId: string, modelName: string): Record<string, VarMeta> {
  try {
    const raw =
      localStorage.getItem(`${META_STORAGE_KEY}:${tabId}`) ||
      localStorage.getItem(`${META_STORAGE_KEY}:${tabId}:${modelName || 'untitled'}`) ||
      localStorage.getItem(`${META_STORAGE_KEY}:${tabId}:untitled`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function SolutionView() {
  const [subTab, setSubTab] = useState<'main' | 'key'>('main');
  // Star/comment/alt-unit settings are keyed by tab id so two untitled tabs
  // never share one bucket and renaming a tab or saving a bundle under a new
  // name never orphans the settings.
  const activeTabId = useModelStore((s) => s.activeTabId);
  const storageKey = `${META_STORAGE_KEY}:${activeTabId}`;
  const [metaMap, setMetaMap] = useState<Record<string, VarMeta>>(() =>
    loadMeta(activeTabId, useModelStore.getState().modelName)
  );
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
    setMetaMap(loadMeta(activeTabId, useModelStore.getState().modelName));
  }, [activeTabId]);

  useEffect(() => {
    try {
      if (Object.keys(metaMap).length === 0) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, JSON.stringify(metaMap));
      }
    } catch {
      // Storage unavailable or quota exceeded
    }
  }, [metaMap, storageKey]);

  const unitSystemStr = useMemo(() => parseUnitSystemString(eescode), [eescode]);

  const parsedMap = useMemo(() => buildParsedMap(parsedVariables), [parsedVariables]);
  const overrideMap = useMemo(() => buildOverrideMap(userUnitOverrides), [userUnitOverrides]);

  const getUnit = useCallback(
    (name: string): string => resolveUnitFromMap(name, parsedMap, overrideMap).units,
    [parsedMap, overrideMap]
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
      (k) => UNIT_TABLE[k].dim === entry.dim && k !== u
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
    const u = unitDraft.trim();
    setUserUnit(editingVar, u);
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
