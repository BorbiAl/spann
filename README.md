# spann

A team communication platform that works everywhere and understands everyone, combining real-time chat with AI-powered language translation, cultural adaptation, and communication coaching — so global teams collaborate without barriers. When infrastructure fails, our peer-to-peer mesh network keeps teams connected offline via Bluetooth and Wi-Fi.

## Run the project

### 1) Install dependencies

```bash
npm install
```

### 2) Start FastAPI backend from backend/ (terminal 1)

If you use a virtual environment, activate it first.

```bash
# Windows PowerShell example
./.venv/Scripts/Activate.ps1
```

Then run:

```bash
npm run backend
```

The backend runs on `http://localhost:8000`.

### 3) Start frontend dev server (terminal 2)

```bash
npm run dev
```

Open the Vite URL shown in your terminal (usually `http://localhost:5173`).

The frontend API base is configured through environment variables and defaults to a relative `/api` path.
In dev mode, Vite proxies `/api/*` to `VITE_API_PROXY_TARGET` (default: `http://localhost:8000`).

## Database migrations (Alembic)

If backend logs show PostgREST schema-cache errors like `PGRST205` (missing `public.channels` or `public.messages`), run migrations:

```bash
# local Python environment
cd backend
alembic upgrade head
```

Or with Docker Compose:

```bash
docker compose exec backend alembic upgrade head
```

Notes:

- Alembic reads DB URL in this order: `SUPABASE_TRANSACTION_POOLER_URL`, `SUPABASE_DB_URL`, then `DATABASE_URL`.
- For transaction pooler, use the Supabase pooler connection string (typically port `6543`) and URL-encode password special characters.
- The initial revision applies `backend/migration.sql` automatically.
- If using Docker, rebuild backend images after dependency updates:

```bash
docker compose build backend backend-worker backend-beat
docker compose up -d
```

## API quick check

```bash
curl http://localhost:8000/health
```

Expected response includes:

```json
{"data":{"status":"ok"},"error":null,"status":200}
```

## Production hardening defaults

Backend configuration now enforces safer production defaults:

- `AUTH_FALLBACK_ENABLED=false` by default
- `TEST_MODE=false` by default
- startup fails in production when Supabase healthcheck fails
- startup validation fails in production if:
  - `ALLOWED_ORIGINS` contains `*`
  - `JWT_SECRET` is shorter than 32 chars
  - Supabase URL/key are missing

Set `ENV=production` only when all production secrets and dependencies are configured.

## Desktop app (Electron)

Run as a desktop app in development:

```bash
npm run desktop:dev
```

Build desktop installers:

```bash
npm run desktop:build
```

Build artifacts are written to `release/` (NSIS on Windows, DMG on macOS, AppImage on Linux).

## Mobile app (Capacitor)

One-time platform setup:

```bash
npm run mobile:add:android
npm run mobile:add:ios
```

Sync latest web build into native projects:

```bash
npm run mobile:sync
```

Open native IDE projects:

```bash
npm run mobile:android
npm run mobile:ios
```

## Native API base configuration

Native builds do not use the Vite `/api` proxy. Configure an absolute backend URL for release builds:

- preferred: set `VITE_API_BASE_URL=https://api.your-domain.com` before `npm run build`
- desktop runtime override: set `SPANN_API_BASE` when launching the Electron app

Default native fallbacks for local development:

- desktop and iOS simulator: `http://127.0.0.1:8000`
- Android emulator: `http://10.0.2.2:8000`
