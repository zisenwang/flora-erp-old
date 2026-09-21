import pool from '@/db/pool'
import { rowToCamel, rowsToCamel } from '@/utils/camel'
import type { PurchaseReturn, PurchaseReturnItem } from '@/dto/purchase-return.dto'
import type { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise'

const RETURN_SELECT = `
  SELECT pr.id, pr.return_no, pr.supplier_id, s.name AS supplier_name, s.code AS supplier_code,
         s.phone AS supplier_phone, s.address AS supplier_address,
         pr.original_order_id,
         DATE_FORMAT(pr.date, '%Y-%m-%d') AS return_date,
         pr.total_qty, pr.total_pieces, pr.total_amount,
         pr.operator, pr.notes, pr.created_at
  FROM purchase_returns pr
  JOIN suppliers s ON s.id = pr.supplier_id`

const ITEM_SELECT = `
  SELECT pri.id, pri.product_id, CONCAT(s.code, '.', p.code) AS product_code, p.name AS product_name,
         p.category, p.grade, p.unit, pri.qty, pri.pieces, pri.unit_price, pri.amount, pri.notes
  FROM purchase_return_items pri
  JOIN products p ON p.id = pri.product_id
  JOIN suppliers s ON s.id = p.supplier_id
  WHERE pri.return_id = ?
  ORDER BY pri.id ASC`

export async function findAll(filters: {
  supplierId?: number
  startDate?: string
  endDate?: string
  search?: string
  searchField?: string
} = {}): Promise<PurchaseReturn[]> {
  let sql = RETURN_SELECT + ' WHERE 1=1'
  const params: unknown[] = []
  if (filters.supplierId) { sql += ' AND pr.supplier_id = ?'; params.push(filters.supplierId) }
  if (filters.startDate) { sql += ' AND pr.date >= ?'; params.push(filters.startDate) }
  if (filters.endDate) { sql += ' AND pr.date <= ?'; params.push(filters.endDate) }
  if (filters.search) {
    const like = `%${filters.search}%`
    if (filters.searchField === 'notes') {
      sql += ' AND pr.notes LIKE ?'
      params.push(like)
    } else if (filters.searchField === 'supplierName') {
      sql += ' AND s.name LIKE ?'
      params.push(like)
    } else if (filters.searchField === 'supplierCode') {
      sql += ' AND s.code LIKE ?'
      params.push(like)
    } else if (filters.searchField === 'orderNo') {
      sql += ' AND pr.return_no LIKE ?'
      params.push(like)
    } else if (filters.searchField === 'operator') {
      sql += ' AND pr.operator LIKE ?'
      params.push(like)
    } else {
      sql += ` AND (s.name LIKE ? OR s.code LIKE ? OR pr.return_no LIKE ?
        OR EXISTS (
          SELECT 1 FROM purchase_return_items pri2
          JOIN products p2 ON p2.id = pri2.product_id
          WHERE pri2.return_id = pr.id AND (p2.name LIKE ? OR p2.code LIKE ?)
        ))`
      params.push(like, like, like, like, like)
    }
  }
  sql += ' ORDER BY pr.date DESC, pr.id DESC'
  const [rows] = await pool.query<RowDataPacket[]>(sql, params)
  return rowsToCamel<PurchaseReturn>(rows as Record<string, unknown>[])
}

export async function findById(id: number): Promise<PurchaseReturn | null> {
  const [rows] = await pool.query<RowDataPacket[]>(`${RETURN_SELECT} WHERE pr.id = ?`, [id])
  if (!rows.length) return null
  const ret = rowToCamel<PurchaseReturn>(rows[0] as Record<string, unknown>)
  const [itemRows] = await pool.query<RowDataPacket[]>(ITEM_SELECT, [id])
  ret.items = rowsToCamel<PurchaseReturnItem>(itemRows as Record<string, unknown>[])
  return ret
}

export async function insertReturn(data: {
  supplierId: number
  originalOrderId: number | null
  date: string
  totalQty: number
  totalPieces: number
  totalAmount: number
  operator: string | null
  notes: string | null
}, conn: PoolConnection): Promise<number> {
  const [result] = await conn.query<ResultSetHeader>(
    `INSERT INTO purchase_returns
       (return_no, supplier_id, original_order_id, date, total_qty, total_pieces, total_amount, operator, notes)
     VALUES ('PENDING', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.supplierId, data.originalOrderId, data.date, data.totalQty, data.totalPieces, data.totalAmount, data.operator, data.notes],
  )
  return result.insertId
}

export async function setReturnNo(id: number, returnNo: string, conn: PoolConnection): Promise<void> {
  await conn.query('UPDATE purchase_returns SET return_no = ? WHERE id = ?', [returnNo, id])
}

export async function countByDate(date: string, id: number, conn: PoolConnection): Promise<number> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(return_no, '_D', -1) AS UNSIGNED)), 0) + 1 AS next_seq
     FROM purchase_returns WHERE YEAR(date) = YEAR(?) AND MONTH(date) = MONTH(?) AND id != ? AND return_no != 'PENDING'`,
    [date, date, id],
  )
  return Number((rows as RowDataPacket[])[0].next_seq)
}

export async function updateReturnTotals(id: number, data: {
  supplierId: number
  originalOrderId: number | null
  date: string
  totalQty: number
  totalPieces: number
  totalAmount: number
  notes: string | null
}, conn: PoolConnection): Promise<void> {
  await conn.query(
    `UPDATE purchase_returns
     SET supplier_id=?, original_order_id=?, date=?, total_qty=?, total_pieces=?, total_amount=?, notes=?
     WHERE id=?`,
    [data.supplierId, data.originalOrderId, data.date, data.totalQty, data.totalPieces, data.totalAmount, data.notes, id],
  )
}

export async function insertItem(returnId: number, item: {
  productId: number
  qty: number
  pieces: number
  unitPrice: number
  amount: number
  notes: string | null
}, conn: PoolConnection): Promise<void> {
  await conn.query(
    `INSERT INTO purchase_return_items (return_id, product_id, qty, pieces, unit_price, amount, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [returnId, item.productId, item.qty, item.pieces, item.unitPrice, item.amount, item.notes],
  )
}

export async function deleteItems(returnId: number, conn: PoolConnection): Promise<{ productId: number; qty: number }[]> {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT product_id, qty FROM purchase_return_items WHERE return_id = ?', [returnId],
  )
  await conn.query('DELETE FROM purchase_return_items WHERE return_id = ?', [returnId])
  return (rows as RowDataPacket[]).map(r => ({ productId: r.product_id as number, qty: r.qty as number }))
}
