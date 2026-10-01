export interface Customer {
  id: number
  code: string
  name: string
  phone: string | null
  address: string | null
  notes: string | null
  status: number
}

export interface CreateCustomerDto {
  code: string
  name: string
  phone?: string
  address?: string
  notes?: string
}

export interface UpdateCustomerDto extends Partial<CreateCustomerDto> {
  status?: number
}
