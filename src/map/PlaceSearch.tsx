import { useEffect, useId, useRef, useState } from 'react'
import type { Place } from '../db/types'
import { searchWorld, type GeoResult } from './leaflet'
import { IconPin, IconSearch } from '../ui/icons'

/**
 * One box for "Where?": as you type it suggests your own places first, then
 * real places from the map (OpenStreetMap, via Photon). No button needed.
 */
export function PlaceSearch({
  places,
  exclude = [],
  onPickExisting,
  onPickNew,
  placeholder = 'Type a city, country or landmark…',
  label = 'Search for a place',
  autoFocus,
}: {
  places: Place[]
  exclude?: string[]
  onPickExisting: (p: Place) => void
  onPickNew: (r: GeoResult) => void
  placeholder?: string
  label?: string
  autoFocus?: boolean
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<GeoResult[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'offline'>('idle')
  const [open, setOpen] = useState(false)
  const seq = useRef(0)
  const listId = useId()

  const term = q.trim()
  useEffect(() => {
    if (term.length < 2) {
      setResults([])
      setState('idle')
      return
    }
    const mine = ++seq.current
    setState('loading')
    const t = setTimeout(async () => {
      try {
        const r = await searchWorld(term)
        if (mine === seq.current) {
          setResults(r)
          setState('idle')
        }
      } catch {
        if (mine === seq.current) {
          setResults([])
          setState('offline')
        }
      }
    }, 350)
    return () => clearTimeout(t)
  }, [term])

  const lower = term.toLowerCase()
  const mineMatches = term
    ? places.filter((p) => !exclude.includes(p.id) && [p.name, p.region, p.country].some((f) => f?.toLowerCase().includes(lower))).slice(0, 4)
    : []
  const show = open && term.length >= 1

  const reset = () => {
    setQ('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="place-search">
      <div className="searchbar" style={{ boxShadow: 'none', border: '1px solid var(--line-strong)', background: '#fffdf9' }}>
        <IconSearch />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          aria-label={label}
          role="combobox"
          aria-expanded={show}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          enterKeyHint="search"
          autoFocus={autoFocus}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (mineMatches[0]) {
                onPickExisting(mineMatches[0])
                reset()
              } else if (results[0]) {
                onPickNew(results[0])
                reset()
              }
            }
            if (e.key === 'Escape') setOpen(false)
          }}
        />
      </div>
      {show && (
        <div className="search-results" id={listId} role="listbox" style={{ boxShadow: 'var(--shadow-md)', marginTop: 6 }}>
          {mineMatches.length > 0 && <div className="sr-head">Your places</div>}
          {mineMatches.map((p) => (
            <button
              type="button"
              role="option"
              aria-selected={false}
              key={p.id}
              onClick={() => {
                onPickExisting(p)
                reset()
              }}
            >
              <span className={`dot ${p.status}`} aria-hidden />
              <span>
                <b>{p.name}</b>
                <span className="xs muted" style={{ display: 'block' }}>
                  {[p.region, p.country].filter(Boolean).join(', ') || (p.status === 'visited' ? 'Visited' : 'Wishlist')}
                </span>
              </span>
            </button>
          ))}
          {term.length >= 2 && <div className="sr-head">On the map</div>}
          {state === 'loading' && results.length === 0 && <div className="sr-note">Searching…</div>}
          {state === 'offline' && <div className="sr-note">Map search needs internet. Your saved places still work.</div>}
          {state === 'idle' && term.length >= 2 && results.length === 0 && <div className="sr-note">No matches — try a nearby city.</div>}
          {results.map((r, i) => (
            <button
              type="button"
              role="option"
              aria-selected={false}
              key={`${r.lat},${r.lng},${i}`}
              onClick={() => {
                onPickNew(r)
                reset()
              }}
            >
              <IconPin style={{ width: 16, height: 16, flex: 'none', color: 'var(--text-muted)' }} />
              <span>
                <b>{r.name}</b>
                <span className="xs muted" style={{ display: 'block' }}>
                  {r.detail}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
