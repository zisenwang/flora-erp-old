import type { Response } from 'express'
import type { AuthRequest } from '@/middleware/auth'
import * as service from '@/services/product-category.service'

export async function list(_req: AuthRequest, res: Response): Promise<void> {
  const data = await service.listCategories()
  res.json({ data })
}

export async function get(req: AuthRequest, res: Response): Promise<void> {
  const data = await service.getCategory(Number(req.params.id))
  res.json({ data })
}

export async function create(req: AuthRequest, res: Response): Promise<void> {
  const data = await service.createCategory(req.body.name, req.user?.username ?? null)
  res.status(201).json({ data })
}

export async function update(req: AuthRequest, res: Response): Promise<void> {
  const data = await service.updateCategory(Number(req.params.id), req.body.name, req.user?.username ?? null)
  res.json({ data })
}

export async function remove(req: AuthRequest, res: Response): Promise<void> {
  await service.deleteCategory(Number(req.params.id))
  res.json({ data: { message: '删除成功' } })
}
