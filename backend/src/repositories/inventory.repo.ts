import pool from '@/db/pool'
import { rowsToCamel } from '@/utils/camel'
import type { InventoryRow, InventoryAdjustment } from '@/dto/inventory.dto'
import type { RowDataPacket, PoolConnection } from 'mysql2/promise'

export async function findAll(
  filters: { supplierId?: number; category?: string; search?: string } = {},
): Promise<InventoryRow[]> {
  let sql = `
    SELECT i.product_id, CONCAT(s.code, '.', p.code) AS product_code, p.name AS product_name,
           s.name AS supplier_name, s.code AS supplier_code,
           p.category, p.unit, p.units_per_piece, i.quantity AS stock,
           DATE_FORMAT(i.updated_at, '%Y-%m-%d') AS last_updated
    FROM inventory i
    JOIN products p ON p.id = i.product_id
    JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.status = 1`
  const params: unknown[] = []
  if (filters.supplierId) {
    sql += ' AND p.supplier_id = ?'
    params.push(filters.supplierId)
  }
  if (filters.category) {
    sql += ' AND p.category = ?'
    params.push(filters.category)
  }
  if (filters.search) {
    sql += ' AND (p.name LIKE ? OR CONCAT(s.code, \'.\', p.code) LIKE ?)'
    params.push(`%${filters.search}%`, `%${filters.search}%`)
  }
  sql += ' ORDER BY s.code ASC, p.code ASC'
  const [rows] = await pool.query<RowDataPacket[]>(sql, params)
  return rowsToCamel<InventoryRow>(rows as Record<string, unknown>[])
}

export async function findAdjustments(productId?: number): Promise<InventoryAdjustment[]> {
  let sql = `
    SELECT ia.id, ia.product_id, CONCAT(s.code, '.', p.code) AS product_code, p.name AS product_name,
           ia.type, ia.qty_before, ia.qty_change, ia.qty_after,
           ia.reason, ia.ref_type, ia.ref_id, COALESCE(u.name, ia.operator) AS operator,
           DATE_FORMAT(ia.created_at, '%Y-%m-%d %H:%i') AS created_at
    FROM inventory_adjustments ia
    JOIN products p ON p.id = ia.product_id
    JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN users u ON u.username = ia.operator
    WHERE 1=1`
  const params: unknown[] = []
  if (productId) {
    sql += ' AND ia.product_id = ?'
    params.push(productId)
  }
  sql += ' ORDER BY ia.created_at DESC LIMIT 200'
  const [rows] = await pool.query<RowDataPacket[]>(sql, params)
  return rowsToCamel<InventoryAdjustment>(rows as Record<string, unknown>[])
}

export async function getQuantity(productId: number, conn?: PoolConnection): Promise<number> {
  const db = conn ?? pool
  const [rows] = await db.query<RowDataPacket[]>(
    'SELECT quantity FROM inventory WHERE product_id = ?',
    [productId],
  )
  return Number((rows as RowDataPacket[])[0]?.quantity ?? 0)
}

export async function setQuantity(
  productId: number,
  qty: number,
  conn: PoolConnection,
): Promise<void> {
  await conn.query('UPDATE inventory SET quantity = ? WHERE product_id = ?', [qty, productId])
}

export async function incrementQuantity(
  productId: number,
  delta: number,
  conn: PoolConnection,
): Promise<void> {
  await conn.query(
    `INSERT INTO inventory (product_id, quantity) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
    [productId, delta, delta],
  )
}

export async function logAdjustment(
  params: {
    productId: number
    type: 'in' | 'out' | 'adjust'
    qtyBefore: number
    qtyChange: number
    qtyAfter: number
    reason?: string
    refType: string
    refId?: number
    operator?: string
  },
  conn: PoolConnection,
): Promise<void> {
  await conn.query(
    `INSERT INTO inventory_adjustments
       (product_id, type, qty_before, qty_change, qty_after, reason, ref_type, ref_id, operator)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.productId,
      params.type,
      params.qtyBefore,
      params.qtyChange,
      params.qtyAfter,
      params.reason ?? null,
      params.refType,
      params.refId ?? null,
      params.operator ?? null,
    ],
  )
}

export async function upsertInventoryRow(productId: number, conn: PoolConnection): Promise<void> {
  await conn.query('INSERT IGNORE INTO inventory (product_id, quantity) VALUES (?, 0)', [productId])
}
