import { useEffect, useState } from 'react'
import { getProducts, getProductCategories, type Product } from '@/api/products'
import { getSuppliers, type Supplier } from '@/api/suppliers'
import { getErrorMessage } from '@/utils/error'
import { SearchIcon } from '@/pages/master/SupplierIcons'
import side from '@/pages/purchase/PurchaseIn.module.css'
import styles from '@/pages/purchase/PurchaseDocs.module.css'

type SortKey = 'code' | 'name' | 'stock'

interface Filters {
  field: 'supplier' | 'code' | 'name'
  keyword: string
  sort: SortKey
  order: 'asc' | 'desc'
}

const DEFAULT_FILTERS: Filters = { field: 'supplier', keyword: '', sort: 'stock', order: 'desc' }

const PAGE_SIZE = 1000
const PAGE_WINDOW = 10

const money = (n: number | null) => (n != null ? Number(n).toFixed(2) : '0.00')

// 件数 = 库存 / 包装 (one decimal); goods sold by the 箱 count each unit as a 件; blank without 包装
function piecesOf(p: Product): string {
  if (p.unit === '箱') return String(p.stock)
  if (!p.unitsPerPiece) return ''
  return (p.stock / p.unitsPerPiece).toFixed(1)
}

// 产品库存表 — replicates old kc_byd_list.asp (导出EXCEL dropped)
export default function InventoryList() {
  // ── Data ─────────────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)

  // ── Filters ──────────────────────────────────────────────────
  const [form, setForm] = useState<Filters>(DEFAULT_FILTERS)
  const [applied, setApplied] = useState<Filters>(DEFAULT_FILTERS)
  const [inStockOnly, setInStockOnly] = useState(false)
  const [sideSearch, setSideSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState<number | null>(null)
  const [page, setPage] = useState(1)

  useEffect(() => {
    Promise.all([getProducts(), getProductCategories(), getSuppliers()])
      .then(([prods, cats, supps]) => { setProducts(prods); setCategories(cats); setSuppliers(supps) })
      .catch(err => alert(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1) }, [applied, inStockOnly, catFilter, supplierFilter])

  // ── Derived ──────────────────────────────────────────────────
  const visibleSuppliers = suppliers.filter(s =>
    sideSearch === '' ||
    s.code.toLowerCase().includes(sideSearch.toLowerCase()) ||
    s.name.toLowerCase().includes(sideSearch.toLowerCase())
  )

  const dir = applied.order === 'asc' ? 1 : -1
  const rows = products
    .filter(p => {
      if (inStockOnly && p.stock <= 0) return false
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
      if (applied.sort === 'stock') return dir * (a.stock - b.stock)
      return dir * a[applied.sort].localeCompare(b[applied.sort], 'zh-CN')
    })

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const windowStart = Math.floor((page - 1) / PAGE_WINDOW) * PAGE_WINDOW + 1
  const windowEnd = Math.min(windowStart + PAGE_WINDOW - 1, totalPages)

  // ── Actions ──────────────────────────────────────────────────
  function setField<K extends keyof Filters>(key: K, value: Filters[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleShowAll() {
    setForm(DEFAULT_FILTERS)
    setApplied(DEFAULT_FILTERS)
    setInStockOnly(false)
    setCatFilter('')
    setSupplierFilter(null)
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ── Sub-toolbar (Enter = 查找, like the old form) ── */}
      <form className={styles.subbar} onSubmit={e => { e.preventDefault(); setApplied({ ...form, keyword: form.keyword.trim() }) }}>
        <SearchIcon />
        <select value={form.field} onChange={e => setField('field', e.target.value as Filters['field'])}>
          <option value="supplier">供货商</option>
          <option value="code">产品编码</option>
          <option value="name">产品名称</option>
        </select>
        <input className={styles.kwInput} type="text" value={form.keyword} onChange={e => setField('keyword', e.target.value)} />
        <select value={form.sort} onChange={e => setField('sort', e.target.value as SortKey)}>
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
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        <input type="button" value="只显示有库存的产品" onClick={() => setInStockOnly(true)} />
      </form>

      <div className={side.layout}>

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

        {/* ══ MAIN: stock table ══════════════════════════════════ */}
        <div style={{ marginLeft: 2 }}>
          {loading ? <div className={styles.loading}>数据加载中，请稍候...</div> : (
            <table className={styles.grid}>
              <thead>
                <tr>
                  <th className={styles.c}>&nbsp;编码&nbsp;</th>
                  <th style={{ textAlign: 'left' }}>&nbsp;产品名称&nbsp;规格&nbsp;等级&nbsp;</th>
                  <th className={styles.c}>&nbsp;单位&nbsp;</th>
                  <th className={styles.c}>&nbsp;包装&nbsp;</th>
                  <th className={styles.c}>&nbsp;供应商&nbsp;</th>
                  <th className={styles.c}>&nbsp;基本价&nbsp;</th>
                  <th className={styles.c}>&nbsp;销售价&nbsp;</th>
                  <th className={styles.c}>&nbsp;库存&nbsp;</th>
                  <th className={styles.c}>件数</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(p => (
                  <tr key={p.id} className={styles.row}>
                    <td className={styles.c}>&nbsp;{p.code}&nbsp;</td>
                    <td>&nbsp;{p.name}&nbsp;{p.spec ?? ''}&nbsp;{p.grade ?? ''}&nbsp;</td>
                    <td className={styles.c}>&nbsp;{p.unit ?? ''}&nbsp;</td>
                    <td className={styles.c}>&nbsp;{p.unitsPerPiece ?? ''}&nbsp;</td>
                    <td className={styles.r}>&nbsp;<span className={`${styles.bold} ${styles.green}`}>{p.supplierCode}</span>&nbsp;</td>
                    <td className={styles.r}>&nbsp;{money(p.costPrice)}&nbsp;</td>
                    <td className={`${styles.r} ${styles.magenta}`}>&nbsp;{money(p.price)}&nbsp;</td>
                    <td className={`${styles.r} ${styles.bold} ${styles.green}`}>&nbsp;{p.stock}&nbsp;</td>
                    <td className={`${styles.r} ${styles.teal}`}>&nbsp;{piecesOf(p)}&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className={styles.countLine}>&nbsp;共{paged.length}个产品</div>

          {/* ── Pager ── */}
          <table className={side.pager} style={{ marginTop: 0 }}>
            <tbody>
              <tr>
                <td className={side.pagerTotal}>&nbsp;总{rows.length}个,共{totalPages}页&nbsp;</td>
                <td>&nbsp;</td>
                {page > 1 && <td>&nbsp;<a onClick={() => setPage(page - 1)}>上一页</a>&nbsp;</td>}
                {Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => windowStart + i).map(n => (
                  <td key={n} className={n === page ? side.pageActive : undefined}>
                    &nbsp;<a onClick={() => setPage(n)}>{n}</a>&nbsp;
                  </td>
                ))}
                {page < totalPages && <td>&nbsp;<a onClick={() => setPage(page + 1)}>下一页</a>&nbsp;</td>}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
