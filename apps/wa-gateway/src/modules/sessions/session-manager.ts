import type { SendResult } from "@workspace/messaging"

import type { CommandBus, GatewayCommand } from "./adapters/session-commands"
import type { SessionLease, SessionLeaseStore } from "./adapters/session-lease"
import { SessionUnavailableError } from "./errors"
import type { BaileysSession } from "./session"
import type { ConnectionRef, SessionLogger } from "./types"

const defaultCommandTimeoutMs = 20_000

interface RunningSession {
  connection: ConnectionRef
  lease: SessionLease
  session: BaileysSession
  owned: { current: boolean }
  settled: boolean
  unsubscribe: () => Promise<void>
}

export class SessionManager {
  private readonly sessions = new Map<string, RunningSession>()
  private readonly pending = new Set<string>()
  private timer: ReturnType<typeof setInterval> | null = null
  private draining = false
  private stopped = false

  constructor(
    private readonly deps: {
      podId: string
      maxSessions: number
      leaseTtlMs: number
      renewIntervalMs: number
      commandTimeoutMs?: number
      leases: SessionLeaseStore
      bus: CommandBus
      listClaimable: () => Promise<ConnectionRef[]>
      setOwner: (
        connection: ConnectionRef,
        ownerPod: string | null
      ) => Promise<void>
      createSession: (
        connection: ConnectionRef,
        isOwner: () => boolean
      ) => Promise<BaileysSession> | BaileysSession
      logger: SessionLogger
    }
  ) {}

  async start(): Promise<void> {
    await this.reconcile()
    this.timer = setInterval(() => {
      this.reconcile().catch((error: unknown) => {
        this.deps.logger.error("session reconcile failed", { error })
      })
    }, this.deps.renewIntervalMs)
    this.timer.unref?.()
  }

  async pause(): Promise<void> {
    this.draining = true
  }

  async stop(): Promise<void> {
    this.draining = true
    this.stopped = true
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    for (const entry of [...this.sessions.values()]) {
      await this.drop(entry)
    }
    await this.deps.bus.close()
  }

  async reconcile(): Promise<void> {
    if (this.stopped) return
    await this.renewOwned()
    if (this.stopped || this.draining) return
    await this.claimAvailable()
  }

  async connect(connection: ConnectionRef): Promise<void> {
    await this.claim(connection, true)
  }

  async requestPairingCode(
    input: ConnectionRef & { phoneNumber: string }
  ): Promise<void> {
    const local = this.localSession(input.channelConnectionId)
    if (local) {
      await local.requestPairingCode(input.phoneNumber)
      return
    }
    await this.connect(input)
    const started = this.localSession(input.channelConnectionId)
    if (started) {
      await started.requestPairingCode(input.phoneNumber)
      return
    }
    const reply = await this.forward(input.channelConnectionId, {
      type: "pairing_code",
      organizationId: input.organizationId,
      channelConnectionId: input.channelConnectionId,
      phoneNumber: input.phoneNumber,
    })
    if (isFailedReply(reply)) throw new SessionUnavailableError()
  }

  async send(
    input: ConnectionRef & { to: string; body: string }
  ): Promise<SendResult> {
    const local = this.localSession(input.channelConnectionId)
    if (local) return local.sendText(input)
    const reply = await this.forward(input.channelConnectionId, {
      type: "send",
      organizationId: input.organizationId,
      channelConnectionId: input.channelConnectionId,
      to: input.to,
      body: input.body,
    })
    if (isSendResult(reply)) return reply
    return { ok: false, retryable: true, code: "session_unavailable" }
  }

  async logout(connection: ConnectionRef): Promise<void> {
    const local = this.localSession(connection.channelConnectionId)
    if (local) {
      await local.logout()
      return
    }
    await this.forward(connection.channelConnectionId, {
      type: "logout",
      organizationId: connection.organizationId,
      channelConnectionId: connection.channelConnectionId,
    })
  }

  private async renewOwned(): Promise<void> {
    for (const entry of [...this.sessions.values()]) {
      if (!entry.owned.current) continue
      const ok = await this.deps.leases.renew(
        entry.connection.channelConnectionId,
        entry.lease,
        this.deps.leaseTtlMs
      )
      if (ok) continue
      this.deps.logger.warn("session lease lost", {
        channelConnectionId: entry.connection.channelConnectionId,
      })
      await this.drop(entry)
    }
  }

  private async claimAvailable(): Promise<void> {
    const claimable = await this.deps.listClaimable()
    for (const connection of claimable) {
      if (this.stopped) return
      await this.claim(connection, false)
    }
  }

  private async claim(
    connection: ConnectionRef,
    route: boolean
  ): Promise<void> {
    const id = connection.channelConnectionId
    if (this.sessions.has(id) || this.pending.has(id)) return
    const full = this.sessions.size + this.pending.size >= this.deps.maxSessions
    if (this.stopped || this.draining || full) {
      if (route && !this.stopped) {
        await this.forward(id, connectCommand(connection))
      }
      return
    }

    this.pending.add(id)
    try {
      const acquired = await this.deps.leases.acquire(
        id,
        this.deps.podId,
        this.deps.leaseTtlMs
      )
      if (!acquired.ok) {
        if (route) await this.forward(id, connectCommand(connection))
        return
      }
      await this.deps.setOwner(connection, this.deps.podId)
      try {
        await this.attach(connection, acquired.lease)
      } catch (error) {
        await this.deps.leases.release(id, acquired.lease)
        await this.deps.setOwner(connection, null)
        if (route) throw error
        this.deps.logger.error("failed to open session", {
          error,
          channelConnectionId: id,
        })
      }
    } finally {
      this.pending.delete(id)
    }
  }

  private async attach(
    connection: ConnectionRef,
    lease: SessionLease
  ): Promise<void> {
    const owned = { current: true }
    const session = await this.deps.createSession(
      connection,
      () => owned.current
    )
    const entry: RunningSession = {
      connection,
      lease,
      session,
      owned,
      settled: false,
      unsubscribe: async () => undefined,
    }
    this.sessions.set(connection.channelConnectionId, entry)
    try {
      entry.unsubscribe = await this.deps.bus.subscribe(
        connection.channelConnectionId,
        (envelope) => {
          this.handleCommand(envelope.replyTo, envelope.command).catch(
            (error: unknown) => {
              this.deps.logger.error("session command failed", {
                error,
                channelConnectionId: connection.channelConnectionId,
              })
            }
          )
        }
      )
    } catch (error) {
      this.sessions.delete(connection.channelConnectionId)
      throw error
    }
    const ended = session.run().then(
      () => this.release(entry),
      (error: unknown) => {
        this.deps.logger.error("session crashed", {
          error,
          channelConnectionId: connection.channelConnectionId,
        })
        return this.release(entry)
      }
    )
    ended.catch((error: unknown) => {
      this.deps.logger.error("session cleanup failed", {
        error,
        channelConnectionId: connection.channelConnectionId,
      })
    })
  }

  private async handleCommand(
    replyTo: string,
    command: GatewayCommand
  ): Promise<void> {
    try {
      const result = await this.dispatch(command)
      await this.deps.bus.reply(replyTo, result)
    } catch (error) {
      this.deps.logger.error("session command failed", {
        error,
        channelConnectionId: command.channelConnectionId,
      })
      await this.deps.bus.reply(replyTo, {
        ok: false,
        retryable: true,
        code: "session_unavailable",
      })
    }
  }

  private async dispatch(command: GatewayCommand): Promise<SendResult | null> {
    if (command.type === "connect") {
      await this.claim(
        {
          organizationId: command.organizationId,
          channelConnectionId: command.channelConnectionId,
        },
        false
      )
      return null
    }
    if (command.type === "logout") {
      const local = this.localSession(command.channelConnectionId)
      if (local) await local.logout()
      return null
    }
    if (command.type === "pairing_code") {
      const local = this.localSession(command.channelConnectionId)
      if (!local || !command.phoneNumber) throw new SessionUnavailableError()
      await local.requestPairingCode(command.phoneNumber)
      return null
    }
    const local = this.localSession(command.channelConnectionId)
    if (!local || !command.to || !command.body) {
      return { ok: false, retryable: true, code: "session_unavailable" }
    }
    return local.sendText({ to: command.to, body: command.body })
  }

  private async drop(entry: RunningSession): Promise<void> {
    if (entry.settled) return
    entry.settled = true
    entry.owned.current = false
    this.sessions.delete(entry.connection.channelConnectionId)
    await entry.session.stop()
    await entry.unsubscribe()
    await this.releaseLease(entry)
  }

  private async release(entry: RunningSession): Promise<void> {
    if (entry.settled) return
    entry.settled = true
    entry.owned.current = false
    this.sessions.delete(entry.connection.channelConnectionId)
    await entry.unsubscribe()
    await this.releaseLease(entry)
  }

  private async releaseLease(entry: RunningSession): Promise<void> {
    const released = await this.deps.leases.release(
      entry.connection.channelConnectionId,
      entry.lease
    )
    if (released) await this.deps.setOwner(entry.connection, null)
  }

  private localSession(connectionId: string): BaileysSession | null {
    const entry = this.sessions.get(connectionId)
    if (!entry?.owned.current) return null
    return entry.session
  }

  private forward(
    connectionId: string,
    command: GatewayCommand
  ): Promise<unknown> {
    return this.deps.bus.request(
      connectionId,
      command,
      this.deps.commandTimeoutMs ?? defaultCommandTimeoutMs
    )
  }
}

function connectCommand(connection: ConnectionRef): GatewayCommand {
  return {
    type: "connect",
    organizationId: connection.organizationId,
    channelConnectionId: connection.channelConnectionId,
  }
}

function isSendResult(value: unknown): value is SendResult {
  if (!value || typeof value !== "object" || !("ok" in value)) return false
  if (value.ok === true) {
    return (
      "externalMessageId" in value &&
      typeof value.externalMessageId === "string"
    )
  }
  return (
    value.ok === false &&
    "retryable" in value &&
    typeof value.retryable === "boolean" &&
    "code" in value &&
    typeof value.code === "string"
  )
}

function isFailedReply(value: unknown): boolean {
  return isSendResult(value) && value.ok === false
}
