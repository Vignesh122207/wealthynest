import type {PagedResponse} from "@/types/api.types";

// Safety net against an infinite loop if a paginated endpoint's response never reports
// meta.last=true — not a limit anyone should hit in practice (500/page cap * 200 pages = 100k rows).
const MAX_PAGES = 200;

/** Follows every page of a paginated endpoint instead of stopping at the first one. Used by
 * exports/reports, where silently capping at a single page would under-report data for any
 * user with more rows than that one page holds. */
export async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<PagedResponse<T>>,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetchPage(page);
    all.push(...res.data);
    if (res.meta.last) break;
  }
  return all;
}
