import { chromium } from 'playwright'
const BASE_URL = 'http://localhost:3001'
const API_URL = 'http://localhost:8000'
async function main() {
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'taku', password: 'test123' }),
  })
  const { token } = await loginRes.json()
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  
  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text())
  })
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message))
  page.on('requestfailed', req => console.log('REQUEST FAILED:', req.url(), req.failure()?.errorText))

  await page.goto(BASE_URL + '/login')
  await page.evaluate(({ token }) => {
    localStorage.setItem('kibunrogu_token', token)
    localStorage.setItem('kibunrogu_username', 'taku')
  }, { token })
  await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  // Click add
  await page.click('.add-btn')
  await page.waitForSelector('.sheet-title', { timeout: 3000 })
  console.log('PlaceSelector opened')

  // Search
  await page.fill('.search-input', '東京駅')
  await page.waitForTimeout(1000)
  await page.waitForSelector('.result-item', { timeout: 5000 })
  console.log('Search results shown')

  // Click result
  const resultText = await page.textContent('.result-item:first-child')
  console.log('Clicking result:', resultText?.slice(0, 50))
  await page.click('.result-item:first-child')
  await page.waitForTimeout(2000)
  
  // Check what's visible
  const html = await page.evaluate(() => document.body.innerHTML.slice(0, 2000))
  console.log('Body HTML after click:', html.slice(0, 1500))

  await browser.close()
}
main().catch(e => console.error(e))
