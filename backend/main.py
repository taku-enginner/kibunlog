from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from database import Base, engine, get_db
from models import Mood, User

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Auth ---


class AuthIn(BaseModel):
    username: str
    password: str


class AuthOut(BaseModel):
    token: str
    username: str


@app.post("/auth/register", response_model=AuthOut)
def register(body: AuthIn, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == body.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists"
        )
    user = User(username=body.username, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id)
    return AuthOut(token=token, username=user.username)


@app.post("/auth/login", response_model=AuthOut)
def login(body: AuthIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    token = create_access_token(user.id)
    return AuthOut(token=token, username=user.username)


# --- Moods ---


class MoodIn(BaseModel):
    date: str
    level: int
    memo: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class MoodOut(BaseModel):
    date: str
    level: int
    memo: str | None = None
    latitude: float | None = None
    longitude: float | None = None


@app.post("/moods", response_model=MoodOut)
def record_mood(
    body: MoodIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    mood = (
        db.query(Mood)
        .filter(Mood.user_id == user.id, Mood.date == body.date)
        .first()
    )
    if mood:
        mood.level = body.level
        mood.memo = body.memo
        mood.latitude = body.latitude
        mood.longitude = body.longitude
    else:
        mood = Mood(
            user_id=user.id, date=body.date, level=body.level, memo=body.memo,
            latitude=body.latitude, longitude=body.longitude,
        )
        db.add(mood)
    db.commit()
    db.refresh(mood)
    return MoodOut(
        date=mood.date, level=mood.level, memo=mood.memo,
        latitude=mood.latitude, longitude=mood.longitude,
    )


@app.get("/moods", response_model=list[MoodOut])
def get_moods(
    from_date: str | None = None,
    to_date: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Mood).filter(Mood.user_id == user.id)
    if from_date:
        q = q.filter(Mood.date >= from_date)
    if to_date:
        q = q.filter(Mood.date <= to_date)
    rows = q.order_by(Mood.date).all()
    return [
        MoodOut(
            date=r.date, level=r.level, memo=r.memo,
            latitude=r.latitude, longitude=r.longitude,
        )
        for r in rows
    ]


@app.get("/moods/with-location", response_model=list[MoodOut])
def get_moods_with_location(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Mood)
        .filter(
            Mood.user_id == user.id,
            Mood.latitude.isnot(None),
            Mood.longitude.isnot(None),
        )
        .order_by(Mood.date.desc())
        .limit(500)
        .all()
    )
    return [
        MoodOut(
            date=r.date, level=r.level, memo=r.memo,
            latitude=r.latitude, longitude=r.longitude,
        )
        for r in rows
    ]
