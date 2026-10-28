import type { Chapter, ChapterItem } from '../db/types'
import type { AllData, TimelineEntry } from './queries'

/** Turn a chapter's item references into entries, skipping any that no longer exist. */
export function resolveItems(items: ChapterItem[], d: AllData): TimelineEntry[] {
  const out: TimelineEntry[] = []
  for (const i of items) {
    if (i.type === 'adventure') {
      const rec = d.adventures.find((x) => x.id === i.id)
      if (rec) out.push({ kind: 'adventure', date: rec.startDate, rec })
    } else if (i.type === 'memory') {
      const rec = d.memories.find((x) => x.id === i.id)
      if (rec) out.push({ kind: 'memory', date: rec.date, rec })
    } else {
      const rec = d.milestones.find((x) => x.id === i.id)
      if (rec) out.push({ kind: 'milestone', date: rec.date, rec })
    }
  }
  return out
}

const entryKey = (e: TimelineEntry) => `${e.kind}:${e.rec.id}`
const inRange = (date: string | undefined, start: string, end?: string) => !!date && date >= start && (!end || date <= end)

/**
 * Everything shown in a chapter. Hand-made chapters: their items, in their order.
 * Automatic chapters (opened from a milestone): their items plus every entry dated
 * inside the chapter's range, minus anything taken out by hand — oldest first.
 */
export function chapterEntries(c: Chapter, d: AllData): TimelineEntry[] {
  const explicit = resolveItems(c.items, d)
  if (!c.autoInclude || !c.startDate) return explicit
  const excluded = new Set((c.excluded ?? []).map((i) => `${i.type}:${i.id}`))
  const map = new Map<string, TimelineEntry>()
  for (const e of explicit) map.set(entryKey(e), e)
  for (const a of d.adventures) if (inRange(a.startDate, c.startDate, c.endDate)) map.set(`adventure:${a.id}`, { kind: 'adventure', date: a.startDate, rec: a })
  for (const m of d.memories) if (inRange(m.date, c.startDate, c.endDate)) map.set(`memory:${m.id}`, { kind: 'memory', date: m.date, rec: m })
  for (const m of d.milestones) if (inRange(m.date, c.startDate, c.endDate)) map.set(`milestone:${m.id}`, { kind: 'milestone', date: m.date, rec: m })
  return [...map.entries()]
    .filter(([k]) => !excluded.has(k))
    .map(([, e]) => e)
    .sort((a, b) => (a.date && b.date ? a.date.localeCompare(b.date) || (a.kind === 'milestone' ? -1 : b.kind === 'milestone' ? 1 : 0) : a.date ? -1 : b.date ? 1 : 0))
}

/** Oldest first; undated entries keep their place at the end. */
export function sortItemsByDate(items: ChapterItem[], d: AllData): ChapterItem[] {
  const entries = resolveItems(items, d)
  const date = new Map(entries.map((e) => [e.kind + ':' + e.rec.id, e.date]))
  return [...items].sort((a, b) => {
    const da = date.get(a.type + ':' + a.id)
    const db = date.get(b.type + ':' + b.id)
    if (da && db) return da.localeCompare(db)
    return da ? -1 : db ? 1 : 0
  })
}

/** Date span covered by a chapter: its own dates, or else its entries' dates. */
export function chapterSpan(c: Chapter, d: AllData): { start?: string; end?: string; open?: boolean } {
  if (c.startDate || c.endDate) return { start: c.startDate, end: c.endDate, open: !!c.startDate && !c.endDate }
  const dates = chapterEntries(c, d)
    .flatMap((e) => (e.kind === 'adventure' ? [e.rec.startDate, e.rec.endDate] : [e.date]))
    .filter(Boolean) as string[]
  if (!dates.length) return {}
  dates.sort()
  return { start: dates[0], end: dates[dates.length - 1] }
}

/** Cover for a chapter: its chosen photo, else the first photo among its entries. */
export function chapterCover(c: Chapter, d: AllData): string | undefined {
  if (c.coverId) return c.coverId
  for (const e of chapterEntries(c, d)) {
    const id = e.rec.coverId ?? e.rec.photoIds[0]
    if (id) return id
  }
  return undefined
}

export function chaptersContaining(type: ChapterItem['type'], id: string, d: AllData) {
  return d.chapters.filter((c) => chapterEntries(c, d).some((e) => e.kind === type && e.rec.id === id))
}

export interface ChapterSuggestion {
  /** Stable key: the milestone it starts with. */
  key: string
  title: string
  startDate: string
  endDate?: string
  items: ChapterItem[]
}

const dayBefore = (iso: string) => {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Suggest chapters from milestones: each milestone can open a chapter that runs
 * from its date forward — until the day before the next milestone, or ongoing
 * if it's the latest. Milestones already used to open a chapter (or dismissed)
 * aren't suggested again.
 */
export function suggestChapters(d: AllData, dismissed: string[] = []): ChapterSuggestion[] {
  const milestones = [...d.milestones].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
  const used = new Set<string>()
  for (const c of d.chapters) {
    if (c.suggestedFrom) used.add(c.suggestedFrom)
    // a milestone placed in a chapter by hand ("keep going") has been decided
    for (const i of c.items) if (i.type === 'milestone') used.add(i.id)
  }
  const skip = new Set([...used, ...dismissed])
  const out: ChapterSuggestion[] = []
  milestones.forEach((m, idx) => {
    if (skip.has(m.id)) return
    const next = milestones.slice(idx + 1).find((n) => n.date > m.date)
    const end = next ? dayBefore(next.date) : undefined
    const within = (date?: string) => inRange(date, m.date, end)
    const dated = [
      ...d.adventures.filter((a) => within(a.startDate)).map((a) => ({ date: a.startDate, item: { type: 'adventure' as const, id: a.id } })),
      ...d.memories.filter((x) => within(x.date)).map((x) => ({ date: x.date!, item: { type: 'memory' as const, id: x.id } })),
      ...d.milestones.filter((x) => x.id !== m.id && x.date === m.date).map((x) => ({ date: x.date, item: { type: 'milestone' as const, id: x.id } })),
    ].sort((a, b) => a.date.localeCompare(b.date))
    out.push({ key: m.id, title: m.title, startDate: m.date, endDate: end, items: [{ type: 'milestone', id: m.id }, ...dated.map((x) => x.item)] })
  })
  return out.reverse() // newest first
}
