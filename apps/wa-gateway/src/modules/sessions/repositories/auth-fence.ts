import type { Database } from "@workspace/db"
import {
  channelConnectionProviderBindings,
  channelConnections,
  channelSessionStates,
  organizations,
} from "@workspace/db/schema"
import { and, eq, inArray } from "drizzle-orm"

import type { AuthKeyScope } from "./auth-keys-repository"

const ELIGIBLE_CONNECTION_STATUSES = ["pending", "active"] as const

type DbExecutor = Pick<Database, "select">

export async function lockConnectionForAuthWrite(
  executor: DbExecutor,
  input: AuthKeyScope
): Promise<boolean> {
  const [connection] = await executor
    .select({ id: channelConnections.id })
    .from(channelConnections)
    .innerJoin(
      organizations,
      eq(organizations.id, channelConnections.organizationId)
    )
    .innerJoin(
      channelConnectionProviderBindings,
      and(
        eq(
          channelConnectionProviderBindings.organizationId,
          channelConnections.organizationId
        ),
        eq(
          channelConnectionProviderBindings.channelConnectionId,
          channelConnections.id
        )
      )
    )
    .where(
      and(
        eq(channelConnections.organizationId, input.organizationId),
        eq(channelConnections.id, input.channelConnectionId),
        eq(organizations.status, "active"),
        eq(channelConnectionProviderBindings.provider, "baileys"),
        inArray(channelConnections.status, [...ELIGIBLE_CONNECTION_STATUSES])
      )
    )
    .for("update", { of: channelConnections })

  if (!connection) return false

  const [session] = await executor
    .select({ ownerToken: channelSessionStates.ownerToken })
    .from(channelSessionStates)
    .where(
      and(
        eq(channelSessionStates.organizationId, input.organizationId),
        eq(channelSessionStates.channelConnectionId, input.channelConnectionId)
      )
    )
    .limit(1)

  return session?.ownerToken === input.ownerToken
}