"""24h 経過したデモアカウントとその関連データを削除する。

systemd timer から hourly に呼ばれる想定。
models.py に ondelete='CASCADE' を入れていないので、子テーブルを先に手動で削除する。
"""

import shutil
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, ".")

from database import SessionLocal
from models import HeatmapEvent, Mood, Place, User

UPLOAD_BASE = Path("/app/uploads")
DEMO_RETENTION = timedelta(hours=24)


def main():
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - DEMO_RETENTION
        # MySQL の DATETIME には timezone がないので naive に揃える
        cutoff_naive = cutoff.replace(tzinfo=None)
        expired = (
            db.query(User)
            .filter(User.is_demo.is_(True), User.created_at < cutoff_naive)
            .all()
        )
        for u in expired:
            db.query(HeatmapEvent).filter(HeatmapEvent.user_id == u.id).delete()
            db.query(Mood).filter(Mood.user_id == u.id).delete()
            db.query(Place).filter(Place.user_id == u.id).delete()
            user_dir = UPLOAD_BASE / str(u.id)
            if user_dir.exists():
                shutil.rmtree(user_dir, ignore_errors=True)
            db.delete(u)
        db.commit()
        print(f"Deleted {len(expired)} expired demo accounts")
    finally:
        db.close()


if __name__ == "__main__":
    main()
