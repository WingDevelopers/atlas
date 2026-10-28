import { describe, expect, it } from 'vitest'
import topo from 'world-atlas/countries-50m.json'
import type { Topology } from 'topojson-specification'
import { buildCountries, countryAt, countryByName, countryFills } from './countries'
import type { Place } from '../db/types'

const countries = buildCountries(topo as unknown as Topology)
const place = (p: Partial<Place>): Place => ({ id: Math.random().toString(36), name: 'x', status: 'visited', tags: [], notes: '', photoIds: [], createdAt: '', updatedAt: '', ...p })

describe('countries', () => {
  it('finds the country under a pin', () => {
    expect(countryAt(countries, 38.7223, -9.1393)?.name).toBe('Portugal') // Lisbon
    expect(countryAt(countries, 9.9281, -84.0907)?.name).toBe('Costa Rica') // San José
    expect(countryAt(countries, 35.0116, 135.7681)?.name).toBe('Japan') // Kyoto
    expect(countryAt(countries, -50.94, -73.4)?.name).toBe('Chile') // Torres del Paine
    expect(countryAt(countries, 40.7128, -74.006)?.name).toBe('United States of America')
    expect(countryAt(countries, 30, -40)).toBeUndefined() // mid-Atlantic
  })
  it('matches typed country names, including common aliases', () => {
    expect(countryByName(countries, 'portugal')?.name).toBe('Portugal')
    expect(countryByName(countries, 'USA')?.name).toBe('United States of America')
    expect(countryByName(countries, 'España')?.name).toBe('Spain')
    expect(countryByName(countries, 'Atlantis')).toBeUndefined()
  })
  it('colours each country once — visited wins over wishlist', () => {
    const fills = countryFills(countries, [
      place({ lat: 38.72, lng: -9.14, status: 'wishlist' }),
      place({ lat: 38.8, lng: -9.38, status: 'visited' }),
      place({ lat: 35.01, lng: 135.77, status: 'wishlist' }),
      place({ country: 'Costa Rica' }), // no pin, typed country
    ])
    const by = Object.fromEntries(fills.map((f) => [f.country.name, [f.status, f.places.length]]))
    expect(by).toEqual({ Portugal: ['visited', 2], Japan: ['wishlist', 1], 'Costa Rica': ['visited', 1] })
  })
})
