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
      { label: '产品资料', path: '/master/products' },
      { label: '客户资料', path: '/master/customers' },
      { label: '供应商资料', path: '/master/suppliers' },
    ],
  },
  {
    label: '采购管理',
    children: [
      { label: '新建进货单', path: '/purchase/orders/new' },
      { label: '进货查询', path: '/purchase/orders' },
      { label: '进货退货', path: '/purchase/returns/new' },
    ],
  },
  {
    label: '销售管理',
    children: [
      { label: '新建销售单', path: '/sales/orders/new' },
      { label: '销售查询', path: '/sales/orders' },
      { label: '销售退货', path: '/sales/returns/new' },
    ],
  },
  { label: '报损管理', path: '/loss' },
  { label: '库存管理', path: '/inventory' },
  {
    label: '报表中心',
    children: [
      { label: '销售报表', path: '/reports/sales' },
      { label: '采购报表', path: '/reports/purchase' },
      { label: '库存报表', path: '/reports/inventory' },
      { label: '排行榜', path: '/reports/rankings' },
    ],
  },
  { label: '销售开单', path: '/sales/orders/new' },
]

const ROUTE_LABELS: Record<string, string> = {
  '/': '进销存系统首页',
  '/master/products': '产品资料',
  '/master/customers': '客户资料',
  '/master/suppliers': '供应商资料',
  '/purchase/orders': '进货管理',
  '/purchase/orders/new': '新建进货单',
  '/purchase/returns/new': '进货退货',
  '/sales/orders': '销售管理',
  '/sales/orders/new': '新建销售单',
  '/sales/returns/new': '销售退货',
  '/loss': '报损管理',
  '/inventory': '库存管理',
  '/inventory/adjust': '库存调整',
  '/inventory/check': '库存盘点',
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
            ⊡ 切换到收支管理
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
