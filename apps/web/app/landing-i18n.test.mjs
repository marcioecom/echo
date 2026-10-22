import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, it } from "vitest"

const appDir = dirname(fileURLToPath(import.meta.url))
const webDir = join(appDir, "..")

function read(relativePath) {
  return readFileSync(join(webDir, relativePath), "utf8")
}

describe("landing locale helpers", () => {
  const source = read("modules/marketing/i18n/dictionary.ts")

  it("maps / and /pt-br to English and Brazilian Portuguese", () => {
    assert.match(source, /export const locales = \["en", "pt-BR"\]/)
    assert.match(source, /locale === "pt-BR" \? "\/pt-br" : "\/"/)
    assert.match(
      source,
      /pathname === "\/pt-br" \|\| pathname\.startsWith\("\/pt-br\/"\)/
    )
  })

  it("keeps the pilot price in BRL in both dictionaries", () => {
    const amounts = source.match(/amount: "R\$297"/g) ?? []
    const periods = source.match(/period: "\/mês"/g) ?? []
    assert.equal(amounts.length, 2)
    assert.equal(periods.length, 2)
    assert.match(source, /Then from R\$297\/mês/)
    assert.match(source, /a partir de R\$297\/mês/)
  })
})

describe("landing routes and SEO", () => {
  it("exposes English and Portuguese home routes with hreflang", () => {
    const index = read("app/routes/index.tsx")
    const portuguese = read("app/routes/pt-br.tsx")
    const head = read("modules/marketing/i18n/head.ts")

    assert.match(index, /createFileRoute\("\/"\)/)
    assert.match(index, /landingHead\("en"\)/)
    assert.match(index, /locale="en"/)
    assert.match(portuguese, /createFileRoute\("\/pt-br"\)/)
    assert.match(portuguese, /landingHead\("pt-BR"\)/)
    assert.match(portuguese, /locale="pt-BR"/)
    assert.match(head, /hrefLang: "en"/)
    assert.match(head, /hrefLang: "pt-BR"/)
    assert.match(head, /hrefLang: "x-default"/)
    assert.match(head, /og:locale/)
  })

  it("sets html lang from the pathname", () => {
    const root = read("app/routes/__root.tsx")
    assert.match(root, /htmlLang\(documentLang\(pathname\)\)/)
    assert.match(root, /document\.documentElement\.lang = lang/)
    assert.match(read("lib/i18n.ts"), /localeFromPath\(pathname\)/)
    assert.match(root, /lang=\{lang\}/)
  })

  it("registers /pt-br in the generated route tree", () => {
    const tree = read("app/routeTree.gen.ts")
    assert.match(tree, /fullPath: '\/pt-br'/)
    assert.match(tree, /id: '\/pt-br'/)
  })
})

describe("landing palette", () => {
  it("uses the shared Echo lime as the landing primary", () => {
    const css = read("modules/marketing/ui/hero.css")
    const tokens = readFileSync(
      join(webDir, "../../packages/ui/src/tokens/echo-palette.ts"),
      "utf8"
    )
    const paletteCss = readFileSync(
      join(webDir, "../../packages/ui/src/styles/echo-palette.css"),
      "utf8"
    )

    assert.match(css, /@import "@workspace\/ui\/echo-palette.css"/)
    assert.match(css, /--landing-primary: var\(--echo-primary\)/)
    assert.match(css, /\.landing-sky/)
    assert.match(css, /oklch\(0\.88 0\.11 128\)/)
    assert.doesNotMatch(css, /oklch\(0\.\d+ 0\.\d+ 228\)/)
    assert.match(css, /prefers-reduced-motion: reduce/)
    assert.match(tokens, /primary: echoGreen\[400\]/)
    assert.match(tokens, /"#99c965"/)
    assert.match(paletteCss, /--echo-primary: var\(--echo-green-400\)/)
    assert.match(paletteCss, /#99c965/)
  })
})

describe("hero scene", () => {
  it("shows where answers come from instead of stacking phone mockups", () => {
    const scene = read("modules/marketing/ui/components/hero-scene.tsx")
    const demo = read("modules/marketing/ui/components/demo-section.tsx")

    assert.match(scene, /ConversationThread/)
    assert.match(scene, /hero-rail/)
    assert.match(scene, /lg:grid-cols-/)
    assert.match(demo, /ConversationThread/)
    assert.doesNotMatch(scene, /PhoneMockup|parallax/)
    assert.doesNotMatch(demo, /PhoneMockup/)
  })

  it("keeps the sequence readable and controllable without motion", () => {
    const scene = read("modules/marketing/ui/components/hero-scene.tsx")
    const hook = read("modules/marketing/hooks/use-hero-sequence.ts")
    const css = read("modules/marketing/ui/hero.css")

    assert.match(scene, /aria-hidden/)
    assert.match(scene, /sr-only/)
    assert.match(scene, /type="button"/)
    assert.match(hook, /prefers-reduced-motion/)
    assert.match(css, /\.hero-sweep/)
    assert.match(css, /prefers-reduced-motion: reduce/)
  })
})

describe("landing copy guardrails", () => {
  it("does not invent social proof", () => {
    const dictionary = read("modules/marketing/i18n/dictionary.ts")
    assert.doesNotMatch(dictionary, /testimonial|⭐|customers worldwide/i)
  })

  it("keeps dashboard routes free of marketing i18n", () => {
    assert.doesNotMatch(
      read("app/routes/_dashboard.tsx"),
      /landingHead|LandingProvider/
    )
  })
})
