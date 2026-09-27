import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  getProducts,
  getProduct,
  getProductCategories,
  createProduct,
  updateProduct,
  getNextProductCode,
  type Product,
  type ProductPayload,
} from '@/api/products'
import { getSuppliers, type Supplier } from '@/api/suppliers'
import { getErrorMessage } from '@/utils/error'
import { EditIcon, SearchIcon } from './SupplierIcons'
import sup from './Suppliers.module.css'
import styles from './ProductForm.module.css'

// ─── Form state ──────────────────────────────────────────────
interface FormState {
  category: string
  name: string
  spec: string
  grade: string
  unit: string
  unitsPerPiece: string
  costPrice: string
  price: string
}

const EMPTY_FORM: FormState = {
  category: '',
  name: '',
  spec: '',
  grade: '',
  unit: '',
  unitsPerPiece: '',
  costPrice: '',
  price: '',
}

const UNITS = ['盆', '箱', '个', '根', '包', '瓶', '把', '盒', '对', '片', '件']

// 新增 / 修改供应商产品 — replicates old gys_prods_add.asp
export default function ProductForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const editingId = id ? Number(id) : null
  const [searchParams, setSearchParams] = useSearchParams()

  // ── Data state ───────────────────────────────────────────────
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [suppProducts, setSuppProducts] = useState<Product[]>([])  // selected supplier's products, newest first
  const [editSupplierId, setEditSupplierId] = useState<number | null>(null)
  const [editStatus, setEditStatus] = useState(1)

  // ── Form state ───────────────────────────────────────────────
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [codeSeq, setCodeSeq] = useState('')
  const [remember, setRemember] = useState(true)
  const [saving, setSaving] = useState(false)

  // ── Filter state ─────────────────────────────────────────────
  const [sideSearch, setSideSearch] = useState('')
  const [listSearch, setListSearch] = useState('')
  const [appliedListSearch, setAppliedListSearch] = useState('')

  const supplierId = editingId != null
    ? editSupplierId
    : (Number(searchParams.get('supplierId')) || null)
  const supplier = suppliers.find(s => s.id === supplierId) ?? null

  // ── Load data ────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([getSuppliers(), getProductCategories()])
      .then(([supps, cats]) => {
        setSuppliers(supps)
        setCategories(cats)
        setForm(f => (f.category ? f : { ...f, category: cats[0] ?? '' }))
      })
      .catch(err => alert(getErrorMessage(err)))
  }, [])

  useEffect(() => {
    if (editingId == null) return
    getProduct(editingId)
      .then(p => {
        setEditSupplierId(p.supplierId)
        setEditStatus(p.status ?? 1)
        setCodeSeq(p.code.split('.').slice(1).join('.'))
        setForm({
          category: p.category ?? '',
          name: p.name ?? '',
          spec: p.spec ?? '',
          grade: p.grade ?? '',
          unit: p.unit ?? '',
          unitsPerPiece: p.unitsPerPiece != null ? String(p.unitsPerPiece) : '',
          costPrice: p.costPrice != null ? String(p.costPrice) : '',
          price: p.price != null ? String(p.price) : '',
        })
      })
      .catch(err => alert(getErrorMessage(err)))
  }, [editingId])

  const loadSupplierData = useCallback(() => {
    if (supplierId == null) { setSuppProducts([]); return }
    getProducts({ supplierId })
      .then(list => setSuppProducts([...list].sort((a, b) => b.id - a.id)))
      .catch(err => alert(getErrorMessage(err)))
    if (editingId == null) {
      getNextProductCode(supplierId)
        .then(setCodeSeq)
        .catch(() => setCodeSeq(''))
    }
  }, [supplierId, editingId])

  useEffect(() => { loadSupplierData() }, [loadSupplierData])

  // ── Derived ──────────────────────────────────────────────────
  const visibleSuppliers = suppliers.filter(s =>
    sideSearch === '' ||
    s.code.toLowerCase().includes(sideSearch.toLowerCase()) ||
    s.name.toLowerCase().includes(sideSearch.toLowerCase())
  )

  const recent3 = suppProducts.slice(0, 3)
  const newestId = suppProducts[0]?.id

  const listProducts = suppProducts.filter(p => {
    if (!appliedListSearch) return true
    const q = appliedListSearch.toLowerCase()
    return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
  })

  const categoryOptions = form.category && !categories.includes(form.category)
    ? [form.category, ...categories]
    : categories

  // ── Helpers ──────────────────────────────────────────────────
  function setField(key: keyof FormState, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function selectSupplier(sid: number) {
    if (editingId != null) navigate(`/master/products/new?supplierId=${sid}`)
    else setSearchParams({ supplierId: String(sid) })
  }

  async function handleSubmit() {
    if (supplierId == null) { alert('请选择供应商'); return }
    if (!form.name.trim()) { alert('请输入品名'); return }
    if (!form.spec.trim()) { alert('请输入规格'); return }
    if (!form.unit.trim()) { alert('请输入单位'); return }
    if (!codeSeq) { alert('编码获取失败，请刷新页面'); return }

    const payload: ProductPayload = {
      code: codeSeq,
      name: form.name.trim(),
      supplierId,
      category: form.category || undefined,
      spec: form.spec.trim(),
      grade: form.grade.trim() || undefined,
      unit: form.unit.trim(),
      unitsPerPiece: form.unitsPerPiece !== '' ? parseFloat(form.unitsPerPiece) : undefined,
      costPrice: form.costPrice !== '' ? parseFloat(form.costPrice) : undefined,
      price: form.price !== '' ? parseFloat(form.price) : undefined,
    }

    setSaving(true)
    try {
      if (editingId != null) {
        await updateProduct(editingId, { ...payload, status: editStatus })
        alert('修改成功')
        navigate(`/master/products/new?supplierId=${supplierId}`)
      } else {
        await createProduct(payload)
        alert('添加成功')
        if (!remember) setForm(f => ({ ...EMPTY_FORM, category: f.category }))
        loadSupplierData()
      }
    } catch (err) {
      alert(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ── Sub-toolbar ── */}
      <div className={styles.subbar}>
        <span className={styles.hint}>新增产品前先确认供应商信息,然后查看右边的产品表,确定产品编码分配到几号了!</span>
        &nbsp;【<a onClick={() => navigate('/master/suppliers')}>查询供应商</a>】【<a onClick={() => navigate('/sales/orders/new')}>销售开单</a>】【<a onClick={() => navigate('/sales/orders')}>订单开单</a>】
      </div>

      <div className={styles.layout}>

        {/* ══ LEFT SIDEBAR: suppliers ══════════════════════════════ */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            &nbsp;分类
            <input
              className={styles.sideSearch}
              type="text"
              value={sideSearch}
              onChange={e => setSideSearch(e.target.value)}
            />
            <input type="button" value="查找" />
          </div>
          <div className={styles.suppCols}>
            {visibleSuppliers.map(s => (
              <a
                key={s.id}
                title={s.code}
                className={`${styles.suppItem} ${s.id === supplierId ? styles.suppActive : ''}`}
                onClick={() => selectSupplier(s.id)}
              >
                {s.code.slice(0, 4)}
              </a>
            ))}
          </div>
        </div>

        <div className={styles.gap6} />

        {/* ══ FORM ════════════════════════════════════════════════ */}
        <div className={styles.formCol}>
          <table className={styles.formTable}>
            <tbody>
              <tr>
                <td className={styles.flabel}>供应商</td>
                <td>
                  <select
                    value={supplierId ?? ''}
                    disabled={editingId != null}
                    onChange={e => e.target.value && selectSupplier(Number(e.target.value))}
                  >
                    {supplierId == null && <option value="">请在左边选择供应商</option>}
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.code}&nbsp;{s.name}&nbsp;</option>
                    ))}
                  </select>
                  &nbsp;<span className={sup.freq}>*</span>
                </td>
              </tr>
              <tr>
                <td className={styles.flabel}>分类&nbsp;</td>
                <td>
                  <select value={form.category} onChange={e => setField('category', e.target.value)}>
                    {categoryOptions.map(c => <option key={c} value={c}>{c}&nbsp;</option>)}
                  </select>
                </td>
              </tr>
              <tr className={styles.codeRow}>
                <td className={styles.flabel}>编码&nbsp;</td>
                <td>
                  <table className={styles.codeInner}>
                    <tbody>
                      <tr>
                        <td rowSpan={2}>
                          <input
                            className={`${sup.finput} ${styles.codeInput}`}
                            type="text"
                            readOnly
                            value={supplier && codeSeq ? `${supplier.code}.${codeSeq}` : ''}
                          />
                          &nbsp;10位以内 <span className={sup.freq}>*</span>
                        </td>
                        <td>以下是最后增加的3个产品</td>
                      </tr>
                      <tr>
                        <td>
                          {recent3.map(p => (
                            <div key={p.id} className={styles.recentLine}>
                              &nbsp;<em className={sup.code}>{p.code}</em>&nbsp;{p.name}&nbsp;{p.spec ?? ''}&nbsp;
                            </div>
                          ))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
              <tr>
                <td className={styles.flabel}>品名&nbsp;</td>
                <td>
                  <input className={sup.finput} style={{ width: 252 }} type="text"
                    value={form.name} onChange={e => setField('name', e.target.value)} />
                  &nbsp;<span className={sup.freq}>*</span>
                </td>
              </tr>
              <tr>
                <td className={styles.flabel}>规格&nbsp;</td>
                <td>
                  <input className={sup.finput} style={{ width: 132 }} type="text"
                    value={form.spec} onChange={e => setField('spec', e.target.value)} />
                  &nbsp;<span className={sup.freq}>*</span>
                </td>
              </tr>
              <tr>
                <td className={styles.flabel}>等级&nbsp;</td>
                <td>
                  <input className={sup.finput} style={{ width: 48 }} type="text"
                    value={form.grade} onChange={e => setField('grade', e.target.value)} />
                </td>
              </tr>
              <tr>
                <td className={styles.flabel}>单位&nbsp;</td>
                <td>
                  <input className={sup.finput} style={{ width: 48 }} type="text"
                    value={form.unit} onChange={e => setField('unit', e.target.value)} />
                  {UNITS.map(u => (
                    <label key={u}>
                      <input className={styles.radio} type="radio" name="unit"
                        checked={form.unit === u} onChange={() => setField('unit', u)} />{u}
                    </label>
                  ))}
                  &nbsp;<span className={sup.freq}>*</span>
                </td>
              </tr>
              <tr>
                <td className={styles.flabel}>包装&nbsp;</td>
                <td>
                  <input className={sup.finput} style={{ width: 48 }} type="text"
                    value={form.unitsPerPiece}
                    onChange={e => setField('unitsPerPiece', e.target.value.replace(/\D/g, ''))} />
                </td>
              </tr>
              <tr>
                <td className={styles.flabel}>进货价&nbsp;</td>
                <td>
                  <input className={sup.finput} style={{ width: 48 }} type="text"
                    value={form.costPrice}
                    onChange={e => setField('costPrice', e.target.value.replace(/[^\d.]/g, ''))} />
                </td>
              </tr>
              <tr>
                <td className={styles.flabel}>销售价&nbsp;</td>
                <td>
                  <input className={sup.finput} style={{ width: 48 }} type="text"
                    value={form.price}
                    onChange={e => setField('price', e.target.value.replace(/[^\d.]/g, ''))} />
                </td>
              </tr>
              {editingId == null && (
                <tr>
                  <td>&nbsp;</td>
                  <td>
                    <label>
                      <input className={styles.checkbox} type="checkbox"
                        checked={remember} onChange={e => setRemember(e.target.checked)} />
                      保存后记住输入的内容(方便录入)
                    </label>
                  </td>
                </tr>
              )}
              <tr>
                <td>&nbsp;</td>
                <td style={{ height: 40 }}>
                  <button className={sup.btnSubmit} onClick={handleSubmit} disabled={saving}>
                    提交保存
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={styles.gap10} />

        {/* ══ RIGHT: this supplier's products ════════════════════ */}
        <div className={styles.listCol}>
          <div className={styles.searchLine}>
            <span className={styles.searchLabel}>输入品名或编码查找产品</span>
            <input
              className={styles.searchInput}
              type="text"
              value={listSearch}
              onChange={e => setListSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setAppliedListSearch(listSearch.trim())}
            />
            <span style={{ cursor: 'pointer' }} onClick={() => setAppliedListSearch(listSearch.trim())}>
              <SearchIcon />
            </span>
          </div>
          <table className={`${sup.grid} ${styles.list}`}>
            <thead>
              <tr>
                <th>序号</th>
                <th>&nbsp;ID&nbsp;</th>
                <th>&nbsp;供应商&nbsp;</th>
                <th>&nbsp;编码&nbsp;产品&nbsp;规格&nbsp;</th>
                <th>&nbsp;单位&nbsp;</th>
                <th>&nbsp;包装&nbsp;</th>
                <th>修改</th>
              </tr>
            </thead>
            <tbody>
              {listProducts.map((p, i) => (
                <tr key={p.id}>
                  <td className={sup.center}>&nbsp;<em className={sup.code}>{i + 1}</em>&nbsp;</td>
                  <td className={sup.center}>&nbsp;{p.id}&nbsp;</td>
                  <td>&nbsp;{p.supplierCode}&nbsp;{p.supplierName}&nbsp;</td>
                  <td>
                    &nbsp;
                    {p.id === newestId
                      ? <><span className={styles.newTag}>NEW</span><em className={sup.code}>{p.code}</em></>
                      : <span className={styles.codeSpan}>{p.code}</span>}
                    &nbsp;{p.name}&nbsp;{p.spec ?? ''}&nbsp;
                  </td>
                  <td>&nbsp;{p.unit ?? ''}&nbsp;</td>
                  <td>&nbsp;{p.unitsPerPiece ?? ''}&nbsp;</td>
                  <td>
                    <EditIcon onClick={() => navigate(`/master/products/edit/${p.id}`)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
