/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_APP_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare namespace Cloudflare {
  interface Env {
    API_URL: string
  }
}

declare module "cloudflare:workers" {
  export const env: Cloudflare.Env
}
