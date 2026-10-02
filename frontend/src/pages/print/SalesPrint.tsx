import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getSalesOrder, getSalesReturn } from '@/api/sales'
import { getProducts, type Product } from '@/api/products'
import { toChineseAmount } from '@/utils/chineseAmount'
import { getErrorMessage } from '@/utils/error'
import { toSlashDate } from '@/utils/slashDate'
import styles from './SalesPrint.module.css'

// header text is fixed on the old 送货单 (differs from the 进货单 title)
const PRINT_TITLE = { order: '广阔卉送货单', return: '广阔卉退货单' }
const PRINT_ADDRESS = '地址:广州市荔湾区花博园宏星路中段广阔卉'
const PRINT_PHONE = '联系电话:13059146326,13903057717'

// old print shows one decimal for money: 12.0 / 432.0
const money = (n: number) => Number(n).toFixed(1)
const qty = (n: number) => String(+Number(n).toFixed(2))

interface PrintLine {
  id: number
  productId: number
  productCode: string
  productName: string
  supplierCode: string
  unit: string
  qty: number
  unitPrice: number
  amount: number
  pieces: number
  notes: string | null
}

interface PrintDoc {
  no: string
  date: string
  customerCode: string
  customerName: string
  customerPhone: string | null
  customerAddress: string | null
  operator: string | null
  notes: string | null
  items: PrintLine[]
}

interface Props {
  kind?: 'order' | 'return'
}

// 销售送货单 / 退货单 — replicates old dy_xsd.asp (opened in a new tab, no nav bar)
export default function SalesPrint({ kind = 'order' }: Props) {
  const { id } = useParams()
  const isReturn = kind === 'return'
  const [order, setOrder] = useState<PrintDoc | null>(null)
  const [productsById, setProductsById] = useState<Record<number, Product>>({})  // items carry no 规格 / 等级

  useEffect(() => {
    document.title = isReturn ? '云达ERP-退货单' : '云达ERP-销售单'
    const load: Promise<PrintDoc> = isReturn
      ? getSalesReturn(Number(id)).then(r => ({
          no: r.returnNo, date: r.returnDate, customerCode: r.customerCode, customerName: r.customerName,
          customerPhone: r.customerPhone, customerAddress: r.customerAddress, operator: r.operator, notes: r.notes,
          items: r.items ?? [],
        }))
      : getSalesOrder(Number(id)).then(o => ({
          no: o.orderNo, date: o.orderDate, customerCode: o.customerCode, customerName: o.customerName,
          customerPhone: o.customerPhone, customerAddress: o.customerAddress, operator: o.operator, notes: o.notes,
          items: (o.items ?? []).map(i => ({ ...i, amount: i.finalAmount })),
        }))
    load.then(setOrder).catch(err => alert(getErrorMessage(err)))
    getProducts()
      .then(list => setProductsById(Object.fromEntries(list.map(p => [p.id, p]))))
      .catch(() => {})
  }, [id, isReturn])

  if (!order) return <div className={styles.loading}>数据加载中，请稍候...</div>

  const items = order.items ?? []
  const totalQty = items.reduce((s, i) => s + i.qty, 0)
  const totalAmount = items.reduce((s, i) => s + i.amount, 0)
  const totalPieces = items.reduce((s, i) => s + i.pieces, 0)

  return (
    <div className={styles.page}>
      <table className={styles.sheet}>
        <tbody>
          <tr>
            <td colSpan={2}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td rowSpan={2} style={{ width: 10 }}>&nbsp;</td>
                    <td rowSpan={2} style={{ width: 80, textAlign: 'center', verticalAlign: 'top' }}>
                      <img src="/logo.png" width={65} height={80} alt="" />
                    </td>
                    <td className={styles.title}>{PRINT_TITLE[kind]}</td>
                    <td rowSpan={2} style={{ width: 10 }}>&nbsp;</td>
                  </tr>
                  <tr>
                    <td className={styles.c} style={{ height: 40, whiteSpace: 'nowrap' }}>
                      {PRINT_ADDRESS}<br />{PRINT_PHONE}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td style={{ height: 20, whiteSpace: 'nowrap' }}>
              客户:{order.customerCode}&nbsp;<span className={styles.customerName}>{order.customerName}</span>&nbsp;{order.customerPhone ?? ''}&nbsp;&nbsp;
            </td>
            <td className={styles.r} style={{ whiteSpace: 'nowrap' }}>单号:{order.no}</td>
          </tr>
          <tr>
            <td style={{ height: 20 }}>地址:&nbsp;{order.customerAddress ?? ''}</td>
            <td className={styles.r} style={{ whiteSpace: 'nowrap' }}>开单日期:{toSlashDate(order.date)}</td>
          </tr>
          <tr>
            <td colSpan={2}>
              <table className={styles.items}>
                <tbody>
                  <tr>
                    <td className={styles.c} style={{ width: 60 }}>编码</td>
                    <td className={styles.c}>供货商</td>
                    <td style={{ height: 18 }}>&nbsp;货品名称&nbsp;</td>
                    <td className={styles.c} style={{ width: 60 }}>单位</td>
                    <td className={styles.c} style={{ width: 60 }}>数量</td>
                    <td className={styles.c} style={{ width: 60 }}>单价</td>
                    <td className={styles.c} style={{ width: 80 }}>金额</td>
                    <td className={styles.c}>件数</td>
                    <td className={styles.c}>备注</td>
                  </tr>
                  {items.map(i => {
                    const p = productsById[i.productId]
                    return (
                      <tr key={i.id}>
                        <td className={styles.c} style={{ height: 24 }}>{i.productCode}</td>
                        <td>{i.supplierCode}</td>
                        <td>{i.productName}&nbsp;{p?.spec ?? ''}&nbsp;{p?.grade ?? ''}</td>
                        <td className={styles.c}>{i.unit}</td>
                        <td className={styles.c}>{qty(i.qty)}</td>
                        <td className={styles.c}>{money(i.unitPrice)}</td>
                        <td className={styles.c}>{money(i.amount)}</td>
                        <td className={styles.c}>{i.pieces}</td>
                        <td>{i.notes ?? ''}</td>
                      </tr>
                    )
                  })}
                  <tr>
                    <td colSpan={4} className={styles.r} style={{ height: 24 }}>小计:</td>
                    <td className={styles.c}>{qty(totalQty)}</td>
                    <td></td>
                    <td className={styles.c}>{money(totalAmount)}</td>
                    <td className={styles.c}>{totalPieces}</td>
                    <td>&nbsp;</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className={styles.r} style={{ height: 24 }}>合计:</td>
                    <td className={styles.c}>{qty(totalQty)}</td>
                    <td className={styles.r}>小写</td>
                    <td className={styles.c}>{money(totalAmount)}</td>
                    <td className={styles.c}>{totalPieces}</td>
                    <td>大写:{toChineseAmount(totalAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td colSpan={2} style={{ height: 24 }}>
              第1页/共1页&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;业务员：{order.operator ?? ''}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;复核:
            </td>
          </tr>
          {order.notes && (
            <tr>
              <td colSpan={2} style={{ height: 40 }}>
                <div className={styles.notesBox}>{order.notes}</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
