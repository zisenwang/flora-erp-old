import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import pool from '@/db/pool'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import type { AuthRequest } from '@/middleware/auth'

const JWT_SECRET = process.env.JWT_SECRET || 'flora_erp_secret'

interface UserRow extends RowDataPacket {
  id: number
  username: string
  password_hash: string
  name: string
  role: string
  status: number
}

interface PermRow extends RowDataPacket { permission: string }

async function getUserPermissions(userId: number): Promise<string[]> {
  const [rows] = await pool.query<PermRow[]>(
    'SELECT permission FROM user_permissions WHERE user_id = ?', [userId],
  )
  return rows.map(r => r.permission)
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { username, password } = req.body as { username?: string; password?: string }
    if (!username || !password) {
      res.status(400).json({ message: '用户名和密码不能为空' })
      return
    }

    const [rows] = await pool.query<UserRow[]>(
      'SELECT id, username, password_hash, name, role, status FROM users WHERE username = ? LIMIT 1',
      [username],
    )
    const user = rows[0]
    if (!user || user.status === 0) {
      res.status(401).json({ message: '用户名或密码错误' })
      return
    }

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) {
      res.status(401).json({ message: '用户名或密码错误' })
      return
    }

    const permissions = await getUserPermissions(user.id)
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
      expiresIn: '8h',
    })
    res.json({
      data: {
        token,
        user: { id: user.id, username: user.username, role: user.role, name: user.name, permissions },
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: '服务器内部错误' })
  }
}

export async function listUsers(_req: AuthRequest, res: Response): Promise<void> {
  const [rows] = await pool.query<UserRow[]>(
    'SELECT id, username, name, role, status FROM users ORDER BY id ASC',
  )
  const [permRows] = await pool.query<(PermRow & { user_id: number } & RowDataPacket)[]>(
    'SELECT user_id, permission FROM user_permissions',
  )
  const permMap: Record<number, string[]> = {}
  for (const p of permRows) {
    if (!permMap[p.user_id]) permMap[p.user_id] = []
    permMap[p.user_id].push(p.permission)
  }
  res.json({ data: rows.map(u => ({ ...u, permissions: permMap[u.id] ?? [] })) })
}

export async function getPermissions(req: AuthRequest, res: Response): Promise<void> {
  const userId = Number(req.params.id)
  const perms = await getUserPermissions(userId)
  res.json({ data: perms })
}

export async function setPermissions(req: AuthRequest, res: Response): Promise<void> {
  const userId = Number(req.params.id)
  const { permissions } = req.body as { permissions: string[] }
  const grantedBy = req.user!.id

  const VALID = new Set(['inventory_adjust', 'inventory_check', 'payment', 'loss'])
  const filtered = (permissions ?? []).filter(p => VALID.has(p))

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query('DELETE FROM user_permissions WHERE user_id = ?', [userId])
    if (filtered.length > 0) {
      const vals = filtered.map(p => [userId, p, grantedBy])
      await conn.query('INSERT INTO user_permissions (user_id, permission, granted_by) VALUES ?', [vals])
    }
    await conn.commit()
    res.json({ data: filtered })
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

export async function createUser(req: AuthRequest, res: Response): Promise<void> {
  const { username, name, password, role } = req.body as {
    username: string; name: string; password: string; role?: string
  }
  if (!username || !name || !password) {
    res.status(400).json({ message: '用户名、姓名、密码不能为空' })
    return
  }
  const [existing] = await pool.query<UserRow[]>(
    'SELECT id FROM users WHERE username = ? LIMIT 1', [username],
  )
  if ((existing as UserRow[]).length > 0) {
    res.status(400).json({ message: '用户名已存在' })
    return
  }
  const hash = await bcrypt.hash(password, 10)
  const [result] = await pool.query<ResultSetHeader>(
    'INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)',
    [username, hash, name, role ?? 'operator'],
  )
  res.json({ data: { id: result.insertId, username, name, role: role ?? 'operator', status: 1 } })
}

export async function updateUser(req: AuthRequest, res: Response): Promise<void> {
  const id = Number(req.params.id)
  const { name, username, role, status } = req.body as {
    name: string; username: string; role: string; status?: number
  }
  if (!name || !username) {
    res.status(400).json({ message: '用户名和姓名不能为空' })
    return
  }
  const [existing] = await pool.query<UserRow[]>(
    'SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1', [username, id],
  )
  if ((existing as UserRow[]).length > 0) {
    res.status(400).json({ message: '用户名已存在' })
    return
  }
  await pool.query(
    'UPDATE users SET name=?, username=?, role=?, status=? WHERE id=?',
    [name, username, role, status ?? 1, id],
  )
  res.json({ data: { id, name, username, role, status: status ?? 1 } })
}

export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  const id = Number(req.params.id)
  const { oldPassword, newPassword } = req.body as { oldPassword?: string; newPassword: string }

  if (!newPassword || newPassword.length < 4) {
    res.status(400).json({ message: '新密码不能少于4位' })
    return
  }

  // Changing own password requires old password verification
  if (req.user?.id === id) {
    if (!oldPassword) {
      res.status(400).json({ message: '请输入原密码' })
      return
    }
    const [rows] = await pool.query<UserRow[]>(
      'SELECT password_hash FROM users WHERE id = ?', [id],
    )
    const user = rows[0]
    if (!user) { res.status(404).json({ message: '用户不存在' }); return }
    const ok = await bcrypt.compare(oldPassword, user.password_hash)
    if (!ok) { res.status(400).json({ message: '原密码错误' }); return }
  }

  const hash = await bcrypt.hash(newPassword, 10)
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id])
  res.json({ data: { message: '密码已修改' } })
}
