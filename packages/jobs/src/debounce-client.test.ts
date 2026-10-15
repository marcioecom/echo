import { beforeEach, describe, expect, it, vi } from "vitest"

const { add, close, constructQueue, getJob } = vi.hoisted(() => ({
  add: vi.fn(),
  close: vi.fn(),
  constructQueue: vi.fn(),
  getJob: vi.fn(),
}))

vi.mock("bullmq", () => ({
  Queue: class {
    constructor(name: string, options: unknown) {
      constructQueue(name, options)
    }

    add = add
    close = close
    getJob = getJob
  },
}))

import { createJobClient } from "./client"

const payload = {
  organizationId: "01JFXN7G8C2V1D7A0B3E4F5G6H",
  channelIdentityId: "01JFXN7G8C2V1D7A0B3E4F5G6J",
  supportConversationId: "01JFXN7G8C2V1D7A0B3E4F5G6K",
  messageId: "01JFXN7G8C2V1D7A0B3E4F5G6M",
}

describe("scheduleDebounced", () => {
  beforeEach(() => {
    add.mockReset()
    close.mockReset()
    constructQueue.mockReset()
    getJob.mockReset()
  })

  it("keys the delayed job by the debounce id", async () => {
    getJob.mockResolvedValue(undefined)
    add.mockImplementation(
      async (_name: string, _data: unknown, options: { jobId: string }) => ({
        id: options.jobId,
      })
    )
    const client = createJobClient({} as never)

    await expect(
      client.scheduleDebounced("process-inbound-message", payload, {
        debounceKey: payload.supportConversationId,
        windowMs: 3_000,
        maxWaitMs: 10_000,
        now: 1_000,
      })
    ).resolves.toEqual({
      id: `process-inbound-message--${payload.supportConversationId}`,
    })

    expect(constructQueue).toHaveBeenCalledWith(
      "support-conversations",
      expect.any(Object)
    )
    expect(add).toHaveBeenCalledWith(
      "process-inbound-message",
      { ...payload, burstStartedAt: 1_000 },
      {
        jobId: `process-inbound-message--${payload.supportConversationId}`,
        delay: 3_000,
      }
    )
  })

  it("rejects an invalid payload before touching the queue", async () => {
    const client = createJobClient({} as never)

    await expect(
      client.scheduleDebounced(
        "process-inbound-message",
        { ...payload, messageId: "nope" },
        {
          debounceKey: payload.supportConversationId,
          windowMs: 3_000,
          maxWaitMs: 10_000,
        }
      )
    ).rejects.toThrow()
    expect(add).not.toHaveBeenCalled()
    expect(getJob).not.toHaveBeenCalled()
  })
})
