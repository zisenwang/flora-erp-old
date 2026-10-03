import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPurchaseOrdersDetail, type PurchaseDetailRow } from '@/api/purchase'
import { getProducts, type Product } from '@/api/products'
import { getErrorMessage } from '@/utils/error'
import { monthStart, parseSlashDate, toSlashDate } from '@/utils/slashDate'
import { SearchIcon } from '@/pages/master/SupplierIcons'
import styles from './Report.module.css'

type Mode = 'product' | 'supplier' | 'operator'

const MODES: { mode: Mode; label: string; path: string }[] = [
  { mode: 'product', label: '按产品汇总', path: '/reports/purchase' },
  { mode: 'supplier', label: '按供应商汇总', path: '/reports/purchase/supplier' },
  { mode: 'operator', label: '按经办人汇总', path: '/reports/purchase/operator' },
]

// search field per mode (old bb_cg_cp / bb_cg_kh / bb_cg_jbr)
const FIELDS: Record<Mode, { value: string; label: string }[]> = {
  product: [
    { value: 'productCode', label: '货品编码' },
    { value: 'productName', label: '货品名称' },
    { value: 'supplier', label: '供应商' },
  ],
  supplier: [
    { value: 'productCode', label: '货品编码' },
    { value: 'productName', label: '货品名称' },
  ],
  operator: [{ value: 'operator', label: '经办人' }],
}

interface Filters {
  start: string   // slash date text, '' = no limit
  end: string
  field: string
  keyword: string
  sort: 'amount' | 'code'   // 按供应商汇总 only
  order: 'desc' | 'asc'
}

// one summary row: 采购 = orders, 退货 = purchase returns
interface SumRow {
  key: string
  code: string
  name: string
  supplierCode: string
  qty: number
  amount: number
  retQty: number
  retAmount: number
}

const fmt = (n: number) => String(+n.toFixed(2))

interface Props {
  mode: Mode
}

// 采购报表 — replicates old bb_cg_cp.asp / bb_cg_kh.asp / bb_cg_jbr.asp.
// Totals are built from the purchase detail rows (orders + returns) for the date range.
export default function PurchaseReport({ mode }: Props) {
  const navigate = useNavigate()

  const [form, setForm] = useState<Filters>(() => ({
    start: monthStart(),
    end: toSlashDate(),
    field: FIELDS[mode][0].value,
    keyword: '',
    sort: 'amount',
    order: 'desc',
  }))
  const [applied, setApplied] = useState<Filters>(form)
  const [rows, setRows] = useState<PurchaseDetailRow[]>([])
  const [productsByCode, setProductsByCode] = useState<Record<string, Product>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (mode !== 'product') return
    getProducts()
      .then(list => setProductsByCode(Object.fromEntries(list.map(p => [p.code, p]))))
      .catch(() => {})
  }, [mode])

  useEffect(() => {
    setLoading(true)
    getPurchaseOrdersDetail({
      startDate: parseSlashDate(applied.start) ?? undefined,
      endDate: parseSlashDate(applied.end) ?? undefined,
    })
      .then(setRows)
      .catch(err => alert(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [applied.start, applied.end])

  // ── Aggregate ────────────────────────────────────────────────
  const q = applied.keyword.toLowerCase()
  const matches = (r: PurchaseDetailRow) => {
    if (!q) return true
    switch (applied.field) {
      case 'productCode': return r.productCode.toLowerCase().includes(q)
      case 'productName': return r.productName.toLowerCase().includes(q)
      case 'supplier': return r.supplierCode.toLowerCase().includes(q) || r.supplierName.toLowerCase().includes(q)
      case 'operator': return (r.operator ?? '').toLowerCase().includes(q)
      default: return true
    }
  }

  const groups = new Map<string, SumRow>()
  for (const r of rows.filter(matches)) {
    const key = mode === 'product' ? r.productCode : mode === 'supplier' ? r.supplierCode : (r.operator ?? '')
    let g = groups.get(key)
    if (!g) {
      g = {
        key,
        code: mode === 'product' ? r.productCode : mode === 'supplier' ? r.supplierCode : '',
        name: mode === 'product' ? r.productName : mode === 'supplier' ? r.supplierName : (r.operator ?? ''),
        supplierCode: r.supplierCode,
        qty: 0, amount: 0, retQty: 0, retAmount: 0,
      }
      groups.set(key, g)
    }
    if (r.rowType === 'order') { g.qty += r.qty; g.amount += r.amount }
    else { g.retQty += r.qty; g.retAmount += r.amount }
  }

  const dir = applied.order === 'asc' ? 1 : -1
  const list = [...groups.values()].sort((a, b) => {
    if (mode === 'product') return a.code.localeCompare(b.code)
    if (mode === 'supplier' && applied.sort === 'code') return dir * a.code.localeCompare(b.code)
    return dir * (a.amount - b.amount)
  })

  const total = list.reduce((t, g) => ({
    qty: t.qty + g.qty, amount: t.amount + g.amount, retQty: t.retQty + g.retQty, retAmount: t.retAmount + g.retAmount,
  }), { qty: 0, amount: 0, retQty: 0, retAmount: 0 })

  // ── Actions ──────────────────────────────────────────────────
  function setField<K extends keyof Filters>(key: K, value: Filters[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleQuery() {
    if (form.start && !parseSlashDate(form.start)) { alert('开始日期格式不正确，例如 2026/10/1'); return }
    if (form.end && !parseSlashDate(form.end)) { alert('结束日期格式不正确，例如 2026/10/1'); return }
    setApplied({ ...form, keyword: form.keyword.trim() })
  }

  const caption = applied.start || applied.end
    ? `从${applied.start || '最早'}到${applied.end || '今天'}采购报表`
    : '全部采购报表'

  // label column(s) depend on the mode; numeric columns are shared
  const labelHeads = mode === 'product'
    ? <><th>&nbsp;编码&nbsp;</th><th style={{ textAlign: 'left' }}>&nbsp;品名&nbsp;规格&nbsp;单位&nbsp;产地&nbsp;</th></>
    : <th>&nbsp;{mode === 'supplier' ? '供应商' : '经办人'}&nbsp;</th>
  const labelSpan = mode === 'product' ? 2 : 1
  const numCols = mode === 'product' ? 5 : 4

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ── Mode links ── */}
      <div className={styles.subbar}>
        {MODES.map(m => (
          <span
            key={m.mode}
            className={`${styles.modeLink} ${m.mode === mode ? styles.modeActive : ''}`}
            onClick={() => navigate(m.path)}
          >
            <span className={styles.listIcon}>☰</span>{m.label}
          </span>
        ))}
      </div>

      {/* ── Query bar (Enter = 查询) ── */}
      <form className={styles.query} onSubmit={e => { e.preventDefault(); handleQuery() }}>
        <SearchIcon />
        {mode === 'supplier' && (
          <>
            排序规则
            <select value={form.sort} onChange={e => setField('sort', e.target.value as Filters['sort'])}>
              <option value="amount">按采购额排序</option>
              <option value="code">按供应商编码排序</option>
            </select>
            <select value={form.order} onChange={e => setField('order', e.target.value as Filters['order'])}>
              <option value="desc">降序</option>
              <option value="asc">升序</option>
            </select>
          </>
        )}
        从<input className={styles.dateInput} type="text" value={form.start} onChange={e => setField('start', e.target.value)} />
        至<input className={styles.dateInput} type="text" value={form.end} onChange={e => setField('end', e.target.value)} />
        <select value={form.field} onChange={e => setField('field', e.target.value)}>
          {FIELDS[mode].map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <input className={styles.kwInput} type="text" value={form.keyword} onChange={e => setField('keyword', e.target.value)} />
        <input type="submit" value="查询" />
      </form>

      <div className={styles.body}>
        <div className={styles.caption}>{caption}</div>
        {loading ? <div className={styles.loading}>数据加载中，请稍候...</div> : (
          <table className={styles.grid}>
            <thead>
              <tr>
                {labelHeads}
                <th>&nbsp;采购数量&nbsp;</th>
                <th>&nbsp;采购金额&nbsp;</th>
                {mode === 'product' && <th>&nbsp;均价&nbsp;</th>}
                <th>&nbsp;退货数量&nbsp;</th>
                <th>&nbsp;退货金额&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {list.map(g => {
                const p = productsByCode[g.code]
                return (
                  <tr key={g.key} className={styles.row}>
                    {mode === 'product' && (
                      <>
                        <td className={styles.c}>&nbsp;{g.code}&nbsp;</td>
                        <td>
                          &nbsp;{g.name}&nbsp;<span className={styles.teal}>{p?.spec ?? ''}</span>&nbsp;{p?.unit ?? ''}&nbsp;
                          <span className={styles.grey}>{g.supplierCode}</span>&nbsp;
                        </td>
                      </>
                    )}
                    {mode === 'supplier' && (
                      <td>&nbsp;<span className={styles.teal}>{g.code}</span>&nbsp;<span className={styles.magenta}>{g.name}</span>&nbsp;</td>
                    )}
                    {mode === 'operator' && <td>&nbsp;{g.name}&nbsp;</td>}
                    <td className={styles.r}>&nbsp;{fmt(g.qty)}&nbsp;</td>
                    <td className={styles.r}>&nbsp;{fmt(g.amount)}&nbsp;</td>
                    {mode === 'product' && (
                      <td className={`${styles.r} ${styles.magenta}`}>&nbsp;{g.qty ? fmt(g.amount / g.qty) : 0}&nbsp;</td>
                    )}
                    <td className={styles.r}>&nbsp;{fmt(g.retQty)}&nbsp;</td>
                    <td className={styles.r}>&nbsp;{fmt(g.retAmount)}&nbsp;</td>
                  </tr>
                )
              })}
              <tr>
                <td colSpan={labelSpan} className={styles.r}>合计</td>
                <td className={styles.r}>&nbsp;{fmt(total.qty)}&nbsp;</td>
                <td className={styles.r}>&nbsp;{fmt(total.amount)}&nbsp;</td>
                {mode === 'product' && <td>&nbsp;</td>}
                <td className={styles.r}>&nbsp;{fmt(total.retQty)}&nbsp;</td>
                <td className={styles.r}>&nbsp;{fmt(total.retAmount)}&nbsp;</td>
              </tr>
              <tr className={styles.footer}>
                <td colSpan={labelSpan}>&nbsp;{list.length}个记录</td>
                <td colSpan={numCols - 2} className={styles.c}>采购数量:{fmt(total.qty)}</td>
                <td colSpan={2} className={styles.c}>采购金额:{fmt(total.amount)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
