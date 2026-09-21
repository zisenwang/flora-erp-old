export interface Payment {
  id: number
  salesOrderId: number
  orderNo: string
  customerId: number
  customerName: string
  customerCode: string
  amount: number
  method: string
  paymentDate: string
  notes: string | null
  operator: string | null
}

export interface CreatePaymentDto {
  salesOrderId: number
  amount: number
  paymentDate: string
  method?: string
  notes?: string
}
