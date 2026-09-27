import { useState, useRef, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/store/AuthContext'
import styles from './MainLayout.module.css'

interface NavItem {
  label: string
  path?: string
  children?: { label: string; path: string }[]
}

const NAV_ITEMS: NavItem[] = [
  {
    label: '基础资料',
    children: [
      { label: '产品分类', path: '/master/categories' },
      { label: '产品资料', path: '/master/products' },
      { label: '产品调价', path: '/master/price-adjust' },
      { label: '客户资料', path: '/master/customers' },
      { label: '供应商资料', path: '/master/suppliers' },
      { label: '修改密码', path: '/settings/password' },
    ],
  },
  {
    label: '采购管理',
    children: [
      { label: '采购入库', path: '/purchase/orders/new' },
      { label: '采购退货', path: '/purchase/returns/new' },
      { label: '采购单据', path: '/purchase/orders' },
    ],
  },
  {
    label: '销售管理',
    children: [
      { label: '销售出库', path: '/sales/orders/new' },
      { label: '销售退货', path: '/sales/returns/new' },
      { label: '销售单据', path: '/sales/orders' },
    ],
  },
  {
    label: '报损管理',
    children: [
      { label: '报损记录', path: '/loss' },
      { label: '新增报损', path: '/loss/new' },
    ],
  },
  {
    label: '库存管理',
    children: [
      { label: '产品库存', path: '/inventory' },
      { label: '库存调整', path: '/inventory/adjust' },
      { label: '调整单据', path: '/inventory/adjustments' },
      { label: '库存盘点', path: '/inventory/check' },
      { label: '盘点单据', path: '/inventory/check-records' },
    ],
  },
  {
    label: '报表中心',
    children: [
      { label: '销售报表', path: '/reports/sales' },
      { label: '采购报表', path: '/reports/purchase' },
      { label: '库存报表', path: '/reports/inventory' },
      { label: '排行榜', path: '/reports/rankings' },
    ],
  },
  { label: '销售订单', path: '/sales/orders' },
]

const ROUTE_LABELS: Record<string, string> = {
  '/': '进销存系统首页',
  '/master/categories': '产品分类',
  '/master/products': '产品资料',
  '/master/price-adjust': '产品调价',
  '/master/customers': '客户资料',
  '/master/suppliers/new': '新增供应商',
  '/master/suppliers/edit': '修改供应商',
  '/master/suppliers': '供应商资料',
  '/settings/password': '修改密码',
  '/purchase/orders/new': '采购入库',
  '/purchase/returns/new': '采购退货',
  '/purchase/orders': '采购单据',
  '/sales/orders/new': '销售出库',
  '/sales/returns/new': '销售退货',
  '/sales/orders': '销售单据',
  '/loss': '报损记录',
  '/loss/new': '新增报损',
  '/inventory': '产品库存',
  '/inventory/adjust': '库存调整',
  '/inventory/adjustments': '调整单据',
  '/inventory/check': '库存盘点',
  '/inventory/check-records': '盘点单据',
  '/reports/sales': '销售报表',
  '/reports/purchase': '采购报表',
  '/reports/inventory': '库存报表',
  '/reports/rankings': '排行榜',
  '/payment': '收支管理',
  '/settings': '系统设置',
}

export default function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const navRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const getBreadcrumb = () => {
    const path = location.pathname
    if (ROUTE_LABELS[path]) return ROUTE_LABELS[path]
    for (const [key, label] of Object.entries(ROUTE_LABELS)) {
      if (key !== '/' && path.startsWith(key)) return label
    }
    return '进销存系统'
  }

  return (
    <div className={styles.root}>
      {/* ── Green top navigation bar ── */}
      <div className={styles.navbar} ref={navRef}>
        <div className={styles.navLeft}>
          {NAV_ITEMS.map((item, idx) => (
            <div
              key={item.label}
              className={styles.navItem}
              onMouseEnter={() => item.children && setOpenMenu(item.label)}
              onMouseLeave={() => item.children && setOpenMenu(null)}
              onClick={() => {
                if (item.path) { navigate(item.path); setOpenMenu(null) }
              }}
            >
              {idx > 0 && <span className={styles.pipe}>│</span>}
              <span className={styles.navLink}>{item.label}</span>

              {item.children && openMenu === item.label && (
                <div className={styles.dropdown}>
                  {item.children.map((child) => (
                    <div
                      key={child.path}
                      className={styles.dropdownItem}
                      onClick={(e) => { e.stopPropagation(); navigate(child.path); setOpenMenu(null) }}
                    >
                      {child.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <span className={styles.pipe}>│</span>
          <div className={styles.switchBtn} onClick={() => navigate('/payment')}>
            切换到收支管理
          </div>
        </div>

        <div className={styles.navRight}>
          <span className={styles.navLink} onClick={() => navigate('/')}>首页</span>
          <span className={styles.pipe}>│</span>
          <span className={styles.version}>云达ERP</span>
          <span className={styles.pipe}>│</span>
          <span className={styles.navUser}>👤 {user?.name ?? '用户'}</span>
          <span className={styles.pipe}>│</span>
          <span className={styles.navLink} onClick={logout}>退出系统</span>
        </div>
      </div>

      {/* ── Breadcrumb sub-bar ── */}
      <div className={styles.subbar}>
        <span className={styles.subArrow}>▶▶</span>
        <span className={styles.subLabel}>{getBreadcrumb()}</span>
      </div>

      {/* ── Page content ── */}
      <div className={styles.content}>
        <Outlet />
      </div>
    </div>
  )
}
