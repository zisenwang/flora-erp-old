import client from "./client.ts";

export interface InventoryRow {
  productId: number;
  productCode: string;
  productName: string;
  supplierName: string;
  supplierCode: string;
  category: string;
  unit: string;
  unitsPerPiece: number | null;
  stock: number;
  lastUpdated: string;
}

export interface InventoryAdjustment {
  id: number;
  productId: number;
  productCode: string;
  productName: string;
  type: string;
  qtyBefore: number;
  qtyChange: number;
  qtyAfter: number;
  reason: string;
  refType: string;
  refId: number;
  operator: string;
  createdAt: string;
}

export interface AdjustPayload {
  productId: number;
  qtyNew: number;
  reason?: string;
}

export const getInventory = async (params?: {
  supplierId?: number;
  category?: string;
  search?: string;
}): Promise<InventoryRow[]> => {
  const res = await client.get<{ data: InventoryRow[] }>("/inventory", {
    params,
  });
  return res.data.data;
};

export const getAdjustments = async (params?: { productId?: number }): Promise<InventoryAdjustment[]> => {
  const res = await client.get<{ data: InventoryAdjustment[] }>(
    "/inventory/adjustments",
    { params },
  );
  return res.data.data;
};

export const createAdjustment = async (
  payload: AdjustPayload,
): Promise<InventoryAdjustment> => {
  const res = await client.post<{ data: InventoryAdjustment }>(
    "/inventory/adjust",
    payload,
  );
  return res.data.data;
};
