import type { AuthenticationCreds } from "@whiskeysockets/baileys"
import { describe, expect, it, vi } from "vitest"

import type { EchoAuthState } from "../auth/use-echo-auth-state"
import {
  BaileysSession,
  type SessionEvents,
  type SessionSocket,
} from "./session-runner"
import type { SessionDirectory } from "./session-directory"

const organizationId = "01K1EDN69NFBWCG42B2H99V2C1"
const channelConnectionId = "01K1EDN9C8VT0N8WRM13RM6M55"

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
  claim?: (id: string) => Promise<boolean>
}) {
  const opened: ReturnType<typeof fakeSocket>[] = []
  const directory: SessionDirectory = {
    setState: vi.fn(async () => undefined),
    markConnected: vi.fn(async () => undefined),
    findResumable: vi.fn(async () => null),
  }
  const publishQr = vi.fn(async () => undefined)
  const publishPairingCode = vi.fn(async () => undefined)
  const enqueueInbound = vi.fn(async () => undefined)
  const enqueueStatus = vi.fn(async () => undefined)
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  const clear = vi.fn(async () => undefined)
  const auth = {
    state: {
      creds: {
        registered: options?.registered ?? false,
      } as AuthenticationCreds,
      keys: { get: async () => ({}), set: async () => undefined },
    },
    saveCreds: vi.fn(async () => undefined),
    flush: vi.fn(async () => undefined),
    clear,
  } as EchoAuthState
  const session = new BaileysSession({
    organizationId,
    channelConnectionId,
    auth,
    openSocket: async () => {
      const socket = fakeSocket()
      opened.push(socket)
      return socket.socket
    },
    directory,
    publishQr,
    publishPairingCode,
    publishStatus: vi.fn(async () => undefined),
    enqueueInbound,
    rememberMessage: vi.fn(async () => undefined),
    enqueueStatus,
    claimInbound: options?.claim ?? (async () => true),
    acquireSendSlot: async () => "ok",
    composeDelayMs: () => 0,
    delay: async () => undefined,
    pairingTimeoutMs: options?.pairingTimeoutMs ?? 60_000,
    ownerPod: "pod-a",
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

  it("ingests a direct message once and maps a delivery receipt", async () => {
    const seen = new Set<string>()
    const setup = harness({
      claim: async (id) => {
        if (seen.has(id)) return false
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
})
