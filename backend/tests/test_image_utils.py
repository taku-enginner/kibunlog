"""Tests for image_utils module."""

import io
from pathlib import Path
from unittest.mock import MagicMock

from PIL import Image

import image_utils


def _make_image_bytes(width=100, height=100, color=(255, 0, 0)):
    """Generate a simple RGB image as bytes."""
    img = Image.new("RGB", (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class TestSanitizePlaceName:
    def test_basic(self):
        assert image_utils.sanitize_place_name("Office") == "Office"

    def test_special_chars(self):
        result = image_utils.sanitize_place_name("My Office! @Home")
        assert "!" not in result
        assert "@" not in result

    def test_japanese(self):
        result = image_utils.sanitize_place_name("東京オフィス")
        assert "東京オフィス" == result

    def test_truncation(self):
        long_name = "a" * 30
        result = image_utils.sanitize_place_name(long_name)
        assert len(result) <= 20

    def test_multiple_underscores_collapsed(self):
        result = image_utils.sanitize_place_name("a!!b")
        assert "__" not in result


class TestResizeToWebp:
    def test_resize_landscape(self):
        img = Image.new("RGB", (200, 100), (0, 255, 0))
        result = image_utils._resize_to_webp(img, 100, 50 * 1024)
        assert isinstance(result, bytes)
        # Verify it's valid webp
        loaded = Image.open(io.BytesIO(result))
        assert loaded.format == "WEBP"
        assert loaded.size[0] == 100
        assert loaded.size[1] == 50

    def test_resize_portrait(self):
        img = Image.new("RGB", (100, 200), (0, 0, 255))
        result = image_utils._resize_to_webp(img, 100, 50 * 1024)
        loaded = Image.open(io.BytesIO(result))
        assert loaded.size[1] == 100
        assert loaded.size[0] == 50

    def test_respects_max_bytes(self):
        # Create a complex image that produces larger output
        img = Image.new("RGB", (1000, 1000), (128, 64, 32))
        result = image_utils._resize_to_webp(img, 500, 50 * 1024)
        assert len(result) <= 50 * 1024


class TestProcessUpload:
    def test_process_upload(self, tmp_path, monkeypatch):
        monkeypatch.setattr(image_utils, "UPLOAD_BASE", tmp_path)

        mood = MagicMock()
        mood.date = "2025-01-01"
        mood.level = 3
        mood.place = None
        mood.place_name_for_image = "Office"

        file_bytes = _make_image_bytes()
        filename = image_utils.process_upload(file_bytes, 1, mood)

        assert filename.endswith(".webp")
        assert "Office" in filename
        assert (tmp_path / "1" / "original" / filename).exists()
        assert (tmp_path / "1" / "thumb" / filename).exists()

    def test_process_upload_no_place(self, tmp_path, monkeypatch):
        monkeypatch.setattr(image_utils, "UPLOAD_BASE", tmp_path)

        mood = MagicMock()
        mood.date = "2025-02-01"
        mood.level = 5
        mood.place = None
        mood.place_name_for_image = None

        # Also test that it doesn't have place attribute
        del mood.place

        file_bytes = _make_image_bytes()
        filename = image_utils.process_upload(file_bytes, 2, mood)

        assert "noplace" in filename
        assert (tmp_path / "2" / "original" / filename).exists()

    def test_process_upload_with_place_object(self, tmp_path, monkeypatch):
        monkeypatch.setattr(image_utils, "UPLOAD_BASE", tmp_path)

        place = MagicMock()
        place.name = "カフェ"
        mood = MagicMock()
        mood.date = "2025-03-01"
        mood.level = 2
        mood.place = place

        file_bytes = _make_image_bytes()
        filename = image_utils.process_upload(file_bytes, 1, mood)

        assert "カフェ" in filename


class TestDeleteImageFiles:
    def test_delete_existing_files(self, tmp_path, monkeypatch):
        monkeypatch.setattr(image_utils, "UPLOAD_BASE", tmp_path)

        original_dir = tmp_path / "1" / "original"
        thumb_dir = tmp_path / "1" / "thumb"
        original_dir.mkdir(parents=True)
        thumb_dir.mkdir(parents=True)

        (original_dir / "test.webp").write_bytes(b"data")
        (thumb_dir / "test.webp").write_bytes(b"data")

        image_utils.delete_image_files(1, "test.webp")

        assert not (original_dir / "test.webp").exists()
        assert not (thumb_dir / "test.webp").exists()

    def test_delete_nonexistent_files(self, tmp_path, monkeypatch):
        monkeypatch.setattr(image_utils, "UPLOAD_BASE", tmp_path)
        # Should not raise
        image_utils.delete_image_files(1, "nonexistent.webp")


class TestRotateImage:
    def test_rotate_image(self, tmp_path, monkeypatch):
        monkeypatch.setattr(image_utils, "UPLOAD_BASE", tmp_path)

        original_dir = tmp_path / "1" / "original"
        thumb_dir = tmp_path / "1" / "thumb"
        original_dir.mkdir(parents=True)
        thumb_dir.mkdir(parents=True)

        # Create webp images
        img = Image.new("RGB", (100, 50), (255, 0, 0))
        buf = io.BytesIO()
        img.save(buf, format="WEBP")
        (original_dir / "test.webp").write_bytes(buf.getvalue())

        img_thumb = Image.new("RGB", (50, 25), (255, 0, 0))
        buf2 = io.BytesIO()
        img_thumb.save(buf2, format="WEBP")
        (thumb_dir / "test.webp").write_bytes(buf2.getvalue())

        image_utils.rotate_image(1, "test.webp")

        assert (original_dir / "test.webp").exists()
        assert (thumb_dir / "test.webp").exists()

    def test_rotate_nonexistent(self, tmp_path, monkeypatch):
        monkeypatch.setattr(image_utils, "UPLOAD_BASE", tmp_path)
        # Should not raise
        image_utils.rotate_image(1, "nonexistent.webp")
