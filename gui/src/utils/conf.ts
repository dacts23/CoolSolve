/**
 * conf.ts — Shared parser and non-destructive serializer for key=value
 * files (coolsolve.conf, .initials).
 *
 * Preserves `#` comments, section headers, and inline notes when settings
 * or guesses are modified via the GUI.
 */

/** `#` starts a comment only after whitespace (or as the whole value).
 * Legacy compact `1#note` now stays part of the value: add a space (`1 #note`). */
function commentIndex(s: string): number {
  if (s.startsWith('#')) return 0;
  const m = /\s#/.exec(s);
  return m ? m.index + 1 : -1;
}

/** Parse conf or initials text into a key→value Map */
export function parseKeyValueText(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    let val = trimmed.substring(eq + 1).trim();
    const hash = commentIndex(val);
    if (hash >= 0) val = val.substring(0, hash).trim();
    map.set(trimmed.substring(0, eq).trim(), val);
  }
  return map;
}

/**
 * Non-destructively update one or more keys in key=value text.
 * Preserves existing comments, line order, and inline notes.
 */
export function updateKeyValueLines(
  text: string,
  updates: Record<string, string | undefined>
): string {
  const pending = { ...updates };
  const lines = text ? text.split(/\r?\n/) : [];
  const out: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('#') && trimmed.includes('=')) {
      const eqIdx = line.indexOf('=');
      const key = line.substring(0, eqIdx).trim();
      if (Object.prototype.hasOwnProperty.call(pending, key)) {
        const val = pending[key];
        delete pending[key];
        if (val === undefined || val === '') {
          // Key removed
          continue;
        }
        // Preserve any inline comment after value
        const afterEq = line.substring(eqIdx + 1);
        const hashIdx = commentIndex(afterEq);
        const comment = hashIdx >= 0 ? ` ${afterEq.substring(hashIdx).trim()}` : '';
        out.push(`${key} = ${val}${comment}`);
        continue;
      }
    }
    out.push(line);
  }

  // Append new keys
  for (const [key, val] of Object.entries(pending)) {
    if (val !== undefined && val !== '') {
      out.push(`${key} = ${val}`);
    }
  }

  const result = out.join('\n').trim();
  return result ? `${result}\n` : '';
}
