#!/bin/bash
# 最新の DB バックアップを kibunrogu_test という別 DB に復元して、テーブル・行数が見えるか確認する。
# 本番 DB を壊さずに「バックアップが本当に復元可能か」をテストする。
# 既存の kibunrogu_test があれば一度 DROP するので、何度走らせても安全。
set -euo pipefail

REPO_DIR=/home/tak/kibunlog
BACKUP_DIR=/home/tak/backups/kibunlog
COMPOSE_FILE="$REPO_DIR/docker-compose.debian.yml"
TEST_DB=kibunrogu_test

ENV_FILE="$REPO_DIR/.env"
if [ -f "$ENV_FILE" ]; then
    set -a
    . "$ENV_FILE"
    set +a
fi
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-password}"

# 最新の DB バックアップを探す (.gz or .gz.gpg)
LATEST=$(ls -t "$BACKUP_DIR"/db_*.sql.gz* 2>/dev/null | head -1)
if [ -z "$LATEST" ]; then
    echo "復元対象のバックアップが見つかりません ($BACKUP_DIR/db_*.sql.gz)" >&2
    exit 1
fi
echo "復元対象: $LATEST"

# gpg 復号 (必要時)
TMP_SQL=$(mktemp /tmp/kibunlog-restore-XXXXXX.sql)
trap 'rm -f "$TMP_SQL"' EXIT
if [[ "$LATEST" == *.gpg ]]; then
    if [ -z "${BACKUP_PASSPHRASE:-}" ]; then
        echo "BACKUP_PASSPHRASE が未設定です。.env で設定してください" >&2
        exit 1
    fi
    gpg --batch --yes --passphrase "$BACKUP_PASSPHRASE" --decrypt "$LATEST" | gunzip > "$TMP_SQL"
else
    gunzip -c "$LATEST" > "$TMP_SQL"
fi

# テスト DB を作り直して復元
docker compose -f "$COMPOSE_FILE" exec -T db mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "
DROP DATABASE IF EXISTS $TEST_DB;
CREATE DATABASE $TEST_DB CHARACTER SET utf8mb4;
"

docker compose -f "$COMPOSE_FILE" exec -T db mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$TEST_DB" < "$TMP_SQL"

# 行数確認
echo "復元結果 (rows per table):"
docker compose -f "$COMPOSE_FILE" exec -T db mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$TEST_DB" -e "
SELECT 'users' AS tbl, COUNT(*) AS rows_count FROM users
UNION ALL SELECT 'places', COUNT(*) FROM places
UNION ALL SELECT 'moods', COUNT(*) FROM moods
UNION ALL SELECT 'heatmap_events', COUNT(*) FROM heatmap_events;
"

echo "Restore test passed. Test DB '$TEST_DB' is left for inspection. DROP it when done."
