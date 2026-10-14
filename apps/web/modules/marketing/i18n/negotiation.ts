export const LANGUAGE_COOKIE_NAME = "lang"
export const LANGUAGE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export type LanguageChoice = "en" | "pt-br"

export function serializeLanguageCookie(choice: LanguageChoice) {
  return `${LANGUAGE_COOKIE_NAME}=${choice}; Path=/; Max-Age=${LANGUAGE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`
}

export function persistLanguageChoice(choice: LanguageChoice) {
  document.cookie = serializeLanguageCookie(choice)
}

export function readLanguageCookie(
  cookieHeader: string | null | undefined
): LanguageChoice | null {
  if (!cookieHeader) return null

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=")
    if (separator === -1) continue

    const name = part.slice(0, separator).trim().toLowerCase()
    if (name !== LANGUAGE_COOKIE_NAME) continue

    const value = part
      .slice(separator + 1)
      .trim()
      .toLowerCase()
    if (value === "en" || value === "pt-br") return value
  }

  return null
}

export function prefersPortuguese(
  acceptLanguage: string | null | undefined
): boolean {
  const preferred = preferredLanguageTag(acceptLanguage)
  return preferred !== null && isPortugueseLanguageTag(preferred)
}

export function preferredLanguageTag(
  acceptLanguage: string | null | undefined
): string | null {
  if (!acceptLanguage) return null

  let bestTag: string | null = null
  let bestQuality = -1
  let bestIndex = Number.POSITIVE_INFINITY

  for (const [index, part] of acceptLanguage.split(",").entries()) {
    const [rawTag, ...params] = part.trim().split(";")
    const tag = rawTag?.trim().toLowerCase()
    if (!tag) continue

    let quality = 1
    for (const param of params) {
      const [key, rawValue] = param.split("=")
      if (key?.trim().toLowerCase() !== "q") continue
      const parsed = Number(rawValue)
      if (Number.isFinite(parsed)) quality = parsed
    }

    if (quality <= 0) continue
    if (
      quality > bestQuality ||
      (quality === bestQuality && index < bestIndex)
    ) {
      bestTag = tag
      bestQuality = quality
      bestIndex = index
    }
  }

  return bestTag
}

export function isPortugueseLanguageTag(tag: string) {
  const normalized = tag.trim().toLowerCase()
  return normalized === "pt" || normalized.startsWith("pt-")
}

export function negotiateLandingRootRedirect(input: {
  pathname: string
  search?: string
  cookieHeader?: string | null
  acceptLanguage?: string | null
}): string | null {
  if (normalizePathname(input.pathname) !== "/") return null
  if (readLanguageCookie(input.cookieHeader)) return null
  if (!prefersPortuguese(input.acceptLanguage)) return null

  return `/pt-br${normalizeSearch(input.search)}`
}

function normalizePathname(pathname: string) {
  if (!pathname || pathname === "/") return "/"
  return pathname
}

function normalizeSearch(search: string | undefined) {
  if (!search) return ""
  return search.startsWith("?") ? search : `?${search}`
}
