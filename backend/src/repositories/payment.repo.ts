import pool from '@/db/pool'
import { rowsToCamel } from '@/utils/camel'
import type { Payment, CreatePaymentDto } from '@/dto/payment.dto'
import type { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise'

const SELECT = `
  SELECT p.id, p.sales_order_id, so.order_no, p.customer_id,
         c.name AS customer_name, c.code AS customer_code, p.amount, p.method,
         DATE_FORMAT(p.payment_date, '%Y-%m-%d') AS payment_date,
         p.notes, COALESCE(u.name, p.operator) AS operator
  FROM payments p
  JOIN sales_orders so ON so.id = p.sales_order_id
  JOIN customers c ON c.id = p.customer_id
  LEFT JOIN users u ON u.username = p.operator`

export async function findAll(
  filters: {
    salesOrderId?: number
    customerId?: number
    startDate?: string
    endDate?: string
  } = {},
): Promise<Payment[]> {
  let sql = SELECT + ' WHERE 1=1'
  const params: unknown[] = []
  if (filters.salesOrderId) {
    sql += ' AND p.sales_order_id = ?'
    params.push(filters.salesOrderId)
  }
  if (filters.customerId) {
    sql += ' AND p.customer_id = ?'
    params.push(filters.customerId)
  }
  if (filters.startDate) {
    sql += ' AND p.payment_date >= ?'
    params.push(filters.startDate)
  }
  if (filters.endDate) {
    sql += ' AND p.payment_date <= ?'
    params.push(filters.endDate)
  }
  sql += ' ORDER BY p.payment_date DESC, p.id DESC'
  const [rows] = await pool.query<RowDataPacket[]>(sql, params)
  return rowsToCamel<Payment>(rows as Record<string, unknown>[])
}

export async function insert(
  dto: CreatePaymentDto,
  customerId: number,
  operator: string | null,
  conn: PoolConnection,
): Promise<number> {
  const [result] = await conn.query<ResultSetHeader>(
    'INSERT INTO payments (sales_order_id, customer_id, amount, payment_date, method, notes, operator) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      dto.salesOrderId,
      customerId,
      dto.amount,
      dto.paymentDate,
      dto.method ?? '转账',
      dto.notes ?? null,
      operator,
    ],
  )
  return result.insertId
}

export async function remove(
  id: number,
  conn: PoolConnection,
): Promise<{ salesOrderId: number } | null> {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT sales_order_id FROM payments WHERE id = ?',
    [id],
  )
  if (!(rows as RowDataPacket[]).length) return null
  await conn.query('DELETE FROM payments WHERE id = ?', [id])
  return { salesOrderId: (rows as RowDataPacket[])[0].sales_order_id as number }
}

export async function getTotalPaid(salesOrderId: number, conn: PoolConnection): Promise<number> {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE sales_order_id = ?',
    [salesOrderId],
  )
  return Number((rows as RowDataPacket[])[0]?.total ?? 0)
}
