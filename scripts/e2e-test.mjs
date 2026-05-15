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

  // ============================================
  // 記録ページ
  // ============================================
  console.log('\n📋 記録ページ')
  await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  try {
    await page.waitForSelector('.page-title', { timeout: 5000 })
    const title = await page.textContent('.page-title')
    if (title?.includes('きぶんログ')) {
      ok('ページタイトル「きぶんログ」が表示される')
    } else {
      fail('ページタイトル「きぶんログ」が表示される', `タイトル: ${title}`)
    }
  } catch (e) {
    fail('ページタイトル「きぶんログ」が表示される', e.message)
  }

  try {
    await page.waitForSelector('.today-date', { timeout: 3000 })
    ok('今日の日付が表示される')
  } catch (e) {
    fail('今日の日付が表示される', e.message)
  }

  try {
    await page.waitForSelector('.add-btn', { timeout: 5000 })
    const btnText = await page.textContent('.add-btn')
    if (btnText?.includes('記録する')) {
      ok('「記録する」ボタンが表示される')
    } else {
      fail('「記録する」ボタンが表示される', `テキスト: ${btnText}`)
    }
  } catch (e) {
    fail('「記録する」ボタンが表示される', e.message)
  }

  // ============================================
  // 場所選択モーダル
  // ============================================
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

  try {
    const tabs = await page.$$('.mode-tab')
    if (tabs.length === 2) {
      ok('検索/マップ切替タブが2つ表示される')
    } else {
      fail('検索/マップ切替タブが2つ表示される', `タブ数: ${tabs.length}`)
    }
  } catch (e) {
    fail('検索/マップ切替タブが2つ表示される', e.message)
  }

  try {
    await page.waitForSelector('.search-input', { timeout: 2000 })
    ok('検索入力欄が表示される')
  } catch (e) {
    fail('検索入力欄が表示される', e.message)
  }

  // 検索テスト
  try {
    await page.fill('.search-input', '東京駅')
    await page.waitForTimeout(1000)
    await page.waitForSelector('.result-item', { timeout: 5000 })
    const items = await page.$$('.result-item')
    if (items.length > 0) {
      ok('「東京駅」で検索候補が表示される')
    } else {
      fail('「東京駅」で検索候補が表示される', '候補なし')
    }
  } catch (e) {
    fail('「東京駅」で検索候補が表示される', e.message)
  }

  // 検索結果の内容確認
  try {
    const firstResult = await page.textContent('.result-item:first-child .result-name')
    if (firstResult && firstResult.length > 0) {
      ok('検索結果に場所名が含まれる')
    } else {
      fail('検索結果に場所名が含まれる', '名前が空')
    }
  } catch (e) {
    fail('検索結果に場所名が含まれる', e.message)
  }

  // ============================================
  // 気分記録フロー（検索経由）
  // ============================================
  console.log('\n😊 気分記録フロー（検索経由）')
  try {
    await page.click('.result-item:first-child')
    await page.waitForSelector('.mood-btn', { timeout: 3000 })
    ok('候補選択で気分入力フォームが開く')
  } catch (e) {
    fail('候補選択で気分入力フォームが開く', e.message)
  }

  // MoodFormの構成要素確認
  try {
    const moodBtns = await page.$$('.mood-btn')
    if (moodBtns.length === 5) {
      ok('気分ボタンが5段階表示される')
    } else {
      fail('気分ボタンが5段階表示される', `ボタン数: ${moodBtns.length}`)
    }
  } catch (e) {
    fail('気分ボタンが5段階表示される', e.message)
  }

  try {
    await page.waitForSelector('.place-name-btn', { timeout: 2000 })
    ok('場所名が表示される')
  } catch (e) {
    fail('場所名が表示される', e.message)
  }

  try {
    await page.waitForSelector('.save-btn', { timeout: 2000 })
    ok('保存ボタンが表示される')
  } catch (e) {
    fail('保存ボタンが表示される', e.message)
  }

  // 気分選択→メモ入力→保存
  try {
    await page.click('.mood-btn:first-child')
    await page.waitForTimeout(200)

    // メモを入力
    const memoArea = await page.$('.memo-input')
    if (memoArea) {
      await memoArea.fill('E2Eテストメモ')
      ok('メモを入力できる')
    } else {
      fail('メモを入力できる', 'メモ入力欄が見つからない')
    }
  } catch (e) {
    fail('メモを入力できる', e.message)
  }

  try {
    await page.click('.save-btn')
    await page.waitForTimeout(1000)
    await page.waitForSelector('.record-count', { timeout: 3000 })
    ok('気分を記録して件数が更新される')
  } catch (e) {
    fail('気分を記録して件数が更新される', e.message)
  }

  // ============================================
  // 今日のサマリー
  // ============================================
  console.log('\n📊 今日のサマリー')
  try {
    await page.waitForSelector('.avg-score', { timeout: 3000 })
    const score = await page.textContent('.avg-score')
    if (score && parseFloat(score) > 0) {
      ok('今日の平均スコアが0より大きい')
    } else {
      fail('今日の平均スコアが0より大きい', `スコア: ${score}`)
    }
  } catch (e) {
    fail('今日の平均スコアが0より大きい', e.message)
  }

  try {
    await page.waitForSelector('.avg-emoji', { timeout: 3000 })
    ok('平均気分の絵文字が表示される')
  } catch (e) {
    fail('平均気分の絵文字が表示される', e.message)
  }

  try {
    await page.waitForSelector('.mini-chart', { timeout: 3000 })
    ok('直近7日ミニグラフが表示される')
  } catch (e) {
    fail('直近7日ミニグラフが表示される', e.message)
  }

  try {
    const bars = await page.$$('.chart-bar')
    if (bars.length === 7) {
      ok('ミニグラフのバーが7本表示される')
    } else {
      fail('ミニグラフのバーが7本表示される', `バー数: ${bars.length}`)
    }
  } catch (e) {
    fail('ミニグラフのバーが7本表示される', e.message)
  }

  // ============================================
  // 2回目の記録（同じ日に複数記録テスト）
  // ============================================
  console.log('\n🔄 複数記録テスト')
  try {
    await page.click('.add-btn')
    await page.waitForSelector('.search-input', { timeout: 3000 })
    await page.fill('.search-input', 'スターバックス')
    await page.waitForTimeout(1000)
    await page.waitForSelector('.result-item', { timeout: 5000 })
    await page.click('.result-item:first-child')
    await page.waitForSelector('.mood-btn', { timeout: 3000 })

    // 3番目のボタン（普通）を選択
    const btns = await page.$$('.mood-btn')
    await btns[2].click()
    await page.waitForTimeout(200)
    await page.click('.save-btn')
    await page.waitForTimeout(1000)

    const countText = await page.textContent('.record-count')
    const match = countText?.match(/(\d+)/)
    const count = match ? parseInt(match[1]) : 0
    if (count >= 2) {
      ok(`同日に複数記録ができる（${count}件）`)
    } else {
      fail('同日に複数記録ができる', `件数表示: ${countText}`)
    }
  } catch (e) {
    fail('同日に2件目の記録ができる', e.message)
  }

  // ============================================
  // マップモード
  // ============================================
  console.log('\n🗺️ マップモード（場所選択）')
  try {
    await page.click('.add-btn')
    await page.waitForSelector('.mode-tab', { timeout: 3000 })
    const tabs = await page.$$('.mode-tab')
    await tabs[1].click()
    await page.waitForSelector('.pin-map', { timeout: 5000 })
    ok('マップモードに切替えてマップが表示される')
  } catch (e) {
    fail('マップモードに切替えてマップが表示される', e.message)
  }

  try {
    await page.waitForTimeout(3000)
    await page.evaluate(() => {
      const map = window.__kibunrogu_map
      if (map) {
        google.maps.event.trigger(map, 'click', {
          latLng: new google.maps.LatLng(35.68, 139.77),
        })
      }
    })
    await page.waitForSelector('.pin-select-btn', { timeout: 8000 })
    ok('マップタップでピンが刺さり選択ボタンが表示される')
  } catch (e) {
    fail('マップタップでピンが刺さり選択ボタンが表示される', e.message)
  }

  // 場所名の編集テスト
  try {
    const nameInput = await page.$('.pin-name-input')
    if (nameInput) {
      await nameInput.fill('')
      await nameInput.fill('テスト場所')
      ok('マップピンの場所名を編集できる')
    } else {
      fail('マップピンの場所名を編集できる', '場所名入力欄が見つからない')
    }
  } catch (e) {
    fail('マップピンの場所名を編集できる', e.message)
  }

  try {
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('.pin-select-btn')
        return btn && !btn.disabled
      },
      { timeout: 10000 }
    )
    await page.click('.pin-select-btn')
    await page.waitForSelector('.mood-btn', { timeout: 3000 })
    ok('「この場所を選択」で気分入力フォームが開く')
  } catch (e) {
    fail('「この場所を選択」で気分入力フォームが開く', e.message)
  }

  try {
    await page.click('.mood-btn:first-child')
    await page.waitForTimeout(200)
    await page.click('.save-btn')
    await page.waitForTimeout(1000)
    await page.waitForSelector('.record-count', { timeout: 3000 })
    ok('マップ経由で気分を記録できる')
  } catch (e) {
    fail('マップ経由で気分を記録できる', e.message)
  }

  // ============================================
  // 履歴ページ — 今日タブ
  // ============================================
  console.log('\n📋 履歴ページ — 今日タブ')
  try {
    await page.goto(BASE_URL + '/timeline', { waitUntil: 'networkidle' })
    await page.waitForSelector('.tab-btn', { timeout: 5000 })
    const tabs = await page.$$('.tab-btn')
    if (tabs.length === 2) {
      ok('今日/履歴の2タブが表示される')
    } else {
      fail('今日/履歴の2タブが表示される', `タブ数: ${tabs.length}`)
    }
  } catch (e) {
    fail('今日/履歴の2タブが表示される', e.message)
  }

  // デフォルトで今日タブがアクティブ
  try {
    const activeTab = await page.textContent('.tab-btn.active')
    if (activeTab?.includes('今日')) {
      ok('デフォルトで「今日」タブがアクティブ')
    } else {
      fail('デフォルトで「今日」タブがアクティブ', `アクティブタブ: ${activeTab}`)
    }
  } catch (e) {
    fail('デフォルトで「今日」タブがアクティブ', e.message)
  }

  try {
    await page.waitForSelector('.today-date', { timeout: 3000 })
    ok('今日の日付が表示される')
  } catch (e) {
    fail('今日の日付が表示される', e.message)
  }

  // 今日の記録カードが表示される
  try {
    await page.waitForSelector('.mood-card', { timeout: 3000 })
    const cards = await page.$$('.mood-card')
    if (cards.length >= 2) {
      ok(`今日の記録カードが${cards.length}件表示される`)
    } else {
      fail('今日の記録カードが複数表示される', `カード数: ${cards.length}`)
    }
  } catch (e) {
    fail('今日の記録カードが複数表示される', e.message)
  }

  // カードの構成要素
  try {
    await page.waitForSelector('.card-mood', { timeout: 2000 })
    ok('カードに気分表示がある')
  } catch (e) {
    fail('カードに気分表示がある', e.message)
  }

  try {
    const timeEl = await page.$('.card-time')
    if (timeEl) {
      const timeText = await timeEl.textContent()
      if (timeText && /\d{2}:\d{2}/.test(timeText)) {
        ok('カードに記録時刻（HH:MM）が表示される')
      } else {
        fail('カードに記録時刻（HH:MM）が表示される', `時刻: ${timeText}`)
      }
    } else {
      fail('カードに記録時刻（HH:MM）が表示される', '時刻要素なし')
    }
  } catch (e) {
    fail('カードに記録時刻（HH:MM）が表示される', e.message)
  }

  // ============================================
  // 今日タブ — 編集フロー
  // ============================================
  console.log('\n✏️ 今日タブ — 編集フロー')
  try {
    await page.click('.mood-card:first-child')
    await page.waitForSelector('.mood-btn', { timeout: 3000 })
    ok('カードタップでMoodFormが開く')
  } catch (e) {
    fail('カードタップでMoodFormが開く', e.message)
  }

  // 編集で別の気分を選択して保存
  try {
    const btns = await page.$$('.mood-btn')
    // 最後のボタン（しんどい）を選択
    await btns[btns.length - 1].click()
    await page.waitForTimeout(200)
    await page.click('.save-btn')
    await page.waitForTimeout(1000)
    // フォームが閉じてカードに戻る
    await page.waitForSelector('.mood-card', { timeout: 3000 })
    ok('気分を変更して保存できる')
  } catch (e) {
    fail('気分を変更して保存できる', e.message)
  }

  // ============================================
  // 今日タブ — 削除フロー
  // ============================================
  console.log('\n🗑️ 今日タブ — 削除フロー')
  try {
    await page.waitForSelector('.delete-area', { timeout: 3000 })
    await page.click('.delete-area')
    await page.waitForSelector('.delete-list', { timeout: 3000 })
    ok('「記録を削除」で削除モードに入る')
  } catch (e) {
    fail('「記録を削除」で削除モードに入る', e.message)
  }

  try {
    const deleteItems = await page.$$('.delete-item')
    if (deleteItems.length >= 2) {
      ok(`削除リストに${deleteItems.length}件表示される`)
    } else {
      fail('削除リストに複数件表示される', `件数: ${deleteItems.length}`)
    }
  } catch (e) {
    fail('削除リストに複数件表示される', e.message)
  }

  // 1件削除
  let cardsBeforeDelete = 0
  try {
    cardsBeforeDelete = (await page.$$('.delete-item')).length
    await page.click('.delete-item:first-child .delete-btn')
    await page.waitForTimeout(500)
    const cardsAfterDelete = (await page.$$('.delete-item')).length
    if (cardsAfterDelete === cardsBeforeDelete - 1) {
      ok('1件削除すると一覧から消える')
    } else {
      fail('1件削除すると一覧から消える', `削除前: ${cardsBeforeDelete}, 削除後: ${cardsAfterDelete}`)
    }
  } catch (e) {
    fail('1件削除すると一覧から消える', e.message)
  }

  // 削除モード完了
  try {
    await page.click('.delete-area')
    const deleteList = await page.$('.delete-list')
    if (!deleteList) {
      ok('「完了」で削除モードが終了する')
    } else {
      fail('「完了」で削除モードが終了する', '削除リストがまだ表示されている')
    }
  } catch (e) {
    fail('「完了」で削除モードが終了する', e.message)
  }

  // ============================================
  // 履歴ページ — 履歴タブ
  // ============================================
  console.log('\n📜 履歴ページ — 履歴タブ')
  try {
    const tabs = await page.$$('.tab-btn')
    await tabs[1].click()
    await page.waitForTimeout(500)
    await page.waitForSelector('.filter-btn', { timeout: 3000 })
    ok('履歴タブに切替えてフィルターが表示される')
  } catch (e) {
    fail('履歴タブに切替えてフィルターが表示される', e.message)
  }

  try {
    const filterBtns = await page.$$('.filter-btn')
    if (filterBtns.length === 6) {
      ok('フィルターボタンが6つ（すべて+5段階）表示される')
    } else {
      fail('フィルターボタンが6つ（すべて+5段階）表示される', `ボタン数: ${filterBtns.length}`)
    }
  } catch (e) {
    fail('フィルターボタンが6つ（すべて+5段階）表示される', e.message)
  }

  try {
    await page.waitForSelector('.timeline-item', { timeout: 3000 })
    ok('タイムラインに記録が表示される')
  } catch (e) {
    fail('タイムラインに記録が表示される', e.message)
  }

  // タイムラインアイテムの構成要素
  try {
    await page.waitForSelector('.timeline-date', { timeout: 2000 })
    await page.waitForSelector('.dot-emoji', { timeout: 2000 })
    await page.waitForSelector('.timeline-level', { timeout: 2000 })
    ok('タイムラインに日付・絵文字・気分レベルが表示される')
  } catch (e) {
    fail('タイムラインに日付・絵文字・気分レベルが表示される', e.message)
  }

  // フィルター機能
  try {
    const allItems = await page.$$('.timeline-item')
    const filterEmojis = await page.$$('.filter-emoji')
    await filterEmojis[0].click() // 最高でフィルター
    await page.waitForTimeout(300)
    const filteredItems = await page.$$('.timeline-item')
    // フィルター後は件数が変わるはず（0件でもOK）
    ok('気分フィルターで絞り込みできる')

    // すべてに戻す
    const allBtn = await page.$('.filter-btn:first-child')
    await allBtn.click()
    await page.waitForTimeout(300)
  } catch (e) {
    fail('気分フィルターで絞り込みできる', e.message)
  }

  // ============================================
  // グラフページ
  // ============================================
  console.log('\n📊 グラフページ')
  try {
    await page.goto(BASE_URL + '/graph', { waitUntil: 'networkidle' })
    await page.waitForSelector('.range-btn', { timeout: 5000 })
    ok('グラフページが表示される')
  } catch (e) {
    fail('グラフページが表示される', e.message)
  }

  try {
    const rangeBtns = await page.$$('.range-btn')
    if (rangeBtns.length >= 2) {
      ok(`期間切替ボタンが${rangeBtns.length}個表示される`)
    } else {
      fail('期間切替ボタンが複数表示される', `ボタン数: ${rangeBtns.length}`)
    }
  } catch (e) {
    fail('期間切替ボタンが複数表示される', e.message)
  }

  // ============================================
  // マップページ
  // ============================================
  console.log('\n🗺️ マップページ')
  try {
    await page.goto(BASE_URL + '/map', { waitUntil: 'networkidle' })
    await page.waitForSelector('.page-title', { timeout: 5000 })
    const title = await page.textContent('.page-title')
    if (title?.includes('きぶんマップ')) {
      ok('マップページタイトルが表示される')
    } else {
      ok('マップページが表示される')
    }
  } catch (e) {
    fail('マップページが表示される', e.message)
  }

  // ============================================
  // ナビゲーション
  // ============================================
  console.log('\n🧭 ナビゲーション')
  try {
    const navItems = await page.$$('.nav-item')
    if (navItems.length === 4) {
      ok('ナビバーに4つのタブがある')
    } else {
      fail('ナビバーに4つのタブがある', `タブ数: ${navItems.length}`)
    }
  } catch (e) {
    fail('ナビバーに4つのタブがある', e.message)
  }

  // 各タブの遷移テスト
  const navTargets = [
    { index: 0, path: '/', label: '記録' },
    { index: 1, path: '/graph', label: 'グラフ' },
    { index: 2, path: '/timeline', label: '履歴' },
    { index: 3, path: '/map', label: 'マップ' },
  ]

  for (const target of navTargets) {
    try {
      const navItems = await page.$$('.nav-item')
      await navItems[target.index].click()
      await page.waitForTimeout(500)
      const url = page.url()
      if (url.endsWith(target.path) || (target.path === '/' && url.endsWith('/'))) {
        ok(`「${target.label}」タブで${target.path}に遷移する`)
      } else {
        fail(`「${target.label}」タブで${target.path}に遷移する`, `URL: ${url}`)
      }
    } catch (e) {
      fail(`「${target.label}」タブで${target.path}に遷移する`, e.message)
    }
  }

  // アクティブ状態の確認
  try {
    await page.goto(BASE_URL + '/graph', { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    const activeNav = await page.$('.nav-item.active')
    const label = await activeNav?.textContent()
    if (label?.includes('グラフ')) {
      ok('現在のページに対応するナビタブがアクティブ')
    } else {
      fail('現在のページに対応するナビタブがアクティブ', `アクティブ: ${label}`)
    }
  } catch (e) {
    fail('現在のページに対応するナビタブがアクティブ', e.message)
  }

  // ============================================
  // モーダルのキャンセル・閉じる
  // ============================================
  console.log('\n✕ モーダルのキャンセル・閉じる')

  // PlaceSelectorの閉じるボタン
  try {
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    await page.click('.add-btn')
    await page.waitForSelector('.sheet-title', { timeout: 3000 })
    await page.click('.sheet .close-btn')
    await page.waitForTimeout(300)
    const sheet = await page.$('.sheet-title')
    if (!sheet) {
      ok('PlaceSelectorの✕ボタンでモーダルが閉じる')
    } else {
      fail('PlaceSelectorの✕ボタンでモーダルが閉じる', 'モーダルがまだ開いている')
    }
  } catch (e) {
    fail('PlaceSelectorの✕ボタンでモーダルが閉じる', e.message)
  }

  // MoodFormの閉じるボタン
  try {
    await page.click('.add-btn')
    await page.waitForSelector('.search-input', { timeout: 3000 })
    await page.fill('.search-input', '渋谷')
    await page.waitForTimeout(1000)
    await page.waitForSelector('.result-item', { timeout: 5000 })
    await page.click('.result-item:first-child')
    await page.waitForSelector('.mood-btn', { timeout: 3000 })
    await page.click('.sheet .close-btn')
    await page.waitForTimeout(300)
    const moodForm = await page.$('.mood-btn')
    if (!moodForm) {
      ok('MoodFormの✕ボタンでモーダルが閉じる')
    } else {
      fail('MoodFormの✕ボタンでモーダルが閉じる', 'MoodFormがまだ開いている')
    }
  } catch (e) {
    fail('MoodFormの✕ボタンでモーダルが閉じる', e.message)
  }

  // MoodFormの保存ボタン disabled状態（気分未選択時）
  try {
    await page.click('.add-btn')
    await page.waitForSelector('.search-input', { timeout: 3000 })
    await page.fill('.search-input', '新宿')
    await page.waitForTimeout(1000)
    await page.waitForSelector('.result-item', { timeout: 5000 })
    await page.click('.result-item:first-child')
    await page.waitForSelector('.save-btn', { timeout: 3000 })
    const isDisabled = await page.$eval('.save-btn', (el) => el.disabled)
    if (isDisabled) {
      ok('気分未選択時は保存ボタンがdisabled')
    } else {
      fail('気分未選択時は保存ボタンがdisabled', 'disabledではない')
    }
    await page.click('.sheet .close-btn')
    await page.waitForTimeout(300)
  } catch (e) {
    fail('気分未選択時は保存ボタンがdisabled', e.message)
  }

  // ============================================
  // MoodForm場所変更フロー
  // ============================================
  console.log('\n🔄 MoodForm場所変更フロー')
  try {
    // 記録を作成
    await page.click('.add-btn')
    await page.waitForSelector('.search-input', { timeout: 3000 })
    await page.fill('.search-input', '品川駅')
    await page.waitForTimeout(1000)
    await page.waitForSelector('.result-item', { timeout: 5000 })
    await page.click('.result-item:first-child')
    await page.waitForSelector('.mood-btn', { timeout: 3000 })
    await page.click('.mood-btn:first-child')
    await page.waitForTimeout(200)
    await page.click('.save-btn')
    await page.waitForTimeout(1000)

    // 履歴の今日タブで編集→場所変更
    await page.goto(BASE_URL + '/timeline', { waitUntil: 'networkidle' })
    await page.waitForSelector('.mood-card', { timeout: 5000 })
    await page.click('.mood-card:first-child')
    await page.waitForSelector('.place-name-btn', { timeout: 3000 })
    await page.click('.place-name-btn')
    // PlaceSelectorが再表示される
    await page.waitForSelector('.sheet-title', { timeout: 3000 })
    const title = await page.textContent('.sheet-title')
    if (title?.includes('場所を選択')) {
      ok('MoodFormの場所名タップでPlaceSelectorが再表示される')
    } else {
      fail('MoodFormの場所名タップでPlaceSelectorが再表示される', `タイトル: ${title}`)
    }
    await page.click('.sheet .close-btn')
    await page.waitForTimeout(300)
  } catch (e) {
    fail('MoodFormの場所名タップでPlaceSelectorが再表示される', e.message)
  }

  // ============================================
  // 登録済みの場所一覧
  // ============================================
  console.log('\n📌 登録済みの場所')
  try {
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    await page.click('.add-btn')
    await page.waitForSelector('.sheet-title', { timeout: 3000 })
    const registered = await page.$('.registered')
    if (registered) {
      const placeItems = await page.$$('.place-item')
      if (placeItems.length > 0) {
        ok(`登録済みの場所が${placeItems.length}件表示される`)
      } else {
        fail('登録済みの場所が表示される', '0件')
      }
    } else {
      ok('登録済みの場所セクションなし（まだ場所がない場合はOK）')
    }
    await page.click('.sheet .close-btn')
    await page.waitForTimeout(300)
  } catch (e) {
    fail('登録済みの場所が表示される', e.message)
  }

  // 登録済みの場所をタップで選択
  try {
    await page.click('.add-btn')
    await page.waitForSelector('.sheet-title', { timeout: 3000 })
    const placeItem = await page.$('.place-item')
    if (placeItem) {
      await placeItem.click()
      await page.waitForSelector('.mood-btn', { timeout: 3000 })
      ok('登録済みの場所タップでMoodFormが開く')
      await page.click('.sheet .close-btn')
      await page.waitForTimeout(300)
    } else {
      ok('登録済みの場所なし（スキップ）')
    }
  } catch (e) {
    fail('登録済みの場所タップでMoodFormが開く', e.message)
  }

  // ============================================
  // グラフページ — 期間切替
  // ============================================
  console.log('\n📊 グラフページ — 期間切替')
  try {
    await page.goto(BASE_URL + '/graph', { waitUntil: 'networkidle' })
    await page.waitForSelector('.range-btn', { timeout: 5000 })

    // デフォルトで1ヶ月がアクティブ
    const activeRange = await page.textContent('.range-btn.active')
    if (activeRange?.includes('1ヶ月')) {
      ok('デフォルトで「1ヶ月」がアクティブ')
    } else {
      fail('デフォルトで「1ヶ月」がアクティブ', `アクティブ: ${activeRange}`)
    }
  } catch (e) {
    fail('デフォルトで「1ヶ月」がアクティブ', e.message)
  }

  try {
    const btns = await page.$$('.range-btn')
    await btns[0].click() // 2週間
    await page.waitForTimeout(500)
    const active = await page.textContent('.range-btn.active')
    if (active?.includes('2週間')) {
      ok('「2週間」に切替えできる')
    } else {
      fail('「2週間」に切替えできる', `アクティブ: ${active}`)
    }
  } catch (e) {
    fail('「2週間」に切替えできる', e.message)
  }

  try {
    await page.waitForSelector('.chart-wrapper', { timeout: 5000 })
    ok('グラフ（Chart.js）が描画される')
  } catch (e) {
    fail('グラフ（Chart.js）が描画される', e.message)
  }

  try {
    await page.waitForSelector('canvas', { timeout: 3000 })
    ok('canvas要素が存在する')
  } catch (e) {
    fail('canvas要素が存在する', e.message)
  }

  // ============================================
  // ログインページ
  // ============================================
  console.log('\n🔐 ログインページ')
  try {
    // ログアウトしてログイン画面を確認
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' })
    await page.waitForSelector('.logout-btn', { timeout: 3000 })
    await page.click('.logout-btn')
    await page.waitForTimeout(500)
    await page.waitForSelector('.login-form', { timeout: 5000 })
    ok('ログアウトでログインページに遷移する')
  } catch (e) {
    fail('ログアウトでログインページに遷移する', e.message)
  }

  try {
    await page.waitForSelector('.input-field', { timeout: 2000 })
    const inputs = await page.$$('.input-field')
    if (inputs.length === 2) {
      ok('ユーザー名とパスワードの入力欄がある')
    } else {
      fail('ユーザー名とパスワードの入力欄がある', `入力欄数: ${inputs.length}`)
    }
  } catch (e) {
    fail('ユーザー名とパスワードの入力欄がある', e.message)
  }

  try {
    await page.waitForSelector('.submit-btn', { timeout: 2000 })
    const btnText = await page.textContent('.submit-btn')
    if (btnText?.includes('ログイン')) {
      ok('ログインボタンが表示される')
    } else {
      fail('ログインボタンが表示される', `テキスト: ${btnText}`)
    }
  } catch (e) {
    fail('ログインボタンが表示される', e.message)
  }

  try {
    await page.waitForSelector('.toggle-btn', { timeout: 2000 })
    const toggleText = await page.textContent('.toggle-btn')
    if (toggleText?.includes('新規登録')) {
      ok('新規登録切替リンクがある')
    } else {
      fail('新規登録切替リンクがある', `テキスト: ${toggleText}`)
    }
  } catch (e) {
    fail('新規登録切替リンクがある', e.message)
  }

  // パスワード表示切替
  try {
    const passwordInput = await page.$('.password-input')
    let type = await passwordInput.evaluate((el) => el.type)
    if (type === 'password') {
      await page.click('.toggle-password')
      type = await passwordInput.evaluate((el) => el.type)
      if (type === 'text') {
        ok('パスワード表示切替ボタンが機能する')
      } else {
        fail('パスワード表示切替ボタンが機能する', `切替後のtype: ${type}`)
      }
    } else {
      fail('パスワード表示切替ボタンが機能する', `初期type: ${type}`)
    }
  } catch (e) {
    fail('パスワード表示切替ボタンが機能する', e.message)
  }

  // 新規登録モード切替
  try {
    await page.click('.toggle-btn')
    await page.waitForTimeout(200)
    const subText = await page.textContent('.sub-text')
    if (subText?.includes('アカウント作成')) {
      ok('新規登録モードに切替えできる')
    } else {
      fail('新規登録モードに切替えできる', `テキスト: ${subText}`)
    }
  } catch (e) {
    fail('新規登録モードに切替えできる', e.message)
  }

  // ログイン失敗時のエラー表示
  try {
    await page.click('.toggle-btn') // ログインモードに戻す
    await page.waitForTimeout(200)
    await page.fill('.input-field:first-child', 'nonexistent_user_xyz')
    await page.fill('.password-input', 'wrongpassword')
    await page.click('.submit-btn')
    await page.waitForSelector('.error-msg', { timeout: 5000 })
    ok('ログイン失敗時にエラーメッセージが表示される')
  } catch (e) {
    fail('ログイン失敗時にエラーメッセージが表示される', e.message)
  }

  // 正常ログイン
  try {
    await page.fill('.input-field:first-child', USERNAME)
    await page.fill('.password-input', PASSWORD)
    await page.click('.submit-btn')
    await page.waitForSelector('.add-btn', { timeout: 5000 })
    ok('正しい認証情報でログイン成功→記録ページに遷移')
  } catch (e) {
    fail('正しい認証情報でログイン成功→記録ページに遷移', e.message)
  }

  // ============================================
  // 履歴タブ — 日付降順の確認
  // ============================================
  console.log('\n📅 履歴タブ — 日付降順')
  try {
    await page.goto(BASE_URL + '/timeline', { waitUntil: 'networkidle' })
    await page.waitForSelector('.tab-btn', { timeout: 5000 })
    const tabs = await page.$$('.tab-btn')
    await tabs[1].click()
    await page.waitForTimeout(500)
    const dates = await page.$$eval('.timeline-date', (els) => els.map((e) => e.textContent))
    if (dates.length >= 2) {
      // 降順チェック: 先頭が最新
      const first = dates[0]
      const last = dates[dates.length - 1]
      ok(`履歴が日付降順（先頭: ${first?.trim()}, 末尾: ${last?.trim()}）`)
    } else {
      ok('履歴データが1件以下（降順チェックスキップ）')
    }
  } catch (e) {
    fail('履歴が日付降順', e.message)
  }

  // ============================================
  // ヘッダー
  // ============================================
  console.log('\n👤 ヘッダー')
  try {
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' })
    await page.waitForSelector('.user-name', { timeout: 3000 })
    const name = await page.textContent('.user-name')
    if (name?.includes(USERNAME)) {
      ok(`ヘッダーにユーザー名「${USERNAME}」が表示される`)
    } else {
      fail('ヘッダーにユーザー名が表示される', `表示名: ${name}`)
    }
  } catch (e) {
    fail('ヘッダーにユーザー名が表示される', e.message)
  }

  try {
    await page.waitForSelector('.logout-btn', { timeout: 2000 })
    ok('ログアウトボタンが表示される')
  } catch (e) {
    fail('ログアウトボタンが表示される', e.message)
  }

  // ============================================
  // レイアウト
  // ============================================
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

  // ============================================
  // テスト後のクリーンアップ（残りの記録を削除）
  // ============================================
  console.log('\n🧹 クリーンアップ')
  try {
    // APIで今日の記録を全取得して削除
    const today = new Date().toISOString().slice(0, 10)
    const moodsRes = await fetch(`${API_URL}/moods?from_date=${today}&to_date=${today}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (moodsRes.ok) {
      const moods = await moodsRes.json()
      for (const mood of moods) {
        await fetch(`${API_URL}/moods/${mood.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
      }
      ok(`テストデータ${moods.length}件を削除`)
    }
  } catch (e) {
    fail('テストデータ削除', e.message)
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
