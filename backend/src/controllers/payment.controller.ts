import type { Response } from 'express'
import type { AuthRequest } from '@/middleware/auth'
import * as service from '@/services/payment.service'

export async function list(req: AuthRequest, res: Response): Promise<void> {
  const { salesOrderId, customerId, startDate, endDate } = req.query as Record<
    string,
    string | undefined
  >
  const data = await service.listPayments({
    salesOrderId: salesOrderId ? Number(salesOrderId) : undefined,
    customerId: customerId ? Number(customerId) : undefined,
    startDate,
    endDate,
  })
  res.json({ data })
}

export async function create(req: AuthRequest, res: Response): Promise<void> {
  const { salesOrderId, amount, paymentDate, method, notes } = req.body
  const data = await service.createPayment(
    { salesOrderId, amount, paymentDate, method, notes },
    req.user?.username ?? null,
  )
  res.status(201).json({ data })
}

export async function remove(req: AuthRequest, res: Response): Promise<void> {
  const data = await service.deletePayment(Number(req.params.id))
  res.json({ data })
}
