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
4. **マップ (/map)** - 場所ごとにピン集約（色=平均気分、サイズ=記録数）+ 高評価フィルター
5. **プラスα (/insights)** - 週次サマリー・曜日別・時間帯別・クロス分析・ストリーク・UIヒートマップ

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

### 将来的な拡張時の注意

- マップへの画像表示、分析での画像利用などで画像を増やす場合も同じ方針を適用
- WiFi判定による自動/手動切替を検討（4G時は警告表示）
- バッチアップロード（WiFi時にまとめて送信）も選択肢

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
