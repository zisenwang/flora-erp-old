import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getPurchaseOrder, getPurchaseReturn } from '@/api/purchase'
import { getProducts } from '@/api/products'
import { useSettings } from '@/store/SettingsContext'
import { toChineseAmount } from '@/utils/chineseAmount'
import { getErrorMessage } from '@/utils/error'
import { toSlashDate } from '@/utils/slashDate'
import styles from './PurchasePrint.module.css'

const fmt = (n: number) => String(+Number(n).toFixed(2))

interface PrintLine {
  id: number
  productId: number
  productCode: string
  productName: string
  unit: string
  qty: number
  unitPrice: number
  amount: number
  discount: number
  finalAmount: number
  notes: string
}

interface PrintDoc {
  no: string
  date: string
  supplierId: number
  supplierCode: string
  supplierPhone: string
  operator: string
  notes: string
  totalQty: number
  finalAmount: number
  lines: PrintLine[]
}

interface Props {
  kind?: 'order' | 'return'
}

// 进货单 / 退货单 打印 — replicates old dy_cgd.asp (opened in a new tab, no nav bar)
export default function PurchasePrint({ kind = 'order' }: Props) {
  const { id } = useParams()
  const { settings } = useSettings()
  const isReturn = kind === 'return'
  const [doc, setDoc] = useState<PrintDoc | null>(null)
  const [specs, setSpecs] = useState<Record<number, string>>({})  // productId → 规格 (items carry no spec)

  useEffect(() => {
    document.title = isReturn ? '云达ERP-退货单' : '云达ERP-进货单'
    const load: Promise<PrintDoc> = isReturn
      ? getPurchaseReturn(Number(id)).then(r => ({
          no: r.returnNo, date: r.returnDate, supplierId: r.supplierId, supplierCode: r.supplierCode,
          supplierPhone: r.supplierPhone ?? '', operator: r.operator ?? '', notes: r.notes ?? '',
          totalQty: r.totalQty, finalAmount: r.totalAmount,
          lines: (r.items ?? []).map(i => ({
            id: i.id, productId: i.productId, productCode: i.productCode, productName: i.productName,
            unit: i.unit, qty: i.qty, unitPrice: i.unitPrice, amount: i.amount,
            discount: 100, finalAmount: i.amount, notes: i.notes ?? '',
          })),
        }))
      : getPurchaseOrder(Number(id)).then(o => ({
          no: o.orderNo, date: o.orderDate, supplierId: o.supplierId, supplierCode: o.supplierCode,
          supplierPhone: o.supplierPhone ?? '', operator: o.operator ?? '', notes: o.notes ?? '',
          totalQty: o.totalQty, finalAmount: o.finalAmount,
          lines: (o.items ?? []).map(i => ({
            id: i.id, productId: i.productId, productCode: i.productCode, productName: i.productName,
            unit: i.unit, qty: i.qty, unitPrice: i.unitPrice, amount: i.amount,
            discount: i.discount, finalAmount: i.finalAmount, notes: i.notes ?? '',
          })),
        }))

    load
      .then(d => {
        setDoc(d)
        return getProducts({ supplierId: d.supplierId })
      })
      .then(prods => setSpecs(Object.fromEntries(prods.map(p => [p.id, p.spec ?? '']))))
      .catch(err => alert(getErrorMessage(err)))
  }, [id, isReturn])

  if (!doc) return <div className={styles.loading}>数据加载中，请稍候...</div>

  const amount = doc.lines.reduce((s, l) => s + Number(l.amount), 0)
  // 退货单 has no discount — drop 折扣 / 折后金额 columns
  const totalsTail = isReturn
    ? <td>&nbsp;</td>
    : <><td>&nbsp;</td><td className={styles.c}>{fmt(doc.finalAmount)}</td><td>&nbsp;</td></>

  return (
    <div className={styles.page}>
      <table className={styles.sheet}>
        <tbody>
          <tr>
            <td colSpan={2} className={styles.title}>{settings.print_title}{isReturn ? '退货单' : '进货单'}</td>
          </tr>
          <tr>
            <td colSpan={2} className={styles.c} style={{ height: 20 }}>
              地址:{settings.company_address}，电话:{settings.company_phone}
            </td>
          </tr>
          <tr>
            <td style={{ height: 20, width: 436 }}>&nbsp;供应商:&nbsp;{doc.supplierCode}</td>
            <td className={styles.r} style={{ width: 247 }}>日期:{toSlashDate(doc.date)}</td>
          </tr>
          <tr>
            <td style={{ height: 20 }}>&nbsp;电&nbsp; 话:&nbsp;{doc.supplierPhone}</td>
            <td className={styles.r}>单号:{doc.no}</td>
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
                    {!isReturn && <td className={styles.c}>折扣</td>}
                    {!isReturn && <td className={styles.c}>折后金额</td>}
                    <td className={styles.c}>备注</td>
                  </tr>
                  {doc.lines.map(l => (
                    <tr key={l.id}>
                      <td className={styles.c}>{l.productCode}</td>
                      <td>&nbsp;{l.productName}</td>
                      <td className={styles.c}>{specs[l.productId] ?? ''}</td>
                      <td className={styles.c}>{l.unit}</td>
                      <td className={styles.c}>{fmt(l.qty)}</td>
                      <td className={styles.c}>{fmt(l.unitPrice)}</td>
                      <td className={styles.c}>{fmt(l.amount)}</td>
                      {!isReturn && <td className={styles.c}>{fmt(l.discount)}</td>}
                      {!isReturn && <td className={styles.c}>{fmt(l.finalAmount)}</td>}
                      <td>{l.notes}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={4} className={styles.r}>小计:</td>
                    <td className={styles.c}>{fmt(doc.totalQty)}</td>
                    <td></td>
                    <td className={styles.c}>{fmt(amount)}</td>
                    {totalsTail}
                  </tr>
                  <tr>
                    <td colSpan={3} className={styles.r}>人民币:{toChineseAmount(Number(doc.finalAmount))}</td>
                    <td className={styles.r}>合计:</td>
                    <td className={styles.c}>{fmt(doc.totalQty)}</td>
                    <td></td>
                    <td className={styles.c}>{fmt(amount)}</td>
                    {totalsTail}
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
          {doc.notes && (
            <tr>
              <td colSpan={2} style={{ height: 20 }}>&nbsp;备注:&nbsp;{doc.notes}</td>
            </tr>
          )}
          <tr>
            <td style={{ height: 20 }}>
              &nbsp;开单人：{doc.operator}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;收货人：&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;复核人：
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
