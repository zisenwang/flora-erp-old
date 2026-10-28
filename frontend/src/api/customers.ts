import client from "./client.ts";

export interface Customer {
  id: number;
  code: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  paymentCycle: string | null; // 付款周期
  status: number;
}

// 付款周期 options (stored as text in customers.payment_cycle)
export const PAYMENT_CYCLES = ["按日结款", "按月结款"];

export type CustomerPayload = Omit<Customer, "id">;

export const getCustomers = async (search?: string): Promise<Customer[]> => {
  const res = await client.get<{ data: Customer[] }>("/customers", {
    params: { search },
  });
  return res.data.data;
};

export const createCustomer = async (
  payload: CustomerPayload,
): Promise<Customer> => {
  const res = await client.post<{ data: Customer }>("/customers", payload);
  return res.data.data;
};

export const updateCustomer = async (
  id: number,
  payload: CustomerPayload,
): Promise<Customer> => {
  const res = await client.put<{ data: Customer }>(`/customers/${id}`, payload);
  return res.data.data;
};

export const deleteCustomer = async (id: number): Promise<void> => {
  await client.delete(`/customers/${id}`)
}

export const getNextCustomerCode = async (): Promise<string> => {
  const res = await client.get<{ data: string }>('/customers/next-code')
  return res.data.data
}

export const getCustomer = async (id: number): Promise<Customer> => {
  const res = await client.get<{ data: Customer }>(`/customers/${id}`)
  return res.data.data
}
