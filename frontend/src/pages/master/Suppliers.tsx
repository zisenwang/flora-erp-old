import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSuppliers, deleteSupplier, type Supplier } from '@/api/suppliers'
import { getErrorMessage } from '@/utils/error'
import { EditIcon, DeleteIcon, AddProductIcon, SearchIcon } from './SupplierIcons'
import styles from './Suppliers.module.css'

type SortKey = 'code' | 'name' | 'address' | 'phone'

const PAGE_SIZE = 100

export default function Suppliers() {
  const navigate = useNavigate()

  // ── Data state ───────────────────────────────────────────────
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)

  // ── Filter / search / sort state ─────────────────────────────
  const [searchBy, setSearchBy] = useState('kmc')        // field selector
  const [searchText, setSearchText] = useState('')       // search text input
  const [appliedSearch, setAppliedSearch] = useState('') // committed search value
  const [appliedBy, setAppliedBy] = useState('kmc')
  const [sortKey, setSortKey] = useState<SortKey>('code')
  const [page, setPage] = useState(1)

  // ── Load data ────────────────────────────────────────────────
  const loadAll = useCallback(() => {
    setLoading(true)
    getSuppliers()
      .then(setSuppliers)
      .catch(err => alert(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Derived: suppliers after search + sort ───────────────────
  const filtered = suppliers
    .filter(s => {
      if (!appliedSearch) return true
      const q = appliedSearch.toLowerCase()
      switch (appliedBy) {
        case 'kbm': return s.code.toLowerCase().includes(q)
        case 'kdh': return (s.phone ?? '').toLowerCase().includes(q)
        case 'kmc':
        default:    return s.name.toLowerCase().includes(q)
      }
    })
    .sort((a, b) => (a[sortKey] ?? '').localeCompare(b[sortKey] ?? '', 'zh-CN'))

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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

  async function handleDelete(s: Supplier) {
    if (!window.confirm('此操作将直接把供应商资料删除掉,并且不可恢复,真的要进行吗?')) return
    try {
      await deleteSupplier(s.id)
      loadAll()
    } catch (err) {
      alert(getErrorMessage(err))
    }
  }

  // ── Render ───────────────────────────────────────────────────
  if (loading) return <div className={styles.loading}>数据加载中，请稍候...</div>

  const sortHeader = (key: SortKey, label: string) => (
    <th>&nbsp;<a className={styles.plk} onClick={() => setSortKey(key)}>{label}</a>&nbsp;</th>
  )

  return (
    <div className={styles.page}>

      {/* ── Sub-toolbar ── */}
      <div className={styles.subbar}>
        <SearchIcon />查找供应商
        <select value={searchBy} onChange={e => setSearchBy(e.target.value)}>
          <option value="kmc">供应商名称</option>
          <option value="kbm">供应商编码</option>
          <option value="kdh">电话</option>
        </select>
        <input
          className={styles.searchInput}
          type="text"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <input type="button" value="查找" onClick={handleSearch} />
        <input type="button" value="显示全部" onClick={handleShowAll} />
        &nbsp;
        <span className={styles.btnAddSupp} onClick={() => navigate('/master/suppliers/new')}>新增供应商资料</span>
      </div>

      <div className={styles.body}>
        <table className={styles.grid}>
          <thead>
            <tr>
              {sortHeader('code', '编码')}
              {sortHeader('name', '名称')}
              {sortHeader('address', '地址')}
              {sortHeader('phone', '电话')}
              <th className={styles.center}>&nbsp;备注&nbsp;</th>
              <th className={styles.center}>&nbsp;操作&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {paged.map(s => (
              <tr key={s.id}>
                <td>&nbsp;<em className={styles.code}>{s.code}</em>&nbsp;</td>
                <td>&nbsp;{s.name}&nbsp;</td>
                <td className={styles.wrap}>&nbsp;{s.address ?? ''}&nbsp;</td>
                <td className={styles.wrap}>&nbsp;{s.phone ?? ''}&nbsp;</td>
                <td className={styles.wrap}>&nbsp;{s.notes ?? ''}&nbsp;</td>
                <td className={styles.center}>
                  <EditIcon onClick={() => navigate(`/master/suppliers/edit/${s.id}`)} />
                  <DeleteIcon onClick={() => handleDelete(s)} />
                  <AddProductIcon onClick={() => navigate(`/master/products/new?supplierId=${s.id}`)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Legend ── */}
        <div className={styles.legend}>
          <EditIcon />修改供应商,<DeleteIcon />删除供应商，<AddProductIcon />为该供应商新增产品。
        </div>

        {/* ── Pager ── */}
        <table className={styles.pager}>
          <tbody>
            <tr>
              <td className={styles.pagerTotal}>
                &nbsp;总<span className={styles.num}>{filtered.length}</span>个,共<span className={styles.num}>{totalPages}</span>页&nbsp;
              </td>
              <td>&nbsp;</td>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <td key={n} className={n === page ? styles.pageActive : undefined}>
                  &nbsp;<a className={styles.pageLink} onClick={() => setPage(n)}>{n}</a>&nbsp;
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
