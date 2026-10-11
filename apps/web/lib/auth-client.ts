import { ac, admin, operator, owner } from "@workspace/auth"
import { organizationClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import { getApiUrl } from "@/lib/env"

export const authClient = createAuthClient({
  baseURL:
    typeof window === "undefined" ? getApiUrl() : window.location.origin,
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
