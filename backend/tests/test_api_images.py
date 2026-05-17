"""Tests for image-related API endpoints and other missing coverage in main.py."""

import io
from pathlib import Path
from unittest.mock import patch

from PIL import Image


def _make_image_bytes(width=10, height=10, color=(255, 0, 0)):
    """Generate a simple RGB image as PNG bytes."""
    img = Image.new("RGB", (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class TestPlaceDuplicate:
    """Test that creating a duplicate place returns the existing one (line 106)."""

    def test_create_duplicate_place(self, client, auth_header):
        resp1 = client.post("/places", json={"name": "Office", "latitude": 35.6, "longitude": 139.7}, headers=auth_header)
        assert resp1.status_code == 200
        resp2 = client.post("/places", json={"name": "Office", "latitude": 35.6, "longitude": 139.7}, headers=auth_header)
        assert resp2.status_code == 200
        assert resp1.json()["id"] == resp2.json()["id"]


class TestPlaceNotFound:
    """Test deleting non-existent place (line 122)."""

    def test_delete_nonexistent_place(self, client, auth_header):
        resp = client.delete("/places/9999", headers=auth_header)
        assert resp.status_code == 404


class TestMoodImageUpload:
    def test_upload_image(self, client, auth_header, tmp_path, monkeypatch):
        import image_utils
        monkeypatch.setattr(image_utils, "UPLOAD_BASE", tmp_path)

        # Create a mood first
        resp = client.post("/moods", json={"date": "2025-01-01", "level": 3}, headers=auth_header)
        mood_id = resp.json()["id"]

        img_bytes = _make_image_bytes()
        resp = client.post(
            f"/moods/{mood_id}/image",
            files={"file": ("test.png", img_bytes, "image/png")},
            headers=auth_header,
        )
        assert resp.status_code == 200
        assert resp.json()["has_image"] is True

    def test_upload_image_not_found(self, client, auth_header):
        img_bytes = _make_image_bytes()
        resp = client.post(
            "/moods/9999/image",
            files={"file": ("test.png", img_bytes, "image/png")},
            headers=auth_header,
        )
        assert resp.status_code == 404

    def test_upload_replaces_existing(self, client, auth_header, tmp_path, monkeypatch):
        import image_utils
        monkeypatch.setattr(image_utils, "UPLOAD_BASE", tmp_path)

        resp = client.post("/moods", json={"date": "2025-01-01", "level": 3}, headers=auth_header)
        mood_id = resp.json()["id"]

        img_bytes = _make_image_bytes()
        client.post(f"/moods/{mood_id}/image", files={"file": ("test.png", img_bytes, "image/png")}, headers=auth_header)
        # Upload again to trigger delete of old image
        resp = client.post(f"/moods/{mood_id}/image", files={"file": ("test2.png", img_bytes, "image/png")}, headers=auth_header)
        assert resp.status_code == 200

    def test_upload_with_place(self, client, auth_header, tmp_path, monkeypatch):
        import image_utils
        monkeypatch.setattr(image_utils, "UPLOAD_BASE", tmp_path)

        # Create place first
        place_resp = client.post("/places", json={"name": "Cafe", "latitude": 35.0, "longitude": 139.0}, headers=auth_header)
        place_id = place_resp.json()["id"]

        resp = client.post("/moods", json={"date": "2025-01-01", "level": 4, "place_id": place_id}, headers=auth_header)
        mood_id = resp.json()["id"]

        img_bytes = _make_image_bytes()
        resp = client.post(f"/moods/{mood_id}/image", files={"file": ("test.png", img_bytes, "image/png")}, headers=auth_header)
        assert resp.status_code == 200


class TestMoodImageGet:
    def _setup_mood_with_image(self, client, auth_header, tmp_path, monkeypatch):
        import image_utils
        import main as main_mod
        monkeypatch.setattr(image_utils, "UPLOAD_BASE", tmp_path)
        monkeypatch.setattr(main_mod, "UPLOAD_BASE", tmp_path)

        resp = client.post("/moods", json={"date": "2025-01-01", "level": 3}, headers=auth_header)
        mood_id = resp.json()["id"]

        img_bytes = _make_image_bytes()
        client.post(f"/moods/{mood_id}/image", files={"file": ("test.png", img_bytes, "image/png")}, headers=auth_header)
        return mood_id

    def test_get_image(self, client, auth_header, tmp_path, monkeypatch):
        mood_id = self._setup_mood_with_image(client, auth_header, tmp_path, monkeypatch)
        resp = client.get(f"/moods/{mood_id}/image", headers=auth_header)
        assert resp.status_code == 200

    def test_get_thumb(self, client, auth_header, tmp_path, monkeypatch):
        mood_id = self._setup_mood_with_image(client, auth_header, tmp_path, monkeypatch)
        resp = client.get(f"/moods/{mood_id}/image/thumb", headers=auth_header)
        assert resp.status_code == 200

    def test_get_image_not_found(self, client, auth_header):
        resp = client.get("/moods/9999/image", headers=auth_header)
        assert resp.status_code == 404

    def test_get_thumb_not_found(self, client, auth_header):
        resp = client.get("/moods/9999/image/thumb", headers=auth_header)
        assert resp.status_code == 404

    def test_get_image_no_image_on_mood(self, client, auth_header):
        resp = client.post("/moods", json={"date": "2025-01-01", "level": 3}, headers=auth_header)
        mood_id = resp.json()["id"]
        resp = client.get(f"/moods/{mood_id}/image", headers=auth_header)
        assert resp.status_code == 404

    def test_get_thumb_no_image_on_mood(self, client, auth_header):
        resp = client.post("/moods", json={"date": "2025-01-01", "level": 3}, headers=auth_header)
        mood_id = resp.json()["id"]
        resp = client.get(f"/moods/{mood_id}/image/thumb", headers=auth_header)
        assert resp.status_code == 404


class TestMoodImageDelete:
    def test_delete_image(self, client, auth_header, tmp_path, monkeypatch):
        import image_utils
        monkeypatch.setattr(image_utils, "UPLOAD_BASE", tmp_path)

        resp = client.post("/moods", json={"date": "2025-01-01", "level": 3}, headers=auth_header)
        mood_id = resp.json()["id"]

        img_bytes = _make_image_bytes()
        client.post(f"/moods/{mood_id}/image", files={"file": ("test.png", img_bytes, "image/png")}, headers=auth_header)

        resp = client.delete(f"/moods/{mood_id}/image", headers=auth_header)
        assert resp.status_code == 204

    def test_delete_image_not_found(self, client, auth_header):
        resp = client.delete("/moods/9999/image", headers=auth_header)
        assert resp.status_code == 404

    def test_delete_image_no_image_on_mood(self, client, auth_header):
        resp = client.post("/moods", json={"date": "2025-01-01", "level": 3}, headers=auth_header)
        mood_id = resp.json()["id"]
        resp = client.delete(f"/moods/{mood_id}/image", headers=auth_header)
        assert resp.status_code == 404


class TestMoodImageRotate:
    def test_rotate_image(self, client, auth_header, tmp_path, monkeypatch):
        import image_utils
        monkeypatch.setattr(image_utils, "UPLOAD_BASE", tmp_path)

        resp = client.post("/moods", json={"date": "2025-01-01", "level": 3}, headers=auth_header)
        mood_id = resp.json()["id"]

        img_bytes = _make_image_bytes()
        client.post(f"/moods/{mood_id}/image", files={"file": ("test.png", img_bytes, "image/png")}, headers=auth_header)

        resp = client.post(f"/moods/{mood_id}/image/rotate", headers=auth_header)
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_rotate_image_not_found(self, client, auth_header):
        resp = client.post("/moods/9999/image/rotate", headers=auth_header)
        assert resp.status_code == 404


class TestMoodImageDownload:
    def test_download_images(self, client, auth_header, tmp_path, monkeypatch):
        import image_utils
        import main as main_mod
        monkeypatch.setattr(image_utils, "UPLOAD_BASE", tmp_path)
        monkeypatch.setattr(main_mod, "UPLOAD_BASE", tmp_path)

        resp = client.post("/moods", json={"date": "2025-01-01", "level": 3}, headers=auth_header)
        mood_id = resp.json()["id"]

        img_bytes = _make_image_bytes()
        client.post(f"/moods/{mood_id}/image", files={"file": ("test.png", img_bytes, "image/png")}, headers=auth_header)

        resp = client.post("/moods/images/download", json={"mood_ids": [mood_id]}, headers=auth_header)
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/zip"

    def test_download_no_images_found(self, client, auth_header):
        resp = client.post("/moods/images/download", json={"mood_ids": [9999]}, headers=auth_header)
        assert resp.status_code == 404


class TestMoodUpdate:
    def test_update_nonexistent_mood(self, client, auth_header):
        resp = client.put("/moods/9999", json={"date": "2025-01-01", "level": 3}, headers=auth_header)
        assert resp.status_code == 404


class TestMoodDeleteWithImage:
    def test_delete_mood_with_image(self, client, auth_header, tmp_path, monkeypatch):
        import image_utils
        monkeypatch.setattr(image_utils, "UPLOAD_BASE", tmp_path)

        resp = client.post("/moods", json={"date": "2025-01-01", "level": 3}, headers=auth_header)
        mood_id = resp.json()["id"]

        img_bytes = _make_image_bytes()
        client.post(f"/moods/{mood_id}/image", files={"file": ("test.png", img_bytes, "image/png")}, headers=auth_header)

        resp = client.delete(f"/moods/{mood_id}", headers=auth_header)
        assert resp.status_code == 204

    def test_delete_nonexistent_mood(self, client, auth_header):
        resp = client.delete("/moods/9999", headers=auth_header)
        assert resp.status_code == 404


class TestMoodFilters:
    def test_get_moods_with_date_filter(self, client, auth_header):
        client.post("/moods", json={"date": "2025-01-01", "level": 3}, headers=auth_header)
        client.post("/moods", json={"date": "2025-01-05", "level": 4}, headers=auth_header)
        client.post("/moods", json={"date": "2025-01-10", "level": 5}, headers=auth_header)

        resp = client.get("/moods?from_date=2025-01-03&to_date=2025-01-07", headers=auth_header)
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["date"] == "2025-01-05"

    def test_get_moods_with_from_date_only(self, client, auth_header):
        client.post("/moods", json={"date": "2025-01-01", "level": 3}, headers=auth_header)
        client.post("/moods", json={"date": "2025-01-10", "level": 4}, headers=auth_header)

        resp = client.get("/moods?from_date=2025-01-05", headers=auth_header)
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_get_moods_with_to_date_only(self, client, auth_header):
        client.post("/moods", json={"date": "2025-01-01", "level": 3}, headers=auth_header)
        client.post("/moods", json={"date": "2025-01-10", "level": 4}, headers=auth_header)

        resp = client.get("/moods?to_date=2025-01-05", headers=auth_header)
        assert resp.status_code == 200
        assert len(resp.json()) == 1


class TestMoodsWithLocation:
    def test_get_moods_with_location(self, client, auth_header):
        # Create a place with location
        place_resp = client.post("/places", json={"name": "Park", "latitude": 35.6, "longitude": 139.7}, headers=auth_header)
        place_id = place_resp.json()["id"]

        # Create mood with that place
        client.post("/moods", json={"date": "2025-01-01", "level": 4, "place_id": place_id}, headers=auth_header)

        resp = client.get("/moods/with-location", headers=auth_header)
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["latitude"] == 35.6

    def test_get_moods_with_location_empty(self, client, auth_header):
        resp = client.get("/moods/with-location", headers=auth_header)
        assert resp.status_code == 200
        assert len(resp.json()) == 0


class TestHeatmap:
    def test_record_heatmap(self, client, auth_header):
        events = [
            {"x_pct": 50.0, "y_pct": 30.0, "page": "/home", "event_type": "click"},
            {"x_pct": 70.0, "y_pct": 80.0, "page": "/home", "event_type": "click"},
        ]
        resp = client.post("/heatmap", json=events, headers=auth_header)
        assert resp.status_code == 201
        assert resp.json()["saved"] == 2

    def test_get_heatmap(self, client, auth_header):
        events = [
            {"x_pct": 50.0, "y_pct": 30.0, "page": "/home", "event_type": "click"},
            {"x_pct": 70.0, "y_pct": 80.0, "page": "/settings", "event_type": "click"},
        ]
        client.post("/heatmap", json=events, headers=auth_header)

        resp = client.get("/heatmap", headers=auth_header)
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_get_heatmap_with_page_filter(self, client, auth_header):
        events = [
            {"x_pct": 50.0, "y_pct": 30.0, "page": "/home", "event_type": "click"},
            {"x_pct": 70.0, "y_pct": 80.0, "page": "/settings", "event_type": "click"},
        ]
        client.post("/heatmap", json=events, headers=auth_header)

        resp = client.get("/heatmap?page=/home", headers=auth_header)
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["page"] == "/home"
