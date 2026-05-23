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
    const getInfo = (el) => {
      const s = getComputedStyle(el)
      return {
        tag: el.tagName,
        id: el.id,
        class: el.className?.toString?.()?.slice(0,60),
        offsetHeight: el.offsetHeight,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        height: s.height,
        minHeight: s.minHeight,
        maxHeight: s.maxHeight,
        overflow: s.overflow,
        overflowY: s.overflowY,
        padding: s.padding,
        margin: s.margin,
        boxSizing: s.boxSizing,
      }
    }

    const chain = []
    let el = document.querySelector('.record-page')
    while (el) {
      chain.unshift(getInfo(el))
      el = el.parentElement
    }
    return chain
  })

  console.log(JSON.stringify(info, null, 2))
  await browser.close()
}

main()
