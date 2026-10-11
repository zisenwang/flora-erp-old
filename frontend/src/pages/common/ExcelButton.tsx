import styles from './ExcelButton.module.css'

// 导出EXCEL — stands in for the old excel.gif link on list / report toolbars
export default function ExcelButton({ onClick }: { onClick: () => void }) {
  return <span className={styles.btn} title="导出EXCEL" onClick={onClick}>导出EXCEL</span>
}
