import type { Database } from "@workspace/db"
import {
  channelConnectionProviderBindings,
  channelConnections,
  channelSessionStates,
} from "@workspace/db/schema"
import type { ChannelSessionState } from "@workspace/domain"
import { and, asc, eq, inArray } from "drizzle-orm"

import { database } from "@/lib/db"

import { RoutingConflictError } from "../errors"
import type { ConnectionRef } from "../types"

export interface SessionDirectory {
  setState(
    input: ConnectionRef & {
      state: ChannelSessionState
      lastError: string | null
      reconnectAttempts?: number
      connected?: boolean
      ownerPod?: string | null
    }
  ): Promise<void>
  markConnected(
    input: ConnectionRef & {
      address: string
      userJid: string
      ownerPod?: string | null
    }
  ): Promise<void>
  listClaimable(): Promise<ConnectionRef[]>
  setOwner(input: ConnectionRef & { ownerPod: string | null }): Promise<void>
}

export class PostgresSessionDirectory implements SessionDirectory {
  constructor(private readonly db: Database = database.db) {}

  async setState(
    input: ConnectionRef & {
      state: ChannelSessionState
      lastError: string | null
      reconnectAttempts?: number
      connected?: boolean
      ownerPod?: string | null
    }
  ): Promise<void> {
    const now = new Date()
    await this.db
      .insert(channelSessionStates)
      .values({
        organizationId: input.organizationId,
        channelConnectionId: input.channelConnectionId,
        state: input.state,
        lastError: input.lastError,
        lastConnectedAt: input.connected ? now : null,
        lastSeenAt: now,
        ownerPod: input.ownerPod ?? null,
        reconnectAttempts: input.reconnectAttempts ?? 0,
      })
      .onConflictDoUpdate({
        target: [
          channelSessionStates.organizationId,
          channelSessionStates.channelConnectionId,
        ],
        set: {
          state: input.state,
          lastError: input.lastError,
          lastSeenAt: now,
          ...(input.connected
            ? { lastConnectedAt: now, reconnectAttempts: 0 }
            : {}),
          ...(input.reconnectAttempts !== undefined
            ? { reconnectAttempts: input.reconnectAttempts }
            : {}),
          ...(input.ownerPod !== undefined ? { ownerPod: input.ownerPod } : {}),
        },
      })
  }

  async markConnected(
    input: ConnectionRef & {
      address: string
      userJid: string
      ownerPod?: string | null
    }
  ): Promise<void> {
    try {
      await this.db.transaction(async (transaction) => {
        await transaction
          .update(channelConnections)
          .set({ address: input.address, status: "active" })
          .where(
            and(
              eq(channelConnections.organizationId, input.organizationId),
              eq(channelConnections.id, input.channelConnectionId)
            )
          )
        await transaction
          .update(channelConnectionProviderBindings)
          .set({
            routingAddress: input.address,
            externalAccountId: input.address,
            externalSenderId: input.userJid,
          })
          .where(
            and(
              eq(
                channelConnectionProviderBindings.organizationId,
                input.organizationId
              ),
              eq(
                channelConnectionProviderBindings.channelConnectionId,
                input.channelConnectionId
              )
            )
          )
        const now = new Date()
        await transaction
          .update(channelSessionStates)
          .set({
            state: "connected",
            lastError: null,
            lastConnectedAt: now,
            lastSeenAt: now,
            reconnectAttempts: 0,
            ownerPod: input.ownerPod ?? null,
          })
          .where(
            and(
              eq(channelSessionStates.organizationId, input.organizationId),
              eq(
                channelSessionStates.channelConnectionId,
                input.channelConnectionId
              )
            )
          )
      })
    } catch (error) {
      if (postgresErrorCode(error) === "23505") throw new RoutingConflictError()
      throw error
    }
  }

  async listClaimable(): Promise<ConnectionRef[]> {
    return this.db
      .select({
        organizationId: channelConnections.organizationId,
        channelConnectionId: channelConnections.id,
      })
      .from(channelConnections)
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
      .innerJoin(
        channelSessionStates,
        and(
          eq(
            channelSessionStates.organizationId,
            channelConnections.organizationId
          ),
          eq(channelSessionStates.channelConnectionId, channelConnections.id)
        )
      )
      .where(
        and(
          eq(channelConnectionProviderBindings.provider, "baileys"),
          inArray(channelConnections.status, ["pending", "active"]),
          inArray(channelSessionStates.state, [
            "connected",
            "connecting",
            "qr_pending",
            "pairing_code_pending",
          ])
        )
      )
      .orderBy(asc(channelSessionStates.updatedAt), asc(channelConnections.id))
  }

  async setOwner(
    input: ConnectionRef & { ownerPod: string | null }
  ): Promise<void> {
    await this.db
      .update(channelSessionStates)
      .set({ ownerPod: input.ownerPod, lastSeenAt: new Date() })
      .where(
        and(
          eq(channelSessionStates.organizationId, input.organizationId),
          eq(
            channelSessionStates.channelConnectionId,
            input.channelConnectionId
          )
        )
      )
  }
}

function postgresErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error))
    return undefined
  return typeof error.code === "string" ? error.code : undefined
}
