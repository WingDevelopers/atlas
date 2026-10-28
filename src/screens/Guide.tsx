import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BackBar } from '../ui/primitives'
import {
  IconArchive,
  IconBook,
  IconCalendar,
  IconCamera,
  IconDreams,
  IconDownload,
  IconFlag,
  IconHome,
  IconMap,
  IconMe,
  IconPin,
  IconPlus,
  IconShield,
  IconSparkle,
} from '../ui/icons'
import { setPrefs } from '../lib/prefs'
import { isDemoMode } from '../db/db'
import { enterDemo } from '../db/demo'

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function Section({ id, eyebrow, title, intro, children }: { id: string; eyebrow: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section className="guide-section" id={id} aria-labelledby={`${id}-h`}>
      <div className="eyebrow">{eyebrow}</div>
      <h2 id={`${id}-h`}>{title}</h2>
      {intro && <p className="guide-intro">{intro}</p>}
      {children}
    </section>
  )
}

function Fold({ icon, tint, title, sub, children, open }: { icon: ReactNode; tint: string; title: string; sub?: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="fold" open={open}>
      <summary>
        <span className="ic" style={{ background: tint }}>
          {icon}
        </span>
        <span className="body">
          <b>{title}</b>
          {sub && <span>{sub}</span>}
        </span>
        <span className="chev" aria-hidden>
          ›
        </span>
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  )
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="guide-steps">
      {items.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ol>
  )
}

function Try({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="btn btn-sea btn-sm guide-try">
      {children}
    </Link>
  )
}

const T = {
  coral: 'var(--coral-tint)',
  sea: 'var(--sea-tint)',
  sun: 'var(--sun-tint)',
  sage: 'var(--sage-tint)',
  sand: 'var(--sand-soft)',
}

/* ------------------------------------------------------------------ */
/* Relationship diagram                                                */
/* ------------------------------------------------------------------ */

function Diagram() {
  const node = (x: number, y: number, w: number, label: string, sub: string, fill: string, stroke: string) => (
    <g>
      <rect x={x - w / 2} y={y - 26} width={w} height={52} rx={14} fill={fill} stroke={stroke} strokeWidth={1.5} />
      <text x={x} y={y - 3} textAnchor="middle" className="dg-label">
        {label}
      </text>
      <text x={x} y={y + 14} textAnchor="middle" className="dg-sub">
        {sub}
      </text>
    </g>
  )
  const line = (d: string, dashed = false) => <path d={d} fill="none" stroke="#414D45" strokeOpacity=".45" strokeWidth={1.6} strokeDasharray={dashed ? '5 5' : undefined} markerEnd="url(#arrow)" />
  const tag = (x: number, y: number, t: string) => (
    <text x={x} y={y} textAnchor="middle" className="dg-tag">
      {t}
    </text>
  )
  return (
    <figure className="diagram">
      <svg viewBox="0 0 360 330" role="img" aria-labelledby="dg-title dg-desc">
        <title id="dg-title">How entries connect</title>
        <desc id="dg-desc">
          A Place sits in the middle. Adventures can include many places. Memories can belong to one place and one adventure. Dreams can point at a place and, once completed, become an adventure or a memory. Milestones stand on their own in the timeline.
        </desc>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10z" fill="#414D45" fillOpacity=".55" />
          </marker>
        </defs>
        {/* links */}
        {line('M92 92 L152 146')}
        {tag(152, 114, 'visits many')}
        {line('M268 92 L208 146')}
        {tag(302, 126, 'happened at')}
        {line('M230 68 L126 68')}
        {tag(178, 60, 'part of')}
        {line('M92 244 L152 190', true)}
        {tag(150, 238, 'dreams of')}
        {line('M70 240 L70 98', true)}
        {tag(36, 166, 'becomes')}
        {/* nodes */}
        {node(70, 68, 104, 'Adventure', 'a trip or outing', '#F3DCD3', '#D77C66')}
        {node(286, 68, 108, 'Memory', 'one moment', '#D9E9E8', '#78AEB0')}
        {node(180, 168, 104, 'Place', 'a pin on the map', '#F6E7C6', '#E7B75F')}
        {node(70, 268, 104, 'Dream', 'not done… yet', '#E3E8DB', '#8FA08A')}
        {node(282, 268, 112, 'Milestone', 'a life moment', '#EFE7D8', '#B9A98A')}
        {tag(282, 312, 'no place needed')}
      </svg>
      <figcaption className="xs muted">Solid lines are links you set. Dashed lines are optional or happen when a dream comes true.</figcaption>
    </figure>
  )
}

/* ------------------------------------------------------------------ */
/* Guide                                                               */
/* ------------------------------------------------------------------ */

export default function Guide() {
  const nav = useNavigate()
  const demo = isDemoMode()

  return (
    <main className="page guide">
      <BackBar title="How ATLAS works" />

      <div className="guide-hero pad">
        <h1 className="display">Five kinds of entries. One living map.</h1>
        <p className="muted">Everything you add lands in the right places automatically: on the map, in your timeline, on the Home screen. This guide shows what each part does and how they fit together.</p>
        <nav className="guide-toc" aria-label="Guide sections">
          <a href="#big-picture">The big picture</a>
          <a href="#tabs">The five tabs</a>
          <a href="#adding">Adding things</a>
          <a href="#types">Entry types</a>
          <a href="#howto">How to…</a>
          <a href="#safe">Keeping it safe</a>
        </nav>
      </div>

      {/* ---------------------------------------------------------------- */}
      <Section id="big-picture" eyebrow="01" title="The big picture" intro="ATLAS keeps five kinds of entries. They're separate things, but you can link them — and links are what make the map, timeline and detail pages come alive.">
        <Diagram />
        <ul className="guide-list">
          <li>
            <b>A Place is a location</b>, not an event. Lisbon is a place; “a week in Lisbon” is an adventure.
          </li>
          <li>
            <b>Adventures</b> can include several places, and collect the memories that happened during them.
          </li>
          <li>
            <b>Memories</b> can stand alone, or point at one place and one adventure.
          </li>
          <li>
            <b>Dreams</b> don’t need a place at all. When you complete one, ATLAS can turn it into an adventure or memory — and keeps the dream, linked both ways.
          </li>
          <li>
            <b>Milestones</b> mark life moments (a move, a new job, a first) and live in your timeline.
          </li>
        </ul>
        <p className="note">Links are always optional. You can add them now, later, or never — nothing breaks.</p>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section id="tabs" eyebrow="02" title="The five tabs" intro="The bar at the bottom takes you around. Each tab is a different view of the same entries.">
        <div className="stack" style={{ gap: 10 } as never}>
          <Fold icon={<IconHome />} tint={T.coral} title="Home" sub="Your latest story at a glance">
            <p>The big photo shows your most recent adventure — tap it to open. Below it, three totals (places visited, memories, dreams), then <b>Postcards from your life</b>: your recent adventures and memories, newest first. <b>Next, maybe?</b> suggests a dream, starting with ones you’ve booked or are planning.</p>
            <p>Every number on Home is counted from your own entries. Tap a number to jump to that tab.</p>
          </Fold>
          <Fold icon={<IconMap />} tint={T.sun} title="Map" sub="Every place with a pin">
            <p>
              Countries you’ve <b>visited</b> fill with coral; countries only on your <b>wishlist</b> fill with sea glass (visited wins if both). Tap a country to see your places there.
            </p>
            <p>
              <b>Zoom in</b> and the countries go back to normal: now each <b>place itself</b> is coloured — its real outline, like Orlando’s city limits. Very small places show a dot until you zoom closer. A place still waiting for its outline (it’s fetched once, online) shows as a soft dashed circle.
            </p>
            <ul className="guide-list">
              <li>
                <b>Search your places</b> at the top (works offline).
              </li>
              <li>
                <b>All / Visited / Wishlist</b> filters the pins. Year and category filters appear once your places have dates or categories.
              </li>
              <li>
                <b>Tap a country</b> for the list of places there, or <b>Zoom in</b>. <b>Tap a place’s area</b> for a preview → <b>View memories</b> opens the full place page.
              </li>
              <li>
                <b>Press and hold</b> anywhere on the map (right‑click on a computer) to add a place right there. The <b>+</b> next to search adds one too.
              </li>
            </ul>
            <p className="xs muted">A place colours its country from its pin — or, if it has no pin, from its Country field. Without either, it simply doesn’t appear on the map.</p>
          </Fold>
          <Fold icon={<IconDreams />} tint={T.sage} title="Dreams" sub="Things you haven’t done. Yet.">
            <p>
              Your bucket list. Filter by status: <b>Someday → Planning → Booked → Completed</b>. “Still dreaming” shows everything not yet done. Open a dream to change its status with one tap, or press <b>I did it</b>.
            </p>
          </Fold>
          <Fold icon={<IconArchive />} tint={T.sea} title="Archive" sub="Your timeline, year by year — and your chapters">
            <p>
              <b>Timeline</b> shows adventures, memories and milestones in date order, newest first, grouped by year. Entries without a date sit at the end under “Undated”. Use the search box (it looks inside titles, stories, people and tags) and the filters: Adventures, Memories, Milestones or Favourites.
            </p>
            <p>
              <b>Chapters</b> (the switch at the top) shows the seasons of your life you’ve named — see “Chapters” below.
            </p>
            <p className="xs muted">Places and dreams aren’t in the timeline — they live on the Map and Dreams tabs.</p>
          </Fold>
          <Fold icon={<IconMe />} tint={T.sand} title="Me" sub="Totals, backup, settings, this guide">
            <p>Your full totals (including countries, taken from the Country field of visited places), plus <b>Backup</b>, preferences (your name, text size, motion), photo storage, privacy, demo mode and reset. This guide and the quick tour live here too.</p>
          </Fold>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section id="adding" eyebrow="03" title="Adding things in 30 seconds" intro="Capture first, details later. Only a title is required — and a date for adventures and milestones (it starts as today).">
        <Steps
          items={[
            <>
              Tap the coral <b>+</b> (bottom right on Home, Dreams, Archive and Me — or next to search on the Map).
            </>,
            <>Pick what you’re adding: Adventure, Memory, Place, Dream or Milestone.</>,
            <>Type a title. Add photos if you like.</>,
            <>
              Tap <b>Save</b>. Done.
            </>,
          ]}
        />
        <p>
          Want more? Tap <b>+ More details</b> on the form for the story, people, places, tags and everything else. You can always come back with the <b>pencil</b> (top right of any entry) or the <b>Edit</b> button at the bottom.
        </p>
        <div className="row wrap">
          <Try to="/new/memory">
            <IconPlus /> Try: add a memory
          </Try>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section id="types" eyebrow="04" title="The five entry types" intro="What each one is for, what you can fill in, and where it shows up.">
        <div className="stack" style={{ gap: 10 } as never}>
          <Fold icon={<IconBook />} tint={T.coral} title="Adventure" sub="A trip or outing — one place or many">
            <dl className="guide-dl">
              <dt>Fill in</dt>
              <dd>Title, start date (end date optional), <b>Where?</b> (one or several places — pick yours or search a city or country), photos. More details: the story, “What I’ll remember” (a single line or quote), who was there, tags.</dd>
              <dt>Shows up</dt>
              <dd>Home hero (if it’s your latest), Postcards, Archive, and on the page of every place it’s linked to.</dd>
              <dt>Connects to</dt>
              <dd>Many places · many memories · the dream it came from.</dd>
            </dl>
            <p className="xs muted">On an adventure’s page, “Add a memory to this adventure” links the new memory automatically.</p>
            <Try to="/new/adventure">Try: new adventure</Try>
          </Fold>
          <Fold icon={<IconSparkle />} tint={T.sea} title="Memory" sub="One moment worth keeping">
            <dl className="guide-dl">
              <dt>Fill in</dt>
              <dd>Title, optional date, <b>Where?</b>, photos. More details: time, the story, the adventure it belongs to, people, tags, favourite ♥.</dd>
              <dt>Shows up</dt>
              <dd>Postcards on Home, Archive (and the Favourites filter), its place’s page and its adventure’s page.</dd>
              <dt>Connects to</dt>
              <dd>One place · one adventure · the dream it came from.</dd>
            </dl>
            <Try to="/new/memory">Try: new memory</Try>
          </Fold>
          <Fold icon={<IconPin />} tint={T.sun} title="Place" sub="Somewhere you’ve been or want to go">
            <dl className="guide-dl">
              <dt>Fill in</dt>
              <dd>Name, Been there / Wishlist, and an optional pin. Search the world map, tap the map to drop a pin, or tap “Use my location”. More details: region, country, address, category, first‑visited date, notes, tags.</dd>
              <dt>Shows up</dt>
              <dd>Map (zoomed out its country fills with colour; zoomed in, the place’s own area does), the Places total on Home, and linked from adventures, memories and dreams.</dd>
              <dt>Its page shows</dt>
              <dd>Visit history (built from linked adventures and memories), every linked adventure, memory and dream, and “I’ve been here” for wishlist places.</dd>
            </dl>
            <p className="xs muted">Tip: while writing an adventure, memory or dream, type a name under “New place name…” to create a place on the spot. Add its pin later.</p>
            <Try to="/new/place">Try: new place</Try>
          </Fold>
          <Fold icon={<IconDreams />} tint={T.sage} title="Dream" sub="A destination, experience, skill — anything">
            <dl className="guide-dl">
              <dt>Fill in</dt>
              <dd>Title, kind (destination, experience, skill, other), status, photos, and — for destinations — <b>Where?</b>: pick one of your places or search a city, country or landmark. More details: why it matters, budget estimate, with whom, inspiration links, notes and planning, tags.</dd>
              <dt>Shows up</dt>
              <dd>Dreams tab, “Next, maybe?” on Home, its place’s page — and the map: a place found from a dream is saved to your wishlist, so its country turns sea glass. Tap that country and the dream is listed.</dd>
              <dt>When it comes true</dt>
              <dd>
                Press <b>I did it</b> → create an adventure, create a memory, or just mark it complete. The dream stays in your list as Completed, linked to what you created, and its place turns from wishlist to visited — sea glass becomes coral.
              </dd>
            </dl>
            <Try to="/new/dream">Try: new dream</Try>
          </Fold>
          <Fold icon={<IconFlag />} tint={T.sand} title="Milestone" sub="A life moment — no place needed">
            <dl className="guide-dl">
              <dt>Fill in</dt>
              <dd>Title, date, optional description and photos.</dd>
              <dt>Shows up</dt>
              <dd>Archive timeline (with a sunshine dot) and the Milestones filter.</dd>
              <dt>Also</dt>
              <dd>Milestones are where chapters begin. When you save a new one, ATLAS asks: <b>open a new chapter</b> from that day forward, or <b>keep going</b> in the chapter you’re in.</dd>
            </dl>
            <Try to="/new/milestone">Try: new milestone</Try>
          </Fold>
          <Fold icon={<IconArchive />} tint={T.sun} title="Chapter" sub="A named season of your life">
            <p>
              A chapter gathers adventures, memories and milestones under one name — “The Lisbon Years”, “Starting over”, “University”. It’s a way of reading your story, not a new kind of entry: nothing is copied or moved.
            </p>
            <dl className="guide-dl">
              <dt>Fill in</dt>
              <dd>Name, what it was about, from/until dates (leave “until” empty for the chapter you’re living now), the entries in it, and a cover from their photos.</dd>
              <dt>Gathers itself</dt>
              <dd>With <b>Gather entries by date automatically</b> on (the default for chapters opened from a milestone), everything dated inside the chapter joins it — including what you add later. You can still take entries out, or add older ones by hand.</dd>
              <dt>Shows up</dt>
              <dd>Archive → Chapters, and as “In chapters” on each entry’s page.</dd>
              <dt>Good to know</dt>
              <dd>An entry can belong to several chapters. Deleting a chapter never deletes its entries; deleting an entry just removes it from its chapters.</dd>
            </dl>
            <Try to="/archive?view=chapters">Try: open Chapters</Try>
          </Fold>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section id="howto" eyebrow="05" title="How to…" intro="Short recipes for the things you’ll do most.">
        <div className="stack" style={{ gap: 10 } as never}>
          <Fold icon={<IconBook />} tint={T.coral} title="Log a whole trip">
            <Steps
              items={[
                <>
                  <b>+ → Adventure.</b> Title (“Spring in Lisbon”) and dates.
                </>,
                <>
                  <b>Where?</b> — choose your places, or type a city or country and tap <b>Find</b>. Add each stop.
                </>,
                <>Add the story, a “What I’ll remember” line and your best photos. Save.</>,
                <>
                  On the adventure’s page, tap <b>Add a memory to this adventure</b> for each special moment.
                </>,
                <>Open each new place and add a pin so it appears on the map.</>,
              ]}
            />
          </Fold>
          <Fold icon={<IconCalendar />} tint={T.coral} title="A trip right now vs. places from before ATLAS">
            <p>ATLAS tells them apart by <b>dates</b> — everything lands in the right spot of your timeline and chapters.</p>
            <p>
              <b>On a trip today:</b> + → <b>Adventure</b>, start date today (leave the end empty), add the places as you go. Add <b>memories</b> to it day by day from the adventure’s page. When you’re home, edit it and set the end date.
            </p>
            <p>
              <b>Countries and cities from before:</b> + → <b>Place</b> → <b>Been there</b>, search it, and under More details set <b>First visited</b> to roughly when (the 1st of the month or year is fine). It colours the map right away.
            </p>
            <p>
              <b>A past trip worth its own story:</b> + → <b>Adventure</b> with its real (past) dates. It slots into the right year and is offered to the right chapter.
            </p>
            <p className="xs muted">Only adventures, memories and milestones live in the timeline and chapters. Places on their own colour the map and count towards your totals.</p>
          </Fold>
          <Fold icon={<IconPin />} tint={T.sun} title="Put a place on the map">
            <Steps
              items={[
                <>
                  Map → press and hold the spot (or <b>+</b> → Place).
                </>,
                <>Or search: type a city, park or address and pick a result. Search needs internet and only sends the words you typed.</>,
                <>
                  Choose <b>Been there</b> or <b>Wishlist</b>. Save — its country fills with coral or sea glass.
                </>,
                <>
                  Already have a place without a pin? Open it → <b>Add a pin</b>.
                </>,
              ]}
            />
          </Fold>
          <Fold icon={<IconDreams />} tint={T.sage} title="Turn a dream into an adventure">
            <Steps
              items={[
                <>Open the dream. Move its status along as plans firm up: Someday → Planning → Booked.</>,
                <>
                  When it happens, tap <b>I did it</b> → <b>Create an adventure</b> (or a memory).
                </>,
                <>The form opens pre‑filled with the dream’s title, place and companions. Add photos and the story, then Save.</>,
                <>The dream now says “You did it” and links to the adventure; the adventure shows “From a dream”.</>,
              ]}
            />
            <p className="xs muted">Marked it complete without writing it up? Open the dream — you can still create the adventure or memory later.</p>
          </Fold>
          <Fold icon={<IconPin />} tint={T.sea} title="Move a wishlist place to visited">
            <p>
              Open the place → <b>I’ve been here</b>. Its area — and its country — turn coral. Then add an adventure or memory linked to it so it gets a visit date.
            </p>
          </Fold>
          <Fold icon={<IconCamera />} tint={T.sand} title="Add photos and choose a cover">
            <p>
              On any form, tap <b>Add photos</b> and pick from your library (several at once is fine). The first photo becomes the cover; tap <b>Set cover</b> on another to change it, or <b>×</b> to remove one. Photos stay on this device — originals are kept untouched.
            </p>
          </Fold>
          <Fold icon={<IconSparkle />} tint={T.coral} title="Favourite a memory">
            <p>
              Open the memory and tap the <b>♥ Favourite</b> chip (or tick it under More details). Find them all in Archive → Favourites.
            </p>
          </Fold>
          <Fold icon={<IconArchive />} tint={T.sun} title="Divide your life into chapters">
            <Steps
              items={[
                <>
                  Add <b>milestones</b> for the turning points — a move, a new job, a graduation, a breakup, a birth.
                </>,
                <>
                  When you save a milestone, choose <b>Open a new chapter</b> (it runs from that day forward, and the chapter you were in ends the day before) or <b>Keep going</b> in your current chapter. Not sure? <b>Decide later</b> — the suggestion waits in <b>Archive → Chapters</b>.
                </>,
                <>
                  Adding milestones from before ATLAS? Each one is suggested in <b>Archive → Chapters</b> too: tap <b>Create</b> and it slots in between your other chapters, or <b>×</b> for “not now”.
                </>,
                <>Rename it to something that feels true, add a sentence about who you were then, and pick a cover.</>,
                <>
                  Use <b>Add entries</b> to include or remove anything, and ↑ ↓ (or <b>Sort by date</b>) to set the order.
                </>,
                <>
                  Prefer to start from scratch? <b>+ Chapter</b> at the top of the list.
                </>,
              ]}
            />
            <p className="xs muted">Chapters can overlap — “Living abroad” and “Learning to cook” can share the same years.</p>
          </Fold>
          <Fold icon={<IconArchive />} tint={T.sea} title="Find something">
            <p>
              <b>Archive search</b> looks through titles, stories, people, companions and tags. <b>Map search</b> looks through place names, regions, countries and tags.
            </p>
          </Fold>
          <Fold icon={<IconFlag />} tint={T.sand} title="Edit, delete and undo">
            <p>
              Open any entry → pencil (top right) or <b>Edit</b> at the bottom. <b>Delete</b> asks first, then shows <b>Undo</b> for a few seconds. Deleting removes that entry and its own photos only — linked entries are kept and simply unlinked.
            </p>
          </Fold>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section id="safe" eyebrow="06" title="Keeping it safe" intro="Your atlas lives only on this device. That keeps it private — and makes backups your safety net.">
        <div className="stack" style={{ gap: 10 } as never}>
          <Fold icon={<IconDownload />} tint={T.coral} title="Back up regularly" sub="Me → Export a backup" open>
            <p>
              Creates one <b>.zip</b> file with every entry and every original photo, checked before it’s handed to you. On iPhone, choose <b>Save to Files</b> and keep it in iCloud Drive or another safe place. A good rhythm: after each trip, or once a month.
            </p>
          </Fold>
          <Fold icon={<IconDownload />} tint={T.sea} title="Restore or move to a new phone" sub="Me → Restore from a backup">
            <p>ATLAS checks the whole file first and changes nothing if anything is damaged. Then choose:</p>
            <ul className="guide-list">
              <li>
                <b>Merge</b> — adds anything missing; if an entry exists in both, the most recently edited version wins.
              </li>
              <li>
                <b>Replace everything</b> — makes this device match the backup exactly.
              </li>
            </ul>
          </Fold>
          <Fold icon={<IconShield />} tint={T.sage} title="Privacy, in plain words">
            <ul className="guide-list">
              <li>No account, no analytics, no tracking. Photos are never uploaded.</li>
              <li>Your location is read only when you tap “Use my location”.</li>
              <li>Internet is used for map backgrounds, when you press Search (only your search words are sent), and once per pinned place to fetch its outline (only its name and pin are sent). After that, outlines are kept on your device.</li>
              <li>Each device and browser has its own separate atlas. Use backups to move between them.</li>
            </ul>
          </Fold>
          <Fold icon={<IconHome />} tint={T.sun} title="On iPhone">
            <ul className="guide-list">
              <li>
                Open ATLAS from its <b>Home Screen icon</b>, not a Safari tab — Safari may clear data for websites you haven’t visited in a while, but keeps it for Home Screen apps.
              </li>
              <li>Everything except the map background works with no signal. Areas of the map you’ve already viewed are remembered.</li>
              <li>
                Larger text and less motion: <b>Me → Preferences</b>.
              </li>
            </ul>
          </Fold>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <section className="guide-section">
        <div className="card card-pad stack">
          <h2 className="display" style={{ fontSize: 'var(--fs-xl)' }}>
            Practice first?
          </h2>
          <p className="small muted">The demo is a separate space filled with clearly labelled sample entries. Try anything there — your own atlas isn’t touched. Exit from the banner at the top.</p>
          <div className="row wrap">
            {!demo && (
              <button className="btn btn-primary btn-sm" onClick={() => enterDemo()}>
                Open the demo
              </button>
            )}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setPrefs({ toured: false })
                nav('/')
              }}
            >
              Replay the quick tour
            </button>
          </div>
        </div>
        <p className="xs muted" style={{ textAlign: 'center', marginTop: 'var(--s8)', paddingBottom: 'var(--s12)' }}>
          Your story continues.
        </p>
      </section>
    </main>
  )
}
