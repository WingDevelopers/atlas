import { getDb, type AtlasDB } from './db'
import { newId, nowIso, tableFor } from './repo'
import type { EntryType, Media, OwnerType, WithPhotos } from './types'

export const MAX_PHOTO_BYTES = 40 * 1024 * 1024 // 40 MB per photo

export interface Thumbnail {
  data: ArrayBuffer
  width: number
  height: number
}
export type ThumbnailMaker = (file: Blob) => Promise<Thumbnail | undefined>

/**
 * Browser thumbnail: draw onto a canvas and re-encode as JPEG.
 * Re-encoding means the thumbnail carries no EXIF/GPS metadata.
 */
export const browserThumbnail: ThumbnailMaker = async (file) => {
  try {
    const bitmap = await createImageBitmap(file)
    const max = 900
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
    const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', 0.82))
    const out = { data: await blob.arrayBuffer(), width: bitmap.width, height: bitmap.height }
    bitmap.close?.()
    return out
  } catch {
    return undefined
  }
}

/* ---------- Minimal EXIF DateTimeOriginal reader (JPEG only) ---------- */

export function readExifDate(buf: ArrayBuffer): string | undefined {
  try {
    const v = new DataView(buf)
    if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return undefined
    let off = 2
    while (off + 4 < v.byteLength) {
      const marker = v.getUint16(off)
      const len = v.getUint16(off + 2)
      if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) {
        const tiff = off + 10
        const le = v.getUint16(tiff) === 0x4949
        const u16 = (o: number) => v.getUint16(o, le)
        const u32 = (o: number) => v.getUint32(o, le)
        const readStr = (o: number, n: number) => {
          let s = ''
          for (let i = 0; i < n - 1; i++) s += String.fromCharCode(v.getUint8(o + i))
          return s
        }
        const scan = (ifd: number, tags: number[]): Record<number, number> => {
          const found: Record<number, number> = {}
          const n = u16(ifd)
          for (let i = 0; i < n; i++) {
            const e = ifd + 2 + i * 12
            const tag = u16(e)
            if (tags.includes(tag)) found[tag] = e
          }
          return found
        }
        const ifd0 = tiff + u32(tiff + 4)
        const t0 = scan(ifd0, [0x8769, 0x0132])
        let raw: string | undefined
        if (t0[0x8769] !== undefined) {
          const exifIfd = tiff + u32(t0[0x8769] + 8)
          const te = scan(exifIfd, [0x9003])
          if (te[0x9003] !== undefined) raw = readStr(tiff + u32(te[0x9003] + 8), 20)
        }
        if (!raw && t0[0x0132] !== undefined) raw = readStr(tiff + u32(t0[0x0132] + 8), 20)
        if (!raw) return undefined
        const m = raw.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
        if (!m) return undefined
        return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`
      }
      if ((marker & 0xff00) !== 0xff00) break
      off += 2 + len
    }
  } catch {
    /* not parseable — that's fine */
  }
  return undefined
}

/* ------------------------------------------------------------------ */

export async function addPhotos(
  ownerType: EntryType,
  ownerId: string,
  files: Blob[],
  opts: { db?: AtlasDB; makeThumb?: ThumbnailMaker } = {},
): Promise<Media[]> {
  const db = opts.db ?? getDb()
  const makeThumb = opts.makeThumb ?? browserThumbnail
  const prepared: Media[] = []
  for (const file of files) {
    if (file.size > MAX_PHOTO_BYTES) throw new Error('That photo is larger than 40 MB.')
    if (file.type && !file.type.startsWith('image/')) throw new Error('Only photos can be attached for now.')
    const data = await file.arrayBuffer()
    const thumb = await makeThumb(file)
    const ts = nowIso()
    prepared.push({
      id: newId(),
      ownerType,
      ownerId,
      mimeType: file.type || 'image/jpeg',
      fileName: (file as File).name || 'photo.jpg',
      size: file.size,
      width: thumb?.width,
      height: thumb?.height,
      capturedAt: readExifDate(data),
      data,
      thumb: thumb?.data,
      createdAt: ts,
      updatedAt: ts,
    })
  }
  const table = tableFor(ownerType, db)
  await db.transaction('rw', [db.media, table], async () => {
    const owner = (await table.get(ownerId)) as unknown as WithPhotos | undefined
    if (!owner) throw new Error('That entry no longer exists.')
    await db.media.bulkAdd(prepared)
    const photoIds = [...(owner.photoIds ?? []), ...prepared.map((m) => m.id)]
    await table.update(ownerId, { photoIds, coverId: owner.coverId ?? photoIds[0], updatedAt: nowIso() } as never)
  })
  return prepared
}

/** Remove one photo. Only that photo and the owner's reference to it change. */
export async function removePhoto(mediaId: string, db: AtlasDB = getDb()) {
  const m = await db.media.get(mediaId)
  if (!m) return
  if (m.ownerType === 'chapter') {
    await db.media.delete(mediaId)
    return
  }
  const table = tableFor(m.ownerType as EntryType, db)
  await db.transaction('rw', [db.media, table, db.chapters], async () => {
    const owner = (await table.get(m.ownerId)) as unknown as WithPhotos | undefined
    await db.media.delete(mediaId)
    const covered = await db.chapters.filter((c) => c.coverId === mediaId).toArray()
    for (const c of covered) {
      const { coverId: _c, ...rest } = c
      await db.chapters.put({ ...rest, updatedAt: nowIso() })
    }
    if (owner) {
      const photoIds = owner.photoIds.filter((id) => id !== mediaId)
      const coverId = owner.coverId === mediaId ? photoIds[0] : owner.coverId
      await table.update(m.ownerId, { photoIds, coverId, updatedAt: nowIso() } as never)
    }
  })
}

export async function setCover(ownerType: EntryType, ownerId: string, mediaId: string, db: AtlasDB = getDb()) {
  await tableFor(ownerType, db).update(ownerId, { coverId: mediaId, updatedAt: nowIso() } as never)
}

/** Media whose owner no longer exists (should not happen, but we check). */
export async function findOrphanMedia(db: AtlasDB = getDb()): Promise<string[]> {
  const all = await db.media.toArray()
  const orphans: string[] = []
  for (const m of all) {
    if (m.ownerType === 'chapter') {
      if (!(await db.chapters.get(m.ownerId))) orphans.push(m.id)
      continue
    }
    const owner = await tableFor(m.ownerType as Exclude<OwnerType, 'chapter'>, db).get(m.ownerId)
    if (!owner) orphans.push(m.id)
  }
  return orphans
}
