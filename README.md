# spann
A team communication platform that works everywhere and understands everyone, combining real-time chat with AI-powered language translation, cultural adaptation, and communication coaching — so global teams collaborate without barriers. When infrastructure fails, our peer-to-peer mesh network keeps teams connected offline via Bluetooth and Wi-Fi.

## Run the project

### 1) Install dependencies

```bash
npm install
```

### 2) Start backend API (terminal 1)

```bash
npm run backend
```

The backend runs on `http://localhost:3001`.

### 3) Start frontend dev server (terminal 2)

```bash
npm run dev
```

Open the Vite URL shown in your terminal (usually `http://localhost:5173`).

The frontend will automatically try to connect to `http://localhost:3001/api`.
If the backend is unavailable, chat interactions gracefully fall back to local state.

## API quick check

```bash
curl http://localhost:3001/api/health
```

Expected response includes:

```json
{"ok":true,"service":"spann-api"}
```

## Main API routes

- `GET /api/health`
- `GET /api/chat/state`
- `GET /api/chat/channels`
- `GET /api/chat/messages/:channel`
- `POST /api/chat/messages`
- `POST /api/chat/reactions`
- `POST /api/chat/unread/clear`
- `POST /api/chat/simulate`
- `POST /api/chat/reset`
- `POST /api/translator/adapt`
