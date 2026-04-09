/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** REST API base URL — e.g. http://localhost:8000 */
  readonly VITE_API_URL: string
  /** WebSocket server URL — e.g. ws://localhost:8002 */
  readonly VITE_WS_URL: string
  /** Semver application version injected at build time */
  readonly VITE_APP_VERSION: string
  /** Runtime environment: "development" | "staging" | "production" */
  readonly VITE_ENVIRONMENT: 'development' | 'staging' | 'production'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Electron exposes this from preload.cjs
declare interface Window {
  SPANN_API_BASE?: string
}
