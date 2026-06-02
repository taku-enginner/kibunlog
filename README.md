# きぶんログ (kibunlog)

気分を 1-10 で記録して、時間・場所・写真とともに振り返り、自分のパターンを見つける個人向け Web アプリ。

**Live demo:** https://kibunlog.takakusagi.dev

> 個人開発 / 転職活動用のポートフォリオです。
> ランディングの「デモを見る」をタップすると、サンプルデータ入りの使い捨てアカウントが
> 即発行されます (24h で自動削除)。自分で全機能を試したい方は「新規登録」から
> (写真アップロード機能はデモアカウントのみ無効化されています)。

## アプリの機能

| | |
|---|---|
| 記録 | 1-10 スコア + メモ + 場所 + 写真。1日に何度でも |
| グラフ | 2週間〜3年の折れ線で気分推移を可視化 (Chart.js) |
| 履歴 | 全記録のタイムライン + 日付フィルター。編集・削除・画像 ZIP DL |
| 分析 | 曜日別 / 時間帯別 / 場所 TOP5 / 場所×曜日クロス / 連続記録ストリーク |

## 技術スタック

| Layer | Tech |
|---|---|
| Frontend | Nuxt 3 (Vue 3 Composition API), TypeScript, Chart.js, Vitest |
| Backend | FastAPI (Python 3.12), SQLAlchemy, Pillow, pytest (62件, カバレッジ 88%) |
| DB | MySQL 8.4 |
| Auth | JWT (PyJWT + bcrypt) |
| Infra | Docker Compose, Caddy, Cloudflare Tunnel, Tailscale |

## 工夫したところ (= コードの見どころ)

### 1. ワンクリック デモアカウント (`POST /auth/demo`)

採用担当が ID/PASS を入力せずに即触れるよう、UUID 採番した使い捨て User + 2週間分の
サンプル Mood/Place を1コールで発行する。`is_demo` フラグで書き込み API を一部制限
(画像アップは 403)、24h 経過分は systemd timer の cleanup スクリプトで CASCADE 削除する。

- `backend/main.py` の `create_demo_user`
- `backend/scripts/seed.py` の `seed_demo_user`
- `backend/scripts/cleanup_demo.py`
- `frontend/components/Landing.vue`

### 2. 画像通信量の制約設計 (月 5GB を意識)

モバイル回線でも快適に動かすため、画像は2段階で保存:
- 原寸: 長辺 1200px / WebP 200KB 以下 (品質を 85→10 で動的調整)
- サムネ: 長辺 100px / WebP 10KB 以下
- 一覧は 📷 アイコンのみ表示、タップで原寸 fetch

EXIF transpose による回転補正 + 別 API での明示的な回転操作にも対応。

- `backend/image_utils.py`
- `backend/main.py` の `upload_mood_image` (サイズ 5MB + 累計 50枚 + デモ禁止の3段ガード)

### 3. 公開時のセキュリティ多層化

- アプリ層: JWT 認証 + 全クエリで `user_id == request.user.id` で行を絞り、デモは書き込み制限
- プロキシ層: Caddy で振り分け、デモ/register エンドポイントを Cloudflare WAF Rate Limit
- ネットワーク層: Cloudflare Tunnel でインバウンドポート完全閉鎖 (UFW で 80/443/22 全閉)
- 管理: Tailscale 経由 SSH のみ

```
ゲスト ─ HTTPS ─→ Cloudflare ── Tunnel(outbound only) ──→ cloudflared ─→ Caddy(:80) ─→ Frontend / Backend
管理者 ────── Tailscale ──────→ SSH (公開SSH 不要) ─────→ Caddy(:443) ─→ 同上
```

### 4. バックアップ運用 (3-2-1 ルール)

- ローカル日次: mysqldump + uploads tar + 任意 gpg 暗号化、7世代ローテーション
- リモート週次: rclone で Cloudflare R2 (egress 無料) に sync
- リストアテスト: `kibunrogu_test` という別 DB に最新 bk を流す非破壊スクリプト

すべて systemd timer で自動化。

- `deploy/scripts/backup.sh` / `backup-remote.sh` / `restore-test.sh`
- `deploy/systemd/*.timer` (`hourly` / `daily 03:00` / `weekly Sun 04:00`)

### 5. 公開後の運用ドキュメント

`deploy/README.md` に Phase 1-4 のデプロイ手順、終了時のクリーンアップ手順
(個人情報 DELETE SQL、最終バックアップコマンド) まで残してある。

---

## ローカル開発

### Mac (Docker)

```bash
docker compose -f docker-compose.mac.yml up -d --build
# Frontend: http://localhost:23000
# Backend:  http://localhost:28000
# MySQL:    localhost:23306
```

### Mac (devbox)

```bash
devbox shell
# frontend :3001, backend :18000, MySQL :13306
```

### サンプルデータ投入

```bash
cd backend && DB_PORT=13306 ../.venv/bin/python scripts/seed.py
# test@example.com / testpass を作成、直近 30 日分の Mood を投入
```

## テスト

```bash
# Backend (pytest + coverage)
cd backend && DATABASE_URL=sqlite:// ../.venv/bin/pytest --cov=. --cov-report=term-missing
# Frontend (Vitest)
cd frontend && npx vitest run --coverage
# E2E (Playwright)
BASE_URL=http://localhost:3001 API_URL=http://localhost:18000 node scripts/e2e-test.mjs
```

| 対象 | カバレッジ | テスト数 |
|---|---|---|
| Backend (main / models / image_utils) | 99% / 100% / 95% | 62 |
| Frontend (composables) | 100% | 46 |

## 本番デプロイ手順

`deploy/README.md` に Cloudflare Tunnel + Caddy + バックアップ運用の Phase 別手順を記載。

## 名前について

- リポジトリ: `kibunrogu` → 公開時に `kibunlog` に rename
- アプリ表示名: 「きぶんログ」 (日本語ひらがな表記)
- 公開ドメイン: `kibunlog.takakusagi.dev`

## ライセンス

MIT License — 詳細は [LICENSE](./LICENSE) を参照。
