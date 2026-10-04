import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getProducts, type Product } from '@/api/products'
import { getErrorMessage } from '@/utils/error'
import { MobileHeader, useSalesDraft } from './MobileShell'
import styles from './Mobile.module.css'

const num = (v: string) => (v === '' ? 0 : Number(v))

// 手机开单 — page 4 (mxs_in_xz.asp): 数量(件*包装) / 单价 / 备注 → 加入到销售单中 → page 5 (核对 dropped, as on the computer)
export default function MobileAddProduct() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { draft, setDraft } = useSalesDraft()
  const [product, setProduct] = useState<Product | null>(null)
  const [pieces, setPieces] = useState('')
  const [perPiece, setPerPiece] = useState('')
  const [price, setPrice] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    getProducts()
      .then(all => {
        const p = all.find(x => x.id === Number(id)) ?? null
        setProduct(p)
        if (p) {
          setPerPiece(p.unitsPerPiece ? String(p.unitsPerPiece) : '1')
          setPrice(p.price != null ? String(+p.price.toFixed(2)) : '')
        }
      })
      .catch(err => alert(getErrorMessage(err)))
  }, [id])

  function handleAdd() {
    if (!product) return
    if (!draft.customer) { alert('请先选择客户'); return }
    const qty = num(pieces) * num(perPiece)
    if (qty <= 0) { alert('请输入数量'); return }
    if (price === '' || isNaN(Number(price))) { alert('请输入单价'); return }
    setDraft(d => ({
      ...d,
      lines: [...d.lines, {
        key: `${product.id}-${Date.now()}`,
        productId: product.id,
        supplierId: product.supplierId,
        costPrice: product.costPrice ?? null,
        code: product.code,
        name: product.name,
        spec: product.spec ?? '',
        grade: product.grade ?? '',
        unit: product.unit ?? '',
        unitsPerPiece: product.unitsPerPiece ?? null,
        qty: String(qty),
        unitPrice: price,
        pieces: String(num(pieces)),
        notes: notes.trim(),
        checked: false,
      }],
    }))
    navigate('/m/sales/order', { replace: true })   // → page 5; back from there returns to page 3
  }

  const p = product
  return (
    <div className={styles.page}>
      <MobileHeader />

      {p && (
        <table className={styles.formTable}>
          <tbody>
            <tr>
              <td className={styles.label}>供应商：</td>
              <td className={styles.green}>&nbsp;{p.supplierCode}</td>
            </tr>
            <tr>
              <td className={styles.label}>产品编码：</td>
              <td className={styles.teal}>&nbsp;{p.code}</td>
            </tr>
            <tr>
              <td className={styles.label}>产品信息：</td>
              <td className={styles.big}>
                <span className={styles.green}>{p.name}</span>&nbsp;&nbsp;<span className={styles.teal}>{p.spec ?? ''}</span>&nbsp;{p.grade ?? ''}
              </td>
            </tr>
            <tr>
              <td className={styles.label}>包装：</td>
              <td className={styles.teal}>{p.unitsPerPiece ?? ''}{p.unit ?? ''}/箱</td>
            </tr>
            <tr>
              <td className={styles.label}>库存：</td>
              <td className={styles.big}><span className={styles.red}>{p.stock}</span><span className={styles.green}>{p.unit ?? ''}</span></td>
            </tr>
            <tr>
              <td className={styles.label}>单价：</td>
              <td className={styles.big}><em>{p.price != null ? +p.price.toFixed(2) : ''}</em></td>
            </tr>
            <tr>
              <td className={styles.label}>数量(件*包装)：</td>
              <td>
                <input className={styles.inShort} type="tel" value={pieces} autoFocus
                  onChange={e => setPieces(e.target.value.replace(/\D/g, ''))} />*
                <input className={styles.inShort} type="tel" value={perPiece}
                  onChange={e => setPerPiece(e.target.value.replace(/\D/g, ''))} />
              </td>
            </tr>
            <tr>
              <td className={styles.label}>单价：</td>
              <td>
                <input className={styles.inMid} type="tel" value={price}
                  onClick={e => e.currentTarget.select()}
                  onChange={e => setPrice(e.target.value.replace(/[^\d.]/g, ''))} />
              </td>
            </tr>
            <tr>
              <td className={styles.label}>备注：</td>
              <td>
                <input className={styles.inLong} type="text" value={notes} onChange={e => setNotes(e.target.value)} />
              </td>
            </tr>
            <tr>
              <td colSpan={2} className={styles.center}>
                <input className={styles.addBtn} type="button" value="加入到销售单中" onClick={handleAdd} />
              </td>
            </tr>
            <tr><td colSpan={2} className={styles.formGap}></td></tr>
            <tr>
              <td colSpan={2} className={styles.backBar} onClick={() => navigate(-1)}>返回上页</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}
