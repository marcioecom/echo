import { ac, admin, operator, owner } from "@workspace/auth"
import { organizationClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
  plugins: [
    organizationClient({
      ac,
      roles: { owner, admin, operator },
    }),
  ],
  fetchOptions: {
    credentials: "include",
  },
})
