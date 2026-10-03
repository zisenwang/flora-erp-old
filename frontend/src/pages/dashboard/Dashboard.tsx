import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { getDashboardSummary, type DashboardSummary, type DailySalesRow } from '@/api/dashboard'
import { getSalesGroup, getRankings, type ReportGroupRow } from '@/api/reports'
import { getProducts } from '@/api/products'
import { getCustomers } from '@/api/customers'
import { getSuppliers } from '@/api/suppliers'
import { peekSalesDraftCustomer } from '@/utils/salesDraft'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [supplierRank, setSupplierRank] = useState<ReportGroupRow[]>([])
  const [productRank, setProductRank] = useState<ReportGroupRow[]>([])
  const [productCount, setProductCount] = useState(0)
  const [customerCount, setCustomerCount] = useState(0)
  const [supplierCount, setSupplierCount] = useState(0)
  const [yearlyData, setYearlyData] = useState<ReportGroupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [draftCustomer] = useState(peekSalesDraftCustomer)  // 未提交销售单 from 销售单录入

  const today = dayjs().format('YYYY-MM-DD')
  const monthStart = dayjs().startOf('month').format('YYYY-MM-DD')
  const todayLabel = dayjs().format('YYYY/M/D')
  const yearStart = dayjs().startOf('year').format('YYYY-MM-DD')
  const currentYear = dayjs().format('YYYY')

  useEffect(() => {
    Promise.all([
      getDashboardSummary(),
      getSalesGroup({ by: 'supplier', startDate: monthStart, endDate: today }),
      getSalesGroup({ by: 'product', startDate: monthStart, endDate: today }),
      getProducts(),
      getCustomers(),
      getSuppliers(),
      getRankings({ type: 'sales', by: 'monthly', startDate: yearStart, endDate: today }),
    ]).then(([summary, suppliers, products, allProducts, allCustomers, allSuppliers, yearly]) => {
      setData(summary)
      setSupplierRank(suppliers)
      setProductRank(products)
      setProductCount(allProducts.length)
      setCustomerCount(allCustomers.length)
      setSupplierCount(allSuppliers.length)
      setYearlyData(yearly)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className={styles.loading}>数据加载中，请稍候...</div>
  if (!data) return null

  const todayRow = data.monthlySalesDaily.find(r => r.date === today)
  const monthNum = dayjs().format('M')

  const monthTotals = data.monthlySalesDaily.reduce(
    (acc, r: DailySalesRow) => ({
      qty: acc.qty + r.salesQty,
      amount: acc.amount + r.salesAmount,
      pieces: acc.pieces + r.pieces,
      returnQty: acc.returnQty + r.returnQty,
      returnAmount: acc.returnAmount + r.returnAmount,
    }),
    { qty: 0, amount: 0, pieces: 0, returnQty: 0, returnAmount: 0 },
  )

  // dynamic supplier columns: max 4 rows each, only as many tables as needed
  const SUPP_PER_COL = 4
  const numSupplierCols = Math.max(1, Math.ceil(supplierRank.length / SUPP_PER_COL))
  const supplierCols: ReportGroupRow[][] = Array.from({ length: numSupplierCols }, (_, ci) =>
    supplierRank.slice(ci * SUPP_PER_COL, ci * SUPP_PER_COL + SUPP_PER_COL)
  ).filter(col => col.length > 0)

  // 2 columns for products (match original HTML layout)
  const half = Math.ceil(productRank.length / 2)
  const productCol1 = productRank.slice(0, half)
  const productCol2 = productRank.slice(half)

  // number formatters
  const fmt = (n: number) => Math.round(n).toLocaleString('zh-CN')
  // amount with 1 decimal and commas like original: 42,798.0
  const fmtAmt = (n: number) =>
    n.toLocaleString('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  // yearly chart: raw number no commas, strip trailing .0
  const fmtYearAmt = (n: number) => n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)
  const fmtWanStrip = (n: number) => {
    const s = (n / 10000).toFixed(1)
    return s.endsWith('.0') ? s.slice(0, -2) : s
  }

  return (
    <div className={styles.page}>

      {/* ── Alert bar: 未提交销售单 ── */}
      <div className={styles.alertOuter}>
        <div className={styles.alertInner}>
          &nbsp;未提交销售单:
          {draftCustomer == null
            ? '（暂无）'
            : <span className={styles.alertLink} onClick={() => navigate('/sales/orders/new')}>{draftCustomer || '（未选客户）'}</span>}
        </div>
      </div>

      <div className={styles.layout}>

        {/* ════ LEFT: stacked rows ════ */}
        <div className={styles.main}>

          {/* ── Row 1: Sales + Counts ── */}
          <div className={styles.row1}>

            {/* Sales panel — green border #009933 */}
            <div className={styles.panel} style={{ borderColor: '#009933' }}>
              <div className={styles.panelBody}>
                <div className={styles.sRow}>
                  <span className={styles.dot}>○</span>
                  今日销售:<em className={styles.hi}>{fmt(todayRow?.salesQty ?? 0)}</em>盆,共
                  <em className={styles.hi}>{fmt(data.todaySales)}</em>元(<em className={styles.hi}>0</em>)
                  &nbsp;<span className={styles.btnInline} onClick={() => navigate('/sales/orders/new')}>销售开单</span>
                </div>
                <div className={styles.sRow}>
                  <span className={styles.dot}>○</span>
                  {dayjs().format('M')}月销售:<em className={styles.hi}>{fmt(monthTotals.qty)}</em>盆,共
                  <em className={styles.hi}>{fmt(monthTotals.amount)}</em>元(<em className={styles.hi}>0</em>)
                </div>
                <div className={styles.sRow}>
                  <span className={styles.dot}>○</span>
                  今天新开<em className={styles.hi}>{data.todayOrderCount}</em>个销售单,本月共有
                  <em className={styles.hi}>{data.todayOrderCount}</em>个销售单
                </div>
                <div className={styles.sRow}>
                  <span className={styles.dot}>○</span>
                  今天新开<em className={styles.hi}>0</em>个进货单,本月共有
                  <em className={styles.hi}>0</em>个进货单
                </div>
                <div className={styles.sRow}>
                  <span className={styles.dot}>○</span>
                  今天新开<em className={styles.hi}>0</em>个报损单,本月共有
                  <em className={styles.hi}>0</em>个报损单
                </div>
              </div>
            </div>

            {/* Counts panel — red border #FF3300 */}
            <div className={styles.panel} style={{ borderColor: '#FF3300' }}>
              <div className={styles.panelBody}>
                <div className={styles.sRow}>
                  <span className={styles.dot}>○</span>
                  产品数量<em className={styles.hi}>{productCount}+</em>个
                  &nbsp;<span className={styles.btnInline} onClick={() => navigate('/inventory')}>查询库存</span>
                  &nbsp;<span className={styles.btnInline} onClick={() => navigate('/master/products')}>手工刷新库存</span>
                </div>
                <div className={styles.sRow}>
                  <span className={styles.dot}>○</span>
                  客户数量<em className={styles.hi}>{customerCount}+</em>个
                  &nbsp;<span className={styles.btnInline} onClick={() => navigate('/master/customers')}>客户资料</span>
                </div>
                <div className={styles.sRow}>
                  <span className={styles.dot}>○</span>
                  供应商数量<em className={styles.hi}>{supplierCount}+</em>个
                  &nbsp;<span className={styles.btnInline} onClick={() => navigate('/master/suppliers')}>供应商</span>
                </div>
                <div className={styles.sRow}>
                  <span className={styles.dot}>○</span>
                  今天有<em className={styles.hi}>1</em>个操作员登录系统
                </div>
              </div>
            </div>

          </div>

          {/* ── Supplier rank label (style7: plain bold) ── */}
          <div className={styles.sectionLabel}>本月供应商销售排行榜</div>

          {/* ── Supplier rankings: up to 5 tables, 4 rows each, only shown if data exists ── */}
          <div className={styles.tableRow}>
            {supplierCols.map((col, ci) => (
              <table key={ci} className={styles.rankTable}>
                <thead>
                  <tr>
                    <th>序号</th><th>供应商</th><th>销售</th><th>金额</th><th>退货</th>
                  </tr>
                </thead>
                <tbody>
                  {col.map((r, ri) => (
                    <tr key={ri}>
                      <td className={styles.tc}>{ci * SUPP_PER_COL + ri + 1}</td>
                      <td>&nbsp;{r.name ?? '-'}&nbsp;</td>
                      <td className={styles.tr}>&nbsp;{fmt(r.totalQty)}&nbsp;</td>
                      <td className={styles.tr}>&nbsp;{fmtAmt(r.totalAmount)}&nbsp;</td>
                      <td className={styles.tc}>-</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>

          {/* ── Product rank label (style7: plain bold) ── */}
          <div className={styles.sectionLabel}>本月产品销售排行榜</div>

          {/* ── Product rankings: 2 tables + yearly chart side by side ── */}
          <div className={styles.tableRow}>
            {[productCol1, productCol2].map((col, ci) => (
              <table key={ci} className={styles.rankTable}>
                <thead>
                  <tr>
                    <th>序号</th><th>产品信息</th><th>今日销售</th><th>均价</th><th>退货</th>
                  </tr>
                </thead>
                <tbody>
                  {col.map((item, ri) => {
                    const globalIdx = ci * half + ri
                    const avg = item.totalQty > 0 ? item.totalAmount / item.totalQty : 0
                    return (
                      <tr key={ri}>
                        <td className={styles.tc}>{globalIdx + 1}</td>
                        <td>&nbsp;{item.name}&nbsp;</td>
                        <td className={styles.tr} style={{ whiteSpace: 'nowrap' }}>
                          &nbsp;{fmt(item.totalQty)}(￥<span className={styles.hi}>{fmtAmt(item.totalAmount)}</span>)&nbsp;{item.totalPieces ?? 0}件&nbsp;
                        </td>
                        <td className={styles.tr}>&nbsp;<span className={styles.hi}>{avg.toFixed(2)}</span>&nbsp;</td>
                        <td className={styles.tc}>-</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ))}

            {/* ── 年度月销售数据 (2026年的数据) ── */}
            {yearlyData.length > 0 && (() => {
              const maxAmt = Math.max(...yearlyData.map(r => r.totalAmount), 1)
              const maxBarPx = 100
              const yearTotal = yearlyData.reduce((s, r) => s + r.totalAmount, 0)
              return (
                <table className={styles.yearTable}>
                  <tbody>
                    <tr>
                      <td className={styles.yearHead}>&nbsp;{currentYear}年的数据&nbsp;</td>
                    </tr>
                    {yearlyData.map((r, i) => {
                      const barW = Math.max(2, Math.round((r.totalAmount / maxAmt) * maxBarPx))
                      return [
                        <tr key={r.name}>
                          <td>
                            <table border={0} cellSpacing={0} cellPadding={0}>
                              <tbody>
                                <tr>
                                  <td className={styles.yearMonth}>&nbsp;{r.name?.slice(5)}月&nbsp;</td>
                                  <td style={{ width: barW, backgroundColor: '#FF3300' }}>&nbsp;</td>
                                  <td className={styles.yearAmt}>&nbsp;<em>{fmtYearAmt(r.totalAmount)}</em>({fmtWanStrip(r.totalAmount)}万元)</td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>,
                        i < yearlyData.length - 1 && <tr key={`sp-${r.name}`}><td style={{ height: 4 }}></td></tr>
                      ]
                    })}
                    <tr>
                      <td className={styles.yearTotal}>
                        &nbsp;合计:<em>{fmtYearAmt(yearTotal)}</em>&nbsp;({fmtWanStrip(yearTotal)}万元)
                      </td>
                    </tr>
                  </tbody>
                </table>
              )
            })()}
          </div>
        </div>

        {/* ════ RIGHT: monthly daily sales table ════ */}
        <div className={styles.dailySide}>
          <table className={styles.dailyTable}>
            <thead>
              <tr>
                <th>&nbsp;序号&nbsp;</th>
                <th>&nbsp;月份&nbsp;</th>
                <th>&nbsp;日期&nbsp;</th>
                <th>&nbsp;销售数量&nbsp;</th>
                <th>&nbsp;销售金额&nbsp;</th>
                <th>&nbsp;件数&nbsp;</th>
                <th>&nbsp;退货数量&nbsp;</th>
                <th>&nbsp;退货金额&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {data.monthlySalesDaily.map((r, i) => (
                <tr key={r.date}>
                  <td className={styles.tc}>&nbsp;{i + 1}&nbsp;</td>
                  {/* month only shows on first row, blank afterwards */}
                  <td>&nbsp;{i === 0 ? <em>{dayjs(r.date).format('M')}</em> : ''}{i === 0 ? '月' : ''}&nbsp;</td>
                  <td className={styles.tc}>&nbsp;<em>{dayjs(r.date).date()}</em>日&nbsp;</td>
                  <td className={styles.tr}>&nbsp;{fmt(r.salesQty)}&nbsp;</td>
                  <td className={styles.tr}>&nbsp;<em>{fmt(r.salesAmount)}</em>&nbsp;</td>
                  <td className={styles.tc}>&nbsp;{r.pieces}&nbsp;</td>
                  <td className={styles.tr}>&nbsp;{r.returnQty > 0 ? fmt(r.returnQty) : 0}&nbsp;</td>
                  <td className={styles.tr}>&nbsp;{r.returnAmount > 0 ? <em>{fmt(r.returnAmount)}</em> : <em>0</em>}&nbsp;</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {/* Orange divider row */}
              <tr><td colSpan={8} className={styles.divider}></td></tr>
              {/* Totals row */}
              <tr className={styles.totalRow}>
                <td colSpan={3} className={styles.tr}>{monthNum}合计</td>
                <td className={styles.tr}>&nbsp;{fmt(monthTotals.qty)}&nbsp;</td>
                <td className={styles.tr}>&nbsp;{fmt(monthTotals.amount)}&nbsp;</td>
                <td className={styles.tr}>&nbsp;{fmt(monthTotals.pieces)}&nbsp;</td>
                <td className={styles.tr}>&nbsp;{monthTotals.returnQty > 0 ? fmt(monthTotals.returnQty) : 0}&nbsp;</td>
                <td className={styles.tr}>&nbsp;{monthTotals.returnAmount > 0 ? fmt(monthTotals.returnAmount) : 0}&nbsp;</td>
              </tr>
              {/* Green summary row */}
              <tr className={styles.summaryRow}>
                <td colSpan={3}>&nbsp;{data.monthlySalesDaily.length}个记录</td>
                <td colSpan={3} className={styles.tc}>销售数量:{fmt(monthTotals.qty)}</td>
                <td colSpan={2} className={styles.tc}>销售金额:{fmt(monthTotals.amount)}</td>
              </tr>
            </tfoot>
          </table>
          <div style={{ textAlign: 'center', padding: '2px', fontSize: '11px', color: '#999' }}>
            {todayLabel}
          </div>
        </div>

      </div>
    </div>
  )
}
