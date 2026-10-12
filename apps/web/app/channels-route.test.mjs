import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { describe, it } from "vitest"
import { fileURLToPath } from "node:url"

const appDir = dirname(fileURLToPath(import.meta.url))
const webDir = dirname(appDir)

describe("channels route", () => {
  it("gates /settings/channels to owners and admins and renders the channels view", () => {
    const route = readFileSync(
      join(appDir, "routes/_dashboard/settings.channels.tsx"),
      "utf8"
    )
    assert.match(route, /createFileRoute\("\/_dashboard\/settings\/channels"\)/)
    assert.match(route, /canManageOrganization/)
    assert.match(route, /redirect\(\{ to: "\/inbox" \}\)/)
    assert.match(route, /<ChannelsView/)

    const tree = readFileSync(join(appDir, "routeTree.gen.ts"), "utf8")
    assert.match(tree, /DashboardSettingsChannelsRoute/)
    assert.match(tree, /fullPath: '\/settings\/channels'/)

    const sidebar = readFileSync(
      join(webDir, "modules/shell/ui/app-sidebar.tsx"),
      "utf8"
    )
    assert.match(sidebar, /\/settings\/channels/)
    assert.match(sidebar, /t\("channels\.nav"\)/)
  })

  it("offers Twilio as the recommended path and an enabled QR path", () => {
    const copy = readFileSync(
      join(webDir, "modules/channels/i18n.ts"),
      "utf8"
    )
    assert.match(copy, /Recomendado/)
    assert.match(copy, /Recommended/)
    assert.match(copy, /nav: "Canais"/)
    assert.match(copy, /nav: "Channels"/)
    assert.doesNotMatch(copy, /betaSoon/)

    const wizard = readFileSync(
      join(webDir, "modules/channels/ui/components/connect-channel-wizard.tsx"),
      "utf8"
    )
    assert.match(wizard, /t\("channels\.recommended"\)/)
    assert.match(wizard, /t\("channels\.qrTitle"\)/)
    assert.doesNotMatch(wizard, /disabled/)
    assert.doesNotMatch(wizard, /betaSoon/)

    const route = readFileSync(
      join(appDir, "routes/_dashboard/settings.channels.tsx"),
      "utf8"
    )
    assert.match(route, /channelsHead/)

    const view = readFileSync(
      join(webDir, "modules/channels/ui/views/channels-view.tsx"),
      "utf8"
    )
    assert.doesNotMatch(view, /document\.title/)
  })

  it("refreshes channel status from the organization event stream", () => {
    const events = readFileSync(
      join(webDir, "modules/channels/hooks/use-channel-events.tsx"),
      "utf8"
    )
    assert.match(events, /channelStatusChangedEventSchema/)
    assert.match(events, /channelQueryKeys\.list\(organizationId\)/)
    assert.match(events, /getChannelEventsUrl/)

    const types = readFileSync(join(webDir, "modules/channels/types.ts"), "utf8")
    assert.match(types, /channel\.status_changed/)
  })
})
