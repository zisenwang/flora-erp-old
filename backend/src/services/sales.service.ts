import pool from '@/db/pool'
import * as salesRepo from '@/repositories/sales.repo'
import * as invRepo from '@/repositories/inventory.repo'
import * as productRepo from '@/repositories/product.repo'
import { genSalesNo } from '@/utils/orderNo'
import { AppError } from '@/services/supplier.service'
import type { SalesOrder, CreateSalesOrderDto, UpdateSalesOrderDto, SalesDetailRow } from '@/dto/sales.dto'

function computeLineTotals(items: CreateSalesOrderDto['items']) {
  let totalQty = 0,
    totalAmount = 0,
    totalPieces = 0
  const lines = items.map((item) => {
    const discount = item.discount ?? 100
    const amount = +(item.qty * item.unitPrice).toFixed(2)
    const finalAmount = +((amount * discount) / 100).toFixed(2)
    totalQty += item.qty
    totalAmount += finalAmount
    totalPieces += item.pieces ?? 0
    return { ...item, discount, amount, finalAmount }
  })
  return { lines, totalQty, totalAmount: +totalAmount.toFixed(2), totalPieces }
}

export async function listOrders(
  filters: Parameters<typeof salesRepo.findAll>[0],
): Promise<SalesOrder[]> {
  return salesRepo.findAll(filters)
}

export async function listDetail(
  filters: Parameters<typeof salesRepo.findDetail>[0],
): Promise<SalesDetailRow[]> {
  return salesRepo.findDetail(filters)
}

export async function getOrder(id: number): Promise<SalesOrder> {
  const order = await salesRepo.findById(id)
  if (!order) throw new AppError(404, '销售订单不存在')
  return order
}

export async function createOrder(
  dto: CreateSalesOrderDto,
  operator: string | null,
): Promise<SalesOrder> {
  const { lines, totalQty, totalAmount, totalPieces } = computeLineTotals(dto.items)

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const orderId = await salesRepo.insertOrder(
      {
        customerId: dto.customerId,
        date: dto.orderDate,
        totalQty,
        totalAmount,
        totalPieces,
        operator,
        notes: dto.notes ?? null,
      },
      conn,
    )
    const seq = await salesRepo.countByDate(dto.orderDate, orderId, conn)
    await salesRepo.setOrderNo(orderId, genSalesNo(seq, new Date(dto.orderDate)), conn)

    for (const line of lines) {
      await salesRepo.insertItem(
        orderId,
        {
          productId: line.productId,
          supplierId: line.supplierId,
          qty: line.qty,
          unitPrice: line.unitPrice,
          amount: line.amount,
          discount: line.discount,
          finalAmount: line.finalAmount,
          costPrice: line.costPrice ?? null,
          pieces: line.pieces ?? 0,
          notes: line.notes ?? null,
        },
        conn,
      )
      await productRepo.updatePrice(line.productId, line.unitPrice, conn)

      const qtyBefore = await invRepo.getQuantity(line.productId, conn)
      await invRepo.incrementQuantity(line.productId, -line.qty, conn)
      await invRepo.logAdjustment(
        {
          productId: line.productId,
          type: 'out',
          qtyBefore,
          qtyChange: -line.qty,
          qtyAfter: qtyBefore - line.qty,
          refType: 'sale',
          refId: orderId,
          operator: operator ?? undefined,
        },
        conn,
      )
    }

    await conn.commit()
    return getOrder(orderId)
  } catch (e) {
    try { await conn.rollback() } catch { conn.destroy() }
    throw e
  } finally {
    conn.release()
  }
}

export async function voidOrder(id: number): Promise<SalesOrder> {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const order = await salesRepo.findById(id)
    if (!order) throw new AppError(404, '销售订单不存在')

    // Get current items to reverse inventory
    const [itemRows] = await conn.query<import('mysql2/promise').RowDataPacket[]>(
      'SELECT product_id, qty FROM sales_order_items WHERE order_id = ?', [id],
    )
    // Reverse: sales took items out, void adds them back
    for (const row of itemRows as { product_id: number; qty: number }[]) {
      if (row.qty > 0) await invRepo.incrementQuantity(row.product_id, row.qty, conn)
    }
    // Zero out all item quantities and amounts
    await conn.query(
      'UPDATE sales_order_items SET qty=0, amount=0, final_amount=0, pieces=0 WHERE order_id=?', [id],
    )
    // Zero out order totals, set status=作废, prepend note
    const newNotes = order.notes ? `作废_${order.notes}` : '作废'
    await conn.query(
      `UPDATE sales_orders SET total_qty=0, total_amount=0, total_pieces=0, status='作废', notes=? WHERE id=?`,
      [newNotes, id],
    )
    await conn.commit()
    return getOrder(id)
  } catch (e) {
    try { await conn.rollback() } catch { conn.destroy() }
    throw e
  } finally {
    conn.release()
  }
}

export async function updateOrder(id: number, dto: UpdateSalesOrderDto): Promise<SalesOrder> {
  const { lines, totalQty, totalAmount, totalPieces } = computeLineTotals(dto.items)

  const existing = await salesRepo.findById(id)
  if (!existing) throw new AppError(404, '销售订单不存在')
  const dateChanged = existing.orderDate !== dto.orderDate

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // Restore inventory for old items
    const oldItems = await salesRepo.deleteItems(id, conn)
    for (const old of oldItems) {
      await invRepo.incrementQuantity(old.productId, old.qty, conn)
    }

    await salesRepo.updateOrderTotals(
      id,
      {
        customerId: dto.customerId,
        date: dto.orderDate,
        totalQty,
        totalAmount,
        totalPieces,
        notes: dto.notes ?? null,
      },
      conn,
    )

    if (dateChanged) {
      const seq = await salesRepo.countByDate(dto.orderDate, id, conn)
      await salesRepo.setOrderNo(id, genSalesNo(seq, new Date(dto.orderDate)), conn)
    }

    for (const line of lines) {
      await salesRepo.insertItem(
        id,
        {
          productId: line.productId,
          supplierId: line.supplierId,
          qty: line.qty,
          unitPrice: line.unitPrice,
          amount: line.amount,
          discount: line.discount,
          finalAmount: line.finalAmount,
          costPrice: line.costPrice ?? null,
          pieces: line.pieces ?? 0,
          notes: line.notes ?? null,
        },
        conn,
      )
      await productRepo.updatePrice(line.productId, line.unitPrice, conn)
      await invRepo.incrementQuantity(line.productId, -line.qty, conn)
    }

    await conn.commit()
    return getOrder(id)
  } catch (e) {
    try { await conn.rollback() } catch { conn.destroy() }
    throw e
  } finally {
    conn.release()
  }
}
