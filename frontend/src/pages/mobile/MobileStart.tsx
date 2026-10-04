import { useNavigate } from 'react-router-dom'
import { MobileHeader, SalesFooter, RecentCustomers, useSalesDraft } from './MobileShell'
import styles from './Mobile.module.css'

// 手机开单 — page 1: always starts here, 点击这里选择 → page 2 (选择客户)
export default function MobileStart() {
  const navigate = useNavigate()
  const { selectCustomer } = useSalesDraft()
  const pickCustomer = () => navigate('/m/sales/customers')

  return (
    <div className={styles.page}>
      <MobileHeader />

      <div className={styles.sj}>&nbsp;销售开单</div>

      <RecentCustomers onSelect={selectCustomer} />

      <div className={styles.pickBox} onClick={pickCustomer}>
        <div>开销售单前请选择一个客户</div>
        <div>点击这里选择</div>
      </div>

      <div className={styles.footSpace} />
      {/* no customer yet: 分类 also leads to 选择客户 first */}
      <SalesFooter onCategory={pickCustomer} />
    </div>
  )
}
