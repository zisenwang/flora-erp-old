import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getSalesOrders, type SalesOrder } from '@/api/sales'
import { createPayment } from '@/api/payments'
import { getErrorMessage } from '@/utils/error'
import { parseSlashDate, toSlashDate } from '@/utils/slashDate'
import { codeEquals } from '@/utils/codeMatch'
import { PAY_METHODS, isVoided } from '@/utils/payment'
import { SearchIcon } from '@/pages/master/SupplierIcons'
import styles from '@/pages/purchase/PurchaseDocs.module.css'
import pay from './Payment.module.css'

const PAGE_SIZE = 20
const PAGE_WINDOW = 10

const fmt = (n: number) => Number(n).toFixed(2)

// 新增收款 — the new system's AddPaymentModal as a page:
// tick one 未收款 销售单 (any amount; less than the total still settles it) or
// several (each paid in full). ?order=ID comes ticked from the 销售单据 收款状态 column.
export default function PaymentNew() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselect = Number(searchParams.get('order')) || null

  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [applied, setApplied] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<number[]>([])

  // form
  const [amountText, setAmountText] = useState<string | null>(null)   // null = the order total
  const [date, setDate] = useState(toSlashDate())
  const [method, setMethod] = useState(PAY_METHODS[0])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getSalesOrders({ paymentStatus: '未收款' })
      .then(list => {
        const unpaid = list
          .filter(o => !isVoided(o.status))
          .sort((a, b) => b.orderDate.localeCompare(a.orderDate) || b.id - a.id)
        setOrders(unpaid)
        // came from 销售单据: tick it and list that customer's 未收款 orders
        const o = unpaid.find(x => x.id === preselect)
        if (o) {
          setSelected([o.id])
          setKeyword(o.customerCode)
          setApplied(o.customerCode)
        }
      })
      .catch(err => alert(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [preselect])

  // ── Derived ──────────────────────────────────────────────────
  // 单号 / 客户名称 fuzzy, 客户编码 exact
  const q = applied.toLowerCase()
  const rows = orders.filter(o => !q ||
    o.orderNo.toLowerCase().includes(q) ||
    codeEquals(o.customerCode, applied) ||
    (o.customerName ?? '').toLowerCase().includes(q))
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const windowStart = Math.floor((page - 1) / PAGE_WINDOW) * PAGE_WINDOW + 1
  const windowEnd = Math.min(windowStart + PAGE_WINDOW - 1, totalPages)

  const chosen = orders.filter(o => selected.includes(o.id))
  const single = chosen.length === 1 ? chosen[0] : null
  const chosenTotal = chosen.reduce((s, o) => s + o.totalAmount, 0)
  const pageAllTicked = paged.length > 0 && paged.every(o => selected.includes(o.id))

  // ── Actions ──────────────────────────────────────────────────
  function changeSelection(next: number[]) {
    setSelected(next)
    setAmountText(null)
  }

  function toggle(id: number) {
    changeSelection(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }

  function togglePage() {
    const ids = paged.map(o => o.id)
    changeSelection(pageAllTicked
      ? selected.filter(id => !ids.includes(id))
      : [...selected, ...ids.filter(id => !selected.includes(id))])
  }

  function search(text: string) {
    setKeyword(text)
    setApplied(text.trim())
    setPage(1)
  }

  async function handleSubmit() {
    if (chosen.length === 0) { alert('请先勾选要收款的销售单'); return }
    const paymentDate = parseSlashDate(date)
    if (!paymentDate) { alert('收款日期格式不正确，例如 2026/10/1'); return }
    const amount = single ? Number(amountText ?? single.totalAmount) : 0
    if (single && !(amount > 0)) { alert('请输入正确的收款金额'); return }

    setSubmitting(true)
    try {
      for (const o of chosen) {
        await createPayment({
          salesOrderId: o.id,
          amount: single ? +amount.toFixed(2) : o.totalAmount,
          paymentDate,
          method,
          notes: notes.trim() || undefined,
        })
      }
      alert(single ? '收款成功' : `已对 ${chosen.length} 笔销售单完成收款`)
      navigate('/payment')
    } catch (err) {
      alert(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ── Sub-toolbar ── */}
      <form className={styles.subbar} onSubmit={e => { e.preventDefault(); search(keyword) }}>
        <SearchIcon />
        单号/客户:
        <input className={pay.searchInput} type="text" value={keyword} onChange={e => setKeyword(e.target.value)} />
        <input type="submit" value="查找" />
        <input type="button" value="显示全部" onClick={() => search('')} />
        <input type="button" value="返回收支管理" onClick={() => navigate('/payment')} />
      </form>

      <div className={styles.body}>
        {loading ? <div className={styles.loading}>数据加载中，请稍候...</div> : (
          <table className={`${styles.grid} ${pay.pick}`}>
            <thead>
              <tr>
                <th><input type="checkbox" checked={pageAllTicked} onChange={togglePage} title="全选本页" /></th>
                <th>&nbsp;单号&nbsp;</th>
                <th>&nbsp;客户&nbsp;</th>
                <th>&nbsp;日期&nbsp;</th>
                <th>&nbsp;金额&nbsp;</th>
                <th>&nbsp;状态&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(o => {
                const ticked = selected.includes(o.id)
                return (
                  <tr key={o.id} className={`${styles.row} ${ticked ? pay.ticked : ''}`} onClick={() => toggle(o.id)}>
                    <td className={styles.c}>
                      <input type="checkbox" checked={ticked} onChange={() => toggle(o.id)} onClick={e => e.stopPropagation()} />
                    </td>
                    <td>&nbsp;<a onClick={e => { e.stopPropagation(); window.open(`/sales/orders/${o.id}`, '_blank') }}>{o.orderNo}</a>&nbsp;</td>
                    <td>&nbsp;{o.customerCode}.{o.customerName}&nbsp;</td>
                    <td className={styles.c}>&nbsp;{toSlashDate(o.orderDate)}&nbsp;</td>
                    <td className={`${styles.c} ${styles.bold}`}>&nbsp;{fmt(o.totalAmount)}&nbsp;</td>
                    <td className={`${styles.c} ${pay.red}`}>&nbsp;未收款&nbsp;</td>
                  </tr>
                )
              })}
              {paged.length === 0 && (
                <tr><td colSpan={6} className={styles.c}>没有未收款的销售单</td></tr>
              )}
            </tbody>
          </table>
        )}

        {/* ── Pager ── */}
        <table className={`${styles.pager} ${pay.pagerGap}`}>
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

        {/* ── 收款信息 ── */}
        <table className={`${styles.doc} ${pay.form}`}>
          <thead>
            <tr><th colSpan={4}>收款信息</th></tr>
          </thead>
          <tbody>
            <tr>
              <td className={pay.label}>已选:</td>
              <td colSpan={3}>
                {chosen.length === 0 ? '请在上表勾选销售单' : single ? (
                  <>
                    <b>{single.orderNo}</b>&nbsp;&nbsp;{single.customerCode}.{single.customerName}
                    &nbsp;&nbsp;订单金额 <em className={styles.qty}>{fmt(single.totalAmount)}</em>
                  </>
                ) : (
                  <>
                    <b>{chosen.length}</b> 笔销售单，合计 <em className={styles.qty}>{fmt(chosenTotal)}</em>（每单按订单金额全额收款）
                  </>
                )}
              </td>
            </tr>
            <tr>
              <td className={pay.label}>收款金额:</td>
              <td>
                {single ? (
                  <input
                    className={pay.input}
                    type="text"
                    value={amountText ?? String(single.totalAmount)}
                    onChange={e => setAmountText(e.target.value)}
                  />
                ) : chosen.length > 1 ? fmt(chosenTotal) : ''}
              </td>
              <td className={pay.label}>收款日期:</td>
              <td><input className={pay.input} type="text" value={date} onChange={e => setDate(e.target.value)} /></td>
            </tr>
            <tr>
              <td className={pay.label}>收款方式:</td>
              <td>
                <select value={method} onChange={e => setMethod(e.target.value)}>
                  {PAY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </td>
              <td className={pay.label}>备注:</td>
              <td><input className={pay.notesInput} type="text" value={notes} onChange={e => setNotes(e.target.value)} /></td>
            </tr>
          </tbody>
        </table>

        <div className={styles.editFoot}>
          <input type="button" value={submitting ? '提交中...' : '确认收款'} disabled={submitting} onClick={handleSubmit} />
          &nbsp;
          <input type="button" value="取消" onClick={() => navigate('/payment')} />
        </div>

        <div className={styles.legend}>
          只有一张单时可以修改收款金额，少收款也算已收款；勾选多张单时每单按订单金额全额收款。
        </div>
      </div>
    </div>
  )
}
