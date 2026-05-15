# きぶんログ

気分を記録し、場所・時間ごとの傾向を可視化するWebアプリ。

## 技術スタック

- Frontend: Nuxt 3
- Backend: Python (FastAPI)
- DB: MySQL 8.4
- 地図: Google Maps JavaScript API / Places API (New)
- インフラ: Docker Compose / Caddy (HTTPS) / Tailscale

## 画面構成

1. **記録 (/)** - 今日の平均スコア + 7日ミニグラフ + 記録ボタン
2. **グラフ (/graph)** - 気分推移の折れ線グラフ（2週間〜3年）
3. **履歴 (/timeline)** - 「今日」タブ（カード一覧・編集・削除）と「履歴」タブ（全記録・フィルター）
4. **マップ (/map)** - 場所ごとにピン集約（色=平均気分、サイズ=記録数）

## 環境変数

`.env`ファイルをプロジェクトルートに作成:

```bash
GOOGLE_MAPS_API_KEY=your_api_key_here
```

Google Cloud Consoleで Maps JavaScript API と Places API (New) を有効化すること。

## 起動方法

### Mac（ローカル検証）

```bash
docker compose -f docker-compose.mac.yml up -d --build
```

- Frontend: http://localhost:23000
- Backend: http://localhost:28000
- MySQL: localhost:23306

### Debian（本番）

```bash
# 初回 or docker-compose.yml→debian.ymlリネーム後
git pull
# .envにGOOGLE_MAPS_API_KEYを設定
docker compose -f docker-compose.debian.yml up -d --build
```

Caddy経由でHTTPSアクセス。

### 停止

```bash
docker compose -f docker-compose.<mac|debian>.yml down
```

## E2Eテスト

```bash
BASE_URL=http://localhost:3001 API_URL=http://localhost:18000 node scripts/e2e-test.mjs
```

devbox環境（フロント3001、バックエンド18000）で実行。
