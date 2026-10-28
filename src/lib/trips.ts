import type { Adventure } from '../db/types'

const DAY = 86_400_000
const toDay = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))

/** Whole days from a to b (both YYYY-MM-DD). */
export const daysBetween = (a: string, b: string) => Math.round((toDay(b) - toDay(a)) / DAY)

/** The adventure happening today: started on/before today and not ended before today. Latest start wins. */
export function currentTrip(adventures: Adventure[], today: string): Adventure | undefined {
  return adventures
    .filter((a) => a.startDate <= today && (!a.endDate || a.endDate >= today))
    .filter((a) => !(a.homeAt && (!a.endDate || a.endDate <= today))) // “I’m home” was tapped
    .filter((a) => a.endDate || daysBetween(a.startDate, today) <= 60) // an open-ended trip older than two months is probably just missing its end date
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
}

/** The next adventure starting within `withinDays`. */
export function upcomingTrip(adventures: Adventure[], today: string, withinDays = 60): Adventure | undefined {
  return adventures
    .filter((a) => a.startDate > today && daysBetween(today, a.startDate) <= withinDays)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
}

/** "Day 3" or "Day 3 of 7". */
export function tripDayLabel(a: Adventure, today: string) {
  const day = daysBetween(a.startDate, today) + 1
  const total = a.endDate ? daysBetween(a.startDate, a.endDate) + 1 : undefined
  return total && total > 1 ? `Day ${day} of ${total}` : `Day ${day}`
}
