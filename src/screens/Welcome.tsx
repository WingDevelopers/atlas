import { useState } from 'react'
import { Art } from '../ui/Art'
import { IconCompassMark } from '../ui/icons'
import { setPrefs } from '../lib/prefs'
import { enterDemo } from '../db/demo'

export default function Welcome() {
  const [step, setStep] = useState<'intro' | 'name'>('intro')
  const [name, setName] = useState('')

  return (
    <main className="welcome">
      <section className="hero art grain">
        <Art scene="coast" seed="welcome" />
        <div className="hero-content" style={{ position: 'relative' }}>
          <div className="wordmark" style={{ color: '#fff', marginBottom: 'var(--s4)' }}>
            <IconCompassMark style={{ width: 28, height: 28 }} />
            <span>ATLAS<span className="dot" style={{ color: "var(--sunshine)" }}>.</span></span>
          </div>
          <h2>A living map of your life.</h2>
          <p>Places, adventures, memories and dreams — kept privately, on this device.</p>
        </div>
      </section>
      <div className="actions">
        {step === 'intro' ? (
          <>
            <button className="btn btn-primary btn-block" onClick={() => setStep('name')}>
              Start my atlas
            </button>
            <button className="btn btn-secondary btn-block" onClick={() => enterDemo()}>
              Look around with sample data
            </button>
            <button className="btn btn-ghost btn-block" onClick={() => setPrefs({ welcomed: true })}>
              Skip
            </button>
          </>
        ) : (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault()
              setPrefs({ welcomed: true, name: name.trim() })
            }}
          >
            <div className="field">
              <label htmlFor="name">What should we call you? (optional)</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" autoComplete="given-name" autoFocus />
            </div>
            <button className="btn btn-primary btn-block" type="submit">
              Begin
            </button>
            <p className="xs muted" style={{ textAlign: 'center' }}>
              No account. No tracking. Your entries stay on this device unless you export them.
            </p>
          </form>
        )}
      </div>
    </main>
  )
}
