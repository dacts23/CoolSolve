import React, { useState, useCallback, useRef } from 'react';
import ConfirmModal from './ConfirmModal';
import SyntaxFooter from './SyntaxFooter';
import { api } from '../api/client';
import { useModelStore } from '../stores/modelStore';
import { downloadCsv } from '../utils/csv';
import { Plus, Minus, Upload, Download, Save, Trash2 } from 'lucide-react';

// ============================================================================
// Helpers
// ============================================================================

function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  const lines = csv.split(/\r?\n/);
  for (const line of lines) {
    if (line.trim() === '') continue;
    // Simple CSV parser: handles quoted fields
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    rows.push(cells);
  }
  return rows;
}

function serializeCSV(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => (cell.includes(',') || cell.includes('"') ? `"${cell.replace(/"/g, '""')}"` : cell))
        .join(',')
    )
    .join('\n');
}

// ============================================================================
// TableGrid: editable grid for one table
// ============================================================================

interface TableGridProps {
  tableName: string;
  onSaved?: () => void;
}

function TableGrid({ tableName, onSaved }: TableGridProps) {
  const lookupTableCSVs = useModelStore((s) => s.lookupTableCSVs);
  const setLookupTableCSV = useModelStore((s) => s.setLookupTableCSV);

  const rawCSV = lookupTableCSVs[tableName] ?? '';
  const [rows, setRows] = useState<string[][]>(() => {
    const parsed = parseCSV(rawCSV);
    // Ensure at least 1 header row + 2 data rows and 2 columns
    if (parsed.length === 0) return [['Column1', 'Column2'], ['', ''], ['', '']];
    return parsed;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setCell = (r: number, c: number, val: string) => {
    setRows((prev) => {
      const next = prev.map((row) => [...row]);
      next[r][c] = val;
      return next;
    });
  };

  const addRow = () =>
    setRows((prev) => [...prev, Array(prev[0]?.length ?? 1).fill('')]);

  const addColumn = () =>
    setRows((prev) => prev.map((row, i) => [...row, i === 0 ? `Column${row.length + 1}` : '']));

  const gridContainerRef = useRef<HTMLDivElement>(null);

  const focusCell = useCallback((r: number, c: number, selectAll = true) => {
    const el = gridContainerRef.current?.querySelector<HTMLInputElement>(
      `input[data-row="${r}"][data-col="${c}"]`
    );
    if (el) {
      el.focus();
      if (selectAll) {
        el.select();
      }
    }
  }, []);

  const [lastFocusedCell, setLastFocusedCell] = useState<{ r: number; c: number } | null>(null);

  const deleteRow = useCallback((r: number) => {
    if (r === 0 || rows.length <= 2) return; // keep header + at least 1 data row
    setRows((prev) => prev.filter((_, i) => i !== r));
    const nextRow = Math.min(r, rows.length - 2);
    const col = lastFocusedCell?.c ?? 0;
    setTimeout(() => focusCell(nextRow, col), 0);
  }, [rows.length, lastFocusedCell, focusCell]);

  const deleteColumn = useCallback((c: number) => {
    if (rows[0]?.length <= 1) return; // keep at least 1 column
    setRows((prev) => prev.map((row) => row.filter((_, i) => i !== c)));
    const nextCol = Math.min(c, (rows[0]?.length ?? 2) - 2);
    const row = lastFocusedCell?.r ?? 0;
    setTimeout(() => focusCell(row, nextCol), 0);
  }, [rows, lastFocusedCell, focusCell]);

  const handleRemoveRow = () => {
    if (rows.length <= 2) return;
    const targetRow = (lastFocusedCell && lastFocusedCell.r > 0 && lastFocusedCell.r < rows.length)
      ? lastFocusedCell.r
      : rows.length - 1;
    deleteRow(targetRow);
  };

  const handleRemoveColumn = () => {
    if (numCols <= 1) return;
    const targetCol = (lastFocusedCell && lastFocusedCell.c >= 0 && lastFocusedCell.c < numCols)
      ? lastFocusedCell.c
      : numCols - 1;
    deleteColumn(targetCol);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const csv = serializeCSV(rows);
      await api.putTable(tableName, csv);
      setLookupTableCSV(tableName, csv);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    const input = e.currentTarget;
    const numRows = rows.length;

    if (e.key === 'Backspace' && input.value === '' && r > 1 && r === numRows - 1) {
      const currentRow = rows[r];
      const isRowEmpty = currentRow.every((cell) => !cell || cell.trim() === '');
      if (isRowEmpty && numRows > 2) {
        e.preventDefault();
        deleteRow(r);
        return;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        if (r > 0) focusCell(r - 1, c);
      } else {
        if (r < numRows - 1) {
          focusCell(r + 1, c);
        } else {
          // On last row, press Enter to append a new row and focus it (like Excel)
          setRows((prev) => [...prev, Array(prev[0]?.length ?? 1).fill('')]);
          setTimeout(() => focusCell(numRows, c), 0);
        }
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      if (r < numRows - 1) {
        e.preventDefault();
        focusCell(r + 1, c);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      if (r > 0) {
        e.preventDefault();
        focusCell(r - 1, c);
      }
      return;
    }

    if (e.key === 'ArrowRight') {
      const isAtEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
      const isAllSelected = input.selectionStart === 0 && input.selectionEnd === input.value.length;
      if ((isAtEnd || isAllSelected) && c < numCols - 1) {
        e.preventDefault();
        focusCell(r, c + 1);
      }
      return;
    }

    if (e.key === 'ArrowLeft') {
      const isAtStart = input.selectionStart === 0 && input.selectionEnd === 0;
      const isAllSelected = input.selectionStart === 0 && input.selectionEnd === input.value.length;
      if ((isAtStart || isAllSelected) && c > 0) {
        e.preventDefault();
        focusCell(r, c - 1);
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        if (c > 0) {
          focusCell(r, c - 1);
        } else if (r > 0) {
          focusCell(r - 1, numCols - 1);
        }
      } else {
        if (c < numCols - 1) {
          focusCell(r, c + 1);
        } else if (r < numRows - 1) {
          focusCell(r + 1, 0);
        } else {
          setRows((prev) => [...prev, Array(prev[0]?.length ?? 1).fill('')]);
          setTimeout(() => focusCell(numRows, 0), 0);
        }
      }
      return;
    }
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length > 0) setRows(parsed);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportCSV = async () => {
    const csv = serializeCSV(rows);
    await downloadCsv(`${tableName}.csv`, csv);
  };

  const numCols = rows[0]?.length ?? 0;

  return (
    <div className="table-editor-container">
      {/* Controls to a top bar, like other panels */}
      <div className="table-editor-toolbar">
        {/* Row controls: label left of button group, buttons are just + and - */}
        <div className="table-control-unit">
          <span className="table-unit-label">Rows</span>
          <div className="table-btn-group">
            <button className="table-btn-pill icon-only" onClick={addRow} title="Add row at bottom">
              <Plus size={11} />
            </button>
            <button className="table-btn-pill icon-only" onClick={handleRemoveRow} disabled={rows.length <= 2} title="Remove bottom row">
              <Minus size={11} />
            </button>
          </div>
        </div>

        {/* Column controls: label left of button group, buttons are just + and - */}
        <div className="table-control-unit">
          <span className="table-unit-label">Cols</span>
          <div className="table-btn-group">
            <button className="table-btn-pill icon-only" onClick={addColumn} title="Add column at right">
              <Plus size={11} />
            </button>
            <button className="table-btn-pill icon-only" onClick={handleRemoveColumn} disabled={numCols <= 1} title="Remove rightmost column">
              <Minus size={11} />
            </button>
          </div>
        </div>

        <div className="table-toolbar-divider" />

        {/* File Transfer */}
        <div className="table-btn-group">
          <label className="table-btn-pill" style={{ cursor: 'pointer' }} title="Import CSV file">
            <Upload size={11} /> Import CSV
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImportCSV} />
          </label>
          <button className="table-btn-pill" onClick={handleExportCSV} title="Export table to CSV">
            <Download size={11} /> Export CSV
          </button>
        </div>

        <div style={{ flex: 1 }} />

        {error && (
          <span style={{ color: 'var(--error-color)', fontSize: 11, marginRight: 8, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={error}>
            {error}
          </span>
        )}

        <button className="table-save-btn" onClick={handleSave} disabled={saving} title="Save changes">
          <Save size={12} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Title above table, not in any panel */}
      <div className="table-inline-header">
        <h2 className="table-inline-title">{tableName}</h2>
        <span className="table-meta-badge">{rows.length - 1} rows · {numCols} cols</span>
      </div>

      {/* Grid */}
      <div ref={gridContainerRef} style={{ flex: 1, overflow: 'auto', background: 'var(--bg-primary)' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed', minWidth: '100%', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={{ width: 44, textAlign: 'center', color: 'var(--text-muted)', fontSize: 10, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', userSelect: 'none' }}>#</th>
              {Array.from({ length: numCols }).map((_, c) => (
                <th key={c} style={{ border: '1px solid var(--border-color)', padding: '3px 6px', background: 'var(--bg-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      data-row={0}
                      data-col={c}
                      className="table-grid-cell"
                      value={rows[0]?.[c] ?? ''}
                      onChange={(e) => setCell(0, c, e.target.value)}
                      onFocus={() => setLastFocusedCell({ r: 0, c })}
                      onKeyDown={(e) => handleKeyDown(e, 0, c)}
                      style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontWeight: 600, fontSize: 12, outline: 'none', padding: '3px 4px', borderRadius: 3 }}
                    />
                    {numCols > 1 && (
                      <button
                        className="grid-del-btn"
                        onClick={() => deleteColumn(c)}
                        tabIndex={-1}
                        title={`Delete column ${rows[0]?.[c] || c + 1}`}
                      >×</button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(1).map((row, ri) => (
              <tr key={ri + 1}>
                <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, border: '1px solid var(--border-color)', width: 44, background: 'var(--bg-secondary)', userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '0 2px' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 14 }}>{ri + 1}</span>
                    {rows.length > 2 && (
                      <button
                        className="grid-del-btn"
                        onClick={() => deleteRow(ri + 1)}
                        tabIndex={-1}
                        title={`Delete row ${ri + 1}`}
                      >×</button>
                    )}
                  </div>
                </td>
                {Array.from({ length: numCols }).map((_, c) => (
                  <td key={c} style={{ border: '1px solid var(--border-color)', padding: 0 }}>
                    <input
                      data-row={ri + 1}
                      data-col={c}
                      className="table-grid-cell"
                      value={row[c] ?? ''}
                      onChange={(e) => setCell(ri + 1, c, e.target.value)}
                      onFocus={() => setLastFocusedCell({ r: ri + 1, c })}
                      onKeyDown={(e) => handleKeyDown(e, ri + 1, c)}
                      style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 12, padding: '3px 6px', outline: 'none', boxSizing: 'border-box', borderRadius: 2 }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SyntaxFooter
        items={[
          { code: `LOOKUP('${tableName}', row, col)` },
          { code: `INTERPOLATE('${tableName}', '${rows[0]?.[0] || 'xcol'}', '${rows[0]?.[1] || 'ycol'}', xval)` },
        ]}
        fileHint={`<model>-${tableName}.csv`}
      />
    </div>
  );
}

// ============================================================================
// LookupTableEditor: list of tables + optional grid view
// ============================================================================

export default function LookupTableEditor() {
  const [tableToDelete, setTableToDelete] = useState<string | null>(null);
  const lookupTables = useModelStore((s) => s.lookupTables);
  const lookupTableCSVs = useModelStore((s) => s.lookupTableCSVs);
  const setLookupTables = useModelStore((s) => s.setLookupTables);
  const setLookupTableCSV = useModelStore((s) => s.setLookupTableCSV);
  const removeLookupTable = useModelStore((s) => s.removeLookupTable);

  const selectedTable = useModelStore((s) => s.selectedLookupTable);
  const setSelectedTable = useModelStore((s) => s.setSelectedLookupTable);
  const [error, setError] = useState<string | null>(null);

  // Auto-fetch CSV if selectedTable is set from sidebar
  React.useEffect(() => {
    if (selectedTable && !lookupTableCSVs[selectedTable]) {
      api.getTableCSV(selectedTable)
        .then((csv) => setLookupTableCSV(selectedTable, csv))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    }
  }, [selectedTable, lookupTableCSVs, setLookupTableCSV]);

  // Refresh table list from server
  const refreshTables = useCallback(async () => {
    try {
      const resp = await api.getTables();
      setLookupTables(resp.tables);
    } catch {
      // Non-fatal; list may be stale
    }
  }, [setLookupTables]);

  // Open a table (fetch CSV if not cached)
  const openTable = useCallback(async (name: string) => {
    if (!lookupTableCSVs[name]) {
      try {
        const csv = await api.getTableCSV(name);
        setLookupTableCSV(name, csv);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return;
      }
    }
    setSelectedTable(name);
  }, [lookupTableCSVs, setLookupTableCSV]);

  const confirmDeleteTable = async () => {
    if (!tableToDelete) return;
    const name = tableToDelete;
    setTableToDelete(null);
    try {
      await api.deleteTable(name);
      removeLookupTable(name);
      if (selectedTable === name) setSelectedTable(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // If editing a table, show the grid
  if (selectedTable !== null) {
    return (
      <TableGrid
        tableName={selectedTable}
        onSaved={() => { refreshTables(); }}
      />
    );
  }

  return (
    <div className="table-editor-container">
      <div className="table-title-header">
        <div className="table-title-display">
          <h2 className="table-main-title">Lookup Tables</h2>
          <span className="table-meta-badge">{lookupTables.length} tables</span>
        </div>
      </div>

      {error && <div style={{ color: 'var(--error-color)', fontSize: 12, padding: '0 14px 8px 14px' }}>{error}</div>}

      {/* Table list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 14px 14px 14px' }}>
        {lookupTables.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, paddingTop: 20, textAlign: 'center' }}>
            No lookup tables yet. Create one using <strong>NEW TABLE</strong> in the sidebar.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ color: 'var(--text-secondary)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '6px 8px' }}>Name</th>
                <th style={{ padding: '6px 8px' }}>Rows</th>
                <th style={{ padding: '6px 8px' }}>Columns</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {lookupTables.map((tbl) => (
                <tr
                  key={tbl.name}
                  onClick={() => openTable(tbl.name)}
                  style={{ cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}
                  className="lookup-table-row"
                >
                  <td style={{ padding: '6px 8px', color: 'var(--accent-color)', fontWeight: 500 }}>{tbl.name}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--text-primary)' }}>{tbl.rows}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{tbl.columns.join(', ')}</td>
                  <td style={{ padding: '6px 8px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setTableToDelete(tbl.name); }}
                      className="icon-btn small"
                      style={{ opacity: 0.7 }}
                      title="Delete table"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <SyntaxFooter
        items={[
          { code: "LOOKUP('tablename', row, col)" },
          { code: "INTERPOLATE('tablename', 'xcol', 'ycol', xval)" },
        ]}
        fileHint="<model>-<tablename>.csv"
      />

      {tableToDelete && (
        <ConfirmModal
          title="Delete Lookup Table"
          message={`Are you sure you want to delete lookup table "${tableToDelete}"? This action cannot be undone.`}
          confirmLabel="Delete Table"
          onConfirm={confirmDeleteTable}
          onCancel={() => setTableToDelete(null)}
        />
      )}
    </div>
  );
}
