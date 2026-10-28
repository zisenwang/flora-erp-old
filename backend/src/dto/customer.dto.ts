export interface Customer {
  id: number
  code: string
  name: string
  phone: string | null
  address: string | null
  notes: string | null
  paymentCycle: string | null   // 付款周期: 按日结款 / 按月结款
  status: number
}

export interface CreateCustomerDto {
  code: string
  name: string
  phone?: string
  address?: string
  notes?: string
  paymentCycle?: string
}

export interface UpdateCustomerDto extends Partial<CreateCustomerDto> {
  status?: number
}
