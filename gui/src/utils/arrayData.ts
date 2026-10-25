export interface ArrayEntry {
  baseName: string;
  index: number;
  value: number;
}

export function extractArrayGrid(variables?: Record<string, number>) {
  if (!variables) {
    return { baseNames: [] as string[], indices: [] as number[], grid: new Map<string, Map<number, number>>() };
  }
  const entries: ArrayEntry[] = [];
  for (const [name, val] of Object.entries(variables)) {
    const match = name.match(/^(.+)\[(\d+)(?:,([^\]]+))?\]$/);
    if (match) {
      const colName = match[3] ? `${match[1]}[i,${match[3]}]` : match[1];
      entries.push({ baseName: colName, index: parseInt(match[2], 10), value: val });
    }
  }

  const baseSet = new Set<string>();
  const indexSet = new Set<number>();
  const grid = new Map<string, Map<number, number>>();

  for (const e of entries) {
    baseSet.add(e.baseName);
    indexSet.add(e.index);
    if (!grid.has(e.baseName)) grid.set(e.baseName, new Map());
    grid.get(e.baseName)!.set(e.index, e.value);
  }

  const baseNames = Array.from(baseSet).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );
  const indices = Array.from(indexSet).sort((a, b) => a - b);

  return { baseNames, indices, grid };
}

export function extractArrayColumns(variables?: Record<string, number>): Map<string, number[]> {
  const { baseNames, indices, grid } = extractArrayGrid(variables);
  const result = new Map<string, number[]>();
  for (const base of baseNames) {
    const colMap = grid.get(base);
    if (!colMap) continue;
    const vals: number[] = [];
    for (const idx of indices) {
      if (colMap.has(idx)) vals.push(colMap.get(idx)!);
    }
    result.set(base, vals);
  }
  return result;
}
