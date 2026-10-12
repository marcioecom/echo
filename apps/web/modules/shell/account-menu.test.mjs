import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { describe, it } from "vitest"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const webDir = dirname(dirname(here))

function read(path) {
  return readFileSync(join(webDir, path), "utf8")
}

describe("dashboard account menu", () => {
  it("opens from the sidebar footer and switches the lang cookie", () => {
    const sidebar = read("modules/shell/ui/app-sidebar.tsx")
    const menu = read("modules/shell/ui/account-menu.tsx")
    const dashboard = read("app/routes/_dashboard.tsx")
    const shell = read("modules/shell/i18n.ts")

    assert.match(sidebar, /<AccountMenu/)
    assert.match(sidebar, /userEmail/)
    assert.doesNotMatch(sidebar, /SignOutButton/)
    assert.doesNotMatch(sidebar, /Logout01Icon/)

    assert.match(dashboard, /userEmail=\{workspace\.user\.email\}/)
    assert.match(menu, /persistLanguageChoice/)
    assert.match(menu, /window\.location\.reload/)
    assert.match(menu, /to="\/settings\/members"/)
    assert.match(menu, /t\("shell\.settings"\)/)
    assert.match(menu, /t\("shell\.language"\)/)
    assert.match(menu, /t\("shell\.signOut"\)/)
    assert.match(menu, /t\("shell\.languageEnglish"\)/)
    assert.match(menu, /t\("shell\.languagePortuguese"\)/)
    assert.match(menu, /DropdownMenuRadioItem/)
    assert.match(menu, /MoreHorizontalIcon/)
    assert.match(menu, /aria-hidden/)
    assert.match(shell, /language: "Idioma"/)
    assert.match(shell, /languageEnglish: "English"/)
    assert.match(shell, /languagePortuguese: "Português"/)
    assert.match(shell, /signOut: "Sair"/)
  })
})
