import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { getSalesOrders, getSalesReturns, getSalesOrdersDetail } from '@/api/sales'
import { getProducts, type Product } from '@/api/products'
import { getErrorMessage } from '@/utils/error'
import { isToday, monthStart, parseSlashDate, toSlashDate } from '@/utils/slashDate'
import { exportRows, rangeName } from '@/utils/exportExcel'
import { EditIcon, SearchIcon } from '@/pages/master/SupplierIcons'
import ExcelButton from '@/pages/common/ExcelButton'
import styles from '@/pages/purchase/PurchaseDocs.module.css'
import { codeEquals } from '@/utils/codeMatch'
import { specCodes } from '@/utils/specMatch'
import { isPaid, isVoided } from '@/utils/payment'
import { can } from '@/utils/permissions'
import { getPayments } from '@/api/payments'

type PayFilter = 'all' | 'paid' | 'unpaid'

type TypeFilter = 'all' | 'order' | 'return'

interface Filters {
  type: TypeFilter
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
  { value: 'spec', label: '产品规格' },
]

// 明细表 can also search by product / supplier (target of the 销售报表 查询明细 magnifiers)
const DETAIL_FIELDS = [
  ...SEARCH_FIELDS,
  { value: 'productCode', label: '产品编码' },
  { value: 'productName', label: '产品名称' },
  { value: 'supplierCode', label: '供货商' },
]

const PAGE_SIZE = 50
const PAGE_WINDOW = 10

const fmt = (n: number) => String(+Number(n).toFixed(2))
const blankZero = (n: number) => (n ? fmt(n) : '')

type Kind = 'order' | 'return'
const TYPE_LABEL: Record<Kind, string> = { order: '销售单', return: '退货单' }
// 退货单 quantities / amounts count against sales: shown negative, totals are net
const sign = (kind: Kind) => (kind === 'return' ? -1 : 1)

// 汇总表: one row per document (销售单 + 退货单)
interface SumRow {
  kind: Kind
  id: number
  no: string
  customer: string
  date: string
  qty: number
  amount: number
  pieces: number
  paid: boolean        // 销售单 已收款 (部分收款 counts as paid)
  voided: boolean      // 作废 销售单
  operator: string
  notes: string
}

// 明细表: one row per item
interface DetailRow {
  kind: Kind
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
  const [searchParams] = useSearchParams()
  const fields = mode === 'detail' ? DETAIL_FIELDS : SEARCH_FIELDS

  // ── Toolbar inputs and applied filters ───────────────────────
  // default range: current month (1st → today); the 销售报表 magnifiers pass
  // ?field=&keyword=&start=&end= to open this list already filtered
  const [form, setForm] = useState<Filters>(() => {
    const field = searchParams.get('field')
    return {
      type: 'all',
      start: searchParams.get('start') ?? monthStart(),
      end: searchParams.get('end') ?? toSlashDate(),
      field: field && fields.some(f => f.value === field) ? field : 'customerCode',
      keyword: searchParams.get('keyword') ?? '',
    }
  })
  const [applied, setApplied] = useState<Filters>(form)
  const [pay, setPay] = useState<PayFilter>('all')
  const [page, setPage] = useState(1)

  // ── Data ─────────────────────────────────────────────────────
  const [sumRows, setSumRows] = useState<SumRow[]>([])
  const [detailRows, setDetailRows] = useState<DetailRow[]>([])
  const [productsByCode, setProductsByCode] = useState<Record<string, Product>>({})
  const [payMethods, setPayMethods] = useState<Record<number, string>>({})   // 销售单 id → 收款方式
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (mode !== 'detail') return
    getProducts()
      .then(list => setProductsByCode(Object.fromEntries(list.map(p => [p.code, p]))))
      .catch(() => {})
  }, [mode])

  useEffect(() => {
    // the backend can't search by supplier or 规格 — those filters are applied to the rows below
    const bySupplier = applied.field === 'supplierCode'
    const bySpec = applied.field === 'spec'
    const local = bySupplier || bySpec
    const params = {
      startDate: parseSlashDate(applied.start) ?? undefined,
      endDate: parseSlashDate(applied.end) ?? undefined,
      search: applied.keyword && !local ? applied.keyword : undefined,
      searchField: applied.keyword && !local ? applied.field : undefined,
    }
    // 规格: product codes whose spec matches (null = no 规格 filter)
    const specP = bySpec && applied.keyword ? specCodes(applied.keyword) : Promise.resolve(null)
    // the backend matches 客户编码 with LIKE — keep only the exact code
    const codeOk = (code: string) =>
      applied.field !== 'customerCode' || !applied.keyword || codeEquals(code, applied.keyword)
    setLoading(true)
    if (mode === 'summary') {
      Promise.all([
        applied.type !== 'return' ? getSalesOrders(params) : Promise.resolve([]),
        applied.type !== 'order' ? getSalesReturns(params) : Promise.resolve([]),
        // 规格 → the documents having a line with a matching product (from the 明细 rows)
        specP.then(codes => codes && getSalesOrdersDetail(params)
          .then(rows => new Set(rows.filter(r => codes.has(r.productCode)).map(r => `${r.rowType}-${r.id}`)))),
      ])
        .then(([orders, returns, docs]) => setSumRows([
          ...orders.filter(o => codeOk(o.customerCode)).map((o): SumRow => ({
            kind: 'order', id: o.id, no: o.orderNo,
            customer: `${o.customerCode}.${o.customerName}`,
            date: dayjs(o.orderDate).format('YYYY-MM-DD'),
            qty: o.totalQty, amount: o.totalAmount, pieces: o.totalPieces,
            paid: isPaid(o.paymentStatus), voided: isVoided(o.status),
            operator: o.operator ?? '', notes: o.notes ?? '',
          })),
          ...returns.filter(r => codeOk(r.customerCode)).map((r): SumRow => ({
            kind: 'return', id: r.id, no: r.returnNo,
            customer: `${r.customerCode}.${r.customerName}`,
            date: dayjs(r.returnDate).format('YYYY-MM-DD'),
            qty: -r.totalQty, amount: -r.totalAmount, pieces: r.totalPieces,
            paid: false, voided: false,
            operator: r.operator ?? '', notes: r.notes ?? '',
          })),
        ]
          .filter(r => !docs || docs.has(`${r.kind}-${r.id}`))
          .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)))
        .catch(err => alert(getErrorMessage(err)))
        .finally(() => setLoading(false))
    } else {
      Promise.all([getSalesOrdersDetail(params), specP])
        .then(([rows, codes]) => setDetailRows(rows
          .filter(r => applied.type === 'all' || r.rowType === applied.type)
          .filter(r => !codes || codes.has(r.productCode))
          .filter(r => codeOk(r.customerCode))
          .filter(r => !bySupplier || !applied.keyword || codeEquals(r.supplierCode, applied.keyword))
          .map((r): DetailRow => {
            const profit = r.profit ?? 0
            const k = sign(r.rowType)
            return {
              kind: r.rowType, id: r.id, no: r.no,
              customer: `${r.customerCode}.${r.customerName}`,
              date: r.date,
              productCode: r.productCode, productName: r.productName, supplierCode: r.supplierCode,
              unit: r.unit, qty: k * r.qty, unitPrice: r.unitPrice, amount: k * r.amount,
              // 退货单 rows carry no 毛利 → no 进价 either
              costPrice: r.rowType === 'order' && r.qty ? +((r.amount - profit) / r.qty).toFixed(2) : 0,
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
  // 已收款 / 未收款 only list 销售单; 作废 orders are in neither
  const rows = sumRows.filter(r =>
    pay === 'all' || (r.kind === 'order' && !r.voided && (pay === 'paid' ? r.paid : !r.paid)))
  const total = mode === 'summary' ? rows.length : detailRows.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pagedDetail = detailRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const windowStart = Math.floor((page - 1) / PAGE_WINDOW) * PAGE_WINDOW + 1
  const windowEnd = Math.min(windowStart + PAGE_WINDOW - 1, totalPages)

  const sum = (list: SumRow[]) => ({
    qty: list.reduce((s, r) => s + r.qty, 0),
    amount: list.reduce((s, r) => s + r.amount, 0),
    pieces: list.reduce((s, r) => s + r.pieces, 0),
  })
  const pageSum = sum(paged)
  const allSum = sum(rows)

  // 导出EXCEL (old xs_djhz_list_excel.asp): every row of the current filter, same columns as the table + 总计
  function handleExport() {
    const num = (n: number) => +Number(n).toFixed(2)
    const range = rangeName(applied.start, applied.end)
    if (mode === 'summary') {
      exportRows(
        `销售单据汇总_${range}`,
        ['类型', '客户', '日期', '单号', '数量', '金额', '件数', '收款状态', '收款方式', '经办人', '备注'],
        [
          ...rows.map(r => [
            TYPE_LABEL[r.kind], r.customer, toSlashDate(r.date), r.no, num(r.qty), num(r.amount),
            r.pieces || '', payText(r), payMethodText(r), r.operator, r.notes,
          ]),
          ['总计', '', '', '', num(allSum.qty), num(allSum.amount), num(allSum.pieces), '', '', '', ''],
        ],
      )
      return
    }
    const total = (key: 'qty' | 'amount' | 'profit' | 'pieces') => num(detailRows.reduce((s, r) => s + r[key], 0))
    exportRows(
      `销售单据明细_${range}`,
      ['类型', '客户', '日期', '单号', '编码', '规格', '产品', '等级', '包装', '供应商', '单位', '数量', '单价', '金额', '进价', '毛利', '件数', '经办人', '备注'],
      [
        ...detailRows.map(r => {
          const p = productsByCode[r.productCode]
          return [
            TYPE_LABEL[r.kind], r.customer, toSlashDate(r.date), r.no, r.productCode,
            p?.spec, r.productName, p?.grade, p?.unitsPerPiece, r.supplierCode, r.unit,
            r.qty ? num(r.qty) : '', num(r.unitPrice), r.amount ? num(r.amount) : '',
            r.costPrice ? num(r.costPrice) : '', r.profit ? num(r.profit) : '', r.pieces || '', r.operator, r.notes,
          ]
        }),
        ['总计', '', '', '', '', '', '', '', '', '', '', total('qty'), '', total('amount'), '', total('profit'), total('pieces'), '', ''],
      ],
    )
  }

  // 收款方式 column (汇总表): the methods of the order's 收款 records; refreshed with each search
  useEffect(() => {
    if (mode !== 'summary') return
    getPayments()
      .then(list => {
        const byOrder: Record<number, string[]> = {}
        list.forEach(p => {
          const ms = (byOrder[p.salesOrderId] ??= [])
          if (p.method && !ms.includes(p.method)) ms.push(p.method)
        })
        setPayMethods(Object.fromEntries(Object.entries(byOrder).map(([id, ms]) => [id, ms.join('、')])))
      })
      .catch(() => {})
  }, [mode, applied])

  const payMethodText = (r: SumRow) => (r.kind === 'order' ? payMethods[r.id] ?? '' : '')

  // 收款状态 column: blank for 退货单
  const payText = (r: SumRow) =>
    r.kind === 'return' ? '' : r.voided ? '已作废' : r.paid ? '已收款' : '未收款'

  function payCell(r: SumRow) {
    // 未收款 → 新增收款 with this order already ticked (needs 收支管理 permission)
    if (r.kind === 'order' && !r.voided && !r.paid) {
      return can('payment')
        ? <a className={styles.unpaid} title="点击收款" onClick={() => navigate(`/payment/new?order=${r.id}`)}>未收款</a>
        : <span className={styles.unpaidText}>未收款</span>
    }
    if (r.kind === 'order' && !r.voided) return <span className={styles.paid}>已收款</span>
    return payText(r)
  }

  const base = (kind: Kind) => (kind === 'order' ? 'orders' : 'returns')
  const viewPath = (kind: Kind, id: number) => `/sales/${base(kind)}/${id}`

  function ops(kind: Kind, id: number) {
    const print = kind === 'order' ? `/print/sales/${id}` : `/print/sales-return/${id}`
    return (
      <>
        <EditIcon title="修改单据" onClick={() => navigate(`/sales/${base(kind)}/${id}/edit`)} />
        <span className={styles.printImg} title="打印单据" onClick={() => window.open(print, '_blank')}>打印</span>
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
        <td colSpan={11} className={styles.r}>{label}</td>
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
      <table className={`${styles.grid} ${styles.wide}`}>
        <thead>
          <tr>
            <th>&nbsp;类型&nbsp;</th>
            <th>&nbsp;客户&nbsp;</th>
            <th>&nbsp;日期&nbsp;</th>
            <th>&nbsp;单号&nbsp;</th>
            <th>&nbsp;编码&nbsp;</th>
            <th>&nbsp;规格&nbsp;</th>
            <th>&nbsp;产品&nbsp;</th>
            <th>&nbsp;等级&nbsp;</th>
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
              <tr key={`${r.kind}-${r.id}-${i}`} className={r.kind === 'return' ? `${styles.row} ${styles.returnRow}` : styles.row}>
                <td>&nbsp;{TYPE_LABEL[r.kind]}&nbsp;</td>
                <td>&nbsp;{r.customer}&nbsp;</td>
                <td className={isToday(r.date) ? styles.dateCell : undefined}>&nbsp;{toSlashDate(r.date)}&nbsp;</td>
                <td>&nbsp;<a onClick={() => navigate(viewPath(r.kind, r.id))}>{r.no}</a>&nbsp;</td>
                <td>&nbsp;{r.productCode}&nbsp;</td>
                <td>&nbsp;<em className={styles.spec}>{p?.spec ?? ''}</em>&nbsp;</td>
                <td>&nbsp;{r.productName}&nbsp;</td>
                <td>&nbsp;{p?.grade ?? ''}&nbsp;</td>
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
                <td><div className={styles.notesCell} title={r.notes}>&nbsp;{r.notes}</div></td>
                <td className={styles.c}>{ops(r.kind, r.id)}</td>
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
    const all: Filters = { type: 'all', start: '', end: '', field: form.field, keyword: '' }
    setForm(all)
    setApplied(all)
    setPay('all')
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ── Sub-toolbar ── */}
      <form className={styles.subbar} onSubmit={e => { e.preventDefault(); handleSearch() }}>
        <SearchIcon />
        <select value={form.type} onChange={e => setField('type', e.target.value as TypeFilter)}>
          <option value="all">全部</option>
          <option value="order">销售单</option>
          <option value="return">退货单</option>
        </select>
        从<input className={styles.dateInput} type="text" value={form.start} onChange={e => setField('start', e.target.value)} />
        至<input className={styles.dateInput} type="text" value={form.end} onChange={e => setField('end', e.target.value)} />
        <select value={form.field} onChange={e => setField('field', e.target.value)}>
          {fields.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <input
          className={styles.kwInput}
          type="text"
          value={form.keyword}
          onChange={e => setField('keyword', e.target.value)}
        />
        <input type="submit" value="查找" />
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
        &nbsp;<ExcelButton onClick={handleExport} />
      </form>

      <div className={styles.body}>
        {loading ? <div className={styles.loading}>数据加载中，请稍候...</div> : mode === 'detail' ? renderDetail() : (
          <table className={`${styles.grid} ${styles.wide}`}>
            <thead>
              <tr>
                <th>&nbsp;类型&nbsp;</th>
                <th>&nbsp;客户&nbsp;</th>
                <th>&nbsp;日期&nbsp;</th>
                <th>&nbsp;单号&nbsp;</th>
                <th>&nbsp;数量&nbsp;</th>
                <th>&nbsp;金额&nbsp;</th>
                <th>件数</th>
                <th>&nbsp;收款状态&nbsp;</th>
                <th>&nbsp;收款方式&nbsp;</th>
                <th>&nbsp;经办人&nbsp;</th>
                <th>&nbsp;备注&nbsp;</th>
                <th>&nbsp;操作&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(r => (
                <tr key={`${r.kind}-${r.id}`} className={r.kind === 'return' ? `${styles.row} ${styles.returnRow}` : styles.row}>
                  <td>&nbsp;{TYPE_LABEL[r.kind]}&nbsp;</td>
                  <td>&nbsp;{r.customer}&nbsp;</td>
                  <td className={isToday(r.date) ? styles.dateCell : undefined}>&nbsp;{toSlashDate(r.date)}&nbsp;</td>
                  <td>&nbsp;<a onClick={() => navigate(viewPath(r.kind, r.id))}>{r.no}</a>&nbsp;</td>
                  <td className={`${styles.c} ${styles.bold}`}>&nbsp;{fmt(r.qty)}&nbsp;</td>
                  <td className={`${styles.c} ${styles.bold}`}>&nbsp;{fmt(r.amount)}&nbsp;</td>
                  <td className={styles.c}>&nbsp;{r.pieces ? <em className={styles.qty}>{r.pieces}</em> : ''}&nbsp;</td>
                  <td className={styles.c}>&nbsp;{payCell(r)}&nbsp;</td>
                  <td className={styles.c}>&nbsp;{payMethodText(r)}&nbsp;</td>
                  <td>&nbsp;{r.operator}&nbsp;</td>
                  <td className={styles.notesCell}><div>&nbsp;{r.notes}</div></td>
                  <td className={styles.c}>
                    {ops(r.kind, r.id)}
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={4} className={styles.r}>本页小计</td>
                <td className={`${styles.c} ${styles.hatch}`}>&nbsp;{fmt(pageSum.qty)}</td>
                <td className={`${styles.c} ${styles.hatch}`}>&nbsp;{fmt(pageSum.amount)}</td>
                <td className={`${styles.c} ${styles.hatch}`}>&nbsp;{fmt(pageSum.pieces)}</td>
                <td colSpan={5}>核对数量:<em className={styles.qty}>{fmt(allSum.qty)}</em></td>
              </tr>
              <tr>
                <td colSpan={4} className={styles.r}>总计</td>
                <td className={`${styles.c} ${styles.hatch}`}>&nbsp;{fmt(allSum.qty)}</td>
                <td className={`${styles.c} ${styles.hatch}`}>&nbsp;{fmt(allSum.amount)}</td>
                <td className={`${styles.c} ${styles.hatch}`}>&nbsp;{fmt(allSum.pieces)}</td>
                <td colSpan={5}>核对金额:<em className={styles.qty}>{fmt(allSum.amount)}</em></td>
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
