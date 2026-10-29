import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { createChapter, deleteChapter, openChapterAt, restoreChapter, updateChapter, ValidationError } from '../db/repo'
import type { Chapter, ChapterItem } from '../db/types'
import { chapterCover, chapterEntries, chapterSpan, sortItemsByDate, suggestChapters, type ChapterSuggestion } from '../lib/chapters'
import { coverOf, timeline, useAll, type AllData, type TimelineEntry } from '../lib/queries'
import { fmtDate, fmtRange } from '../lib/format'
import { setPrefs, usePrefs } from '../lib/prefs'
import { Art } from '../ui/Art'
import { BackBar, Cover, EmptyState, Loading, Photo, Sheet, useConfirm, useToast } from '../ui/primitives'
import { IconBack, IconCheck, IconClose, IconEdit, IconPlus, IconSearch, IconSparkle, IconTrash } from '../ui/icons'

const key = (i: ChapterItem) => `${i.type}:${i.id}`

function spanLabel(start?: string, end?: string, open = false) {
  if (!start) return ''
  if (open && !end) return `${fmtDate(start)} – now`
  return fmtRange(start, end)
}

function entryWhen(e: TimelineEntry) {
  if (e.kind === 'adventure') return fmtRange(e.rec.startDate, e.rec.endDate)
  return e.date ? fmtDate(e.date) : 'Undated'
}

/* ------------------------------------------------------------------ */
/* List (shown inside Archive → Chapters)                              */
/* ------------------------------------------------------------------ */

export function ChaptersList({ data }: { data: AllData }) {
  const { dismissedChapters } = usePrefs()
  const nav = useNavigate()
  const suggestions = useMemo(() => suggestChapters(data, dismissedChapters), [data, dismissedChapters])
  const chapters = useMemo(
    () =>
      [...data.chapters].sort((a, b) => {
        const sa = chapterSpan(a, data).start ?? ''
        const sb = chapterSpan(b, data).start ?? ''
        return sb.localeCompare(sa) || b.createdAt.localeCompare(a.createdAt)
      }),
    [data],
  )

  return (
    <div className="chapters">
      <div className="pad stack" style={{ marginBottom: 'var(--s5)', gap: 10 } as never}>
        <p className="small muted">Name the seasons of your life and gather what belongs to each.</p>
        <Link to="/new/chapter" className="btn btn-primary btn-block">
          <IconPlus /> New chapter
        </Link>
      </div>

      {suggestions.length > 0 && (
        <section className="pad" aria-labelledby="sugg-h" style={{ marginBottom: 'var(--s6)' }}>
          <h2 id="sugg-h" className="eyebrow" style={{ marginBottom: 'var(--s3)' }}>
            Suggested from your milestones
          </h2>
          <div className="stack" style={{ gap: 10 } as never}>
            {suggestions.map((s) => (
              <SuggestionCard key={s.key} s={s} onCreate={() => nav(`/new/chapter?suggest=${s.key}`)} onDismiss={() => setPrefs({ dismissedChapters: [...dismissedChapters, s.key] })} />
            ))}
          </div>
        </section>
      )}

      {chapters.length === 0 ? (
        suggestions.length === 0 && (
          <EmptyState
            title="Your story, in chapters."
            text="A chapter is a season of your life — “The Lisbon Years”, “Starting over”. Add milestones (a move, a new job) and ATLAS will suggest chapters for you."
            action={
              <Link to="/new/chapter" className="btn btn-primary">
                <IconPlus /> Start a chapter
              </Link>
            }
          />
        )
      ) : (
        <div className="list" style={{ gap: 'var(--s4)' }}>
          {chapters.map((c) => {
            const span = chapterSpan(c, data)
            const n = chapterEntries(c, data).length
            return (
              <Link key={c.id} to={`/chapter/${c.id}`} className="card chapter-card">
                <div className="media">
                  <Cover mediaId={chapterCover(c, data)} seed={c.id} />
                </div>
                <div className="card-pad">
                  <div className="eyebrow">{[spanLabel(span.start, span.end, span.open), `${n} ${n === 1 ? 'entry' : 'entries'}`].filter(Boolean).join(' · ')}</div>
                  <h3 className="display" style={{ fontSize: 'var(--fs-xl)', marginTop: 6 }}>
                    {c.title}
                  </h3>
                  {c.description && <p className="small muted excerpt-2">{c.description}</p>}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SuggestionCard({ s, onCreate, onDismiss }: { s: ChapterSuggestion; onCreate: () => void; onDismiss: () => void }) {
  const n = s.items.length
  return (
    <div className="suggestion">
      <span className="ic">
        <IconSparkle />
      </span>
      <div className="body">
        <b>{s.title}</b>
        <span>
          {spanLabel(s.startDate, s.endDate, true)} · {n} entries
        </span>
      </div>
      <button className="btn btn-sm btn-primary" onClick={onCreate}>
        Create
      </button>
      <button className="icon-btn" onClick={onDismiss} aria-label={`Not now: ${s.title}`}>
        <IconClose />
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */

export function ChapterDetail() {
  const { id } = useParams()
  const data = useAll()
  const nav = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  if (!data) return <Loading />
  const c = data.chapters.find((x) => x.id === id)
  if (!c)
    return (
      <main className="page pad" style={{ paddingTop: 80 }}>
        <h1 className="display">This chapter has closed.</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          It may have been deleted. Its entries are still in your Archive.
        </p>
        <button className="btn btn-secondary" style={{ marginTop: 20 }} onClick={() => nav('/archive?view=chapters')}>
          Back to chapters
        </button>
      </main>
    )
  const entries = chapterEntries(c, data)
  const span = chapterSpan(c, data)
  const cover = chapterCover(c, data)

  return (
    <main>
      <div className="detail-cover grain">
        {cover ? <Photo id={cover} variant="full" /> : <Art seed={c.id} />}
        <div className="detail-nav">
          <button className="icon-btn glass" onClick={() => (history.length > 1 ? nav(-1) : nav('/archive?view=chapters'))} aria-label="Back">
            <IconBack />
          </button>
          <span className="spacer" />
          <Link to={`/edit/chapter/${c.id}`} className="icon-btn glass" aria-label="Edit chapter">
            <IconEdit />
          </Link>
        </div>
        <div className="inner" style={{ position: 'relative' }}>
          <span className="chip planning" style={{ marginBottom: 12 }}>
            Chapter
          </span>
          <h1>{c.title}</h1>
          <div className="meta">{[spanLabel(span.start, span.end, span.open), `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`].filter(Boolean).join(' · ')}</div>
        </div>
      </div>
      <div className="detail-body">
        {c.description && <p className="story">{c.description}</p>}
        <section>
          <h2>In this chapter</h2>
          {entries.length === 0 ? (
            <div className="stack">
              <p className="muted">Nothing here yet.</p>
              <Link to={`/edit/chapter/${c.id}`} className="btn btn-sea btn-sm" style={{ alignSelf: 'flex-start' }}>
                <IconPlus /> Add entries
              </Link>
            </div>
          ) : (
            <ol className="timeline" style={{ listStyle: 'none', margin: 0, padding: '0 0 0 26px' }}>
              {entries.map((e) => (
                <li key={e.kind + e.rec.id} className={`tl-item ${e.kind}`}>
                  <Link to={`/${e.kind}/${e.rec.id}`} className="card tl-card">
                    {(e.kind !== 'milestone' || coverOf(e.rec)) && (
                      <div className="media thumb">
                        <Cover mediaId={coverOf(e.rec)} seed={e.rec.id} />
                      </div>
                    )}
                    <div className="body">
                      <span className="eyebrow">
                        {e.kind} · {entryWhen(e)}
                      </span>
                      <h3>{e.rec.title}</h3>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section style={{ paddingBottom: 'var(--s12)' }}>
          <div className="detail-actions">
            <Link to={`/edit/chapter/${c.id}`} className="btn btn-secondary btn-block">
              <IconEdit /> Edit chapter
            </Link>
            <button
              className="btn btn-danger btn-block"
              onClick={async () => {
                const ok = await confirm({
                  title: `Delete “${c.title}”?`,
                  text: 'Only the chapter is removed. Every adventure, memory and milestone in it stays in your Archive. You can undo right after.',
                  confirmLabel: 'Delete chapter',
                  danger: true,
                })
                if (!ok) return
                const gone = await deleteChapter(c.id)
                nav('/archive?view=chapters', { replace: true })
                if (gone) toast({ message: 'Chapter deleted.', actionLabel: 'Undo', onAction: () => restoreChapter(gone) })
              }}
            >
              <IconTrash /> Delete chapter
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

/* ------------------------------------------------------------------ */
/* Create / edit                                                       */
/* ------------------------------------------------------------------ */

interface Draft {
  title: string
  description: string
  startDate: string
  endDate: string
  coverId?: string
  items: ChapterItem[]
  suggestedFrom?: string
  autoInclude: boolean
  excluded: ChapterItem[]
}

export function ChapterForm() {
  const { id } = useParams()
  const [search] = useSearchParams()
  const suggestKey = search.get('suggest')
  const data = useAll()
  const nav = useNavigate()
  const toast = useToast()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [picking, setPicking] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const { dismissedChapters } = usePrefs()

  // Load once data is ready
  useEffect(() => {
    if (!data || draft) return
    if (id) {
      const c = data.chapters.find((x) => x.id === id)
      if (c) setDraft({ title: c.title, description: c.description, startDate: c.startDate ?? '', endDate: c.endDate ?? '', coverId: c.coverId, items: c.items, suggestedFrom: c.suggestedFrom, autoInclude: !!c.autoInclude, excluded: c.excluded ?? [] })
      return
    }
    const s = suggestKey ? suggestChapters(data, dismissedChapters).find((x) => x.key === suggestKey) : undefined
    const w = search.get('with')?.split(':')
    const withItem: ChapterItem[] = w && ['adventure', 'memory', 'milestone'].includes(w[0]) && w[1] ? [{ type: w[0] as ChapterItem['type'], id: w[1] }] : []
    setDraft(
      s
        ? { title: s.title, description: '', startDate: s.startDate, endDate: s.endDate ?? '', items: [s.items[0]], suggestedFrom: s.key, autoInclude: true, excluded: [] }
        : { title: '', description: '', startDate: '', endDate: '', items: withItem, autoInclude: false, excluded: [] },
    )
  }, [data, draft, id, suggestKey, dismissedChapters, search])

  const auto = !!draft?.autoInclude && !!draft?.startDate
  const entries = useMemo(
    () =>
      data && draft
        ? chapterEntries(
            { id: id ?? 'draft', title: draft.title, description: '', items: draft.items, startDate: draft.startDate || undefined, endDate: draft.endDate || undefined, autoInclude: draft.autoInclude, excluded: draft.excluded, createdAt: '', updatedAt: '' },
            data,
          )
        : [],
    [data, draft, id],
  )
  const photos = useMemo(() => [...new Set(entries.flatMap((e) => e.rec.photoIds))], [entries])

  if (!data || !draft) return <Loading />
  if (id && !data.chapters.some((c) => c.id === id))
    return (
      <main className="page">
        <BackBar />
        <p className="pad muted">This chapter no longer exists.</p>
      </main>
    )

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))
  const move = (i: number, by: number) => {
    const items = [...draft.items]
    const j = i + by
    if (j < 0 || j >= items.length) return
    ;[items[i], items[j]] = [items[j], items[i]]
    set('items', items)
  }

  async function save() {
    if (!draft || saving) return
    setSaving(true)
    setErrors({})
    try {
      // keep only items that still exist
      const live = new Set(entries.map((e) => `${e.kind}:${e.rec.id}`))
      const payload: Partial<Chapter> = {
        title: draft.title,
        description: draft.description,
        startDate: draft.startDate || undefined,
        endDate: draft.endDate || undefined,
        coverId: draft.coverId && photos.includes(draft.coverId) ? draft.coverId : undefined,
        items: draft.items.filter((i) => live.has(key(i))),
        suggestedFrom: draft.suggestedFrom,
        autoInclude: draft.autoInclude && !!draft.startDate,
        excluded: draft.excluded,
      }
      let rec: Chapter
      let closedTitle: string | undefined
      if (id) rec = await updateChapter(id, payload)
      else if (draft.suggestedFrom && payload.autoInclude) {
        // opening a chapter at a milestone closes the one that was running
        const r = await openChapterAt(draft.suggestedFrom, payload)
        rec = r.created
        closedTitle = r.closed?.title
      } else rec = await createChapter(payload)
      toast({ message: id ? 'Chapter saved.' : closedTitle ? `Chapter opened — “${closedTitle}” now ends the day before.` : 'Chapter created.' })
      nav(`/chapter/${rec.id}`, { replace: true })
    } catch (err) {
      if (err instanceof ValidationError) setErrors({ [err.field]: err.message })
      else setErrors({ form: (err as Error).message || 'Something went wrong. Nothing was lost — try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page">
      <BackBar title={id ? 'Edit chapter' : suggestKey ? 'Create suggested chapter' : 'New chapter'} />
      <form
        className="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        {draft.suggestedFrom && !id && (
          <div className="note">
            Opens a new chapter at your milestone and runs from that day forward. Everything you add with a date inside it joins automatically. If another chapter was running, it ends the day before. Give it a name that feels true.
          </div>
        )}
        <div className="field">
          <label htmlFor="title">Chapter name</label>
          <input id="title" className="input title" value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. The Lisbon Years" autoFocus={!id && !suggestKey} maxLength={200} />
          {errors.title && <span className="error">{errors.title}</span>}
        </div>
        <div className="field">
          <label htmlFor="description">What this chapter was about (optional)</label>
          <textarea id="description" className="textarea" style={{ minHeight: 90 }} value={draft.description} onChange={(e) => set('description', e.target.value)} placeholder="Who you were, what changed, how it felt." />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="startDate">From (optional)</label>
            <input id="startDate" type="date" className="input" value={draft.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="endDate">Until (optional)</label>
            <input id="endDate" type="date" className="input" value={draft.endDate} min={draft.startDate} onChange={(e) => set('endDate', e.target.value)} />
            {errors.endDate && <span className="error">{errors.endDate}</span>}
          </div>
        </div>
        <span className="hint xs muted" style={{ marginTop: -12 }}>
          Leave dates empty and ATLAS uses the dates of the entries inside. Leave “Until” empty for a chapter you’re still living.
        </span>

        <label className="toggle">
          <input type="checkbox" checked={draft.autoInclude} onChange={(e) => set('autoInclude', e.target.checked)} />
          <span>
            Gather entries by date automatically
            <span className="xs muted" style={{ display: 'block', fontWeight: 400 }}>
              {draft.startDate ? 'Anything dated inside this chapter joins it — including what you add later.' : 'Set a “From” date to use this.'}
            </span>
          </span>
        </label>

        <div className="field">
          <div className="row">
            <span className="label spacer">Entries · {entries.length}</span>
            {!auto && entries.length > 1 && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => set('items', sortItemsByDate(draft.items, data))}>
                Sort by date
              </button>
            )}
          </div>
          {entries.length === 0 && <p className="small muted">Add adventures, memories and milestones that belong to this chapter.</p>}
          <ol className="chapter-items">
            {entries.map((e, i) => (
              <li key={e.kind + e.rec.id}>
                <div className="media thumb">
                  <Cover mediaId={coverOf(e.rec)} seed={e.rec.id} />
                </div>
                <div className="body">
                  <span className="eyebrow">
                    {e.kind} · {entryWhen(e)}
                  </span>
                  <b>{e.rec.title}</b>
                </div>
                <div className="reorder">
                  {!auto && (
                    <>
                      <button type="button" className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${e.rec.title} up`}>
                        ↑
                      </button>
                      <button type="button" className="icon-btn" onClick={() => move(i, 1)} disabled={i === entries.length - 1} aria-label={`Move ${e.rec.title} down`}>
                        ↓
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => {
                      const k = `${e.kind}:${e.rec.id}`
                      setDraft((d) =>
                        d ? { ...d, items: d.items.filter((x) => key(x) !== k), excluded: d.autoInclude ? [...d.excluded.filter((x) => key(x) !== k), { type: e.kind, id: e.rec.id }] : d.excluded } : d,
                      )
                    }}
                    aria-label={`Remove ${e.rec.title} from chapter`}
                  >
                    <IconClose />
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <button type="button" className="more-toggle" onClick={() => setPicking(true)}>
            <IconPlus style={{ width: 18 }} /> Add entries
          </button>
          {errors.items && <span className="error">{errors.items}</span>}
        </div>

        {photos.length > 0 && (
          <div className="field">
            <span className="label">Cover</span>
            <div className="photo-strip">
              <button type="button" className={`cover-pick${!draft.coverId ? ' on' : ''}`} onClick={() => set('coverId', undefined)} aria-pressed={!draft.coverId}>
                <span className="xs">Automatic</span>
              </button>
              {photos.map((p) => (
                <button type="button" key={p} className={`photo-tile cover-pick${draft.coverId === p ? ' on' : ''}`} onClick={() => set('coverId', p)} aria-pressed={draft.coverId === p} aria-label="Use this photo as cover">
                  <Photo id={p} />
                  {draft.coverId === p && (
                    <span className="cover-check">
                      <IconCheck />
                    </span>
                  )}
                </button>
              ))}
            </div>
            <span className="hint">Chosen from the photos of the entries in this chapter.</span>
          </div>
        )}

        {errors.form && (
          <p className="note warn" role="alert">
            {errors.form}
          </p>
        )}
      </form>
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={() => nav(-1)}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save chapter'}
        </button>
      </div>

      <Sheet open={picking} onClose={() => setPicking(false)} label="Add entries to chapter">
        <EntryPicker
          data={data}
          selected={new Set(entries.map((e) => `${e.kind}:${e.rec.id}`))}
          onDone={(picked) => {
            const pickedKeys = new Set(picked.map(key))
            const shown = new Set(entries.map((e) => `${e.kind}:${e.rec.id}`))
            const existing = new Set(draft.items.map(key))
            const added = picked.filter((p) => !existing.has(key(p)))
            const kept = draft.items.filter((i) => pickedKeys.has(key(i)))
            // in automatic chapters, unticking an entry that came in by date excludes it
            const newlyExcluded = draft.autoInclude ? [...shown].filter((k) => !pickedKeys.has(k)).map((k) => ({ type: k.split(':')[0] as ChapterItem['type'], id: k.split(':').slice(1).join(':') })) : []
            setDraft((d) =>
              d
                ? {
                    ...d,
                    items: [...kept, ...sortItemsByDate(added, data)],
                    excluded: [...d.excluded.filter((x) => !pickedKeys.has(key(x)) && !newlyExcluded.some((n) => key(n) === key(x))), ...newlyExcluded],
                  }
                : d,
            )
            setPicking(false)
          }}
        />
      </Sheet>
    </main>
  )
}

function EntryPicker({ data, selected, onDone }: { data: AllData; selected: Set<string>; onDone: (items: ChapterItem[]) => void }) {
  const [sel, setSel] = useState(() => new Set(selected))
  const [q, setQ] = useState('')
  const all = useMemo(() => timeline(data), [data])
  const t = q.trim().toLowerCase()
  const shown = t ? all.filter((e) => e.rec.title.toLowerCase().includes(t) || (e.date ?? '').startsWith(t)) : all
  const toggle = (k: string) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  return (
    <div className="picker">
      <h2>Add entries</h2>
      <div className="searchbar" style={{ boxShadow: 'none', border: '1px solid var(--line-strong)', margin: '8px 0 12px' }}>
        <IconSearch />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles or a year (e.g. 2025)" aria-label="Search entries" />
      </div>
      {all.length === 0 && <p className="muted small">No adventures, memories or milestones yet. Add some first — then gather them here.</p>}
      <ul className="pick-list">
        {shown.map((e) => {
          const k = `${e.kind}:${e.rec.id}`
          return (
            <li key={k}>
              <label className="pick-row">
                <input type="checkbox" checked={sel.has(k)} onChange={() => toggle(k)} />
                <span className="body">
                  <b>{e.rec.title}</b>
                  <span className="xs muted">
                    {e.kind} · {entryWhen(e)}
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      <div className="row" style={{ position: 'sticky', bottom: 0, background: 'var(--cream)', paddingTop: 12 }}>
        <span className="small muted spacer">{sel.size} selected</span>
        <button
          className="btn btn-primary"
          onClick={() =>
            onDone(
              [...sel].map((k) => {
                const [type, ...rest] = k.split(':')
                return { type: type as ChapterItem['type'], id: rest.join(':') }
              }),
            )
          }
        >
          <IconCheck /> Done
        </button>
      </div>
    </div>
  )
}

