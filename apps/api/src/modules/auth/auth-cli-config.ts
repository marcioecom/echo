import { createDatabase } from "@workspace/db"

import { loadApiEnv } from "../../config/env"
import { createAuth } from "./auth"

const env = loadApiEnv()
const database = createDatabase(env.DATABASE_URL, env.DEPENDENCY_TIMEOUT_MS)

export const auth = createAuth({
  db: database.db,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  webAppUrl: env.WEB_APP_URL,
  deliverInvitationEmail: async () => undefined,
})
