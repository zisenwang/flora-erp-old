import type { Response } from 'express'
import type { AuthRequest } from '@/middleware/auth'
import * as service from '@/services/product.service'

export async function list(req: AuthRequest, res: Response): Promise<void> {
  const { supplierId, search } = req.query as Record<string, string | undefined>
  const data = await service.listProducts({
    supplierId: supplierId ? Number(supplierId) : undefined,
    search,
  })
  res.json({ data })
}

export async function get(req: AuthRequest, res: Response): Promise<void> {
  const data = await service.getProduct(Number(req.params.id))
  res.json({ data })
}

export async function create(req: AuthRequest, res: Response): Promise<void> {
  const { code, name, supplierId, category, grade, spec, unit, costPrice, price, unitsPerPiece } =
    req.body
  const data = await service.createProduct({
    code,
    name,
    supplierId,
    category,
    grade,
    spec,
    unit,
    costPrice,
    price,
    unitsPerPiece,
  })
  res.status(201).json({ data })
}

export async function update(req: AuthRequest, res: Response): Promise<void> {
  const {
    code,
    name,
    supplierId,
    category,
    grade,
    spec,
    unit,
    costPrice,
    price,
    unitsPerPiece,
    status,
  } = req.body
  const data = await service.updateProduct(Number(req.params.id), {
    code,
    name,
    supplierId,
    category,
    grade,
    spec,
    unit,
    costPrice,
    price,
    unitsPerPiece,
    status,
  })
  res.json({ data })
}

export async function remove(req: AuthRequest, res: Response): Promise<void> {
  await service.deleteProduct(Number(req.params.id))
  res.json({ data: { message: '删除成功' } })
}

export async function categories(_req: AuthRequest, res: Response): Promise<void> {
  const data = await service.getProductCategories()
  res.json({ data })
}

export async function nextCode(req: AuthRequest, res: Response): Promise<void> {
  const supplierId = Number(req.query.supplierId)
  if (!supplierId) { res.status(400).json({ message: '缺少 supplierId' }); return }
  const data = await service.getNextProductCode(supplierId)
  res.json({ data })
}
