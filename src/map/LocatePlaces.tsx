import { useState } from 'react'
import { Link } from 'react-router-dom'
import { updateEntry } from '../db/repo'
import type { Place } from '../db/types'
import { Sheet, useToast } from '../ui/primitives'
import { PlaceSearch } from './PlaceSearch'

/** Places that can't be coloured on the map: no pin and no recognisable country. */
export function isUnlocated(p: Place, countryKnown: (name?: string) => boolean) {
  return (typeof p.lat !== 'number' || typeof p.lng !== 'number') && !countryKnown(p.country)
}

/**
 * Fix places saved with only a name: search each one on the map and
 * pick the right result. Its pin, country and region are filled in.
 */
export function LocatePlacesSheet({ places, open, onClose }: { places: Place[]; open: boolean; onClose: () => void }) {
  const toast = useToast()
  const [active, setActive] = useState<string | null>(null)
  return (
    <Sheet open={open} onClose={onClose} label="Put places on the map">
      <h2>Put these on the map</h2>
      <p className="small muted">
        These places were saved with just a name, so ATLAS doesn’t know where they are and can’t colour them. Find each one and pick the right match — its country colours in right away.
      </p>
      {places.length === 0 ? (
        <p className="note" style={{ marginTop: 16 }}>
          All your places are on the map.
        </p>
      ) : (
        <ul className="locate-list">
          {places.map((p) => (
            <li key={p.id}>
              <div className="row">
                <span className={`dot ${p.status}`} aria-hidden />
                <b className="spacer">{p.name}</b>
                <span className="xs muted">{p.status === 'visited' ? 'Visited' : 'Wishlist'}</span>
                {active !== p.id && (
                  <button type="button" className="btn btn-sm btn-sea" onClick={() => setActive(p.id)}>
                    Find
                  </button>
                )}
              </div>
              {active === p.id && (
                <div style={{ marginTop: 8 }}>
                  <PlaceSearch
                    places={[]}
                    initialQuery={p.name}
                    autoFocus
                    label={`Find ${p.name} on the map`}
                    onPickExisting={() => {}}
                    onPickNew={async (r) => {
                      await updateEntry('place', p.id, {
                        lat: Math.round(r.lat * 1e5) / 1e5,
                        lng: Math.round(r.lng * 1e5) / 1e5,
                        country: p.country || r.country,
                        region: p.region || r.region,
                      })
                      setActive(null)
                      toast({ message: `${p.name} is on the map.` })
                    }}
                  />
                  <p className="xs muted" style={{ marginTop: 6 }}>
                    Can’t find it? <Link to={`/edit/place/${p.id}`}>Drop a pin by hand</Link>.
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
