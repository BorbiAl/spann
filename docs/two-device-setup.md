# Two-Device Setup (Laptop + Hotspot Router Device)

This guide helps you run Spann so two devices can sign in with different accounts, join the same workspace, and exchange messages.

## Current capability status

- Workspace auth and membership: supported
- Messaging between accounts: supported
- Voice/video calling between devices: not fully implemented yet (current Call screen is UI-focused and local controls)

## 1) Start backend on the laptop (host device)

From repository root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ..
npm run backend
```

Backend runs on 0.0.0.0:8000 from package scripts, so LAN devices can reach it.

## 2) Start frontend for LAN access

In a second terminal from repository root:

```powershell
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

## 3) Find laptop LAN IP

Use PowerShell on the laptop:

```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object InterfaceAlias,IPAddress
```

Pick the IP on the hotspot/router network, for example 192.168.137.1.

## 4) Connect both devices to the same network

- Device A: laptop (host)
- Device B: second device connected to the same hotspot/router

Open the app URL on both devices:

- http://<LAPTOP_IP>:5173

Example:

- http://192.168.137.1:5173

## 5) Create two accounts and use one workspace

- On device A, register account A and create a workspace.
- On device B, register account B.
- From device A, invite account B from the workspace members flow.
- Accept invitation on device B.

Both users should now appear in the same workspace members list.

## 6) Messaging verification

- Send a message from device A in any shared channel.
- Device B should receive it automatically (chat polling refreshes every 4 seconds).
- Reply from device B and verify on device A.

## Notes for LAN/dev stability

- If auth or API calls fail from device B, ensure backend env has ALLOWED_ORIGINS including both:
  - http://localhost:5173
  - http://<LAPTOP_IP>:5173
- Restart backend after changing backend environment values.
- Keep TEST_MODE=false and AUTH_FALLBACK_ENABLED=false unless you are specifically testing fallback scenarios.

## Calling status and next step

Calling UI exists, but media/signaling transport is not wired end-to-end for cross-device audio/video yet.

To make calling real between two devices, implement:

1. Call signaling channel (offer/answer/ICE exchange).
2. Peer connection lifecycle (join, leave, reconnect).
3. Media track publish/subscription for remote audio/video.
4. Presence-aware participant synchronization.

A practical next implementation is WebRTC P2P with signaling over a backend route or WebSocket channel.
