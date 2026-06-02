"""POST /auth/demo + デモアカウント関連のガードのテスト。"""

import io

from PIL import Image


def _make_image_bytes(width=10, height=10):
    img = Image.new("RGB", (width, height), (255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class TestCreateDemoAccount:
    def test_create_demo_returns_token_and_seeds(self, client):
        resp = client.post("/auth/demo")
        assert resp.status_code == 200
        body = resp.json()
        assert body["token"]
        assert body["username"].startswith("demo-")
        assert body["username"].endswith("@example.com")

        # JWT が通る + サンプルデータが投入されている
        headers = {"Authorization": f"Bearer {body['token']}"}
        places = client.get("/places", headers=headers).json()
        assert len(places) == 5  # DEMO_PLACES と同数

        moods = client.get("/moods", headers=headers).json()
        # 14日分 × 2-3件 = 28-42 件くらい
        assert 14 <= len(moods) <= 50

    def test_each_demo_call_creates_distinct_user(self, client):
        a = client.post("/auth/demo").json()
        b = client.post("/auth/demo").json()
        assert a["username"] != b["username"]


class TestDemoCannotUpload:
    def test_demo_image_upload_forbidden(self, client):
        demo = client.post("/auth/demo").json()
        headers = {"Authorization": f"Bearer {demo['token']}"}

        # デモアカウントの mood を 1 件取って画像アップを試みる
        moods = client.get("/moods", headers=headers).json()
        mood_id = moods[0]["id"]

        resp = client.post(
            f"/moods/{mood_id}/image",
            files={"file": ("test.png", _make_image_bytes(), "image/png")},
            headers=headers,
        )
        assert resp.status_code == 403
        assert "demo" in resp.json()["detail"].lower()
