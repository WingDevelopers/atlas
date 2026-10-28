import { beforeEach, describe, expect, it } from 'vitest'
import { AtlasDB } from './db'
import { addToChapter, chapterOn, createChapter, createEntry, deleteChapter, deleteEntry, openChapterAt, restoreChapter, restoreSnapshot, updateChapter, ValidationError } from './repo'
import { addPhotos, removePhoto } from './media'
import { exportBackup, importBackup } from './backup'
import { chapterEntries, chapterSpan, chaptersContaining, resolveItems, sortItemsByDate, suggestChapters } from '../lib/chapters'
import type { AllData } from '../lib/queries'

let db: AtlasDB
let n = 0
const fakeThumb = async () => ({ data: new Uint8Array([1]).buffer, width: 1, height: 1 })
const photo = () => new File([new Uint8Array([7, 7])], 'p.jpg', { type: 'image/jpeg' })
const all = async (): Promise<AllData> => ({
  places: await db.places.toArray(),
  adventures: await db.adventures.toArray(),
  memories: await db.memories.toArray(),
  milestones: await db.milestones.toArray(),
  dreams: await db.dreams.toArray(),
  chapters: await db.chapters.toArray(),
})

beforeEach(async () => {
  db = new AtlasDB(`ch-${n++}`)
  await db.open()
})

describe('chapters', () => {
  it('creates, reorders and edits a chapter; entries are never touched', async () => {
    const a = await createEntry('adventure', { title: 'Lisbon', startDate: '2025-05-01' }, db)
    const m = await createEntry('memory', { title: 'First swim', date: '2025-04-01' }, db)
    const c = await createChapter({ title: '  The Lisbon Years ', items: [{ type: 'adventure', id: a.id }, { type: 'memory', id: m.id }, { type: 'memory', id: m.id }] }, db)
    expect(c.title).toBe('The Lisbon Years')
    expect(c.items).toHaveLength(2) // duplicates removed
    const sorted = sortItemsByDate(c.items, await all())
    expect(sorted.map((i) => i.id)).toEqual([m.id, a.id])
    const u = await updateChapter(c.id, { items: sorted, description: 'Sun and tiles.' }, db)
    expect(u.items[0].id).toBe(m.id)
    expect(chapterSpan(u, await all())).toEqual({ start: '2025-04-01', end: '2025-05-01' })
    await expect(createChapter({ title: ' ' }, db)).rejects.toBeInstanceOf(ValidationError)
    await expect(createChapter({ title: 'x', startDate: '2025-02-01', endDate: '2025-01-01' }, db)).rejects.toThrow(/before the start/)
  })

  it('deleting a chapter keeps its entries, and undo brings it back', async () => {
    const m = await createEntry('memory', { title: 'Keep me' }, db)
    const c = await createChapter({ title: 'Ch', items: [{ type: 'memory', id: m.id }] }, db)
    const gone = await deleteChapter(c.id, db)
    expect(await db.chapters.count()).toBe(0)
    expect(await db.memories.count()).toBe(1)
    await restoreChapter(gone!, db)
    expect((await db.chapters.get(c.id))!.items).toHaveLength(1)
  })

  it('deleting an entry removes it from chapters (and its photo as cover); undo restores both', async () => {
    const a = await createEntry('adventure', { title: 'Trip', startDate: '2025-01-01' }, db)
    const [p] = await addPhotos('adventure', a.id, [photo()], { db, makeThumb: fakeThumb })
    const c = await createChapter({ title: 'Ch', coverId: p.id, items: [{ type: 'adventure', id: a.id }] }, db)
    const snap = await deleteEntry('adventure', a.id, db)
    let ch = (await db.chapters.get(c.id))!
    expect(ch.items).toEqual([])
    expect(ch.coverId).toBeUndefined()
    await restoreSnapshot(snap!, db)
    ch = (await db.chapters.get(c.id))!
    expect(ch.items).toHaveLength(1)
    expect(ch.coverId).toBe(p.id)
  })

  it('removing the cover photo clears the chapter cover', async () => {
    const a = await createEntry('adventure', { title: 'Trip', startDate: '2025-01-01' }, db)
    const [p] = await addPhotos('adventure', a.id, [photo()], { db, makeThumb: fakeThumb })
    const c = await createChapter({ title: 'Ch', coverId: p.id, items: [{ type: 'adventure', id: a.id }] }, db)
    await removePhoto(p.id, db)
    expect((await db.chapters.get(c.id))!.coverId).toBeUndefined()
  })

  it('suggests chapters between milestones, skipping used and dismissed ones', async () => {
    const m1 = await createEntry('milestone', { title: 'Moved to Lisbon', date: '2024-01-10' }, db)
    const m2 = await createEntry('milestone', { title: 'New job', date: '2025-03-01' }, db)
    const m3 = await createEntry('milestone', { title: 'Lonely milestone', date: '2026-09-01' }, db) // latest → open-ended suggestion
    const a = await createEntry('adventure', { title: 'Sintra', startDate: '2024-06-01' }, db)
    const mem = await createEntry('memory', { title: 'Office day one', date: '2025-03-01' }, db)
    await createEntry('memory', { title: 'Undated' }, db)
    let s = suggestChapters(await all())
    expect(s.map((x) => x.title)).toEqual(['Lonely milestone', 'New job', 'Moved to Lisbon'])
    expect(s[0]).toMatchObject({ startDate: '2026-09-01', endDate: undefined })
    const lisbon = s.find((x) => x.key === m1.id)!
    expect(lisbon).toMatchObject({ startDate: '2024-01-10', endDate: '2025-02-28' })
    expect(lisbon.items.map((i) => i.id)).toEqual([m1.id, a.id])
    expect(s.find((x) => x.key === m2.id)!.items.map((i) => i.id)).toEqual([m2.id, mem.id])

    await createChapter({ title: 'The Lisbon Years', suggestedFrom: m1.id, items: lisbon.items }, db)
    s = suggestChapters(await all(), [m2.id, m3.id])
    expect(s).toEqual([])
    expect(resolveItems(lisbon.items, await all()).map((e) => e.rec.title)).toEqual(['Moved to Lisbon', 'Sintra'])
  })

  it('chapters survive a backup round-trip', async () => {
    const m = await createEntry('memory', { title: 'x', date: '2025-01-01' }, db)
    await createChapter({ title: 'Ch', description: 'd', items: [{ type: 'memory', id: m.id }] }, db)
    const { blob } = await exportBackup(db)
    const fresh = new AtlasDB(`chr-${n++}`)
    await importBackup(blob, 'replace', fresh)
    expect(await fresh.chapters.toArray()).toEqual(await db.chapters.toArray())
  })

  it('a milestone opens a chapter from that day forward; the running chapter closes the day before', async () => {
    const lisbon = await createEntry('milestone', { title: 'Moved to Lisbon', date: '2024-01-10' }, db)
    const first = (await openChapterAt(lisbon.id, { title: 'The Lisbon Years' }, db)).created
    expect(first).toMatchObject({ startDate: '2024-01-10', endDate: undefined, autoInclude: true })

    // entries added later with dates inside the chapter join it automatically
    const trip = await createEntry('adventure', { title: 'Sintra', startDate: '2024-06-01' }, db)
    let d = await all()
    expect(chapterEntries(first, d).map((e) => e.rec.title)).toEqual(['Moved to Lisbon', 'Sintra'])
    expect(chaptersContaining('adventure', trip.id, d).map((c) => c.title)).toEqual(['The Lisbon Years'])

    // a new milestone opens the next chapter and closes the previous one
    const job = await createEntry('milestone', { title: 'New job in Porto', date: '2025-03-01' }, db)
    expect((await chapterOn('2025-03-01', db))!.id).toBe(first.id) // before opening, Lisbon is running
    const { created, closed } = await openChapterAt(job.id, {}, db)
    expect(closed!.endDate).toBe('2025-02-28')
    expect(created).toMatchObject({ title: 'New job in Porto', startDate: '2025-03-01', endDate: undefined })
    const later = await createEntry('memory', { title: 'Ribeira at dusk', date: '2025-05-05' }, db)
    d = await all()
    const lisbonNow = d.chapters.find((c) => c.id === first.id)!
    expect(chapterEntries(lisbonNow, d).some((e) => e.rec.id === later.id)).toBe(false)
    expect(chapterEntries(created, d).map((e) => e.rec.title)).toEqual(['New job in Porto', 'Ribeira at dusk'])

    // back-filling an older milestone slots a chapter in between and ends it before the next one
    const uni = await createEntry('milestone', { title: 'Started university', date: '2020-09-01' }, db)
    const past = (await openChapterAt(uni.id, {}, db)).created
    expect(past.endDate).toBe('2024-01-09')
  })

  it('keep going: a milestone can join the running chapter; exclusions stick', async () => {
    const m = await createEntry('milestone', { title: 'Moved', date: '2024-01-01' }, db)
    const c = (await openChapterAt(m.id, {}, db)).created
    const small = await createEntry('milestone', { title: 'Got a dog', date: '2024-05-01' }, db)
    await addToChapter(c.id, { type: 'milestone', id: small.id }, db)
    const mem = await createEntry('memory', { title: 'Not this one', date: '2024-06-01' }, db)
    await updateChapter(c.id, { excluded: [{ type: 'memory', id: mem.id }] }, db)
    const d = await all()
    const titles = chapterEntries(d.chapters[0], d).map((e) => e.rec.title)
    expect(titles).toEqual(['Moved', 'Got a dog'])
    expect(suggestChapters(d).map((x) => x.title)).toEqual([]) // both milestones are decided
  })
})
