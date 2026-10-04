// Unsaved 销售单 kept in localStorage by 销售单录入 / 手机开单 (old system: 未提交销售单, kept server-side)
import type { Customer } from '@/api/customers'
import { toSlashDate } from './slashDate'

export const SALES_DRAFT_KEY = 'flora.salesDraft'

export interface DraftCustomer {
  id: number
  code: string
  name: string
  address: string
  phone: string
}

export interface DraftLine {
  key: string
  productId: number
  supplierId: number
  costPrice: number | null   // latest purchase price, saved for 毛利
  code: string
  name: string
  spec: string
  grade: string
  unit: string
  unitsPerPiece: number | null
  qty: string
  unitPrice: string
  pieces: string
  notes: string
  checked: boolean
}

export interface Draft {
  customer: DraftCustomer | null
  lines: DraftLine[]
  orderDate: string
  notes: string
}

export const newDraft = (customer: DraftCustomer | null = null): Draft => ({
  customer,
  lines: [],
  orderDate: toSlashDate(),
  notes: '',
})

export function loadDraft(key: string): Draft {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return { ...newDraft(), ...JSON.parse(raw) }
  } catch { /* storage unavailable — start empty */ }
  return newDraft()
}

export function saveDraft(key: string, draft: Draft) {
  try { localStorage.setItem(key, JSON.stringify(draft)) } catch { /* ignore */ }
}

export const toDraftCustomer = (c: Customer): DraftCustomer => ({
  id: c.id, code: c.code, name: c.name, address: c.address ?? '', phone: c.phone ?? '',
})

// 件数 = ceil(数量 / 包装), same rule as 进货单录入
export const calcPieces = (qty: string, unitsPerPiece: number | null) =>
  unitsPerPiece && Number(qty) > 0 ? String(Math.ceil(Number(qty) / unitsPerPiece)) : '0'

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
