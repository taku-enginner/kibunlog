import json
import os
import re
import subprocess
import threading
import uuid

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler

from kibunrogu_client import KibunroguClient
from mood_session import MoodSessionManager

app = App(token=os.environ["SLACK_BOT_TOKEN"])

SESSION_FILE = os.path.join(os.path.dirname(__file__), "sessions.json")
WORKDIR = os.environ.get("CLAUDE_WORKDIR", "/home/tak")
KIBUNROGU_CHANNEL = os.environ.get("KIBUNROGU_CHANNEL", "")

kibunrogu = KibunroguClient()


def on_session_timeout(channel_id: str) -> None:
    try:
        app.client.chat_postMessage(
            channel=channel_id,
            text="⏱ タイムアウト。記録がキャンセルされました。",
        )
    except Exception:
        pass


mood_sessions = MoodSessionManager(on_timeout=on_session_timeout)


# --- Claude セッション管理 ---

def load_sessions():
    try:
        with open(SESSION_FILE) as f:
            return json.load(f)
    except Exception:
        return {}


def save_sessions(sessions):
    with open(SESSION_FILE, "w") as f:
        json.dump(sessions, f)


def convert_to_slack(text):
    lines = text.split("\n")
    result = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.strip().startswith("|"):
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_lines.append(lines[i])
                i += 1
            rows = [l for l in table_lines if not re.match(r"^\s*\|[-| :]+\|\s*$", l)]
            parsed = []
            for row in rows:
                cells = [c.strip() for c in row.strip().strip("|").split("|")]
                parsed.append(cells)
            if parsed:
                formatted = []
                for idx, row in enumerate(parsed):
                    if idx == 0:
                        formatted.append(" | ".join(f"*{c}*" for c in row))
                    else:
                        formatted.append("• " + " | ".join(row))
                result.append("\n".join(formatted))
            continue
        line = re.sub(r"\*\*(.+?)\*\*", r"*\1*", line)
        line = re.sub(r"^#{1,3}\s+(.+)", r"*\1*", line)
        result.append(line)
        i += 1
    return "\n".join(result)


def run_claude(user_id, prompt):
    sessions = load_sessions()

    cmd = [
        "claude", "-p", prompt,
        "--dangerously-skip-permissions",
        "--output-format", "json",
    ]

    if user_id in sessions:
        cmd += ["--resume", sessions[user_id]]
    else:
        new_id = str(uuid.uuid4())
        sessions[user_id] = new_id
        save_sessions(sessions)
        cmd += ["--session-id", new_id]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=180,
            cwd=WORKDIR,
        )
        raw = result.stdout or result.stderr or ""
        try:
            data = json.loads(raw)
            if "session_id" in data:
                sessions[user_id] = data["session_id"]
                save_sessions(sessions)
            output = data.get("result", raw)
        except json.JSONDecodeError:
            output = raw
    except subprocess.TimeoutExpired:
        subprocess.run(["/home/tak/.claude/notify-slack.sh", "timeout", f"タイムアウト（180秒）: {prompt[:50]}"])
        output = "タイムアウト（180秒）"
    except Exception as e:
        subprocess.run(["/home/tak/.claude/notify-slack.sh", "error", f"エラー: {str(e)[:80]}"])
        output = f"エラー: {e}"

    output = convert_to_slack(output.strip())
    if len(output) > 3000:
        output = output[:2900] + "\n\n…（省略）"
    return output


def handle(event, say):
    raw_text = event.get("text", "")
    prompt = re.sub(r"<@[^>]+>", "", raw_text).strip()
    channel_id = event.get("channel", "unknown")

    if not prompt:
        say("指示を入力してください。")
        return

    resp = say("実行中... (0秒)")
    msg_ts = resp.get("ts")
    msg_channel = resp.get("channel")

    result_holder = [None]
    done_event = threading.Event()

    def run():
        result_holder[0] = run_claude(channel_id, prompt)
        done_event.set()

    thread = threading.Thread(target=run, daemon=True)
    thread.start()

    elapsed = 0
    interval = 10
    while not done_event.wait(timeout=interval):
        elapsed += interval
        if msg_ts:
            app.client.chat_update(
                channel=msg_channel, ts=msg_ts,
                text=f"実行中... ({elapsed}秒)"
            )

    if msg_ts:
        app.client.chat_update(
            channel=msg_channel, ts=msg_ts,
            text=result_holder[0]
        )
    else:
        say(result_holder[0])


# --- 気分記録フロー ---

def build_level_blocks() -> list[dict]:
    buttons = [
        {
            "type": "button",
            "text": {"type": "plain_text", "text": str(i)},
            "action_id": f"mood_level_{i}",
            "value": str(i),
        }
        for i in range(1, 6)
    ]
    return [
        {"type": "section", "text": {"type": "mrkdwn", "text": "気分を記録しよう。レベルは？"}},
        {"type": "actions", "elements": buttons},
    ]


def build_memo_blocks() -> list[dict]:
    return [
        {"type": "section", "text": {"type": "mrkdwn", "text": "メモは？（テキストを入力 or スキップ）"}},
        {"type": "actions", "elements": [
            {"type": "button", "text": {"type": "plain_text", "text": "スキップ"}, "action_id": "mood_memo_skip", "value": "skip"},
        ]},
    ]


def build_place_blocks(places: list[dict]) -> list[dict]:
    buttons = []
    for place in places[:24]:
        buttons.append({
            "type": "button",
            "text": {"type": "plain_text", "text": place["name"]},
            "action_id": f"mood_place_{place['id']}",
            "value": str(place["id"]),
        })
    buttons.append({
        "type": "button",
        "text": {"type": "plain_text", "text": "スキップ"},
        "action_id": "mood_place_skip",
        "value": "skip",
    })
    return [
        {"type": "section", "text": {"type": "mrkdwn", "text": "場所は？"}},
        {"type": "actions", "elements": buttons},
    ]


def _finish_recording(channel_id, session, place_id, place_name, responder) -> None:
    try:
        kibunrogu.record_mood(session.level, session.memo, place_id)
        parts = [f"レベル {session.level}"]
        if session.memo:
            parts.append(session.memo)
        if place_name:
            parts.append(place_name)
        responder(f"✓ 記録完了 — {' / '.join(parts)}")
    except Exception as e:
        responder(f"❌ 記録に失敗しました: {e}")
    finally:
        mood_sessions.clear(channel_id)


def handle_mood_message(event, say) -> None:
    channel_id = event.get("channel", "")

    session = mood_sessions.get(channel_id)

    if session is None:
        mood_sessions.start(channel_id)
        say(blocks=build_level_blocks(), text="気分を記録しよう。レベルは？")
        return

    if session.step == "waiting_level":
        say(blocks=build_level_blocks(), text="気分を記録しよう。レベルは？")

    elif session.step == "waiting_memo":
        session.memo = text
        session.step = "waiting_place"
        try:
            places = kibunrogu.get_places()
        except Exception:
            places = []
        if places:
            say(blocks=build_place_blocks(places), text="場所は？")
        else:
            _finish_recording(channel_id, session, None, None, say)

    elif session.step == "waiting_place":
        say("場所をボタンで選択してください。")


@app.action(re.compile(r"mood_level_.*"))
def handle_level_action(ack, action, body, say) -> None:
    ack()
    channel_id = body["channel"]["id"]
    session = mood_sessions.get(channel_id)
    if not session or session.step != "waiting_level":
        return
    session.level = int(action["value"])
    session.step = "waiting_memo"
    say(blocks=build_memo_blocks(), text="メモは？")


@app.action("mood_memo_skip")
def handle_memo_skip_action(ack, body, say) -> None:
    ack()
    channel_id = body["channel"]["id"]
    session = mood_sessions.get(channel_id)
    if not session or session.step != "waiting_memo":
        return
    session.memo = None
    session.step = "waiting_place"
    try:
        places = kibunrogu.get_places()
    except Exception:
        places = []
    if places:
        say(blocks=build_place_blocks(places), text="場所は？")
    else:
        _finish_recording(channel_id, session, None, None, say)


@app.action(re.compile(r"mood_place_.*"))
def handle_place_action(ack, action, body, say) -> None:
    ack()
    channel_id = body["channel"]["id"]
    session = mood_sessions.get(channel_id)
    if not session or session.step != "waiting_place":
        return
    value = action["value"]
    place_id = None if value == "skip" else int(value)
    place_name = None if value == "skip" else action["text"]["text"]
    _finish_recording(channel_id, session, place_id, place_name, say)


# --- スケジュール通知 ---

def notify_if_needed() -> None:
    if not KIBUNROGU_CHANNEL:
        return
    try:
        if kibunrogu.has_recent_record(hours=3):
            return
        app.client.chat_postMessage(
            channel=KIBUNROGU_CHANNEL,
            blocks=build_level_blocks(),
            text="気分を記録しよう。レベルは？",
        )
        mood_sessions.start(KIBUNROGU_CHANNEL)
    except Exception as e:
        print(f"[notify] エラー: {e}")


# --- イベントハンドラ ---

@app.event("message")
def handle_message(event, say):
    if event.get("bot_id") or event.get("subtype"):
        return
    if event.get("channel") == KIBUNROGU_CHANNEL:
        handle_mood_message(event, say)
    else:
        handle(event, say)


if __name__ == "__main__":
    scheduler = BackgroundScheduler(timezone="Asia/Tokyo")
    for hour in [6, 9, 12, 15, 18, 21]:
        scheduler.add_job(notify_if_needed, CronTrigger(hour=hour, minute=0))
    scheduler.start()

    handler = SocketModeHandler(app, os.environ["SLACK_APP_TOKEN"])
    handler.start()
