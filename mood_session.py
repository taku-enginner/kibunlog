import threading
from dataclasses import dataclass, field
from typing import Callable

TIMEOUT_SECONDS = 30 * 60  # 30分


@dataclass
class MoodSession:
    step: str = "waiting_level"  # waiting_level | waiting_memo | waiting_place
    level: int | None = None
    memo: str | None = None
    timer: threading.Timer | None = field(default=None, repr=False)


class MoodSessionManager:
    def __init__(self, on_timeout: Callable[[str], None]):
        self._sessions: dict[str, MoodSession] = {}
        self._lock = threading.Lock()
        self._on_timeout = on_timeout

    def start(self, channel_id: str) -> MoodSession:
        with self._lock:
            self._cancel_timer(channel_id)
            session = MoodSession()
            session.timer = threading.Timer(
                TIMEOUT_SECONDS, self._handle_timeout, args=[channel_id]
            )
            session.timer.daemon = True
            session.timer.start()
            self._sessions[channel_id] = session
        return session

    def get(self, channel_id: str) -> MoodSession | None:
        with self._lock:
            return self._sessions.get(channel_id)

    def clear(self, channel_id: str) -> None:
        with self._lock:
            self._cancel_timer(channel_id)
            self._sessions.pop(channel_id, None)

    def _cancel_timer(self, channel_id: str) -> None:
        session = self._sessions.get(channel_id)
        if session and session.timer:
            session.timer.cancel()

    def _handle_timeout(self, channel_id: str) -> None:
        with self._lock:
            self._sessions.pop(channel_id, None)
        self._on_timeout(channel_id)
