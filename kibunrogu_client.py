import os
from datetime import datetime, timedelta

import httpx


class KibunroguClient:
    def __init__(self):
        self._base_url = os.environ["KIBUNROGU_API_URL"].rstrip("/")
        self._username = os.environ["KIBUNROGU_USERNAME"]
        self._password = os.environ["KIBUNROGU_PASSWORD"]
        self._token: str | None = None

    def _login(self) -> None:
        resp = httpx.post(
            f"{self._base_url}/auth/login",
            json={"username": self._username, "password": self._password},
            timeout=10,
        )
        resp.raise_for_status()
        self._token = resp.json()["token"]

    def _headers(self) -> dict:
        if not self._token:
            self._login()
        return {"Authorization": f"Bearer {self._token}"}

    def _request(self, method: str, path: str, **kwargs) -> httpx.Response:
        resp = httpx.request(
            method, f"{self._base_url}{path}", headers=self._headers(), timeout=10, **kwargs
        )
        if resp.status_code == 401:
            self._login()
            resp = httpx.request(
                method, f"{self._base_url}{path}", headers=self._headers(), timeout=10, **kwargs
            )
        resp.raise_for_status()
        return resp

    def has_recent_record(self, hours: int = 3) -> bool:
        now = datetime.now()
        since = now - timedelta(hours=hours)
        today = now.strftime("%Y-%m-%d")
        resp = self._request("GET", "/moods", params={"from_date": today, "to_date": today})
        since_time = since.strftime("%H:%M")
        return any(
            m.get("time", "") >= since_time
            for m in resp.json()
            if m.get("time")
        )

    def get_places(self) -> list[dict]:
        return self._request("GET", "/places").json()

    def record_mood(
        self, level: int, memo: str | None = None, place_id: int | None = None
    ) -> dict:
        now = datetime.now()
        payload: dict = {
            "date": now.strftime("%Y-%m-%d"),
            "time": now.strftime("%H:%M"),
            "level": level,
        }
        if memo:
            payload["memo"] = memo
        if place_id is not None:
            payload["place_id"] = place_id
        return self._request("POST", "/moods", json=payload).json()
