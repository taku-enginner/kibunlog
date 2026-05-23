import { chromium } from 'playwright'

const BASE_URL = 'http://localhost:3001'
const API_URL = 'http://localhost:18000'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.on('console', msg => console.log('BROWSER:', msg.type(), msg.text()))
page.on('pageerror', err => console.log('PAGE_ERROR:', err.message))
page.on('response', res => {
  if (res.status() >= 400) console.log('HTTP_ERROR:', res.status(), res.url())
})

// Login
const loginRes = await fetch(`${API_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'taku', password: 'test123' }),
})
const { token } = await loginRes.json()

await page.goto(BASE_URL + '/login')
await page.evaluate(({ token }) => {
  localStorage.setItem('kibunrogu_token', token)
  localStorage.setItem('kibunrogu_username', 'taku')
}, { token })

await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)

// Click first mood card to edit
const cards = await page.$$('.mood-card')
console.log('Mood cards:', cards.length)
if (cards.length === 0) {
  console.log('No cards to edit')
  await browser.close()
  process.exit(0)
}

await cards[0].click()
await page.waitForSelector('.mood-btn', { timeout: 3000 })
console.log('MoodForm opened for edit')

// Click a different mood
await page.click('.mood-btn:nth-child(2)')
await page.waitForTimeout(200)

// Click save
console.log('Clicking save...')
const saveBtn = await page.$('.save-btn')
const disabled = await saveBtn.evaluate(el => el.disabled)
console.log('Save button disabled:', disabled)

await page.click('.save-btn')
await page.waitForTimeout(2000)

// Check if form closed
const formStillOpen = await page.$('.mood-btn')
console.log('Form still open after save:', !!formStillOpen)

await browser.close()
