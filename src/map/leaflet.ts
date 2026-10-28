import L from './leaflet-global'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'

export { L }

export const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

export function pinIcon(kind: 'visited' | 'wishlist' | 'pick', label?: string) {
  return L.divIcon({
    className: '',
    html: `<div class="atlas-pin ${kind}" role="img" aria-label="${label ? label.replace(/"/g, '&quot;') : kind}"></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  })
}

export interface GeoResult {
  name: string
  detail: string
  lat: number
  lng: number
  country?: string
  region?: string
}

/**
 * World search (only when you press search). Uses the free Photon service
 * built on OpenStreetMap. Only the search text is sent.
 */
export async function searchWorld(q: string): Promise<GeoResult[]> {
  const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en`)
  if (!res.ok) throw new Error('Search is unavailable right now.')
  const json = (await res.json()) as {
    features: { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> }[]
  }
  return json.features.map((f) => {
    const p = f.properties
    const region = p.state || p.county
    return {
      name: p.name || p.city || q,
      detail: [p.city !== p.name ? p.city : undefined, region, p.country].filter(Boolean).join(', '),
      lng: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      country: p.country,
      region: p.city && p.city !== p.name ? p.city : region,
    }
  })
}
