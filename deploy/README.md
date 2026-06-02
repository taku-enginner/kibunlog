# kibunlog 公開デプロイ手順 (Cloudflare Tunnel + 多段 Phase 公開)

wedding_invitation と同じ Debian サーバーに相乗りする前提。
インバウンドポートを一切開けずに、Cloudflare Tunnel (`cloudflared`) と Tailscale だけで運用する。

```
              HTTPS                       Tunnel (アウトバウンドのみ)
採用担当の ───────────→ Cloudflare ────────────────→ cloudflared (Debian)
ブラウザ                  Edge                              │
                                                           │ http://localhost:8081
                                                    ┌──────┴──────┐
                                                    │ Caddy :80   │ ← パス振り分け (公開用)
                                                    │ Caddy :443  │ ← Tailscale 経由 (自分専用)
                                                    └──────┬──────┘
                                                ┌──────────┴──────────┐
                                       frontend (Nuxt:3000)  backend (FastAPI:8000)
```

利点:
- 既存の wedding_invitation 用 Cloudflare Tunnel に ingress を追加するだけ
- 既存の Tailscale 経由 HTTPS (`debian.tail69d614.ts.net:8443`) も今までどおり残せる
- 認証はアプリ内 JWT に集約。Basic 認証は使わない
- spam サインアップは Cloudflare WAF Rate Limiting で抑える

## 段階公開計画

- **Phase 1 (本書がカバーする範囲)**: インフラだけ整えて自分の register/login が公開ドメインから通る状態にする。デモ機能・オンボーディング・画像悪用対策はまだ実装しない。よって Phase 1 公開中は **register エンドポイントが裸**。必ず Cloudflare WAF Rate Limiting を設定してから公開する
- **Phase 2**: backend に `User.is_demo` + `POST /auth/demo`、画像サイズ・枚数制限、frontend にランディング/オンボーディング画面を追加
- **Phase 3**: バックアップ運用 (mysqldump + uploads tar + R2 同期) とデモアカウント掃除 systemd timer
- **Phase 4**: gitleaks スキャン → LICENSE → README ポートフォリオ整備 → リポジトリ rename → GitHub public

---

## Phase 1 手順

### 1. サーバに `.env` を配備

```bash
ssh deploy@<tailscale-name>
cd /home/tak/kibunlog
cp env.example .env
$EDITOR .env
```

`.env` に以下をセット:

| 変数 | 値 |
|------|----|
| `PUBLIC_DOMAIN` | `kibunlog.takakusagi.dev` |
| `COMPOSE_PROJECT_NAME` | `kibunrogu` (固定。既存 volume を引き継ぐため) |

### 2. Cloudflare DNS にレコード追加

```bash
cloudflared tunnel route dns wedding kibunlog.takakusagi.dev
```

`wedding` は既存トンネル名。`cloudflared tunnel list` で確認できる。

### 3. cloudflared の ingress に追加

```bash
sudo $EDITOR /etc/cloudflared/config.yml
```

既存の `wedding.takakusagi.dev` ブロックの**前**に追加。ingress は上から評価される。

```yaml
ingress:
  - hostname: kibunlog.takakusagi.dev
    service: http://localhost:8081
    originRequest:
      connectTimeout: 30s
      httpHostHeader: kibunlog.takakusagi.dev
  - hostname: wedding.takakusagi.dev
    service: http://localhost:3000
    originRequest:
      noTLSVerify: false
      connectTimeout: 30s
      httpHostHeader: wedding.takakusagi.dev
  - service: http_status:404
```

反映:

```bash
sudo systemctl restart cloudflared
sudo systemctl status cloudflared
```

### 4. Cloudflare WAF Rate Limiting を設定 (必須)

**Phase 1 では register エンドポイントが裸なので、これを先に設定しないと公開しない**。

Cloudflare ダッシュボード → 該当ドメイン → Security → WAF → Rate limiting rules:

| ルール名 | 条件 | アクション |
|----------|------|-----------|
| `kibunlog auth register limit` | `(http.request.uri.path eq "/auth/register" and http.request.method eq "POST" and http.host eq "kibunlog.takakusagi.dev")` | `5 requests / 1 minute / per IP` で `Block` |
| `kibunlog auth demo limit` (Phase 2 以降) | 同上 path を `/auth/demo` に | 同条件 |
| `kibunlog image upload limit` (Phase 2 以降) | path matches `/moods/*/image` and method POST | `5 requests / 1 minute / per IP` で `Block` |

Free プランでも Rate Limiting 1ルールは無料、Pro 以上は複数可。Free で1ルールに収めたいなら、URI を OR 条件でまとめる。

### 5. kibunlog をビルド & 起動

```bash
cd /home/tak/kibunlog
git pull
docker compose -f docker-compose.debian.yml up -d --build
```

`COMPOSE_PROJECT_NAME=kibunrogu` の効果で、既存の `kibunrogu_db_data` / `kibunrogu_uploads_data` volume を引き継ぐ。

### 6. 動作確認

1. `https://kibunlog.takakusagi.dev` を開く → 既存の login.vue が出る (Phase 1 はランディングなし)
2. 「新規登録」モードに切替 → 自分の本物アカウントでログイン
3. 既存の Tailscale 経由 (`https://debian.tail69d614.ts.net:8443`) でも以前と同じデータが見える
4. `curl -sI https://kibunlog.takakusagi.dev/robots.txt` で `200` を返し、`Disallow: /` が返る
5. ページソースに `<meta name="robots" content="noindex, nofollow">` が含まれる

ログ確認:

```bash
docker compose -f docker-compose.debian.yml logs -f caddy frontend backend
sudo journalctl -u cloudflared -f
```

---

## Phase 2 手順

Phase 2 で追加した backend / frontend の機能はコードがリポジトリに入っていれば自動で有効になる。
ただし backend の `users` テーブルに `is_demo` カラムを追加する migration が必要:

```bash
cd /home/tak/kibunlog
git pull
docker compose -f docker-compose.debian.yml up -d --build
docker compose -f docker-compose.debian.yml exec backend python migrate_add_is_demo.py
```

動作確認:

```bash
curl -sX POST https://kibunlog.takakusagi.dev/auth/demo | jq
# -> {"token": "...", "username": "demo-xxxxxxxx@example.com"}
```

ブラウザで開けば未ログイン時はランディング画面、「デモを見る」でサンプルデータ入り
アカウントに即ログイン、画像アップは 403。

## Phase 3 手順 (バックアップ + デモ掃除の systemd)

### 3.1 ホスト側パッケージの導入

```bash
sudo apt update
sudo apt install -y gnupg            # backup を gpg 暗号化するため
curl https://rclone.org/install.sh | sudo bash   # R2 同期用 (公式 install スクリプト)
```

### 3.2 バックアップ暗号化のパスフレーズ設定 (任意だが推奨)

```bash
$EDITOR /home/tak/kibunlog/.env
# 以下を追記。サーバ単独乗っ取り時にもバックアップが読めないようにする
# BACKUP_PASSPHRASE='強めのランダム文字列(例: openssl rand -hex 32)'
```

設定なしでも動くが、その場合は `.gz` 平文のままローカル/R2 に置かれる。

### 3.3 systemd unit を配置

```bash
sudo cp /home/tak/kibunlog/deploy/systemd/*.service /etc/systemd/system/
sudo cp /home/tak/kibunlog/deploy/systemd/*.timer /etc/systemd/system/
sudo systemctl daemon-reload

# デモ掃除 (毎時)
sudo systemctl enable --now kibunlog-demo-cleanup.timer

# ローカル日次バックアップ (毎日 03:00)
sudo systemctl enable --now kibunlog-backup.timer
```

R2 同期 timer は 3.4 で rclone を設定してから有効化する。

確認:

```bash
systemctl list-timers --no-pager | grep kibunlog
sudo systemctl status kibunlog-demo-cleanup.timer
```

手動で1回走らせてみる:

```bash
sudo systemctl start kibunlog-demo-cleanup.service
sudo journalctl -u kibunlog-demo-cleanup.service --no-pager -n 20

sudo systemctl start kibunlog-backup.service
sudo journalctl -u kibunlog-backup.service --no-pager -n 30
ls -la /home/tak/backups/kibunlog/
```

### 3.4 Cloudflare R2 を rclone リモートとして設定

Cloudflare ダッシュボード → R2 → Manage R2 API Tokens → トークン発行 (Read & Write)。
バケット `kibunlog-backups` を作成 (R2 → Create bucket)。

```bash
rclone config
# n) New remote
# name>  r2
# Storage>  s3
# provider>  Cloudflare
# env_auth>  false
# access_key_id>  <R2 トークンの Access Key>
# secret_access_key>  <R2 トークンの Secret>
# region>  auto
# endpoint>  https://<account-id>.r2.cloudflarestorage.com
# その他はデフォルト
# y) Yes this is OK -> q) Quit config
```

接続テスト:

```bash
rclone lsd r2:
# kibunlog-backups が見えれば OK
```

R2 同期 timer を有効化:

```bash
sudo systemctl enable --now kibunlog-backup-remote.timer
sudo systemctl start kibunlog-backup-remote.service   # 即時1回実行
rclone ls r2:kibunlog-backups/
```

### 3.5 リストアテスト (1回必ずやる)

「バックアップは取れているが復元方法が分からない」事故を防ぐため、初回は手動で復元テストを走らせる。

```bash
/home/tak/kibunlog/deploy/scripts/restore-test.sh
# 復元先は kibunrogu_test という別 DB。本番 (kibunrogu) は触らない
# 各テーブルの行数が表示されれば OK
```

確認後、テスト DB は手動で DROP するか、放置でも害なし (再実行時に DROP IF EXISTS される)。

## Phase 4 以降の手順 (TODO)

Phase 4: gitleaks → LICENSE → README → rename → public → 実装完了後に追記

---

## 採用活動終了時のクリーンアップ

公開を畳む時の手順。**先に最終バックアップを取ってから撤去する**。

### 1. 最終バックアップ

```bash
/home/tak/kibunlog/deploy/scripts/backup.sh
# /home/tak/backups/kibunlog/ に最新の dump が作成される
rclone sync /home/tak/backups/kibunlog/ r2:kibunlog-backups/final/
```

### 2. 個人情報削除

採用担当が register したアカウントは全削除する。自分の user_id だけを残す。

```bash
docker compose -f docker-compose.debian.yml exec db mysql -uroot -p"$MYSQL_ROOT_PASSWORD" kibunrogu -e "
SET @me := (SELECT id FROM users WHERE username = 'YOUR_USERNAME');
DELETE FROM heatmap_events WHERE user_id != @me;
DELETE FROM moods WHERE user_id != @me;
DELETE FROM places WHERE user_id != @me;
DELETE FROM users WHERE id != @me;
"
```

注意: models.py の ForeignKey に `ondelete='CASCADE'` を入れていれば `DELETE FROM users` だけで連動削除。入れていないなら上記のように順番に削除する (Phase 2 で CASCADE 化予定)。

### 3. 画像ファイル削除

自分以外の user_id ディレクトリを削除。

```bash
docker compose -f docker-compose.debian.yml exec backend sh -c \
  'find /app/uploads -mindepth 1 -maxdepth 1 -type d ! -name "YOUR_USER_ID" -exec rm -rf {} +'
```

### 4. 公開エンドポイント撤去

```bash
# cloudflared から ingress を削除
sudo $EDITOR /etc/cloudflared/config.yml   # kibunlog ブロック削除
sudo systemctl restart cloudflared

# Cloudflare DNS から kibunlog.takakusagi.dev を削除 (ダッシュボードで)

# Caddyfile から公開ブロック削除
$EDITOR Caddyfile   # http://{$PUBLIC_DOMAIN} ブロック削除
# docker-compose.debian.yml から 127.0.0.1:8080:80 削除
$EDITOR docker-compose.debian.yml

# .env から PUBLIC_DOMAIN を削除
$EDITOR .env

# デモ掃除 systemd timer 停止 (Phase 3 で導入)
sudo systemctl disable --now kibunlog-demo-cleanup.timer

docker compose -f docker-compose.debian.yml up -d
```

これで Tailscale 経由のみの状態に戻る。

### 5. GitHub リポジトリの扱い

ポートフォリオの履歴として残すなら public のまま、転職活動が一段落して "見せたくない" なら Settings → Change visibility → Private。決めた方を選んでこの README にメモする。

決定: __________________ (記入する)

---

## 落とし穴

- [ ] `cloudflared tunnel route dns` を打たないと DNS は変わらない
- [ ] Caddy の `127.0.0.1:8081:80` は **127.0.0.1 限定**バインド。`0.0.0.0:8081:80` にしてはダメ。（ホスト 8080 は shutdown-api が使用中のため 8081 を採用）
- [ ] Tailscale 経由アクセス (`debian.tail69d614.ts.net:8443`) では認証なし(JWTのみ)。Cloudflare WAF は当然効かない。Tailscale 端末は信頼前提
- [ ] Phase 1 で **WAF Rate Limiting を入れる前に公開しない**。bot に register を叩かれる前に必ず先に設定する
- [ ] `COMPOSE_PROJECT_NAME=kibunrogu` を消すとディレクトリ名から自動的に project name が決まり、既存 volume を見失う。`.env` で明示し続けること
- [ ] noindex meta は SSR/CSR どちらでも HTML に含まれる必要がある。動作確認時に `curl -s https://kibunlog.takakusagi.dev/ | grep robots` で必ず存在確認する
- [ ] バックアップ運用 (Phase 3) は最短で Phase 3 着手前に手動で1回 mysqldump を取っておく。Phase 1 〜 Phase 3 着手までの空白期にデータ消失すると悲しい
