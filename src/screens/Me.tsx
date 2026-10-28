import { useEffect, useRef, useState } from 'react'
import { backupFileName, exportBackup, importBackup, readBackup, type BackupManifest, type ImportMode } from '../db/backup'
import { getDb, isDemoMode } from '../db/db'
import { enterDemo, exitDemo, removeDemoData } from '../db/demo'
import { findOrphanMedia } from '../db/media'
import { wipeAll } from '../db/repo'
import { bytes, fmtDate } from '../lib/format'
import { setPrefs, usePrefs } from '../lib/prefs'
import { stats, useAll } from '../lib/queries'
import { IconCamera, IconCompassMark, IconDownload, IconShield, IconSparkle, IconText, IconTrash, IconUpload } from '../ui/icons'
import { Loading, PageTitle, Segmented, Sheet, useConfirm, useToast } from '../ui/primitives'

const LAST_BACKUP = 'atlas.lastBackup'

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="section" style={{ marginTop: 'var(--s8)' }}>
      <h2 className="eyebrow pad" style={{ marginBottom: 'var(--s3)' }}>
        {title}
      </h2>
      <div className="settings-group">{children}</div>
    </section>
  )
}

function Setting({ icon, bg, title, sub, onClick, right }: { icon: React.ReactNode; bg: string; title: string; sub?: string; onClick?: () => void; right?: React.ReactNode }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className="setting" onClick={onClick}>
      <span className="ic" style={{ background: bg }}>
        {icon}
      </span>
      <span className="body">
        <b>{title}</b>
        {sub && <span>{sub}</span>}
      </span>
      {right}
    </Tag>
  )
}

export default function Me() {
  const data = useAll()
  const prefs = usePrefs()
  const toast = useToast()
  const confirm = useConfirm()
  const demo = isDemoMode()
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState('')
  const [storage, setStorage] = useState<{ usage?: number; quota?: number; persisted?: boolean }>({})
  const [mediaInfo, setMediaInfo] = useState<{ count: number; size: number; orphans: number }>()
  const [restore, setRestore] = useState<{ file: File; manifest: BackupManifest } | null>(null)
  const [restoreErr, setRestoreErr] = useState('')
  const [last, setLast] = useState(() => {
    try {
      return localStorage.getItem(LAST_BACKUP) ?? ''
    } catch {
      return ''
    }
  })

  useEffect(() => {
    ;(async () => {
      const est = await navigator.storage?.estimate?.().catch(() => undefined)
      const persisted = await navigator.storage?.persisted?.().catch(() => undefined)
      setStorage({ usage: est?.usage, quota: est?.quota, persisted })
    })()
  }, [])
  useEffect(() => {
    ;(async () => {
      let size = 0,
        count = 0
      await getDb().media.each((m) => {
        count++
        size += m.size + (m.thumb?.byteLength ?? 0)
      })
      setMediaInfo({ count, size, orphans: (await findOrphanMedia()).length })
    })()
  }, [data])

  if (!data) return <Loading />
  const s = stats(data)

  async function doExport() {
    setBusy('export')
    try {
      const { blob, manifest } = await exportBackup()
      // Verify the file we just made can be read back before handing it over.
      await readBackup(blob)
      const name = backupFileName()
      const file = new File([blob], name, { type: 'application/zip' })
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
      if (nav.canShare?.({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
        await navigator.share({ files: [file], title: name }).catch(() => {})
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = name
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 10000)
      }
      const when = new Date().toISOString()
      try {
        localStorage.setItem(LAST_BACKUP, when)
      } catch {
        /* ignore */
      }
      setLast(when)
      const total = Object.entries(manifest.counts).reduce((n, [, v]) => n + v, 0)
      toast({ message: `Backup ready — ${total} items, verified.` })
    } catch (e) {
      toast({ message: `Backup failed: ${(e as Error).message}` })
    } finally {
      setBusy('')
    }
  }

  async function pickRestore(file: File) {
    setRestoreErr('')
    setBusy('verify')
    try {
      const { manifest } = await readBackup(file)
      setRestore({ file, manifest })
    } catch (e) {
      setRestoreErr((e as Error).message)
      setRestore(null)
    } finally {
      setBusy('')
    }
  }

  async function doRestore(mode: ImportMode) {
    if (!restore) return
    if (mode === 'replace') {
      const ok = await confirm({
        title: 'Replace everything?',
        text: 'Your current atlas on this device will be replaced by the backup. Consider exporting a backup of the current data first.',
        confirmLabel: 'Replace',
        danger: true,
      })
      if (!ok) return
    }
    setBusy('restore')
    try {
      const r = await importBackup(restore.file, mode)
      toast({ message: `Restored: ${r.added} added, ${r.updated} updated, ${r.photos} photos.` })
      setRestore(null)
    } catch (e) {
      setRestoreErr((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  return (
    <main className="page">
      <PageTitle title={prefs.name ? prefs.name : 'Explorer'} subtitle="Your atlas, your rules.">
        <IconCompassMark style={{ width: 40, height: 40 }} />
      </PageTitle>

      <div className="facts pad">
        {[
          ['Places visited', s.places],
          ['Countries', s.countries],
          ['Adventures', s.adventures],
          ['Memories', s.memories],
          ['Milestones', s.milestones],
          ['Dreams done', `${s.dreamsDone} of ${s.dreamsDone + s.dreams}`],
        ].map(([k, v]) => (
          <div className="fact" key={k as string}>
            <div className="eyebrow">{k}</div>
            <div className="display" style={{ fontSize: 'var(--fs-xl)' }}>
              {v}
            </div>
          </div>
        ))}
      </div>
      <p className="pad xs muted" style={{ marginTop: 8 }}>
        Counted from your entries. Countries come from the “Country” field on visited places.
      </p>

      <Group title="Backup">
        <Setting
          icon={<IconDownload />}
          bg="var(--coral-tint)"
          title={busy === 'export' ? 'Preparing backup…' : 'Export a backup'}
          sub={last ? `Last backup on this device: ${fmtDate(last.slice(0, 10))}` : 'A single .zip with every entry and original photo.'}
          onClick={busy ? undefined : doExport}
        />
        <Setting icon={<IconUpload />} bg="var(--sea-tint)" title={busy === 'verify' ? 'Checking backup…' : 'Restore from a backup'} sub="We check the file is complete before changing anything." onClick={() => fileInput.current?.click()} />
        <input
          ref={fileInput}
          type="file"
          accept=".zip,application/zip"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) pickRestore(f)
            e.target.value = ''
          }}
        />
      </Group>
      {restoreErr && (
        <p className="note warn" style={{ margin: '12px 20px 0' }} role="alert">
          {restoreErr}
        </p>
      )}

      <Group title="Preferences">
        <div className="setting">
          <span className="ic" style={{ background: 'var(--sun-tint)' }}>
            <IconSparkle />
          </span>
          <span className="body">
            <label htmlFor="pname">
              <b>Your name</b>
            </label>
            <input id="pname" className="input" style={{ minHeight: 40, marginTop: 6 }} value={prefs.name} onChange={(e) => setPrefs({ name: e.target.value })} placeholder="Optional" />
          </span>
        </div>
        <Setting
          icon={<IconText />}
          bg="var(--sage-tint)"
          title="Text size"
          right={
            <Segmented
              label="Text size"
              value={prefs.text}
              onChange={(v) => setPrefs({ text: v })}
              options={[
                { value: 'normal', label: 'Normal' },
                { value: 'large', label: 'Large' },
              ]}
            />
          }
        />
        <Setting
          icon={<IconSparkle />}
          bg="var(--sea-tint)"
          title="Motion"
          sub="Follows your device by default."
          right={
            <Segmented
              label="Motion"
              value={prefs.motion}
              onChange={(v) => setPrefs({ motion: v })}
              options={[
                { value: 'system', label: 'Auto' },
                { value: 'reduce', label: 'Less' },
              ]}
            />
          }
        />
      </Group>

      <Group title="Photos & storage">
        <Setting
          icon={<IconCamera />}
          bg="var(--sand-soft)"
          title={mediaInfo ? `${mediaInfo.count} photos · ${bytes(mediaInfo.size)}` : 'Counting photos…'}
          sub={storage.usage !== undefined ? `This app uses ${bytes(storage.usage)} on this device.${storage.persisted ? ' Storage is protected from automatic clean-up.' : ''}` : undefined}
        />
        {mediaInfo && mediaInfo.orphans > 0 && (
          <Setting
            icon={<IconTrash />}
            bg="var(--coral-tint)"
            title={`Tidy ${mediaInfo.orphans} unattached photos`}
            sub="Photos whose entry no longer exists."
            onClick={async () => {
              const ids = await findOrphanMedia()
              await getDb().media.bulkDelete(ids)
              toast({ message: 'Tidied up.' })
            }}
          />
        )}
      </Group>

      <Group title="Privacy">
        <div className="setting" style={{ alignItems: 'flex-start' }}>
          <span className="ic" style={{ background: 'var(--sea-tint)' }}>
            <IconShield />
          </span>
          <span className="body small" style={{ lineHeight: 1.55 }}>
            <b>Private by design</b>
            <span style={{ display: 'block', marginTop: 4 }}>
              Everything you add is stored only in this browser on this device. There’s no account, no analytics and no tracking. Photos are never uploaded. Your location is only read if you tap “Use my location”.
            </span>
            <span style={{ display: 'block', marginTop: 8 }}>
              Internet is used only for map tiles (CARTO / OpenStreetMap) and when you press Search on the world map (Photon / OpenStreetMap) — only the search words are sent.
            </span>
            <span style={{ display: 'block', marginTop: 8 }}>
              Because data lives on this device, regular backups are your safety net. On iPhone, add ATLAS to your Home Screen so Safari keeps your data.
            </span>
          </span>
        </div>
      </Group>

      <Group title="Demo & reset">
        {demo ? (
          <Setting icon={<IconSparkle />} bg="var(--sun-tint)" title="Exit demo mode" sub="Return to your own atlas." onClick={() => exitDemo()} />
        ) : (
          <Setting icon={<IconSparkle />} bg="var(--sun-tint)" title="Explore the demo" sub="Sample entries in a separate space. Your atlas isn’t touched." onClick={() => enterDemo()} />
        )}
        {!demo && (
          <Setting
            icon={<IconTrash />}
            bg="var(--sand-soft)"
            title="Remove demo data"
            onClick={async () => {
              await removeDemoData()
              toast({ message: 'Demo data removed.' })
            }}
          />
        )}
        <Setting
          icon={<IconTrash />}
          bg="var(--coral-tint)"
          title={demo ? 'Clear demo entries' : 'Delete everything'}
          sub={demo ? undefined : 'Permanently erase this device’s atlas. Export a backup first.'}
          onClick={async () => {
            const ok = await confirm({
              title: demo ? 'Clear all demo entries?' : 'Delete your entire atlas?',
              text: demo ? undefined : 'Every place, adventure, memory, milestone, dream and photo on this device will be erased. This cannot be undone without a backup.',
              confirmLabel: 'Delete everything',
              danger: true,
            })
            if (!ok) return
            await wipeAll()
            toast({ message: 'Erased.' })
          }}
        />
      </Group>

      <p className="pad xs muted" style={{ marginTop: 'var(--s8)', textAlign: 'center' }}>
        ATLAS · v0.1 · A living map of your life.
      </p>

      <Sheet open={!!restore} onClose={() => setRestore(null)} label="Restore backup">
        {restore && (
          <div className="stack">
            <h2>Backup looks good</h2>
            <p className="small muted">
              Made {fmtDate(restore.manifest.exportedAt.slice(0, 10))} · {restore.manifest.counts.places} places, {restore.manifest.counts.adventures} adventures, {restore.manifest.counts.memories} memories,{' '}
              {restore.manifest.counts.milestones} milestones, {restore.manifest.counts.dreams} dreams, {restore.manifest.counts.media} photos. All files checked.
            </p>
            <button className="btn btn-primary btn-block" disabled={!!busy} onClick={() => doRestore('merge')}>
              Merge with what’s here
            </button>
            <p className="xs muted">Adds anything missing. If an entry exists in both, the most recently edited version is kept.</p>
            <button className="btn btn-secondary btn-block" disabled={!!busy} onClick={() => doRestore('replace')}>
              Replace everything
            </button>
            <p className="xs muted">Makes this device match the backup exactly.</p>
          </div>
        )}
      </Sheet>
    </main>
  )
}
