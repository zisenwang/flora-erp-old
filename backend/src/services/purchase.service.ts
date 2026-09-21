import pool from '@/db/pool'
import * as purchaseRepo from '@/repositories/purchase.repo'
import * as invRepo from '@/repositories/inventory.repo'
import * as productRepo from '@/repositories/product.repo'
import { genPurchaseNo } from '@/utils/orderNo'
import { AppError } from '@/services/supplier.service'
import type {
  PurchaseOrder,
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  PurchaseDetailRow,
} from '@/dto/purchase.dto'

function computeLineTotals(items: CreatePurchaseOrderDto['items'], orderDiscount: number) {
  let totalQty = 0,
    totalPieces = 0,
    totalAmount = 0
  const lines = items.map((item) => {
    const discount = item.discount ?? 100
    const amount = +(item.qty * item.unitPrice).toFixed(2)
    const finalAmount = +((amount * discount) / 100).toFixed(2)
    const pieces = item.pieces ?? 0
    totalQty += item.qty
    totalPieces += pieces
    totalAmount += finalAmount
    return { ...item, discount, amount, finalAmount, pieces }
  })
  totalAmount = +totalAmount.toFixed(2)
  const finalAmount = +((totalAmount * orderDiscount) / 100).toFixed(2)
  return { lines, totalQty, totalPieces, totalAmount, finalAmount }
}

export async function listOrders(
  filters: Parameters<typeof purchaseRepo.findAll>[0],
): Promise<PurchaseOrder[]> {
  return purchaseRepo.findAll(filters)
}

export async function listDetail(
  filters: Parameters<typeof purchaseRepo.findDetail>[0],
): Promise<PurchaseDetailRow[]> {
  return purchaseRepo.findDetail(filters)
}

export async function getOrder(id: number): Promise<PurchaseOrder> {
  const order = await purchaseRepo.findById(id)
  if (!order) throw new AppError(404, '采购订单不存在')
  return order
}

export async function createOrder(
  dto: CreatePurchaseOrderDto,
  operator: string | null,
): Promise<PurchaseOrder> {
  const orderDiscount = dto.discount ?? 100
  const { lines, totalQty, totalPieces, totalAmount, finalAmount } = computeLineTotals(dto.items, orderDiscount)

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const orderId = await purchaseRepo.insertOrder(
      {
        supplierId: dto.supplierId,
        date: dto.orderDate,
        totalQty,
        totalPieces,
        totalAmount,
        discount: orderDiscount,
        finalAmount,
        operator,
        notes: dto.notes ?? null,
      },
      conn,
    )
    const seq = await purchaseRepo.countByDate(dto.orderDate, orderId, conn)
    await purchaseRepo.setOrderNo(orderId, genPurchaseNo(seq, new Date(dto.orderDate)), conn)

    for (const line of lines) {
      await purchaseRepo.insertItem(
        orderId,
        {
          productId: line.productId,
          qty: line.qty,
          pieces: line.pieces,
          unitPrice: line.unitPrice,
          amount: line.amount,
          discount: line.discount,
          finalAmount: line.finalAmount,
          notes: line.notes ?? null,
        },
        conn,
      )
      await productRepo.updateCostPrice(line.productId, line.unitPrice, conn)

      const qtyBefore = await invRepo.getQuantity(line.productId, conn)
      await invRepo.incrementQuantity(line.productId, line.qty, conn)
      await invRepo.logAdjustment(
        {
          productId: line.productId,
          type: 'in',
          qtyBefore,
          qtyChange: line.qty,
          qtyAfter: qtyBefore + line.qty,
          refType: 'purchase',
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

export async function voidOrder(id: number): Promise<PurchaseOrder> {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const order = await purchaseRepo.findById(id)
    if (!order) throw new AppError(404, '采购订单不存在')

    // Get current items to reverse inventory
    const [itemRows] = await conn.query<import('mysql2/promise').RowDataPacket[]>(
      'SELECT product_id, qty FROM purchase_order_items WHERE order_id = ?', [id],
    )
    // Reverse: purchase added items to inventory, void removes them
    for (const row of itemRows as { product_id: number; qty: number }[]) {
      if (row.qty > 0) await invRepo.incrementQuantity(row.product_id, -row.qty, conn)
    }
    // Zero out all item quantities and amounts
    await conn.query(
      'UPDATE purchase_order_items SET qty=0, amount=0, final_amount=0, pieces=0 WHERE order_id=?', [id],
    )
    // Zero out order totals, set status=作废, prepend note
    const newNotes = order.notes ? `作废_${order.notes}` : '作废'
    await conn.query(
      `UPDATE purchase_orders SET total_qty=0, total_pieces=0, total_amount=0, final_amount=0, status='作废', notes=? WHERE id=?`,
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

export async function updateOrder(id: number, dto: UpdatePurchaseOrderDto): Promise<PurchaseOrder> {
  const orderDiscount = dto.discount ?? 100
  const { lines, totalQty, totalPieces, totalAmount, finalAmount } = computeLineTotals(dto.items, orderDiscount)

  const existing = await purchaseRepo.findById(id)
  if (!existing) throw new AppError(404, '采购订单不存在')
  const dateChanged = existing.orderDate !== dto.orderDate

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const oldItems = await purchaseRepo.deleteItems(id, conn)
    for (const old of oldItems) {
      await invRepo.incrementQuantity(old.productId, -old.qty, conn)
    }

    await purchaseRepo.updateOrderTotals(
      id,
      {
        supplierId: dto.supplierId,
        date: dto.orderDate,
        totalQty,
        totalPieces,
        totalAmount,
        discount: orderDiscount,
        finalAmount,
        notes: dto.notes ?? null,
      },
      conn,
    )

    if (dateChanged) {
      const seq = await purchaseRepo.countByDate(dto.orderDate, id, conn)
      await purchaseRepo.setOrderNo(id, genPurchaseNo(seq, new Date(dto.orderDate)), conn)
    }

    for (const line of lines) {
      await purchaseRepo.insertItem(
        id,
        {
          productId: line.productId,
          qty: line.qty,
          pieces: line.pieces,
          unitPrice: line.unitPrice,
          amount: line.amount,
          discount: line.discount,
          finalAmount: line.finalAmount,
          notes: line.notes ?? null,
        },
        conn,
      )
      await productRepo.updateCostPrice(line.productId, line.unitPrice, conn)
      await invRepo.incrementQuantity(line.productId, line.qty, conn)
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
