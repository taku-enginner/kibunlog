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
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  })
  const page = await context.newPage()

  await page.goto(BASE_URL + '/login')
  await page.evaluate(({ token }) => {
    localStorage.setItem('kibunrogu_token', token)
    localStorage.setItem('kibunrogu_username', 'taku')
  }, { token })

  await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  const info = await page.evaluate(() => {
    const results = {}
    // Check document level
    results.docScrollHeight = document.documentElement.scrollHeight
    results.docClientHeight = document.documentElement.clientHeight
    results.bodyScrollHeight = document.body.scrollHeight
    results.bodyClientHeight = document.body.clientHeight
    results.windowInnerHeight = window.innerHeight

    // Walk DOM tree to find overflowing elements
    const all = document.querySelectorAll('*')
    const overflowing = []
    for (const el of all) {
      if (el.scrollHeight > el.clientHeight + 2) {
        overflowing.push({
          tag: el.tagName,
          id: el.id,
          class: el.className,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          overflow: getComputedStyle(el).overflow,
          overflowY: getComputedStyle(el).overflowY,
        })
      }
    }
    results.overflowing = overflowing
    return results
  })

  console.log(JSON.stringify(info, null, 2))
  await browser.close()
}

main()
