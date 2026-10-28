import type { Table } from 'dexie'
import { getDb, type AtlasDB } from './db'
import type {
  Adventure,
  Chapter,
  ChapterItem,
  Dream,
  EntryMap,
  EntryType,
  Media,
  Memory,
  Milestone,
  Place,
} from './types'

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export const nowIso = () => new Date().toISOString()

export function tableFor<T extends EntryType>(type: T, db: AtlasDB = getDb()): Table<EntryMap[T], string> {
  const map = {
    place: db.places,
    adventure: db.adventures,
    memory: db.memories,
    milestone: db.milestones,
    dream: db.dreams,
  }
  return map[type] as unknown as Table<EntryMap[T], string>
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export class ValidationError extends Error {
  field: string
  constructor(field: string, message: string) {
    super(message)
    this.field = field
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const isValidDate = (d: string) => DATE_RE.test(d) && !Number.isNaN(Date.parse(d + 'T00:00:00Z'))

function requireText(field: string, value: unknown, label = 'This') {
  if (typeof value !== 'string' || !value.trim()) throw new ValidationError(field, `${label} needs a name.`)
  if (value.length > 200) throw new ValidationError(field, 'Please keep it under 200 characters.')
}

function optDate(field: string, value: unknown) {
  if (value === undefined || value === '' || value === null) return
  if (typeof value !== 'string' || !isValidDate(value)) throw new ValidationError(field, 'Please use a valid date.')
}

export function validate<T extends EntryType>(type: T, r: Partial<EntryMap[T]>) {
  const rec = r as Record<string, unknown>
  switch (type) {
    case 'place': {
      requireText('name', rec.name, 'This place')
      const { lat, lng } = rec as { lat?: number; lng?: number }
      if ((lat === undefined) !== (lng === undefined)) throw new ValidationError('location', 'A location needs both latitude and longitude.')
      if (lat !== undefined && (!Number.isFinite(lat) || lat < -90 || lat > 90)) throw new ValidationError('location', 'Latitude must be between -90 and 90.')
      if (lng !== undefined && (!Number.isFinite(lng) || lng < -180 || lng > 180)) throw new ValidationError('location', 'Longitude must be between -180 and 180.')
      optDate('visitedOn', rec.visitedOn)
      break
    }
    case 'adventure': {
      requireText('title', rec.title, 'This adventure')
      if (!rec.startDate || !isValidDate(String(rec.startDate))) throw new ValidationError('startDate', 'When did it start?')
      optDate('endDate', rec.endDate)
      if (rec.endDate && String(rec.endDate) < String(rec.startDate)) throw new ValidationError('endDate', 'The end date is before the start.')
      break
    }
    case 'memory':
      requireText('title', rec.title, 'This memory')
      optDate('date', rec.date)
      break
    case 'milestone':
      requireText('title', rec.title, 'This milestone')
      if (!rec.date || !isValidDate(String(rec.date))) throw new ValidationError('date', 'A milestone needs a date.')
      break
    case 'dream':
      requireText('title', rec.title, 'This dream')
      optDate('completedOn', rec.completedOn)
      break
  }
}

/* ------------------------------------------------------------------ */
/* Defaults                                                            */
/* ------------------------------------------------------------------ */

const defaults: { [K in EntryType]: () => Omit<EntryMap[K], 'id' | 'createdAt' | 'updatedAt'> } = {
  place: () => ({ name: '', status: 'visited', tags: [], notes: '', photoIds: [] }) as Omit<Place, 'id' | 'createdAt' | 'updatedAt'>,
  adventure: () => ({ title: '', startDate: '', placeIds: [], story: '', companions: '', tags: [], highlight: '', photoIds: [] }),
  memory: () => ({ title: '', story: '', people: '', tags: [], favorite: false, photoIds: [] }),
  milestone: () => ({ title: '', date: '', description: '', photoIds: [] }),
  dream: () => ({ title: '', type: 'destination', status: 'someday', why: '', notes: '', inspirationLinks: [], companions: '', photoIds: [] }),
}

/** Remove empty-string optional values so records stay tidy. */
function clean<T extends object>(obj: T): T {
  const out = { ...obj } as Record<string, unknown>
  for (const k of Object.keys(out)) if (out[k] === '' && !REQUIRED_STRINGS.has(k)) delete out[k]
  return out as T
}
const REQUIRED_STRINGS = new Set(['name', 'title', 'notes', 'story', 'companions', 'highlight', 'people', 'description', 'why', 'startDate'])

/* ------------------------------------------------------------------ */
/* CRUD                                                                */
/* ------------------------------------------------------------------ */

export async function createEntry<T extends EntryType>(
  type: T,
  data: Partial<EntryMap[T]>,
  db: AtlasDB = getDb(),
): Promise<EntryMap[T]> {
  const ts = nowIso()
  const rec = clean({ ...defaults[type](), ...data, id: data.id ?? newId(), createdAt: ts, updatedAt: ts }) as EntryMap[T]
  if (typeof (rec as { title?: string }).title === 'string') (rec as { title: string }).title = (rec as { title: string }).title.trim()
  if (typeof (rec as { name?: string }).name === 'string') (rec as { name: string }).name = (rec as { name: string }).name.trim()
  validate(type, rec)
  await tableFor(type, db).add(rec)
  return rec
}

export async function updateEntry<T extends EntryType>(
  type: T,
  id: string,
  patch: Partial<EntryMap[T]>,
  db: AtlasDB = getDb(),
): Promise<EntryMap[T]> {
  const table = tableFor(type, db)
  const existing = await table.get(id)
  if (!existing) throw new Error('That entry no longer exists.')
  const merged = { ...existing, ...patch, id, createdAt: existing.createdAt, updatedAt: nowIso() } as Record<string, unknown>
  // explicit `undefined` / '' in a patch means "clear this field"
  for (const [k, v] of Object.entries(patch)) if ((v === undefined || v === '') && !REQUIRED_STRINGS.has(k)) delete merged[k]
  const rec = merged as unknown as EntryMap[T]
  validate(type, rec)
  await table.put(rec)
  return rec
}

export async function getEntry<T extends EntryType>(type: T, id: string, db: AtlasDB = getDb()) {
  return tableFor(type, db).get(id)
}

/* ------------------------------------------------------------------ */
/* Safe deletion with undo                                             */
/* ------------------------------------------------------------------ */

export interface UndoSnapshot {
  deleted: { type: EntryType; record: EntryMap[EntryType] }
  media: Media[]
  /** Previous versions of records whose links were cleaned up. */
  touched: {
    places: Place[]
    adventures: Adventure[]
    memories: Memory[]
    milestones: Milestone[]
    dreams: Dream[]
    chapters: Chapter[]
  }
}

/**
 * Delete an entry, its own photos, and any links pointing at it.
 * Related entries are never deleted — only unlinked.
 * Returns a snapshot that `restoreSnapshot` can use to undo.
 */
export async function deleteEntry(type: EntryType, id: string, db: AtlasDB = getDb()): Promise<UndoSnapshot | null> {
  return db.transaction('rw', [db.places, db.adventures, db.memories, db.milestones, db.dreams, db.chapters, db.media], async () => {
    const record = await tableFor(type, db).get(id)
    if (!record) return null
    const media = await db.media.where('[ownerType+ownerId]').equals([type, id]).toArray()
    const touched: UndoSnapshot['touched'] = { places: [], adventures: [], memories: [], milestones: [], dreams: [], chapters: [] }
    const ts = nowIso()

    if (type === 'place') {
      const advs = await db.adventures.where('placeIds').equals(id).toArray()
      for (const a of advs) {
        touched.adventures.push(a)
        await db.adventures.put({ ...a, placeIds: a.placeIds.filter((p) => p !== id), updatedAt: ts })
      }
      const mems = await db.memories.where('placeId').equals(id).toArray()
      for (const m of mems) {
        touched.memories.push(m)
        const { placeId: _p, ...rest } = m
        await db.memories.put({ ...rest, updatedAt: ts })
      }
      const drs = await db.dreams.where('placeId').equals(id).toArray()
      for (const d of drs) {
        touched.dreams.push(d)
        const { placeId: _p, ...rest } = d
        await db.dreams.put({ ...rest, updatedAt: ts })
      }
    }
    if (type === 'adventure') {
      const mems = await db.memories.where('adventureId').equals(id).toArray()
      for (const m of mems) {
        touched.memories.push(m)
        const { adventureId: _a, ...rest } = m
        await db.memories.put({ ...rest, updatedAt: ts })
      }
      const drs = await db.dreams.filter((d) => d.linkedAdventureId === id).toArray()
      for (const d of drs) {
        touched.dreams.push(d)
        const { linkedAdventureId: _l, ...rest } = d
        await db.dreams.put({ ...rest, updatedAt: ts })
      }
    }
    if (type === 'memory') {
      const drs = await db.dreams.filter((d) => d.linkedMemoryId === id).toArray()
      for (const d of drs) {
        touched.dreams.push(d)
        const { linkedMemoryId: _l, ...rest } = d
        await db.dreams.put({ ...rest, updatedAt: ts })
      }
    }
    if (type === 'dream') {
      const advs = await db.adventures.where('fromDreamId').equals(id).toArray()
      for (const a of advs) {
        touched.adventures.push(a)
        const { fromDreamId: _f, ...rest } = a
        await db.adventures.put({ ...rest, updatedAt: ts })
      }
      const mems = await db.memories.filter((m) => m.fromDreamId === id).toArray()
      for (const m of mems) {
        touched.memories.push(m)
        const { fromDreamId: _f, ...rest } = m
        await db.memories.put({ ...rest, updatedAt: ts })
      }
    }
    if (type === 'adventure' || type === 'memory' || type === 'milestone') {
      const chs = await db.chapters.filter((c) => c.items.some((i) => i.type === type && i.id === id)).toArray()
      for (const c of chs) {
        touched.chapters.push(c)
        await db.chapters.put({ ...c, items: c.items.filter((i) => !(i.type === type && i.id === id)), updatedAt: ts })
      }
    }

    // chapters whose cover was one of the photos being deleted lose that cover
    if (media.length) {
      const ids = new Set(media.map((m) => m.id))
      const covered = await db.chapters.filter((c) => !!c.coverId && ids.has(c.coverId)).toArray()
      for (const c of covered) {
        if (!touched.chapters.some((t) => t.id === c.id)) touched.chapters.push(c)
        const current = (await db.chapters.get(c.id))!
        const { coverId: _c, ...rest } = current
        await db.chapters.put({ ...rest, updatedAt: ts })
      }
    }
    await db.media.bulkDelete(media.map((m) => m.id))
    await tableFor(type, db).delete(id)
    return { deleted: { type, record }, media, touched }
  })
}

export async function restoreSnapshot(snap: UndoSnapshot, db: AtlasDB = getDb()) {
  await db.transaction('rw', [db.places, db.adventures, db.memories, db.milestones, db.dreams, db.chapters, db.media], async () => {
    await tableFor(snap.deleted.type, db).put(snap.deleted.record as never)
    await db.media.bulkPut(snap.media)
    await db.places.bulkPut(snap.touched.places)
    await db.adventures.bulkPut(snap.touched.adventures)
    await db.memories.bulkPut(snap.touched.memories)
    await db.milestones.bulkPut(snap.touched.milestones)
    await db.dreams.bulkPut(snap.touched.dreams)
    await db.chapters.bulkPut(snap.touched.chapters)
  })
}

/* ------------------------------------------------------------------ */
/* Dreams → adventures / memories                                     */
/* ------------------------------------------------------------------ */

export const todayIso = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * Mark a dream complete. Optionally create a linked adventure or memory.
 * The original dream is always kept; both records point at each other.
 */
export async function completeDream(
  dreamId: string,
  opts:
    | { as: 'none'; completedOn?: string }
    | { as: 'adventure'; data: Partial<Adventure>; completedOn?: string }
    | { as: 'memory'; data: Partial<Memory>; completedOn?: string },
  db: AtlasDB = getDb(),
) {
  return db.transaction('rw', [db.dreams, db.adventures, db.memories, db.places], async () => {
    const dream = await db.dreams.get(dreamId)
    if (!dream) throw new Error('That dream no longer exists.')
    const completedOn = opts.completedOn ?? todayIso()
    // You went! The dream's place moves from wishlist to visited.
    if (dream.placeId) {
      const place = await db.places.get(dream.placeId)
      if (place && place.status === 'wishlist') await updateEntry('place', place.id, { status: 'visited', visitedOn: place.visitedOn ?? completedOn }, db)
    }
    const patch: Partial<Dream> = { status: 'completed', completedOn }
    let created: Adventure | Memory | undefined
    if (opts.as === 'adventure') {
      created = await createEntry(
        'adventure',
        { title: dream.title, startDate: completedOn, placeIds: dream.placeId ? [dream.placeId] : [], companions: dream.companions, ...opts.data, fromDreamId: dream.id },
        db,
      )
      patch.linkedAdventureId = created.id
    } else if (opts.as === 'memory') {
      created = await createEntry('memory', { title: dream.title, date: completedOn, placeId: dream.placeId, ...opts.data, fromDreamId: dream.id }, db)
      patch.linkedMemoryId = created.id
    }
    const updated = await updateEntry('dream', dreamId, patch, db)
    return { dream: updated, created }
  })
}

/* ------------------------------------------------------------------ */
/* Bulk                                                                */
/* ------------------------------------------------------------------ */

export async function wipeAll(db: AtlasDB = getDb()) {
  await db.transaction('rw', [db.places, db.adventures, db.memories, db.milestones, db.dreams, db.chapters, db.media], async () => {
    await Promise.all([db.places.clear(), db.adventures.clear(), db.memories.clear(), db.milestones.clear(), db.dreams.clear(), db.chapters.clear(), db.media.clear()])
  })
}

/* ------------------------------------------------------------------ */
/* Chapters                                                            */
/* ------------------------------------------------------------------ */

export function validateChapter(c: Partial<Chapter>) {
  requireText('title', c.title, 'This chapter')
  optDate('startDate', c.startDate)
  optDate('endDate', c.endDate)
  if (c.startDate && c.endDate && c.endDate < c.startDate) throw new ValidationError('endDate', 'The end date is before the start.')
  for (const i of c.items ?? []) if (!['adventure', 'memory', 'milestone'].includes(i.type) || typeof i.id !== 'string') throw new ValidationError('items', 'One of the entries isn’t valid.')
}

export async function createChapter(data: Partial<Chapter>, db: AtlasDB = getDb()): Promise<Chapter> {
  const ts = nowIso()
  const rec = clean({ title: '', description: '', items: [], ...data, id: data.id ?? newId(), createdAt: ts, updatedAt: ts }) as Chapter
  rec.title = rec.title.trim()
  rec.items = dedupeItems(rec.items)
  validateChapter(rec)
  await db.chapters.add(rec)
  return rec
}

export async function updateChapter(id: string, patch: Partial<Chapter>, db: AtlasDB = getDb()): Promise<Chapter> {
  const existing = await db.chapters.get(id)
  if (!existing) throw new Error('That chapter no longer exists.')
  const merged = { ...existing, ...patch, id, createdAt: existing.createdAt, updatedAt: nowIso() } as Record<string, unknown>
  for (const [k, v] of Object.entries(patch)) if ((v === undefined || v === '') && !REQUIRED_STRINGS.has(k)) delete merged[k]
  const rec = merged as unknown as Chapter
  if (typeof rec.title === 'string') rec.title = rec.title.trim()
  rec.items = dedupeItems(rec.items ?? [])
  validateChapter(rec)
  await db.chapters.put(rec)
  return rec
}

/** Deleting a chapter never deletes its entries. Returns the chapter for undo. */
export async function deleteChapter(id: string, db: AtlasDB = getDb()): Promise<Chapter | undefined> {
  const c = await db.chapters.get(id)
  if (c) await db.chapters.delete(id)
  return c
}

export async function restoreChapter(c: Chapter, db: AtlasDB = getDb()) {
  await db.chapters.put(c)
}

function dedupeItems(items: Chapter['items']) {
  const seen = new Set<string>()
  return items.filter((i) => {
    const k = i.type + ':' + i.id
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

const dayBeforeIso = (iso: string) => {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** The chapter whose date range contains `date` (latest start wins), if any. */
export async function chapterOn(date: string, db: AtlasDB = getDb(), exceptId?: string): Promise<Chapter | undefined> {
  const all = await db.chapters.toArray()
  return all
    .filter((c) => c.id !== exceptId && c.startDate && c.startDate <= date && (!c.endDate || c.endDate >= date))
    .sort((a, b) => b.startDate!.localeCompare(a.startDate!))[0]
}

/**
 * Open a new chapter at a milestone: it runs from the milestone's date forward
 * (until the next chapter that starts later, or ongoing), gathers entries in
 * that range automatically, and the chapter that was running closes the day before.
 */
export async function openChapterAt(milestoneId: string, overrides: Partial<Chapter> = {}, db: AtlasDB = getDb()) {
  return db.transaction('rw', [db.chapters, db.milestones], async () => {
    const m = await db.milestones.get(milestoneId)
    if (!m) throw new Error('That milestone no longer exists.')
    const all = await db.chapters.toArray()
    const next = all
      .filter((c) => c.startDate && c.startDate > m.date)
      .sort((a, b) => a.startDate!.localeCompare(b.startDate!))[0]
    const running = await chapterOn(m.date, db)
    let closed: Chapter | undefined
    if (running && running.startDate! < m.date) {
      closed = await updateChapter(running.id, { endDate: dayBeforeIso(m.date) }, db)
    }
    const created = await createChapter(
      {
        title: m.title,
        description: '',
        startDate: m.date,
        endDate: next ? dayBeforeIso(next.startDate!) : undefined,
        items: [{ type: 'milestone', id: m.id }],
        suggestedFrom: m.id,
        autoInclude: true,
        ...overrides,
      },
      db,
    )
    return { created, closed, previous: running }
  })
}

/** Keep going: add a milestone to the chapter that's running on its date. */
export async function addToChapter(chapterId: string, item: ChapterItem, db: AtlasDB = getDb()) {
  const c = await db.chapters.get(chapterId)
  if (!c) throw new Error('That chapter no longer exists.')
  return updateChapter(
    chapterId,
    { items: [...c.items, item], excluded: (c.excluded ?? []).filter((x) => !(x.type === item.type && x.id === item.id)) },
    db,
  )
}
