export interface SalesReturnItem {
  id: number
  productId: number
  productCode: string
  productName: string
  supplierCode: string
  unit: string
  qty: number
  pieces: number
  unitPrice: number
  amount: number
  notes: string | null
}

export interface SalesReturn {
  id: number
  returnNo: string
  customerId: number
  customerName: string
  customerCode: string
  customerPhone: string | null
  customerAddress: string | null
  originalOrderId: number | null
  returnDate: string
  totalQty: number
  totalPieces: number
  totalAmount: number
  operator: string | null
  notes: string | null
  createdAt: string
  items?: SalesReturnItem[]
}

export interface CreateSalesReturnItemDto {
  productId: number
  qty: number
  pieces?: number
  unitPrice: number
  notes?: string
}

export interface CreateSalesReturnDto {
  customerId: number
  returnDate: string
  originalOrderId?: number
  notes?: string
  items: CreateSalesReturnItemDto[]
}

export interface UpdateSalesReturnDto extends CreateSalesReturnDto {}
