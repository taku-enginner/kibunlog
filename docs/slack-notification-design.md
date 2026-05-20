# Slack通知機能 設計書

## 概要

kibunroguアプリへの気分記録をSlackから行えるようにする。  
通知(bot→ユーザー)と記録(ユーザー→bot→API)の双方向対応。

## 通知仕様

| 項目 | 内容 |
|---|---|
| タイミング | 毎日 6:00〜21:00、3時間おき(6回) |
| 条件 | 直近3時間以内に記録があればスキップ |
| 送信先 | 専用Slackチャンネル |

スケジュール: 6:00 / 9:00 / 12:00 / 15:00 / 18:00 / 21:00

## 記録フロー

```
[通知への返信 または チャンネルへの任意メッセージ]
  ↓
Bot: 「気分を記録しよう。レベルは?(1〜5)」
  ↓ ユーザー返信(数字)
Bot: 「メモは?(スキップ→「なし」)」
  ↓ ユーザー返信
Bot: 「場所は?」[登録済み場所ボタン] [スキップ]
  ↓ ユーザー選択
Bot: 「記録完了 ✓ レベルX / メモ / 場所」
```

- ステップ式(1つずつ入力)
- タイムアウト: 30分で自動破棄
- 自発的記録: チャンネルへの任意メッセージで開始可能(通知なしでも記録可)

## 技術設計

### 実装場所
`claude-slack-bot` に追加(既存のSlack Bot Token / Socket Modeを流用)

### スケジューラ
APScheduler(既存の `bot.py` に追加)

### kibunrogu API認証
- `tokens.env` に `KIBUNROGU_USERNAME` / `KIBUNROGU_PASSWORD` を追加
- 起動時にJWT取得、401返却時に自動再ログイン

### セッション管理
- 記録フローの進行状態をメモリ上で管理(既存 `sessions.json` とは別)
- タイムアウト30分でクリア

## 設定項目(tokens.env追加分)

```
KIBUNROGU_API_URL=https://...
KIBUNROGU_USERNAME=...
KIBUNROGU_PASSWORD=...
KIBUNROGU_SLACK_CHANNEL=#kibunrogu
```
