import * as repo from '@/repositories/customer.repo'
import type { Customer, CreateCustomerDto, UpdateCustomerDto } from '@/dto/customer.dto'
import { AppError } from '@/services/supplier.service'

export async function listCustomers(search?: string): Promise<Customer[]> {
  return repo.findAll(search)
}

export async function getCustomer(id: number): Promise<Customer> {
  const customer = await repo.findById(id)
  if (!customer) throw new AppError(404, '客户不存在')
  return customer
}

export async function createCustomer(dto: CreateCustomerDto): Promise<Customer> {
  return repo.create(dto)
}

export async function updateCustomer(id: number, dto: UpdateCustomerDto): Promise<Customer> {
  const customer = await repo.update(id, dto)
  if (!customer) throw new AppError(404, '客户不存在')
  return customer
}

export async function deleteCustomer(id: number): Promise<void> {
  const ok = await repo.remove(id)
  if (!ok) throw new AppError(404, '客户不存在')
}

export async function getNextCode(): Promise<string> {
  return repo.getNextCode()
}
