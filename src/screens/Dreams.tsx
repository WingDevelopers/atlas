import { useState } from 'react'
import { Link } from 'react-router-dom'
import { coverOf, useAll } from '../lib/queries'
import { Cover, EmptyState, FilterChips, Loading, PageTitle } from '../ui/primitives'
import { IconPlus } from '../ui/icons'
import type { DreamStatus } from '../db/types'
import { cap } from '../lib/format'

type F = 'open' | DreamStatus | 'all'

export default function Dreams() {
  const data = useAll()
  const [f, setF] = useState<F>('open')
  if (!data) return <Loading />
  const order = { booked: 0, planning: 1, someday: 2, completed: 3 }
  const list = data.dreams
    .filter((d) => (f === 'all' ? true : f === 'open' ? d.status !== 'completed' : d.status === f))
    .sort((a, b) => order[a.status] - order[b.status] || b.updatedAt.localeCompare(a.updatedAt))
  const places = new Map(data.places.map((p) => [p.id, p]))

  return (
    <main className="page">
      <PageTitle title="Dreams" subtitle="Things you haven’t done. Yet.">
        <Link to="/new/dream" className="btn btn-sm btn-secondary">
          <IconPlus /> Dream
        </Link>
      </PageTitle>
      {data.dreams.length > 0 && (
        <FilterChips
          label="Filter dreams"
          value={f}
          onChange={setF}
          options={[
            { value: 'open', label: 'Still dreaming' },
            { value: 'someday', label: 'Someday' },
            { value: 'planning', label: 'Planning' },
            { value: 'booked', label: 'Booked' },
            { value: 'completed', label: 'Completed' },
            { value: 'all', label: 'All' },
          ]}
        />
      )}
      {data.dreams.length === 0 ? (
        <EmptyState
          title="What’s calling you?"
          text="A place, a skill, a feeling. Dreams don’t need a location — or a deadline."
          action={
            <Link to="/new/dream" className="btn btn-primary">
              <IconPlus /> Add a dream
            </Link>
          }
        />
      ) : list.length === 0 ? (
        <p className="pad muted" style={{ marginTop: 'var(--s6)' }}>
          Nothing here right now.
        </p>
      ) : (
        <div className="list" style={{ marginTop: 'var(--s4)', gap: 'var(--s4)' }}>
          {list.map((d) => (
            <Link key={d.id} to={`/dream/${d.id}`} className="card">
              <div className="media" style={{ aspectRatio: '16 / 8' }}>
                <Cover mediaId={coverOf(d)} seed={d.id} />
              </div>
              <div className="card-pad">
                <div className="row wrap" style={{ gap: 6 }}>
                  <span className={`chip ${d.status}`}>{cap(d.status)}</span>
                  <span className="chip">{cap(d.type)}</span>
                  {d.placeId && places.get(d.placeId) && <span className="chip">{places.get(d.placeId)!.name}</span>}
                </div>
                <h3 className="display" style={{ fontSize: 'var(--fs-xl)', marginTop: 10 }}>
                  {d.title}
                </h3>
                {d.why && (
                  <p className="small muted" style={{ marginTop: 4 }}>
                    {d.why}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
