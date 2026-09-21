export interface SalesRankRow {
  customerCode: string
  customerName: string
  totalAmount: number
  totalPieces: number
}

export interface DailySalesRow {
  date: string
  salesQty: number
  salesAmount: number
  pieces: number
  returnQty: number
  returnAmount: number
}

export interface DashboardSummary {
  todaySales: number
  todayIncome: number
  todayPurchase: number
  todayOrderCount: number
  monthlySalesRank: SalesRankRow[]
  monthlySalesDaily: DailySalesRow[]
}
