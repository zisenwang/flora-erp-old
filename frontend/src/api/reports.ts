import client from './client.ts'
import type { SalesOrder } from './sales.ts'
import type { PurchaseOrder } from './purchase.ts'

export interface InventoryReportItem {
  productId: number
  productCode: string
  productName: string
  supplierName: string
  supplierCode: string
  category: string
  unit: string
  unitsPerPiece: number | null
  stock: number
  costPrice: number | null
  price: number
}

export interface SalesReportData {
  totalOrders: number
  totalAmount: number
  totalPieces: number
  totalPaid: number
  totalUnpaid: number
  totalProfit: number
  orders: SalesOrder[]
}

export interface PurchaseReportData {
  totalOrders: number
  totalAmount: number
  totalQty: number
  orders: PurchaseOrder[]
}

export interface InventoryReportData {
  totalItems: number
  totalStock: number
  inventory: InventoryReportItem[]
}

export const getSalesReport = async (params?: {
  startDate?: string
  endDate?: string
  customerId?: number
}): Promise<SalesReportData> => {
  const res = await client.get<{ data: SalesReportData }>('/reports/sales', { params })
  return res.data.data
}

export const getPurchaseReport = async (params?: {
  startDate?: string
  endDate?: string
  supplierId?: number
}): Promise<PurchaseReportData> => {
  const res = await client.get<{ data: PurchaseReportData }>('/reports/purchase', { params })
  return res.data.data
}

export const getInventoryReport = async (params?: {
  category?: string
  supplierId?: number
}): Promise<InventoryReportData> => {
  const res = await client.get<{ data: InventoryReportData }>('/reports/inventory', { params })
  return res.data.data
}

// ── Aggregated drill-down report types ───────────────────────────────────────

export interface ReportGroupRow {
  id: number
  name: string
  unit?: string
  orderCount: number
  totalQty: number
  totalPieces: number
  totalAmount: number
  totalProfit?: number
}

export interface ReportOrderRow {
  orderId: number
  orderNo: string
  orderDate: string
  customerName?: string
  productCode?: string
  productName?: string
  supplierCode?: string
  supplierName?: string
  unit?: string | null
  operator?: string | null
  qty: number
  pieces: number
  unitPrice: number
  amount: number
  discount: number
  finalAmount: number
  costPrice?: number | null
  profit?: number
  notes?: string | null
  isReturn?: boolean
}

export const getSalesGroup = async (params: {
  by: 'customer' | 'product' | 'supplier'
  startDate: string
  endDate: string
}): Promise<ReportGroupRow[]> => {
  const res = await client.get<{ data: ReportGroupRow[] }>('/reports/sales/group', { params })
  return res.data.data
}

export const getSalesSubgroup = async (params: {
  by: 'customer' | 'product' | 'supplier'
  parentId: number
  startDate: string
  endDate: string
}): Promise<ReportGroupRow[]> => {
  const res = await client.get<{ data: ReportGroupRow[] }>('/reports/sales/subgroup', { params })
  return res.data.data
}

export const getSalesOrderRows = async (params: {
  startDate: string
  endDate: string
  customerId?: number
  productId?: number
  supplierId?: number
}): Promise<ReportOrderRow[]> => {
  const res = await client.get<{ data: ReportOrderRow[] }>('/reports/sales/orders', { params })
  return res.data.data
}

export const getPurchaseGroup = async (params: {
  by: 'supplier' | 'product'
  startDate: string
  endDate: string
}): Promise<ReportGroupRow[]> => {
  const res = await client.get<{ data: ReportGroupRow[] }>('/reports/purchase/group', { params })
  return res.data.data
}

export const getPurchaseSubgroup = async (params: {
  by: 'supplier' | 'product'
  parentId: number
  startDate: string
  endDate: string
}): Promise<ReportGroupRow[]> => {
  const res = await client.get<{ data: ReportGroupRow[] }>('/reports/purchase/subgroup', { params })
  return res.data.data
}

export const getPurchaseOrderRows = async (params: {
  startDate: string
  endDate: string
  supplierId?: number
  productId?: number
}): Promise<ReportOrderRow[]> => {
  const res = await client.get<{ data: ReportOrderRow[] }>('/reports/purchase/orders', { params })
  return res.data.data
}

export type SalesRankDim = 'customer' | 'product' | 'supplier' | 'daily' | 'monthly'
export type PurchaseRankDim = 'product' | 'supplier'

export const getRankings = async (params: {
  type: 'sales' | 'purchase'
  by: SalesRankDim | PurchaseRankDim
  startDate: string
  endDate: string
}): Promise<ReportGroupRow[]> => {
  const res = await client.get<{ data: ReportGroupRow[] }>('/reports/rankings', { params })
  return res.data.data
}
