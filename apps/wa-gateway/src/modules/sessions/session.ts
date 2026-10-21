import type { FilteredInbound } from "./adapters/inbound-filter"
import type { StoreInboundMedia } from "./adapters/media-store"
import type { EchoAuthState } from "./auth-state"
import type { CloseOutcome, LifecycleEvent, LifecycleState } from "./lifecycle"
import type { SessionDirectory } from "./repositories/session-directory"
import type {
  MediaDownloadResult,
  SessionEvents,
  SessionLogger,
  SessionSocket,
} from "./types"
import type { ChannelSessionState } from "@workspace/domain"
import type { SendResult, StatusUpdate } from "@workspace/messaging"

import {
  isSupportedInboundAudioMimeType,
  maxInboundAudioBytes,
  normalizeAudioMimeType,
} from "@workspace/domain"

import { statusUpdatesFromBaileys } from "./adapters/delivery-status"
import { filterInboundUpsert, phoneFromJid } from "./adapters/inbound-filter"
import { PairingUnavailableError, RoutingConflictError } from "./errors"
import { transitionLifecycle } from "./lifecycle"
import { classifyDisconnect, disconnectStatusCode } from "./policies/disconnect"
import { nextReconnect } from "./policies/reconnect"

export class BaileysSession {
  private lifecycle: LifecycleState = { phase: "unowned" }
  private socket: SessionSocket | null = null
  private qrWaiters: Array<(ready: boolean) => void> = []
  private pairingTimer: ReturnType<typeof setTimeout> | null = null
  private resolveClose: ((outcome: CloseOutcome) => void) | null = null
  private readonly inboundInFlight = new Set<string>()

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
      storeMedia: StoreInboundMedia
      hasSeenInbound: (externalMessageId: string) => Promise<boolean>
      claimInbound: (externalMessageId: string) => Promise<boolean>
      acquireSendSlot: (to: string) => Promise<"ok" | "connection" | "contact">
      composeDelayMs: (body: string) => number
      delay: (ms: number) => Promise<void>
      pairingTimeoutMs: number
      ownerPod: string | null
      ownerToken: string
      logger: SessionLogger
    }
  ) {}

  async run(): Promise<void> {
    let attempt = 0
    while (!this.isStopping()) {
      const outcome = await this.connectOnce()
      const step = nextReconnect({
        outcome,
        attempt,
        stopped: this.isStopping(),
      })
      if (step.type === "stop") {
        this.transition({ type: "stopped" })
        break
      }
      if (step.type === "exhausted") {
        await this.recordState(
          "disconnected",
          "reconnect_exhausted",
          step.attempt
        )
        this.transition({ type: "stopped" })
        break
      }
      attempt = step.attempt
      if (step.type === "backoff") {
        this.transition({
          type: "backoff",
          attempt: step.attempt,
          delayMs: step.delayMs,
        })
        await this.deps.delay(step.delayMs)
      }
    }
    await this.deps.auth.flush()
  }

  async stop(options?: { ownershipLost?: boolean }): Promise<void> {
    this.transition({ type: "stop" })
    this.clearPairingTimer()
    await this.socket?.end(undefined).catch((error: unknown) => {
      this.deps.logger.warn("Socket close failed during stop", {
        error: error instanceof Error ? error.message : String(error),
      })
    })
    this.finish("stopped")
    this.transition({ type: "stopped" })
    if (options?.ownershipLost) {
      await this.deps.auth.discard()
      return
    }
    await this.deps.auth.flush()
  }

  async logout(): Promise<void> {
    this.transition({ type: "stop" })
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
    this.transition({ type: "stopped" })
  }

  async requestPairingCode(phoneE164: string): Promise<void> {
    const ready = await this.waitForQr()
    if (!ready || !this.socket || this.deps.auth.state.creds.registered) {
      throw new PairingUnavailableError()
    }
    const code = await this.socket.requestPairingCode(phoneE164.slice(1))
    await this.recordState("pairing_code_pending", null)
    await this.deps.publishPairingCode(code)
  }

  async sendText(input: { to: string; body: string }): Promise<SendResult> {
    if (!this.socket || this.lifecycle.phase !== "connected") {
      return { ok: false, retryable: true, code: "session_unavailable" }
    }
    const slot = await this.deps.acquireSendSlot(input.to)
    if (slot !== "ok") {
      return { ok: false, retryable: true, code: "rate_limited" }
    }
    const jid = `${input.to.slice(1)}@s.whatsapp.net`
    await this.socket.sendPresenceUpdate("composing", jid)
    try {
      await this.deps.delay(this.deps.composeDelayMs(input.body))
      const sent = await this.socket.sendMessage(jid, { text: input.body })
      const externalMessageId = sent?.key?.id
      if (!externalMessageId) {
        return { ok: false, retryable: true, code: "missing_provider_id" }
      }
      return { ok: true, externalMessageId }
    } finally {
      await this.socket.sendPresenceUpdate("paused", jid).catch(() => undefined)
    }
  }

  async downloadMedia(input: {
    externalMessageId: string
    senderAddress: string
  }): Promise<MediaDownloadResult> {
    const context = {
      organizationId: this.deps.organizationId,
      channelConnectionId: this.deps.channelConnectionId,
      externalMessageId: input.externalMessageId,
    }
    if (this.lifecycle.phase !== "connected" || !this.socket) {
      this.deps.logger.warn("Media download skipped; session unavailable", {
        ...context,
        outcome: "session_unavailable",
      })
      return { ok: false, retryable: true, code: "session_unavailable" }
    }

    const socket = this.socket
    let bytes: Uint8Array
    let mimeType: string
    try {
      const downloaded = await socket.downloadMedia(input)
      bytes = downloaded.bytes
      mimeType = normalizeAudioMimeType(downloaded.mimeType)
    } catch (error) {
      this.deps.logger.warn("Media download failed", {
        ...context,
        outcome: "media_unavailable",
        error: error instanceof Error ? error.message : String(error),
      })
      return { ok: false, retryable: true, code: "media_unavailable" }
    }

    if (
      bytes.byteLength === 0 ||
      bytes.byteLength > maxInboundAudioBytes ||
      !isSupportedInboundAudioMimeType(mimeType)
    ) {
      this.deps.logger.warn("Media rejected as unsupported", {
        ...context,
        sizeBytes: bytes.byteLength,
        mimeType,
        outcome: "unsupported_media",
      })
      return { ok: false, retryable: false, code: "unsupported_media" }
    }

    try {
      const media = await this.deps.storeMedia({
        organizationId: this.deps.organizationId,
        channelConnectionId: this.deps.channelConnectionId,
        externalMessageId: input.externalMessageId,
        bytes,
        mimeType,
      })
      this.deps.logger.info("Media stored", {
        ...context,
        sizeBytes: media.sizeBytes,
        durationMs: media.durationMs,
        outcome: "stored",
      })
      return { ok: true, media }
    } catch (error) {
      this.deps.logger.warn("Media upload failed", {
        ...context,
        sizeBytes: bytes.byteLength,
        outcome: "media_store_failed",
        error: error instanceof Error ? error.message : String(error),
      })
      return { ok: false, retryable: true, code: "media_store_failed" }
    }
  }

  private async connectOnce(): Promise<CloseOutcome> {
    this.transition({ type: "connect" })
    const done = new Promise<CloseOutcome>((resolve) => {
      this.resolveClose = resolve
    })
    const tracked = await this.recordState("connecting", null)
    if (!tracked) {
      this.transition({ type: "stop" })
      this.finish("stopped")
      return "stopped"
    }
    if (this.isStopping()) {
      this.finish("stopped")
      return "stopped"
    }
    const socket = await this.deps.openSocket()
    if (this.isStopping()) {
      await socket.end(undefined)
      this.finish("stopped")
      return "stopped"
    }
    this.socket = socket
    this.socket.ev.process(async (events) => {
      try {
        await this.onEvents(events)
      } catch (error) {
        this.deps.logger.error("Session event handler failed", {
          error: error instanceof Error ? error.message : String(error),
        })
        this.transition({ type: "stop" })
        this.finish("stopped")
        if (this.socket) await this.socket.end(undefined)
      }
    })
    if (!this.deps.auth.state.creds.registered) this.armPairingTimeout()
    return done
  }

  private async onEvents(events: SessionEvents): Promise<void> {
    if (events["creds.update"]) await this.deps.auth.saveCreds()
    const update = events["connection.update"]
    if (update?.qr) {
      this.transition({ type: "qr" })
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
    this.transition({ type: "open" })
    this.clearPairingTimer()
    const userJid = this.socket?.user?.id
    const address = phoneFromJid(userJid)
    if (!address || !userJid) {
      await this.recordState("disconnected", "missing_phone")
      this.transition({ type: "stop" })
      await this.socket?.end(undefined)
      this.finish("stopped")
      return
    }
    try {
      const connected = await this.deps.directory.markConnected({
        organizationId: this.deps.organizationId,
        channelConnectionId: this.deps.channelConnectionId,
        ownerToken: this.deps.ownerToken,
        address,
        userJid,
        ownerPod: this.deps.ownerPod,
      })
      if (!connected) {
        await this.deps.auth.discard()
        this.transition({ type: "stop" })
        await this.socket?.end(undefined)
        this.finish("stopped")
        return
      }
    } catch (error) {
      if (error instanceof RoutingConflictError) {
        await this.recordState("disconnected", "routing_conflict")
        this.transition({ type: "stop" })
        await this.socket?.end(undefined)
        this.finish("stopped")
        return
      }
      throw error
    }
    await this.deps.publishStatus()
  }

  private async onClose(statusCode: number | undefined): Promise<void> {
    const sawOpen = this.lifecycle.phase === "connected"
    this.clearPairingTimer()
    const action = classifyDisconnect(statusCode)
    if (action === "logged_out") {
      this.transition({ type: "stop" })
      await this.deps.auth.clear()
      await this.recordState("logged_out", null)
      this.finish("logged_out")
      this.transition({ type: "stopped" })
      return
    }
    if (action === "banned") {
      this.transition({ type: "stop" })
      await this.recordState("banned_suspected", "forbidden")
      this.finish("banned")
      return
    }
    if (action === "replaced") {
      this.transition({ type: "stop" })
      await this.recordState("disconnected", "connection_replaced")
      this.finish("replaced")
      return
    }
    const outcome =
      action === "restart" ? "restart" : sawOpen ? "retry_after_open" : "retry"
    this.transition({ type: "close", outcome })
    this.finish(outcome)
  }

  private async onUpsert(
    upsert: NonNullable<SessionEvents["messages.upsert"]>
  ) {
    for (const message of filterInboundUpsert(upsert)) {
      if (message.action !== "accept") continue
      const id = message.externalMessageId
      if (this.inboundInFlight.has(id)) continue
      this.inboundInFlight.add(id)
      try {
        if (await this.deps.hasSeenInbound(id)) continue
        const raw = upsert.messages.find((entry) => entry.key.id === id)
        if (raw?.message) await this.deps.rememberMessage(id, raw.message)
        await this.deps.enqueueInbound(message)
        await this.deps.claimInbound(id)
      } finally {
        this.inboundInFlight.delete(id)
      }
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
      this.onPairingTimeout()
    }, this.deps.pairingTimeoutMs)
  }

  private async onPairingTimeout(): Promise<void> {
    if (
      this.deps.auth.state.creds.registered ||
      this.hasOpened() ||
      this.isStopping()
    ) {
      return
    }
    this.transition({ type: "stop" })
    await this.recordState("disconnected", "pairing_timeout")
    if (this.socket) await this.socket.end(undefined)
    this.finish("pairing_timeout")
  }

  private async recordState(
    state: ChannelSessionState,
    lastError: string | null,
    reconnectAttempts?: number
  ): Promise<boolean> {
    try {
      const tracked = await this.deps.directory.setState({
        organizationId: this.deps.organizationId,
        channelConnectionId: this.deps.channelConnectionId,
        ownerToken: this.deps.ownerToken,
        state,
        lastError,
        reconnectAttempts,
        ownerPod: this.deps.ownerPod,
        connected: state === "connected",
      })
      if (!tracked) {
        await this.deps.auth.discard()
        this.transition({ type: "stop" })
        this.deps.logger.warn("Skipping state write; ownership lost", {
          state,
          lastError,
        })
        return false
      }
    } catch (error) {
      if (!isMissingConnection(error)) throw error
      this.deps.logger.warn("Skipping state write; connection gone", {
        state,
        lastError,
      })
      this.transition({ type: "stop" })
      return false
    }
    await this.deps.publishStatus()
    return true
  }

  private waitForQr(): Promise<boolean> {
    if (this.deps.auth.state.creds.registered) return Promise.resolve(false)
    if (this.hasSeenQr()) return Promise.resolve(true)
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

  private transition(event: LifecycleEvent): void {
    this.lifecycle = transitionLifecycle(this.lifecycle, event)
  }

  private isStopping(): boolean {
    return (
      this.lifecycle.phase === "stopping" || this.lifecycle.phase === "stopped"
    )
  }

  private hasOpened(): boolean {
    return (
      this.lifecycle.phase === "connected" ||
      (this.lifecycle.phase === "backoff" &&
        this.lifecycle.outcome === "retry_after_open")
    )
  }

  private hasSeenQr(): boolean {
    return this.lifecycle.phase === "pairing" && this.lifecycle.qrSeen
  }

  private finish(outcome: CloseOutcome): void {
    const resolve = this.resolveClose
    if (!resolve) return
    this.resolveClose = null
    this.releaseQrWaiters(false)
    resolve(outcome)
  }
}
function isMissingConnection(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  if ("code" in error && error.code === "23503") return true
  if ("cause" in error) return isMissingConnection(error.cause)
  return false
}
