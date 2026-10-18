import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPayments, deletePayment, type Payment } from '@/api/payments'
import { getSalesOrders, type SalesOrder } from '@/api/sales'
import { getErrorMessage } from '@/utils/error'
import { monthStart, parseSlashDate, toSlashDate } from '@/utils/slashDate'
import { exportRows, rangeName } from '@/utils/exportExcel'
import { codeEquals } from '@/utils/codeMatch'
import { isPaid, isVoided } from '@/utils/payment'
import { SearchIcon } from '@/pages/master/SupplierIcons'
import ExcelButton from '@/pages/common/ExcelButton'
import styles from '@/pages/purchase/PurchaseDocs.module.css'
import pay from './Payment.module.css'

// 销售单 list: all (default) / 已收款 / 未收款 — same buttons as the 销售单据 top bar
type View = 'all' | 'paid' | 'unpaid'

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
]

const VIEW_NAME: Record<View, string> = { all: '全部销售单', paid: '已收款销售单', unpaid: '未收款销售单' }

const PAGE_SIZE = 50
const PAGE_WINDOW = 10

const fmt = (n: number) => Number(n).toFixed(2)
const num = (n: number) => +Number(n).toFixed(2)

function matches(f: Filters, r: { customerCode: string; customerName: string; orderNo: string }) {
  if (!f.keyword) return true
  const q = f.keyword.toLowerCase()
  switch (f.field) {
    case 'customerCode': return codeEquals(r.customerCode, f.keyword)
    case 'customerName': return (r.customerName ?? '').toLowerCase().includes(q)
    case 'orderNo': return r.orderNo.toLowerCase().includes(q)
    default: return true
  }
}

// 收支管理 — the new system's 收款管理 (本期收款 / 应收金额 / 未收款订单) drawn as an
// old-style 销售单 list: 未收款 orders link to 新增收款, 已收款 ones can have their 收款 deleted
export default function PaymentList() {
  const navigate = useNavigate()

  // ── Toolbar inputs and applied filters ───────────────────────
  const [form, setForm] = useState<Filters>(() => ({
    start: monthStart(), end: toSlashDate(), field: 'customerCode', keyword: '',
  }))
  const [applied, setApplied] = useState<Filters>(form)
  const [view, setView] = useState<View>('all')
  const [page, setPage] = useState(1)

  // ── Data ─────────────────────────────────────────────────────
  // every 收款记录 (gives 已收金额 per order and 本期收款); 销售单 within the date range;
  // every 未收款 销售单 (未收款总额)
  const [payments, setPayments] = useState<Payment[]>([])
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [allUnpaid, setAllUnpaid] = useState<SalesOrder[]>([])   // 未收款 销售单 of every date
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getPayments(),
      getSalesOrders({
        startDate: parseSlashDate(applied.start) ?? undefined,
        endDate: parseSlashDate(applied.end) ?? undefined,
      }),
      getSalesOrders({ paymentStatus: '未收款' }),
    ])
      .then(([p, o, u]) => { setPayments(p); setOrders(o); setAllUnpaid(u) })
      .catch(err => alert(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [applied.start, applied.end, reloadKey])

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1) }, [applied, view])

  // ── Derived ──────────────────────────────────────────────────
  const paymentsByOrder: Record<number, Payment[]> = {}
  payments.forEach(p => { (paymentsByOrder[p.salesOrderId] ??= []).push(p) })
  const paidAmount = (id: number) => (paymentsByOrder[id] ?? []).reduce((s, p) => s + p.amount, 0)

  const liveOrders = orders.filter(o => !isVoided(o.status) && matches(applied, o))
  const unpaidOrders = liveOrders.filter(o => !isPaid(o.paymentStatus))
  const rows = view === 'all' ? liveOrders
    : view === 'paid' ? liveOrders.filter(o => isPaid(o.paymentStatus))
    : unpaidOrders

  // 本期收款 = 收款 dated within the range; 应收金额 / 未收款订单 = 未收款 orders dated within it
  const from = parseSlashDate(applied.start)
  const to = parseSlashDate(applied.end)
  const collected = payments
    .filter(p => (!from || p.paymentDate >= from) && (!to || p.paymentDate <= to) && matches(applied, p))
    .reduce((s, p) => s + p.amount, 0)
  const receivable = unpaidOrders.reduce((s, o) => s + o.totalAmount, 0)
  // 未收款总额 = every 未收款 order regardless of the date range (still follows the search)
  const unpaidTotal = allUnpaid
    .filter(o => !isVoided(o.status) && matches(applied, o))
    .reduce((s, o) => s + o.totalAmount, 0)

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const windowStart = Math.floor((page - 1) / PAGE_WINDOW) * PAGE_WINDOW + 1
  const windowEnd = Math.min(windowStart + PAGE_WINDOW - 1, totalPages)

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

  // 删除: every 收款 of this order → it goes back to 未收款
  async function handleDelete(o: SalesOrder) {
    const list = paymentsByOrder[o.id] ?? []
    if (list.length === 0) { alert('该单没有收款记录'); return }
    const msg = `删除「${o.orderNo}」的收款记录（共${list.length}笔，合计 ${fmt(paidAmount(o.id))}）？该单将变回未收款。`
    if (!window.confirm(msg)) return
    try {
      for (const p of list) await deletePayment(p.id)
    } catch (err) {
      alert(getErrorMessage(err))
    }
    setReloadKey(k => k + 1)
  }

  function handleExport() {
    exportRows(
      `${VIEW_NAME[view]}_${rangeName(applied.start, applied.end)}`,
      ['客户', '日期', '单号', '金额', '已收金额', '收款状态', '经办人', '备注'],
      [
        ...rows.map(o => [
          `${o.customerCode}.${o.customerName}`, toSlashDate(o.orderDate), o.orderNo, num(o.totalAmount),
          num(paidAmount(o.id)), isPaid(o.paymentStatus) ? '已收款' : '未收款', o.operator, o.notes,
        ]),
        ['总计', '', '', num(rows.reduce((s, o) => s + o.totalAmount, 0)),
          num(rows.reduce((s, o) => s + paidAmount(o.id), 0)), '', '', ''],
      ],
    )
  }

  // ── Table ────────────────────────────────────────────────────
  const amountOf = (list: SalesOrder[]) => list.reduce((s, o) => s + o.totalAmount, 0)
  const paidOf = (list: SalesOrder[]) => list.reduce((s, o) => s + paidAmount(o.id), 0)
  const totalRow = (label: string, list: SalesOrder[]) => (
    <tr>
      <td colSpan={3} className={styles.r}>{label}</td>
      <td className={`${styles.c} ${styles.hatch}`}>&nbsp;{fmt(amountOf(list))}</td>
      <td className={`${styles.c} ${styles.hatch}`}>&nbsp;{fmt(paidOf(list))}</td>
      <td colSpan={4}>&nbsp;</td>
    </tr>
  )

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ── Sub-toolbar ── */}
      <form className={styles.subbar} onSubmit={e => { e.preventDefault(); handleSearch() }}>
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
        />
        <input type="submit" value="查找" />
        <input type="button" value="显示全部" onClick={handleShowAll} />
        <input type="button" value="新增收款" onClick={() => navigate('/payment/new')} />
        &nbsp;&nbsp;
        <input type="button" value="已收款" onClick={() => setView('paid')} />
        <input type="button" value="未收款" onClick={() => setView('unpaid')} />
        <input type="button" value="全部订单" onClick={() => setView('all')} />
        &nbsp;<ExcelButton onClick={handleExport} />
      </form>

      <div className={`${styles.body} ${pay.layout}`}>
        {/* ── 收款汇总 box, shown right of the list (CSS order), styled like the 首页 panels ── */}
        <div className={pay.panel}>
          <div className={pay.panelTitle}>收款汇总</div>
          <div className={pay.sRow}><span className={pay.dot}>○</span>本期收款:<em className={pay.greenNum}>{fmt(collected)}</em>元</div>
          <div className={pay.sRow}><span className={pay.dot}>○</span>应收金额:<em className={pay.greenNum}>{fmt(receivable)}</em>元</div>
          <div className={pay.sRow}><span className={pay.dot}>○</span>未收款订单:<em>{unpaidOrders.length}</em>个</div>
          <div className={pay.sRow}><span className={pay.dot}>○</span>未收款总额:<em>{fmt(unpaidTotal)}</em>元</div>
        </div>

        <div>
        <div className={pay.viewName}>【{VIEW_NAME[view]}】</div>

        {loading ? <div className={styles.loading}>数据加载中，请稍候...</div> : (
          <table className={`${styles.grid} ${pay.list}`}>
            <colgroup>
              <col className={pay.wCustomer} />
              <col className={pay.wDate} />
              <col className={pay.wNo} />
              <col className={pay.wAmount} />
              <col className={pay.wAmount} />
              <col className={pay.wStatus} />
              <col className={pay.wOperator} />
              <col className={pay.wNotes} />
              <col className={pay.wOps} />
            </colgroup>
            <thead>
              <tr>
                <th>&nbsp;客户&nbsp;</th>
                <th>&nbsp;日期&nbsp;</th>
                <th>&nbsp;单号&nbsp;</th>
                <th>&nbsp;金额&nbsp;</th>
                <th>&nbsp;已收金额&nbsp;</th>
                <th>&nbsp;收款状态&nbsp;</th>
                <th>&nbsp;经办人&nbsp;</th>
                <th>&nbsp;备注&nbsp;</th>
                <th>&nbsp;操作&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(o => {
                const paid = isPaid(o.paymentStatus)
                const received = paidAmount(o.id)
                return (
                  <tr key={o.id} className={styles.row}>
                    <td>&nbsp;{o.customerCode}.{o.customerName}&nbsp;</td>
                    <td className={styles.c}>&nbsp;{toSlashDate(o.orderDate)}&nbsp;</td>
                    <td>&nbsp;<a onClick={() => navigate(`/sales/orders/${o.id}`)}>{o.orderNo}</a>&nbsp;</td>
                    <td className={`${styles.c} ${styles.bold}`}>&nbsp;{fmt(o.totalAmount)}&nbsp;</td>
                    <td className={styles.c}>&nbsp;{received ? fmt(received) : ''}&nbsp;</td>
                    <td className={styles.c}>
                      &nbsp;<span className={paid ? styles.paid : pay.unpaidText}>{paid ? '已收款' : '未收款'}</span>&nbsp;
                    </td>
                    <td className={styles.c}>&nbsp;{o.operator ?? ''}&nbsp;</td>
                    <td className={pay.notesCell} title={o.notes ?? ''}>&nbsp;{o.notes ?? ''}</td>
                    <td className={styles.c}>
                      {paid
                        ? <a className={pay.deleteLink} onClick={() => handleDelete(o)}>删除</a>
                        : <a onClick={() => navigate(`/payment/new?order=${o.id}`)}>收款</a>}
                    </td>
                  </tr>
                )
              })}
              {totalRow('本页小计', paged)}
              {totalRow('总计', rows)}
            </tbody>
          </table>
        )}

        {/* ── Legend ── */}
        <div className={styles.legend}>
          日期为开单日期，本期收款按收款日期统计。少收款的单据也算已收款。点击单号查看销售单，点击收款录入收款，点击删除删除该单的收款记录。
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
    </div>
  )
}
