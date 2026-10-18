// 权限 — same rules as the new system: 管理员 (admin) can do everything, 操作员 (operator)
// only sees the modules ticked in 操作员表 → 权限. Read from the user saved at login,
// so a change takes effect after that operator logs in again.

export const PERMISSIONS = [
  { key: 'inventory_adjust', label: '库存调整' },
  { key: 'inventory_check', label: '库存盘点' },
  { key: 'payment', label: '收支管理' },
  { key: 'loss', label: '报损管理' },
] as const

export type Permission = (typeof PERMISSIONS)[number]['key']

export const ROLES = [
  { value: 'operator', label: '操作员' },
  { value: 'admin', label: '管理员' },
]

export const roleLabel = (role: string) => (role === 'admin' ? '管理员' : '操作员')

interface PermUser {
  role: string
  permissions?: string[]
}

export function storedUser(): PermUser | null {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const isAdmin = (user: PermUser | null = storedUser()): boolean => user?.role === 'admin'

export function can(permission: Permission, user: PermUser | null = storedUser()): boolean {
  if (!user) return false
  return user.role === 'admin' || (user.permissions ?? []).includes(permission)
}
