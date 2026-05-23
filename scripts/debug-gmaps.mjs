import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage()
page.on('console', msg => console.log('BROWSER:', msg.type(), msg.text()))
page.on('pageerror', err => console.log('PAGE_ERROR:', err.message))

const res = await fetch('http://localhost:18000/auth/login', {
  method: 'POST',
  headers: {'Content-Type':'application/json'},
  body: JSON.stringify({username:'taku',password:'test123'})
})
const {token} = await res.json()

await page.goto('http://localhost:3001/login')
await page.evaluate(({token}) => {
  localStorage.setItem('kibunrogu_token', token)
  localStorage.setItem('kibunrogu_username', 'taku')
}, {token})

await page.goto('http://localhost:3001/', {waitUntil:'networkidle'})
await page.waitForTimeout(2000)
await page.click('.add-btn')
await page.waitForTimeout(3000)
await page.fill('.search-input', '東京駅')
await page.waitForTimeout(5000)

const results = await page.$$('.result-item')
console.log('Results found:', results.length)

await browser.close()
