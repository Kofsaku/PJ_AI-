# AI Voice Settings Improvement - OpenSpec Change Proposal

## Quick Links
- [Full Change Documentation](./change.md) - 完全な変更ドキュメント
- [Troubleshooting Guide](./troubleshooting.md) - トラブルシューティングガイド

## Summary
OpenAI Realtime APIのボイス設定最適化とプロンプトエンジニアリング改善を実施。

## Key Changes
1. ✅ AI設定保存の不具合修正（環境変数の優先順位、Mongoose markModified）
2. ✅ 会話トーン・スタイルを「フォーマル」に固定
3. ✅ AIボイスを8種類→3種類に厳選（alloy, cedar, coral）
4. ✅ OpenAI公式ベストプラクティスに基づくプロンプト改善

## Critical Fixes
### Issue 1: AI設定が保存されない
**原因**: フロントエンドAPIプロキシが本番URLに接続していた
**修正**: 環境変数の優先順位を変更（`NEXT_PUBLIC_BACKEND_URL`を優先）

### Issue 2: Mongooseでネストオブジェクトが更新されない
**原因**: Mongooseはネストオブジェクトの変更を自動検知しない
**修正**: `markModified('conversationSettings')`を追加

詳細は [troubleshooting.md](./troubleshooting.md) を参照。

## Files Changed
- `frontend/app/api/users/sales-pitch/route.ts`
- `frontend/app/settings/sales-pitch/page.tsx`
- `backend/models/AgentSettings.js`
- `backend/utils/promptBuilder.js`
- `backend/routes/userRoutes.js`

## Commits
```
8765b62 - debug: Add detailed logging for AI settings save/load
40b19d6 - fix: Use markModified for conversationSettings nested fields
bd6bc70 - fix: Include voice in PUT /api/users/sales-pitch response
2349ca0 - fix: Add backend support for AI settings
1c6f1e3 - feat: Add AI settings UI and speech rate control
d52a92c - feat: Update AI voice settings and improve prompt based on OpenAI docs
4d83870 - refine: Simplify tone description in promptBuilder
99a5a6d - feat: Simplify AI voice options to 3 voices
```

## Testing
```bash
# 1. 環境変数を確認
cat frontend/.env.local | grep BACKEND_URL

# 2. サーバーを起動
cd backend && npm start
cd frontend && npm run dev

# 3. 設定画面でAI設定を変更
# http://localhost:3000/settings/sales-pitch

# 4. データベースで確認
mongosh "mongodb+srv://..."
use ai-call
db.agentsettings.findOne({ userId: ObjectId("...") })
```

## Status
- **Status**: ✅ Completed
- **Date**: 2025-10-21
- **Tested**: Yes
- **Deployed**: Pending
