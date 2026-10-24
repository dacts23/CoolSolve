
function escapeCsvCell(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function downloadCsv(suggestedName: string, csvContent: string): Promise<void> {
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as unknown as {
        showSaveFilePicker: (opts: {
          suggestedName?: string;
          types?: { description: string; accept: Record<string, string[]> }[];
        }) => Promise<FileSystemFileHandle>;
      }).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'CSV File (*.csv)',
            accept: {
              'text/csv': ['.csv'],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(csvContent);
      await writable.close();
      return;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
    }
  }
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
