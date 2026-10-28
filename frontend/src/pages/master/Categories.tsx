import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { listProductCategories, deleteProductCategory, type ProductCategory } from '@/api/productCategories'
import { getErrorMessage } from '@/utils/error'
import { toSlashDate } from '@/utils/slashDate'
import { EditIcon, DeleteIcon } from './SupplierIcons'
import styles from './Suppliers.module.css'
import cat from './Categories.module.css'

// 产品分类 — replicates old cpfl.asp (排序号 dropped: the new table has no sort column)
export default function Categories() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    listProductCategories()
      .then(setCategories)
      .catch(err => alert(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // blocked by the backend while products still use the category
  async function handleDelete(c: ProductCategory) {
    if (!window.confirm('此操作将直接把产品分类删除掉,并且不可恢复,真的要进行吗?')) return
    try {
      await deleteProductCategory(c.id)
      load()
    } catch (err) {
      alert(getErrorMessage(err))
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.subbar}>
        <span className={styles.btnAddSupp} style={{ width: 78 }} onClick={() => navigate('/master/categories/new')}>新增产品分类</span>
      </div>

      <div className={styles.body} style={{ paddingLeft: 6 }}>
        {loading ? <div className={styles.loading}>数据加载中，请稍候...</div> : (
          <table className={styles.grid}>
            <thead>
              <tr>
                <th>&nbsp;序号&nbsp;</th>
                <th>&nbsp;分类名称&nbsp;</th>
                <th>&nbsp;加入日期&nbsp;</th>
                <th>&nbsp;经办人&nbsp;</th>
                <th className={styles.center}>&nbsp;操作&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c, i) => (
                <tr key={c.id}>
                  <td className={styles.center}>&nbsp;<span className={cat.seq}>{i + 1}</span>&nbsp;</td>
                  <td>&nbsp;{c.name}&nbsp;</td>
                  <td>&nbsp;{toSlashDate(c.createdAt.slice(0, 10))}&nbsp;</td>
                  <td>&nbsp;{c.operator ?? ''}&nbsp;</td>
                  <td className={styles.center}>
                    <EditIcon title="修改分类" onClick={() => navigate(`/master/categories/edit/${c.id}`)} />
                    <DeleteIcon title="删除分类" onClick={() => handleDelete(c)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
