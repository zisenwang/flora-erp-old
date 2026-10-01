import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { getPurchaseOrders, getPurchaseReturns, getPurchaseOrdersDetail } from '@/api/purchase'
import { getProducts, type Product } from '@/api/products'
import { getErrorMessage } from '@/utils/error'
import { parseSlashDate, toSlashDate } from '@/utils/slashDate'
import { EditIcon, SearchIcon } from '@/pages/master/SupplierIcons'
import styles from './PurchaseDocs.module.css'

type Kind = 'order' | 'return'
type TypeFilter = 'all' | Kind

// 汇总表: one row per document
interface SumRow {
  kind: Kind
  id: number
  no: string
  supplier: string
  date: string
  qty: number
  amount: number
  pieces: number
  discount: number | null
  final: number
  operator: string
  notes: string
}

// 明细表: one row per item
interface DetailRow {
  kind: Kind
  id: number
  no: string
  supplier: string
  date: string
  productCode: string
  productName: string
  unit: string
  qty: number
  unitPrice: number
  amount: number      // 数量 × 单价
  final: number       // after line discount (returns: amount)
  discount: number
  pieces: number
  operator: string
  notes: string
}

interface Filters {
  type: TypeFilter
  start: string   // slash date text, '' = no limit
  end: string
  field: string
  keyword: string
}

const SEARCH_FIELDS = [
  { value: 'supplierCode', label: '供应商编码' },
  { value: 'supplierName', label: '供应商名称' },
  { value: 'orderNo', label: '单号' },
  { value: 'operator', label: '开单人' },
]

const PAGE_SIZE = 50
const PAGE_WINDOW = 10
const TYPE_LABEL: Record<Kind, string> = { order: '采购单', return: '采退单' }

const fmt = (n: number) => String(+Number(n).toFixed(2))
const byDateDesc = <T extends { date: string; id: number }>(a: T, b: T) =>
  b.date.localeCompare(a.date) || b.id - a.id

interface Props {
  mode: 'summary' | 'detail'
}

// 进货单据汇总 (buy_djhz_list.asp) / 进货单据明细 (buy_djmx_list.asp)
export default function PurchaseList({ mode }: Props) {
  const navigate = useNavigate()
  const today = toSlashDate()

  // ── Toolbar inputs and applied filters ───────────────────────
  const [form, setForm] = useState<Filters>({ type: 'all', start: today, end: today, field: 'supplierCode', keyword: '' })
  const [applied, setApplied] = useState<Filters>(form)
  const [page, setPage] = useState(1)

  // ── Data ─────────────────────────────────────────────────────
  const [sumRows, setSumRows] = useState<SumRow[]>([])
  const [detailRows, setDetailRows] = useState<DetailRow[]>([])
  const [productsByCode, setProductsByCode] = useState<Record<string, Product>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (mode !== 'detail') return
    getProducts()
      .then(list => setProductsByCode(Object.fromEntries(list.map(p => [p.code, p]))))
      .catch(() => {})
  }, [mode])

  useEffect(() => {
    const params = {
      startDate: parseSlashDate(applied.start) ?? undefined,
      endDate: parseSlashDate(applied.end) ?? undefined,
      search: applied.keyword || undefined,
      searchField: applied.keyword ? applied.field : undefined,
    }
    setLoading(true)
    setPage(1)

    if (mode === 'summary') {
      Promise.all([
        applied.type !== 'return' ? getPurchaseOrders(params) : Promise.resolve([]),
        applied.type !== 'order' ? getPurchaseReturns(params) : Promise.resolve([]),
      ])
        .then(([orders, returns]) => setSumRows([
          ...orders.map((o): SumRow => ({
            kind: 'order', id: o.id, no: o.orderNo,
            supplier: `${o.supplierCode} ${o.supplierName}`,
            date: dayjs(o.orderDate).format('YYYY-MM-DD'),
            qty: o.totalQty, amount: o.totalAmount, pieces: o.totalPieces,
            discount: o.discount, final: o.finalAmount,
            operator: o.operator ?? '', notes: o.notes ?? '',
          })),
          ...returns.map((r): SumRow => ({
            kind: 'return', id: r.id, no: r.returnNo,
            supplier: `${r.supplierCode} ${r.supplierName}`,
            date: dayjs(r.returnDate).format('YYYY-MM-DD'),
            qty: r.totalQty, amount: r.totalAmount, pieces: r.totalPieces,
            discount: null, final: r.totalAmount,
            operator: r.operator ?? '', notes: r.notes ?? '',
          })),
        ].sort(byDateDesc)))
        .catch(err => alert(getErrorMessage(err)))
        .finally(() => setLoading(false))
    } else {
      getPurchaseOrdersDetail(params)
        .then(rows => setDetailRows(rows
          .filter(r => applied.type === 'all' || r.rowType === applied.type)
          .map((r): DetailRow => {
            const amount = +(r.qty * r.unitPrice).toFixed(2)
            return {
              kind: r.rowType, id: r.id, no: r.no,
              supplier: `${r.supplierCode} ${r.supplierName}`,
              date: r.date,
              productCode: r.productCode, productName: r.productName, unit: r.unit,
              qty: r.qty, unitPrice: r.unitPrice, amount, final: r.amount,
              discount: amount ? Math.round((r.amount / amount) * 100) : 100,
              pieces: r.pieces, operator: r.operator ?? '', notes: r.notes ?? '',
            }
          })))
        .catch(err => alert(getErrorMessage(err)))
        .finally(() => setLoading(false))
    }
  }, [mode, applied])

  // ── Derived ──────────────────────────────────────────────────
  const total = mode === 'summary' ? sumRows.length : detailRows.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const windowStart = Math.floor((page - 1) / PAGE_WINDOW) * PAGE_WINDOW + 1
  const windowEnd = Math.min(windowStart + PAGE_WINDOW - 1, totalPages)
  const pagedSum = sumRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pagedDetail = detailRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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
    const all: Filters = { type: 'all', start: '', end: '', field: form.field, keyword: '' }
    setForm(all)
    setApplied(all)
  }

  const viewPath = (kind: Kind, id: number) => (kind === 'order' ? `/purchase/orders/${id}` : `/purchase/returns/${id}`)

  function ops(kind: Kind, id: number) {
    if (kind !== 'order') return null  // 采退单 修改/打印 come with the 采购退货 pages
    return (
      <>
        <EditIcon title="修改单据" onClick={() => navigate(`/purchase/orders/${id}/edit`)} />
        <span className={styles.printImg} title="打印单据" onClick={() => window.open(`/print/purchase/${id}`, '_blank')}>打印</span>
      </>
    )
  }

  // ── Render helpers ───────────────────────────────────────────
  function renderSummary() {
    const sum = (rows: SumRow[]) => ({
      qty: rows.reduce((s, r) => s + r.qty, 0),
      amount: rows.reduce((s, r) => s + r.amount, 0),
      pieces: rows.reduce((s, r) => s + r.pieces, 0),
      final: rows.reduce((s, r) => s + r.final, 0),
    })
    const pageSum = sum(pagedSum)
    const allSum = sum(sumRows)
    const totalRow = (label: string, t: ReturnType<typeof sum>) => (
      <tr>
        <td colSpan={4} className={styles.r}>{label}</td>
        <td className={`${styles.c} ${styles.hatch}`}>&nbsp;{fmt(t.qty)}</td>
        <td className={`${styles.c} ${styles.hatch}`}>&nbsp;{fmt(t.amount)}</td>
        <td className={`${styles.c} ${styles.hatch}`}>&nbsp;{fmt(t.pieces)}</td>
        <td>&nbsp;</td>
        <td className={`${styles.c} ${styles.hatch}`}>{fmt(t.final)}</td>
        <td colSpan={3}>&nbsp;</td>
      </tr>
    )
    return (
      <table className={styles.grid}>
        <thead>
          <tr>
            <th>&nbsp;类型&nbsp;</th>
            <th>&nbsp;供应商&nbsp;</th>
            <th>&nbsp;日期&nbsp;</th>
            <th>&nbsp;单号&nbsp;</th>
            <th>&nbsp;数量&nbsp;</th>
            <th>&nbsp;金额&nbsp;</th>
            <th>&nbsp;件数&nbsp;</th>
            <th>&nbsp;折扣&nbsp;</th>
            <th>&nbsp;折后金额&nbsp;</th>
            <th>&nbsp;经办人&nbsp;</th>
            <th>&nbsp;备注&nbsp;</th>
            <th>&nbsp;操作&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {pagedSum.map(r => (
            <tr key={`${r.kind}-${r.id}`} className={styles.row}>
              <td>&nbsp;{TYPE_LABEL[r.kind]}&nbsp;</td>
              <td>&nbsp;{r.supplier}&nbsp;</td>
              <td className={styles.dateCell}>&nbsp;{toSlashDate(r.date)}&nbsp;</td>
              <td>&nbsp;<a onClick={() => navigate(viewPath(r.kind, r.id))}>{r.no}</a>&nbsp;</td>
              <td className={styles.c}>&nbsp;<em className={styles.qty}>{fmt(r.qty)}</em>&nbsp;</td>
              <td className={styles.c}>&nbsp;{fmt(r.amount)}&nbsp;</td>
              <td className={styles.c}>&nbsp;{r.pieces || ''}&nbsp;</td>
              <td className={`${styles.c} ${styles.magenta}`}>&nbsp;{r.discount ?? ''}&nbsp;</td>
              <td className={`${styles.c} ${styles.teal}`}>&nbsp;{fmt(r.final)}&nbsp;</td>
              <td>&nbsp;{r.operator}&nbsp;</td>
              <td>&nbsp;{r.notes}&nbsp;</td>
              <td className={styles.c}>{ops(r.kind, r.id)}</td>
            </tr>
          ))}
          {totalRow('本页小计', pageSum)}
          {totalRow('总计', allSum)}
        </tbody>
      </table>
    )
  }

  function renderDetail() {
    const sum = (rows: DetailRow[]) => {
      const orders = rows.filter(r => r.kind === 'order')
      const returns = rows.filter(r => r.kind === 'return')
      return {
        qty: orders.reduce((s, r) => s + r.qty, 0),
        amount: orders.reduce((s, r) => s + r.amount, 0),
        pieces: rows.reduce((s, r) => s + r.pieces, 0),
        final: orders.reduce((s, r) => s + r.final, 0),
        retQty: returns.reduce((s, r) => s + r.qty, 0),
        retAmount: returns.reduce((s, r) => s + r.final, 0),
      }
    }
    const pageSum = sum(pagedDetail)
    const allSum = sum(detailRows)
    const totalRow = (label: string, t: ReturnType<typeof sum>) => (
      <tr>
        <td colSpan={8} className={styles.r}>{label}</td>
        <td className={`${styles.c} ${styles.hatch}`}>{fmt(t.qty)}</td>
        <td>&nbsp;</td>
        <td className={`${styles.c} ${styles.hatch}`}>{fmt(t.amount)}</td>
        <td className={`${styles.c} ${styles.hatch}`}>{fmt(t.pieces)}</td>
        <td>&nbsp;</td>
        <td className={`${styles.c} ${styles.hatch}`}>{fmt(t.final)}</td>
        <td className={`${styles.c} ${styles.hatch}`}>{fmt(t.retQty)}</td>
        <td className={`${styles.c} ${styles.hatch}`}>{fmt(t.retAmount)}</td>
        <td colSpan={3}>&nbsp;</td>
      </tr>
    )
    return (
      <table className={styles.grid}>
        <thead>
          <tr>
            <th>&nbsp;类型&nbsp;</th>
            <th>&nbsp;供应商&nbsp;</th>
            <th>&nbsp;日期&nbsp;</th>
            <th>&nbsp;单号&nbsp;</th>
            <th>&nbsp;编码&nbsp;</th>
            <th>&nbsp;产品&nbsp;</th>
            <th>&nbsp;包装&nbsp;</th>
            <th>&nbsp;单位&nbsp;</th>
            <th>&nbsp;数量&nbsp;</th>
            <th>&nbsp;单价&nbsp;</th>
            <th>&nbsp;金额&nbsp;</th>
            <th>&nbsp;件数&nbsp;</th>
            <th>&nbsp;折扣&nbsp;</th>
            <th>&nbsp;折后金额&nbsp;</th>
            <th>&nbsp;退货&nbsp;</th>
            <th>&nbsp;金额&nbsp;</th>
            <th>&nbsp;经办人&nbsp;</th>
            <th>&nbsp;备注&nbsp;</th>
            <th>&nbsp;操作&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {pagedDetail.map((r, i) => {
            const p = productsByCode[r.productCode]
            const isOrder = r.kind === 'order'
            const off = isOrder && r.discount !== 100 ? styles.discounted : ''
            return (
              <tr key={`${r.kind}-${r.id}-${i}`} className={styles.row}>
                <td>&nbsp;{TYPE_LABEL[r.kind]}&nbsp;</td>
                <td>&nbsp;{r.supplier}&nbsp;</td>
                <td className={styles.dateCell}>&nbsp;{toSlashDate(r.date)}&nbsp;</td>
                <td>&nbsp;<a onClick={() => navigate(viewPath(r.kind, r.id))}>{r.no}</a>&nbsp;</td>
                <td>&nbsp;{r.productCode}&nbsp;</td>
                <td>&nbsp;{r.productName}&nbsp;<em className={styles.spec}>{p?.spec ?? ''}</em>&nbsp;</td>
                <td>&nbsp;{p?.unitsPerPiece ?? ''}&nbsp;</td>
                <td>&nbsp;{r.unit}&nbsp;</td>
                <td className={`${styles.c} ${styles.bold}`}>{isOrder ? fmt(r.qty) : ''}</td>
                <td className={`${styles.c} ${styles.magenta}`}>{fmt(r.unitPrice)}</td>
                <td className={`${styles.c} ${styles.bold}`}>{isOrder ? fmt(r.amount) : ''}</td>
                <td className={styles.c}>{r.pieces || ''}</td>
                <td className={`${styles.c} ${styles.magenta} ${off}`}>{isOrder ? r.discount : ''}</td>
                <td className={`${styles.c} ${styles.teal} ${off}`}>{isOrder ? fmt(r.final) : ''}</td>
                <td className={styles.c}>{isOrder ? '' : fmt(r.qty)}</td>
                <td className={styles.c}>{isOrder ? '' : fmt(r.final)}</td>
                <td>&nbsp;{r.operator}&nbsp;</td>
                <td>&nbsp;{r.notes}&nbsp;</td>
                <td className={styles.c}>{ops(r.kind, r.id)}</td>
              </tr>
            )
          })}
          {totalRow('本页小计', pageSum)}
          {totalRow('总计', allSum)}
        </tbody>
      </table>
    )
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ── Sub-toolbar ── */}
      <div className={styles.subbar}>
        <SearchIcon />
        <select value={form.type} onChange={e => setField('type', e.target.value as TypeFilter)}>
          <option value="all">全部</option>
          <option value="order">进货单</option>
          <option value="return">退回单</option>
        </select>
        从<input className={styles.dateInput} type="text" value={form.start} onChange={e => setField('start', e.target.value)} />
        至<input className={styles.dateInput} type="text" value={form.end} onChange={e => setField('end', e.target.value)} />
        <select value={form.field} onChange={e => setField('field', e.target.value)}>
          {SEARCH_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <input
          className={styles.kwInput}
          type="text"
          value={form.keyword}
          onChange={e => setField('keyword', e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <input type="button" value="查找" onClick={handleSearch} />
        <input type="button" value="显示全部" onClick={handleShowAll} />
        {mode === 'summary'
          ? <input type="button" value="查看明细表" onClick={() => navigate('/purchase/orders/detail')} />
          : <input type="button" value="查看汇总表" onClick={() => navigate('/purchase/orders')} />}
      </div>

      <div className={styles.body}>
        {loading
          ? <div className={styles.loading}>数据加载中，请稍候...</div>
          : mode === 'summary' ? renderSummary() : renderDetail()}

        {/* ── Legend ── */}
        <div className={styles.legend}>
          点击单号可以查看明细!点击<EditIcon />修改单据，点击<span className={styles.printImg}>打印</span>打印单据。
        </div>

        {/* ── Pager ── */}
        <table className={styles.pager}>
          <tbody>
            <tr>
              <td className={styles.pagerTotal}>&nbsp;总{total}个,共{totalPages}页</td>
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
