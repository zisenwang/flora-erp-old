import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCustomers, deleteCustomer, type Customer } from '@/api/customers'
import { getErrorMessage } from '@/utils/error'
import { EditIcon, DeleteIcon, SearchIcon } from './SupplierIcons'
import sup from './Suppliers.module.css'
import styles from './Customers.module.css'

type SortKey = 'code' | 'phone'

const PAGE_SIZE = 50
const PAGE_WINDOW = 10

// 客户资料(会员) — replicates old members.asp
export default function Customers() {
  const navigate = useNavigate()

  // ── Data state ───────────────────────────────────────────────
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  // ── Filter / search / sort state ─────────────────────────────
  const [searchBy, setSearchBy] = useState('mc')         // field selector
  const [searchText, setSearchText] = useState('')       // search text input
  const [appliedSearch, setAppliedSearch] = useState('') // committed search value
  const [appliedBy, setAppliedBy] = useState('mc')
  const [sortKey, setSortKey] = useState<SortKey>('code')
  const [page, setPage] = useState(1)

  // ── Load data ────────────────────────────────────────────────
  const loadAll = useCallback(() => {
    setLoading(true)
    getCustomers()
      .then(setCustomers)
      .catch(err => alert(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Derived: customers after search + sort ───────────────────
  const filtered = customers
    .filter(c => {
      if (!appliedSearch) return true
      const q = appliedSearch.toLowerCase()
      switch (appliedBy) {
        case 'bm': return c.code.toLowerCase().includes(q)
        case 'dh': return (c.phone ?? '').toLowerCase().includes(q)
        case 'mc':
        default:   return c.name.toLowerCase().includes(q)
      }
    })
    .sort((a, b) => (a[sortKey] ?? '').localeCompare(b[sortKey] ?? '', 'zh-CN'))

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const windowStart = Math.floor((page - 1) / PAGE_WINDOW) * PAGE_WINDOW + 1
  const windowEnd = Math.min(windowStart + PAGE_WINDOW - 1, totalPages)

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1) }, [appliedSearch, appliedBy, sortKey])

  // ── Actions ──────────────────────────────────────────────────
  function handleSearch() {
    setAppliedSearch(searchText.trim())
    setAppliedBy(searchBy)
  }

  function handleShowAll() {
    setSearchText('')
    setAppliedSearch('')
    setSortKey('code')
  }

  async function handleDelete(c: Customer) {
    if (!window.confirm('此操作将直接把客户资料删除掉,并且不可恢复,真的要进行吗?')) return
    try {
      await deleteCustomer(c.id)
      loadAll()
    } catch (err) {
      alert(getErrorMessage(err))
    }
  }

  // ── Render ───────────────────────────────────────────────────
  if (loading) return <div className={sup.loading}>数据加载中，请稍候...</div>

  return (
    <div className={sup.page}>

      {/* ── Sub-toolbar ── */}
      <div className={sup.subbar}>
        <SearchIcon />
        <select value={searchBy} onChange={e => setSearchBy(e.target.value)}>
          <option value="mc">客户名称</option>
          <option value="bm">客户编码</option>
          <option value="dh">电话</option>
        </select>
        <input
          className={sup.searchInput}
          type="text"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <input type="button" value="查找" onClick={handleSearch} />
        <input type="button" value="显示全部" onClick={handleShowAll} />
        &nbsp;
        <span className={sup.btnAddSupp} style={{ width: 78 }} onClick={() => navigate('/master/customers/new')}>新增客户资料</span>
      </div>

      <div className={sup.body}>
        <table className={styles.grid}>
          <thead>
            <tr>
              <th>&nbsp;<a className={sup.plk} onClick={() => setSortKey('code')}>客户名称</a>&nbsp;</th>
              <th>&nbsp;<a className={sup.plk} onClick={() => setSortKey('phone')}>电话</a>&nbsp;</th>
              <th>&nbsp;详细地址&nbsp;</th>
              <th className={styles.center}>&nbsp;操作&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {paged.map(c => (
              <tr key={c.id}>
                <td>&nbsp;<strong className={styles.code}>{c.code}</strong>&nbsp;<span className={styles.pink}>{c.name}</span>&nbsp;</td>
                <td>&nbsp;&nbsp;<span className={styles.pink}>{c.phone ?? ''}</span>&nbsp;</td>
                <td>&nbsp;{c.address ?? ''}&nbsp;</td>
                <td className={styles.center}>
                  <EditIcon onClick={() => navigate(`/master/customers/edit/${c.id}`)} />
                  <DeleteIcon onClick={() => handleDelete(c)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Legend ── */}
        <div className={sup.legend}>
          <EditIcon />修改客户,<DeleteIcon />删除客户。
        </div>

        {/* ── Pager: 10-page window + 上一页 / 下一页 ── */}
        <table className={sup.pager}>
          <tbody>
            <tr>
              <td className={sup.pagerTotal}>
                &nbsp;总<span className={sup.num}>{filtered.length}</span>个,共<span className={sup.num}>{totalPages}</span>页&nbsp;
              </td>
              <td>&nbsp;</td>
              {page > 1 && (
                <td>&nbsp;<a className={sup.pageLink} onClick={() => setPage(page - 1)}>上一页</a>&nbsp;</td>
              )}
              {Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => windowStart + i).map(n => (
                <td key={n} className={n === page ? sup.pageActive : undefined}>
                  &nbsp;<a className={sup.pageLink} onClick={() => setPage(n)}>{n}</a>&nbsp;
                </td>
              ))}
              {page < totalPages && (
                <td>&nbsp;<a className={sup.pageLink} onClick={() => setPage(page + 1)}>下一页</a>&nbsp;</td>
              )}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
