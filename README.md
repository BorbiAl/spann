# Spann

**Reach Anyone. Anywhere. Always.**

[![iOS](https://img.shields.io/badge/iOS-App%20Store-0D96F6?logo=apple&logoColor=white)](https://apps.apple.com/) [![Android](https://img.shields.io/badge/Android-Google%20Play-3DDC84?logo=googleplay&logoColor=white)](https://play.google.com/store) [![Windows](https://img.shields.io/badge/Windows-Microsoft%20Store-0078D6?logo=windows&logoColor=white)](https://apps.microsoft.com/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE) [![Built%20with%20React%20Native](https://img.shields.io/badge/Built%20with-React%20Native-61DAFB?logo=react&logoColor=white)](https://reactnative.dev/)

Spann is a cross-platform enterprise communication app that combines realtime messaging, AI translation/coaching, and offline mesh networking so distributed teams can collaborate through connectivity disruptions and language barriers.

## Screenshots / Demo

Add screenshots here.

Main screens to showcase:

- Chat
- Mesh
- Carbon
- Pulse
- Accessibility
- Translator
- Settings

## Features

### Communication

- Realtime team chat powered by Supabase Realtime channels.
- Presence indicators (online/away/typing) per workspace channel.
- Emoji reactions with per-user toggle behavior.
- Threaded replies for focused side-conversations.
- File attachments with private bucket access control.
- Read state synchronization and optimistic UI updates.

### Translation

- Auto-translate incoming messages by user locale preference.
- Cultural adaptation layer for tone and region-appropriate phrasing.
- Support for 10 culture pairs and localized idiom handling.
- Tone matching (formal, neutral, casual) across translated output.

### AI Coaching

- Async micro-coaching nudges after message send.
- Inline sentiment bar while composing messages.
- Team pulse scoring with near-live channel-level updates.

### Mesh Networking

- Bluetooth LE peer discovery + encrypted payload exchange.
- WebRTC DataChannel for high-throughput nearby peers.
- Offline message queue with automatic replay on reconnection.
- Auto-failover between internet transport and mesh transport.
- Epidemic routing with max 6-hop forwarding (TTL=6).

### Carbon Tracking

- Commute logging across 7 transport types.
- Team leaderboard with weekly and monthly ranking.
- Achievement badges for streaks and low-emission milestones.
- Workspace-wide emissions goal tracking and progress view.

### Accessibility

- Dyslexia-friendly font mode.
- Text-to-speech reading support.
- High contrast mode.
- Color blind safe palette presets.
- Scalable typography and touch target enhancements.
- Accessibility preferences persist to account and apply globally.

### Onboarding

- 6-step guided onboarding from profile to workspace setup.
- New workspace creation with slug validation.
- Invite code flow with deep-link support.

## Tech Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Mobile | React Native 0.84 + Expo SDK 55 + Expo Router | Cross-platform mobile app and file-based navigation |
| Windows | React Native for Windows 0.82 (WinUI 3) | Native Windows desktop client |
| State | Zustand | Lightweight local application state |
| Server State | TanStack Query v5 | Caching, sync, retries, and mutations |
| Backend | FastAPI (Python) | AI endpoints, orchestration, and secure service integration |
| Database | Supabase Postgres | Relational data and workspace domain model |
| Realtime | Supabase Realtime | Live message/presence updates |
| Storage | Supabase Storage | Avatars and file attachment objects |
| Auth | Supabase Auth | Email/password and workspace access control |
| Offline | WatermelonDB | Local-first cache and durable offline queue |
| Mesh | react-native-ble-plx + WebRTC DataChannel | Local peer discovery and offline/nearby transport |
| AI | Groq via FastAPI | Translation, coaching, sentiment analysis |
| Styling | NativeWind (Tailwind for React Native) | Utility-first styling and design consistency |
| CI/CD | EAS Build + EAS Submit | App build, signing, and store submission pipeline |

## Prerequisites

- Node.js 20+ ([download](https://nodejs.org/en/download))
- npm 10+ or Bun 1.1+ ([npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm), [Bun](https://bun.sh/docs/installation))
- Expo CLI

```bash
npm install -g expo
```

- EAS CLI

```bash
npm install -g eas-cli
```

- iOS build prerequisites:
  - macOS 14+
  - Xcode 15.4+
  - CocoaPods 1.15+
  - Apple Developer Account ([enroll](https://developer.apple.com/programs/))
- Android build prerequisites:
  - Android Studio Hedgehog+ ([download](https://developer.android.com/studio))
  - Android NDK 26+
  - Android SDK API 26+
  - Java 17
- Windows build prerequisites:
  - Windows 11
  - Visual Studio 2022 with Desktop development with C++ and Universal Windows Platform workloads
  - Windows App SDK 1.8 ([docs](https://learn.microsoft.com/windows/apps/windows-app-sdk/))
  - Node.js Windows Build Tools
- Supabase account ([create project](https://supabase.com/dashboard))
- FastAPI backend running (see [backend README](./backend/README.md))

## Quick Start

For running two devices on the same local network (two accounts in one workspace), see:

- [Two-device setup guide](docs/two-device-setup.md)

1. Clone the repository.

```bash
git clone https://github.com/BorbiAl/spann.git
cd spann
```

2.Install dependencies.

```bash
npm install
```

3.Create your environment file and set values.

```bash
cp .env.example .env
```

Set these variables in `.env`:

- `EXPO_PUBLIC_SUPABASE_URL`: Supabase project URL used by mobile and desktop clients.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Supabase public anon key for authenticated client access.
- `EXPO_PUBLIC_API_URL`: FastAPI base URL (HTTP), for example `http://localhost:8000`.
- `EXPO_PUBLIC_WS_URL`: WebSocket URL for live backend streams, for example `ws://localhost:8002`.
- `EXPO_PUBLIC_APP_ENV`: Runtime environment flag (`development` or `production`).
- `EXPO_PUBLIC_APP_VERSION`: App version shown in diagnostics/settings, for example `1.0.0`.

4.Run Supabase migration.

```bash
psql "$SUPABASE_DB_URL" -f backend/migration.sql
```

5.Create Supabase Storage buckets.

```sql
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('attachments', 'attachments', false)
on conflict (id) do nothing;
```

6.Start FastAPI backend.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
npm run backend
```

On Windows PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ..
npm run backend
```

7.Run on iOS.

```bash
npx expo run:ios
```

8.Run on Android.

```bash
npx expo run:android
```

9.Run on Windows.

```bash
npx react-native run-windows
```

## Environment Variables

| Variable | Required | Platform | Description | Example |
| --- | --- | --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | iOS, Android, Windows | Supabase project base URL used by the app client SDK. | `https://acme-team.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | iOS, Android, Windows | Supabase anon key used for client authentication/session requests. | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `EXPO_PUBLIC_API_URL` | Yes | iOS, Android, Windows | FastAPI HTTP base URL for translation, coaching, and sync endpoints. | `http://localhost:8000` |
| `EXPO_PUBLIC_WS_URL` | Yes | iOS, Android, Windows | WebSocket endpoint for pulse and message stream updates. | `ws://localhost:8002` |
| `EXPO_PUBLIC_APP_ENV` | Yes | iOS, Android, Windows | Runtime environment selector (`development` or `production`). | `development` |
| `EXPO_PUBLIC_APP_VERSION` | Yes | iOS, Android, Windows | App semantic version surfaced in settings and telemetry context. | `1.0.0` |

## Project Structure

```text
spann/
  app/                     - Expo Router pages (file-based navigation)
    (tabs)/                - Bottom tab navigator
      chat/                - Chat page and channel view
      mesh/                - Mesh status, peers, and relay diagnostics
      carbon/              - Carbon tracker and team leaderboard
      pulse/               - Team sentiment pulse dashboard
      accessibility/       - Accessibility controls and previews
      translator/          - Translation and adaptation tools
      settings/            - User and workspace settings
    onboarding/            - 6-step onboarding flow screens
  components/              - Reusable UI components
    chat/                  - Message bubble, composer, reactions, thread UI
    mesh/                  - Peer cards, queue indicators, route inspector
    carbon/                - Carbon stats cards, progress meters, badges
    pulse/                 - Sentiment chart and pulse summary widgets
    common/                - Shared buttons, inputs, modals, avatars
  hooks/                   - Custom React hooks (useMessages, usePulse, etc.)
  store/                   - Zustand stores (auth, messages, presence, etc.)
  services/                - API wrappers (Supabase, FastAPI, mesh transport)
  lib/                     - Supabase client, utilities, mesh HMAC signing
  types/                   - TypeScript interfaces and domain types
  modules/                 - Native C++ TurboModules (mesh BLE/WebRTC daemon)
  windows/                 - React Native for Windows project
  ios/                     - Xcode project
  android/                 - Gradle project
  backend/                 - FastAPI AI backend
  backend/migration.sql    - Complete Supabase schema and RLS policies
  .env.example             - All required environment variables
```

## Supabase Setup

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. Run the schema migration:

```bash
psql "$SUPABASE_DB_URL" -f backend/migration.sql
```

You can also paste the SQL into Supabase SQL Editor and run it directly.

3.Create storage buckets:
-`avatars` (public: `true`)
-`attachments` (public: `false`)

4.Enable Realtime replication for these tables:
-`messages`
-`message_reactions`
-`workspace_members`
-`pulse_snapshots`

5.Copy project URL and anon key into `.env`:
-`EXPO_PUBLIC_SUPABASE_URL`
-`EXPO_PUBLIC_SUPABASE_ANON_KEY`

All tables have Row Level Security enabled. Users can only access data within their workspace.

## Database Schema Overview

- `profiles`: Extends `auth.users` with display name, avatar URL, locale, and culture settings.
- `workspaces`: Stores team workspace metadata including stable slug.
- `workspace_members`: Tracks role-based membership (`owner`, `admin`, `member`).
- `workspace_invites`: Invite code records with expiration and acceptance audit fields.
- `channels`: Workspace-scoped messaging channels.
- `messages`: Core message records with translation fields, sentiment label, and mesh origin flag.
- `message_edits`: Message edit history with previous text snapshots.
- `message_reactions`: Per-user emoji reactions with idempotent toggle behavior.
- `carbon_logs`: Daily commute and transport impact entries.
- `carbon_badges`: Achievement badges earned by user activity.
- `pulse_snapshots`: Time-series sentiment snapshots per channel.
- `mesh_nodes`: Registered mesh-capable devices and node health metadata.
- `user_settings`: User-level accessibility, notification, and translation preferences.

## Building for Production

### iOS

```bash
# Configure EAS
eas build:configure

# Build for TestFlight / App Store
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

Notes:

- Requires Apple Developer Program membership ($99/year).
- Bundle identifier must match the App Store Connect app record.
- Push notification entitlement must be enabled for production profiles.

### Android

```bash
# Build for Google Play
eas build --platform android --profile production

# Submit to Play Console
eas submit --platform android
```

Notes:

- Requires Google Play Developer account ($25 one-time).
- Signing keystore can be managed by EAS for safer key handling.

### Windows

```bash
# Run in development
npx react-native run-windows

# Build release MSIX
cd windows
msbuild Spann.sln /p:Configuration=Release /p:Platform=x64

# Package for Microsoft Store
# Open Visual Studio -> Project -> Publish -> Create App Package
```

Notes:

- Requires Visual Studio 2022 and Windows App SDK 1.8.
- Microsoft Store submission requires valid code signing identity.

## Mesh Networking

Spann mesh transport is a hybrid architecture designed for intermittent connectivity:

- BLE discovery: Devices advertise and scan using a dedicated service UUID, then establish GATT characteristics for low-bandwidth control/data exchange.
- WebRTC DataChannel: When peers are on a local network, Spann upgrades to WebRTC DataChannel for higher throughput and lower delivery latency.
- Epidemic routing: Messages propagate with hop metadata and TTL=6 to prevent infinite forwarding loops while maximizing delivery probability.
- Offline queue: Outbound messages are persisted in WatermelonDB and marked with transport state (`queued`, `relayed`, `acked`).
- Reconnect sync: Once internet or strong peer paths return, queued payloads are deduplicated and synchronized to Supabase/FastAPI.

Local mesh test workflow:

1. Use two physical devices (BLE is not supported in simulators).
2. Sign both devices into the same workspace.
3. Disable internet on one device and send messages.
4. Move devices into Bluetooth/WiFi range and confirm delayed message replay.

Mesh daemon note: the mesh daemon is implemented as a C++ TurboModule. Android builds require NDK; iOS builds require Xcode with CoreBluetooth support.

## AI Features

### Translation

- Client calls `POST /translate` on the FastAPI backend.
- Response payload includes:
  - literal translation
  - cultural adaptation
  - explanation
  - tags
  - sentiment label
- Fail-open behavior: if API is unavailable, the original text is shown and chat continues.

Supported culture pairs:

- American English <-> British English
- American English <-> Bulgarian
- American English <-> Japanese
- American English <-> German
- American English <-> Brazilian Portuguese
- American English <-> Arabic
- American English <-> French
- American English <-> Indian English
- American English <-> Chinese (Simplified)
- British English <-> Indian English

### Coaching Nudges

- Triggered asynchronously right after a message is sent.
- Groq model evaluates tone, clarity, and sentiment risk.
- Returns nudge text and severity (`low`, `medium`, `high`).
- Nudge appears above composer input and is dismissable.
- Message delivery is never blocked by coaching analysis.

### Sentiment Pulse

- Celery beat schedules pulse jobs every 60 seconds.
- Worker scores the most recent 20 messages per active channel.
- Results publish to Redis, then stream through the Go WebSocket server to clients.
- Score range: `-1.0` (stressed) to `1.0` (positive).

## Avatars

- Default avatar source: DiceBear personas
  - `https://api.dicebear.com/8.x/personas/svg?seed={userId}`
  - Produces stable illustrated human-style faces per user.
  - Initials-only circles are not used as a primary avatar style.
- Users can upload custom photos in Settings.
- Uploaded files are stored in Supabase Storage bucket `avatars`.
- Upload takes precedence over generated DiceBear image.
- On image load error, UI falls back to DiceBear (never a broken image frame).

## Onboarding Flow

1. Welcome
  - Personalized greeting with current user name.
2. Profile Setup
  - Avatar selection (DiceBear or upload), display name, language, culture.
3. Create or Join Workspace
  - Create path: workspace name + slug.
  - Join path: 6-character invite code.
4. Invite Team
  - Generate and share invite links in the format `spann://join/{code}`.
5. Preferences
  - Theme, notifications, auto-translate defaults.
6. Complete
  - Animated checkmark, confetti, and `Open Spann` call-to-action.

Deep link behavior: `spann://join/{inviteCode}` opens the app directly into the join workspace flow.

## Contributing

- Fork the repository and create a branch from `main`.
- Branch naming convention:
  - `feature/<short-name>`
  - `fix/<short-name>`
  - `chore/<short-name>`
- Use Conventional Commits:
  - `feat:`
  - `fix:`
  - `chore:`
  - `docs:`
- Run checks before opening a PR:

```bash
npm run type-check
npm run lint
npm test
```

- Pull request template: `.github/pull_request_template.md`

## Troubleshooting

### Metro bundler won't start

```bash
npx expo start --clear
```

### iOS build fails: CocoaPods error

```bash
cd ios && pod install --repo-update
```

### Android build fails: NDK not found

```text
Set ANDROID_NDK_HOME in your environment
Add NDK 26.x in Android Studio -> SDK Manager -> SDK Tools
```

### Windows build fails: WinUI3 missing

```text
Open Visual Studio Installer -> Modify -> Add "Windows App SDK C# Templates"
Run: winget install Microsoft.WindowsAppRuntime.1.5
```

### Supabase Realtime not receiving messages

```text
Check: Realtime is enabled for messages table in Supabase Dashboard -> Database -> Replication
Check: EXPO_PUBLIC_SUPABASE_URL ends with .supabase.co (no trailing slash)
```

### BLE mesh not discovering peers

```text
Physical devices required - BLE does not work on simulators
Both devices must be signed into the same workspace
Grant Bluetooth and Local Network permissions when prompted
```

### Translation returns original text unchanged

```text
Check: EXPO_PUBLIC_API_URL is set and FastAPI backend is running
Check: FastAPI logs for Groq API key errors
Check: source_locale !== target_locale (same locale returns as-is by design)
```

## License

MIT License. See the [LICENSE](./LICENSE) file.

## Links

- [Supabase docs](https://supabase.com/docs)
- [Expo docs](https://docs.expo.dev)
- [React Native 0.84 release notes](https://reactnative.dev/blog)
- [React Native for Windows](https://microsoft.github.io/react-native-windows)
- [EAS Build docs](https://docs.expo.dev/build/introduction)
- [DiceBear avatars](https://www.dicebear.com/styles/personas)
- [FastAPI backend README](./backend/README.md)
