const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-05-03" → "3 May 2026" */
export function fmtDate(d?: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-').map(Number)
  if (!y || !m) return d
  return `${day ? day + ' ' : ''}${MONTHS[m - 1]} ${y}`
}

export function fmtRange(start?: string, end?: string) {
  if (!start) return ''
  if (!end || end === start) return fmtDate(start)
  const [ys, ms] = start.split('-')
  const [ye, me, de] = end.split('-').map(Number)
  if (ys === String(ye) && ms === String(me).padStart(2, '0')) return `${Number(start.split('-')[2])}–${de} ${MONTHS[me - 1]} ${ye}`
  return `${fmtDate(start)} – ${fmtDate(end)}`
}

export function postmark(d?: string) {
  if (!d) return ''
  const [y, m] = d.split('-').map(Number)
  return `${MONTHS[m - 1]}\n${y}`
}

export const yearOf = (d?: string) => (d ? d.slice(0, 4) : undefined)

export function placeLine(p: { region?: string; country?: string; address?: string }) {
  return [p.region, p.country].filter(Boolean).join(', ') || p.address || ''
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function splitTags(s: string) {
  return s
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

export function bytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function greeting(date = new Date()) {
  const h = date.getHours()
  if (h < 5) return 'Still awake'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function safeUrl(u: string) {
  try {
    const url = new URL(u.includes('://') ? u : `https://${u}`)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined
  } catch {
    return undefined
  }
}
