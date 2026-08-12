import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { ac, admin, operator, owner } from "@workspace/auth"
import { schema, type Database } from "@workspace/db"
import { createId } from "@workspace/domain"
import {
  type SendInvitationEmailJob,
  type SendPasswordResetEmailJob,
} from "@workspace/jobs"
import { createLoggerWithContext } from "@workspace/logger"
import { betterAuth } from "better-auth"
import { organization } from "better-auth/plugins/organization"
import { asc, eq } from "drizzle-orm"

import { env } from "@/config/env"
import { database } from "@/lib/db"
import { jobs } from "@/lib/jobs-client"

export interface CreateAuthOptions {
  db: Database
  secret: string
  baseURL: string
  webAppUrl: string
  emailAssetBaseUrl: string
  deliverInvitationEmail: (request: SendInvitationEmailJob) => Promise<void>
  deliverPasswordResetEmail: (request: SendPasswordResetEmailJob) => Promise<void>
  onDeliveryError?: (error: unknown, request: SendInvitationEmailJob) => void
}

export function createAuth(options: CreateAuthOptions) {
  return betterAuth({
    baseURL: options.baseURL,
    secret: options.secret,
    trustedOrigins: [options.webAppUrl],
    database: drizzleAdapter(options.db, {
      provider: "pg",
      usePlural: true,
    }),
    advanced: {
      database: {
        generateId: createId,
      },
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
      ...(env.NODE_ENV !== "development" &&
        env.BETTER_AUTH_COOKIE_DOMAIN && {
          crossSubDomainCookies: {
            enabled: true,
            domain: env.BETTER_AUTH_COOKIE_DOMAIN,
          },
        }),
    },
    emailAndPassword: {
      enabled: true,
      resetPasswordTokenExpiresIn: 30 * 60,
      revokeSessionsOnPasswordReset: true,
      async sendResetPassword({ user, url }) {
        await options.deliverPasswordResetEmail({
          email: user.email,
          resetUrl: url,
          logoUrl: new URL(
            "/brand/echo-logo-horizontal.png",
            options.emailAssetBaseUrl
          ).toString(),
        })
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const [membership] = await options.db
              .select({ organizationId: schema.members.organizationId })
              .from(schema.members)
              .where(eq(schema.members.userId, session.userId))
              .orderBy(asc(schema.members.createdAt))
              .limit(1)
            return {
              data: {
                ...session,
                activeOrganizationId: membership?.organizationId ?? null,
              },
            }
          },
        },
      },
    },
    plugins: [
      organization({
        teams: { enabled: false },
        // Our ULID invitation ids are opaque (80-bit random), so the emailed
        // link alone proves mailbox ownership. Better Auth cannot infer that
        // from a custom generateId and would otherwise demand verified emails.
        requireEmailVerificationOnInvitation: false,
        ac,
        roles: {
          owner,
          admin,
          operator,
        },
        async sendInvitationEmail(data) {
          const request: SendInvitationEmailJob = {
            invitationId: data.id,
            email: data.email,
            inviterName: data.inviter.user.name,
            organizationName: data.organization.name,
            inviteUrl: `${options.webAppUrl}/accept-invitation/${data.id}`,
            logoUrl: new URL(
              "/brand/echo-logo-horizontal.png",
              options.emailAssetBaseUrl
            ).toString(),
          }
          try {
            await options.deliverInvitationEmail(request)
          } catch (error) {
            options.onDeliveryError?.(error, request)
          }
        },
        schema: {
          organization: {
            additionalFields: {
              status: {
                type: "string",
                required: true,
                defaultValue: "active",
                input: false,
              },
              archivedAt: {
                type: "date",
                required: false,
                input: false,
              },
            },
          },
        },
      }),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>

const logger = createLoggerWithContext("api:auth")

export const auth = createAuth({
  db: database.db,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.PUBLIC_API_URL,
  webAppUrl: env.WEB_APP_URL,
  emailAssetBaseUrl: env.EMAIL_ASSET_BASE_URL,
  deliverInvitationEmail: async (request) => {
    await jobs.enqueue("send-invitation-email", request)
  },
  deliverPasswordResetEmail: async (request) => {
    await jobs.enqueue("send-password-reset-email", request)
  },
  onDeliveryError: (error, request) => {
    logger.error("failed to enqueue invitation email", {
      error,
      invitationId: request.invitationId,
    })
  },
})
