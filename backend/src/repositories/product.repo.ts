import pool from '@/db/pool'
import { rowToCamel, rowsToCamel } from '@/utils/camel'
import type { Product, CreateProductDto, UpdateProductDto } from '@/dto/product.dto'
import type { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise'
import { AppError } from '@/services/supplier.service'

const SELECT = `
  SELECT p.id, CONCAT(s.code, '.', p.code) AS code, p.name, p.supplier_id,
         s.name AS supplier_name, s.code AS supplier_code,
         p.category, p.grade, p.spec, p.unit, p.cost_price, p.price, p.units_per_piece,
         p.status, COALESCE(i.quantity, 0) AS stock
  FROM products p
  JOIN suppliers s ON s.id = p.supplier_id
  LEFT JOIN inventory i ON i.product_id = p.id`

export async function findAll(
  filters: { supplierId?: number; search?: string } = {},
): Promise<Product[]> {
  let sql = SELECT + ' WHERE 1=1'
  const params: unknown[] = []
  if (filters.supplierId) {
    sql += ' AND p.supplier_id = ?'
    params.push(filters.supplierId)
  }
  if (filters.search) {
    sql += ' AND (p.name LIKE ? OR CONCAT(s.code, \'.\', p.code) LIKE ?)'
    params.push(`%${filters.search}%`, `%${filters.search}%`)
  }
  sql += ' ORDER BY s.code ASC, p.code ASC'
  const [rows] = await pool.query<RowDataPacket[]>(sql, params)
  return rowsToCamel<Product>(rows as Record<string, unknown>[])
}

export async function findById(id: number): Promise<Product | null> {
  const [rows] = await pool.query<RowDataPacket[]>(`${SELECT} WHERE p.id = ?`, [id])
  return rows.length ? rowToCamel<Product>(rows[0] as Record<string, unknown>) : null
}

export async function create(dto: CreateProductDto, conn: PoolConnection): Promise<number> {
  try {
    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO products (code, name, supplier_id, category, grade, spec, unit, cost_price, price, units_per_piece)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dto.code,
        dto.name,
        dto.supplierId,
        dto.category ?? null,
        dto.grade ?? null,
        dto.spec ?? null,
        dto.unit ?? '盆',
        dto.costPrice ?? null,
        dto.price ?? null,
        dto.unitsPerPiece ?? null,
      ],
    )
    return result.insertId
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') throw new AppError(409, '货品编码已存在')
    if (err.code === 'ER_NO_REFERENCED_ROW_2') throw new AppError(400, '供应商不存在')
    throw err
  }
}

export async function update(id: number, dto: UpdateProductDto): Promise<Product | null> {
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE products SET code=?, name=?, supplier_id=?, category=?, grade=?, spec=?,
       unit=?, cost_price=?, price=?, units_per_piece=?, status=? WHERE id=?`,
      [
        dto.code,
        dto.name,
        dto.supplierId,
        dto.category ?? null,
        dto.grade ?? null,
        dto.spec ?? null,
        dto.unit ?? '盆',
        dto.costPrice ?? null,
        dto.price ?? null,
        dto.unitsPerPiece ?? null,
        dto.status ?? 1,
        id,
      ],
    )
    if (result.affectedRows === 0) return null
    return findById(id)
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') throw new AppError(409, '货品编码已存在')
    throw err
  }
}

export async function getNextCode(supplierId: number): Promise<string> {
  const [allRows] = await pool.query<RowDataPacket[]>(
    'SELECT code FROM products WHERE supplier_id = ? ORDER BY updated_at DESC',
    [supplierId],
  )
  const lastSeq = allRows[0]?.code ? Number(allRows[0].code) || 0 : 0
  const occupied = new Set(allRows.map((r: RowDataPacket) => String(r.code)))

  let candidate = lastSeq + 1
  while (occupied.has(String(candidate))) candidate++
  return String(candidate)
}

export async function updateCostPrice(
  id: number,
  costPrice: number,
  conn: PoolConnection,
): Promise<void> {
  await conn.query('UPDATE products SET cost_price = ? WHERE id = ?', [costPrice, id])
}

export async function updatePrice(
  id: number,
  price: number,
  conn: PoolConnection,
): Promise<void> {
  await conn.query('UPDATE products SET price = ? WHERE id = ?', [price, id])
}

export async function remove(id: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>('DELETE FROM products WHERE id = ?', [id])
  return result.affectedRows > 0
}


export async function findCategories(): Promise<string[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT DISTINCT category FROM products WHERE status = 1 AND category IS NOT NULL AND category != '' ORDER BY category",
  )
  return (rows as RowDataPacket[]).map(r => r.category as string)
}
