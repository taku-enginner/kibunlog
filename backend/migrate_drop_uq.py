"""Add time column and drop uq_user_date_place unique constraint."""
from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    # Add time column
    try:
        conn.execute(text("ALTER TABLE moods ADD COLUMN time VARCHAR(5) NULL AFTER date"))
        conn.commit()
        print("Added time column")
    except Exception as e:
        print(f"Skip time column: {e}")

    # Add separate index for user_id FK before dropping unique constraint
    try:
        conn.execute(text("ALTER TABLE moods ADD INDEX idx_user_id (user_id)"))
        conn.commit()
        print("Added idx_user_id")
    except Exception as e:
        print(f"Skip idx_user_id: {e}")

    # Drop unique constraint
    try:
        conn.execute(text("ALTER TABLE moods DROP INDEX uq_user_date_place"))
        conn.commit()
        print("Dropped uq_user_date_place")
    except Exception as e:
        print(f"Skip drop constraint: {e}")
