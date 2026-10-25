/** Shared 200-row paging for result tables (parametric, integral, lookup). */
export const TABLE_PAGE_SIZE = 200;

export function pageCount(total: number, size = TABLE_PAGE_SIZE): number {
  if (!Number.isFinite(total) || !Number.isFinite(size) || size <= 0) return 1;
  return Math.max(1, Math.ceil(Math.max(0, Math.floor(total)) / Math.floor(size)));
}

export function clampPage(page: number, total: number, size = TABLE_PAGE_SIZE): number {
  if (!Number.isFinite(page)) return 0;
  return Math.min(Math.max(0, Math.floor(page)), pageCount(total, size) - 1);
}
