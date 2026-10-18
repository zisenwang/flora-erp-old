// 收款方式 — same list as the new system's 新增收款
export const PAY_METHODS = ['公户', '银行卡', '微信', '支付宝', '现金']

// An order charged less than its total ends up 部分收款 — the customer agreed to the
// lower price, so it counts as settled (已收款) everywhere in this frontend
export const isPaid = (paymentStatus: string | null | undefined): boolean =>
  paymentStatus === '已收款' || paymentStatus === '部分收款'

export const isVoided = (status: string | null | undefined): boolean => status === '作废'
