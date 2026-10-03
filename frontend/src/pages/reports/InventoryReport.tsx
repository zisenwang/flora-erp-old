import { Fragment, useEffect, useState } from 'react'
import { getProducts, type Product } from '@/api/products'
import { getPurchaseOrdersDetail } from '@/api/purchase'
import { getSalesOrdersDetail } from '@/api/sales'
import { getErrorMessage } from '@/utils/error'
import { monthStart, parseSlashDate, toSlashDate } from '@/utils/slashDate'
import { SearchIcon } from '@/pages/master/SupplierIcons'
import styles from './Report.module.css'

type Business = 'all' | 'with' | 'without'
type Field = 'supplier' | 'code' | 'name' | 'spec'

// period movements per product code, from the current order / return lines
// (so edits and voids are reflected — inventory_adjustments only logs creation)
interface Moves {
  sold: number
  purchased: number
  saleReturned: number
  purchaseReturned: number
}

const NO_MOVES: Moves = { sold: 0, purchased: 0, saleReturned: 0, purchaseReturned: 0 }

// green header repeats every N rows, like the old report
const HEADER_EVERY = 25

const money = (n: number | null) => (n != null ? Number(n).toFixed(2) : '')
// 件数 = ceil(库存 / 每件数量), same rule as the rest of the system; blank without 每件数量
const piecesOf = (p: Product) => (p.unitsPerPiece ? Math.ceil(p.stock / p.unitsPerPiece) : '')

// 产品库存报表 — old bb_hzb_byd.asp layout with the new system's columns plus
// 本期售出数 / 本期进货数 / 本期售退数 / 本期进退数 for the date range
export default function InventoryReport() {
  // ── Bar: date range (查询) ───────────────────────────────────
  const [dates, setDates] = useState({ start: monthStart(), end: toSlashDate() })
  const [appliedDates, setAppliedDates] = useState(dates)

  // ── Row below: 筛选 ──────────────────────────────────────────
  const [business, setBusiness] = useState<Business>('all')
  const [field, setField] = useState<Field>('code')
  const [keyword, setKeyword] = useState('')
  const [applied, setApplied] = useState({ business: 'all' as Business, field: 'code' as Field, keyword: '' })

  // ── Data ─────────────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([])
  const [moves, setMoves] = useState<Record<string, Moves>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProducts().then(setProducts).catch(err => alert(getErrorMessage(err)))
  }, [])

  useEffect(() => {
    const params = {
      startDate: parseSlashDate(appliedDates.start) ?? undefined,
      endDate: parseSlashDate(appliedDates.end) ?? undefined,
    }
    setLoading(true)
    Promise.all([getSalesOrdersDetail(params), getPurchaseOrdersDetail(params)])
      .then(([sales, purchases]) => {
        const m: Record<string, Moves> = {}
        const add = (code: string, key: keyof Moves, qty: number) => {
          m[code] = m[code] ?? { ...NO_MOVES }
          m[code][key] += Math.abs(qty)
        }
        for (const r of sales) add(r.productCode, r.rowType === 'order' ? 'sold' : 'saleReturned', r.qty)
        for (const r of purchases) add(r.productCode, r.rowType === 'order' ? 'purchased' : 'purchaseReturned', r.qty)
        setMoves(m)
      })
      .catch(err => alert(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [appliedDates])

  // ── Derived ──────────────────────────────────────────────────
  const hasBusiness = (code: string) => {
    const mv = moves[code]
    return !!mv && mv.sold + mv.purchased + mv.saleReturned + mv.purchaseReturned > 0
  }

  const q = applied.keyword.toLowerCase()
  const rows = products
    .filter(p => {
      if (applied.business === 'with' && !hasBusiness(p.code)) return false
      if (applied.business === 'without' && hasBusiness(p.code)) return false
      if (!q) return true
      switch (applied.field) {
        case 'supplier': return (p.supplierCode ?? '').toLowerCase().includes(q) || (p.supplierName ?? '').toLowerCase().includes(q)
        case 'name': return p.name.toLowerCase().includes(q)
        case 'spec': return (p.spec ?? '').toLowerCase().includes(q)
        case 'code':
        default: return p.code.toLowerCase().includes(q)
      }
    })
    .sort((a, b) => a.code.localeCompare(b.code))

  // ── Actions ──────────────────────────────────────────────────
  function handleQuery() {
    if (dates.start && !parseSlashDate(dates.start)) { alert('开始日期格式不正确，例如 2026/10/1'); return }
    if (dates.end && !parseSlashDate(dates.end)) { alert('结束日期格式不正确，例如 2026/10/1'); return }
    setAppliedDates(dates)
  }

  const header = (
    <tr>
      <th>&nbsp;编码&nbsp;</th>
      <th style={{ textAlign: 'left' }}>&nbsp;品名&nbsp;规格&nbsp;等级&nbsp;</th>
      <th>&nbsp;当前库存&nbsp;</th>
      <th>&nbsp;件数&nbsp;</th>
      <th>&nbsp;每件数量&nbsp;</th>
      <th>&nbsp;成本价&nbsp;</th>
      <th>&nbsp;售价&nbsp;</th>
      <th>&nbsp;本期售出数&nbsp;</th>
      <th>&nbsp;本期进货数&nbsp;</th>
      <th>&nbsp;本期售退数&nbsp;</th>
      <th>&nbsp;本期进退数&nbsp;</th>
    </tr>
  )

  const caption = appliedDates.start || appliedDates.end
    ? `从${appliedDates.start || '最早'}到${appliedDates.end || '今天'}产品库存报表`
    : '全部产品库存报表'

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ── Bar: 从 … 至 … 查询 (Enter = 查询) ── */}
      <form className={styles.subbar} onSubmit={e => { e.preventDefault(); handleQuery() }}>
        <SearchIcon />
        从<input className={styles.dateInput} type="text" value={dates.start} onChange={e => setDates(d => ({ ...d, start: e.target.value }))} />
        至<input className={styles.dateInput} type="text" value={dates.end} onChange={e => setDates(d => ({ ...d, end: e.target.value }))} />
        <input type="submit" value="查询" />
      </form>

      {/* ── Red title + 筛选 (Enter = 筛选) ── */}
      <form className={styles.invTitleRow} onSubmit={e => { e.preventDefault(); setApplied({ business, field, keyword: keyword.trim() }) }}>
        <span className={styles.invTitle}>{caption}</span>
        <SearchIcon />
        <select value={business} onChange={e => setBusiness(e.target.value as Business)}>
          <option value="all">显示全部产品</option>
          <option value="with">只显示有发生业务的产品</option>
          <option value="without">只显示没有发生业务的产品</option>
        </select>
        <select value={field} onChange={e => setField(e.target.value as Field)}>
          <option value="supplier">供货商</option>
          <option value="code">货品编码</option>
          <option value="name">货品名称</option>
          <option value="spec">货品规格</option>
        </select>
        <input className={styles.invKeyword} type="text" value={keyword} onChange={e => setKeyword(e.target.value)} />
        <input type="submit" value="筛选" />
      </form>

      <div className={styles.body}>
        {loading ? <div className={styles.loading}>数据加载中，请稍候...</div> : (
          <table className={styles.grid}>
            <thead>{header}</thead>
            <tbody>
              {rows.map((p, i) => {
                const mv = moves[p.code] ?? NO_MOVES
                return (
                  <Fragment key={p.id}>
                    {i > 0 && i % HEADER_EVERY === 0 && header}
                    <tr className={styles.row}>
                      <td>&nbsp;<span className={styles.boldCode}>{p.code}</span>&nbsp;</td>
                      <td>&nbsp;{p.name}&nbsp;{p.spec ?? ''}&nbsp;{p.grade ?? ''}&nbsp;</td>
                      <td className={`${styles.c} ${styles.bold}`}>&nbsp;{p.stock}&nbsp;</td>
                      <td className={styles.c}>&nbsp;{piecesOf(p)}&nbsp;</td>
                      <td className={styles.c}>&nbsp;{p.unitsPerPiece ?? ''}&nbsp;</td>
                      <td className={`${styles.r} ${styles.magenta}`}>&nbsp;{money(p.costPrice)}&nbsp;</td>
                      <td className={`${styles.r} ${styles.magenta}`}>&nbsp;{money(p.price)}&nbsp;</td>
                      <td className={`${styles.c} ${styles.teal}`}>&nbsp;{mv.sold}&nbsp;</td>
                      <td className={styles.c}>&nbsp;{mv.purchased}&nbsp;</td>
                      <td className={`${styles.c} ${styles.magenta}`}>&nbsp;{mv.saleReturned}&nbsp;</td>
                      <td className={`${styles.c} ${styles.magenta}`}>&nbsp;{mv.purchaseReturned}&nbsp;</td>
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
        <div className={styles.countLine}>共{rows.length}个产品</div>
      </div>
    </div>
  )
}
