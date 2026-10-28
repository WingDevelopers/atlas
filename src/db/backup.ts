import JSZip from 'jszip'
import { getDb, SCHEMA_VERSION, type AtlasDB } from './db'
import type { Adventure, Chapter, Dream, Media, Memory, Milestone, Place } from './types'

/**
 * BACKUP FORMAT — "the-atlas-backup", format version 1
 *
 * A standard .zip file containing:
 *   manifest.json            format/version info, record counts, SHA-256 of every file
 *   data.json                all records (places, adventures, memories, milestones,
 *                            dreams, chapters) plus photo metadata (no image bytes)
 *   media/originals/<id>.*   every photo exactly as you added it
 *   media/thumbs/<id>.jpg    the small preview copies
 *   README.txt               this explanation in plain words
 *
 * Everything is plain JSON + ordinary image files, so it can be opened
 * without The Atlas.
 */

export const BACKUP_FORMAT = 'the-atlas-backup'
export const BACKUP_FORMAT_VERSION = 1
export const APP_VERSION = '0.1.0'

type MediaMeta = Omit<Media, 'data' | 'thumb'> & { file: string; thumbFile?: string }

export interface BackupData {
  places: Place[]
  adventures: Adventure[]
  memories: Memory[]
  milestones: Milestone[]
  dreams: Dream[]
  chapters: Chapter[]
  media: MediaMeta[]
}

export interface BackupManifest {
  format: string
  formatVersion: number
  schemaVersion: number
  appVersion: string
  exportedAt: string
  counts: Record<keyof BackupData, number>
  files: Record<string, string> // path -> sha256 hex
}

const RECORD_TABLES = ['places', 'adventures', 'memories', 'milestones', 'dreams', 'chapters'] as const

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
}

async function sha256(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const digest = await crypto.subtle.digest('SHA-256', view as BufferSource)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

const README = `THE ATLAS — BACKUP
A living map of your life.

This file is a complete copy of your Atlas: every place, adventure,
memory, milestone, dream and chapter, plus every photo in its original form.

To restore: open The Atlas → Me → Backup → Restore from backup.

What's inside
- data.json: all your entries as plain JSON text.
- media/originals: your photos exactly as you added them.
- media/thumbs: smaller preview copies.
- manifest.json: a checksum (SHA-256) for every file, so The Atlas can
  confirm nothing was damaged before restoring.

Keep this file somewhere safe — a second drive or a private cloud folder.
`

export async function exportBackup(db: AtlasDB = getDb()): Promise<{ blob: Blob; manifest: BackupManifest }> {
  const zip = new JSZip()
  const files: Record<string, string> = {}
  const data = {} as BackupData

  // Read a consistent snapshot first (only database calls are allowed inside
  // a transaction), then hash and zip outside it.
  let media: Media[] = []
  await db.transaction('r', [db.places, db.adventures, db.memories, db.milestones, db.dreams, db.chapters, db.media], async () => {
    for (const t of RECORD_TABLES) (data as unknown as Record<string, unknown[]>)[t] = await db[t].toArray()
    media = await db.media.toArray()
  })
  data.media = []
  {
    for (const m of media) {
      const { data: bytes, thumb, ...meta } = m
      const file = `media/originals/${m.id}.${EXT[m.mimeType] ?? 'bin'}`
      zip.file(file, bytes)
      files[file] = await sha256(bytes)
      let thumbFile: string | undefined
      if (thumb) {
        thumbFile = `media/thumbs/${m.id}.jpg`
        zip.file(thumbFile, thumb)
        files[thumbFile] = await sha256(thumb)
      }
      data.media.push({ ...meta, file, thumbFile })
    }
  }

  const dataJson = new TextEncoder().encode(JSON.stringify(data, null, 2))
  zip.file('data.json', dataJson)
  files['data.json'] = await sha256(dataJson)
  zip.file('README.txt', README)

  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, (v as unknown[]).length])) as BackupManifest['counts'],
    files,
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' })
  return { blob: new Blob([bytes as BlobPart], { type: 'application/zip' }), manifest }
}

export interface CheckedBackup {
  manifest: BackupManifest
  data: BackupData
  zip: JSZip
}

export class BackupError extends Error {}

/** Open a backup and verify every checksum. Writes nothing. */
export async function readBackup(file: Blob): Promise<CheckedBackup> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer())
  } catch {
    throw new BackupError("This doesn't look like an Atlas backup (it isn't a readable .zip file).")
  }
  const mf = zip.file('manifest.json')
  if (!mf) throw new BackupError('This zip has no manifest.json, so it is not an Atlas backup.')
  let manifest: BackupManifest
  try {
    manifest = JSON.parse(await mf.async('string'))
  } catch {
    throw new BackupError('The backup manifest is damaged.')
  }
  if (manifest.format !== BACKUP_FORMAT) throw new BackupError('This zip is not an Atlas backup.')
  if (manifest.formatVersion > BACKUP_FORMAT_VERSION)
    throw new BackupError('This backup was made by a newer version of The Atlas. Please update the app first.')

  for (const [path, hash] of Object.entries(manifest.files)) {
    const f = zip.file(path)
    if (!f) throw new BackupError(`The backup is missing a file: ${path}`)
    const bytes = await f.async('uint8array')
    if ((await sha256(bytes)) !== hash) throw new BackupError(`A file in the backup is damaged: ${path}`)
  }
  const data = JSON.parse(await zip.file('data.json')!.async('string')) as BackupData
  for (const t of [...RECORD_TABLES, 'media'] as const) {
    if (!Array.isArray(data[t])) throw new BackupError(`The backup's data is incomplete (${t}).`)
    if (data[t].length !== manifest.counts[t]) throw new BackupError(`The backup's ${t} count doesn't match its manifest.`)
    for (const r of data[t] as { id?: unknown }[]) if (typeof r.id !== 'string') throw new BackupError(`A ${t} record has no id.`)
  }
  return { manifest, data, zip }
}

export type ImportMode = 'merge' | 'replace'
export interface ImportSummary {
  added: number
  updated: number
  keptLocal: number
  photos: number
}

/**
 * Restore a backup.
 *  - replace: your current data is cleared and replaced by the backup.
 *  - merge:   entries are matched by id. New ones are added; when both
 *             copies exist, the most recently edited one wins.
 * The backup is fully verified before anything is written, and the whole
 * restore happens in one transaction — it either fully succeeds or changes nothing.
 */
export async function importBackup(file: Blob, mode: ImportMode, db: AtlasDB = getDb()): Promise<ImportSummary> {
  const { data, zip } = await readBackup(file)
  // Load all photo bytes before opening the write transaction.
  const mediaFull: Media[] = []
  for (const meta of data.media) {
    const { file: path, thumbFile, ...rest } = meta
    const bytes = await zip.file(path)!.async('arraybuffer')
    const thumb = thumbFile ? await zip.file(thumbFile)?.async('arraybuffer') : undefined
    mediaFull.push({ ...rest, data: bytes, thumb })
  }

  const summary: ImportSummary = { added: 0, updated: 0, keptLocal: 0, photos: 0 }
  await db.transaction('rw', [db.places, db.adventures, db.memories, db.milestones, db.dreams, db.chapters, db.media], async () => {
    if (mode === 'replace') {
      await Promise.all([...RECORD_TABLES.map((t) => db[t].clear()), db.media.clear()])
    }
    const finalPhotoRefs = new Set<string>()
    for (const t of RECORD_TABLES) {
      const table = db[t] as unknown as import('dexie').Table<{ id: string; updatedAt: string; photoIds?: string[]; coverId?: string }, string>
      for (const rec of data[t] as unknown as { id: string; updatedAt: string; photoIds?: string[]; coverId?: string }[]) {
        const existing = mode === 'merge' ? await table.get(rec.id) : undefined
        let final = rec
        if (!existing) {
          await table.put(rec)
          summary.added++
        } else if (rec.updatedAt > existing.updatedAt) {
          await table.put(rec)
          summary.updated++
        } else {
          final = existing
          summary.keptLocal++
        }
        final.photoIds?.forEach((id) => finalPhotoRefs.add(id))
        if (final.coverId) finalPhotoRefs.add(final.coverId)
      }
    }
    for (const m of mediaFull) {
      if (!finalPhotoRefs.has(m.id)) continue
      if (mode === 'merge' && (await db.media.get(m.id))) continue
      await db.media.put(m)
      summary.photos++
    }
  })
  return summary
}

export function backupFileName(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `atlas-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.zip`
}
