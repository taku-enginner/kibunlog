import { chromium } from 'playwright'
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const API_URL = process.env.API_URL || 'http://localhost:8000'
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
  await page.goto(BASE_URL + '/login')
  await page.evaluate(({ token }) => {
    localStorage.setItem('kibunrogu_token', token)
    localStorage.setItem('kibunrogu_username', 'taku')
  }, { token })
  await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  const html = await page.content()
  // Print relevant parts
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] || ''
  console.log(bodyMatch.slice(0, 3000))
  await browser.close()
}
main()
