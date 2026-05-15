import { chromium } from 'playwright'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const API_URL = process.env.API_URL || 'http://localhost:8000'
const USERNAME = process.env.APP_USERNAME || 'taku'
const PASSWORD = process.env.APP_PASSWORD || 'test123'

const SCREENSHOT_DIR = path.join(import.meta.dirname, 'screenshots')
const OUTPUT_FILE = path.join(import.meta.dirname, 'ui-review.md')

async function main() {
  // Setup
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

  // Get auth token
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  })
  if (!loginRes.ok) {
    console.error('Login failed. Register a user first.')
    process.exit(1)
  }
  const { token } = await loginRes.json()

  // Launch browser (mobile viewport)
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 size
    deviceScaleFactor: 3,
  })

  const page = await context.newPage()

  // Set auth token in localStorage
  await page.goto(BASE_URL + '/login')
  await page.evaluate(
    ({ token, username }) => {
      localStorage.setItem('kibunrogu_token', token)
      localStorage.setItem('kibunrogu_username', username)
    },
    { token, username: USERNAME }
  )

  // Take screenshots of each page
  const pages = [
    { name: 'record', path: '/', desc: '記録画面' },
    { name: 'graph', path: '/graph', desc: 'グラフ画面' },
    { name: 'timeline', path: '/timeline', desc: 'タイムライン画面' },
  ]

  const screenshots = []

  for (const p of pages) {
    await page.goto(BASE_URL + p.path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    const filepath = path.join(SCREENSHOT_DIR, `${p.name}.png`)
    await page.screenshot({ path: filepath, fullPage: true })
    console.log(`📸 ${p.desc}: ${filepath}`)
    screenshots.push({ ...p, filepath })
  }

  await browser.close()

  // Send to Claude API for review
  console.log('\n🤖 Claude APIに改善提案を依頼中...\n')

  const client = new Anthropic()

  const imageContents = screenshots.map((s) => {
    const imageData = fs.readFileSync(s.filepath)
    const base64 = imageData.toString('base64')
    return [
      { type: 'text', text: `【${s.desc}（${s.path}）】` },
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: base64 },
      },
    ]
  })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `以下は「きぶんログ」というモバイル向けWebアプリの各画面のスクリーンショットです。
このアプリは毎朝1分で気分を5段階で記録し、傾向を可視化するものです。

UI/UXの改善提案をしてください。以下の観点で具体的に指摘してください：

1. レイアウト・余白・間隔の問題
2. フォントサイズ・ウェイトのバランス
3. タップターゲットのサイズ（モバイルで押しやすいか）
4. 色のコントラスト・アクセシビリティ
5. 情報の優先度（何が目立つべきか）
6. 全体的な統一感・一貫性
7. その他気になる点

各画面ごとに具体的な改善案を出してください。CSSの修正案も含めてください。`,
          },
          ...imageContents.flat(),
        ],
      },
    ],
  })

  const review = message.content[0].text

  // Save as markdown
  const output = `# UI/UXレビュー結果

生成日: ${new Date().toISOString().slice(0, 10)}

---

${review}
`

  fs.writeFileSync(OUTPUT_FILE, output)
  console.log(`✅ レビュー結果: ${OUTPUT_FILE}`)
  console.log('\n' + review)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
