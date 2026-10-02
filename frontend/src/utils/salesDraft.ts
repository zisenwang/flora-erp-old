// Unsaved 销售单 kept in localStorage by 销售单录入 (old system: 未提交销售单)

export const SALES_DRAFT_KEY = 'flora.salesDraft'

/** Customer name of the unsubmitted 销售单, or null when there is none (no lines yet). */
export function peekSalesDraftCustomer(): string | null {
  try {
    const raw = localStorage.getItem(SALES_DRAFT_KEY)
    if (!raw) return null
    const draft = JSON.parse(raw) as { customer?: { name?: string } | null; lines?: unknown[] }
    if (!draft.lines?.length) return null
    return draft.customer?.name ?? ''
  } catch {
    return null
  }
}
