/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** REST API base URL — e.g. http://localhost:8000 */
  readonly VITE_API_URL: string
  /** Optional local mesh daemon URL — e.g. http://127.0.0.1:7070 */
  readonly VITE_MESH_DAEMON_URL?: string
  /** Explicit API base for file:// native builds (desktop/mobile shells) */
  readonly VITE_NATIVE_API_BASE_URL?: string
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
  electronAPI?: {
    getPassword: (service: string, account: string) => Promise<string | null>
    setPassword: (service: string, account: string, password: string) => Promise<void>
    deletePassword: (service: string, account: string) => Promise<void>
    getHostname?: () => Promise<string>
  }
}
