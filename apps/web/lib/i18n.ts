import type { AuthMessages } from "@/modules/auth/i18n"
import type { ChannelsMessages } from "@/modules/channels/i18n"
import type { InboxMessages } from "@/modules/inbox/i18n"
import type { KnowledgeMessages } from "@/modules/knowledge-base/i18n"
import type { MembersMessages } from "@/modules/organization/i18n"
import type { ShellMessages } from "@/modules/shell/i18n"

import { authMessages } from "@/modules/auth/i18n"
import { channelsMessages } from "@/modules/channels/i18n"
import { inboxMessages } from "@/modules/inbox/i18n"
import { knowledgeMessages } from "@/modules/knowledge-base/i18n"
import { localeFromPath } from "@/modules/marketing/i18n/dictionary"
import {
  prefersPortuguese,
  readLanguageCookie,
} from "@/modules/marketing/i18n/negotiation"
import { membersMessages } from "@/modules/organization/i18n"
import { shellMessages } from "@/modules/shell/i18n"

export type AppLocale = "en" | "pt-BR"

type Catalog = {
  auth: AuthMessages
  channels: ChannelsMessages
  inbox: InboxMessages
  knowledge: KnowledgeMessages
  members: MembersMessages
  shell: ShellMessages
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
  en: {
    auth: authMessages.en,
    channels: channelsMessages.en,
    inbox: inboxMessages.en,
    knowledge: knowledgeMessages.en,
    members: membersMessages.en,
    shell: shellMessages.en,
  },
  "pt-BR": {
    auth: authMessages["pt-BR"],
    channels: channelsMessages["pt-BR"],
    inbox: inboxMessages["pt-BR"],
    knowledge: knowledgeMessages["pt-BR"],
    members: membersMessages["pt-BR"],
    shell: shellMessages["pt-BR"],
  },
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

export function documentLang(pathname: string): AppLocale {
  const fromPath = localeFromPath(pathname)
  if (pathname === "/" || fromPath === "pt-BR") return fromPath
  return appLocale()
}

export function t(key: MessageKey, values?: Record<string, string>): string {
  const message = tables[appLocale()][key] ?? tables.en[key] ?? key
  if (!values) return message
  return message.replace(/\{([A-Za-z0-9_]+)\}/g, (token, name: string) => {
    const value = values[name]
    return value === undefined ? token : value
  })
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
