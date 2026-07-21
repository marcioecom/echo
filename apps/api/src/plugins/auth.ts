import { fromNodeHeaders } from "better-auth/node"
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify"

import type { Auth } from "../modules/auth/auth"

export interface RequestAuthUser {
  id: string
  name: string
  email: string
}

export interface RequestAuthOrganization {
  id: string
  name: string
  slug: string
}

export interface RequestAuthMember {
  id: string
  role: string
}

export interface RequestAuth {
  user: RequestAuthUser
  member: RequestAuthMember | null
  organization: RequestAuthOrganization | null
}

declare module "fastify" {
  interface FastifyRequest {
    auth: RequestAuth | null
  }
}

export interface AuthGuards {
  requireUser: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => Promise<void>
  requireMembership: (options?: {
    roles?: string[]
  }) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>
}

export function registerAuthRoutes(app: FastifyInstance, auth: Auth): void {
  app.decorateRequest("auth", null)

  app.all("/api/auth/*", async (request, reply) => {
    const url = new URL(
      request.url,
      `http://${request.headers.host ?? "localhost"}`,
    )
    const fetchRequest = new Request(url, {
      method: request.method,
      headers: fromNodeHeaders(request.headers),
      body:
        request.body === undefined ? undefined : JSON.stringify(request.body),
    })

    const response = await auth.handler(fetchRequest)

    reply.status(response.status)
    const setCookies = response.headers.getSetCookie()
    if (setCookies.length > 0) {
      reply.header("set-cookie", setCookies)
    }
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "set-cookie") {
        reply.header(key, value)
      }
    })

    return reply.send(await response.text())
  })
}

export function createAuthGuards(auth: Auth): AuthGuards {
  async function requireUser(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    })
    if (!session) {
      return reply.code(401).send({ error: "unauthenticated" })
    }
    request.auth = {
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
      member: null,
      organization: null,
    }
  }

  function requireMembership(options?: { roles?: string[] }) {
    return async (
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void> => {
      const organization = await auth.api
        .getFullOrganization({
          headers: fromNodeHeaders(request.headers),
        })
        .catch(() => null)

      const member = organization?.members.find(
        (entry) => entry.userId === request.auth?.user.id,
      )
      if (!organization || !member) {
        return reply.code(403).send({ error: "membership_required" })
      }

      const memberRoles = member.role.split(",").map((role) => role.trim())
      if (
        options?.roles &&
        !memberRoles.some((role) => options.roles?.includes(role))
      ) {
        return reply.code(403).send({ error: "insufficient_role" })
      }

      request.auth = {
        user: request.auth!.user,
        member: { id: member.id, role: member.role },
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
        },
      }
    }
  }

  return { requireUser, requireMembership }
}
