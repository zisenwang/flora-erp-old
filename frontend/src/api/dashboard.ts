import client from "./client.ts";

export interface DailySalesRow {
  date: string;
  salesQty: number;
  salesAmount: number;
  pieces: number;
  returnQty: number;
  returnAmount: number;
}

export interface DashboardSummary {
  todaySales: number;
  todayIncome: number;
  todayPurchase: number;
  todayOrderCount: number;
  monthlySalesRank: {
    customerCode: string;
    customerName: string;
    totalAmount: number;
    totalPieces: number;
  }[];
  monthlySalesDaily: DailySalesRow[];
}

export const getDashboardSummary = async (): Promise<DashboardSummary> => {
  const res = await client.get<{ data: DashboardSummary }>(
    "/dashboard/summary",
  );
  return res.data.data;
};
