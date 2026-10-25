import { useState, useEffect } from 'react';
import ConfirmModal from './ConfirmModal';
import { SetupShell } from './SetupShell';
import { Table2, Plus, Trash2 } from 'lucide-react';
import { useModelStore } from '../stores/modelStore';
import { api } from '../api/client';

export default function LookupTablesSetup() {
  const lookupTables = useModelStore((s) => s.lookupTables);
  const setLookupTables = useModelStore((s) => s.setLookupTables);
  const setLookupTableCSV = useModelStore((s) => s.setLookupTableCSV);
  const removeLookupTable = useModelStore((s) => s.removeLookupTable);
  const selectedLookupTable = useModelStore((s) => s.selectedLookupTable);
  const setSelectedLookupTable = useModelStore((s) => s.setSelectedLookupTable);
  const lookupTableDirty = useModelStore((s) => s.lookupTableDirty);

  const [newTableName, setNewTableName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tableToDelete, setTableToDelete] = useState<string | null>(null);
  const [tableToSwitch, setTableToSwitch] = useState<string | null>(null);
  useEffect(() => {
    if (lookupTables.length > 0 && !selectedLookupTable) {
      setSelectedLookupTable(lookupTables[0].name);
    }
  }, [lookupTables, selectedLookupTable, setSelectedLookupTable]);

  // Switching tables drops the unsaved cell edits of the open grid: confirm first.
  const selectTable = (name: string) => {
    if (lookupTableDirty && name !== selectedLookupTable) {
      setTableToSwitch(name);
    } else {
      setSelectedLookupTable(name);
    }
  };

  const handleCreateTable = async () => {
    const name = newTableName.trim();
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(name)) {
      setError('Table name must be 1-64 chars: letters, numbers, - or _');
      return;
    }
    const defaultCSV = 'Column1,Column2\n1,\n2,\n';
    setLoading(true);
    setError(null);
    try {
      await api.putTable(name, defaultCSV);
      setLookupTableCSV(name, defaultCSV);
      const res = await api.getTables();
      setLookupTables(res.tables);
      setNewTableName('');
      setSelectedLookupTable(name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteTable = async () => {
    if (!tableToDelete) return;
    const name = tableToDelete;
    setTableToDelete(null);
    try {
      await api.deleteTable(name);
      removeLookupTable(name);
      if (selectedLookupTable === name) {
        setSelectedLookupTable(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <SetupShell icon={<Table2 size={14} className="accent-icon" />} title="LOOKUP TABLES">
        <div className="parametric-section">
          <div className="parametric-section-title">NEW TABLE</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              className="settings-input"
              style={{ flex: 1, padding: '4px 8px', fontSize: 12 }}
              placeholder="Table name..."
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTable()}
            />
            <button
              className="parametric-run-btn"
              style={{ padding: '4px 10px', fontSize: 12 }}
              onClick={handleCreateTable}
              disabled={loading || !newTableName.trim()}
              title="Create new table"
            >
              <Plus size={13} style={{ marginRight: 3, verticalAlign: 'middle' }} />
              Add
            </button>
          </div>
          {error && <div style={{ color: '#f87171', fontSize: 11, marginTop: 4 }}>{error}</div>}
        </div>
        <div className="parametric-section">
          <div className="parametric-section-title">
            TABLES ({lookupTables.length})
          </div>
          {lookupTables.length === 0 ? (
            <div className="parametric-notice">
              No lookup tables yet. Create one above or load a model folder containing CSV files.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {lookupTables.map((tbl) => {
                const isSelected = selectedLookupTable === tbl.name;
                return (
                  <div
                    key={tbl.name}
                    onClick={() => selectTable(tbl.name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      border: `1px solid ${isSelected ? 'var(--accent, #3b82f6)' : 'var(--border, #2a2a3a)'}`,
                      background: isSelected ? 'var(--bg-elevated, #1e1e2e)' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
                      <span style={{ fontSize: 12, fontWeight: isSelected ? 600 : 400, color: 'var(--text-primary)' }}>
                        {tbl.name}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {tbl.rows} rows · {tbl.columns.length} cols
                      </span>
                    </div>
                    <button
                      className="icon-btn small"
                      onClick={(e) => { e.stopPropagation(); setTableToDelete(tbl.name); }}
                      title={`Delete ${tbl.name}`}
                      style={{ opacity: 0.7 }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      {tableToDelete && (
        <ConfirmModal
          title="Delete Lookup Table"
          message={`Are you sure you want to delete lookup table "${tableToDelete}"? This action cannot be undone.`}
          confirmLabel="Delete Table"
          onConfirm={confirmDeleteTable}
          onCancel={() => setTableToDelete(null)}
        />
      )}
      {tableToSwitch && (
        <ConfirmModal
          title="Discard Unsaved Table Edits?"
          message={`"${selectedLookupTable}" has unsaved cell edits. Switching tables will discard them.`}
          confirmLabel="Discard & Switch"
          onConfirm={() => {
            setSelectedLookupTable(tableToSwitch);
            setTableToSwitch(null);
          }}
          onCancel={() => setTableToSwitch(null)}
        />
      )}
    </SetupShell>
  );
}
