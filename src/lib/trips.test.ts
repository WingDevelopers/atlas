import { describe, expect, it } from 'vitest'
import { currentTrip, daysBetween, tripDayLabel, upcomingTrip } from './trips'
import type { Adventure } from '../db/types'

let n = 0
const adv = (startDate: string, endDate?: string): Adventure => ({ id: `a${n++}`, title: startDate, startDate, endDate, placeIds: [], story: '', companions: '', tags: [], highlight: '', photoIds: [], createdAt: '', updatedAt: '' })

describe('current trip', () => {
  it('finds the trip happening today', () => {
    const past = adv('2026-01-01', '2026-01-05')
    const now = adv('2026-10-26')
    const planned = adv('2026-10-20', '2026-10-30')
    const later = adv('2026-11-10', '2026-11-12')
    expect(currentTrip([past, now, planned, later], '2026-10-28')?.id).toBe(now.id) // latest start wins
    expect(currentTrip([past, planned], '2026-10-28')?.id).toBe(planned.id)
    expect(currentTrip([past, later], '2026-10-28')).toBeUndefined()
    expect(currentTrip([adv('2026-01-01')], '2026-10-28')).toBeUndefined() // forgotten end date
    expect(upcomingTrip([past, later], '2026-10-28')?.id).toBe(later.id)
    const home = { ...adv('2026-10-26', '2026-10-28'), homeAt: '2026-10-28T18:00:00Z' }
    expect(currentTrip([home], '2026-10-28')).toBeUndefined() // tapped “I’m home” on the last day
  })
  it('labels the day', () => {
    expect(daysBetween('2026-10-26', '2026-10-28')).toBe(2)
    expect(tripDayLabel(adv('2026-10-26'), '2026-10-28')).toBe('Day 3')
    expect(tripDayLabel(adv('2026-10-26', '2026-11-01'), '2026-10-28')).toBe('Day 3 of 7')
  })
})
