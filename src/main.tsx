import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/index.css'
import '@fontsource-variable/fraunces/full.css'
import 'leaflet/dist/leaflet.css'
import './styles/tokens.css'
import './styles/app.css'
import App from './App'
import { applyPrefs } from './lib/prefs'

applyPrefs()

// Ask the browser to keep our data even when storage is tight.
navigator.storage?.persist?.().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
