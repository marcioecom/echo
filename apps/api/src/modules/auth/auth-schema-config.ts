import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { defaultDependencyTimeoutMs } from "@workspace/config"
import { createDatabase } from "@workspace/db"
import { createId } from "@workspace/domain"
import { betterAuth } from "better-auth"
import { organization } from "better-auth/plugins/organization"

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/echo"
const database = createDatabase(databaseUrl, defaultDependencyTimeoutMs)

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
  database: drizzleAdapter(database.db, {
    provider: "pg",
    usePlural: true,
  }),
  advanced: {
    database: {
      generateId: createId,
    },
  },
  plugins: [
    organization({
      teams: { enabled: false },
      schema: {
        organization: {
          additionalFields: {
            status: {
              type: "string",
              required: true,
              defaultValue: "active",
              input: false,
            },
            archivedAt: {
              type: "date",
              required: false,
              input: false,
            },
          },
        },
      },
    }),
  ],
})
