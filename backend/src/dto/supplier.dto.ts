export interface Supplier {
  id: number
  code: string
  name: string
  phone: string | null
  address: string | null
  status: number
}

export interface CreateSupplierDto {
  code: string
  name: string
  phone?: string
  address?: string
}

export interface UpdateSupplierDto extends Partial<CreateSupplierDto> {
  status?: number
}
