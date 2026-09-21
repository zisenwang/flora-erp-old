import client from './client.ts'

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
  notes: string
  operator: string
}

export interface PaymentPayload {
  salesOrderId: number
  amount: number
  paymentDate: string
  method?: string
  notes?: string
}

export const getPayments = async (params?: {
  salesOrderId?: number
  customerId?: number
  startDate?: string
  endDate?: string
}): Promise<Payment[]> => {
  const res = await client.get<{ data: Payment[] }>('/payments', { params })
  return res.data.data
}

export const createPayment = async (payload: PaymentPayload): Promise<Payment> => {
  const res = await client.post<{ data: Payment }>('/payments', payload)
  return res.data.data
}

export const deletePayment = async (id: number): Promise<void> => {
  await client.delete(`/payments/${id}`)
}
