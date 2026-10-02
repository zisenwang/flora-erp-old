import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { getSalesOrders, getSalesOrdersDetail, type SalesOrder } from '@/api/sales'
import { getProducts, type Product } from '@/api/products'
import { getErrorMessage } from '@/utils/error'
import { parseSlashDate, toSlashDate } from '@/utils/slashDate'
import { EditIcon, SearchIcon } from '@/pages/master/SupplierIcons'
import styles from '@/pages/purchase/PurchaseDocs.module.css'

type PayFilter = 'all' | 'paid' | 'unpaid'

interface Filters {
  start: string   // slash date text, '' = no limit
  end: string
  field: string
  keyword: string
}

const SEARCH_FIELDS = [
  { value: 'customerCode', label: '客户编码' },
  { value: 'customerName', label: '客户名称' },
  { value: 'orderNo', label: '单号' },
  { value: 'operator', label: '开单人' },
  { value: 'notes', label: '备注' },
]

const PAGE_SIZE = 50
const PAGE_WINDOW = 10

const fmt = (n: number) => String(+Number(n).toFixed(2))
const blankZero = (n: number) => (n ? fmt(n) : '')

// 明细表: one row per item (sales orders only, like the 汇总表)
interface DetailRow {
  id: number
  no: string
  customer: string
  date: string
  productCode: string
  productName: string
  supplierCode: string
  unit: string
  qty: number
  unitPrice: number
  amount: number       // after line discount
  costPrice: number    // 进价 = (金额 - 毛利) / 数量
  profit: number
  pieces: number
  operator: string
  notes: string
}

interface Props {
  mode?: 'summary' | 'detail'
}

// 销售单据汇总 / 明细 — replicates old xs_djhz_list.asp / xs_djmx_list.asp
// (来源 / 状态 / 收款备注 / 打印标签 dropped)
export default function SalesList({ mode = 'summary' }: Props) {
  const navigate = useNavigate()

  // ── Toolbar inputs and applied filters ───────────────────────
  // default range: 1st of the month three months back → today (old page: 2026/7/1 → 2026/10/1)
  const [form, setForm] = useState<Filters>({
    start: toSlashDate(dayjs().subtract(3, 'month').startOf('month').toDate()),
    end: toSlashDate(),
    field: 'customerCode',
    keyword: '',
  })
  const [applied, setApplied] = useState<Filters>(form)
  const [pay, setPay] = useState<PayFilter>('all')
  const [page, setPage] = useState(1)

  // ── Data ─────────────────────────────────────────────────────
  const [orders, setOrders] = useState<SalesOrder[]>([])
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
    if (mode === 'summary') {
      getSalesOrders(params)
        .then(list => setOrders(list.sort((a, b) =>
          dayjs(b.orderDate).valueOf() - dayjs(a.orderDate).valueOf() || b.id - a.id)))
        .catch(err => alert(getErrorMessage(err)))
        .finally(() => setLoading(false))
    } else {
      getSalesOrdersDetail(params)
        .then(rows => setDetailRows(rows
          .filter(r => r.rowType === 'order')
          .map((r): DetailRow => {
            const profit = r.profit ?? 0
            return {
              id: r.id, no: r.no,
              customer: `${r.customerCode}.${r.customerName}`,
              date: r.date,
              productCode: r.productCode, productName: r.productName, supplierCode: r.supplierCode,
              unit: r.unit, qty: r.qty, unitPrice: r.unitPrice, amount: r.amount,
              costPrice: r.qty ? +((r.amount - profit) / r.qty).toFixed(2) : 0,
              profit, pieces: r.pieces, operator: r.operator ?? '', notes: r.notes ?? '',
            }
          })))
        .catch(err => alert(getErrorMessage(err)))
        .finally(() => setLoading(false))
    }
  }, [mode, applied])

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1) }, [applied, pay])

  // ── Derived ──────────────────────────────────────────────────
  // 已收款 = fully paid; 未收款 = anything not fully paid (未收款 / 部分收款)
  const rows = orders.filter(o =>
    pay === 'all' || (pay === 'paid' ? o.paymentStatus === '已收款' : o.paymentStatus !== '已收款'))
  const total = mode === 'summary' ? rows.length : detailRows.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pagedDetail = detailRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const windowStart = Math.floor((page - 1) / PAGE_WINDOW) * PAGE_WINDOW + 1
  const windowEnd = Math.min(windowStart + PAGE_WINDOW - 1, totalPages)

  const sum = (list: SalesOrder[]) => ({
    qty: list.reduce((s, o) => s + o.totalQty, 0),
    amount: list.reduce((s, o) => s + o.totalAmount, 0),
    pieces: list.reduce((s, o) => s + o.totalPieces, 0),
  })
  const pageSum = sum(paged)
  const allSum = sum(rows)

  function ops(id: number) {
    return (
      <>
        <EditIcon title="修改单据" onClick={() => navigate(`/sales/orders/${id}/edit`)} />
        <span className={styles.printImg} title="打印单据" onClick={() => window.open(`/print/sales/${id}`, '_blank')}>打印</span>
      </>
    )
  }

  function renderDetail() {
    const dsum = (list: DetailRow[]) => ({
      qty: list.reduce((s, r) => s + r.qty, 0),
      amount: list.reduce((s, r) => s + r.amount, 0),
      profit: list.reduce((s, r) => s + r.profit, 0),
      pieces: list.reduce((s, r) => s + r.pieces, 0),
    })
    const pSum = dsum(pagedDetail)
    const aSum = dsum(detailRows)
    const totalRow = (label: string, t: ReturnType<typeof dsum>) => (
      <tr>
        <td colSpan={9} className={styles.r}>{label}</td>
        <td className={`${styles.c} ${styles.hatch}`}>{fmt(t.qty)}</td>
        <td>&nbsp;</td>
        <td className={`${styles.c} ${styles.hatch}`}>{fmt(t.amount)}</td>
        <td>&nbsp;</td>
        <td className={`${styles.r} ${styles.hatch}`}>{fmt(t.profit)}</td>
        <td className={`${styles.c} ${styles.hatch}`}>{fmt(t.pieces)}</td>
        <td colSpan={3}>&nbsp;</td>
      </tr>
    )
    return (
      <table className={styles.grid}>
        <thead>
          <tr>
            <th>&nbsp;类型&nbsp;</th>
            <th>&nbsp;客户&nbsp;</th>
            <th>&nbsp;日期&nbsp;</th>
            <th>&nbsp;单号&nbsp;</th>
            <th>&nbsp;编码&nbsp;</th>
            <th>&nbsp;产品&nbsp;</th>
            <th>&nbsp;包装&nbsp;</th>
            <th>&nbsp;供应商&nbsp;</th>
            <th>&nbsp;单位&nbsp;</th>
            <th>&nbsp;数量&nbsp;</th>
            <th>&nbsp;单价&nbsp;</th>
            <th>&nbsp;金额&nbsp;</th>
            <th>&nbsp;进价&nbsp;</th>
            <th>&nbsp;毛利&nbsp;</th>
            <th>&nbsp;件数&nbsp;</th>
            <th>&nbsp;经办人&nbsp;</th>
            <th>&nbsp;备注&nbsp;</th>
            <th>&nbsp;操作&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {pagedDetail.map((r, i) => {
            const p = productsByCode[r.productCode]
            return (
              <tr key={`${r.id}-${i}`} className={styles.row}>
                <td>&nbsp;销售单&nbsp;</td>
                <td>&nbsp;{r.customer}&nbsp;</td>
                <td>&nbsp;{toSlashDate(r.date)}&nbsp;</td>
                <td>&nbsp;<a onClick={() => navigate(`/sales/orders/${r.id}`)}>{r.no}</a>&nbsp;</td>
                <td>&nbsp;{r.productCode}&nbsp;</td>
                <td>&nbsp;{r.productName}&nbsp;<em className={styles.spec}>{p?.spec ?? ''}</em>&nbsp;{p?.grade ?? ''}&nbsp;</td>
                <td>&nbsp;{p?.unitsPerPiece ?? ''}&nbsp;</td>
                <td>&nbsp;{r.supplierCode}&nbsp;</td>
                <td>&nbsp;{r.unit}&nbsp;</td>
                <td className={`${styles.c} ${styles.bold}`}>{blankZero(r.qty)}</td>
                <td className={`${styles.c} ${styles.magenta}`}>{fmt(r.unitPrice)}</td>
                <td className={`${styles.c} ${styles.bold}`}>{blankZero(r.amount)}</td>
                <td className={`${styles.c} ${styles.teal}`}>{r.costPrice ? fmt(r.costPrice) : ''}</td>
                <td className={`${styles.r} ${r.profit < 0 ? styles.loss : ''}`}>{blankZero(r.profit)}&nbsp;</td>
                <td className={styles.c}>{r.pieces ? <em className={styles.qty}>{r.pieces}</em> : ''}</td>
                <td>&nbsp;{r.operator}&nbsp;</td>
                <td>&nbsp;{r.notes}&nbsp;</td>
                <td className={styles.c}>{ops(r.id)}</td>
              </tr>
            )
          })}
          {totalRow('本页小计', pSum)}
          {totalRow('总计', aSum)}
        </tbody>
      </table>
    )
  }

  // ── Actions ──────────────────────────────────────────────────
  function setField<K extends keyof Filters>(key: K, value: Filters[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleSearch() {
    if (form.start && !parseSlashDate(form.start)) { alert('开始日期格式不正确，例如 2026/10/1'); return }
    if (form.end && !parseSlashDate(form.end)) { alert('结束日期格式不正确，例如 2026/10/1'); return }
    setApplied({ ...form, keyword: form.keyword.trim() })
  }

  // first 显示全部: drop every filter
  function handleShowAll() {
    const all: Filters = { start: '', end: '', field: form.field, keyword: '' }
    setForm(all)
    setApplied(all)
    setPay('all')
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ── Sub-toolbar ── */}
      <div className={styles.subbar}>
        <SearchIcon />
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
        {mode === 'summary' ? (
          <>
            <input type="button" value="查看明细表" onClick={() => navigate('/sales/orders/detail')} />
            &nbsp;&nbsp;
            <input type="button" value="已收款" onClick={() => setPay('paid')} />
            <input type="button" value="未收款" onClick={() => setPay('unpaid')} />
            <input type="button" value="显示全部" onClick={() => setPay('all')} />
          </>
        ) : (
          <input type="button" value="查看汇总表" onClick={() => navigate('/sales/orders')} />
        )}
      </div>

      <div className={styles.body}>
        {loading ? <div className={styles.loading}>数据加载中，请稍候...</div> : mode === 'detail' ? renderDetail() : (
          <table className={styles.grid}>
            <thead>
              <tr>
                <th>&nbsp;类型&nbsp;</th>
                <th>&nbsp;客户&nbsp;</th>
                <th>&nbsp;日期&nbsp;</th>
                <th>&nbsp;单号&nbsp;</th>
                <th>&nbsp;数量&nbsp;</th>
                <th>&nbsp;金额&nbsp;</th>
                <th>件数</th>
                <th>&nbsp;经办人&nbsp;</th>
                <th>&nbsp;备注&nbsp;</th>
                <th>&nbsp;操作&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(o => (
                <tr key={o.id} className={styles.row}>
                  <td>&nbsp;销售单&nbsp;</td>
                  <td>&nbsp;{o.customerCode}.{o.customerName}&nbsp;</td>
                  <td>&nbsp;{toSlashDate(o.orderDate)}&nbsp;</td>
                  <td>&nbsp;<a onClick={() => navigate(`/sales/orders/${o.id}`)}>{o.orderNo}</a>&nbsp;</td>
                  <td className={`${styles.c} ${styles.bold}`}>&nbsp;{fmt(o.totalQty)}&nbsp;</td>
                  <td className={`${styles.c} ${styles.bold}`}>&nbsp;{fmt(o.totalAmount)}&nbsp;</td>
                  <td className={styles.c}>&nbsp;{o.totalPieces ? <em className={styles.qty}>{o.totalPieces}</em> : ''}&nbsp;</td>
                  <td>&nbsp;{o.operator ?? ''}&nbsp;</td>
                  <td>&nbsp;{o.notes ?? ''}&nbsp;</td>
                  <td className={styles.c}>
                    {ops(o.id)}
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={4} className={styles.r}>本页小计</td>
                <td className={`${styles.c} ${styles.hatch}`}>&nbsp;{fmt(pageSum.qty)}</td>
                <td className={`${styles.c} ${styles.hatch}`}>&nbsp;{fmt(pageSum.amount)}</td>
                <td className={`${styles.c} ${styles.hatch}`}>&nbsp;{fmt(pageSum.pieces)}</td>
                <td colSpan={3}>核对数量:<em className={styles.qty}>{fmt(allSum.qty)}</em></td>
              </tr>
              <tr>
                <td colSpan={4} className={styles.r}>总计</td>
                <td className={`${styles.c} ${styles.hatch}`}>&nbsp;{fmt(allSum.qty)}</td>
                <td className={`${styles.c} ${styles.hatch}`}>&nbsp;{fmt(allSum.amount)}</td>
                <td className={`${styles.c} ${styles.hatch}`}>&nbsp;{fmt(allSum.pieces)}</td>
                <td colSpan={3}>核对金额:<em className={styles.qty}>{fmt(allSum.amount)}</em></td>
              </tr>
            </tbody>
          </table>
        )}

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
