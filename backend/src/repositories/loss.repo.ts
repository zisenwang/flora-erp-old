import pool from '@/db/pool'
import { rowToCamel, rowsToCamel } from '@/utils/camel'
import type { LossRecord, CreateLossDto } from '@/dto/loss.dto'
import type { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise'

const SELECT = `
  SELECT lr.id, lr.product_id, CONCAT(s.code, '.', p.code) AS product_code, p.name AS product_name,
         p.unit, lr.qty, lr.reason, COALESCE(u.name, lr.operator) AS operator,
         DATE_FORMAT(lr.date, '%Y-%m-%d') AS date, lr.notes
  FROM loss_records lr
  JOIN products p ON p.id = lr.product_id
  JOIN suppliers s ON s.id = p.supplier_id
  LEFT JOIN users u ON u.username = lr.operator`

export async function findAll(
  filters: { startDate?: string; endDate?: string } = {},
): Promise<LossRecord[]> {
  let sql = SELECT + ' WHERE 1=1'
  const params: unknown[] = []
  if (filters.startDate) {
    sql += ' AND lr.date >= ?'
    params.push(filters.startDate)
  }
  if (filters.endDate) {
    sql += ' AND lr.date <= ?'
    params.push(filters.endDate)
  }
  sql += ' ORDER BY lr.date DESC, lr.id DESC'
  const [rows] = await pool.query<RowDataPacket[]>(sql, params)
  return rowsToCamel<LossRecord>(rows as Record<string, unknown>[])
}

export async function findById(id: number): Promise<LossRecord | null> {
  const [rows] = await pool.query<RowDataPacket[]>(`${SELECT} WHERE lr.id = ?`, [id])
  return rows.length ? rowToCamel<LossRecord>(rows[0] as Record<string, unknown>) : null
}

export async function insert(
  dto: CreateLossDto,
  operator: string | null,
  conn: PoolConnection,
): Promise<number> {
  const [result] = await conn.query<ResultSetHeader>(
    'INSERT INTO loss_records (product_id, qty, reason, operator, date, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [dto.productId, dto.qty, dto.reason ?? null, operator, dto.date, dto.notes ?? null],
  )
  return result.insertId
}
