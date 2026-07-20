import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

import { authClient } from "@/lib/auth-client"

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
  const session = await getSession()
  if (!session) return null

  const { data: organization, error } =
    await authClient.organization.getFullOrganization({
      fetchOptions: {
        headers: await headers(),
      },
    })
  if (error || !organization) return null

  const member = organization.members.find(
    (entry) => entry.userId === session.user.id,
  )
  if (!member) return null

  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    },
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    },
    role: member.role,
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
