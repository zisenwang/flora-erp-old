import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { getSalesOrders, type SalesOrder } from '@/api/sales'
import { getPurchaseOrders, type PurchaseOrder } from '@/api/purchase'
import { getSalesGroup, type ReportGroupRow } from '@/api/reports'
import { useAuth } from '@/store/AuthContext'
import { getErrorMessage } from '@/utils/error'
import { preferDesktop } from '@/utils/device'
import { MobileHeader, MOBILE_SALES } from './MobileShell'
import styles from './Mobile.module.css'

const fmt = (n: number) => String(+n.toFixed(2))

interface Totals { qty: number; amount: number; count: number }

const sum = (orders: { totalQty: number; totalAmount: number }[]): Totals => ({
  qty: orders.reduce((s, o) => s + o.totalQty, 0),
  amount: orders.reduce((s, o) => s + o.totalAmount, 0),
  count: orders.length,
})

interface RankData {
  supplierToday: ReportGroupRow[]
  supplierMonth: ReportGroupRow[]
  productToday: ReportGroupRow[]
  productMonth: ReportGroupRow[]
  customerMonth: ReportGroupRow[]
}

// 手机版首页 (old jhsmpS/main.asp) — only 手机开单 kept of the 5 green buttons; 订单汇总 dropped (no 预订 in backend)
export default function MobileHome() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [sales, setSales] = useState<SalesOrder[]>([])
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([])
  const [ranks, setRanks] = useState<RankData | null>(null)

  const today = dayjs().format('YYYY-MM-DD')
  const monthStart = dayjs().startOf('month').format('YYYY-MM-DD')

  useEffect(() => {
    const month = { startDate: monthStart, endDate: today }
    const day = { startDate: today, endDate: today }
    Promise.all([
      getSalesOrders(month),
      getPurchaseOrders(month),
      getSalesGroup({ by: 'supplier', ...day }),
      getSalesGroup({ by: 'supplier', ...month }),
      getSalesGroup({ by: 'product', ...day }),
      getSalesGroup({ by: 'product', ...month }),
      getSalesGroup({ by: 'customer', ...month }),
    ]).then(([so, po, supplierToday, supplierMonth, productToday, productMonth, customerMonth]) => {
      setSales(so.filter(o => o.status !== '作废'))
      setPurchases(po.filter(o => o.status !== '作废'))
      setRanks({ supplierToday, supplierMonth, productToday, productMonth, customerMonth })
    }).catch(err => alert(getErrorMessage(err)))
  }, [today, monthStart])

  const isToday = (d: string) => dayjs(d).format('YYYY-MM-DD') === today
  const salesToday = sum(sales.filter(o => isToday(o.orderDate)))
  const salesMonth = sum(sales)
  const buyToday = sum(purchases.filter(o => isToday(o.orderDate)))
  const buyMonth = sum(purchases)

  function toDesktop() {
    preferDesktop()
    navigate('/')
  }

  const avg = (r: ReportGroupRow) => (r.totalQty > 0 ? (r.totalAmount / r.totalQty).toFixed(2) : '0')

  return (
    <div className={styles.page}>
      <MobileHeader />

      <div className={styles.homeBtnRow}>
        <span className={styles.homeBtn} onClick={() => navigate(MOBILE_SALES)}>手机开单</span>
      </div>

      {/* ── 销售汇总 / 采购汇总 (red frame) ── */}
      <div className={styles.redBox}>
        <div className={styles.sumTitle}><span className={styles.sumDot}>●</span>&nbsp;销售汇总</div>
        <div className={styles.sumRow}>
          今日:<em>{fmt(salesToday.qty)}</em>盆,共<em>{fmt(salesToday.amount)}</em>元,总<em>{salesToday.count}</em>个单(<em>0</em>)
        </div>
        <div className={styles.sumRow}>
          本月:<em>{fmt(salesMonth.qty)}</em>盆,共<em>{fmt(salesMonth.amount)}</em>元,总<em>{salesMonth.count}</em>个单(<em>0</em>)
        </div>
        <div className={styles.sumTitle}><span className={styles.sumDot}>●</span>&nbsp;采购汇总</div>
        <div className={styles.sumRow}>
          今日采购:<em>{fmt(buyToday.qty)}</em>盆,共<em>{fmt(buyToday.amount)}</em>元,总<em>{buyToday.count}</em>个单
        </div>
        <div className={styles.sumRow}>
          本月采购:<em>{fmt(buyMonth.qty)}</em>盆,共<em>{fmt(buyMonth.amount)}</em>元,总<em>{buyMonth.count}</em>个单
        </div>
      </div>

      {/* ── 操作员 / 切换到电脑版 (blue frame) ── */}
      <div className={styles.blueBox}>
        &nbsp;今天有<em>1</em>个操作员登录&nbsp;&nbsp;
        <a className={styles.toDesktop} onClick={toDesktop}>切换到电脑版<span className={styles.gotoArrow}>➜</span></a>
      </div>

      {ranks && (
        <>
          <table className={styles.homeTable} style={{ background: '#CCCCCC' }}>
            <thead>
              <tr style={{ background: '#00CC66' }}>
                <th>&nbsp;序号&nbsp;</th><th>&nbsp;供应商&nbsp;</th><th>&nbsp;今日销售&nbsp;</th><th>&nbsp;今日退货&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {ranks.supplierToday.map((r, i) => (
                <tr key={r.id}>
                  <td className={styles.center}>{i + 1}</td>
                  <td>&nbsp;{r.name}</td>
                  <td>&nbsp;{fmt(r.totalQty)}(￥<em>{fmt(r.totalAmount)}</em>)</td>
                  <td className={styles.center}>-</td>
                </tr>
              ))}
            </tbody>
          </table>

          <table className={styles.homeTable} style={{ background: '#FF99FF' }}>
            <thead>
              <tr style={{ background: '#0000FF' }}>
                <th>&nbsp;序号&nbsp;</th><th>&nbsp;供应商&nbsp;</th><th>&nbsp;本月销售&nbsp;</th><th>&nbsp;本月退货&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {ranks.supplierMonth.map((r, i) => (
                <tr key={r.id}>
                  <td className={styles.center}>{i + 1}</td>
                  <td>&nbsp;{r.name}</td>
                  <td>&nbsp;{fmt(r.totalQty)}(￥<em>{fmt(r.totalAmount)}</em>)</td>
                  <td className={styles.center}>-</td>
                </tr>
              ))}
            </tbody>
          </table>

          <table className={styles.homeTable} style={{ background: '#CCCCCC' }}>
            <thead>
              <tr style={{ background: '#3366FF' }}>
                <th>&nbsp;序&nbsp;</th><th>&nbsp;产品&nbsp;</th><th>&nbsp;今日销售&nbsp;</th><th>&nbsp;均价&nbsp;</th><th>&nbsp;退货&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {ranks.productToday.map((r, i) => (
                <tr key={r.id}>
                  <td className={styles.center}>{i + 1}</td>
                  <td>&nbsp;{r.name}</td>
                  <td>&nbsp;{fmt(r.totalQty)}(￥<em>{fmt(r.totalAmount)}</em>)</td>
                  <td>&nbsp;<em>{avg(r)}</em></td>
                  <td className={styles.center}>-</td>
                </tr>
              ))}
            </tbody>
          </table>

          <table className={styles.homeTable} style={{ background: '#FF99FF' }}>
            <thead>
              <tr style={{ background: '#FF6600' }}>
                <th>&nbsp;序&nbsp;</th><th>&nbsp;产品&nbsp;</th><th>&nbsp;本月销售&nbsp;</th><th>&nbsp;均价&nbsp;</th><th>&nbsp;退货&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {ranks.productMonth.map((r, i) => (
                <tr key={r.id}>
                  <td className={styles.center}>{i + 1}</td>
                  <td>&nbsp;{r.name}</td>
                  <td>&nbsp;{fmt(r.totalQty)}(￥<em>{fmt(r.totalAmount)}</em>)</td>
                  <td>&nbsp;<em>{avg(r)}</em></td>
                  <td className={styles.center}>-</td>
                </tr>
              ))}
            </tbody>
          </table>

          <table className={styles.homeTable} style={{ background: '#CC99FF' }}>
            <thead>
              <tr style={{ background: '#FF00FF' }}>
                <th>&nbsp;序&nbsp;</th><th>&nbsp;客户&nbsp;</th><th>&nbsp;本月销售&nbsp;</th><th>&nbsp;退货&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {ranks.customerMonth.map((r, i) => (
                <tr key={r.id}>
                  <td className={styles.center}>{i + 1}</td>
                  <td>&nbsp;{r.name}</td>
                  <td>&nbsp;{fmt(r.totalQty)}(￥<em>{fmt(r.totalAmount)}</em>)</td>
                  <td className={styles.center}>-</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className={styles.footSpace} />
      <div className={styles.footer}>
        <div className={styles.footItem} onClick={() => window.scrollTo(0, 0)}>返回顶部</div>
        <div className={styles.footItem} onClick={toDesktop}>电脑版查看</div>
        <div className={styles.footItem} onClick={logout}>退出系统</div>
      </div>
    </div>
  )
}
