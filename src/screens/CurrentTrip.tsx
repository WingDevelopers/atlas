import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { createEntry, todayIso, updateEntry } from '../db/repo'
import { addPhotos } from '../db/media'
import type { Adventure } from '../db/types'
import type { AllData } from '../lib/queries'
import { coverOf } from '../lib/queries'
import { daysBetween, tripDayLabel } from '../lib/trips'
import { fmtDate } from '../lib/format'
import { PlaceSearch } from '../map/PlaceSearch'
import { Art } from '../ui/Art'
import { Photo, Sheet, useConfirm, useToast } from '../ui/primitives'
import { IconCamera, IconCheck, IconPin, IconSparkle } from '../ui/icons'

/** Home, while you're on an adventure: where you are in it, and quick ways to capture it. */
export function CurrentTrip({ trip, data }: { trip: Adventure; data: AllData }) {
  const today = todayIso()
  const toast = useToast()
  const confirm = useConfirm()
  const photoInput = useRef<HTMLInputElement>(null)
  const [nextStop, setNextStop] = useState(false)
  const [busy, setBusy] = useState(false)

  const stops = trip.placeIds.map((id) => data.places.find((p) => p.id === id)).filter(Boolean) as AllData['places']
  const lastStop = stops[stops.length - 1]
  const momentsToday = data.memories.filter((m) => m.adventureId === trip.id && m.date === today).length
  const moments = data.memories.filter((m) => m.adventureId === trip.id).length
  const cover = coverOf(trip)
  const sortedPlaces = [...data.places].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <section aria-label="Your current adventure">
      <Link to={`/adventure/${trip.id}`} className={`hero grain${cover ? '' : ' art'}`} style={{ minHeight: 300 }}>
        {cover ? <Photo id={cover} variant="full" /> : <Art seed={trip.id} />}
        <div className="hero-content" style={{ position: 'relative' }}>
          <div className="eyebrow">
            <span className="live-dot" aria-hidden /> On an adventure · {tripDayLabel(trip, today)}
          </div>
          <h2>{trip.title}</h2>
          <p>
            {lastStop ? `Now in ${lastStop.name}` : 'Where are you? Set your current stop.'}
            {stops.length > 1 && ` · after ${stops.slice(0, -1).map((s) => s.name).join(', ')}`}
            {moments > 0 && ` · ${moments} ${moments === 1 ? 'moment' : 'moments'}`}
          </p>
        </div>
      </Link>

      <div className="trip-actions" role="group" aria-label="Quick add to this adventure">
        <Link to={`/new/memory?adventure=${trip.id}${lastStop ? `&place=${lastStop.id}` : ''}`} className="trip-action">
          <span className="ic" style={{ background: 'var(--sea-tint)', color: '#2d5c5e' }}>
            <IconSparkle />
          </span>
          Add a moment
          {momentsToday > 0 && <span className="xs muted">{momentsToday} today</span>}
        </Link>
        <button type="button" className="trip-action" onClick={() => photoInput.current?.click()} disabled={busy}>
          <span className="ic" style={{ background: 'var(--coral-tint)', color: '#8d3f2c' }}>
            <IconCamera />
          </span>
          {busy ? 'Adding…' : 'Add photos'}
        </button>
        <button type="button" className="trip-action" onClick={() => setNextStop(true)}>
          <span className="ic" style={{ background: 'var(--sun-tint)', color: '#7a5517' }}>
            <IconPin />
          </span>
          Current stop
          {lastStop && <span className="xs muted">{lastStop.name}</span>}
        </button>
        <button
          type="button"
          className="trip-action"
          onClick={async () => {
            const early = trip.endDate && trip.endDate > today
            const ok = await confirm({
              title: early ? 'Home early?' : 'Back home?',
              text: `“${trip.title}” will end today, ${fmtDate(today)}. You can change the dates any time.`,
              confirmLabel: 'End adventure today',
            })
            if (!ok) return
            await updateEntry('adventure', trip.id, { endDate: today, homeAt: new Date().toISOString() })
            toast({ message: 'Welcome home. Your adventure is in the Archive.' })
          }}
        >
          <span className="ic" style={{ background: 'var(--sage-tint)', color: '#45533a' }}>
            <IconCheck />
          </span>
          I’m home
        </button>
      </div>
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (!files.length) return
          setBusy(true)
          try {
            await addPhotos('adventure', trip.id, files)
            toast({ message: `${files.length} ${files.length === 1 ? 'photo' : 'photos'} added to ${trip.title}.` })
          } catch (err) {
            toast({ message: (err as Error).message })
          } finally {
            setBusy(false)
          }
        }}
      />

      <Sheet open={nextStop} onClose={() => setNextStop(false)} label="Set your current stop">
        <h2>Where are you now?</h2>
        <p className="small muted">
          {lastStop ? `Moved on from ${lastStop.name}? ` : ''}Your current stop is added to “{trip.title}” and coloured on your map.
        </p>
        <div style={{ marginTop: 'var(--s4)', minHeight: 280 }}>
          <PlaceSearch
            places={sortedPlaces}
            exclude={trip.placeIds}
            autoFocus
            label="Current stop — search"
            onPickExisting={async (p) => {
              await updateEntry('adventure', trip.id, { placeIds: [...trip.placeIds, p.id] })
              if (p.status === 'wishlist') await updateEntry('place', p.id, { status: 'visited', visitedOn: p.visitedOn ?? today })
              setNextStop(false)
              toast({ message: `${p.name} added.` })
            }}
            onPickNew={async (r) => {
              const p = await createEntry('place', {
                name: r.name,
                status: 'visited',
                visitedOn: today,
                lat: Math.round(r.lat * 1e5) / 1e5,
                lng: Math.round(r.lng * 1e5) / 1e5,
                country: r.country,
                region: r.region,
              })
              await updateEntry('adventure', trip.id, { placeIds: [...trip.placeIds, p.id] })
              setNextStop(false)
              toast({ message: `${p.name} added.` })
            }}
          />
        </div>
      </Sheet>
    </section>
  )
}

/** A quiet note when an adventure starts soon. */
export function UpcomingTrip({ trip }: { trip: Adventure }) {
  const days = daysBetween(todayIso(), trip.startDate)
  return (
    <Link to={`/adventure/${trip.id}`} className="upcoming">
      <span className="count display">{days}</span>
      <span className="body">
        <span className="eyebrow">{days === 1 ? 'day to go' : 'days to go'}</span>
        <b>{trip.title}</b>
      </span>
    </Link>
  )
}
