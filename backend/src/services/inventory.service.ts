import pool from '@/db/pool'
import * as invRepo from '@/repositories/inventory.repo'
import type {
  InventoryRow,
  InventoryAdjustment,
  AdjustInventoryDto,
  AdjustmentRecord,
  AdjustmentFilters,
} from '@/dto/inventory.dto'
import { AppError } from '@/services/supplier.service'

export async function listInventory(
  filters: { supplierId?: number; category?: string; search?: string } = {},
): Promise<InventoryRow[]> {
  return invRepo.findAll(filters)
}

export async function listAdjustments(productId?: number): Promise<InventoryAdjustment[]> {
  return invRepo.findAdjustments(productId)
}

// 库存调整明细 only ever shows manual adjustments (made on the 库存调整 page)
const MANUAL = 'manual'

export async function listManualAdjustments(
  filters: Omit<AdjustmentFilters, 'refType'> = {},
): Promise<AdjustmentRecord[]> {
  return invRepo.findAdjustmentRecords({ ...filters, refType: MANUAL })
}

export async function getManualAdjustment(id: number): Promise<AdjustmentRecord> {
  const record = await invRepo.findAdjustmentRecordById(id)
  if (!record || record.refType !== MANUAL) throw new AppError(404, '调整记录不存在')
  return record
}

export async function adjustInventory(
  dto: AdjustInventoryDto,
  operator: string | null,
): Promise<void> {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const qtyBefore = await invRepo.getQuantity(dto.productId, conn)
    const qtyChange = dto.qtyNew - qtyBefore
    await invRepo.setQuantity(dto.productId, dto.qtyNew, conn)
    await invRepo.logAdjustment(
      {
        productId: dto.productId,
        type: 'adjust',
        qtyBefore,
        qtyChange,
        qtyAfter: dto.qtyNew,
        reason: dto.reason,
        refType: 'manual',
        operator: operator ?? undefined,
      },
      conn,
    )
    await conn.commit()
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}
