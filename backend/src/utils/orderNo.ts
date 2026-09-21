// Order number generators
// Format: {prefix}{YYYY}{M}G{DD}_{seq:03d}
// e.g. X20266G23_001 (sales), C20266G23_001 (purchase)
// Sequence resets to 001 each day.

export function genSalesNo(seq: number, date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = String(date.getDate()).padStart(2, '0')
  return `X${y}${m}G${d}_D${seq}`
}

export function genPurchaseNo(seq: number, date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = String(date.getDate()).padStart(2, '0')
  return `C${y}${m}G${d}_D${seq}`
}

export function genPurchaseReturnNo(seq: number, date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = String(date.getDate()).padStart(2, '0')
  return `CR${y}${m}G${d}_D${seq}`
}

export function genSalesReturnNo(seq: number, date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = String(date.getDate()).padStart(2, '0')
  return `XR${y}${m}G${d}_D${seq}`
}
