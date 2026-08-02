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
})
