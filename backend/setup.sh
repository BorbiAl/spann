#!/bin/bash
set -euo pipefail

echo "=== SPANN BACKEND SETUP ==="

if [ ! -f .env ]; then
    echo "ERROR: .env not found. Copy .env.example and fill in values."
    exit 1
fi

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -q
pip install -r requirements-test.txt -q
echo "✓ Python environment ready"

docker compose -f docker-compose.test.yml up -d
echo "Waiting for services..."
sleep 8

docker compose -f docker-compose.test.yml ps
echo "✓ Test infrastructure running"

set -a
source .env
set +a

psql "$TEST_DATABASE_URL" -f schema.sql -q
echo "✓ Schema applied"

TABLE_COUNT=$(psql "$TEST_DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'" | tr -d ' ')
echo "✓ $TABLE_COUNT tables created"

echo "--- Ruff ---"
ruff check app/ --fix

echo "--- Mypy ---"
mypy app/ --ignore-missing-imports --strict

echo "--- Bandit ---"
bandit -r app/ -ll -q

echo "--- Secrets scan ---"
if grep -rn "api_key\s*=\s*['\"][a-zA-Z0-9]" app/ --include="*.py"; then
    echo "ERROR: potential hardcoded API key found"
    exit 1
fi

echo "✓ Static analysis clean"

echo "--- Tests ---"
pytest tests/ -v --cov=app --cov-report=term-missing --cov-report=json -x --tb=short 2>&1 | tee test_output.log
echo "✓ Tests complete"

COVERAGE=$(python3 - <<'PY'
import json
try:
    with open('coverage.json', encoding='utf-8') as f:
        data = json.load(f)
    print(int(data.get('totals', {}).get('percent_covered', 0)))
except Exception:
    print(0)
PY
)

echo "Coverage: $COVERAGE%"

uvicorn app.main:app --host 0.0.0.0 --port 8001 &
APP_PID=$!
sleep 3

HEALTH=$(curl -s http://localhost:8001/health)
echo "Health: $HEALTH"

METRICS_OK=$(curl -s http://localhost:8001/metrics | grep -c "http_requests_total" || true)
echo "Metrics series found: $METRICS_OK"

kill "$APP_PID" 2>/dev/null || true
docker compose -f docker-compose.test.yml down -v

echo ""
echo "=== SETUP COMPLETE ==="
