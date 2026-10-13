import { t, type MessageKey } from "@/lib/i18n"

const roleKeys = {
  owner: "members.roles.owner",
  admin: "members.roles.admin",
  operator: "members.roles.operator",
} as const satisfies Record<string, MessageKey>

export function memberRoleLabel(role: string) {
  if (role === "owner" || role === "admin" || role === "operator") {
    return t(roleKeys[role])
  }
  return role
}
