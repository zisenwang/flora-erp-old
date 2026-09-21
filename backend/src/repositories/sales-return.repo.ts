import pool from '@/db/pool'
import { rowToCamel, rowsToCamel } from '@/utils/camel'
import type { SalesReturn, SalesReturnItem } from '@/dto/sales-return.dto'
import type { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise'

const RETURN_SELECT = `
  SELECT sr.id, sr.return_no, sr.customer_id, c.name AS customer_name, c.code AS customer_code,
         c.phone AS customer_phone, c.address AS customer_address,
         sr.original_order_id,
         DATE_FORMAT(sr.date, '%Y-%m-%d') AS return_date,
         sr.total_qty, sr.total_pieces, sr.total_amount,
         sr.operator, sr.notes, sr.created_at
  FROM sales_returns sr
  JOIN customers c ON c.id = sr.customer_id`

const ITEM_SELECT = `
  SELECT sri.id, sri.product_id, CONCAT(s.code, '.', p.code) AS product_code, p.name AS product_name,
         s.code AS supplier_code, p.unit, sri.qty, sri.pieces, sri.unit_price, sri.amount, sri.notes
  FROM sales_return_items sri
  JOIN products p ON p.id = sri.product_id
  JOIN suppliers s ON s.id = p.supplier_id
  WHERE sri.return_id = ?
  ORDER BY sri.id ASC`

export async function findAll(filters: {
  customerId?: number
  startDate?: string
  endDate?: string
  search?: string
  searchField?: string
} = {}): Promise<SalesReturn[]> {
  let sql = RETURN_SELECT + ' WHERE 1=1'
  const params: unknown[] = []
  if (filters.customerId) { sql += ' AND sr.customer_id = ?'; params.push(filters.customerId) }
  if (filters.startDate) { sql += ' AND sr.date >= ?'; params.push(filters.startDate) }
  if (filters.endDate) { sql += ' AND sr.date <= ?'; params.push(filters.endDate) }
  if (filters.search) {
    const like = `%${filters.search}%`
    if (filters.searchField === 'notes') {
      sql += ' AND sr.notes LIKE ?'
      params.push(like)
    } else if (filters.searchField === 'customerName') {
      sql += ' AND c.name LIKE ?'
      params.push(like)
    } else if (filters.searchField === 'customerCode') {
      sql += ' AND c.code LIKE ?'
      params.push(like)
    } else if (filters.searchField === 'orderNo') {
      sql += ' AND sr.return_no LIKE ?'
      params.push(like)
    } else if (filters.searchField === 'operator') {
      sql += ' AND sr.operator LIKE ?'
      params.push(like)
    } else {
      sql += ` AND (c.name LIKE ? OR c.code LIKE ? OR sr.return_no LIKE ?
        OR EXISTS (
          SELECT 1 FROM sales_return_items sri2
          JOIN products p2 ON p2.id = sri2.product_id
          WHERE sri2.return_id = sr.id AND (p2.name LIKE ? OR p2.code LIKE ?)
        ))`
      params.push(like, like, like, like, like)
    }
  }
  sql += ' ORDER BY sr.date DESC, sr.id DESC'
  const [rows] = await pool.query<RowDataPacket[]>(sql, params)
  return rowsToCamel<SalesReturn>(rows as Record<string, unknown>[])
}

export async function findById(id: number): Promise<SalesReturn | null> {
  const [rows] = await pool.query<RowDataPacket[]>(`${RETURN_SELECT} WHERE sr.id = ?`, [id])
  if (!rows.length) return null
  const ret = rowToCamel<SalesReturn>(rows[0] as Record<string, unknown>)
  const [itemRows] = await pool.query<RowDataPacket[]>(ITEM_SELECT, [id])
  ret.items = rowsToCamel<SalesReturnItem>(itemRows as Record<string, unknown>[])
  return ret
}

export async function insertReturn(data: {
  customerId: number
  originalOrderId: number | null
  date: string
  totalQty: number
  totalPieces: number
  totalAmount: number
  operator: string | null
  notes: string | null
}, conn: PoolConnection): Promise<number> {
  const [result] = await conn.query<ResultSetHeader>(
    `INSERT INTO sales_returns
       (return_no, customer_id, original_order_id, date, total_qty, total_pieces, total_amount, operator, notes)
     VALUES ('PENDING', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.customerId, data.originalOrderId, data.date, data.totalQty, data.totalPieces, data.totalAmount, data.operator, data.notes],
  )
  return result.insertId
}

export async function setReturnNo(id: number, returnNo: string, conn: PoolConnection): Promise<void> {
  await conn.query('UPDATE sales_returns SET return_no = ? WHERE id = ?', [returnNo, id])
}

export async function countByDate(date: string, id: number, conn: PoolConnection): Promise<number> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(return_no, '_D', -1) AS UNSIGNED)), 0) + 1 AS next_seq
     FROM sales_returns WHERE YEAR(date) = YEAR(?) AND MONTH(date) = MONTH(?) AND id != ? AND return_no != 'PENDING'`,
    [date, date, id],
  )
  return Number((rows as RowDataPacket[])[0].next_seq)
}

export async function updateReturnTotals(id: number, data: {
  customerId: number
  originalOrderId: number | null
  date: string
  totalQty: number
  totalPieces: number
  totalAmount: number
  notes: string | null
}, conn: PoolConnection): Promise<void> {
  await conn.query(
    `UPDATE sales_returns
     SET customer_id=?, original_order_id=?, date=?, total_qty=?, total_pieces=?, total_amount=?, notes=?
     WHERE id=?`,
    [data.customerId, data.originalOrderId, data.date, data.totalQty, data.totalPieces, data.totalAmount, data.notes, id],
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
    `INSERT INTO sales_return_items (return_id, product_id, qty, pieces, unit_price, amount, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [returnId, item.productId, item.qty, item.pieces, item.unitPrice, item.amount, item.notes],
  )
}

export async function deleteItems(returnId: number, conn: PoolConnection): Promise<{ productId: number; qty: number }[]> {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT product_id, qty FROM sales_return_items WHERE return_id = ?', [returnId],
  )
  await conn.query('DELETE FROM sales_return_items WHERE return_id = ?', [returnId])
  return (rows as RowDataPacket[]).map(r => ({ productId: r.product_id as number, qty: r.qty as number }))
}
