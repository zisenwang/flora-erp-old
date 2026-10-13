// 记忆功能: products used on recent 开单/退单 are listed first in the 录入 pages
import dayjs from 'dayjs'

export const RECENT_DAYS = 60

/** First day of the last `days` days (今天 = 1), as YYYY-MM-DD */
export const recentStartDate = (days = RECENT_DAYS) =>
  dayjs().subtract(days - 1, 'day').format('YYYY-MM-DD')

/** Detail rows (sales or purchase), newest first as the /orders/detail endpoints return them */
export interface RecentRow {
  rowType: 'order' | 'return'
  date: string
  productCode: string
  qty: number
}

/** Product codes of `rowType` rows in most-recent-first order; voided documents (qty 0) are skipped */
export function recentCodes(rows: RecentRow[], rowType: RecentRow['rowType'], days = RECENT_DAYS): string[] {
  const start = recentStartDate(days)
  const seen = new Set<string>()
  for (const r of rows) {
    if (r.rowType === rowType && r.qty > 0 && r.date >= start) seen.add(r.productCode)
  }
  return [...seen]
}

/** Recently used products first (most recent on top), the rest keep their original order */
export function sortByRecent<T extends { code: string }>(products: T[], codes: string[]): T[] {
  const rank = new Map(codes.map((c, i) => [c, i]))
  const recent = products.filter(p => rank.has(p.code)).sort((a, b) => rank.get(a.code)! - rank.get(b.code)!)
  return [...recent, ...products.filter(p => !rank.has(p.code))]
}
