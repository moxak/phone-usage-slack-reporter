curl -X POST http://localhost:4600/api/report \
     -H "x-api-key: your-secure-api-key" \
     -H "Content-Type: application/json" \
     -d '{"userId": "65327d40-517f-4ab8-8723-e2e3d697be17"}'

curl -X GET http://localhost:3000/health