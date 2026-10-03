export interface InventoryRow {
  productId: number
  productCode: string
  productName: string
  supplierName: string
  supplierCode: string
  category: string | null
  unit: string
  unitsPerPiece: number | null
  stock: number
  lastUpdated: string
}

export interface InventoryAdjustment {
  id: number
  productId: number
  productCode: string
  productName: string
  type: 'in' | 'out' | 'adjust'
  qtyBefore: number
  qtyChange: number
  qtyAfter: number
  reason: string | null
  refType: string
  refId: number | null
  operator: string | null
  createdAt: string
}

export interface AdjustInventoryDto {
  productId: number
  qtyNew: number
  reason?: string
}

// One inventory_adjustments row joined with its product / supplier for display
export interface AdjustmentRecord {
  id: number
  productId: number
  productCode: string
  productName: string
  spec: string | null
  grade: string | null
  unit: string
  unitsPerPiece: number | null
  supplierCode: string
  supplierName: string
  type: 'in' | 'out' | 'adjust'
  qtyBefore: number
  qtyChange: number
  qtyAfter: number
  reason: string | null
  refType: string // 'manual' | 'purchase' | 'sale' | 'purchase_return' | 'sale_return' ...
  refId: number | null
  operator: string | null
  createdAt: string // 'YYYY-MM-DD HH:mm'
}

// All optional; text filters are partial matches
export interface AdjustmentFilters {
  refType?: string
  type?: 'in' | 'out' | 'adjust'
  productId?: number
  startDate?: string // 'YYYY-MM-DD', inclusive
  endDate?: string // 'YYYY-MM-DD', inclusive
  productCode?: string
  productName?: string
  operator?: string // matches the operator's display name or username
  reason?: string
}
