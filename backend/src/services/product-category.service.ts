import * as repo from '@/repositories/product-category.repo'
import type { ProductCategory } from '@/dto/product-category.dto'
import { AppError } from '@/services/supplier.service'

function cleanName(name: unknown): string {
  const n = typeof name === 'string' ? name.trim() : ''
  if (!n) throw new AppError(400, '请输入分类名称')
  if (n.length > 50) throw new AppError(400, '分类名称不能超过50个字')
  return n
}

export async function listCategories(): Promise<ProductCategory[]> {
  return repo.findAll()
}

export async function getCategory(id: number): Promise<ProductCategory> {
  const category = await repo.findById(id)
  if (!category) throw new AppError(404, '产品分类不存在')
  return category
}

export async function createCategory(name: unknown, operator: string | null): Promise<ProductCategory> {
  const id = await repo.create(cleanName(name), operator)
  return getCategory(id)
}

// products point at the id, so a rename shows up on every product automatically
export async function updateCategory(id: number, name: unknown, operator: string | null): Promise<ProductCategory> {
  if (!(await repo.update(id, cleanName(name), operator))) throw new AppError(404, '产品分类不存在')
  return getCategory(id)
}

// blocked while any product still uses the category
export async function deleteCategory(id: number): Promise<void> {
  const category = await getCategory(id)
  if (category.productCount > 0) {
    throw new AppError(409, `该分类下还有${category.productCount}个产品，不能删除`)
  }
  await repo.remove(id)
}
