import pool from '@/db/pool'
import { rowsToCamel } from '@/utils/camel'
import type { RowDataPacket } from 'mysql2'
import type { SalesReportOrder, PurchaseReportOrder, InventoryReportRow, ReportGroupRow, ReportOrderRow } from '@/dto/reports.dto'

type SalesFilters = { startDate?: string; endDate?: string; customerId?: number }
type PurchaseFilters = { startDate?: string; endDate?: string; supplierId?: number }
type InventoryFilters = { category?: string; supplierId?: number }

export async function getSalesOrders(f: SalesFilters): Promise<SalesReportOrder[]> {
  let sql = `
    SELECT so.id, so.order_no, so.customer_id, c.name AS customer_name,
           DATE_FORMAT(so.date, '%Y-%m-%d') AS order_date,
           so.total_qty, so.total_amount, so.total_pieces, so.payment_status
    FROM sales_orders so JOIN customers c ON c.id = so.customer_id WHERE 1=1`
  const p: unknown[] = []
  if (f.startDate) {
    sql += ' AND so.date >= ?'
    p.push(f.startDate)
  }
  if (f.endDate) {
    sql += ' AND so.date <= ?'
    p.push(f.endDate)
  }
  if (f.customerId) {
    sql += ' AND so.customer_id = ?'
    p.push(f.customerId)
  }
  sql += ' ORDER BY so.date DESC, so.id DESC'
  const [rows] = await pool.query<RowDataPacket[]>(sql, p)
  return rowsToCamel<SalesReportOrder>(rows as Record<string, unknown>[])
}

export async function getSalesStats(
  f: SalesFilters,
): Promise<{ totalOrders: number; totalAmount: number; totalPieces: number }> {
  let sql = `SELECT COUNT(*) AS total_orders, COALESCE(SUM(total_amount), 0) AS total_amount,
             COALESCE(SUM(total_pieces), 0) AS total_pieces FROM sales_orders so WHERE 1=1`
  const p: unknown[] = []
  if (f.startDate) {
    sql += ' AND so.date >= ?'
    p.push(f.startDate)
  }
  if (f.endDate) {
    sql += ' AND so.date <= ?'
    p.push(f.endDate)
  }
  if (f.customerId) {
    sql += ' AND so.customer_id = ?'
    p.push(f.customerId)
  }
  const [rows] = await pool.query<RowDataPacket[]>(sql, p)
  const r = (rows as RowDataPacket[])[0]
  return {
    totalOrders: Number(r.total_orders),
    totalAmount: Number(r.total_amount),
    totalPieces: Number(r.total_pieces),
  }
}

export async function getSalesProfit(f: SalesFilters): Promise<number> {
  let sql = `SELECT COALESCE(SUM(soi.final_amount - COALESCE(soi.cost_price, 0) * soi.qty), 0) AS total_profit
             FROM sales_order_items soi
             JOIN sales_orders so ON so.id = soi.order_id WHERE 1=1`
  const p: unknown[] = []
  if (f.startDate) {
    sql += ' AND so.date >= ?'
    p.push(f.startDate)
  }
  if (f.endDate) {
    sql += ' AND so.date <= ?'
    p.push(f.endDate)
  }
  if (f.customerId) {
    sql += ' AND so.customer_id = ?'
    p.push(f.customerId)
  }
  const [rows] = await pool.query<RowDataPacket[]>(sql, p)
  return Number((rows as RowDataPacket[])[0]?.total_profit ?? 0)
}

export async function getSalesPaid(f: SalesFilters): Promise<number> {
  let sql = `SELECT COALESCE(SUM(p.amount), 0) AS total_paid
             FROM payments p JOIN sales_orders so ON so.id = p.sales_order_id WHERE 1=1`
  const p: unknown[] = []
  if (f.startDate) {
    sql += ' AND so.date >= ?'
    p.push(f.startDate)
  }
  if (f.endDate) {
    sql += ' AND so.date <= ?'
    p.push(f.endDate)
  }
  if (f.customerId) {
    sql += ' AND so.customer_id = ?'
    p.push(f.customerId)
  }
  const [rows] = await pool.query<RowDataPacket[]>(sql, p)
  return Number((rows as RowDataPacket[])[0]?.total_paid ?? 0)
}

export async function getPurchaseOrders(f: PurchaseFilters): Promise<PurchaseReportOrder[]> {
  let sql = `
    SELECT po.id, po.order_no, po.supplier_id, s.name AS supplier_name,
           DATE_FORMAT(po.date, '%Y-%m-%d') AS order_date,
           po.total_qty, po.total_amount, po.final_amount, po.status
    FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id WHERE 1=1`
  const p: unknown[] = []
  if (f.startDate) {
    sql += ' AND po.date >= ?'
    p.push(f.startDate)
  }
  if (f.endDate) {
    sql += ' AND po.date <= ?'
    p.push(f.endDate)
  }
  if (f.supplierId) {
    sql += ' AND po.supplier_id = ?'
    p.push(f.supplierId)
  }
  sql += ' ORDER BY po.date DESC, po.id DESC'
  const [rows] = await pool.query<RowDataPacket[]>(sql, p)
  return rowsToCamel<PurchaseReportOrder>(rows as Record<string, unknown>[])
}

export async function getPurchaseStats(
  f: PurchaseFilters,
): Promise<{ totalOrders: number; totalAmount: number; totalQty: number }> {
  let sql = `SELECT COUNT(*) AS total_orders, COALESCE(SUM(total_amount), 0) AS total_amount,
             COALESCE(SUM(total_qty), 0) AS total_qty FROM purchase_orders po WHERE 1=1`
  const p: unknown[] = []
  if (f.startDate) {
    sql += ' AND po.date >= ?'
    p.push(f.startDate)
  }
  if (f.endDate) {
    sql += ' AND po.date <= ?'
    p.push(f.endDate)
  }
  if (f.supplierId) {
    sql += ' AND po.supplier_id = ?'
    p.push(f.supplierId)
  }
  const [rows] = await pool.query<RowDataPacket[]>(sql, p)
  const r = (rows as RowDataPacket[])[0]
  return {
    totalOrders: Number(r.total_orders),
    totalAmount: Number(r.total_amount),
    totalQty: Number(r.total_qty),
  }
}

export async function getInventoryRows(f: InventoryFilters): Promise<InventoryReportRow[]> {
  let sql = `
    SELECT p.id AS product_id, CONCAT(s.code, '.', p.code) AS product_code, p.name AS product_name,
           s.name AS supplier_name, s.code AS supplier_code, p.category, p.unit,
           p.units_per_piece, COALESCE(i.quantity, 0) AS stock, p.price, p.cost_price
    FROM products p
    JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN inventory i ON i.product_id = p.id
    WHERE p.status = 1`
  const p: unknown[] = []
  if (f.category) {
    sql += ' AND p.category = ?'
    p.push(f.category)
  }
  if (f.supplierId) {
    sql += ' AND p.supplier_id = ?'
    p.push(f.supplierId)
  }
  sql += ' ORDER BY s.code ASC, p.code ASC'
  const [rows] = await pool.query<RowDataPacket[]>(sql, p)
  return rowsToCamel<InventoryReportRow>(rows as Record<string, unknown>[])
}

// ── Sales aggregated queries ──────────────────────────────────────────────────

type DateFilter = { startDate: string; endDate: string }

export async function getSalesL1(
  by: 'customer' | 'product' | 'supplier',
  f: DateFilter,
): Promise<ReportGroupRow[]> {
  let sql: string
  const p = [f.startDate, f.endDate, f.startDate, f.endDate]
  if (by === 'customer') {
    sql = `
      SELECT id, name,
             SUM(order_count) AS order_count,
             SUM(total_qty) AS total_qty, SUM(total_pieces) AS total_pieces,
             SUM(total_amount) AS total_amount, SUM(total_profit) AS total_profit
      FROM (
        SELECT c.id, CONCAT(c.code, ' ', c.name) AS name,
               COUNT(DISTINCT so.id) AS order_count,
               SUM(soi.qty) AS total_qty, SUM(soi.pieces) AS total_pieces,
               SUM(soi.final_amount) AS total_amount,
               SUM(soi.final_amount - COALESCE(soi.cost_price, 0) * soi.qty) AS total_profit
        FROM sales_order_items soi
        JOIN sales_orders so ON so.id = soi.order_id
        JOIN customers c ON c.id = so.customer_id
        WHERE so.date BETWEEN ? AND ?
        GROUP BY c.id, c.code, c.name
        UNION ALL
        SELECT c.id, CONCAT(c.code, ' ', c.name) AS name,
               0, -SUM(sri.qty), -COALESCE(SUM(sri.pieces), 0), -SUM(sri.amount), -SUM(sri.amount)
        FROM sales_return_items sri
        JOIN sales_returns sr ON sr.id = sri.return_id
        JOIN customers c ON c.id = sr.customer_id
        WHERE sr.date BETWEEN ? AND ?
        GROUP BY c.id, c.code, c.name
      ) t
      GROUP BY id, name
      ORDER BY total_amount DESC`
  } else if (by === 'product') {
    sql = `
      SELECT id, name, unit,
             SUM(order_count) AS order_count,
             SUM(total_qty) AS total_qty, SUM(total_pieces) AS total_pieces,
             SUM(total_amount) AS total_amount, SUM(total_profit) AS total_profit
      FROM (
        SELECT p.id, CONCAT(s.code, '.', p.code, ' ', p.name) AS name, p.unit,
               COUNT(DISTINCT so.id) AS order_count,
               SUM(soi.qty) AS total_qty, SUM(soi.pieces) AS total_pieces,
               SUM(soi.final_amount) AS total_amount,
               SUM(soi.final_amount - COALESCE(soi.cost_price, 0) * soi.qty) AS total_profit
        FROM sales_order_items soi
        JOIN sales_orders so ON so.id = soi.order_id
        JOIN products p ON p.id = soi.product_id
        JOIN suppliers s ON s.id = p.supplier_id
        WHERE so.date BETWEEN ? AND ?
        GROUP BY p.id, s.code, p.code, p.name, p.unit
        UNION ALL
        SELECT p.id, CONCAT(s.code, '.', p.code, ' ', p.name) AS name, p.unit,
               0, -SUM(sri.qty), -COALESCE(SUM(sri.pieces), 0), -SUM(sri.amount), -SUM(sri.amount)
        FROM sales_return_items sri
        JOIN sales_returns sr ON sr.id = sri.return_id
        JOIN products p ON p.id = sri.product_id
        JOIN suppliers s ON s.id = p.supplier_id
        WHERE sr.date BETWEEN ? AND ?
        GROUP BY p.id, s.code, p.code, p.name, p.unit
      ) t
      GROUP BY id, name, unit
      ORDER BY total_amount DESC`
  } else {
    sql = `
      SELECT id, name,
             SUM(order_count) AS order_count,
             SUM(total_qty) AS total_qty, SUM(total_pieces) AS total_pieces,
             SUM(total_amount) AS total_amount, SUM(total_profit) AS total_profit
      FROM (
        SELECT s.id, CONCAT(s.code, ' ', s.name) AS name,
               COUNT(DISTINCT so.id) AS order_count,
               SUM(soi.qty) AS total_qty, SUM(soi.pieces) AS total_pieces,
               SUM(soi.final_amount) AS total_amount,
               SUM(soi.final_amount - COALESCE(soi.cost_price, 0) * soi.qty) AS total_profit
        FROM sales_order_items soi
        JOIN sales_orders so ON so.id = soi.order_id
        JOIN suppliers s ON s.id = soi.supplier_id
        WHERE so.date BETWEEN ? AND ?
        GROUP BY s.id, s.code, s.name
        UNION ALL
        SELECT s.id, CONCAT(s.code, ' ', s.name) AS name,
               0, -SUM(sri.qty), -COALESCE(SUM(sri.pieces), 0), -SUM(sri.amount), -SUM(sri.amount)
        FROM sales_return_items sri
        JOIN sales_returns sr ON sr.id = sri.return_id
        JOIN products p ON p.id = sri.product_id
        JOIN suppliers s ON s.id = p.supplier_id
        WHERE sr.date BETWEEN ? AND ?
        GROUP BY s.id, s.code, s.name
      ) t
      GROUP BY id, name
      ORDER BY total_amount DESC`
  }
  const [rows] = await pool.query<RowDataPacket[]>(sql, p)
  return rowsToCamel<ReportGroupRow>(rows as Record<string, unknown>[])
}

export async function getSalesL2(
  by: 'customer' | 'product' | 'supplier',
  parentId: number,
  f: DateFilter,
): Promise<ReportGroupRow[]> {
  let sql: string
  let params: unknown[]
  if (by === 'customer') {
    sql = `
      SELECT id, name, unit,
             SUM(order_count) AS order_count,
             SUM(total_qty) AS total_qty, SUM(total_pieces) AS total_pieces,
             SUM(total_amount) AS total_amount, SUM(total_profit) AS total_profit
      FROM (
        SELECT p.id, CONCAT(s.code, '.', p.code, ' ', p.name) AS name, p.unit,
               COUNT(DISTINCT so.id) AS order_count,
               SUM(soi.qty) AS total_qty, SUM(soi.pieces) AS total_pieces,
               SUM(soi.final_amount) AS total_amount,
               SUM(soi.final_amount - COALESCE(soi.cost_price, 0) * soi.qty) AS total_profit
        FROM sales_order_items soi
        JOIN sales_orders so ON so.id = soi.order_id
        JOIN products p ON p.id = soi.product_id
        JOIN suppliers s ON s.id = p.supplier_id
        WHERE so.date BETWEEN ? AND ? AND so.customer_id = ?
        GROUP BY p.id, s.code, p.code, p.name, p.unit
        UNION ALL
        SELECT p.id, CONCAT(s.code, '.', p.code, ' ', p.name) AS name, p.unit,
               0, -SUM(sri.qty), -COALESCE(SUM(sri.pieces), 0), -SUM(sri.amount), -SUM(sri.amount)
        FROM sales_return_items sri
        JOIN sales_returns sr ON sr.id = sri.return_id
        JOIN products p ON p.id = sri.product_id
        JOIN suppliers s ON s.id = p.supplier_id
        WHERE sr.date BETWEEN ? AND ? AND sr.customer_id = ?
        GROUP BY p.id, s.code, p.code, p.name, p.unit
      ) t
      GROUP BY id, name, unit
      ORDER BY total_amount DESC`
    params = [f.startDate, f.endDate, parentId, f.startDate, f.endDate, parentId]
  } else if (by === 'product') {
    sql = `
      SELECT id, name,
             SUM(order_count) AS order_count,
             SUM(total_qty) AS total_qty, SUM(total_pieces) AS total_pieces,
             SUM(total_amount) AS total_amount, SUM(total_profit) AS total_profit
      FROM (
        SELECT c.id, CONCAT(c.code, ' ', c.name) AS name,
               COUNT(DISTINCT so.id) AS order_count,
               SUM(soi.qty) AS total_qty, SUM(soi.pieces) AS total_pieces,
               SUM(soi.final_amount) AS total_amount,
               SUM(soi.final_amount - COALESCE(soi.cost_price, 0) * soi.qty) AS total_profit
        FROM sales_order_items soi
        JOIN sales_orders so ON so.id = soi.order_id
        JOIN customers c ON c.id = so.customer_id
        WHERE so.date BETWEEN ? AND ? AND soi.product_id = ?
        GROUP BY c.id, c.code, c.name
        UNION ALL
        SELECT c.id, CONCAT(c.code, ' ', c.name) AS name,
               0, -SUM(sri.qty), -COALESCE(SUM(sri.pieces), 0), -SUM(sri.amount), -SUM(sri.amount)
        FROM sales_return_items sri
        JOIN sales_returns sr ON sr.id = sri.return_id
        JOIN customers c ON c.id = sr.customer_id
        WHERE sr.date BETWEEN ? AND ? AND sri.product_id = ?
        GROUP BY c.id, c.code, c.name
      ) t
      GROUP BY id, name
      ORDER BY total_amount DESC`
    params = [f.startDate, f.endDate, parentId, f.startDate, f.endDate, parentId]
  } else {
    sql = `
      SELECT id, name, unit,
             SUM(order_count) AS order_count,
             SUM(total_qty) AS total_qty, SUM(total_pieces) AS total_pieces,
             SUM(total_amount) AS total_amount, SUM(total_profit) AS total_profit
      FROM (
        SELECT p.id, CONCAT(s.code, '.', p.code, ' ', p.name) AS name, p.unit,
               COUNT(DISTINCT so.id) AS order_count,
               SUM(soi.qty) AS total_qty, SUM(soi.pieces) AS total_pieces,
               SUM(soi.final_amount) AS total_amount,
               SUM(soi.final_amount - COALESCE(soi.cost_price, 0) * soi.qty) AS total_profit
        FROM sales_order_items soi
        JOIN sales_orders so ON so.id = soi.order_id
        JOIN products p ON p.id = soi.product_id
        JOIN suppliers s ON s.id = soi.supplier_id
        WHERE so.date BETWEEN ? AND ? AND soi.supplier_id = ?
        GROUP BY p.id, s.code, p.code, p.name, p.unit
        UNION ALL
        SELECT p.id, CONCAT(s.code, '.', p.code, ' ', p.name) AS name, p.unit,
               0, -SUM(sri.qty), -COALESCE(SUM(sri.pieces), 0), -SUM(sri.amount), -SUM(sri.amount)
        FROM sales_return_items sri
        JOIN sales_returns sr ON sr.id = sri.return_id
        JOIN products p ON p.id = sri.product_id
        JOIN suppliers s ON s.id = p.supplier_id
        WHERE sr.date BETWEEN ? AND ? AND p.supplier_id = ?
        GROUP BY p.id, s.code, p.code, p.name, p.unit
      ) t
      GROUP BY id, name, unit
      ORDER BY total_amount DESC`
    params = [f.startDate, f.endDate, parentId, f.startDate, f.endDate, parentId]
  }
  const [rows] = await pool.query<RowDataPacket[]>(sql, params)
  return rowsToCamel<ReportGroupRow>(rows as Record<string, unknown>[])
}

export async function getSalesL3(
  f: DateFilter & { customerId?: number; productId?: number; supplierId?: number },
): Promise<ReportOrderRow[]> {
  const orderParams: unknown[] = [f.startDate, f.endDate]
  let orderWhere = ''
  if (f.customerId) { orderWhere += ' AND so.customer_id = ?'; orderParams.push(f.customerId) }
  if (f.productId)  { orderWhere += ' AND soi.product_id = ?'; orderParams.push(f.productId) }
  if (f.supplierId) { orderWhere += ' AND soi.supplier_id = ?'; orderParams.push(f.supplierId) }

  const returnParams: unknown[] = [f.startDate, f.endDate]
  let returnWhere = ''
  if (f.customerId) { returnWhere += ' AND sr.customer_id = ?'; returnParams.push(f.customerId) }
  if (f.productId)  { returnWhere += ' AND sri.product_id = ?'; returnParams.push(f.productId) }
  if (f.supplierId) { returnWhere += ' AND p.supplier_id = ?'; returnParams.push(f.supplierId) }

  const sql = `
    SELECT order_id, order_no, order_date, customer_name, product_code, product_name,
           supplier_code, supplier_name, unit, operator, qty, pieces, unit_price, amount, discount,
           final_amount, cost_price, notes, profit, is_return
    FROM (
      SELECT so.id AS order_id, so.order_no, DATE_FORMAT(so.date, '%Y-%m-%d') AS order_date,
             CONCAT(c.code, ' ', c.name) AS customer_name,
             CONCAT(s.code, '.', p.code) AS product_code, p.name AS product_name,
             s.code AS supplier_code, CONCAT(s.code, ' ', s.name) AS supplier_name,
             p.unit, so.operator,
             soi.qty, soi.pieces, soi.unit_price, soi.amount, soi.discount, soi.final_amount,
             soi.cost_price, soi.notes,
             (soi.final_amount - COALESCE(soi.cost_price, 0) * soi.qty) AS profit,
             0 AS is_return
      FROM sales_order_items soi
      JOIN sales_orders so ON so.id = soi.order_id
      JOIN customers c ON c.id = so.customer_id
      JOIN products p ON p.id = soi.product_id
      JOIN suppliers s ON s.id = soi.supplier_id
      WHERE so.date BETWEEN ? AND ?${orderWhere}
      UNION ALL
      SELECT sr.id AS order_id, sr.return_no AS order_no,
             DATE_FORMAT(sr.date, '%Y-%m-%d') AS order_date,
             CONCAT(c.code, ' ', c.name) AS customer_name,
             CONCAT(s.code, '.', p.code) AS product_code, p.name AS product_name,
             s.code AS supplier_code, CONCAT(s.code, ' ', s.name) AS supplier_name,
             p.unit, sr.operator,
             -sri.qty AS qty, -COALESCE(sri.pieces, 0) AS pieces, sri.unit_price,
             -sri.amount AS amount, 100 AS discount, -sri.amount AS final_amount,
             NULL AS cost_price, sri.notes,
             -sri.amount AS profit,
             1 AS is_return
      FROM sales_return_items sri
      JOIN sales_returns sr ON sr.id = sri.return_id
      JOIN customers c ON c.id = sr.customer_id
      JOIN products p ON p.id = sri.product_id
      JOIN suppliers s ON s.id = p.supplier_id
      WHERE sr.date BETWEEN ? AND ?${returnWhere}
    ) t
    ORDER BY order_date DESC, is_return ASC, order_id DESC`

  const [rows] = await pool.query<RowDataPacket[]>(sql, [...orderParams, ...returnParams])
  return rowsToCamel<ReportOrderRow>(rows as Record<string, unknown>[])
}

// ── Purchase aggregated queries ───────────────────────────────────────────────

export async function getPurchaseL1(
  by: 'supplier' | 'product',
  f: DateFilter,
): Promise<ReportGroupRow[]> {
  let sql: string
  const p = [f.startDate, f.endDate, f.startDate, f.endDate]
  if (by === 'supplier') {
    sql = `
      SELECT id, name,
             SUM(order_count) AS order_count,
             SUM(total_qty) AS total_qty, SUM(total_pieces) AS total_pieces,
             SUM(total_amount) AS total_amount
      FROM (
        SELECT s.id, CONCAT(s.code, ' ', s.name) AS name,
               COUNT(DISTINCT po.id) AS order_count,
               SUM(poi.qty) AS total_qty, SUM(poi.pieces) AS total_pieces,
               SUM(poi.final_amount) AS total_amount
        FROM purchase_order_items poi
        JOIN purchase_orders po ON po.id = poi.order_id
        JOIN suppliers s ON s.id = po.supplier_id
        WHERE po.date BETWEEN ? AND ?
        GROUP BY s.id, s.code, s.name
        UNION ALL
        SELECT s.id, CONCAT(s.code, ' ', s.name) AS name,
               0, -SUM(pri.qty), -COALESCE(SUM(pri.pieces), 0), -SUM(pri.amount)
        FROM purchase_return_items pri
        JOIN purchase_returns pr ON pr.id = pri.return_id
        JOIN suppliers s ON s.id = pr.supplier_id
        WHERE pr.date BETWEEN ? AND ?
        GROUP BY s.id, s.code, s.name
      ) t
      GROUP BY id, name
      ORDER BY total_amount DESC`
  } else {
    sql = `
      SELECT id, name, unit,
             SUM(order_count) AS order_count,
             SUM(total_qty) AS total_qty, SUM(total_pieces) AS total_pieces,
             SUM(total_amount) AS total_amount
      FROM (
        SELECT p.id, CONCAT(s.code, '.', p.code, ' ', p.name) AS name, p.unit,
               COUNT(DISTINCT po.id) AS order_count,
               SUM(poi.qty) AS total_qty, SUM(poi.pieces) AS total_pieces,
               SUM(poi.final_amount) AS total_amount
        FROM purchase_order_items poi
        JOIN purchase_orders po ON po.id = poi.order_id
        JOIN products p ON p.id = poi.product_id
        JOIN suppliers s ON s.id = p.supplier_id
        WHERE po.date BETWEEN ? AND ?
        GROUP BY p.id, s.code, p.code, p.name, p.unit
        UNION ALL
        SELECT p.id, CONCAT(s.code, '.', p.code, ' ', p.name) AS name, p.unit,
               0, -SUM(pri.qty), -COALESCE(SUM(pri.pieces), 0), -SUM(pri.amount)
        FROM purchase_return_items pri
        JOIN purchase_returns pr ON pr.id = pri.return_id
        JOIN products p ON p.id = pri.product_id
        JOIN suppliers s ON s.id = p.supplier_id
        WHERE pr.date BETWEEN ? AND ?
        GROUP BY p.id, s.code, p.code, p.name, p.unit
      ) t
      GROUP BY id, name, unit
      ORDER BY total_amount DESC`
  }
  const [rows] = await pool.query<RowDataPacket[]>(sql, p)
  return rowsToCamel<ReportGroupRow>(rows as Record<string, unknown>[])
}

export async function getPurchaseL2(
  by: 'supplier' | 'product',
  parentId: number,
  f: DateFilter,
): Promise<ReportGroupRow[]> {
  let sql: string
  let params: unknown[]
  if (by === 'supplier') {
    sql = `
      SELECT id, name, unit,
             SUM(order_count) AS order_count,
             SUM(total_qty) AS total_qty, SUM(total_pieces) AS total_pieces,
             SUM(total_amount) AS total_amount
      FROM (
        SELECT p.id, CONCAT(s.code, '.', p.code, ' ', p.name) AS name, p.unit,
               COUNT(DISTINCT po.id) AS order_count,
               SUM(poi.qty) AS total_qty, SUM(poi.pieces) AS total_pieces,
               SUM(poi.final_amount) AS total_amount
        FROM purchase_order_items poi
        JOIN purchase_orders po ON po.id = poi.order_id
        JOIN products p ON p.id = poi.product_id
        JOIN suppliers s ON s.id = po.supplier_id
        WHERE po.date BETWEEN ? AND ? AND po.supplier_id = ?
        GROUP BY p.id, s.code, p.code, p.name, p.unit
        UNION ALL
        SELECT p.id, CONCAT(s.code, '.', p.code, ' ', p.name) AS name, p.unit,
               0, -SUM(pri.qty), -COALESCE(SUM(pri.pieces), 0), -SUM(pri.amount)
        FROM purchase_return_items pri
        JOIN purchase_returns pr ON pr.id = pri.return_id
        JOIN products p ON p.id = pri.product_id
        JOIN suppliers s ON s.id = p.supplier_id
        WHERE pr.date BETWEEN ? AND ? AND pr.supplier_id = ?
        GROUP BY p.id, s.code, p.code, p.name, p.unit
      ) t
      GROUP BY id, name, unit
      ORDER BY total_amount DESC`
    params = [f.startDate, f.endDate, parentId, f.startDate, f.endDate, parentId]
  } else {
    sql = `
      SELECT id, name,
             SUM(order_count) AS order_count,
             SUM(total_qty) AS total_qty, SUM(total_pieces) AS total_pieces,
             SUM(total_amount) AS total_amount
      FROM (
        SELECT s.id, CONCAT(s.code, ' ', s.name) AS name,
               COUNT(DISTINCT po.id) AS order_count,
               SUM(poi.qty) AS total_qty, SUM(poi.pieces) AS total_pieces,
               SUM(poi.final_amount) AS total_amount
        FROM purchase_order_items poi
        JOIN purchase_orders po ON po.id = poi.order_id
        JOIN suppliers s ON s.id = po.supplier_id
        WHERE po.date BETWEEN ? AND ? AND poi.product_id = ?
        GROUP BY s.id, s.code, s.name
        UNION ALL
        SELECT s.id, CONCAT(s.code, ' ', s.name) AS name,
               0, -SUM(pri.qty), -COALESCE(SUM(pri.pieces), 0), -SUM(pri.amount)
        FROM purchase_return_items pri
        JOIN purchase_returns pr ON pr.id = pri.return_id
        JOIN suppliers s ON s.id = pr.supplier_id
        WHERE pr.date BETWEEN ? AND ? AND pri.product_id = ?
        GROUP BY s.id, s.code, s.name
      ) t
      GROUP BY id, name
      ORDER BY total_amount DESC`
    params = [f.startDate, f.endDate, parentId, f.startDate, f.endDate, parentId]
  }
  const [rows] = await pool.query<RowDataPacket[]>(sql, params)
  return rowsToCamel<ReportGroupRow>(rows as Record<string, unknown>[])
}

// ── Rankings ──────────────────────────────────────────────────────────────────

export async function getSalesRankByDay(f: DateFilter): Promise<ReportGroupRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(so.date, '%Y-%m-%d') AS name,
            SUM(so.total_qty) AS total_qty, SUM(so.total_pieces) AS total_pieces,
            SUM(so.total_amount) AS total_amount,
            COUNT(DISTINCT so.id) AS order_count
     FROM sales_orders so
     WHERE so.date BETWEEN ? AND ?
     GROUP BY so.date
     ORDER BY total_amount DESC`,
    [f.startDate, f.endDate],
  )
  return rowsToCamel<ReportGroupRow>(rows as Record<string, unknown>[])
}

export async function getSalesRankByMonth(f: DateFilter): Promise<ReportGroupRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(so.date, '%Y-%m') AS name,
            SUM(so.total_qty) AS total_qty, SUM(so.total_pieces) AS total_pieces,
            SUM(so.total_amount) AS total_amount,
            COUNT(DISTINCT so.id) AS order_count
     FROM sales_orders so
     WHERE so.date BETWEEN ? AND ?
     GROUP BY DATE_FORMAT(so.date, '%Y-%m')
     ORDER BY total_amount DESC`,
    [f.startDate, f.endDate],
  )
  return rowsToCamel<ReportGroupRow>(rows as Record<string, unknown>[])
}

export async function getPurchaseL3(
  f: DateFilter & { supplierId?: number; productId?: number },
): Promise<ReportOrderRow[]> {
  const orderParams: unknown[] = [f.startDate, f.endDate]
  let orderWhere = ''
  if (f.supplierId) { orderWhere += ' AND po.supplier_id = ?'; orderParams.push(f.supplierId) }
  if (f.productId)  { orderWhere += ' AND poi.product_id = ?'; orderParams.push(f.productId) }

  const returnParams: unknown[] = [f.startDate, f.endDate]
  let returnWhere = ''
  if (f.supplierId) { returnWhere += ' AND pr.supplier_id = ?'; returnParams.push(f.supplierId) }
  if (f.productId)  { returnWhere += ' AND pri.product_id = ?'; returnParams.push(f.productId) }

  const sql = `
    SELECT order_id, order_no, order_date, supplier_code, supplier_name, product_code, product_name,
           unit, qty, pieces, unit_price, amount, discount, final_amount, operator, notes, is_return
    FROM (
      SELECT po.id AS order_id, po.order_no, DATE_FORMAT(po.date, '%Y-%m-%d') AS order_date,
             s.code AS supplier_code, CONCAT(s.code, ' ', s.name) AS supplier_name,
             CONCAT(s.code, '.', p.code) AS product_code, p.name AS product_name,
             p.unit, poi.qty, poi.pieces, poi.unit_price, poi.amount, poi.discount, poi.final_amount,
             po.operator, poi.notes, 0 AS is_return
      FROM purchase_order_items poi
      JOIN purchase_orders po ON po.id = poi.order_id
      JOIN suppliers s ON s.id = po.supplier_id
      JOIN products p ON p.id = poi.product_id
      WHERE po.date BETWEEN ? AND ?${orderWhere}
      UNION ALL
      SELECT pr.id AS order_id, pr.return_no AS order_no,
             DATE_FORMAT(pr.date, '%Y-%m-%d') AS order_date,
             s.code AS supplier_code, CONCAT(s.code, ' ', s.name) AS supplier_name,
             CONCAT(s.code, '.', p.code) AS product_code, p.name AS product_name,
             p.unit, -pri.qty AS qty, -COALESCE(pri.pieces, 0) AS pieces, pri.unit_price,
             -pri.amount AS amount, 100 AS discount, -pri.amount AS final_amount,
             pr.operator, pri.notes, 1 AS is_return
      FROM purchase_return_items pri
      JOIN purchase_returns pr ON pr.id = pri.return_id
      JOIN suppliers s ON s.id = pr.supplier_id
      JOIN products p ON p.id = pri.product_id
      WHERE pr.date BETWEEN ? AND ?${returnWhere}
    ) t
    ORDER BY order_date DESC, is_return ASC, order_id DESC`

  const [rows] = await pool.query<RowDataPacket[]>(sql, [...orderParams, ...returnParams])
  return rowsToCamel<ReportOrderRow>(rows as Record<string, unknown>[])
}
