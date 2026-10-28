import { getDb, type AtlasDB } from '../db/db'
import type { Place, PlaceArea } from '../db/types'

/**
 * Place outlines from OpenStreetMap's Nominatim service.
 *
 * Asked once per pinned place, only while online; the outline is then saved on
 * the device (and in backups), so the map keeps working offline. What's sent:
 * the place's name and its pin's coordinates — nothing else.
 * Nominatim's policy allows at most one request per second, so lookups queue.
 */

const BASE = 'https://nominatim.openstreetmap.org'
const MAX_BYTES = 120_000 // skip huge outlines (e.g. a whole state)
const RETRY_AFTER_MS = 1000 * 60 * 60 * 24 * 14 // try a failed place again after 2 weeks

type Geo = PlaceArea['geometry']
interface NFeature {
  geometry: { type: string; coordinates: unknown }
  properties: { name?: string; addresstype?: string; type?: string }
}

const round = (v: unknown): unknown => (Array.isArray(v) ? v.map(round) : typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v)

function inRing(lng: number, lat: number, ring: number[][]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
export function containsPoint(g: Geo, lat: number, lng: number) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  return polys.some((p) => inRing(lng, lat, p[0]) && !p.slice(1).some((h) => inRing(lng, lat, h)))
}

function toArea(f: NFeature | undefined, lat: number, lng: number): PlaceArea | undefined {
  if (!f || (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon')) return undefined
  const geometry = { type: f.geometry.type, coordinates: round(f.geometry.coordinates) } as Geo
  if (JSON.stringify(geometry).length > MAX_BYTES) return undefined
  return { name: f.properties.name ?? '', kind: f.properties.addresstype ?? f.properties.type, geometry, forLat: lat, forLng: lng, source: 'openstreetmap' }
}

let queue: Promise<unknown> = Promise.resolve()
/** Run lookups one at a time, at least 1.1 s apart. */
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn)
  queue = run.then(
    () => new Promise((r) => setTimeout(r, 1100)),
    () => new Promise((r) => setTimeout(r, 1100)),
  )
  return run
}

async function getJson(url: string, fetcher: typeof fetch) {
  const res = await fetcher(url, { referrerPolicy: 'strict-origin' })
  if (!res.ok) throw new Error(`lookup failed (${res.status})`)
  return (await res.json()) as { features?: NFeature[] }
}

/**
 * Find the outline for a pinned place: first by its name near the pin
 * (gives "Lisbon" the city, not one neighbourhood), then the town/city
 * that contains the pin.
 */
export async function lookupArea(name: string, lat: number, lng: number, fetcher: typeof fetch = fetch): Promise<PlaceArea | undefined> {
  const d = 0.5
  const viewbox = [lng - d, lat + d, lng + d, lat - d].join(',')
  const byName = await throttled(() =>
    getJson(`${BASE}/search?q=${encodeURIComponent(name)}&format=geojson&polygon_geojson=1&polygon_threshold=0.002&limit=5&viewbox=${viewbox}&bounded=1&accept-language=en`, fetcher),
  )
  const polys = (byName.features ?? []).map((f) => toArea(f, lat, lng)).filter(Boolean) as PlaceArea[]
  const hit = polys.find((a) => containsPoint(a.geometry, lat, lng)) ?? polys[0]
  if (hit) return hit
  const around = await throttled(() => getJson(`${BASE}/reverse?lat=${lat}&lon=${lng}&zoom=10&format=geojson&polygon_geojson=1&polygon_threshold=0.002&accept-language=en`, fetcher))
  return toArea(around.features?.[0], lat, lng)
}

export function needsArea(p: Place, now = Date.now()) {
  if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return false
  if (p.area && p.area.forLat === p.lat && p.area.forLng === p.lng) return false
  if (p.areaTriedAt && now - Date.parse(p.areaTriedAt) < RETRY_AFTER_MS && (!p.area || (p.area.forLat === p.lat && p.area.forLng === p.lng))) return false
  return true
}

/**
 * Look up (and save) outlines for places that don't have one yet.
 * Outline data isn't a user edit, so `updatedAt` is left alone.
 */
export async function ensureAreas(places: Place[], opts: { db?: AtlasDB; fetcher?: typeof fetch; limit?: number; force?: boolean } = {}) {
  const db = opts.db ?? getDb()
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 0
  const todo = places.filter((p) => opts.force || needsArea(p)).slice(0, opts.limit ?? 25)
  let found = 0
  for (const p of todo) {
    try {
      const area = await lookupArea(p.name, p.lat!, p.lng!, opts.fetcher)
      const patch: Partial<Place> = { areaTriedAt: new Date().toISOString() }
      if (area) {
        patch.area = area
        found++
      }
      await db.places.update(p.id, patch)
    } catch {
      // offline or service busy — try again another time
      break
    }
  }
  return found
}
