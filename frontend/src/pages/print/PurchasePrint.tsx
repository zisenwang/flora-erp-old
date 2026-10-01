import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { getPurchaseOrder, type PurchaseOrder } from '@/api/purchase'
import { getProducts } from '@/api/products'
import { useSettings } from '@/store/SettingsContext'
import { toChineseAmount } from '@/utils/chineseAmount'
import { getErrorMessage } from '@/utils/error'
import styles from './PurchasePrint.module.css'

const fmt = (n: number) => String(+Number(n).toFixed(2))

// 进货单打印 — replicates old dy_cgd.asp (opened in a new tab, no nav bar)
export default function PurchasePrint() {
  const { id } = useParams()
  const { settings } = useSettings()
  const [order, setOrder] = useState<PurchaseOrder | null>(null)
  const [specs, setSpecs] = useState<Record<number, string>>({})  // productId → 规格 (order items carry no spec)

  useEffect(() => {
    document.title = '云达ERP-进货单'
    getPurchaseOrder(Number(id))
      .then(o => {
        setOrder(o)
        return getProducts({ supplierId: o.supplierId })
      })
      .then(prods => setSpecs(Object.fromEntries(prods.map(p => [p.id, p.spec ?? '']))))
      .catch(err => alert(getErrorMessage(err)))
  }, [id])

  if (!order) return <div className={styles.loading}>数据加载中，请稍候...</div>

  const items = order.items ?? []
  const amount = items.reduce((s, i) => s + Number(i.amount), 0)

  return (
    <div className={styles.page}>
      <table className={styles.sheet}>
        <tbody>
          <tr>
            <td colSpan={2} className={styles.title}>{settings.print_title}进货单</td>
          </tr>
          <tr>
            <td colSpan={2} className={styles.c} style={{ height: 20 }}>
              地址:{settings.company_address}，电话:{settings.company_phone}
            </td>
          </tr>
          <tr>
            <td style={{ height: 20, width: 436 }}>&nbsp;供应商:&nbsp;{order.supplierCode}</td>
            <td className={styles.r} style={{ width: 247 }}>日期:{dayjs(order.orderDate).format('YYYY/M/D')}</td>
          </tr>
          <tr>
            <td style={{ height: 20 }}>&nbsp;电&nbsp; 话:&nbsp;{order.supplierPhone ?? ''}</td>
            <td className={styles.r}>单号:{order.orderNo}</td>
          </tr>
          <tr>
            <td colSpan={2}>
              <table className={styles.items}>
                <tbody>
                  <tr>
                    <td className={styles.c}>编码</td>
                    <td>&nbsp;货品名称</td>
                    <td className={styles.c}>规格</td>
                    <td className={styles.c}>单位</td>
                    <td className={styles.c}>数量</td>
                    <td className={styles.c}>单价</td>
                    <td className={styles.c}>金额</td>
                    <td className={styles.c}>折扣</td>
                    <td className={styles.c}>折后金额</td>
                    <td className={styles.c}>备注</td>
                  </tr>
                  {items.map(i => (
                    <tr key={i.id}>
                      <td className={styles.c}>{i.productCode}</td>
                      <td>&nbsp;{i.productName}</td>
                      <td className={styles.c}>{specs[i.productId] ?? ''}</td>
                      <td className={styles.c}>{i.unit}</td>
                      <td className={styles.c}>{fmt(i.qty)}</td>
                      <td className={styles.c}>{fmt(i.unitPrice)}</td>
                      <td className={styles.c}>{fmt(i.amount)}</td>
                      <td className={styles.c}>{fmt(i.discount)}</td>
                      <td className={styles.c}>{fmt(i.finalAmount)}</td>
                      <td>{i.notes ?? ''}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={4} className={styles.r}>小计:</td>
                    <td className={styles.c}>{fmt(order.totalQty)}</td>
                    <td></td>
                    <td className={styles.c}>{fmt(amount)}</td>
                    <td>&nbsp;</td>
                    <td className={styles.c}>{fmt(order.finalAmount)}</td>
                    <td>&nbsp;</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className={styles.r}>人民币:{toChineseAmount(Number(order.finalAmount))}</td>
                    <td className={styles.r}>合计:</td>
                    <td className={styles.c}>{fmt(order.totalQty)}</td>
                    <td></td>
                    <td className={styles.c}>{fmt(amount)}</td>
                    <td>&nbsp;</td>
                    <td className={styles.c}>{fmt(order.finalAmount)}</td>
                    <td>&nbsp;</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
          {order.notes && (
            <tr>
              <td colSpan={2} style={{ height: 20 }}>&nbsp;备注:&nbsp;{order.notes}</td>
            </tr>
          )}
          <tr>
            <td style={{ height: 20 }}>
              &nbsp;开单人：{order.operator ?? ''}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;收货人：&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;复核人：
            </td>
            <td className={styles.r}>第1页/共1页</td>
          </tr>
          <tr>
            <td colSpan={2} style={{ height: 40 }}></td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
