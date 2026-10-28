# ATLAS — *a living map of your life.*

A private, offline-first personal adventure journal: places, adventures, memories,
milestones and dreams, on a real map — stored only on your own device.

**Status:** Phase 1 (MVP) — v0.1.0

---

## In plain English

- **What it is:** a web app ("PWA"). It runs in Safari/Chrome and can be added to your
  iPhone Home Screen, where it looks and works like a normal app — including offline.
- **Where your data lives:** in the browser's built‑in database *on that device*. No account,
  no server, no analytics. Photos are never uploaded.
- **Your safety net:** *Me → Export a backup* makes one `.zip` with every entry and every
  original photo. *Me → Restore from a backup* brings it all back (it checks the file first).
- **iPhone tip:** add ATLAS to your Home Screen (Share → *Add to Home Screen*). Safari can
  clear website data that hasn't been opened for a few weeks; Home Screen apps are kept.

## Learning the app

A one-minute **quick tour** runs the first time you open Home (replay it from Me → Help). The full
**How ATLAS works** guide — every tab, entry type, how they connect, and step-by-step recipes — is
under Me → Help, or the **?** button on Home.

## Run it on your computer

You need [Node.js](https://nodejs.org) (the "LTS" version) installed once.

```bash
npm install        # first time only — downloads the building blocks
npm run dev        # starts the app; open the address it prints (http://localhost:5173)
```

To open it on your iPhone while testing, run `npm run dev -- --host` and open the
"Network" address it prints on your phone (same Wi‑Fi). For the full installable/offline
experience on iPhone, the app needs to be hosted on an `https://` address — see *Next steps*.

## Tests

```bash
npm test           # data-safety tests: create/edit/delete, undo, photos, dreams, backup round-trip
npm run build && npm run preview   # then, in another window:
npm run e2e        # clicks through the whole app at iPhone size (needs Playwright installed)
```

## How it's built (for future Claude sessions)

| Piece | Choice | Why |
| --- | --- | --- |
| App | React + TypeScript + Vite | Widely supported, fast, easy for Claude to maintain |
| Local database | IndexedDB via Dexie | Works offline, stores photos, has versioned schema migrations |
| Map | Leaflet + CARTO Voyager tiles (free key, restricted to fernandovindas21.github.io; set in src/map/leaflet.ts) + filled countries (Natural Earth via world-atlas) + marker clustering | Light editorial style; falls back to OpenStreetMap if the key is removed |
| World search | Photon (OpenStreetMap), only when you press Search | No key; only search words are sent |
| Offline | Service worker (vite-plugin-pwa) | App works with no connection; viewed map tiles are cached |
| Fonts | Inter (UI) + Fraunces (editorial headings), bundled | No external font requests |

```
src/
  db/        types.ts (data model) · db.ts (schema + migrations) · repo.ts (CRUD, safe delete, undo,
             dream completion) · media.ts (photos) · backup.ts (export/import) · demo.ts
  screens/   Home, MapScreen, Dreams, Archive, Me, EntryForm, details, Welcome
  ui/        design primitives, icons, illustrations
  styles/    tokens.css (Modern Wanderlust design tokens) · app.css
  map/       Leaflet setup, location picker
e2e/         browser smoke test
```

### Design tokens (Modern Wanderlust — locked)

Ivory `#F5F0E6` · Sunshine `#E7B75F` · Coral `#D77C66` · Sea Glass `#78AEB0` · Charcoal `#414D45`,
with sand/sage used sparingly. For readable text, coral text uses `#B0533C` and primary buttons use
`#B85C45` (same hue, deeper, so white text passes accessibility contrast).

### Data rules

- Every record has an `id`, `createdAt`, `updatedAt`. Relationships are explicit ids.
- Deleting an entry deletes its own photos and **unlinks** (never deletes) related entries; undo restores all.
- Completing a dream keeps the dream and links it to the new adventure/memory (both directions).
- Demo data lives in a **separate database** (`atlas-demo`) and is labelled everywhere.

### Backup format (`the-atlas-backup`, v1)

A `.zip` containing `manifest.json` (versions, counts, SHA‑256 of every file), `data.json`
(all records + photo metadata), `media/originals/*` (photos exactly as added),
`media/thumbs/*` (previews), `README.txt`. Restore verifies every checksum before writing and runs
in one transaction. **Merge** keeps the most recently edited copy of each entry; **Replace** makes
the device match the backup.

## Known limitations (honest list)

- Chapters exist in the data model but have no screens yet (Phase 2).
- Map tiles need internet unless you've viewed that area before.
- Photo previews are re-encoded (no metadata); originals are stored untouched — including any
  location data inside them. Stripping metadata for *sharing* is planned with sharing features.
- HEIC photos: iPhone usually converts to JPEG when picking; if a preview can't be made, the
  original is still saved.
- Your name and display preferences are per‑device and not in the backup yet.
- No dark theme yet.

## Next steps

Phase 1 finish-up: host on a private `https://` address for iPhone install, real-device testing.
Phase 2: chapters, richer galleries, trip checklists, On This Day, yearly recaps.
