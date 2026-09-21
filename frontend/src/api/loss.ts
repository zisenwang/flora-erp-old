import client from "./client.ts";

export interface LossRecord {
  id: number;
  productId: number;
  productCode: string;
  productName: string;
  unit: string;
  qty: number;
  reason: string;
  operator: string;
  date: string;
  notes: string;
}

export interface LossPayload {
  productId: number;
  qty: number;
  reason?: string;
  date: string;
  notes?: string;
}

export const getLossRecords = async (params?: {
  startDate?: string;
  endDate?: string;
}): Promise<LossRecord[]> => {
  const res = await client.get<{ data: LossRecord[] }>("/loss", { params });
  return res.data.data;
};

export const createLossRecord = async (
  payload: LossPayload,
): Promise<LossRecord> => {
  const res = await client.post<{ data: LossRecord }>("/loss", payload);
  return res.data.data;
};
