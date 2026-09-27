import client from './client.ts'

export interface Product {
  id: number
  code: string
  name: string
  supplierId: number
  supplierName: string
  supplierCode: string
  category: string
  grade: string
  spec: string
  unit: string
  costPrice: number
  price: number
  unitsPerPiece: number
  status: number
  stock: number
}

export interface ProductPayload {
  code: string
  name: string
  supplierId: number
  category?: string
  grade?: string
  spec?: string
  unit?: string
  costPrice?: number
  price?: number
  unitsPerPiece?: number
  status?: number
}

export const getProducts = async (params?: { supplierId?: number; search?: string }): Promise<Product[]> => {
  const res = await client.get<{ data: Product[] }>('/products', { params })
  return res.data.data
}

export const getProduct = async (id: number): Promise<Product> => {
  const res = await client.get<{ data: Product }>(`/products/${id}`)
  return res.data.data
}

export const createProduct = async (payload: ProductPayload): Promise<Product> => {
  const res = await client.post<{ data: Product }>('/products', payload)
  return res.data.data
}

export const updateProduct = async (id: number, payload: ProductPayload): Promise<Product> => {
  const res = await client.put<{ data: Product }>(`/products/${id}`, payload)
  return res.data.data
}

export const deleteProduct = async (id: number): Promise<void> => {
  await client.delete(`/products/${id}`)
}

export const getNextProductCode = async (supplierId: number): Promise<string> => {
  const res = await client.get<{ data: string }>('/products/next-code', { params: { supplierId } })
  return res.data.data
}

export const getProductCategories = async (): Promise<string[]> => {
  const res = await client.get<{ data: string[] }>('/products/categories')
  return res.data.data
}
