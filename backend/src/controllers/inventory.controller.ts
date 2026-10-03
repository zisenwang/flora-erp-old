import type { Response } from 'express'
import type { AuthRequest } from '@/middleware/auth'
import * as service from '@/services/inventory.service'

export async function list(req: AuthRequest, res: Response): Promise<void> {
  const { supplierId, category, search } = req.query as Record<string, string | undefined>
  const data = await service.listInventory({
    supplierId: supplierId ? Number(supplierId) : undefined,
    category,
    search,
  })
  res.json({ data })
}

export async function listAdjustments(req: AuthRequest, res: Response): Promise<void> {
  const { productId } = req.query as { productId?: string }
  const data = await service.listAdjustments(productId ? Number(productId) : undefined)
  res.json({ data })
}

export async function listManualAdjustments(req: AuthRequest, res: Response): Promise<void> {
  const { startDate, endDate, productCode, productName, operator, reason } =
    req.query as Record<string, string | undefined>
  const data = await service.listManualAdjustments({
    startDate,
    endDate,
    productCode,
    productName,
    operator,
    reason,
  })
  res.json({ data })
}

export async function getManualAdjustment(req: AuthRequest, res: Response): Promise<void> {
  const data = await service.getManualAdjustment(Number(req.params.id))
  res.json({ data })
}

export async function adjust(req: AuthRequest, res: Response): Promise<void> {
  const { productId, qtyNew, reason } = req.body
  await service.adjustInventory({ productId, qtyNew, reason }, req.user?.username ?? null)
  res.status(201).json({ data: { message: '调整成功' } })
}
