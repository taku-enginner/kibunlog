"""テストデータ投入スクリプト

Usage:
    cd backend && python scripts/seed.py          # デフォルト: 追加モード
    cd backend && python scripts/seed.py --clear   # 既存データをクリアして再投入
"""

import argparse
import random
import sys
from datetime import date, timedelta

sys.path.insert(0, ".")

from auth import hash_password
from database import SessionLocal, engine
from models import Base, Mood, User

SEED_USER = "test@example.com"
SEED_PASSWORD = "testpass"

MEMOS = [
    "よく眠れた",
    "朝から調子がいい",
    "少し疲れ気味",
    "昼寝した",
    "運動して気分爽快",
    "仕事がうまくいった",
    "ちょっとだるい",
    "天気が良くて気持ちいい",
    "夜ふかししてしまった",
    "友人と会って楽しかった",
    "集中できた",
    "なんとなく落ち着かない",
    None,
]

PLACE_TAGS = ["自宅", "オフィス", "カフェ", "公園", "ジム", None]

TIMES = ["07:30", "09:00", "12:00", "14:30", "17:00", "19:30", "21:00", "23:00"]


def get_or_create_user(db):
    user = db.query(User).filter(User.username == SEED_USER).first()
    if user:
        print(f"既存ユーザーを使用: {SEED_USER} (id={user.id})")
        return user
    user = User(username=SEED_USER, password_hash=hash_password(SEED_PASSWORD))
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"ユーザー作成: {SEED_USER} / {SEED_PASSWORD} (id={user.id})")
    return user


def generate_moods(user_id: int, days: int = 7) -> list[Mood]:
    moods = []
    today = date.today()
    for i in range(days):
        d = today - timedelta(days=days - 1 - i)
        date_str = d.isoformat()
        count = random.randint(2, 3)
        times = sorted(random.sample(TIMES, count))
        for t in times:
            moods.append(
                Mood(
                    user_id=user_id,
                    date=date_str,
                    time=t,
                    level=random.randint(1, 10),
                    memo=random.choice(MEMOS),
                    place_tag=random.choice(PLACE_TAGS),
                )
            )
    return moods


def main():
    parser = argparse.ArgumentParser(description="テストデータ投入")
    parser.add_argument("--clear", action="store_true", help="既存のテストユーザーデータをクリアして再投入")
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        user = get_or_create_user(db)

        if args.clear:
            deleted = db.query(Mood).filter(Mood.user_id == user.id).delete()
            db.commit()
            print(f"既存データ削除: {deleted}件")

        moods = generate_moods(user.id)
        db.add_all(moods)
        db.commit()
        print(f"Moodデータ投入完了: {len(moods)}件 (直近7日分)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
