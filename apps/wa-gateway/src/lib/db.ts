import { createDatabase } from "@workspace/db"

import { env } from "../config/env"

export const database = createDatabase(
  env.DATABASE_URL,
  env.DEPENDENCY_TIMEOUT_MS
)
