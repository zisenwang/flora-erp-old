import { getProducts } from '@/api/products'

// 规格 search in the 单据 lists (customer request 10-20): the backend can't search by spec,
// so find the product codes whose 规格 contains the keyword (LIKE, case-insensitive)
export async function specCodes(keyword: string): Promise<Set<string>> {
  const q = keyword.trim().toLowerCase()
  const products = await getProducts()
  return new Set(products.filter(p => (p.spec ?? '').toLowerCase().includes(q)).map(p => p.code))
}
