import * as XLSX from 'xlsx'
import type { ReportGroupRow, ReportOrderRow, InventoryReportItem } from '@/api/reports.ts'
import type { SalesDetailRow } from '@/api/sales.ts'
import type { PurchaseDetailRow } from '@/api/purchase.ts'
import type { Product } from '@/api/products.ts'
import type { InventoryRow } from '@/api/inventory.ts'
import type { Payment } from '@/api/payments.ts'

function autoWidth(ws: XLSX.WorkSheet) {
  const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })
  const colWidths: number[] = []
  data.forEach(row => {
    row.forEach((cell, ci) => {
      const len = String(cell ?? '').length * 1.5 + 2
      if (!colWidths[ci] || colWidths[ci] < len) colWidths[ci] = len
    })
  })
  ws['!cols'] = colWidths.map(w => ({ wch: Math.min(w, 40) }))
}

function write(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// ─── Sales Report Summary ────────────────────────────────────────────────────

export function exportSalesGroupExcel(
  rows: ReportGroupRow[],
  groupLabel: string,
  startDate: string,
  endDate: string,
) {
  const sheetData = rows.map(r => {
    const margin = r.totalAmount && r.totalProfit != null
      ? (r.totalProfit / r.totalAmount * 100).toFixed(1) + '%'
      : '—'
    return {
      [groupLabel]: r.name,
      '订单数': r.orderCount,
      '数量': r.totalQty,
      '金额': r.totalAmount,
      '件数': r.totalPieces || 0,
      '毛利': r.totalProfit ?? 0,
      '毛利率': margin,
    }
  })
  const totalAmount = rows.reduce((s, r) => s + r.totalAmount, 0)
  const totalProfit = rows.reduce((s, r) => s + (r.totalProfit ?? 0), 0)
  sheetData.push({
    [groupLabel]: '合计',
    '订单数': rows.reduce((s, r) => s + r.orderCount, 0),
    '数量': rows.reduce((s, r) => s + r.totalQty, 0),
    '金额': totalAmount,
    '件数': rows.reduce((s, r) => s + r.totalPieces, 0),
    '毛利': totalProfit,
    '毛利率': totalAmount ? (totalProfit / totalAmount * 100).toFixed(1) + '%' : '—',
  })
  const ws = XLSX.utils.json_to_sheet(sheetData)
  autoWidth(ws)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '销售汇总')
  write(wb, `销售报表_按${groupLabel}汇总_${startDate}_${endDate}`)
}

// ─── Purchase Report Summary ──────────────────────────────────────────────────

export function exportPurchaseGroupExcel(
  rows: ReportGroupRow[],
  groupLabel: string,
  startDate: string,
  endDate: string,
) {
  const sheetData = rows.map(r => ({
    [groupLabel]: r.name,
    '订单数': r.orderCount,
    '数量': r.totalQty,
    '件数': r.totalPieces || 0,
    '金额': r.totalAmount,
  }))
  sheetData.push({
    [groupLabel]: '合计',
    '订单数': rows.reduce((s, r) => s + r.orderCount, 0),
    '数量': rows.reduce((s, r) => s + r.totalQty, 0),
    '件数': rows.reduce((s, r) => s + r.totalPieces, 0),
    '金额': rows.reduce((s, r) => s + r.totalAmount, 0),
  })
  const ws = XLSX.utils.json_to_sheet(sheetData)
  autoWidth(ws)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '采购汇总')
  write(wb, `采购报表_按${groupLabel}汇总_${startDate}_${endDate}`)
}

// ─── Sales Report (report center) ────────────────────────────────────────────

export function exportSalesExcel(
  rows: ReportOrderRow[],
  startDate: string,
  endDate: string,
  label?: string,
) {
  const sheetData = rows.map(r => ({
    '日期': r.orderDate,
    '客户': r.customerName ?? '',
    '单号': r.orderNo,
    '产品编码': r.productCode ?? '',
    '产品名称': r.productName ?? '',
    '供应商': r.supplierCode ?? '',
    '单位': r.unit ?? '',
    '数量': r.qty,
    '单价': r.unitPrice,
    '金额': r.finalAmount,
    '件数': r.pieces || 0,
    '毛利': r.isReturn ? '' : (r.profit ?? ''),
    '经办人': r.operator ?? '',
    '备注': r.notes ?? '',
  }))
  const totalQty    = rows.reduce((s, r) => s + r.qty, 0)
  const totalPieces = rows.reduce((s, r) => s + (r.pieces || 0), 0)
  const totalAmount = rows.reduce((s, r) => s + r.finalAmount, 0)
  const totalProfit = rows.filter(r => !r.isReturn).reduce((s, r) => s + (r.profit ?? 0), 0)
  sheetData.push({
    '日期': '', '客户': '', '单号': '合计', '产品编码': '', '产品名称': '',
    '供应商': '', '单位': '', '数量': totalQty, '单价': '', '金额': totalAmount,
    '件数': totalPieces, '毛利': totalProfit, '经办人': '', '备注': '',
  } as never)
  const ws = XLSX.utils.json_to_sheet(sheetData)
  autoWidth(ws)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '销售明细')
  write(wb, label ? `销售报表_${label}_${startDate}_${endDate}` : `销售报表_${startDate}_${endDate}`)
}

// ─── Purchase Report (report center) ─────────────────────────────────────────

export function exportPurchaseExcel(
  rows: ReportOrderRow[],
  startDate: string,
  endDate: string,
  label?: string,
) {
  const sheetData = rows.map(r => ({
    '日期': r.orderDate,
    '供应商': r.supplierCode ?? '',
    '单号': r.orderNo,
    '产品编码': r.productCode ?? '',
    '产品名称': r.productName ?? '',
    '单位': r.unit ?? '',
    '数量': r.qty,
    '单价': r.unitPrice,
    '金额': r.finalAmount,
    '件数': r.pieces || 0,
    '经办人': r.operator ?? '',
    '备注': r.notes ?? '',
  }))
  const totalQty    = rows.reduce((s, r) => s + r.qty, 0)
  const totalPieces = rows.reduce((s, r) => s + (r.pieces || 0), 0)
  const totalAmount = rows.reduce((s, r) => s + r.finalAmount, 0)
  sheetData.push({
    '日期': '', '供应商': '', '单号': '合计', '产品编码': '', '产品名称': '',
    '单位': '', '数量': totalQty, '单价': '', '金额': totalAmount,
    '件数': totalPieces, '经办人': '', '备注': '',
  } as never)
  const ws = XLSX.utils.json_to_sheet(sheetData)
  autoWidth(ws)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '进货明细')
  write(wb, label ? `采购报表_${label}_${startDate}_${endDate}` : `采购报表_${startDate}_${endDate}`)
}

// ─── Inventory Report (report center) ────────────────────────────────────────

export function exportInventoryExcel(rows: InventoryReportItem[]) {
  const getPieces = (r: InventoryReportItem) =>
    r.unitsPerPiece ? Math.ceil(r.stock / r.unitsPerPiece) : 0
  const sheetData = rows.map(r => ({
    '编码': r.productCode,
    '货品名称': r.productName,
    '供应商': r.supplierName,
    '分类': r.category ?? '',
    '单位': r.unit,
    '当前库存': r.stock,
    '件数': r.unitsPerPiece ? getPieces(r) : '',
    '每件数量': r.unitsPerPiece ?? '',
    '成本价': r.costPrice != null ? r.costPrice : '',
    '售价': r.price != null ? r.price : '',
  }))
  const totalQty    = rows.reduce((s, r) => s + r.stock, 0)
  const totalPieces = rows.reduce((s, r) => s + getPieces(r), 0)
  sheetData.push({ '编码': '', '货品名称': '合计', '供应商': '', '分类': '', '单位': '', '当前库存': totalQty, '件数': totalPieces, '每件数量': '', '成本价': '', '售价': '' })
  const ws = XLSX.utils.json_to_sheet(sheetData)
  autoWidth(ws)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '库存报表')
  write(wb, `库存报表_${new Date().toISOString().slice(0, 10)}`)
}

// ─── Sales Order List — summary mode ─────────────────────────────────────────

interface SalesOrderSummaryRow {
  date: string
  customerCode: string
  customerName: string
  no: string
  rowType: 'order' | 'return'
  qty: number
  amount: number
  pieces: number
  paymentStatus?: string
  status?: string
  profit?: number
}

export function exportSalesOrdersExcel(
  rows: SalesOrderSummaryRow[],
  startDate: string,
  endDate: string,
) {
  const sheetData = rows.map(r => ({
    '日期': r.date,
    '客户': `${r.customerCode} ${r.customerName}`,
    '单号': r.no,
    '类型': r.rowType === 'return' ? '退货' : '销售',
    '数量': r.qty,
    '合计金额': r.rowType === 'return' ? -r.amount : r.amount,
    '件数': r.pieces || 0,
    '收款状态': r.rowType === 'return' ? '退货' : (r.status === '作废' ? '已作废' : (r.paymentStatus ?? '')),
    '毛利': r.rowType === 'return' ? '' : (r.profit != null ? r.profit : ''),
  }))
  const orderRows  = rows.filter(r => r.rowType === 'order')
  const returnRows = rows.filter(r => r.rowType === 'return')
  sheetData.push({
    '日期': '', '客户': '', '单号': '合计', '类型': '',
    '数量': orderRows.reduce((s, r) => s + r.qty, 0) - returnRows.reduce((s, r) => s + r.qty, 0),
    '合计金额': orderRows.reduce((s, r) => s + r.amount, 0) - returnRows.reduce((s, r) => s + r.amount, 0),
    '件数': orderRows.reduce((s, r) => s + r.pieces, 0) - returnRows.reduce((s, r) => s + r.pieces, 0),
    '收款状态': '', '毛利': '',
  })
  const ws = XLSX.utils.json_to_sheet(sheetData)
  autoWidth(ws)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '销售单据')
  write(wb, `销售单据_${startDate}_${endDate}`)
}

// ─── Sales Order List — detail mode ──────────────────────────────────────────

export function exportSalesOrdersDetailExcel(
  rows: SalesDetailRow[],
  startDate: string,
  endDate: string,
) {
  const sheetData = rows.map(r => ({
    '日期': r.date,
    '客户': `${r.customerCode} ${r.customerName}`,
    '单号': r.no,
    '类型': r.rowType === 'return' ? '退货' : '销售',
    '产品编码': r.productCode,
    '产品名称': r.productName,
    '供应商': r.supplierCode,
    '单位': r.unit,
    '数量': r.qty,
    '单价': r.unitPrice,
    '金额': r.rowType === 'return' ? -r.amount : r.amount,
    '件数': r.pieces || 0,
    '毛利': r.profit != null ? r.profit : '',
    '经办人': r.operator ?? '',
    '备注': r.notes ?? '',
  }))
  const orderRows  = rows.filter(r => r.rowType === 'order')
  const returnRows = rows.filter(r => r.rowType === 'return')
  sheetData.push({
    '日期': '', '客户': '', '单号': '合计', '类型': '', '产品编码': '', '产品名称': '', '供应商': '', '单位': '',
    '数量': orderRows.reduce((s, r) => s + r.qty, 0) - returnRows.reduce((s, r) => s + r.qty, 0),
    '单价': '',
    '金额': orderRows.reduce((s, r) => s + r.amount, 0) - returnRows.reduce((s, r) => s + r.amount, 0),
    '件数': orderRows.reduce((s, r) => s + r.pieces, 0) - returnRows.reduce((s, r) => s + r.pieces, 0),
    '毛利': '', '经办人': '', '备注': '',
  } as never)
  const ws = XLSX.utils.json_to_sheet(sheetData)
  autoWidth(ws)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '销售明细')
  write(wb, `销售明细_${startDate}_${endDate}`)
}

// ─── Purchase Order List — summary mode ──────────────────────────────────────

interface PurchaseOrderSummaryRow {
  date: string
  supplierCode: string
  supplierName: string
  no: string
  rowType: 'order' | 'return'
  qty: number
  amount: number
  pieces: number
  status?: string
  voided?: boolean
}

export function exportPurchaseOrdersExcel(
  rows: PurchaseOrderSummaryRow[],
  startDate: string,
  endDate: string,
) {
  const sheetData = rows.map(r => ({
    '日期': r.date,
    '供应商': `${r.supplierCode} ${r.supplierName}`,
    '单号': r.no,
    '类型': r.rowType === 'return' ? '退货' : '采购',
    '数量': r.qty,
    '金额': r.rowType === 'return' ? -r.amount : r.amount,
    '件数': r.pieces || 0,
    '状态': r.voided ? '已作废' : (r.rowType === 'return' ? '退货' : (r.status ?? '')),
  }))
  const orderRows  = rows.filter(r => r.rowType === 'order')
  const returnRows = rows.filter(r => r.rowType === 'return')
  sheetData.push({
    '日期': '', '供应商': '', '单号': '合计', '类型': '',
    '数量': orderRows.reduce((s, r) => s + r.qty, 0) - returnRows.reduce((s, r) => s + r.qty, 0),
    '金额': orderRows.reduce((s, r) => s + r.amount, 0) - returnRows.reduce((s, r) => s + r.amount, 0),
    '件数': orderRows.reduce((s, r) => s + r.pieces, 0) - returnRows.reduce((s, r) => s + r.pieces, 0),
    '状态': '',
  })
  const ws = XLSX.utils.json_to_sheet(sheetData)
  autoWidth(ws)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '采购单据')
  write(wb, `采购单据_${startDate}_${endDate}`)
}

// ─── Purchase Order List — detail mode ───────────────────────────────────────

export function exportPurchaseOrdersDetailExcel(
  rows: PurchaseDetailRow[],
  startDate: string,
  endDate: string,
) {
  const sheetData = rows.map(r => ({
    '日期': r.date,
    '供应商': `${r.supplierCode} ${r.supplierName}`,
    '单号': r.no,
    '类型': r.rowType === 'return' ? '退货' : '采购',
    '产品编码': r.productCode,
    '产品名称': r.productName,
    '单位': r.unit,
    '数量': r.qty,
    '单价': r.unitPrice,
    '金额': r.rowType === 'return' ? -r.amount : r.amount,
    '件数': r.pieces || 0,
    '经办人': r.operator ?? '',
    '备注': r.notes ?? '',
  }))
  const orderRows  = rows.filter(r => r.rowType === 'order')
  const returnRows = rows.filter(r => r.rowType === 'return')
  sheetData.push({
    '日期': '', '供应商': '', '单号': '合计', '类型': '', '产品编码': '', '产品名称': '', '单位': '',
    '数量': orderRows.reduce((s, r) => s + r.qty, 0) - returnRows.reduce((s, r) => s + r.qty, 0),
    '单价': '',
    '金额': orderRows.reduce((s, r) => s + r.amount, 0) - returnRows.reduce((s, r) => s + r.amount, 0),
    '件数': orderRows.reduce((s, r) => s + r.pieces, 0) - returnRows.reduce((s, r) => s + r.pieces, 0),
    '经办人': '', '备注': '',
  } as never)
  const ws = XLSX.utils.json_to_sheet(sheetData)
  autoWidth(ws)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '采购明细')
  write(wb, `采购明细_${startDate}_${endDate}`)
}

// ─── Product List ─────────────────────────────────────────────────────────────

export function exportProductsExcel(rows: Product[]) {
  const getPieces = (r: Product) =>
    r.unitsPerPiece ? Math.floor((r.stock || 0) / r.unitsPerPiece) : null
  const sheetData = rows.map(r => ({
    '编码': r.code,
    '货品名称': r.name,
    '供应商': r.supplierName,
    '品类': r.category ?? '',
    '等级': r.grade ?? '',
    '单位': r.unit,
    '每件数量': r.unitsPerPiece ?? '',
    '最新进价': r.costPrice != null ? r.costPrice : '',
    '单价': r.price != null ? r.price : '',
    '库存': r.stock || 0,
    '件数': getPieces(r) ?? '',
    '状态': r.status === 1 ? '启用' : '停用',
  }))
  const ws = XLSX.utils.json_to_sheet(sheetData)
  autoWidth(ws)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '货品列表')
  write(wb, `货品列表_${new Date().toISOString().slice(0, 10)}`)
}

// ─── Inventory List ───────────────────────────────────────────────────────────

export function exportInventoryListExcel(rows: InventoryRow[]) {
  const getPieces = (r: InventoryRow) =>
    r.unitsPerPiece ? Math.ceil(r.stock / r.unitsPerPiece) : null
  const sheetData = rows.map(r => ({
    '编码': r.productCode,
    '货品名称': r.productName,
    '供应商': r.supplierName,
    '分类': r.category ?? '',
    '单位': r.unit,
    '当前库存': r.stock,
    '件数': getPieces(r) ?? '',
    '每件数量': r.unitsPerPiece ?? '',
    '最后更新': r.lastUpdated,
  }))
  const totalQty    = rows.reduce((s, r) => s + r.stock, 0)
  const totalPieces = rows.reduce((s, r) => s + (getPieces(r) ?? 0), 0)
  sheetData.push({ '编码': '', '货品名称': '合计', '供应商': '', '分类': '', '单位': '', '当前库存': totalQty, '件数': totalPieces, '每件数量': '', '最后更新': '' })
  const ws = XLSX.utils.json_to_sheet(sheetData)
  autoWidth(ws)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '产品库存')
  write(wb, `产品库存_${new Date().toISOString().slice(0, 10)}`)
}

// ─── Payment List ─────────────────────────────────────────────────────────────

export function exportPaymentsExcel(
  rows: Payment[],
  startDate: string,
  endDate: string,
) {
  const sheetData = rows.map(r => ({
    '日期': r.paymentDate,
    '单号': r.orderNo,
    '客户': `${r.customerCode} ${r.customerName}`,
    '金额': r.amount,
    '收款方式': r.method,
    '备注': r.notes ?? '',
    '操作人': r.operator ?? '',
  }))
  const total = rows.reduce((s, r) => s + r.amount, 0)
  sheetData.push({ '日期': '', '单号': '', '客户': '合计', '金额': total, '收款方式': '', '备注': '', '操作人': '' })
  const ws = XLSX.utils.json_to_sheet(sheetData)
  autoWidth(ws)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '收款记录')
  write(wb, `收款记录_${startDate}_${endDate}`)
}
