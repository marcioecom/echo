import type { SendResult, StatusUpdate } from "@workspace/messaging"
import type { ChannelSessionState } from "@workspace/domain"

import type { EchoAuthState } from "../auth/use-echo-auth-state"
import { statusUpdatesFromBaileys } from "./delivery-status"
import { classifyDisconnect, disconnectStatusCode } from "./disconnect"
import {
  filterInboundUpsert,
  phoneFromJid,
  type FilteredInbound,
  type RawInboundMessage,
} from "./inbound-filter"
import { reconnectDelayMs } from "./pacing"
import {
  RoutingConflictError,
  type SessionDirectory,
} from "./session-directory"

const MAX_RECONNECT_ATTEMPTS = 8

export interface SessionSocket {
  ev: {
    process: (handler: (events: SessionEvents) => void | Promise<void>) => void
  }
  user?: { id: string }
  sendMessage: (
    jid: string,
    content: { text: string }
  ) => Promise<{ key?: { id?: string | null } } | undefined>
  sendPresenceUpdate: (
    type: "composing" | "paused",
    jid?: string
  ) => Promise<void>
  requestPairingCode: (phoneNumber: string) => Promise<string>
  logout: () => Promise<void>
  end: (error: Error | undefined) => Promise<void>
}

export interface SessionEvents {
  "connection.update"?: {
    connection?: "open" | "connecting" | "close"
    qr?: string
    lastDisconnect?: { error?: unknown }
  }
  "creds.update"?: unknown
  "messages.upsert"?: { type: string; messages: RawInboundMessage[] }
  "messages.update"?: Array<{
    key: { id?: string | null; fromMe?: boolean | null }
    update?: { status?: number | null }
  }>
}

type CloseOutcome =
  | "restart"
  | "logged_out"
  | "replaced"
  | "banned"
  | "retry"
  | "retry_after_open"
  | "pairing_timeout"
  | "stopped"

export interface SessionLogger {
  info: (message: string, data?: Record<string, unknown>) => void
  warn: (message: string, data?: Record<string, unknown>) => void
  error: (message: string, data?: Record<string, unknown>) => void
}

export class BaileysSession {
  private socket: SessionSocket | null = null
  private stopped = false
  private open = false
  private sawOpen = false
  private qrSeen = false
  private qrWaiters: Array<(ready: boolean) => void> = []
  private pairingTimer: ReturnType<typeof setTimeout> | null = null
  private resolveClose: ((outcome: CloseOutcome) => void) | null = null
  private closed = false

  constructor(
    private readonly deps: {
      organizationId: string
      channelConnectionId: string
      auth: EchoAuthState
      openSocket: () => Promise<SessionSocket>
      directory: SessionDirectory
      publishQr: (qr: string) => Promise<void>
      publishPairingCode: (pairingCode: string) => Promise<void>
      publishStatus: () => Promise<void>
      enqueueInbound: (
        message: Extract<FilteredInbound, { action: "accept" }>
      ) => Promise<void>
      rememberMessage: (
        externalMessageId: string,
        message: unknown
      ) => Promise<void>
      enqueueStatus: (update: StatusUpdate) => Promise<void>
      claimInbound: (externalMessageId: string) => Promise<boolean>
      acquireSendSlot: (to: string) => Promise<"ok" | "connection" | "contact">
      composeDelayMs: (body: string) => number
      delay: (ms: number) => Promise<void>
      pairingTimeoutMs: number
      ownerPod: string | null
      logger: SessionLogger
    }
  ) {}

  async run(): Promise<void> {
    let attempt = 0
    while (!this.stopped) {
      const outcome = await this.connectOnce()
      if (this.stopped || outcome === "stopped") break
      if (
        outcome === "logged_out" ||
        outcome === "replaced" ||
        outcome === "banned" ||
        outcome === "pairing_timeout"
      ) {
        break
      }
      if (outcome === "restart" || outcome === "retry_after_open") {
        attempt = 0
        continue
      }
      attempt += 1
      if (attempt >= MAX_RECONNECT_ATTEMPTS) {
        await this.recordState("disconnected", "reconnect_exhausted", attempt)
        break
      }
      await this.deps.delay(reconnectDelayMs(attempt))
    }
    await this.deps.auth.flush()
  }

  async stop(): Promise<void> {
    this.stopped = true
    this.clearPairingTimer()
    if (this.socket) await this.socket.end(undefined)
    this.finish("stopped")
    await this.deps.auth.flush()
  }

  async logout(): Promise<void> {
    this.stopped = true
    this.clearPairingTimer()
    if (this.socket) {
      try {
        await this.socket.logout()
      } catch {
        await this.socket.end(undefined)
      }
    }
    await this.deps.auth.clear()
    await this.recordState("logged_out", null)
    this.finish("logged_out")
  }

  async requestPairingCode(phoneE164: string): Promise<void> {
    const ready = await this.waitForQr()
    if (!ready || !this.socket || this.deps.auth.state.creds.registered) {
      throw new Error("pairing_unavailable")
    }
    const code = await this.socket.requestPairingCode(phoneE164.slice(1))
    await this.recordState("pairing_code_pending", null)
    await this.deps.publishPairingCode(code)
  }

  async sendText(input: { to: string; body: string }): Promise<SendResult> {
    if (!this.socket || !this.open) {
      return { ok: false, retryable: true, code: "session_unavailable" }
    }
    const slot = await this.deps.acquireSendSlot(input.to)
    if (slot !== "ok") {
      return { ok: false, retryable: true, code: "rate_limited" }
    }
    const jid = `${input.to.slice(1)}@s.whatsapp.net`
    await this.socket.sendPresenceUpdate("composing", jid)
    await this.deps.delay(this.deps.composeDelayMs(input.body))
    const sent = await this.socket.sendMessage(jid, { text: input.body })
    await this.socket.sendPresenceUpdate("paused", jid)
    const externalMessageId = sent?.key?.id
    if (!externalMessageId) {
      return { ok: false, retryable: true, code: "missing_provider_id" }
    }
    return { ok: true, externalMessageId }
  }

  private async connectOnce(): Promise<CloseOutcome> {
    this.open = false
    this.sawOpen = false
    this.qrSeen = false
    this.closed = false
    const done = new Promise<CloseOutcome>((resolve) => {
      this.resolveClose = resolve
    })
    await this.recordState("connecting", null)
    this.socket = await this.deps.openSocket()
    this.socket.ev.process((events) => this.onEvents(events))
    if (!this.deps.auth.state.creds.registered) this.armPairingTimeout()
    return done
  }

  private async onEvents(events: SessionEvents): Promise<void> {
    if (events["creds.update"]) await this.deps.auth.saveCreds()
    const update = events["connection.update"]
    if (update?.qr) {
      this.qrSeen = true
      await this.recordState("qr_pending", null)
      await this.deps.publishQr(update.qr)
      this.releaseQrWaiters(true)
      this.deps.logger.info("QR issued", {
        channelConnectionId: this.deps.channelConnectionId,
      })
    }
    if (update?.connection === "open") await this.onOpen()
    if (update?.connection === "close") {
      await this.onClose(disconnectStatusCode(update.lastDisconnect?.error))
    }
    if (events["messages.upsert"]) {
      await this.onUpsert(events["messages.upsert"])
    }
    if (events["messages.update"])
      await this.onStatus(events["messages.update"])
  }

  private async onOpen(): Promise<void> {
    this.open = true
    this.sawOpen = true
    this.clearPairingTimer()
    const address = phoneFromJid(this.socket?.user?.id)
    if (!address || !this.socket?.user?.id) {
      await this.recordState("disconnected", "missing_phone")
      return
    }
    try {
      await this.deps.directory.markConnected({
        organizationId: this.deps.organizationId,
        channelConnectionId: this.deps.channelConnectionId,
        address,
        userJid: this.socket.user.id,
        ownerPod: this.deps.ownerPod,
      })
    } catch (error) {
      if (error instanceof RoutingConflictError) {
        await this.recordState("disconnected", "routing_conflict")
        this.stopped = true
        await this.socket.end(undefined)
        return
      }
      throw error
    }
    await this.deps.publishStatus()
  }

  private async onClose(statusCode: number | undefined): Promise<void> {
    this.open = false
    this.clearPairingTimer()
    const action = classifyDisconnect(statusCode)
    if (action === "logged_out") {
      this.stopped = true
      await this.deps.auth.clear()
      await this.recordState("logged_out", null)
      this.finish("logged_out")
      return
    }
    if (action === "banned") {
      this.stopped = true
      await this.recordState("banned_suspected", "forbidden")
      this.finish("banned")
      return
    }
    if (action === "replaced") {
      this.stopped = true
      await this.recordState("disconnected", "connection_replaced")
      this.finish("replaced")
      return
    }
    if (action === "restart") {
      this.finish("restart")
      return
    }
    this.finish(this.sawOpen ? "retry_after_open" : "retry")
  }

  private async onUpsert(
    upsert: NonNullable<SessionEvents["messages.upsert"]>
  ) {
    for (const message of filterInboundUpsert(upsert)) {
      if (message.action !== "accept") continue
      const claimed = await this.deps.claimInbound(message.externalMessageId)
      if (!claimed) continue
      const raw = upsert.messages.find(
        (entry) => entry.key.id === message.externalMessageId
      )
      if (raw?.message) {
        await this.deps.rememberMessage(message.externalMessageId, raw.message)
      }
      await this.deps.enqueueInbound(message)
    }
  }

  private async onStatus(
    updates: NonNullable<SessionEvents["messages.update"]>
  ): Promise<void> {
    const mapped = statusUpdatesFromBaileys({
      organizationId: this.deps.organizationId,
      channelConnectionId: this.deps.channelConnectionId,
      updates: updates.map((update) => ({
        key: update.key,
        status: update.update?.status,
      })),
    })
    for (const update of mapped) await this.deps.enqueueStatus(update)
  }

  private armPairingTimeout(): void {
    this.clearPairingTimer()
    this.pairingTimer = setTimeout(() => {
      void this.onPairingTimeout()
    }, this.deps.pairingTimeoutMs)
  }

  private async onPairingTimeout(): Promise<void> {
    if (this.deps.auth.state.creds.registered || this.sawOpen || this.stopped) {
      return
    }
    this.stopped = true
    await this.recordState("disconnected", "pairing_timeout")
    if (this.socket) await this.socket.end(undefined)
    this.finish("pairing_timeout")
  }

  private async recordState(
    state: ChannelSessionState,
    lastError: string | null,
    reconnectAttempts?: number
  ): Promise<void> {
    await this.deps.directory.setState({
      organizationId: this.deps.organizationId,
      channelConnectionId: this.deps.channelConnectionId,
      state,
      lastError,
      reconnectAttempts,
      ownerPod: this.deps.ownerPod,
      connected: state === "connected",
    })
    await this.deps.publishStatus()
  }

  private waitForQr(): Promise<boolean> {
    if (this.deps.auth.state.creds.registered) return Promise.resolve(false)
    if (this.qrSeen) return Promise.resolve(true)
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 20_000)
      this.qrWaiters.push((ready) => {
        clearTimeout(timer)
        resolve(ready)
      })
    })
  }

  private releaseQrWaiters(ready: boolean): void {
    const waiters = this.qrWaiters.splice(0)
    for (const waiter of waiters) waiter(ready)
  }

  private clearPairingTimer(): void {
    if (!this.pairingTimer) return
    clearTimeout(this.pairingTimer)
    this.pairingTimer = null
  }

  private finish(outcome: CloseOutcome): void {
    if (this.closed) return
    this.closed = true
    this.releaseQrWaiters(false)
    this.resolveClose?.(outcome)
  }
}
