import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getPurchaseOrder, getPurchaseReturn } from '@/api/purchase'
import { getProducts } from '@/api/products'
import { getErrorMessage } from '@/utils/error'
import { toSlashDate } from '@/utils/slashDate'
import styles from './PurchaseDocs.module.css'

interface ViewLine {
  id: number
  productId: number
  productCode: string
  productName: string
  grade: string
  unit: string
  qty: number
  unitPrice: number
  amount: number
  pieces: number
  notes: string
}

interface ViewDoc {
  typeLabel: string
  no: string
  date: string
  supplierId: number
  supplierCode: string
  supplierName: string
  operator: string
  lines: ViewLine[]
}

const fmt = (n: number) => String(+Number(n).toFixed(2))

interface Props {
  kind: 'order' | 'return'
}

// 单据明细 — replicates old main_all_djmx_info.asp
export default function PurchaseView({ kind }: Props) {
  const navigate = useNavigate()
  const { id } = useParams()
  const [doc, setDoc] = useState<ViewDoc | null>(null)
  const [specs, setSpecs] = useState<Record<number, string>>({})  // items carry no 规格

  useEffect(() => {
    const load: Promise<ViewDoc> = kind === 'order'
      ? getPurchaseOrder(Number(id)).then(o => ({
          typeLabel: '采购单', no: o.orderNo, date: o.orderDate,
          supplierId: o.supplierId, supplierCode: o.supplierCode, supplierName: o.supplierName,
          operator: o.operator ?? '',
          lines: (o.items ?? []).map(i => ({
            id: i.id, productId: i.productId, productCode: i.productCode, productName: i.productName,
            grade: i.grade ?? '', unit: i.unit, qty: i.qty, unitPrice: i.unitPrice,
            amount: i.amount, pieces: i.pieces, notes: i.notes ?? '',
          })),
        }))
      : getPurchaseReturn(Number(id)).then(r => ({
          typeLabel: '采退单', no: r.returnNo, date: r.returnDate,
          supplierId: r.supplierId, supplierCode: r.supplierCode, supplierName: r.supplierName,
          operator: r.operator ?? '',
          lines: (r.items ?? []).map(i => ({
            id: i.id, productId: i.productId, productCode: i.productCode, productName: i.productName,
            grade: i.grade ?? '', unit: i.unit, qty: i.qty, unitPrice: i.unitPrice,
            amount: i.amount, pieces: i.pieces, notes: i.notes ?? '',
          })),
        }))

    load
      .then(d => {
        setDoc(d)
        return getProducts({ supplierId: d.supplierId })
      })
      .then(prods => setSpecs(Object.fromEntries(prods.map(p => [p.id, p.spec ?? '']))))
      .catch(err => alert(getErrorMessage(err)))
  }, [kind, id])

  if (!doc) return <div className={styles.loading}>数据加载中，请稍候...</div>

  const totalQty = doc.lines.reduce((s, l) => s + l.qty, 0)
  const totalAmount = doc.lines.reduce((s, l) => s + l.amount, 0)
  const totalPieces = doc.lines.reduce((s, l) => s + l.pieces, 0)

  return (
    <div className={styles.page}>
      <div className={styles.body}>
        <table className={styles.doc}>
          <thead>
            <tr>
              <th>类型</th>
              <th>客户\供应商\部门</th>
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
            {doc.lines.map(l => (
              <tr key={l.id}>
                <td>{doc.typeLabel}</td>
                <td>{doc.supplierCode} {doc.supplierName}</td>
                <td>{toSlashDate(doc.date)}</td>
                <td>{doc.no}</td>
                <td>{doc.supplierCode}</td>
                <td>{l.productCode}</td>
                <td>{l.productName} {specs[l.productId] ?? ''} {l.grade}</td>
                <td className={styles.c}>{l.unit}</td>
                <td className={styles.c}>{fmt(l.qty)}</td>
                <td className={styles.c}>{fmt(l.unitPrice)}</td>
                <td className={styles.c}>{fmt(l.amount)}</td>
                <td className={styles.c}>0</td>
                <td className={styles.c}>0</td>
                <td className={styles.c}>{l.pieces}</td>
                <td className={styles.c}>{doc.operator}</td>
                <td>{l.notes}</td>
              </tr>
            ))}
            <tr className={styles.docSumYellow}>
              <td colSpan={7} className={styles.c}>总共{doc.lines.length}个产品</td>
              <td className={styles.c}>合计</td>
              <td className={styles.c}>{fmt(totalQty)}</td>
              <td></td>
              <td className={styles.c}>¥{fmt(totalAmount)}</td>
              <td></td>
              <td className={styles.c}>¥0</td>
              <td className={styles.c}>{fmt(totalPieces)}</td>
              <td colSpan={2}></td>
            </tr>
          </tbody>
        </table>

        <input className={styles.backBtn} type="button" value="返回上页" onClick={() => navigate(-1)} />

        <div className={styles.infoBox}>
          <div className={styles.infoTitle}>客户\供应商\部门信息</div>
          <div className={styles.infoBody}>{doc.supplierCode}　　{doc.supplierName}</div>
        </div>
      </div>
    </div>
  )
}
