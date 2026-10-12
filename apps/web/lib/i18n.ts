import {
  channelsMessages,
  type ChannelsMessages,
} from "@/modules/channels/i18n"
import {
  prefersPortuguese,
  readLanguageCookie,
} from "@/modules/marketing/i18n/negotiation"

export type AppLocale = "en" | "pt-BR"

type Catalog = {
  channels: ChannelsMessages
}

type LeafPaths<T, Prefix extends string = ""> = {
  [Key in keyof T & string]: T[Key] extends string
    ? `${Prefix}${Key}`
    : T[Key] extends Record<string, unknown>
      ? LeafPaths<T[Key], `${Prefix}${Key}.`>
      : never
}[keyof T & string]

export type MessageKey = LeafPaths<Catalog>

const catalogs: Record<AppLocale, Catalog> = {
  en: { channels: channelsMessages.en },
  "pt-BR": { channels: channelsMessages["pt-BR"] },
}

const tables: Record<AppLocale, Record<string, string>> = {
  en: flatten(catalogs.en),
  "pt-BR": flatten(catalogs["pt-BR"]),
}

export function resolveLocale(input: {
  cookie?: string | null
  language?: string | null
}): AppLocale {
  const choice = readLanguageCookie(input.cookie)
  if (choice === "pt-br") return "pt-BR"
  if (choice === "en") return "en"
  if (prefersPortuguese(input.language)) return "pt-BR"
  return "en"
}

export function appLocale(): AppLocale {
  if (typeof document === "undefined") return "en"
  return resolveLocale({
    cookie: document.cookie,
    language: navigator.language,
  })
}

export function t(key: MessageKey): string {
  return tables[appLocale()][key] ?? tables.en[key] ?? key
}

export function isMessageKey(value: string): value is MessageKey {
  return Object.prototype.hasOwnProperty.call(tables.en, value)
}

export function translateMessage(message: string): string {
  return isMessageKey(message) ? t(message) : message
}

function flatten(
  value: unknown,
  prefix = "",
  out: Record<string, string> = {}
) {
  if (!value || typeof value !== "object") return out
  for (const [key, entry] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof entry === "string") out[path] = entry
    else flatten(entry, path, out)
  }
  return out
}
