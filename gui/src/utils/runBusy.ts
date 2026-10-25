/**
 * runBusy.ts — one flag both runners share so tab switches cannot corrupt a run.
 *
 * A `zustand` import here would create a store cycle (modelStore <->
 * parametricStore), so this stays a tiny module with no imports.
 *
 * The owner (e.g. 'solve' or 'parametric') stops one runner from clearing the
 * other's flag: releases only clear when the owner matches. Plain
 * setRunBusy(false) with no owner still clears unconditionally (used by tests
 * and by code that owns the whole session moment).
 */
let owner: string | null = null;

/** True while a solve or parametric study is using the server session. */
export function isRunBusy(): boolean {
  return owner !== null;
}

/** Current owner, or null when idle. */
export function runOwner(): string | null {
  return owner;
}

export function setRunBusy(v: boolean, who = '?'): void {
  if (v) {
    if (owner === null) owner = who;
  } else if (who === '?' || owner === '?' || owner === who) {
    owner = null;
  }
}
