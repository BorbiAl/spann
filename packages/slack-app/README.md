# Spann — Slack App

The Slack integration for Spann, an AI-powered accessibility plugin that makes Slack channels fully usable for people with visual, auditory, motor, cognitive, dyslexic, and anxiety/autism-spectrum disabilities.

---

## What it does

| Feature | Trigger | What happens |
|---|---|---|
| **App Home Settings** | User opens App Home tab | Block Kit UI to configure disability types, reading level, font size, captions, tone alerts |
| **Message Simplification** | Any message posted | Ephemeral simplified version for users with COGNITIVE / DYSLEXIA profiles |
| **Tone Badge** | Any message posted | Ephemeral tone classification (URGENT / AGGRESSIVE / etc.) for ANXIETY profiles |
| **Alt Text Audit** | Message with images | Warns VISUAL profile users when images are missing alt text |
| **`/spann-setup`** | Slash command | Opens full accessibility profile modal |
| **`/spann-simplify [text]`** | Slash command | Returns AI-simplified version of any text |
| **`/spann-summary`** | Slash command | Summarises the last 20 channel messages |
| **Make Accessible** | Message shortcut | Modal with simplified text, tone, reading level, and 3 reply suggestions |
| **OAuth Install** | "Add to Slack" button | Full OAuth 2.0 flow, workspace registered in Spann backend |

---

## Architecture

```
packages/slack-app/src/
├── api/
│   ├── client.ts        FastAPI HTTP client (all AI calls go through the backend)
│   └── types.ts         Mirrors of the backend Pydantic models
├── cache/
│   └── profileCache.ts  TTL Map (5 min) — avoids backend round-trip on every message
├── handlers/
│   ├── appHome.ts       app_home_opened event
│   ├── messages.ts      message event (simplify / tone / alt-text audit)
│   ├── commands.ts      /spann-setup, /spann-simplify, /spann-summary
│   ├── shortcuts.ts     "Make Accessible" message shortcut
│   └── actions.ts       Block Kit action handlers + modal submit
├── views/
│   ├── homeView.ts      App Home Block Kit builder
│   ├── setupModal.ts    /spann-setup modal builder
│   └── accessibleModal.ts  "Make Accessible" results modal
├── oauth/
│   └── installationStore.ts  Supabase-backed OAuth token store
└── index.ts             Entry point, dual Socket/HTTP mode
```

All AI processing is delegated to the FastAPI backend (`SPANN_API_URL`). The Slack app never calls Groq directly.

---

## Prerequisites

- **Node.js** ≥ 20
- **Spann FastAPI backend** running (see `backend/api/`)
- **Supabase project** with the schema from `backend/api/schema.sql` applied
- A **Slack App** created at [api.slack.com/apps](https://api.slack.com/apps)

---

## 1 — Create the Slack App

### 1.1 Create from App Manifest

Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From an app manifest**.

Paste the manifest below (update `YOUR_DOMAIN` for production):

```yaml
display_information:
  name: Spann Accessibility
  description: AI-powered accessibility for your workspace
  background_color: "#0f172a"

features:
  app_home:
    home_tab_enabled: true
    messages_tab_enabled: false
  bot_user:
    display_name: Spann
    always_online: true
  slash_commands:
    - command: /spann-setup
      description: Configure your accessibility profile
      usage_hint: ""
      should_escape: false
    - command: /spann-simplify
      description: Simplify any text with AI
      usage_hint: "[message text]"
      should_escape: false
    - command: /spann-summary
      description: Summarise the last 20 messages in this channel
      usage_hint: ""
      should_escape: false
  shortcuts:
    - name: Make Accessible
      type: message
      callback_id: make_accessible
      description: Analyse and simplify a message for accessibility

oauth_config:
  redirect_urls:
    - https://YOUR_DOMAIN/slack/oauth_redirect   # HTTP mode only
  scopes:
    bot:
      - app_mentions:read
      - channels:history
      - channels:join
      - channels:read
      - chat:write
      - chat:write.public
      - commands
      - files:read
      - groups:history
      - im:history
      - im:write
      - mpim:history
      - team:read
      - users:read
      - users:read.email

settings:
  event_subscriptions:
    request_url: https://YOUR_DOMAIN/slack/events   # HTTP mode only
    bot_events:
      - app_home_opened
      - message.channels
      - message.groups
      - message.im
      - message.mpim
  interactivity:
    is_enabled: true
    request_url: https://YOUR_DOMAIN/slack/events    # HTTP mode only
  socket_mode_enabled: true   # set to false for production HTTP mode
  token_rotation_enabled: false
```

### 1.2 Collect credentials

From the Slack App settings page, note:

| Variable | Where to find it |
|---|---|
| `SLACK_BOT_TOKEN` | OAuth & Permissions → Bot User OAuth Token (`xoxb-…`) |
| `SLACK_SIGNING_SECRET` | Basic Information → App Credentials → Signing Secret |
| `SLACK_APP_TOKEN` | Basic Information → App-Level Tokens → Generate token with `connections:write` scope (`xapp-…`) |
| `SLACK_CLIENT_ID` | Basic Information → App Credentials → Client ID |
| `SLACK_CLIENT_SECRET` | Basic Information → App Credentials → Client Secret |
| `SLACK_APP_ID` | Basic Information → App ID |

---

## 2 — Add the Supabase `slack_installations` table

Run this SQL in your Supabase project (SQL Editor or `psql`):

```sql
CREATE TABLE IF NOT EXISTS slack_installations (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id        TEXT        NOT NULL,
  enterprise_id  TEXT,
  workspace_id   UUID        REFERENCES workspaces(id),
  bot_token      TEXT        NOT NULL,
  bot_user_id    TEXT,
  bot_scopes     TEXT[]      DEFAULT '{}',
  user_token     TEXT,
  installed_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_slack_installations_team
    UNIQUE (team_id, COALESCE(enterprise_id, ''))
);

-- Service role only — platform bots use service key
ALTER TABLE slack_installations ENABLE ROW LEVEL SECURITY;
```

---

## 3 — Configure environment

Copy `.env.example` from the repo root and fill in the Slack section:

```env
# ── Slack ───────────────────────────────────────────────────────────────────
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token        # Socket Mode only
SLACK_CLIENT_ID=your-client-id             # HTTP Mode OAuth
SLACK_CLIENT_SECRET=your-client-secret     # HTTP Mode OAuth
SLACK_STATE_SECRET=generate-a-random-string
SLACK_APP_ID=your-app-id
SLACK_SOCKET_MODE=true                     # true = dev, false = production
SLACK_PORT=3001

# ── Backend ─────────────────────────────────────────────────────────────────
SPANN_API_URL=http://localhost:8001        # FastAPI backend URL

# ── Supabase (OAuth installation store) ─────────────────────────────────────
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

---

## 4 — Run

### Development (Socket Mode)

```bash
# From repo root
npm install

# Start the Spann FastAPI backend first
cd backend && uvicorn api.main:app --port 8001 --reload

# Start the Slack app (in another terminal)
cd packages/slack-app
npm run dev
```

No public URL needed — Socket Mode tunnels through Slack's servers.

### Production (HTTP Mode)

```bash
# Set SLACK_SOCKET_MODE=false in your environment
# Ensure SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_STATE_SECRET are set

npm run build
npm start
```

Bolt automatically handles:
- `GET  /slack/install` — "Add to Slack" landing page
- `GET  /slack/oauth_redirect` — OAuth callback
- `POST /slack/events` — all events and interactions

Point your Slack App's **Request URL** and **Redirect URL** to your production domain.

---

## 5 — Install to a workspace

### Development
With Socket Mode enabled, click **Install to Workspace** in the Slack App settings page. The bot token is stored in `SLACK_BOT_TOKEN`.

### Production
Visit `https://YOUR_DOMAIN/slack/install` to trigger the full OAuth 2.0 flow. After successful install, the bot token is stored in Supabase `slack_installations` and the workspace is registered in Spann via `POST /api/workspaces/register`.

---

## 6 — User setup

After installation, users:

1. Open the **Spann** app in Slack sidebar
2. Switch to the **Home** tab
3. Select their accessibility needs (checkboxes)
4. Adjust reading level, font size, and feature toggles
5. Click **Save Settings**

Or run `/spann-setup` from any channel.

---

## Slack Required Scopes

| Scope | Purpose |
|---|---|
| `channels:history` / `groups:history` / `im:history` | Read messages for processing |
| `channels:join` | Join public channels on install |
| `chat:write` / `chat:write.public` | Post ephemeral messages |
| `commands` | Register slash commands |
| `files:read` | Read file metadata for alt-text audit |
| `team:read` | Resolve workspace name |
| `users:read` / `users:read.email` | Fetch display names for profiles |

---

## Event / Interaction Flow

```
User posts message
  → message event
    → fetch profile from cache (5 min TTL)
    → if COGNITIVE/DYSLEXIA: POST /api/messages/process → ephemeral simplified
    → if ANXIETY:            POST /api/messages/process → ephemeral tone badge
    → if VISUAL + files:     check alt text → ephemeral warning if missing

User opens App Home
  → app_home_opened event
    → GET /api/users/{id}/profile
    → views.publish(homeView)

User clicks Save Settings
  → block_actions (action_save_settings_home)
    → POST /api/users/{id}/profile
    → views.publish(updated homeView)

User runs /spann-setup
  → command → views.open(setupModal)
  → User submits → view_submission
    → POST /api/users/{id}/profile

User runs /spann-simplify [text]
  → POST /api/messages/process → ephemeral result

User runs /spann-summary
  → conversations.history (20 messages)
  → POST /api/messages/summarize-thread → ephemeral summary

User right-clicks message → Make Accessible
  → shortcut (make_accessible)
    → views.open(loadingModal)         ← acked within 3 s
    → POST /api/messages/process        ← concurrent
    → views.update(accessibleModal)
```

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Missing required environment variable` on startup | Check `.env` has all required keys |
| Slack shows "This app didn't respond in time" | SPANN_API_URL unreachable or slow; check backend health at `/health` |
| Home tab shows error banner | Backend unreachable or user has no profile yet (click Save Settings) |
| OAuth redirect fails | Check `SLACK_STATE_SECRET` is set and redirect URL matches app settings |
| `slack_installations` upsert error | Ensure the table was created (step 2 above) |
| Profile changes not reflected | Profile cache TTL is 5 min; wait or restart the app |
