/**
 * ATLAS data model.
 *
 * Every record has a stable string id plus createdAt/updatedAt (ISO strings).
 * Relationships are explicit id references — a Place is never an Adventure,
 * and a Dream is never a Place. Photos live in the `media` table and point
 * back to their owner; owners keep an ordered list of photo ids.
 *
 * Dates are stored as "YYYY-MM-DD" strings (calendar dates, no timezone
 * surprises). Times, when present, are "HH:MM".
 */

export type ISODate = string // YYYY-MM-DD
export type Timestamp = string // full ISO timestamp

export interface BaseRecord {
  id: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface WithPhotos {
  /** Ordered list of Media ids owned by this record. */
  photoIds: string[]
  /** Media id used as the cover; falls back to the first photo. */
  coverId?: string
}

export type PlaceStatus = 'visited' | 'wishlist'

export const PLACE_CATEGORIES = [
  'city',
  'nature',
  'beach',
  'mountain',
  'food',
  'culture',
  'stay',
  'other',
] as const
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number]

export interface Place extends BaseRecord, WithPhotos {
  name: string
  lat?: number
  lng?: number
  address?: string
  region?: string
  country?: string
  status: PlaceStatus
  category?: PlaceCategory
  /** Optional first/manual visit date. Further visits come from linked adventures & memories. */
  visitedOn?: ISODate
  tags: string[]
  notes: string
}

export interface Adventure extends BaseRecord, WithPhotos {
  title: string
  startDate: ISODate
  endDate?: ISODate
  placeIds: string[]
  story: string
  companions: string
  tags: string[]
  /** "What I'll remember" — one quote or highlight. */
  highlight: string
  /** Set when this adventure was created by completing a dream. */
  fromDreamId?: string
}

export interface Memory extends BaseRecord, WithPhotos {
  title: string
  date?: ISODate
  time?: string
  story: string
  placeId?: string
  adventureId?: string
  people: string
  tags: string[]
  favorite: boolean
  fromDreamId?: string
}

export interface Milestone extends BaseRecord, WithPhotos {
  title: string
  date: ISODate
  description: string
  chapterId?: string
}

export type DreamType = 'destination' | 'experience' | 'skill' | 'other'
export type DreamStatus = 'someday' | 'planning' | 'booked' | 'completed'
export const DREAM_STATUSES: DreamStatus[] = ['someday', 'planning', 'booked', 'completed']
export const DREAM_TYPES: DreamType[] = ['destination', 'experience', 'skill', 'other']

export interface Dream extends BaseRecord, WithPhotos {
  title: string
  type: DreamType
  status: DreamStatus
  placeId?: string
  /** Why it matters. */
  why: string
  notes: string
  inspirationLinks: string[]
  budget?: string
  companions: string
  completedOn?: ISODate
  linkedAdventureId?: string
  linkedMemoryId?: string
}

export type ChapterItemType = 'adventure' | 'memory' | 'milestone'
export interface ChapterItem {
  type: ChapterItemType
  id: string
}

export interface Chapter extends BaseRecord {
  title: string
  description: string
  startDate?: ISODate
  endDate?: ISODate
  /** Media id of a photo from one of its entries, used as the cover. */
  coverId?: string
  items: ChapterItem[]
  /** Set when the chapter was created from a suggestion (the milestone it starts with). */
  suggestedFrom?: string
  /**
   * When true, every adventure, memory and milestone dated inside the chapter's
   * from/until range belongs to it automatically (minus `excluded`), shown in date order.
   * Chapters opened from a milestone work this way.
   */
  autoInclude?: boolean
  /** Entries taken out of an automatic chapter by hand. */
  excluded?: ChapterItem[]
}

export type OwnerType = 'place' | 'adventure' | 'memory' | 'milestone' | 'dream' | 'chapter'

export interface Media extends BaseRecord {
  ownerType: OwnerType
  ownerId: string
  mimeType: string
  fileName: string
  size: number
  width?: number
  height?: number
  /** Taken from photo metadata (EXIF) when available. */
  capturedAt?: Timestamp
  /** Original bytes, preserved exactly as chosen. */
  data: ArrayBuffer
  /** Small JPEG for fast display (re-encoded, so it carries no metadata). */
  thumb?: ArrayBuffer
}

export type EntryType = 'place' | 'adventure' | 'memory' | 'milestone' | 'dream'

export interface EntryMap {
  place: Place
  adventure: Adventure
  memory: Memory
  milestone: Milestone
  dream: Dream
}

export const ENTRY_LABEL: Record<EntryType, string> = {
  adventure: 'Adventure',
  memory: 'Memory',
  place: 'Place',
  milestone: 'Milestone',
  dream: 'Dream',
}
