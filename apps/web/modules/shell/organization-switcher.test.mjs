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

  it("shares organization creation with the onboarding flow", () => {
    const createForm = read(
      "modules/organization/hooks/use-create-organization-form.ts"
    )
    const onboardingHook = read("modules/auth/hooks/use-onboarding-form.ts")
    const onboardingView = read("modules/auth/ui/views/onboarding-view.tsx")
    const availability = read(
      "modules/organization/ui/components/slug-availability.tsx"
    )

    assert.match(createForm, /authClient\.organization\.checkSlug/)
    assert.match(createForm, /authClient\.organization\.create/)
    assert.match(createForm, /deriveSlug/)
    assert.match(onboardingHook, /useCreateOrganizationForm/)
    assert.match(onboardingView, /SlugAvailabilityStatus/)
    assert.doesNotMatch(onboardingView, /AVAILABILITY_STATUS/)
    assert.match(availability, /organization\.slugHint/)
    assert.match(availability, /aria-live="polite"/)
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
