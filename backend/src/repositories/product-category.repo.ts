import pool from '@/db/pool'
import { rowToCamel, rowsToCamel } from '@/utils/camel'
import type { ProductCategory } from '@/dto/product-category.dto'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import { AppError } from '@/services/supplier.service'

// products.category holds the category id (as text)
const SELECT = `
  SELECT pc.id, pc.name, pc.operator,
         DATE_FORMAT(pc.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
         DATE_FORMAT(pc.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
         (SELECT COUNT(*) FROM products p WHERE p.category = pc.id) AS product_count
  FROM product_categories pc`

export async function findAll(): Promise<ProductCategory[]> {
  const [rows] = await pool.query<RowDataPacket[]>(`${SELECT} ORDER BY pc.id ASC`)
  return rowsToCamel<ProductCategory>(rows as Record<string, unknown>[])
}

export async function findById(id: number): Promise<ProductCategory | null> {
  const [rows] = await pool.query<RowDataPacket[]>(`${SELECT} WHERE pc.id = ?`, [id])
  return rows.length ? rowToCamel<ProductCategory>(rows[0] as Record<string, unknown>) : null
}

export async function create(name: string, operator: string | null): Promise<number> {
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO product_categories (name, operator) VALUES (?, ?)',
      [name, operator],
    )
    return result.insertId
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') throw new AppError(409, '分类名称已存在')
    throw err
  }
}

export async function update(id: number, name: string, operator: string | null): Promise<boolean> {
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE product_categories SET name = ?, operator = ? WHERE id = ?',
      [name, operator, id],
    )
    return result.affectedRows > 0
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') throw new AppError(409, '分类名称已存在')
    throw err
  }
}

export async function remove(id: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>('DELETE FROM product_categories WHERE id = ?', [id])
  return result.affectedRows > 0
}
