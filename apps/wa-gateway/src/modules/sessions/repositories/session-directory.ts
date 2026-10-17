import type { Database } from "@workspace/db"
import {
  channelConnectionProviderBindings,
  channelConnections,
  channelSessionStates,
  organizations,
} from "@workspace/db/schema"
import type { ChannelSessionState } from "@workspace/domain"
import { and, asc, eq, inArray } from "drizzle-orm"

import { database } from "@/lib/db"

import { RoutingConflictError } from "../errors"
import type { ConnectionRef } from "../types"

const RESUMABLE_SESSION_STATES: ChannelSessionState[] = [
  "connecting",
  "qr_pending",
  "pairing_code_pending",
  "connected",
]

const ELIGIBLE_CONNECTION_STATUSES = ["pending", "active"] as const

export interface SessionDirectory {
  findResumable(): Promise<ConnectionRef[]>
  claim(
    input: ConnectionRef & { ownerToken: string; ownerPod: string }
  ): Promise<boolean>
  isOwner(input: ConnectionRef & { ownerToken: string }): Promise<boolean>
  release(input: ConnectionRef & { ownerToken: string }): Promise<boolean>
  setState(
    input: ConnectionRef & {
      ownerToken: string
      state: ChannelSessionState
      lastError: string | null
      reconnectAttempts?: number
      connected?: boolean
      ownerPod?: string | null
    }
  ): Promise<boolean>
  markConnected(
    input: ConnectionRef & {
      ownerToken: string
      address: string
      userJid: string
      ownerPod?: string | null
    }
  ): Promise<boolean>
}

export class PostgresSessionDirectory implements SessionDirectory {
  constructor(private readonly db: Database = database.db) {}

  async findResumable(): Promise<ConnectionRef[]> {
    return this.db
      .select({
        organizationId: channelConnections.organizationId,
        channelConnectionId: channelConnections.id,
      })
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
          eq(organizations.status, "active"),
          eq(channelConnectionProviderBindings.provider, "baileys"),
          inArray(channelConnections.status, [...ELIGIBLE_CONNECTION_STATUSES]),
          inArray(channelSessionStates.state, RESUMABLE_SESSION_STATES)
        )
      )
      .orderBy(asc(channelConnections.id))
  }

  async claim(
    input: ConnectionRef & { ownerToken: string; ownerPod: string }
  ): Promise<boolean> {
    return this.db.transaction(async (transaction) => {
      const locked = await lockEligibleBaileysConnection(transaction, input)
      if (!locked) return false

      const updated = await transaction
        .update(channelSessionStates)
        .set({
          ownerToken: input.ownerToken,
          ownerPod: input.ownerPod,
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
        .returning({ id: channelSessionStates.id })

      return updated.length === 1
    })
  }

  async isOwner(
    input: ConnectionRef & { ownerToken: string }
  ): Promise<boolean> {
    const [row] = await this.db
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
          eq(channelConnections.organizationId, input.organizationId),
          eq(channelConnections.id, input.channelConnectionId),
          eq(organizations.status, "active"),
          eq(channelConnectionProviderBindings.provider, "baileys"),
          inArray(channelConnections.status, [...ELIGIBLE_CONNECTION_STATUSES]),
          eq(channelSessionStates.ownerToken, input.ownerToken)
        )
      )
      .limit(1)
    return row !== undefined
  }

  async release(
    input: ConnectionRef & { ownerToken: string }
  ): Promise<boolean> {
    return this.db.transaction(async (transaction) => {
      const locked = await lockEligibleBaileysConnection(transaction, input)
      if (!locked) return false

      const updated = await transaction
        .update(channelSessionStates)
        .set({ ownerToken: null, ownerPod: null })
        .where(
          and(
            eq(channelSessionStates.organizationId, input.organizationId),
            eq(
              channelSessionStates.channelConnectionId,
              input.channelConnectionId
            ),
            eq(channelSessionStates.ownerToken, input.ownerToken)
          )
        )
        .returning({ id: channelSessionStates.id })

      return updated.length === 1
    })
  }

  async setState(
    input: ConnectionRef & {
      ownerToken: string
      state: ChannelSessionState
      lastError: string | null
      reconnectAttempts?: number
      connected?: boolean
      ownerPod?: string | null
    }
  ): Promise<boolean> {
    const now = new Date()
    return this.db.transaction(async (transaction) => {
      const locked = await lockEligibleBaileysConnection(transaction, input)
      if (!locked) return false

      const updated = await transaction
        .update(channelSessionStates)
        .set({
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
        })
        .where(
          and(
            eq(channelSessionStates.organizationId, input.organizationId),
            eq(
              channelSessionStates.channelConnectionId,
              input.channelConnectionId
            ),
            eq(channelSessionStates.ownerToken, input.ownerToken)
          )
        )
        .returning({ id: channelSessionStates.id })

      return updated.length === 1
    })
  }

  async markConnected(
    input: ConnectionRef & {
      ownerToken: string
      address: string
      userJid: string
      ownerPod?: string | null
    }
  ): Promise<boolean> {
    try {
      return await this.db.transaction(async (transaction) => {
        const locked = await lockEligibleBaileysConnection(transaction, input)
        if (!locked) return false

        const [owned] = await transaction
          .select({ id: channelSessionStates.id })
          .from(channelSessionStates)
          .where(
            and(
              eq(channelSessionStates.organizationId, input.organizationId),
              eq(
                channelSessionStates.channelConnectionId,
                input.channelConnectionId
              ),
              eq(channelSessionStates.ownerToken, input.ownerToken)
            )
          )
          .limit(1)
        if (!owned) return false

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
        const updated = await transaction
          .update(channelSessionStates)
          .set({
            state: "connected",
            lastError: null,
            lastConnectedAt: now,
            lastSeenAt: now,
            reconnectAttempts: 0,
            ...(input.ownerPod !== undefined
              ? { ownerPod: input.ownerPod }
              : {}),
          })
          .where(
            and(
              eq(channelSessionStates.organizationId, input.organizationId),
              eq(
                channelSessionStates.channelConnectionId,
                input.channelConnectionId
              ),
              eq(channelSessionStates.ownerToken, input.ownerToken)
            )
          )
          .returning({ id: channelSessionStates.id })

        return updated.length === 1
      })
    } catch (error) {
      if (postgresErrorCode(error) === "23505") throw new RoutingConflictError()
      throw error
    }
  }
}

type DbTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0]

async function lockEligibleBaileysConnection(
  transaction: DbTransaction,
  ref: ConnectionRef
): Promise<boolean> {
  const [row] = await transaction
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
        eq(channelConnections.organizationId, ref.organizationId),
        eq(channelConnections.id, ref.channelConnectionId),
        eq(organizations.status, "active"),
        eq(channelConnectionProviderBindings.provider, "baileys"),
        inArray(channelConnections.status, [...ELIGIBLE_CONNECTION_STATUSES])
      )
    )
    .for("update", { of: channelConnections })

  return row !== undefined
}

function postgresErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined
  if ("code" in error && typeof error.code === "string") return error.code
  if ("cause" in error) return postgresErrorCode(error.cause)
  return undefined
}
