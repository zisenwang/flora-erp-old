import pool from '@/db/pool'
import { rowToCamel, rowsToCamel } from '@/utils/camel'
import type { SalesOrder, SalesOrderItem, SalesDetailRow } from '@/dto/sales.dto'
import type { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise'

const ORDER_SELECT = `
  SELECT so.id, so.order_no, so.customer_id, c.name AS customer_name, c.code AS customer_code,
         c.phone AS customer_phone, c.address AS customer_address,
         DATE_FORMAT(so.date, '%Y-%m-%d') AS order_date,
         so.total_qty, so.total_amount, so.total_pieces,
         so.payment_status, so.operator, so.notes, so.status,
         so.created_at
  FROM sales_orders so
  JOIN customers c ON c.id = so.customer_id`

// Used for list queries — includes per-order profit aggregated from items
const ORDER_SELECT_LIST = `
  SELECT so.id, so.order_no, so.customer_id, c.name AS customer_name, c.code AS customer_code,
         c.phone AS customer_phone, c.address AS customer_address,
         DATE_FORMAT(so.date, '%Y-%m-%d') AS order_date,
         so.total_qty, so.total_amount, so.total_pieces,
         so.payment_status, so.operator, so.notes, so.status, so.created_at,
         COALESCE(SUM(soi.final_amount - COALESCE(soi.cost_price, 0) * soi.qty), 0) AS total_profit
  FROM sales_orders so
  JOIN customers c ON c.id = so.customer_id
  LEFT JOIN sales_order_items soi ON soi.order_id = so.id`

const ITEM_SELECT = `
  SELECT soi.id, soi.product_id, CONCAT(s.code, '.', p.code) AS product_code, p.name AS product_name,
         soi.supplier_id, s.code AS supplier_code, s.name AS supplier_name,
         p.unit, soi.qty, soi.unit_price, soi.amount,
         soi.discount, soi.final_amount, soi.cost_price, soi.pieces, soi.notes
  FROM sales_order_items soi
  JOIN products p ON p.id = soi.product_id
  JOIN suppliers s ON s.id = soi.supplier_id
  WHERE soi.order_id = ?
  ORDER BY soi.id ASC`

export async function findAll(
  filters: {
    customerId?: number
    paymentStatus?: string
    startDate?: string
    endDate?: string
    search?: string
    searchField?: string
  } = {},
): Promise<SalesOrder[]> {
  let sql = ORDER_SELECT_LIST + ' WHERE 1=1'
  const params: unknown[] = []
  if (filters.customerId) {
    sql += ' AND so.customer_id = ?'
    params.push(filters.customerId)
  }
  if (filters.paymentStatus) {
    sql += ' AND so.payment_status = ?'
    params.push(filters.paymentStatus)
  }
  if (filters.startDate) {
    sql += ' AND so.date >= ?'
    params.push(filters.startDate)
  }
  if (filters.endDate) {
    sql += ' AND so.date <= ?'
    params.push(filters.endDate)
  }
  if (filters.search) {
    const like = `%${filters.search}%`
    if (filters.searchField === 'notes') {
      sql += ' AND so.notes LIKE ?'
      params.push(like)
    } else if (filters.searchField === 'customerName') {
      sql += ' AND c.name LIKE ?'
      params.push(like)
    } else if (filters.searchField === 'customerCode') {
      sql += ' AND c.code LIKE ?'
      params.push(like)
    } else if (filters.searchField === 'orderNo') {
      sql += ' AND so.order_no LIKE ?'
      params.push(like)
    } else if (filters.searchField === 'operator') {
      sql += ' AND so.operator LIKE ?'
      params.push(like)
    } else {
      sql += ` AND (c.name LIKE ? OR c.code LIKE ? OR so.order_no LIKE ?
        OR EXISTS (
          SELECT 1 FROM sales_order_items soi2
          JOIN products p2 ON p2.id = soi2.product_id
          WHERE soi2.order_id = so.id AND (p2.name LIKE ? OR p2.code LIKE ?)
        ))`
      params.push(like, like, like, like, like)
    }
  }
  sql += ' GROUP BY so.id, so.order_no, so.customer_id, c.name, c.code, c.phone, c.address, so.date, so.total_qty, so.total_amount, so.total_pieces, so.payment_status, so.operator, so.notes, so.status, so.created_at'
  sql += ' ORDER BY so.date DESC, so.id DESC'
  const [rows] = await pool.query<RowDataPacket[]>(sql, params)
  return rowsToCamel<SalesOrder>(rows as Record<string, unknown>[])
}

export async function findById(id: number): Promise<SalesOrder | null> {
  const [rows] = await pool.query<RowDataPacket[]>(`${ORDER_SELECT} WHERE so.id = ?`, [id])
  if (!rows.length) return null
  const order = rowToCamel<SalesOrder>(rows[0] as Record<string, unknown>)
  const [itemRows] = await pool.query<RowDataPacket[]>(ITEM_SELECT, [id])
  order.items = rowsToCamel<SalesOrderItem>(itemRows as Record<string, unknown>[])
  order.totalProfit = +order.items
    .reduce((s, i) => s + i.finalAmount - (i.costPrice ?? 0) * i.qty, 0)
    .toFixed(2)
  return order
}

export async function insertOrder(
  data: {
    customerId: number
    date: string
    totalQty: number
    totalAmount: number
    totalPieces: number
    operator: string | null
    notes: string | null
  },
  conn: PoolConnection,
): Promise<number> {
  const [result] = await conn.query<ResultSetHeader>(
    `INSERT INTO sales_orders
       (order_no, customer_id, date, total_qty, total_amount, total_pieces, operator, notes)
     VALUES ('PENDING', ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.customerId,
      data.date,
      data.totalQty,
      data.totalAmount,
      data.totalPieces,
      data.operator,
      data.notes,
    ],
  )
  return result.insertId
}

export async function setOrderNo(id: number, orderNo: string, conn: PoolConnection): Promise<void> {
  await conn.query('UPDATE sales_orders SET order_no = ? WHERE id = ?', [orderNo, id])
}

export async function countByDate(date: string, id: number, conn: PoolConnection): Promise<number> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(order_no, '_D', -1) AS UNSIGNED)), 0) + 1 AS next_seq
     FROM sales_orders WHERE YEAR(date) = YEAR(?) AND MONTH(date) = MONTH(?) AND id != ? AND order_no != 'PENDING'`,
    [date, date, id],
  )
  return Number((rows as RowDataPacket[])[0].next_seq)
}

export async function updateOrderTotals(
  id: number,
  data: {
    customerId: number
    date: string
    totalQty: number
    totalAmount: number
    totalPieces: number
    notes: string | null
  },
  conn: PoolConnection,
): Promise<void> {
  await conn.query(
    `UPDATE sales_orders
     SET customer_id=?, date=?, total_qty=?, total_amount=?, total_pieces=?, notes=?, status='confirmed'
     WHERE id=?`,
    [data.customerId, data.date, data.totalQty, data.totalAmount, data.totalPieces, data.notes, id],
  )
}

export async function insertItem(
  orderId: number,
  item: {
    productId: number
    supplierId: number
    qty: number
    unitPrice: number
    amount: number
    discount: number
    finalAmount: number
    costPrice: number | null
    pieces: number
    notes: string | null
  },
  conn: PoolConnection,
): Promise<void> {
  await conn.query(
    `INSERT INTO sales_order_items
       (order_id, product_id, supplier_id, qty, unit_price, amount, discount, final_amount, cost_price, pieces, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderId,
      item.productId,
      item.supplierId,
      item.qty,
      item.unitPrice,
      item.amount,
      item.discount,
      item.finalAmount,
      item.costPrice ?? null,
      item.pieces,
      item.notes,
    ],
  )
}

export async function deleteItems(
  orderId: number,
  conn: PoolConnection,
): Promise<{ productId: number; qty: number }[]> {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT product_id, qty FROM sales_order_items WHERE order_id = ?',
    [orderId],
  )
  await conn.query('DELETE FROM sales_order_items WHERE order_id = ?', [orderId])
  return (rows as RowDataPacket[]).map((r) => ({
    productId: r.product_id as number,
    qty: r.qty as number,
  }))
}

export async function findOrderForPayment(
  id: number,
  conn: PoolConnection,
): Promise<{ customerId: number; totalAmount: number } | null> {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT customer_id, total_amount FROM sales_orders WHERE id = ?',
    [id],
  )
  if (!(rows as RowDataPacket[]).length) return null
  const r = (rows as RowDataPacket[])[0]
  return { customerId: r.customer_id as number, totalAmount: Number(r.total_amount) }
}

export async function findPaymentStatus(id: number): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT payment_status FROM sales_orders WHERE id = ?',
    [id],
  )
  return ((rows as RowDataPacket[])[0]?.payment_status as string) ?? null
}

export async function updatePaymentStatus(
  orderId: number,
  status: '未收款' | '已收款' | '部分收款',
  conn: PoolConnection,
): Promise<void> {
  await conn.query('UPDATE sales_orders SET payment_status = ? WHERE id = ?', [status, orderId])
}

export async function findDetail(
  filters: {
    startDate?: string
    endDate?: string
    search?: string
    searchField?: string
  } = {},
): Promise<SalesDetailRow[]> {
  const params: unknown[] = []
  const returnParams: unknown[] = []

  // Build WHERE clauses for orders side
  let orderWhere = 'WHERE 1=1'
  if (filters.startDate) {
    orderWhere += ' AND so.date >= ?'
    params.push(filters.startDate)
  }
  if (filters.endDate) {
    orderWhere += ' AND so.date <= ?'
    params.push(filters.endDate)
  }
  if (filters.search) {
    const like = `%${filters.search}%`
    const sf = filters.searchField
    if (!sf || sf === 'all') {
      orderWhere += ' AND (c.name LIKE ? OR c.code LIKE ? OR so.order_no LIKE ?)'
      params.push(like, like, like)
    } else if (sf === 'customerName') { orderWhere += ' AND c.name LIKE ?'; params.push(like) }
    else if (sf === 'customerCode')   { orderWhere += ' AND c.code LIKE ?'; params.push(like) }
    else if (sf === 'orderNo')        { orderWhere += ' AND so.order_no LIKE ?'; params.push(like) }
    else if (sf === 'productCode')    { orderWhere += ' AND CONCAT(sup.code, \'.\', p.code) LIKE ?'; params.push(like) }
    else if (sf === 'productName')    { orderWhere += ' AND p.name LIKE ?'; params.push(like) }
    else if (sf === 'operator')       { orderWhere += ' AND so.operator LIKE ?'; params.push(like) }
    else if (sf === 'notes')          { orderWhere += ' AND soi.notes LIKE ?'; params.push(like) }
  }

  // Build WHERE clauses for returns side
  let returnWhere = 'WHERE 1=1'
  if (filters.startDate) {
    returnWhere += ' AND sr.date >= ?'
    returnParams.push(filters.startDate)
  }
  if (filters.endDate) {
    returnWhere += ' AND sr.date <= ?'
    returnParams.push(filters.endDate)
  }
  if (filters.search) {
    const like = `%${filters.search}%`
    const sf = filters.searchField
    if (!sf || sf === 'all') {
      returnWhere += ' AND (c.name LIKE ? OR c.code LIKE ? OR sr.return_no LIKE ?)'
      returnParams.push(like, like, like)
    } else if (sf === 'customerName') { returnWhere += ' AND c.name LIKE ?'; returnParams.push(like) }
    else if (sf === 'customerCode')   { returnWhere += ' AND c.code LIKE ?'; returnParams.push(like) }
    else if (sf === 'orderNo')        { returnWhere += ' AND sr.return_no LIKE ?'; returnParams.push(like) }
    else if (sf === 'productCode')    { returnWhere += ' AND CONCAT(sup.code, \'.\', p.code) LIKE ?'; returnParams.push(like) }
    else if (sf === 'productName')    { returnWhere += ' AND p.name LIKE ?'; returnParams.push(like) }
    else if (sf === 'operator')       { returnWhere += ' AND sr.operator LIKE ?'; returnParams.push(like) }
    else if (sf === 'notes')          { returnWhere += ' AND sri.notes LIKE ?'; returnParams.push(like) }
  }

  const sql = `
    SELECT
      'order' AS row_type,
      so.id AS id,
      so.order_no AS no,
      DATE_FORMAT(so.date, '%Y-%m-%d') AS date,
      c.code AS customer_code, c.name AS customer_name,
      CONCAT(sup.code, '.', p.code) AS product_code, p.name AS product_name,
      sup.code AS supplier_code,
      p.unit AS unit,
      soi.qty, soi.unit_price, soi.final_amount AS amount, soi.pieces,
      (soi.final_amount - COALESCE(soi.cost_price, 0) * soi.qty) AS profit,
      so.operator, soi.notes, so.status,
      so.date AS _sort_date, so.id AS _sort_id
    FROM sales_orders so
    JOIN sales_order_items soi ON soi.order_id = so.id
    JOIN products p ON p.id = soi.product_id
    JOIN suppliers sup ON sup.id = soi.supplier_id
    JOIN customers c ON c.id = so.customer_id
    ${orderWhere}

    UNION ALL

    SELECT
      'return' AS row_type,
      sr.id AS id,
      sr.return_no AS no,
      DATE_FORMAT(sr.date, '%Y-%m-%d') AS date,
      c.code AS customer_code, c.name AS customer_name,
      CONCAT(sup.code, '.', p.code) AS product_code, p.name AS product_name,
      sup.code AS supplier_code,
      p.unit AS unit,
      sri.qty, sri.unit_price, sri.amount AS amount, sri.pieces,
      NULL AS profit,
      sr.operator, sri.notes, NULL AS status,
      sr.date AS _sort_date, sr.id AS _sort_id
    FROM sales_returns sr
    JOIN sales_return_items sri ON sri.return_id = sr.id
    JOIN products p ON p.id = sri.product_id
    JOIN suppliers sup ON sup.id = p.supplier_id
    JOIN customers c ON c.id = sr.customer_id
    ${returnWhere}

    ORDER BY _sort_date DESC, _sort_id DESC
  `

  const [rows] = await pool.query<RowDataPacket[]>(sql, [...params, ...returnParams])
  return rowsToCamel<SalesDetailRow>(rows as Record<string, unknown>[])
}
