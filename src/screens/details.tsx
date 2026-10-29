import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { completeDream, deleteEntry, getEntry, restoreSnapshot, updateEntry } from '../db/repo'
import { DREAM_STATUSES, ENTRY_LABEL, type DreamStatus, type EntryMap, type EntryType } from '../db/types'
import { coverOf, useAll, visitsFor, type AllData } from '../lib/queries'
import { chapterCover, chaptersContaining } from '../lib/chapters'
import { Art } from '../ui/Art'
import { Cover, Loading, Photo, Segmented, Sheet, useConfirm, useToast } from '../ui/primitives'
import { IconBack, IconCheck, IconClose, IconEdit, IconHeart, IconMap, IconPlus, IconTrash } from '../ui/icons'
import { cap, fmtDate, fmtRange, placeLine, safeUrl } from '../lib/format'

/* ---------------- shared ---------------- */

function useEntry<T extends EntryType>(type: T) {
  const { id } = useParams()
  return useLiveQuery(async () => ((await getEntry(type, id!)) ?? null) as EntryMap[T] | null, [type, id])
}

function Gallery({ ids }: { ids: string[] }) {
  const [open, setOpen] = useState<string>()
  if (!ids.length) return null
  return (
    <section>
      <h2>Photos</h2>
      <div className="gallery">
        {ids.map((id, i) => (
          <button key={id} onClick={() => setOpen(id)} aria-label={`Open photo ${i + 1}`}>
            <Photo id={id} />
          </button>
        ))}
      </div>
      {open && (
        <div className="lightbox" role="dialog" aria-label="Photo" onClick={() => setOpen(undefined)}>
          <Photo id={open} variant="full" />
          <button className="icon-btn" aria-label="Close photo">
            <IconClose />
          </button>
        </div>
      )}
    </section>
  )
}

function DeleteButton({ type, id, title }: { type: EntryType; id: string; title: string }) {
  const confirm = useConfirm()
  const toast = useToast()
  const nav = useNavigate()
  return (
    <button
      className="btn btn-danger btn-block"
      onClick={async () => {
        const ok = await confirm({
          title: `Delete “${title}”?`,
          text: `This removes the ${ENTRY_LABEL[type].toLowerCase()} and its photos. Linked entries are kept — they’re just unlinked. You can undo right after.`,
          confirmLabel: 'Delete',
          danger: true,
        })
        if (!ok) return
        const snap = await deleteEntry(type, id)
        nav(-1)
        if (snap) toast({ message: `${ENTRY_LABEL[type]} deleted.`, actionLabel: 'Undo', onAction: () => restoreSnapshot(snap) })
      }}
    >
      <IconTrash /> Delete {ENTRY_LABEL[type].toLowerCase()}
    </button>
  )
}

function DetailLayout({
  type,
  rec,
  title,
  meta,
  chips,
  children,
}: {
  type: EntryType
  rec: { id: string; photoIds: string[]; coverId?: string }
  title: string
  meta?: ReactNode
  chips?: ReactNode
  children: ReactNode
}) {
  const nav = useNavigate()
  const cover = coverOf(rec)
  const others = rec.photoIds
  return (
    <main>
      <div className="detail-cover grain">
        {cover ? <Photo id={cover} variant="full" alt="" /> : <Art seed={rec.id} />}
        <div className="detail-nav">
          <button className="icon-btn glass" onClick={() => (history.length > 1 ? nav(-1) : nav('/'))} aria-label="Back">
            <IconBack />
          </button>
          <span className="spacer" />
          <Link to={`/edit/${type}/${rec.id}`} className="icon-btn glass" aria-label="Edit">
            <IconEdit />
          </Link>
        </div>
        <div className="inner" style={{ position: 'relative' }}>
          {chips}
          <h1>{title}</h1>
          {meta && <div className="meta">{meta}</div>}
        </div>
      </div>
      <div className="detail-body">
        {children}
        <Gallery ids={others} />
        <section style={{ paddingBottom: 'var(--s12)' }}>
          <div className="detail-actions">
            <Link to={`/edit/${type}/${rec.id}`} className="btn btn-secondary btn-block">
              <IconEdit /> Edit
            </Link>
            <DeleteButton type={type} id={rec.id} title={title} />
          </div>
        </section>
      </div>
    </main>
  )
}

function NotFound() {
  const nav = useNavigate()
  return (
    <main className="page pad" style={{ paddingTop: 80 }}>
      <h1 className="display">This page has wandered off.</h1>
      <p className="muted" style={{ marginTop: 8 }}>
        The entry may have been deleted.
      </p>
      <button className="btn btn-secondary" style={{ marginTop: 20 }} onClick={() => nav('/')}>
        Go home
      </button>
    </main>
  )
}

function Facts({ items }: { items: [string, ReactNode | undefined][] }) {
  const shown = items.filter(([, v]) => v !== undefined && v !== '' && v !== null)
  if (!shown.length) return null
  return (
    <div className="facts">
      {shown.map(([k, v]) => (
        <div className="fact" key={k}>
          <div className="eyebrow">{k}</div>
          <div>{v}</div>
        </div>
      ))}
    </div>
  )
}

function Tags({ tags }: { tags?: string[] }) {
  if (!tags?.length) return null
  return (
    <div className="row wrap" style={{ gap: 6 }}>
      {tags.map((t) => (
        <span key={t} className={`chip${t === 'demo' ? ' demo' : ''}`}>
          #{t}
        </span>
      ))}
    </div>
  )
}

type Linkable = { kind: EntryType | 'chapter'; id: string; title: string; sub?: string; cover?: string }
function LinkedList({ title, items, empty }: { title: string; items: Linkable[]; empty?: ReactNode }) {
  if (!items.length && !empty) return null
  return (
    <section>
      <h2>{title}</h2>
      {items.length === 0 ? (
        empty
      ) : (
        <div className="stack" style={{ gap: 10 } as never}>
          {items.map((i) => (
            <Link key={i.kind + i.id} to={`/${i.kind}/${i.id}`} className="list-row">
              <div className="media thumb">
                <Cover mediaId={i.cover} seed={i.id} />
              </div>
              <div className="body">
                <h3>{i.title}</h3>
                {i.sub && <div className="meta">{i.sub}</div>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

function InChapters({ type, id, all }: { type: 'adventure' | 'memory' | 'milestone'; id: string; all: AllData }) {
  const chs = chaptersContaining(type, id, all)
  if (!chs.length) return null
  return <LinkedList title="In chapters" items={chs.map((c) => ({ kind: 'chapter', id: c.id, title: c.title, sub: 'Chapter', cover: chapterCover(c, all) }))} />
}

const placeItem = (p: AllData['places'][number]): Linkable => ({ kind: 'place', id: p.id, title: p.name, sub: [p.status === 'visited' ? 'Visited' : 'Wishlist', placeLine(p)].filter(Boolean).join(' · '), cover: coverOf(p) })

/* ---------------- Adventure ---------------- */

export function AdventureDetail() {
  const a = useEntry('adventure')
  const all = useAll()
  if (a === undefined || !all) return <Loading />
  if (a === null) return <NotFound />
  const places = a.placeIds.map((id) => all.places.find((p) => p.id === id)).filter(Boolean) as AllData['places']
  const memories = all.memories.filter((m) => m.adventureId === a.id).sort((x, y) => (x.date ?? '').localeCompare(y.date ?? ''))
  const dream = a.fromDreamId ? all.dreams.find((d) => d.id === a.fromDreamId) : undefined
  return (
    <DetailLayout
      type="adventure"
      rec={a}
      title={a.title}
      chips={<span className="chip visited">Adventure</span>}
      meta={
        <>
          {fmtRange(a.startDate, a.endDate)}
          {places.length > 0 && ` · ${places.map((p) => p.name).join(', ')}`}
        </>
      }
    >
      {a.story && <p className="story">{a.story}</p>}
      {a.highlight && (
        <section>
          <h2>What I’ll remember</h2>
          <blockquote className="quote" style={{ margin: 0 }}>
            “{a.highlight}”
          </blockquote>
        </section>
      )}
      <Facts items={[['With', a.companions], ['Dates', fmtRange(a.startDate, a.endDate)], ['From a dream', dream && <Link to={`/dream/${dream.id}`}>{dream.title}</Link>]]} />
      <Tags tags={a.tags} />
      <LinkedList title="Places" items={places.map(placeItem)} />
      <LinkedList
        title="Memories from this adventure"
        items={memories.map((m) => ({ kind: 'memory', id: m.id, title: m.title, sub: fmtDate(m.date), cover: coverOf(m) }))}
        empty={
          <Link to={`/new/memory?adventure=${a.id}`} className="btn btn-sea btn-sm">
            <IconPlus /> Add a memory to this adventure
          </Link>
        }
      />
      {memories.length > 0 && (
        <Link to={`/new/memory?adventure=${a.id}`} className="btn btn-sea btn-sm">
          <IconPlus /> Add another memory
        </Link>
      )}
      <InChapters type="adventure" id={a.id} all={all} />
    </DetailLayout>
  )
}

/* ---------------- Memory ---------------- */

export function MemoryDetail() {
  const m = useEntry('memory')
  const all = useAll()
  if (m === undefined || !all) return <Loading />
  if (m === null) return <NotFound />
  const place = m.placeId ? all.places.find((p) => p.id === m.placeId) : undefined
  const adv = m.adventureId ? all.adventures.find((a) => a.id === m.adventureId) : undefined
  const dream = m.fromDreamId ? all.dreams.find((d) => d.id === m.fromDreamId) : undefined
  return (
    <DetailLayout
      type="memory"
      rec={m}
      title={m.title}
      chips={
        <div className="row" style={{ gap: 6, marginBottom: 12 }}>
          <span className="chip wishlist" style={{ margin: 0 }}>
            Memory
          </span>
          <button
            className="chip"
            style={{ margin: 0, minHeight: 32 }}
            onClick={() => updateEntry('memory', m.id, { favorite: !m.favorite })}
            aria-pressed={m.favorite}
            aria-label={m.favorite ? 'Remove from favourites' : 'Mark as favourite'}
          >
            <IconHeart filled={m.favorite} style={{ color: 'var(--coral)' }} /> {m.favorite ? 'Favourite' : 'Favourite?'}
          </button>
        </div>
      }
      meta={[m.date && fmtDate(m.date), m.time, place?.name].filter(Boolean).join(' · ')}
    >
      {m.story && <p className="story">{m.story}</p>}
      <Facts items={[['People', m.people], ['Adventure', adv && <Link to={`/adventure/${adv.id}`}>{adv.title}</Link>], ['From a dream', dream && <Link to={`/dream/${dream.id}`}>{dream.title}</Link>]]} />
      <Tags tags={m.tags} />
      {place && <LinkedList title="Place" items={[placeItem(place)]} />}
      <InChapters type="memory" id={m.id} all={all} />
    </DetailLayout>
  )
}

/* ---------------- Milestone ---------------- */

export function MilestoneDetail() {
  const m = useEntry('milestone')
  const all = useAll()
  if (m === undefined || !all) return <Loading />
  if (m === null) return <NotFound />
  return (
    <DetailLayout type="milestone" rec={m} title={m.title} chips={<span className="chip planning">Milestone</span>} meta={fmtDate(m.date)}>
      {m.description ? <p className="story">{m.description}</p> : <p className="muted">A moment that mattered.</p>}
      <InChapters type="milestone" id={m.id} all={all} />
      {chaptersContaining('milestone', m.id, all).length === 0 && (
        <Link to={`/new/chapter?suggest=${m.id}&with=milestone:${m.id}`} className="btn btn-sea btn-sm" style={{ alignSelf: 'flex-start' }}>
          Start a chapter here
        </Link>
      )}
    </DetailLayout>
  )
}

/* ---------------- Place ---------------- */

export function PlaceDetail() {
  const p = useEntry('place')
  const all = useAll()
  if (p === undefined || !all) return <Loading />
  if (p === null) return <NotFound />
  const advs = all.adventures.filter((a) => a.placeIds.includes(p.id)).sort((a, b) => b.startDate.localeCompare(a.startDate))
  const mems = all.memories.filter((m) => m.placeId === p.id).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  const dreams = all.dreams.filter((d) => d.placeId === p.id)
  const visits = visitsFor(p, all)
  const hasPin = p.lat !== undefined && p.lng !== undefined
  return (
    <DetailLayout
      type="place"
      rec={p}
      title={p.name}
      chips={<span className={`chip ${p.status}`}>{p.status === 'visited' ? 'Visited' : 'Wishlist'}</span>}
      meta={placeLine(p) || (hasPin ? `${p.lat}, ${p.lng}` : undefined)}
    >
      <div className="row wrap">
        {hasPin ? (
          <Link to={`/map?focus=${p.id}`} className="btn btn-secondary btn-sm">
            <IconMap /> Show on map
          </Link>
        ) : (
          <Link to={`/edit/place/${p.id}`} className="btn btn-secondary btn-sm">
            <IconMap /> Add a pin
          </Link>
        )}
        <Link to={`/new/memory?place=${p.id}`} className="btn btn-sea btn-sm">
          <IconPlus /> Memory here
        </Link>
        {p.status === 'wishlist' && (
          <button className="btn btn-primary btn-sm" onClick={() => updateEntry('place', p.id, { status: 'visited' })}>
            <IconCheck /> I’ve been here
          </button>
        )}
      </div>
      {p.notes && <p className="story">{p.notes}</p>}
      <Facts items={[['Category', p.category && cap(p.category)], ['Address', p.address], ['Visits', visits.length ? `${visits.length}` : undefined]]} />
      {visits.length > 0 && (
        <section>
          <h2>Visit history</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack">
            {visits.map((v, i) => (
              <li key={i} className="row" style={{ marginTop: i ? 8 : 0 }}>
                <span className="chip">{fmtDate(v.date)}</span>
                {v.to ? <Link to={v.to}>{v.label}</Link> : <span>{v.label}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <Tags tags={p.tags} />
      <LinkedList title="Adventures" items={advs.map((a) => ({ kind: 'adventure', id: a.id, title: a.title, sub: fmtRange(a.startDate, a.endDate), cover: coverOf(a) }))} />
      <LinkedList title="Memories" items={mems.map((m) => ({ kind: 'memory', id: m.id, title: m.title, sub: fmtDate(m.date), cover: coverOf(m) }))} />
      <LinkedList title="Dreams" items={dreams.map((d) => ({ kind: 'dream', id: d.id, title: d.title, sub: cap(d.status), cover: coverOf(d) }))} />
    </DetailLayout>
  )
}

/* ---------------- Dream ---------------- */

export function DreamDetail() {
  const d = useEntry('dream')
  const all = useAll()
  const nav = useNavigate()
  const toast = useToast()
  const [completing, setCompleting] = useState(false)
  if (d === undefined || !all) return <Loading />
  if (d === null) return <NotFound />
  const place = d.placeId ? all.places.find((p) => p.id === d.placeId) : undefined
  const adv = d.linkedAdventureId ? all.adventures.find((a) => a.id === d.linkedAdventureId) : undefined
  const mem = d.linkedMemoryId ? all.memories.find((m) => m.id === d.linkedMemoryId) : undefined
  const done = d.status === 'completed'
  const links = d.inspirationLinks.map((l) => ({ l, href: safeUrl(l) }))

  return (
    <DetailLayout
      type="dream"
      rec={d}
      title={d.title}
      chips={
        <div className="row" style={{ gap: 6, marginBottom: 12 }}>
          <span className={`chip ${d.status}`} style={{ margin: 0 }}>
            {cap(d.status)}
          </span>
          <span className="chip" style={{ margin: 0 }}>
            {cap(d.type)}
          </span>
        </div>
      }
      meta={done ? `Completed ${fmtDate(d.completedOn)}` : place?.name}
    >
      {!done ? (
        <section>
          <h2>Where it stands</h2>
          <Segmented
            label="Dream status"
            value={d.status}
            options={DREAM_STATUSES.filter((s) => s !== 'completed').map((s) => ({ value: s, label: cap(s) }))}
            onChange={(s: DreamStatus) => updateEntry('dream', d.id, { status: s })}
          />
          <button className="btn btn-primary btn-block" style={{ marginTop: 'var(--s4)' }} onClick={() => setCompleting(true)}>
            <IconCheck /> I did it
          </button>
        </section>
      ) : (
        <section>
          <h2>You did it</h2>
          {adv || mem ? (
            <Link to={adv ? `/adventure/${adv.id}` : `/memory/${mem!.id}`} className="list-row">
              <div className="media thumb">
                <Cover mediaId={coverOf((adv ?? mem)!)} seed={(adv ?? mem)!.id} />
              </div>
              <div className="body">
                <div className="eyebrow">{adv ? 'Adventure' : 'Memory'}</div>
                <h3>{(adv ?? mem)!.title}</h3>
              </div>
            </Link>
          ) : (
            <div className="row wrap">
              <Link to={`/new/adventure?fromDream=${d.id}`} className="btn btn-sea btn-sm">
                Write it up as an adventure
              </Link>
              <Link to={`/new/memory?fromDream=${d.id}`} className="btn btn-sea btn-sm">
                …or a memory
              </Link>
            </div>
          )}
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => updateEntry('dream', d.id, { status: 'planning', completedOn: undefined })}>
            Not done after all? Reopen
          </button>
        </section>
      )}
      {d.why && (
        <section>
          <h2>Why it matters</h2>
          <blockquote className="quote" style={{ margin: 0 }}>
            {d.why}
          </blockquote>
        </section>
      )}
      <Facts items={[['Budget', d.budget], ['With', d.companions], ['Place', place && <Link to={`/place/${place.id}`}>{place.name}</Link>]]} />
      {!done && (
        <section>
          <h2>On your map</h2>
          {!place ? (
            <div className="note">
              No place yet.{' '}
              <Link to={`/edit/dream/${d.id}`}>Add where</Link> and it appears on your map in turquoise.
            </div>
          ) : place.lat === undefined && !place.country ? (
            <div className="note warn">
              {place.name} has no location yet, so it can’t be shown. <Link to={`/edit/place/${place.id}`}>Add its location</Link>.
            </div>
          ) : place.status === 'wishlist' ? (
            <div className="row" style={{ gap: 10 }}>
              <span className="place-chip wishlist" style={{ paddingRight: 14 }}>
                <span className="dot wishlist" aria-hidden />
                {place.name}
              </span>
              <Link to={`/map?focus=${place.id}`} className="btn btn-sm btn-secondary">
                Show on map
              </Link>
            </div>
          ) : (
            <div className="note">
              You’ve already been to {place.name}, so it shows in <b>coral</b> (visited) — dreaming of going back counts too. If you haven’t actually been,{' '}
              <button className="link-btn" onClick={() => updateEntry('place', place.id, { status: 'wishlist', visitedOn: undefined })}>
                mark {place.name} as not visited yet
              </button>{' '}
              and it turns turquoise.
            </div>
          )}
        </section>
      )}
      {d.notes && (
        <section>
          <h2>Notes & planning</h2>
          <p className="story">{d.notes}</p>
        </section>
      )}
      {links.length > 0 && (
        <section className="link-list">
          <h2>Inspiration</h2>
          {links.map(({ l, href }) =>
            href ? (
              <a key={l} href={href} target="_blank" rel="noopener noreferrer">
                {l}
              </a>
            ) : (
              <span key={l}>{l}</span>
            ),
          )}
        </section>
      )}
      <Tags tags={(d as { tags?: string[] }).tags} />

      <Sheet open={completing} onClose={() => setCompleting(false)} label="Complete dream">
        <h2>You did it.</h2>
        <p className="muted small">Want to keep the story? Your dream stays in your list, linked to what you create.</p>
        <div className="stack" style={{ marginTop: 'var(--s5)' }}>
          <button className="btn btn-primary btn-block" onClick={() => nav(`/new/adventure?fromDream=${d.id}`)}>
            Create an adventure
          </button>
          <button className="btn btn-secondary btn-block" onClick={() => nav(`/new/memory?fromDream=${d.id}`)}>
            Create a memory
          </button>
          <button
            className="btn btn-ghost btn-block"
            onClick={async () => {
              await completeDream(d.id, { as: 'none' })
              setCompleting(false)
              toast({ message: 'Marked complete.' })
            }}
          >
            Just mark it complete
          </button>
        </div>
      </Sheet>
    </DetailLayout>
  )
}
