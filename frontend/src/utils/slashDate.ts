import dayjs from 'dayjs'

// Old-system date text ("2026/10/1") ⇄ API date ("2026-10-01")

export function toSlashDate(date: string | Date = new Date()): string {
  return dayjs(date).format('YYYY/M/D')
}

/** "2026/10/1" or "2026-10-01" → "2026-10-01"; null if not a valid date */
export function parseSlashDate(text: string): string | null {
  const m = text.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)
  if (!m) return null
  const d = dayjs(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`)
  return d.isValid() ? d.format('YYYY-MM-DD') : null
}

/** 1st of the current month, e.g. "2026/10/1" — default start date of the 单据 lists */
export function monthStart(): string {
  return toSlashDate(dayjs().startOf('month').toDate())
}
