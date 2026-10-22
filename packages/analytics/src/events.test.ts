import { describe, expect, it } from "vitest"

import {
  analyticsEventOwners,
  assertSafeAnalyticsProperties,
  ForbiddenAnalyticsPropertyError,
  organizationDistinctId,
} from "./events"

describe("analytics event contract", () => {
  it("keeps success events on the server that writes the row", () => {
    expect(analyticsEventOwners.signup_completed).toBe("api")
    expect(analyticsEventOwners.organization_created).toBe("api")
    expect(analyticsEventOwners.message_received).toBe("worker")
    expect(analyticsEventOwners.ai_reply_sent).toBe("worker")
    expect(analyticsEventOwners.operator_reply_sent).toBe("api")
  })

  it("keeps intent events on the browser", () => {
    expect(analyticsEventOwners.signup_started).toBe("web")
    expect(analyticsEventOwners.operator_reply_started).toBe("web")
    expect(analyticsEventOwners.inbox_filter_applied).toBe("web")
  })

  it("rejects properties that carry customer data", () => {
    expect(() =>
      assertSafeAnalyticsProperties({ organizationId: "org_1", phone: "+55" })
    ).toThrow(ForbiddenAnalyticsPropertyError)

    expect(() =>
      assertSafeAnalyticsProperties({
        organizationId: "org_1",
        messageBody: "hello",
      })
    ).toThrow(/may contain customer data/)
  })

  it("allows identifier and enum properties", () => {
    expect(() =>
      assertSafeAnalyticsProperties({
        organizationId: "01J8Z",
        channelType: "whatsapp",
        isNewConversation: true,
      })
    ).not.toThrow()
  })

  it("namespaces organization actors so system events are filterable", () => {
    expect(organizationDistinctId("01J8Z")).toBe("organization:01J8Z")
  })
})
