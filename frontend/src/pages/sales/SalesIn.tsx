import { useEffect, useState, useCallback } from 'react'
import dayjs from 'dayjs'
import { getProducts, getProductCategories, type Product } from '@/api/products'
import { getSuppliers, type Supplier } from '@/api/suppliers'
import { getCustomers, type Customer } from '@/api/customers'
import { createSalesOrder, createSalesReturn, getSalesOrdersDetail, type SalesDetailRow } from '@/api/sales'
import { useAuth } from '@/store/AuthContext'
import { getErrorMessage } from '@/utils/error'
import { parseSlashDate } from '@/utils/slashDate'
import {
  SALES_DRAFT_KEY, newDraft, loadDraft, saveDraft, toDraftCustomer, calcPieces,
  type Draft, type DraftLine,
} from '@/utils/salesDraft'
import { SearchIcon } from '@/pages/master/SupplierIcons'
import SupplierPicker from '@/pages/purchase/SupplierPicker'
import styles from '@/pages/purchase/PurchaseIn.module.css'
import sales from './SalesIn.module.css'

type Kind = 'order' | 'return'

// 销售单录入 (xs_in.asp) vs 销售退货单录入 (th_in.asp) — same page, different wording/columns
const TEXT = {
  order: {
    doc: '销售单',
    priceHead: '单价',
    success: '销售单据已经成功保存!是否打印销售单?',
    printPath: '/print/sales/',
    draftKey: SALES_DRAFT_KEY,
  },
  return: {
    doc: '销售退货单',
    priceHead: '销售单价',
    success: '退货单据已经成功保存!是否打印退货单?',
    printPath: '/print/sales-return/',
    draftKey: 'flora.salesReturnDraft',
  },
} as const

// ─── Helpers ─────────────────────────────────────────────────
const num = (v: string) => (v === '' ? 0 : Number(v))
const fmt = (n: number) => String(+n.toFixed(2))
const lineAmount = (l: DraftLine) => num(l.qty) * num(l.unitPrice)
const DAY_OPTIONS = [
  { days: 1, label: '今天' },
  { days: 7, label: '7天' },
  { days: 15, label: '15天' },
  { days: 30, label: '30天' },
  { days: 0, label: '全部' },
]

const PAGE_SIZE = 25
const PAGE_WINDOW = 10
const HISTORY_ROWS = 20

interface RowInput {
  qty: string
  price: string
  notes: string
}

interface Props {
  kind?: Kind
}

// 销售单录入 — replicates old xs_in.asp (手工刷新库存 / 核对 / 开单时收款 / 送货时间 dropped)
// 销售退货单录入 — old th_in.asp: no day filter / 更换客户 / 库存 / 件数 / history
export default function SalesIn({ kind = 'order' }: Props) {
  const { user } = useAuth()
  const isReturn = kind === 'return'
  const T = TEXT[kind]

  // ── Data state ───────────────────────────────────────────────
  const [customers, setCustomers] = useState<Customer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [products, setProducts] = useState<Product[]>([])  // all products — any supplier's goods can be sold
  const [soldCodes, setSoldCodes] = useState<Set<string> | null>(null)  // null = 全部
  const [history, setHistory] = useState<SalesDetailRow[]>([])

  // ── Draft (right panel) ──────────────────────────────────────
  const [draft, setDraftState] = useState<Draft>(() => loadDraft(T.draftKey))
  const [saved, setSaved] = useState<{ id: number; no: string } | null>(null)
  const [saving, setSaving] = useState(false)

  // ── Filter state ─────────────────────────────────────────────
  const [sideSearch, setSideSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState<number | null>(null)
  const [searchText, setSearchText] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [days, setDays] = useState(0)
  const [page, setPage] = useState(1)
  const [rowInputs, setRowInputs] = useState<Record<number, RowInput>>({})

  // ── 请选择客户 overlay: 'select' starts a new order, 'change' keeps the lines ──
  const [picker, setPicker] = useState<'select' | 'change' | null>(null)

  const customer = draft.customer

  function setDraft(update: (d: Draft) => Draft) {
    setDraftState(d => {
      const next = update(d)
      saveDraft(T.draftKey, next)
      return next
    })
  }

  // ── Load data ────────────────────────────────────────────────
  const loadProducts = useCallback(() => {
    getProducts().then(setProducts).catch(err => alert(getErrorMessage(err)))
  }, [])

  useEffect(() => {
    Promise.all([getCustomers(), getSuppliers(), getProductCategories()])
      .then(([custs, supps, cats]) => { setCustomers(custs); setSuppliers(supps); setCategories(cats) })
      .catch(err => alert(getErrorMessage(err)))
    loadProducts()
  }, [loadProducts])

  // 今天 / 7天 / 15天 / 30天: products sold (to anyone) within the period
  useEffect(() => {
    if (days === 0) { setSoldCodes(null); return }
    getSalesOrdersDetail({ startDate: dayjs().subtract(days - 1, 'day').format('YYYY-MM-DD') })
      .then(rows => setSoldCodes(new Set(rows.filter(r => r.rowType === 'order').map(r => r.productCode))))
      .catch(err => alert(getErrorMessage(err)))
  }, [days])

  // 历史单据明细: this customer's latest 20 sold item rows
  const customerCode = customer?.code ?? null
  const loadHistory = useCallback(() => {
    if (isReturn || customerCode == null) { setHistory([]); return }
    getSalesOrdersDetail({ search: customerCode, searchField: 'customerCode' })
      .then(rows => setHistory(rows
        .filter(r => r.rowType === 'order' && r.customerCode === customerCode)
        .slice(0, HISTORY_ROWS)))
      .catch(() => setHistory([]))
  }, [isReturn, customerCode])

  useEffect(() => { loadHistory() }, [loadHistory])

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1) }, [supplierFilter, catFilter, appliedSearch, days])

  // ── Derived ──────────────────────────────────────────────────
  const productsByCode = Object.fromEntries(products.map(p => [p.code, p]))
  const addedIds = new Set(draft.lines.map(l => l.productId))

  const visibleSuppliers = suppliers.filter(s =>
    sideSearch === '' ||
    s.code.toLowerCase().includes(sideSearch.toLowerCase()) ||
    s.name.toLowerCase().includes(sideSearch.toLowerCase())
  )

  const filtered = products.filter(p => {
    if (supplierFilter != null && p.supplierId !== supplierFilter) return false
    if (catFilter && p.category !== catFilter) return false
    if (soldCodes && !soldCodes.has(p.code)) return false
    if (!appliedSearch) return true
    const q = appliedSearch.toLowerCase()
    return p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || (p.spec ?? '').toLowerCase().includes(q)
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const windowStart = Math.floor((page - 1) / PAGE_WINDOW) * PAGE_WINDOW + 1
  const windowEnd = Math.min(windowStart + PAGE_WINDOW - 1, totalPages)

  const totalQty = draft.lines.reduce((s, l) => s + num(l.qty), 0)
  const totalAmount = draft.lines.reduce((s, l) => s + lineAmount(l), 0)
  const totalPieces = draft.lines.reduce((s, l) => s + num(l.pieces), 0)

  // ── Customer selection ───────────────────────────────────────
  // 选择客户: start a new, empty order for this customer
  function selectCustomer(c: Customer) {
    if (draft.lines.length > 0 && draft.customer?.id !== c.id &&
        !window.confirm(`${T.doc}中已有产品，选择新客户将清空当前${T.doc}，确定吗？`)) return
    if (draft.customer?.id !== c.id) setDraft(() => newDraft(toDraftCustomer(c)))
    setSaved(null)
  }

  // 更换客户: keep the lines, switch the customer
  function changeCustomer(c: Customer) {
    setDraft(d => ({ ...d, customer: toDraftCustomer(c) }))
  }

  // ── Left table: 加入 ─────────────────────────────────────────
  function rowInput(p: Product): RowInput {
    return rowInputs[p.id] ?? { qty: '', price: p.price != null ? p.price.toFixed(2) : '', notes: '' }
  }

  function setRowInput(p: Product, patch: Partial<RowInput>) {
    setRowInputs(r => ({ ...r, [p.id]: { ...rowInput(p), ...patch } }))
  }

  function handleAdd(p: Product) {
    if (!customer) { alert('请先选择客户'); return }
    const input = rowInput(p)
    if (num(input.qty) <= 0) { alert('请输入数量'); return }
    if (input.price === '' || isNaN(Number(input.price))) { alert('请输入单价'); return }
    setDraft(d => ({
      ...d,
      lines: [...d.lines, {
        key: `${p.id}-${Date.now()}`,
        productId: p.id,
        supplierId: p.supplierId,
        costPrice: p.costPrice ?? null,
        code: p.code,
        name: p.name,
        spec: p.spec ?? '',
        grade: p.grade ?? '',
        unit: p.unit ?? '',
        unitsPerPiece: p.unitsPerPiece ?? null,
        qty: input.qty,
        unitPrice: input.price,
        pieces: calcPieces(input.qty, p.unitsPerPiece ?? null),
        notes: input.notes,
        checked: false,
      }],
    }))
    setRowInput(p, { qty: '', notes: '' })
    setSaved(null)
  }

  // ── Right panel: edit lines ──────────────────────────────────
  function setLine(key: string, patch: Partial<DraftLine>) {
    setDraft(d => ({ ...d, lines: d.lines.map(l => (l.key === key ? { ...l, ...patch } : l)) }))
  }

  function handleDeleteChecked() {
    if (!draft.lines.some(l => l.checked)) { alert('请先勾选要删除的产品'); return }
    setDraft(d => ({ ...d, lines: d.lines.filter(l => !l.checked) }))
  }

  async function handleSave() {
    if (saving) return
    if (!draft.customer) { alert('请先选择客户'); return }
    if (draft.lines.length === 0) { alert(`${T.doc}中没有产品`); return }
    if (draft.lines.some(l => num(l.qty) <= 0)) { alert('数量必须大于0'); return }
    if (draft.lines.some(l => l.unitPrice === '' || isNaN(Number(l.unitPrice)))) { alert('请输入单价'); return }
    const date = parseSlashDate(draft.orderDate)
    if (!date) { alert('开单日期格式不正确，例如 2026/10/1'); return }

    const notes = draft.notes.trim() || undefined
    setSaving(true)
    try {
      if (isReturn) {
        const ret = await createSalesReturn({
          customerId: draft.customer.id,
          returnDate: date,
          notes,
          items: draft.lines.map(l => ({
            productId: l.productId,
            qty: num(l.qty),
            pieces: num(l.pieces),
            unitPrice: num(l.unitPrice),
            notes: l.notes.trim() || undefined,
          })),
        })
        setSaved({ id: ret.id, no: ret.returnNo })
      } else {
        const order = await createSalesOrder({
          customerId: draft.customer.id,
          orderDate: date,
          notes,
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
        setSaved({ id: order.id, no: order.orderNo })
      }
      setDraft(d => newDraft(d.customer))
      loadProducts()   // refresh stock
      loadHistory()
    } catch (err) {
      alert(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ── Sub-toolbar ── */}
      <div className={styles.subbar}>
        <SearchIcon />查找产品
        <input
          className={styles.searchInput}
          type="text"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && setAppliedSearch(searchText.trim())}
        />
        <input type="button" value="查找" onClick={() => setAppliedSearch(searchText.trim())} />
        <span className={styles.btnPickSupp} onClick={() => setPicker('select')}>
          <span className={styles.listIcon}>☰</span>选择客户
        </span>
        {!isReturn && DAY_OPTIONS.map(o => (
          <label key={o.days}>
            <input className={styles.dayCheck} type="checkbox" checked={days === o.days} onChange={() => setDays(o.days)} />
            {o.label}
          </label>
        ))}
        {!isReturn && (
          <span className={`${styles.btnPickSupp} ${sales.pushRight}`} onClick={() => setPicker('change')}>
            <span className={styles.listIcon}>☰</span>更换客户
          </span>
        )}
      </div>

      <div className={styles.layout}>

        {/* ══ LEFT SIDEBAR: categories + suppliers (filters) ═════ */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            &nbsp;分类
            <input className={styles.sideSearch} type="text" value={sideSearch} onChange={e => setSideSearch(e.target.value)} />
            <input type="button" value="查找" />
          </div>
          <div className={styles.catList}>
            {categories.map(c => (
              <a
                key={c}
                className={`${styles.catItem} ${catFilter === c ? styles.active : ''}`}
                onClick={() => setCatFilter(catFilter === c ? '' : c)}
              >
                <span className={styles.catArrow}>➡</span>{c}
              </a>
            ))}
          </div>
          <div className={styles.suppCols}>
            {visibleSuppliers.map(s => (
              <a
                key={s.id}
                title={`${s.code} ${s.name}`}
                className={`${styles.suppItem} ${s.id === supplierFilter ? styles.active : ''}`}
                onClick={() => setSupplierFilter(supplierFilter === s.id ? null : s.id)}
              >
                {s.code.slice(0, 4)}
              </a>
            ))}
          </div>
        </div>

        {/* ══ MIDDLE: products ═══════════════════════════════════ */}
        <div className={styles.mainCol}>
          <table className={styles.prodTable}>
            <thead>
              <tr>
                <th>&nbsp;供应商&nbsp;</th>
                <th>&nbsp;编码&nbsp;</th>
                <th>&nbsp;品名&nbsp;&nbsp;规格&nbsp;&nbsp;等级&nbsp;</th>
                <th>&nbsp;包装&nbsp;</th>
                <th>&nbsp;单位&nbsp;</th>
                {!isReturn && <th>&nbsp;库存&nbsp;</th>}
                <th>数量</th>
                <th>{T.priceHead}</th>
                <th></th>
                {isReturn && <th>备注</th>}
              </tr>
            </thead>
            <tbody>
              {paged.map(p => {
                const input = rowInput(p)
                return (
                  <tr key={p.id} className={isReturn ? '' : `${sales.hoverRow} ${addedIds.has(p.id) ? sales.added : ''}`}>
                    <td>&nbsp;{p.supplierCode}&nbsp;</td>
                    <td>&nbsp;{p.code}&nbsp;</td>
                    <td>&nbsp;{p.name}&nbsp;<em className={styles.spec}>{p.spec ?? ''}</em>&nbsp;{p.grade ?? ''}&nbsp;</td>
                    <td>&nbsp;{p.unitsPerPiece ?? ''}&nbsp;</td>
                    <td>&nbsp;{p.unit ?? ''}&nbsp;</td>
                    {!isReturn && <td className={styles.stock}>&nbsp;{p.stock}&nbsp;</td>}
                    <td>
                      <input
                        className={styles.qtyInput}
                        type="text"
                        value={input.qty}
                        onChange={e => setRowInput(p, { qty: e.target.value.replace(/\D/g, '') })}
                        onKeyDown={e => e.key === 'Enter' && handleAdd(p)}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.priceInput}
                        type="text"
                        value={input.price}
                        onFocus={e => e.target.select()}
                        onChange={e => setRowInput(p, { price: e.target.value.replace(/[^\d.]/g, '') })}
                        onKeyDown={e => e.key === 'Enter' && handleAdd(p)}
                      />
                    </td>
                    <td><input type="button" value="加入" onClick={() => handleAdd(p)} /></td>
                    {isReturn && (
                      <td>
                        <input
                          className={styles.noteInput}
                          type="text"
                          value={input.notes}
                          onChange={e => setRowInput(p, { notes: e.target.value })}
                          onKeyDown={e => e.key === 'Enter' && handleAdd(p)}
                        />
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>

          <table className={styles.pager}>
            <tbody>
              <tr>
                <td className={styles.pagerTotal}>&nbsp;总{filtered.length}个,共{totalPages}页&nbsp;</td>
                <td>&nbsp;</td>
                {page > 1 && <td>&nbsp;<a onClick={() => setPage(page - 1)}>上一页</a>&nbsp;</td>}
                {Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => windowStart + i).map(n => (
                  <td key={n} className={`${styles.pageNum} ${n === page ? styles.pageActive : ''}`}>
                    <a onClick={() => setPage(n)}>{n}</a>
                  </td>
                ))}
                {page < totalPages && <td>&nbsp;<a onClick={() => setPage(page + 1)}>下一页</a>&nbsp;</td>}
              </tr>
            </tbody>
          </table>
          {!isReturn && <div className={sales.hint}>提示：橙色背景的产品表示已经加入到销售单中了。</div>}
        </div>

        <div className={styles.gapCol}>«</div>

        {/* ══ RIGHT: 销售单 + 历史单据明细 ═══════════════════════ */}
        <div className={styles.orderCol}>
          {saved && draft.lines.length === 0 ? (
            <div className={styles.success}>
              <div className={styles.successMsg}>{T.success}</div>
              <a className={styles.printLink} onClick={() => window.open(`${T.printPath}${saved.id}`, '_blank')}>
                {saved.no}
              </a>
            </div>
          ) : (
            <>
              <div className={styles.orderTitle}>
                <span className={styles.orderTitleBig}>{T.doc}</span>
                {customer ? `(${customer.code}　${customer.name})` : '(　　)'}
              </div>
              <table className={styles.orderTable}>
                <thead>
                  <tr>
                    <th><span className={styles.delAll} title="删除勾选的产品" onClick={handleDeleteChecked}>×</span></th>
                    <th>编码</th>
                    <th>品名 规格 等级</th>
                    <th>单位</th>
                    <th>数量</th>
                    <th>单价</th>
                    <th>金额</th>
                    {!isReturn && <th>件数</th>}
                    <th>备注</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.lines.length === 0 && (
                    <tr className={styles.noRecord}><td colSpan={isReturn ? 8 : 9}>无记录!</td></tr>
                  )}
                  {draft.lines.map(l => (
                    <tr key={l.key}>
                      <td>
                        <input type="checkbox" checked={l.checked} onChange={e => setLine(l.key, { checked: e.target.checked })} />
                      </td>
                      <td>{l.code}</td>
                      <td className={styles.wrapName}>{l.name} {l.spec} {l.grade}</td>
                      <td className={styles.num}>{l.unit}</td>
                      <td>
                        <input className={styles.lineQty} type="text" value={l.qty}
                          onChange={e => {
                            const qty = e.target.value.replace(/\D/g, '')
                            setLine(l.key, { qty, pieces: calcPieces(qty, l.unitsPerPiece ?? null) })
                          }} />
                      </td>
                      <td>
                        <input className={styles.linePrice} type="text" value={l.unitPrice}
                          onChange={e => setLine(l.key, { unitPrice: e.target.value.replace(/[^\d.]/g, '') })} />
                      </td>
                      <td className={styles.num}>{fmt(lineAmount(l))}</td>
                      {!isReturn && (
                        <td>
                          <input className={styles.linePieces} type="text" value={l.pieces}
                            onChange={e => setLine(l.key, { pieces: e.target.value.replace(/\D/g, '') })} />
                        </td>
                      )}
                      <td>
                        <input className={styles.lineNotes} type="text" value={l.notes}
                          onChange={e => setLine(l.key, { notes: e.target.value })} />
                      </td>
                    </tr>
                  ))}
                  {draft.lines.length > 0 && (
                    <tr className={styles.sumRow}>
                      <td colSpan={4} style={{ textAlign: 'right' }}>合计&nbsp;&nbsp;</td>
                      <td className={styles.pinkNum}>{fmt(totalQty)}</td>
                      <td></td>
                      <td className={styles.pinkNum}>{fmt(totalAmount)}</td>
                      {!isReturn && <td className={styles.pinkNum}>{fmt(totalPieces)}</td>}
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>

              {draft.lines.length > 0 && customer && (
                <>
                  {/* 老板贵姓 / 送货地址 / 合计件数 — from the customer record and lines, not saved */}
                  {!isReturn && <div className={sales.orangeArea}>
                    <div className={sales.orangeRow}>
                      老板贵姓
                      <input className={sales.bossInput} type="text" value={customer.name} readOnly />
                    </div>
                    <div className={sales.orangeRow}>
                      送货地址
                      <input className={sales.addrInput} type="text" value={customer.address} readOnly />
                    </div>
                    <div className={sales.orangeRow}>
                      合计件数
                      <input className={sales.piecesInput} type="text" value={fmt(totalPieces)} readOnly />
                    </div>
                  </div>}
                  <div className={styles.pinkArea}>
                    <div className={styles.pinkRow}>
                      开单日期
                      <input
                        className={styles.dateInput}
                        type="text"
                        value={draft.orderDate}
                        onChange={e => setDraft(d => ({ ...d, orderDate: e.target.value }))}
                      />
                      &nbsp;&nbsp;经办人
                      <input className={styles.operatorInput} type="text" value={user?.name ?? ''} readOnly />
                    </div>
                    <textarea
                      className={styles.notesArea}
                      value={draft.notes}
                      onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                    />
                    <div className={styles.saveRow}>
                      <span className={styles.imgBtn} aria-disabled={saving} onClick={handleSave}>
                        {saving ? '保存中...' : '保存单据'}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {!isReturn && customer && (
            <>
              <div className={sales.histCaption}>
                {customer.code}　{customer.name}　历史单据明细(只显示{HISTORY_ROWS}笔)
              </div>
              <table className={sales.histTable}>
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>编码</th>
                    <th>品名&nbsp;&nbsp;规格&nbsp;&nbsp;等级</th>
                    <th>单位</th>
                    <th>数量</th>
                    <th>单价</th>
                    <th>金额</th>
                    <th>件数</th>
                    <th>备注</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => {
                    const p = productsByCode[h.productCode]
                    return (
                      <tr key={`${h.id}-${i}`}>
                        <td>{dayjs(h.date).format('M.D')}</td>
                        <td>{h.productCode}</td>
                        <td className={sales.left}>{h.productName}　{p?.spec ?? ''}{p?.grade ?? ''}</td>
                        <td>{h.unit}</td>
                        <td>{fmt(h.qty)}</td>
                        <td>{fmt(h.unitPrice)}</td>
                        <td>{fmt(h.amount)}</td>
                        <td>{h.pieces || ''}</td>
                        <td className={sales.left}>{h.notes ?? ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {/* ══ 请选择客户 overlay ════════════════════════════════════ */}
      {picker && (
        <SupplierPicker
          suppliers={customers}
          title="请选择客户"
          searchLabel="查找客户"
          onSelect={picker === 'select' ? selectCustomer : changeCustomer}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  )
}
