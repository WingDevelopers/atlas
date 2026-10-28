import Dexie, { type Table } from 'dexie'
import type { Adventure, Chapter, Dream, Media, Memory, Milestone, Place } from './types'

export interface MetaRow {
  key: string
  value: unknown
}

/** Bump when the stored shape changes; add a matching `.version()` below. */
export const SCHEMA_VERSION = 1

export class AtlasDB extends Dexie {
  places!: Table<Place, string>
  adventures!: Table<Adventure, string>
  memories!: Table<Memory, string>
  milestones!: Table<Milestone, string>
  dreams!: Table<Dream, string>
  chapters!: Table<Chapter, string>
  media!: Table<Media, string>
  meta!: Table<MetaRow, string>

  constructor(name: string) {
    super(name)
    // Schema migrations: never edit a released version — add a new one.
    this.version(1).stores({
      places: 'id, status, name, updatedAt',
      adventures: 'id, startDate, *placeIds, fromDreamId, updatedAt',
      memories: 'id, date, placeId, adventureId, favorite, updatedAt',
      milestones: 'id, date, chapterId, updatedAt',
      dreams: 'id, status, type, placeId, updatedAt',
      chapters: 'id, updatedAt',
      media: 'id, [ownerType+ownerId], ownerId',
      meta: 'key',
    })
  }
}

export const PERSONAL_DB = 'atlas'
export const DEMO_DB = 'atlas-demo'

const MODE_KEY = 'atlas.mode'

export function isDemoMode(): boolean {
  try {
    return localStorage.getItem(MODE_KEY) === 'demo'
  } catch {
    return false
  }
}

export function setDemoMode(on: boolean) {
  try {
    if (on) localStorage.setItem(MODE_KEY, 'demo')
    else localStorage.removeItem(MODE_KEY)
  } catch {
    /* ignore */
  }
}

let current: AtlasDB | null = null

/**
 * The active database. Demo data lives in a completely separate database,
 * so it can never mix with your personal entries.
 */
export function getDb(): AtlasDB {
  if (!current) current = new AtlasDB(isDemoMode() ? DEMO_DB : PERSONAL_DB)
  return current
}

/** For tests: point the app at a specific database. */
export function setDatabase(db: AtlasDB) {
  current = db
}
