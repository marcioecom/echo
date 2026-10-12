import {
  BufferJSON,
  initAuthCreds,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataSet,
  type SignalDataTypeMap,
} from "@whiskeysockets/baileys"
import type {
  ChannelCredentialContext,
  IChannelCredentialsCipher,
} from "@workspace/messaging"

import type {
  AuthKeyScope,
  BaileysAuthKeyRepository,
  StoredAuthKey,
} from "./auth-key-repository"

const CREDS_TYPE = "creds"
const CREDS_ID = "creds"

export interface EchoAuthState {
  state: AuthenticationState
  saveCreds: () => Promise<void>
  flush: () => Promise<void>
  clear: () => Promise<void>
}

export async function useEchoAuthState(input: {
  organizationId: string
  channelConnectionId: string
  cipher: IChannelCredentialsCipher
  repository: BaileysAuthKeyRepository
  flushDelayMs?: number
  batchSize?: number
}): Promise<EchoAuthState> {
  const scope: AuthKeyScope = {
    organizationId: input.organizationId,
    channelConnectionId: input.channelConnectionId,
  }
  const flushDelayMs = input.flushDelayMs ?? 1_000
  const batchSize = input.batchSize ?? 25
  const creds = await readCreds(input.cipher, input.repository, scope)
  const buffer = new KeyWriteBuffer({
    scope,
    cipher: input.cipher,
    repository: input.repository,
    flushDelayMs,
    batchSize,
  })

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => buffer.get(type, ids),
        set: async (data) => {
          buffer.enqueue(data)
          await buffer.flushReady()
        },
      },
    },
    saveCreds: () => writeCreds(input.cipher, input.repository, scope, creds),
    flush: () => buffer.flush(),
    clear: async () => {
      await buffer.flush()
      buffer.dropPending()
      await input.repository.deleteAll(scope)
    },
  }
}

export async function rotateBaileysAuthKeys(input: {
  organizationId: string
  channelConnectionId: string
  repository: BaileysAuthKeyRepository
  from: IChannelCredentialsCipher
  to: IChannelCredentialsCipher
}): Promise<number> {
  const scope: AuthKeyScope = {
    organizationId: input.organizationId,
    channelConnectionId: input.channelConnectionId,
  }
  const rows = await input.repository.list(scope)
  const upserts = rows.map((row) => {
    const context = keyContext(scope, row.keyType, row.keyId)
    const plaintext = input.from.decrypt(toEncrypted(row), context)
    return {
      keyType: row.keyType,
      keyId: row.keyId,
      ...input.to.encrypt(plaintext, context),
    }
  })
  if (upserts.length > 0) {
    await input.repository.write({ ...scope, upserts, deletes: [] })
  }
  return upserts.length
}

class KeyWriteBuffer {
  private readonly pending = new Map<string, PendingKey>()
  private waiters: Array<{
    resolve: () => void
    reject: (error: unknown) => void
  }> = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private flushing: Promise<void> | null = null

  constructor(
    private readonly options: {
      scope: AuthKeyScope
      cipher: IChannelCredentialsCipher
      repository: BaileysAuthKeyRepository
      flushDelayMs: number
      batchSize: number
    }
  ) {}

  enqueue(data: SignalDataSet): void {
    for (const [keyType, entries] of Object.entries(data)) {
      if (!entries) continue
      for (const [keyId, value] of Object.entries(entries)) {
        const mapKey = `${keyType}\0${keyId}`
        if (value == null) {
          this.pending.set(mapKey, { kind: "delete", keyType, keyId })
          continue
        }
        this.pending.set(mapKey, {
          kind: "upsert",
          keyType,
          keyId,
          plaintext: JSON.stringify(value, BufferJSON.replacer),
        })
      }
    }
  }

  async get<T extends keyof SignalDataTypeMap>(
    type: T,
    ids: string[]
  ): Promise<{ [id: string]: SignalDataTypeMap[T] }> {
    const result: { [id: string]: SignalDataTypeMap[T] } = {}
    for (const id of ids) {
      const pending = this.pending.get(`${type}\0${id}`)
      if (pending?.kind === "delete") continue
      if (pending?.kind === "upsert") {
        result[id] = deserializeKey(type, pending.plaintext)
        continue
      }
      const row = await this.options.repository.read({
        ...this.options.scope,
        keyType: type,
        keyId: id,
      })
      if (!row) continue
      const plaintext = this.options.cipher.decrypt(
        toEncrypted(row),
        keyContext(this.options.scope, type, id)
      )
      result[id] = deserializeKey(type, plaintext)
    }
    return result
  }

  async flushReady(): Promise<void> {
    if (this.pending.size >= this.options.batchSize) {
      await this.flush()
      return
    }
    await new Promise<void>((resolve, reject) => {
      this.waiters.push({ resolve, reject })
      this.timer ??= setTimeout(() => {
        this.flush().catch(() => undefined)
      }, this.options.flushDelayMs)
    })
  }

  async flush(): Promise<void> {
    if (this.flushing) {
      await this.flushing
      if (this.pending.size === 0) return
    }
    if (this.pending.size === 0 && this.waiters.length === 0) return

    const run = this.persist().finally(() => {
      this.flushing = null
    })
    this.flushing = run
    await run
    if (this.pending.size > 0) await this.flush()
  }

  dropPending(): void {
    this.pending.clear()
  }

  private async persist(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    const batch = new Map(this.pending)
    const waiting = this.waiters.splice(0)
    this.pending.clear()
    if (batch.size === 0) {
      for (const waiter of waiting) waiter.resolve()
      return
    }

    const upserts: StoredAuthKey[] = []
    const deletes: Array<{ keyType: string; keyId: string }> = []
    for (const entry of batch.values()) {
      if (entry.kind === "delete") {
        deletes.push({ keyType: entry.keyType, keyId: entry.keyId })
        continue
      }
      upserts.push({
        keyType: entry.keyType,
        keyId: entry.keyId,
        ...this.options.cipher.encrypt(
          entry.plaintext,
          keyContext(this.options.scope, entry.keyType, entry.keyId)
        ),
      })
    }

    try {
      await this.options.repository.write({
        ...this.options.scope,
        upserts,
        deletes,
      })
      for (const waiter of waiting) waiter.resolve()
    } catch (error) {
      for (const [key, value] of batch) {
        if (!this.pending.has(key)) this.pending.set(key, value)
      }
      for (const waiter of waiting) waiter.reject(error)
      throw error
    }
  }
}

type PendingKey =
  | { kind: "delete"; keyType: string; keyId: string }
  | { kind: "upsert"; keyType: string; keyId: string; plaintext: string }

async function readCreds(
  cipher: IChannelCredentialsCipher,
  repository: BaileysAuthKeyRepository,
  scope: AuthKeyScope
): Promise<AuthenticationCreds> {
  const row = await repository.read({
    ...scope,
    keyType: CREDS_TYPE,
    keyId: CREDS_ID,
  })
  if (!row) return initAuthCreds()
  const plaintext = cipher.decrypt(
    toEncrypted(row),
    keyContext(scope, CREDS_TYPE, CREDS_ID)
  )
  return JSON.parse(plaintext, BufferJSON.reviver) as AuthenticationCreds
}

async function writeCreds(
  cipher: IChannelCredentialsCipher,
  repository: BaileysAuthKeyRepository,
  scope: AuthKeyScope,
  creds: AuthenticationCreds
): Promise<void> {
  const plaintext = JSON.stringify(creds, BufferJSON.replacer)
  await repository.write({
    ...scope,
    deletes: [],
    upserts: [
      {
        keyType: CREDS_TYPE,
        keyId: CREDS_ID,
        ...cipher.encrypt(plaintext, keyContext(scope, CREDS_TYPE, CREDS_ID)),
      },
    ],
  })
}

function keyContext(
  scope: AuthKeyScope,
  keyType: string,
  keyId: string
): ChannelCredentialContext {
  return {
    organizationId: scope.organizationId,
    channelConnectionId: scope.channelConnectionId,
    provider: "baileys",
    keyType,
    keyId,
  }
}

function toEncrypted(row: StoredAuthKey) {
  return {
    ciphertext: row.ciphertext,
    nonce: row.nonce,
    authTag: row.authTag,
    keyVersion: row.keyVersion,
  }
}

function deserializeKey<T extends keyof SignalDataTypeMap>(
  type: T,
  plaintext: string
): SignalDataTypeMap[T] {
  const value = JSON.parse(
    plaintext,
    BufferJSON.reviver
  ) as SignalDataTypeMap[T]
  if (type === "app-state-sync-key" && value && typeof value === "object") {
    return proto.Message.AppStateSyncKeyData.fromObject(
      value as { [key: string]: unknown }
    ) as unknown as SignalDataTypeMap[T]
  }
  return value
}
