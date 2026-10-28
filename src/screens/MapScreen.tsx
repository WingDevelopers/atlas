import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import { L, pinIcon, TILE_ATTRIBUTION, TILE_URL } from '../map/leaflet'
import { coverOf, placeYears, useAll, visitsFor } from '../lib/queries'
import type { Place } from '../db/types'
import { Cover, Loading, Segmented } from '../ui/primitives'
import { IconClose, IconPlus, IconSearch } from '../ui/icons'
import { cap, fmtDate, placeLine } from '../lib/format'

type StatusFilter = 'all' | 'visited' | 'wishlist'

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
  const [selected, setSelected] = useState<Place | undefined>()
  const focusId = params.get('focus')

  const located = useMemo(() => (data?.places ?? []).filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number'), [data])
  const years = useMemo(() => {
    if (!data) return []
    const s = new Set<string>()
    for (const p of data.places) placeYears(p, data).forEach((y) => s.add(y))
    return [...s].sort().reverse()
  }, [data])
  const categories = useMemo(() => [...new Set(located.map((p) => p.category).filter(Boolean))] as string[], [located])

  const visible = useMemo(() => {
    if (!data) return []
    return located.filter((p) => (status === 'all' || p.status === status) && (!category || p.category === category) && (!year || placeYears(p, data).has(year)))
  }, [located, status, category, year, data])

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t || !data) return []
    return data.places.filter((p) => [p.name, p.region, p.country, p.address, ...p.tags].some((f) => f?.toLowerCase().includes(t))).slice(0, 8)
  }, [q, data])

  const focus = useMemo(() => data?.places.find((p) => p.id === focusId), [data, focusId])
  useEffect(() => {
    if (focus) setSelected(focus)
  }, [focus])

  if (!data) return <Loading />
  const unlocated = data.places.length - located.length

  return (
    <main className="map-page">
      <h1 className="sr-only">Map</h1>
      <MapContainer center={[20, 0]} zoom={2} minZoom={1} worldCopyJump zoomControl={false} style={{ height: '100%' }}>
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} subdomains="abcd" maxZoom={19} />
        <ClusterLayer places={visible} onSelect={setSelected} />
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

      {located.length === 0 && !selected && (
        <div className="map-empty-note card card-pad" role="note">
          <b>Your map is waiting.</b>
          <p className="small muted" style={{ marginTop: 4 }}>
            Add a place with a pin — somewhere you’ve been, or somewhere you dream of.
            {unlocated > 0 && ` (${unlocated} of your places don’t have a pin yet.)`}
          </p>
          <Link to="/new/place" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
            <IconPlus /> Add place
          </Link>
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
