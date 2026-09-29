import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getProducts,
  getProductCategories,
  deleteProduct,
  type Product,
} from '@/api/products'
import { getSuppliers, type Supplier } from '@/api/suppliers'
import styles from './Products.module.css'

export default function Products() {
  const navigate = useNavigate()

  // ── Data state ───────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)

  // ── Filter / search state ────────────────────────────────────
  const [catFilter, setCatFilter] = useState('')          // active category filter
  const [supplierFilter, setSupplierFilter] = useState('') // active supplier code filter
  const [catSearch, setCatSearch] = useState('')          // sidebar category search input
  const [searchBy, setSearchBy] = useState('pbm')        // field selector
  const [searchText, setSearchText] = useState('')        // search text input
  const [appliedSearch, setAppliedSearch] = useState('')  // committed search value
  const [page, setPage] = useState(1)

  // ── Load data ────────────────────────────────────────────────
  const loadAll = useCallback(() => {
    setLoading(true)
    Promise.all([getProducts(), getProductCategories(), getSuppliers()])
      .then(([prods, cats, supps]) => {
        setProducts(prods)
        setCategories(cats)
        setSuppliers(supps)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Derived: supplier codes filtered by catSearch input ──────
  const visibleSuppliers = suppliers.filter(s =>
    catSearch === '' || s.code.toLowerCase().includes(catSearch.toLowerCase())
  )

  // ── Derived: products after catFilter + supplierFilter + search ─
  const filteredProducts = products.filter(p => {
    if (catFilter && p.category !== catFilter) return false
    if (supplierFilter && (p.supplierCode ?? '') !== supplierFilter) return false
    if (!appliedSearch) return true
    const q = appliedSearch.toLowerCase()
    switch (searchBy) {
      case 'pbm':  return p.code.toLowerCase().includes(q)
      case 'ppm':  return p.name.toLowerCase().includes(q)
      case 'gmc':  return (p.supplierName ?? '').toLowerCase().includes(q)
      case 'gjz':
      default:
        return (
          p.code.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          (p.supplierName ?? '').toLowerCase().includes(q) ||
          (p.spec ?? '').toLowerCase().includes(q) ||
          (p.grade ?? '').toLowerCase().includes(q)
        )
    }
  })

  const PAGE_SIZE = 100
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
  const pagedProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1) }, [catFilter, supplierFilter, appliedSearch])

  async function handleDelete(p: Product) {
    if (!window.confirm(`此操作将直接把产品资料删除掉，并且不可恢复，真的要进行吗？\n${p.code} ${p.name}`)) return
    try {
      await deleteProduct(p.id)
      loadAll()
    } catch (e: unknown) {
      alert('删除失败: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  function handleSearch() {
    setAppliedSearch(searchText)
  }

  function handleCatSearchKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      // catSearch is already bound; just show filtered list
    }
  }

  // ── Render ───────────────────────────────────────────────────
  if (loading) return <div className={styles.loading}>数据加载中，请稍候...</div>

  return (
    <div className={styles.page}>

      {/* ══ LEFT SIDEBAR ══════════════════════════════════════════ */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarInner}>

          {/* Sidebar header: 分类 search */}
          <div className={styles.sidebarHeader}>
            &nbsp;分类
            <input
              className={styles.catSearchInput}
              type="text"
              size={6}
              value={catSearch}
              onChange={e => setCatSearch(e.target.value)}
              onKeyDown={handleCatSearchKey}
            />
            <button className={styles.catSearchBtn} onClick={() => {}}>查找</button>
          </div>

          {/* Category list */}
          <div className={styles.catList}>
            {/* "All" entry */}
            <div
              className={`${styles.catItem} ${catFilter === '' && supplierFilter === '' ? styles.catActive : ''}`}
              onClick={() => { setCatFilter(''); setSupplierFilter('') }}
            >
              <span className={styles.catArrow}>▶</span>全部
            </div>
            {categories.map(cat => (
              <div
                key={cat}
                className={`${styles.catItem} ${catFilter === cat ? styles.catActive : ''}`}
                onClick={() => { setCatFilter(cat); setSupplierFilter('') }}
              >
                <span className={styles.catArrow}>▶</span>
                {cat}
              </div>
            ))}
          </div>

          {/* Supplier codes section */}
          <div className={styles.suppHeader}>
            &nbsp;供应商
          </div>
          <div className={styles.suppList}>
            <div className={styles.suppGrid}>
              {visibleSuppliers.map(s => (
                <div
                  key={s.id}
                  className={`${styles.suppItem} ${supplierFilter === s.code ? styles.suppActive : ''}`}
                  onClick={() => { setSupplierFilter(s.code); setCatFilter('') }}
                >
                  {s.code}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══ MAIN AREA ═════════════════════════════════════════════ */}
      <div className={styles.main}>

        {/* ── Sub-toolbar ── */}
        <div className={styles.subbar}>
          <span className={styles.subbarControls}>
            查找产品&nbsp;
            <select
              className={styles.searchSelect}
              value={searchBy}
              onChange={e => setSearchBy(e.target.value)}
            >
              <option value="pbm">产品编码</option>
              <option value="ppm">产品名称</option>
              <option value="gmc">供应商</option>
              <option value="gjz">关键字</option>
            </select>
            <input
              className={styles.searchInput}
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <button className={styles.btnInline} onClick={handleSearch}>查找</button>
            &nbsp;
            <button className={styles.btnInline} onClick={() => navigate('/master/suppliers')}>新增产品资料</button>
            &nbsp;
            <button className={styles.btnInlineGrey} disabled>导出EXCEL</button>
          </span>
        </div>

        {/* ── Table area (scrollable) ── */}
        <div className={styles.tableArea}>
          <table className={styles.prodTable}>
            <thead>
              <tr className={styles.thead}>
                <th>ID</th>
                <th>供应商</th>
                <th>分类</th>
                <th>编码</th>
                <th>品名</th>
                <th>规格</th>
                <th>等级</th>
                <th>单位</th>
                <th>包装</th>
                <th>操作</th>
                <th>进货价</th>
                <th>销售价</th>
              </tr>
            </thead>
            <tbody>
              {pagedProducts.map(p => (
                <tr key={p.id} className={styles.trow}>
                  <td className={styles.tc}>&nbsp;{p.id}&nbsp;</td>
                  <td className={styles.tnowrap}>&nbsp;{p.supplierName ?? ''}&nbsp;</td>
                  <td className={styles.tnowrap}>&nbsp;{p.category ?? ''}&nbsp;</td>
                  <td className={styles.tnowrap}>
                    &nbsp;<em className={styles.codeCell}>{p.code}</em>&nbsp;
                  </td>
                  <td className={styles.tnowrap}>&nbsp;{p.name}&nbsp;</td>
                  <td className={styles.tnowrap}>&nbsp;{p.spec ?? ''}&nbsp;</td>
                  <td className={styles.tnowrap}>&nbsp;{p.grade ?? ''}&nbsp;</td>
                  <td className={styles.tc}>&nbsp;{p.unit ?? ''}&nbsp;</td>
                  <td className={styles.tc}>&nbsp;{p.unitsPerPiece ?? ''}&nbsp;</td>
                  <td className={styles.tcOps}>
                    <span className={styles.opBtn} onClick={() => navigate(`/master/products/view/${p.id}`)}>查看</span>
                    <span className={`${styles.opBtn} ${styles.opEdit}`} onClick={() => navigate(`/master/products/edit/${p.id}`)}>编辑</span>
                    <span className={`${styles.opBtn} ${styles.opDel}`} onClick={() => handleDelete(p)}>删除</span>
                  </td>
                  <td className={`${styles.tc} ${styles.priceCell}`}>
                    &nbsp;{p.costPrice != null ? p.costPrice.toFixed(2) : ''}&nbsp;
                  </td>
                  <td className={`${styles.tc} ${styles.priceCell}`}>
                    &nbsp;{p.price != null ? p.price.toFixed(2) : ''}&nbsp;
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Footer count row ── */}
        <div className={styles.footer}>
          &nbsp;共 <strong>{filteredProducts.length}</strong> 个记录
          {catFilter && <span>（分类: {catFilter}）</span>}
          {supplierFilter && <span>（供应商: {supplierFilter}）</span>}
          {appliedSearch && <span>（搜索: {appliedSearch}）</span>}
          &nbsp;&nbsp;
          <button className={styles.pgBtn} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>◀</button>
          &nbsp;第 <strong>{page}</strong> / {totalPages} 页&nbsp;
          <button className={styles.pgBtn} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>▶</button>
        </div>

      </div>
    </div>
  )
}
