import { describe, expect, it, vi } from "vitest"
import type { WebSocket } from "ws"

import { SupportInboxEventBroker } from "./support-inbox-event-broker"

function createSocket() {
  return {
    OPEN: 1,
    readyState: 1,
    send: vi.fn(),
  } as unknown as WebSocket
}

describe("SupportInboxEventBroker", () => {
  it("delivers only to sockets in the target Organization", () => {
    const broker = new SupportInboxEventBroker()
    const acmeSocket = createSocket()
    const otherSocket = createSocket()
    broker.subscribe("acme", acmeSocket)
    broker.subscribe("other", otherSocket)

    broker.publish("acme", {
      type: "support_conversation.updated",
      conversationId: "01K1EDN69NFBWCG42B2H99V2C4",
    })

    expect(acmeSocket.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "support_conversation.updated",
        conversationId: "01K1EDN69NFBWCG42B2H99V2C4",
      })
    )
    expect(otherSocket.send).not.toHaveBeenCalled()
  })

  it("stops delivery after unsubscribe", () => {
    const broker = new SupportInboxEventBroker()
    const socket = createSocket()
    const unsubscribe = broker.subscribe("acme", socket)
    unsubscribe()

    broker.publish("acme", {
      type: "support_conversation.updated",
      conversationId: "01K1EDN69NFBWCG42B2H99V2C4",
    })

    expect(socket.send).not.toHaveBeenCalled()
  })

  it("sends a QR only to owners and admins", () => {
    const broker = new SupportInboxEventBroker()
    const adminSocket = createSocket()
    const operatorSocket = createSocket()
    broker.subscribe("01K1EDN69NFBWCG42B2H99V2C1", adminSocket, "admin")
    broker.subscribe("01K1EDN69NFBWCG42B2H99V2C1", operatorSocket, "operator")

    broker.publish("01K1EDN69NFBWCG42B2H99V2C1", {
      type: "channel.qr",
      channelConnectionId: "01K1EDN69NFBWCG42B2H99V2C4",
      qr: "2@secret",
    })

    expect(adminSocket.send).toHaveBeenCalledOnce()
    expect(operatorSocket.send).not.toHaveBeenCalled()
  })

  it("does not deliver a channel status event to another Organization", () => {
    const broker = new SupportInboxEventBroker()
    const acmeSocket = createSocket()
    const otherSocket = createSocket()
    broker.subscribe("01K1EDN69NFBWCG42B2H99V2C1", acmeSocket)
    broker.subscribe("01K1EDN69NFBWCG42B2H99V2C2", otherSocket)

    broker.publish("01K1EDN69NFBWCG42B2H99V2C1", {
      type: "channel.status_changed",
      channelConnectionId: "01K1EDN69NFBWCG42B2H99V2C4",
    })

    expect(acmeSocket.send).toHaveBeenCalledOnce()
    expect(otherSocket.send).not.toHaveBeenCalled()
  })
})
