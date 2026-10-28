import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listUsers, type UserRow } from '@/api/auth'
import { getErrorMessage } from '@/utils/error'
import { PERMISSIONS, roleLabel } from '@/utils/permissions'
import styles from '@/pages/purchase/PurchaseDocs.module.css'
import op from './Operator.module.css'

const permText = (u: UserRow) => u.role === 'admin'
  ? '全部'
  : PERMISSIONS.filter(p => u.permissions?.includes(p.key)).map(p => p.label).join('、')

// 操作员表 (old musers.asp) — the new system's 系统设置 → 用户管理 as an old-style list;
// 新增 / 编辑 / 改密 / 权限 each open a page
export default function OperatorList() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch(err => alert(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  const go = (id: number, page: string) => navigate(`/settings/operators/${id}/${page}`)

  return (
    <div className={styles.page}>
      <div className={styles.subbar}>
        <input type="button" value="新增操作员" onClick={() => navigate('/settings/operators/new')} />
      </div>

      <div className={styles.body}>
        {loading ? <div className={styles.loading}>数据加载中，请稍候...</div> : (
          <table className={`${styles.grid} ${op.list}`}>
            <thead>
              <tr>
                <th>&nbsp;用户名&nbsp;</th>
                <th>&nbsp;姓名&nbsp;</th>
                <th>&nbsp;角色&nbsp;</th>
                <th>&nbsp;状态&nbsp;</th>
                <th>&nbsp;权限&nbsp;</th>
                <th>&nbsp;操作&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className={styles.row}>
                  <td className={styles.c}>&nbsp;{u.username}&nbsp;</td>
                  <td className={styles.c}>&nbsp;{u.name}&nbsp;</td>
                  <td className={`${styles.c} ${u.role === 'admin' ? op.admin : ''}`}>&nbsp;{roleLabel(u.role)}&nbsp;</td>
                  <td className={`${styles.c} ${u.status === 1 ? op.on : op.off}`}>&nbsp;{u.status === 1 ? '启用' : '停用'}&nbsp;</td>
                  <td>&nbsp;{permText(u)}&nbsp;</td>
                  <td className={styles.c}>
                    <a onClick={() => go(u.id, 'edit')}>编辑</a>
                    <span className={op.sep}>|</span>
                    <a onClick={() => go(u.id, 'password')}>改密</a>
                    {u.role !== 'admin' && (
                      <>
                        <span className={op.sep}>|</span>
                        <a onClick={() => go(u.id, 'permissions')}>权限</a>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className={styles.legend}>
          管理员拥有全部权限；操作员只能打开勾选的页面。修改角色或权限后，该操作员需重新登录才生效。
        </div>
      </div>
    </div>
  )
}
