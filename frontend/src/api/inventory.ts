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

// ——— Manual adjustments (库存调整明细) — ref_type 'manual' only ———

export interface ManualAdjustment {
  id: number
  productId: number
  productCode: string
  productName: string
  spec: string | null
  grade: string | null
  unit: string
  unitsPerPiece: number | null
  supplierCode: string
  supplierName: string
  qtyBefore: number
  qtyChange: number
  qtyAfter: number
  reason: string | null
  operator: string | null
  createdAt: string // 'YYYY-MM-DD HH:mm'
}

export interface ManualAdjustmentFilters {
  startDate?: string
  endDate?: string
  productCode?: string
  productName?: string
  operator?: string
  reason?: string
}

export const getManualAdjustments = async (params?: ManualAdjustmentFilters): Promise<ManualAdjustment[]> => {
  const res = await client.get<{ data: ManualAdjustment[] }>('/inventory/manual-adjustments', { params })
  return res.data.data
}

export const getManualAdjustment = async (id: number): Promise<ManualAdjustment> => {
  const res = await client.get<{ data: ManualAdjustment }>(`/inventory/manual-adjustments/${id}`)
  return res.data.data
}
