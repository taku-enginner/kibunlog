#!/bin/bash
# kibunlog の DB + 画像のローカル日次バックアップ。
# 暗号化に gpg --symmetric (AES256) を使う。BACKUP_PASSPHRASE は環境変数 or .env から取得。
# systemd timer (kibunlog-backup.timer) から日次で呼ばれる。
set -euo pipefail

REPO_DIR=/home/tak/kibunrogu
BACKUP_DIR=/home/tak/backups/kibunlog
COMPOSE_FILE="$REPO_DIR/docker-compose.debian.yml"
TS=$(date +%Y%m%d_%H%M%S)
RETAIN_DAYS=7

ENV_FILE="$REPO_DIR/.env"
if [ -f "$ENV_FILE" ]; then
    set -a
    . "$ENV_FILE"
    set +a
fi

MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-password}"

mkdir -p "$BACKUP_DIR"

# --- DB ダンプ ---
docker compose -f "$COMPOSE_FILE" exec -T db \
    mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" kibunrogu \
    | gzip > "$BACKUP_DIR/db_${TS}.sql.gz"

# --- 画像 tar (volume を一時マウントしてアーカイブ) ---
# tar 作成後にホスト所有者で chown (alpine コンテナは root で動くため、そのままだと
# ホスト側で root 所有になる)
UID_GID="$(id -u):$(id -g)"
docker run --rm \
    -v kibunrogu_uploads_data:/data:ro \
    -v "$BACKUP_DIR":/backup \
    alpine sh -c "tar czf /backup/uploads_${TS}.tar.gz -C /data . && chown $UID_GID /backup/uploads_${TS}.tar.gz"

# --- gpg 暗号化 (passphrase 設定時のみ。サーバ単独乗っ取り時の機密保持) ---
if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
    gpg --batch --yes --passphrase "$BACKUP_PASSPHRASE" --symmetric --cipher-algo AES256 \
        "$BACKUP_DIR/db_${TS}.sql.gz"
    gpg --batch --yes --passphrase "$BACKUP_PASSPHRASE" --symmetric --cipher-algo AES256 \
        "$BACKUP_DIR/uploads_${TS}.tar.gz"
    rm "$BACKUP_DIR/db_${TS}.sql.gz" "$BACKUP_DIR/uploads_${TS}.tar.gz"
    echo "Backup encrypted: $TS"
else
    echo "Backup unencrypted (BACKUP_PASSPHRASE not set): $TS"
fi

# --- 世代管理 (7日以上経過したファイルを削除) ---
find "$BACKUP_DIR" -type f -mtime +"$RETAIN_DAYS" -delete

echo "Backup completed: $TS"
