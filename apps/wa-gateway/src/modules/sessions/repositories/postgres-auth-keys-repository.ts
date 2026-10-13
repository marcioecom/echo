import type { Database } from "@workspace/db"
import { baileysAuthKeys } from "@workspace/db/schema"
import { createId } from "@workspace/domain"
import { and, eq, sql } from "drizzle-orm"

import { database } from "@/lib/db"

import type {
  AuthKeyScope,
  AuthKeysRepository,
  StoredAuthKey,
} from "./auth-keys-repository"

export class PostgresAuthKeysRepository implements AuthKeysRepository {
  constructor(private readonly db: Database = database.db) {}

  async read(
    input: AuthKeyScope & { keyType: string; keyId: string }
  ): Promise<StoredAuthKey | null> {
    const [row] = await this.db
      .select({
        keyType: baileysAuthKeys.keyType,
        keyId: baileysAuthKeys.keyId,
        ciphertext: baileysAuthKeys.ciphertext,
        nonce: baileysAuthKeys.nonce,
        authTag: baileysAuthKeys.authTag,
        keyVersion: baileysAuthKeys.keyVersion,
      })
      .from(baileysAuthKeys)
      .where(
        and(
          eq(baileysAuthKeys.organizationId, input.organizationId),
          eq(baileysAuthKeys.channelConnectionId, input.channelConnectionId),
          eq(baileysAuthKeys.keyType, input.keyType),
          eq(baileysAuthKeys.keyId, input.keyId)
        )
      )
      .limit(1)
    return row ?? null
  }

  async write(
    input: AuthKeyScope & {
      upserts: StoredAuthKey[]
      deletes: Array<{ keyType: string; keyId: string }>
    }
  ): Promise<void> {
    if (input.upserts.length === 0 && input.deletes.length === 0) return

    await this.db.transaction(async (transaction) => {
      for (const key of input.deletes) {
        await transaction
          .delete(baileysAuthKeys)
          .where(
            and(
              eq(baileysAuthKeys.organizationId, input.organizationId),
              eq(
                baileysAuthKeys.channelConnectionId,
                input.channelConnectionId
              ),
              eq(baileysAuthKeys.keyType, key.keyType),
              eq(baileysAuthKeys.keyId, key.keyId)
            )
          )
      }

      if (input.upserts.length === 0) return

      await transaction
        .insert(baileysAuthKeys)
        .values(
          input.upserts.map((row) => ({
            id: createId(),
            organizationId: input.organizationId,
            channelConnectionId: input.channelConnectionId,
            keyType: row.keyType,
            keyId: row.keyId,
            ciphertext: row.ciphertext,
            nonce: row.nonce,
            authTag: row.authTag,
            keyVersion: row.keyVersion,
          }))
        )
        .onConflictDoUpdate({
          target: [
            baileysAuthKeys.organizationId,
            baileysAuthKeys.channelConnectionId,
            baileysAuthKeys.keyType,
            baileysAuthKeys.keyId,
          ],
          set: {
            ciphertext: sql`excluded.ciphertext`,
            nonce: sql`excluded.nonce`,
            authTag: sql`excluded.auth_tag`,
            keyVersion: sql`excluded.key_version`,
            updatedAt: new Date(),
          },
        })
    })
  }

  async list(input: AuthKeyScope): Promise<StoredAuthKey[]> {
    return this.db
      .select({
        keyType: baileysAuthKeys.keyType,
        keyId: baileysAuthKeys.keyId,
        ciphertext: baileysAuthKeys.ciphertext,
        nonce: baileysAuthKeys.nonce,
        authTag: baileysAuthKeys.authTag,
        keyVersion: baileysAuthKeys.keyVersion,
      })
      .from(baileysAuthKeys)
      .where(
        and(
          eq(baileysAuthKeys.organizationId, input.organizationId),
          eq(baileysAuthKeys.channelConnectionId, input.channelConnectionId)
        )
      )
  }

  async deleteAll(input: AuthKeyScope): Promise<void> {
    await this.db
      .delete(baileysAuthKeys)
      .where(
        and(
          eq(baileysAuthKeys.organizationId, input.organizationId),
          eq(baileysAuthKeys.channelConnectionId, input.channelConnectionId)
        )
      )
  }
}
