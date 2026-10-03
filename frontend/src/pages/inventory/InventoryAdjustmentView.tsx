import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getManualAdjustment, type ManualAdjustment } from '@/api/inventory'
import { getErrorMessage } from '@/utils/error'
import { toSlashDate } from '@/utils/slashDate'
import styles from '@/pages/purchase/PurchaseDocs.module.css'

// 单据明细 for one manual 库存调整 record — same red-table format as the other 单据明细 pages
export default function InventoryAdjustmentView() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [record, setRecord] = useState<ManualAdjustment | null>(null)

  useEffect(() => {
    getManualAdjustment(Number(id))
      .then(setRecord)
      .catch(err => alert(getErrorMessage(err)))
  }, [id])

  if (!record) return <div className={styles.loading}>数据加载中，请稍候...</div>

  return (
    <div className={styles.page}>
      <div className={styles.body}>
        <table className={styles.doc}>
          <thead>
            <tr>
              <th>类型</th>
              <th>日期</th>
              <th>供应商</th>
              <th>编码</th>
              <th>产品名称&nbsp;&nbsp;规格&nbsp;&nbsp;等级</th>
              <th>单位</th>
              <th>库存数量</th>
              <th>盘点数量</th>
              <th>盈亏数量</th>
              <th>经办人</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>库存调整单</td>
              <td>{toSlashDate(record.createdAt.slice(0, 10))} {record.createdAt.slice(11)}</td>
              <td>{record.supplierCode}</td>
              <td>{record.productCode}</td>
              <td>{record.productName} {record.spec ?? ''} {record.grade ?? ''}</td>
              <td className={styles.c}>{record.unit}</td>
              <td className={styles.c}>{record.qtyBefore}</td>
              <td className={styles.c}>{record.qtyAfter}</td>
              <td className={styles.c}>{record.qtyChange}</td>
              <td className={styles.c}>{record.operator ?? ''}</td>
              <td>{record.reason ?? ''}</td>
            </tr>
            <tr className={styles.docSumYellow}>
              <td colSpan={5} className={styles.c}>总共1个产品</td>
              <td className={styles.c}>合计</td>
              <td className={styles.c}>{record.qtyBefore}</td>
              <td className={styles.c}>{record.qtyAfter}</td>
              <td className={styles.c}>{record.qtyChange}</td>
              <td colSpan={2}></td>
            </tr>
          </tbody>
        </table>

        <input className={styles.backBtn} type="button" value="返回上页" onClick={() => navigate(-1)} />
      </div>
    </div>
  )
}
