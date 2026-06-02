"""User テーブルに is_demo TINYINT(1) NOT NULL DEFAULT 0 を追加する migration。

冪等にしてあるので複数回実行しても安全 (既に列があればスキップ)。

Usage:
    cd backend && DB_PORT=3306 python migrate_add_is_demo.py
"""

from database import engine
from sqlalchemy import text

CHECK_SQL = """
SELECT COUNT(*) FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'users'
  AND column_name = 'is_demo'
"""

ALTER_SQL = "ALTER TABLE users ADD COLUMN is_demo TINYINT(1) NOT NULL DEFAULT 0"


def main():
    with engine.connect() as conn:
        already = conn.execute(text(CHECK_SQL)).scalar()
        if already:
            print("users.is_demo は既に存在します。スキップ。")
            return
        conn.execute(text(ALTER_SQL))
        conn.commit()
        print("users.is_demo を追加しました。")


if __name__ == "__main__":
    main()
