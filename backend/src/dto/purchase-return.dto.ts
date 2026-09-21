export interface PurchaseReturnItem {
  id: number
  productId: number
  productCode: string
  productName: string
  category: string | null
  grade: string | null
  unit: string
  qty: number
  pieces: number
  unitPrice: number
  amount: number
  notes: string | null
}

export interface PurchaseReturn {
  id: number
  returnNo: string
  supplierId: number
  supplierName: string
  supplierCode: string
  supplierPhone: string | null
  supplierAddress: string | null
  originalOrderId: number | null
  returnDate: string
  totalQty: number
  totalPieces: number
  totalAmount: number
  operator: string | null
  notes: string | null
  createdAt: string
  items?: PurchaseReturnItem[]
}

export interface CreatePurchaseReturnItemDto {
  productId: number
  qty: number
  pieces?: number
  unitPrice: number
  notes?: string
}

export interface CreatePurchaseReturnDto {
  supplierId: number
  returnDate: string
  originalOrderId?: number
  notes?: string
  items: CreatePurchaseReturnItemDto[]
}

export interface UpdatePurchaseReturnDto extends CreatePurchaseReturnDto {}
