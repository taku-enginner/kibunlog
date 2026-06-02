#!/bin/bash
# ローカルバックアップを rclone で Cloudflare R2 (or 他リモート) に同期する。
# systemd timer (kibunlog-backup-remote.timer) から週次で呼ばれる。
# rclone リモート名は環境変数 BACKUP_REMOTE で指定 (デフォルト: r2:kibunlog-backups)。
set -euo pipefail

BACKUP_DIR=/home/tak/backups/kibunlog
REMOTE="${BACKUP_REMOTE:-r2:kibunlog-backups}"

if ! command -v rclone >/dev/null 2>&1; then
    echo "rclone がインストールされていません。`curl https://rclone.org/install.sh | sudo bash` で導入してください" >&2
    exit 1
fi

rclone sync "$BACKUP_DIR" "$REMOTE" \
    --transfers 2 \
    --checkers 4 \
    --log-level INFO

echo "Remote sync completed -> $REMOTE"
