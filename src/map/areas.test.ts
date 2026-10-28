import { beforeEach, describe, expect, it } from 'vitest'
import { AtlasDB } from '../db/db'
import { createEntry, updateEntry } from '../db/repo'
import { containsPoint, ensureAreas, lookupArea, needsArea } from './areas'

const square = (lat: number, lng: number, d: number, name: string, kind = 'city') => ({
  type: 'Feature',
  properties: { name, addresstype: kind },
  geometry: { type: 'Polygon', coordinates: [[[lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d], [lng - d, lat + d], [lng - d, lat - d]]] },
})
const respond = (features: unknown[]) => new Response(JSON.stringify({ type: 'FeatureCollection', features }), { status: 200 })

let db: AtlasDB
let n = 0
beforeEach(async () => {
  db = new AtlasDB(`areas-${n++}`)
  await db.open()
})

describe('place outlines', () => {
  it('prefers the named place that contains the pin', async () => {
    const calls: string[] = []
    const fetcher = (async (url: string) => {
      calls.push(url)
      // a far-away "Orlando" first, then the right one
      return respond([square(10, 10, 0.1, 'Orlando'), square(28.54, -81.38, 0.2, 'Orlando')])
    }) as unknown as typeof fetch
    const a = await lookupArea('Orlando', 28.5384, -81.3792, fetcher)
    expect(a?.name).toBe('Orlando')
    expect(containsPoint(a!.geometry, 28.5384, -81.3792)).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain('search?q=Orlando')
  })

  it('falls back to the town around the pin', async () => {
    const fetcher = (async (url: string) => (url.includes('/search') ? respond([{ type: 'Feature', properties: { name: 'Cafe' }, geometry: { type: 'Point', coordinates: [0, 0] } }]) : respond([square(38.72, -9.14, 0.05, 'Lisbon')]))) as unknown as typeof fetch
    const a = await lookupArea('My favourite café', 38.7223, -9.1393, fetcher)
    expect(a?.name).toBe('Lisbon')
  })

  it('saves outlines without changing when the place was last edited, and refreshes when the pin moves', async () => {
    const p = await createEntry('place', { name: 'Orlando', lat: 28.5384, lng: -81.3792 }, db)
    expect(needsArea(p)).toBe(true)
    const fetcher = (async () => respond([square(28.54, -81.38, 0.2, 'Orlando')])) as unknown as typeof fetch
    expect(await ensureAreas([p], { db, fetcher })).toBe(1)
    const saved = (await db.places.get(p.id))!
    expect(saved.area?.name).toBe('Orlando')
    expect(saved.updatedAt).toBe(p.updatedAt)
    expect(needsArea(saved)).toBe(false)
    const moved = await updateEntry('place', p.id, { lat: 28.6, lng: -81.2 }, db)
    expect(needsArea(moved)).toBe(true)
  })
})
