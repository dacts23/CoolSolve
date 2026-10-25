import { useState, useMemo, useCallback } from 'react';
import { Download } from 'lucide-react';
import { useModelStore } from '../stores/modelStore';
import { exportArrayTableToCsv } from '../utils/csv';
import { fmt } from '../stores/parametricStore';
import { extractArrayGrid } from '../utils/arrayData';
import { TABLE_PAGE_SIZE, pageCount, clampPage } from '../utils/paging.ts';
import { TablePager } from './SetupShell';

export default function ArrayTable() {
  const [filter, setFilter] = useState('');
  const lastResult = useModelStore((s) => s.lastResult);
  const modelName = useModelStore((s) => s.modelName);

  const { baseNames, indices, grid } = useMemo(
    () => extractArrayGrid(lastResult?.variables),
    [lastResult]
  );

  const filteredBaseNames = useMemo(() => {
    if (!filter) return baseNames;
    const lower = filter.toLowerCase();
    return baseNames.filter((n) => n.toLowerCase().includes(lower));
  }, [baseNames, filter]);

  // Large arrays (10k rows) would create 10k DOM rows: page like other tables.
  const [page, setPage] = useState(0);
  const totalPages = pageCount(indices.length, TABLE_PAGE_SIZE);
  const safePage = clampPage(page, indices.length, TABLE_PAGE_SIZE);
  const pagedIndices = useMemo(
    () => indices.slice(safePage * TABLE_PAGE_SIZE, (safePage + 1) * TABLE_PAGE_SIZE),
    [indices, safePage]
  );

  const handleExportCsv = useCallback(() => {
    if (baseNames.length === 0 || indices.length === 0) return;
    exportArrayTableToCsv(baseNames, indices, grid, modelName);
  }, [baseNames, indices, grid, modelName]);

  if (!lastResult || baseNames.length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>
        {lastResult
          ? 'No array variables found in the solution.'
          : 'No solve result yet. Click Solve to compute variable values.'}
      </div>
    );
  }

  return (
    <div className="array-table-view">
      <div className="search-filter">
        <input
          type="text"
          placeholder="Filter array names..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          className="export-csv-btn"
          onClick={handleExportCsv}
          title="Export array table to CSV"
        >
          <Download size={15} />
        </button>
      </div>
      <div className="variable-table-container">
        <table className="variable-table array-table">
          <thead>
            <tr>
              <th>Index</th>
              {filteredBaseNames.map((name) => (
                <th key={name} style={{ textAlign: 'right' }}>{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedIndices.map((idx) => (
              <tr key={idx}>
                <td style={{ fontWeight: 600 }}>{idx}</td>
                {filteredBaseNames.map((name) => {
                  const val = grid.get(name)?.get(idx);
                  return (
                    <td key={name} className="value-cell solved">
                      {val !== undefined ? fmt(val) : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePager page={safePage} totalPages={totalPages} onPageChange={setPage} />
      <div className="table-footer-status">
        {filteredBaseNames.length} array{filteredBaseNames.length !== 1 ? 's' : ''} × {indices.length} indices
      </div>
    </div>
  );
}
