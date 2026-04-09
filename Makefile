.PHONY: test-up test-down test test-cov test-fast test-auth test-security migrate migrate-docker

test-up:
	docker compose -f docker-compose.test.yml up -d

test-down:
	docker compose -f docker-compose.test.yml down -v

test:
	cd backend && pytest -v --tb=short

test-cov:
	cd backend && pytest --cov=app --cov-report=term-missing --cov-report=html --cov-fail-under=85

test-fast:
	cd backend && pytest -m "not slow" -x

test-auth:
	cd backend && pytest tests/test_auth.py -v

test-security:
	cd backend && pytest tests/test_security.py tests/test_mesh.py -v

migrate:
	cd backend && alembic upgrade head

migrate-docker:
	docker compose exec backend alembic upgrade head
