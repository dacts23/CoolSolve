import { parseCSV, parseCSVToTable } from './csv.ts';
import type { IntegralTableData } from '../api/types.ts';

/** One place for the live-JSON-or-CSV fallback used by IntegralTable + IntegralSetup. */
export function resolveIntegralTable(
  integralTable: IntegralTableData | null,
  integralCSV: string,
): IntegralTableData | null {
  if (integralTable && integralTable.numRows > 0) return integralTable;
  if (integralCSV) {
    const name = integralTable?.csvName ?? 'model-integral.csv';
    try {
      return parseCSVToTable(integralCSV, name);
    } catch {
      // A ragged trajectory still shows its good prefix instead of vanishing.
      try {
        return parseLenientCSV(integralCSV, name);
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Longest-prefix parse: long rows truncate, short rows pad with NaN. */
function parseLenientCSV(csv: string, csvName: string): IntegralTableData | null {
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
      const raw = (cells[c] ?? '').trim();
      const num = raw === '' ? NaN : Number(raw);
      data[header[c]].push(Number.isFinite(num) ? num : NaN);
    }
  }
  const numRows = data[header[0]].length;
  if (numRows === 0) return null;
  return { integrationVar: header[0], columns: header, data, numRows, csvName };
}
