import { useState, useMemo, useCallback, useRef } from 'react';
import { useModelStore } from '../stores/modelStore';
import { api } from '../api/client';
import { parseKeyValueText, updateKeyValueLines } from '../utils/conf';
import { fmt } from '../stores/parametricStore';
import { buildOverrideMap, buildParsedMap, isImposedFromMap, resolveUnitFromMap } from '../utils/parsedUnits.ts';

/** CSS class for unit source color coding */
function unitSourceClass(source: string): string {
  switch (source) {
    case 'code':     return 'unit-code';
    case 'inferred': return 'unit-inferred';
    case 'user':     return 'unit-user';
    default:         return '';
  }
}

type FilterMode = 'all' | 'imposed' | 'with-units';

export default function VariableTable() {
  const [filter, setFilter] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  // Enter commits and unmounts the input, whose blur then fires with stale
  // props: ignore that trailing blur so one edit writes exactly once.
  const committedRef = useRef<string | null>(null);
  const lastResult = useModelStore((s) => s.lastResult);
  const initials = useModelStore((s) => s.initials);
  const setInitials = useModelStore((s) => s.setInitials);
  const parsedVariables = useModelStore((s) => s.parsedVariables);
  const userUnitOverrides = useModelStore((s) => s.userUnitOverrides);

  const initialsMap = useMemo(() => parseKeyValueText(initials), [initials]);
  const parsedMap = useMemo(() => buildParsedMap(parsedVariables), [parsedVariables]);
  const overrideMap = useMemo(() => buildOverrideMap(userUnitOverrides), [userUnitOverrides]);

  /** Get effective unit for a variable: user override > parsed */
  const getUnit = useCallback((name: string): { units: string; source: string } => {
    const r = resolveUnitFromMap(name, parsedMap, overrideMap);
    return { units: r.units, source: r.source };
  }, [parsedMap, overrideMap]);

  /** Check if a variable is imposed (var = constant) */
  const isImposed = useCallback((name: string): boolean => {
    return isImposedFromMap(name, parsedMap);
  }, [parsedMap]);

  const variables = useMemo(() => {
    if (!lastResult) {
      if (initialsMap.size === 0) return [];
      const vars: { name: string; value: string; initial: string; isArray: boolean; isString: boolean }[] = [];
      for (const [name, val] of initialsMap) {
        vars.push({ name, value: '', initial: val, isArray: name.includes('['), isString: false });
      }
      vars.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      return vars;
    }

    const vars: { name: string; value: string; initial: string; isArray: boolean; isString: boolean }[] = [];

    for (const [name, val] of Object.entries(lastResult.variables)) {
      vars.push({
        name,
        value: fmt(val),
        initial: initialsMap.get(name) ?? '',
        isArray: name.includes('['),
        isString: false,
      });
    }

    for (const [name, val] of Object.entries(lastResult.stringVariables)) {
      vars.push({
        name,
        value: `'${val}'`,
        initial: '',
        isArray: false,
        isString: true,
      });
    }

    vars.sort((a, b) => {
      if (a.isArray !== b.isArray) return a.isArray ? 1 : -1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    return vars;
  }, [lastResult, initialsMap]);

  const filtered = useMemo(() => {
    let result = variables;

    // Apply filter mode
    if (filterMode === 'imposed') {
      result = result.filter((v) => isImposed(v.name));
    } else if (filterMode === 'with-units') {
      result = result.filter((v) => getUnit(v.name).units !== '');
    }

    // Apply text filter
    if (filter) {
      const lower = filter.toLowerCase();
      result = result.filter((v) => v.name.toLowerCase().includes(lower));
    }

    return result;
  }, [variables, filter, filterMode, isImposed, getUnit]);

  const handleInitialClick = useCallback((name: string, current: string) => {
    committedRef.current = null;
    setEditingCell(name);
    setEditValue(current);
  }, []);

  const commitEdit = useCallback((name: string) => {
    if (committedRef.current === name) return;
    committedRef.current = name;
    setEditingCell(null);
    const trimmed = editValue.trim();
    const newText = updateKeyValueLines(initials, { [name]: trimmed || undefined });
    setInitials(newText);
    api.putInitials(newText).catch((err) =>
      useModelStore.getState().addConsoleLine(`>>> ERROR saving guesses: ${err instanceof Error ? err.message : String(err)}`)
    );
  }, [editValue, initials, setInitials]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, name: string) => {
    if (e.key === 'Enter') {
      commitEdit(name);
    } else if (e.key === 'Escape') {
      // Mark committed so the unmount blur does not write back the edit.
      committedRef.current = name;
      setEditingCell(null);
    }
  }, [commitEdit]);

  // Count imposed variables for the badge
  const imposedCount = useMemo(
    () => variables.filter((v) => isImposed(v.name)).length,
    [variables, isImposed]
  );

  return (
    <div className="variable-table-view">
      <div className="search-filter">
        <input
          type="text"
          placeholder="Filter variables..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="filter-mode-bar">
          <button
            className={`filter-mode-btn ${filterMode === 'all' ? 'active' : ''}`}
            onClick={() => setFilterMode('all')}
          >All</button>
          <button
            className={`filter-mode-btn ${filterMode === 'imposed' ? 'active' : ''}`}
            onClick={() => setFilterMode('imposed')}
            title="Show only imposed variables (candidates for parametric study)"
          >Imposed {imposedCount > 0 && <span className="badge">{imposedCount}</span>}</button>
          <button
            className={`filter-mode-btn ${filterMode === 'with-units' ? 'active' : ''}`}
            onClick={() => setFilterMode('with-units')}
          >With Units</button>
        </div>
      </div>
      <div className="variable-table-container">
        {variables.length === 0 ? (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>
            No solve result yet. Click <strong>Solve</strong> to compute variable values.
          </div>
        ) : (
          <table className="variable-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="unit-col">Units</th>
                <th style={{ textAlign: 'right' }}>Initial</th>
                <th style={{ textAlign: 'right' }}>Value</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => {
                const unit = getUnit(v.name);
                const imposed = isImposed(v.name);
                return (
                  <tr key={v.name} className={imposed ? 'imposed-row' : ''}>
                    <td>
                      {v.name}
                      {imposed && <span className="imposed-badge" title="Imposed (variable = constant)">⊕</span>}
                    </td>
                    <td className={`unit-cell ${unitSourceClass(unit.source)}`}>
                      {unit.units || '—'}
                    </td>
                    <td
                      className="value-cell initial-cell"
                      onClick={() => handleInitialClick(v.name, v.initial)}
                    >
                      {editingCell === v.name ? (
                        <input
                          className="initial-input"
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => commitEdit(v.name)}
                          onKeyDown={(e) => handleKeyDown(e, v.name)}
                          autoFocus
                        />
                      ) : (
                        <span className="initial-value">{v.initial || '—'}</span>
                      )}
                    </td>
                    <td className="value-cell solved">{v.value}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {variables.length > 0 && (
        <div className="table-footer-status">
          {filtered.length} of {variables.length} variables
          {imposedCount > 0 && ` · ${imposedCount} imposed`}
        </div>
      )}
    </div>
  );
}
