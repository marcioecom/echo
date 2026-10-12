import { toChannelConnectionView } from "../channel-connection-view"
import { channelConnectionsRepository } from "../repositories/channel-connections-repository"

export async function listChannelConnections(organizationId: string) {
  const connections =
    await channelConnectionsRepository.listForOrganization(organizationId)
  return { items: connections.map(toChannelConnectionView) }
}
