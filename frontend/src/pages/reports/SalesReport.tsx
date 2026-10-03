import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { getSalesOrderRows, type ReportOrderRow } from '@/api/reports'
import { getProducts, type Product } from '@/api/products'
import { getErrorMessage } from '@/utils/error'
import { monthStart, parseSlashDate, toSlashDate } from '@/utils/slashDate'
import { SearchIcon } from '@/pages/master/SupplierIcons'
import styles from './Report.module.css'

type Mode = 'product' | 'customer' | 'supplier' | 'monthly' | 'customerProduct' | 'yearMonth'
type SortKey = 'qty' | 'amount' | 'code'

const MODES: { mode: Mode; label: string; path: string }[] = [
  { mode: 'product', label: '按产品汇总', path: '/reports/sales' },
  { mode: 'customer', label: '按客户汇总', path: '/reports/sales/customer' },
  { mode: 'supplier', label: '按供货商汇总', path: '/reports/sales/supplier' },
  { mode: 'monthly', label: '销售月报表', path: '/reports/sales/monthly' },
  { mode: 'customerProduct', label: '按客户+产品汇总', path: '/reports/sales/customer-product' },
  { mode: 'yearMonth', label: '按年+月汇总报表', path: '/reports/sales/year-month' },
]

type Opt = { value: string; label: string }

// sort / search options per mode (old bb_xs_cp / kh / ghs / khcp)
const SORTS: Partial<Record<Mode, Opt[]>> = {
  product: [
    { value: 'qty', label: '按销售数量排序' },
    { value: 'amount', label: '按销售额排序' },
    { value: 'code', label: '按产品编码排序' },
  ],
  customer: [{ value: 'amount', label: '按销售额排序' }, { value: 'code', label: '按客户编码排序' }],
  supplier: [{ value: 'amount', label: '按销售额排序' }, { value: 'code', label: '按供应商名称排序' }],
  customerProduct: [{ value: 'amount', label: '按销售额排序' }, { value: 'code', label: '按客户编码排序' }],
}

const PRODUCT_FIELDS: Opt[] = [
  { value: 'productCode', label: '货品编码' },
  { value: 'productName', label: '货品名称' },
]
const CUSTOMER_FIELDS: Opt[] = [
  { value: 'customerCode', label: '客户编码' },
  { value: 'customerName', label: '客户名称' },
]
const FIELDS: Partial<Record<Mode, Opt[]>> = {
  product: [...PRODUCT_FIELDS, { value: 'supplier', label: '供货商' }],
  customer: CUSTOMER_FIELDS,
  supplier: [{ value: 'supplier', label: '供应商名称' }],
  customerProduct: CUSTOMER_FIELDS,   // + a second (product) search below
}

interface Filters {
  start: string
  end: string
  sort: SortKey
  order: 'desc' | 'asc'
  field: string
  keyword: string
  field2: string     // 按客户+产品汇总: product search
  keyword2: string
}

// one report line — sales and returns kept apart (returns come back negative from the API)
interface Line {
  date: string
  customerCode: string
  customerName: string
  productCode: string
  productName: string
  supplierCode: string
  supplierName: string
  unit: string
  isReturn: boolean
  qty: number
  amount: number
  pieces: number
  profit: number     // as the API reports it (a return counts as −amount)
}

interface Agg {
  key: string
  line: Line         // first line of the group, for labels
  qty: number
  amount: number
  pieces: number
  retQty: number
  retAmount: number
  profit: number
}

const fmt = (n: number) => String(+n.toFixed(2))

// "1703 吉宏" → ["1703", "吉宏"]
function splitCodeName(text = ''): [string, string] {
  const i = text.indexOf(' ')
  return i < 0 ? [text, ''] : [text.slice(0, i), text.slice(i + 1)]
}

function toLine(r: ReportOrderRow): Line {
  const [customerCode, customerName] = splitCodeName(r.customerName)
  const [, supplierName] = splitCodeName(r.supplierName)
  return {
    date: r.orderDate,
    customerCode, customerName,
    productCode: r.productCode ?? '', productName: r.productName ?? '',
    supplierCode: r.supplierCode ?? '', supplierName,
    unit: r.unit ?? '',
    isReturn: Boolean(r.isReturn),
    qty: Math.abs(r.qty), amount: Math.abs(r.finalAmount), pieces: Math.abs(r.pieces),
    profit: r.profit ?? 0,
  }
}

function aggregate(lines: Line[], keyOf: (l: Line) => string): Agg[] {
  const map = new Map<string, Agg>()
  for (const l of lines) {
    const key = keyOf(l)
    let a = map.get(key)
    if (!a) {
      a = { key, line: l, qty: 0, amount: 0, pieces: 0, retQty: 0, retAmount: 0, profit: 0 }
      map.set(key, a)
    }
    if (l.isReturn) { a.retQty += l.qty; a.retAmount += l.amount }
    else { a.qty += l.qty; a.amount += l.amount; a.pieces += l.pieces }
    a.profit += l.profit
  }
  return [...map.values()]
}

function matchField(l: Line, field: string, keyword: string): boolean {
  if (!keyword) return true
  const q = keyword.toLowerCase()
  switch (field) {
    case 'productCode': return l.productCode.toLowerCase().includes(q)
    case 'productName': return l.productName.toLowerCase().includes(q)
    case 'supplier': return l.supplierCode.toLowerCase().includes(q) || l.supplierName.toLowerCase().includes(q)
    case 'customerCode': return l.customerCode.toLowerCase().includes(q)
    case 'customerName': return l.customerName.toLowerCase().includes(q)
    default: return true
  }
}

function defaultFilters(mode: Mode): Filters {
  return {
    // 按年+月汇总: last year + this year; everything else: current month
    start: mode === 'yearMonth' ? toSlashDate(dayjs().subtract(1, 'year').startOf('year').toDate()) : monthStart(),
    end: toSlashDate(),
    sort: mode === 'product' ? 'qty' : 'amount',
    order: 'desc',
    field: FIELDS[mode]?.[0].value ?? '',
    keyword: '',
    field2: 'productCode',
    keyword2: '',
  }
}

interface Props {
  mode: Mode
}

// 销售报表 — replicates old bb_xs_cp / kh / ghs / day / khcp / ny.asp, all built from the
// report order-line rows (sales + returns) for the date range.
export default function SalesReport({ mode }: Props) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // 查询汇总 opens 按产品汇总 with ?field=customerCode|supplier&keyword=&start=&end=
  const [form, setForm] = useState<Filters>(() => {
    const f = defaultFilters(mode)
    const field = searchParams.get('field')
    return {
      ...f,
      start: searchParams.get('start') ?? f.start,
      end: searchParams.get('end') ?? f.end,
      field: field ?? f.field,
      keyword: searchParams.get('keyword') ?? '',
    }
  })
  const [applied, setApplied] = useState<Filters>(form)
  const [lines, setLines] = useState<Line[]>([])
  const [productsByCode, setProductsByCode] = useState<Record<string, Product>>({})
  const [loading, setLoading] = useState(true)

  // the customer-code search only exists when arriving from 按客户汇总's 查询汇总
  const fieldOptions: Opt[] = [
    ...(FIELDS[mode] ?? []),
    ...(mode === 'product' && form.field === 'customerCode' ? [{ value: 'customerCode', label: '客户编码' }] : []),
  ]

  useEffect(() => {
    if (mode !== 'product' && mode !== 'customerProduct') return
    getProducts()
      .then(list => setProductsByCode(Object.fromEntries(list.map(p => [p.code, p]))))
      .catch(() => {})
  }, [mode])

  useEffect(() => {
    setLoading(true)
    getSalesOrderRows({
      startDate: parseSlashDate(applied.start) ?? '2000-01-01',
      endDate: parseSlashDate(applied.end) ?? '2099-12-31',
    })
      .then(rows => setLines(rows.map(toLine)))
      .catch(err => alert(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [applied.start, applied.end])

  // ── Filter + aggregate ───────────────────────────────────────
  const filtered = lines.filter(l =>
    matchField(l, applied.field, applied.keyword) &&
    (mode !== 'customerProduct' || matchField(l, applied.field2, applied.keyword2)))

  const dir = applied.order === 'asc' ? 1 : -1
  const sortAggs = (list: Agg[], codeOf: (a: Agg) => string) => list.sort((a, b) => {
    if (applied.sort === 'qty') return dir * (a.qty - b.qty)
    if (applied.sort === 'code') return dir * codeOf(a).localeCompare(codeOf(b))
    return dir * (a.amount - b.amount)
  })

  const groups: Agg[] =
    mode === 'product' ? sortAggs(aggregate(filtered, l => l.productCode), a => a.line.productCode)
    : mode === 'customer' ? sortAggs(aggregate(filtered, l => l.customerCode), a => a.line.customerCode)
    : mode === 'supplier' ? sortAggs(aggregate(filtered, l => l.supplierCode), a => a.line.supplierCode)
    : mode === 'customerProduct'
      ? sortAggs(aggregate(filtered, l => `${l.customerCode}|${l.productCode}`), a => a.line.customerCode)
    : []

  const total = aggregate(filtered, () => 'all')[0] ??
    { qty: 0, amount: 0, pieces: 0, retQty: 0, retAmount: 0, profit: 0 }

  // ── Actions ──────────────────────────────────────────────────
  function setField<K extends keyof Filters>(key: K, value: Filters[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleQuery() {
    if (form.start && !parseSlashDate(form.start)) { alert('开始日期格式不正确，例如 2026/10/1'); return }
    if (form.end && !parseSlashDate(form.end)) { alert('结束日期格式不正确，例如 2026/10/1'); return }
    setApplied({ ...form, keyword: form.keyword.trim(), keyword2: form.keyword2.trim() })
  }

  // magnifiers open a new tab, like the old target="_blank" links
  function openTab(path: string, field: string, keyword: string) {
    const qs = new URLSearchParams({ field, keyword, start: applied.start, end: applied.end })
    window.open(`${path}?${qs}`, '_blank')
  }
  const openDetail = (field: string, keyword: string) => openTab('/sales/orders/detail', field, keyword)
  const openSummary = (field: string, keyword: string) => openTab('/reports/sales', field, keyword)

  const lens = (onClick: () => void) => (
    <td className={styles.lens} onClick={onClick}><SearchIcon /></td>
  )

  const caption = mode === 'monthly'
    ? `从${applied.start}到${applied.end} 销售月报表`
    : mode === 'yearMonth'
      ? `从${applied.start}到${applied.end}销售按年+月汇总报表`
      : `从${applied.start}到${applied.end}销售报表`

  // ── Mode tables ──────────────────────────────────────────────
  // green footer: net quantity / amount (sales − returns), as on the old pages
  const footer = (labelSpan: number, qtySpan: number, amountSpan: number) => (
    <tr className={styles.footer}>
      <td colSpan={labelSpan}>&nbsp;{groups.length}个记录</td>
      <td colSpan={qtySpan} className={styles.c}>销售数量:{fmt(total.qty - total.retQty)}</td>
      <td colSpan={amountSpan} className={styles.c}>销售金额:{fmt(total.amount - total.retAmount)}</td>
    </tr>
  )

  function renderProduct() {
    return (
      <table className={styles.grid}>
        <thead>
          <tr>
            <th>&nbsp;编码&nbsp;</th>
            <th style={{ textAlign: 'left' }}>&nbsp;品名&nbsp;规格&nbsp;单位&nbsp;产地&nbsp;</th>
            <th>&nbsp;销售数量&nbsp;</th>
            <th>&nbsp;销售金额&nbsp;</th>
            <th>&nbsp;均价&nbsp;</th>
            <th>&nbsp;退货数量&nbsp;</th>
            <th>&nbsp;退货金额&nbsp;</th>
            <th>&nbsp;毛利&nbsp;</th>
            <th>&nbsp;查询明细&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(g => {
            const p = productsByCode[g.line.productCode]
            return (
              <tr key={g.key} className={styles.row}>
                <td className={styles.c}>&nbsp;{g.line.productCode}&nbsp;</td>
                <td>&nbsp;{g.line.productName}&nbsp;{p?.spec ?? ''}&nbsp;{g.line.unit}&nbsp;{g.line.supplierCode}&nbsp;</td>
                <td className={styles.r}>&nbsp;{fmt(g.qty)}&nbsp;</td>
                <td className={styles.r}>&nbsp;{fmt(g.amount)}&nbsp;</td>
                <td className={`${styles.r} ${styles.magenta}`}>&nbsp;{g.qty ? fmt(g.amount / g.qty) : 0}&nbsp;</td>
                <td className={styles.r}>&nbsp;{fmt(g.retQty)}&nbsp;</td>
                <td className={styles.r}>&nbsp;{fmt(g.retAmount)}&nbsp;</td>
                <td className={styles.r}>&nbsp;{fmt(g.profit)}&nbsp;</td>
                {lens(() => openDetail('productCode', g.line.productCode))}
              </tr>
            )
          })}
          <tr>
            <td colSpan={2} className={styles.r}>合计</td>
            <td className={styles.r}>&nbsp;{fmt(total.qty)}&nbsp;</td>
            <td className={styles.r}>&nbsp;{fmt(total.amount)}&nbsp;</td>
            <td>&nbsp;</td>
            <td className={styles.r}>&nbsp;{fmt(total.retQty)}&nbsp;</td>
            <td className={styles.r}>&nbsp;{fmt(total.retAmount)}&nbsp;</td>
            <td className={styles.r}>&nbsp;{fmt(total.profit)}&nbsp;</td>
            <td>&nbsp;</td>
          </tr>
          {footer(2, 3, 4)}
        </tbody>
      </table>
    )
  }

  // 按客户汇总 / 按供货商汇总 share one layout
  function renderParty(kind: 'customer' | 'supplier') {
    return (
      <table className={styles.grid}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>&nbsp;{kind === 'customer' ? '客户' : '供货商'}&nbsp;</th>
            <th>&nbsp;销售数量&nbsp;</th>
            <th>&nbsp;销售金额&nbsp;</th>
            <th>&nbsp;退货数量&nbsp;</th>
            <th>&nbsp;退货金额&nbsp;</th>
            <th>&nbsp;毛利&nbsp;</th>
            <th>&nbsp;查询明细&nbsp;</th>
            <th>&nbsp;查询汇总&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(g => {
            const code = kind === 'customer' ? g.line.customerCode : g.line.supplierCode
            return (
              <tr key={g.key} className={styles.row}>
                {kind === 'customer'
                  ? <td>&nbsp;<span className={styles.boldCode}>{code}</span>&nbsp;<span className={styles.teal}>{g.line.customerName}</span>&nbsp;</td>
                  : <td>&nbsp;<span className={styles.magenta}>{code}</span>&nbsp;{g.line.supplierName}&nbsp;</td>}
                <td className={styles.r}>&nbsp;{fmt(g.qty)}&nbsp;</td>
                <td className={styles.r}>&nbsp;{fmt(g.amount)}&nbsp;</td>
                <td className={styles.r}>&nbsp;{fmt(g.retQty)}&nbsp;</td>
                <td className={styles.r}>&nbsp;{fmt(g.retAmount)}&nbsp;</td>
                <td className={styles.r}>&nbsp;{fmt(g.profit)}&nbsp;</td>
                {lens(() => openDetail(kind === 'customer' ? 'customerCode' : 'supplierCode', code))}
                {lens(() => openSummary(kind === 'customer' ? 'customerCode' : 'supplier', code))}
              </tr>
            )
          })}
          <tr>
            <td className={styles.r}>合计</td>
            <td className={styles.r}>&nbsp;{fmt(total.qty)}&nbsp;</td>
            <td className={styles.r}>&nbsp;{fmt(total.amount)}&nbsp;</td>
            <td className={styles.r}>&nbsp;{fmt(total.retQty)}&nbsp;</td>
            <td className={styles.r}>&nbsp;{fmt(total.retAmount)}&nbsp;</td>
            <td className={styles.r}>&nbsp;{fmt(total.profit)}&nbsp;</td>
            <td colSpan={2}>&nbsp;</td>
          </tr>
          {footer(1, 2, 5)}
        </tbody>
      </table>
    )
  }

  function renderCustomerProduct() {
    return (
      <table className={styles.grid}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>&nbsp;客户&nbsp;</th>
            <th>&nbsp;供货商&nbsp;</th>
            <th style={{ textAlign: 'left' }}>&nbsp;产品&nbsp;</th>
            <th>&nbsp;销售数量&nbsp;</th>
            <th>&nbsp;销售金额&nbsp;</th>
            <th>&nbsp;退货数量&nbsp;</th>
            <th>&nbsp;退货金额&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(g => {
            const p = productsByCode[g.line.productCode]
            return (
              <tr key={g.key} className={styles.row}>
                <td>&nbsp;{g.line.customerCode}&nbsp;<span className={styles.teal}>{g.line.customerName}</span>&nbsp;</td>
                <td>&nbsp;{g.line.supplierCode}&nbsp;</td>
                <td>
                  &nbsp;{g.line.productCode}&nbsp;{g.line.productName}&nbsp;
                  <span className={styles.magenta}>{p?.spec ?? ''}</span>&nbsp;<span className={styles.bold}>{p?.grade ?? ''}</span>&nbsp;
                </td>
                <td className={styles.r}>&nbsp;{fmt(g.qty)}&nbsp;</td>
                <td className={styles.r}>&nbsp;{fmt(g.amount)}&nbsp;</td>
                <td className={styles.r}>&nbsp;{fmt(g.retQty)}&nbsp;</td>
                <td className={styles.r}>&nbsp;{fmt(g.retAmount)}&nbsp;</td>
              </tr>
            )
          })}
          <tr>
            <td colSpan={3} className={styles.r}>合计</td>
            <td className={styles.r}>&nbsp;{fmt(total.qty)}&nbsp;</td>
            <td className={styles.r}>&nbsp;{fmt(total.amount)}&nbsp;</td>
            <td className={styles.r}>&nbsp;{fmt(total.retQty)}&nbsp;</td>
            <td className={styles.r}>&nbsp;{fmt(total.retAmount)}&nbsp;</td>
          </tr>
          {footer(3, 2, 2)}
        </tbody>
      </table>
    )
  }

  // 销售月报表: one row per day, a "M合计" row after each month, then 总计
  function renderMonthly() {
    const days = aggregate(filtered, l => l.date).sort((a, b) => a.key.localeCompare(b.key))
    const months = new Map<string, Agg[]>()
    for (const d of days) {
      const m = d.key.slice(0, 7)
      months.set(m, [...(months.get(m) ?? []), d])
    }
    let seq = 0
    return (
      <table className={styles.grid}>
        <thead>
          <tr>
            <th>&nbsp;序号&nbsp;</th>
            <th>&nbsp;月份&nbsp;</th>
            <th>&nbsp;日期&nbsp;</th>
            <th>&nbsp;销售数量&nbsp;</th>
            <th>&nbsp;销售金额&nbsp;</th>
            <th>&nbsp;件数&nbsp;</th>
            <th>&nbsp;退货数量&nbsp;</th>
            <th>&nbsp;退货金额&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {[...months.entries()].map(([m, list]) => {
            const mm = Number(m.slice(5, 7))
            const monthQty = list.reduce((s, d) => s + d.qty, 0)
            const monthAmount = list.reduce((s, d) => s + d.amount, 0)
            const monthPieces = list.reduce((s, d) => s + d.pieces, 0)
            return [
              ...list.map((d, i) => (
                <tr key={d.key} className={styles.row}>
                  <td className={styles.bold}>&nbsp;{++seq}&nbsp;</td>
                  <td className={styles.periodLabel}>&nbsp;{i === 0 ? `${mm}月` : ''}&nbsp;</td>
                  <td className={styles.c}><span className={styles.periodLabel}>{Number(d.key.slice(8, 10))}</span>日</td>
                  <td className={styles.r}>&nbsp;{fmt(d.qty)}&nbsp;</td>
                  <td className={styles.r}>&nbsp;{fmt(d.amount)}&nbsp;</td>
                  <td className={`${styles.c} ${styles.bold}`}>&nbsp;{fmt(d.pieces)}&nbsp;</td>
                  <td className={styles.r}>&nbsp;{fmt(d.retQty)}&nbsp;</td>
                  <td className={styles.r}>&nbsp;{fmt(d.retAmount)}&nbsp;</td>
                </tr>
              )),
              <tr key={`${m}-sum`}>
                <td colSpan={3} className={styles.subtotalLabel}>{mm}合计</td>
                <td className={styles.r}>&nbsp;{fmt(monthQty)}&nbsp;</td>
                <td className={styles.r}>&nbsp;{fmt(monthAmount)}&nbsp;</td>
                <td className={`${styles.c} ${styles.bold}`}>&nbsp;{fmt(monthPieces)}&nbsp;</td>
                <td colSpan={2}>&nbsp;</td>
              </tr>,
            ]
          })}
          <tr>
            <td colSpan={3} className={styles.r}>总计</td>
            <td className={styles.r}>&nbsp;{fmt(total.qty)}&nbsp;</td>
            <td className={styles.r}>&nbsp;{fmt(total.amount)}&nbsp;</td>
            <td className={`${styles.c} ${styles.bold}`}>&nbsp;{fmt(total.pieces)}&nbsp;</td>
            <td className={styles.r}>&nbsp;{fmt(total.retQty)}&nbsp;</td>
            <td className={styles.r}>&nbsp;{fmt(total.retAmount)}&nbsp;</td>
          </tr>
        </tbody>
      </table>
    )
  }

  // 按年+月汇总: one row per month, a "YYYY年合计" row after each year, then 总计
  function renderYearMonth() {
    const monthsAgg = aggregate(filtered, l => l.date.slice(0, 7)).sort((a, b) => a.key.localeCompare(b.key))
    const years = new Map<string, Agg[]>()
    for (const m of monthsAgg) {
      const y = m.key.slice(0, 4)
      years.set(y, [...(years.get(y) ?? []), m])
    }
    const currentMonth = dayjs().format('YYYY-MM')
    const sumOf = (list: Agg[]) => list.reduce((t, a) => ({
      qty: t.qty + a.qty, amount: t.amount + a.amount, pieces: t.pieces + a.pieces,
      retQty: t.retQty + a.retQty, retAmount: t.retAmount + a.retAmount,
    }), { qty: 0, amount: 0, pieces: 0, retQty: 0, retAmount: 0 })
    return (
      <table className={styles.grid}>
        <thead>
          <tr>
            <th>&nbsp;序号&nbsp;</th>
            <th>&nbsp;年份&nbsp;</th>
            <th>&nbsp;月份&nbsp;</th>
            <th>&nbsp;销售数量&nbsp;</th>
            <th>&nbsp;销售金额&nbsp;</th>
            <th>&nbsp;件数&nbsp;</th>
            <th>&nbsp;退货数量&nbsp;</th>
            <th>&nbsp;退货金额&nbsp;</th>
            <th>&nbsp;金额合计&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {[...years.entries()].map(([y, list]) => {
            const s = sumOf(list)
            return [
              ...list.map((m, i) => (
                <tr key={m.key} className={`${styles.row} ${m.key === currentMonth ? styles.currentRow : ''}`}>
                  <td className={styles.bold}>&nbsp;{i + 1}&nbsp;</td>
                  <td className={styles.periodLabel}>&nbsp;{i === 0 ? `${y}年` : ''}&nbsp;</td>
                  <td className={styles.c}><span className={styles.periodLabel}>{Number(m.key.slice(5, 7))}月</span></td>
                  <td className={styles.r}>&nbsp;{fmt(m.qty)}&nbsp;</td>
                  <td className={styles.r}>&nbsp;{fmt(m.amount)}&nbsp;</td>
                  <td className={`${styles.c} ${styles.bold}`}>&nbsp;{fmt(m.pieces)}&nbsp;</td>
                  <td className={styles.r}>&nbsp;{fmt(m.retQty)}&nbsp;</td>
                  <td className={styles.r}>&nbsp;{fmt(m.retAmount)}&nbsp;</td>
                  <td className={`${styles.r} ${styles.bold}`}>&nbsp;{fmt(m.amount - m.retAmount)}&nbsp;</td>
                </tr>
              )),
              <tr key={`${y}-sum`} className={styles.yearBreak}>
                <td colSpan={3} className={styles.subtotalLabel}>{y}年合计</td>
                <td className={styles.r}>&nbsp;{fmt(s.qty)}&nbsp;</td>
                <td className={styles.r}>&nbsp;{fmt(s.amount)}&nbsp;</td>
                <td className={`${styles.c} ${styles.bold}`}>&nbsp;{fmt(s.pieces)}&nbsp;</td>
                <td className={styles.r}>&nbsp;{fmt(s.retQty)}&nbsp;</td>
                <td className={styles.r}>&nbsp;{fmt(s.retAmount)}&nbsp;</td>
                <td className={`${styles.r} ${styles.bigRed}`}>&nbsp;{fmt(s.amount - s.retAmount)}&nbsp;</td>
              </tr>,
            ]
          })}
          <tr>
            <td colSpan={3} className={styles.r}>总计</td>
            <td className={styles.r}>&nbsp;{fmt(total.qty)}&nbsp;</td>
            <td className={styles.r}>&nbsp;{fmt(total.amount)}&nbsp;</td>
            <td className={`${styles.c} ${styles.bold}`}>&nbsp;{fmt(total.pieces)}&nbsp;</td>
            <td className={styles.r}>&nbsp;{fmt(total.retQty)}&nbsp;</td>
            <td className={styles.r}>&nbsp;{fmt(total.retAmount)}&nbsp;</td>
            <td className={styles.r}>&nbsp;{fmt(total.amount - total.retAmount)}&nbsp;</td>
          </tr>
        </tbody>
      </table>
    )
  }

  function renderTable() {
    switch (mode) {
      case 'product': return renderProduct()
      case 'customer': return renderParty('customer')
      case 'supplier': return renderParty('supplier')
      case 'customerProduct': return renderCustomerProduct()
      case 'monthly': return renderMonthly()
      case 'yearMonth': return renderYearMonth()
    }
  }

  // ── Render ───────────────────────────────────────────────────
  const sortOptions = SORTS[mode]
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
        {sortOptions && (
          <>
            排序规则
            <select value={form.sort} onChange={e => setField('sort', e.target.value as SortKey)}>
              {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={form.order} onChange={e => setField('order', e.target.value as Filters['order'])}>
              <option value="desc">降序</option>
              <option value="asc">升序</option>
            </select>
          </>
        )}
        从<input className={styles.dateInput} type="text" value={form.start} onChange={e => setField('start', e.target.value)} />
        至<input className={styles.dateInput} type="text" value={form.end} onChange={e => setField('end', e.target.value)} />
        {fieldOptions.length > 0 && (
          <>
            <select value={form.field} onChange={e => setField('field', e.target.value)}>
              {fieldOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input className={styles.kwInput} type="text" value={form.keyword} onChange={e => setField('keyword', e.target.value)} />
          </>
        )}
        {mode === 'customerProduct' && (
          <>
            <select value={form.field2} onChange={e => setField('field2', e.target.value)}>
              {PRODUCT_FIELDS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input className={styles.kwInput} type="text" value={form.keyword2} onChange={e => setField('keyword2', e.target.value)} />
          </>
        )}
        <input type="submit" value="查询" />
      </form>

      <div className={styles.body}>
        <div className={styles.caption}>{caption}</div>
        {loading ? <div className={styles.loading}>数据加载中，请稍候...</div> : renderTable()}
      </div>
    </div>
  )
}
