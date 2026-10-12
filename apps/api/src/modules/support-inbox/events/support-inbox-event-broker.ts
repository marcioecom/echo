import type { InboxEvent } from "@workspace/jobs"
import type { WebSocket } from "ws"

interface InboxSocket {
  socket: WebSocket
  role: string
}

const adminOnlyEvents = new Set(["channel.qr", "channel.pairing_code"])

export class SupportInboxEventBroker {
  private readonly connections = new Map<string, Set<InboxSocket>>()

  subscribe(
    organizationId: string,
    socket: WebSocket,
    role = "owner"
  ): () => void {
    const connection = { socket, role }
    const organizationConnections =
      this.connections.get(organizationId) ?? new Set<InboxSocket>()
    organizationConnections.add(connection)
    this.connections.set(organizationId, organizationConnections)

    return () => {
      organizationConnections.delete(connection)
      if (organizationConnections.size === 0) {
        this.connections.delete(organizationId)
      }
    }
  }

  publish(organizationId: string, event: InboxEvent): void {
    const payload = JSON.stringify(event)
    const adminOnly = adminOnlyEvents.has(event.type)
    for (const connection of this.connections.get(organizationId) ?? []) {
      if (adminOnly && !isChannelAdmin(connection.role)) continue
      if (connection.socket.readyState === connection.socket.OPEN) {
        connection.socket.send(payload)
      }
    }
  }
}

function isChannelAdmin(role: string): boolean {
  const roles = role.split(",").map((entry) => entry.trim())
  return roles.includes("owner") || roles.includes("admin")
}

export const supportInboxEventBroker = new SupportInboxEventBroker()
