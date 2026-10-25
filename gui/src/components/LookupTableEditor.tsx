import React, { useState, useCallback, useRef } from 'react';
import ConfirmModal from './ConfirmModal';
import SyntaxFooter from './SyntaxFooter';
import { api } from '../api/client';
import { useModelStore } from '../stores/modelStore';
import { downloadCsv, normalizeGridRows, parseCSV, safeSpreadsheetCell, sanitizeFilename, serializeCSV } from '../utils/csv';
import { TABLE_PAGE_SIZE } from '../utils/paging.ts';
import { EmptyState, TablePager } from './SetupShell';
import { Plus, Minus, Upload, Download, Save, Trash2, Copy, Check, Table2 } from 'lucide-react';

// ============================================================================
// TableGrid: editable grid for one table
// ============================================================================

// Thousands of rows would mount one <input> per cell: show 200 data rows
// per page. data-row/data-col stay absolute so edits and focus still work.
const GRID_PAGE_SIZE = TABLE_PAGE_SIZE;

interface TableGridProps {
  tableName: string;
  onSaved?: () => void;
}

function TableGrid({ tableName, onSaved }: TableGridProps) {
  const lookupTableCSVs = useModelStore((s) => s.lookupTableCSVs);
  const setLookupTableCSV = useModelStore((s) => s.setLookupTableCSV);
  const setLookupTableDirty = useModelStore((s) => s.setLookupTableDirty);

  const rawCSV = lookupTableCSVs[tableName] ?? '';
  const [parseFailed, setParseFailed] = useState(() => {
    if (!rawCSV) return false;
    try {
      parseCSV(rawCSV);
      return false;
    } catch {
      return true;
    }
  });
  const [rows, setRows] = useState<string[][]>(() => {
    try {
      const parsed = parseCSV(rawCSV);
      // Ensure at least 1 header row + 2 data rows and 2 columns
      if (parsed.length === 0) return [['Column1', 'Column2'], ['', ''], ['', '']];
      return normalizeGridRows(parsed);
    } catch {
      return [['Column1', 'Column2'], ['', ''], ['', '']];
    }
  });

  // Any cell edit marks the grid dirty (uncommitted work). The async CSV load
  // below keeps plain setRows: it is not an edit.
  const editRows = useCallback(
    (updater: React.SetStateAction<string[][]>) => {
      setRows(updater);
      setLookupTableDirty(true);
    },
    [setLookupTableDirty]
  );

  // Sync rows if rawCSV loads asynchronously from the backend — but never over
  // cell edits the user already made while the load was in flight.
  React.useEffect(() => {
    if (rawCSV && !useModelStore.getState().lookupTableDirty) {
      try {
        const parsed = parseCSV(rawCSV);
        if (parsed.length > 0) setRows(normalizeGridRows(parsed));
        setParseFailed(false);
      } catch {
        setParseFailed(true);
        setError('Stored table is not valid CSV and was not loaded.');
      }
    }
  }, [rawCSV]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(parseFailed ? 'Stored table is not valid CSV and was not loaded.' : null);

  const setCell = (r: number, c: number, val: string) => {
    editRows((prev) => {
      const next = prev.map((row) => [...row]);
      next[r][c] = val;
      return next;
    });
  };

  const addRow = () =>
    editRows((prev) => [...prev, Array(prev[0]?.length ?? 1).fill('')]);

  const addColumn = () =>
    editRows((prev) => {
      // Never reuse a header: ColumnN+1 can collide after delete+add.
      const used = new Set(prev[0] ?? []);
      let n = (prev[0]?.length ?? 0) + 1;
      while (used.has(`Column${n}`)) n++;
      return prev.map((row, i) => [...row, i === 0 ? `Column${n}` : '']);
    });

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

  const [gridPage, setGridPage] = useState(0);
  const totalGridPages = Math.max(1, Math.ceil(Math.max(1, rows.length - 1) / GRID_PAGE_SIZE));
  const safeGridPage = Math.min(gridPage, totalGridPages - 1);

  // Focus a cell by absolute row, switching grid pages when needed.
  const goToCell = useCallback((r: number, c: number, selectAll = true) => {
    const targetPage = Math.max(0, Math.floor((r - 1) / GRID_PAGE_SIZE));
    if (targetPage !== gridPage) {
      setGridPage(targetPage);
      setTimeout(() => focusCell(r, c, selectAll), 0);
    } else {
      focusCell(r, c, selectAll);
    }
  }, [gridPage, focusCell]);

  const deleteRow = useCallback((r: number) => {
    if (r === 0 || rows.length <= 2) return; // keep header + at least 1 data row
    editRows((prev) => prev.filter((_, i) => i !== r));
    const nextRow = Math.min(r, rows.length - 2);
    const col = lastFocusedCell?.c ?? 0;
    setTimeout(() => goToCell(nextRow, col), 0);
  }, [rows.length, lastFocusedCell, goToCell, editRows]);

  const deleteColumn = useCallback((c: number) => {
    if (rows[0]?.length <= 1) return; // keep at least 1 column
    editRows((prev) => prev.map((row) => row.filter((_, i) => i !== c)));
    const nextCol = Math.min(c, (rows[0]?.length ?? 2) - 2);
    const row = lastFocusedCell?.r ?? 0;
    setTimeout(() => goToCell(row, nextCol), 0);
  }, [rows, lastFocusedCell, goToCell, editRows]);

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
      setLookupTableDirty(false);
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
        if (r > 0) goToCell(r - 1, c);
      } else {
        if (r < numRows - 1) {
          goToCell(r + 1, c);
        } else {
          // On last row, press Enter to append a new row and focus it (like Excel)
          editRows((prev) => [...prev, Array(prev[0]?.length ?? 1).fill('')]);
          setTimeout(() => goToCell(numRows, c), 0);
        }
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      if (r < numRows - 1) {
        e.preventDefault();
        goToCell(r + 1, c);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      if (r > 0) {
        e.preventDefault();
        goToCell(r - 1, c);
      }
      return;
    }

    if (e.key === 'ArrowRight') {
      const isAtEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
      const isAllSelected = input.selectionStart === 0 && input.selectionEnd === input.value.length;
      if ((isAtEnd || isAllSelected) && c < numCols - 1) {
        e.preventDefault();
        goToCell(r, c + 1);
      }
      return;
    }

    if (e.key === 'ArrowLeft') {
      const isAtStart = input.selectionStart === 0 && input.selectionEnd === 0;
      const isAllSelected = input.selectionStart === 0 && input.selectionEnd === input.value.length;
      if ((isAtStart || isAllSelected) && c > 0) {
        e.preventDefault();
        goToCell(r, c - 1);
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        if (c > 0) {
          goToCell(r, c - 1);
        } else if (r > 0) {
          goToCell(r - 1, numCols - 1);
        }
      } else {
        if (c < numCols - 1) {
          goToCell(r, c + 1);
        } else if (r < numRows - 1) {
          goToCell(r + 1, 0);
        } else {
          editRows((prev) => [...prev, Array(prev[0]?.length ?? 1).fill('')]);
          setTimeout(() => goToCell(numRows, 0), 0);
        }
      }
      return;
    }
  };

  // Each cell is an <input>: cap the import so the grid stays editable.
  const MAX_IMPORT_ROWS = 2000;
  const MAX_IMPORT_COLS = 50;

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('Import file exceeds the 10 MB limit.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      let parsed: string[][];
      try {
        parsed = parseCSV(text);
      } catch (err) {
        setError(err instanceof Error ? `Import failed: ${err.message}` : 'Import failed: not valid CSV.');
        return;
      }
      if (parsed.length === 0) return;
      const cols = Math.max(...parsed.map((r) => r.length));
      if (parsed.length > MAX_IMPORT_ROWS || cols > MAX_IMPORT_COLS) {
        setError(`Import is ${parsed.length} x ${cols}: capped at ${MAX_IMPORT_ROWS} rows x ${MAX_IMPORT_COLS} columns.`);
        return;
      }
      editRows(normalizeGridRows(parsed));
      setParseFailed(false);
      setError(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportCSV = async () => {
    // Prefix Excel-formula cells so opening the CSV never runs code, but keep valid numbers intact.
    const safe = rows.map((r) => r.map(safeSpreadsheetCell));
    const csv = serializeCSV(safe);
    await downloadCsv(sanitizeFilename(`${tableName}.csv`), csv);
  };

  const [copiedTsv, setCopiedTsv] = useState(false);
  const handleCopyTSV = async () => {
    const escTsv = (c: string) => {
      // TSV has no quoting: replace tabs/newlines so paste keeps columns.
      const t = c.replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
      return safeSpreadsheetCell(t);
    };
    const tsv = rows.map((r) => r.map(escTsv).join('\t')).join('\n');
    try {
      await navigator.clipboard.writeText(tsv);
      setCopiedTsv(true);
      setTimeout(() => setCopiedTsv(false), 1200);
    } catch {
      setError('Copy failed: the clipboard is unavailable.');
    }
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
            <button className="table-btn-pill icon-only" onClick={handleRemoveRow} disabled={rows.length <= 2} title="Remove selected or bottom row">
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
            <button className="table-btn-pill icon-only" onClick={handleRemoveColumn} disabled={numCols <= 1} title="Remove selected or rightmost column">
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
          <button className="table-btn-pill" onClick={handleCopyTSV} title="Copy table as TSV (paste into Excel)">
            {copiedTsv ? <Check size={11} /> : <Copy size={11} />} {copiedTsv ? 'Copied' : 'Copy TSV'}
          </button>
        </div>

        <div style={{ flex: 1 }} />

        {error && (
          <span style={{ color: 'var(--error-color)', fontSize: 11, marginRight: 8, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={error}>
            {error}
          </span>
        )}

        <button className="table-save-btn" onClick={handleSave} disabled={saving || parseFailed} title={parseFailed ? 'Stored table failed to load — re-import before saving' : 'Save changes'}>
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
            {rows.slice(1 + safeGridPage * GRID_PAGE_SIZE, 1 + (safeGridPage + 1) * GRID_PAGE_SIZE).map((row, pi) => {
              const ri = safeGridPage * GRID_PAGE_SIZE + pi;
              return (
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
              );
            })}
          </tbody>
        </table>
      </div>

      <TablePager
        page={safeGridPage}
        totalPages={totalGridPages}
        onPageChange={setGridPage}
        label={`Rows ${safeGridPage * GRID_PAGE_SIZE + 1}–${Math.min(rows.length - 1, (safeGridPage + 1) * GRID_PAGE_SIZE)} of ${rows.length - 1}`}
      />

      <SyntaxFooter
        items={[
          { code: `LOOKUP('${tableName.replace(/'/g, "''")}', row, col)` },
          { code: `INTERPOLATE('${tableName.replace(/'/g, "''")}', '${(rows[0]?.[0] || 'xcol').replace(/'/g, "''")}', '${(rows[0]?.[1] || 'ycol').replace(/'/g, "''")}', xval)` },
          { code: `INTERPOLATE2('${tableName.replace(/'/g, "''")}', '${(rows[0]?.[0] || 'xcol').replace(/'/g, "''")}', '${(rows[0]?.[1] || 'ycol').replace(/'/g, "''")}', '${(rows[0]?.[2] || 'zcol').replace(/'/g, "''")}', x, y)` },
          { code: `LOOKUP$ROW('${tableName.replace(/'/g, "''")}', '${(rows[0]?.[0] || 'col').replace(/'/g, "''")}', key)` },
          { code: `SUMLOOKUP('${tableName.replace(/'/g, "''")}', '${(rows[0]?.[0] || 'col').replace(/'/g, "''")}')` },
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
  const setLookupTableDirty = useModelStore((s) => s.setLookupTableDirty);
  const [error, setError] = useState<string | null>(null);
  const [tableToSwitchTo, setTableToSwitchTo] = useState<string | null>(null);

  // Auto-fetch CSV if selectedTable is set from sidebar
  React.useEffect(() => {
    if (selectedTable && !lookupTableCSVs[selectedTable]) {
      api.getTableCSV(selectedTable)
        .then((csv) => setLookupTableCSV(selectedTable, csv, true))
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

  // Open a table (fetch CSV if not cached). Switching grids drops unsaved
  // cell edits, so confirm first when the open grid is dirty.
  // A seq guard keeps fast double-clicks on the last clicked table.
  const openSeq = useRef(0);
  const openTable = useCallback(async (name: string) => {
    if (name !== selectedTable && useModelStore.getState().lookupTableDirty) {
      setTableToSwitchTo(name);
      return;
    }
    if (!lookupTableCSVs[name]) {
      const seq = ++openSeq.current;
      try {
        const csv = await api.getTableCSV(name);
        if (seq !== openSeq.current) return;
        setLookupTableCSV(name, csv, true);
      } catch (e) {
        if (seq !== openSeq.current) return;
        setError(e instanceof Error ? e.message : String(e));
        return;
      }
    }
    setSelectedTable(name);
  }, [selectedTable, lookupTableCSVs, setLookupTableCSV, setSelectedTable]);

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
        key={selectedTable}
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

      {/* Table list or Guide */}
      {lookupTables.length === 0 ? (
        <EmptyState
          style={{ flex: 1 }}
          icon={<Table2 size={36} />}
          title="Lookup Tables Workspace"
          description="Manage, edit, and interpolate external experimental data or custom property tables directly in equations."
          steps={[
            <>Enter a table name and click <strong>Add</strong> in the left sidebar</>,
            'Populate rows, edit cells, or import an existing CSV file',
            <>Access data in equations using <strong>LOOKUP</strong>, <strong>INTERPOLATE</strong>, or <strong>TABLEVALUE</strong></>,
          ]}
        />
      ) : (
        <div style={{ flex: 1, overflow: 'auto', padding: '0 14px 14px 14px' }}>
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
        </div>
      )}
      <SyntaxFooter
        items={[
          { code: "LOOKUP('table', row, col)" },
          { code: "INTERPOLATE('table', 'xcol', 'ycol', xval)" },
          { code: "INTERPOLATE2('table', 'xcol', 'ycol', 'zcol', x, y)" },
          { code: "LOOKUP$ROW('table', 'col', key)" },
          { code: "SUMLOOKUP('table', 'col')" },
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
      {tableToSwitchTo && (
        <ConfirmModal
          title="Discard Unsaved Table Edits?"
          message={`"${selectedTable}" has unsaved cell edits. Opening "${tableToSwitchTo}" will discard them.`}
          confirmLabel="Discard & Open"
          onConfirm={() => {
            setLookupTableDirty(false);
            const name = tableToSwitchTo;
            setTableToSwitchTo(null);
            void openTable(name);
          }}
          onCancel={() => setTableToSwitchTo(null)}
        />
      )}
    </div>
  );
}
