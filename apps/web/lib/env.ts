export function getApiUrl() {
  return import.meta.env.VITE_API_URL ?? "http://localhost:3001"
}

export function getAppUrl() {
  return import.meta.env.VITE_APP_URL ?? "http://localhost:3000"
}

export function isGoogleAuthEnabled() {
  return import.meta.env.VITE_GOOGLE_AUTH_ENABLED === "true"
}
