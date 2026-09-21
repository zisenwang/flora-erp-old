import client from './client.ts'

export interface Supplier {
  id: number
  code: string
  name: string
  phone: string
  address: string
  status: number
}

export type SupplierPayload = Omit<Supplier, 'id'>

export const getSuppliers = async (search?: string): Promise<Supplier[]> => {
  const res = await client.get<{ data: Supplier[] }>('/suppliers', { params: { search } })
  return res.data.data
}

export const createSupplier = async (payload: SupplierPayload): Promise<Supplier> => {
  const res = await client.post<{ data: Supplier }>('/suppliers', payload)
  return res.data.data
}

export const updateSupplier = async (id: number, payload: SupplierPayload): Promise<Supplier> => {
  const res = await client.put<{ data: Supplier }>(`/suppliers/${id}`, payload)
  return res.data.data
}

export const deleteSupplier = async (id: number): Promise<void> => {
  await client.delete(`/suppliers/${id}`)
}

export const getNextSupplierCode = async (): Promise<string> => {
  const res = await client.get<{ data: string }>('/suppliers/next-code')
  return res.data.data
}
