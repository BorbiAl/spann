# Spann Native App Targets

Spann now supports native packaging for both desktop and mobile while keeping the existing React UI.

## Targets
- Desktop: Electron
- Mobile: Capacitor (Android and iOS)

## Prerequisites
- Node.js 20+
- npm
- Android Studio (for Android)
- Xcode (for iOS on macOS)

## Desktop

Development desktop app:

```bash
npm run desktop:dev
```

Production installers:

```bash
npm run desktop:build
```

Output directory:

- `release/`

## Mobile

Add native projects once:

```bash
npm run mobile:add:android
npm run mobile:add:ios
```

Sync web assets after frontend changes:

```bash
npm run mobile:sync
```

Open native projects:

```bash
npm run mobile:android
npm run mobile:ios
```

## API Base URL Strategy

Web development uses Vite proxying (`/api`), but native apps require an absolute backend URL.

Set at build time:

```bash
VITE_API_BASE_URL=https://api.your-domain.com npm run build
```

Desktop runtime override is also supported:

```bash
SPANN_API_BASE=https://api.your-domain.com npm run desktop:dev
```

Fallbacks for local native development:
- Android emulator: `http://10.0.2.2:8000`
- Desktop and iOS simulator: `http://127.0.0.1:8000`

## Production Notes

- Keep backend `ENV=production`
- Keep `AUTH_FALLBACK_ENABLED=false`
- Keep `TEST_MODE=false`
- Ensure CORS allows your app origins
