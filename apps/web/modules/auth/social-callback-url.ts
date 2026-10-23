type SocialCallbackUrlInput = {
  base: string
  fallback: string
  redirectTo: string
}

/**
 * Builds the callback URL for social sign-in. The URL parser normalizes
 * backslashes, tabs, and newlines, so the origin check happens after parsing;
 * a string prefix check would let `/%09/evil.example` through.
 */
export function buildSocialCallbackUrl({
  base,
  fallback,
  redirectTo,
}: SocialCallbackUrlInput): string {
  if (!redirectTo) return new URL(fallback, base).toString()

  const baseUrl = new URL(base)
  const target = new URL(redirectTo, baseUrl)

  if (target.origin !== baseUrl.origin) {
    return new URL(fallback, baseUrl).toString()
  }

  return target.toString()
}
