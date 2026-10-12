import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { describe, it } from "vitest"
import { fileURLToPath } from "node:url"

import {
  LANGUAGE_COOKIE_MAX_AGE_SECONDS,
  LANGUAGE_COOKIE_NAME,
  negotiateLandingRootRedirect,
  prefersPortuguese,
  readLanguageCookie,
  serializeLanguageCookie,
} from "../modules/marketing/i18n/negotiation.ts"

const appDir = dirname(fileURLToPath(import.meta.url))
const webDir = join(appDir, "..")

function read(relativePath) {
  return readFileSync(join(webDir, relativePath), "utf8")
}

describe("language cookie", () => {
  it("reads explicit en and pt-br choices", () => {
    assert.equal(readLanguageCookie("theme=light; lang=en"), "en")
    assert.equal(readLanguageCookie("lang=pt-br; session=abc"), "pt-br")
    assert.equal(readLanguageCookie("LANG=PT-BR"), "pt-br")
    assert.equal(readLanguageCookie("lang=fr"), null)
    assert.equal(readLanguageCookie(""), null)
    assert.equal(readLanguageCookie(undefined), null)
  })

  it("serializes a one-year SameSite cookie", () => {
    assert.equal(LANGUAGE_COOKIE_NAME, "lang")
    assert.equal(LANGUAGE_COOKIE_MAX_AGE_SECONDS, 60 * 60 * 24 * 365)
    assert.equal(
      serializeLanguageCookie("en"),
      "lang=en; Path=/; Max-Age=31536000; SameSite=Lax"
    )
    assert.equal(
      serializeLanguageCookie("pt-br"),
      "lang=pt-br; Path=/; Max-Age=31536000; SameSite=Lax"
    )
  })
})

describe("Accept-Language", () => {
  it("treats any highest-priority pt-* as Portuguese", () => {
    assert.equal(prefersPortuguese("pt-BR"), true)
    assert.equal(prefersPortuguese("pt"), true)
    assert.equal(prefersPortuguese("pt-PT,en;q=0.8"), true)
    assert.equal(prefersPortuguese("pt-br,pt;q=0.9,en-US;q=0.8"), true)
  })

  it("does not prefer Portuguese when English wins or the header is missing", () => {
    assert.equal(prefersPortuguese("en-US,en;q=0.9"), false)
    assert.equal(prefersPortuguese("en-US,pt-BR;q=0.8"), false)
    assert.equal(prefersPortuguese("*"), false)
    assert.equal(prefersPortuguese("pt-BR;q=0"), false)
    assert.equal(prefersPortuguese(""), false)
    assert.equal(prefersPortuguese(undefined), false)
  })
})

describe("landing root negotiation", () => {
  it("redirects / to /pt-br when Portuguese is preferred and no cookie is set", () => {
    assert.equal(
      negotiateLandingRootRedirect({
        pathname: "/",
        acceptLanguage: "pt-BR,pt;q=0.9,en;q=0.8",
      }),
      "/pt-br"
    )
  })

  it("preserves the query string on the Portuguese redirect", () => {
    assert.equal(
      negotiateLandingRootRedirect({
        pathname: "/",
        search: "?utm_source=whatsapp",
        acceptLanguage: "pt",
      }),
      "/pt-br?utm_source=whatsapp"
    )
    assert.equal(
      negotiateLandingRootRedirect({
        pathname: "/",
        search: "ref=pilot",
        acceptLanguage: "pt-BR",
      }),
      "/pt-br?ref=pilot"
    )
  })

  it("lets an explicit language cookie win over Accept-Language", () => {
    assert.equal(
      negotiateLandingRootRedirect({
        pathname: "/",
        cookieHeader: "lang=en",
        acceptLanguage: "pt-BR",
      }),
      null
    )
    assert.equal(
      negotiateLandingRootRedirect({
        pathname: "/",
        cookieHeader: "lang=pt-br",
        acceptLanguage: "pt-BR",
      }),
      null
    )
  })

  it("keeps English for crawlers and browsers without a Portuguese preference", () => {
    assert.equal(
      negotiateLandingRootRedirect({
        pathname: "/",
        acceptLanguage: "en-US,en;q=0.9",
      }),
      null
    )
    assert.equal(
      negotiateLandingRootRedirect({
        pathname: "/",
        acceptLanguage: undefined,
      }),
      null
    )
  })

  it("never redirects app or dashboard routes", () => {
    for (const pathname of ["/inbox", "/login", "/sign-up", "/pt-br", "/api/auth"]) {
      assert.equal(
        negotiateLandingRootRedirect({
          pathname,
          acceptLanguage: "pt-BR",
        }),
        null
      )
    }
  })
})

describe("landing locale wiring", () => {
  it("negotiates / on the server and persists the switcher cookie", () => {
    const start = read("app/start.ts")
    const switcher = read("modules/marketing/ui/components/language-switcher.tsx")
    const brand = read("components/brand-logo.tsx")
    const root = read("app/routes/__root.tsx")
    const head = read("modules/marketing/i18n/head.ts")

    assert.match(start, /negotiateLandingRootRedirect/)
    assert.match(start, /statusCode: 302/)
    assert.match(start, /Vary:\s*["']Accept-Language["']/)
    assert.match(start, /Cache-Control/)
    assert.match(switcher, /persistLanguageChoice/)
    assert.match(brand, /translate="no"/)
    assert.match(root, /htmlLang\(localeFromPath\(pathname\)\)/)
    assert.match(head, /hrefLang: "en"/)
    assert.match(head, /hrefLang: "pt-BR"/)
    assert.match(head, /hrefLang: "x-default"/)
  })

  it("discovers web tests with vitest instead of a file list", () => {
    const pkg = JSON.parse(read("package.json"))
    const config = read("vitest.config.ts")
    assert.equal(pkg.scripts.test, "vitest run")
    assert.doesNotMatch(pkg.scripts.test, /inbox-routes\.test/)
    assert.match(config, /include: \["\*\*\/\*\.test\.\{mjs,ts,tsx\}"\]/)
  })
})
