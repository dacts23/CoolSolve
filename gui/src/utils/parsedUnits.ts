/**
 * parsedUnits.ts - one lookup for "what unit does this variable have".
 * Priority: user override (set in the GUI) > parsed annotation > none.
 */
import type { UserUnitOverride, VariableInfo } from '../api/types.ts';

export interface ResolvedUnit {
  units: string;
  /** Where the unit came from: code annotation, CoolProp inference, or the user. */
  source: string;
}

/** Build a case-insensitive lookup map from parsedVariables */
export function buildParsedMap(parsed: VariableInfo[]): Map<string, VariableInfo> {
  const map = new Map<string, VariableInfo>();
  for (const v of parsed) {
    map.set(v.name.trim().toLowerCase(), v);
  }
  return map;
}

/** Build a case-insensitive lookup map from user overrides (memoize per render). */
export function buildOverrideMap(overrides: UserUnitOverride[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const o of overrides) {
    const key = o.variableName.toLowerCase();
    // Last duplicate wins (same rule as before, now O(1) lookup).
    map.set(key, o.units);
  }
  return map;
}

/** Map-based lookup (memoize the map for tables that resolve many rows). */
const overrideCache = new WeakMap<UserUnitOverride[], Map<string, string>>();

export function resolveUnitFromMap(
  name: string,
  map: Map<string, VariableInfo>,
  userUnitOverrides: UserUnitOverride[] | Map<string, string>
): ResolvedUnit {
  const key = name.trim().toLowerCase();
  let overrides: Map<string, string>;
  if (userUnitOverrides instanceof Map) {
    overrides = userUnitOverrides;
  } else {
    const cached = overrideCache.get(userUnitOverrides);
    if (cached) {
      overrides = cached;
    } else {
      overrides = buildOverrideMap(userUnitOverrides);
      overrideCache.set(userUnitOverrides, overrides);
    }
  }
  const hit = overrides.get(key);
  if (hit !== undefined) return { units: hit, source: 'user' };
  const info = map.get(key);
  if (info && info.units) return { units: info.units, source: info.unitSource || 'code' };
  return { units: '', source: '' };
}

/** Map-based imposed check (memoize the map for tables that check many rows). */
export function isImposedFromMap(name: string, map: Map<string, VariableInfo>): boolean {
  return map.get(name.trim().toLowerCase())?.isImposed ?? false;
}
