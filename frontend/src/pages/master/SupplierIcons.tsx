// Recreations of the old ../mmimg/*.gif operation images (edit.gif, delete1.gif, xzcp.gif, cw4.gif)
import styles from './Suppliers.module.css'

interface OpProps {
  onClick?: () => void
  title?: string
}

// edit.gif — 22x20 notepad with pencil
export function EditIcon({ onClick, title }: OpProps) {
  return (
    <span className={styles.opImg} style={{ width: 22 }} onClick={onClick} title={title}>
      <svg width="20" height="18" viewBox="0 0 20 18">
        <rect x="4.5" y="3.5" width="10" height="12" fill="#FFFFCC" stroke="#808080" />
        <line x1="6" y1="6.5" x2="12" y2="6.5" stroke="#404040" />
        <line x1="6" y1="8.5" x2="11" y2="8.5" stroke="#404040" />
        <line x1="6" y1="10.5" x2="10" y2="10.5" stroke="#404040" />
        <line x1="6" y1="12.5" x2="9" y2="12.5" stroke="#404040" />
        <polygon points="15,2 17.5,3.5 12,14 10.5,14.8 10.2,13" fill="#FFE800" stroke="#000" strokeWidth="0.8" />
        <polygon points="15,2 17.5,3.5 18,2.6 15.6,1.2" fill="#C00000" />
      </svg>
    </span>
  )
}

// look.gif — 22x20 dark goggles
export function LookIcon({ onClick, title }: OpProps) {
  return (
    <span className={styles.opImg} style={{ width: 22 }} onClick={onClick} title={title}>
      <svg width="20" height="18" viewBox="0 0 20 18">
        <rect x="2" y="6" width="16" height="3" rx="1" fill="#808080" />
        <ellipse cx="6" cy="10.5" rx="3.6" ry="3" fill="#202020" stroke="#606060" />
        <ellipse cx="14" cy="10.5" rx="3.6" ry="3" fill="#202020" stroke="#606060" />
        <rect x="9.2" y="9" width="1.6" height="2" fill="#404040" />
        <line x1="4" y1="9.5" x2="6" y2="9.5" stroke="#9A9A9A" />
        <line x1="12" y1="9.5" x2="14" y2="9.5" stroke="#9A9A9A" />
      </svg>
    </span>
  )
}

// delete1.gif — 22x20 black X
export function DeleteIcon({ onClick, title }: OpProps) {
  return (
    <span className={styles.opImg} style={{ width: 22 }} onClick={onClick} title={title}>
      <svg width="20" height="18" viewBox="0 0 20 18">
        <line x1="4" y1="3" x2="15" y2="14" stroke="#000" strokeWidth="2.2" />
        <line x1="15" y1="3" x2="4" y2="14" stroke="#000" strokeWidth="2.2" />
        <rect x="15" y="14" width="1" height="1" fill="#000" />
      </svg>
    </span>
  )
}

// xzcp.gif — 50x20 blue "新增产品"
export function AddProductIcon({ onClick, title }: OpProps) {
  return (
    <span className={`${styles.opImg} ${styles.opText}`} style={{ width: 50 }} onClick={onClick} title={title}>
      新增产品
    </span>
  )
}

// cw4.gif — 16x16 magnifier
export function SearchIcon() {
  return (
    <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 16 16">
      <circle cx="6.5" cy="6.5" r="4.2" fill="#E8F4FF" stroke="#4A6E9A" strokeWidth="1.6" />
      <line x1="9.6" y1="9.6" x2="14" y2="14" stroke="#8A5A2B" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}
