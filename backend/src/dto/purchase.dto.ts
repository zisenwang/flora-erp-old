export interface PurchaseOrderItem {
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
  discount: number
  finalAmount: number
  notes: string | null
}

export interface PurchaseOrder {
  id: number
  orderNo: string
  supplierId: number
  supplierName: string
  supplierCode: string
  supplierPhone: string | null
  supplierAddress: string | null
  orderDate: string
  totalQty: number
  totalPieces: number
  totalAmount: number
  discount: number
  finalAmount: number
  operator: string | null
  notes: string | null
  status: '草稿' | '已入库'
  createdAt: string
  items?: PurchaseOrderItem[]
}

export interface CreatePurchaseItemDto {
  productId: number
  qty: number
  pieces?: number
  unitPrice: number
  discount?: number // default 100
  notes?: string
}

export interface CreatePurchaseOrderDto {
  supplierId: number
  orderDate: string
  discount?: number // order-level discount, default 100
  notes?: string
  items: CreatePurchaseItemDto[]
}

export interface UpdatePurchaseOrderDto extends CreatePurchaseOrderDto {}

export interface PurchaseDetailRow {
  rowType: 'order' | 'return'
  no: string
  date: string
  supplierCode: string
  supplierName: string
  productCode: string
  productName: string
  unit: string
  qty: number
  unitPrice: number
  amount: number
  pieces: number
  operator: string | null
  notes: string | null
  status: string | null
}
