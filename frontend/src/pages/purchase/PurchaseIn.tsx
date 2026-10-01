import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { getProducts, getProductCategories, type Product } from '@/api/products'
import { getSuppliers, type Supplier } from '@/api/suppliers'
import { createPurchaseOrder, createPurchaseReturn, getPurchaseOrdersDetail } from '@/api/purchase'
import { useAuth } from '@/store/AuthContext'
import { getErrorMessage } from '@/utils/error'
import { SearchIcon } from '@/pages/master/SupplierIcons'
import { parseSlashDate, toSlashDate } from '@/utils/slashDate'
import SupplierPicker from './SupplierPicker'
import styles from './PurchaseIn.module.css'

// ─── Unsaved 进货单 / 退货单 kept in localStorage (old system kept it server-side) ──
interface DraftSupplier {
  id: number
  code: string
  name: string
}

interface DraftLine {
  key: string
  productId: number
  code: string
  name: string
  spec: string
  grade: string
  unit: string
  unitsPerPiece: number | null
  qty: string
  unitPrice: string
  discount: number
  pieces: string
  notes: string
  checked: boolean
}

interface Draft {
  supplier: DraftSupplier | null
  lines: DraftLine[]
  discountRate: string
  orderDate: string
  notes: string
}

type Kind = 'order' | 'return'

// 进货单录入 (buy_in.asp) vs 进货退回 (buy_out.asp) — same page, different wording/columns
const TEXT = {
  order: {
    doc: '进货单',
    qtyHead: '进货数量',
    dateLabel: '开单日期',
    operatorLabel: '经办人',
    success: '进货单据已经成功保存!是否打印进货单?',
    printPath: '/print/purchase/',
    draftKey: 'flora.purchaseDraft',
  },
  return: {
    doc: '退货单',
    qtyHead: '数量',
    dateLabel: '日期:',
    operatorLabel: '经办人:',
    success: '退货单据已经成功保存!是否打印退货单?',
    printPath: '/print/purchase-return/',
    draftKey: 'flora.purchaseReturnDraft',
  },
} as const

const newDraft = (supplier: DraftSupplier | null = null): Draft => ({
  supplier,
  lines: [],
  discountRate: '100',
  orderDate: toSlashDate(),
  notes: '',
})

function loadDraft(key: string): Draft {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return { ...newDraft(), ...JSON.parse(raw) }
  } catch { /* storage unavailable — start empty */ }
  return newDraft()
}

function saveDraft(key: string, draft: Draft) {
  try { localStorage.setItem(key, JSON.stringify(draft)) } catch { /* ignore */ }
}

// ─── Helpers ─────────────────────────────────────────────────
const num = (v: string) => (v === '' ? 0 : Number(v))
const fmt = (n: number) => String(+n.toFixed(2))
// 折扣率 text → line discount (falls back to 100 while the box is empty / invalid)
const rateOf = (text: string) => {
  const r = Number(text)
  return text === '' || isNaN(r) || r < 0 || r > 100 ? 100 : r
}
const lineAmount = (l: DraftLine) => num(l.qty) * num(l.unitPrice)
const lineFinal = (l: DraftLine) => (lineAmount(l) * l.discount) / 100
// 件数 = ceil(数量 / 包装), same as new system; 0 when product has no 包装
const calcPieces = (qty: string, unitsPerPiece: number | null) =>
  unitsPerPiece && num(qty) > 0 ? String(Math.ceil(num(qty) / unitsPerPiece)) : '0'

const DAY_OPTIONS = [
  { days: 1, label: '今天' },
  { days: 7, label: '7天' },
  { days: 15, label: '15天' },
  { days: 30, label: '30天' },
  { days: 0, label: '全部' },
]

const PAGE_SIZE = 25
const PAGE_WINDOW = 10

interface RowInput {
  qty: string
  price: string
  notes: string
}

interface Props {
  kind?: Kind
}

// 进货单录入 / 进货退回 — replicates old buy_in.asp and buy_out.asp
export default function PurchaseIn({ kind = 'order' }: Props) {
  const { user } = useAuth()
  const isReturn = kind === 'return'
  const T = TEXT[kind]

  // ── Data state ───────────────────────────────────────────────
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [products, setProducts] = useState<Product[]>([])  // selected supplier's products
  const [recentCodes, setRecentCodes] = useState<Set<string> | null>(null)  // null = 全部

  // ── Draft (right panel) ──────────────────────────────────────
  const [draft, setDraftState] = useState<Draft>(() => loadDraft(T.draftKey))
  const [saved, setSaved] = useState<{ id: number; no: string } | null>(null)
  const [saving, setSaving] = useState(false)

  // ── Filter state ─────────────────────────────────────────────
  const [sideSearch, setSideSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [searchText, setSearchText] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [days, setDays] = useState(0)
  const [page, setPage] = useState(1)
  const [rowInputs, setRowInputs] = useState<Record<number, RowInput>>({})

  // ── 选择供应商 overlay ───────────────────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false)

  const supplier = draft.supplier

  function setDraft(update: (d: Draft) => Draft) {
    setDraftState(d => {
      const next = update(d)
      saveDraft(T.draftKey, next)
      return next
    })
  }

  // ── Load data ────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([getSuppliers(), getProductCategories()])
      .then(([supps, cats]) => { setSuppliers(supps); setCategories(cats) })
      .catch(err => alert(getErrorMessage(err)))
  }, [])

  const supplierId = supplier?.id ?? null
  useEffect(() => {
    if (supplierId == null) { setProducts([]); return }
    getProducts({ supplierId })
      .then(setProducts)
      .catch(err => alert(getErrorMessage(err)))
  }, [supplierId])

  // 今天 / 7天 / 15天 / 30天: products of this supplier purchased within the period
  const supplierCode = supplier?.code ?? null
  useEffect(() => {
    if (isReturn || supplierCode == null || days === 0) { setRecentCodes(null); return }
    getPurchaseOrdersDetail({
      startDate: dayjs().subtract(days - 1, 'day').format('YYYY-MM-DD'),
      search: supplierCode,
      searchField: 'supplierCode',
    })
      .then(rows => setRecentCodes(new Set(
        rows.filter(r => r.rowType === 'order' && r.supplierCode === supplierCode).map(r => r.productCode),
      )))
      .catch(err => alert(getErrorMessage(err)))
  }, [isReturn, supplierCode, days])

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1) }, [supplierId, catFilter, appliedSearch, days])

  // ── Derived ──────────────────────────────────────────────────
  const visibleSuppliers = suppliers.filter(s =>
    sideSearch === '' ||
    s.code.toLowerCase().includes(sideSearch.toLowerCase()) ||
    s.name.toLowerCase().includes(sideSearch.toLowerCase())
  )

  const filtered = products.filter(p => {
    if (catFilter && p.category !== catFilter) return false
    if (recentCodes && !recentCodes.has(p.code)) return false
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
  const totalFinal = draft.lines.reduce((s, l) => s + lineFinal(l), 0)
  const totalPieces = draft.lines.reduce((s, l) => s + num(l.pieces), 0)

  // ── Supplier selection (left panel or overlay) ───────────────
  function selectSupplier(s: Supplier) {
    if (draft.supplier?.id === s.id) return
    if (draft.lines.length > 0 &&
        !window.confirm(`${T.doc}中已有 ${draft.supplier?.code ?? ''} 的产品，切换供应商将清空当前${T.doc}，确定吗？`)) return
    setDraft(() => newDraft({ id: s.id, code: s.code, name: s.name }))
    setSaved(null)
    setRowInputs({})
    setCatFilter('')
  }

  // ── Left table: 加入 ─────────────────────────────────────────
  function rowInput(p: Product): RowInput {
    return rowInputs[p.id] ?? { qty: '', price: p.costPrice != null ? p.costPrice.toFixed(1) : '', notes: '' }
  }

  function setRowInput(p: Product, patch: Partial<RowInput>) {
    setRowInputs(r => ({ ...r, [p.id]: { ...rowInput(p), ...patch } }))
  }

  function handleAdd(p: Product) {
    const input = rowInput(p)
    if (num(input.qty) <= 0) { alert(`请输入${T.qtyHead}`); return }
    if (input.price === '' || isNaN(Number(input.price))) { alert('请输入进货单价'); return }
    setDraft(d => ({
      ...d,
      lines: [...d.lines, {
        key: `${p.id}-${Date.now()}`,
        productId: p.id,
        code: p.code,
        name: p.name,
        spec: p.spec ?? '',
        grade: p.grade ?? '',
        unit: p.unit ?? '',
        unitsPerPiece: p.unitsPerPiece ?? null,
        qty: input.qty,
        unitPrice: input.price,
        discount: isReturn ? 100 : rateOf(d.discountRate),
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

  // 折扣率 applies to every line in the order
  function handleRateChange(text: string) {
    const value = text.replace(/[^\d.]/g, '')
    setDraft(d => ({ ...d, discountRate: value, lines: d.lines.map(l => ({ ...l, discount: rateOf(value) })) }))
  }

  async function handleSave() {
    if (saving) return
    if (!draft.supplier) { alert('请选择供应商'); return }
    if (draft.lines.length === 0) { alert(`${T.doc}中没有产品`); return }
    if (draft.lines.some(l => num(l.qty) <= 0)) { alert(`${T.qtyHead}必须大于0`); return }
    if (draft.lines.some(l => l.unitPrice === '' || isNaN(Number(l.unitPrice)))) { alert('请输入进货单价'); return }
    const rate = Number(draft.discountRate)
    if (!isReturn && (draft.discountRate === '' || isNaN(rate) || rate < 0 || rate > 100)) { alert('请输入0-100之间的折扣率'); return }
    const date = parseSlashDate(draft.orderDate)
    if (!date) { alert('日期格式不正确，例如 2026/10/1'); return }

    const items = draft.lines.map(l => ({
      productId: l.productId,
      qty: num(l.qty),
      pieces: num(l.pieces),
      unitPrice: num(l.unitPrice),
      notes: l.notes.trim() || undefined,
    }))
    const notes = draft.notes.trim() || undefined

    setSaving(true)
    try {
      if (isReturn) {
        const ret = await createPurchaseReturn({ supplierId: draft.supplier.id, returnDate: date, notes, items })
        setSaved({ id: ret.id, no: ret.returnNo })
      } else {
        const order = await createPurchaseOrder({
          supplierId: draft.supplier.id,
          orderDate: date,
          notes,
          items: items.map((it, i) => ({ ...it, discount: draft.lines[i].discount })),
        })
        setSaved({ id: order.id, no: order.orderNo })
      }
      setDraft(d => newDraft(d.supplier))
      // refresh stock numbers in the left table
      getProducts({ supplierId: draft.supplier.id }).then(setProducts).catch(() => {})
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
        <span className={styles.btnPickSupp} onClick={() => setPickerOpen(true)}>
          <span className={styles.listIcon}>☰</span>选择供应商
        </span>
        {!isReturn && DAY_OPTIONS.map(o => (
          <label key={o.days}>
            <input className={styles.dayCheck} type="checkbox" checked={days === o.days} onChange={() => setDays(o.days)} />
            {o.label}
          </label>
        ))}
      </div>

      <div className={styles.layout}>

        {/* ══ LEFT SIDEBAR: categories + suppliers ════════════════ */}
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
                className={`${styles.suppItem} ${s.id === supplierId ? styles.active : ''}`}
                onClick={() => selectSupplier(s)}
              >
                {s.code.slice(0, 4)}
              </a>
            ))}
          </div>
        </div>

        {/* ══ MIDDLE: products of the selected supplier ══════════ */}
        <div className={styles.mainCol}>
          <table className={styles.prodTable}>
            <thead>
              <tr>
                <th>&nbsp;供应商&nbsp;</th>
                <th>&nbsp;编码&nbsp;</th>
                <th>&nbsp;品名&nbsp;&nbsp;规格&nbsp;&nbsp;等级&nbsp;</th>
                <th>&nbsp;包装&nbsp;</th>
                <th>&nbsp;单位&nbsp;</th>
                <th>&nbsp;库存&nbsp;</th>
                <th>{T.qtyHead}</th>
                <th>进货单价</th>
                <th></th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {supplier == null && (
                <tr className={styles.emptyRow}><td colSpan={10}>请先在左边或点击【选择供应商】选择供应商</td></tr>
              )}
              {paged.map(p => {
                const input = rowInput(p)
                return (
                  <tr key={p.id}>
                    <td>&nbsp;{p.supplierCode}&nbsp;</td>
                    <td>&nbsp;{p.code}&nbsp;</td>
                    <td>&nbsp;{p.name}&nbsp;<em className={styles.spec}>{p.spec ?? ''}</em>&nbsp;{p.grade ?? ''}&nbsp;</td>
                    <td>&nbsp;{p.unitsPerPiece ?? ''}&nbsp;</td>
                    <td>&nbsp;{p.unit ?? ''}&nbsp;</td>
                    <td className={styles.stock}>&nbsp;{p.stock}&nbsp;</td>
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
                    <td>
                      <input
                        className={styles.noteInput}
                        type="text"
                        value={input.notes}
                        onChange={e => setRowInput(p, { notes: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && handleAdd(p)}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {supplier != null && (
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
          )}
        </div>

        <div className={styles.gapCol}>«</div>

        {/* ══ RIGHT: 进货单 ═════════════════════════════════════ */}
        <div className={styles.orderCol}>
          {saved && draft.lines.length === 0 ? (
            <div className={styles.success}>
              <div className={styles.successMsg}>{T.success}</div>
              <a
                className={styles.printLink}
                onClick={() => window.open(`${T.printPath}${saved.id}`, '_blank')}
              >
                {saved.no}
              </a>
            </div>
          ) : (
            <>
              <div className={styles.orderTitle}>
                <span className={styles.orderTitleBig}>{T.doc}</span>
                {supplier ? `(${supplier.code}　${supplier.name})` : '(　　)'}
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
                    {!isReturn && <th>折扣</th>}
                    {!isReturn && <th>折后</th>}
                    {!isReturn && <th>件数</th>}
                    <th>备注</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.lines.length === 0 && (
                    <tr className={styles.noRecord}><td colSpan={isReturn ? 8 : 11}>无记录!</td></tr>
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
                      {!isReturn && <td className={styles.num}>{l.discount}</td>}
                      {!isReturn && <td className={styles.num}>{fmt(lineFinal(l))}</td>}
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
                      {!isReturn && (
                        <>
                          <td></td>
                          <td className={styles.pinkNum}>{fmt(totalFinal)}</td>
                          <td className={styles.pinkNum}>{fmt(totalPieces)}</td>
                        </>
                      )}
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>

              {draft.lines.length > 0 && (
                <>
                  {!isReturn && (
                    <div className={styles.discountRow}>
                      输入折扣率
                      <input
                        className={styles.rateInput}
                        type="text"
                        value={draft.discountRate}
                        onChange={e => handleRateChange(e.target.value)}
                      />
                      %
                    </div>
                  )}
                  <div className={styles.pinkArea}>
                    <div className={styles.pinkRow}>
                      {T.dateLabel}
                      <input
                        className={styles.dateInput}
                        type="text"
                        value={draft.orderDate}
                        onChange={e => setDraft(d => ({ ...d, orderDate: e.target.value }))}
                      />
                      {T.operatorLabel}
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
        </div>
      </div>

      {/* ══ 请选择供应商 overlay ══════════════════════════════════ */}
      {pickerOpen && (
        <SupplierPicker suppliers={suppliers} onSelect={selectSupplier} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  )
}
