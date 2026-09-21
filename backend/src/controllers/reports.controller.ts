import type { Response } from 'express'
import type { AuthRequest } from '@/middleware/auth'
import * as service from '@/services/reports.service'

export async function salesReport(req: AuthRequest, res: Response): Promise<void> {
  const { startDate, endDate, customerId } = req.query as Record<string, string | undefined>
  const data = await service.getSalesReport({
    startDate,
    endDate,
    customerId: customerId ? Number(customerId) : undefined,
  })
  res.json({ data })
}

export async function purchaseReport(req: AuthRequest, res: Response): Promise<void> {
  const { startDate, endDate, supplierId } = req.query as Record<string, string | undefined>
  const data = await service.getPurchaseReport({
    startDate,
    endDate,
    supplierId: supplierId ? Number(supplierId) : undefined,
  })
  res.json({ data })
}

export async function inventoryReport(req: AuthRequest, res: Response): Promise<void> {
  const { category, supplierId } = req.query as Record<string, string | undefined>
  const data = await service.getInventoryReport({
    category,
    supplierId: supplierId ? Number(supplierId) : undefined,
  })
  res.json({ data })
}

export async function salesGroup(req: AuthRequest, res: Response): Promise<void> {
  const { by, startDate, endDate } = req.query as Record<string, string>
  const data = await service.getSalesGroup(by as 'customer' | 'product' | 'supplier', startDate, endDate)
  res.json({ data })
}

export async function salesSubgroup(req: AuthRequest, res: Response): Promise<void> {
  const { by, parentId, startDate, endDate } = req.query as Record<string, string>
  const data = await service.getSalesSubgroup(by as 'customer' | 'product' | 'supplier', Number(parentId), startDate, endDate)
  res.json({ data })
}

export async function salesOrders(req: AuthRequest, res: Response): Promise<void> {
  const { startDate, endDate, customerId, productId, supplierId } = req.query as Record<string, string>
  const data = await service.getSalesOrderRows({
    startDate, endDate,
    customerId: customerId ? Number(customerId) : undefined,
    productId: productId ? Number(productId) : undefined,
    supplierId: supplierId ? Number(supplierId) : undefined,
  })
  res.json({ data })
}

export async function purchaseGroup(req: AuthRequest, res: Response): Promise<void> {
  const { by, startDate, endDate } = req.query as Record<string, string>
  const data = await service.getPurchaseGroup(by as 'supplier' | 'product', startDate, endDate)
  res.json({ data })
}

export async function purchaseSubgroup(req: AuthRequest, res: Response): Promise<void> {
  const { by, parentId, startDate, endDate } = req.query as Record<string, string>
  const data = await service.getPurchaseSubgroup(by as 'supplier' | 'product', Number(parentId), startDate, endDate)
  res.json({ data })
}

export async function purchaseOrders(req: AuthRequest, res: Response): Promise<void> {
  const { startDate, endDate, supplierId, productId } = req.query as Record<string, string>
  const data = await service.getPurchaseOrderRows({
    startDate, endDate,
    supplierId: supplierId ? Number(supplierId) : undefined,
    productId: productId ? Number(productId) : undefined,
  })
  res.json({ data })
}

export async function rankings(req: AuthRequest, res: Response): Promise<void> {
  const { type, by, startDate, endDate } = req.query as Record<string, string>
  const data = await service.getRankings(
    type as 'sales' | 'purchase',
    by as 'customer' | 'product' | 'supplier' | 'daily' | 'monthly',
    startDate,
    endDate,
  )
  res.json({ data })
}
