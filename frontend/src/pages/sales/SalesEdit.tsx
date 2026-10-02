import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  getSalesOrder, getSalesReturn, updateSalesOrder, updateSalesReturn, voidSalesOrder, voidSalesReturn,
} from '@/api/sales'
import { getProducts, type Product } from '@/api/products'
import { getCustomers, type Customer } from '@/api/customers'
import { getErrorMessage } from '@/utils/error'
import { parseSlashDate, toSlashDate } from '@/utils/slashDate'
import SupplierPicker from '@/pages/purchase/SupplierPicker'
import ProductPicker from '@/pages/purchase/ProductPicker'
import styles from '@/pages/purchase/PurchaseDocs.module.css'

interface EditLine {
  key: string
  productId: number
  supplierId: number
  supplierCode: string
  code: string
  name: string
  spec: string
  grade: string
  unit: string
  unitsPerPiece: number | null
  qty: string
  unitPrice: string
  pieces: string
  costPrice: string
  discount: number
  notes: string
}

// header info shared by 销售单 and 退货单
interface DocMeta {
  id: number
  no: string
  date: string
  operator: string
  voided: boolean
}

interface EditCustomer {
  id: number
  code: string
  name: string
  address: string
}

// ─── Helpers ─────────────────────────────────────────────────
const num = (v: string) => (v === '' ? 0 : Number(v))
const fmt = (n: number) => String(+n.toFixed(2))
const lineAmount = (l: EditLine) => (num(l.qty) * num(l.unitPrice) * l.discount) / 100
const lineCost = (l: EditLine) => num(l.qty) * num(l.costPrice)
// 件数 = ceil(数量 / 每箱数量), same rule as 进货单录入
const calcPieces = (qty: string, unitsPerPiece: number | null) =>
  unitsPerPiece && num(qty) > 0 ? String(Math.ceil(num(qty) / unitsPerPiece)) : '0'

let keySeq = 0
const nextKey = () => `s${++keySeq}`

function lineFromProduct(p: Product, qty: string, discount: number): EditLine {
  return {
    key: nextKey(),
    productId: p.id,
    supplierId: p.supplierId,
    supplierCode: p.supplierCode,
    code: p.code,
    name: p.name,
    spec: p.spec ?? '',
    grade: p.grade ?? '',
    unit: p.unit ?? '',
    unitsPerPiece: p.unitsPerPiece ?? null,
    qty,
    unitPrice: p.price != null ? String(p.price) : '',
    pieces: calcPieces(qty, p.unitsPerPiece ?? null),
    costPrice: p.costPrice != null ? String(p.costPrice) : '',
    discount,
    notes: '',
  }
}

interface Props {
  kind?: 'order' | 'return'
}

// 修改销售单 / 退货单 — replicates old edit_xs.asp (复制此单 / 送货时间 dropped; 退货单 has no 进价/成本/毛利)
export default function SalesEdit({ kind = 'order' }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const orderId = Number(id)
  const isReturn = kind === 'return'

  const [order, setOrder] = useState<DocMeta | null>(null)
  const [customer, setCustomer] = useState<EditCustomer | null>(null)
  const [lines, setLines] = useState<EditLine[]>([])
  const [orderDate, setOrderDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])  // all products — a sale can take any supplier's goods
  const [pickCustomer, setPickCustomer] = useState(false)
  const [pickAdd, setPickAdd] = useState(false)
  const [replaceKey, setReplaceKey] = useState<string | null>(null)

  // ── Load data ────────────────────────────────────────────────
  useEffect(() => {
    // normalize 销售单 / 退货单 into one shape
    const load = isReturn
      ? getSalesReturn(orderId).then(r => ({
          meta: { id: r.id, no: r.returnNo, date: r.returnDate, operator: r.operator ?? '', voided: (r.notes ?? '').startsWith('作废') },
          customerId: r.customerId, customerCode: r.customerCode, customerName: r.customerName,
          customerAddress: r.customerAddress, notes: r.notes,
          items: (r.items ?? []).map(i => ({ ...i, supplierId: null as number | null, costPrice: null as number | null, discount: 100 })),
        }))
      : getSalesOrder(orderId).then(o => ({
          meta: { id: o.id, no: o.orderNo, date: o.orderDate, operator: o.operator ?? '', voided: o.status === '作废' },
          customerId: o.customerId, customerCode: o.customerCode, customerName: o.customerName,
          customerAddress: o.customerAddress, notes: o.notes,
          items: (o.items ?? []).map(i => ({ ...i, supplierId: i.supplierId as number | null })),
        }))

    Promise.all([load, getCustomers(), getProducts()])
      .then(([o, custs, prods]) => {
        const byId = Object.fromEntries(prods.map(p => [p.id, p]))
        setOrder(o.meta)
        setCustomers(custs)
        setProducts(prods)
        setCustomer({ id: o.customerId, code: o.customerCode, name: o.customerName, address: o.customerAddress ?? '' })
        setOrderDate(toSlashDate(o.meta.date))
        setNotes(o.notes ?? '')
        setLines(o.items.map(i => ({
          key: nextKey(),
          productId: i.productId,
          supplierId: i.supplierId ?? byId[i.productId]?.supplierId ?? 0,
          supplierCode: i.supplierCode,
          code: i.productCode,
          name: i.productName,
          spec: byId[i.productId]?.spec ?? '',
          grade: byId[i.productId]?.grade ?? '',
          unit: i.unit,
          unitsPerPiece: byId[i.productId]?.unitsPerPiece ?? null,
          qty: String(i.qty),
          unitPrice: String(i.unitPrice),
          pieces: String(i.pieces ?? 0),
          costPrice: i.costPrice != null ? String(i.costPrice) : '',
          discount: i.discount ?? 100,
          notes: i.notes ?? '',
        })))
      })
      .catch(err => alert(getErrorMessage(err)))
  }, [orderId, isReturn])

  // ── Line edits ───────────────────────────────────────────────
  function setLine(key: string, patch: Partial<EditLine>) {
    setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l)))
  }

  function handleReplace(p: Product) {
    if (replaceKey == null) return
    setLines(ls => ls.map(l => {
      if (l.key !== replaceKey) return l
      const next = lineFromProduct(p, l.qty, l.discount)
      return { ...next, key: l.key, notes: l.notes, unitPrice: next.unitPrice || l.unitPrice }
    }))
    setReplaceKey(null)
  }

  function handleAdd(p: Product) {
    setLines(ls => [...ls, lineFromProduct(p, '1', 100)])
    setPickAdd(false)
  }

  function goBack() {
    if (location.key !== 'default') navigate(-1)
    else navigate('/sales/orders')  // 汇总表 lists both 销售单 and 退货单
  }

  async function handleSave() {
    if (saving || !order || !customer) return
    if (lines.length === 0) { alert('单据中没有产品'); return }
    if (lines.some(l => num(l.qty) <= 0)) { alert('数量必须大于0'); return }
    if (lines.some(l => l.unitPrice === '' || isNaN(Number(l.unitPrice)))) { alert('请输入单价'); return }
    if (lines.some(l => l.costPrice !== '' && isNaN(Number(l.costPrice)))) { alert('进价格式不正确'); return }
    const date = parseSlashDate(orderDate)
    if (!date) { alert('开单日期格式不正确，例如 2026/10/1'); return }

    setSaving(true)
    try {
      if (isReturn) {
        await updateSalesReturn(order.id, {
          customerId: customer.id,
          returnDate: date,
          notes: notes.trim() || undefined,
          items: lines.map(l => ({
            productId: l.productId,
            qty: num(l.qty),
            pieces: num(l.pieces),
            unitPrice: num(l.unitPrice),
            notes: l.notes.trim() || undefined,
          })),
        })
      } else {
        await updateSalesOrder(order.id, {
          customerId: customer.id,
          orderDate: date,
          notes: notes.trim() || undefined,
          items: lines.map(l => ({
            productId: l.productId,
            supplierId: l.supplierId,
            qty: num(l.qty),
            unitPrice: num(l.unitPrice),
            discount: l.discount,
            pieces: num(l.pieces),
            notes: l.notes.trim() || undefined,
            costPrice: l.costPrice === '' ? null : num(l.costPrice),
          })),
        })
      }
      alert('修改成功')
      goBack()
    } catch (err) {
      alert(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleVoid() {
    if (!order) return
    if (!window.confirm('作废后数量归零，单据保留，确定作废此单吗？')) return
    try {
      if (isReturn) await voidSalesReturn(order.id)
      else await voidSalesOrder(order.id)
      alert('已作废')
      goBack()
    } catch (err) {
      alert(getErrorMessage(err))
    }
  }

  // ── Render ───────────────────────────────────────────────────
  if (!order || !customer) return <div className={styles.loading}>数据加载中，请稍候...</div>

  const totalQty = lines.reduce((s, l) => s + num(l.qty), 0)
  const totalAmount = lines.reduce((s, l) => s + lineAmount(l), 0)
  const totalPieces = lines.reduce((s, l) => s + num(l.pieces), 0)
  const totalCost = lines.reduce((s, l) => s + lineCost(l), 0)
  const replacing = lines.find(l => l.key === replaceKey) ?? null
  const isVoided = order.voided
  const typeLabel = isReturn ? '退货单' : '销售单'

  return (
    <div className={styles.page}>

      {/* ── Sub-toolbar ── */}
      <div className={styles.subbar}>
        <span className={styles.blueBtn} onClick={() => setPickAdd(true)}>向此单追加产品</span>
        <span className={styles.blueBtn} onClick={goBack}>点这里返回上页</span>
        <span className={styles.btnGap} />
        {!isVoided && <span className={styles.greenBtn} onClick={handleVoid}>作废此单</span>}
      </div>

      <div className={styles.body}>
        <table className={styles.doc}>
          <thead>
            <tr>
              <th>类型</th>
              <th>客户</th>
              <th>日期</th>
              <th>单号</th>
              <th>供应商</th>
              <th>编码</th>
              <th>产品名称&nbsp;&nbsp;规格&nbsp;&nbsp;等级</th>
              <th>单位</th>
              <th>每箱数量</th>
              <th>数量</th>
              <th>单价</th>
              <th>金额</th>
              <th>件数</th>
              {!isReturn && <th>进价</th>}
              {!isReturn && <th>成本</th>}
              <th>备注</th>
              <th>经办人</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(l => (
              <tr key={l.key}>
                <td>{typeLabel}</td>
                <td>
                  <span className={styles.badgeGreen} title="更换客户" onClick={() => setPickCustomer(true)}>更换</span>
                  {customer.code} {customer.name}
                </td>
                <td>{toSlashDate(order.date)}</td>
                <td>{order.no}</td>
                <td>{l.supplierCode}</td>
                <td>{l.code}</td>
                <td>
                  <span className={styles.badgeRed} title="更换产品" onClick={() => setReplaceKey(l.key)}>更换</span>
                  {l.name} {l.spec} {l.grade}
                </td>
                <td className={styles.c}>{l.unit}</td>
                <td className={styles.c}>{l.unitsPerPiece ?? ''}</td>
                <td>
                  <input className={styles.lineInput} type="text" value={l.qty}
                    onChange={e => {
                      const qty = e.target.value.replace(/\D/g, '')
                      setLine(l.key, { qty, pieces: calcPieces(qty, l.unitsPerPiece) })
                    }} />
                </td>
                <td>
                  <input className={styles.lineInput} type="text" value={l.unitPrice}
                    onChange={e => setLine(l.key, { unitPrice: e.target.value.replace(/[^\d.]/g, '') })} />
                </td>
                <td className={styles.c}>{fmt(lineAmount(l))}</td>
                <td>
                  <input className={styles.lineInput} type="text" value={l.pieces}
                    onChange={e => setLine(l.key, { pieces: e.target.value.replace(/\D/g, '') })} />
                </td>
                {!isReturn && (
                  <>
                    <td>
                      <input className={styles.lineInput} type="text" value={l.costPrice}
                        onChange={e => setLine(l.key, { costPrice: e.target.value.replace(/[^\d.]/g, '') })} />
                    </td>
                    <td className={styles.c}>{fmt(lineCost(l))}</td>
                  </>
                )}
                <td>
                  <input className={styles.lineNotes} type="text" value={l.notes}
                    onChange={e => setLine(l.key, { notes: e.target.value })} />
                </td>
                <td>
                  <input className={styles.lineInput} type="text" value={order.operator} readOnly />
                </td>
              </tr>
            ))}
            <tr className={styles.docSumGray}>
              <td colSpan={8} className={styles.c}>总共{lines.length}个产品</td>
              <td className={styles.c}>合计</td>
              <td className={styles.c}>{fmt(totalQty)}</td>
              <td></td>
              <td className={styles.c}>¥{fmt(totalAmount)}</td>
              <td className={styles.c}>{fmt(totalPieces)}</td>
              {isReturn ? (
                <td colSpan={2}></td>
              ) : (
                <>
                  <td></td>
                  <td className={styles.c}>¥{fmt(totalCost)}</td>
                  <td colSpan={2} className={styles.c}>
                    毛利:¥<span className={styles.profitText}>{fmt(totalAmount - totalCost)}</span>
                  </td>
                </>
              )}
            </tr>
          </tbody>
        </table>

        {/* 老板贵姓 / 送货地址 / 合计件数 — shown from customer record and lines, not saved */}
        <table className={styles.infoRows}>
          <tbody>
            <tr>
              <td>老板贵姓</td>
              <td><input className={styles.greenInput} style={{ width: 80 }} type="text" value={customer.name} readOnly /></td>
            </tr>
            <tr>
              <td>送货地址</td>
              <td><input className={styles.greenInput} style={{ width: 386 }} type="text" value={customer.address} readOnly /></td>
            </tr>
            <tr>
              <td>合计件数</td>
              <td><input className={styles.greenInput} style={{ width: 80 }} type="text" value={fmt(totalPieces)} readOnly /></td>
            </tr>
          </tbody>
        </table>

        <textarea className={styles.notesArea} style={{ width: 608 }} value={notes} onChange={e => setNotes(e.target.value)} />

        <div className={styles.editFoot}>
          修改开单日期
          <input className={styles.dateInput} type="text" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
          <input type="button" value={saving ? '保存中...' : '确认修改'} disabled={saving} onClick={handleSave} />
          <input type="button" value="返回上页" onClick={goBack} />
        </div>
      </div>

      {/* ── Overlays ── */}
      {pickCustomer && (
        <SupplierPicker
          suppliers={customers}
          title="请选择客户"
          searchLabel="查找客户"
          onSelect={c => setCustomer({ id: c.id, code: c.code, name: c.name, address: c.address ?? '' })}
          onClose={() => setPickCustomer(false)}
        />
      )}
      {pickAdd && (
        <ProductPicker products={products} mode="add" priceField="price" onPick={handleAdd} onClose={() => setPickAdd(false)} />
      )}
      {replacing && (
        <ProductPicker
          products={products}
          mode="replace"
          priceField="price"
          initialSearch={replacing.name}
          onPick={handleReplace}
          onClose={() => setReplaceKey(null)}
          header={
            <table className={styles.doc} style={{ margin: '4px 0' }}>
              <thead>
                <tr>
                  <th>类型</th><th>客户/供应商</th><th>日期</th><th>单号</th><th>编码</th>
                  <th>产品名称&nbsp;&nbsp;规格&nbsp;&nbsp;等级</th><th>单位</th><th>基本价</th><th>数量</th>
                  <th>单价</th><th>金额</th><th>件数</th><th>经办人</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{typeLabel}</td>
                  <td>{customer.code} {customer.name}</td>
                  <td>{toSlashDate(order.date)}</td>
                  <td>{order.no}</td>
                  <td>{replacing.code}</td>
                  <td>{replacing.name} {replacing.spec} {replacing.grade}</td>
                  <td className={styles.c}>{replacing.unit}</td>
                  <td className={styles.c}>{replacing.costPrice || 0}</td>
                  <td className={styles.c}>{replacing.qty}</td>
                  <td className={styles.c}>{replacing.unitPrice}</td>
                  <td className={styles.c}>{fmt(lineAmount(replacing))}</td>
                  <td className={styles.c}>{replacing.pieces}</td>
                  <td className={styles.c}>{order.operator}</td>
                </tr>
                <tr className={styles.docSumYellow}>
                  <td colSpan={8} className={styles.c}>总共1个产品</td>
                  <td className={styles.c}>{replacing.qty}</td>
                  <td></td>
                  <td className={styles.c}>{fmt(lineAmount(replacing))}</td>
                  <td className={styles.c}>{replacing.pieces}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          }
        />
      )}
    </div>
  )
}
