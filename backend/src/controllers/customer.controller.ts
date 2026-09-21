import type { Response } from 'express'
import type { AuthRequest } from '@/middleware/auth'
import * as service from '@/services/customer.service'

export async function list(req: AuthRequest, res: Response): Promise<void> {
  const data = await service.listCustomers(req.query.search as string | undefined)
  res.json({ data })
}

export async function get(req: AuthRequest, res: Response): Promise<void> {
  const data = await service.getCustomer(Number(req.params.id))
  res.json({ data })
}

export async function create(req: AuthRequest, res: Response): Promise<void> {
  const data = await service.createCustomer(req.body)
  res.status(201).json({ data })
}

export async function update(req: AuthRequest, res: Response): Promise<void> {
  const data = await service.updateCustomer(Number(req.params.id), req.body)
  res.json({ data })
}

export async function remove(req: AuthRequest, res: Response): Promise<void> {
  await service.deleteCustomer(Number(req.params.id))
  res.json({ data: { message: '删除成功' } })
}

export async function nextCode(_req: AuthRequest, res: Response): Promise<void> {
  const data = await service.getNextCode()
  res.json({ data })
}
