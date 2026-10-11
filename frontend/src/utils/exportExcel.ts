import * as XLSX from 'xlsx'

// 导出EXCEL — the old *_excel.asp pages: the same columns as the list / report on screen.

export type Cell = string | number | null | undefined

// "2026/10/1" + "2026/10/11" → "2026-10-1至2026-10-11" (slashes are not allowed in file names)
export function rangeName(start: string, end: string): string {
  const clean = (s: string) => s.replace(/\//g, '-')
  return `${start ? clean(start) : '最早'}至${end ? clean(end) : '今天'}`
}

// CJK characters take about two columns
function textWidth(v: unknown): number {
  let w = 0
  for (const ch of String(v ?? '')) w += ch.charCodeAt(0) > 255 ? 2 : 1
  return w
}

function save(ws: XLSX.WorkSheet, filename: string) {
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
  const widths: number[] = []
  data.forEach(row => row.forEach((cell, ci) => {
    widths[ci] = Math.max(widths[ci] ?? 4, textWidth(cell) + 2)
  }))
  ws['!cols'] = widths.map(w => ({ wch: Math.min(w, 50) }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// Lists (paged on screen): export every filtered row, not just the current page
export function exportRows(filename: string, header: string[], rows: Cell[][]) {
  const aoa = [header, ...rows.map(r => r.map(c => c ?? ''))]
  save(XLSX.utils.aoa_to_sheet(aoa), filename)
}

// Reports (not paged): export the rendered table as shown. Cells / rows marked
// data-noexport (magnifier columns, repeated headers) are left out; cells marked
// data-t="s" stay text (product codes like 110.10 would otherwise become 110.1).
export function exportTable(filename: string, table: HTMLTableElement | null) {
  if (!table) return
  const copy = table.cloneNode(true) as HTMLTableElement
  copy.querySelectorAll('[data-noexport]').forEach(el => el.remove())

  // colspans that covered a removed column would now run past the table: trim them to the header width
  const span = (el: Element) => Number(el.getAttribute('colspan')) || 1
  const width = [...(copy.rows[0]?.cells ?? [])].reduce((s, c) => s + span(c), 0)
  for (const row of copy.rows) {
    let over = [...row.cells].reduce((s, c) => s + span(c), 0) - width
    for (let i = row.cells.length - 1; i >= 0 && over > 0; i--) {
      const cut = Math.min(over, span(row.cells[i]) - 1)
      if (cut > 0) { row.cells[i].setAttribute('colspan', String(span(row.cells[i]) - cut)); over -= cut }
    }
  }

  copy.querySelectorAll('th, td').forEach(el => {
    const text = (el.textContent ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
    el.textContent = text
    // only plain numbers become numbers — SheetJS would otherwise guess dates from text like "1703 吉宏"
    if (!/^-?\d+(\.\d+)?$/.test(text)) el.setAttribute('data-t', 's')
  })
  save(XLSX.utils.table_to_sheet(copy), filename)
}
