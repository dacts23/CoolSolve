import { useMemo } from 'react';
import { Sigma } from 'lucide-react';
import { useModelStore } from '../stores/modelStore';
import type { IntegralTableData } from '../api/types';

function parseCSVToTable(csv: string, csvName: string): IntegralTableData | null {
  if (!csv || !csv.trim()) return null;
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return null;

  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  const header = splitLine(lines[0]);
  if (header.length === 0) return null;

  const data: Record<string, number[]> = {};
  for (const col of header) data[col] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    for (let c = 0; c < header.length; c++) {
      const raw = cells[c] ?? '';
      const num = Number(raw);
      data[header[c]].push(Number.isFinite(num) ? num : NaN);
    }
  }

  return {
    integrationVar: header[0],
    columns: header,
    data,
    numRows: data[header[0]].length,
    csvName,
  };
}
export default function IntegralSetup() {
  const integralTable = useModelStore((s) => s.integralTable);
  const integralCSV = useModelStore((s) => s.integralCSV);

  const table = useMemo<IntegralTableData | null>(() => {
    if (integralTable && integralTable.numRows > 0) return integralTable;
    if (integralCSV) {
      const name = integralTable?.csvName ?? 'model-integral.csv';
      return parseCSVToTable(integralCSV, name);
    }
    return null;
  }, [integralTable, integralCSV]);
  return (
    <div className="parametric-setup-sidebar">
      <div className="explorer-header">
        <div className="explorer-title-group">
          <Sigma size={14} className="accent-icon" />
          <span className="explorer-title">INTEGRAL TRAJECTORY</span>
        </div>
      </div>

      <div className="parametric-setup-content">
        <div className="parametric-section">
          <div className="parametric-section-title">TRAJECTORY STATUS</div>
          {table ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Variable:</span>
                <code>{table.integrationVar}</code>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Points:</span>
                <span>{table.numRows} rows</span>
              </div>
              {table.totalSteps !== undefined && (
                <div style={{ fontSize: 12, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Steps:</span>
                  <span>{table.totalSteps} steps</span>
                </div>
              )}
              {table.rejectedSteps !== undefined && table.rejectedSteps > 0 && (
                <div style={{ fontSize: 12, color: '#f87171', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Rejected:</span>
                  <span>{table.rejectedSteps}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="parametric-notice">
              No integral trajectory computed yet. Run a model with dynamic integration equations to populate this view.
            </div>
          )}
        </div>
        {table && (
          <div className="parametric-section">
            <div className="parametric-section-title">
              RECORDED VARIABLES ({table.columns.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {table.columns.map((col) => (
                <span
                  key={col}
                  style={{
                    fontSize: 11,
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: col === table.integrationVar ? 'var(--accent, #3b82f6)' : 'var(--bg-elevated, #1e1e2e)',
                    color: col === table.integrationVar ? '#fff' : 'var(--text-primary)',
                    border: '1px solid var(--border, #2a2a3a)',
                  }}
                >
                  {col}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
