import type { Response } from 'express'
import type { AuthRequest } from '@/middleware/auth'
import * as service from '@/services/dashboard.service'

export async function summary(_req: AuthRequest, res: Response): Promise<void> {
  const data = await service.getSummary()
  res.json({ data })
}
