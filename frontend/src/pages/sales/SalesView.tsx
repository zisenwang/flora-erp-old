import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getSalesOrder, getSalesReturn } from '@/api/sales'
import { getProducts, type Product } from '@/api/products'
import { getErrorMessage } from '@/utils/error'
import { toSlashDate } from '@/utils/slashDate'
import styles from '@/pages/purchase/PurchaseDocs.module.css'

const fmt = (n: number) => String(+Number(n).toFixed(2))

interface ViewLine {
  id: number
  productId: number
  supplierCode: string
  productCode: string
  productName: string
  unit: string
  qty: number
  unitPrice: number
  amount: number
  costPrice: number | null   // 销售单 only
  pieces: number
  notes: string
}

interface ViewDoc {
  no: string
  date: string
  customerCode: string
  customerName: string
  customerAddress: string
  customerPhone: string
  operator: string
  notes: string
  lines: ViewLine[]
}

interface Props {
  kind?: 'order' | 'return'
}

// 单据明细 (销售单 / 退货单) — replicates old main_all_djmx_info.asp (来源 dropped)
export default function SalesView({ kind = 'order' }: Props) {
  const navigate = useNavigate()
  const { id } = useParams()
  const isReturn = kind === 'return'
  const [doc, setDoc] = useState<ViewDoc | null>(null)
  const [productsById, setProductsById] = useState<Record<number, Product>>({})  // items carry no 规格 / 等级

  useEffect(() => {
    const load: Promise<ViewDoc> = isReturn
      ? getSalesReturn(Number(id)).then(r => ({
          no: r.returnNo, date: r.returnDate,
          customerCode: r.customerCode, customerName: r.customerName,
          customerAddress: r.customerAddress ?? '', customerPhone: r.customerPhone ?? '',
          operator: r.operator ?? '', notes: r.notes ?? '',
          lines: (r.items ?? []).map(i => ({
            id: i.id, productId: i.productId, supplierCode: i.supplierCode,
            productCode: i.productCode, productName: i.productName, unit: i.unit,
            qty: i.qty, unitPrice: i.unitPrice, amount: i.amount, costPrice: null,
            pieces: i.pieces, notes: i.notes ?? '',
          })),
        }))
      : getSalesOrder(Number(id)).then(o => ({
          no: o.orderNo, date: o.orderDate,
          customerCode: o.customerCode, customerName: o.customerName,
          customerAddress: o.customerAddress ?? '', customerPhone: o.customerPhone ?? '',
          operator: o.operator ?? '', notes: o.notes ?? '',
          lines: (o.items ?? []).map(i => ({
            id: i.id, productId: i.productId, supplierCode: i.supplierCode,
            productCode: i.productCode, productName: i.productName, unit: i.unit,
            qty: i.qty, unitPrice: i.unitPrice, amount: i.finalAmount, costPrice: i.costPrice ?? 0,
            pieces: i.pieces, notes: i.notes ?? '',
          })),
        }))
    load.then(setDoc).catch(err => alert(getErrorMessage(err)))
    getProducts()
      .then(list => setProductsById(Object.fromEntries(list.map(p => [p.id, p]))))
      .catch(() => {})
  }, [id, isReturn])

  if (!doc) return <div className={styles.loading}>数据加载中，请稍候...</div>

  const profitOf = (l: ViewLine) => (l.costPrice == null ? 0 : l.amount - l.costPrice * l.qty)
  const totalQty = doc.lines.reduce((s, l) => s + l.qty, 0)
  const totalAmount = doc.lines.reduce((s, l) => s + l.amount, 0)
  const totalProfit = doc.lines.reduce((s, l) => s + profitOf(l), 0)
  const totalPieces = doc.lines.reduce((s, l) => s + l.pieces, 0)
  const customer = `${doc.customerCode} ${doc.customerName}`
  const typeLabel = isReturn ? '退货单' : '销售单'

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
            {doc.lines.map(l => {
              const p = productsById[l.productId]
              return (
                <tr key={l.id}>
                  <td>{typeLabel}</td>
                  <td>{customer}</td>
                  <td>{toSlashDate(doc.date)}</td>
                  <td>{doc.no}</td>
                  <td>{l.supplierCode}</td>
                  <td>{l.productCode}</td>
                  <td>{l.productName} {p?.spec ?? ''} {p?.grade ?? ''}</td>
                  <td className={styles.c}>{l.unit}</td>
                  <td className={styles.c}>{fmt(l.qty)}</td>
                  <td className={styles.c}>{fmt(l.unitPrice)}</td>
                  <td className={styles.c}>{fmt(l.amount)}</td>
                  <td className={styles.c}>{l.costPrice == null ? '' : fmt(l.costPrice)}</td>
                  <td className={styles.c}>{l.costPrice == null ? '' : fmt(profitOf(l))}</td>
                  <td className={styles.c}>{l.pieces}</td>
                  <td className={styles.c}>{doc.operator}</td>
                  <td>{l.notes}</td>
                </tr>
              )
            })}
            <tr className={styles.docSumYellow}>
              <td colSpan={7} className={styles.c}>总共{doc.lines.length}个产品</td>
              <td className={styles.c}>合计</td>
              <td className={styles.c}>{fmt(totalQty)}</td>
              <td></td>
              <td className={styles.c}>¥{fmt(totalAmount)}</td>
              <td></td>
              <td className={styles.c}>{isReturn ? '' : `¥${fmt(totalProfit)}`}</td>
              <td className={styles.c}>{fmt(totalPieces)}</td>
              <td colSpan={2}></td>
            </tr>
            <tr className={styles.docNotesRow}>
              <td colSpan={16}>{doc.notes}</td>
            </tr>
          </tbody>
        </table>

        <input className={styles.backBtn} type="button" value="返回上页" onClick={() => navigate(-1)} />

        <div className={styles.infoBox}>
          <div className={styles.infoTitle}>客户\供应商\部门信息</div>
          <div className={styles.infoBody} style={{ height: 'auto', minHeight: 56, paddingBottom: 6 }}>
            {doc.customerCode}　{doc.customerName}
            {doc.customerAddress ? `\n${doc.customerAddress}` : ''}
            {doc.customerPhone ? `\n${doc.customerPhone}` : ''}
          </div>
        </div>
      </div>
    </div>
  )
}
