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
  let cellQuoted = false;
  // A quote or comma proves the row is data, not a blank line.
  let rowTouched = false;

  const endCell = () => {
    // Quoted cells keep their spaces (RFC4180); unquoted cells trim.
    cells.push(cellQuoted ? current : current.trim());
    current = '';
    cellQuoted = false;
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
      cellQuoted = true;
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
  // An unterminated quote means a broken file: say so instead of silently
  // swallowing the rest of the table.
  if (inQuotes) throw new Error('Malformed CSV: unterminated quoted field');
  if (current !== '' || cells.length > 0 || rowTouched) endRow();
  return rows;
}

export function serializeCSV(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}

/** Pad uneven CSV rows to a rectangular grid with at least 1 header row + 1 data row. */
export function normalizeGridRows(rows: string[][]): string[][] {
  if (rows.length === 0) return [['Column1', 'Column2'], ['', ''], ['', '']];
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const padded = rows.map((r, ri) =>
    Array.from({ length: cols }, (_, c) => r[c] ?? (ri === 0 ? `Column${c + 1}` : ''))
  );
  if (padded.length < 2) padded.push(Array(cols).fill(''));
  return padded;
}

/** Parse a CSV string (header row + numeric rows) into IntegralTableData. */
export function parseCSVToTable(csv: string, csvName: string): IntegralTableData | null {
  if (!csv || !csv.trim()) return null;
  const rows = parseCSV(csv);
  if (rows.length < 2) return null;

  const header = rows[0];
  if (header.length === 0) return null;

  const data: Record<string, number[]> = {};
  const seen = new Set<string>();
  const headerOut: string[] = [];
  for (const col of header) {
    // Duplicate headers must not merge: make each name unique.
    let name = col;
    let n = 2;
    while (seen.has(name)) name = `${col}_${n++}`;
    seen.add(name);
    headerOut.push(name);
    data[name] = [];
  }

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    // A longer row would silently lose cells, a shorter row would silently
    // gain NaNs: reject the file instead.
    if (cells.length !== header.length) {
      throw new Error(`Malformed CSV: row ${i + 1} has ${cells.length} cells but the header has ${header.length}`);
    }
    for (let c = 0; c < header.length; c++) {
      const raw = (cells[c] ?? '').trim();
      // Empty cell is missing data, not zero.
      const num = raw === '' ? NaN : Number(raw);
      data[headerOut[c]].push(Number.isFinite(num) ? num : NaN);
    }
  }

  const numRows = data[headerOut[0]].length;
  return {
    integrationVar: headerOut[0],
    columns: headerOut,
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

/**
 * Prefix dangerous spreadsheet formula triggers (=, +, -, @) with a single quote,
 * but preserve genuine numbers (e.g. -15.2, +10, 0) without alteration.
 */
export function safeSpreadsheetCell(val: string): string {
  const t = val.trim();
  return !Number.isFinite(Number(t)) && /^[=+\-@]/.test(t) ? `'${val}` : val;
}

/** File names come from model/study text: strip path chars the OS rejects. */
export function sanitizeFilename(name: string, fallback = 'export.csv'): string {
  let clean = String(name).replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').replace(/[. ]+$/g, '').slice(0, 120);
  // Windows reserves these device names with or without an extension.
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(clean)) clean = `_${clean}`;
  return clean || fallback;
}

export async function downloadCsv(suggestedName: string, csvContent: string): Promise<void> {
  await saveFileWithPicker(csvContent, sanitizeFilename(suggestedName), [
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
  const rows: string[][] = [
    ['Index', ...baseNames.map(safeSpreadsheetCell)],
    ...indices.map((idx) => [
      String(idx),
      ...baseNames.map((name) => {
        const val = grid.get(name)?.get(idx);
        return val === undefined || Number.isNaN(val) ? '' : safeSpreadsheetCell(String(val));
      }),
    ]),
  ];
  const csv = serializeCSV(rows);
  const filename = sanitizeFilename(modelName ? `${modelName}-arrays.csv` : 'arrays.csv');
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
      : Object.keys(results.find((r) => r.success && r.variables)?.variables || {}).sort();
  const rows: string[][] = [
    ['#', ...sweepNames.map(safeSpreadsheetCell), 'Status', ...outVars.map(safeSpreadsheetCell)],
    ...results.map((pt, idx) => [
      String(idx + 1),
      ...sweepNames.map((name) => safeSpreadsheetCell(String(pt.overrides[name] ?? ''))),
      pt.success ? 'Success' : 'Failed',
      ...outVars.map((name) =>
        pt.success && pt.variables && pt.variables[name] !== undefined
          ? safeSpreadsheetCell(String(pt.variables[name]))
          : ''
      ),
    ]),
  ];
  const csv = serializeCSV(rows);
  const cleanSweep = sweepNames.join('_') || 'sweep';
  const prefix = studyName ? studyName.replace(/\s+/g, '_') : modelName ? `${modelName}_parametric` : 'parametric';
  const filename = sanitizeFilename(`${prefix}_${cleanSweep}.csv`);
  await downloadCsv(filename, csv);
}
