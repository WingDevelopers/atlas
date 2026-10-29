import type { EntryType } from '../db/types'
import { IconBook, IconDreams, IconFlag, IconLayers, IconPin, IconSparkle } from '../ui/icons'

const TYPES: { type: EntryType | 'chapter'; label: string; hint: string; Icon: typeof IconPin; bg: string; fg: string }[] = [
  { type: 'adventure', label: 'Adventure', hint: 'A trip or outing, one place or many', Icon: IconBook, bg: 'var(--coral-tint)', fg: 'var(--coral-ink)' },
  { type: 'memory', label: 'Memory', hint: 'A moment worth keeping', Icon: IconSparkle, bg: 'var(--turquoise-tint)', fg: 'var(--turquoise-ink)' },
  { type: 'place', label: 'Place', hint: 'Somewhere you’ve been or want to go', Icon: IconPin, bg: 'var(--sun-tint)', fg: 'var(--sun-ink)' },
  { type: 'dream', label: 'Dream', hint: 'Something you haven’t done. Yet.', Icon: IconDreams, bg: 'var(--forest-tint)', fg: 'var(--forest)' },
  { type: 'milestone', label: 'Milestone', hint: 'A life moment — a move, a first', Icon: IconFlag, bg: 'var(--sand-soft)', fg: 'var(--forest)' },
  { type: 'chapter', label: 'Chapter', hint: 'A season of your life — group entries under one name', Icon: IconLayers, bg: 'var(--sun-tint)', fg: 'var(--sun-ink)' },
]

export function TypePicker({ onPick }: { onPick: (t: EntryType | 'chapter') => void }) {
  return (
    <div>
      <h2>Add to your atlas</h2>
      <p className="muted small">Just a title is enough. Add the rest whenever you like.</p>
      <div className="type-grid">
        {TYPES.map(({ type, label, hint, Icon, bg, fg }, i) => (
          <button key={type} className={`type-card${i >= TYPES.length - 2 && TYPES.length % 2 === 0 ? '' : i === TYPES.length - 1 ? ' wide' : ''}`} onClick={() => onPick(type)}>
            <span className="ic" style={{ background: bg, color: fg }}>
              <Icon />
            </span>
            <div>
              <b>{label}</b>
              <br />
              <span>{hint}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
