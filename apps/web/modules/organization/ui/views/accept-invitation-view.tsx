"use client"

import { Button } from "@workspace/ui/components/button"

import { t } from "@/lib/i18n"
import { useAcceptInvitation } from "@/modules/organization/hooks/use-accept-invitation"

export function AcceptInvitationView({
  invitationId,
}: {
  invitationId: string
}) {
  const { invitation, isInvalid, acceptMutation } =
    useAcceptInvitation(invitationId)

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <h1 className="text-lg font-medium">{t("members.accept.title")}</h1>
          {invitation ? (
            <p className="text-sm text-muted-foreground">
              {t("members.accept.invitedBefore")}{" "}
              <strong>{invitation.organizationName}</strong>{" "}
              {t("members.accept.invitedAfter")}
            </p>
          ) : isInvalid ? (
            <p className="text-sm text-destructive">
              {t("members.accept.invalid")}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("members.accept.loading")}
            </p>
          )}
        </div>
        <Button
          onClick={() => acceptMutation.mutate()}
          disabled={acceptMutation.isPending || !invitation}
          className="w-full"
        >
          {acceptMutation.isPending
            ? t("members.accept.accepting")
            : t("members.accept.submit")}
        </Button>
      </div>
    </div>
  )
}
