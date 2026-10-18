import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  listUsers, createUser, updateUser, changePassword, setUserPermissions, type UserRow,
} from '@/api/auth'
import { useAuth } from '@/store/AuthContext'
import { getErrorMessage } from '@/utils/error'
import { PERMISSIONS, ROLES, roleLabel } from '@/utils/permissions'
import sup from '@/pages/master/Suppliers.module.css'
import op from './Operator.module.css'

type Mode = 'new' | 'edit' | 'password' | 'permissions'

const TITLE: Record<Mode, string> = {
  new: '新增操作员',
  edit: '编辑操作员',
  password: '修改密码',
  permissions: '权限设置',
}

const LIST = '/settings/operators'

// 操作员表 sub-pages (the new system's 新增用户 / 编辑用户 / 修改密码 / 权限设置 modals)
export default function OperatorForm({ mode }: { mode: Mode }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user: me } = useAuth()

  const [target, setTarget] = useState<UserRow | null>(null)
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('operator')
  const [enabled, setEnabled] = useState(true)
  const [oldPassword, setOldPassword] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [perms, setPerms] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (mode === 'new') return
    listUsers()
      .then(list => {
        const u = list.find(x => x.id === Number(id))
        if (!u) { alert('操作员不存在'); navigate(LIST); return }
        setTarget(u)
        setUsername(u.username)
        setName(u.name)
        setRole(u.role)
        setEnabled(u.status === 1)
        setPerms(u.permissions ?? [])
      })
      .catch(err => alert(getErrorMessage(err)))
  }, [mode, id, navigate])

  const isSelf = target != null && target.id === me?.id

  function togglePerm(key: string) {
    setPerms(p => (p.includes(key) ? p.filter(x => x !== key) : [...p, key]))
  }

  function checkNewPassword(): boolean {
    if (password.length < 4) { alert('密码不能少于4位'); return false }
    if (password !== password2) { alert('两次输入的密码不一致'); return false }
    return true
  }

  async function handleSubmit() {
    try {
      if (mode === 'new') {
        if (!username.trim()) { alert('请输入用户名'); return }
        if (!name.trim()) { alert('请输入姓名'); return }
        if (!checkNewPassword()) return
        setSaving(true)
        await createUser({ username: username.trim(), name: name.trim(), password, role })
        alert('添加成功')
      } else if (!target) {
        return
      } else if (mode === 'edit') {
        if (!username.trim()) { alert('请输入用户名'); return }
        if (!name.trim()) { alert('请输入姓名'); return }
        setSaving(true)
        await updateUser(target.id, { username: username.trim(), name: name.trim(), role, status: enabled ? 1 : 0 })
        alert('修改成功')
      } else if (mode === 'password') {
        if (isSelf && !oldPassword) { alert('请输入原密码'); return }
        if (!checkNewPassword()) return
        setSaving(true)
        await changePassword(target.id, { oldPassword: isSelf ? oldPassword : undefined, newPassword: password })
        alert('密码已修改')
      } else {
        setSaving(true)
        await setUserPermissions(target.id, perms)
        alert('权限已更新')
      }
      navigate(LIST)
    } catch (err) {
      alert(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const textRow = (label: string, value: string, set: (v: string) => void, type = 'text', required = true) => (
    <tr>
      <td className={`${sup.flabel} ${op.flabel}`}>{label}</td>
      <td>
        <input className={sup.finput} style={{ width: 180 }} type={type} value={value} onChange={e => set(e.target.value)} />
        {required && <>&nbsp;<span className={sup.freq}>*</span></>}
      </td>
    </tr>
  )

  return (
    <div className={sup.page}>
      <div className={op.formWrap}>
        <div className={op.title}>
          {TITLE[mode]}{target && <> — {target.name}（{target.username}）</>}
        </div>

        <table className={sup.formTable}>
          <tbody>
            {(mode === 'new' || mode === 'edit') && (
              <>
                {textRow('用户名', username, setUsername)}
                {textRow('姓名', name, setName)}
                {mode === 'new' && textRow('密码', password, setPassword, 'password')}
                {mode === 'new' && textRow('确认密码', password2, setPassword2, 'password')}
                <tr>
                  <td className={`${sup.flabel} ${op.flabel}`}>角色</td>
                  <td>
                    <select value={role} onChange={e => setRole(e.target.value)}>
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </td>
                </tr>
                {mode === 'edit' && (
                  <tr>
                    <td className={`${sup.flabel} ${op.flabel}`}>状态</td>
                    <td>
                      <label>
                        <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />启用
                      </label>
                      <span className={op.hint}>（停用后不能登录）</span>
                    </td>
                  </tr>
                )}
              </>
            )}

            {mode === 'password' && (
              <>
                {isSelf && textRow('原密码', oldPassword, setOldPassword, 'password')}
                {textRow('新密码', password, setPassword, 'password')}
                {textRow('确认新密码', password2, setPassword2, 'password')}
              </>
            )}

            {mode === 'permissions' && (
              target?.role === 'admin' ? (
                <tr><td colSpan={2}>{roleLabel('admin')}拥有全部权限，无需设置。</td></tr>
              ) : (
                <>
                  <tr><td colSpan={2} className={op.hint}>勾选后该操作员可访问对应模块：</td></tr>
                  {PERMISSIONS.map(p => (
                    <tr key={p.key}>
                      <td className={`${sup.flabel} ${op.flabel}`}>
                        <input type="checkbox" checked={perms.includes(p.key)} onChange={() => togglePerm(p.key)} />
                      </td>
                      <td><label onClick={() => togglePerm(p.key)}>{p.label}</label></td>
                    </tr>
                  ))}
                </>
              )
            )}

            <tr>
              <td></td>
              <td>
                <button className={sup.btnSubmit} onClick={handleSubmit} disabled={saving}>提交保存</button>
                &nbsp;&nbsp;
                <input type="button" value="返回操作员表" onClick={() => navigate(LIST)} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
