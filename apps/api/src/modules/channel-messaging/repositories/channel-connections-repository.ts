import type { Database } from "@workspace/db"
import {
  auditEvents,
  baileysAuthKeys,
  channelConnectionProviderBindings,
  channelConnections,
  channelSessionStates,
  organizations,
} from "@workspace/db/schema"
import {
  createId,
  type ChannelConnectionStatus,
  type ChannelProvider,
  type ChannelSessionState,
  type ChannelType,
} from "@workspace/domain"
import { and, desc, eq, ne, sql } from "drizzle-orm"

import type { EncryptedChannelCredentials } from "../adapters/channel-credentials-cipher"
import { database } from "@/lib/db"

export class BaileysSessionExistsError extends Error {
  constructor() {
    super("A Baileys session is already open for this Organization")
    this.name = "BaileysSessionExistsError"
  }
}

export class ChannelRoutingConflictError extends Error {
  constructor() {
    super("Channel routing key is already in use")
    this.name = "ChannelRoutingConflictError"
  }
}

export class OrganizationNotActiveError extends Error {
  constructor() {
    super("Organization is not active")
    this.name = "OrganizationNotActiveError"
  }
}

export interface ListedChannelConnection {
  id: string
  channelType: ChannelType
  provider: ChannelProvider
  name: string
  displayName: string | null
  address: string | null
  status: ChannelConnectionStatus
  inboxId: string | null
  updatedAt: Date
  session: {
    state: ChannelSessionState
    lastError: string | null
    lastConnectedAt: Date | null
    lastSeenAt: Date | null
  } | null
}

export interface StoredTwilioBinding {
  organizationId: string
  channelConnectionId: string
  accountSid: string
  address: string
  encryptedCredentials: EncryptedChannelCredentials
}

export class ChannelConnectionsRepository {
  constructor(private readonly db: Database = database.db) {}

  async isOrganizationActive(organizationId: string): Promise<boolean> {
    const [organization] = await this.db
      .select({ status: organizations.status })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)

    return organization?.status === "active"
  }

  async saveVerifiedTwilioConnection(input: {
    organizationId: string
    name: string
    address: string
    accountSid: string
    externalSenderId: string
    encryptCredentials: (
      channelConnectionId: string
    ) => EncryptedChannelCredentials
  }): Promise<{ channelConnectionId: string }> {
    return this.db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`channel-connection-provision:${input.organizationId}:whatsapp`}, 0))`
      )
      const [organization] = await transaction
        .select({ status: organizations.status })
        .from(organizations)
        .where(eq(organizations.id, input.organizationId))
        .limit(1)
        .for("update")
      if (organization?.status !== "active") {
        throw new Error("Organization is not active")
      }

      const [existingConnection] = await transaction
        .select({ id: channelConnections.id })
        .from(channelConnections)
        .where(
          and(
            eq(channelConnections.organizationId, input.organizationId),
            eq(channelConnections.channelType, "whatsapp"),
            eq(channelConnections.address, input.address)
          )
        )
        .limit(1)

      const channelConnectionId = existingConnection?.id ?? createId()
      const encrypted = input.encryptCredentials(channelConnectionId)

      const disabledConnections = await transaction
        .update(channelConnections)
        .set({ status: "disabled" })
        .where(
          and(
            eq(channelConnections.organizationId, input.organizationId),
            eq(channelConnections.channelType, "whatsapp"),
            eq(channelConnections.status, "active"),
            ne(channelConnections.address, input.address)
          )
        )
        .returning({ id: channelConnections.id })

      if (disabledConnections.length > 0) {
        await transaction.insert(auditEvents).values(
          disabledConnections.map((connection) => ({
            organizationId: input.organizationId,
            eventType: "channel_connection.disabled",
            actorType: "system" as const,
            subjectType: "channel_connection",
            subjectId: connection.id,
            data: { provider: "twilio", reason: "replacement" },
          }))
        )
      }

      if (existingConnection) {
        await transaction
          .update(channelConnections)
          .set({ name: input.name, status: "active" })
          .where(
            and(
              eq(channelConnections.organizationId, input.organizationId),
              eq(channelConnections.id, channelConnectionId)
            )
          )
      } else {
        await transaction.insert(channelConnections).values({
          id: channelConnectionId,
          organizationId: input.organizationId,
          channelType: "whatsapp",
          name: input.name,
          address: input.address,
          status: "active",
        })
      }

      await transaction
        .insert(channelConnectionProviderBindings)
        .values({
          organizationId: input.organizationId,
          channelConnectionId,
          provider: "twilio",
          externalAccountId: input.accountSid,
          externalSenderId: input.externalSenderId,
          routingAddress: input.address,
          credentialsCiphertext: encrypted.ciphertext,
          credentialsNonce: encrypted.nonce,
          credentialsAuthTag: encrypted.authTag,
          credentialsKeyVersion: encrypted.keyVersion,
        })
        .onConflictDoUpdate({
          target: [
            channelConnectionProviderBindings.organizationId,
            channelConnectionProviderBindings.channelConnectionId,
          ],
          set: {
            provider: "twilio",
            externalAccountId: input.accountSid,
            externalSenderId: input.externalSenderId,
            routingAddress: input.address,
            credentialsCiphertext: encrypted.ciphertext,
            credentialsNonce: encrypted.nonce,
            credentialsAuthTag: encrypted.authTag,
            credentialsKeyVersion: encrypted.keyVersion,
            updatedAt: new Date(),
          },
        })

      await transaction.insert(auditEvents).values({
        organizationId: input.organizationId,
        eventType: existingConnection
          ? "channel_connection.credentials_replaced"
          : "channel_connection.activated",
        actorType: "system",
        subjectType: "channel_connection",
        subjectId: channelConnectionId,
        data: {
          provider: "twilio",
          address: input.address,
          externalAccountId: input.accountSid,
          externalSenderId: input.externalSenderId,
        },
      })

      return { channelConnectionId }
    })
  }

  async recordValidationFailure(input: {
    organizationId: string
    accountSid: string
    address: string
    reason: string
    operatorUserId?: string
  }): Promise<void> {
    await this.db.insert(auditEvents).values({
      organizationId: input.organizationId,
      eventType: "channel_connection.validation_failed",
      actorType: input.operatorUserId ? "operator" : "system",
      operatorUserId: input.operatorUserId ?? null,
      subjectType: "organization",
      subjectId: input.organizationId,
      data: {
        provider: "twilio",
        address: input.address,
        externalAccountId: input.accountSid,
        reason: input.reason,
      },
    })
  }

  async listForOrganization(
    organizationId: string
  ): Promise<ListedChannelConnection[]> {
    const rows = await this.listedQuery()
      .where(eq(channelConnections.organizationId, organizationId))
      .orderBy(desc(channelConnections.createdAt))
    return rows.map(toListedChannelConnection)
  }

  async findForOrganization(
    organizationId: string,
    channelConnectionId: string
  ): Promise<ListedChannelConnection | null> {
    const [row] = await this.listedQuery()
      .where(
        and(
          eq(channelConnections.organizationId, organizationId),
          eq(channelConnections.id, channelConnectionId)
        )
      )
      .limit(1)
    return row ? toListedChannelConnection(row) : null
  }

  async saveManagedTwilioConnection(input: {
    organizationId: string
    operatorUserId: string
    displayName: string
    inboxId: string | null
    address: string
    accountSid: string
    externalSenderId: string
    encryptCredentials: (
      channelConnectionId: string
    ) => EncryptedChannelCredentials
  }): Promise<{ channelConnectionId: string }> {
    try {
      return await this.db.transaction(async (transaction) => {
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`channel-connection-provision:${input.organizationId}:whatsapp`}, 0))`
        )
        const [organization] = await transaction
          .select({ status: organizations.status })
          .from(organizations)
          .where(eq(organizations.id, input.organizationId))
          .limit(1)
          .for("update")
        if (organization?.status !== "active") {
          throw new OrganizationNotActiveError()
        }

        const [existingConnection] = await transaction
          .select({ id: channelConnections.id })
          .from(channelConnections)
          .where(
            and(
              eq(channelConnections.organizationId, input.organizationId),
              eq(channelConnections.channelType, "whatsapp"),
              eq(channelConnections.address, input.address)
            )
          )
          .limit(1)

        const channelConnectionId = existingConnection?.id ?? createId()
        const encrypted = input.encryptCredentials(channelConnectionId)

        if (existingConnection) {
          await transaction
            .update(channelConnections)
            .set({
              name: input.displayName,
              displayName: input.displayName,
              inboxId: input.inboxId,
              status: "active",
            })
            .where(
              and(
                eq(channelConnections.organizationId, input.organizationId),
                eq(channelConnections.id, channelConnectionId)
              )
            )
        } else {
          await transaction.insert(channelConnections).values({
            id: channelConnectionId,
            organizationId: input.organizationId,
            channelType: "whatsapp",
            name: input.displayName,
            displayName: input.displayName,
            inboxId: input.inboxId,
            address: input.address,
            status: "active",
          })
        }

        await transaction
          .insert(channelConnectionProviderBindings)
          .values({
            organizationId: input.organizationId,
            channelConnectionId,
            provider: "twilio",
            externalAccountId: input.accountSid,
            externalSenderId: input.externalSenderId,
            routingAddress: input.address,
            credentialsCiphertext: encrypted.ciphertext,
            credentialsNonce: encrypted.nonce,
            credentialsAuthTag: encrypted.authTag,
            credentialsKeyVersion: encrypted.keyVersion,
          })
          .onConflictDoUpdate({
            target: [
              channelConnectionProviderBindings.organizationId,
              channelConnectionProviderBindings.channelConnectionId,
            ],
            set: {
              provider: "twilio",
              externalAccountId: input.accountSid,
              externalSenderId: input.externalSenderId,
              routingAddress: input.address,
              credentialsCiphertext: encrypted.ciphertext,
              credentialsNonce: encrypted.nonce,
              credentialsAuthTag: encrypted.authTag,
              credentialsKeyVersion: encrypted.keyVersion,
              updatedAt: new Date(),
            },
          })

        await transaction.insert(auditEvents).values({
          organizationId: input.organizationId,
          eventType: existingConnection
            ? "channel_connection.credentials_replaced"
            : "channel_connection.activated",
          actorType: "operator",
          operatorUserId: input.operatorUserId,
          subjectType: "channel_connection",
          subjectId: channelConnectionId,
          data: {
            provider: "twilio",
            address: input.address,
            externalAccountId: input.accountSid,
            externalSenderId: input.externalSenderId,
            displayName: input.displayName,
            inboxId: input.inboxId,
          },
        })

        return { channelConnectionId }
      })
    } catch (error) {
      if (error instanceof OrganizationNotActiveError) throw error
      if (postgresErrorCode(error) === "23505") {
        throw new ChannelRoutingConflictError()
      }
      throw error
    }
  }

  async savePendingBaileysConnection(input: {
    organizationId: string
    operatorUserId: string
    displayName: string
    inboxId: string | null
    encryptCredentials: (
      channelConnectionId: string
    ) => EncryptedChannelCredentials
  }): Promise<{ channelConnectionId: string }> {
    try {
      return await this.db.transaction(async (transaction) => {
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`channel-connection-provision:${input.organizationId}:baileys`}, 0))`
        )
        const [organization] = await transaction
          .select({ status: organizations.status })
          .from(organizations)
          .where(eq(organizations.id, input.organizationId))
          .limit(1)
          .for("update")
        if (organization?.status !== "active") {
          throw new OrganizationNotActiveError()
        }

        const [existing] = await transaction
          .select({ id: channelConnections.id })
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
          .where(
            and(
              eq(channelConnections.organizationId, input.organizationId),
              eq(channelConnectionProviderBindings.provider, "baileys"),
              ne(channelConnections.status, "disabled")
            )
          )
          .limit(1)
        if (existing) throw new BaileysSessionExistsError()

        const channelConnectionId = createId()
        const pendingAddress = `pending:${channelConnectionId}`
        const encrypted = input.encryptCredentials(channelConnectionId)
        await transaction.insert(channelConnections).values({
          id: channelConnectionId,
          organizationId: input.organizationId,
          channelType: "whatsapp",
          name: input.displayName,
          displayName: input.displayName,
          inboxId: input.inboxId,
          status: "pending",
        })
        await transaction.insert(channelConnectionProviderBindings).values({
          organizationId: input.organizationId,
          channelConnectionId,
          provider: "baileys",
          externalAccountId: pendingAddress,
          externalSenderId: pendingAddress,
          routingAddress: pendingAddress,
          credentialsCiphertext: encrypted.ciphertext,
          credentialsNonce: encrypted.nonce,
          credentialsAuthTag: encrypted.authTag,
          credentialsKeyVersion: encrypted.keyVersion,
        })
        await transaction.insert(channelSessionStates).values({
          organizationId: input.organizationId,
          channelConnectionId,
          state: "connecting",
        })
        await transaction.insert(auditEvents).values({
          organizationId: input.organizationId,
          eventType: "channel_connection.pairing_requested",
          actorType: "operator",
          operatorUserId: input.operatorUserId,
          subjectType: "channel_connection",
          subjectId: channelConnectionId,
          data: {
            provider: "baileys",
            displayName: input.displayName,
            inboxId: input.inboxId,
          },
        })
        return { channelConnectionId }
      })
    } catch (error) {
      if (
        error instanceof OrganizationNotActiveError ||
        error instanceof BaileysSessionExistsError
      ) {
        throw error
      }
      if (postgresErrorCode(error) === "23505") {
        throw new ChannelRoutingConflictError()
      }
      throw error
    }
  }

  async updateChannelConnection(input: {
    organizationId: string
    channelConnectionId: string
    operatorUserId: string
    displayName?: string
    inboxId?: string | null
    status?: "active" | "disabled"
  }): Promise<
    | "updated"
    | "not_found"
    | "missing_address"
    | "pairing_required"
    | "organization_unavailable"
  > {
    if (!(await this.isOrganizationActive(input.organizationId))) {
      return "organization_unavailable"
    }

    return this.db.transaction(async (transaction) => {
      const [connection] = await transaction
        .select({
          id: channelConnections.id,
          address: channelConnections.address,
        })
        .from(channelConnections)
        .where(
          and(
            eq(channelConnections.organizationId, input.organizationId),
            eq(channelConnections.id, input.channelConnectionId)
          )
        )
        .limit(1)
        .for("update")
      if (!connection) return "not_found"
      if (input.status === "active" && !connection.address) {
        return "missing_address"
      }
      if (
        input.status === "active" &&
        (await this.baileysNeedsPairing(
          transaction,
          input.organizationId,
          input.channelConnectionId
        ))
      ) {
        return "pairing_required"
      }

      const changes: {
        name?: string
        displayName?: string
        inboxId?: string | null
        status?: "active" | "disabled"
      } = {}
      if (input.displayName !== undefined) {
        changes.name = input.displayName
        changes.displayName = input.displayName
      }
      if (input.inboxId !== undefined) changes.inboxId = input.inboxId
      if (input.status !== undefined) changes.status = input.status

      await transaction
        .update(channelConnections)
        .set(changes)
        .where(
          and(
            eq(channelConnections.organizationId, input.organizationId),
            eq(channelConnections.id, input.channelConnectionId)
          )
        )
      if (input.status === "disabled") {
        await this.revokeBaileysSession(
          transaction,
          input.organizationId,
          input.channelConnectionId
        )
      }

      await transaction.insert(auditEvents).values({
        organizationId: input.organizationId,
        eventType:
          input.status === "disabled"
            ? "channel_connection.disabled"
            : input.status === "active"
              ? "channel_connection.activated"
              : "channel_connection.updated",
        actorType: "operator",
        operatorUserId: input.operatorUserId,
        subjectType: "channel_connection",
        subjectId: input.channelConnectionId,
        data: {
          displayName: input.displayName ?? null,
          inboxId: input.inboxId === undefined ? null : input.inboxId,
          status: input.status ?? null,
        },
      })

      return "updated"
    })
  }

  async disableChannelConnection(input: {
    organizationId: string
    channelConnectionId: string
    operatorUserId: string
  }): Promise<"disabled" | "not_found" | "organization_unavailable"> {
    if (!(await this.isOrganizationActive(input.organizationId))) {
      return "organization_unavailable"
    }

    return this.db.transaction(async (transaction) => {
      const [connection] = await transaction
        .select({
          id: channelConnections.id,
          status: channelConnections.status,
        })
        .from(channelConnections)
        .where(
          and(
            eq(channelConnections.organizationId, input.organizationId),
            eq(channelConnections.id, input.channelConnectionId)
          )
        )
        .limit(1)
        .for("update")
      if (!connection) return "not_found"
      if (connection.status === "disabled") return "disabled"

      await transaction
        .update(channelConnections)
        .set({ status: "disabled" })
        .where(
          and(
            eq(channelConnections.organizationId, input.organizationId),
            eq(channelConnections.id, input.channelConnectionId)
          )
        )
      await this.revokeBaileysSession(
        transaction,
        input.organizationId,
        input.channelConnectionId
      )
      await transaction.insert(auditEvents).values({
        organizationId: input.organizationId,
        eventType: "channel_connection.removed",
        actorType: "operator",
        operatorUserId: input.operatorUserId,
        subjectType: "channel_connection",
        subjectId: input.channelConnectionId,
        data: { status: "disabled" },
      })
      return "disabled"
    })
  }

  private listedQuery() {
    return this.db
      .select({
        id: channelConnections.id,
        channelType: channelConnections.channelType,
        provider: channelConnectionProviderBindings.provider,
        name: channelConnections.name,
        displayName: channelConnections.displayName,
        address: channelConnections.address,
        status: channelConnections.status,
        inboxId: channelConnections.inboxId,
        updatedAt: channelConnections.updatedAt,
        sessionState: channelSessionStates.state,
        lastError: channelSessionStates.lastError,
        lastConnectedAt: channelSessionStates.lastConnectedAt,
        lastSeenAt: channelSessionStates.lastSeenAt,
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
      .leftJoin(
        channelSessionStates,
        and(
          eq(
            channelSessionStates.organizationId,
            channelConnections.organizationId
          ),
          eq(channelSessionStates.channelConnectionId, channelConnections.id)
        )
      )
  }

  async findActiveTwilioBinding(input: {
    accountSid: string
    address: string
  }): Promise<StoredTwilioBinding | null> {
    const [binding] = await this.db
      .select({
        organizationId: channelConnectionProviderBindings.organizationId,
        channelConnectionId:
          channelConnectionProviderBindings.channelConnectionId,
        accountSid: channelConnectionProviderBindings.externalAccountId,
        address: channelConnectionProviderBindings.routingAddress,
        ciphertext: channelConnectionProviderBindings.credentialsCiphertext,
        nonce: channelConnectionProviderBindings.credentialsNonce,
        authTag: channelConnectionProviderBindings.credentialsAuthTag,
        keyVersion: channelConnectionProviderBindings.credentialsKeyVersion,
      })
      .from(channelConnectionProviderBindings)
      .innerJoin(
        channelConnections,
        and(
          eq(
            channelConnections.organizationId,
            channelConnectionProviderBindings.organizationId
          ),
          eq(
            channelConnections.id,
            channelConnectionProviderBindings.channelConnectionId
          )
        )
      )
      .innerJoin(
        organizations,
        eq(organizations.id, channelConnectionProviderBindings.organizationId)
      )
      .where(
        and(
          eq(channelConnectionProviderBindings.provider, "twilio"),
          eq(
            channelConnectionProviderBindings.externalAccountId,
            input.accountSid
          ),
          eq(channelConnectionProviderBindings.routingAddress, input.address),
          eq(channelConnections.channelType, "whatsapp"),
          eq(channelConnections.status, "active"),
          eq(organizations.status, "active")
        )
      )
      .limit(1)

    if (!binding) return null

    return {
      organizationId: binding.organizationId,
      channelConnectionId: binding.channelConnectionId,
      accountSid: binding.accountSid,
      address: binding.address,
      encryptedCredentials: {
        ciphertext: binding.ciphertext,
        nonce: binding.nonce,
        authTag: binding.authTag,
        keyVersion: binding.keyVersion,
      },
    }
  }

  async recordInvalidSignature(input: {
    organizationId: string
    channelConnectionId: string
  }): Promise<void> {
    await this.db.insert(auditEvents).values({
      organizationId: input.organizationId,
      eventType: "channel_connection.webhook_signature_invalid",
      actorType: "system",
      subjectType: "channel_connection",
      subjectId: input.channelConnectionId,
      data: { provider: "twilio" },
    })
  }

  private async baileysNeedsPairing(
    transaction: DbTransaction,
    organizationId: string,
    channelConnectionId: string
  ): Promise<boolean> {
    const [binding] = await transaction
      .select({ provider: channelConnectionProviderBindings.provider })
      .from(channelConnectionProviderBindings)
      .where(
        and(
          eq(channelConnectionProviderBindings.organizationId, organizationId),
          eq(
            channelConnectionProviderBindings.channelConnectionId,
            channelConnectionId
          )
        )
      )
      .limit(1)
    if (binding?.provider !== "baileys") return false

    const [session] = await transaction
      .select({ state: channelSessionStates.state })
      .from(channelSessionStates)
      .where(
        and(
          eq(channelSessionStates.organizationId, organizationId),
          eq(channelSessionStates.channelConnectionId, channelConnectionId)
        )
      )
      .limit(1)

    return !session || session.state === "logged_out"
  }

  private async revokeBaileysSession(
    transaction: DbTransaction,
    organizationId: string,
    channelConnectionId: string
  ): Promise<void> {
    await transaction
      .delete(baileysAuthKeys)
      .where(
        and(
          eq(baileysAuthKeys.organizationId, organizationId),
          eq(baileysAuthKeys.channelConnectionId, channelConnectionId)
        )
      )
    await transaction
      .update(channelSessionStates)
      .set({ state: "logged_out" })
      .where(
        and(
          eq(channelSessionStates.organizationId, organizationId),
          eq(channelSessionStates.channelConnectionId, channelConnectionId)
        )
      )
  }
}

export const channelConnectionsRepository = new ChannelConnectionsRepository()

function toListedChannelConnection(row: {
  id: string
  channelType: ChannelType
  provider: ChannelProvider
  name: string
  displayName: string | null
  address: string | null
  status: ChannelConnectionStatus
  inboxId: string | null
  updatedAt: Date
  sessionState: ChannelSessionState | null
  lastError: string | null
  lastConnectedAt: Date | null
  lastSeenAt: Date | null
}): ListedChannelConnection {
  return {
    id: row.id,
    channelType: row.channelType,
    provider: row.provider,
    name: row.name,
    displayName: row.displayName,
    address: row.address,
    status: row.status,
    inboxId: row.inboxId,
    updatedAt: row.updatedAt,
    session:
      row.sessionState === null
        ? null
        : {
            state: row.sessionState,
            lastError: row.lastError,
            lastConnectedAt: row.lastConnectedAt,
            lastSeenAt: row.lastSeenAt,
          },
  }
}

type DbTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0]

function postgresErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined
  if ("code" in error && typeof error.code === "string") return error.code
  if ("cause" in error) return postgresErrorCode(error.cause)
  return undefined
}
