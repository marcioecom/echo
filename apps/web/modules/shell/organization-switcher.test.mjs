import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, it } from "vitest"

const here = dirname(fileURLToPath(import.meta.url))
const webDir = dirname(dirname(here))

function read(path) {
  return readFileSync(join(webDir, path), "utf8")
}

describe("organization switcher", () => {
  it("lists organizations and offers creating a new one", () => {
    const switcher = read("modules/shell/ui/organization-switcher.tsx")
    const sidebar = read("modules/shell/ui/app-sidebar.tsx")
    const hook = read("modules/shell/hooks/use-organization-switcher.ts")

    assert.match(sidebar, /<OrganizationSwitcher/)
    assert.match(switcher, /useOrganizationSwitcher/)
    assert.match(switcher, /useCreateOrganizationForm/)
    assert.match(switcher, /SlugAvailabilityStatus/)
    assert.match(switcher, /t\("shell\.organizations"\)/)
    assert.match(switcher, /t\("shell\.createOrganization"\)/)
    assert.match(switcher, /t\("shell\.newOrganization"\)/)
    assert.match(switcher, /t\("shell\.organizationName"\)/)
    assert.match(switcher, /aria-current/)
    assert.match(switcher, /aria-label=/)
    assert.match(switcher, /disabled=\{isCreating/)
    assert.match(hook, /organizationCreated/)
    assert.match(hook, /invalidateQueries\(\{ queryKey: workspaceQueryKey \}\)/)
  })

  it("creates the first Organization without asking for a slug", () => {
    const createForm = read(
      "modules/organization/hooks/use-create-organization-form.ts"
    )
    const setupHook = read("modules/setup/hooks/use-organization-form.ts")
    const setupRoute = read("app/routes/_setup/setup.tsx")
    const setupForm = read("modules/setup/ui/components/organization-form.tsx")
    const availability = read(
      "modules/organization/ui/components/slug-availability.tsx"
    )

    assert.match(createForm, /authClient\.organization\.checkSlug/)
    assert.match(createForm, /authClient\.organization\.create/)
    assert.match(createForm, /deriveSlug/)
    assert.match(availability, /organization\.slugHint/)
    assert.match(availability, /aria-live="polite"/)

    // The first Organization is created from one field: the slug is an internal
    // address, so it is derived and retried on collision instead of asked.
    assert.match(setupHook, /deriveSlug/)
    assert.match(setupHook, /authClient\.organization\.create/)
    assert.doesNotMatch(setupHook, /checkSlug/)
    assert.doesNotMatch(setupForm, /slug/i)
    assert.match(setupRoute, /<OrganizationForm \/>/)
  })

  it("translates the create flow", () => {
    const shell = read("modules/shell/i18n.ts")
    const organization = read("modules/organization/i18n.ts")

    assert.match(shell, /createOrganization: "Criar organização"/)
    assert.match(shell, /newOrganization: "Nova organização"/)
    assert.match(shell, /organizationCreated: "Organização criada: \{name\}"/)
    assert.match(shell, /create: "Não foi possível criar a organização"/)
    assert.match(organization, /slugHint: "Minúsculas, números e hífens\."/)
    assert.match(organization, /taken: "\{slug\} já está em uso\. Tente outro"/)
  })
})
