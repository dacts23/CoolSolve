import { saveFileWithPicker } from './fileSave.ts';
import type { IntegralTableData } from '../api/types.ts';

/**
 * Parse one CSV text into rows of cells. Handles quoted cells that contain
 * commas, escaped quotes ("") or line breaks. Blank lines are skipped.
 */
export function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let cells: string[] = [];
  let current = '';
  let inQuotes = false;
  // A quote or comma proves the row is data, not a blank line.
  let rowTouched = false;

  const endCell = () => {
    cells.push(current.trim());
    current = '';
  };
  const endRow = () => {
    endCell();
    if (cells.length > 1 || cells[0] !== '' || rowTouched) rows.push(cells);
    cells = [];
    rowTouched = false;
  };

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"') {
        if (csv[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch; // line breaks belong to the cell
      }
    } else if (ch === '"') {
      inQuotes = true;
      rowTouched = true;
    } else if (ch === ',') {
      rowTouched = true;
      endCell();
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && csv[i + 1] === '\n') i++;
      endRow();
    } else {
      current += ch;
    }
  }
  if (current !== '' || cells.length > 0 || rowTouched) endRow();
  return rows;
}

export function serializeCSV(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(',')
    )
    .join('\r\n');
}

/** Parse a CSV string (header row + numeric rows) into IntegralTableData. */
export function parseCSVToTable(csv: string, csvName: string): IntegralTableData | null {
  if (!csv || !csv.trim()) return null;
  const rows = parseCSV(csv);
  if (rows.length < 2) return null;

  const header = rows[0];
  if (header.length === 0) return null;

  const data: Record<string, number[]> = {};
  for (const col of header) data[col] = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    for (let c = 0; c < header.length; c++) {
      const raw = cells[c] ?? '';
      const num = Number(raw);
      data[header[c]].push(Number.isFinite(num) ? num : NaN);
    }
  }

  const numRows = data[header[0]].length;
  return {
    integrationVar: header[0],
    columns: header,
    data,
    numRows,
    csvName,
  };
}

function escapeCsvCell(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function downloadCsv(suggestedName: string, csvContent: string): Promise<void> {
  await saveFileWithPicker(csvContent, suggestedName, [
    {
      description: 'CSV File (*.csv)',
      accept: {
        'text/csv': ['.csv'],
      },
    },
  ]);
}

export async function exportArrayTableToCsv(
  baseNames: string[],
  indices: number[],
  grid: Map<string, Map<number, number>>,
  modelName?: string
): Promise<void> {
  const header = ['Index', ...baseNames].map(escapeCsvCell).join(',');
  const rows = indices.map((idx) => {
    const cells = [escapeCsvCell(idx)];
    for (const name of baseNames) {
      const val = grid.get(name)?.get(idx);
      cells.push(escapeCsvCell(val));
    }
    return cells.join(',');
  });
  const csv = [header, ...rows].join('\r\n');
  const filename = modelName ? `${modelName}-arrays.csv` : 'arrays.csv';
  await downloadCsv(filename, csv);
}

export interface ParametricPointData {
  overrides: Record<string, number>;
  success: boolean;
  variables?: Record<string, number>;
}

export async function exportParametricStudyToCsv(
  sweepVariables: { name: string }[],
  results: ParametricPointData[],
  outputVarNames?: string[],
  modelName?: string,
  studyName?: string
): Promise<void> {
  const sweepNames = sweepVariables.map((s) => s.name);
  const outVars =
    outputVarNames && outputVarNames.length > 0
      ? outputVarNames
      : Object.keys(results.find((r) => r.success && r.variables)?.variables || {}).sort(
          (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })
        );

  const header = ['#', ...sweepNames, 'Status', ...outVars].map(escapeCsvCell).join(',');
  const rows = results.map((pt, idx) => {
    const cells = [
      escapeCsvCell(idx + 1),
      ...sweepNames.map((name) => escapeCsvCell(pt.overrides[name])),
      escapeCsvCell(pt.success ? 'Success' : 'Failed'),
      ...outVars.map((name) =>
        pt.success && pt.variables && pt.variables[name] !== undefined
          ? escapeCsvCell(pt.variables[name])
          : ''
      ),
    ];
    return cells.join(',');
  });

  const csv = [header, ...rows].join('\r\n');
  const cleanSweep = sweepNames.join('_') || 'sweep';
  const prefix = studyName ? studyName.replace(/\s+/g, '_') : modelName ? `${modelName}_parametric` : 'parametric';
  const filename = `${prefix}_${cleanSweep}.csv`;
  await downloadCsv(filename, csv);
}
