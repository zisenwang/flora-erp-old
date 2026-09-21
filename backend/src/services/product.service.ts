import pool from '@/db/pool'
import * as repo from '@/repositories/product.repo'
import * as invRepo from '@/repositories/inventory.repo'
import type { Product, CreateProductDto, UpdateProductDto } from '@/dto/product.dto'
import { AppError } from '@/services/supplier.service'

export async function listProducts(
  filters: { supplierId?: number; search?: string } = {},
): Promise<Product[]> {
  return repo.findAll(filters)
}

export async function getProduct(id: number): Promise<Product> {
  const product = await repo.findById(id)
  if (!product) throw new AppError(404, '货品不存在')
  return product
}

export async function createProduct(dto: CreateProductDto): Promise<Product> {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const id = await repo.create(dto, conn)
    await invRepo.upsertInventoryRow(id, conn)
    await conn.commit()
    return getProduct(id)
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}

export async function updateProduct(id: number, dto: UpdateProductDto): Promise<Product> {
  const product = await repo.update(id, dto)
  if (!product) throw new AppError(404, '货品不存在')
  return product
}

export async function deleteProduct(id: number): Promise<void> {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    // Clean up operational inventory records before deleting the product.
    // Sales/purchase order items still have FK constraints and will throw if referenced.
    await conn.query('DELETE FROM inventory_adjustments WHERE product_id = ?', [id])
    await conn.query('DELETE FROM inventory WHERE product_id = ?', [id])
    const [result] = await conn.query<import('mysql2/promise').ResultSetHeader>(
      'DELETE FROM products WHERE id = ?', [id],
    )
    if (result.affectedRows === 0) throw new AppError(404, '货品不存在')
    await conn.commit()
  } catch (e: any) {
    await conn.rollback()
    if (e.code === 'ER_ROW_IS_REFERENCED_2') throw new AppError(409, `该货品有关联订单数据，无法删除（${e.sqlMessage}）`)
    throw e
  } finally {
    conn.release()
  }
}

export async function getNextProductCode(supplierId: number): Promise<string> {
  return repo.getNextCode(supplierId)
}

export async function getProductCategories(): Promise<string[]> {
  return repo.findCategories()
}
