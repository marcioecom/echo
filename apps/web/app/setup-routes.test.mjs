import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, it } from "vitest"

const appDir = dirname(fileURLToPath(import.meta.url))

function read(path) {
  return readFileSync(join(appDir, path), "utf8")
}

describe("first-run setup routing", () => {
  it("sends a session without an Organization to /setup", () => {
    const dashboard = read("routes/_dashboard.tsx")
    assert.match(dashboard, /to: "\/setup"/)
    assert.doesNotMatch(dashboard, /to: "\/onboarding"/)

    const signUp = read("../modules/auth/hooks/use-sign-up-form.ts")
    assert.match(signUp, /redirectParam \?\? "\/setup"/)
    assert.match(signUp, /isInvitation/)
  })

  it("keeps /onboarding as a redirect into the setup flow", () => {
    const onboarding = read("routes/_auth/onboarding.tsx")
    assert.match(onboarding, /to: "\/setup"/)
  })

  it("gates /setup on a session and hides it from Operators", () => {
    const layout = read("routes/_setup.tsx")
    assert.match(layout, /loadSession/)
    assert.match(layout, /to: "\/login"/)

    const route = read("routes/_setup/setup.tsx")
    assert.match(route, /canManageOrganization/)
    assert.match(route, /to: "\/inbox"/)
  })

  it("replaces the empty queue with setup or a waiting state", () => {
    const inbox = read("../modules/inbox/ui/views/inbox-view.tsx")
    assert.match(inbox, /isFirstRun/)
    assert.match(inbox, /isWaiting/)
    assert.match(inbox, /<SetupChecklist/)
    assert.match(inbox, /<WaitingFirstMessage/)

    const tree = read("routeTree.gen.ts")
    assert.match(tree, /fullPath: '\/setup'/)
  })

  it("keeps every setup step inside /setup instead of settings", () => {
    const view = read("../modules/setup/ui/views/setup-view.tsx")
    assert.match(view, /<ConnectChannelWizard/)
    assert.match(view, /<KnowledgeDocumentForm/)
    assert.match(view, /<BaileysPairingSession/)
    assert.match(view, /useFirstConversation/)
    assert.match(view, /<SetupSuccess/)

    const checklist = read("../modules/setup/ui/components/setup-checklist.tsx")
    assert.match(checklist, /onSelectStep/)
    assert.doesNotMatch(checklist, /\/settings\/channels/)
    assert.doesNotMatch(checklist, /\/settings\/knowledge/)
  })

  it("drops the QR panel once the channel reports connected", () => {
    for (const path of [
      "../modules/channels/ui/components/baileys-pairing-form.tsx",
      "../modules/channels/ui/components/baileys-pairing-session.tsx",
    ]) {
      const component = read(path)
      assert.match(component, /isChannelConnected/)
      assert.match(component, /<ChannelConnectedPanel/)
    }
  })

  it("polls for the first conversation instead of trusting one load", () => {
    const hook = read("../modules/setup/hooks/use-first-conversation.ts")
    assert.match(hook, /conversationListPath\(\{ limit: 1 \}\)/)
    assert.doesNotMatch(hook, /status=all/)
    assert.match(hook, /refetchInterval/)
    assert.match(hook, /echoAnswered/)
  })
})
