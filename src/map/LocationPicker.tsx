import { useEffect, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { pinIcon, TILE_OPTIONS } from './leaflet'
import { PlaceSearch } from './PlaceSearch'
import { IconLocate } from '../ui/icons'

export interface PickedLocation {
  lat?: number
  lng?: number
  country?: string
  region?: string
  name?: string
}

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(round(e.latlng.lat), round(e.latlng.lng)) })
  return null
}
function FlyTo({ lat, lng }: { lat?: number; lng?: number }) {
  const map = useMap()
  useEffect(() => {
    if (lat !== undefined && lng !== undefined) map.setView([lat, lng], Math.max(map.getZoom(), 10), { animate: true })
  }, [lat, lng, map])
  return null
}
const round = (n: number) => Math.round(n * 1e5) / 1e5

/**
 * Manual pin placement: tap the map, search the world, or (only if you tap
 * the button) use your current location. Nothing happens automatically.
 */
export function LocationPicker({ value, onChange }: { value: PickedLocation; onChange: (v: PickedLocation) => void }) {
  const [err, setErr] = useState('')
  const has = value.lat !== undefined && value.lng !== undefined

  function locate() {
    if (!navigator.geolocation) return setErr('Location isn’t available on this device.')
    setErr('')
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange({ ...value, lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) }),
      () => setErr('Location permission was not given — no problem, tap the map instead.'),
      { enableHighAccuracy: false, timeout: 10000 },
    )
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <PlaceSearch
        places={[]}
        onPickExisting={() => {}}
        onPickNew={(r) => onChange({ lat: round(r.lat), lng: round(r.lng), country: r.country, region: r.region, name: r.name })}
        label="Search the world map"
        placeholder="Type a city, park, address…"
      />
      <div className="picker-map">
        <MapContainer center={has ? [value.lat!, value.lng!] : [20, 0]} zoom={has ? 10 : 2} scrollWheelZoom worldCopyJump>
          <TileLayer {...TILE_OPTIONS} />
          <ClickToPlace onPick={(lat, lng) => onChange({ ...value, lat, lng })} />
          <FlyTo lat={value.lat} lng={value.lng} />
          {has && <Marker position={[value.lat!, value.lng!]} icon={pinIcon('pick')} />}
        </MapContainer>
      </div>
      <div className="row wrap">
        <span className="xs muted spacer">{has ? `Pinned at ${value.lat}, ${value.lng}` : 'Tap the map to drop a pin. Location is optional.'}</span>
        <button type="button" className="btn btn-sm btn-ghost" onClick={locate}>
          <IconLocate /> Use my location
        </button>
        {has && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => onChange({ ...value, lat: undefined, lng: undefined })}>
            Clear pin
          </button>
        )}
      </div>
      {err && <p className="xs" style={{ color: 'var(--coral-ink)' }}>{err}</p>}
    </div>
  )
}
