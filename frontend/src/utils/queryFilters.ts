import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

// List-page filters kept in the query string, like the old pages' ?rq1=&rq2=&xmz=&gjz=&nys= links,
// so going back from 修改 / 收款 shows the same search and page again.
// A value equal to its default is left out of the URL. Any change that doesn't set `page`
// drops it (back to page 1). The URL is replaced, not pushed: searching adds no history entries.
export function useQueryFilters<T extends { [K in keyof T]: string }>(defaults: T) {
  const [params, setParams] = useSearchParams()
  const qs = params.toString()

  const values = useMemo(() => {
    const out = { ...defaults }
    for (const k of Object.keys(defaults) as (keyof T & string)[]) {
      const v = params.get(k)
      if (v !== null) out[k] = v as T[typeof k]
    }
    return out
  // defaults hold today's dates — only the query string decides when the values change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs])

  function update(patch: Partial<T>) {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      if (!('page' in patch)) next.delete('page')
      for (const [k, v] of Object.entries(patch) as [keyof T & string, string | undefined][]) {
        if (v === undefined || v === defaults[k]) next.delete(k)
        else next.set(k, v)
      }
      return next
    }, { replace: true })
  }

  return [values, update] as const
}

/** `page` text from the URL → a page number within 1..totalPages */
export function pageOf(text: string, totalPages: number): number {
  return Math.min(Math.max(1, Math.floor(Number(text)) || 1), totalPages)
}
