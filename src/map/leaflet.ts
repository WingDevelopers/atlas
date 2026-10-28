import L from './leaflet-global'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'

export { L }

/**
 * Map background tiles.
 *
 * CARTO "Voyager" (the light, editorial style) is used when a CARTO Basemaps
 * key is set below. CARTO ended keyless access in autumn 2026; a free key for
 * personal, non-commercial use comes from https://dashboard.basemaps.carto.com/.
 * Map keys are public by nature (they travel in every tile address), so it is
 * fine for this to live in the code — restrict the key to your site's address
 * in the CARTO dashboard.
 *
 * Without a key, ATLAS falls back to OpenStreetMap's standard map (free, keyless,
 * policy: https://operations.osmfoundation.org/policies/tiles/).
 *
 * Both require the browser to send a Referer, so index.html and the tile layers
 * use referrer policy "strict-origin" (only the site's address is shared).
 */
export const CARTO_KEY: string = 'cb1_4x6d_1_30230531f014077f2bd5870e'

const carto = CARTO_KEY.trim()
export const TILE_URL = carto
  ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(carto)}`
  : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const TILE_ATTRIBUTION = carto
  ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
export const TILE_MAX_ZOOM = 19
/** Extra Leaflet tile-layer options for the active provider. */
export const TILE_OPTIONS = {
  url: TILE_URL,
  attribution: TILE_ATTRIBUTION,
  maxZoom: TILE_MAX_ZOOM,
  referrerPolicy: 'strict-origin' as const,
  ...(carto ? { subdomains: 'abcd' } : {}),
}
export const TILE_PROVIDER: 'carto' | 'osm' = carto ? 'carto' : 'osm'

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
