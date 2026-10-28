import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { L, pinIcon, TILE_OPTIONS } from '../map/leaflet'
import { countryFills, loadCountries, type Country, type CountryFill } from '../map/countries'
import { coverOf, placeYears, useAll, visitsFor } from '../lib/queries'
import type { Place } from '../db/types'
import { Cover, Loading, Segmented } from '../ui/primitives'
import { IconClose, IconPlus, IconSearch } from '../ui/icons'
import { cap, fmtDate, placeLine } from '../lib/format'

type StatusFilter = 'all' | 'visited' | 'wishlist'

/** Place pins appear from this zoom level (roughly "a region") and closer. */
const PIN_ZOOM = 5

const FILL = {
  visited: { fillColor: '#D77C66', color: '#B85C45', fillOpacity: 0.5 },
  wishlist: { fillColor: '#78AEB0', color: '#4F8C8E', fillOpacity: 0.42 },
}

function useZoom() {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  return zoom
}

function CountryLayer({ fills, onSelect, selectedId }: { fills: CountryFill[]; onSelect: (f: CountryFill) => void; selectedId?: string }) {
  const map = useMap()
  // When zoomed in, soften the fill so towns and roads stay readable under it.
  const close = useZoom() >= PIN_ZOOM
  useEffect(() => {
    const layers: L.Layer[] = []
    for (const f of fills) {
      const selected = f.country.id === selectedId
      const base = close ? 0.18 : FILL[f.status].fillOpacity
      const layer = L.geoJSON(f.country.feature, {
        style: { ...FILL[f.status], weight: selected ? 2.5 : close ? 1.5 : 1, opacity: 0.9, fillOpacity: base + (selected ? 0.15 : 0) },
      })
      layer.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        onSelect(f)
      })
      layer.bindTooltip(f.country.name, { sticky: true, direction: 'top', className: 'atlas-tip' })
      layer.addTo(map)
      layers.push(layer)
    }
    return () => layers.forEach((l) => map.removeLayer(l))
  }, [map, fills, onSelect, selectedId, close])
  return null
}

function PinsWhenClose({ places, onSelect, always }: { places: Place[]; onSelect: (p: Place) => void; always: boolean }) {
  const zoom = useZoom()
  if (!always && zoom < PIN_ZOOM) return null
  return <ClusterLayer places={places} onSelect={onSelect} />
}

/** Zoom to a country's saved places (so their pins show), or to the country itself. */
function ZoomToCountry({ target }: { target?: CountryFill }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    const pts = target.places.filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number').map((p) => [p.lat!, p.lng!] as [number, number])
    if (pts.length === 1) map.setView(pts[0], Math.max(map.getZoom(), 9))
    else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 10 })
    else {
      const [a, b, c, d] = target.country.bbox
      if (c - a <= 180) map.fitBounds([[b, a], [d, c]], { padding: [40, 40], maxZoom: 7 })
    }
  }, [target, map])
  return null
}

function ClusterLayer({ places, onSelect }: { places: Place[]; onSelect: (p: Place) => void }) {
  const map = useMap()
  useEffect(() => {
    const group = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 48,
      iconCreateFunction: (c) => L.divIcon({ html: `<div class="atlas-cluster">${c.getChildCount()}</div>`, className: '', iconSize: [42, 42] }),
    })
    for (const p of places) {
      const m = L.marker([p.lat!, p.lng!], { icon: pinIcon(p.status, p.name), title: p.name, keyboard: true })
      m.on('click', () => onSelect(p))
      group.addLayer(m)
    }
    map.addLayer(group)
    return () => {
      map.removeLayer(group)
    }
  }, [map, places, onSelect])
  return null
}

function FitTo({ places, focus }: { places: Place[]; focus?: Place }) {
  const map = useMap()
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (focus?.lat !== undefined) {
      map.setView([focus.lat, focus.lng!], Math.max(map.getZoom(), 9))
      return
    }
    if (done || places.length === 0) return
    if (places.length === 1) map.setView([places[0].lat!, places[0].lng!], 8)
    else map.fitBounds(L.latLngBounds(places.map((p) => [p.lat!, p.lng!] as [number, number])), { padding: [36, 36], maxZoom: 10 })
    setDone(true)
  }, [places, focus, map, done])
  return null
}

function LongPressToAdd() {
  const map = useMap()
  const nav = useNavigate()
  useEffect(() => {
    const handler = (e: L.LeafletMouseEvent) => nav(`/new/place?lat=${e.latlng.lat.toFixed(5)}&lng=${e.latlng.lng.toFixed(5)}`)
    map.on('contextmenu', handler)
    return () => {
      map.off('contextmenu', handler)
    }
  }, [map, nav])
  return null
}

export default function MapScreen() {
  const data = useAll()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState<StatusFilter>('all')
  const [category, setCategory] = useState<string>('')
  const [year, setYear] = useState<string>('')
  const [q, setQ] = useState('')
  const [selected, setSelectedPlace] = useState<Place | undefined>()
  const [selCountry, setSelCountry] = useState<CountryFill | undefined>()
  const [zoomTarget, setZoomTarget] = useState<CountryFill | undefined>()
  const [countries, setCountries] = useState<Country[] | null>(null)
  const focusId = params.get('focus')

  useEffect(() => {
    let alive = true
    loadCountries()
      .then((c) => alive && setCountries(c))
      .catch(() => alive && setCountries([])) // fall back to pins only
    return () => {
      alive = false
    }
  }, [])

  const setSelected = useCallback((p: Place | undefined) => {
    setSelectedPlace(p)
    if (p) setSelCountry(undefined)
  }, [])
  const selectCountry = useCallback((f: CountryFill) => {
    setSelCountry(f)
    setSelectedPlace(undefined)
  }, [])

  const located = useMemo(() => (data?.places ?? []).filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number'), [data])
  const years = useMemo(() => {
    if (!data) return []
    const s = new Set<string>()
    for (const p of data.places) placeYears(p, data).forEach((y) => s.add(y))
    return [...s].sort().reverse()
  }, [data])
  const categories = useMemo(() => [...new Set(located.map((p) => p.category).filter(Boolean))] as string[], [located])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.places.filter((p) => (status === 'all' || p.status === status) && (!category || p.category === category) && (!year || placeYears(p, data).has(year)))
  }, [status, category, year, data])
  const visible = useMemo(() => filtered.filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number'), [filtered])
  const fills = useMemo(() => (countries ? countryFills(countries, filtered) : []), [countries, filtered])

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t || !data) return []
    return data.places.filter((p) => [p.name, p.region, p.country, p.address, ...p.tags].some((f) => f?.toLowerCase().includes(t))).slice(0, 8)
  }, [q, data])

  const focus = useMemo(() => data?.places.find((p) => p.id === focusId), [data, focusId])
  useEffect(() => {
    if (focus) setSelected(focus)
  }, [focus, setSelected])

  if (!data) return <Loading />
  const unlocated = data.places.length - located.length

  return (
    <main className="map-page">
      <h1 className="sr-only">Map</h1>
      <MapContainer center={[20, 0]} zoom={2} minZoom={1} worldCopyJump zoomControl={false} style={{ height: '100%' }}>
        <TileLayer {...TILE_OPTIONS} />
        <CountryLayer fills={fills} onSelect={selectCountry} selectedId={selCountry?.country.id} />
        <PinsWhenClose places={visible} onSelect={setSelected} always={!countries?.length} />
        <ZoomToCountry target={zoomTarget} />
        <FitTo places={visible} focus={focus} />
        <LongPressToAdd />
      </MapContainer>

      <div className="map-ui">
        <div className="searchbar">
          <IconSearch />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your places" aria-label="Search your places" />
          {q && (
            <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => setQ('')} aria-label="Clear search">
              <IconClose />
            </button>
          )}
          <button className="icon-btn" style={{ background: "var(--coral-deep)", color: "#fff", width: 40, height: 40 }} onClick={() => nav("/new/place")} aria-label="Add place">
            <IconPlus />
          </button>
        </div>
        {q && (
          <div className="search-results">
            {matches.length === 0 && <div style={{ padding: 14 }} className="small muted">No places match “{q}”.</div>}
            {matches.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setQ('')
                  if (p.lat !== undefined) {
                    setParams({ focus: p.id }, { replace: true })
                    setSelected(p)
                  } else nav(`/place/${p.id}`)
                }}
              >
                <b>{p.name}</b>
                <div className="xs muted">
                  {cap(p.status === 'visited' ? 'visited' : 'wishlist')}
                  {placeLine(p) && ` · ${placeLine(p)}`}
                  {p.lat === undefined && ' · no pin yet'}
                </div>
              </button>
            ))}
          </div>
        )}
        <Segmented
          label="Show places"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All' },
            { value: 'visited', label: 'Visited' },
            { value: 'wishlist', label: 'Wishlist' },
          ]}
        />
        {(years.length > 0 || categories.length > 0) && (
          <div className="filters">
            {years.length > 0 && (
              <select className="filter-chip" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Filter by year" style={{ appearance: 'auto' }}>
                <option value="">Any year</option>
                {years.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            )}
            {categories.map((c) => (
              <button key={c} className="filter-chip" aria-pressed={category === c} onClick={() => setCategory(category === c ? '' : c)}>
                {cap(c)}
              </button>
            ))}
          </div>
        )}
      </div>

      {located.length === 0 && fills.length === 0 && !selected && (
        <div className="map-empty-note card card-pad" role="note">
          <b>Your map is waiting.</b>
          <p className="small muted" style={{ marginTop: 4 }}>
            Add a place — somewhere you’ve been, or somewhere you dream of — and its country fills with colour.
            {unlocated > 0 && ` (${unlocated} of your places don’t have a pin yet.)`}
          </p>
          <Link to="/new/place" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
            <IconPlus /> Add place
          </Link>
        </div>
      )}

      {selCountry && !selected && (
        <div className="place-preview" role="dialog" aria-label={selCountry.country.name}>
          <div className="card">
            <div className="top" style={{ alignItems: 'center' }}>
              <div style={{ minWidth: 0, flex: 1, paddingLeft: 6 }}>
                <span className={`chip ${selCountry.status}`}>{selCountry.status === 'visited' ? 'Visited' : 'Wishlist'}</span>
                <h3 style={{ marginTop: 6 }}>{selCountry.country.name}</h3>
                <p className="small muted">
                  {(() => {
                    const v = selCountry.places.filter((p) => p.status === 'visited').length
                    const w = selCountry.places.length - v
                    return [v && `${v} visited`, w && `${w} on your wishlist`].filter(Boolean).join(' · ')
                  })()}
                </p>
              </div>
              <button className="icon-btn" onClick={() => setSelCountry(undefined)} aria-label="Close country">
                <IconClose />
              </button>
            </div>
            <div className="country-places">
              {(() => {
                const ids = new Set(selCountry.places.map((p) => p.id))
                return data.dreams
                  .filter((d) => d.placeId && ids.has(d.placeId) && d.status !== 'completed')
                  .map((d) => (
                    <Link key={d.id} to={`/dream/${d.id}`} className="country-place">
                      <span className="dot wishlist" aria-hidden />
                      <span className="spacer">{d.title}</span>
                      <span className="xs muted">Dream · {d.status}</span>
                    </Link>
                  ))
              })()}
              {selCountry.places.slice(0, 6).map((p) => (
                <Link key={p.id} to={`/place/${p.id}`} className="country-place">
                  <span className={`dot ${p.status}`} aria-hidden />
                  <span className="spacer">{p.name}</span>
                  <span className="xs muted">{placeLine(p) && placeLine(p) !== selCountry.country.name ? placeLine(p) : ''}</span>
                </Link>
              ))}
              {selCountry.places.length > 6 && <p className="xs muted" style={{ padding: '4px 12px' }}>+ {selCountry.places.length - 6} more — zoom in to see them all.</p>}
            </div>
            <div className="actions">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setZoomTarget({ ...selCountry })
                  setSelCountry(undefined)
                }}
              >
                Zoom in
              </button>
              <Link to="/new/place" className="btn btn-secondary btn-sm">
                Add a place
              </Link>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="place-preview" role="dialog" aria-label={selected.name}>
          <div className="card">
            <div className="top">
              <div className="media thumb">
                <Cover mediaId={coverOf(selected)} seed={selected.id} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span className={`chip ${selected.status}`}>{selected.status === 'visited' ? 'Visited' : 'Wishlist'}</span>
                <h3 style={{ marginTop: 6 }}>{selected.name}</h3>
                <p className="small muted">
                  {placeLine(selected)}
                  {(() => {
                    const v = visitsFor(selected, data)[0]
                    return v ? `${placeLine(selected) ? ' · ' : ''}${fmtDate(v.date)}` : ''
                  })()}
                </p>
              </div>
              <button
                className="icon-btn"
                onClick={() => {
                  setSelected(undefined)
                  if (focusId) setParams({}, { replace: true })
                }}
                aria-label="Close preview"
              >
                <IconClose />
              </button>
            </div>
            <div className="actions">
              <Link to={`/place/${selected.id}`} className="btn btn-primary btn-sm">
                View memories
              </Link>
              <Link to={`/new/memory?place=${selected.id}`} className="btn btn-secondary btn-sm">
                Add memory here
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
