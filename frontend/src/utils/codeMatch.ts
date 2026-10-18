// 客户编码 / 供应商编码 searches are exact: "135" finds code 135, never 1135 or 1351
export const codeEquals = (code: string | null | undefined, keyword: string): boolean =>
  (code ?? '').trim().toLowerCase() === keyword.trim().toLowerCase()
