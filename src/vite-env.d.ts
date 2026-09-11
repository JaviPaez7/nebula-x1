/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base path the app is served from, e.g. `/nebula-x1/` on GitHub Pages. */
  readonly VITE_BASE?: string
  readonly DEV: boolean
  readonly PROD: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
