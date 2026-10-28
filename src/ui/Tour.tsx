import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { setPrefs } from '../lib/prefs'
import { IconArchive, IconCompassMark, IconDreams, IconMap, IconMe, IconPlus } from './icons'

interface Step {
  /** What to highlight: a tab path, the + button, or nothing. */
  target?: '/map' | '/dreams' | '/archive' | '/me' | 'fab'
  icon: ReactNode
  title: string
  text: string
}

const STEPS: Step[] = [
  {
    icon: <IconCompassMark style={{ width: 30, height: 30 }} />,
    title: 'Welcome to ATLAS',
    text: 'A private map of your life — places, adventures, memories and dreams. Here’s the tour in under a minute.',
  },
  {
    target: 'fab',
    icon: <IconPlus />,
    title: 'Add anything with +',
    text: 'Pick Adventure, Memory, Place, Dream or Milestone. A title is enough — add photos and details now or later.',
  },
  {
    target: '/map',
    icon: <IconMap />,
    title: 'Map',
    text: 'Places with a pin appear here: coral for visited, sea glass for wishlist. Tap a pin to see everything that happened there.',
  },
  {
    target: '/dreams',
    icon: <IconDreams />,
    title: 'Dreams',
    text: 'Things you haven’t done. Yet. Move them from Someday to Booked — and when one comes true, turn it into an adventure.',
  },
  {
    target: '/archive',
    icon: <IconArchive />,
    title: 'Archive',
    text: 'Your adventures, memories and milestones as a timeline, year by year, with search and filters.',
  },
  {
    target: '/me',
    icon: <IconMe />,
    title: 'Me & backups',
    text: 'Everything stays on this device. Export a backup from Me now and then — and find the full guide there any time.',
  },
]

/**
 * A short, skippable first-run tour. It dims the screen, highlights one
 * part of the tab bar at a time and explains it in a sentence.
 */
export function Tour() {
  const [i, setI] = useState(0)
  const nav = useNavigate()
  const card = useRef<HTMLDivElement>(null)
  const step = STEPS[i]
  const last = i === STEPS.length - 1

  useEffect(() => {
    const root = document.documentElement
    root.dataset.tour = step.target ?? 'none'
    card.current?.focus()
    return () => {
      delete root.dataset.tour
    }
  }, [step.target])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
      if (e.key === 'ArrowRight' && !last) setI((n) => n + 1)
      if (e.key === 'ArrowLeft' && i > 0) setI((n) => n - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function finish(toGuide = false) {
    setPrefs({ toured: true })
    if (toGuide) nav('/guide')
  }

  return (
    <>
      <div className="tour-backdrop" onClick={() => finish()} />
      <div className="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text" tabIndex={-1} ref={card} key={i}>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <span className="tour-ic">{step.icon}</span>
          <span className="spacer" />
          <button className="btn btn-ghost btn-sm" onClick={() => finish()}>
            Skip
          </button>
        </div>
        <h2 id="tour-title" className="display">
          {step.title}
        </h2>
        <p id="tour-text">{step.text}</p>
        <div className="row" style={{ marginTop: 'var(--s5)' }}>
          <div className="tour-dots" aria-label={`Step ${i + 1} of ${STEPS.length}`}>
            {STEPS.map((_, n) => (
              <span key={n} className={n === i ? 'on' : ''} />
            ))}
          </div>
          <span className="spacer" />
          {i > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={() => setI(i - 1)}>
              Back
            </button>
          )}
          {last ? (
            <button className="btn btn-primary btn-sm" onClick={() => finish()}>
              Start exploring
            </button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => setI(i + 1)}>
              Next
            </button>
          )}
        </div>
        {last && (
          <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop: 8 }} onClick={() => finish(true)}>
            Read the full guide
          </button>
        )}
      </div>
    </>
  )
}
