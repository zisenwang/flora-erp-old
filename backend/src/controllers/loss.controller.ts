import type { Response } from 'express'
import type { AuthRequest } from '@/middleware/auth'
import * as service from '@/services/loss.service'

export async function list(req: AuthRequest, res: Response): Promise<void> {
  const { startDate, endDate } = req.query as Record<string, string | undefined>
  const data = await service.listLossRecords({ startDate, endDate })
  res.json({ data })
}

export async function create(req: AuthRequest, res: Response): Promise<void> {
  const { productId, qty, reason, date, notes } = req.body
  const data = await service.createLossRecord(
    { productId, qty, reason, date, notes },
    req.user?.username ?? null,
  )
  res.status(201).json({ data })
}
