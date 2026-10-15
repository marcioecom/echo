export const defaultInboundAgentDebounceMs = 3_000
export const defaultInboundAgentDebounceMaxWaitMs = 10_000

export function inboundAgentDebounceDelay(input: {
  now: number
  burstStartedAt: number
  windowMs: number
  maxWaitMs: number
}): number {
  if (input.windowMs <= 0) {
    throw new Error("Debounce window must be positive")
  }
  if (input.maxWaitMs < input.windowMs) {
    throw new Error("Debounce max wait must cover the window")
  }

  const elapsed = Math.max(0, input.now - input.burstStartedAt)
  const remaining = input.maxWaitMs - elapsed
  if (remaining <= 0) return 0
  return Math.min(input.windowMs, remaining)
}

export interface SlidingDebounceJob {
  id?: string
  data: unknown
  getState: () => Promise<string>
  updateData: (data: unknown) => Promise<unknown>
  changeDelay: (delay: number) => Promise<unknown>
  remove: () => Promise<unknown>
}

export interface SlidingDebounceQueue {
  getJob: (jobId: string) => Promise<SlidingDebounceJob | undefined>
  add: (
    name: string,
    data: unknown,
    options: { jobId: string; delay: number }
  ) => Promise<{ id?: string | null }>
}

const burstStartedAtField = "burstStartedAt"

function readBurstStartedAt(data: unknown, fallback: number): number {
  if (
    typeof data !== "object" ||
    data === null ||
    !(burstStartedAtField in data)
  ) {
    return fallback
  }
  const value = (data as Record<string, unknown>)[burstStartedAtField]
  return typeof value === "number" ? value : fallback
}

function readMessageId(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null || !("messageId" in data)) {
    return undefined
  }
  const value = (data as Record<string, unknown>).messageId
  return typeof value === "string" ? value : undefined
}

function preferLatestPayload<TPayload extends object>(
  current: unknown,
  incoming: TPayload
): TPayload {
  if (!("messageId" in incoming) || typeof incoming.messageId !== "string") {
    return incoming
  }
  const currentMessageId = readMessageId(current)
  if (currentMessageId && currentMessageId > incoming.messageId) {
    return { ...incoming, messageId: currentMessageId }
  }
  return incoming
}

function isTerminal(state: string): boolean {
  return state === "completed" || state === "failed" || state === "missing"
}

function followUpJobId(jobId: string): string {
  return `${jobId}--next`
}

function messageJobId(jobName: string, payload: object, now: number): string {
  if (
    "messageId" in payload &&
    typeof payload.messageId === "string" &&
    payload.messageId.length > 0
  ) {
    return `${jobName}--${payload.messageId}`
  }
  return `${jobName}--fallback--${now}`
}

async function slide<TPayload extends object>(
  job: SlidingDebounceJob,
  input: { payload: TPayload; windowMs: number; maxWaitMs: number },
  now: number
): Promise<string> {
  const burstStartedAt = readBurstStartedAt(job.data, now)
  const delay = inboundAgentDebounceDelay({
    now,
    burstStartedAt,
    windowMs: input.windowMs,
    maxWaitMs: input.maxWaitMs,
  })
  await job.updateData({
    ...preferLatestPayload(job.data, input.payload),
    burstStartedAt,
  })
  await job.changeDelay(delay)
  if (!job.id) throw new Error("Debounced job is missing an id")
  return job.id
}

async function addDelayed<TPayload extends object>(
  queue: SlidingDebounceQueue,
  jobId: string,
  input: {
    jobName: string
    payload: TPayload
    windowMs: number
    maxWaitMs: number
  },
  now: number,
  burstStartedAt: number
): Promise<{ id: string }> {
  const delay = inboundAgentDebounceDelay({
    now,
    burstStartedAt,
    windowMs: input.windowMs,
    maxWaitMs: input.maxWaitMs,
  })
  const job = await queue.add(
    input.jobName,
    { ...input.payload, burstStartedAt },
    { jobId, delay }
  )
  const current = await queue.getJob(jobId)
  if (current && (await current.getState()) === "delayed") {
    const storedMessageId = readMessageId(current.data)
    const incomingMessageId = readMessageId(input.payload)
    if (storedMessageId && storedMessageId !== incomingMessageId) {
      return { id: await slide(current, input, now) }
    }
  }
  const id = current?.id ?? job.id
  if (!id) throw new Error(`Failed to enqueue job: ${input.jobName}`)
  return { id }
}

async function removeIfDelayed(
  queue: SlidingDebounceQueue,
  jobId: string
): Promise<void> {
  const job = await queue.getJob(jobId)
  if (job && (await job.getState()) === "delayed") await job.remove()
}

async function scheduleFallback<TPayload extends object>(
  queue: SlidingDebounceQueue,
  input: {
    jobName: string
    payload: TPayload
    windowMs: number
    maxWaitMs: number
  },
  now: number
): Promise<{ id: string }> {
  const jobId = messageJobId(input.jobName, input.payload, now)
  const existing = await queue.getJob(jobId)
  const state = existing ? await existing.getState() : "missing"
  if (existing && state === "delayed") {
    return { id: await slide(existing, input, now) }
  }
  if (existing && !isTerminal(state)) {
    if (!existing.id) throw new Error(`Failed to enqueue job: ${input.jobName}`)
    return { id: existing.id }
  }
  if (existing) await existing.remove()
  return addDelayed(queue, jobId, input, now, now)
}

async function scheduleFollowUp<TPayload extends object>(
  queue: SlidingDebounceQueue,
  input: {
    jobName: string
    jobId: string
    payload: TPayload
    windowMs: number
    maxWaitMs: number
  },
  now: number
): Promise<{ id: string }> {
  const jobId = followUpJobId(input.jobId)
  const existing = await queue.getJob(jobId)
  const state = existing ? await existing.getState() : "missing"
  if (existing && state === "delayed") {
    return { id: await slide(existing, input, now) }
  }
  if (existing && isTerminal(state)) await existing.remove()
  if (existing && !isTerminal(state)) {
    return scheduleFallback(queue, input, now)
  }
  return addDelayed(queue, jobId, input, now, now)
}

export async function scheduleSlidingDebounce<TPayload extends object>(
  queue: SlidingDebounceQueue,
  input: {
    jobName: string
    jobId: string
    payload: TPayload
    windowMs: number
    maxWaitMs: number
    now?: number
  }
): Promise<{ id: string }> {
  const now = input.now ?? Date.now()
  const primary = await queue.getJob(input.jobId)
  const primaryState = primary ? await primary.getState() : "missing"

  if (primary && primaryState === "delayed") {
    const id = await slide(primary, input, now)
    await removeIfDelayed(queue, followUpJobId(input.jobId))
    return { id }
  }

  if (primary && !isTerminal(primaryState)) {
    return scheduleFollowUp(queue, input, now)
  }

  if (primary) await primary.remove()

  const followUp = await queue.getJob(followUpJobId(input.jobId))
  const followUpState = followUp ? await followUp.getState() : "missing"
  if (followUp && followUpState === "delayed") {
    return { id: await slide(followUp, input, now) }
  }
  if (followUp && !isTerminal(followUpState)) {
    return scheduleFallback(queue, input, now)
  }
  if (followUp) await followUp.remove()

  return addDelayed(queue, input.jobId, input, now, now)
}
