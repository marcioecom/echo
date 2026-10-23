const FALLBACK_DISPLAY_NAME = "Equipe"

/**
 * Better Auth requires a non-empty User name, but signup no longer asks for one.
 * The email local part is the closest thing we already have, so it becomes the
 * readable default.
 */
export function displayNameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? ""

  const words = localPart
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\d+/g, " ")
    .split(/[^\p{L}]+/u)
    .filter(Boolean)
    .map(capitalize)

  return words.length > 0 ? words.join(" ") : FALLBACK_DISPLAY_NAME
}

function capitalize(word: string): string {
  const [first = "", ...rest] = Array.from(word)
  return `${first.toLocaleUpperCase()}${rest.join("").toLocaleLowerCase()}`
}
