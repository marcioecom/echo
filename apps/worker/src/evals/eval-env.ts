const placeholders: Record<string, string> = {
  DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5432/echo",
  REDIS_URL: "redis://127.0.0.1:6379",
  RESEND_API_KEY: "eval-unused",
  EMAIL_FROM: "Echo <eval@example.com>",
  PUBLIC_API_URL: "http://127.0.0.1:3001",
  CHANNEL_CREDENTIALS_ENCRYPTION_KEY:
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  CHANNEL_CREDENTIALS_KEY_VERSION: "v1",
  R2_ENDPOINT: "https://example.r2.cloudflarestorage.com",
  R2_BUCKET_NAME: "eval-unused",
  R2_ACCESS_KEY_ID: "eval-unused",
  R2_SECRET_ACCESS_KEY: "eval-unused",
  LANGSMITH_PROJECT: "echo",
}

const required = ["AI_GATEWAY_API_KEY", "LANGSMITH_API_KEY"]

export function prepareEvalEnv(): string[] {
  for (const [key, value] of Object.entries(placeholders)) {
    if (!process.env[key]) process.env[key] = value
  }
  process.env.LANGSMITH_TRACING = "true"
  return required.filter((key) => !process.env[key])
}
