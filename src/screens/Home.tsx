import { Link } from 'react-router-dom'
import { coverOf, nextDream, stats, timeline, useAll } from '../lib/queries'
import { Art } from '../ui/Art'
import { Cover, EmptyState, Loading, Photo } from '../ui/primitives'
import { IconCompassMark, IconDreams, IconHelp, IconPlus } from '../ui/icons'
import { fmtRange, greeting, postmark } from '../lib/format'
import { usePrefs } from '../lib/prefs'

export default function Home({ onAdd }: { onAdd: () => void }) {
  const data = useAll()
  const { name } = usePrefs()
  if (!data) return <Loading />

  const s = stats(data)
  const tl = timeline(data)
  const isEmpty = tl.length === 0 && data.places.length === 0 && data.dreams.length === 0
  const latest = [...data.adventures].sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
  const heroPhoto = latest && coverOf(latest)
  const postcards = tl.filter((e) => e.kind !== 'milestone').slice(0, 12)
  const dream = nextDream(data.dreams)

  return (
    <main className="page">
      <header className="topbar">
        <span className="wordmark" aria-label="ATLAS.">
          <IconCompassMark />
          <span>ATLAS<span className="dot">.</span></span>
        </span>
        <Link to="/guide" className="icon-btn help-link" aria-label="How ATLAS works">
          <IconHelp />
        </Link>
      </header>

      {latest ? (
        <Link to={`/adventure/${latest.id}`} className={`hero grain${heroPhoto ? '' : ' art'}`} aria-label={`Latest adventure: ${latest.title}`}>
          {heroPhoto ? <Photo id={heroPhoto} variant="full" /> : <Art seed={latest.id} />}
          <div className="hero-content" style={{ position: 'relative' }}>
            <div className="eyebrow">
              {greeting()}
              {name ? `, ${name}` : ''} · Your story continues
            </div>
            <h2>{latest.title}</h2>
            <p>{fmtRange(latest.startDate, latest.endDate)}</p>
          </div>
        </Link>
      ) : (
        <section className="hero art grain">
          <Art scene="coast" seed="home" />
          <div className="hero-content" style={{ position: 'relative' }}>
            <div className="eyebrow">
              {greeting()}
              {name ? `, ${name}` : ''}
            </div>
            <h2>Go somewhere. Feel something.</h2>
            <button className="btn btn-primary" onClick={onAdd}>
              <IconPlus /> Add to your atlas
            </button>
          </div>
        </section>
      )}

      <div className="stats" aria-label="Your totals">
        <Link to="/map" className="stat" style={{ color: 'inherit' }}>
          <b>{s.places}</b>
          <span>{s.places === 1 ? 'Place' : 'Places'}</span>
        </Link>
        <Link to="/archive" className="stat" style={{ color: 'inherit' }}>
          <b>{s.memories + s.adventures}</b>
          <span>Memories</span>
        </Link>
        <Link to="/dreams" className="stat" style={{ color: 'inherit' }}>
          <b>{s.dreams}</b>
          <span>{s.dreams === 1 ? 'Dream' : 'Dreams'}</span>
        </Link>
      </div>

      {isEmpty ? (
        <div className="section">
          <EmptyState
            title="Every story starts somewhere."
            text="Add your first memory — a title is enough. Photos and places can come later."
            action={
              <button className="btn btn-primary" onClick={onAdd}>
                <IconPlus /> Add your first memory
              </button>
            }
          />
        </div>
      ) : (
        <>
          <section className="section" aria-labelledby="pc-h">
            <div className="section-head">
              <h2 id="pc-h">Postcards from your life</h2>
              <Link to="/archive">See all</Link>
            </div>
            {postcards.length ? (
              <div className="scroller">
                {postcards.map((e) => (
                  <Link key={e.rec.id} to={`/${e.kind}/${e.rec.id}`} className="postcard">
                    <div className="media">
                      <Cover mediaId={coverOf(e.rec)} seed={e.rec.id} />
                    </div>
                    {e.date && <div className="postmark">{postmark(e.date)}</div>}
                    <h3>{e.rec.title}</h3>
                    <div className="meta">{e.kind === 'adventure' ? 'Adventure' : 'Memory'}</div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="pad muted small">Your adventures and memories will appear here as postcards.</p>
            )}
          </section>

          <section className="section" aria-labelledby="next-h">
            <div className="section-head">
              <h2 id="next-h">Next, maybe?</h2>
              <Link to="/dreams">All dreams</Link>
            </div>
            <div className="pad">
              {dream ? (
                <Link to={`/dream/${dream.id}`} className="card" style={{ display: 'flex', alignItems: 'stretch' }}>
                  <div className="media" style={{ width: 120, flex: 'none' }}>
                    <Cover mediaId={coverOf(dream)} seed={dream.id} />
                  </div>
                  <div className="card-pad" style={{ minWidth: 0 }}>
                    <span className={`chip ${dream.status}`}>{dream.status.charAt(0).toUpperCase() + dream.status.slice(1)}</span>
                    <h3 className="display" style={{ fontSize: 'var(--fs-xl)', marginTop: 8 }}>
                      {dream.title}
                    </h3>
                    {dream.why && (
                      <p className="small muted" style={{ marginTop: 4 }}>
                        {dream.why}
                      </p>
                    )}
                  </div>
                </Link>
              ) : (
                <Link to="/new/dream" className="card card-pad row" style={{ color: 'inherit' }}>
                  <span className="chip someday">
                    <IconDreams /> Dream
                  </span>
                  <span>Things you haven’t done. Yet. Add one?</span>
                </Link>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
