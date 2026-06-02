# きぶんログ

気分を記録し、場所・時間ごとの傾向を可視化するWebアプリ。

## 技術構成

### フロントエンド

| 項目 | 技術 |
|------|------|
| フレームワーク | Nuxt 3 (Vue 3, Composition API) |
| 言語 | TypeScript |
| グラフ | Chart.js + vue-chartjs |
| テスト | Vitest + @vue/test-utils + happy-dom |
| カバレッジ | @vitest/coverage-v8 |

### バックエンド

| 項目 | 技術 |
|------|------|
| フレームワーク | FastAPI (Python 3.12) |
| ORM | SQLAlchemy |
| DB | MySQL 8.4 |
| 認証 | JWT (PyJWT + bcrypt) |
| 画像処理 | Pillow (リサイズ・WebP変換・EXIF補正・回転) |
| テスト | pytest + coverage.py + httpx |

### インフラ・デプロイ

| 項目 | 技術 |
|------|------|
| コンテナ | Docker Compose |
| リバースプロキシ | Caddy (HTTPS自動証明書) |
| ネットワーク | Tailscale (VPN経由アクセス) |
| ローカル開発 | devbox (Python 3.12 + Node.js 22 + MySQL 8.4) |

## サーバー構成

### 本番 (Debian)

```
[クライアント] → Tailscale VPN → [Caddy :443]
                                      ├─ /auth/*, /moods*, /places* → [Backend :8000]
                                      └─ /* → [Frontend :3000]

[Backend :8000] → [MySQL :3306]
                → [/app/uploads] (画像ファイル)
```

- ドメイン: `debian.tail69d614.ts.net`
- Tailscale経由のみアクセス可（インターネット非公開）
- Caddy: TLS証明書はTailscaleが発行したものを使用
- データ永続化: Docker volumes (db_data, uploads_data, caddy_data)

### ローカル開発 (Mac)

```
[ブラウザ] → [Frontend :23000] → [Backend :28000] → [MySQL :23306]
```

- devbox環境: `frontend :3001`, `backend :18000`, `MySQL :13306`
- Docker環境: `frontend :23000`, `backend :28000`, `MySQL :23306`

## 画面構成

1. **記録 (/)** - 今日の平均スコア + 7日ミニグラフ + 今日の記録一覧 + 記録ボタン
2. **グラフ (/graph)** - 気分推移の折れ線グラフ（2週間〜3年、小数平均でプロット）
3. **履歴 (/timeline)** - 「今日」タブ（カード一覧・詳細・編集・削除）と「履歴」タブ（全記録・フィルター・日付フィルター）
4. **プラスα (/insights)** - 週次サマリー・曜日別・時間帯別・場所TOP5（ドリルダウン）・場所×曜日クロス分析・ストリーク・マップ

## 画像・通信量の方針

月5GBの通信量制約があるため、以下の方針で設計する。

### 基本ルール

- 一覧表示では画像を自動読み込みしない（📷アイコンのみ表示）
- ユーザーがタップした時だけ画像を読み込む
- アップロード時にサムネイル（長辺100px, 5-10KB）と原寸（長辺1200px, WebP 200KB以下）の2枚を生成
- 画像はサーバーのローカルファイルに保存（パスだけDBに持つ）

### 通信量の目安

| 操作 | 通信量 |
|------|--------|
| テキストのみ（API通信） | 数KB/回 |
| サムネイル表示 | 5-10KB/枚 |
| 原寸画像表示（タップ時） | 100-200KB/枚 |
| 1日の通常利用 | 〜1MB |
| 月間想定 | 〜30MB（5GBの0.6%） |

### 画像ダウンロード

- 履歴タブで複数枚をチェックボックスで選択 → ZIPでまとめてダウンロード
- バックエンド: `POST /moods/images/download` にIDリストを送信 → ZIP生成して返却
- ファイル名: `{日付}_{場所名}_{気分}.webp`

### 将来的な拡張時の注意

- マップへの画像表示、分析での画像利用などで画像を増やす場合も同じ方針を適用
- WiFi判定による自動/手動切替を検討（4G時は警告表示）
- バッチアップロード（WiFi時にまとめて送信）も選択肢

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
docker compose -f docker-compose.debian.yml up -d --build
```

Caddy経由でHTTPSアクセス。

### 停止

```bash
docker compose -f docker-compose.<mac|debian>.yml down
```

## テストデータ投入

ローカル検証用にテストデータを1コマンドで投入できる。

```bash
cd backend && DB_PORT=13306 ../.venv/bin/python scripts/seed.py
```

- テストユーザー `test@example.com` / `testpass` を自動作成（既存なら再利用）
- 直近7日分、1日2-3件のMoodデータを投入

既存データをクリアして再投入する場合:

```bash
cd backend && DB_PORT=13306 ../.venv/bin/python scripts/seed.py --clear
```

## テスト

### バックエンド単体テスト（pytest + coverage.py）

```bash
cd backend
../.venv/bin/pytest --cov=. --cov-report=term-missing
```

- SQLite in-memory使用（本番DBに接続しない）
- 認証・気分CRUD・場所CRUDをカバー

### フロントエンド単体テスト（Vitest + @vitest/coverage-v8）

```bash
cd frontend
npx vitest run --coverage
```

- composables（useToast, useDate, useAuth）のユニットテスト
- コンポーネントテスト（ToastMessage）

### E2Eテスト（Playwright）

```bash
BASE_URL=http://localhost:3001 API_URL=http://localhost:18000 node scripts/e2e-test.mjs
```

devbox環境（フロント3001、バックエンド18000）で実行。

### カバレッジ状況

| 対象 | Stmts | テスト数 | 備考 |
|------|-------|---------|------|
| バックエンド | 95% | 56 | auth 91%, models 100%, main 99%, image_utils 95% |
| フロントエンド (composables) | 100% | 46 | Branch 85% (SSR分岐のみ未到達) |
