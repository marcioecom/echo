import type { StoreInboundMedia } from "./adapters/media-store"
import type { EchoAuthState } from "./auth-state"
import type { SessionDirectory } from "./repositories/session-directory"
import type { SessionEvents, SessionSocket } from "./types"
import type { AuthenticationCreds } from "@whiskeysockets/baileys"

import { maxInboundAudioBytes } from "@workspace/domain"
import { describe, expect, it, vi } from "vitest"

import { BaileysSession } from "./session"

const organizationId = "01K1EDN69NFBWCG42B2H99V2C1"
const channelConnectionId = "01K1EDN9C8VT0N8WRM13RM6M55"
const ownerToken = "01OWNER_TOKEN_FOR_TESTS000000"

function fakeSocket() {
  let handler: ((events: SessionEvents) => Promise<void> | void) | null = null
  const socket: SessionSocket = {
    ev: {
      process: (next) => {
        handler = next
      },
    },
    user: undefined,
    sendMessage: vi.fn(async () => ({ key: { id: "wamid.out" } })),
    sendPresenceUpdate: vi.fn(async () => undefined),
    requestPairingCode: vi.fn(async () => "ABCD1234"),
    downloadMedia: vi.fn(async () => ({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "audio/ogg",
    })),
    logout: vi.fn(async () => undefined),
    end: vi.fn(async () => undefined),
  }
  return {
    socket,
    emit: (events: SessionEvents) => handler?.(events),
    ready: () => handler !== null,
  }
}

function harness(options?: {
  pairingTimeoutMs?: number
  registered?: boolean
  hasSeenInbound?: (id: string) => Promise<boolean>
  claim?: (id: string) => Promise<boolean>
  openSocket?: () => Promise<SessionSocket>
}) {
  const opened: ReturnType<typeof fakeSocket>[] = []
  const directory: SessionDirectory = {
    claim: vi.fn(async () => true),
    isOwner: vi.fn(async () => true),
    release: vi.fn(async () => true),
    setState: vi.fn(async () => true),
    markConnected: vi.fn(async () => true),
    findResumable: vi.fn(async () => []),
  }
  const publishQr = vi.fn(async () => undefined)
  const publishPairingCode = vi.fn(async () => undefined)
  const enqueueInbound = vi.fn(async () => undefined)
  const enqueueStatus = vi.fn(async () => undefined)
  const storeMedia = vi.fn<StoreInboundMedia>(async (media) => ({
    objectKey: "media-key",
    mimeType: media.mimeType,
    sizeBytes: media.bytes.byteLength,
  }))
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  const clear = vi.fn(async () => undefined)
  const discard = vi.fn(async () => undefined)
  const auth = {
    state: {
      creds: {
        registered: options?.registered ?? false,
      } as AuthenticationCreds,
      keys: { get: async () => ({}), set: async () => undefined },
    },
    saveCreds: vi.fn(async () => undefined),
    flush: vi.fn(async () => undefined),
    discard,
    clear,
  } as EchoAuthState
  const session = new BaileysSession({
    organizationId,
    channelConnectionId,
    auth,
    openSocket:
      options?.openSocket ??
      (async () => {
        const socket = fakeSocket()
        opened.push(socket)
        return socket.socket
      }),
    directory,
    publishQr,
    publishPairingCode,
    publishStatus: vi.fn(async () => undefined),
    enqueueInbound,
    rememberMessage: vi.fn(async () => undefined),
    enqueueStatus,
    storeMedia,
    hasSeenInbound: options?.hasSeenInbound ?? (async () => false),
    claimInbound: options?.claim ?? (async () => true),
    acquireSendSlot: async () => "ok",
    composeDelayMs: () => 0,
    delay: async () => undefined,
    pairingTimeoutMs: options?.pairingTimeoutMs ?? 60_000,
    ownerPod: "pod-a",
    ownerToken,
    logger,
  })
  return {
    session,
    opened,
    directory,
    publishQr,
    publishPairingCode,
    enqueueInbound,
    enqueueStatus,
    storeMedia,
    logger,
    clear,
  }
}

describe("BaileysSession", () => {
  it("publishes a QR without storing or logging it", async () => {
    const setup = harness()
    const running = setup.session.run()
    await vi.waitFor(() => expect(setup.opened[0]?.ready()).toBe(true))
    await setup.opened[0]?.emit({
      "connection.update": { qr: "2@secret-qr" },
    })

    expect(setup.publishQr).toHaveBeenCalledWith("2@secret-qr")
    expect(
      JSON.stringify(vi.mocked(setup.directory.setState).mock.calls)
    ).not.toContain("2@secret-qr")
    expect(JSON.stringify(setup.logger.info.mock.calls)).not.toContain(
      "2@secret-qr"
    )
    await setup.session.stop()
    await running
  })

  it("returns to disconnected when pairing times out", async () => {
    const setup = harness({ pairingTimeoutMs: 20 })
    await setup.session.run()
    expect(setup.directory.setState).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "disconnected",
        lastError: "pairing_timeout",
      })
    )
  })

  it("activates the connection with the paired phone number", async () => {
    const setup = harness()
    const running = setup.session.run()
    await vi.waitFor(() => expect(setup.opened[0]?.ready()).toBe(true))
    setup.opened[0]!.socket.user = { id: "5511999999999:12@s.whatsapp.net" }
    await setup.opened[0]?.emit({ "connection.update": { connection: "open" } })

    expect(setup.directory.markConnected).toHaveBeenCalledWith(
      expect.objectContaining({
        address: "+5511999999999",
        userJid: "5511999999999:12@s.whatsapp.net",
      })
    )
    await setup.session.stop()
    await running
  })

  it("closes an opened socket without a usable phone identity", async () => {
    const setup = harness({ registered: true })
    const running = setup.session.run()
    await vi.waitFor(() => expect(setup.opened[0]?.ready()).toBe(true))
    await setup.opened[0]?.emit({ "connection.update": { connection: "open" } })

    expect(setup.opened[0]?.socket.end).toHaveBeenCalledWith(undefined)
    expect(setup.directory.setState).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "disconnected",
        lastError: "missing_phone",
      })
    )
    await expect(running).resolves.toBeUndefined()
  })

  it("closes a socket that opens after shutdown begins", async () => {
    let resolveSocket!: (socket: SessionSocket) => void
    const opening = new Promise<SessionSocket>((resolve) => {
      resolveSocket = resolve
    })
    const lateSocket = fakeSocket()
    let openStarted = false
    const setup = harness({
      registered: true,
      openSocket: () => {
        openStarted = true
        return opening
      },
    })
    const running = setup.session.run()
    await vi.waitFor(() => expect(openStarted).toBe(true))
    const stopping = setup.session.stop()
    resolveSocket(lateSocket.socket)

    await Promise.all([running, stopping])
    expect(lateSocket.socket.end).toHaveBeenCalledWith(undefined)
  })

  it("ingests a direct message once and maps a delivery receipt", async () => {
    const seen = new Set<string>()
    const setup = harness({
      hasSeenInbound: async (id) => seen.has(id),
      claim: async (id) => {
        seen.add(id)
        return true
      },
    })
    const running = setup.session.run()
    await vi.waitFor(() => expect(setup.opened[0]?.ready()).toBe(true))
    const upsert = {
      type: "notify",
      messages: [
        {
          key: {
            id: "wamid.in",
            fromMe: false,
            remoteJid: "5511888888888@s.whatsapp.net",
          },
          pushName: "Ana",
          message: { conversation: "Oi" },
        },
      ],
    }
    await setup.opened[0]?.emit({ "messages.upsert": upsert })
    await setup.opened[0]?.emit({ "messages.upsert": upsert })
    await setup.opened[0]?.emit({
      "messages.update": [
        { key: { id: "wamid.out", fromMe: true }, update: { status: 3 } },
      ],
    })

    expect(setup.enqueueInbound).toHaveBeenCalledTimes(1)
    expect(setup.enqueueStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        externalMessageId: "wamid.out",
        status: "delivered",
      })
    )
    await setup.session.stop()
    await running
  })
  it("retries an inbound event after enqueue fails in a prior session", async () => {
    const seen = new Set<string>()
    const hasSeenInbound = async (id: string) => seen.has(id)
    const claim = async (id: string) => {
      seen.add(id)
      return true
    }
    const upsert = {
      type: "notify",
      messages: [
        {
          key: {
            id: "wamid.retry",
            fromMe: false,
            remoteJid: "5511888888888@s.whatsapp.net",
          },
          pushName: "Ana",
          message: { conversation: "Oi" },
        },
      ],
    }

    const first = harness({ hasSeenInbound, claim })
    first.enqueueInbound.mockRejectedValueOnce(new Error("queue unavailable"))
    const firstRun = first.session.run()
    await vi.waitFor(() => expect(first.opened[0]?.ready()).toBe(true))
    await first.opened[0]?.emit({ "messages.upsert": upsert })
    await firstRun

    const second = harness({ hasSeenInbound, claim })
    const secondRun = second.session.run()
    await vi.waitFor(() => expect(second.opened[0]?.ready()).toBe(true))
    await second.opened[0]?.emit({ "messages.upsert": upsert })

    expect(second.enqueueInbound).toHaveBeenCalledTimes(1)
    await second.session.stop()
    await secondRun
  })

  it("suppresses an accepted inbound event after a session restart", async () => {
    const seen = new Set<string>()
    const hasSeenInbound = async (id: string) => seen.has(id)
    const claim = async (id: string) => {
      seen.add(id)
      return true
    }
    const upsert = {
      type: "notify",
      messages: [
        {
          key: {
            id: "wamid.restart",
            fromMe: false,
            remoteJid: "5511888888888@s.whatsapp.net",
          },
          message: { conversation: "Oi" },
        },
      ],
    }
    const first = harness({ hasSeenInbound, claim })
    const firstRun = first.session.run()
    await vi.waitFor(() => expect(first.opened[0]?.ready()).toBe(true))
    await first.opened[0]?.emit({ "messages.upsert": upsert })
    await first.session.stop()
    await firstRun

    const restarted = harness({ hasSeenInbound, claim })
    const restartedRun = restarted.session.run()
    await vi.waitFor(() => expect(restarted.opened[0]?.ready()).toBe(true))
    await restarted.opened[0]?.emit({ "messages.upsert": upsert })

    expect(restarted.enqueueInbound).not.toHaveBeenCalled()
    await restarted.session.stop()
    await restartedRun
  })

  it("enqueues a concurrent duplicate callback only once", async () => {
    const seen = new Set<string>()
    const setup = harness({
      hasSeenInbound: async (id) => seen.has(id),
      claim: async (id) => {
        seen.add(id)
        return true
      },
    })
    const upsert = {
      type: "notify",
      messages: [
        {
          key: {
            id: "wamid.concurrent",
            fromMe: false,
            remoteJid: "5511888888888@s.whatsapp.net",
          },
          message: { conversation: "Oi" },
        },
      ],
    }
    const running = setup.session.run()
    await vi.waitFor(() => expect(setup.opened[0]?.ready()).toBe(true))

    await Promise.all([
      setup.opened[0]?.emit({ "messages.upsert": upsert }),
      setup.opened[0]?.emit({ "messages.upsert": upsert }),
    ])

    expect(setup.enqueueInbound).toHaveBeenCalledTimes(1)
    await setup.session.stop()
    await running
  })

  it("sends with a composing pause and deletes keys on logout", async () => {
    const setup = harness({ registered: true })
    const running = setup.session.run()
    await vi.waitFor(() => expect(setup.opened[0]?.ready()).toBe(true))
    setup.opened[0]!.socket.user = { id: "5511999999999@s.whatsapp.net" }
    await setup.opened[0]?.emit({ "connection.update": { connection: "open" } })

    await expect(
      setup.session.sendText({ to: "+5511888888888", body: "Oi" })
    ).resolves.toEqual({ ok: true, externalMessageId: "wamid.out" })
    expect(setup.opened[0]?.socket.sendPresenceUpdate).toHaveBeenNthCalledWith(
      1,
      "composing",
      "5511888888888@s.whatsapp.net"
    )
    expect(setup.opened[0]?.socket.sendMessage).toHaveBeenCalledWith(
      "5511888888888@s.whatsapp.net",
      { text: "Oi" }
    )

    await setup.session.logout()
    expect(setup.clear).toHaveBeenCalled()
    expect(setup.directory.setState).toHaveBeenCalledWith(
      expect.objectContaining({ state: "logged_out" })
    )
    await running
  })

  it("requests a pairing code without logging it", async () => {
    const setup = harness()
    const running = setup.session.run()
    await vi.waitFor(() => expect(setup.opened[0]?.ready()).toBe(true))
    await setup.opened[0]?.emit({ "connection.update": { qr: "2@secret-qr" } })
    await setup.session.requestPairingCode("+5511999999999")

    expect(setup.opened[0]?.socket.requestPairingCode).toHaveBeenCalledWith(
      "5511999999999"
    )
    expect(setup.publishPairingCode).toHaveBeenCalledWith("ABCD1234")
    expect(JSON.stringify(setup.logger.info.mock.calls)).not.toContain(
      "ABCD1234"
    )
    await setup.session.stop()
    await running
  })

  it("survives logged_out after the connection row was deleted", async () => {
    const setup = harness()
    const missing = Object.assign(new Error("fk"), {
      cause: Object.assign(new Error("fk"), { code: "23503" }),
    })
    vi.mocked(setup.directory.setState)
      .mockResolvedValueOnce(true)
      .mockRejectedValue(missing)

    const running = setup.session.run()
    await vi.waitFor(() => expect(setup.opened[0]?.ready()).toBe(true))
    await setup.opened[0]?.emit({
      "connection.update": {
        connection: "close",
        lastDisconnect: { error: { output: { statusCode: 401 } } },
      },
    })

    await expect(running).resolves.toBeUndefined()
    expect(setup.logger.warn).toHaveBeenCalledWith(
      "Skipping state write; connection gone",
      expect.objectContaining({ state: "logged_out" })
    )
  })

  it("downloads and stores audio while connected", async () => {
    const setup = harness({ registered: true })
    const running = setup.session.run()
    await vi.waitFor(() => expect(setup.opened[0]?.ready()).toBe(true))
    setup.opened[0]!.socket.user = { id: "5511999999999@s.whatsapp.net" }
    await setup.opened[0]?.emit({ "connection.update": { connection: "open" } })
    const socket = setup.opened[0]!.socket
    vi.mocked(socket.downloadMedia).mockResolvedValueOnce({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "Audio/OGG; codecs=opus",
    })

    await expect(
      setup.session.downloadMedia({
        externalMessageId: "wamid.audio",
        senderAddress: "+5511888888888",
      })
    ).resolves.toEqual({
      ok: true,
      media: {
        objectKey: "media-key",
        mimeType: "audio/ogg",
        sizeBytes: 3,
      },
    })

    expect(socket.downloadMedia).toHaveBeenCalledWith({
      externalMessageId: "wamid.audio",
      senderAddress: "+5511888888888",
    })
    expect(setup.storeMedia).toHaveBeenCalledWith({
      organizationId,
      channelConnectionId,
      externalMessageId: "wamid.audio",
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "audio/ogg",
    })
    expect(setup.logger.info).toHaveBeenCalledWith(
      "Media stored",
      expect.objectContaining({
        externalMessageId: "wamid.audio",
        sizeBytes: 3,
        outcome: "stored",
      })
    )
    await setup.session.stop()
    await running
  })

  it("reports a disconnected session as retryable", async () => {
    const setup = harness()

    await expect(
      setup.session.downloadMedia({
        externalMessageId: "wamid.audio",
        senderAddress: "+5511888888888",
      })
    ).resolves.toEqual({
      ok: false,
      retryable: true,
      code: "session_unavailable",
    })
    expect(setup.storeMedia).not.toHaveBeenCalled()
  })

  it("rejects oversized audio without retrying", async () => {
    const setup = harness({ registered: true })
    const running = setup.session.run()
    await vi.waitFor(() => expect(setup.opened[0]?.ready()).toBe(true))
    setup.opened[0]!.socket.user = { id: "5511999999999@s.whatsapp.net" }
    await setup.opened[0]?.emit({ "connection.update": { connection: "open" } })
    vi.mocked(setup.opened[0]!.socket.downloadMedia).mockResolvedValueOnce({
      bytes: new Uint8Array(maxInboundAudioBytes + 1),
      mimeType: "audio/ogg",
    })

    await expect(
      setup.session.downloadMedia({
        externalMessageId: "wamid.audio",
        senderAddress: "+5511888888888",
      })
    ).resolves.toEqual({
      ok: false,
      retryable: false,
      code: "unsupported_media",
    })
    expect(setup.storeMedia).not.toHaveBeenCalled()
    await setup.session.stop()
    await running
  })

  it("rejects unsupported audio mime without retrying", async () => {
    const setup = harness({ registered: true })
    const running = setup.session.run()
    await vi.waitFor(() => expect(setup.opened[0]?.ready()).toBe(true))
    setup.opened[0]!.socket.user = { id: "5511999999999@s.whatsapp.net" }
    await setup.opened[0]?.emit({ "connection.update": { connection: "open" } })
    vi.mocked(setup.opened[0]!.socket.downloadMedia).mockResolvedValueOnce({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "audio/aac",
    })

    await expect(
      setup.session.downloadMedia({
        externalMessageId: "wamid.audio",
        senderAddress: "+5511888888888",
      })
    ).resolves.toEqual({
      ok: false,
      retryable: false,
      code: "unsupported_media",
    })
    expect(setup.storeMedia).not.toHaveBeenCalled()
    await setup.session.stop()
    await running
  })
})
