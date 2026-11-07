import type { PaginatedResponse } from "./api/config";

/** Loads every API page when a view needs complete local filtering or ordering. */
export async function collectPages<T>(load: (page: number) => Promise<PaginatedResponse<T>>): Promise<T[]> {
  const first = await load(1);
  const items = [...first.items];
  const pages = Math.ceil(first.total / first.pageSize);
  for (let page = 2; page <= pages; page += 1) {
    const next = await load(page);
    items.push(...next.items);
  }
  return items;
}

export function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  return { items: items.slice((currentPage - 1) * pageSize, currentPage * pageSize), page: currentPage, totalPages };
}