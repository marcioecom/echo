import { describe, expect, it } from "vitest"

import { conversationListPath } from "./conversation-list-path"

describe("conversationListPath", () => {
  it("omits the status param for the all filter", () => {
    expect(conversationListPath({ status: "all", limit: 1 })).toBe(
      "/v1/support-conversations?limit=1"
    )
  })

  it("sends a concrete status filter", () => {
    expect(conversationListPath({ status: "human_required" })).toBe(
      "/v1/support-conversations?status=human_required"
    )
  })

  it("includes cursor and limit when present", () => {
    expect(
      conversationListPath({ status: "open", cursor: "next", limit: 10 })
    ).toBe("/v1/support-conversations?status=open&cursor=next&limit=10")
  })

  it("returns the bare path without params", () => {
    expect(conversationListPath({})).toBe("/v1/support-conversations")
  })
})
