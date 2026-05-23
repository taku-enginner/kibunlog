import io
import zipfile
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from database import Base, engine, get_db
from image_utils import UPLOAD_BASE, delete_image_files, process_upload, rotate_image
from models import HeatmapEvent, Mood, Place, User

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
    time: str | None = None
    level: int
    memo: str | None = None
    place_id: int | None = None
    place_tag: str | None = None


class MoodOut(BaseModel):
    id: int
    date: str
    time: str | None = None
    level: int
    memo: str | None = None
    place_id: int | None = None
    place_name: str | None = None
    place_tag: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    has_image: bool = False


def _mood_to_out(mood: Mood, place: Place | None) -> MoodOut:
    return MoodOut(
        id=mood.id,
        date=mood.date,
        time=mood.time,
        level=mood.level,
        memo=mood.memo,
        place_id=mood.place_id,
        place_name=place.name if place else None,
        place_tag=mood.place_tag,
        latitude=place.latitude if place else None,
        longitude=place.longitude if place else None,
        has_image=mood.image_path is not None,
    )


@app.post("/moods", response_model=MoodOut)
def record_mood(
    body: MoodIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    mood = Mood(
        user_id=user.id, date=body.date, time=body.time,
        level=body.level, memo=body.memo, place_id=body.place_id, place_tag=body.place_tag,
    )
    db.add(mood)
    db.commit()
    db.refresh(mood)
    place = db.query(Place).filter(Place.id == mood.place_id).first() if mood.place_id else None
    return _mood_to_out(mood, place)


class ImageDownloadIn(BaseModel):
    mood_ids: list[int]


@app.post("/moods/images/download")
def download_images(
    body: ImageDownloadIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    moods = (
        db.query(Mood)
        .filter(Mood.id.in_(body.mood_ids), Mood.user_id == user.id, Mood.image_path.isnot(None))
        .all()
    )
    if not moods:
        raise HTTPException(status_code=404, detail="No images found")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for mood in moods:
            file_path = UPLOAD_BASE / str(user.id) / "original" / mood.image_path
            if file_path.exists():
                zf.write(file_path, mood.image_path)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=mood_images.zip"},
    )


@app.post("/moods/{mood_id}/image", response_model=MoodOut)
def upload_mood_image(
    mood_id: int,
    file: UploadFile,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    mood = db.query(Mood).filter(Mood.id == mood_id, Mood.user_id == user.id).first()
    if not mood:
        raise HTTPException(status_code=404, detail="Mood not found")

    # Delete old image if exists
    if mood.image_path:
        delete_image_files(user.id, mood.image_path)

    file_bytes = file.file.read()

    # Attach place_name for filename generation
    place = db.query(Place).filter(Place.id == mood.place_id).first() if mood.place_id else None
    mood.place_name_for_image = place.name if place else None

    filename = process_upload(file_bytes, user.id, mood)
    mood.image_path = filename
    db.commit()
    db.refresh(mood)
    return _mood_to_out(mood, place)


@app.get("/moods/{mood_id}/image/thumb")
def get_mood_image_thumb(
    mood_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    mood = db.query(Mood).filter(Mood.id == mood_id, Mood.user_id == user.id).first()
    if not mood or not mood.image_path:
        raise HTTPException(status_code=404, detail="Image not found")
    file_path = UPLOAD_BASE / str(user.id) / "thumb" / mood.image_path
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail file not found")
    return FileResponse(file_path, media_type="image/webp")


@app.get("/moods/{mood_id}/image")
def get_mood_image(
    mood_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    mood = db.query(Mood).filter(Mood.id == mood_id, Mood.user_id == user.id).first()
    if not mood or not mood.image_path:
        raise HTTPException(status_code=404, detail="Image not found")
    file_path = UPLOAD_BASE / str(user.id) / "original" / mood.image_path
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found")
    return FileResponse(file_path, media_type="image/webp")


@app.delete("/moods/{mood_id}/image", status_code=204)
def delete_mood_image(
    mood_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    mood = db.query(Mood).filter(Mood.id == mood_id, Mood.user_id == user.id).first()
    if not mood or not mood.image_path:
        raise HTTPException(status_code=404, detail="Image not found")
    delete_image_files(user.id, mood.image_path)
    mood.image_path = None
    db.commit()


@app.post("/moods/{mood_id}/image/rotate", status_code=200)
def rotate_mood_image(
    mood_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    mood = db.query(Mood).filter(Mood.id == mood_id, Mood.user_id == user.id).first()
    if not mood or not mood.image_path:
        raise HTTPException(status_code=404, detail="Image not found")
    rotate_image(user.id, mood.image_path)
    return {"status": "ok"}


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
    mood.level = body.level
    mood.memo = body.memo
    mood.place_id = body.place_id
    mood.place_tag = body.place_tag
    mood.date = body.date
    mood.time = body.time
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
    if mood.image_path:
        delete_image_files(user.id, mood.image_path)
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


# --- Heatmap ---


class HeatmapEventIn(BaseModel):
    x_pct: float
    y_pct: float
    page: str
    event_type: str
    timestamp: str | None = None


class HeatmapEventOut(BaseModel):
    id: int
    page: str
    x_pct: float
    y_pct: float
    event_type: str
    created_at: str


@app.post("/heatmap", status_code=201)
def record_heatmap(
    events: list[HeatmapEventIn],
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    for ev in events:
        row = HeatmapEvent(
            user_id=user.id,
            page=ev.page,
            x_pct=ev.x_pct,
            y_pct=ev.y_pct,
            event_type=ev.event_type,
        )
        db.add(row)
    db.commit()
    return {"saved": len(events)}


@app.get("/heatmap", response_model=list[HeatmapEventOut])
def get_heatmap(
    page: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(HeatmapEvent).filter(HeatmapEvent.user_id == user.id)
    if page:
        q = q.filter(HeatmapEvent.page == page)
    rows = q.order_by(HeatmapEvent.created_at.desc()).limit(5000).all()
    return [
        HeatmapEventOut(
            id=r.id,
            page=r.page,
            x_pct=r.x_pct,
            y_pct=r.y_pct,
            event_type=r.event_type,
            created_at=r.created_at.isoformat(),
        )
        for r in rows
    ]
