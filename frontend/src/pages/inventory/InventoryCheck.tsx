import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProducts, getProductCategories, type Product } from '@/api/products'
import { getSuppliers, type Supplier } from '@/api/suppliers'
import { createAdjustment } from '@/api/inventory'
import { getErrorMessage } from '@/utils/error'
import { SearchIcon } from '@/pages/master/SupplierIcons'
import side from '@/pages/purchase/PurchaseIn.module.css'
import styles from '@/pages/purchase/PurchaseDocs.module.css'
import check from './InventoryCheck.module.css'

type SortKey = 'supplier' | 'code' | 'name' | 'stock'

interface Filters {
  field: 'supplier' | 'code' | 'name'
  keyword: string
  sort: SortKey
  order: 'asc' | 'desc'
}

const DEFAULT_FILTERS: Filters = { field: 'supplier', keyword: '', sort: 'stock', order: 'desc' }

// typed 现库存 per product, kept so a long count survives leaving the page
const COUNTS_KEY = 'flora.inventoryCheckCounts'
// reason recorded on each saved row (same as the old system's 盘点 records)
const CHECK_REASON = '库存盘点'

function loadCounts(): Record<number, string> {
  try {
    const raw = localStorage.getItem(COUNTS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* storage unavailable — start empty */ }
  return {}
}

function saveCounts(counts: Record<number, string>) {
  try { localStorage.setItem(COUNTS_KEY, JSON.stringify(counts)) } catch { /* ignore */ }
}

// 库存盘点 — replicates old pd_byd_in.asp (产品信息 / 截止日期 / 生成盘点库存 dropped).
// Each counted product is saved as one manual adjustment with reason 库存盘点.
export default function InventoryCheck() {
  const navigate = useNavigate()

  // ── Data ─────────────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [counts, setCountsState] = useState<Record<number, string>>(loadCounts)
  const [saving, setSaving] = useState(false)

  // ── Filters ──────────────────────────────────────────────────
  const [form, setForm] = useState<Filters>(DEFAULT_FILTERS)
  const [applied, setApplied] = useState<Filters>(DEFAULT_FILTERS)
  const [sideSearch, setSideSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState<number | null>(null)

  function setCounts(update: (c: Record<number, string>) => Record<number, string>) {
    setCountsState(c => {
      const next = update(c)
      saveCounts(next)
      return next
    })
  }

  const loadProducts = useCallback(() => {
    return getProducts().then(setProducts).catch(err => alert(getErrorMessage(err)))
  }, [])

  useEffect(() => {
    Promise.all([getProductCategories(), getSuppliers()])
      .then(([cats, supps]) => { setCategories(cats); setSuppliers(supps) })
      .catch(err => alert(getErrorMessage(err)))
    loadProducts().finally(() => setLoading(false))
  }, [loadProducts])

  // ── Derived ──────────────────────────────────────────────────
  const visibleSuppliers = suppliers.filter(s =>
    sideSearch === '' ||
    s.code.toLowerCase().includes(sideSearch.toLowerCase()) ||
    s.name.toLowerCase().includes(sideSearch.toLowerCase())
  )

  const dir = applied.order === 'asc' ? 1 : -1
  const rows = products
    .filter(p => {
      if (catFilter && p.category !== catFilter) return false
      if (supplierFilter != null && p.supplierId !== supplierFilter) return false
      if (!applied.keyword) return true
      const q = applied.keyword.toLowerCase()
      switch (applied.field) {
        case 'code': return p.code.toLowerCase().includes(q)
        case 'name': return p.name.toLowerCase().includes(q)
        case 'supplier':
        default:
          return (p.supplierCode ?? '').toLowerCase().includes(q) || (p.supplierName ?? '').toLowerCase().includes(q)
      }
    })
    .sort((a, b) => {
      switch (applied.sort) {
        case 'stock': return dir * (a.stock - b.stock)
        case 'supplier': return dir * (a.supplierCode ?? '').localeCompare(b.supplierCode ?? '', 'zh-CN')
        default: return dir * a[applied.sort].localeCompare(b[applied.sort], 'zh-CN')
      }
    })

  // every product with a typed 现库存 (not just the filtered ones) is part of the 盘点单
  const counted = products.filter(p => (counts[p.id] ?? '') !== '')

  // ── Actions ──────────────────────────────────────────────────
  function setField<K extends keyof Filters>(key: K, value: Filters[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleShowAll() {
    setForm(DEFAULT_FILTERS)
    setApplied(DEFAULT_FILTERS)
    setCatFilter('')
    setSupplierFilter(null)
  }

  // 批量生成盘点单: one manual adjustment per counted product; stop at the first failure
  async function handleGenerate() {
    if (saving) return
    if (counted.length === 0) { alert('请先输入产品的现库存'); return }
    if (!window.confirm(`确定生成盘点单吗？共${counted.length}个产品`)) return

    setSaving(true)
    let done = 0
    try {
      for (const p of counted) {
        await createAdjustment({ productId: p.id, qtyNew: Number(counts[p.id]), reason: CHECK_REASON })
        setCounts(c => {
          const next = { ...c }
          delete next[p.id]
          return next
        })
        done++
      }
      alert(`盘点单已生成，共${done}个产品`)
    } catch (err) {
      const failed = counted[done]
      alert(`已保存${done}个产品，${failed.code} ${failed.name} 保存失败：${getErrorMessage(err)}`)
    } finally {
      setSaving(false)
      loadProducts()   // refresh 原库存
    }
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ── Sub-toolbar ── */}
      <div className={styles.subbar}>
        <input type="button" value="查看盘点单据" onClick={() => navigate('/inventory/adjustments')} />
      </div>

      {/* ── Search row above the table (Enter = 查找) ── */}
      <form className={check.searchRow} onSubmit={e => { e.preventDefault(); setApplied({ ...form, keyword: form.keyword.trim() }) }}>
        <SearchIcon />
        <select value={form.field} onChange={e => setField('field', e.target.value as Filters['field'])}>
          <option value="supplier">供应商</option>
          <option value="code">产品编码</option>
          <option value="name">产品名称</option>
        </select>
        <input className={styles.kwInput} type="text" value={form.keyword} onChange={e => setField('keyword', e.target.value)} />
        <select value={form.sort} onChange={e => setField('sort', e.target.value as SortKey)}>
          <option value="supplier">按供应商排序</option>
          <option value="code">按产品编码排序</option>
          <option value="name">按产品名称排序</option>
          <option value="stock">按库存大小排序</option>
        </select>
        <select value={form.order} onChange={e => setField('order', e.target.value as Filters['order'])}>
          <option value="asc">升序</option>
          <option value="desc">降序</option>
        </select>
        <input type="submit" value="查找" />
        <input type="button" value="显示全部" onClick={handleShowAll} />
      </form>

      <div className={side.layout} style={{ paddingTop: 0 }}>

        {/* ══ LEFT SIDEBAR: categories + suppliers (filters) ═════ */}
        <div className={side.sidebar}>
          <div className={side.sidebarHeader}>
            &nbsp;分类
            <input className={side.sideSearch} type="text" value={sideSearch} onChange={e => setSideSearch(e.target.value)} />
            <input type="button" value="查找" />
          </div>
          <div className={side.catList}>
            {categories.map(c => (
              <a
                key={c}
                className={`${side.catItem} ${catFilter === c ? side.active : ''}`}
                onClick={() => setCatFilter(catFilter === c ? '' : c)}
              >
                <span className={side.catArrow}>➡</span>{c}
              </a>
            ))}
          </div>
          <div className={side.suppCols}>
            {visibleSuppliers.map(s => (
              <a
                key={s.id}
                title={`${s.code} ${s.name}`}
                className={`${side.suppItem} ${s.id === supplierFilter ? side.active : ''}`}
                onClick={() => setSupplierFilter(supplierFilter === s.id ? null : s.id)}
              >
                {s.code.slice(0, 4)}
              </a>
            ))}
          </div>
        </div>

        {/* ══ MAIN: 盘点 table — all products, no paging (like the old form) ══ */}
        <div>
          {loading ? <div className={styles.loading}>数据加载中，请稍候...</div> : (
            <table className={styles.grid}>
              <thead>
                <tr>
                  <th className={styles.c}>&nbsp;供应商&nbsp;</th>
                  <th className={styles.c}>&nbsp;编码&nbsp;</th>
                  <th style={{ textAlign: 'left' }}>&nbsp;产品名称&nbsp;规格&nbsp;等级&nbsp;</th>
                  <th className={styles.c}>&nbsp;单位&nbsp;</th>
                  <th className={styles.c}>&nbsp;包装&nbsp;</th>
                  <th className={styles.c}>&nbsp;原库存&nbsp;</th>
                  <th className={styles.c}>&nbsp;现库存&nbsp;</th>
                  <th className={styles.c}>&nbsp;盈亏数量&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(p => {
                  const value = counts[p.id] ?? ''
                  const diff = value === '' ? null : Number(value) - p.stock
                  return (
                    <tr key={p.id} className={styles.row}>
                      <td className={`${styles.r} ${styles.magenta}`}>&nbsp;{p.supplierCode}&nbsp;</td>
                      <td className={styles.c}>&nbsp;{p.code}&nbsp;</td>
                      <td>&nbsp;{p.name}&nbsp;{p.spec ?? ''}&nbsp;{p.grade ?? ''}</td>
                      <td className={styles.c}>&nbsp;{p.unit ?? ''}&nbsp;</td>
                      <td className={styles.c}>&nbsp;{p.unitsPerPiece ?? ''}&nbsp;</td>
                      <td className={`${styles.r} ${check.stock}`}>&nbsp;{p.stock}&nbsp;</td>
                      <td className={styles.c}>
                        <input
                          className={check.countInput}
                          type="text"
                          value={value}
                          onChange={e => {
                            const v = e.target.value.replace(/\D/g, '')
                            setCounts(c => {
                              const next = { ...c }
                              if (v === '') delete next[p.id]
                              else next[p.id] = v
                              return next
                            })
                          }}
                        />
                      </td>
                      <td className={`${styles.r} ${diff != null && diff < 0 ? check.loss : check.gain}`}>
                        &nbsp;{diff == null ? '' : diff}&nbsp;
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* ── Footer bar: 批量生成盘点单 ── */}
          <div className={check.footer}>
            &nbsp;共{rows.length}个产品&nbsp;
            <input
              type="button"
              value={saving ? '保存中...' : '输入产品实际库存后,点击这里批量生成盘点单'}
              disabled={saving}
              onClick={handleGenerate}
            />
            {counted.length > 0 && <span>&nbsp;已输入{counted.length}个产品</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
