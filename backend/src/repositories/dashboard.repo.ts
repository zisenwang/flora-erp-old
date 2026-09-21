import pool from '@/db/pool'
import { rowsToCamel } from '@/utils/camel'
import type { RowDataPacket } from 'mysql2'
import type { SalesRankRow, DailySalesRow } from '@/dto/dashboard.dto'

export async function getTodayStats(today: string): Promise<{
  todaySales: number
  todayIncome: number
  todayPurchase: number
  todayOrderCount: number
}> {
  const [[salesRows], [incomeRows], [purchaseRows], [orderRows]] = await Promise.all([
    pool.query<RowDataPacket[]>(
      'SELECT COALESCE(SUM(total_amount), 0) AS val FROM sales_orders WHERE date = ?',
      [today],
    ),
    pool.query<RowDataPacket[]>(
      'SELECT COALESCE(SUM(amount), 0) AS val FROM payments WHERE payment_date = ?',
      [today],
    ),
    pool.query<RowDataPacket[]>(
      'SELECT COALESCE(SUM(final_amount), 0) AS val FROM purchase_orders WHERE date = ?',
      [today],
    ),
    pool.query<RowDataPacket[]>('SELECT COUNT(*) AS val FROM sales_orders WHERE date = ?', [today]),
  ])
  return {
    todaySales: Number((salesRows as RowDataPacket[])[0]?.val ?? 0),
    todayIncome: Number((incomeRows as RowDataPacket[])[0]?.val ?? 0),
    todayPurchase: Number((purchaseRows as RowDataPacket[])[0]?.val ?? 0),
    todayOrderCount: Number((orderRows as RowDataPacket[])[0]?.val ?? 0),
  }
}

export async function getMonthlySalesRank(monthStart: string): Promise<SalesRankRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.code AS customer_code, c.name AS customer_name,
            SUM(so.total_amount) AS total_amount, SUM(so.total_pieces) AS total_pieces
     FROM sales_orders so JOIN customers c ON c.id = so.customer_id
     WHERE so.date >= ?
     GROUP BY so.customer_id, c.code, c.name
     ORDER BY total_amount DESC LIMIT 10`,
    [monthStart],
  )
  return rowsToCamel<SalesRankRow>(rows as Record<string, unknown>[])
}

export async function getMonthlySalesDaily(monthStart: string, monthEnd: string): Promise<DailySalesRow[]> {
  const [[salesRows], [returnRows]] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(so.date, '%Y-%m-%d') AS date,
              SUM(so.total_qty) AS sales_qty,
              SUM(so.total_amount) AS sales_amount,
              SUM(so.total_pieces) AS pieces
       FROM sales_orders so
       WHERE so.date BETWEEN ? AND ?
       GROUP BY so.date
       ORDER BY so.date`,
      [monthStart, monthEnd],
    ),
    pool.query<RowDataPacket[]>(
      `SELECT DATE_FORMAT(sr.date, '%Y-%m-%d') AS date,
              SUM(sr.total_qty) AS return_qty,
              SUM(sr.total_amount) AS return_amount
       FROM sales_returns sr
       WHERE sr.date BETWEEN ? AND ?
       GROUP BY sr.date
       ORDER BY sr.date`,
      [monthStart, monthEnd],
    ),
  ])

  // Merge sales and return rows by date
  const map = new Map<string, DailySalesRow>()
  for (const r of salesRows as RowDataPacket[]) {
    map.set(r.date as string, {
      date: r.date as string,
      salesQty: Number(r.sales_qty ?? 0),
      salesAmount: Number(r.sales_amount ?? 0),
      pieces: Number(r.pieces ?? 0),
      returnQty: 0,
      returnAmount: 0,
    })
  }
  for (const r of returnRows as RowDataPacket[]) {
    const d = r.date as string
    const existing = map.get(d)
    if (existing) {
      existing.returnQty = Number(r.return_qty ?? 0)
      existing.returnAmount = Number(r.return_amount ?? 0)
    } else {
      map.set(d, {
        date: d,
        salesQty: 0,
        salesAmount: 0,
        pieces: 0,
        returnQty: Number(r.return_qty ?? 0),
        returnAmount: Number(r.return_amount ?? 0),
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
}
