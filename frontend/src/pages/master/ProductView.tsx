import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getProduct, type Product } from '@/api/products'
import { getErrorMessage } from '@/utils/error'
import { EditIcon } from './SupplierIcons'
import sup from './Suppliers.module.css'
import styles from './ProductView.module.css'

// 查看产品 — replicates old prods_info.asp (photos / 关键字 / 拼音码 / 备注 not in backend)
export default function ProductView() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [product, setProduct] = useState<Product | null>(null)

  useEffect(() => {
    getProduct(Number(id))
      .then(setProduct)
      .catch(err => alert(getErrorMessage(err)))
  }, [id])

  if (!product) return <div className={styles.loading}>数据加载中，请稍候...</div>

  return (
    <div className={styles.page}>
      <div className={styles.title}>
        <span>供 应 商:{product.supplierCode}</span>
        <EditIcon onClick={() => navigate(`/master/products/edit/${product.id}`)} />
      </div>

      <table className={styles.info}>
        <tbody>
          <tr>
            <th rowSpan={2} className={styles.block}>产品信息</th>
            <th>分类</th>
            <th>编码</th>
            <th>品名</th>
            <th>规格</th>
            <th>等级</th>
            <th>包装</th>
            <th>单位</th>
            <th>供应商</th>
          </tr>
          <tr>
            <td>{product.category ?? ''}</td>
            <td>{product.code}</td>
            <td>{product.name}</td>
            <td>{product.spec ?? ''}</td>
            <td>{product.grade ?? ''}</td>
            <td>{product.unitsPerPiece ?? ''}</td>
            <td>{product.unit ?? ''}</td>
            <td>{product.supplierName}</td>
          </tr>
        </tbody>
      </table>

      <div className={styles.dotted} />

      <button className={`${sup.btnSubmit} ${styles.back}`} onClick={() => navigate(-1)}>返回上页</button>
    </div>
  )
}
