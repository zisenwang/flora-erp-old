import pool from '@/db/pool'
import * as payRepo from '@/repositories/payment.repo'
import * as salesRepo from '@/repositories/sales.repo'
import { AppError } from '@/services/supplier.service'
import type { Payment, CreatePaymentDto } from '@/dto/payment.dto'

async function recalcPaymentStatus(
  salesOrderId: number,
  conn: Awaited<ReturnType<typeof pool.getConnection>>,
): Promise<void> {
  const order = await salesRepo.findOrderForPayment(salesOrderId, conn)
  if (!order) return
  const totalPaid = await payRepo.getTotalPaid(salesOrderId, conn)

  let status: '未收款' | '已收款' | '部分收款'
  if (totalPaid <= 0) status = '未收款'
  else if (totalPaid >= order.totalAmount) status = '已收款'
  else status = '部分收款'

  await salesRepo.updatePaymentStatus(salesOrderId, status, conn)
}

export async function listPayments(
  filters: Parameters<typeof payRepo.findAll>[0],
): Promise<Payment[]> {
  return payRepo.findAll(filters)
}

export async function createPayment(
  dto: CreatePaymentDto,
  operator: string | null,
): Promise<{ payment: Payment; paymentStatus: string }> {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const order = await salesRepo.findOrderForPayment(dto.salesOrderId, conn)
    if (!order) throw new AppError(404, '销售单不存在')

    await payRepo.insert(dto, order.customerId, operator, conn)
    await recalcPaymentStatus(dto.salesOrderId, conn)
    await conn.commit()

    const [payments, paymentStatus] = await Promise.all([
      payRepo.findAll({ salesOrderId: dto.salesOrderId }),
      salesRepo.findPaymentStatus(dto.salesOrderId),
    ])
    return { payment: payments[0], paymentStatus: paymentStatus ?? '未收款' }
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}

export async function deletePayment(id: number): Promise<{ paymentStatus: string }> {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const result = await payRepo.remove(id, conn)
    if (!result) throw new AppError(404, '收款记录不存在')

    await recalcPaymentStatus(result.salesOrderId, conn)
    await conn.commit()

    const paymentStatus = await salesRepo.findPaymentStatus(result.salesOrderId)
    return { paymentStatus: paymentStatus ?? '未收款' }
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}
