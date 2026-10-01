import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { getPurchaseOrder, getPurchaseReturn, updatePurchaseOrder, updatePurchaseReturn } from '@/api/purchase'
import { getProducts, type Product } from '@/api/products'
import { getSuppliers, type Supplier } from '@/api/suppliers'
import { getErrorMessage } from '@/utils/error'
import { parseSlashDate, toSlashDate } from '@/utils/slashDate'
import SupplierPicker from './SupplierPicker'
import ProductPicker from './ProductPicker'
import styles from './PurchaseDocs.module.css'

interface EditLine {
  key: string
  productId: number
  code: string
  name: string
  spec: string
  grade: string
  unit: string
  unitsPerPiece: number | null
  qty: string
  unitPrice: string
  pieces: string
  discount: number
  notes: string
}

// header info shared by 采购单 and 采退单
interface DocMeta {
  id: number
  no: string
  date: string
  operator: string
  discount: number  // order-level discount (采购单 only, kept as-is)
}

interface EditSupplier {
  id: number
  code: string
  name: string
}

// ─── Helpers (same rules as 进货单录入) ────────────────────────
const num = (v: string) => (v === '' ? 0 : Number(v))
const fmt = (n: number) => String(+n.toFixed(2))
const lineAmount = (l: EditLine) => num(l.qty) * num(l.unitPrice)
const lineFinal = (l: EditLine) => (lineAmount(l) * l.discount) / 100
const calcPieces = (qty: string, unitsPerPiece: number | null) =>
  unitsPerPiece && num(qty) > 0 ? String(Math.ceil(num(qty) / unitsPerPiece)) : '0'
const rateOf = (text: string) => {
  const r = Number(text)
  return text === '' || isNaN(r) || r < 0 || r > 100 ? 100 : r
}

let keySeq = 0
const nextKey = () => `l${++keySeq}`

function lineFromProduct(p: Product, qty: string, discount: number): EditLine {
  return {
    key: nextKey(),
    productId: p.id,
    code: p.code,
    name: p.name,
    spec: p.spec ?? '',
    grade: p.grade ?? '',
    unit: p.unit ?? '',
    unitsPerPiece: p.unitsPerPiece ?? null,
    qty,
    unitPrice: p.costPrice != null ? String(p.costPrice) : '',
    pieces: calcPieces(qty, p.unitsPerPiece ?? null),
    discount,
    notes: '',
  }
}

interface Props {
  kind?: 'order' | 'return'
}

// 修改采购单 / 修改退货单 — replicates old edit_buy.asp
export default function PurchaseEdit({ kind = 'order' }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const docId = Number(id)
  const isReturn = kind === 'return'

  const [order, setOrder] = useState<DocMeta | null>(null)
  const [supplier, setSupplier] = useState<EditSupplier | null>(null)
  const [lines, setLines] = useState<EditLine[]>([])
  const [rate, setRate] = useState('100')
  const [orderDate, setOrderDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])  // current supplier's products, for pickers
  const [pickSupplier, setPickSupplier] = useState(false)
  const [pickAdd, setPickAdd] = useState(false)
  const [replaceKey, setReplaceKey] = useState<string | null>(null)

  // ── Load data ────────────────────────────────────────────────
  useEffect(() => {
    // normalize 采购单 / 采退单 into one shape
    const load = isReturn
      ? getPurchaseReturn(docId).then(r => ({
          meta: { id: r.id, no: r.returnNo, date: r.returnDate, operator: r.operator ?? '', discount: 100 },
          supplierId: r.supplierId, supplierCode: r.supplierCode, supplierName: r.supplierName, notes: r.notes,
          items: (r.items ?? []).map(i => ({ ...i, discount: 100 })),
        }))
      : getPurchaseOrder(docId).then(o => ({
          meta: { id: o.id, no: o.orderNo, date: o.orderDate, operator: o.operator ?? '', discount: o.discount },
          supplierId: o.supplierId, supplierCode: o.supplierCode, supplierName: o.supplierName, notes: o.notes,
          items: o.items ?? [],
        }))

    Promise.all([load, getSuppliers()])
      .then(async ([o, supps]) => {
        const prods = await getProducts({ supplierId: o.supplierId })
        const byId = Object.fromEntries(prods.map(p => [p.id, p]))
        const items = o.items
        const discounts = new Set(items.map(i => i.discount))
        setOrder(o.meta)
        setSuppliers(supps)
        setProducts(prods)
        setSupplier({ id: o.supplierId, code: o.supplierCode, name: o.supplierName })
        setOrderDate(toSlashDate(o.meta.date))
        setNotes(o.notes ?? '')
        setRate(discounts.size === 1 ? String(items[0].discount) : '100')
        setLines(items.map(i => ({
          key: nextKey(),
          productId: i.productId,
          code: i.productCode,
          name: i.productName,
          spec: byId[i.productId]?.spec ?? '',
          grade: i.grade ?? '',
          unit: i.unit,
          unitsPerPiece: byId[i.productId]?.unitsPerPiece ?? null,
          qty: String(i.qty),
          unitPrice: String(i.unitPrice),
          pieces: String(i.pieces ?? 0),
          discount: i.discount,
          notes: i.notes ?? '',
        })))
      })
      .catch(err => alert(getErrorMessage(err)))
  }, [docId, isReturn])

  // products for the pickers follow the order's (possibly changed) supplier
  const supplierId = supplier?.id ?? null
  useEffect(() => {
    if (supplierId == null) return
    getProducts({ supplierId }).then(setProducts).catch(() => {})
  }, [supplierId])

  // ── Line edits ───────────────────────────────────────────────
  function setLine(key: string, patch: Partial<EditLine>) {
    setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l)))
  }

  function handleRateChange(text: string) {
    const value = text.replace(/[^\d.]/g, '')
    setRate(value)
    setLines(ls => ls.map(l => ({ ...l, discount: rateOf(value) })))
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
    setLines(ls => [...ls, lineFromProduct(p, '1', rateOf(rate))])
    setPickAdd(false)
  }

  function goBack() {
    if (location.key !== 'default') navigate(-1)
    else navigate('/purchase/orders')  // 汇总表 lists both 采购单 and 采退单
  }

  async function handleSave() {
    if (saving || !order || !supplier) return
    if (lines.length === 0) { alert('单据中没有产品'); return }
    if (lines.some(l => num(l.qty) <= 0)) { alert('数量必须大于0'); return }
    if (lines.some(l => l.unitPrice === '' || isNaN(Number(l.unitPrice)))) { alert('请输入单价'); return }
    const r = Number(rate)
    if (!isReturn && (rate === '' || isNaN(r) || r < 0 || r > 100)) { alert('请输入0-100之间的折扣率'); return }
    const date = parseSlashDate(orderDate)
    if (!date) { alert('开单日期格式不正确，例如 2026/10/1'); return }

    setSaving(true)
    try {
      const items = lines.map(l => ({
        productId: l.productId,
        qty: num(l.qty),
        pieces: num(l.pieces),
        unitPrice: num(l.unitPrice),
        notes: l.notes.trim() || undefined,
      }))
      if (isReturn) {
        await updatePurchaseReturn(order.id, {
          supplierId: supplier.id,
          returnDate: date,
          notes: notes.trim() || undefined,
          items,
        })
      } else {
        await updatePurchaseOrder(order.id, {
          supplierId: supplier.id,
          orderDate: date,
          discount: order.discount,
          notes: notes.trim() || undefined,
          items: items.map((it, i) => ({ ...it, discount: lines[i].discount })),
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

  // ── Render ───────────────────────────────────────────────────
  if (!order || !supplier) return <div className={styles.loading}>数据加载中，请稍候...</div>

  const totalQty = lines.reduce((s, l) => s + num(l.qty), 0)
  const totalAmount = lines.reduce((s, l) => s + lineAmount(l), 0)
  const totalFinal = lines.reduce((s, l) => s + lineFinal(l), 0)
  const totalPieces = lines.reduce((s, l) => s + num(l.pieces), 0)
  const replacing = lines.find(l => l.key === replaceKey) ?? null
  const typeLabel = isReturn ? '采退单' : '采购单'

  return (
    <div className={styles.page}>

      {/* ── Sub-toolbar ── */}
      <div className={styles.subbar}>
        <span className={styles.blueBtn} onClick={() => setPickAdd(true)}>向此单追加产品</span>
        <span className={styles.blueBtn} onClick={goBack}>点这里返回上页</span>
      </div>

      <div className={styles.body}>
        <table className={styles.doc}>
          <thead>
            <tr>
              <th>类型</th>
              <th>供应商</th>
              <th>日期</th>
              <th>单号</th>
              <th>编码</th>
              <th>产品名称&nbsp;&nbsp;规格&nbsp;&nbsp;等级</th>
              <th>单位</th>
              <th>{isReturn ? '退货数量' : '进货数量'}</th>
              <th>单价</th>
              <th>{isReturn ? '金额' : '进货金额'}</th>
              {!isReturn && <th>件数</th>}
              {!isReturn && <th>折扣</th>}
              {!isReturn && <th>折后金额</th>}
              <th>备注</th>
              <th>经办人</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(l => (
              <tr key={l.key}>
                <td>{typeLabel}</td>
                <td>
                  <span className={styles.badgeGreen} title="更换供应商" onClick={() => setPickSupplier(true)}>更换</span>
                  {supplier.code} {supplier.name}
                </td>
                <td>{toSlashDate(order.date)}</td>
                <td>{order.no}</td>
                <td>{l.code}</td>
                <td>
                  <span className={styles.badgeRed} title="更换产品" onClick={() => setReplaceKey(l.key)}>更换</span>
                  {l.name} {l.spec} {l.grade}
                </td>
                <td className={styles.c}>{l.unit}</td>
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
                {!isReturn && (
                  <>
                    <td>
                      <input className={styles.lineInput} type="text" value={l.pieces}
                        onChange={e => setLine(l.key, { pieces: e.target.value.replace(/\D/g, '') })} />
                    </td>
                    <td className={styles.c}>{l.discount}</td>
                    <td className={styles.c}>{fmt(lineFinal(l))}</td>
                  </>
                )}
                <td>
                  <input className={styles.lineNotes} type="text" value={l.notes}
                    onChange={e => setLine(l.key, { notes: e.target.value })} />
                </td>
                <td className={styles.c}>{order.operator}</td>
              </tr>
            ))}
            <tr className={styles.docSumGray}>
              <td colSpan={6} className={styles.c}>总共{lines.length}个产品</td>
              <td className={styles.c}>合计</td>
              <td className={styles.c}>{fmt(totalQty)}</td>
              <td></td>
              <td className={styles.c}>¥{fmt(totalAmount)}</td>
              {!isReturn && (
                <>
                  <td className={styles.c}>{fmt(totalPieces)}</td>
                  <td></td>
                  <td className={styles.c}>¥{fmt(totalFinal)}</td>
                </>
              )}
              <td colSpan={2}></td>
            </tr>
          </tbody>
        </table>

        <textarea className={styles.notesArea} value={notes} onChange={e => setNotes(e.target.value)} />

        <div className={styles.editFoot}>
          {!isReturn && (
            <>
              输入折扣率
              <input className={styles.rateInput} type="text" value={rate} onChange={e => handleRateChange(e.target.value)} />
              %&nbsp;
            </>
          )}
          修改开单日期
          <input className={styles.dateInput} type="text" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
          &nbsp;&nbsp;
          <input type="button" value={saving ? '保存中...' : '确认修改'} disabled={saving} onClick={handleSave} />
          <input type="button" value="返回上页" onClick={goBack} />
        </div>
      </div>

      {/* ── Overlays ── */}
      {pickSupplier && (
        <SupplierPicker
          suppliers={suppliers}
          onSelect={s => setSupplier({ id: s.id, code: s.code, name: s.name })}
          onClose={() => setPickSupplier(false)}
        />
      )}
      {pickAdd && (
        <ProductPicker products={products} mode="add" onPick={handleAdd} onClose={() => setPickAdd(false)} />
      )}
      {replacing && (
        <ProductPicker
          products={products}
          mode="replace"
          onPick={handleReplace}
          onClose={() => setReplaceKey(null)}
          header={
            <table className={styles.doc} style={{ margin: '4px 0' }}>
              <thead>
                <tr>
                  <th>类型</th><th>供应商</th><th>日期</th><th>单号</th><th>编码</th>
                  <th>产品名称&nbsp;&nbsp;规格&nbsp;&nbsp;等级</th><th>单位</th><th>数量</th><th>单价</th>
                  <th>金额</th><th>件数</th><th>经办人</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{typeLabel}</td>
                  <td>{supplier.code} {supplier.name}</td>
                  <td>{toSlashDate(order.date)}</td>
                  <td>{order.no}</td>
                  <td>{replacing.code}</td>
                  <td>{replacing.name} {replacing.spec} {replacing.grade}</td>
                  <td className={styles.c}>{replacing.unit}</td>
                  <td className={styles.c}>{replacing.qty}</td>
                  <td className={styles.c}>{replacing.unitPrice}</td>
                  <td className={styles.c}>{fmt(lineAmount(replacing))}</td>
                  <td className={styles.c}>{replacing.pieces}</td>
                  <td className={styles.c}>{order.operator}</td>
                </tr>
              </tbody>
            </table>
          }
        />
      )}
    </div>
  )
}
