import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { addToChapter, chapterOn, completeDream, createEntry, getEntry, openChapterAt, todayIso, updateEntry, ValidationError } from '../db/repo'
import { addPhotos, removePhoto } from '../db/media'
import { DREAM_STATUSES, DREAM_TYPES, ENTRY_LABEL, PLACE_CATEGORIES, type Chapter, type EntryMap, type EntryType, type Milestone } from '../db/types'
import { BackBar, Loading, Photo, Segmented, Sheet, useToast } from '../ui/primitives'
import { IconCamera, IconClose, IconHeart } from '../ui/icons'
import { LocationPicker } from '../map/LocationPicker'
import { searchWorld, type GeoResult } from '../map/leaflet'
import { useAll } from '../lib/queries'
import { cap, splitTags } from '../lib/format'

type Draft = Record<string, unknown>
const TYPES: EntryType[] = ['adventure', 'memory', 'place', 'milestone', 'dream']

/* ---------------- Photo field ---------------- */

interface PhotoState {
  kept: string[]
  removed: string[]
  pending: File[]
  coverId?: string
}

function PendingThumb({ file }: { file: File }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  return url ? <img src={url} alt="" /> : null
}

function PhotoField({ state, onChange }: { state: PhotoState; onChange: (s: PhotoState) => void }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="field">
      <span className="label">Photos</span>
      <div className="photo-strip">
        {state.kept.map((id) => (
          <div className="photo-tile" key={id}>
            <Photo id={id} />
            <button type="button" className="remove" aria-label="Remove photo" onClick={() => onChange({ ...state, kept: state.kept.filter((k) => k !== id), removed: [...state.removed, id], coverId: state.coverId === id ? undefined : state.coverId })}>
              <IconClose />
            </button>
            <button type="button" className="cover-badge" onClick={() => onChange({ ...state, coverId: id })} aria-pressed={(state.coverId ?? state.kept[0]) === id}>
              {(state.coverId ?? state.kept[0]) === id ? 'Cover' : 'Set cover'}
            </button>
          </div>
        ))}
        {state.pending.map((f, i) => (
          <div className="photo-tile" key={i}>
            <PendingThumb file={f} />
            <button type="button" className="remove" aria-label="Remove photo" onClick={() => onChange({ ...state, pending: state.pending.filter((_, j) => j !== i) })}>
              <IconClose />
            </button>
          </div>
        ))}
        <button type="button" className="photo-add" onClick={() => input.current?.click()}>
          <IconCamera />
          Add photos
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) onChange({ ...state, pending: [...state.pending, ...files] })
          e.target.value = ''
        }}
      />
      <span className="hint">Photos stay on this device. Nothing is uploaded.</span>
    </div>
  )
}

/* ---------------- Small field helpers ---------------- */

function Field({ label, error, hint, children, id }: { label: string; error?: string; hint?: string; children: ReactNode; id?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
      {error && (
        <span className="error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

/* ---------------- Form ---------------- */

export default function EntryForm() {
  const params = useParams()
  const [search] = useSearchParams()
  const nav = useNavigate()
  const toast = useToast()
  const all = useAll()
  const type = params.type as EntryType
  const editId = params.id
  const fromDream = search.get('fromDream') ?? undefined

  const [draft, setDraft] = useState<Draft | null>(editId ? null : {})
  const [photos, setPhotos] = useState<PhotoState>({ kept: [], removed: [], pending: [] })
  const [more, setMore] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [newPlace, setNewPlace] = useState('')
  const [askChapter, setAskChapter] = useState<{ milestone: Milestone; running?: Chapter } | null>(null)

  // Load existing entry, or prefill a new one
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (editId) {
        const rec = (await getEntry(type, editId)) as unknown as Draft | undefined
        if (!alive) return
        if (!rec) return setDraft({ __missing: true })
        setDraft({ ...rec, tagsText: ((rec.tags as string[]) ?? []).join(', '), linksText: ((rec.inspirationLinks as string[]) ?? []).join('\n') })
        setPhotos({ kept: (rec.photoIds as string[]) ?? [], removed: [], pending: [], coverId: rec.coverId as string | undefined })
        setMore(true)
        return
      }
      const d: Draft = {}
      if (type === 'adventure') d.startDate = todayIso()
      if (type === 'milestone') d.date = todayIso()
      if (type === 'memory') d.date = todayIso()
      if (type === 'place') {
        d.status = search.get('status') === 'wishlist' ? 'wishlist' : 'visited'
        const lat = search.get('lat'), lng = search.get('lng')
        if (lat && lng) Object.assign(d, { lat: Number(lat), lng: Number(lng) })
      }
      if (type === 'dream') Object.assign(d, { type: 'destination', status: 'someday' })
      const placeId = search.get('place')
      if (placeId) {
        if (type === 'adventure') d.placeIds = [placeId]
        else d.placeId = placeId
      }
      const adventureId = search.get('adventure')
      if (adventureId && type === 'memory') d.adventureId = adventureId
      if (fromDream) {
        const dream = await getEntry('dream', fromDream)
        if (dream) {
          d.title = dream.title
          if (type === 'adventure') {
            d.placeIds = dream.placeId ? [dream.placeId] : []
            d.companions = dream.companions
          } else d.placeId = dream.placeId
        }
      }
      if (alive) setDraft(d)
    })()
    return () => {
      alive = false
    }
  }, [type, editId, fromDream, search])

  const sortedPlaces = useMemo(() => [...(all?.places ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [all])

  if (!TYPES.includes(type)) return <BackBar title="Unknown entry type" />
  if (!draft || !all) return <Loading />
  if (draft.__missing)
    return (
      <main className="page">
        <BackBar />
        <p className="pad muted">This entry no longer exists.</p>
      </main>
    )

  const set = (k: string, v: unknown) => setDraft((d) => ({ ...d, [k]: v }))
  const str = (k: string) => (draft[k] as string | undefined) ?? ''
  const titleKey = type === 'place' ? 'name' : 'title'

  /** Dreams create wishlist places; adventures and memories create visited ones. */
  const newPlaceStatus = type === 'dream' ? 'wishlist' : 'visited'
  async function quickAddPlace(found?: GeoResult) {
    const name = (found?.name ?? newPlace).trim()
    if (!name) return
    // reuse an existing place with the same name rather than creating a twin
    const twin = sortedPlaces.find((p) => p.name.toLowerCase() === name.toLowerCase())
    const p =
      twin ??
      (await createEntry('place', {
        name,
        status: newPlaceStatus,
        ...(found ? { lat: Math.round(found.lat * 1e5) / 1e5, lng: Math.round(found.lng * 1e5) / 1e5, country: found.country, region: found.region } : {}),
      }))
    setNewPlace('')
    if (type === 'adventure') {
      const ids = (draft!.placeIds as string[]) ?? []
      if (!ids.includes(p.id)) set('placeIds', [...ids, p.id])
    } else set('placeId', p.id)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setErrors({})
    try {
      const { tagsText, linksText, id: _id, createdAt: _c, updatedAt: _u, photoIds: _p, coverId: _cv, ...rest } = draft as Draft
      const data: Draft = { ...rest }
      if (typeof tagsText === 'string') data.tags = splitTags(tagsText)
      if (typeof linksText === 'string') data.inspirationLinks = linksText.split('\n').map((s) => s.trim()).filter(Boolean)
      if (type === 'place') {
        const hasLoc = typeof data.lat === 'number' && typeof data.lng === 'number'
        if (!hasLoc) {
          data.lat = undefined
          data.lng = undefined
        }
      }

      let id: string
      if (editId) {
        const rec = await updateEntry(type, editId, data as Partial<EntryMap[EntryType]>)
        id = rec.id
      } else if (fromDream && (type === 'adventure' || type === 'memory')) {
        const { created } = await completeDream(fromDream, { as: type, data: data as never, completedOn: (type === 'adventure' ? data.startDate : data.date) as string | undefined })
        id = created!.id
      } else {
        const rec = await createEntry(type, data as Partial<EntryMap[EntryType]>)
        id = rec.id
      }

      // photos
      for (const mid of photos.removed) await removePhoto(mid)
      if (photos.pending.length) await addPhotos(type, id, photos.pending)
      if (photos.coverId && photos.kept.includes(photos.coverId)) await updateEntry(type, id, { coverId: photos.coverId } as never)

      if (type === 'milestone' && !editId) {
        // A new milestone can open a new chapter of your life
        const milestone = (await getEntry('milestone', id))!
        setAskChapter({ milestone, running: await chapterOn(milestone.date) })
        return
      }
      toast({ message: editId ? 'Saved.' : fromDream ? 'Dream complete — and kept.' : `${ENTRY_LABEL[type]} added.` })
      nav(`/${type}/${id}`, { replace: true })
    } catch (err) {
      if (err instanceof ValidationError) {
        setErrors({ [err.field]: err.message })
        if (['location', 'visitedOn', 'endDate', 'completedOn'].includes(err.field)) setMore(true)
      } else setErrors({ form: (err as Error).message || 'Something went wrong. Nothing was lost — try again.' })
    } finally {
      setSaving(false)
    }
  }

  const placeSelect = (k: string, label = 'Place') => (
    <Field label={label} id={k}>
      <select id={k} className="select" value={str(k)} onChange={(e) => set(k, e.target.value || undefined)}>
        <option value="">None</option>
        {sortedPlaces.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <QuickPlace value={newPlace} onChange={setNewPlace} onAdd={quickAddPlace} status={newPlaceStatus} />
    </Field>
  )

  const heading = editId ? `Edit ${ENTRY_LABEL[type].toLowerCase()}` : fromDream ? `Complete your dream` : `New ${ENTRY_LABEL[type].toLowerCase()}`

  return (
    <main className="page">
      <BackBar title={heading} />
      <form className="form" onSubmit={save} noValidate>
        {fromDream && <div className="note">Your dream will be marked complete and linked to this {type}. The original dream is kept.</div>}
        <Field label={type === 'place' ? 'Name' : 'Title'} error={errors[titleKey]} id="title">
          <input
            id="title"
            className="input title"
            value={str(titleKey)}
            onChange={(e) => set(titleKey, e.target.value)}
            placeholder={{ adventure: 'Where did you go?', memory: 'What happened?', place: 'Name this place', milestone: 'What changed?', dream: 'What do you dream of?' }[type]}
            autoFocus={!editId}
            maxLength={200}
            required
          />
        </Field>

        {/* ---------- essentials ---------- */}
        {type === 'adventure' && (
          <div className="field-row">
            <Field label="Start" error={errors.startDate} id="startDate">
              <input id="startDate" type="date" className="input" value={str('startDate')} onChange={(e) => set('startDate', e.target.value)} />
            </Field>
            <Field label="End (optional)" error={errors.endDate} id="endDate">
              <input id="endDate" type="date" className="input" value={str('endDate')} min={str('startDate')} onChange={(e) => set('endDate', e.target.value)} />
            </Field>
          </div>
        )}
        {(type === 'memory' || type === 'milestone') && (
          <Field label={type === 'memory' ? 'Date (optional)' : 'Date'} error={errors.date} id="date">
            <input id="date" type="date" className="input" value={str('date')} onChange={(e) => set('date', e.target.value)} />
          </Field>
        )}
        {type === 'place' && (
          <>
            <div className="field">
              <span className="label">Status</span>
              <Segmented
                label="Place status"
                value={(str('status') || 'visited') as 'visited' | 'wishlist'}
                options={[
                  { value: 'visited', label: 'Been there' },
                  { value: 'wishlist', label: 'Wishlist' },
                ]}
                onChange={(v) => set('status', v)}
              />
            </div>
            <div className="field">
              <span className="label">Location (optional)</span>
              <LocationPicker
                value={{ lat: draft.lat as number | undefined, lng: draft.lng as number | undefined }}
                onChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    lat: v.lat,
                    lng: v.lng,
                    ...(v.country && !d?.country ? { country: v.country } : {}),
                    ...(v.region && !d?.region ? { region: v.region } : {}),
                    ...(v.name && !d?.name ? { name: v.name } : {}),
                  }))
                }
              />
              {errors.location && <span className="error">{errors.location}</span>}
            </div>
          </>
        )}
        {type === 'dream' && (
          <>
            <div className="field">
              <span className="label">Kind of dream</span>
              <Segmented label="Dream type" value={(str('type') || 'destination') as never} options={DREAM_TYPES.map((t) => ({ value: t, label: cap(t) }))} onChange={(v) => set('type', v)} />
            </div>
            {!fromDream && (
              <div className="field">
                <span className="label">Status</span>
                <Segmented label="Dream status" value={(str('status') || 'someday') as never} options={DREAM_STATUSES.map((t) => ({ value: t, label: cap(t) }))} onChange={(v) => set('status', v)} />
              </div>
            )}
            {(str('type') || 'destination') === 'destination' && (
              placeSelect('placeId', 'Where? (optional)')
            )}
          </>
        )}

        <PhotoField state={photos} onChange={setPhotos} />

        {/* ---------- optional details ---------- */}
        {!more ? (
          <button type="button" className="more-toggle" onClick={() => setMore(true)} aria-expanded={false}>
            + More details <span className="xs">(all optional)</span>
          </button>
        ) : (
          <>
            {type === 'adventure' && (
              <>
                <div className="field">
                  <span className="label">Places</span>
                  <div className="row wrap" style={{ gap: 8 }}>
                    {sortedPlaces.length === 0 && <span className="xs muted">No places yet — add one below.</span>}
                    {sortedPlaces.map((p) => {
                      const ids = (draft.placeIds as string[]) ?? []
                      const on = ids.includes(p.id)
                      return (
                        <button type="button" key={p.id} className="filter-chip" aria-pressed={on} onClick={() => set('placeIds', on ? ids.filter((i) => i !== p.id) : [...ids, p.id])}>
                          {p.name}
                        </button>
                      )
                    })}
                  </div>
                  <QuickPlace value={newPlace} onChange={setNewPlace} onAdd={quickAddPlace} status={newPlaceStatus} />
                </div>
                <Field label="The story" id="story">
                  <textarea id="story" className="textarea" value={str('story')} onChange={(e) => set('story', e.target.value)} placeholder="How did it feel? What surprised you?" />
                </Field>
                <Field label="What I’ll remember" id="highlight" hint="One line, a quote, a feeling.">
                  <input id="highlight" className="input" value={str('highlight')} onChange={(e) => set('highlight', e.target.value)} />
                </Field>
                <Field label="Who was there" id="companions">
                  <input id="companions" className="input" value={str('companions')} onChange={(e) => set('companions', e.target.value)} placeholder="Names, or ‘solo’" />
                </Field>
              </>
            )}
            {type === 'memory' && (
              <>
                <Field label="Time (optional)" id="time">
                  <input id="time" type="time" className="input" value={str('time')} onChange={(e) => set('time', e.target.value)} />
                </Field>
                <Field label="The story" id="story">
                  <textarea id="story" className="textarea" value={str('story')} onChange={(e) => set('story', e.target.value)} />
                </Field>
                {placeSelect('placeId')}
                <Field label="Part of an adventure" id="adventureId">
                  <select id="adventureId" className="select" value={str('adventureId')} onChange={(e) => set('adventureId', e.target.value || undefined)}>
                    <option value="">None</option>
                    {[...all.adventures]
                      .sort((a, b) => b.startDate.localeCompare(a.startDate))
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="People" id="people">
                  <input id="people" className="input" value={str('people')} onChange={(e) => set('people', e.target.value)} />
                </Field>
                <label className="toggle">
                  <input type="checkbox" checked={!!draft.favorite} onChange={(e) => set('favorite', e.target.checked)} />
                  <IconHeart filled={!!draft.favorite} style={{ width: 20, color: 'var(--coral)' }} /> Favourite
                </label>
              </>
            )}
            {type === 'place' && (
              <>
                <div className="field-row">
                  <Field label="Region / city" id="region">
                    <input id="region" className="input" value={str('region')} onChange={(e) => set('region', e.target.value)} />
                  </Field>
                  <Field label="Country" id="country">
                    <input id="country" className="input" value={str('country')} onChange={(e) => set('country', e.target.value)} />
                  </Field>
                </div>
                <Field label="Address" id="address">
                  <input id="address" className="input" value={str('address')} onChange={(e) => set('address', e.target.value)} />
                </Field>
                <div className="field-row">
                  <Field label="Category" id="category">
                    <select id="category" className="select" value={str('category')} onChange={(e) => set('category', e.target.value || undefined)}>
                      <option value="">—</option>
                      {PLACE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {cap(c)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {str('status') !== 'wishlist' && (
                    <Field label="First visited" error={errors.visitedOn} id="visitedOn">
                      <input id="visitedOn" type="date" className="input" value={str('visitedOn')} onChange={(e) => set('visitedOn', e.target.value)} />
                    </Field>
                  )}
                </div>
                <Field label="Notes" id="notes">
                  <textarea id="notes" className="textarea" value={str('notes')} onChange={(e) => set('notes', e.target.value)} />
                </Field>
              </>
            )}
            {type === 'milestone' && (
              <Field label="Description" id="description">
                <textarea id="description" className="textarea" value={str('description')} onChange={(e) => set('description', e.target.value)} />
              </Field>
            )}
            {type === 'dream' && (
              <>
                <Field label="Why it matters" id="why">
                  <textarea id="why" className="textarea" style={{ minHeight: 90 }} value={str('why')} onChange={(e) => set('why', e.target.value)} />
                </Field>
                {str('type') !== 'destination' && placeSelect('placeId', 'Where? (optional)')}
                <div className="field-row">
                  <Field label="Budget estimate" id="budget">
                    <input id="budget" className="input" value={str('budget')} onChange={(e) => set('budget', e.target.value)} placeholder="e.g. $2,000" />
                  </Field>
                  <Field label="With whom" id="companions">
                    <input id="companions" className="input" value={str('companions')} onChange={(e) => set('companions', e.target.value)} />
                  </Field>
                </div>
                <Field label="Inspiration links" id="links" hint="One link per line.">
                  <textarea id="links" className="textarea" style={{ minHeight: 80 }} value={str('linksText')} onChange={(e) => set('linksText', e.target.value)} inputMode="url" />
                </Field>
                <Field label="Notes & planning" id="notes">
                  <textarea id="notes" className="textarea" value={str('notes')} onChange={(e) => set('notes', e.target.value)} />
                </Field>
                {str('status') === 'completed' && (
                  <Field label="Completed on" error={errors.completedOn} id="completedOn">
                    <input id="completedOn" type="date" className="input" value={str('completedOn')} onChange={(e) => set('completedOn', e.target.value)} />
                  </Field>
                )}
              </>
            )}
            {type !== 'milestone' && (
              <Field label="Tags" id="tags" hint="Separate with commas.">
                <input id="tags" className="input" value={str('tagsText')} onChange={(e) => set('tagsText', e.target.value)} placeholder="e.g. road trip, family" />
              </Field>
            )}
          </>
        )}
        {errors.form && (
          <p className="note warn" role="alert">
            {errors.form}
          </p>
        )}
      </form>
      <Sheet
        open={!!askChapter}
        onClose={() => {
          const m = askChapter?.milestone
          setAskChapter(null)
          if (m) nav(`/milestone/${m.id}`, { replace: true })
        }}
        label="Open a new chapter?"
      >
        {askChapter && (
          <div className="stack">
            <h2>A new chapter?</h2>
            <p className="small muted">
              “{askChapter.milestone.title}” could open a new chapter of your life, from {askChapter.milestone.date ? new Date(askChapter.milestone.date + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : 'today'} forward.
              {askChapter.running && <> Right now you’re in “{askChapter.running.title}”.</>}
            </p>
            <button
              className="btn btn-primary btn-block"
              onClick={async () => {
                const { created, closed } = await openChapterAt(askChapter.milestone.id)
                setAskChapter(null)
                toast({ message: closed ? `New chapter opened. “${closed.title}” ends the day before.` : 'New chapter opened — give it a name.' })
                nav(`/edit/chapter/${created.id}`, { replace: true })
              }}
            >
              Open a new chapter
            </button>
            {askChapter.running && (
              <button
                className="btn btn-secondary btn-block"
                onClick={async () => {
                  await addToChapter(askChapter.running!.id, { type: 'milestone', id: askChapter.milestone.id })
                  const m = askChapter.milestone
                  setAskChapter(null)
                  toast({ message: `Added to “${askChapter.running!.title}”.` })
                  nav(`/milestone/${m.id}`, { replace: true })
                }}
              >
                Keep going in “{askChapter.running.title}”
              </button>
            )}
            <button
              className="btn btn-ghost btn-block"
              onClick={() => {
                const m = askChapter.milestone
                setAskChapter(null)
                toast({ message: 'Milestone added. The chapter suggestion waits in Archive → Chapters.' })
                nav(`/milestone/${m.id}`, { replace: true })
              }}
            >
              Decide later
            </button>
          </div>
        )}
      </Sheet>
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={() => nav(-1)}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </main>
  )
}

function QuickPlace({ value, onChange, onAdd, status }: { value: string; onChange: (v: string) => void; onAdd: (found?: GeoResult) => void; status: 'visited' | 'wishlist' }) {
  const [results, setResults] = useState<GeoResult[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function find() {
    const q = value.trim()
    if (!q) return
    setBusy(true)
    setErr('')
    try {
      setResults(await searchWorld(q))
    } catch {
      setResults(null)
      setErr('Search needs internet — you can still add it by name and pin it later.')
    } finally {
      setBusy(false)
    }
  }
  const done = (found?: GeoResult) => {
    onAdd(found)
    setResults(null)
    setErr('')
  }
  return (
    <div className="quick-place">
      <div className="row" style={{ gap: 8 }}>
        <input
          className="input"
          style={{ minHeight: 40 }}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setResults(null)
          }}
          placeholder={status === 'wishlist' ? 'Search a city, country or landmark…' : 'New place — search a city or country…'}
          aria-label="Find a new place"
          enterKeyHint="search"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              find()
            }
          }}
        />
        <button type="button" className="btn btn-sm btn-sea" onClick={find} disabled={!value.trim() || busy}>
          {busy ? '…' : 'Find'}
        </button>
      </div>
      {results && (
        <div className="search-results" style={{ boxShadow: 'none', border: '1px solid var(--line)', marginTop: 8 }}>
          {results.length === 0 && <div style={{ padding: 12 }} className="small muted">No matches.</div>}
          {results.map((r, i) => (
            <button type="button" key={i} onClick={() => done(r)}>
              <b>{r.name}</b>
              <div className="xs muted">{r.detail}</div>
            </button>
          ))}
          <button type="button" onClick={() => done()}>
            <span className="small">
              Add “{value.trim()}” without a pin
            </span>
          </button>
        </div>
      )}
      {err && (
        <div className="row" style={{ marginTop: 6 }}>
          <span className="xs muted spacer">{err}</span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => done()}>
            Add by name
          </button>
        </div>
      )}
      <span className="xs muted" style={{ display: 'block', marginTop: 4 }}>
        New places are saved as {status === 'wishlist' ? 'wishlist (sea glass on the map)' : 'visited (coral on the map)'}.
      </span>
    </div>
  )
}
