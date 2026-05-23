# CLAUDE.md

## テストポリシー

コードを変更したら、対応するテストも必ず追加・更新する。

### バックエンド (pytest)

- テストファイル: `backend/tests/`
- 実行: `cd backend && DATABASE_URL=sqlite:// ../.venv/bin/pytest --cov=. --cov-report=term-missing`
- カバレッジ目標: 90%以上を維持
- 新しいAPIエンドポイントを追加したら `test_api.py` または専用ファイルにテスト追加
- image_utils.pyを変更したら `test_image_utils.py` を更新

### フロントエンド (Vitest)

- テストファイル: `frontend/tests/`
- 実行: `cd frontend && npx vitest run --coverage`
- カバレッジ対象: `composables/` (useAuth, useToast, useDate)
- composableを変更・追加したら対応するテストを追加・更新
- カバレッジ目標: Stmts 90%以上を維持

### E2Eテスト (Playwright)

- テストファイル: `scripts/e2e-test.mjs`
- 実行（Docker）: `docker-compose -f docker-compose.mac.yml run --rm e2e`
- 実行（ローカル）: `node scripts/e2e-test.mjs`
- UI構造やページ遷移を変更したらE2Eテストも更新

## 開発環境

- フロントエンド: Nuxt 3 (`frontend/`)
- バックエンド: FastAPI (`backend/`)
- DB: MySQL 8.4 (devboxでport 13306)
- venv: `.venv/`
- ビルド確認: `cd frontend && npx nuxi build`
