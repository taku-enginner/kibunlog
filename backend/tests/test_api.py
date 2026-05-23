"""Basic API tests for kibunrogu backend."""


class TestAuth:
    def test_register_success(self, client):
        resp = client.post("/auth/register", json={"username": "newuser", "password": "pass123"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "newuser"
        assert "token" in data

    def test_register_duplicate_username(self, client):
        client.post("/auth/register", json={"username": "dup", "password": "pass123"})
        resp = client.post("/auth/register", json={"username": "dup", "password": "pass456"})
        assert resp.status_code == 400
        assert "already exists" in resp.json()["detail"]

    def test_login_success(self, client):
        client.post("/auth/register", json={"username": "loginuser", "password": "pass123"})
        resp = client.post("/auth/login", json={"username": "loginuser", "password": "pass123"})
        assert resp.status_code == 200
        assert "token" in resp.json()

    def test_login_wrong_password(self, client):
        client.post("/auth/register", json={"username": "loginuser2", "password": "pass123"})
        resp = client.post("/auth/login", json={"username": "loginuser2", "password": "wrong"})
        assert resp.status_code == 401


class TestMoods:
    def test_create_mood(self, client, auth_header):
        resp = client.post(
            "/moods",
            json={"date": "2025-01-01", "level": 3, "memo": "good day"},
            headers=auth_header,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["level"] == 3
        assert data["memo"] == "good day"
        assert data["date"] == "2025-01-01"

    def test_get_moods(self, client, auth_header):
        client.post("/moods", json={"date": "2025-01-01", "level": 4}, headers=auth_header)
        client.post("/moods", json={"date": "2025-01-02", "level": 2}, headers=auth_header)
        resp = client.get("/moods", headers=auth_header)
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_update_mood(self, client, auth_header):
        resp = client.post("/moods", json={"date": "2025-01-01", "level": 3}, headers=auth_header)
        mood_id = resp.json()["id"]
        resp = client.put(
            f"/moods/{mood_id}",
            json={"date": "2025-01-01", "level": 5, "memo": "updated"},
            headers=auth_header,
        )
        assert resp.status_code == 200
        assert resp.json()["level"] == 5
        assert resp.json()["memo"] == "updated"

    def test_delete_mood(self, client, auth_header):
        resp = client.post("/moods", json={"date": "2025-01-01", "level": 3}, headers=auth_header)
        mood_id = resp.json()["id"]
        resp = client.delete(f"/moods/{mood_id}", headers=auth_header)
        assert resp.status_code == 204
        resp = client.get("/moods", headers=auth_header)
        assert len(resp.json()) == 0

    def test_create_mood_with_place_tag(self, client, auth_header):
        resp = client.post(
            "/moods",
            json={"date": "2025-01-01", "level": 8, "place_tag": "会社"},
            headers=auth_header,
        )
        assert resp.status_code == 200
        assert resp.json()["place_tag"] == "会社"

    def test_unauthorized_access(self, client):
        resp = client.get("/moods")
        assert resp.status_code == 401


class TestPlaces:
    def test_create_and_get_places(self, client, auth_header):
        resp = client.post(
            "/places",
            json={"name": "Office", "latitude": 35.6, "longitude": 139.7},
            headers=auth_header,
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Office"

        resp = client.get("/places", headers=auth_header)
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_delete_place(self, client, auth_header):
        resp = client.post("/places", json={"name": "Cafe"}, headers=auth_header)
        place_id = resp.json()["id"]
        resp = client.delete(f"/places/{place_id}", headers=auth_header)
        assert resp.status_code == 204
