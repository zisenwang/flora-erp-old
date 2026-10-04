import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { getProducts, type Product } from '@/api/products'
import { getErrorMessage } from '@/utils/error'
import { SearchIcon } from '@/pages/master/SupplierIcons'
import { MobileHeader, SalesFooter, RecentCustomers, CategoryOverlay, useSalesDraft, MOBILE_SALES } from './MobileShell'
import styles from './Mobile.module.css'

// 手机开单 — page 3 (mxs_in.asp): product list for the chosen customer, ＋ → page 4
export default function MobileSales() {
  const navigate = useNavigate()
  const { draft, selectCustomer } = useSalesDraft()
  const customer = draft.customer

  const [products, setProducts] = useState<Product[]>([])
  const [searchText, setSearchText] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [category, setCategory] = useState('')
  const [showCategories, setShowCategories] = useState(false)

  useEffect(() => {
    getProducts().then(setProducts).catch(err => alert(getErrorMessage(err)))
  }, [])

  const filtered = products.filter(p => {
    if (category && p.category !== category) return false
    if (!appliedSearch) return true
    const q = appliedSearch.toLowerCase()
    return p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || (p.spec ?? '').toLowerCase().includes(q)
  })

  // No customer chosen yet → start from page 1
  if (!customer) return <Navigate to={MOBILE_SALES} replace />

  return (
    <div className={styles.page}>
      <MobileHeader />

      <div className={styles.sj}>
        &nbsp;销售开单&nbsp;{customer.code}&nbsp;{customer.name}
      </div>

      <RecentCustomers onSelect={selectCustomer} />

      <div className={styles.searchRow}>
        &nbsp;<SearchIcon />查找产品
        <input
          className={styles.searchInput}
          type="text"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          onBlur={() => setAppliedSearch(searchText.trim())}
          onKeyDown={e => e.key === 'Enter' && setAppliedSearch(searchText.trim())}
        />
      </div>
      {/* fixed column widths: fits the screen width, long names wrap instead of scrolling sideways */}
      <table className={styles.prodTable}>
        <colgroup>
          <col style={{ width: '17%' }} />
          <col />
          <col style={{ width: '10%' }} />
          <col style={{ width: '15%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '13%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>编码</th>
            <th>品名 规格 等级</th>
            <th>包装</th>
            <th>库存</th>
            <th>单价</th>
            <th>加入</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(p => (
            <tr key={p.id}>
              <td>{p.supplierCode}<br /><span className={styles.bold}>{p.code}</span></td>
              <td>{p.name} <em>{p.spec ?? ''}</em> {p.grade ?? ''}</td>
              <td>{p.unitsPerPiece ?? ''}</td>
              <td><span className={styles.bold}>{p.stock}</span>{p.unit ?? ''}</td>
              <td><em>{p.price != null ? +p.price.toFixed(2) : ''}</em></td>
              <td className={styles.center}>
                <span className={styles.plusBtn} onClick={() => navigate(`/m/sales/add/${p.id}`)}>
                  <svg width="34" height="34" viewBox="0 0 40 40">
                    <path d="M15 3 H25 V15 H37 V25 H25 V37 H15 V25 H3 V15 H15 Z" fill="#66EE00" stroke="#339900" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.footSpace} />
      <SalesFooter onCategory={() => setShowCategories(true)} />

      {showCategories && (
        <CategoryOverlay
          onSelect={c => { setCategory(c); setShowCategories(false) }}
          onClose={() => setShowCategories(false)}
        />
      )}
    </div>
  )
}
