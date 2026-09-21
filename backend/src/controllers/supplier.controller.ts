import type { Response } from 'express'
import type { AuthRequest } from '@/middleware/auth'
import * as service from '@/services/supplier.service'

export async function list(req: AuthRequest, res: Response): Promise<void> {
  const data = await service.listSuppliers(req.query.search as string | undefined)
  res.json({ data })
}

export async function get(req: AuthRequest, res: Response): Promise<void> {
  const data = await service.getSupplier(Number(req.params.id))
  res.json({ data })
}

export async function create(req: AuthRequest, res: Response): Promise<void> {
  const data = await service.createSupplier(req.body)
  res.status(201).json({ data })
}

export async function update(req: AuthRequest, res: Response): Promise<void> {
  const data = await service.updateSupplier(Number(req.params.id), req.body)
  res.json({ data })
}

export async function remove(req: AuthRequest, res: Response): Promise<void> {
  await service.deleteSupplier(Number(req.params.id))
  res.json({ data: { message: '删除成功' } })
}

export async function nextCode(_req: AuthRequest, res: Response): Promise<void> {
  const data = await service.getNextCode()
  res.json({ data })
}
