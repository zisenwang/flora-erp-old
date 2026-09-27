import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  getNextSupplierCode,
  type Supplier,
  type SupplierPayload,
} from '@/api/suppliers'
import { getErrorMessage } from '@/utils/error'
import { EditIcon } from './SupplierIcons'
import styles from './Suppliers.module.css'

// ─── Form state ──────────────────────────────────────────────
interface FormState {
  code: string
  name: string
  address: string
  phone: string
  notes: string
}

const EMPTY_FORM: FormState = { code: '', name: '', address: '', phone: '', notes: '' }

const RECENT_COUNT = 20

// 新增 / 修改供应商 — replicates old gys_.asp / gys_edit.asp (form left, latest suppliers right)
export default function SupplierForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const editingId = id ? Number(id) : null

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [status, setStatus] = useState(1)
  const [recent, setRecent] = useState<Supplier[]>([])
  const [saving, setSaving] = useState(false)

  // ── Load data ────────────────────────────────────────────────
  const loadRecent = useCallback(() => {
    getSuppliers()
      .then(list => setRecent([...list].sort((a, b) => b.id - a.id).slice(0, RECENT_COUNT)))
      .catch(err => alert(getErrorMessage(err)))
  }, [])

  const loadForm = useCallback(() => {
    if (editingId != null) {
      getSupplier(editingId)
        .then(s => {
          setForm({
            code: s.code ?? '',
            name: s.name ?? '',
            address: s.address ?? '',
            phone: s.phone ?? '',
            notes: s.notes ?? '',
          })
          setStatus(s.status ?? 1)
        })
        .catch(err => alert(getErrorMessage(err)))
    } else {
      setForm(EMPTY_FORM)
      setStatus(1)
      getNextSupplierCode()
        .then(code => setForm(f => ({ ...f, code })))
        .catch(() => {})
    }
  }, [editingId])

  useEffect(() => { loadRecent() }, [loadRecent])
  useEffect(() => { loadForm() }, [loadForm])

  function setField(key: keyof FormState, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit() {
    if (!form.code.trim()) { alert('请输入供应商编号'); return }
    if (!form.name.trim()) { alert('请输入供应商名称'); return }

    const payload: SupplierPayload = {
      code: form.code.trim(),
      name: form.name.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      notes: form.notes.trim(),
      status,
    }

    setSaving(true)
    try {
      if (editingId != null) {
        await updateSupplier(editingId, payload)
        alert('修改成功')
        navigate('/master/suppliers')
      } else {
        await createSupplier(payload)
        alert('添加成功')
        loadForm()
        loadRecent()
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
      <div className={styles.editLayout}>

        {/* ══ LEFT: form ══════════════════════════════════════════ */}
        <div className={styles.formCol}>
          <table className={styles.formTable}>
            <tbody>
              <tr>
                <td className={styles.flabel}>供应商编号</td>
                <td>
                  <input
                    className={styles.finput}
                    style={{ width: 36 }}
                    type="text"
                    value={form.code}
                    onChange={e => setField('code', e.target.value)}
                  />
                  &nbsp;<span className={styles.freq}>*</span>
                </td>
              </tr>
              <tr>
                <td className={styles.flabel}>供应商名称</td>
                <td>
                  <input
                    className={styles.finput}
                    style={{ width: 192 }}
                    type="text"
                    value={form.name}
                    onChange={e => setField('name', e.target.value)}
                  />
                  &nbsp;<span className={styles.freq}>*</span>
                </td>
              </tr>
              <tr>
                <td className={styles.flabel}>地址</td>
                <td>
                  <input
                    className={styles.finput}
                    style={{ width: 252 }}
                    type="text"
                    value={form.address}
                    onChange={e => setField('address', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td className={styles.flabel}>电话</td>
                <td>
                  <input
                    className={styles.finput}
                    style={{ width: 132 }}
                    type="text"
                    value={form.phone}
                    onChange={e => setField('phone', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td className={styles.flabel} style={{ height: 66 }}>备注</td>
                <td>
                  <textarea
                    className={styles.ftextarea}
                    value={form.notes}
                    onChange={e => setField('notes', e.target.value)}
                  />
                </td>
              </tr>
              <tr>
                <td></td>
                <td>
                  <button className={styles.btnSubmit} onClick={handleSubmit} disabled={saving}>
                    提交保存
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ══ RIGHT: latest 20 suppliers ══════════════════════════ */}
        <div className={styles.listCol}>
          <table className={styles.grid}>
            <thead>
              <tr>
                <th className={styles.center} style={{ width: 79 }}>编码</th>
                <th className={styles.center} style={{ width: 61 }}>名称</th>
                <th className={styles.center} style={{ width: 49 }}>地址</th>
                <th className={styles.center} style={{ width: 49 }}>电话</th>
                <th className={styles.center} style={{ width: 49 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(s => (
                <tr key={s.id}>
                  <td>&nbsp;<em className={styles.code}>{s.code}</em>&nbsp;</td>
                  <td>&nbsp;{s.name}&nbsp;</td>
                  <td className={styles.wrap}>&nbsp;{s.address ?? ''}&nbsp;</td>
                  <td className={styles.wrap}>&nbsp;{s.phone ?? ''}&nbsp;</td>
                  <td className={styles.center}>
                    <EditIcon onClick={() => navigate(`/master/suppliers/edit/${s.id}`)} />
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
