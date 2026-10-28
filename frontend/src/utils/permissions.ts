// 权限 — 管理员 (admin) can do everything; 操作员 (operator) only opens the pages ticked in
// 操作员表 → 权限 (one checkbox per page, customer request 10-20; the home page is always open).
// Read from the user saved at login, so a change takes effect after that operator logs in again.

// grouped like the nav bar — the 权限 page shows one heading per group
export const PERMISSION_GROUPS = [
  {
    title: '基础资料',
    items: [
      { key: 'product_category', label: '产品分类' },
      { key: 'product', label: '产品资料' },
      { key: 'price_adjust', label: '产品调价' },
      { key: 'customer', label: '客户资料' },
      { key: 'supplier', label: '供应商资料' },
    ],
  },
  {
    title: '采购管理',
    items: [
      { key: 'purchase_in', label: '采购入库' },
      { key: 'purchase_return', label: '采购退货' },
      { key: 'purchase_list', label: '采购单据' },
    ],
  },
  {
    title: '销售管理',
    items: [
      { key: 'sales_in', label: '销售出库' },
      { key: 'sales_return', label: '销售退货' },
      { key: 'sales_list', label: '销售单据' },
    ],
  },
  {
    title: '库存管理',
    items: [
      { key: 'inventory', label: '产品库存' },
      { key: 'inventory_adjust', label: '库存调整' },
      { key: 'inventory_check', label: '库存盘点' },
      { key: 'inventory_adjustments', label: '调整单据' },
    ],
  },
  {
    title: '报表中心',
    items: [
      { key: 'report_purchase', label: '采购报表' },
      { key: 'report_sales', label: '销售报表' },
      { key: 'report_inventory', label: '库存报表' },
    ],
  },
  {
    title: '其他',
    items: [
      { key: 'payment', label: '收支管理' },
      { key: 'mobile', label: '手机开单' },
      { key: 'loss', label: '报损管理' },
    ],
  },
] as const

export const PERMISSIONS = PERMISSION_GROUPS.flatMap(g => g.items)

export type Permission = (typeof PERMISSION_GROUPS)[number]['items'][number]['key']

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
