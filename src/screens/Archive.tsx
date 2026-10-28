import { Fragment, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { coverOf, timeline, useAll, type TimelineEntry } from '../lib/queries'
import { Cover, EmptyState, FilterChips, Loading, PageTitle, Segmented } from '../ui/primitives'
import { ChaptersList } from './Chapters'
import { IconHeart, IconPlus, IconSearch } from '../ui/icons'
import { fmtDate, fmtRange } from '../lib/format'

type F = 'all' | 'adventure' | 'memory' | 'milestone' | 'favorites'

function excerpt(e: TimelineEntry) {
  if (e.kind === 'adventure') return e.rec.highlight || e.rec.story
  if (e.kind === 'memory') return e.rec.story
  return e.rec.description
}
function when(e: TimelineEntry) {
  if (e.kind === 'adventure') return fmtRange(e.rec.startDate, e.rec.endDate)
  return e.date ? fmtDate(e.date) : 'Undated'
}

export default function Archive() {
  const data = useAll()
  const [f, setF] = useState<F>('all')
  const [q, setQ] = useState('')
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'chapters' ? 'chapters' : 'timeline'

  const groups = useMemo(() => {
    if (!data) return []
    const t = q.trim().toLowerCase()
    const items = timeline(data).filter((e) => {
      if (f === 'favorites') {
        if (!(e.kind === 'memory' && e.rec.favorite)) return false
      } else if (f !== 'all' && e.kind !== f) return false
      if (!t) return true
      const r = e.rec as unknown as Record<string, unknown>
      return ['title', 'story', 'description', 'highlight', 'companions', 'people'].some((k) => typeof r[k] === 'string' && (r[k] as string).toLowerCase().includes(t)) || ((r.tags as string[]) ?? []).some((x) => x.toLowerCase().includes(t))
    })
    const out: { year: string; items: TimelineEntry[] }[] = []
    for (const e of items) {
      const y = e.date ? e.date.slice(0, 4) : 'Undated'
      if (!out.length || out[out.length - 1].year !== y) out.push({ year: y, items: [] })
      out[out.length - 1].items.push(e)
    }
    return out
  }, [data, f, q])

  if (!data) return <Loading />
  const total = data.adventures.length + data.memories.length + data.milestones.length

  return (
    <main className="page">
      <PageTitle title="Archive" subtitle="Not just where you’ve been. Who you’ve become." />
      {(total > 0 || data.chapters.length > 0) && (
        <div className="pad" style={{ marginBottom: 'var(--s4)' }}>
          <Segmented
            label="Archive view"
            value={view}
            onChange={(v) => setParams(v === 'chapters' ? { view: 'chapters' } : {}, { replace: true })}
            options={[
              { value: 'timeline', label: 'Timeline' },
              { value: 'chapters', label: `Chapters${data.chapters.length ? ` · ${data.chapters.length}` : ''}` },
            ]}
          />
        </div>
      )}
      {total === 0 ? (
        <EmptyState
          title="Every story starts somewhere."
          text="Add your first memory. Your timeline will grow from there — year by year."
          action={
            <Link to="/new/memory" className="btn btn-primary">
              <IconPlus /> Add your first memory
            </Link>
          }
        />
      ) : view === 'chapters' ? (
        <ChaptersList data={data} />
      ) : (
        <>
          <div className="pad" style={{ marginBottom: 'var(--s3)' }}>
            <div className="searchbar" style={{ boxShadow: 'none', border: '1px solid var(--line-strong)', background: 'var(--paper)' }}>
              <IconSearch />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your story" aria-label="Search the archive" />
            </div>
          </div>
          <FilterChips
            label="Filter archive"
            value={f}
            onChange={setF}
            options={[
              { value: 'all', label: 'Everything' },
              { value: 'adventure', label: 'Adventures' },
              { value: 'memory', label: 'Memories' },
              { value: 'milestone', label: 'Milestones' },
              { value: 'favorites', label: 'Favourites' },
            ]}
          />
          <div style={{ marginTop: 'var(--s4)' }}>
            {groups.length === 0 && <p className="pad muted">Nothing matches.</p>}
            {groups.map((g) => (
              <Fragment key={g.year}>
                <h2 className="year">{g.year}</h2>
                <ol className="timeline" style={{ listStyle: 'none', margin: 0 }}>
                  {g.items.map((e) => (
                    <li key={e.rec.id} className={`tl-item ${e.kind}`}>
                      <Link to={`/${e.kind}/${e.rec.id}`} className="card tl-card">
                        {(e.kind !== 'milestone' || coverOf(e.rec)) && (
                          <div className="media thumb">
                            <Cover mediaId={coverOf(e.rec)} seed={e.rec.id} />
                          </div>
                        )}
                        <div className="body">
                          <span className="eyebrow">
                            {e.kind} · {when(e)}
                          </span>
                          <h3>
                            {e.rec.title} {e.kind === 'memory' && e.rec.favorite && <IconHeart filled style={{ width: 14, color: 'var(--coral)', display: 'inline', verticalAlign: '-2px' }} aria-label="Favourite" />}
                          </h3>
                          {excerpt(e) && <p className="excerpt">{excerpt(e)}</p>}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ol>
              </Fragment>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
