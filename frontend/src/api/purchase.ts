import client from './client.ts'

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
  notes: string
}

export interface PurchaseOrder {
  id: number
  orderNo: string
  supplierId: number
  supplierName: string
  supplierCode: string
  supplierPhone?: string | null
  orderDate: string
  totalQty: number
  totalAmount: number
  totalPieces: number
  discount: number
  finalAmount: number
  operator: string
  notes: string
  status: '已入库' | '作废'
  createdAt: string
  items: PurchaseOrderItem[]
}

export interface PurchaseOrderPayload {
  supplierId: number
  orderDate: string
  discount?: number
  notes?: string
  items: {
    productId: number
    qty: number
    pieces?: number
    unitPrice: number
    discount?: number
    notes?: string
  }[]
}

export const getPurchaseOrders = async (params?: {
  supplierId?: number
  startDate?: string
  endDate?: string
  search?: string
  searchField?: string
}): Promise<PurchaseOrder[]> => {
  const res = await client.get<{ data: PurchaseOrder[] }>('/purchase/orders', { params })
  return res.data.data
}

export const getPurchaseOrder = async (id: number): Promise<PurchaseOrder> => {
  const res = await client.get<{ data: PurchaseOrder }>(`/purchase/orders/${id}`)
  return res.data.data
}

export const createPurchaseOrder = async (payload: PurchaseOrderPayload): Promise<PurchaseOrder> => {
  const res = await client.post<{ data: PurchaseOrder }>('/purchase/orders', payload)
  return res.data.data
}

export const updatePurchaseOrder = async (id: number, payload: PurchaseOrderPayload): Promise<PurchaseOrder> => {
  const res = await client.put<{ data: PurchaseOrder }>(`/purchase/orders/${id}`, payload)
  return res.data.data
}

export const voidPurchaseOrder = async (id: number): Promise<PurchaseOrder> => {
  const res = await client.patch<{ data: PurchaseOrder }>(`/purchase/orders/${id}/void`)
  return res.data.data
}

// ——— Purchase Returns ———

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

export interface PurchaseReturnPayload {
  supplierId: number
  returnDate: string
  originalOrderId?: number
  notes?: string
  items: {
    productId: number
    qty: number
    pieces?: number
    unitPrice: number
    notes?: string
  }[]
}

export const getPurchaseReturns = async (params?: {
  supplierId?: number
  startDate?: string
  endDate?: string
  search?: string
  searchField?: string
}): Promise<PurchaseReturn[]> => {
  const res = await client.get<{ data: PurchaseReturn[] }>('/purchase/returns', { params })
  return res.data.data
}

export const getPurchaseReturn = async (id: number): Promise<PurchaseReturn> => {
  const res = await client.get<{ data: PurchaseReturn }>(`/purchase/returns/${id}`)
  return res.data.data
}

export const createPurchaseReturn = async (payload: PurchaseReturnPayload): Promise<PurchaseReturn> => {
  const res = await client.post<{ data: PurchaseReturn }>('/purchase/returns', payload)
  return res.data.data
}

export const updatePurchaseReturn = async (id: number, payload: PurchaseReturnPayload): Promise<PurchaseReturn> => {
  const res = await client.put<{ data: PurchaseReturn }>(`/purchase/returns/${id}`, payload)
  return res.data.data
}

export const voidPurchaseReturn = async (id: number): Promise<PurchaseReturn> => {
  const res = await client.patch<{ data: PurchaseReturn }>(`/purchase/returns/${id}/void`)
  return res.data.data
}

// ——— Purchase Detail (flat rows) ———

export interface PurchaseDetailRow {
  rowType: 'order' | 'return'
  id: number
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

export const getPurchaseOrdersDetail = async (params?: {
  startDate?: string
  endDate?: string
  search?: string
  searchField?: string
}): Promise<PurchaseDetailRow[]> => {
  const res = await client.get<{ data: PurchaseDetailRow[] }>('/purchase/orders/detail', { params })
  return res.data.data
}
