import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BackBar, EmptyState, Loading, Segmented } from '../ui/primitives'
import { IconMap, IconPlus } from '../ui/icons'
import { useAll } from '../lib/queries'
import { countryByName, loadCountries, type Country } from '../map/countries'
import { isUnlocated, LocatePlacesSheet } from '../map/LocatePlaces'
import { placeTree } from '../lib/placeTree'

type Show = 'visited' | 'wishlist'

/** Your places as a list: continent › country › city. */
export default function PlacesList() {
  const data = useAll()
  const [params, setParams] = useSearchParams()
  const show: Show = params.get('show') === 'wishlist' ? 'wishlist' : 'visited'
  const [countries, setCountries] = useState<Country[] | null>(null)
  const [fixing, setFixing] = useState(false)
  useEffect(() => {
    let alive = true
    loadCountries()
      .then((c) => alive && setCountries(c))
      .catch(() => alive && setCountries([]))
    return () => {
      alive = false
    }
  }, [])

  const tree = useMemo(() => (data && countries ? placeTree(data.places.filter((p) => p.status === show), countries) : []), [data, countries, show])
  if (!data || !countries) return <Loading />

  const known = tree.filter((c) => c.continent !== 'Somewhere else')
  const nCountries = known.reduce((n, c) => n + c.countries.length, 0)
  const nPlaces = tree.reduce((n, c) => n + c.count, 0)
  const dreamsByPlace = new Map<string, string[]>()
  for (const d of data.dreams) if (d.placeId && d.status !== 'completed') dreamsByPlace.set(d.placeId, [...(dreamsByPlace.get(d.placeId) ?? []), d.title])

  return (
    <main className="page">
      <BackBar
        title={show === 'visited' ? 'Where you’ve been' : 'Where you want to go'}
        right={
          <Link to="/map" className="icon-btn" aria-label="Back to the map">
            <IconMap />
          </Link>
        }
      />
      <div className="pad stack" style={{ gap: 12 } as never}>
        <Segmented
          label="Which places"
          value={show}
          onChange={(v) => setParams(v === 'wishlist' ? { show: 'wishlist' } : {}, { replace: true })}
          options={[
            { value: 'visited', label: 'Visited' },
            { value: 'wishlist', label: 'Wishlist' },
          ]}
        />
        {nPlaces > 0 && (
          <p className="small muted">
            {[known.length && `${known.length} ${known.length === 1 ? 'continent' : 'continents'}`, nCountries && `${nCountries} ${nCountries === 1 ? 'country' : 'countries'}`, `${nPlaces} ${nPlaces === 1 ? 'place' : 'places'}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>

      {nPlaces === 0 ? (
        <EmptyState
          title={show === 'visited' ? 'Nowhere yet — or nowhere written down.' : 'Where would you go?'}
          text={show === 'visited' ? 'Add a place you’ve been, or log an adventure with a “Where?”.' : 'Add a dream with a destination, or a wishlist place.'}
          action={
            <Link to={show === 'visited' ? '/new/place' : '/new/dream'} className="btn btn-primary">
              <IconPlus /> {show === 'visited' ? 'Add a place' : 'Add a dream'}
            </Link>
          }
        />
      ) : (
        <div className="tree">
          {tree.map((cont) => (
            <section key={cont.continent} className="tree-continent" aria-labelledby={`c-${cont.continent}`}>
              <h2 id={`c-${cont.continent}`} className="tree-continent-h">
                <span className="display">{cont.continent}</span>
                <span className="xs muted">
                  {cont.continent !== 'Somewhere else' && `${cont.countries.length} ${cont.countries.length === 1 ? 'country' : 'countries'} · `}
                  {cont.count} {cont.count === 1 ? 'place' : 'places'}
                </span>
              </h2>
              {cont.continent === 'Somewhere else' && (
                <div className="note warn row" style={{ marginBottom: 8 }}>
                  <span className="spacer">No location yet, so these can’t be sorted or coloured on the map.</span>
                  <button className="btn btn-sm btn-secondary" onClick={() => setFixing(true)}>
                    Put on map
                  </button>
                </div>
              )}
              <div className="stack" style={{ gap: 8 } as never}>
                {cont.countries.map((c) => (
                  <details key={c.countryId} className="fold tree-country" open={cont.countries.length <= 3 && cont.count <= 12}>
                    <summary>
                      <span className={`tree-dot ${show}`} aria-hidden />
                      <span className="body">
                        <b>{c.country}</b>
                        <span>
                          {c.cities.length} {c.cities.length === 1 ? 'city' : 'cities'} · {c.count} {c.count === 1 ? 'place' : 'places'}
                        </span>
                      </span>
                      <span className="chev" aria-hidden>
                        ›
                      </span>
                    </summary>
                    <ul className="tree-cities">
                      {c.cities.map((city) => {
                        const single = city.places.length === 1 && city.places[0].name === city.city
                        return (
                          <li key={city.city}>
                            {single ? (
                              <Link to={`/place/${city.places[0].id}`} className="tree-city-link">
                                <b>{city.city}</b>
                                {dreamsByPlace.get(city.places[0].id)?.map((t) => (
                                  <span key={t} className="xs muted">
                                    Dream: {t}
                                  </span>
                                ))}
                              </Link>
                            ) : (
                              <>
                                <div className="tree-city">
                                  <b>{city.city}</b>
                                  <span className="xs muted">{city.places.length}</span>
                                </div>
                                <ul className="tree-places">
                                  {city.places.map((p) => (
                                    <li key={p.id}>
                                      <Link to={`/place/${p.id}`}>
                                        {p.name}
                                        {dreamsByPlace.get(p.id)?.map((t) => (
                                          <span key={t} className="xs muted" style={{ display: 'block' }}>
                                            Dream: {t}
                                          </span>
                                        ))}
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              </>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <LocatePlacesSheet places={data.places.filter((p) => isUnlocated(p, (n) => !!countryByName(countries, n)))} open={fixing} onClose={() => setFixing(false)} />
    </main>
  )
}
