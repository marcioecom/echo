import type { StatusUpdate } from "@workspace/messaging"

const SERVER_ACK = 2
const DELIVERY_ACK = 3
const READ = 4
const PLAYED = 5
const ERROR = 0

const statusByCode = {
  [SERVER_ACK]: "sent",
  [DELIVERY_ACK]: "delivered",
  [READ]: "read",
  [PLAYED]: "read",
  [ERROR]: "failed",
} as const

export function statusUpdatesFromBaileys(input: {
  organizationId: string
  channelConnectionId: string
  updates: Array<{
    key: { id?: string | null; fromMe?: boolean | null }
    status?: number | null
  }>
}): StatusUpdate[] {
  const updates: StatusUpdate[] = []
  for (const update of input.updates) {
    if (!update.key.fromMe || !update.key.id) continue
    if (update.status == null) continue
    const status = statusByCode[update.status as keyof typeof statusByCode]
    if (!status) continue
    updates.push({
      organizationId: input.organizationId,
      channelConnectionId: input.channelConnectionId,
      externalMessageId: update.key.id,
      status,
    })
  }
  return updates
}
