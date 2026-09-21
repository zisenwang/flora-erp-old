import client from './client.ts'

export interface SalesOrderItem {
  id: number
  productId: number
  productCode: string
  productName: string
  supplierId: number
  supplierCode: string
  supplierName: string
  unit: string
  qty: number
  unitPrice: number
  amount: number
  discount: number
  finalAmount: number
  costPrice: number | null
  pieces: number
  notes: string
}

export interface SalesOrder {
  id: number
  orderNo: string
  customerId: number
  customerName: string
  customerCode: string
  customerPhone: string
  customerAddress: string
  orderDate: string
  totalQty: number
  totalAmount: number
  totalPieces: number
  totalProfit: number
  paymentStatus: string   // "未收款" | "部分收款" | "已收款"
  operator: string
  notes: string
  status: string
  createdAt: string
  items: SalesOrderItem[]
}

export interface SalesOrderPayload {
  customerId: number
  orderDate: string
  notes?: string
  items: {
    productId: number
    supplierId?: number
    qty: number
    unitPrice: number
    discount?: number
    pieces?: number
    notes?: string
    costPrice?: number | null
  }[]
}

export const getSalesOrders = async (params?: {
  customerId?: number
  paymentStatus?: string
  startDate?: string
  endDate?: string
  search?: string
  searchField?: string
}): Promise<SalesOrder[]> => {
  const res = await client.get<{ data: SalesOrder[] }>('/sales/orders', { params })
  return res.data.data
}

export const getSalesOrder = async (id: number): Promise<SalesOrder> => {
  const res = await client.get<{ data: SalesOrder }>(`/sales/orders/${id}`)
  return res.data.data
}

export const createSalesOrder = async (payload: SalesOrderPayload): Promise<SalesOrder> => {
  const res = await client.post<{ data: SalesOrder }>('/sales/orders', payload)
  return res.data.data
}

export const updateSalesOrder = async (id: number, payload: SalesOrderPayload): Promise<SalesOrder> => {
  const res = await client.put<{ data: SalesOrder }>(`/sales/orders/${id}`, payload)
  return res.data.data
}

export const voidSalesOrder = async (id: number): Promise<SalesOrder> => {
  const res = await client.patch<{ data: SalesOrder }>(`/sales/orders/${id}/void`)
  return res.data.data
}

// ——— Sales Returns ———

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

export interface SalesReturnPayload {
  customerId: number
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

export const getSalesReturns = async (params?: {
  customerId?: number
  startDate?: string
  endDate?: string
  search?: string
  searchField?: string
}): Promise<SalesReturn[]> => {
  const res = await client.get<{ data: SalesReturn[] }>('/sales/returns', { params })
  return res.data.data
}

export const getSalesReturn = async (id: number): Promise<SalesReturn> => {
  const res = await client.get<{ data: SalesReturn }>(`/sales/returns/${id}`)
  return res.data.data
}

export const createSalesReturn = async (payload: SalesReturnPayload): Promise<SalesReturn> => {
  const res = await client.post<{ data: SalesReturn }>('/sales/returns', payload)
  return res.data.data
}

export const updateSalesReturn = async (id: number, payload: SalesReturnPayload): Promise<SalesReturn> => {
  const res = await client.put<{ data: SalesReturn }>(`/sales/returns/${id}`, payload)
  return res.data.data
}

export const voidSalesReturn = async (id: number): Promise<SalesReturn> => {
  const res = await client.patch<{ data: SalesReturn }>(`/sales/returns/${id}/void`)
  return res.data.data
}

// ——— Sales Detail (flat rows) ———

export interface SalesDetailRow {
  rowType: 'order' | 'return'
  id: number
  no: string
  date: string
  customerCode: string
  customerName: string
  productCode: string
  productName: string
  supplierCode: string
  unit: string
  qty: number
  unitPrice: number
  amount: number
  pieces: number
  profit: number | null
  operator: string | null
  notes: string | null
  status: string | null
}

export const getSalesOrdersDetail = async (params?: {
  startDate?: string
  endDate?: string
  search?: string
  searchField?: string
}): Promise<SalesDetailRow[]> => {
  const res = await client.get<{ data: SalesDetailRow[] }>('/sales/orders/detail', { params })
  return res.data.data
}
