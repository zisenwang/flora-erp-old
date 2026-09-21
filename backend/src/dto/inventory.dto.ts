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
