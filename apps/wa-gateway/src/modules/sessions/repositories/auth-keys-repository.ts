export interface StoredAuthKey {
  keyType: string
  keyId: string
  ciphertext: string
  nonce: string
  authTag: string
  keyVersion: string
}

export interface AuthKeyScope {
  organizationId: string
  channelConnectionId: string
}

export interface AuthKeysRepository {
  read(
    input: AuthKeyScope & { keyType: string; keyId: string }
  ): Promise<StoredAuthKey | null>
  write(
    input: AuthKeyScope & {
      upserts: StoredAuthKey[]
      deletes: Array<{ keyType: string; keyId: string }>
    }
  ): Promise<void>
  list(input: AuthKeyScope): Promise<StoredAuthKey[]>
  deleteAll(input: AuthKeyScope): Promise<void>
}

export class MemoryAuthKeyRepository implements AuthKeysRepository {
  private readonly rows = new Map<string, StoredAuthKey>()

  async read(
    input: AuthKeyScope & { keyType: string; keyId: string }
  ): Promise<StoredAuthKey | null> {
    return this.rows.get(this.mapKey(input)) ?? null
  }

  async write(
    input: AuthKeyScope & {
      upserts: StoredAuthKey[]
      deletes: Array<{ keyType: string; keyId: string }>
    }
  ): Promise<void> {
    for (const key of input.deletes) {
      this.rows.delete(this.mapKey({ ...input, ...key }))
    }
    for (const row of input.upserts) {
      this.rows.set(this.mapKey({ ...input, ...row }), row)
    }
  }

  async list(input: AuthKeyScope): Promise<StoredAuthKey[]> {
    const prefix = `${input.organizationId}:${input.channelConnectionId}:`
    return [...this.rows.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, row]) => row)
  }

  async deleteAll(input: AuthKeyScope): Promise<void> {
    const prefix = `${input.organizationId}:${input.channelConnectionId}:`
    for (const key of [...this.rows.keys()]) {
      if (key.startsWith(prefix)) this.rows.delete(key)
    }
  }

  private mapKey(
    input: AuthKeyScope & { keyType: string; keyId: string }
  ): string {
    return [
      input.organizationId,
      input.channelConnectionId,
      input.keyType,
      input.keyId,
    ].join(":")
  }
}
