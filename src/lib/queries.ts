import { useLiveQuery } from 'dexie-react-hooks'
import { getDb } from '../db/db'
import type { Adventure, Chapter, Dream, Memory, Milestone, Place } from '../db/types'

export interface AllData {
  places: Place[]
  adventures: Adventure[]
  memories: Memory[]
  milestones: Milestone[]
  dreams: Dream[]
  chapters: Chapter[]
}

/** Live view of every record. Fine for a personal-scale atlas (thousands of entries). */
export function useAll(): AllData | undefined {
  return useLiveQuery(async () => {
    const db = getDb()
    const [places, adventures, memories, milestones, dreams, chapters] = await Promise.all([
      db.places.toArray(),
      db.adventures.toArray(),
      db.memories.toArray(),
      db.milestones.toArray(),
      db.dreams.toArray(),
      db.chapters.toArray(),
    ])
    return { places, adventures, memories, milestones, dreams, chapters }
  }, [])
}

export const coverOf = (r: { coverId?: string; photoIds?: string[] }) => r.coverId ?? r.photoIds?.[0]

export type TimelineEntry =
  | { kind: 'adventure'; date?: string; rec: Adventure }
  | { kind: 'memory'; date?: string; rec: Memory }
  | { kind: 'milestone'; date?: string; rec: Milestone }

export function timeline(d: AllData): TimelineEntry[] {
  const items: TimelineEntry[] = [
    ...d.adventures.map((rec) => ({ kind: 'adventure' as const, date: rec.startDate, rec })),
    ...d.memories.map((rec) => ({ kind: 'memory' as const, date: rec.date, rec })),
    ...d.milestones.map((rec) => ({ kind: 'milestone' as const, date: rec.date, rec })),
  ]
  // newest first; undated entries last (ordered by when they were added)
  return items.sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date) || b.rec.createdAt.localeCompare(a.rec.createdAt)
    if (a.date) return -1
    if (b.date) return 1
    return b.rec.createdAt.localeCompare(a.rec.createdAt)
  })
}

export function stats(d: AllData) {
  const visited = d.places.filter((p) => p.status === 'visited')
  const countries = new Set(visited.map((p) => p.country?.trim().toLowerCase()).filter(Boolean))
  return {
    places: visited.length,
    wishlist: d.places.length - visited.length,
    countries: countries.size,
    adventures: d.adventures.length,
    memories: d.memories.length,
    milestones: d.milestones.length,
    dreams: d.dreams.filter((x) => x.status !== 'completed').length,
    dreamsDone: d.dreams.filter((x) => x.status === 'completed').length,
    photos: [...d.places, ...d.adventures, ...d.memories, ...d.milestones, ...d.dreams].reduce((n, r) => n + r.photoIds.length, 0),
  }
}

export function nextDream(dreams: Dream[]) {
  const order = { booked: 0, planning: 1, someday: 2, completed: 9 }
  return [...dreams].filter((d) => d.status !== 'completed').sort((a, b) => order[a.status] - order[b.status] || a.createdAt.localeCompare(b.createdAt))[0]
}

/** Dates a place was visited, from its own date and linked entries. */
export function visitsFor(place: Place, d: AllData) {
  const visits: { date: string; label: string; to?: string }[] = []
  if (place.visitedOn) visits.push({ date: place.visitedOn, label: 'Visited' })
  for (const a of d.adventures) if (a.placeIds.includes(place.id)) visits.push({ date: a.startDate, label: a.title, to: `/adventure/${a.id}` })
  for (const m of d.memories) if (m.placeId === place.id && m.date) visits.push({ date: m.date, label: m.title, to: `/memory/${m.id}` })
  return visits.sort((a, b) => b.date.localeCompare(a.date))
}

export function placeYears(place: Place, d: AllData): Set<string> {
  return new Set(visitsFor(place, d).map((v) => v.date.slice(0, 4)))
}
