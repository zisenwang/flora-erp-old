// Shared pieces of the 手机开单 pages (old jhsmpS/mxs_*.asp): top bar, bottom bar, draft, customer bar
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { getSalesOrders } from '@/api/sales'
import { getProductCategories } from '@/api/products'
import { useAuth } from '@/store/AuthContext'
import {
  SALES_DRAFT_KEY, loadDraft, saveDraft, newDraft,
  type Draft, type DraftCustomer,
} from '@/utils/salesDraft'
import styles from './Mobile.module.css'

export const MOBILE_HOME = '/m'          // 手机版首页
export const MOBILE_SALES = '/m/sales'   // 手机开单 page 1 (请选择一个客户)
export const MOBILE_PRODUCTS = '/m/sales/products'   // 手机开单 page 3 (选择产品)

// Same draft as 销售单录入 on the computer, so 未提交销售单 shows on both.
// selectCustomer (选择此客户): start a new, empty 销售单 for this customer, then go to page 3 (选择产品)
export function useSalesDraft() {
  const navigate = useNavigate()
  const [draft, setDraftState] = useState<Draft>(() => loadDraft(SALES_DRAFT_KEY))

  function setDraft(update: (d: Draft) => Draft) {
    setDraftState(d => {
      const next = update(d)
      saveDraft(SALES_DRAFT_KEY, next)
      return next
    })
  }

  function selectCustomer(c: DraftCustomer) {
    if (draft.lines.length > 0 && draft.customer?.id !== c.id &&
        !window.confirm('销售单中已有产品，选择新客户将清空当前销售单，确定吗？')) return
    if (draft.customer?.id !== c.id) setDraft(() => newDraft(c))
    navigate(MOBILE_PRODUCTS)
  }

  return { draft, setDraft, selectCustomer }
}

// ── Top bar: back / home / 云达ERP复刻版【user】 ──────────────────
export function MobileHeader() {
  const navigate = useNavigate()
  const { user } = useAuth()
  return (
    <div className={styles.header}>
      <span className={styles.headerBtn} onClick={() => navigate(-1)}>
        <svg width="22" height="20" viewBox="0 0 22 20">
          <path d="M10 3 L3 10 L10 17 M3 10 H19" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={styles.headerBtn} onClick={() => navigate(MOBILE_HOME)}>
        <svg width="16" height="15" viewBox="0 0 16 15">
          <path d="M8 1 L1 8 H3 V14 H6.5 V10 H9.5 V14 H13 V8 H15 Z" fill="#fff" />
        </svg>
      </span>
      <span className={styles.headerTitle}>
        云达ERP复刻版&nbsp;<span className={styles.headerUser}>【<span className={styles.userIcon}>👤</span>&nbsp;{user?.name ?? ''}】</span>
      </span>
    </div>
  )
}

// ── Bottom bar of 销售开单: 首页 / 分类 / 选择客户 / 订单 ─────────────
export function SalesFooter({ onCategory }: { onCategory: () => void }) {
  const navigate = useNavigate()
  return (
    <div className={styles.footer}>
      <div className={styles.footItem} onClick={() => navigate(MOBILE_HOME)}>
        <span className={styles.footIcon}>⌂</span>首页
      </div>
      <div className={styles.footItem} onClick={onCategory}>
        <span className={styles.footIcon}>＋</span>分类
      </div>
      <div className={`${styles.footItem} ${styles.footWide}`} onClick={() => navigate('/m/sales/customers')}>
        <span className={styles.footIcon}>👤</span>选择客户
      </div>
      <div className={styles.footItem} onClick={() => navigate('/m/sales/order')}>
        <span className={styles.footIcon}>☰</span>订单
      </div>
    </div>
  )
}

// Single-link bottom bar (返回上页)
export function BackFooter() {
  const navigate = useNavigate()
  return (
    <div className={`${styles.footer} ${styles.footerBack}`} onClick={() => navigate(-1)}>返回上页</div>
  )
}

// ── Green bar of recently billed customers (现场客户 汕头 阿强 …) ─────
const RECENT_CUSTOMERS = 5

export function RecentCustomers({ onSelect }: { onSelect: (c: DraftCustomer) => void }) {
  const [recent, setRecent] = useState<DraftCustomer[]>([])

  useEffect(() => {
    getSalesOrders({ startDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD') })
      .then(orders => {
        const seen = new Map<number, DraftCustomer>()
        for (const o of orders) {
          if (seen.size >= RECENT_CUSTOMERS) break
          if (!seen.has(o.customerId)) {
            seen.set(o.customerId, {
              id: o.customerId, code: o.customerCode, name: o.customerName,
              address: o.customerAddress ?? '', phone: o.customerPhone ?? '',
            })
          }
        }
        setRecent([...seen.values()])
      })
      .catch(() => setRecent([]))
  }, [])

  return (
    <div className={styles.recentOuter}>
      <div className={styles.recentInner}>
        {recent.map(c => (
          <a key={c.id} className={styles.recentLink} onClick={() => onSelect(c)}>{c.name}</a>
        ))}
      </div>
    </div>
  )
}

// ── 请选择产品分类 overlay ──────────────────────────────────────
export function CategoryOverlay({ onSelect, onClose }: { onSelect: (c: string) => void; onClose: () => void }) {
  const [categories, setCategories] = useState<string[]>([])
  useEffect(() => { getProductCategories().then(setCategories).catch(() => setCategories([])) }, [])
  return (
    <div className={styles.overlay}>
      <div className={styles.overlayHead}>
        &nbsp;请选择产品分类
        <span className={styles.overlayClose} onClick={onClose}>×</span>
      </div>
      <div className={styles.overlayBody}>
        <a className={styles.catItem} onClick={() => onSelect('')}>全部</a>
        {categories.map(c => (
          <a key={c} className={styles.catItem} onClick={() => onSelect(c)}>{c}</a>
        ))}
      </div>
    </div>
  )
}
