import { t } from "@/lib/i18n"

export function membersHead() {
  return {
    meta: [{ title: t("members.metaTitle") }],
  }
}

export function acceptInvitationHead() {
  return {
    meta: [{ title: t("members.accept.metaTitle") }],
  }
}
