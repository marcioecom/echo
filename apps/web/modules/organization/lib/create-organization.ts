import { deriveSlug, SLUG_MAX_LENGTH } from "@workspace/domain"

import { authClient } from "@/lib/auth-client"

/**
 * Creates an Organization from the name collected in onboarding. The slug is
 * an internal address, so it is derived from the name and retried on collision
 * instead of being asked of the person who is only trying to start.
 */
export async function createOrganization(name: string) {
  for (const slug of slugCandidates(name)) {
    const { data, error } = await authClient.organization.create({ name, slug })
    if (!error && data) return data
    if (!slugIsTaken(error)) return null
  }
  return null
}

export function slugCandidates(name: string): string[] {
  const base = deriveSlug(name) || "organizacao"
  return [
    base,
    ...["2", "3", "4", "5"].map((suffix) => withSuffix(base, suffix)),
    withSuffix(base, Math.random().toString(36).slice(2, 6)),
  ]
}

function withSuffix(base: string, suffix: string): string {
  const room = SLUG_MAX_LENGTH - suffix.length - 1
  return `${base.slice(0, room).replace(/-+$/, "")}-${suffix}`
}

function slugIsTaken(error: unknown): boolean {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : undefined
  return (
    code === "ORGANIZATION_SLUG_ALREADY_TAKEN" ||
    code === "ORGANIZATION_ALREADY_EXISTS"
  )
}
