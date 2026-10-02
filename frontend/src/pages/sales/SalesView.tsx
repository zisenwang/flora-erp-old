import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getSalesOrder, type SalesOrder } from '@/api/sales'
import { getProducts, type Product } from '@/api/products'
import { getErrorMessage } from '@/utils/error'
import { toSlashDate } from '@/utils/slashDate'
import styles from '@/pages/purchase/PurchaseDocs.module.css'

const fmt = (n: number) => String(+Number(n).toFixed(2))

// 单据明细 (销售单) — replicates old main_all_djmx_info.asp for a sales order (来源 dropped)
export default function SalesView() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [order, setOrder] = useState<SalesOrder | null>(null)
  const [productsById, setProductsById] = useState<Record<number, Product>>({})  // items carry no 规格 / 等级

  useEffect(() => {
    getSalesOrder(Number(id))
      .then(setOrder)
      .catch(err => alert(getErrorMessage(err)))
    getProducts()
      .then(list => setProductsById(Object.fromEntries(list.map(p => [p.id, p]))))
      .catch(() => {})
  }, [id])

  if (!order) return <div className={styles.loading}>数据加载中，请稍候...</div>

  const items = order.items ?? []
  const profitOf = (i: SalesOrder['items'][number]) => i.finalAmount - (i.costPrice ?? 0) * i.qty
  const totalQty = items.reduce((s, i) => s + i.qty, 0)
  const totalAmount = items.reduce((s, i) => s + i.finalAmount, 0)
  const totalProfit = items.reduce((s, i) => s + profitOf(i), 0)
  const totalPieces = items.reduce((s, i) => s + i.pieces, 0)
  const customer = `${order.customerCode} ${order.customerName}`

  return (
    <div className={styles.page}>
      <div className={styles.body}>
        <table className={styles.doc}>
          <thead>
            <tr>
              <th>类型</th>
              <th>客户/供应商/部门</th>
              <th>日期</th>
              <th>单号</th>
              <th>供应商</th>
              <th>编码</th>
              <th>产品名称&nbsp;&nbsp;规格&nbsp;&nbsp;等级</th>
              <th>单位</th>
              <th>数量</th>
              <th>单价</th>
              <th>金额</th>
              <th>进价</th>
              <th>毛利</th>
              <th>件数</th>
              <th>经办人</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            {items.map(i => {
              const p = productsById[i.productId]
              return (
                <tr key={i.id}>
                  <td>销售单</td>
                  <td>{customer}</td>
                  <td>{toSlashDate(order.orderDate)}</td>
                  <td>{order.orderNo}</td>
                  <td>{i.supplierCode}</td>
                  <td>{i.productCode}</td>
                  <td>{i.productName} {p?.spec ?? ''} {p?.grade ?? ''}</td>
                  <td className={styles.c}>{i.unit}</td>
                  <td className={styles.c}>{fmt(i.qty)}</td>
                  <td className={styles.c}>{fmt(i.unitPrice)}</td>
                  <td className={styles.c}>{fmt(i.finalAmount)}</td>
                  <td className={styles.c}>{fmt(i.costPrice ?? 0)}</td>
                  <td className={styles.c}>{fmt(profitOf(i))}</td>
                  <td className={styles.c}>{i.pieces}</td>
                  <td className={styles.c}>{order.operator ?? ''}</td>
                  <td>{i.notes ?? ''}</td>
                </tr>
              )
            })}
            <tr className={styles.docSumYellow}>
              <td colSpan={7} className={styles.c}>总共{items.length}个产品</td>
              <td className={styles.c}>合计</td>
              <td className={styles.c}>{fmt(totalQty)}</td>
              <td></td>
              <td className={styles.c}>¥{fmt(totalAmount)}</td>
              <td></td>
              <td className={styles.c}>¥{fmt(totalProfit)}</td>
              <td className={styles.c}>{fmt(totalPieces)}</td>
              <td colSpan={2}></td>
            </tr>
            <tr className={styles.docNotesRow}>
              <td colSpan={16}>{order.notes ?? ''}</td>
            </tr>
          </tbody>
        </table>

        <input className={styles.backBtn} type="button" value="返回上页" onClick={() => navigate(-1)} />

        <div className={styles.infoBox}>
          <div className={styles.infoTitle}>客户\供应商\部门信息</div>
          <div className={styles.infoBody} style={{ height: 'auto', minHeight: 56, paddingBottom: 6 }}>
            {order.customerCode}　{order.customerName}
            {order.customerAddress ? `\n${order.customerAddress}` : ''}
            {order.customerPhone ? `\n${order.customerPhone}` : ''}
          </div>
        </div>
      </div>
    </div>
  )
}
