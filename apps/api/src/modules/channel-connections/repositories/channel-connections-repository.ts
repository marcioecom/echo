import type { Database } from "@workspace/db"
import {
  auditEvents,
  channelConnectionProviderBindings,
  channelConnections,
  organizations,
} from "@workspace/db/schema"
import { createId } from "@workspace/domain"
import { and, eq, ne, sql } from "drizzle-orm"

import type { EncryptedChannelCredentials } from "../adapters/channel-credentials-cipher"

export interface StoredTwilioBinding {
  organizationId: string
  channelConnectionId: string
  accountSid: string
  address: string
  encryptedCredentials: EncryptedChannelCredentials
}

export interface ChannelConnectionsRepository {
  isOrganizationActive: (organizationId: string) => Promise<boolean>
  saveVerifiedTwilioConnection: (input: {
    organizationId: string
    name: string
    address: string
    accountSid: string
    externalSenderId: string
    encryptCredentials: (
      channelConnectionId: string
    ) => EncryptedChannelCredentials
  }) => Promise<{ channelConnectionId: string }>
  recordValidationFailure: (input: {
    organizationId: string
    accountSid: string
    address: string
    reason: string
  }) => Promise<void>
  findActiveTwilioBinding: (input: {
    accountSid: string
    address: string
  }) => Promise<StoredTwilioBinding | null>
  recordInvalidSignature: (input: {
    organizationId: string
    channelConnectionId: string
  }) => Promise<void>
}

export function createChannelConnectionsRepository(
  db: Database
): ChannelConnectionsRepository {
  return {
    async isOrganizationActive(organizationId) {
      const [organization] = await db
        .select({ status: organizations.status })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1)

      return organization?.status === "active"
    },

    async saveVerifiedTwilioConnection(input) {
      return db.transaction(async (transaction) => {
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
    },

    async recordValidationFailure(input) {
      await db.insert(auditEvents).values({
        organizationId: input.organizationId,
        eventType: "channel_connection.validation_failed",
        actorType: "system",
        subjectType: "organization",
        subjectId: input.organizationId,
        data: {
          provider: "twilio",
          address: input.address,
          externalAccountId: input.accountSid,
          reason: input.reason,
        },
      })
    },

    async findActiveTwilioBinding(input) {
      const [binding] = await db
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

      if (!binding) {
        return null
      }

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
    },

    async recordInvalidSignature(input) {
      await db.insert(auditEvents).values({
        organizationId: input.organizationId,
        eventType: "channel_connection.webhook_signature_invalid",
        actorType: "system",
        subjectType: "channel_connection",
        subjectId: input.channelConnectionId,
        data: { provider: "twilio" },
      })
    },
  }
}
