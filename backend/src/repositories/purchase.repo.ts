import pool from '@/db/pool'
import { rowToCamel, rowsToCamel } from '@/utils/camel'
import type { PurchaseOrder, PurchaseOrderItem, PurchaseDetailRow } from '@/dto/purchase.dto'
import type { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise'

const ORDER_SELECT = `
  SELECT po.id, po.order_no, po.supplier_id, s.name AS supplier_name, s.code AS supplier_code,
         s.phone AS supplier_phone,
         DATE_FORMAT(po.date, '%Y-%m-%d') AS order_date,
         po.total_qty, po.total_pieces, po.total_amount, po.discount, po.final_amount,
         po.operator, po.notes, po.status, po.created_at
  FROM purchase_orders po
  JOIN suppliers s ON s.id = po.supplier_id`

const ITEM_SELECT = `
  SELECT poi.id, poi.product_id, CONCAT(s.code, '.', p.code) AS product_code, p.name AS product_name,
         p.category, p.grade, p.unit, poi.qty, poi.pieces, poi.unit_price, poi.amount,
         poi.discount, poi.final_amount, poi.notes
  FROM purchase_order_items poi
  JOIN products p ON p.id = poi.product_id
  JOIN suppliers s ON s.id = p.supplier_id
  WHERE poi.order_id = ?
  ORDER BY poi.id ASC`

export async function findAll(
  filters: {
    supplierId?: number
    startDate?: string
    endDate?: string
    search?: string
    searchField?: string
  } = {},
): Promise<PurchaseOrder[]> {
  let sql = ORDER_SELECT + ' WHERE 1=1'
  const params: unknown[] = []
  if (filters.supplierId) {
    sql += ' AND po.supplier_id = ?'
    params.push(filters.supplierId)
  }
  if (filters.startDate) {
    sql += ' AND po.date >= ?'
    params.push(filters.startDate)
  }
  if (filters.endDate) {
    sql += ' AND po.date <= ?'
    params.push(filters.endDate)
  }
  if (filters.search) {
    const like = `%${filters.search}%`
    if (filters.searchField === 'notes') {
      sql += ' AND po.notes LIKE ?'
      params.push(like)
    } else if (filters.searchField === 'supplierName') {
      sql += ' AND s.name LIKE ?'
      params.push(like)
    } else if (filters.searchField === 'supplierCode') {
      sql += ' AND s.code LIKE ?'
      params.push(like)
    } else if (filters.searchField === 'orderNo') {
      sql += ' AND po.order_no LIKE ?'
      params.push(like)
    } else if (filters.searchField === 'operator') {
      sql += ' AND po.operator LIKE ?'
      params.push(like)
    } else {
      sql += ` AND (s.name LIKE ? OR s.code LIKE ? OR po.order_no LIKE ?
        OR EXISTS (
          SELECT 1 FROM purchase_order_items poi2
          JOIN products p2 ON p2.id = poi2.product_id
          WHERE poi2.order_id = po.id AND (p2.name LIKE ? OR p2.code LIKE ?)
        ))`
      params.push(like, like, like, like, like)
    }
  }
  sql += ' ORDER BY po.date DESC, po.id DESC'
  const [rows] = await pool.query<RowDataPacket[]>(sql, params)
  return rowsToCamel<PurchaseOrder>(rows as Record<string, unknown>[])
}

export async function findById(id: number): Promise<PurchaseOrder | null> {
  const [rows] = await pool.query<RowDataPacket[]>(`${ORDER_SELECT} WHERE po.id = ?`, [id])
  if (!rows.length) return null
  const order = rowToCamel<PurchaseOrder>(rows[0] as Record<string, unknown>)
  const [itemRows] = await pool.query<RowDataPacket[]>(ITEM_SELECT, [id])
  order.items = rowsToCamel<PurchaseOrderItem>(itemRows as Record<string, unknown>[])
  return order
}

export async function insertOrder(
  data: {
    supplierId: number
    date: string
    totalQty: number
    totalPieces: number
    totalAmount: number
    discount: number
    finalAmount: number
    operator: string | null
    notes: string | null
  },
  conn: PoolConnection,
): Promise<number> {
  const [result] = await conn.query<ResultSetHeader>(
    `INSERT INTO purchase_orders
       (order_no, supplier_id, date, total_qty, total_pieces, total_amount, discount, final_amount, operator, notes)
     VALUES ('PENDING', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.supplierId,
      data.date,
      data.totalQty,
      data.totalPieces,
      data.totalAmount,
      data.discount,
      data.finalAmount,
      data.operator,
      data.notes,
    ],
  )
  return result.insertId
}

export async function setOrderNo(id: number, orderNo: string, conn: PoolConnection): Promise<void> {
  await conn.query('UPDATE purchase_orders SET order_no = ? WHERE id = ?', [orderNo, id])
}

export async function countByDate(date: string, id: number, conn: PoolConnection): Promise<number> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(order_no, '_D', -1) AS UNSIGNED)), 0) + 1 AS next_seq
     FROM purchase_orders WHERE YEAR(date) = YEAR(?) AND MONTH(date) = MONTH(?) AND id != ? AND order_no != 'PENDING'`,
    [date, date, id],
  )
  return Number((rows as RowDataPacket[])[0].next_seq)
}

export async function updateOrderTotals(
  id: number,
  data: {
    supplierId: number
    date: string
    totalQty: number
    totalPieces: number
    totalAmount: number
    discount: number
    finalAmount: number
    notes: string | null
  },
  conn: PoolConnection,
): Promise<void> {
  await conn.query(
    `UPDATE purchase_orders
     SET supplier_id=?, date=?, total_qty=?, total_pieces=?, total_amount=?, discount=?, final_amount=?, notes=?, status='已入库'
     WHERE id=?`,
    [
      data.supplierId,
      data.date,
      data.totalQty,
      data.totalPieces,
      data.totalAmount,
      data.discount,
      data.finalAmount,
      data.notes,
      id,
    ],
  )
}

export async function insertItem(
  orderId: number,
  item: {
    productId: number
    qty: number
    pieces: number
    unitPrice: number
    amount: number
    discount: number
    finalAmount: number
    notes: string | null
  },
  conn: PoolConnection,
): Promise<void> {
  await conn.query(
    `INSERT INTO purchase_order_items
       (order_id, product_id, qty, pieces, unit_price, amount, discount, final_amount, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [orderId, item.productId, item.qty, item.pieces, item.unitPrice, item.amount, item.discount, item.finalAmount, item.notes],
  )
}

export async function deleteItems(
  orderId: number,
  conn: PoolConnection,
): Promise<{ productId: number; qty: number }[]> {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT product_id, qty FROM purchase_order_items WHERE order_id = ?',
    [orderId],
  )
  await conn.query('DELETE FROM purchase_order_items WHERE order_id = ?', [orderId])
  return (rows as RowDataPacket[]).map((r) => ({
    productId: r.product_id as number,
    qty: r.qty as number,
  }))
}

export async function findDetail(
  filters: {
    startDate?: string
    endDate?: string
    search?: string
    searchField?: string
  } = {},
): Promise<PurchaseDetailRow[]> {
  const params: unknown[] = []
  const returnParams: unknown[] = []

  // Build WHERE clauses for orders side
  let orderWhere = 'WHERE 1=1'
  if (filters.startDate) {
    orderWhere += ' AND po.date >= ?'
    params.push(filters.startDate)
  }
  if (filters.endDate) {
    orderWhere += ' AND po.date <= ?'
    params.push(filters.endDate)
  }
  if (filters.search) {
    const like = `%${filters.search}%`
    const sf = filters.searchField
    if (!sf || sf === 'all') {
      orderWhere += ' AND (s.name LIKE ? OR s.code LIKE ? OR po.order_no LIKE ?)'
      params.push(like, like, like)
    } else if (sf === 'supplierName') { orderWhere += ' AND s.name LIKE ?'; params.push(like) }
    else if (sf === 'supplierCode')   { orderWhere += ' AND s.code LIKE ?'; params.push(like) }
    else if (sf === 'orderNo')        { orderWhere += ' AND po.order_no LIKE ?'; params.push(like) }
    else if (sf === 'productCode')    { orderWhere += ' AND CONCAT(s.code, \'.\', p.code) LIKE ?'; params.push(like) }
    else if (sf === 'productName')    { orderWhere += ' AND p.name LIKE ?'; params.push(like) }
    else if (sf === 'operator')       { orderWhere += ' AND po.operator LIKE ?'; params.push(like) }
    else if (sf === 'notes')          { orderWhere += ' AND poi.notes LIKE ?'; params.push(like) }
  }

  // Build WHERE clauses for returns side
  let returnWhere = 'WHERE 1=1'
  if (filters.startDate) {
    returnWhere += ' AND pr.date >= ?'
    returnParams.push(filters.startDate)
  }
  if (filters.endDate) {
    returnWhere += ' AND pr.date <= ?'
    returnParams.push(filters.endDate)
  }
  if (filters.search) {
    const like = `%${filters.search}%`
    const sf = filters.searchField
    if (!sf || sf === 'all') {
      returnWhere += ' AND (s.name LIKE ? OR s.code LIKE ? OR pr.return_no LIKE ?)'
      returnParams.push(like, like, like)
    } else if (sf === 'supplierName') { returnWhere += ' AND s.name LIKE ?'; returnParams.push(like) }
    else if (sf === 'supplierCode')   { returnWhere += ' AND s.code LIKE ?'; returnParams.push(like) }
    else if (sf === 'orderNo')        { returnWhere += ' AND pr.return_no LIKE ?'; returnParams.push(like) }
    else if (sf === 'productCode')    { returnWhere += ' AND CONCAT(s.code, \'.\', p.code) LIKE ?'; returnParams.push(like) }
    else if (sf === 'productName')    { returnWhere += ' AND p.name LIKE ?'; returnParams.push(like) }
    else if (sf === 'operator')       { returnWhere += ' AND pr.operator LIKE ?'; returnParams.push(like) }
    else if (sf === 'notes')          { returnWhere += ' AND pri.notes LIKE ?'; returnParams.push(like) }
  }

  const sql = `
    SELECT
      'order' AS row_type,
      po.id AS id,
      po.order_no AS no,
      DATE_FORMAT(po.date, '%Y-%m-%d') AS date,
      s.code AS supplier_code, s.name AS supplier_name,
      CONCAT(s.code, '.', p.code) AS product_code, p.name AS product_name,
      p.unit AS unit,
      poi.qty, poi.unit_price, poi.final_amount AS amount, poi.pieces,
      po.operator, poi.notes, po.status,
      po.date AS _sort_date, po.id AS _sort_id
    FROM purchase_orders po
    JOIN purchase_order_items poi ON poi.order_id = po.id
    JOIN products p ON p.id = poi.product_id
    JOIN suppliers s ON s.id = po.supplier_id
    ${orderWhere}

    UNION ALL

    SELECT
      'return' AS row_type,
      pr.id AS id,
      pr.return_no AS no,
      DATE_FORMAT(pr.date, '%Y-%m-%d') AS date,
      s.code AS supplier_code, s.name AS supplier_name,
      CONCAT(s.code, '.', p.code) AS product_code, p.name AS product_name,
      p.unit AS unit,
      pri.qty, pri.unit_price, pri.amount AS amount, pri.pieces,
      pr.operator, pri.notes, NULL AS status,
      pr.date AS _sort_date, pr.id AS _sort_id
    FROM purchase_returns pr
    JOIN purchase_return_items pri ON pri.return_id = pr.id
    JOIN products p ON p.id = pri.product_id
    JOIN suppliers s ON s.id = pr.supplier_id
    ${returnWhere}

    ORDER BY _sort_date DESC, _sort_id DESC
  `

  const [rows] = await pool.query<RowDataPacket[]>(sql, [...params, ...returnParams])
  return rowsToCamel<PurchaseDetailRow>(rows as Record<string, unknown>[])
}
