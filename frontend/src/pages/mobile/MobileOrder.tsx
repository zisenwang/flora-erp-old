import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { getProducts, type Product } from '@/api/products'
import { createSalesOrder, getSalesOrdersDetail, type SalesDetailRow } from '@/api/sales'
import { useAuth } from '@/store/AuthContext'
import { getErrorMessage } from '@/utils/error'
import { parseSlashDate } from '@/utils/slashDate'
import { newDraft, calcPieces, type DraftLine } from '@/utils/salesDraft'
import { MOBILE_SALES, useSalesDraft } from './MobileShell'
import desk from '@/pages/purchase/PurchaseIn.module.css'
import styles from './Mobile.module.css'

const num = (v: string) => (v === '' ? 0 : Number(v))
const fmt = (n: number) => String(+n.toFixed(2))
const lineAmount = (l: DraftLine) => num(l.qty) * num(l.unitPrice)
const HISTORY_ROWS = 20

// 手机开单 — page 5 (mxs_list.asp): 销售出库单 → 保存单据, then back to page 1 (核对 dropped)
export default function MobileOrder() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { draft, setDraft } = useSalesDraft()
  const [products, setProducts] = useState<Product[]>([])
  const [history, setHistory] = useState<SalesDetailRow[]>([])
  const [saving, setSaving] = useState(false)
  const customer = draft.customer

  useEffect(() => {
    getProducts().then(setProducts).catch(() => setProducts([]))
  }, [])

  // 历史单据明细: this customer's latest 20 sold item rows
  const customerCode = customer?.code ?? null
  const loadHistory = useCallback(() => {
    if (customerCode == null) { setHistory([]); return }
    getSalesOrdersDetail({ search: customerCode, searchField: 'customerCode' })
      .then(rows => setHistory(rows
        .filter(r => r.rowType === 'order' && r.customerCode === customerCode)
        .slice(0, HISTORY_ROWS)))
      .catch(() => setHistory([]))
  }, [customerCode])

  useEffect(() => { loadHistory() }, [loadHistory])

  const productsById = Object.fromEntries(products.map(p => [p.id, p]))
  const productsByCode = Object.fromEntries(products.map(p => [p.code, p]))
  const totalQty = draft.lines.reduce((s, l) => s + num(l.qty), 0)
  const totalAmount = draft.lines.reduce((s, l) => s + lineAmount(l), 0)
  const totalPieces = draft.lines.reduce((s, l) => s + num(l.pieces), 0)

  function setLine(key: string, patch: Partial<DraftLine>) {
    setDraft(d => ({ ...d, lines: d.lines.map(l => (l.key === key ? { ...l, ...patch } : l)) }))
  }

  function deleteLine(key: string) {
    setDraft(d => ({ ...d, lines: d.lines.filter(l => l.key !== key) }))
  }

  async function handleSave() {
    if (saving) return
    if (!customer) { alert('请先选择客户'); return }
    if (draft.lines.length === 0) { alert('销售单中没有产品'); return }
    if (draft.lines.some(l => num(l.qty) <= 0)) { alert('数量必须大于0'); return }
    if (draft.lines.some(l => l.unitPrice === '' || isNaN(Number(l.unitPrice)))) { alert('请输入单价'); return }
    const date = parseSlashDate(draft.orderDate)
    if (!date) { alert('开单日期格式不正确，例如 2026/10/1'); return }
    if (!window.confirm('此操作将直接保存数据,而且不可恢复!真的要进行吗?')) return

    setSaving(true)
    try {
      const order = await createSalesOrder({
        customerId: customer.id,
        orderDate: date,
        notes: draft.notes.trim() || undefined,
        items: draft.lines.map(l => ({
          productId: l.productId,
          supplierId: l.supplierId,
          qty: num(l.qty),
          unitPrice: num(l.unitPrice),
          discount: 100,
          pieces: num(l.pieces),
          notes: l.notes.trim() || undefined,
          costPrice: l.costPrice,
        })),
      })
      setDraft(() => newDraft())
      alert(`销售单据已经成功保存!单号:${order.orderNo}`)
      navigate(MOBILE_SALES, { replace: true })
    } catch (err) {
      alert(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.orderHead}>销售出库单</div>
      <div className={styles.orderCust}>
        &nbsp;客户:{customer ? <>{customer.code}&nbsp;{customer.name}</> : '（未选客户）'}
      </div>

      <div className={styles.scrollX}>
        <table className={styles.orderTable}>
          <thead>
            <tr>
              <th>&nbsp;编码&nbsp;</th>
              <th className={styles.left}>&nbsp;品名&nbsp;规格&nbsp;等级&nbsp;</th>
              <th>&nbsp;数量&nbsp;</th>
              <th>&nbsp;单价&nbsp;</th>
              <th>&nbsp;金额&nbsp;</th>
              <th>&nbsp;件数&nbsp;</th>
              <th title="删除">×</th>
              <th>备注&nbsp;&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {draft.lines.length === 0 && (
              <tr><td colSpan={8} className={styles.noRecord}>无记录!</td></tr>
            )}
            {draft.lines.map(l => {
              const stock = productsById[l.productId]?.stock
              const short = stock != null && num(l.qty) > stock   // 库存不足 → red row
              return (
                <tr key={l.key} className={short ? styles.shortRow : ''}>
                  <td>{l.code}</td>
                  <td className={styles.left}>&nbsp;{l.name}&nbsp;<em>{l.spec}</em>&nbsp;{l.grade}&nbsp;</td>
                  <td className={styles.nowrap}>
                    <input className={styles.cellIn} type="tel" value={l.qty}
                      onChange={e => {
                        const qty = e.target.value.replace(/\D/g, '')
                        setLine(l.key, { qty, pieces: calcPieces(qty, l.unitsPerPiece) })
                      }} />{l.unit}
                  </td>
                  <td>
                    <input className={styles.cellIn} type="tel" value={l.unitPrice}
                      onChange={e => setLine(l.key, { unitPrice: e.target.value.replace(/[^\d.]/g, '') })} />
                  </td>
                  <td>{fmt(lineAmount(l))}</td>
                  <td>
                    <input className={styles.cellIn} type="tel" value={l.pieces}
                      onChange={e => setLine(l.key, { pieces: e.target.value.replace(/\D/g, '') })} />
                  </td>
                  <td><input type="checkbox" checked={false} onChange={() => deleteLine(l.key)} /></td>
                  <td>
                    <input className={styles.cellNotes} type="text" value={l.notes}
                      onChange={e => setLine(l.key, { notes: e.target.value })} />
                  </td>
                </tr>
              )
            })}
            {draft.lines.length > 0 && (
              <tr>
                <td colSpan={2} className={styles.right}>合计</td>
                <td className={styles.pink}>{fmt(totalQty)}</td>
                <td></td>
                <td className={styles.pink}>{fmt(totalAmount)}</td>
                <td className={styles.pink}>{fmt(totalPieces)}</td>
                <td></td>
                <td></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.yellowLine} />
      <div className={styles.orderForm}>
        &nbsp;开单日期
        <input className={styles.dateIn} type="text" value={draft.orderDate}
          onChange={e => setDraft(d => ({ ...d, orderDate: e.target.value }))} />
        &nbsp;&nbsp;经办人
        <input className={styles.operatorIn} type="text" value={user?.name ?? ''} readOnly />
      </div>
      <div className={styles.orderForm}>
        <textarea className={styles.notesArea} rows={4} value={draft.notes}
          onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
      </div>
      <div className={styles.orderForm}>
        <span className={desk.imgBtn} aria-disabled={saving} onClick={handleSave}>
          {saving ? '保存中...' : '保存单据'}
        </span>
      </div>
      <div className={styles.yellowLine} />

      {customer && (
        <>
          <div className={styles.histCaption}>
            {customer.code}&nbsp;{customer.name}&nbsp;历史单据明细(只显示{HISTORY_ROWS}笔)
          </div>
          <div className={styles.scrollX}>
            <table className={styles.histTable}>
              <thead>
                <tr>
                  <th>&nbsp;日期&nbsp;</th>
                  <th>&nbsp;编码&nbsp;</th>
                  <th className={styles.left}>&nbsp;品名&nbsp;规格&nbsp;等级&nbsp;</th>
                  <th>&nbsp;单位&nbsp;</th>
                  <th>&nbsp;数量&nbsp;</th>
                  <th>&nbsp;单价&nbsp;</th>
                  <th>&nbsp;金额&nbsp;</th>
                  <th>&nbsp;件数&nbsp;</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => {
                  const p = productsByCode[h.productCode]
                  return (
                    <tr key={`${h.id}-${i}`}>
                      <td>&nbsp;{dayjs(h.date).format('M.D')}&nbsp;</td>
                      <td>{h.productCode}</td>
                      <td className={styles.left}>&nbsp;{h.productName}&nbsp;{p?.spec ?? ''}&nbsp;{p?.grade ?? ''}</td>
                      <td>{h.unit}</td>
                      <td>{fmt(h.qty)}</td>
                      <td>{fmt(h.unitPrice)}</td>
                      <td>{fmt(h.amount)}</td>
                      <td>{h.pieces || 0}</td>
                      <td>{h.notes ?? ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
