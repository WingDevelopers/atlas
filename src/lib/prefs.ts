import { useSyncExternalStore } from 'react'

/** Small per-device preferences (not personal records). */
export interface Prefs {
  name: string
  text: 'normal' | 'large'
  motion: 'system' | 'reduce'
  welcomed: boolean
  /** Quick tour seen (or skipped). */
  toured: boolean
  /** Chapter suggestions the owner said “not now” to (milestone ids). */
  dismissedChapters: string[]
}

const KEY = 'atlas.prefs'
const DEFAULTS: Prefs = { name: '', text: 'normal', motion: 'system', welcomed: false, toured: false, dismissedChapters: [] }
const listeners = new Set<() => void>()

function read(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return DEFAULTS
  }
}
let cache = read()

export function applyPrefs(p: Prefs = cache) {
  document.documentElement.dataset.text = p.text
  document.documentElement.dataset.motion = p.motion
}

export function setPrefs(patch: Partial<Prefs>) {
  cache = { ...cache, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    /* private mode — keep in memory */
  }
  applyPrefs(cache)
  listeners.forEach((l) => l())
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => cache,
  )
}
