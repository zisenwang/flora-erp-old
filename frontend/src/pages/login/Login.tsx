import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '@/api/auth'
import { useAuth } from '@/store/AuthContext'
import styles from './Login.module.css'

export default function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) { setError('请输入用户账号和密码'); return }
    setError('')
    setLoading(true)
    try {
      const res = await login({ username, password })
      setAuth(res.token, res.user)
      navigate('/')
    } catch {
      setError('用户账号或密码错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      {/* Login box */}
      <div className={styles.box}>
        <div className={styles.boxTitle}>用户登录</div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <table className={styles.formTable}>
            <tbody>
              <tr>
                <td className={styles.label}>用户账号：</td>
                <td>
                  <input
                    className={styles.input}
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoFocus
                  />
                </td>
              </tr>
              <tr>
                <td className={styles.label}>用户密码：</td>
                <td>
                  <input
                    className={styles.input}
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </td>
              </tr>
            </tbody>
          </table>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.btnRow}>
            <button className={styles.btn} type="submit" disabled={loading}>
              {loading ? '登录中...' : '登 录'}
            </button>
            <button className={styles.btnCancel} type="button" onClick={() => { setUsername(''); setPassword('') }}>
              清 空
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
