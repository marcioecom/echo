import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"

import { matchResult } from "../../../common/match"
import { env } from "../../../config/env"
import {
  getOrganizationAuth,
  guards,
  type OrganizationRequestAuth,
} from "../../../plugins/auth"
import { supportInboxEventBroker } from "../events/support-inbox-event-broker"
import { listSupportConversationsQuerySchema, supportConversationParamsSchema } from "../schemas"
import { getSupportConversationDetail } from "../use-cases/get-support-conversation-detail"
import { listSupportConversations } from "../use-cases/list-support-conversations"

const webAppOrigin = new URL(env.WEB_APP_URL).origin

export function registerSupportInboxRoutes(app: FastifyInstance): void {
  const preHandler = [guards.requireUser, guards.requireMembership()]

  app.get(
    "/v1/support-conversations",
    { preHandler },
    async (request, reply) => {
      const query = listSupportConversationsQuerySchema.safeParse(request.query)
      if (!query.success) {
        return reply.code(400).send({ error: "invalid_query" })
      }

      return withOrganizationAuth(request, reply, async (auth) => {
        const result = await listSupportConversations({
          organizationId: auth.organization.id,
          status: query.data.status,
          cursor: query.data.cursor,
          limit: query.data.limit,
        })

        return matchResult(result, {
          err: (error) => reply.code(400).send({ error: error.type }),
          ok: (value) => reply.send(value),
        })
      })
    }
  )

  app.get(
    "/v1/support-conversations/:conversationId",
    { preHandler },
    async (request, reply) => {
      const params = supportConversationParamsSchema.safeParse(request.params)
      if (!params.success) {
        return reply.code(404).send({ error: "support_conversation_not_found" })
      }

      return withOrganizationAuth(request, reply, async (auth) => {
        const detail = await getSupportConversationDetail({
          organizationId: auth.organization.id,
          conversationId: params.data.conversationId,
        })
        return detail
          ? reply.send(detail)
          : reply.code(404).send({ error: "support_conversation_not_found" })
      })
    }
  )

  app.get(
    "/v1/support-conversations/events",
    {
      websocket: true,
      preValidation: [
        requireWebAppOrigin,
        ...preHandler,
      ],
    },
    (socket, request) => {
      matchResult(getOrganizationAuth(request), {
        err: () => socket.close(),
        ok: (auth) => {
          const unsubscribe = supportInboxEventBroker.subscribe(
            auth.organization.id,
            socket
          )
          socket.once("close", unsubscribe)
          socket.once("error", unsubscribe)
        },
      })
    }
  )
}

function withOrganizationAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  handler: (auth: OrganizationRequestAuth) => Promise<FastifyReply>
): Promise<FastifyReply> {
  return matchResult(getOrganizationAuth(request), {
    err: async (error) => reply.code(403).send({ error: error.type }),
    ok: handler,
  })
}

async function requireWebAppOrigin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (request.headers.origin !== webAppOrigin) {
    await reply.code(403).send({ error: "origin_rejected" })
  }
}
