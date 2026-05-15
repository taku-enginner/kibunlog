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
from models import Mood, Place, User

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


# --- Places ---


class PlaceIn(BaseModel):
    name: str
    latitude: float | None = None
    longitude: float | None = None


class PlaceOut(BaseModel):
    id: int
    name: str
    latitude: float | None = None
    longitude: float | None = None


@app.get("/places", response_model=list[PlaceOut])
def get_places(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.query(Place).filter(Place.user_id == user.id).order_by(Place.name).all()
    return [PlaceOut(id=r.id, name=r.name, latitude=r.latitude, longitude=r.longitude) for r in rows]


@app.post("/places", response_model=PlaceOut)
def create_place(
    body: PlaceIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.query(Place).filter(Place.user_id == user.id, Place.name == body.name).first()
    if existing:
        return PlaceOut(id=existing.id, name=existing.name, latitude=existing.latitude, longitude=existing.longitude)
    place = Place(user_id=user.id, name=body.name, latitude=body.latitude, longitude=body.longitude)
    db.add(place)
    db.commit()
    db.refresh(place)
    return PlaceOut(id=place.id, name=place.name, latitude=place.latitude, longitude=place.longitude)


@app.delete("/places/{place_id}", status_code=204)
def delete_place(
    place_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    place = db.query(Place).filter(Place.id == place_id, Place.user_id == user.id).first()
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
    db.delete(place)
    db.commit()


# --- Moods ---


class MoodIn(BaseModel):
    date: str
    level: int
    memo: str | None = None
    place_id: int | None = None


class MoodOut(BaseModel):
    id: int
    date: str
    level: int
    memo: str | None = None
    place_id: int | None = None
    place_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None


def _mood_to_out(mood: Mood, place: Place | None) -> MoodOut:
    return MoodOut(
        id=mood.id,
        date=mood.date,
        level=mood.level,
        memo=mood.memo,
        place_id=mood.place_id,
        place_name=place.name if place else None,
        latitude=place.latitude if place else None,
        longitude=place.longitude if place else None,
    )


@app.post("/moods", response_model=MoodOut)
def record_mood(
    body: MoodIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Mood).filter(Mood.user_id == user.id, Mood.date == body.date)
    if body.place_id is not None:
        q = q.filter(Mood.place_id == body.place_id)
    else:
        q = q.filter(Mood.place_id.is_(None))
    mood = q.first()

    if mood:
        mood.level = body.level
        mood.memo = body.memo
    else:
        mood = Mood(
            user_id=user.id, date=body.date, level=body.level,
            memo=body.memo, place_id=body.place_id,
        )
        db.add(mood)
    db.commit()
    db.refresh(mood)
    place = db.query(Place).filter(Place.id == mood.place_id).first() if mood.place_id else None
    return _mood_to_out(mood, place)


@app.put("/moods/{mood_id}", response_model=MoodOut)
def update_mood(
    mood_id: int,
    body: MoodIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    mood = db.query(Mood).filter(Mood.id == mood_id, Mood.user_id == user.id).first()
    if not mood:
        raise HTTPException(status_code=404, detail="Mood not found")

    # 場所変更先に既存レコードがある場合はマージ
    if body.place_id != mood.place_id or body.date != mood.date:
        q = db.query(Mood).filter(
            Mood.user_id == user.id, Mood.date == body.date, Mood.id != mood_id
        )
        if body.place_id is not None:
            q = q.filter(Mood.place_id == body.place_id)
        else:
            q = q.filter(Mood.place_id.is_(None))
        existing = q.first()
        if existing:
            existing.level = body.level
            existing.memo = body.memo
            db.delete(mood)
            db.commit()
            db.refresh(existing)
            place = db.query(Place).filter(Place.id == existing.place_id).first() if existing.place_id else None
            return _mood_to_out(existing, place)

    mood.level = body.level
    mood.memo = body.memo
    mood.place_id = body.place_id
    mood.date = body.date
    db.commit()
    db.refresh(mood)
    place = db.query(Place).filter(Place.id == mood.place_id).first() if mood.place_id else None
    return _mood_to_out(mood, place)


@app.delete("/moods/{mood_id}", status_code=204)
def delete_mood(
    mood_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    mood = db.query(Mood).filter(Mood.id == mood_id, Mood.user_id == user.id).first()
    if not mood:
        raise HTTPException(status_code=404, detail="Mood not found")
    db.delete(mood)
    db.commit()


@app.get("/moods", response_model=list[MoodOut])
def get_moods(
    from_date: str | None = None,
    to_date: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Mood, Place).outerjoin(Place, Mood.place_id == Place.id).filter(Mood.user_id == user.id)
    if from_date:
        q = q.filter(Mood.date >= from_date)
    if to_date:
        q = q.filter(Mood.date <= to_date)
    rows = q.order_by(Mood.date, Mood.id).all()
    return [_mood_to_out(mood, place) for mood, place in rows]


@app.get("/moods/with-location", response_model=list[MoodOut])
def get_moods_with_location(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Mood, Place)
        .join(Place, Mood.place_id == Place.id)
        .filter(
            Mood.user_id == user.id,
            Place.latitude.isnot(None),
            Place.longitude.isnot(None),
        )
        .order_by(Mood.date.desc())
        .limit(500)
        .all()
    )
    return [_mood_to_out(mood, place) for mood, place in rows]
