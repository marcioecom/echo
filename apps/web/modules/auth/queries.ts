import { queryOptions, type QueryClient } from "@tanstack/react-query"

import { authClient } from "@/lib/auth-client"

import type { Workspace } from "./session"

export const sessionQueryKey = ["auth", "session"] as const
export const workspaceQueryKey = ["auth", "workspace"] as const

const AUTH_QUERY_STALE_TIME = 60_000

export function sessionQueryOptions() {
  return queryOptions({
    queryKey: sessionQueryKey,
    queryFn: fetchSession,
    staleTime: (query) =>
      query.state.data == null ? 0 : AUTH_QUERY_STALE_TIME,
  })
}

export function workspaceQueryOptions() {
  return queryOptions({
    queryKey: workspaceQueryKey,
    queryFn: fetchWorkspace,
    staleTime: (query) =>
      query.state.data == null ? 0 : AUTH_QUERY_STALE_TIME,
  })
}

export function loadSession(queryClient: QueryClient) {
  return queryClient.query(sessionQueryOptions())
}

export function loadWorkspace(queryClient: QueryClient) {
  return queryClient.query(workspaceQueryOptions())
}

export function clearAuthQueries(queryClient: QueryClient) {
  queryClient.removeQueries({ queryKey: sessionQueryKey })
  queryClient.removeQueries({ queryKey: workspaceQueryKey })
}

export async function fetchSession() {
  const { data, error } = await authClient.getSession()
  if (error || !data) return null
  return data
}

export async function fetchWorkspace(): Promise<Workspace | null> {
  const session = await fetchSession()
  if (!session) return null

  const { data: organization, error } =
    await authClient.organization.getFullOrganization()
  if (error || !organization) return null

  const member = organization.members.find(
    (entry) => entry.userId === session.user.id
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
}
