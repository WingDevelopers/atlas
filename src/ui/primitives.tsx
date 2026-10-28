import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getDb } from '../db/db'
import { Art, EmptyArt } from './Art'
import { IconBack } from './icons'
import { useNavigate } from 'react-router-dom'

/* ---------------- Photos ---------------- */

export function useMediaUrl(id?: string, variant: 'thumb' | 'full' = 'thumb') {
  const media = useLiveQuery(() => (id ? getDb().media.get(id) : undefined), [id])
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!media) {
      setUrl(undefined)
      return
    }
    const bytes = variant === 'thumb' && media.thumb ? media.thumb : media.data
    const type = variant === 'thumb' && media.thumb ? 'image/jpeg' : media.mimeType
    const u = URL.createObjectURL(new Blob([bytes], { type }))
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [media, variant])
  return url
}

export function Photo({ id, variant = 'thumb', alt = '', className }: { id: string; variant?: 'thumb' | 'full'; alt?: string; className?: string }) {
  const url = useMediaUrl(id, variant)
  if (!url) return <div className={className} style={{ background: 'var(--sand)', width: '100%', height: '100%' }} />
  return <img src={url} alt={alt} className={className} loading="lazy" decoding="async" />
}

/** Cover image or a gentle illustrated placeholder. */
export function Cover({ mediaId, seed, alt = '', variant = 'thumb' }: { mediaId?: string; seed: string; alt?: string; variant?: 'thumb' | 'full' }) {
  if (mediaId) return <Photo id={mediaId} alt={alt} variant={variant} />
  return <Art seed={seed} />
}

/* ---------------- Layout ---------------- */

export function PageTitle({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="page-title">
      <div className="row">
        <h1 className="spacer">{title}</h1>
        {children}
      </div>
      {subtitle && <p>{subtitle}</p>}
    </header>
  )
}

export function BackBar({ title, right }: { title?: string; right?: ReactNode }) {
  const nav = useNavigate()
  return (
    <div className="topbar">
      <button className="icon-btn" onClick={() => (history.length > 1 ? nav(-1) : nav('/'))} aria-label="Back">
        <IconBack />
      </button>
      <h1 className="spacer">{title}</h1>
      {right}
    </div>
  )
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <EmptyArt />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function FilterChips<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="filters" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className="filter-chip" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------------- Sheet ---------------- */

export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref}>
        <div className="grabber" />
        {children}
      </div>
    </>
  )
}

/* ---------------- Confirm ---------------- */

interface ConfirmOpts {
  title: string
  text?: string
  confirmLabel?: string
  danger?: boolean
}
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false)
export const useConfirm = () => useContext(ConfirmCtx)

/* ---------------- Toast ---------------- */

interface ToastOpts {
  message: string
  actionLabel?: string
  onAction?: () => void
}
const ToastCtx = createContext<(t: ToastOpts) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOpts & { key: number }) | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback((t: ToastOpts) => {
    window.clearTimeout(timer.current)
    setToast({ ...t, key: Date.now() })
    timer.current = window.setTimeout(() => setToast(null), t.onAction ? 7000 : 3200)
  }, [])

  const [confirm, setConfirm] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null)
  const ask = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setConfirm({ ...o, resolve })), [])
  const close = (v: boolean) => {
    confirm?.resolve(v)
    setConfirm(null)
  }

  return (
    <ToastCtx.Provider value={show}>
      <ConfirmCtx.Provider value={ask}>
        {children}
        <Sheet open={!!confirm} onClose={() => close(false)} label={confirm?.title ?? 'Confirm'}>
          {confirm && (
            <div className="stack">
              <h2>{confirm.title}</h2>
              {confirm.text && <p className="muted">{confirm.text}</p>}
              <div className="row" style={{ marginTop: 'var(--s6)' }}>
                <button className="btn btn-secondary spacer" onClick={() => close(false)}>
                  Cancel
                </button>
                <button className={`btn spacer ${confirm.danger ? 'btn-primary' : 'btn-primary'}`} onClick={() => close(true)} autoFocus>
                  {confirm.confirmLabel ?? 'Confirm'}
                </button>
              </div>
            </div>
          )}
        </Sheet>
        {toast && (
          <div className="toast" role="status" aria-live="polite" key={toast.key}>
            <span>{toast.message}</span>
            {toast.onAction && (
              <button
                onClick={() => {
                  toast.onAction?.()
                  setToast(null)
                }}
              >
                {toast.actionLabel ?? 'Undo'}
              </button>
            )}
          </div>
        )}
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  )
}

export function Loading() {
  return <div className="loading">Unfolding the map…</div>
}
