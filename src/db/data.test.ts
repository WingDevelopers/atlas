import { beforeEach, describe, expect, it } from 'vitest'
import { AtlasDB } from './db'
import { completeDream, createEntry, deleteEntry, restoreSnapshot, updateEntry, ValidationError } from './repo'
import { addPhotos, findOrphanMedia, readExifDate, removePhoto } from './media'
import { exportBackup, importBackup, readBackup, BackupError } from './backup'
import JSZip from 'jszip'

let db: AtlasDB
let n = 0
const fakeThumb = async () => ({ data: new Uint8Array([9, 9, 9]).buffer, width: 10, height: 5 })
const photo = (bytes: number[], name = 'p.jpg') => new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' })

beforeEach(async () => {
  db = new AtlasDB(`test-${n++}`)
  await db.open()
})

describe('entries', () => {
  it('creates every entry type with only the minimum fields', async () => {
    const p = await createEntry('place', { name: 'Lisbon' }, db)
    const a = await createEntry('adventure', { title: 'Weekend away', startDate: '2026-05-01' }, db)
    const m = await createEntry('memory', { title: 'First swim' }, db)
    const ms = await createEntry('milestone', { title: 'New job', date: '2026-02-01' }, db)
    const d = await createEntry('dream', { title: 'Learn to surf', type: 'skill' }, db)
    expect(p.status).toBe('visited')
    expect(d.status).toBe('someday')
    expect(await db.places.count()).toBe(1)
    expect([a, m, ms].every((r) => r.id && r.createdAt)).toBe(true)
  })

  it('rejects invalid input with a friendly message', async () => {
    await expect(createEntry('place', { name: '  ' }, db)).rejects.toBeInstanceOf(ValidationError)
    await expect(createEntry('adventure', { title: 'x', startDate: '2026-05-02', endDate: '2026-05-01' }, db)).rejects.toThrow(/before the start/)
    await expect(createEntry('place', { name: 'x', lat: 95, lng: 0 }, db)).rejects.toThrow(/Latitude/)
    await expect(createEntry('milestone', { title: 'x' }, db)).rejects.toThrow(/date/)
  })

  it('updates and clears optional fields', async () => {
    const p = await createEntry('place', { name: 'Kyoto', lat: 35, lng: 135, country: 'Japan' }, db)
    const u = await updateEntry('place', p.id, { status: 'wishlist', country: '' }, db)
    expect(u.status).toBe('wishlist')
    expect(u.country).toBeUndefined()
    expect(u.createdAt).toBe(p.createdAt)
  })
})

describe('safe delete', () => {
  it('unlinks (never deletes) related entries, and undo restores everything', async () => {
    const p = await createEntry('place', { name: 'Oaxaca' }, db)
    const a = await createEntry('adventure', { title: 'Mexico', startDate: '2025-01-01', placeIds: [p.id] }, db)
    const m = await createEntry('memory', { title: 'Mole night', placeId: p.id, adventureId: a.id }, db)
    await addPhotos('place', p.id, [photo([1, 2, 3])], { db, makeThumb: fakeThumb })

    const snap = await deleteEntry('place', p.id, db)
    expect(await db.places.get(p.id)).toBeUndefined()
    expect(await db.media.count()).toBe(0)
    expect((await db.adventures.get(a.id))!.placeIds).toEqual([])
    expect((await db.memories.get(m.id))!.placeId).toBeUndefined()

    await restoreSnapshot(snap!, db)
    expect((await db.places.get(p.id))!.name).toBe('Oaxaca')
    expect(await db.media.count()).toBe(1)
    expect((await db.adventures.get(a.id))!.placeIds).toEqual([p.id])
    expect((await db.memories.get(m.id))!.placeId).toBe(p.id)
  })
})

describe('photos', () => {
  it('attaches, sets cover, and removes a photo without touching other entries', async () => {
    const a = await createEntry('adventure', { title: 'Trip', startDate: '2025-03-01' }, db)
    const b = await createEntry('adventure', { title: 'Other', startDate: '2025-04-01' }, db)
    const [m1, m2] = await addPhotos('adventure', a.id, [photo([1]), photo([2])], { db, makeThumb: fakeThumb })
    await addPhotos('adventure', b.id, [photo([3])], { db, makeThumb: fakeThumb })
    let rec = (await db.adventures.get(a.id))!
    expect(rec.photoIds).toEqual([m1.id, m2.id])
    expect(rec.coverId).toBe(m1.id)

    await removePhoto(m1.id, db)
    rec = (await db.adventures.get(a.id))!
    expect(rec.photoIds).toEqual([m2.id])
    expect(rec.coverId).toBe(m2.id)
    expect((await db.adventures.get(b.id))!.photoIds).toHaveLength(1)
    expect(await db.media.count()).toBe(2)
    expect(await findOrphanMedia(db)).toEqual([])
  })

  it('reads the capture date from JPEG EXIF', () => {
    // Build a tiny JPEG with an EXIF IFD0 DateTime tag (big-endian)
    const date = '2024:07:14 18:30:05\0'
    const tiff: number[] = [0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x32, 0, 2, 0, 0, 0, 20, 0, 0, 0, 26, 0, 0, 0, 0]
    for (const c of date) tiff.push(c.charCodeAt(0))
    const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]
    const len = app1.length + 2
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 255, ...app1, 0xff, 0xd9])
    expect(readExifDate(jpeg.buffer)).toBe('2024-07-14T18:30:05')
    expect(readExifDate(new Uint8Array([1, 2, 3, 4]).buffer)).toBeUndefined()
  })
})

describe('dreams', () => {
  it('creates a dream without a location and completes it into a linked adventure', async () => {
    const d = await createEntry('dream', { title: 'See the northern lights', type: 'experience' }, db)
    expect(d.placeId).toBeUndefined()
    const { dream, created } = await completeDream(d.id, { as: 'adventure', data: { story: 'Green skies.' }, completedOn: '2026-01-10' }, db)
    expect(dream.status).toBe('completed')
    expect(dream.linkedAdventureId).toBe(created!.id)
    expect((created as { fromDreamId?: string }).fromDreamId).toBe(d.id)
    expect(await db.dreams.count()).toBe(1) // dream preserved

    // deleting the adventure keeps the dream, just unlinks it
    await deleteEntry('adventure', created!.id, db)
    const after = (await db.dreams.get(d.id))!
    expect(after.status).toBe('completed')
    expect(after.linkedAdventureId).toBeUndefined()
  })

  it('a dream with a wishlist place: completing it marks the place visited', async () => {
    const kyoto = await createEntry('place', { name: 'Kyoto', lat: 35.01, lng: 135.77, status: 'wishlist' }, db)
    const d = await createEntry('dream', { title: 'Cherry blossoms', placeId: kyoto.id }, db)
    expect((await db.places.get(kyoto.id))!.status).toBe('wishlist')
    await completeDream(d.id, { as: 'adventure', data: {}, completedOn: '2027-04-02' }, db)
    const after = (await db.places.get(kyoto.id))!
    expect(after.status).toBe('visited')
    expect(after.visitedOn).toBe('2027-04-02')
  })

  it('completes into a memory', async () => {
    const d = await createEntry('dream', { title: 'Swim in a cenote' }, db)
    const { dream, created } = await completeDream(d.id, { as: 'memory', data: {} }, db)
    expect(dream.linkedMemoryId).toBe(created!.id)
  })
})

describe('backup', () => {
  async function seed() {
    const p = await createEntry('place', { name: 'Cusco', lat: -13.5, lng: -71.9, status: 'visited' }, db)
    const a = await createEntry('adventure', { title: 'Andes', startDate: '2024-06-01', placeIds: [p.id], story: 'Thin air, big views.' }, db)
    await createEntry('memory', { title: 'Sunrise', adventureId: a.id, favorite: true }, db)
    await createEntry('milestone', { title: 'Turned 30', date: '2024-03-03' }, db)
    await createEntry('dream', { title: 'Patagonia', status: 'planning' }, db)
    await addPhotos('adventure', a.id, [photo([10, 20, 30, 40]), photo([50, 60])], { db, makeThumb: fakeThumb })
  }
  const snapshot = async (d: AtlasDB) => ({
    places: await d.places.toArray(),
    adventures: await d.adventures.toArray(),
    memories: await d.memories.toArray(),
    milestones: await d.milestones.toArray(),
    dreams: await d.dreams.toArray(),
    media: (await d.media.toArray()).map((m) => ({ ...m, data: Array.from(new Uint8Array(m.data)), thumb: m.thumb && Array.from(new Uint8Array(m.thumb)) })),
  })

  it('round-trips every record and photo byte-for-byte into an empty database', async () => {
    await seed()
    const { blob, manifest } = await exportBackup(db)
    expect(manifest.counts.media).toBe(2)
    const fresh = new AtlasDB(`restore-${n++}`)
    const summary = await importBackup(blob, 'replace', fresh)
    expect(summary.photos).toBe(2)
    expect(await snapshot(fresh)).toEqual(await snapshot(db))
  })

  it('rejects a damaged backup without changing anything', async () => {
    await seed()
    const { blob } = await exportBackup(db)
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const data = JSON.parse(await zip.file('data.json')!.async('string'))
    data.places[0].name = 'Tampered'
    zip.file('data.json', JSON.stringify(data))
    const bad = new Blob([await zip.generateAsync({ type: 'uint8array' }) as BlobPart])
    const target = new AtlasDB(`t-${n++}`)
    await createEntry('memory', { title: 'Keep me' }, target)
    await expect(importBackup(bad, 'replace', target)).rejects.toBeInstanceOf(BackupError)
    expect(await target.memories.count()).toBe(1)
    await expect(readBackup(new Blob(['not a zip']))).rejects.toBeInstanceOf(BackupError)
  })

  it('merge keeps the most recently edited copy and adds new entries', async () => {
    await seed()
    const { blob } = await exportBackup(db)
    const target = new AtlasDB(`m-${n++}`)
    await importBackup(blob, 'replace', target)
    const place = (await target.places.toArray())[0]
    await new Promise((r) => setTimeout(r, 5))
    await updateEntry('place', place.id, { notes: 'edited locally after backup' }, target)
    await createEntry('memory', { title: 'Local only' }, target)
    const s = await importBackup(blob, 'merge', target)
    expect((await target.places.get(place.id))!.notes).toBe('edited locally after backup')
    expect(s.keptLocal).toBeGreaterThan(0)
    expect(await target.memories.count()).toBe(2)
    expect(await target.media.count()).toBe(2)
  })
})
