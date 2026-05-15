import { chromium } from 'playwright'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const API_URL = process.env.API_URL || 'http://localhost:8000'
const USERNAME = process.env.APP_USERNAME || 'taku'
const PASSWORD = process.env.APP_PASSWORD || 'test123'

let passed = 0
let failed = 0

function ok(name) {
  passed++
  console.log(`  ✅ ${name}`)
}

function fail(name, err) {
  failed++
  console.log(`  ❌ ${name}: ${err}`)
}

async function main() {
  // Auth
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  })
  if (!loginRes.ok) {
    console.error('Login failed. Register user first.')
    process.exit(1)
  }
  const { token } = await loginRes.json()

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  })
  const page = await context.newPage()

  // Set auth
  await page.goto(BASE_URL + '/login')
  await page.evaluate(
    ({ token, username }) => {
      localStorage.setItem('kibunrogu_token', token)
      localStorage.setItem('kibunrogu_username', username)
    },
    { token, username: USERNAME }
  )

  // --- Test: Record page loads ---
  console.log('\n📋 記録ページ')
  await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  try {
    await page.waitForSelector('.page-title', { timeout: 5000 })
    ok('ページタイトルが表示される')
  } catch (e) {
    fail('ページタイトルが表示される', e.message)
  }

  try {
    await page.waitForSelector('.add-btn', { timeout: 5000 })
    ok('「記録を追加」ボタンが表示される')
  } catch (e) {
    fail('「記録を追加」ボタンが表示される', e.message)
  }

  // --- Test: PlaceSelector opens ---
  console.log('\n📍 場所選択モーダル')
  try {
    await page.click('.add-btn')
    await page.waitForSelector('.sheet-title', { timeout: 3000 })
    const title = await page.textContent('.sheet-title')
    if (title?.includes('場所を選択')) {
      ok('場所選択モーダルが開く')
    } else {
      fail('場所選択モーダルが開く', `タイトル: ${title}`)
    }
  } catch (e) {
    fail('場所選択モーダルが開く', e.message)
  }

  // --- Test: Mode tabs exist ---
  try {
    const tabs = await page.$$('.mode-tab')
    if (tabs.length === 2) {
      ok('検索/マップ切替タブが表示される')
    } else {
      fail('検索/マップ切替タブが表示される', `タブ数: ${tabs.length}`)
    }
  } catch (e) {
    fail('検索/マップ切替タブが表示される', e.message)
  }

  // --- Test: Search input exists ---
  try {
    await page.waitForSelector('.search-input', { timeout: 2000 })
    ok('検索入力欄が表示される')
  } catch (e) {
    fail('検索入力欄が表示される', e.message)
  }

  // --- Test: Search for a place ---
  try {
    await page.fill('.search-input', '東京駅')
    await page.waitForTimeout(1000) // debounce wait
    await page.waitForSelector('.result-item', { timeout: 5000 })
    ok('場所検索で候補が表示される')
  } catch (e) {
    fail('場所検索で候補が表示される', e.message)
  }

  // --- Test: Select search result opens MoodForm ---
  try {
    await page.click('.result-item:first-child')
    await page.waitForSelector('.mood-btn', { timeout: 3000 })
    ok('候補選択で気分入力フォームが開く')
  } catch (e) {
    fail('候補選択で気分入力フォームが開く', e.message)
  }

  // --- Test: Select mood and submit ---
  try {
    await page.click('.mood-btn:first-child') // 最高
    await page.waitForTimeout(200)
    await page.click('.save-btn')
    await page.waitForTimeout(1000)
    // Check that mood card appeared
    await page.waitForSelector('.mood-card', { timeout: 3000 })
    ok('気分を記録してカードが表示される')
  } catch (e) {
    fail('気分を記録してカードが表示される', e.message)
  }

  // --- Test: Edit existing card ---
  console.log('\n✏️ 編集')
  try {
    await page.click('.mood-card:first-child')
    await page.waitForSelector('.mood-btn', { timeout: 3000 })
    ok('カードタップで編集フォームが開く')
    // Close it
    await page.click('.close-btn')
    await page.waitForTimeout(300)
  } catch (e) {
    fail('カードタップで編集フォームが開く', e.message)
  }

  // --- Test: Map mode ---
  console.log('\n🗺️ マップモード')
  try {
    await page.click('.add-btn')
    await page.waitForSelector('.mode-tab', { timeout: 3000 })
    const tabs = await page.$$('.mode-tab')
    await tabs[1].click() // マップで選ぶ
    await page.waitForSelector('.pin-map', { timeout: 5000 })
    ok('マップモードに切替えてマップが表示される')
  } catch (e) {
    fail('マップモードに切替えてマップが表示される', e.message)
  }

  // --- Test: Pin on map ---
  try {
    const map = await page.$('.pin-map')
    const box = await map.boundingBox()
    await page.click('.pin-map', {
      position: { x: box.width / 2, y: box.height / 2 },
    })
    await page.waitForSelector('.pin-select-btn', { timeout: 5000 })
    ok('マップタップでピンが刺さり選択ボタンが表示される')
  } catch (e) {
    fail('マップタップでピンが刺さり選択ボタンが表示される', e.message)
  }

  // --- Test: Confirm pin opens MoodForm ---
  try {
    // Wait for reverse geocoding
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('.pin-select-btn')
        return btn && !btn.disabled
      },
      { timeout: 8000 }
    )
    await page.click('.pin-select-btn')
    await page.waitForSelector('.mood-btn', { timeout: 3000 })
    ok('「この場所を選択」で気分入力フォームが開く')
  } catch (e) {
    fail('「この場所を選択」で気分入力フォームが開く', e.message)
  }

  // --- Test: Map flow: select mood and submit ---
  try {
    const cardsBefore = await page.$$('.mood-card')
    await page.click('.mood-btn:first-child')
    await page.waitForTimeout(200)
    await page.click('.save-btn')
    await page.waitForTimeout(1000)
    await page.waitForSelector('.mood-card', { timeout: 3000 })
    const cardsAfter = await page.$$('.mood-card')
    if (cardsAfter.length > cardsBefore.length) {
      ok('マップ経由で気分を記録してカードが増える')
    } else {
      fail('マップ経由で気分を記録してカードが増える', `カード数: ${cardsBefore.length} → ${cardsAfter.length}`)
    }
  } catch (e) {
    fail('マップ経由で気分を記録してカードが増える', e.message)
  }

  // --- Test: Graph page ---
  console.log('\n📊 グラフページ')
  try {
    await page.goto(BASE_URL + '/graph', { waitUntil: 'networkidle' })
    await page.waitForSelector('.range-btn', { timeout: 5000 })
    ok('グラフページが表示される')
  } catch (e) {
    fail('グラフページが表示される', e.message)
  }

  // --- Test: Timeline page ---
  console.log('\n📋 タイムラインページ')
  try {
    await page.goto(BASE_URL + '/timeline', { waitUntil: 'networkidle' })
    await page.waitForSelector('.filter-btn', { timeout: 5000 })
    ok('タイムラインページが表示される')
  } catch (e) {
    fail('タイムラインページが表示される', e.message)
  }

  // --- Test: Map page ---
  console.log('\n🗺️ マップページ')
  try {
    await page.goto(BASE_URL + '/map', { waitUntil: 'networkidle' })
    await page.waitForSelector('.page-title', { timeout: 5000 })
    ok('マップページが表示される')
  } catch (e) {
    fail('マップページが表示される', e.message)
  }

  // --- Test: No vertical scroll on record page ---
  console.log('\n📐 レイアウト')
  try {
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    const scrollable = await page.evaluate(() => {
      return document.documentElement.scrollHeight > document.documentElement.clientHeight
    })
    if (!scrollable) {
      ok('記録ページで縦スクロールが発生しない')
    } else {
      fail('記録ページで縦スクロールが発生しない', 'scrollHeight > clientHeight')
    }
  } catch (e) {
    fail('記録ページで縦スクロールが発生しない', e.message)
  }

  await browser.close()

  // Summary
  console.log(`\n${'='.repeat(40)}`)
  console.log(`結果: ${passed} passed, ${failed} failed`)
  console.log('='.repeat(40))

  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
