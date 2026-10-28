// End-to-end smoke test at iPhone size. Run: node e2e/smoke.mjs (with `npm run preview` running)
import { chromium, devices } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:4173/'
const OUT = process.env.SHOTS ?? 'e2e/shots'
fs.mkdirSync(OUT, { recursive: true })
const errors = []
const step = (m) => console.log('✓', m)

const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 14'], acceptDownloads: true })
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|tile/.test(m.text()) && errors.push(m.text()))
// Offline-friendly test: fake map tiles + world search
await page.route(/basemaps\.cartocdn\.com/, (r) => r.fulfill({ path: 'public/icon-192.png' }).catch(() => {}))
await page.route(/photon\.komoot\.io/, (r) =>
  r.fulfill({ json: { features: [{ geometry: { coordinates: [-9.1393, 38.7223] }, properties: { name: 'Lisbon', country: 'Portugal', state: 'Lisbon' } }] } }),
)
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` })

await page.goto(BASE)
await page.getByText('A living map of your life.').waitFor()
await shot('01-welcome')
await page.getByRole('button', { name: 'Start my atlas' }).click()
await page.getByLabel('What should we call you? (optional)').fill('Fer')
await page.getByRole('button', { name: 'Begin' }).click()
await page.getByText('Go somewhere. Feel something.').waitFor()
await shot('02-home-empty')
step('onboarding + empty home')

// Quick capture: memory with only a title
await page.getByRole('button', { name: 'Add an entry' }).click()
await page.getByRole('dialog', { name: 'Add to your atlas' }).getByRole('button', { name: /Memory/ }).click()
await page.locator('#title').fill('First coffee in the new kitchen')
await page.getByRole('button', { name: 'Save' }).click()
await page.getByRole('heading', { name: 'First coffee in the new kitchen' }).waitFor()
step('memory in one title')

// Place with world search + photo
await page.goto(BASE + '#/new/place')
await page.locator('#title').fill('')
await page.getByLabel('Search the world map').fill('Lisbon')
await page.getByRole('button', { name: 'Search', exact: true }).click()
await page.getByRole('button', { name: /Lisbon/ }).first().click()
await page.locator('input[type=file]').setInputFiles('public/icon-512.png')
await page.waitForTimeout(300)
await shot('03-place-form')
await page.getByRole('button', { name: 'Save' }).click()
await page.getByRole('heading', { name: 'Lisbon' }).waitFor()
await shot('04-place-detail')
step('place with pin + photo')

// Wishlist place
await page.goto(BASE + '#/new/place?status=wishlist&lat=35.0116&lng=135.7681')
await page.locator('#title').fill('Kyoto')
await page.getByRole('button', { name: 'Save' }).click()
await page.getByRole('heading', { name: 'Kyoto' }).waitFor()

// Adventure linked to Lisbon with story
await page.goto(BASE + '#/new/adventure')
await page.locator('#title').fill('Spring in Lisbon')
await page.locator('#startDate').fill('2026-04-10')
await page.locator('#endDate').fill('2026-04-16')
await page.getByRole('button', { name: /More details/ }).click()
await page.getByRole('button', { name: 'Lisbon', exact: true }).click()
await page.locator('#story').fill('Trams, tiles, and long golden evenings.')
await page.locator('#highlight').fill('The city turned gold at 8pm.')
await page.locator('input[type=file]').setInputFiles(['public/icon-512.png', 'public/apple-touch-icon.png'])
await page.getByRole('button', { name: 'Save' }).click()
await page.getByRole('heading', { name: 'Spring in Lisbon' }).waitFor()
await shot('05-adventure-detail')
step('adventure with places + photos')

// Milestone + dream without place, then complete dream into adventure
await page.goto(BASE + '#/new/milestone')
await page.locator('#title').fill('Started The Atlas')
await page.getByRole('button', { name: 'Save' }).click()
await page.getByRole('heading', { name: 'Started The Atlas' }).waitFor()
await page.goto(BASE + '#/new/dream')
await page.locator('#title').fill('Learn to surf')
await page.getByRole('button', { name: 'Skill' }).click()
await page.getByRole('button', { name: 'Save' }).click()
await page.getByRole('heading', { name: 'Learn to surf' }).waitFor()
await shot('06-dream-detail')
await page.getByRole('button', { name: 'I did it' }).click()
await page.getByRole('button', { name: 'Create an adventure' }).click()
await page.getByText('Your dream will be marked complete').waitFor()
await page.getByRole('button', { name: 'Save' }).click()
await page.getByRole('link', { name: 'Learn to surf' }).waitFor() // "From a dream" link on adventure
await page.getByRole('link', { name: 'Learn to surf' }).click()
await page.getByText('You did it', { exact: true }).waitFor()
step('dream → linked adventure, dream preserved')

// Tabs
await page.goto(BASE + '#/')
await page.getByText('Postcards from your life').waitFor()
await page.waitForTimeout(400)
await shot('07-home')
await page.getByRole('link', { name: 'Dreams' }).last().click()
await shot('08-dreams')
await page.getByRole('link', { name: 'Archive' }).last().click()
await page.getByRole('heading', { name: '2026' }).waitFor()
await shot('09-archive')
await page.getByRole('link', { name: 'Map' }).last().click()
await page.waitForSelector(".atlas-pin"); await page.waitForTimeout(700)
const pins = await page.locator('.atlas-pin').count()
if (pins !== 2) throw new Error(`expected 2 pins, got ${pins}`)
await page.getByRole('button', { name: 'Wishlist' }).click()
await page.waitForTimeout(200)
if ((await page.locator('.atlas-pin').count()) !== 1) throw new Error('wishlist filter failed')
await page.getByRole('button', { name: 'All' }).click()
await page.locator('.atlas-pin.visited').first().click()
await page.getByRole('link', { name: 'View memories' }).waitFor()
await shot('10-map')
step('map pins, filter, preview')

// Delete with undo
await page.goto(BASE + '#/')
await page.goto(BASE + '#/archive')
await page.getByRole('link', { name: /First coffee/ }).click()
await page.getByRole('button', { name: 'Delete memory' }).click()
await page.getByRole('button', { name: 'Delete', exact: true }).click()
await page.getByRole('button', { name: 'Undo' }).click()
await page.waitForTimeout(300)
await page.goto(BASE + '#/archive')
await page.getByRole('link', { name: /First coffee/ }).waitFor()
step('delete + undo')

// Persistence across reload
await page.reload()
await page.getByRole('link', { name: /Spring in Lisbon/ }).waitFor()
step('data persists after restart')

// Export, wipe, restore
await page.goto(BASE + '#/me')
await shot('11-me')
const dl = page.waitForEvent('download')
await page.getByRole('button', { name: /^Export a backup/ }).click()
const file = await dl
const zipPath = `${OUT}/backup.zip`
await file.saveAs(zipPath)
await page.getByRole('button', { name: /^Delete everything/ }).click()
await page.getByRole('button', { name: 'Delete everything' }).last().click()
await page.goto(BASE + '#/archive')
await page.getByText('Every story starts somewhere.').waitFor()
await page.goto(BASE + '#/me')
await page.locator('input[accept*="zip"]').setInputFiles(zipPath)
await page.getByText('Backup looks good').waitFor()
await page.getByRole('button', { name: 'Replace everything' }).click()
await page.getByRole('button', { name: 'Replace' }).last().click()
await page.getByText(/Restored:/).waitFor()
await page.goto(BASE + '#/adventure/' + '')
await page.goto(BASE + '#/archive')
await page.getByRole('link', { name: /Spring in Lisbon/ }).click()
await page.locator('.gallery img').first().waitFor()
const imgs = await page.locator('.gallery img').count()
if (imgs !== 2) throw new Error(`expected 2 restored photos, got ${imgs}`)
step('export → wipe → restore (photos intact)')

// Offline: reload with network off (service worker)
await ctx.setOffline(true)
await page.reload()
await page.getByRole('heading', { name: 'Spring in Lisbon' }).waitFor()
step('works offline')
await ctx.setOffline(false)

await browser.close()
if (errors.length) {
  console.error('Page errors:\n' + errors.join('\n'))
  process.exit(1)
}
console.log('All smoke checks passed.')
