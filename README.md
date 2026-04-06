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

## API quick check

```bash
curl http://localhost:8000/health
```

Expected response includes:

```json
{"data":{"status":"ok"},"error":null,"status":200}
```
