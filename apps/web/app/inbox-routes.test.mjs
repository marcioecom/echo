import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

const appDir = dirname(fileURLToPath(import.meta.url))
const dashboardRoutes = join(appDir, "routes/_dashboard")

describe("inbox route nesting", () => {
  it("renders the conversation page through the inbox layout Outlet", () => {
    const layout = readFileSync(join(dashboardRoutes, "inbox.tsx"), "utf8")
    assert.match(layout, /<Outlet\s*\/>/)
    assert.doesNotMatch(layout, /selectedConversationId/)

    const index = readFileSync(
      join(dashboardRoutes, "inbox.index.tsx"),
      "utf8"
    )
    assert.match(index, /selectedConversationId=\{null\}/)

    const conversation = readFileSync(
      join(dashboardRoutes, "inbox.$conversationId.tsx"),
      "utf8"
    )
    assert.match(conversation, /selectedConversationId=\{conversationId\}/)

    const tree = readFileSync(join(appDir, "routeTree.gen.ts"), "utf8")
    assert.match(tree, /DashboardInboxIndexRoute/)
    assert.match(
      tree,
      /fullPath: '\/inbox\/\$conversationId'[\s\S]*parentRoute: typeof DashboardInboxRoute/
    )
  })
})
