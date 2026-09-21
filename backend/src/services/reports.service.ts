import * as repo from '@/repositories/reports.repo'
import type {
  SalesReportResult,
  PurchaseReportResult,
  InventoryReportResult,
  ReportGroupRow,
  ReportOrderRow,
} from '@/dto/reports.dto'

export async function getSalesReport(filters: {
  startDate?: string
  endDate?: string
  customerId?: number
}): Promise<SalesReportResult> {
  const [orders, stats, totalPaid, totalProfit] = await Promise.all([
    repo.getSalesOrders(filters),
    repo.getSalesStats(filters),
    repo.getSalesPaid(filters),
    repo.getSalesProfit(filters),
  ])
  return {
    ...stats,
    totalPaid,
    totalUnpaid: +(stats.totalAmount - totalPaid).toFixed(2),
    totalProfit: +totalProfit.toFixed(2),
    orders,
  }
}

export async function getPurchaseReport(filters: {
  startDate?: string
  endDate?: string
  supplierId?: number
}): Promise<PurchaseReportResult> {
  const [orders, stats] = await Promise.all([
    repo.getPurchaseOrders(filters),
    repo.getPurchaseStats(filters),
  ])
  return { ...stats, orders }
}

export async function getInventoryReport(filters: {
  category?: string
  supplierId?: number
}): Promise<InventoryReportResult> {
  const inventory = await repo.getInventoryRows(filters)
  const totalStock = inventory.reduce((s, r) => s + Number(r.stock), 0)
  return { totalItems: inventory.length, totalStock, inventory }
}

export async function getSalesGroup(
  by: 'customer' | 'product' | 'supplier',
  startDate: string,
  endDate: string,
): Promise<ReportGroupRow[]> {
  return repo.getSalesL1(by, { startDate, endDate })
}

export async function getSalesSubgroup(
  by: 'customer' | 'product' | 'supplier',
  parentId: number,
  startDate: string,
  endDate: string,
): Promise<ReportGroupRow[]> {
  return repo.getSalesL2(by, parentId, { startDate, endDate })
}

export async function getSalesOrderRows(
  filters: { startDate: string; endDate: string; customerId?: number; productId?: number; supplierId?: number },
): Promise<ReportOrderRow[]> {
  return repo.getSalesL3(filters)
}

export async function getPurchaseGroup(
  by: 'supplier' | 'product',
  startDate: string,
  endDate: string,
): Promise<ReportGroupRow[]> {
  return repo.getPurchaseL1(by, { startDate, endDate })
}

export async function getPurchaseSubgroup(
  by: 'supplier' | 'product',
  parentId: number,
  startDate: string,
  endDate: string,
): Promise<ReportGroupRow[]> {
  return repo.getPurchaseL2(by, parentId, { startDate, endDate })
}

export async function getPurchaseOrderRows(
  filters: { startDate: string; endDate: string; supplierId?: number; productId?: number },
): Promise<ReportOrderRow[]> {
  return repo.getPurchaseL3(filters)
}

type SalesDim = 'customer' | 'product' | 'supplier' | 'daily' | 'monthly'
type PurchaseDim = 'product' | 'supplier'

export async function getRankings(
  type: 'sales' | 'purchase',
  by: SalesDim | PurchaseDim,
  startDate: string,
  endDate: string,
): Promise<ReportGroupRow[]> {
  if (type === 'sales') {
    if (by === 'daily')   return repo.getSalesRankByDay({ startDate, endDate })
    if (by === 'monthly') return repo.getSalesRankByMonth({ startDate, endDate })
    return repo.getSalesL1(by as 'customer' | 'product' | 'supplier', { startDate, endDate })
  }
  return repo.getPurchaseL1(by as 'supplier' | 'product', { startDate, endDate })
}
