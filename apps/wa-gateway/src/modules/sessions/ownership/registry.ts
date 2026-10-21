import type { SessionDirectory } from "../repositories/session-directory"
import type { BaileysSession } from "../session"
import type { ConnectionRef, MediaDownloadResult } from "../types"
import type { SendResult } from "@workspace/messaging"
import type { Redis } from "ioredis"

import { waConnectionQueueName } from "@workspace/jobs"
import { createLoggerWithContext } from "@workspace/logger"
import { Worker } from "bullmq"

import { SessionUnavailableError } from "../errors"
import { handleWaConnectionJob } from "../use-cases/handle-connection-job"
import { SessionLease } from "./lease"

const logger = createLoggerWithContext("wa-gateway:registry")
const reconcileMs = 5_000

type Entry = {
  connection: ConnectionRef
  session: BaileysSession
  lease: SessionLease
  commandWorker: Worker
  run: Promise<void>
  ownershipLost: boolean
}

export type OpenSessionFn = (
  connection: ConnectionRef,
  lease: SessionLease
) => Promise<BaileysSession>

export class SessionRegistry {
  private readonly entries = new Map<string, Entry>()
  private readonly starting = new Map<string, Promise<void>>()
  private reconcileTimer: NodeJS.Timeout | null = null
  private stopping = false

  constructor(
    private readonly deps: {
      redis: Redis
      directory: SessionDirectory
      ownerPod: string
      openSession: OpenSessionFn
    }
  ) {}

  async start(): Promise<void> {
    const resumable = await this.deps.directory.findResumable()
    if (this.stopping) return
    for (const connection of resumable) {
      try {
        await this.connect(connection)
      } catch (error) {
        logger.error("resume failed", {
          error: error instanceof Error ? error.message : String(error),
          ...connection,
        })
      }
    }
    if (this.stopping) return
    this.reconcileTimer = setInterval(() => {
      void this.reconcile()
    }, reconcileMs)
    this.reconcileTimer.unref()
  }

  async connect(connection: ConnectionRef): Promise<void> {
    const id = connection.channelConnectionId
    if (this.stopping || this.entries.has(id)) return

    const inflight = this.starting.get(id)
    if (inflight) {
      await inflight
      return
    }

    const work = this.connectOwned(connection)
    this.starting.set(id, work)
    try {
      await work
    } finally {
      this.starting.delete(id)
    }
  }

  async requestPairingCode(
    input: ConnectionRef & { phoneNumber: string }
  ): Promise<void> {
    const entry = this.entryFor(input)
    if (!entry) throw new SessionUnavailableError()
    if (!(await this.ensureOwner(entry))) throw new SessionUnavailableError()
    await entry.session.requestPairingCode(input.phoneNumber)
  }

  async send(
    input: ConnectionRef & { to: string; body: string }
  ): Promise<SendResult> {
    const entry = this.entryFor(input)
    if (!entry) {
      return { ok: false, retryable: true, code: "session_unavailable" }
    }
    if (!(await this.ensureOwner(entry))) {
      return { ok: false, retryable: true, code: "session_unavailable" }
    }
    return entry.session.sendText(input)
  }

  async downloadMedia(
    input: ConnectionRef & {
      externalMessageId: string
      senderAddress: string
    }
  ): Promise<MediaDownloadResult> {
    const entry = this.entryFor(input)
    if (!entry) {
      logger.warn("Media download skipped; session not registered", {
        organizationId: input.organizationId,
        channelConnectionId: input.channelConnectionId,
        externalMessageId: input.externalMessageId,
        outcome: "session_unavailable",
      })
      return { ok: false, retryable: true, code: "session_unavailable" }
    }
    if (!(await this.ensureOwner(entry))) {
      logger.warn("Media download skipped; ownership lost", {
        organizationId: input.organizationId,
        channelConnectionId: input.channelConnectionId,
        externalMessageId: input.externalMessageId,
        outcome: "session_unavailable",
      })
      return { ok: false, retryable: true, code: "session_unavailable" }
    }
    return entry.session.downloadMedia(input)
  }

  async logout(connection: ConnectionRef): Promise<void> {
    const entry = this.entryFor(connection)
    if (!entry) return
    if (!(await this.ensureOwner(entry))) return
    await entry.session.logout()
  }

  async stop(): Promise<void> {
    this.stopping = true
    if (this.reconcileTimer) {
      clearInterval(this.reconcileTimer)
      this.reconcileTimer = null
    }
    await Promise.allSettled([...this.starting.values()])
    const ids = [...this.entries.keys()]
    await Promise.all(ids.map((id) => this.shutdownEntry(id)))
  }

  private async connectOwned(connection: ConnectionRef): Promise<void> {
    const id = connection.channelConnectionId
    if (this.entries.has(id) || this.stopping) return

    let lease: SessionLease | null = null
    let claimed = false
    let session: BaileysSession | null = null
    let commandWorker: Worker | null = null
    let registered = false
    try {
      lease = await SessionLease.acquire(this.deps.redis, id)
      if (!lease) return
      if (this.stopping) return

      claimed = await this.deps.directory.claim({
        ...connection,
        ownerToken: lease.token,
        ownerPod: this.deps.ownerPod,
      })
      if (!claimed || this.stopping) return

      session = await this.deps.openSession(connection, lease)
      if (this.stopping) return

      commandWorker = new Worker(
        waConnectionQueueName(id),
        (job) => handleWaConnectionJob(this, job),
        { connection: this.deps.redis, concurrency: 1 }
      )
      commandWorker.on("failed", (job, error) => {
        logger.error("connection job failed", {
          error: error.message,
          jobName: job?.name,
          jobId: job?.id,
          channelConnectionId: id,
        })
      })
      if (this.stopping) return

      const entry: Entry = {
        connection,
        session,
        lease,
        commandWorker,
        ownershipLost: false,
        run: Promise.resolve(),
      }
      this.entries.set(id, entry)
      registered = true

      const offLost = lease.onLost(() => {
        void this.onLeaseLost(id)
      })
      entry.run = session
        .run()
        .catch(async (error) => {
          logger.error("session task failed", {
            error: error instanceof Error ? error.message : String(error),
            channelConnectionId: id,
          })
          try {
            await entry.session.stop()
          } catch (stopError) {
            logger.warn("session stop after task failure failed", {
              error:
                stopError instanceof Error
                  ? stopError.message
                  : String(stopError),
              channelConnectionId: id,
            })
          }
        })
        .finally(async () => {
          offLost()
          await this.onSessionEnded(id)
        })
        .catch((error) => {
          logger.error("session cleanup failed", {
            error: error instanceof Error ? error.message : String(error),
            channelConnectionId: id,
          })
        })
    } finally {
      if (!registered) {
        if (commandWorker) await commandWorker.close().catch(() => undefined)
        if (session) await session.stop().catch(() => undefined)
        if (claimed && lease) {
          try {
            await this.deps.directory.release({
              ...connection,
              ownerToken: lease.token,
            })
          } catch (error) {
            logger.warn("release owner token failed", {
              error: error instanceof Error ? error.message : String(error),
              ...connection,
            })
          }
        }
        if (lease) await lease.release().catch(() => undefined)
      }
    }
  }

  private async reconcile(): Promise<void> {
    if (this.stopping) return

    let resumable: ConnectionRef[] = []
    try {
      resumable = await this.deps.directory.findResumable()
    } catch (error) {
      logger.error("reconcile list failed", {
        error: error instanceof Error ? error.message : String(error),
      })
      return
    }

    const resumableIds = new Set(resumable.map((r) => r.channelConnectionId))

    for (const connection of resumable) {
      try {
        const entry = this.entries.get(connection.channelConnectionId)
        if (!entry) {
          await this.connect(connection)
          continue
        }
        if (!(await this.ensureOwner(entry))) {
          await this.evict(connection.channelConnectionId, {
            ownershipLost: true,
          })
        }
      } catch (error) {
        logger.error("reconcile connect failed", {
          error: error instanceof Error ? error.message : String(error),
          ...connection,
        })
      }
    }

    for (const id of [...this.entries.keys()]) {
      if (resumableIds.has(id)) continue
      try {
        await this.evict(id, { ownershipLost: true })
      } catch (error) {
        logger.error("reconcile evict failed", {
          error: error instanceof Error ? error.message : String(error),
          channelConnectionId: id,
        })
      }
    }
  }

  private async onLeaseLost(channelConnectionId: string): Promise<void> {
    await this.evict(channelConnectionId, { ownershipLost: true })
  }

  private async evict(
    channelConnectionId: string,
    options: { ownershipLost: boolean }
  ): Promise<void> {
    const entry = this.entries.get(channelConnectionId)
    if (!entry || entry.ownershipLost) return
    entry.ownershipLost = options.ownershipLost
    await entry.session.stop({ ownershipLost: options.ownershipLost })
  }

  private async onSessionEnded(channelConnectionId: string): Promise<void> {
    const entry = this.entries.get(channelConnectionId)
    if (!entry) return

    this.entries.delete(channelConnectionId)
    try {
      await entry.commandWorker.close()
    } catch (error) {
      logger.warn("connection worker close failed", {
        error: error instanceof Error ? error.message : String(error),
        channelConnectionId,
      })
    }

    if (!entry.ownershipLost) {
      try {
        await this.deps.directory.release({
          ...entry.connection,
          ownerToken: entry.lease.token,
        })
      } catch (error) {
        logger.warn("release owner token failed", {
          error: error instanceof Error ? error.message : String(error),
          ...entry.connection,
        })
      }
      try {
        await entry.lease.release()
      } catch (error) {
        logger.warn("release lease failed", {
          error: error instanceof Error ? error.message : String(error),
          ...entry.connection,
        })
      }
    }
  }
  private async shutdownEntry(channelConnectionId: string): Promise<void> {
    const entry = this.entries.get(channelConnectionId)
    if (!entry) return
    try {
      await entry.session.stop()
    } finally {
      await entry.run.catch(() => undefined)
    }
  }

  private entryFor(ref: ConnectionRef): Entry | undefined {
    const entry = this.entries.get(ref.channelConnectionId)
    if (!entry || entry.connection.organizationId !== ref.organizationId) {
      return undefined
    }
    return entry
  }

  private async ensureOwner(entry: Entry): Promise<boolean> {
    if (entry.ownershipLost) return false
    if (!(await entry.lease.isValid())) return false
    return this.deps.directory.isOwner({
      ...entry.connection,
      ownerToken: entry.lease.token,
    })
  }
}
