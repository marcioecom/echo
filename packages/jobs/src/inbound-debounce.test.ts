import { describe, expect, it } from "vitest"

import {
  inboundAgentDebounceDelay,
  scheduleSlidingDebounce,
  type SlidingDebounceJob,
} from "./inbound-debounce"

const windowMs = 3_000
const maxWaitMs = 10_000
const conversationId = "01JFXN7G8C2V1D7A0B3E4F5G6K"
const jobId = `process-inbound-message--${conversationId}`

function payload(messageId: string) {
  return {
    organizationId: "01JFXN7G8C2V1D7A0B3E4F5G6H",
    channelIdentityId: "01JFXN7G8C2V1D7A0B3E4F5G6J",
    supportConversationId: conversationId,
    messageId,
  }
}

type StoredJob = {
  id: string
  name: string
  data: Record<string, unknown>
  delay: number
  state: "delayed" | "active" | "waiting" | "completed" | "failed"
}

function createQueue(initial: StoredJob[] = []) {
  const jobs = new Map(initial.map((job) => [job.id, job]))

  return {
    jobs,
    async getJob(id: string): Promise<SlidingDebounceJob | undefined> {
      const job = jobs.get(id)
      if (!job) return undefined
      return {
        id: job.id,
        get data() {
          return job.data
        },
        getState: async () => job.state,
        updateData: async (data) => {
          job.data = data as Record<string, unknown>
        },
        changeDelay: async (delay) => {
          if (job.state !== "delayed") throw new Error("Job is not delayed")
          job.delay = delay
        },
        remove: async () => {
          jobs.delete(id)
        },
      }
    },
    async add(
      name: string,
      data: unknown,
      options: { jobId: string; delay: number }
    ) {
      if (jobs.has(options.jobId)) return { id: options.jobId }
      jobs.set(options.jobId, {
        id: options.jobId,
        name,
        data: data as Record<string, unknown>,
        delay: options.delay,
        state: "delayed",
      })
      return { id: options.jobId }
    },
  }
}

describe("inboundAgentDebounceDelay", () => {
  it("uses the full window at the start of a burst", () => {
    expect(
      inboundAgentDebounceDelay({
        now: 1_000,
        burstStartedAt: 1_000,
        windowMs,
        maxWaitMs,
      })
    ).toBe(windowMs)
  })

  it("keeps the sliding window inside the max wait", () => {
    expect(
      inboundAgentDebounceDelay({
        now: 8_500,
        burstStartedAt: 0,
        windowMs,
        maxWaitMs,
      })
    ).toBe(1_500)
  })

  it("runs immediately once the max wait has elapsed", () => {
    expect(
      inboundAgentDebounceDelay({
        now: 10_000,
        burstStartedAt: 0,
        windowMs,
        maxWaitMs,
      })
    ).toBe(0)
  })

  it("rejects a max wait shorter than the window", () => {
    expect(() =>
      inboundAgentDebounceDelay({
        now: 0,
        burstStartedAt: 0,
        windowMs,
        maxWaitMs: 1_000,
      })
    ).toThrow(/max wait/)
  })
})

describe("scheduleSlidingDebounce", () => {
  it("delays the first message of a conversation", async () => {
    const queue = createQueue()

    await expect(
      scheduleSlidingDebounce(queue, {
        jobName: "process-inbound-message",
        jobId,
        payload: payload("01JFXN7G8C2V1D7A0B3E4F5G6M"),
        windowMs,
        maxWaitMs,
        now: 5_000,
      })
    ).resolves.toEqual({ id: jobId })

    expect(queue.jobs.get(jobId)).toMatchObject({
      state: "delayed",
      delay: windowMs,
      data: {
        messageId: "01JFXN7G8C2V1D7A0B3E4F5G6M",
        burstStartedAt: 5_000,
      },
    })
  })

  it("reschedules the same delayed job when another message arrives", async () => {
    const queue = createQueue()
    const first = payload("01JFXN7G8C2V1D7A0B3E4F5G6M")
    const second = payload("01JFXN7G8C2V1D7A0B3E4F5G6N")
    await scheduleSlidingDebounce(queue, {
      jobName: "process-inbound-message",
      jobId,
      payload: first,
      windowMs,
      maxWaitMs,
      now: 0,
    })

    await scheduleSlidingDebounce(queue, {
      jobName: "process-inbound-message",
      jobId,
      payload: second,
      windowMs,
      maxWaitMs,
      now: 2_000,
    })

    expect(queue.jobs.size).toBe(1)
    expect(queue.jobs.get(jobId)).toMatchObject({
      delay: windowMs,
      data: { messageId: second.messageId, burstStartedAt: 0 },
    })
  })

  it("caps the slide so a long burst cannot postpone the agent forever", async () => {
    const queue = createQueue()
    await scheduleSlidingDebounce(queue, {
      jobName: "process-inbound-message",
      jobId,
      payload: payload("01JFXN7G8C2V1D7A0B3E4F5G6M"),
      windowMs,
      maxWaitMs,
      now: 0,
    })

    await scheduleSlidingDebounce(queue, {
      jobName: "process-inbound-message",
      jobId,
      payload: payload("01JFXN7G8C2V1D7A0B3E4F5G6N"),
      windowMs,
      maxWaitMs,
      now: 8_000,
    })
    expect(queue.jobs.get(jobId)?.delay).toBe(2_000)

    await scheduleSlidingDebounce(queue, {
      jobName: "process-inbound-message",
      jobId,
      payload: payload("01JFXN7G8C2V1D7A0B3E4F5G6P"),
      windowMs,
      maxWaitMs,
      now: 11_000,
    })
    expect(queue.jobs.get(jobId)).toMatchObject({
      delay: 0,
      data: {
        messageId: "01JFXN7G8C2V1D7A0B3E4F5G6P",
        burstStartedAt: 0,
      },
    })
  })

  it("keeps a newer message id when an older one is scheduled later", async () => {
    const queue = createQueue()
    const newer = payload("01JFXN7G8C2V1D7A0B3E4F5G6N")
    const older = payload("01JFXN7G8C2V1D7A0B3E4F5G6M")
    await scheduleSlidingDebounce(queue, {
      jobName: "process-inbound-message",
      jobId,
      payload: newer,
      windowMs,
      maxWaitMs,
      now: 0,
    })

    await scheduleSlidingDebounce(queue, {
      jobName: "process-inbound-message",
      jobId,
      payload: older,
      windowMs,
      maxWaitMs,
      now: 1_000,
    })

    expect(queue.jobs.get(jobId)?.data).toMatchObject({
      messageId: newer.messageId,
      burstStartedAt: 0,
    })
    expect(queue.jobs.get(jobId)?.delay).toBe(windowMs)
  })

  it("keeps bursts for different conversations apart", async () => {
    const queue = createQueue()
    const otherJobId = "process-inbound-message--01JFXN7G8C2V1D7A0B3E4F5G6Q"
    await scheduleSlidingDebounce(queue, {
      jobName: "process-inbound-message",
      jobId,
      payload: payload("01JFXN7G8C2V1D7A0B3E4F5G6M"),
      windowMs,
      maxWaitMs,
      now: 0,
    })
    await scheduleSlidingDebounce(queue, {
      jobName: "process-inbound-message",
      jobId: otherJobId,
      payload: {
        ...payload("01JFXN7G8C2V1D7A0B3E4F5G6N"),
        supportConversationId: "01JFXN7G8C2V1D7A0B3E4F5G6Q",
      },
      windowMs,
      maxWaitMs,
      now: 1_000,
    })

    expect([...queue.jobs.keys()].sort()).toEqual([jobId, otherJobId].sort())
  })

  it("starts a new burst after the previous job has finished", async () => {
    const queue = createQueue([
      {
        id: jobId,
        name: "process-inbound-message",
        data: {
          ...payload("01JFXN7G8C2V1D7A0B3E4F5G6M"),
          burstStartedAt: 0,
        },
        delay: 0,
        state: "completed",
      },
    ])

    await scheduleSlidingDebounce(queue, {
      jobName: "process-inbound-message",
      jobId,
      payload: payload("01JFXN7G8C2V1D7A0B3E4F5G6N"),
      windowMs,
      maxWaitMs,
      now: 20_000,
    })

    expect(queue.jobs.get(jobId)).toMatchObject({
      state: "delayed",
      delay: windowMs,
      data: {
        messageId: "01JFXN7G8C2V1D7A0B3E4F5G6N",
        burstStartedAt: 20_000,
      },
    })
  })

  it("queues a follow-up when the conversation job is already running", async () => {
    const queue = createQueue([
      {
        id: jobId,
        name: "process-inbound-message",
        data: {
          ...payload("01JFXN7G8C2V1D7A0B3E4F5G6M"),
          burstStartedAt: 0,
        },
        delay: 0,
        state: "active",
      },
    ])
    const followUpId = `${jobId}--next`

    await scheduleSlidingDebounce(queue, {
      jobName: "process-inbound-message",
      jobId,
      payload: payload("01JFXN7G8C2V1D7A0B3E4F5G6N"),
      windowMs,
      maxWaitMs,
      now: 4_000,
    })
    await scheduleSlidingDebounce(queue, {
      jobName: "process-inbound-message",
      jobId,
      payload: payload("01JFXN7G8C2V1D7A0B3E4F5G6P"),
      windowMs,
      maxWaitMs,
      now: 5_000,
    })

    expect(queue.jobs.get(jobId)?.data).toMatchObject({
      messageId: "01JFXN7G8C2V1D7A0B3E4F5G6M",
    })
    expect(queue.jobs.get(followUpId)).toMatchObject({
      state: "delayed",
      delay: windowMs,
      data: {
        messageId: "01JFXN7G8C2V1D7A0B3E4F5G6P",
        burstStartedAt: 4_000,
      },
    })
    expect(queue.jobs.size).toBe(2)
  })
})
