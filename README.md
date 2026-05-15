# きぶんログ

毎朝1分で気分を3段階（良い / 普通 / しんどい）で記録し、傾向を可視化するWebアプリ。

## 目的

- 日々の体調傾向を把握する
- 2日以上連続で「普通以下」が続いたら黄色信号として表示する
- 将来的に「来週やばいかどうか」を判断できるようにする

## 技術スタック

- Frontend: Nuxt 3
- Backend: Python (FastAPI)
- DB: MySQL 8.4
- インフラ: Docker Compose / Tailscale経由でアクセス

## アーキテクチャ判断

### なぜDocker Composeか

devboxはPython/Node.jsなどの開発ツール管理に使い、実行環境はDocker Composeにまとめる方針。

理由:
- `docker compose up` 一発で MySQL + Backend + Frontend が起動する
- 別のPCでもすぐ再現できる
- Tailscaleで他端末からアクセスするときにポート管理がシンプル
- 長期運用で安定する

### なぜdevboxも残すか

ローカル開発時にPython/Node.jsのバージョンを固定するために使う。
実行はDocker Compose、開発はdevbox shell内で行う。

## 画面構成

1. **記録画面 (/)** - 3段階をタップするだけ。朝1回の記録用
2. **グラフ画面 (/graph)** - 直近30日の気分推移を折れ線グラフで表示

## 起動方法

```bash
docker compose up -d
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
