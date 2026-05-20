import json
import os
import re
import subprocess
import threading
import uuid
from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler

app = App(token=os.environ["SLACK_BOT_TOKEN"])

SESSION_FILE = os.path.join(os.path.dirname(__file__), "sessions.json")
WORKDIR = os.environ.get("CLAUDE_WORKDIR", "/home/tak")


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
        # テーブル検出: | で始まる行が続く場合
        if line.strip().startswith("|"):
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_lines.append(lines[i])
                i += 1
            # セパレータ行（|---|）を除外
            rows = [l for l in table_lines if not re.match(r"^\s*\|[-| :]+\|\s*$", l)]
            # セルを抽出してコードブロックで整形
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
        # **bold** → *bold*
        line = re.sub(r"\*\*(.+?)\*\*", r"*\1*", line)
        # # 見出し → *見出し*
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


@app.event("message")
def handle_message(event, say):
    if event.get("bot_id"):
        return
    if event.get("subtype"):
        return
    handle(event, say)


if __name__ == "__main__":
    handler = SocketModeHandler(app, os.environ["SLACK_APP_TOKEN"])
    handler.start()
