import { createDatabase, type DatabaseClient } from "@workspace/db"
import {
  baileysAuthKeys,
  channelConnectionProviderBindings,
  channelConnections,
  channelSessionStates,
  organizations,
} from "@workspace/db/schema"
import { createId } from "@workspace/domain"
import { eq, like } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("@/config/env", () => ({
  env: {
    CHANNEL_CREDENTIALS_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
    CHANNEL_CREDENTIALS_KEY_VERSION: "v1",
  },
}))
vi.mock("@/lib/db", () => ({
  database: { db: {} },
}))

import { ChannelCredentialsCipher } from "@workspace/messaging"

import { RoutingConflictError } from "../errors"
import { PostgresAuthKeysRepository } from "./postgres-auth-keys-repository"
import { PostgresSessionDirectory } from "./session-directory"

const ORG_SLUG_PREFIX = "wa-gw-session-dir-"

describe("PostgresSessionDirectory", () => {
  let client: DatabaseClient
  let directory: PostgresSessionDirectory
  let authKeys: PostgresAuthKeysRepository
  const cipher = new ChannelCredentialsCipher({
    encryptionKey: Buffer.alloc(32, 9).toString("base64"),
    keyVersion: "v1",
  })

  const credentials = {
    credentialsCiphertext: "ciphertext",
    credentialsNonce: "nonce",
    credentialsAuthTag: "tag",
    credentialsKeyVersion: "v1",
  }

  beforeAll(() => {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL is required (pnpm infra:up and apps/wa-gateway/.env)"
      )
    }
    const dependencyTimeoutMs = Number(process.env.DEPENDENCY_TIMEOUT_MS ?? 5000)
    client = createDatabase(databaseUrl, dependencyTimeoutMs)
    directory = new PostgresSessionDirectory(client.db)
    authKeys = new PostgresAuthKeysRepository(client.db)
  })

  afterAll(async () => {
    await deleteTestOrganizations()
    await client?.close()
  })

  async function deleteTestOrganizations(): Promise<void> {
    const testOrgs = await client.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(like(organizations.slug, `${ORG_SLUG_PREFIX}%`))

    for (const { id: organizationId } of testOrgs) {
      await client.db
        .delete(baileysAuthKeys)
        .where(eq(baileysAuthKeys.organizationId, organizationId))
      await client.db
        .delete(channelSessionStates)
        .where(eq(channelSessionStates.organizationId, organizationId))
      await client.db
        .delete(channelConnectionProviderBindings)
        .where(
          eq(channelConnectionProviderBindings.organizationId, organizationId)
        )
      await client.db
        .delete(channelConnections)
        .where(eq(channelConnections.organizationId, organizationId))
      await client.db
        .delete(organizations)
        .where(eq(organizations.id, organizationId))
    }
  }

  async function createOrganization(
    label: string,
    status: "active" | "archived" = "active"
  ): Promise<string> {
    const id = createId()
    const slug = `${ORG_SLUG_PREFIX}${label}-${createId()}`
    await client.db.insert(organizations).values({
      id,
      name: slug,
      slug,
      status,
      createdAt: new Date(),
    })
    return id
  }

  async function seedBaileysConnection(input: {
    organizationId: string
    state:
      | "connecting"
      | "qr_pending"
      | "pairing_code_pending"
      | "connected"
      | "logged_out"
    status?: "pending" | "active" | "disabled"
    address?: string | null
    connectionId?: string
  }): Promise<string> {
    const channelConnectionId = input.connectionId ?? createId()
    const pendingAddress = input.address ?? `pending:${channelConnectionId}`
    await client.db.insert(channelConnections).values({
      id: channelConnectionId,
      organizationId: input.organizationId,
      channelType: "whatsapp",
      name: "Baileys",
      address: input.address ?? null,
      status: input.status ?? "pending",
    })
    await client.db.insert(channelConnectionProviderBindings).values({
      organizationId: input.organizationId,
      channelConnectionId,
      provider: "baileys",
      externalAccountId: pendingAddress,
      externalSenderId: pendingAddress,
      routingAddress: pendingAddress,
      ...credentials,
    })
    await client.db.insert(channelSessionStates).values({
      organizationId: input.organizationId,
      channelConnectionId,
      state: input.state,
    })
    return channelConnectionId
  }

  it("lists all resumable Baileys connections for active orgs sorted by connection id", async () => {
    const organizationId = await createOrganization("resumable")
    const firstId = createId()
    const secondId = createId()
    await seedBaileysConnection({
      organizationId,
      connectionId: secondId,
      state: "qr_pending",
    })
    await seedBaileysConnection({
      organizationId,
      connectionId: firstId,
      state: "connected",
      status: "active",
      address: "+5511999000001",
    })
    const archivedOrgId = await createOrganization("archived-org", "archived")
    await seedBaileysConnection({
      organizationId: archivedOrgId,
      state: "connecting",
    })
    await seedBaileysConnection({
      organizationId,
      state: "logged_out",
    })

    const resumable = await directory.findResumable()
    const ours = resumable.filter((row) => row.organizationId === organizationId)

    expect(ours).toEqual([
      { organizationId, channelConnectionId: firstId },
      { organizationId, channelConnectionId: secondId },
    ])
  })

  it("claims ownership, fences state writes, and releases", async () => {
    const organizationId = await createOrganization("claim")
    const channelConnectionId = await seedBaileysConnection({
      organizationId,
      state: "connecting",
    })
    const ref = { organizationId, channelConnectionId }
    const ownerToken = createId()
    const otherToken = createId()

    expect(
      await directory.claim({ ...ref, ownerToken, ownerPod: "pod-a" })
    ).toBe(true)
    expect(await directory.isOwner({ ...ref, ownerToken })).toBe(true)
    expect(await directory.isOwner({ ...ref, ownerToken: otherToken })).toBe(
      false
    )

    expect(
      await directory.setState({
        ...ref,
        ownerToken,
        state: "qr_pending",
        lastError: null,
      })
    ).toBe(true)
    expect(
      await directory.setState({
        ...ref,
        ownerToken: otherToken,
        state: "connected",
        lastError: null,
      })
    ).toBe(false)

    const [session] = await client.db
      .select({ state: channelSessionStates.state })
      .from(channelSessionStates)
      .where(eq(channelSessionStates.channelConnectionId, channelConnectionId))
    expect(session?.state).toBe("qr_pending")

    expect(
      await directory.release({ ...ref, ownerToken })
    ).toBe(true)
    expect(await directory.isOwner({ ...ref, ownerToken })).toBe(false)
  })

  it("does not resurrect session state rows via setState", async () => {
    const organizationId = await createOrganization("no-resurrect")
    const channelConnectionId = await seedBaileysConnection({
      organizationId,
      state: "connecting",
    })
    const ref = { organizationId, channelConnectionId }
    const ownerToken = createId()

    await client.db
      .delete(channelSessionStates)
      .where(eq(channelSessionStates.channelConnectionId, channelConnectionId))

    expect(
      await directory.setState({
        ...ref,
        ownerToken,
        state: "qr_pending",
        lastError: null,
      })
    ).toBe(false)

    const rows = await client.db
      .select({ id: channelSessionStates.id })
      .from(channelSessionStates)
      .where(eq(channelSessionStates.channelConnectionId, channelConnectionId))
    expect(rows).toHaveLength(0)
  })

  it("isOwner is false when the organization is no longer active", async () => {
    const organizationId = await createOrganization("archived-owner")
    const channelConnectionId = await seedBaileysConnection({
      organizationId,
      state: "connecting",
    })
    const ref = { organizationId, channelConnectionId }
    const ownerToken = createId()

    await directory.claim({ ...ref, ownerToken, ownerPod: "pod-a" })
    expect(await directory.isOwner({ ...ref, ownerToken })).toBe(true)

    await client.db
      .update(organizations)
      .set({ status: "archived" })
      .where(eq(organizations.id, organizationId))

    expect(await directory.isOwner({ ...ref, ownerToken })).toBe(false)
  })

  it("rejects fenced writes after token revocation or connection disable", async () => {
    const organizationId = await createOrganization("revoked")
    const channelConnectionId = await seedBaileysConnection({
      organizationId,
      state: "connecting",
    })
    const ref = { organizationId, channelConnectionId }
    const ownerToken = createId()

    await directory.claim({ ...ref, ownerToken, ownerPod: "pod-a" })

    await client.db
      .update(channelSessionStates)
      .set({ ownerToken: null })
      .where(eq(channelSessionStates.channelConnectionId, channelConnectionId))

    expect(
      await directory.setState({
        ...ref,
        ownerToken,
        state: "pairing_code_pending",
        lastError: null,
      })
    ).toBe(false)

    await directory.claim({ ...ref, ownerToken, ownerPod: "pod-b" })
    await client.db
      .update(channelConnections)
      .set({ status: "disabled" })
      .where(eq(channelConnections.id, channelConnectionId))

    expect(
      await directory.setState({
        ...ref,
        ownerToken,
        state: "disconnected",
        lastError: "disabled",
      })
    ).toBe(false)
  })

  it("marks connected only for the current owner", async () => {
    const organizationId = await createOrganization("mark-connected")
    const channelConnectionId = await seedBaileysConnection({
      organizationId,
      state: "qr_pending",
    })
    const ref = { organizationId, channelConnectionId }
    const ownerToken = createId()

    await directory.claim({ ...ref, ownerToken, ownerPod: "pod-a" })
    const address = "+5511999887766"
    expect(
      await directory.markConnected({
        ...ref,
        ownerToken,
        address,
        userJid: `${address.replace("+", "")}@s.whatsapp.net`,
      })
    ).toBe(true)

    const [connection] = await client.db
      .select({
        address: channelConnections.address,
        status: channelConnections.status,
        state: channelSessionStates.state,
      })
      .from(channelConnections)
      .innerJoin(
        channelSessionStates,
        eq(channelSessionStates.channelConnectionId, channelConnections.id)
      )
      .where(eq(channelConnections.id, channelConnectionId))

    expect(connection).toMatchObject({
      address,
      status: "active",
      state: "connected",
    })

    expect(
      await directory.markConnected({
        ...ref,
        ownerToken: createId(),
        address: "+5511999887767",
        userJid: "5511999887767@s.whatsapp.net",
      })
    ).toBe(false)
  })

  it("throws routing conflict when pairing the same real number twice", async () => {
    const organizationId = await createOrganization("routing-conflict")
    const sharedAddress = "+5511888776655"
    const firstConnectionId = await seedBaileysConnection({
      organizationId,
      state: "qr_pending",
    })
    const secondConnectionId = await seedBaileysConnection({
      organizationId,
      state: "qr_pending",
    })
    const firstToken = createId()
    const secondToken = createId()

    await directory.claim({
      organizationId,
      channelConnectionId: firstConnectionId,
      ownerToken: firstToken,
      ownerPod: "pod-a",
    })
    await directory.markConnected({
      organizationId,
      channelConnectionId: firstConnectionId,
      ownerToken: firstToken,
      address: sharedAddress,
      userJid: "5511888776655@s.whatsapp.net",
    })

    await directory.claim({
      organizationId,
      channelConnectionId: secondConnectionId,
      ownerToken: secondToken,
      ownerPod: "pod-a",
    })

    await expect(
      directory.markConnected({
        organizationId,
        channelConnectionId: secondConnectionId,
        ownerToken: secondToken,
        address: sharedAddress,
        userJid: "5511888776655@s.whatsapp.net",
      })
    ).rejects.toBeInstanceOf(RoutingConflictError)
  })

  it("fences auth key writes on owner token and connection status", async () => {
    const organizationId = await createOrganization("auth-fence")
    const channelConnectionId = await seedBaileysConnection({
      organizationId,
      state: "connecting",
    })
    const ref = { organizationId, channelConnectionId }
    const ownerToken = createId()
    const staleToken = createId()
    const scope = { ...ref, ownerToken }

    await directory.claim({ ...ref, ownerToken, ownerPod: "pod-a" })

    const encrypted = cipher.encrypt("{}", {
      organizationId,
      channelConnectionId,
      provider: "baileys",
      keyType: "creds",
      keyId: "creds",
    })
    await authKeys.write({
      ...scope,
      upserts: [{ keyType: "creds", keyId: "creds", ...encrypted }],
      deletes: [],
    })

    const initial = await authKeys.read({
      ...scope,
      keyType: "creds",
      keyId: "creds",
    })
    expect(initial).not.toBeNull()

    await authKeys.write({
      ...scope,
      ownerToken: staleToken,
      upserts: [{ keyType: "creds", keyId: "creds", ...encrypted }],
      deletes: [],
    })
    const afterStale = await authKeys.read({
      ...scope,
      keyType: "creds",
      keyId: "creds",
    })
    expect(afterStale?.ciphertext).toBe(initial?.ciphertext)

    await client.db
      .update(channelSessionStates)
      .set({ ownerToken: null })
      .where(eq(channelSessionStates.channelConnectionId, channelConnectionId))

    await authKeys.write({
      ...scope,
      upserts: [{ keyType: "creds", keyId: "creds", ...encrypted }],
      deletes: [],
    })

    const newToken = createId()
    await directory.claim({ ...ref, ownerToken: newToken, ownerPod: "pod-b" })
    const rotated = cipher.encrypt('{"registered":true}', {
      organizationId,
      channelConnectionId,
      provider: "baileys",
      keyType: "creds",
      keyId: "creds",
    })
    await authKeys.write({
      ...ref,
      ownerToken: newToken,
      upserts: [{ keyType: "creds", keyId: "creds", ...rotated }],
      deletes: [],
    })
    const row = await authKeys.read({
      ...ref,
      ownerToken: newToken,
      keyType: "creds",
      keyId: "creds",
    })
    expect(row?.ciphertext).toBe(rotated.ciphertext)
  })
})
