import type { Feature, MultiPolygon, Polygon, Position } from 'geojson'
import type { Topology, GeometryCollection } from 'topojson-specification'
import { feature } from 'topojson-client'
import type { Place, PlaceStatus } from '../db/types'

/**
 * Country shapes for filling visited / wishlist countries on the map.
 *
 * Source: world-atlas "countries-50m" (Natural Earth 1:50m, public domain,
 * packaged by Mike Bostock, ISC licence). Bundled with the app so it works
 * offline; loaded only when the map opens.
 */

export interface Country {
  id: string
  name: string
  feature: Feature<Polygon | MultiPolygon, { name: string }>
  bbox: [number, number, number, number] // minLng, minLat, maxLng, maxLat
}

let cache: Promise<Country[]> | null = null

export function loadCountries(): Promise<Country[]> {
  if (!cache) {
    cache = import('world-atlas/countries-50m.json').then((m) => buildCountries((m.default ?? m) as unknown as Topology))
  }
  return cache
}

export function buildCountries(topo: Topology): Country[] {
  const fc = feature(topo, topo.objects.countries as GeometryCollection<{ name: string }>)
  const out: Country[] = []
  for (const f of fc.features) {
    if (!f.geometry || (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon')) continue
    const feat = f as Feature<Polygon | MultiPolygon, { name: string }>
    out.push({ id: String(f.id ?? f.properties.name), name: f.properties.name, feature: feat, bbox: bboxOf(feat.geometry) })
  }
  return out
}

function bboxOf(g: Polygon | MultiPolygon): [number, number, number, number] {
  let a = Infinity,
    b = Infinity,
    c = -Infinity,
    d = -Infinity
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  for (const poly of polys)
    for (const [x, y] of poly[0]) {
      if (x < a) a = x
      if (y < b) b = y
      if (x > c) c = x
      if (y > d) d = y
    }
  return [a, b, c, d]
}

function inRing(lng: number, lat: number, ring: Position[]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function inPolygon(lng: number, lat: number, poly: Position[][]) {
  if (!inRing(lng, lat, poly[0])) return false
  for (let h = 1; h < poly.length; h++) if (inRing(lng, lat, poly[h])) return false // holes
  return true
}

/** Rough distance in km from a point to a ring's edges (fine for small distances). */
function distToRingKm(lng: number, lat: number, ring: Position[]) {
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180)
  const ky = 110.57
  let best = Infinity
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = (ring[j][0] - lng) * kx, ay = (ring[j][1] - lat) * ky
    const bx = (ring[i][0] - lng) * kx, by = (ring[i][1] - lat) * ky
    const dx = bx - ax, dy = by - ay
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)))
    const d = Math.hypot(ax + t * dx, ay + t * dy)
    if (d < best) best = d
  }
  return best
}

/** Pins on coasts, estuaries or tiny islands can fall just outside simplified borders. */
const NEAR_KM = 30

export function countryAt(countries: Country[], lat: number, lng: number): Country | undefined {
  let nearest: Country | undefined
  let nearestKm = NEAR_KM
  const pad = 0.5 // degrees, for the "nearby" check
  for (const c of countries) {
    const [a, b, cc, d] = c.bbox
    if (lng < a - pad || lng > cc + pad || lat < b - pad || lat > d + pad) continue
    const g = c.feature.geometry
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
    if (lng >= a && lng <= cc && lat >= b && lat <= d && polys.some((p) => inPolygon(lng, lat, p))) return c
    for (const p of polys) {
      const km = distToRingKm(lng, lat, p[0])
      if (km < nearestKm) {
        nearestKm = km
        nearest = c
      }
    }
  }
  return nearest
}

/* Common ways people write country names → Natural Earth names. */
const ALIASES: Record<string, string> = {
  usa: 'United States of America',
  us: 'United States of America',
  'u.s.': 'United States of America',
  'u.s.a.': 'United States of America',
  'united states': 'United States of America',
  'estados unidos': 'United States of America',
  uk: 'United Kingdom',
  'great britain': 'United Kingdom',
  britain: 'United Kingdom',
  england: 'United Kingdom',
  scotland: 'United Kingdom',
  wales: 'United Kingdom',
  'reino unido': 'United Kingdom',
  'czech republic': 'Czechia',
  'south korea': 'South Korea',
  korea: 'South Korea',
  'north korea': 'North Korea',
  russia: 'Russia',
  'the netherlands': 'Netherlands',
  holland: 'Netherlands',
  'holanda': 'Netherlands',
  'españa': 'Spain',
  espana: 'Spain',
  'méxico': 'Mexico',
  'perú': 'Peru',
  'panamá': 'Panama',
  'brasil': 'Brazil',
  'alemania': 'Germany',
  'francia': 'France',
  'italia': 'Italy',
  'japón': 'Japan',
  'japon': 'Japan',
  'ivory coast': "Côte d'Ivoire",
  'dominican republic': 'Dominican Rep.',
  'república dominicana': 'Dominican Rep.',
  'bosnia and herzegovina': 'Bosnia and Herz.',
  'czechia': 'Czechia',
  uae: 'United Arab Emirates',
}

const norm = (s: string) => s.trim().toLowerCase()

export function countryByName(countries: Country[], name?: string): Country | undefined {
  if (!name?.trim()) return undefined
  const n = norm(name)
  const target = ALIASES[n] ? norm(ALIASES[n]) : n
  return countries.find((c) => norm(c.name) === target)
}

export type CountryStatus = PlaceStatus // 'visited' | 'wishlist'

export interface CountryFill {
  country: Country
  status: CountryStatus
  places: Place[]
}

/**
 * Work out which country each place belongs to (its pin first, then its
 * Country field) and colour each country: visited wins over wishlist.
 */
export function countryFills(countries: Country[], places: Place[]): CountryFill[] {
  const map = new Map<string, CountryFill>()
  for (const p of places) {
    const c = (typeof p.lat === 'number' && typeof p.lng === 'number' ? countryAt(countries, p.lat, p.lng) : undefined) ?? countryByName(countries, p.country)
    if (!c) continue
    const cur = map.get(c.id)
    if (!cur) map.set(c.id, { country: c, status: p.status, places: [p] })
    else {
      cur.places.push(p)
      if (p.status === 'visited') cur.status = 'visited'
    }
  }
  return [...map.values()]
}
