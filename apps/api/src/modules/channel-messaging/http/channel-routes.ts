import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"

import { matchResult, matchTag } from "@/common/match"
import {
  getOrganizationAuth,
  guards,
  type OrganizationRequestAuth,
} from "@/plugins/auth"

import {
  channelConnectionParamsSchema,
  createChannelBodySchema,
  requestPairingCodeSchema,
  updateChannelConnectionSchema,
} from "../schemas"
import { createBaileysChannelConnection } from "../use-cases/create-baileys-channel-connection"
import { createTwilioChannelConnection } from "../use-cases/create-twilio-channel-connection"
import { deleteChannelConnection } from "../use-cases/delete-channel-connection"
import { listChannelConnections } from "../use-cases/list-channel-connections"
import { requestBaileysPairingCode } from "../use-cases/request-baileys-pairing-code"
import { updateChannelConnection } from "../use-cases/update-channel-connection"

export function registerChannelRoutes(app: FastifyInstance): void {
  const preHandler = [
    guards.requireUser,
    guards.requireMembership({ roles: ["owner", "admin"] }),
  ]

  app.get("/v1/channels", { preHandler }, async (request, reply) => {
    return withOrganizationAuth(request, reply, async (auth) => {
      const channels = await listChannelConnections(auth.organization.id)
      return reply.send(channels)
    })
  })

  app.post("/v1/channels", { preHandler }, async (request, reply) => {
    const body = createChannelBodySchema.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: "invalid_request" })

    return withOrganizationAuth(request, reply, async (auth) => {
      if (body.data.provider === "baileys") {
        const result = await createBaileysChannelConnection({
          organizationId: auth.organization.id,
          operatorUserId: auth.user.id,
          displayName: body.data.displayName,
          inboxId: body.data.inboxId ?? null,
        })
        return matchResult(result, {
          err: (error) =>
            matchTag(error, {
              organization_unavailable: () =>
                reply.code(404).send({ error: "organization_not_found" }),
              session_exists: () =>
                reply.code(409).send({ error: "baileys_session_exists" }),
              routing_conflict: () =>
                reply.code(409).send({ error: "channel_routing_conflict" }),
              queue_unavailable: () =>
                reply.code(503).send({ error: "queue_unavailable" }),
            }),
          ok: (channel) => reply.code(201).send({ channel }),
        })
      }

      const result = await createTwilioChannelConnection({
        organizationId: auth.organization.id,
        operatorUserId: auth.user.id,
        displayName: body.data.displayName,
        address: body.data.address,
        accountSid: body.data.accountSid,
        authToken: body.data.authToken,
        inboxId: body.data.inboxId ?? null,
        sandbox: body.data.sandbox,
      })

      return matchResult(result, {
        err: (error) =>
          matchTag(error, {
            organization_unavailable: () =>
              reply.code(404).send({ error: "organization_not_found" }),
            verification_failed: (value) =>
              reply.code(422).send({
                error: "twilio_verification_failed",
                reason: value.reason,
              }),
            routing_conflict: () =>
              reply.code(409).send({ error: "channel_routing_conflict" }),
          }),
        ok: (channel) => reply.code(201).send({ channel }),
      })
    })
  })

  app.post(
    "/v1/channels/:channelConnectionId/pairing-code",
    { preHandler },
    async (request, reply) => {
      const params = channelConnectionParamsSchema.safeParse(request.params)
      const body = requestPairingCodeSchema.safeParse(request.body)
      if (!params.success || !body.success) {
        return reply.code(400).send({ error: "invalid_request" })
      }

      return withOrganizationAuth(request, reply, async (auth) => {
        const result = await requestBaileysPairingCode({
          organizationId: auth.organization.id,
          channelConnectionId: params.data.channelConnectionId,
          phoneNumber: body.data.phoneNumber,
        })
        return matchResult(result, {
          err: (error) =>
            matchTag(error, {
              organization_unavailable: () =>
                reply.code(404).send({ error: "organization_not_found" }),
              not_found: () =>
                reply.code(404).send({ error: "channel_connection_not_found" }),
              queue_unavailable: () =>
                reply.code(503).send({ error: "queue_unavailable" }),
            }),
          ok: () => reply.code(202).send({ accepted: true }),
        })
      })
    }
  )

  app.patch(
    "/v1/channels/:channelConnectionId",
    { preHandler },
    async (request, reply) => {
      const params = channelConnectionParamsSchema.safeParse(request.params)
      const body = updateChannelConnectionSchema.safeParse(request.body)
      if (!params.success || !body.success) {
        return reply.code(400).send({ error: "invalid_request" })
      }

      return withOrganizationAuth(request, reply, async (auth) => {
        const result = await updateChannelConnection({
          organizationId: auth.organization.id,
          channelConnectionId: params.data.channelConnectionId,
          operatorUserId: auth.user.id,
          ...body.data,
        })
        return matchResult(result, {
          err: (error) =>
            matchTag(error, {
              organization_unavailable: () =>
                reply.code(404).send({ error: "organization_not_found" }),
              not_found: () =>
                reply.code(404).send({ error: "channel_connection_not_found" }),
              missing_address: () =>
                reply.code(409).send({
                  error: "channel_connection_missing_address",
                }),
              session_exists: () =>
                reply.code(409).send({ error: "baileys_session_exists" }),
              queue_unavailable: () =>
                reply.code(503).send({ error: "queue_unavailable" }),
            }),
          ok: (channel) => reply.send({ channel }),
        })
      })
    }
  )

  app.delete(
    "/v1/channels/:channelConnectionId",
    { preHandler },
    async (request, reply) => {
      const params = channelConnectionParamsSchema.safeParse(request.params)
      if (!params.success) {
        return reply.code(400).send({ error: "invalid_request" })
      }

      return withOrganizationAuth(request, reply, async (auth) => {
        const result = await deleteChannelConnection({
          organizationId: auth.organization.id,
          channelConnectionId: params.data.channelConnectionId,
          operatorUserId: auth.user.id,
        })
        return matchResult(result, {
          err: (error) =>
            matchTag(error, {
              organization_unavailable: () =>
                reply.code(404).send({ error: "organization_not_found" }),
              not_found: () =>
                reply.code(404).send({ error: "channel_connection_not_found" }),
            }),
          ok: () => reply.code(204).send(),
        })
      })
    }
  )
}

function withOrganizationAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  handler: (auth: OrganizationRequestAuth) => Promise<unknown>
): Promise<unknown> {
  return matchResult(getOrganizationAuth(request), {
    err: async (error) => reply.code(403).send({ error: error.type }),
    ok: handler,
  })
}
