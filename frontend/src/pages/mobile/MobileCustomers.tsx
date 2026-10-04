import { useEffect, useState } from 'react'
import { getCustomers, type Customer } from '@/api/customers'
import { getErrorMessage } from '@/utils/error'
import { toDraftCustomer } from '@/utils/salesDraft'
import { MobileHeader, BackFooter, useSalesDraft } from './MobileShell'
import styles from './Mobile.module.css'

// Quick-search links under 查找客户, as in the old mxs_xzkh_list.asp
const CITY_ROWS = [
  ['昆明', '广州', '北京', '深圳', '武汉', '西安', '郑州', '成都', '新疆', '杭州'],
  ['上海', '兰州', '贵阳', '重庆', '汕头', '山东'],
]

type SortBy = 'code' | 'name'

// 手机开单 — page 2 (mxs_xzkh_list.asp): 选择此客户 (按联系人排序 dropped: no 联系人 field)
export default function MobileCustomers() {
  const { selectCustomer } = useSalesDraft()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchText, setSearchText] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('code')

  useEffect(() => {
    getCustomers().then(setCustomers).catch(err => alert(getErrorMessage(err)))
  }, [])

  const q = appliedSearch.toLowerCase()
  const shown = customers
    .filter(c => !q ||
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      (c.address ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').includes(q))
    .sort((a, b) => sortBy === 'name'
      ? a.name.localeCompare(b.name, 'zh-CN')
      : a.code.localeCompare(b.code, undefined, { numeric: true }))

  function search(text: string) {
    setSearchText(text)
    setAppliedSearch(text.trim())
  }

  return (
    <div className={styles.page}>
      <MobileHeader />

      <div className={styles.custSearch}>
        查找客户
        <input
          className={styles.custSearchInput}
          type="text"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search(searchText)}
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}>
          <option value="code">按编码排序</option>
          <option value="name">按名称排序</option>
        </select>
        <input type="button" value="查找" onClick={() => search(searchText)} />
      </div>
      {CITY_ROWS.map((row, i) => (
        <div key={i} className={styles.cityRow}>
          {i === 0 && <><a onClick={() => search('')}>全部</a>&nbsp;&nbsp;</>}
          {row.map(city => (
            <span key={city}><a onClick={() => search(city)}>{city}</a>&nbsp;&nbsp;</span>
          ))}
        </div>
      ))}

      <div className={styles.custList}>
        {shown.map(c => (
          <div key={c.id} className={styles.custRow} onClick={() => selectCustomer(toDraftCustomer(c))}>
            <span className={styles.custBtn}>选择此客户</span>
            &nbsp;{c.code}&nbsp;&nbsp;{c.name}
          </div>
        ))}
      </div>

      <div className={styles.footSpace} />
      <BackFooter />
    </div>
  )
}
