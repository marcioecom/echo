import { createAccessControl } from "better-auth/plugins/access"
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access"

const statement = {
  ...defaultStatements,
} as const

export const ac = createAccessControl(statement)

export const owner = ac.newRole({ ...ownerAc.statements })
export const admin = ac.newRole({ ...adminAc.statements })
export const operator = ac.newRole({ ...memberAc.statements })

export const organizationRoles = { owner, admin, operator } as const

export const organizationRoleNames = ["owner", "admin", "operator"] as const
export type OrganizationRole = (typeof organizationRoleNames)[number]

// TODO: deixar o auth.ts e auth-client.ts aqui?
