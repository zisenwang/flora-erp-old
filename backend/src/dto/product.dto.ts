export interface Product {
  id: number
  code: string
  name: string
  supplierId: number
  supplierName: string
  supplierCode: string
  category: string | null
  grade: string | null
  spec: string | null
  unit: string
  costPrice: number | null
  price: number | null
  unitsPerPiece: number | null // how many units (盆) per piece (件); null = not fixed
  status: number
  stock: number
}

export interface CreateProductDto {
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
}

export interface UpdateProductDto extends Partial<CreateProductDto> {
  status?: number
}
