import { useEffect, useState } from 'react'
import { getProducts, getProductCategories, updateProduct, type Product } from '@/api/products'
import { getSuppliers, type Supplier } from '@/api/suppliers'
import { getErrorMessage } from '@/utils/error'
import { SearchIcon } from './SupplierIcons'
import side from '@/pages/purchase/PurchaseIn.module.css'
import styles from '@/pages/purchase/PurchaseDocs.module.css'
import pa from './PriceAdjust.module.css'
import { codeEquals } from '@/utils/codeMatch'

type Field = 'code' | 'name' | 'supplier' | 'keyword'

const PAGE_SIZE = 40
const PAGE_WINDOW = 10

const priceText = (n: number | null) => (n != null ? Number(n).toFixed(2) : '')
const cleanNum = (v: string) => v.replace(/[^\d.]/g, '')

interface Edit { price: string; cost: string }

// 产品调价 — replicates old prods_update_price.asp (拼音码 search dropped).
// Saved through the normal product update (PUT /products/:id), one request per changed product.
export default function PriceAdjust() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // ── Filters ──────────────────────────────────────────────────
  const [field, setField] = useState<Field>('code')
  const [keyword, setKeyword] = useState('')
  const [applied, setApplied] = useState<{ field: Field; keyword: string }>({ field: 'code', keyword: '' })
  const [sideSearch, setSideSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState<number | null>(null)
  const [page, setPage] = useState(1)

  // productId → edited 销售价 / 成本价 text (kept across pages until saved)
  const [edits, setEdits] = useState<Record<number, Edit>>({})

  function load() {
    setLoading(true)
    Promise.all([getProducts(), getProductCategories(), getSuppliers()])
      .then(([prods, cats, supps]) => { setProducts(prods); setCategories(cats); setSuppliers(supps) })
      .catch(err => alert(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])
  useEffect(() => { setPage(1) }, [applied, catFilter, supplierFilter])

  // ── Derived ──────────────────────────────────────────────────
  const visibleSuppliers = suppliers.filter(s =>
    sideSearch === '' || codeEquals(s.code, sideSearch) || s.name.toLowerCase().includes(sideSearch.toLowerCase()))

  const rows = products.filter(p => {
    if (catFilter && p.category !== catFilter) return false
    if (supplierFilter != null && p.supplierId !== supplierFilter) return false
    if (!applied.keyword) return true
    const q = applied.keyword.toLowerCase()
    switch (applied.field) {
      case 'code': return p.code.toLowerCase().includes(q)
      case 'name': return p.name.toLowerCase().includes(q)
      case 'supplier': return codeEquals(p.supplierCode, q) || (p.supplierName ?? '').toLowerCase().includes(q)
      case 'keyword':
      default:
        return [p.code, p.name, p.spec, p.grade].some(v => (v ?? '').toLowerCase().includes(q))
    }
  })

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const windowStart = Math.floor((page - 1) / PAGE_WINDOW) * PAGE_WINDOW + 1
  const windowEnd = Math.min(windowStart + PAGE_WINDOW - 1, totalPages)

  const editOf = (p: Product): Edit => edits[p.id] ?? { price: priceText(p.price), cost: priceText(p.costPrice) }
  const isChanged = (p: Product) => {
    const e = edits[p.id]
    return !!e && (e.price !== priceText(p.price) || e.cost !== priceText(p.costPrice))
  }

  function setEdit(p: Product, patch: Partial<Edit>) {
    setEdits(m => ({ ...m, [p.id]: { ...editOf(p), ...patch } }))
  }

  // ── Save: every changed product, full payload so nothing else is touched ──
  async function handleSave() {
    const changed = products.filter(isChanged)
    if (changed.length === 0) { alert('没有修改任何价格'); return }
    setSaving(true)
    let ok = 0
    try {
      for (const p of changed) {
        const e = edits[p.id]
        await updateProduct(p.id, {
          code: p.code.split('.').slice(1).join('.'),
          name: p.name,
          supplierId: p.supplierId,
          categoryId: p.categoryId ?? undefined,
          spec: p.spec || undefined,
          grade: p.grade || undefined,
          unit: p.unit,
          unitsPerPiece: p.unitsPerPiece ?? undefined,
          price: e.price !== '' ? parseFloat(e.price) : undefined,
          costPrice: e.cost !== '' ? parseFloat(e.cost) : undefined,
          status: p.status,
        })
        ok++
      }
      alert(`已保存${ok}个产品的价格`)
    } catch (err) {
      alert(`已保存${ok}个，第${ok + 1}个保存失败：${getErrorMessage(err)}`)
    } finally {
      setSaving(false)
      setEdits({})
      load()
    }
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ── Sub-toolbar: 查找产品 (Enter = 查找) ── */}
      <form className={styles.subbar} onSubmit={e => { e.preventDefault(); setApplied({ field, keyword: keyword.trim() }) }}>
        <SearchIcon />查找产品
        <select value={field} onChange={e => setField(e.target.value as Field)}>
          <option value="code">产品编码</option>
          <option value="name">产品名称</option>
          <option value="supplier">供应商</option>
          <option value="keyword">关键字</option>
        </select>
        <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)} />
        <input type="submit" value="查找" />
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
              <a key={c} className={`${side.catItem} ${catFilter === c ? side.active : ''}`}
                onClick={() => setCatFilter(catFilter === c ? '' : c)}>
                <span className={side.catArrow}>➡</span>{c}
              </a>
            ))}
          </div>
          <div className={side.suppCols}>
            {visibleSuppliers.map(s => (
              <a key={s.id} title={`${s.code} ${s.name}`}
                className={`${side.suppItem} ${s.id === supplierFilter ? side.active : ''}`}
                onClick={() => setSupplierFilter(supplierFilter === s.id ? null : s.id)}>
                {s.code.slice(0, 4)}
              </a>
            ))}
          </div>
        </div>

        {/* ══ MAIN: price table ══════════════════════════════════ */}
        <div style={{ marginLeft: 2 }}>
          {loading ? <div className={styles.loading}>数据加载中，请稍候...</div> : (
            <table className={styles.grid}>
              <thead>
                <tr>
                  <th>&nbsp;ID&nbsp;</th>
                  <th>&nbsp;供应商&nbsp;</th>
                  <th>&nbsp;编码&nbsp;</th>
                  <th>&nbsp;规格&nbsp;</th>
                  <th>&nbsp;品名&nbsp;</th>
                  <th>&nbsp;等级&nbsp;</th>
                  <th>&nbsp;销售价&nbsp;</th>
                  <th>&nbsp;成本价&nbsp;</th>
                  <th>&nbsp;包装&nbsp;</th>
                  <th>&nbsp;单位&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(p => {
                  const e = editOf(p)
                  const changed = isChanged(p) ? pa.changed : ''
                  return (
                    <tr key={p.id} className={styles.row}>
                      <td className={styles.c}>&nbsp;{p.id}&nbsp;</td>
                      <td>&nbsp;{p.supplierCode}&nbsp;{p.supplierName}&nbsp;</td>
                      <td>&nbsp;{p.code}&nbsp;</td>
                      <td>&nbsp;{p.spec ?? ''}&nbsp;</td>
                      <td>&nbsp;{p.name}&nbsp;</td>
                      <td>&nbsp;{p.grade ?? ''}&nbsp;</td>
                      <td>
                        <input className={`${pa.priceInput} ${changed}`} type="text" value={e.price}
                          onChange={ev => setEdit(p, { price: cleanNum(ev.target.value) })} />
                      </td>
                      <td>
                        <input className={`${pa.costInput} ${changed}`} type="text" value={e.cost}
                          onChange={ev => setEdit(p, { cost: cleanNum(ev.target.value) })} />
                      </td>
                      <td>&nbsp;{p.unitsPerPiece ?? ''}&nbsp;</td>
                      <td>&nbsp;{p.unit ?? ''}&nbsp;</td>
                    </tr>
                  )
                })}
                <tr className={pa.saveRow}>
                  <td colSpan={10}>
                    <input type="button" value={saving ? '保存中...' : '修改后点击这里保存'} disabled={saving} onClick={handleSave} />
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {/* ── Pager ── */}
          <table className={side.pager} style={{ marginTop: 6 }}>
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
