import io
import re
from pathlib import Path

from PIL import Image, ImageOps

UPLOAD_BASE = Path("/app/uploads")


def sanitize_place_name(name: str) -> str:
    """Replace non-alphanumeric/non-Japanese chars with _, truncate to 20 chars."""
    # Keep alphanumeric, Japanese (hiragana, katakana, kanji), replace rest with _
    sanitized = re.sub(r"[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]", "_", name)
    sanitized = re.sub(r"_+", "_", sanitized).strip("_")
    return sanitized[:20]


def _resize_to_webp(img: Image.Image, long_side: int, max_bytes: int) -> bytes:
    """Resize image so longest side = long_side, encode as WebP within max_bytes."""
    w, h = img.size
    if w >= h:
        new_w = long_side
        new_h = int(h * long_side / w)
    else:
        new_h = long_side
        new_w = int(w * long_side / h)

    resized = img.resize((new_w, new_h), Image.LANCZOS)

    # Try decreasing quality to fit under max_bytes
    for quality in range(85, 10, -5):
        buf = io.BytesIO()
        resized.save(buf, format="WEBP", quality=quality)
        if buf.tell() <= max_bytes:
            return buf.getvalue()

    # Last resort: lowest quality
    buf = io.BytesIO()
    resized.save(buf, format="WEBP", quality=10)
    return buf.getvalue()


def process_upload(file_bytes: bytes, user_id: int, mood) -> str:
    """
    Process uploaded image: create original (1200px, <200KB) and thumbnail (100px, <10KB).
    Returns the generated filename.
    """
    img = Image.open(io.BytesIO(file_bytes))
    img = ImageOps.exif_transpose(img)
    img = img.convert("RGB")

    # Build filename
    place_name = ""
    if hasattr(mood, "place") and mood.place:
        place_name = sanitize_place_name(mood.place.name)
    elif hasattr(mood, "place_name_for_image") and mood.place_name_for_image:
        place_name = sanitize_place_name(mood.place_name_for_image)
    else:
        place_name = "noplace"

    filename = f"{mood.date}_{place_name}_{mood.level}.webp"

    # Directories
    original_dir = UPLOAD_BASE / str(user_id) / "original"
    thumb_dir = UPLOAD_BASE / str(user_id) / "thumb"
    original_dir.mkdir(parents=True, exist_ok=True)
    thumb_dir.mkdir(parents=True, exist_ok=True)

    # Generate and save original (long side 1200px, <200KB)
    original_bytes = _resize_to_webp(img, 1200, 200 * 1024)
    (original_dir / filename).write_bytes(original_bytes)

    # Generate and save thumbnail (long side 100px, <10KB)
    thumb_bytes = _resize_to_webp(img, 100, 10 * 1024)
    (thumb_dir / filename).write_bytes(thumb_bytes)

    return filename


def rotate_image(user_id: int, filename: str) -> None:
    """Rotate original and thumbnail 90 degrees clockwise, overwrite files."""
    original_path = UPLOAD_BASE / str(user_id) / "original" / filename
    thumb_path = UPLOAD_BASE / str(user_id) / "thumb" / filename

    if original_path.exists():
        img = Image.open(original_path)
        rotated = img.rotate(-90, expand=True)
        original_bytes = _resize_to_webp(rotated, 1200, 200 * 1024)
        original_path.write_bytes(original_bytes)

    if thumb_path.exists():
        img = Image.open(thumb_path)
        rotated = img.rotate(-90, expand=True)
        thumb_bytes = _resize_to_webp(rotated, 100, 10 * 1024)
        thumb_path.write_bytes(thumb_bytes)


def delete_image_files(user_id: int, filename: str) -> None:
    """Delete original and thumbnail files for a given image."""
    original = UPLOAD_BASE / str(user_id) / "original" / filename
    thumb = UPLOAD_BASE / str(user_id) / "thumb" / filename
    if original.exists():
        original.unlink()
    if thumb.exists():
        thumb.unlink()
