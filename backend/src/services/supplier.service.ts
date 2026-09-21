import * as repo from '@/repositories/supplier.repo'
import type { Supplier, CreateSupplierDto, UpdateSupplierDto } from '@/dto/supplier.dto'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message)
  }
}

export async function listSuppliers(search?: string): Promise<Supplier[]> {
  return repo.findAll(search)
}

export async function getSupplier(id: number): Promise<Supplier> {
  const supplier = await repo.findById(id)
  if (!supplier) throw new AppError(404, '供应商不存在')
  return supplier
}

export async function createSupplier(dto: CreateSupplierDto): Promise<Supplier> {
  return repo.create(dto)
}

export async function updateSupplier(id: number, dto: UpdateSupplierDto): Promise<Supplier> {
  const supplier = await repo.update(id, dto)
  if (!supplier) throw new AppError(404, '供应商不存在')
  return supplier
}

export async function deleteSupplier(id: number): Promise<void> {
  const ok = await repo.remove(id)
  if (!ok) throw new AppError(404, '供应商不存在')
}

export async function getNextCode(): Promise<string> {
  return repo.getNextCode()
}
