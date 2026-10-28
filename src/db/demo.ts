import Dexie from 'dexie'
import { AtlasDB, DEMO_DB, setDemoMode } from './db'
import { createChapter, createEntry } from './repo'

/**
 * Demo mode uses a separate database ("atlas-demo"). Every demo entry is
 * fictional sample content, tagged "demo", and shown under a Demo banner.
 * Your personal atlas is never touched.
 */
export async function seedDemo(db: AtlasDB) {
  if ((await db.places.count()) > 0) return
  const tags = ['demo']
  const lisbon = await createEntry('place', { name: 'Lisbon', lat: 38.7223, lng: -9.1393, country: 'Portugal', status: 'visited', category: 'city', visitedOn: '2025-05-02', tags, notes: 'Sample place for the demo.' }, db)
  const sintra = await createEntry('place', { name: 'Sintra', lat: 38.8029, lng: -9.3817, country: 'Portugal', status: 'visited', category: 'culture', tags, notes: '' }, db)
  const kyoto = await createEntry('place', { name: 'Kyoto', lat: 35.0116, lng: 135.7681, country: 'Japan', status: 'wishlist', category: 'culture', tags, notes: 'Sample wishlist place.' }, db)
  await createEntry('place', { name: 'Monteverde', lat: 10.3009, lng: -84.8255, country: 'Costa Rica', status: 'visited', category: 'nature', visitedOn: '2024-08-17', tags, notes: '' }, db)
  await createEntry('place', { name: 'Torres del Paine', lat: -50.9423, lng: -73.4068, country: 'Chile', status: 'wishlist', category: 'mountain', tags, notes: '' }, db)
  const adv = await createEntry(
    'adventure',
    {
      title: 'A week of tiles and tram bells',
      startDate: '2025-05-02',
      endDate: '2025-05-08',
      placeIds: [lisbon.id, sintra.id],
      story: 'This is a sample adventure for demo mode.\n\nMornings on miradouros, afternoons getting lost in Alfama, one very long day trip to Sintra.',
      companions: 'Sample companion',
      highlight: 'The city turns gold for about ten minutes every evening.',
      tags,
    },
    db,
  )
  await createEntry('memory', { title: 'Pastéis still warm', date: '2025-05-03', story: 'Sample memory.', placeId: lisbon.id, adventureId: adv.id, people: '', favorite: true, tags }, db)
  await createEntry('memory', { title: 'Fog lifting over the palace', date: '2025-05-06', story: 'Sample memory.', placeId: sintra.id, adventureId: adv.id, people: '', favorite: false, tags }, db)
  const flat = await createEntry('milestone', { title: 'Moved into the new flat', date: '2024-11-01', description: 'Sample milestone.' }, db)
  await createEntry('milestone', { title: 'Started a new job', date: '2025-09-15', description: 'Sample milestone — ATLAS suggests a chapter from here once something happens after it.' }, db)
  await createEntry('memory', { title: 'First week, new desk', date: '2025-09-19', story: 'Sample memory.', people: '', favorite: false, tags }, db)
  await createChapter(
    {
      title: 'The new-flat year',
      description: 'Sample chapter — a season of your life, gathering what happened in it.',
      startDate: '2024-11-01',
      endDate: '2025-09-14',
      suggestedFrom: flat.id,
      items: [
        { type: 'milestone', id: flat.id },
        { type: 'adventure', id: adv.id },
      ],
    },
    db,
  )
  await createEntry('dream', { title: 'Cherry blossoms in Kyoto', type: 'destination', status: 'planning', placeId: kyoto.id, why: 'Sample dream — to see a city celebrate something so brief.', notes: '', inspirationLinks: [], companions: '', budget: '' }, db)
  await createEntry('dream', { title: 'Learn to surf', type: 'skill', status: 'someday', why: 'Sample dream without a location.', notes: '', inspirationLinks: [], companions: '' }, db)
  await createEntry('dream', { title: 'Sleep under the Milky Way', type: 'experience', status: 'someday', why: '', notes: '', inspirationLinks: [], companions: '' }, db)
}

export async function enterDemo() {
  const db = new AtlasDB(DEMO_DB)
  await seedDemo(db)
  db.close()
  setDemoMode(true)
  location.hash = '#/'
  location.reload()
}

export function exitDemo() {
  setDemoMode(false)
  location.hash = '#/'
  location.reload()
}

export async function removeDemoData() {
  await Dexie.delete(DEMO_DB)
}
