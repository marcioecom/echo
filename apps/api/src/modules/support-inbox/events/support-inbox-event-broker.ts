import type { WebSocket } from "ws"

import type { SupportConversationUpdatedEvent } from "../types"

export class SupportInboxEventBroker {
  private readonly connections = new Map<string, Set<WebSocket>>()

  subscribe(organizationId: string, socket: WebSocket): () => void {
    const organizationConnections =
      this.connections.get(organizationId) ?? new Set<WebSocket>()
    organizationConnections.add(socket)
    this.connections.set(organizationId, organizationConnections)

    return () => {
      organizationConnections.delete(socket)
      if (organizationConnections.size === 0) {
        this.connections.delete(organizationId)
      }
    }
  }

  publish(
    organizationId: string,
    event: SupportConversationUpdatedEvent
  ): void {
    const payload = JSON.stringify(event)
    for (const socket of this.connections.get(organizationId) ?? []) {
      if (socket.readyState === socket.OPEN) socket.send(payload)
    }
  }
}

export const supportInboxEventBroker = new SupportInboxEventBroker()
