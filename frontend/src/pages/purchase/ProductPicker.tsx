import { useState, type ReactNode } from 'react'
import type { Product } from '@/api/products'
import { SearchIcon } from '@/pages/master/SupplierIcons'
import styles from './PurchaseDocs.module.css'

interface Props {
  products: Product[]
  /** 'add' → native 加入 button (向此单追加产品); 'replace' → red 用此更换 (更换产品) */
  mode: 'add' | 'replace'
  /** optional block above the search (the line being replaced) */
  header?: ReactNode
  onPick: (p: Product) => void
  onClose: () => void
}

// 请选择产品 — full-screen overlay (old prods_xz.asp / add-product picker)
export default function ProductPicker({ products, mode, header, onPick, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState('')

  const list = products.filter(p => {
    if (!applied) return true
    const q = applied.toLowerCase()
    return p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || (p.spec ?? '').toLowerCase().includes(q)
  })

  return (
    <div className={styles.overlay}>
      <div className={styles.overlayTitle}>
        请选择产品
        <span className={styles.overlayClose} onClick={onClose}>✕</span>
      </div>
      <div className={styles.overlayBody}>
        {header}
        <div className={styles.pickSearch}>
          <SearchIcon />查找产品(输入编码\品名)
          <input
            className={styles.pickInput}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && setApplied(search.trim())}
          />
          <input type="button" value="查找" onClick={() => setApplied(search.trim())} />
        </div>
        <table className={styles.grid}>
          <thead>
            <tr>
              <th>&nbsp;ID&nbsp;</th>
              <th>&nbsp;分类&nbsp;</th>
              <th>&nbsp;供应商&nbsp;</th>
              <th>&nbsp;编码&nbsp;</th>
              <th>&nbsp;品名&nbsp;</th>
              <th>&nbsp;规格&nbsp;</th>
              <th>&nbsp;等级&nbsp;</th>
              <th>&nbsp;单价&nbsp;</th>
              <th>&nbsp;包装&nbsp;</th>
              <th>&nbsp;单位&nbsp;</th>
              <th>&nbsp;库存&nbsp;</th>
              <th>&nbsp;选择&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {list.map(p => (
              <tr key={p.id} className={styles.row}>
                <td className={styles.c}>&nbsp;{p.id}&nbsp;</td>
                <td className={styles.c}>&nbsp;{p.category ?? ''}&nbsp;</td>
                <td>&nbsp;{p.supplierCode}&nbsp;{p.supplierName}&nbsp;</td>
                <td>&nbsp;{p.code}&nbsp;</td>
                <td>&nbsp;{p.name}&nbsp;</td>
                <td>&nbsp;{p.spec ?? ''}&nbsp;</td>
                <td>&nbsp;{p.grade ?? ''}&nbsp;</td>
                <td className={styles.pickPrice}>&nbsp;{p.costPrice != null ? +p.costPrice : ''}&nbsp;</td>
                <td>&nbsp;{p.unitsPerPiece ?? ''}&nbsp;</td>
                <td>&nbsp;{p.unit ?? ''}&nbsp;</td>
                <td className={styles.c}>&nbsp;{p.stock}&nbsp;</td>
                <td className={styles.c}>
                  {mode === 'replace'
                    ? <span className={styles.useBtn} onClick={() => onPick(p)}>用此更换</span>
                    : <input type="button" value="加入" onClick={() => onPick(p)} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
