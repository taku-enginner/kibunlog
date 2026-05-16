from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("ALTER TABLE moods ADD COLUMN image_path VARCHAR(500) NULL"))
    conn.commit()
