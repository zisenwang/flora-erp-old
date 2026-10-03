import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getManualAdjustments, type ManualAdjustment } from '@/api/inventory'
import { getErrorMessage } from '@/utils/error'
import { monthStart, parseSlashDate, toSlashDate } from '@/utils/slashDate'
import { LookIcon, SearchIcon } from '@/pages/master/SupplierIcons'
import styles from '@/pages/purchase/PurchaseDocs.module.css'

interface Filters {
  start: string   // slash date text, '' = no limit
  end: string
  field: 'productCode' | 'productName' | 'operator' | 'reason'
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

// 库存调整明细 — replicates old kp_djmx_list.asp. Each row is one manual adjustment record
// (no 单号 / 修改 / 打印); 查看 opens the record in the 单据明细 format.
export default function InventoryAdjustments() {
  const navigate = useNavigate()

  const [rows, setRows] = useState<ManualAdjustment[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Filters>(defaultFilters)
  const [applied, setApplied] = useState<Filters>(form)
  const [page, setPage] = useState(1)

  // filtering happens in the backend (manual adjustments only)
  useEffect(() => {
    setLoading(true)
    setPage(1)
    getManualAdjustments({
      startDate: parseSlashDate(applied.start) ?? undefined,
      endDate: parseSlashDate(applied.end) ?? undefined,
      ...(applied.keyword ? { [applied.field]: applied.keyword } : {}),
    })
      .then(setRows)
      .catch(err => alert(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [applied])

  // ── Derived ──────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const windowStart = Math.floor((page - 1) / PAGE_WINDOW) * PAGE_WINDOW + 1
  const windowEnd = Math.min(windowStart + PAGE_WINDOW - 1, totalPages)

  const sum = (list: ManualAdjustment[]) => ({
    before: list.reduce((s, r) => s + r.qtyBefore, 0),
    after: list.reduce((s, r) => s + r.qtyAfter, 0),
    change: list.reduce((s, r) => s + r.qtyChange, 0),
  })
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

  const totalRow = (label: string, t: ReturnType<typeof sum>) => (
    <tr>
      <td colSpan={7} className={`${styles.r} ${styles.hatch}`}>{label}</td>
      <td className={`${styles.c} ${styles.hatch}`}>&nbsp;{t.before}</td>
      <td className={`${styles.c} ${styles.hatch}`}>&nbsp;{t.after}</td>
      <td className={`${styles.c} ${styles.hatch}`}>&nbsp;{t.change}</td>
      <td colSpan={3} className={styles.hatch}>&nbsp;</td>
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
          <option value="reason">备注</option>
        </select>
        <input className={styles.kwInput} type="text" value={form.keyword} onChange={e => setField('keyword', e.target.value)} />
        <input type="submit" value="查找" />
        <input type="button" value="显示全部" onClick={handleShowAll} />
      </form>

      <div className={styles.body}>
        {loading ? <div className={styles.loading}>数据加载中，请稍候...</div> : (
          <table className={styles.grid}>
            <thead>
              <tr>
                <th>&nbsp;类型&nbsp;</th>
                <th>&nbsp;日期&nbsp;</th>
                <th>&nbsp;编码&nbsp;</th>
                <th>&nbsp;产品&nbsp;</th>
                <th>&nbsp;包装&nbsp;</th>
                <th>&nbsp;供应商&nbsp;</th>
                <th>&nbsp;单位&nbsp;</th>
                <th>&nbsp;库存数量&nbsp;</th>
                <th>&nbsp;盘点数量&nbsp;</th>
                <th>盈亏数量</th>
                <th>&nbsp;经办人&nbsp;</th>
                <th>&nbsp;备注&nbsp;</th>
                <th>&nbsp;操作&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(r => (
                <tr key={r.id} className={styles.row}>
                  <td>&nbsp;库存调整单&nbsp;</td>
                  <td>&nbsp;{toSlashDate(r.createdAt.slice(0, 10))}&nbsp;</td>
                  <td>&nbsp;{r.productCode}&nbsp;</td>
                  <td>&nbsp;{r.productName}&nbsp;{r.spec ?? ''}&nbsp;{r.grade ?? ''}&nbsp;</td>
                  <td>&nbsp;{r.unitsPerPiece ?? ''}&nbsp;</td>
                  <td>&nbsp;{r.supplierCode}&nbsp;</td>
                  <td>&nbsp;{r.unit}&nbsp;</td>
                  <td className={styles.c}>&nbsp;{r.qtyBefore}&nbsp;</td>
                  <td className={styles.c}>&nbsp;{r.qtyAfter}&nbsp;</td>
                  <td className={styles.c}>&nbsp;{r.qtyChange}&nbsp;</td>
                  <td>&nbsp;{r.operator ?? ''}&nbsp;</td>
                  <td>&nbsp;{r.reason ?? ''}&nbsp;</td>
                  <td className={styles.c}>
                    <LookIcon title="查看明细" onClick={() => navigate(`/inventory/adjustments/${r.id}`)} />
                  </td>
                </tr>
              ))}
              {totalRow('本页小计', pageSum)}
              {totalRow('总计', allSum)}
            </tbody>
          </table>
        )}

        {/* ── Legend ── */}
        <div className={styles.legend}>
          点击<LookIcon />可以查看明细!
        </div>

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
