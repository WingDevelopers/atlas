import type { Place } from '../db/types'
import { countryAt, countryByName, type Country } from '../map/countries'
import { CONTINENT_ORDER, continentOf, type Continent } from '../map/continents'

export interface CityGroup {
  city: string
  places: Place[]
}
export interface CountryGroup {
  country: string
  countryId: string
  cities: CityGroup[]
  count: number
}
export interface ContinentGroup {
  continent: Continent | 'Somewhere else'
  countries: CountryGroup[]
  count: number
}

const CITYISH = new Set(['city', 'town', 'village', 'municipality', 'hamlet', 'suburb', 'borough', 'county', 'district', 'state_district', 'administrative'])

/** The town or city a place belongs to: its outline's name if that's a town/city, else its Region field, else its own name. */
export function cityOf(p: Place) {
  if (p.area?.name && (!p.area.kind || CITYISH.has(p.area.kind))) return p.area.name
  return p.region?.trim() || p.name
}

export function countryOfPlace(p: Place, countries: Country[]) {
  return (typeof p.lat === 'number' && typeof p.lng === 'number' ? countryAt(countries, p.lat, p.lng) : undefined) ?? countryByName(countries, p.country)
}

const byName = (a: { name?: string; city?: string; country?: string }, b: typeof a) =>
  (a.name ?? a.city ?? a.country ?? '').localeCompare(b.name ?? b.city ?? b.country ?? '')

/** Continent → country → city → places. Places with no pin and no recognisable country go under “Somewhere else”. */
export function placeTree(places: Place[], countries: Country[]): ContinentGroup[] {
  const conts = new Map<string, Map<string, { country: string; countryId: string; cities: Map<string, Place[]> }>>()
  for (const p of places) {
    const c = countryOfPlace(p, countries)
    const cont = (c && continentOf(c)) ?? 'Somewhere else'
    const countryName = c?.name ?? (p.country?.trim() || 'No country yet')
    const countryKey = c?.id ?? `?${countryName}`
    if (!conts.has(cont)) conts.set(cont, new Map())
    const cmap = conts.get(cont)!
    if (!cmap.has(countryKey)) cmap.set(countryKey, { country: countryName, countryId: countryKey, cities: new Map() })
    const entry = cmap.get(countryKey)!
    const city = c ? cityOf(p) : p.name
    if (!entry.cities.has(city)) entry.cities.set(city, [])
    entry.cities.get(city)!.push(p)
  }
  const order = (x: string) => {
    const i = (CONTINENT_ORDER as readonly string[]).indexOf(x)
    return i === -1 ? 99 : i
  }
  return [...conts.entries()]
    .sort(([a], [b]) => order(a) - order(b))
    .map(([continent, cmap]) => {
      const countriesOut: CountryGroup[] = [...cmap.values()]
        .map((x) => {
          const cities = [...x.cities.entries()].map(([city, ps]) => ({ city, places: ps.sort(byName as never) })).sort((a, b) => a.city.localeCompare(b.city))
          return { country: x.country, countryId: x.countryId, cities, count: cities.reduce((n, c) => n + c.places.length, 0) }
        })
        .sort((a, b) => a.country.localeCompare(b.country))
      return { continent: continent as ContinentGroup['continent'], countries: countriesOut, count: countriesOut.reduce((n, c) => n + c.count, 0) }
    })
}
