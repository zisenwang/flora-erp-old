import { useEffect, useState } from 'react'
import { getLossRecords, type LossRecord } from '@/api/loss'
import { getProducts, type Product } from '@/api/products'
import { getErrorMessage } from '@/utils/error'
import { monthStart, parseSlashDate, toSlashDate } from '@/utils/slashDate'
import { exportRows, rangeName } from '@/utils/exportExcel'
import { SearchIcon } from '@/pages/master/SupplierIcons'
import ExcelButton from '@/pages/common/ExcelButton'
import styles from '@/pages/purchase/PurchaseDocs.module.css'

interface Filters {
  start: string   // slash date text, '' = no limit
  end: string
  field: 'productCode' | 'productName' | 'operator' | 'notes'
  keyword: string
}

const PAGE_SIZE = 50
const PAGE_WINDOW = 10

const defaultFilters = (): Filters => ({
  start: monthStart(),   // current month (1st → today)
  end: toSlashDate(),
  field: 'productCode',
  keyword: '',
})

// 备注 column: 行备注 (reason) + 整单备注 (notes)
const noteOf = (r: LossRecord) => [r.reason, r.notes].filter(Boolean).join(' ')

// 报损记录 — same layout as 库存调整明细 (kp_djmx_list.asp). Each row is one loss record.
// The loss API only filters by date; the keyword filter runs here, and 规格 / 等级 / 包装 / 供应商
// come from the product list.
export default function LossList() {
  const [rows, setRows] = useState<LossRecord[]>([])
  const [productsById, setProductsById] = useState<Record<number, Product>>({})
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Filters>(defaultFilters)
  const [applied, setApplied] = useState<Filters>(form)
  const [page, setPage] = useState(1)

  useEffect(() => {
    getProducts()
      .then(list => setProductsById(Object.fromEntries(list.map(p => [p.id, p]))))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setPage(1)
    getLossRecords({
      startDate: parseSlashDate(applied.start) ?? undefined,
      endDate: parseSlashDate(applied.end) ?? undefined,
    })
      .then(list => {
        const q = applied.keyword.toLowerCase()
        setRows(!q ? list : list.filter(r => {
          switch (applied.field) {
            case 'productCode': return r.productCode.toLowerCase().includes(q)
            case 'productName': return r.productName.toLowerCase().includes(q)
            case 'operator': return (r.operator ?? '').toLowerCase().includes(q)
            case 'notes':
            default: return noteOf(r).toLowerCase().includes(q)
          }
        }))
      })
      .catch(err => alert(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [applied])

  // ── Derived ──────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const windowStart = Math.floor((page - 1) / PAGE_WINDOW) * PAGE_WINDOW + 1
  const windowEnd = Math.min(windowStart + PAGE_WINDOW - 1, totalPages)

  const sum = (list: LossRecord[]) => list.reduce((s, r) => s + Number(r.qty), 0)
  const pageSum = sum(paged)
  const allSum = sum(rows)

  // ── Actions ──────────────────────────────────────────────────
  function setField<K extends keyof Filters>(key: K, value: Filters[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleSearch() {
    if (form.start && !parseSlashDate(form.start)) { alert('开始日期格式不正确，例如 2026/10/1'); return }
    if (form.end && !parseSlashDate(form.end)) { alert('结束日期格式不正确，例如 2026/10/1'); return }
    setApplied({ ...form, keyword: form.keyword.trim() })
  }

  function handleShowAll() {
    const all: Filters = { start: '', end: '', field: form.field, keyword: '' }
    setForm(all)
    setApplied(all)
  }

  // 导出EXCEL: every record, same columns as the table + 总计
  function handleExport() {
    exportRows(
      `报损记录_${rangeName(applied.start, applied.end)}`,
      ['类型', '日期', '编码', '规格', '产品', '等级', '包装', '供应商', '单位', '报损数量', '经办人', '备注'],
      [
        ...rows.map(r => {
          const p = productsById[r.productId]
          return [
            '报损单', toSlashDate(r.date), r.productCode,
            p?.spec, r.productName, p?.grade, p?.unitsPerPiece, p?.supplierCode, r.unit,
            Number(r.qty), r.operator, noteOf(r),
          ]
        }),
        ['总计', '', '', '', '', '', '', '', '', allSum, '', ''],
      ],
    )
  }

  const totalRow = (label: string, total: number) => (
    <tr>
      <td colSpan={9} className={`${styles.r} ${styles.hatch}`}>{label}</td>
      <td className={`${styles.c} ${styles.hatch}`}>&nbsp;{total}</td>
      <td colSpan={2} className={styles.hatch}>&nbsp;</td>
    </tr>
  )

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ── Sub-toolbar (Enter = 查找) ── */}
      <form className={styles.subbar} onSubmit={e => { e.preventDefault(); handleSearch() }}>
        <SearchIcon />
        从<input className={styles.dateInput} type="text" value={form.start} onChange={e => setField('start', e.target.value)} />
        至<input className={styles.dateInput} type="text" value={form.end} onChange={e => setField('end', e.target.value)} />
        <select value={form.field} onChange={e => setField('field', e.target.value as Filters['field'])}>
          <option value="productCode">产品编码</option>
          <option value="productName">产品名称</option>
          <option value="operator">开单人</option>
          <option value="notes">备注</option>
        </select>
        <input className={styles.kwInput} type="text" value={form.keyword} onChange={e => setField('keyword', e.target.value)} />
        <input type="submit" value="查找" />
        <input type="button" value="显示全部" onClick={handleShowAll} />
        &nbsp;<ExcelButton onClick={handleExport} />
      </form>

      <div className={styles.body}>
        {loading ? <div className={styles.loading}>数据加载中，请稍候...</div> : (
          <table className={styles.grid}>
            <thead>
              <tr>
                <th>&nbsp;类型&nbsp;</th>
                <th>&nbsp;日期&nbsp;</th>
                <th>&nbsp;编码&nbsp;</th>
                <th>&nbsp;规格&nbsp;</th>
                <th>&nbsp;产品&nbsp;</th>
                <th>&nbsp;等级&nbsp;</th>
                <th>&nbsp;包装&nbsp;</th>
                <th>&nbsp;供应商&nbsp;</th>
                <th>&nbsp;单位&nbsp;</th>
                <th>&nbsp;报损数量&nbsp;</th>
                <th>&nbsp;经办人&nbsp;</th>
                <th>&nbsp;备注&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(r => {
                const p = productsById[r.productId]
                return (
                  <tr key={r.id} className={styles.row}>
                    <td>&nbsp;报损单&nbsp;</td>
                    <td>&nbsp;{toSlashDate(r.date)}&nbsp;</td>
                    <td>&nbsp;{r.productCode}&nbsp;</td>
                    <td>&nbsp;{p?.spec ?? ''}&nbsp;</td>
                    <td>&nbsp;{r.productName}&nbsp;</td>
                    <td>&nbsp;{p?.grade ?? ''}&nbsp;</td>
                    <td>&nbsp;{p?.unitsPerPiece ?? ''}&nbsp;</td>
                    <td>&nbsp;{p?.supplierCode ?? ''}&nbsp;</td>
                    <td>&nbsp;{r.unit}&nbsp;</td>
                    <td className={styles.c}>&nbsp;{Number(r.qty)}&nbsp;</td>
                    <td>&nbsp;{r.operator ?? ''}&nbsp;</td>
                    <td>&nbsp;{noteOf(r)}&nbsp;</td>
                  </tr>
                )
              })}
              {totalRow('本页小计', pageSum)}
              {totalRow('总计', allSum)}
            </tbody>
          </table>
        )}

        {/* ── Pager ── */}
        <table className={styles.pager}>
          <tbody>
            <tr>
              <td className={styles.pagerTotal}>&nbsp;总{rows.length}个,共{totalPages}页</td>
              <td className={styles.pagerGap}></td>
              <td className={styles.pagerPages}>
                {page > 1 && <a className={styles.pageSmall} onClick={() => setPage(page - 1)}>上一页</a>}
                {Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => windowStart + i).map(n => (
                  n === page
                    ? <span key={n} className={styles.pageNum}>{n}</span>
                    : <a key={n} className={styles.pageNum} onClick={() => setPage(n)}>{n}</a>
                ))}
                {page < totalPages && <a className={styles.pageSmall} onClick={() => setPage(page + 1)}>下一页</a>}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
