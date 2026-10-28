import { useState } from 'react'
import { HashRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { FeedbackProvider, Sheet } from './ui/primitives'
import { IconArchive, IconDreams, IconHome, IconMap, IconMe, IconPlus } from './ui/icons'
import { TypePicker } from './screens/AddSheet'
import Home from './screens/Home'
import MapScreen from './screens/MapScreen'
import Dreams from './screens/Dreams'
import Archive from './screens/Archive'
import Me from './screens/Me'
import EntryForm from './screens/EntryForm'
import { AdventureDetail, DreamDetail, MemoryDetail, MilestoneDetail, PlaceDetail } from './screens/details'
import Welcome from './screens/Welcome'
import Guide from './screens/Guide'
import { ChapterDetail, ChapterForm } from './screens/Chapters'
import { Tour } from './ui/Tour'
import { isDemoMode } from './db/db'
import { exitDemo } from './db/demo'
import { usePrefs } from './lib/prefs'

const TABS = [
  { to: '/', label: 'Home', Icon: IconHome, end: true },
  { to: '/map', label: 'Map', Icon: IconMap },
  { to: '/dreams', label: 'Dreams', Icon: IconDreams },
  { to: '/archive', label: 'Archive', Icon: IconArchive },
  { to: '/me', label: 'Me', Icon: IconMe },
]
const PRIMARY = ['/', '/map', '/dreams', '/archive', '/me']

function Shell() {
  const loc = useLocation()
  const nav = useNavigate()
  const [adding, setAdding] = useState(false)
  const onPrimary = PRIMARY.includes(loc.pathname)
  const showTabs = onPrimary
  const showFab = onPrimary && loc.pathname !== '/map' // the map has its own + button
  const demo = isDemoMode()
  const { toured } = usePrefs()

  return (
    <>
      {demo && (
        <div className="demo-banner" role="note">
          <span>
            <b>Demo mode</b> — sample entries, not your data.
          </span>
          <button className="btn btn-sm btn-secondary" onClick={() => exitDemo()}>
            Exit demo
          </button>
        </div>
      )}
      <div className="app" style={showTabs ? undefined : { paddingBottom: 0 }}>
        <Routes>
          <Route path="/" element={<Home onAdd={() => setAdding(true)} />} />
          <Route path="/map" element={<MapScreen />} />
          <Route path="/dreams" element={<Dreams />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="/me" element={<Me />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/chapter/:id" element={<ChapterDetail />} />
          <Route path="/new/chapter" element={<ChapterForm />} />
          <Route path="/edit/chapter/:id" element={<ChapterForm />} />
          <Route path="/new/:type" element={<EntryForm />} />
          <Route path="/edit/:type/:id" element={<EntryForm />} />
          <Route path="/place/:id" element={<PlaceDetail />} />
          <Route path="/adventure/:id" element={<AdventureDetail />} />
          <Route path="/memory/:id" element={<MemoryDetail />} />
          <Route path="/milestone/:id" element={<MilestoneDetail />} />
          <Route path="/dream/:id" element={<DreamDetail />} />
          <Route path="*" element={<Home onAdd={() => setAdding(true)} />} />
        </Routes>
      </div>

      {showTabs && (
        <>
          {showFab && (
            <button className="fab" onClick={() => setAdding(true)} aria-label="Add an entry">
              <IconPlus />
            </button>
          )}
          <nav className="tabbar" aria-label="Main">
            <div className="tabbar-inner">
              {TABS.map(({ to, label, Icon, end }) => (
                <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
                  <Icon />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          </nav>
        </>
      )}

      {!toured && loc.pathname === '/' && <Tour />}

      <Sheet open={adding} onClose={() => setAdding(false)} label="Add to your atlas">
        <TypePicker
          onPick={(type) => {
            setAdding(false)
            nav(`/new/${type}`)
          }}
        />
      </Sheet>
    </>
  )
}

export default function App() {
  const prefs = usePrefs()
  return (
    <FeedbackProvider>
      {!prefs.welcomed && !isDemoMode() ? (
        <Welcome />
      ) : (
        <HashRouter>
          <Shell />
        </HashRouter>
      )}
    </FeedbackProvider>
  )
}
