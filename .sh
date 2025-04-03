# 全ユーザーの毎時レポートを手動実行
curl -X POST http://localhost:4600/api/trigger-hourly-reports \
  -H "Authorization: Bearer your-secure-api-key"

# 特定ユーザーの毎時レポートをテスト
curl -X POST http://localhost:4600/api/test-hourly-report \
  -H "Authorization: Bearer your-secure-api-key" \
  -H "Content-Type: application/json" \
  -d '{"userId": "65327d40-517f-4ab8-8723-e2e3d697be17"}'

curl -X GET http://localhost:4600/health