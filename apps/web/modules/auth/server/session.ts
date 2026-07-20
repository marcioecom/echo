import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

import { authClient } from "@/lib/auth-client"

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

export interface Workspace {
  user: {
    id: string
    name: string
    email: string
  }
  organization: {
    id: string
    name: string
    slug: string
  }
  role: string
}

export const getSession = cache(async () => {
  const requestHeaders = await headers()
  if (!requestHeaders.get("cookie")) {
    return null
  }

  const { data: session, error } = await authClient.getSession({
    fetchOptions: {
      headers: requestHeaders,
    },
  })
  if (error || !session) {
    return null
  }

  return session
})

export const getWorkspace = cache(async (): Promise<Workspace | null> => {
  const cookieStore = await cookies()
  const cookie = cookieStore.toString()
  if (!cookie) return null
  try {
    const response = await fetch(`${apiUrl}/v1/me`, {
      headers: { cookie },
      cache: "no-store",
    })
    if (!response.ok) return null
    return (await response.json()) as Workspace
  } catch {
    return null
  }
})

export async function requireUser(redirectTo?: string) {
  const session = await getSession()
  if (!session) {
    const target = redirectTo
      ? `/login?redirect=${encodeURIComponent(redirectTo)}`
      : "/login"
    redirect(target)
  }
  return session
}

export async function requireWorkspace(): Promise<Workspace> {
  await requireUser()
  const workspace = await getWorkspace()
  if (!workspace) {
    redirect("/onboarding")
  }
  return workspace
}
