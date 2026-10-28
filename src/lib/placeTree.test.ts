import { describe, expect, it } from 'vitest'
import topo from 'world-atlas/countries-50m.json'
import type { Topology } from 'topojson-specification'
import { buildCountries } from '../map/countries'
import { placeTree } from './placeTree'
import type { Place } from '../db/types'

const countries = buildCountries(topo as unknown as Topology)
let i = 0
const place = (p: Partial<Place>): Place => ({ id: `p${i++}`, name: 'x', status: 'visited', tags: [], notes: '', photoIds: [], createdAt: '', updatedAt: '', ...p })

describe('places by continent › country › city', () => {
  it('groups places, using the outline or region as the city', () => {
    const tree = placeTree(
      [
        place({ name: 'Disney World', lat: 28.385, lng: -81.563, area: { name: 'Bay Lake', kind: 'city', geometry: { type: 'Polygon', coordinates: [] }, forLat: 28.385, forLng: -81.563, source: 'openstreetmap' } }),
        place({ name: 'Orlando', lat: 28.5384, lng: -81.3792 }),
        place({ name: 'Lisbon', lat: 38.7223, lng: -9.1393 }),
        place({ name: 'Belém Tower', lat: 38.6916, lng: -9.216, region: 'Lisbon' }),
        place({ name: 'Monteverde', lat: 10.3009, lng: -84.8255 }),
        place({ name: 'Grandma’s house', country: 'Costa Rica' }),
        place({ name: 'Somewhere secret' }),
      ],
      countries,
    )
    expect(tree.map((c) => c.continent)).toEqual(['Europe', 'North America', 'Somewhere else'])
    const na = tree[1]
    expect(na.countries.map((c) => c.country)).toEqual(['Costa Rica', 'United States of America'])
    const usa = na.countries[1]
    expect(usa.cities.map((c) => c.city)).toEqual(['Bay Lake', 'Orlando'])
    const pt = tree[0].countries[0]
    expect(pt.country).toBe('Portugal')
    expect(pt.cities).toHaveLength(1)
    expect(pt.cities[0].places.map((p) => p.name)).toEqual(['Belém Tower', 'Lisbon'])
    expect(tree[2].count).toBe(1)
  })
})
