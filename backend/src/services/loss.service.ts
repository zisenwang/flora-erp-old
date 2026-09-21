import pool from '@/db/pool'
import * as lossRepo from '@/repositories/loss.repo'
import * as invRepo from '@/repositories/inventory.repo'
import type { LossRecord, CreateLossDto } from '@/dto/loss.dto'

export async function listLossRecords(
  filters: { startDate?: string; endDate?: string } = {},
): Promise<LossRecord[]> {
  return lossRepo.findAll(filters)
}

export async function createLossRecord(
  dto: CreateLossDto,
  operator: string | null,
): Promise<LossRecord> {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const id = await lossRepo.insert(dto, operator, conn)

    const qtyBefore = await invRepo.getQuantity(dto.productId, conn)
    await invRepo.incrementQuantity(dto.productId, -dto.qty, conn)
    await invRepo.logAdjustment(
      {
        productId: dto.productId,
        type: 'out',
        qtyBefore,
        qtyChange: -dto.qty,
        qtyAfter: qtyBefore - dto.qty,
        reason: dto.reason,
        refType: 'loss',
        refId: id,
        operator: operator ?? undefined,
      },
      conn,
    )

    await conn.commit()
    return lossRepo.findById(id) as Promise<LossRecord>
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}
