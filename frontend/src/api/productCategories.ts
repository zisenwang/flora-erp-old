import client from './client.ts'

// 产品分类 (product_categories table) — products store the category id
export interface ProductCategory {
  id: number
  name: string
  operator: string | null
  createdAt: string
  updatedAt: string
  productCount: number
}

export const listProductCategories = async (): Promise<ProductCategory[]> => {
  const res = await client.get<{ data: ProductCategory[] }>('/product-categories')
  return res.data.data
}

export const getProductCategory = async (id: number): Promise<ProductCategory> => {
  const res = await client.get<{ data: ProductCategory }>(`/product-categories/${id}`)
  return res.data.data
}

export const createProductCategory = async (name: string): Promise<ProductCategory> => {
  const res = await client.post<{ data: ProductCategory }>('/product-categories', { name })
  return res.data.data
}

export const updateProductCategory = async (id: number, name: string): Promise<ProductCategory> => {
  const res = await client.put<{ data: ProductCategory }>(`/product-categories/${id}`, { name })
  return res.data.data
}

export const deleteProductCategory = async (id: number): Promise<void> => {
  await client.delete(`/product-categories/${id}`)
}
