import { beforeEach, describe, expect, it, vi } from "vitest"

import { requestBaileysPairingCode } from "./request-baileys-pairing-code"

const { enqueue, findForOrganization, isOrganizationActive } = vi.hoisted(
  () => ({
    enqueue: vi.fn(),
    findForOrganization: vi.fn(),
    isOrganizationActive: vi.fn(),
  })
)

vi.mock("@/lib/jobs-client", () => ({
  jobs: { enqueue },
}))
vi.mock("../repositories/channel-connections-repository", () => ({
  channelConnectionsRepository: {
    isOrganizationActive,
    findForOrganization,
  },
}))

const organizationId = "01K1EDN69NFBWCG42B2H99V2C1"
const channelConnectionId = "01K1EDN9C8VT0N8WRM13RM6M55"
const phoneNumber = "+5511999999999"

describe("requestBaileysPairingCode", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isOrganizationActive.mockResolvedValue(true)
    findForOrganization.mockResolvedValue({
      id: channelConnectionId,
      provider: "baileys",
      status: "active",
    })
    enqueue.mockResolvedValue({ id: "job-1" })
  })

  it("enqueues pairing on the connection queue", async () => {
    await expect(
      requestBaileysPairingCode({
        organizationId,
        channelConnectionId,
        phoneNumber,
      })
    ).resolves.toEqual({ ok: true, value: undefined })

    expect(enqueue).toHaveBeenCalledWith("wa-pairing-code", {
      organizationId,
      channelConnectionId,
      phoneNumber,
    })
  })

  it("returns queue_unavailable when enqueue fails", async () => {
    enqueue.mockRejectedValue(new Error("redis down"))

    await expect(
      requestBaileysPairingCode({
        organizationId,
        channelConnectionId,
        phoneNumber,
      })
    ).resolves.toEqual({ ok: false, error: { type: "queue_unavailable" } })
  })
})
