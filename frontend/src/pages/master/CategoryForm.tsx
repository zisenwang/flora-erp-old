import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getProductCategory, createProductCategory, updateProductCategory } from '@/api/productCategories'
import { getErrorMessage } from '@/utils/error'
import sup from './Suppliers.module.css'
import cat from './Categories.module.css'

const LIST = '/master/categories'

// 新增产品分类 / 修改产品分类 (old cpfl_add.asp / cpfl_edit.asp)
export default function CategoryForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const editingId = id ? Number(id) : null
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editingId == null) return
    getProductCategory(editingId)
      .then(c => setName(c.name))
      .catch(err => { alert(getErrorMessage(err)); navigate(LIST) })
  }, [editingId, navigate])

  async function handleSubmit() {
    if (!name.trim()) { alert('请输入分类名称'); return }
    setSaving(true)
    try {
      if (editingId != null) await updateProductCategory(editingId, name.trim())
      else await createProductCategory(name.trim())
      navigate(LIST)
    } catch (err) {
      alert(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={sup.page}>
      <div className={cat.formWrap}>
        <div className={cat.title}>{editingId != null ? '修改产品分类' : '新增产品分类'}</div>
        <table className={sup.formTable}>
          <tbody>
            <tr>
              <td className={sup.flabel}>分类名称&nbsp;</td>
              <td>
                <input className={sup.finput} style={{ width: 180 }} type="text" maxLength={50} value={name}
                  onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
                &nbsp;<span className={sup.freq}>*</span>
              </td>
            </tr>
            <tr>
              <td></td>
              <td>
                <button className={sup.btnSubmit} onClick={handleSubmit} disabled={saving}>提交保存</button>
                &nbsp;&nbsp;
                <input type="button" value="返回产品分类" onClick={() => navigate(LIST)} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
