import { useState } from 'react'
import type { Supplier } from '@/api/suppliers'
import styles from './PurchaseIn.module.css'

interface Props {
  suppliers: Supplier[]
  onSelect: (s: Supplier) => void
  onClose: () => void
}

// 请选择供应商 — full-screen overlay (old buy_xzkh_list.asp)
export default function SupplierPicker({ suppliers, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState('')
  const [sort, setSort] = useState<'code' | 'name'>('code')

  const list = suppliers
    .filter(s =>
      applied === '' ||
      s.code.toLowerCase().includes(applied.toLowerCase()) ||
      s.name.toLowerCase().includes(applied.toLowerCase()))
    .sort((a, b) => a[sort].localeCompare(b[sort], 'zh-CN'))

  return (
    <div className={styles.overlay}>
      <div className={styles.overlayTitle}>
        请选择供应商
        <span className={styles.overlayClose} onClick={onClose}>✕</span>
      </div>
      <div className={styles.overlayBar}>
        查找供应商
        <input
          className={styles.overlaySearch}
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && setApplied(search.trim())}
        />
        <select value={sort} onChange={e => setSort(e.target.value as 'code' | 'name')}>
          <option value="code">按编码排序</option>
          <option value="name">按名称排序</option>
        </select>
        <input type="button" value="查找" onClick={() => setApplied(search.trim())} />
      </div>
      <div className={styles.overlayList}>
        {list.map(s => (
          <span key={s.id} className={styles.overlayItem} onClick={() => { onSelect(s); onClose() }}>
            <span className={styles.overlayCode}>{s.code}</span>&nbsp;{s.name}
          </span>
        ))}
      </div>
    </div>
  )
}
