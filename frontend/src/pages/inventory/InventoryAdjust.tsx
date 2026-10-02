import { useEffect, useState, useCallback } from 'react'
import { getProducts, getProductCategories, type Product } from '@/api/products'
import { getSuppliers, type Supplier } from '@/api/suppliers'
import { createAdjustment } from '@/api/inventory'
import { useAuth } from '@/store/AuthContext'
import { getErrorMessage } from '@/utils/error'
import { toSlashDate } from '@/utils/slashDate'
import { SearchIcon } from '@/pages/master/SupplierIcons'
import styles from '@/pages/purchase/PurchaseIn.module.css'

// ─── Unsaved 库存调整单 kept in localStorage (old system kept it server-side) ──
// The backend has no adjustment document: each line is saved as its own manual
// adjustment (type adjust / ref_type manual), reason = 整单备注 + 行备注.
interface DraftLine {
  key: string
  productId: number
  code: string
  name: string
  spec: string
  grade: string
  unit: string
  stock: number      // 库存数量 when added
  actual: string     // 实际数量
  notes: string
  checked: boolean
}

interface Draft {
  lines: DraftLine[]
  notes: string
}

const DRAFT_KEY = 'flora.inventoryAdjustDraft'
const newDraft = (): Draft => ({ lines: [], notes: '' })

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (raw) return { ...newDraft(), ...JSON.parse(raw) }
  } catch { /* storage unavailable — start empty */ }
  return newDraft()
}

function saveDraft(draft: Draft) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)) } catch { /* ignore */ }
}

const num = (v: string) => (v === '' ? 0 : Number(v))
const diffOf = (l: DraftLine) => num(l.actual) - l.stock
const reasonOf = (docNotes: string, lineNotes: string) =>
  [docNotes.trim(), lineNotes.trim()].filter(Boolean).join(' ') || undefined

const PAGE_SIZE = 25
const PAGE_WINDOW = 10

interface RowInput {
  actual: string
  notes: string
}

// 库存调整 — replicates old kp_in.asp (手工刷新库存 / 修改单据 dropped)
export default function InventoryAdjust() {
  const { user } = useAuth()

  // ── Data state ───────────────────────────────────────────────
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [products, setProducts] = useState<Product[]>([])

  // ── Draft (right panel) ──────────────────────────────────────
  const [draft, setDraftState] = useState<Draft>(loadDraft)
  const [savedCount, setSavedCount] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  // ── Filter state ─────────────────────────────────────────────
  const [sideSearch, setSideSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState<number | null>(null)
  const [searchText, setSearchText] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [rowInputs, setRowInputs] = useState<Record<number, RowInput>>({})

  function setDraft(update: (d: Draft) => Draft) {
    setDraftState(d => {
      const next = update(d)
      saveDraft(next)
      return next
    })
  }

  // ── Load data ────────────────────────────────────────────────
  const loadProducts = useCallback(() => {
    getProducts().then(setProducts).catch(err => alert(getErrorMessage(err)))
  }, [])

  useEffect(() => {
    Promise.all([getSuppliers(), getProductCategories()])
      .then(([supps, cats]) => { setSuppliers(supps); setCategories(cats) })
      .catch(err => alert(getErrorMessage(err)))
    loadProducts()
  }, [loadProducts])

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1) }, [supplierFilter, catFilter, appliedSearch])

  // ── Derived ──────────────────────────────────────────────────
  const visibleSuppliers = suppliers.filter(s =>
    sideSearch === '' ||
    s.code.toLowerCase().includes(sideSearch.toLowerCase()) ||
    s.name.toLowerCase().includes(sideSearch.toLowerCase())
  )

  const filtered = products.filter(p => {
    if (supplierFilter != null && p.supplierId !== supplierFilter) return false
    if (catFilter && p.category !== catFilter) return false
    if (!appliedSearch) return true
    const q = appliedSearch.toLowerCase()
    return p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || (p.spec ?? '').toLowerCase().includes(q)
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const windowStart = Math.floor((page - 1) / PAGE_WINDOW) * PAGE_WINDOW + 1
  const windowEnd = Math.min(windowStart + PAGE_WINDOW - 1, totalPages)

  const totalStock = draft.lines.reduce((s, l) => s + l.stock, 0)
  const totalActual = draft.lines.reduce((s, l) => s + num(l.actual), 0)
  const totalDiff = draft.lines.reduce((s, l) => s + diffOf(l), 0)

  // ── Left table: 加入 ─────────────────────────────────────────
  function rowInput(p: Product): RowInput {
    return rowInputs[p.id] ?? { actual: '', notes: '' }
  }

  function setRowInput(p: Product, patch: Partial<RowInput>) {
    setRowInputs(r => ({ ...r, [p.id]: { ...rowInput(p), ...patch } }))
  }

  function handleAdd(p: Product) {
    const input = rowInput(p)
    if (input.actual === '') { alert('请输入实际数量'); return }
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
        stock: p.stock,
        actual: input.actual,
        notes: input.notes,
        checked: false,
      }],
    }))
    setRowInput(p, { actual: '', notes: '' })
    setSavedCount(null)
  }

  // ── Right panel ──────────────────────────────────────────────
  function setLine(key: string, patch: Partial<DraftLine>) {
    setDraft(d => ({ ...d, lines: d.lines.map(l => (l.key === key ? { ...l, ...patch } : l)) }))
  }

  function handleDeleteChecked() {
    if (!draft.lines.some(l => l.checked)) { alert('请先勾选要删除的产品'); return }
    setDraft(d => ({ ...d, lines: d.lines.filter(l => !l.checked) }))
  }

  // one manual adjustment per line; stop at the first failure and keep the unsaved lines
  async function handleSave() {
    if (saving) return
    if (draft.lines.length === 0) { alert('库存调整单中没有产品'); return }
    if (draft.lines.some(l => l.actual === '')) { alert('请输入实际数量'); return }

    setSaving(true)
    let done = 0
    try {
      for (const line of draft.lines) {
        await createAdjustment({
          productId: line.productId,
          qtyNew: num(line.actual),
          reason: reasonOf(draft.notes, line.notes),
        })
        done++
      }
      setDraft(() => newDraft())
      setSavedCount(done)
    } catch (err) {
      const failed = draft.lines[done]
      setDraft(d => ({ ...d, lines: d.lines.slice(done) }))
      alert(`已保存${done}个产品，${failed.code} ${failed.name} 保存失败：${getErrorMessage(err)}`)
    } finally {
      setSaving(false)
      loadProducts()   // refresh 库存数量
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
                <th>&nbsp;库存数量&nbsp;</th>
                <th>实际数量</th>
                <th>&nbsp;备注&nbsp;</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
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
                        value={input.actual}
                        onChange={e => setRowInput(p, { actual: e.target.value.replace(/\D/g, '') })}
                        onKeyDown={e => e.key === 'Enter' && handleAdd(p)}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.noteInput}
                        type="text"
                        value={input.notes}
                        onChange={e => setRowInput(p, { notes: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && handleAdd(p)}
                      />
                    </td>
                    <td><input type="button" value="加入" onClick={() => handleAdd(p)} /></td>
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
        </div>

        <div className={styles.gapCol}>«</div>

        {/* ══ RIGHT: 库存调整单 ═════════════════════════════════ */}
        <div className={styles.orderCol}>
          {savedCount != null && draft.lines.length === 0 ? (
            <div className={styles.success}>
              <div className={styles.successMsg}>库存调整单已经成功保存!共调整{savedCount}个产品。</div>
            </div>
          ) : (
            <>
              <div className={styles.orderTitle}>
                <span className={styles.orderTitleBig}>库存调整单</span>
              </div>
              <table className={styles.orderTable}>
                <thead>
                  <tr>
                    <th><span className={styles.delAll} title="删除勾选的产品" onClick={handleDeleteChecked}>×</span></th>
                    <th>编码</th>
                    <th>品名 规格 等级</th>
                    <th>单位</th>
                    <th>库存数量</th>
                    <th>实际数量</th>
                    <th>盈亏数量</th>
                    <th>备注</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.lines.length === 0 && (
                    <tr className={styles.noRecord}><td colSpan={8}>无记录!</td></tr>
                  )}
                  {draft.lines.map(l => (
                    <tr key={l.key}>
                      <td>
                        <input type="checkbox" checked={l.checked} onChange={e => setLine(l.key, { checked: e.target.checked })} />
                      </td>
                      <td>{l.code}</td>
                      <td className={styles.wrapName}>{l.name} {l.spec} {l.grade}</td>
                      <td className={styles.num}>{l.unit}</td>
                      <td className={styles.num}>{l.stock}</td>
                      <td>
                        <input className={styles.lineQty} type="text" value={l.actual}
                          onChange={e => setLine(l.key, { actual: e.target.value.replace(/\D/g, '') })} />
                      </td>
                      <td className={styles.num}>{diffOf(l)}</td>
                      <td>
                        <input className={styles.lineNotes} type="text" value={l.notes}
                          onChange={e => setLine(l.key, { notes: e.target.value })} />
                      </td>
                    </tr>
                  ))}
                  {draft.lines.length > 0 && (
                    <tr className={styles.sumRow}>
                      <td colSpan={4} style={{ textAlign: 'right' }}>合计&nbsp;&nbsp;</td>
                      <td className={styles.pinkNum}>{totalStock}</td>
                      <td className={styles.num}>{totalActual}</td>
                      <td className={styles.pinkNum}>{totalDiff}</td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>

              {draft.lines.length > 0 && (
                <div className={styles.pinkArea}>
                  <div className={styles.pinkRow}>
                    开单日期
                    <input className={styles.dateInput} type="text" value={toSlashDate()} readOnly />
                    &nbsp;经办人
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
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
