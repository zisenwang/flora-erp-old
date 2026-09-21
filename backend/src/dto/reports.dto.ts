export interface SalesReportOrder {
  id: number
  orderNo: string
  customerId: number
  customerName: string
  orderDate: string
  totalQty: number
  totalAmount: number
  totalPieces: number
  paymentStatus: string
}

export interface SalesReportResult {
  totalOrders: number
  totalAmount: number
  totalPieces: number
  totalPaid: number
  totalUnpaid: number
  totalProfit: number
  orders: SalesReportOrder[]
}

export interface PurchaseReportOrder {
  id: number
  orderNo: string
  supplierId: number
  supplierName: string
  orderDate: string
  totalQty: number
  totalAmount: number
  finalAmount: number
  status: string
}

export interface PurchaseReportResult {
  totalOrders: number
  totalAmount: number
  totalQty: number
  orders: PurchaseReportOrder[]
}

export interface InventoryReportRow {
  productId: number
  productCode: string
  productName: string
  supplierName: string
  supplierCode: string
  category: string
  unit: string
  unitsPerPiece: number | null
  stock: number
  costPrice: number | null
  price: number
}

export interface InventoryReportResult {
  totalItems: number
  totalStock: number
  inventory: InventoryReportRow[]
}

// ── Aggregated report types ───────────────────────────────────────────────────

export interface ReportGroupRow {
  id: number
  name: string          // always "{code} {name}" for customers/suppliers; "{code} {name}" for products
  unit?: string         // only for products
  orderCount: number
  totalQty: number
  totalPieces: number
  totalAmount: number
  totalProfit?: number  // sales only
}

export interface ReportOrderRow {
  orderId: number
  orderNo: string
  orderDate: string
  customerName?: string       // sales only
  productCode?: string
  productName?: string
  supplierCode?: string
  supplierName?: string
  unit?: string | null
  operator?: string | null
  qty: number
  pieces: number
  unitPrice: number
  amount: number
  discount: number
  finalAmount: number
  costPrice?: number | null   // sales only
  profit?: number             // sales only
  notes?: string | null
  isReturn?: boolean
}
